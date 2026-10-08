#!/usr/bin/env python3
"""
Exports Swedish regulations and citation graphs from regtech.db (SQLite)
directly into src/data/swedish_regulations.json for Nordic RegTech Studio.
Preserves rich metadata: attachments (PDF, Besluts-PM memo, source URL),
amendments lineage, authorizations (delegated authority), rule types (guidance vs binding),
and bidirectional citation graphs.
"""
import json
import sqlite3
from collections import defaultdict
from pathlib import Path

PIPELINE_DIR = Path(__file__).resolve().parent
DB_PATH = PIPELINE_DIR / "data" / "regtech.db"
OUTPUT_PATH = PIPELINE_DIR.parent / "src" / "data" / "swedish_regulations.json"

CHAINED_LINKS_SQL = """
SELECT outer_link.document_id, outer_link.chunk_id, outer_link.citing_label,
       inner_link.target_document_id, inner_link.target_chunk_id,
       inner_link.citing_label AS via_label
FROM citations AS inner_link
JOIN citations AS outer_link ON outer_link.target_chunk_id = inner_link.chunk_id
WHERE inner_link.citing_is_bemyndigande = 1
"""


def export():
    if not DB_PATH.exists():
        print(f"Error: {DB_PATH} does not exist.")
        return

    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    # 1. Fetch all documents and build lookup tables
    doc_rows = c.execute(
        "SELECT id, source, identifier, title, amends, json FROM documents"
    ).fetchall()
    print(f"Exporting {len(doc_rows)} documents from SQLite...")

    id_to_ident = {}
    ident_to_id = {}
    amendments_by_target = defaultdict(list)

    for row in doc_rows:
        doc_id, source, identifier, title, amends, _ = row
        id_to_ident[doc_id] = identifier
        ident_to_id[identifier] = doc_id
        if amends:
            amendments_by_target[amends].append(
                {
                    "id": doc_id,
                    "code": identifier,
                }
            )

    # 2. Precompute citations
    outgoing_map = defaultdict(list)
    incoming_by_chunk = defaultdict(list)
    incoming_by_doc = defaultdict(list)
    total_incoming_by_doc = defaultdict(int)

    # Auth citation map: (doc_id, citation_index) -> (target_doc_id, target_chunk_id)
    auth_citations_map = {}

    seen_incoming = set()

    # Fetch direct citations
    for row in c.execute("""
        SELECT document_id, chunk_id, citing_label, citation_index, raw_text, target_document_id, target_chunk_id
        FROM citations
    """).fetchall():
        doc_id, chunk_id, citing_label, cit_idx, raw_text, target_doc_id, target_chunk_id = row
        total_incoming_by_doc[target_doc_id] += 1

        if chunk_id is None:
            auth_citations_map[(doc_id, cit_idx)] = (target_doc_id, target_chunk_id)

        # Outgoing cross reference
        out_entry = {
            "label": raw_text,
            "regId": target_doc_id,
        }
        if target_chunk_id:
            out_entry["targetSectionId"] = target_chunk_id
        outgoing_map[(doc_id, chunk_id)].append(out_entry)

        # Incoming reference
        inc_key = (target_chunk_id or target_doc_id, doc_id, chunk_id, None)
        if inc_key not in seen_incoming:
            seen_incoming.add(inc_key)
            inc_entry = {
                "docId": doc_id,
                "code": id_to_ident.get(doc_id, doc_id),
                "chunkId": chunk_id,
                "label": citing_label,
            }
            if target_chunk_id:
                incoming_by_chunk[target_chunk_id].append(inc_entry)
            else:
                incoming_by_doc[target_doc_id].append(inc_entry)

    # Fetch chained citations
    for row in c.execute(CHAINED_LINKS_SQL).fetchall():
        doc_id, chunk_id, citing_label, target_doc_id, target_chunk_id, via_label = row
        inc_key = (target_chunk_id or target_doc_id, doc_id, chunk_id, via_label)
        if inc_key not in seen_incoming:
            seen_incoming.add(inc_key)
            inc_entry = {
                "docId": doc_id,
                "code": id_to_ident.get(doc_id, doc_id),
                "chunkId": chunk_id,
                "label": citing_label,
                "via": via_label,
            }
            if target_chunk_id:
                incoming_by_chunk[target_chunk_id].append(inc_entry)
            else:
                incoming_by_doc[target_doc_id].append(inc_entry)

    # 3. Assemble document models
    docs = []

    for row in doc_rows:
        doc_id, source, identifier, title, amends, doc_json_str = row
        data = json.loads(doc_json_str)

        is_sfs = source == "riksdagen"
        jurisdiction = "Sweden (Riksdagen)" if is_sfs else "Sweden (Finansinspektionen)"
        authority = "Riksdagen" if is_sfs else "Finansinspektionen (FI)"
        doc_type = "national_act" if is_sfs else "fsa_regulation"

        # Group sections into chapters
        sections = data.get("sections", [])
        chapters_dict = {}

        for sec in sections:
            ch_num = sec.get("chapter") or "General"
            ch_title = sec.get("chapter_title") or ""
            ch_key = (ch_num, ch_title)

            if ch_key not in chapters_dict:
                if (
                    ch_num != "General"
                    and not str(ch_num).lower().endswith("kap.")
                    and not str(ch_num).lower().startswith("chapter")
                ):
                    ch_label = f"Chapter {ch_num}"
                elif str(ch_num).lower().endswith("kap."):
                    num_part = str(ch_num)[:-4].strip()
                    ch_label = f"Chapter {num_part}"
                else:
                    ch_label = str(ch_num)

                chapters_dict[ch_key] = {
                    "number": ch_label,
                    "title": ch_title,
                    "sections": [],
                }

            chunk_id = sec.get("chunk_id")
            cur_sec_count = len(chapters_dict[ch_key]["sections"])
            sec_id = chunk_id or f"{doc_id}-{cur_sec_count}"
            sec_refs = outgoing_map.get((doc_id, chunk_id), [])
            inc_refs = incoming_by_chunk.get(chunk_id, [])

            sec_num = sec.get("section") or "§"
            if not sec_num.endswith("§"):
                sec_num = f"{sec_num} §"

            # Check rule type and paragraphs
            paras = sec.get("paragraphs", [])
            has_guidance = any(p.get("rule_type") == "guidance" for p in paras)
            has_binding = any(p.get("rule_type") in ("binding_rule", "binding", None) for p in paras)

            if has_guidance and has_binding:
                sec_rule_type = "mixed"
            elif has_guidance:
                sec_rule_type = "guidance"
            elif has_binding:
                sec_rule_type = "binding_rule"
            else:
                sec_rule_type = None

            sec_data = {
                "id": sec_id,
                "number": sec_num,
                "heading": sec.get("heading") or "",
                "text": sec.get("full_text") or sec.get("text") or "",
                "ruleType": sec_rule_type,
                "crossRefs": sec_refs,
                "status": "UNCHANGED",
            }

            if paras:
                sec_data["paragraphs"] = [
                    {
                        "text": p.get("text") or "",
                        "ruleType": p.get("rule_type") or "binding_rule",
                        "points": p.get("points") or [],
                    }
                    for p in paras
                ]

            if sec.get("upcoming"):
                sec_data["upcoming"] = True
            if sec.get("in_force_from"):
                sec_data["inForceFrom"] = sec.get("in_force_from")
            if sec.get("in_force_until"):
                sec_data["inForceUntil"] = sec.get("in_force_until")
            if inc_refs:
                sec_data["incomingRefs"] = inc_refs

            chapters_dict[ch_key]["sections"].append(sec_data)

        chapters_list = list(chapters_dict.values())

        preamble_text = data.get("preamble")
        preamble_outgoing = outgoing_map.get((doc_id, None), [])
        preamble_incoming = incoming_by_doc.get(doc_id, [])

        # If doc has preamble and no chapters, provide statutory chapter
        if not chapters_list and preamble_text:
            chapters_list.append(
                {
                    "number": "Statutory text",
                    "title": "",
                    "sections": [
                        {
                            "id": f"{doc_id}-preamble",
                            "number": "1 §",
                            "heading": "Provisions & Application",
                            "text": preamble_text,
                            "crossRefs": preamble_outgoing,
                            "incomingRefs": preamble_incoming,
                            "status": "UNCHANGED",
                        }
                    ],
                }
            )

        tags = ["Sweden"]
        if is_sfs:
            tags.append("SFS")
            tags.append("Statute")
        else:
            tags.append("FFFS")
            tags.append("Regulation")

        # Resolve authorizations
        raw_auths = data.get("authorizations", [])
        resolved_auths = []
        for idx, a in enumerate(raw_auths):
            target_doc = a.get("target_document")
            # First check if SQL citations resolved target doc/chunk
            sql_target = auth_citations_map.get((doc_id, idx))
            t_doc_id = sql_target[0] if sql_target else ident_to_id.get(target_doc)
            t_chunk_id = sql_target[1] if sql_target else None

            resolved_auths.append(
                {
                    "rawText": a.get("raw_text") or "",
                    "citationType": a.get("citation_type") or "external",
                    "targetDoc": target_doc,
                    "targetDocId": t_doc_id,
                    "targetChunkId": t_chunk_id,
                }
            )

        amends_target = data.get("amends")
        amends_id = ident_to_id.get(amends_target) if amends_target else None

        doc_summary = (preamble_text or title)[:250]

        doc_obj = {
            "id": doc_id,
            "code": identifier,
            "title": title,
            "shortTitle": identifier,
            "jurisdiction": jurisdiction,
            "authority": authority,
            "type": doc_type,
            "inForce": data.get("effective_date") or data.get("issue_date") or "2026-01-01",
            "status": "In force",
            "tags": tags,
            "summary": doc_summary,
            "chapters": chapters_list,
        }

        # Rich metadata fields from original UI
        if data.get("issue_date"):
            doc_obj["issueDate"] = data.get("issue_date")
        if data.get("effective_date"):
            doc_obj["effectiveDate"] = data.get("effective_date")
        if data.get("latest_amendment"):
            doc_obj["latestAmendment"] = data.get("latest_amendment")
        if data.get("pdf_url"):
            doc_obj["pdfUrl"] = data.get("pdf_url")
        if data.get("memo_url"):
            doc_obj["memoUrl"] = data.get("memo_url")
        if data.get("source_url"):
            doc_obj["sourceUrl"] = data.get("source_url")
        if amends_target:
            doc_obj["amends"] = amends_target
            if amends_id:
                doc_obj["amendsId"] = amends_id
        if amendments_by_target.get(identifier):
            doc_obj["amendments"] = amendments_by_target[identifier]
        if resolved_auths:
            doc_obj["authorizations"] = resolved_auths
        if total_incoming_by_doc.get(doc_id):
            doc_obj["incomingCount"] = total_incoming_by_doc[doc_id]
        if preamble_incoming:
            doc_obj["incomingRefs"] = preamble_incoming
        if preamble_text:
            doc_obj["preamble"] = preamble_text

        docs.append(doc_obj)

    # Sort docs by identifier
    docs.sort(key=lambda d: d["code"])

    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(docs, f, ensure_ascii=False, indent=2)

    file_size_mb = OUTPUT_PATH.stat().st_size / (1024 * 1024)
    print(f"✅ Successfully exported {len(docs)} regulations ({file_size_mb:.2f} MB) to {OUTPUT_PATH}")


if __name__ == "__main__":
    export()
