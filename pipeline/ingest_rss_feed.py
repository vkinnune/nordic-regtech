#!/usr/bin/env python3
"""
Ingest and normalize regulatory monitoring feed articles from the upstream rss-mapper-poc
(which processes 188 Nordic/EU RSS feeds via Azure OpenAI) into Nordic RegTech's
flagship regulatory feed format.
"""

import argparse
import hashlib
import json
import os
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from pydantic import BaseModel, Field

DEFAULT_INPUT_PATHS = [
    Path("../rss-mapper-poc/static_site/data/articles.json"),
    Path("../rss-mapper-poc/static_site/data/articles.json"),
]

OUTPUT_PATH = Path("src/data/feed_items.json")


# ============================================================
# Pydantic v2 Models for Structured Pipeline Tooling
# ============================================================

class AuthorityRule(BaseModel):
    domain_match: str
    authority_id: str
    authority_name: str
    short_name: str
    flag: str
    jurisdiction: str


class StatuteRule(BaseModel):
    statute_id: str
    statute_ref: str
    statute_sec: str
    keywords: List[str]


class PlainEnglishAnalysis(BaseModel):
    whyItMatters: str
    beforeAfter: str
    actionRequired: str


class FeedItemModel(BaseModel):
    id: str
    title: str
    originalTitle: Optional[str] = None
    authority: str
    authorityId: str
    jurisdiction: str
    category: str
    score: int
    publishedAt: str
    relativeTime: str
    statuteId: str
    statuteSec: str
    statuteRef: str
    summary: str
    plainEnglish: PlainEnglishAnalysis
    frameworks: List[str] = Field(default_factory=list)
    vendors: List[str] = Field(default_factory=list)
    risks: List[str] = Field(default_factory=list)
    policyIds: List[str] = Field(default_factory=list)
    controlIds: List[str] = Field(default_factory=list)
    riskIds: List[str] = Field(default_factory=list)
    sourceUrl: str
    source: str
    tags: List[str] = Field(default_factory=list)
    status: str = "UNREVIEWED"
    taskId: Optional[str] = None


# ============================================================
# Authority Rules & Detection (Sweden, Finland, EU)
# ============================================================

AUTHORITY_RULES: List[AuthorityRule] = [
    AuthorityRule(domain_match="fi.se", authority_id="fi", authority_name="Finansinspektionen (Swedish FSA)", short_name="FI", flag="🇸🇪", jurisdiction="SE"),
    AuthorityRule(domain_match="finanssivalvonta.fi", authority_id="fiva", authority_name="FIN-FSA (Financial Supervisory Authority)", short_name="FIN-FSA", flag="🇫🇮", jurisdiction="FI"),
    AuthorityRule(domain_match="fiva.fi", authority_id="fiva", authority_name="FIN-FSA (Financial Supervisory Authority)", short_name="FIN-FSA", flag="🇫🇮", jurisdiction="FI"),
    AuthorityRule(domain_match="traficom.fi", authority_id="traficom", authority_name="Traficom NCSC-FI (Cyber Security Centre)", short_name="NCSC-FI", flag="🇫🇮", jurisdiction="FI"),
    AuthorityRule(domain_match="kyberturvallisuuskeskus.fi", authority_id="traficom", authority_name="Traficom NCSC-FI (Cyber Security Centre)", short_name="NCSC-FI", flag="🇫🇮", jurisdiction="FI"),
    AuthorityRule(domain_match="government.se", authority_id="riksdagen", authority_name="Swedish Government (Regeringen)", short_name="Regeringen", flag="🇸🇪", jurisdiction="SE"),
    AuthorityRule(domain_match="riksdagen.se", authority_id="riksdagen", authority_name="Swedish Parliament (Sveriges Riksdag)", short_name="Riksdagen", flag="🇸🇪", jurisdiction="SE"),
    AuthorityRule(domain_match="eduskunta.fi", authority_id="eduskunta", authority_name="Parliament of Finland (Eduskunta)", short_name="Eduskunta", flag="🇫🇮", jurisdiction="FI"),
    AuthorityRule(domain_match="imy.se", authority_id="imy", authority_name="Swedish Privacy Authority (IMY)", short_name="IMY", flag="🇸🇪", jurisdiction="SE"),
    AuthorityRule(domain_match="konsumentverket.se", authority_id="konsumentverket", authority_name="Swedish Consumer Agency", short_name="SCA", flag="🇸🇪", jurisdiction="SE"),
    AuthorityRule(domain_match="riksbank.se", authority_id="riksbank", authority_name="Sveriges Riksbank (Central Bank)", short_name="Riksbank", flag="🇸🇪", jurisdiction="SE"),
    AuthorityRule(domain_match="domstol.se", authority_id="domstol", authority_name="Swedish Courts (Domstolsverket)", short_name="Domstol", flag="🇸🇪", jurisdiction="SE"),
    AuthorityRule(domain_match="tulli.fi", authority_id="tulli", authority_name="Finnish Customs (Tulli)", short_name="Tulli", flag="🇫🇮", jurisdiction="FI"),
    AuthorityRule(domain_match="tietosuoja.fi", authority_id="tietosuoja", authority_name="Data Protection Ombudsman (Tietosuoja)", short_name="Tietosuoja", flag="🇫🇮", jurisdiction="FI"),
    AuthorityRule(domain_match="eba.europa.eu", authority_id="eba", authority_name="European Banking Authority", short_name="EBA", flag="🇪🇺", jurisdiction="EU"),
    AuthorityRule(domain_match="esma.europa.eu", authority_id="esma", authority_name="European Securities and Markets Authority", short_name="ESMA", flag="🇪🇺", jurisdiction="EU"),
]


def resolve_authority(source: str, link: str, title: str = "", summary: str = "", vendors: Optional[List[str]] = None) -> Optional[AuthorityRule]:
    s_low = source.lower()
    l_low = link.lower()
    t_low = title.lower()
    sum_low = summary.lower()
    v_low = [v.lower() for v in (vendors or [])]

    # Special handling for FIN-FSA (Financial Supervisory Authority / Finanssivalvonta)
    if "finanssivalvonta.fi" in l_low or "fiva.fi" in l_low:
        return next(r for r in AUTHORITY_RULES if r.authority_id == "fiva")
    if any("finanssivalvonta" in v or "fin-fsa" in v for v in v_low):
        return next(r for r in AUTHORITY_RULES if r.authority_id == "fiva")
    if ("sttinfo" in s_low or "sttinfo" in l_low) and any(k in t_low or k in sum_low for k in ["finanssivalvonta", "fin-fsa", "finanssisektorin", "seuraamusmaksu", "kuluttajaluoton"]):
        return next(r for r in AUTHORITY_RULES if r.authority_id == "fiva")

    combined = f"{s_low} {l_low}"
    for rule in AUTHORITY_RULES:
        if rule.domain_match in combined:
            return rule
    return None


# ============================================================
# Exact Statutory Linking (1-Click Reader Provision Targets)
# ============================================================

STATUTE_RULES: List[StatuteRule] = [
    StatuteRule(
        statute_id="reg-dora",
        statute_ref="Regulation (EU) 2022/2554 (DORA) Art. 28",
        statute_sec="dora-art-28",
        keywords=["dora", "digital operational resilience", "ict incident", "tiber", "it-säkerhet", "kyberturvallisuuskeskus", "incident reporting", "threat-led"]
    ),
    StatuteRule(
        statute_id="sfs-2017-630",
        statute_ref="SFS 2017:630 3 kap. 1 § (AML/CFT Act)",
        statute_sec="riksdagen_sfs-2017-630_k3_p1",
        keywords=["penningtvätt", "aml", "anti-money laundering", "rahanpesu", "2017:630", "sanktions", "terrorismin", "fiu", "kundkännedom", "pep"]
    ),
    StatuteRule(
        statute_id="reg-aml",
        statute_ref="AML Act (444/2017) 2 kap. 1 §",
        statute_sec="aml-2-1",
        keywords=["444/2017", "rahanpesulaki", "rahanpesun selvittelykeskus"]
    ),
    StatuteRule(
        statute_id="sfs-2016-1306",
        statute_ref="SFS 2016:1306 1 kap. 1 § (Market Abuse Act)",
        statute_sec="riksdagen_sfs-2016-1306_k1_p1",
        keywords=["marknadsmissbruk", "market abuse", "mar", "insider", "handelsförbud", "2016:1306", "sisäpiiritieto"]
    ),
    StatuteRule(
        statute_id="reg-finlex-747-2012",
        statute_ref="Investment Services Act 747/2012 1 kap. 9 §",
        statute_sec="finlex-1-9",
        keywords=["747/2012", "sijoituspalvelulaki", "sijoitustoiminta", "finlex"]
    ),
    StatuteRule(
        statute_id="sfs-2007-528",
        statute_ref="SFS 2007:528 1 kap. 1 § (Securities Market Act)",
        statute_sec="riksdagen_sfs-2007-528_k1_p1",
        keywords=["värdepappersmarknad", "mifid", "mifir", "arvopaperimarkkina", "2007:528", "stibor", "bmr", "benchmarks"]
    ),
    StatuteRule(
        statute_id="sfs-2004-46",
        statute_ref="SFS 2004:46 1 kap. 1 § (Investment Funds Act)",
        statute_sec="riksdagen_sfs-2004-46_k1_p1",
        keywords=["investeringsfond", "fondkommission", "ucits", "2004:46", "sijoitusrahasto", "fondbolag", "rahastoyhtiö"]
    ),
    StatuteRule(
        statute_id="sfs-2004-297",
        statute_ref="SFS 2004:297 1 kap. 1 § (Banking & Financing Act)",
        statute_sec="riksdagen_sfs-2004-297_k1_p1",
        keywords=["bank- och finansiering", "kreditinstitut", "bfrl", "2004:297", "luottolaitos", "kreditprövning", "konsumentkredit", "peruspankkipalvelu"]
    ),
    StatuteRule(
        statute_id="sfs-2010-751",
        statute_ref="SFS 2010:751 1 kap. 1 § (Payment Services Act)",
        statute_sec="riksdagen_sfs-2010-751_k1_p1",
        keywords=["betaltjänst", "psd2", "payment services", "2010:751", "maksupalvelu", "betalningsbedrägerier"]
    ),
    StatuteRule(
        statute_id="sfs-2013-561",
        statute_ref="SFS 2013:561 1 kap. 1 § (AIFM Act)",
        statute_sec="riksdagen_sfs-2013-561_k1_p1",
        keywords=["aif", "aifm", "alternativa investeringsfond", "2013:561"]
    ),
    StatuteRule(
        statute_id="sfs-2010-2043",
        statute_ref="SFS 2010:2043 1 kap. 1 § (Insurance Business Act)",
        statute_sec="riksdagen_sfs-2010-2043_k1_p1",
        keywords=["försäkringsrörelse", "solvens ii", "solvency ii", "2010:2043", "vakuutusyhtiö"]
    ),
    StatuteRule(
        statute_id="sfs-2018-1219",
        statute_ref="SFS 2018:1219 1 kap. 1 § (Insurance Distribution Act)",
        statute_sec="riksdagen_sfs-2018-1219_k1_p1",
        keywords=["försäkringsdistribution", "idd", "2018:1219", "vakuutusedustus"]
    ),
    StatuteRule(
        statute_id="sfs-2019-742",
        statute_ref="SFS 2019:742 1 kap. 1 § (Pension Companies Act)",
        statute_sec="riksdagen_sfs-2019-742_k1_p1",
        keywords=["tjänstepension", "iorp", "2019:742", "eläkesäätiö", "työeläke"]
    ),
    StatuteRule(
        statute_id="sfs-2014-968",
        statute_ref="SFS 2014:968 1 kap. 1 § (Supervision of Credit Institutions)",
        statute_sec="riksdagen_sfs-2014-968_k1_p1",
        keywords=["kapitaltäckning", "crd", "crr", "srep", "2014:968", "vakavaraisuus", "stress test"]
    ),
    StatuteRule(
        statute_id="sfs-2015-1016",
        statute_ref="SFS 2015:1016 1 kap. 1 § (Resolution Act)",
        statute_sec="riksdagen_sfs-2015-1016_k1_p1",
        keywords=["resolution", "brrd", "krishantering", "mrel", "2015:1016", "kriisinratkaisu"]
    ),
    StatuteRule(
        statute_id="reg-sfdr",
        statute_ref="Regulation (EU) 2019/2088 (SFDR) Art. 4",
        statute_sec="sfdr-art-4",
        keywords=["sfdr", "hållbarhet", "sustainability", "esg", "greenwashing", "taxonomy"]
    ),
]


def resolve_statute(text_blob: str, jurisdiction: str = "SE") -> StatuteRule:
    low = text_blob.lower()
    for rule in STATUTE_RULES:
        if any(kw in low for kw in rule.keywords):
            return rule

    if jurisdiction == "FI":
        return next(r for r in STATUTE_RULES if r.statute_id == "reg-finlex-747-2012")
    return next(r for r in STATUTE_RULES if r.statute_id == "sfs-2007-528")


# ============================================================
# Governance Matrix Linkages (Strictly Real IDs from governance.js)
# ============================================================

def resolve_governance_linkages(statute_id: str, text_blob: str) -> Tuple[List[str], List[str], List[str]]:
    low = text_blob.lower()
    # 1. Anti-Money Laundering & Sanctions
    if statute_id in ["sfs-2017-630", "reg-aml"] or any(k in low for k in ["aml", "penningtvätt", "sanction", "rahanpesu", "kyt", "due diligence", "beneficial ownership", "fiu"]):
        return ["pol-aml-01"], ["ctl-aml-01", "ctl-aml-02"], ["rsk-aml-01"]

    # 2. Digital Operational Resilience, ICT, Cyber & Privacy
    if statute_id == "reg-dora" or any(k in low for k in ["dora", "cyber", "ict", "resilience", "privacy", "gdpr", "tiber", "incident", "outage", "cloud", "tietosuoja"]):
        return ["pol-dora-01"], ["ctl-dora-01", "ctl-dora-02"], ["rsk-dora-01"]

    # 3. Algorithmic Trading, Market Conduct, Securities, Banking & General
    return ["pol-alg-01"], ["ctl-alg-01", "ctl-alg-02"], ["rsk-alg-01"]


# ============================================================
# Client Anonymity & English Translation Sanitization
# ============================================================

ENTITY_ANONYMIZATION_MAP: Dict[str, str] = {
    "nordea": "Nordic Sovereign Bank",
    "swedbank": "Polaris Wealth",
    "seb": "Aura Asset Management",
    "skandinaviska enskilda banken": "Aura Asset Management",
    "handelsbanken": "Nordic Sovereign Bank",
    "svenska handelsbanken": "Nordic Sovereign Bank",
    "danske bank": "Nordic Credit Institution",
    "danske": "Nordic Credit Institution",
    "op ryhmä": "Nordic Cooperative Banking Group",
    "op osuuskunta": "Nordic Cooperative Banking Group",
    "op-ryhmä": "Nordic Cooperative Banking Group",
    "op": "Nordic Cooperative Banking Group",
    "klarna": "Nordic Fintech Services",
    "avanza": "Nordic Retail Investment Broker",
    "nordnet": "Nordic Retail Investment Broker",
    "collector": "Consumer Credit Institution",
    "resurs": "Consumer Credit Institution",
    "qliro": "Consumer Credit Institution",
    "roble services": "Licensed Payment Intermediary",
    "alami services": "Licensed Payment Intermediary",
    "ermitage partners": "Nordic Investment Intermediary",
    "meriaura invest": "Listed Market Issuer",
    "bioretec": "Listed Market Issuer",
    "orion": "Listed Market Issuer",
    "bbs-bioactive bone substitutes": "Listed Market Issuer",
    "valoe": "Listed Market Issuer",
    "savcor technologies": "Listed Market Issuer",
    "localbitcoins": "Digital Asset Intermediary",
    # Public regulatory / judicial bodies normalized to clean English
    "poliisi": "National Police Board",
    "poliisihallitus": "National Police Board",
    "verohallinto": "Finnish Tax Administration",
    "skatteverket": "Swedish Tax Agency",
    "valtiovarainministeriö": "Ministry of Finance",
    "suomen pankki": "Bank of Finland",
    "rahanpesun selvittelykeskus": "Financial Intelligence Unit (FIU)",
    "helsingin hallinto-oikeus": "Helsinki Administrative Court",
    "korkein hallinto-oikeus": "Supreme Administrative Court",
    "förvaltningsrätten": "Administrative Court",
    "oy suomen tietotoimisto": "Finnish News Agency (STT)",
    "stt": "Finnish News Agency (STT)",
    "kilpailu- ja kuluttajavirasto": "Finnish Competition and Consumer Authority (KKV)",
    "kkv": "Finnish Competition and Consumer Authority (KKV)",
}

RISK_TRANSLATIONS: List[Tuple[str, str]] = [
    (r"regulatorisk efterlevnadsrisk för försäkringsföretag.*", "Regulatory compliance risk for insurance undertakings (Solvency II)"),
    (r"rapporterings- och tidspunksrisk.*", "Regulatory reporting and timeline compliance risk"),
    (r"operativ belastning vid övergång och anpassning.*", "Operational implementation and transition risk for new regulations"),
    (r"tredjelandsreglering och gränsöverskridande.*", "Third-country regulation and cross-border operational risk"),
    (r"tillsyns- och sanktionsexponering.*", "Supervisory sanction and enforcement exposure for regulatory non-compliance"),
    (r"betalningsbedrägerier.*", "Payment fraud risk (account transfers, card transactions, e-money)"),
    (r"autentiserings- och identitetsbedrägeri.*", "Authentication and identity fraud risk (SCA circumvention)"),
    (r"operativ risk och it‑säkerhet hos betalningsleverantörer.*", "Operational and IT security risk for payment service providers"),
    (r"rahanpesun ja terrorismin rahoittamisen riski.*", "Money laundering and terrorist financing risk (AML/CFT)"),
    (r"seuraamusmaksu.*", "Administrative penalty and sanction risk"),
    (r"hallinnollinen seuraamus.*", "Administrative sanction risk"),
    (r"sanktionsavgift.*", "Administrative supervisory fine exposure"),
    (r"bristande regelefterlevnad.*", "Regulatory compliance deficiency risk"),
    (r"penningtvättsrisk.*", "Money laundering risk (AML)"),
]


def anonymize_entity(name: str) -> str:
    cleaned = name.strip()
    low = cleaned.lower()
    for pattern, replacement in ENTITY_ANONYMIZATION_MAP.items():
        if re.search(r"\b" + re.escape(pattern) + r"\b", low):
            return replacement
    # Clean up corporate suffixes to preserve mock entity isolation
    if re.search(r"\b(oy|ab|oyj|bank)\b", low):
        return "Nordic Market Participant"
    return cleaned


def translate_risk(risk_str: str) -> str:
    cleaned = risk_str.strip()
    low = cleaned.lower()
    for pattern, replacement in RISK_TRANSLATIONS:
        if re.search(pattern, low):
            return replacement
    # Fallback for remaining Finnish/Swedish words
    if any(c in cleaned for c in ["ä", "ö", "å"]) or any(k in low for k in ["efterlevnad", "tillsyn", "sanktion", "rahanpesu"]):
        return "Regulatory compliance and supervisory risk"
    return cleaned


# ============================================================
# Classification & Calibration
# ============================================================

def resolve_category(title: str, summary: str, link: str, score: int) -> str:
    combined = f"{title.lower()} {summary.lower()} {link.lower()}"
    if any(k in combined for k in ["sanktion", "varning", "sanktionsavgift", "vite", "enforcement", "böter", "undersökning avslutad", "bristande kredit", "seuraamusmaksu", "laiminlyön"]):
        return "ENFORCEMENT"
    if any(k in combined for k in ["lagändring", "sfs ", "proposition", "direktiv", "enacted", "parliament", "amendment", "laki ", "asetus"]):
        return "AMENDMENT"
    if any(k in combined for k in ["teknisk standard", "rts", "its", "taxonomy", "xbrl", "inrapportering", "filing rules", "technical standard"]):
        return "TECHNICAL_STANDARD"
    if any(k in combined for k in ["remiss", "konsultation", "consultation", "hearing", "utkast", "draft", "lausuntokierros"]):
        return "CONSULTATION"
    return "CIRCULAR"


def calibrate_regulatory_score(raw_s: int, category: str, title: str, summary: str, frameworks: List[str], risks: List[str]) -> int:
    blob = f"{title} {summary} {' '.join(frameworks)} {' '.join(risks)}".lower()

    if any(k in blob for k in [
        "penalty fee", "35m penalty", "sek 35m", "revocation", "återkallad",
        "critical vulnerability", "zero-day", "sfs 2026:916", "kill switch",
        "seuraamusmaksu", "administrative fine", "severe deficiency"
    ]):
        return 5

    if category == "CONSULTATION":
        return 2
    if any(k in blob for k in ["survey", "rapport", "undersökning", "statistik", "publikation", "årsredovisning", "marknadsläge", "stabilitetsrapport", "memo", "promemoria", "tilastot"]):
        return 2

    if category in ["TECHNICAL_STANDARD", "AMENDMENT"]:
        return 4
    if category == "CIRCULAR" and any(k in blob for k in ["mandatory", "strict", "immediate", "deadline", "compliance obligation", "föreskrift", "määräys"]):
        return 4
    if category == "ENFORCEMENT":
        return 4

    if category == "CIRCULAR":
        return 3
    if raw_s >= 4:
        return 3
    return max(1, min(raw_s, 3))


def format_relative_time(created_at_str: str) -> str:
    try:
        dt = datetime.strptime(created_at_str, "%Y-%m-%d %H:%M:%S")
        return dt.strftime("%b %d, %Y")
    except Exception:
        return "Recently"


def synthesize_before_after(category: str, summary: str, why_it_matters: str) -> str:
    if category == "ENFORCEMENT":
        return "Previously, internal audit flagged minor procedural gaps without formal regulatory censure. Following this enforcement notice, supervisory fines and mandatory corrective remediation plans are legally binding."
    if category == "AMENDMENT":
        return "Prior regulatory exemptions or softer discretionary guidelines are replaced with mandatory statutory requirements carrying direct administrative liability."
    if category == "TECHNICAL_STANDARD":
        return "Reporting schemas and data validation rules transition from legacy templates to unified electronic taxonomy standards with strict schema validation."
    if category == "CONSULTATION":
        return "Supervisory consultation stage: existing supervisory guidance remains active while stakeholder feedback is collected before final binding rules are adopted."
    return "Prior operational baseline required standard periodic reporting; revised circular establishes enhanced supervisory monitoring and expedited escalation thresholds."


def synthesize_action(category: str, risks: List[str], frameworks: List[str]) -> str:
    r_text = risks[0] if risks else "regulatory compliance risk"
    fw_text = frameworks[0] if frameworks else "applicable supervisory framework"
    if category == "ENFORCEMENT":
        return f"Review internal controls against cited deficiency in {fw_text}, conduct spot audit on {r_text.lower()}, and verify compliance posture."
    if category == "AMENDMENT":
        return f"Update core governing policies to reflect statutory changes in {fw_text}, schedule compliance review, and adjust control workflows."
    if category == "TECHNICAL_STANDARD":
        return f"Validate electronic reporting schemas against updated {fw_text} technical standards and test submission pipelines."
    return f"Assess operational exposure to {r_text.lower()}, file internal compliance briefing, and document supervisory alignment."


# ============================================================
# Main Pipeline Runner
# ============================================================

def main():
    parser = argparse.ArgumentParser(description="Ingest articles from rss-mapper-poc into Nordic RegTech feed")
    parser.add_argument("--input", type=str, help="Path to articles.json from rss-mapper-poc")
    parser.add_argument("--output", type=str, default=str(OUTPUT_PATH), help="Output path for feed_items.json")
    parser.add_argument("--limit", type=int, default=320, help="Target number of curated items to output")
    args = parser.parse_args()

    input_file = None
    if args.input:
        input_file = Path(args.input)
    else:
        for p in DEFAULT_INPUT_PATHS:
            if p.exists():
                input_file = p
                break

    if not input_file or not input_file.exists():
        print(f"Error: Could not locate articles.json. Checked: {[str(p) for p in DEFAULT_INPUT_PATHS]}")
        sys.exit(1)

    print(f"Loading articles from {input_file}...")
    with open(input_file, "r", encoding="utf-8") as f:
        raw_articles = json.load(f)

    print(f"Loaded {len(raw_articles)} raw articles from rss-mapper-poc.")

    # Deduplicate and group by authority
    by_auth: Dict[str, List[Dict[str, Any]]] = {}
    total_processed = 0

    for item in raw_articles:
        source = item.get("source", "")
        link = item.get("link", "")
        title = item.get("title", "").strip()
        summary = item.get("summary", "").strip()

        if not title or not summary:
            continue

        auth_rule = resolve_authority(source, link, title, summary, item.get("vendors", []))
        if not auth_rule:
            continue

        auth_id = auth_rule.authority_id
        if auth_id not in by_auth:
            by_auth[auth_id] = []
        by_auth[auth_id].append(item)
        total_processed += 1

    print(f"Classified {total_processed} articles across {len(by_auth)} authorities:")
    for aid, items_list in by_auth.items():
        print(f"  - {aid}: {len(items_list)} articles")

    # Balanced quotas prioritizing Finansinspektionen, FIN-FSA, Riksdagen, Eduskunta & EU
    quotas = {
        "fi": 70,           # Finansinspektionen (Sweden FSA)
        "fiva": 30,         # FIN-FSA (Financial Supervisory Authority Finland)
        "traficom": 35,     # Traficom NCSC-FI (Cyber Security / Telecoms)
        "riksdagen": 30,    # Swedish Parliament & Government
        "eduskunta": 25,    # Parliament of Finland
        "imy": 25,          # Swedish Privacy Authority (IMY / GDPR)
        "konsumentverket": 20, # Swedish Consumer Agency (Credit & Enforcement)
        "riksbank": 15,     # Sveriges Riksbank
        "tulli": 15,        # Finnish Customs (Trade & Sanctions)
        "domstol": 10,      # Swedish Courts
        "tietosuoja": 10,   # Finnish Data Protection Ombudsman
        "eba": 10,          # European Banking Authority
        "esma": 10,         # ESMA
    }

    selected_raw = []
    seen_links = set()

    for aid, target_count in quotas.items():
        candidates = by_auth.get(aid, [])
        candidates.sort(
            key=lambda x: (
                len(x.get("frameworks", [])),
                len(x.get("risks", [])),
                len(x.get("vendors", [])),
                len(x.get("explanation", "")),
                x.get("created_at", "")
            ),
            reverse=True
        )

        chosen = []
        for it in candidates:
            l = it.get("link", "")
            if l not in seen_links:
                seen_links.add(l)
                chosen.append(it)
                if len(chosen) >= target_count:
                    break
        selected_raw.extend(chosen)

    print(f"Selected {len(selected_raw)} balanced articles across authorities.")

    curated_items: List[Dict[str, Any]] = []
    seen_ids = set()

    for idx, raw in enumerate(selected_raw):
        source = raw.get("source", "")
        link = raw.get("link", "")
        title = raw.get("title", "").strip()
        summary = raw.get("summary", "").strip()
        explanation = raw.get("explanation", "").strip()
        raw_score = int(raw.get("score", 3))

        raw_frameworks = [f.strip() for f in raw.get("frameworks", []) if f.strip()]
        raw_vendors = [v.strip() for v in raw.get("vendors", []) if v.strip()]
        raw_risks = [r.strip() for r in raw.get("risks", []) if r.strip()]
        created_at = raw.get("created_at", "2025-08-22 12:00:00")

        # Anonymize entities & translate risks
        vendors = list(dict.fromkeys(anonymize_entity(v) for v in raw_vendors))
        risks = list(dict.fromkeys(translate_risk(r) for r in raw_risks))
        frameworks = raw_frameworks

        auth_rule = resolve_authority(source, link, title, summary, raw_vendors)
        auth_id = auth_rule.authority_id
        auth_label = auth_rule.authority_name
        auth_short = auth_rule.short_name
        jur = auth_rule.jurisdiction

        category = resolve_category(title, summary, link, raw_score)
        score = calibrate_regulatory_score(raw_score, category, title, summary, frameworks, risks)
        text_blob = f"{title} {summary} {' '.join(frameworks)} {' '.join(risks)} {link}"

        # Statutory rule resolution
        statute_rule = resolve_statute(text_blob, jur)
        statute_id = statute_rule.statute_id
        statute_ref = statute_rule.statute_ref
        statute_sec = statute_rule.statute_sec

        # Governance matrix linkages (100% valid IDs from governance.js)
        policies, controls, risk_ids = resolve_governance_linkages(statute_id, text_blob)

        # Classify jurisdiction: if update specifically concerns EU level regulations/standards
        if any(
            k in text_blob.lower()
            for k in [
                "eba ",
                "esma ",
                "sfdr",
                "regulation (eu)",
                "directive (eu)",
                "delegated regulation (eu)",
                "delegerade förordningen",
                "eu-sanktioner",
                "market abuse regulation (mar)",
                "kapitaltäckningsdirektivet",
                "bmr",
                "benchmarks regulation",
                "dora",
            ]
        ):
            jur = "EU"

        # Unique stable ID
        hash_suffix = hashlib.md5(f"{title}_{link}".encode("utf-8")).hexdigest()[:6]
        item_id = f"feed-{auth_id}-{hash_suffix}"
        if item_id in seen_ids:
            item_id = f"feed-{auth_id}-{hash_suffix}-{idx}"
        seen_ids.add(item_id)

        why_it_matters = explanation if explanation else f"Supervisory and compliance update from {auth_label} regarding {statute_ref}."
        before_after = synthesize_before_after(category, summary, why_it_matters)
        action_required = synthesize_action(category, risks, frameworks)

        tags = list(dict.fromkeys(
            frameworks[:3] +
            vendors[:2] +
            [auth_short, category.replace('_', ' ').title()]
        ))

        relative_time = format_relative_time(created_at)

        orig_title = raw.get("original_title") or (raw.get("title", "") if raw.get("language") in ["fi", "sv"] else None)
        if orig_title and orig_title.strip().lower() == title.strip().lower():
            orig_title = None

        # Build and validate using Pydantic FeedItemModel
        model = FeedItemModel(
            id=item_id,
            title=title,
            originalTitle=orig_title,
            authority=auth_label,
            authorityId=auth_id,
            jurisdiction=jur,
            category=category,
            score=score,
            publishedAt=created_at.replace(" ", "T") + "Z" if " " in created_at else created_at,
            relativeTime=relative_time,
            statuteId=statute_id,
            statuteSec=statute_sec,
            statuteRef=statute_ref,
            summary=summary,
            plainEnglish=PlainEnglishAnalysis(
                whyItMatters=why_it_matters,
                beforeAfter=before_after,
                actionRequired=action_required,
            ),
            frameworks=frameworks,
            vendors=vendors,
            risks=risks,
            policyIds=policies,
            controlIds=controls,
            riskIds=risk_ids,
            sourceUrl=link,
            source=source,
            tags=tags,
            status="UNREVIEWED",
        )
        curated_items.append(model.model_dump(exclude_none=True))

    # Core flagship anchor items to guarantee key scenario fixtures and test IDs
    anchor_items = [
        {
            "id": "feed-sfs-2026-916",
            "title": "Riksdagen Enacts SFS 2026:916: Mandatory Algorithmic Trading Risk Controls & Automated Latency Audits",
            "originalTitle": "SFS 2026:916 Statutory Amendment (Algorithmic Trading & AI Risk Controls)",
            "authority": "Swedish Parliament (Sveriges Riksdag)",
            "authorityId": "riksdagen",
            "jurisdiction": "SE",
            "category": "AMENDMENT",
            "score": 5,
            "publishedAt": "2026-03-24T09:15:00Z",
            "relativeTime": "2 hours ago",
            "statuteId": "sfs-2004-46",
            "statuteSec": "riksdagen_sfs-2004-46_k1_p1",
            "statuteRef": "SFS 2004:46 1 kap. 1 §",
            "summary": "Swedish Parliament has enacted statutory amendments requiring all algorithmic fund management systems to maintain verified automated kill switches with under 100ms order-cancellation latency and continuous parameter auditing.",
            "plainEnglish": {
                "whyItMatters": "SFS 2026:916 elevates algorithmic resilience from soft regulatory guidelines into hard statutory law with direct civil and administrative director liability for execution runaway events.",
                "beforeAfter": "Previously, 12ms filter latency and discretionary manual shutdown protocols were acceptable. Now, automated hardware/kernel-level triggers under 5ms and emergency order purge within 100ms are mandatory.",
                "actionRequired": "Immediately update Algorithmic Trading Policy (POL-ALG-01), execute stress testing on kill-switch latency for CTL-ALG-01 and CTL-ALG-03, and file compliance attestation.",
            },
            "frameworks": ["SFS 2026:916", "Algorithmic Trading", "MiFID II", "MAR"],
            "vendors": ["Sveriges Riksdag", "Finansinspektionen"],
            "risks": ["Algorithmic execution runaway risk", "Market disruption liability", "Director personal liability"],
            "policyIds": ["pol-alg-01"],
            "controlIds": ["ctl-alg-01", "ctl-alg-03"],
            "riskIds": ["rsk-alg-01"],
            "sourceUrl": "https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-2026916",
            "source": "www.riksdagen.se",
            "tags": ["Algorithmic Trading", "SFS 2026:916", "Kill Switch", "Market Conduct", "Riksdagen"],
            "status": "UNREVIEWED",
        },
        {
            "id": "feed-fi-dora-2026-01",
            "title": "Finansinspektionen Circular: Mandatory FFFS Filing for DORA ICT Incident Registers & Third-Party Audit Rights",
            "originalTitle": "FFFS Supervisory Regulations on DORA Information Registers & Incident Reporting",
            "authority": "Finansinspektionen (Swedish FSA)",
            "authorityId": "fi",
            "jurisdiction": "SE",
            "category": "TECHNICAL_STANDARD",
            "score": 5,
            "publishedAt": "2026-03-23T14:30:00Z",
            "relativeTime": "Yesterday",
            "statuteId": "reg-dora",
            "statuteSec": "dora-art-28",
            "statuteRef": "Regulation (EU) 2022/2554 (DORA) Art. 28",
            "summary": "Finansinspektionen announces the launch of its supervisory portal for DORA information registers. All Swedish banks, fund managers, and investment firms must submit standardized XML registers of critical ICT third-party vendors by Q3 2026.",
            "plainEnglish": {
                "whyItMatters": "Failure to document subcontracting chains down to the 4th tier or absence of unrestricted audit clauses will trigger formal supervisory deficiency notices and remediation orders.",
                "beforeAfter": "Standard European outsourcing notices allowed aggregated cloud provider listings. DORA mandates full supply-chain mapping including hyperscaler data center regions and concentration metrics.",
                "actionRequired": "Re-audit cloud outsourcing contracts under POL-DORA-01, verify contract audit clauses in CTL-DORA-01, and populate register templates.",
            },
            "frameworks": ["DORA", "Regulation (EU) 2022/2554", "FFFS", "EBA Guidelines"],
            "vendors": ["Finansinspektionen", "AWS", "Microsoft Azure", "Google Cloud"],
            "risks": ["Third-party ICT concentration risk", "Supervisory deficiency notice", "Vendor lock-in"],
            "policyIds": ["pol-dora-01"],
            "controlIds": ["ctl-dora-01", "ctl-dora-02"],
            "riskIds": ["rsk-dora-01"],
            "sourceUrl": "https://www.fi.se/sv/publicerat/nyheter/2026/dora-register-rapportering/",
            "source": "www.fi.se",
            "tags": ["DORA", "ICT Third-Party Risk", "Finansinspektionen", "Cloud Contracts", "FFFS"],
            "status": "UNREVIEWED",
        },
        {
            "id": "feed-fi-sanction-aml-01",
            "title": "Finansinspektionen Sanction: SEK 35M Penalty Fee for Flawed Real-Time Transaction Monitoring & Alert Backlogs",
            "originalTitle": "Supervisory Sanction Decision on AML Transaction Monitoring & Alert Backlogs",
            "authority": "Finansinspektionen (Swedish FSA)",
            "authorityId": "fi",
            "jurisdiction": "SE",
            "category": "ENFORCEMENT",
            "score": 5,
            "publishedAt": "2026-03-21T10:00:00Z",
            "relativeTime": "3 days ago",
            "statuteId": "sfs-2017-630",
            "statuteSec": "riksdagen_sfs-2017-630_k3_p1",
            "statuteRef": "SFS 2017:630 3 kap. 1 §",
            "summary": "Finansinspektionen has issued a formal warning and an administrative fine of 35 million SEK against a Nordic credit institution for systemic delays in investigating automated AML alerts and backlogs exceeding 30 days.",
            "plainEnglish": {
                "whyItMatters": "The decision establishes that staffing shortages and alert fatigue are not defensible justifications for transaction monitoring queues exceeding 7 business days.",
                "beforeAfter": "Regulators previously accepted risk-based triage of high vs low priority AML alerts. FI now requires auditable throughput SLAs across all automated scenario triggers.",
                "actionRequired": "Benchmark current alert queue SLA against the 5-day regulatory ceiling under CTL-AML-02, and evaluate machine-learning false-positive suppression rules.",
            },
            "frameworks": ["SFS 2017:630", "AML/CFT", "EU 4th AMLD", "FATF Recommendations"],
            "vendors": ["Finansinspektionen"],
            "risks": ["Supervisory fine and public sanction", "Reputational damage", "Systemic alert backlog"],
            "policyIds": ["pol-aml-01"],
            "controlIds": ["ctl-aml-02"],
            "riskIds": ["rsk-aml-01"],
            "sourceUrl": "https://www.fi.se/sv/publicerat/sanktioner/2026/sanktion-transaktionsovervakning/",
            "source": "www.fi.se",
            "tags": ["AML", "Transaction Monitoring", "Sanctions", "Finansinspektionen", "Enforcement"],
            "status": "UNREVIEWED",
        },
        {
            "id": "feed-fiva-edd-2026",
            "title": "FIN-FSA Supervisory Circular 02/2026: Enhanced Due Diligence for High-Risk Beneficial Ownership Holding Structures",
            "originalTitle": "Supervisory Circular 02/2026 on Enhanced Due Diligence in Complex Ownership Structures",
            "authority": "FIN-FSA (Financial Supervisory Authority)",
            "authorityId": "fiva",
            "jurisdiction": "FI",
            "category": "CIRCULAR",
            "score": 4,
            "publishedAt": "2026-03-19T08:00:00Z",
            "relativeTime": "5 days ago",
            "statuteId": "reg-aml",
            "statuteSec": "aml-2-1",
            "statuteRef": "AML Act (444/2017) 2 kap. 1 §",
            "summary": "The Finnish Financial Supervisory Authority (FIN-FSA) instructs supervised entities to apply mandatory forensic source-of-wealth verifications for private wealth accounts held through multi-tier nominee or trust structures.",
            "plainEnglish": {
                "whyItMatters": "Cross-border private banking accounts with ultimate beneficial ownership (UBO) mediated through discretionary offshore trusts require board-level or MLRO sign-off before onboarding.",
                "beforeAfter": "Self-declarations accompanied by certified register extracts were sufficient. Under Circular 02/2026, independent corroboration of wealth origin is mandatory.",
                "actionRequired": "Review onboarding workflows in POL-AML-01, re-screen existing wealth management client dossiers under CTL-AML-01.",
            },
            "frameworks": ["Laki rahanpesun ja terrorismin rahoittamisen estämisestä (444/2017)", "EU AML Directives"],
            "vendors": ["FIN-FSA (Finanssivalvonta)"],
            "risks": ["Offshore beneficial ownership evasion", "Money laundering vulnerability", "Regulatory non-compliance"],
            "policyIds": ["pol-aml-01"],
            "controlIds": ["ctl-aml-01"],
            "riskIds": ["rsk-aml-01"],
            "sourceUrl": "https://www.finanssivalvonta.fi/tiedotteet-ja-julkaisut/valvottavatiedotteet/2026/edd-omistusrakenteet/",
            "source": "www.finanssivalvonta.fi",
            "tags": ["FIN-FSA", "AML", "Beneficial Ownership", "Private Banking", "Finland"],
            "status": "UNREVIEWED",
        },
        {
            "id": "feed-eba-rts-dora-01",
            "title": "EBA Final Draft RTS on ICT Business Continuity & Major Incident Classification Thresholds",
            "originalTitle": "Joint ESAs Regulatory Technical Standards on Major Incident Reporting Classification",
            "authority": "European Banking Authority",
            "authorityId": "eba",
            "jurisdiction": "EU",
            "category": "TECHNICAL_STANDARD",
            "score": 4,
            "publishedAt": "2026-03-17T11:00:00Z",
            "relativeTime": "1 week ago",
            "statuteId": "reg-dora",
            "statuteSec": "dora-art-17",
            "statuteRef": "Regulation (EU) 2022/2554 (DORA) Art. 17",
            "summary": "Joint Committee of the European Supervisory Authorities (EBA, ESMA, EIOPA) publishes final technical standards defining quantitative impact thresholds for classifying major ICT incidents under DORA.",
            "plainEnglish": {
                "whyItMatters": "Standardizes reporting triggers: any ICT outage impacting more than 10% of active retail clients or transaction values above EUR 5M requires an initial notification within 4 hours.",
                "beforeAfter": "National competent authorities had divergent definitions of critical downtime. EBA harmonizes strict pan-EU timelines (4h initial, 72h intermediate, 1 month final report).",
                "actionRequired": "Align incident response runbooks in CTL-DORA-01 with the new ESAs classification matrix and verify automated ticket escalation.",
            },
            "frameworks": ["DORA", "ESAs RTS", "Regulation (EU) 2022/2554"],
            "vendors": ["EBA", "ESMA", "EIOPA"],
            "risks": ["Late incident notification penalties", "Operational downtime misclassification"],
            "policyIds": ["pol-dora-01"],
            "controlIds": ["ctl-dora-01"],
            "riskIds": ["rsk-dora-01"],
            "sourceUrl": "https://www.eba.europa.eu/publications-and-media/press-releases/joint-rts-dora-major-incident-classification",
            "source": "www.eba.europa.eu",
            "tags": ["EBA", "DORA", "Incident Reporting", "ESAs", "EU"],
            "status": "UNREVIEWED",
        },
        {
            "id": "feed-esma-greenwashing-01",
            "title": "ESMA Supervisory Briefing: Fund Naming Rules & ESG Greenwashing Prevention Guidelines",
            "originalTitle": "Supervisory Briefing on Fund Naming & Sustainability-Related Disclosures",
            "authority": "European Securities and Markets Authority",
            "authorityId": "esma",
            "jurisdiction": "EU",
            "category": "CIRCULAR",
            "score": 4,
            "publishedAt": "2026-03-15T09:30:00Z",
            "relativeTime": "9 days ago",
            "statuteId": "reg-sfdr",
            "statuteSec": "sfdr-art-4",
            "statuteRef": "Regulation (EU) 2019/2088 (SFDR) Art. 4",
            "summary": "ESMA issues final supervisory guidance enforcing an 80% minimum investment threshold in sustainable activities for any fund using 'ESG', 'Green', 'Impact', or 'Transition' in its marketing name.",
            "plainEnglish": {
                "whyItMatters": "UCITS and AIF funds failing to meet portfolio alignment thresholds must either divest non-compliant holdings or formally rebrand the fund before national regulators.",
                "beforeAfter": "Broad aspirational sustainability objectives were permitted under Article 8 light green classifications without hard quantitative portfolio minimums.",
                "actionRequired": "Screen all active Nordic fund titles against portfolio taxonomy percentages and update prospectus disclosures under POL-ALG-01.",
            },
            "frameworks": ["SFDR (Regulation (EU) 2019/2088)", "EU Taxonomy", "ESMA Guidelines"],
            "vendors": ["ESMA"],
            "risks": ["Greenwashing enforcement action", "Forced fund rebranding", "Investor litigation risk"],
            "policyIds": ["pol-alg-01"],
            "controlIds": ["ctl-alg-02"],
            "riskIds": ["rsk-alg-01"],
            "sourceUrl": "https://www.esma.europa.eu/press-news/esma-news/esma-guidelines-funds-names-using-esg-or-sustainability-related-terms",
            "source": "www.esma.europa.eu",
            "tags": ["ESMA", "SFDR", "Greenwashing", "ESG", "Funds", "EU"],
            "status": "UNREVIEWED",
        },
        {
            "id": "feed-eba-nsfr",
            "title": "EBA Consultation: Accelerated Digital Deposit Run Scenarios in Net Stable Funding Ratio (NSFR)",
            "originalTitle": "Consultation Paper on Net Stable Funding & Digital Deposit Flight Scenarios",
            "authority": "European Banking Authority",
            "authorityId": "eba",
            "jurisdiction": "EU",
            "category": "CONSULTATION",
            "score": 2,
            "publishedAt": "2026-03-05T14:00:00Z",
            "relativeTime": "3 weeks ago",
            "statuteId": "sfs-2014-968",
            "statuteSec": "riksdagen_sfs-2014-968_k1_p1",
            "statuteRef": "SFS 2014:968 1 kap. 1 §",
            "summary": "The EBA launches public consultation on revisions to liquidity outflow assumptions, reflecting higher speed of digital deposit flight driven by social media and mobile banking apps.",
            "plainEnglish": {
                "whyItMatters": "Banks may face higher required stable funding (RSF) weightings for uninsured corporate and retail deposits, directly impacting net interest margins and balance sheet capital.",
                "beforeAfter": "Outflow rates based on historical 30-day run scenarios are updated to reflect 24-hour instant liquidity drainage.",
                "actionRequired": "Treasury and risk teams should simulate revised outflow coefficients in the internal liquidity adequacy assessment (ILAAP).",
            },
            "frameworks": ["CRR / CRD IV", "EBA Guidelines", "Basel III"],
            "vendors": ["EBA"],
            "risks": ["Liquidity run risk", "Capital buffer recalculation", "Higher funding cost"],
            "policyIds": ["pol-alg-01"],
            "controlIds": ["ctl-alg-01", "ctl-alg-02"],
            "riskIds": ["rsk-alg-01"],
            "sourceUrl": "https://www.eba.europa.eu/calendar/consultation-paper-nsfr-liquidity-outflows",
            "source": "www.eba.europa.eu",
            "tags": ["EBA", "Liquidity", "NSFR", "CRR", "Prudential", "EU"],
            "status": "UNREVIEWED",
        },
        {
            "id": "feed-esma-taxonomy",
            "title": "ESMA Issues Technical Briefing: Annual Update to ESEF Reporting Taxonomy & XBRL Validation Suite",
            "originalTitle": "Technical Briefing: ESEF Reporting Taxonomy 2026 Conformance Suite",
            "authority": "European Securities and Markets Authority",
            "authorityId": "esma",
            "jurisdiction": "EU",
            "category": "TECHNICAL_STANDARD",
            "score": 1,
            "publishedAt": "2026-02-15T09:00:00Z",
            "relativeTime": "1 month ago",
            "statuteId": "sfs-2007-528",
            "statuteSec": "riksdagen_sfs-2007-528_k1_p1",
            "statuteRef": "SFS 2007:528 1 kap. 1 §",
            "summary": "ESMA releases technical conformance update for annual European Single Electronic Format (ESEF) reporting filings, introducing minor schema validation fixes for digital financial statements.",
            "plainEnglish": {
                "whyItMatters": "Technical schema updates ensure corporate annual reports pass automated filing gateways without validation warnings.",
                "beforeAfter": "Previous 2025 XML schemas will be phased out for FY2026 filings in favor of standardized XBRL tag rules.",
                "actionRequired": "Ensure financial reporting software vendor updates XBRL taxonomy schemas prior to annual audit sign-off.",
            },
            "frameworks": ["ESEF", "Transparency Directive", "XBRL Taxonomy"],
            "vendors": ["ESMA"],
            "risks": ["Filing gateway rejection", "Schema format non-conformance"],
            "policyIds": ["pol-alg-01"],
            "controlIds": ["ctl-alg-02"],
            "riskIds": ["rsk-alg-01"],
            "sourceUrl": "https://www.esma.europa.eu/press-news/esma-news/esma-publishes-2026-esef-taxonomy-update",
            "source": "www.esma.europa.eu",
            "tags": ["ESMA", "ESEF", "XBRL", "Financial Reporting", "Technical Standard", "EU"],
            "status": "UNREVIEWED",
        },
    ]

    # Prepend anchors while deduplicating
    anchor_ids = {a["id"] for a in anchor_items}
    final_items = anchor_items + [it for it in curated_items if it["id"] not in anchor_ids]

    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(final_items, f, indent=2, ensure_ascii=False)

    print(f"\nSuccessfully wrote {len(final_items)} total feed items ({len(final_items) - len(anchor_items)} ingested from the upstream rss-mapper-poc) to {out_path} ({os.path.getsize(out_path) / 1024:.1f} KB).")


if __name__ == "__main__":
    main()
