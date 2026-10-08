#!/usr/bin/env python3
"""
Exports Swedish regulations and citation graphs from regtech.db (SQLite)
directly into src/data/swedish_regulations.json for Nordic RegTech Studio.
"""
import sqlite3
import json
from pathlib import Path
from collections import defaultdict

PIPELINE_DIR = Path(__file__).resolve().parent
DB_PATH = PIPELINE_DIR / "data" / "regtech.db"
OUTPUT_PATH = PIPELINE_DIR.parent / "src" / "data" / "swedish_regulations.json"

def export():
    if not DB_PATH.exists():
        print(f"Error: {DB_PATH} does not exist.")
        return

    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    # 1. Fetch citations grouped by (document_id, chunk_id)
    citations_map = defaultdict(list)
    for row in c.execute("""
        SELECT document_id, chunk_id, citing_label, target_document_id, target_chunk_id
        FROM citations
    """).fetchall():
        doc_id, chunk_id, citing_label, target_doc_id, target_chunk_id = row
        key = (doc_id, chunk_id)
        citations_map[key].append({
            "regId": target_doc_id,
            "targetSectionId": target_chunk_id,
            "label": citing_label
        })

    # 2. Fetch all documents
    docs = []
    rows = c.execute("SELECT id, source, identifier, title, json FROM documents").fetchall()
    print(f"Exporting {len(rows)} documents from SQLite...")

    for row in rows:
        doc_id, source, identifier, title, doc_json_str = row
        data = json.loads(doc_json_str)

        is_sfs = source == "riksdagen"
        jurisdiction = "Sweden (Riksdagen)" if is_sfs else "Sweden (Finansinspektionen)"
        authority = "Riksdagen" if is_sfs else "Finansinspektionen (FI)"
        doc_type = "national_act" if is_sfs else "fsa_regulation"

        # Group sections into chapters
        sections = data.get("sections", [])
        chapters_dict = {}

        for sec in sections:
            ch_num = sec.get("chapter") or "Allmänt"
            ch_title = sec.get("chapter_title") or ""
            ch_key = (ch_num, ch_title)
            
            if ch_key not in chapters_dict:
                ch_label = f"{ch_num} kap." if ch_num != "Allmänt" and not str(ch_num).lower().endswith("kap.") else str(ch_num)
                chapters_dict[ch_key] = {
                    "number": ch_label,
                    "title": ch_title,
                    "sections": []
                }

            sec_id = sec.get("id") or f"{doc_id}-{len(chapters_dict[ch_key]['sections'])}"
            sec_refs = citations_map.get((doc_id, sec.get("id")), [])

            chapters_dict[ch_key]["sections"].append({
                "id": f"{doc_id}-{sec_id}",
                "number": sec.get("section") or "§",
                "heading": sec.get("heading") or "",
                "text": sec.get("text") or "",
                "crossRefs": sec_refs,
                "status": "UNCHANGED"
            })

        chapters_list = list(chapters_dict.values())

        # If doc has preamble or no chapters, ensure a chapter exists for the preamble
        if not chapters_list and data.get("preamble"):
            chapters_list.append({
                "number": "Säädösteksti",
                "title": "",
                "sections": [{
                    "id": f"{doc_id}-preamble",
                    "number": "1 §",
                    "heading": "Voimaantulo ja soveltaminen",
                    "text": data.get("preamble"),
                    "crossRefs": [],
                    "status": "UNCHANGED"
                }]
            })

        tags = ["Sweden"]
        if is_sfs:
            tags.append("SFS")
            tags.append("Lag")
        else:
            tags.append("FFFS")
            tags.append("Föreskrifter")

        docs.append({
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
            "summary": (data.get("preamble") or title)[:250],
            "chapters": chapters_list
        })

    # Sort docs by identifier
    docs.sort(key=lambda d: d["code"])

    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(docs, f, ensure_ascii=False, indent=2)

    file_size_mb = OUTPUT_PATH.stat().st_size / (1024 * 1024)
    print(f"✅ Successfully wrote {len(docs)} regulations ({file_size_mb:.2f} MB) to {OUTPUT_PATH}")

if __name__ == "__main__":
    export()
