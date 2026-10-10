#!/usr/bin/env python3
"""
Exports Swedish regulations and citation graphs from regtech.db (SQLite)
directly into src/data/swedish_regulations.json and src/data/changes_feed.json
for Nordic RegTech Studio.
Preserves rich metadata: attachments (PDF, Besluts-PM memo, source URL),
amendments lineage, authorizations (delegated authority), rule types (guidance vs binding),
bidirectional citation graphs, section version diffs, and the change feed.
"""
import json
import sqlite3
import sys
from collections import Counter, defaultdict
from pathlib import Path

PIPELINE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(PIPELINE_DIR / "src"))
from regtech.versions import text_diff

DB_PATH = PIPELINE_DIR / "data" / "regtech.db"
RAW_DIR = PIPELINE_DIR / "data" / "raw"
OUTPUT_PATH = PIPELINE_DIR.parent / "src" / "data" / "swedish_regulations.json"
FEED_OUTPUT_PATH = PIPELINE_DIR.parent / "src" / "data" / "changes_feed.json"

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
    id_to_title = {}
    id_to_source = {}
    ident_to_id = {}
    amendments_by_target = defaultdict(list)

    for row in doc_rows:
        doc_id, source, identifier, title, amends, _ = row
        id_to_ident[doc_id] = identifier
        id_to_title[doc_id] = title
        id_to_source[doc_id] = source
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

    # 3. Fetch version changes
    changes_map = {}
    feed_events = []
    has_changes_table = c.execute(
        "SELECT count(*) FROM sqlite_master WHERE type='table' AND name='changes'"
    ).fetchone()[0]

    if has_changes_table:
        changes_rows = c.execute("""
            SELECT id, document_id, level, chapter, section, upcoming, ordinal, status,
                   old_text, new_text, amending_act, amended_date, fetched_at
            FROM changes
            ORDER BY id ASC
        """).fetchall()
        print(f"Loaded {len(changes_rows)} changes from changes table.")

        for r in changes_rows:
            cid, doc_id, level, chapter, section, upcoming, ordinal, status, old_text, new_text, amending_act, amended_date, fetched_at = r
            diff_parts = []
            if old_text and new_text:
                diff_parts = [
                    [op, text]
                    for op, text in text_diff(old_text, new_text)
                ]

            ch_info = {
                "id": cid,
                "docId": doc_id,
                "level": level,
                "chapter": chapter,
                "section": section,
                "upcoming": bool(upcoming),
                "ordinal": ordinal,
                "status": status,
                "amendingAct": amending_act,
                "amendedDate": amended_date,
                "fetchedAt": fetched_at,
                "oldText": old_text,
                "newText": new_text,
                "diff": diff_parts,
            }
            changes_map[(doc_id, chapter, section, bool(upcoming), ordinal)] = ch_info

            raw_src = id_to_source.get(doc_id, "")
            src_val = "fffs" if raw_src in ("fi_fffs", "fffs") else "riksdagen"
            feed_events.append({
                "id": cid,
                "docId": doc_id,
                "code": id_to_ident.get(doc_id, doc_id),
                "title": id_to_title.get(doc_id, ""),
                "source": src_val,
                "level": level,
                "chapter": chapter,
                "section": section,
                "upcoming": bool(upcoming),
                "status": status,
                "amendingAct": amending_act,
                "amendedDate": amended_date,
                "fetchedAt": fetched_at,
                "oldText": old_text,
                "newText": new_text,
                "diff": diff_parts,
            })

    # Add authentic FFFS supervisory amendment events from the 276 amending acts
    fffs_event_id = 5000
    for row in doc_rows:
        doc_id, source, identifier, title, amends, doc_json_str = row
        if source != "fi_fffs" or not amends:
            continue
        data = json.loads(doc_json_str)
        eff_date = data.get("effective_date")
        fetched_at = data.get("updated_at", "2026-10-10T00:00:00Z")
        secs = data.get("sections", [])
        base_id = ident_to_id.get(amends, amends)

        if secs:
            for s in secs[:3]:
                fffs_event_id += 1
                feed_events.append({
                    "id": fffs_event_id,
                    "docId": base_id,
                    "code": amends,
                    "title": id_to_title.get(base_id, title),
                    "source": "fffs",
                    "level": "section",
                    "chapter": s.get("chapter"),
                    "section": s.get("section"),
                    "upcoming": False,
                    "status": "MODIFIED",
                    "amendingAct": identifier,
                    "amendedDate": eff_date,
                    "fetchedAt": fetched_at,
                    "oldText": None,
                    "newText": s.get("full_text"),
                    "diff": [],
                })
        else:
            fffs_event_id += 1
            feed_events.append({
                "id": fffs_event_id,
                "docId": base_id,
                "code": amends,
                "title": id_to_title.get(base_id, title),
                "source": "fffs",
                "level": "document",
                "chapter": None,
                "section": None,
                "upcoming": False,
                "status": "MODIFIED",
                "amendingAct": identifier,
                "amendedDate": eff_date,
                "fetchedAt": fetched_at,
                "oldText": None,
                "newText": None,
                "diff": [],
            })

    # 4. Assemble document models
    docs = []

    for row in doc_rows:
        doc_id, source, identifier, title, amends, doc_json_str = row
        data = json.loads(doc_json_str)

        is_sfs = source == "riksdagen"
        is_fffs = not is_sfs
        jurisdiction = "Sweden (Riksdagen)" if is_sfs else "Sweden (Finansinspektionen)"
        authority = "Riksdagen" if is_sfs else "Finansinspektionen (FI)"
        doc_type = "national_act" if is_sfs else "fsa_regulation"

        # Group sections into chapters
        sections = data.get("sections", [])
        chapters_dict = {}
        seen_sec_keys = Counter()

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

            sec_key = (sec.get("chapter"), sec.get("section"), bool(sec.get("upcoming")))
            ordinal = seen_sec_keys[sec_key]
            seen_sec_keys[sec_key] += 1
            change_info = changes_map.get((doc_id, *sec_key, ordinal))

            sec_status = change_info["status"] if change_info else "UNCHANGED"
            amending_act = change_info["amendingAct"] if change_info else None
            amended_date = change_info["amendedDate"] if change_info else None

            sec_data = {
                "id": sec_id,
                "number": sec_num,
                "heading": sec.get("heading") or "",
                "text": sec.get("full_text") or sec.get("text") or "",
                "ruleType": sec_rule_type,
                "status": sec_status,
            }
            if sec_refs:
                sec_data["crossRefs"] = sec_refs

            if change_info:
                sec_data["amendingAct"] = amending_act
                sec_data["amendedDate"] = amended_date
                sec_data["change"] = {
                    "id": change_info["id"],
                    "status": change_info["status"],
                    "amendingAct": change_info["amendingAct"],
                    "amendedDate": change_info["amendedDate"],
                    "oldText": change_info["oldText"],
                    "newText": change_info["newText"],
                    "diff": change_info["diff"],
                }
                # Also link back chunkId to feed event
                change_info["chunkId"] = sec_id

            # Omit redundant paragraphs array; sec_data["text"] contains the authentic statutory text

            if sec.get("upcoming") or (change_info and change_info.get("upcoming")):
                sec_data["upcoming"] = True
            if sec.get("in_force_from") or amended_date:
                sec_data["inForceFrom"] = sec.get("in_force_from") or amended_date
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

        # Local document serving assets (M2.1)
        local_pdf = data.get("local_pdf_path")
        if not local_pdf and is_fffs:
            cand = f"fi_fffs/{doc_id}/regulation.pdf"
            if (RAW_DIR / cand).is_file():
                local_pdf = cand
            else:
                cand_cons = f"fi_fffs/{doc_id}/consolidated.pdf"
                if (RAW_DIR / cand_cons).is_file():
                    local_pdf = cand_cons
        if local_pdf and (RAW_DIR / local_pdf).is_file():
            doc_obj["localPdf"] = local_pdf

        local_memo = data.get("local_memo_path")
        if not local_memo and is_fffs:
            cand_memo = f"fi_fffs/{doc_id}/memo.pdf"
            if (RAW_DIR / cand_memo).is_file():
                local_memo = cand_memo
        if local_memo and (RAW_DIR / local_memo).is_file():
            doc_obj["localMemo"] = local_memo

        local_source = data.get("local_source_path")
        if not local_source:
            if is_fffs:
                cand_item = f"fi_fffs/{doc_id}/item.html"
                if (RAW_DIR / cand_item).is_file():
                    local_source = cand_item
            else:
                cand_sfs = f"riksdagen/documents/{doc_id}.json"
                if (RAW_DIR / cand_sfs).is_file():
                    local_source = cand_sfs
        if local_source and (RAW_DIR / local_source).is_file():
            doc_obj["localSource"] = local_source
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
        json.dump(docs, f, ensure_ascii=False, separators=(",", ":"))

    file_size_mb = OUTPUT_PATH.stat().st_size / (1024 * 1024)
    print(f"✅ Successfully exported {len(docs)} regulations ({file_size_mb:.2f} MB) to {OUTPUT_PATH}")

    # Link chunkIds to feed_events from changes_map
    for ev in feed_events:
        matching_ch = changes_map.get((
            ev["docId"],
            ev["chapter"],
            ev["section"],
            ev["upcoming"],
            ev.get("ordinal", 0)
        ))
        if matching_ch and "chunkId" in matching_ch:
            ev["chunkId"] = matching_ch["chunkId"]

    # Sort feed_events in descending event ID order (newest first)
    feed_events.sort(key=lambda e: e["id"], reverse=True)

    with open(FEED_OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(feed_events, f, ensure_ascii=False, indent=2)

    feed_size_kb = FEED_OUTPUT_PATH.stat().st_size / 1024
    print(f"✅ Successfully exported {len(feed_events)} change events ({feed_size_kb:.1f} KB) to {FEED_OUTPUT_PATH}")


if __name__ == "__main__":
    export()
