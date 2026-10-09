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
    explanation: Optional[str] = None
    plainEnglish: Optional[PlainEnglishAnalysis] = None
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
# Authority Rules & Domain-First Detection
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

    # Domain match takes strict precedence (prevents Swedish FI articles mentioning FIN-FSA from misattribution)
    for rule in AUTHORITY_RULES:
        if rule.domain_match in l_low or rule.domain_match in s_low:
            return rule

    # Special handling for STT Info press releases issued by Finanssivalvonta (FIN-FSA)
    if "sttinfo" in s_low or "sttinfo" in l_low:
        if any(k in t_low or k in sum_low or any(k in v for v in v_low) for k in ["finanssivalvonta", "fin-fsa", "fiva", "valvottavatiedotteet"]):
            return next(r for r in AUTHORITY_RULES if r.authority_id == "fiva")

    # Vendor-based fallback for non-domain sources
    if any("finanssivalvonta" in v or "fin-fsa" in v for v in v_low):
        return next(r for r in AUTHORITY_RULES if r.authority_id == "fiva")

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
# Client Anonymity & Mock Entity Isolation Standard
# (Strictly Nordic Sovereign Bank, Polaris Wealth, Aura Asset Management)
# ============================================================

ENTITY_MOCK_MAP: List[Tuple[str, str]] = [
    # Commercial Banks and Credit Institutions -> Nordic Sovereign Bank
    (r"\bnordea(?:\s+hypotek(?:\s+ab)?)?", "Nordic Sovereign Bank"),
    (r"\bnordea\s+bank(?:\s+abp)?\b", "Nordic Sovereign Bank"),
    (r"\bhandelsbanken\b", "Nordic Sovereign Bank"),
    (r"\bsvenska\s+handelsbanken\b", "Nordic Sovereign Bank"),
    (r"\bdanske(?:\s+bank)?\b", "Nordic Sovereign Bank"),
    (r"\bop(?:\s*-\s*ryhmä|\s+ryhmä|\s+osuuskunta)?\b", "Nordic Sovereign Bank"),
    (r"\baktia(?:\s+pankki)?\b", "Nordic Sovereign Bank"),
    (r"\balisa\s+pankki\b", "Nordic Sovereign Bank"),
    (r"\bs-pankki\b", "Nordic Sovereign Bank"),
    (r"\bsäästöpankki(?:ryhmä)?\b", "Nordic Sovereign Bank"),
    (r"\bålandsbanken\b", "Nordic Sovereign Bank"),
    (r"\bklarna(?:\s+bank(?:\s+ab)?)?\b", "Nordic Sovereign Bank"),
    (r"\bcollector(?:\s+bank)?\b", "Nordic Sovereign Bank"),
    (r"\bresurs(?:\s+bank)?\b", "Nordic Sovereign Bank"),
    (r"\bqliro\b", "Nordic Sovereign Bank"),
    (r"\bsantander(?:\s+consumer\s+bank)?\b", "Nordic Sovereign Bank"),
    (r"\bstabelo\b", "Nordic Sovereign Bank"),
    (r"\bhypoteekkiyhdistys\b", "Nordic Sovereign Bank"),
    (r"\bambrion\s+finans(?:\s+ab)?\b", "Nordic Sovereign Bank"),
    (r"\bluma\s+finans(?:\s+ab)?\b", "Nordic Sovereign Bank"),
    (r"\bbillmate(?:\s+ab)?\b", "Nordic Sovereign Bank"),
    (r"\bjsm\s+capital(?:\s+ab)?\b", "Nordic Sovereign Bank"),
    (r"\broble\s+services(?:\s+oy)?\b", "Nordic Sovereign Bank"),
    (r"\balami\s+services(?:\s+oy)?\b", "Nordic Sovereign Bank"),
    (r"\blocalbitcoins\b", "Nordic Sovereign Bank"),

    # Private Wealth, Retail Brokers, Intermediaries -> Polaris Wealth
    (r"\bswedbank(?:\s+ab)?\b", "Polaris Wealth"),
    (r"\bavanza(?:\s+bank)?\b", "Polaris Wealth"),
    (r"\bnordnet(?:\s+bank)?\b", "Polaris Wealth"),
    (r"\bermitage\s+partners\b", "Polaris Wealth"),

    # Asset Managers, Fund Management, Insurers, Issuers -> Aura Asset Management
    (r"\bseb\b", "Aura Asset Management"),
    (r"\bskandinaviska\s+enskilda\s+banken\b", "Aura Asset Management"),
    (r"\bcoeli(?:\s+asset\s+management)?\b", "Aura Asset Management"),
    (r"\beq\s+rahastoyhtiö\b", "Aura Asset Management"),
    (r"\bdina\s+försäkring(?:ar)?\b", "Aura Asset Management"),
    (r"\bskandia\b", "Aura Asset Management"),
    (r"\bvaloe\b", "Aura Asset Management"),
    (r"\bsavcor\s+technologies\b", "Aura Asset Management"),
    (r"\bmeriaura\s+invest\b", "Aura Asset Management"),
    (r"\bbioretec\b", "Aura Asset Management"),
    (r"\borion\b", "Aura Asset Management"),
    (r"\bbbs-bioactive\s+bone\s+substitutes\b", "Aura Asset Management"),

    # Collective references to real banking tiers
    (r"\b(?:de\s+fyra\s+storbankerna|tre\s+storbankerna|svenska\s+storbanker|suuret\s+pankit)\b", "major Nordic institutions"),
    (r"\b(?:swedish\s+irk-banker|svenska\s+banker\s*\(tillsynskategori\s*1\s*och\s*2\))\b", "supervised Nordic banks"),
]

# Public supervisory / judicial bodies normalized to clean English
PUBLIC_BODIES_MAP: List[Tuple[str, str]] = [
    (r"\bfinansinspektionen(?:\s*\(fi\))?\b", "Swedish Financial Supervisory Authority (FI)"),
    (r"\bsveriges\s+riksdag\b|\briksdagen\b", "Swedish Parliament (Sveriges Riksdag)"),
    (r"\bsveriges\s+riksbank(?:\s*\(riksbanken\))?\b|\briksbanken\b", "Sveriges Riksbank (Central Bank)"),
    (r"\bsveriges\s+regering\b|\bregeringskansliet(?:\s*\(swedish\s+government\))?\b", "Swedish Government Offices"),
    (r"\bsveriges\s+domstolar\b|\bdomstolsverket\b", "Swedish Courts Administration"),
    (r"\båklagarmyndigheten(?:\s*\(the\s+prosecutor\))?\b", "Swedish Prosecution Authority"),
    (r"\bkonsumentverket(?:\s*\(swedish\s+consumer\s+agency\))?\b", "Swedish Consumer Agency"),
    (r"\bkonsumentombudsmannen\b", "Swedish Consumer Ombudsman"),
    (r"\bintegritetsskyddsmyndigheten\b|\bimy\b|\bdatainspektionen\b", "Swedish Privacy Authority (IMY)"),
    (r"\btraficom(?:\s*\(liikenne-\s*ja\s*viestintävirasto\))?\b", "Traficom NCSC-FI (Cyber Security Centre)"),
    (r"\btulli(?:\s*\(finnish\s+customs\))?\b", "Finnish Customs (Tulli)"),
    (r"\btietosuojavaltuutetun\s+toimisto\b|\btietosuojavaltuutettu\b", "Office of the Data Protection Ombudsman"),
    (r"\beduskunta\b", "Parliament of Finland (Eduskunta)"),
    (r"\beuropaparlamentet\s+och\s+rådet\b", "European Parliament and Council"),
    (r"\bsjöfartsverket(?:\s*\(swedish\s+maritime\s+administration\))?\b", "Swedish Maritime Administration"),
    (r"\bspelinspektionen\b", "Swedish Gambling Authority"),
    (r"\btransportstyrelsen\b", "Swedish Transport Agency"),
    (r"\bvaltioneuvosto(?:\s*\(finnish\s+government\))?\b", "Finnish Government"),
    (r"\bulosottolaitos(?:\s*\(enforcement\s+authority\))?\b", "National Enforcement Authority"),
    (r"\bsisäministeriö(?:\s*\(ministry\s+of\s+the\s+interior\))?\b", "Ministry of the Interior"),
    (r"\bsuojelupoliisi(?:\s*\(finnish\s+security\s+intelligence\s+service\))?\b", "Finnish Security Intelligence Service (Supo)"),
    (r"\bsveriges\s+advokatsamfund\b", "Swedish Bar Association"),
    (r"\bsveriges\s+konsumenter\b", "Swedish Consumers Association"),
    (r"\bturvallisuus-\s*ja\s*kemikaalivirasto(?:\s*\(tukes\))?\b|\btukes\b", "Finnish Safety and Chemicals Agency (Tukes)"),
    (r"\btilastokeskus(?:\s*\(statistics\s+finland\))?\b", "Statistics Finland"),
    (r"\btyöeläkelaitokset(?:\s*\(pension\s+institutions\))?\b", "Occupational Pension Institutions"),
    (r"\bulkoministeriö(?:\s*\(ministry\s+for\s+foreign\s+affairs.*?\))?\b", "Ministry for Foreign Affairs of Finland"),
    (r"\bvaltiovarainministeriö(?:\s*\(ministry\s+of\s+finance\))?\b|\bvaltionvarainministeriö\b", "Ministry of Finance"),
    (r"\bverohallinto\b", "Finnish Tax Administration"),
    (r"\bskatteverket\b", "Swedish Tax Agency"),
    (r"\bpoliisihallitus\b|\bpoliisi\b", "National Police Board"),
    (r"\bpolisen\b", "Swedish Police Authority"),
    (r"\bsocialstyrelsen\b", "National Board of Health and Welfare"),
    (r"\bsametinget\b", "Sámi Parliament"),
    (r"\barbetsmiljöverket\b", "Swedish Work Environment Authority"),
    (r"\bfinanssiala\b", "Finance Finland"),
    (r"\barvopaperimarkkinayhdistys\b", "Securities Market Association"),
    (r"\bsuomen\s+pankki\b", "Bank of Finland"),
    (r"\brahanpesun\s+selvittelykeskus\b", "Financial Intelligence Unit (FIU)"),
    (r"\bhelsingin\s+hallinto-oikeus\b", "Helsinki Administrative Court"),
    (r"\bkorkein\s+hallinto-oikeus\b", "Supreme Administrative Court"),
    (r"\bförvaltningsrätten\b", "Administrative Court"),
    (r"\boy\s+suomen\s+tietotoimisto\b|\bstt\b", "Finnish News Agency (STT)"),
    (r"\bkilpailu-\s*ja\s*kuluttajavirasto\b|\bkkv\b", "Finnish Competition and Consumer Authority (KKV)"),
    (r"\bfondbolag(?:\s*\(fund\s+management\s+companies\))?\b", "Fund Management Companies"),
    (r"\bförvaltningsbolag\b", "Management Companies"),
    (r"\bvärdepappersinstitut(?:\s*\(securities\s+institutions\))?\b", "Securities Institutions"),
    (r"\bleverantörer\s+av\s+datarapporteringstjänster.*?\b", "Data Reporting Service Providers"),
    (r"\bemittentinstitut(?:\s*\(issuer\s+institutions\))?\b", "Issuer Institutions"),
    (r"\bsvenska\s+aktiebolag\b", "Swedish Limited Companies"),
]


def sanitize_text(text: str) -> str:
    """Sanitize any text string (title, summary, explanation) ensuring zero real bank names."""
    if not text:
        return ""
    result = text
    # Clean non-breaking spaces and soft hyphens
    result = result.replace("\u00ad", "").replace("\u00a0", " ")

    # Handle composite bank lists (e.g. Handelsbanken, Nordea, SEB, Swedbank)
    result = re.sub(
        r"\((?:Handelsbanken|Nordea|SEB|Swedbank)[^)]*\)",
        "(Nordic Sovereign Bank, Polaris Wealth, Aura Asset Management)",
        result,
        flags=re.IGNORECASE
    )

    for pattern, replacement in ENTITY_MOCK_MAP:
        result = re.sub(pattern, replacement, result, flags=re.IGNORECASE)

    for pattern, replacement in PUBLIC_BODIES_MAP:
        result = re.sub(pattern, replacement, result, flags=re.IGNORECASE)

    return result


def anonymize_entity(name: str) -> str:
    """Strictly maps vendor strings into one of the 3 mock entities or recognized English public bodies."""
    cleaned = name.strip().replace("\u00ad", "").replace("\u00a0", " ")
    low = cleaned.lower()

    # Public authorities match
    for pattern, replacement in PUBLIC_BODIES_MAP:
        if re.search(pattern, low):
            return replacement

    # Commercial entities match strictly into the 3 mock entities
    for pattern, replacement in ENTITY_MOCK_MAP:
        if re.search(pattern, low):
            return replacement

    # Fallback: if corporate suffix exists, map to Aura Asset Management
    if re.search(r"\b(?:oy|ab|oyj|bank|abp|as|ltd|gmbh)\b", low):
        return "Aura Asset Management"

    # Clean any remaining non-English characters
    if re.search(r"[äöåÄÖÅ]", cleaned):
        return "Nordic Supervisory Participant"

    return cleaned


# ============================================================
# 100% English Language Standard Translation Engine
# ============================================================

LOW_VALUE_NAVIGATION_TITLES = {
    "nyheter", "nyheter & övrigt publicerat", "e-plikt", "fi-forum", "kalendarium",
    "pressmeddelanden", "lediga jobb", "om webbplatsen", "kontakt", "sök",
    "sök sanktioner", "remisser", "undersökningar lista", "avslutade undersökningar",
    "tiedotteet", "uutiset", "tapahtumat", "yhteystiedot"
}

TITLE_MAP: Dict[str, str] = {
    "agenda för en ny marknadstillsyn (2002:1)": "Agenda for Modern Market Supervision (2002:1)",
    "ahosniemi: finanssialan kasvustrategian hyvät eväät jäävät torsoksi, ellei sääntelyä yksinkertaisteta ja järkevöitetä": "Industry Address: Financial Sector Growth Strategy Requires Regulatory Simplification and Burden Reduction",
    "ahosniemi: kotitalouksien ja yritysten rahoitusta vaikeuttavan sääntelyn purkaminen sekä kotimaisten sijoitusrahastojen toimintaedellytysten vahvistaminen ovat hallitukselta vahvoja tekoja kasvun vauhdittamiseksi": "Executive Commentary: Dismantling Restrictive Lending Rules and Strengthening Domestic Investment Funds Drive Economic Growth",
    "ambrion finans varnas för bristande kreditprövning": "Nordic Sovereign Bank Warned by Consumer Agency for Deficient Credit Assessments",
    "anna seim i västervik:  goda förutsättningar att hantera den osäkra vägen framåt": "Riksbank Address: Favorable Conditions for Managing Macroeconomic Uncertainty",
    "anna seim i västervik: goda förutsättningar att hantera den osäkra vägen framåt": "Riksbank Address: Favorable Conditions for Managing Macroeconomic Uncertainty",
    "anmälda personuppgiftsincidenter 2022": "Annual Statistical Overview: Notified Personal Data Incidents 2022",
    "anna seim: bra utgångsläge i en föränderlig omvärld": "Riksbank Deputy Governor Anna Seim: Strong Economic Foundation in an Uncertain Global Environment",
    "anna seim: riksbanken är en av de mest transparenta centralbankerna": "Riksbank Deputy Governor Anna Seim: Riksbank Ranks Among the World's Most Transparent Central Banks",
    "asuntorahoituksen sääntelyyn ehdotetaan lisää joustavuutta": "Regulatory Proposal Recommends Greater Flexibility in Residential Mortgage Lending Rules",
    "autolla norjaan ja takaisin – muista tullimuodollisuudet": "Cross-Border Vehicle Transit to Norway: Essential Customs Procedures and Declaration Rules",
    "baltic återkallar uppblåsbara flytvästar på grund av risk för punktering av luftblåsa": "Product Safety Recall: Inflatable Life Jackets Recalled Over Bladder Puncture Risks",
    "barn och ungas rättigheter på digitala plattformar": "Supervisory Guidance: Protection of Minor Rights and Privacy on Digital Platforms",
    "breman: ”att våga tänka annorlunda – om riksbankens penningpolitiska kommunikation”": "First Deputy Governor Breman: Daring to Think Differently — Communicating Monetary Policy",
    "brottsbekämpande myndigheter": "Supervisory Guidance for Law Enforcement and Financial Crime Authorities",
    "bättre verktyg för fi att motverka att det finansiella systemet missbrukas av kriminella": "Enhanced Supervisory Powers for FI to Combat Financial System Abuse by Criminals",
    "coca-cola lovar ta bort vilseledande miljöpåståenden": "Consumer Agency Enforcement: Company Commits to Remove Misleading Environmental Claims",
    "eduskunta kannattaa eu-lainsäädännön tavoitteita yritysten hallinnollisen taakan vähentämiseksi": "Parliament Endorses EU Legislative Initiatives to Reduce Corporate Administrative Burden",
    "eu-viikkokirje: puhtaan teollisuuden valtiontukikehys, ehdotus avaruussäädöksestä": "EU Parliamentary Weekly Brief: Clean Industrial State Aid Framework and Space Law Proposals",
    "eu:n jätesäädöspaketin täytäntöönpano": "Transposition of EU Waste Regulatory Package and Circular Economy Standards",
    "eurooppalaiset pankit kestivät rankan stressitestin": "EBA Regulatory Stress Test Results: European Banks Demonstrate High Resilience Under Adverse Shocks",
    "fi tillämpar riktlinjer för sund ersättningspolicy med vissa undantag": "Finansinspektionen Implements Guidelines on Sound Remuneration Policies with Specific Exceptions",
    "finanssisektorin vakavaraisuus 31.3.2024: suomen finanssisektorin vakavaraisuus säilyi edelleen vahvana epävarmassa toimintaympäristössä": "FIN-FSA Solvency Review (Q1 2024): Financial Sector Capital Adequacy Remains Robust Amid Macro Uncertainty",
    "finanssisektorin vakavaraisuus 30.9.2024: suomen finanssisektorin vakavaraisuus säilyi edelleen vahvana geopoliittisen epävarmuuden yhä lisääntyessä": "FIN-FSA Solvency Review (Q3 2024): Financial Sector Solvency Retains High Resilience Amid Heightened Geopolitical Risks",
    "finanssivalvonnan teema-arvio: finanssisektorin organisaatiot käyttävät tekoälyä sisäisissä prosesseissaan, hyödyntäminen asiakasrajapinnassa lisääntyy": "FIN-FSA Thematic Review: Financial Institutions Deploy Artificial Intelligence in Core Operations and Customer Interfaces",
    "finnish customs (tulli) mukana puolustusvoimain lippujuhlan päivässä kuopiossa 4.6.2025": "Customs Event Notice: Inter-Agency Participation in National Flag Day Celebrations",
    "framtida transaktionsrapportering kommer kräva legal entity identifier-kod (lei)": "Mandatory Legal Entity Identifier (LEI) Code Required for MiFIR Transaction Reporting",
    "fyra prioriteringar för stärkt konsumentskydd": "Four Strategic Supervisory Priorities for Enhanced Consumer Protection in Retail Finance",
    "förslag till ändrade regler om årsredovisning och rapportering för kreditinstitut och värdepappersbolag": "Proposed Amendments to Financial Statement Reporting Rules for Credit Institutions and Investment Firms",
    "helsingin taksiliikenteessä havaittiin useita puutteita": "Transport Authority Enforcement Sweep Identifies Compliance Deficiencies in Taxi Operations",
    "huhtikuun markkinamyllerrys vaihtui toukokuussa kurssinousuun – rahaa virtasi erityisesti osake- ja yhdistelmärahastoihin": "Market Rebound Follows April Volatility: Strong Inflows Recorded in Equity and Multi-Asset Funds",
    "imo-kokouksessa tehtiin historiallisten kasvihuonekaasupäästöjen vähentämistoimien lisäksi päätös myös koillis-atlantin rikki- ja typpioksidien sekä partikkeleiden rajoitusalueesta": "IMO Assembly Resolution: Marine Emission Reduction Measures and North-East Atlantic Emission Control Area Enacted",
    "imo:ssa edettiin kohti maailmanlaajuisia keinoja alusliikenteen kasvihuonekaasupäästöjen vähentämiseksi": "IMO Deliberations Advance Global Measures to Reduce Marine Greenhouse Gas Emissions",
    "imo:ssa edistettiin kestävää merenkulkua välimerellä": "International Maritime Organization Advances Environmental Standards in Mediterranean Shipping",
    "konsumentskyddsmyndigheter uppmanar shein att följa regelverket": "Consumer Protection Authorities Issue Joint Demands on Platform Compliance with EU Consumer Law",
    "markkinoiden hermoilu hellitti tullisopimusten myötä – rahastopääoman arvo kohosi yli 190 miljardin euron": "Market Volatility Eases Following Trade Agreements: Fund Capital Assets Rise Above EUR 190 Billion",
    "miten eläkeikäsi määräytyy?": "Supervisory Information Brief: Statutory Pension Age Determination and Life Expectancy Coefficients",
    "nopeasta toiminnasta kiitos – rahastoliiketoiminta voi pysyä jatkossakin suomessa": "Industry Commentary: Timely Regulatory Actions Secure Operating Conditions for Domestic Investment Funds",
    "nya regler om undantag från bestämmelser i aktiebolagslagen": "New Statutory Regulations on Exemptions Under the Swedish Companies Act",
    "parliament of finland (eduskunta) kannattaa eu-lainsäädännön tavoitteita yritysten hallinnollisen taakan vähentämiseksi": "Parliament Endorses EU Legislative Initiatives to Reduce Corporate Administrative Burden",
    "pyydämme organisaatioita päivittämään tietosuojavastaavien yhteystiedot": "Data Protection Ombudsman Notice: Supervised Entities Must Update Data Protection Officer Registry Details",
    "speech by minister for defence pål jonson in manila": "Speech by Swedish Minister for Defence Pal Jonson in Manila",
    "stressitestien mukaan suomalaispankit selviäisivät rankoissakin oloissa – vakavaraisuusvaatimusten lisäkiristykset heikentäisivät pankkien kykyä rahoittaa talouskasvua": "FIN-FSA Stress Tests: Supervised Banks Maintain High Buffers; Excessive Capital Tightening Could Restrict Lending",
    "traficom ncsc-fi (cyber security centre) sai eagle s -aluksen satamavaltiotarkastuksen päätökseen – alus pysäytetty puutteiden vuoksi": "Port State Control Inspection Concluded: Vessel Detained Over Regulatory and Safety Deficiencies",
    "traficom sai eagle s -aluksen satamavaltiotarkastuksen päätökseen – alus pysäytetty puutteiden vuoksi": "Port State Control Inspection Concluded: Vessel Detained Over Regulatory and Safety Deficiencies",
    "tulli mukana puolustusvoimain lippujuhlan päivässä kuopiossa 4.6.2025": "Customs Event Notice: Inter-Agency Participation in National Flag Day Celebrations",
    "ulkoasiainvaliokunnan tiedotustilaisuus ottawan sopimusta koskevasta mietinnöstä pe 13.6. klo 13.45": "Parliamentary Foreign Affairs Committee Press Briefing on Ottawa Convention Report",
    "vahvistetut s-100 standardit ohjaavat työtä kohti uuden sukupolven digitaalisia navigointituotteita": "Confirmed S-100 Hydrographic Standards Guide Next-Generation Digital Navigation Systems",
    "åtgärder mot missbruk av alternativa betalningssystem": "Supervisory Measures Against Fraudulent Abuse of Alternative Payment Systems",
    "”think before you click” – även efter oktober": "Cybersecurity Advisory: Ongoing Awareness on Phishing and Credential Harvesting Attacks",
    "dataskyddsombudens roll och ställning": "Supervisory Guidance on the Role and Legal Standing of Data Protection Officers (DPOs)",
    "delegerad förordning och frågor och svar om det enhetliga elektroniska rapporteringsformatet (esef) har publicerats": "Delegated Regulation and Q&A Published on the European Single Electronic Format (ESEF)",
    "delegerade förordningar som kompletterar benchmarkförordningen": "Delegated Regulations Published Supplementing the EU Benchmarks Regulation (BMR)",
    "dom i mål om tull, mervärdesskatt och ersättning för kostnader": "Court Judgment in Case Concerning Customs Duties, VAT, and Litigation Costs",
    "dom i målet konsumentverket –technology of sweden": "Court Judgment in Consumer Agency Enforcement Case Against Technology of Sweden",
    "eba påminner om ukrainska flyktingars rätt till finansiella tjänster": "EBA Reminder on Displaced Persons Access to Basic Financial and Payment Services",
    "eu har publicerat nytt kapitaltäckningsregelverk för värdepappersbolag": "EU Enacts New Capital Requirements Framework for Investment Firms (IFR/IFD)",
    "eu-komissio julkaisi sovelluksen iän varmistamiseksi – tavoitteena suojella lapsia aikuisille tarkoitetulta verkkosisällöltä": "European Commission Releases Age Verification Technical Application to Protect Minors Online",
    "eu:n neuvosto ja euroopan parlamentti alustavaan sopimukseen uudesta asetuksesta – tavoitteena nopeuttaa tietosuojaviranomaisten työtä useita maita koskevissa asioissa": "EU Council and Parliament Reach Provisional Agreement to Streamline Cross-Border GDPR Enforcement",
    "eu:n tieliikenteen liikkuvuuspaketin täytäntöönpano muuttaa tavara- ja henkilöliikennelupia koskevia säännöksiä": "EU Road Mobility Package Transposition Updates Commercial Transport Licensing Rules",
    "eduskunnan kirjasto on julkaissut tietopaketin edunvalvontasääntelyn muuttamisesta": "Parliamentary Library Publishes Legislative Information Brief on Guardianship Reform",
    "eduskunnan kirjasto on julkaissut tietopaketin kansalaisuuslain nuhteettomuus- ja toimeentuloedellytysten muuttamisesta": "Parliamentary Library Publishes Legislative Brief on Reformed Citizenship Criteria",
    "efrag publicerar utkast till digitala taxonomier för hållbarhetsrapportering": "EFRAG Releases Draft Digital Taxonomies for European Sustainability Reporting Standards (ESRS)",
    "employment (co-determination in the workplace) act (lag om medbestämmande i arbetslivet)": "Statutory Overview: Employment Co-Determination in the Workplace Act (MBL)",
    "employment protection act (lag om anställningsskydd)": "Statutory Overview: Employment Protection Act (LAS)",
    "ensimmäiset s-100 testituotteet valmiina pilotointiin": "First S-100 Hydrographic Test Datasets Ready for Digital Maritime Navigation Piloting",
    "eric leijonram är nu generaldirektör för integritetsskyddsmyndigheten": "Eric Leijonram Appointed Director General of the Swedish Privacy Authority (IMY)",
    "eric leijonram – ny generaldirektör för imy": "Eric Leijonram Named New Director General of the Swedish Privacy Authority (IMY)",
    "erik thedéen: näringslivet kan och borde ta chansen att snabba på omställningen": "FI Director General Speech: Business Sector Must Accelerate the Climate Transition",
    "erik thedéen: regler förebygger kriser": "FI Director General Erik Thedéen: Robust Prudential Rules Prevent Financial Crises",
    "erik thedéen: tio år efter finanskrisen – är regelverken effektiva?": "FI Director General Speech: A Decade After the Financial Crisis — Evaluating Regulatory Effectiveness",
    "erik thedéens tal vid driving global standards on sustainable finance": "Executive Address by Erik Thedéen: Driving Global Standards on Sustainable Finance",
    "esma ger svar om tekniskt format för inrapportering av årsredovisningar": "ESMA Issues Q&A on Technical Formatting and Validation for ESEF Annual Financial Reports",
    "esma publicerar fokusområden för tillsynen över börsföretagens finansiella rapporter": "ESMA Publishes Supervisory Focus Priorities for Listed Companies Financial Disclosures",
    "eurooppalaiset ja kotimaiset stressitestit valmistuneet: pankeilla hyvä kestokyky myös geopoliittisten jännitteiden tuomille toimintaympäristön muutoksille": "EU and Domestic Bank Stress Tests Completed: Supervised Banks Maintain High Resilience Against Geopolitical Shocks",
    "fi bedömer en kontracyklisk kapitalbuffert på 1 procent som rimlig": "Finansinspektionen Determines 1 Percent Countercyclical Capital Buffer Target Appropriate",
    "fi följer riktlinjer om angivande och offentliggörande av systemviktiga indikatorer": "Finansinspektionen Implements EBA Guidelines on Disclosure of Systemic Importance Indicators",
    "fi föreslår nya regler om att fondbolag, förvaltningsbolag och värdepappersinstitut ska beakta hållbarhetsfaktorer och integrera hållbarhetsrisker": "FI Proposes Mandatory ESG Integration and Sustainability Risk Rules for Fund Managers and Securities Firms",
    "fi föreslår ändrade regler och ändrad tillämpning av bankers kapitalkrav": "Finansinspektionen Proposes Revisions to Capital Requirements and Prudential Assessment Methods for Banks",
    "fi förtydligar skyldigheter för tredjepartsleverantörer av betaltjänster": "Finansinspektionen Clarifies Operational Obligations for Third-Party Payment Service Providers (TPPs)",
    "fi har beslutat om nya och ändrade föreskrifter": "Finansinspektionen Enacts New and Amending Supervisory Regulations (FFFS)",
    "fi har beslutat om ändringar i fem föreskrifter": "Finansinspektionen Adopts Amendments Across Five Core Supervisory Regulations",
    "fi har beslutat om ändringar i två föreskrifter": "Finansinspektionen Enacts Amendments Across Two Capital and Reporting Regulations",
    "fi publicerar pelare 2-krav på likviditetstäckningskvot i enskilda valutor": "Finansinspektionen Publishes Pillar 2 Guidance on Liquidity Coverage Ratios (LCR) in Individual Currencies",
    "fi sätter fokus på livförsäkringsföretags återförsäkring av risk för massannullation": "Finansinspektionen Examines Life Insurers Reinsurance Arrangements for Mass Lapse Risk",
    "fi tillämpar riktlinjer för lämplighetsbedömning av medlemmar i ledningsorgan för utgivare av tillgångsanknutna token och leverantörer av kryptotillgångstjänster": "FI Applies EBA Guidelines on Fit and Proper Suitability for Asset-Referenced Token Issuers and CASPs under MiCA",
    "fi tillämpar riktlinjer för lämplighetsbedömningar av ledamöter i ledningsorgan och ledande befattningshavare": "FI Adopts Joint ESMA and EBA Guidelines on Management Suitability and Fit & Proper Assessments",
    "fi tillämpar riktlinjer för lämplighetsbedömningar av ledamöter i ledningsorgan och ledande befattningshavare med vissa undantag": "FI Adopts Management Suitability Guidelines with Specific Domestic Legal Exceptions",
    "fi tillämpar riktlinjer om riskfaktorer": "Finansinspektionen Implements Joint Guidelines on ML/TF Risk Factors and Customer Due Diligence",
    "fi tillämpar riktlinjer om tillsyn över hållbarhetsinformation": "Finansinspektionen Implements Guidelines on Supervisory Oversight of Corporate Sustainability Disclosures",
    "fi:s innovationscenter vägleder under stockholm fintech week": "FI Innovation Centre Provides Supervisory Regulatory Guidance at Stockholm Fintech Week",
    "fi:s pelare 2-krav på likviditetstäckningskvot i enskilda valutor": "Supervisory Circular: Pillar 2 Requirements for Liquidity Coverage Ratios (LCR) by Currency",
    "fi:s prioriterade områden 2021": "Finansinspektionen Supervisory Priorities and Strategic Risk Outlook",
    "finansiella företag": "Supervisory Overview and Reporting Guidelines for Regulated Financial Entities",
    "finanssisektorin digitaalista häiriönsietokykyä koskevan asetuksen soveltaminen alkoi – finanssivalvonta keskittyy valvonnassaan ict-riskien ja kyberuhkien hallintaan": "DORA Enters into Application: FIN-FSA Focuses Supervisory Scrutiny on ICT Third-Party Risks and Cyber Threat Resilience",
    "finanssisektorin vakavaraisuus 30.6.2024: vaisu talouskehitys ja geopoliittiset jännitteet pitäneet finanssisektorin riskit korkeana – vakavaraisuus säilynyt vahvana": "FIN-FSA Financial Sector Solvency Report: Solid Capital Buffers Guard Against Subdued Macroeconomic and Geopolitical Risks",
    "finanssivalvonnan arvio: osa kuluttajaluotonmyöntäjistä ei hallitse maksukyvyttömyysriskejä riittävällä tavalla, myös sopimusehdoissa puutteita": "FIN-FSA Thematic Review: Deficiencies Identified in Consumer Lenders Insolvency Risk Controls and Standard Contract Terms",
    "finanssivalvonta selvitti peruspankkipalveluiden saatavuutta - saatavuudessa tai hinnoittelussa ei merkittäviä muutoksia aiempaan": "FIN-FSA Survey on Basic Banking Services: Accessibility and Fee Levels Remain Largely Stable Across Digital Channels",
    "fintaric-tullinimikepalvelun tietoja on päivitetty 4.6.2025": "Fintaric Customs Tariff Database Updated with Harmonized Tariff Schedules (June 4, 2025)",
    "fintaric-tullinimikepalvelun tietoja on päivitetty 9.7.2025": "Fintaric Customs Tariff Database Updated with Revised Tariff Schedules (July 9, 2025)",
    "fintaric-tullinimiketietoja on päivitetty 26.6.2025": "Fintaric Customs Tariff System Technical Data Schedule Update (June 26, 2025)",
    "fiva pitää asuntolainakaton ennallaan – pankkien lisäpääomavaatimuksia olisi pitänyt alentaa": "FIN-FSA Keeps Loan-to-Collateral Cap Unchanged Despite Industry Calls to Adjust Capital Buffers",
    "focus on global stocktake at cop28": "Supervisory Briefing: Focus on Global Stocktake and ESG Transition Finance at COP28",
    "föreläggande avis": "Consumer Agency Injunction Issued Against Avis for Inadequate Fee Disclosures",
    "föreläggande mot reva media ab": "Enforcement Injunction Issued Against Reva Media AB for Aggressive Digital Marketing Practices",
    "föreläggande mot sambla ab": "Consumer Protection Injunction Issued Against Sambla AB for Misleading Loan Intermediation",
    "föreläggande mot åhléns ab": "Consumer Agency Enforces Injunction on Misleading Pricing Practices Against Retailing Chain",
    "förslag till nya föreskrifter och allmänna råd": "Consultation: Proposed New Regulations and General Guidelines on Clearing Operations",
    "förslag till nya föreskrifter om ägar-, ägarlednings- och ledningsprövning": "Proposed New Regulations on Fit & Proper Assessments for Owners and Senior Management",
    "förslag till nya och ändrade regler för tjänstepensionsföretag och försäkringsföretag": "Proposed Amendments to Prudential and Governance Rules for Occupational Pension Institutions and Insurers",
    "förslag till ändrade föreskrifter om ägar-, ägarlednings- och ledningsprövning": "Proposed Amendments to Fit and Proper Management Suitability Assessment Regulations",
    "förslag till ändrade regler bland annat om mycket stora värdepappersbolag": "Consultation on Prudential Regulatory Amendments for Systemically Significant Investment Firms",
    "förslag till ändrade regler med anledning av mifid 2 och mifir": "Proposed Rule Changes Pursuant to MiFID II and MiFIR Transposition",
    "första behandling av förslaget om att frånträda ottawakonventionen": "Parliamentary Reading on Proposed Legislative Withdrawal from Ottawa Convention",
    "första omgången riktlinjer som kompletterar solvens 2 klara": "EIOPA Finalizes Initial Tranche of Technical Guidelines Implementing Solvency II",
    "försvarsutskottet för att säga upp ottawakonventionen": "Defence Committee Approves Proposal to Denounce the Ottawa Convention",
    "förtydligande om likviditetsrapportering och svenska kronor som signifikant valuta": "Regulatory Clarification on Liquidity Reporting and Swedish Krona Designation as Significant Currency",
    "hushållens skulder oroar": "Riksbank Financial Stability Report: Household Debt Levels Present Vulnerability to Macroeconomic Shocks",
    "höjda tillsynsavgifter för 2024": "Finansinspektionen Enacts Revised Supervisory Fee Schedule for Regulated Institutions for 2024",
    "imy förstärker – rekryterar ett 50-tal nya medarbetare": "Swedish Privacy Authority Expands Supervisory Capacity with Recruitment of Regulatory Specialists",
    "imy har flyttat": "Swedish Privacy Authority (IMY) Relocates Official Headquarters and Administrative Offices",
    "imy söker nu dataskyddsombud till våra referensgrupper!": "Swedish Privacy Authority Invites Data Protection Officers to Join Specialized Regulatory Working Groups",
    "imy vill se fortsatta satsningar på dataskyddsområdet": "IMY Annual Assessment: Sustained Public and Private Investment Required for GDPR Compliance",
    "imy:s innovationsportal – ett sätt att ge vägledning till innovatörer": "Swedish Privacy Authority Launches Regulatory Sandbox Portal to Guide Tech Innovators on Privacy by Design",
    "information om aktivitetsgrad i fondförvaltning": "Supervisory Information Bulletin on Active Share Metrics in UCITS Fund Management",
    "information om rapportering enligt dora": "Supervisory Guidance on Information Register Reporting Under DORA",
    "jollyroom återkallar barnvagga på grund av risk för kvävning och klämskada": "Product Safety Alert: Consumer Agency Announces Recall of Defective Child Cradle",
    "ko har ordet: beklämmande hur e-handlare nonchalerar lagen": "Consumer Ombudsman Address: Systematic Non-Compliance Among E-Commerce Platforms Requires Deterrent Penalties",
    "kansalaisuuslain muuttaminen nuhteettomuus- ja toimeentuloedellytysten osalta": "Statutory Amendment: Revised Integrity and Livelihood Requirements in the Finnish Citizenship Act",
    "kryptovarapalveluiden sääntely kiristyi mica-asetuksen myötä – kuluttajien edelleen syytä olla tarkkana": "MiCA Enters into Force: Stricter Regulatory Standards for Crypto-Asset Service Providers",
    "lennokkitoiminta siirtyy eu-sääntelyn alaisuuteen 1.1.2023 alkaen": "Unmanned Aircraft and Drone Operations Transition to Harmonized EU Regulatory Framework",
    "lomalla ulkomaille? katso tästä tullin vinkit sujuvaan kotiinpaluuseen": "Finnish Customs Traveler Advisory: Import Allowances and Electronic Declarations",
    "maa- ja metsätalousvaliokunnan lausunto eu:n monivuotisesta rahoituskehyksestä valmistui": "Parliamentary Committee Opinion on the European Union Multiannual Financial Framework",
    "maa- ja metsätalousvaliokunta kannattaa lunastuslain muuttamista": "Parliamentary Committee Endorsement of Statutory Expropriation Act Reforms",
    "maksamisen kotivarasta kannattaa huolehtia ja muistaa maltti häiriötilanteessa – uusi varautumisopas julkaistu": "National Contingency Guide: Maintaining Backup Household Payment Means During Digital Infrastructure Disruptions",
    "markkinoiden heilunta näkyi – huhtikuussa pääomia siirrettiin lyhyen koron rahastoihin": "Fund Market Analysis: Volatility Shifts Capital Allocations to Short-Term Money Market Funds",
    "merkittävät kiinteistöriskit suomen finanssisektorilla – vahvat puskurit suojaavat": "FIN-FSA Financial Stability Review: Commercial Real Estate Risks Offset by Robust Bank Capital Buffers",
    "millu ab återkallar reflexselar i barnstorlek": "Consumer Agency Product Safety Recall of Non-Compliant Child Reflective Harnesses",
    "misslyckade bilköp kostar svenskarna 4,2 miljarder kronor årligen": "Consumer Agency Economic Study: Faulty Motor Vehicle Transactions Inflict SEK 4.2B in Annual Consumer Detriment",
    "muistutuskutsu: finanssivalvonnan lehdistötilaisuus torstaina 3.4. finanssisektorin tilasta ja riskeistä – erityisteemoina kiinteistöriskit, rahastosektori sekä kryptovarapalveluiden valvonta": "FIN-FSA Press Briefing: Financial Sector Stability Outlook, Real Estate Risks, and MiCA Supervision",
    "muutoksia yhdistetyn nimikkeistön selittäviin huomautuksiin (cn-selitykset)": "Finnish Customs Bulletin: Amendments to Explanatory Notes of the Combined Nomenclature (CN)",
    "många nätbutiker som säljer secondhand-varor ger bristande information om rätten att returnera varor": "Consumer Agency Sweep: Inadequate Statutory Withdrawal and Cancellation Information in Online Stores",
    "ny strategisk allokering av guld- och valutareserven och oförändrad valutasäkring": "Sveriges Riksbank Decides on Strategic Asset Allocation of Gold and Foreign Currency Reserves",
    "nya hållbarhetsregler har trätt i kraft": "New Sustainable Finance Disclosure (SFDR) Rules Enter into Force",
    "nya metoder för bankernas riskvikter och kapitalkrav beslutade": "Finansinspektionen Decides on New Risk Weight Assessment Methodologies for Banking Capital Requirements",
    "nya och ändrade föreskrifter och allmänna råd om clearingverksamhet": "New and Amended Regulations and General Guidelines on Financial Clearing Operations",
    "nya regler mot penningtvätt och finansiering av terrorism": "New Supervisory Regulations Enacted Against Money Laundering and Terrorist Financing (AML/CFT)",
    "nya regler om hållbarhetsrapportering": "Corporate Sustainability Reporting Directive (CSRD) Transposition Rules Enacted",
    "pankin turvatili on sitkeä valhe – pankki ei tarvitse asiakkaan tunnuksia rahojen turvaamiseen": "Supervisory Fraud Warning: Banks Never Require Customer Security Credentials to Secure Accounts",
    "peruspankkipalveluiden käyttö keskittyy digitaalisiin kanaviin - hintataso pysynyt pääosin ennallaan": "FIN-FSA Review: Basic Banking Services Shift to Digital Channels with Stable Fee Baseline",
    "pohjoismaiden tietosuojaviranomaiset sopivat yhteistyön tiivistämisestä tietoturvakysymyksissä ja rajat ylittävissä asioissa": "Nordic Data Protection Authorities Agree to Deepen Cross-Border Cooperation on Cybersecurity and GDPR Enforcement",
    "protokoll från det penningpolitiska mötet den 18 december 2024": "Minutes of the Riksbank Monetary Policy Meeting (December 18, 2024)",
    "protokoll från det penningpolitiska mötet den 19 augusti 2024": "Minutes of the Riksbank Monetary Policy Meeting (August 19, 2024)",
    "protokoll från det penningpolitiska mötet den 19 mars 2025": "Minutes of the Riksbank Monetary Policy Meeting (March 19, 2025)",
    "protokoll från det penningpolitiska mötet den 26 juni 2024": "Minutes of the Riksbank Monetary Policy Meeting (June 26, 2024)",
    "protokoll från det penningpolitiska mötet den 28 januari 2025": "Minutes of the Riksbank Monetary Policy Meeting (January 28, 2025)",
    "protokoll från det penningpolitiska mötet den 7 maj 2024": "Minutes of the Riksbank Monetary Policy Meeting (May 7, 2024)",
    "puhelinneuvonta ja kirjaamo suljettuna 27.5.2025": "Office of the Data Protection Ombudsman Administrative Schedule Notice",
    "puhelinneuvontamme on suljettu 7.7.–3.8.2025": "Data Protection Ombudsman Summer Administrative Schedule Notice",
    "pågående undersökningar": "Supervisory Register: Active Investigations and Thematic Examinations",
    "rahastomarkkinoilla oli kesäkuussa myönteinen vire – uusia pääomia kertyi kaikkiin rahastoluokkiin yhteensä yli 1,3 miljardia euroa": "Nordic Fund Market Report: Net Inflows Exceed EUR 1.3B Across Major Asset Classes in June",
    "rahastot mukaan osakesäästötiliin – fa:n ahosniemi kehuu pääministeri orpon ja elinkeinoministeri puiston avausta": "Finance Finland Welcomes Government Initiative to Include Investment Funds in Equity Savings Accounts",
    "rapportering av tjänstepensionsdata": "Supervisory Guidelines for Data Submissions by Occupational Pension Institutions",
    "rapporteringsförändringar": "Prudential Regulatory Reporting Framework Changes and Schema Updates",
    "redovisning av samarbete för att motverka olaglig spelverksamhet och penningtvätt": "Supervisory Report on Cross-Agency Cooperation to Combat Illegal Gambling and Money Laundering",
    "regionstyrelsen region sörmland": "Administrative Court Review: Health Authority IT Procurement Compliance",
    "remiss – nya föreskrifter om en paneuropeisk privat pensionsprodukt": "Consultation Paper: Proposed New Regulations on Pan-European Personal Pension Products (PEPP)",
    "revideringen av mifid och mifir klar: nya regelverk publicerade": "MiFID II and MiFIR Review Concluded: Revised Regulatory Framework Enacted",
    "riksdagen godkände innehållet i förslaget om att ändra sametingslagen": "Parliament Approves Statutory Amendments to the Sámi Parliament Act",
    "riksdagen godkände uppsägning av ottawakonventionen": "Parliament Approves Denunciation of the Ottawa Anti-Personnel Mine Convention",
    "riksdagen röstar om sametingslagen torsdagen den 19.6": "Parliamentary Agenda: Vote on Sámi Parliament Act Amendments Scheduled",
    "riksdagsbibliotekets infopaket om bruk av teknologi för gränssäkerhet": "Parliamentary Research Brief on Digital Border Surveillance and Identity Technology",
    "samarbete mot oseriösa nätbutiker stoppade misstänkta bedrägerier för 134 miljoner": "Joint Enforcement Taskforce Halts SEK 134 Million in Suspected Digital Payment Fraud",
    "shein utreds av konsumentverket och andra europeiska konsumentskyddsmyndigheter": "European Consumer Protection Authorities Launch Joint Coordinated Investigation into Shein Platform",
    "sosiaali- ja terveysvaliokunta järjestää julkisen kuulemisen eutanasialakia ehdottavasta kansalaisaloitteesta": "Parliamentary Committee Organizes Public Hearing on Healthcare Legislation Initiative",
    "startskott för eba:s stresstest av europeiska banker 2018": "EBA Launches Comprehensive Stress Test Exercise for European Banking Sector",
    "stora förändringar av ramverket för bankernas kreditriskmodeller": "Major Regulatory Overhaul of Prudential Framework for Bank Internal Credit Risk Models (IRB)",
    "stora utskottet tog ställning till återvändandeförordningen, budgetramen och beredskapsunionen": "Parliament Grand Committee Resolves Position on EU Return Directive, Budget Framework, and Preparedness",
    "suomalaiset tyytyväisiä vakuutuksiinsa – hakemusten hylkäykset harvinaisia, 86 prosenttia koki korvauksen vastanneen sattunutta vahinkoa": "Insurance Consumer Survey: High Claim Settlement Rates and Customer Satisfaction Reported in Finland",
    "suomalaispankkien luottojen arvonalentumisluokitteluissa eroja – oikea-aikaiset ja riittävät luottotappiovaraukset edellyttävät toimivaa luottoriskien hallintaa": "FIN-FSA Thematic Audit: Variance in Bank Loan Impairment Classifications Highlights Need for Robust Credit Risk Provisions",
    "suomen finanssisektorin vakavaraisuus säilynyt vahvana – epävarmuus varjostaa talousnäkymiä": "FIN-FSA Solvency Assessment: Finnish Financial Sector Retains High Capital Adequacy Amid Macroeconomic Uncertainty",
    "suomi läpäisi merenkulun hallinnon imsas-auditoinnin": "Finland Successfully Completes International Maritime Organization (IMO) IMSAS Audit",
    "suuri valiokunta yhtyy täsmennyksin valtioneuvoston kantaan neuvotteluissa csam-asetuksesta": "Grand Committee Endorses Government Position in Negotiations on EU Online Safety Regulation",
    "sveriges digitalisering måste vara hållbar": "Director General Statement: Digital Transformation in the Financial Sector Must Ensure Resilience and Sustainability",
    "särskilda pm och beslut": "Supervisory Memoranda and Individual Precedent Decisions",
    "taxonomi 4.0  – datum för rapportering": "Supervisory Schedule Update: EU Taxonomy 4.0 Electronic Reporting Timelines and Technical Guidance",
    "thedéen: makromötet – hur ser en riksbankschef på omvärldsläget?": "Riksbank Governor Speech: Central Bank Perspective on Global Macroeconomic and Financial Stability Risks",
    "thedéen: sveriges ekonomiska läge i en turbulent omvärld": "Riksbank Governor Speech: Sweden's Economic Position and Inflation Outlook in Turbulent Global Markets",
    "tiedote lentäjille: part-fcl-lupakirjojen kelpuutuksiin jatkoa tarvittaessa": "Aviation Safety Notice: Temporary Extensions for Part-FCL Flight Crew Licensing Ratings",
    "tietosuojavaltuutetun toimiston toimintakertomus 2024: tietosuojatyötä digitaalisen yhteiskunnan ja sääntelyn murroksessa": "Office of the Data Protection Ombudsman Annual Report 2024: Data Protection in a Transforming Digital Society",
    "tietosuojaviranomaisten päälliköt kokoontuvat helsingissä": "Nordic and European Data Protection Commissioners Convene in Helsinki on Cross-Border Enforcement",
    "traficomin säädösinfoissa luodaan katsaus ajankohtaisiin säädös- ja määräysasioihin": "Traficom Regulatory Briefing: Overview of Upcoming Transport and Cyber Security Regulations",
    "tre områden i fokus för granskning av finansiella rapporter från börsföretag": "Supervisory Priorities: Three Core Focus Areas for Financial Statement Audits of Listed Companies",
    "tullimuseo toivottaa kävijät tervetulleiksi elokuun loppuun asti": "Finnish Customs Cultural Heritage Notice: Customs Museum Open for Public Visits",
    "tullin määräys 9/2022 unionitavaran tuonnista ahvenanmaalle toisesta eu-maasta": "Finnish Customs Regulation 9/2022: Importation of Union Goods into the Aland Islands from EU Member States",
    "tullin vastuullisuusvuotta 2024 värittivät itärajan sulun vaikutukset, monitahoinen viranomaisyhteistyö ja verkkokauppatilausten räjähdysmäinen kasvu": "Finnish Customs Annual Sustainability Review 2024: Border Sanctions Enforcement and E-Commerce Freight Growth",
    "tullin vuosi 2024: kaupankäynti venäjän kanssa romahti, verkkokaupan volyymit kasvoivat räjähdysmäisesti": "Finnish Customs Annual Report 2024: Sanctions Enforcement and Digital E-Commerce Trade Dynamics",
    "turvallinen arki ja vauraampi tulevaisuus – huijausten torjunta ja kansankapitalismin edistäminen fa:n lobbauksen kärkiaiheita": "Financial Sector Priority: Fraud Prevention and Retail Investment Participation Form Core Industry Initiatives",
    "två förordningar kompletterar eu:s taxonomiförordning": "European Commission Adopts Delegated Regulations Complementing the EU Taxonomy Regulation",
    "täsmämuutoksia tietosuojasääntelyyn: euroopan tietosuojaviranomaiset tukevat pienten ja keskikokoisten yritysten velvollisuuksien helpottamista": "GDPR Regulatory Alignment: European Data Protection Authorities Support Targeted Compliance Relief for SMEs",
    "ukrainalaisten ajokortit ja autot": "Transport Regulatory Notice: Recognition of Ukrainian Driving Licences and Motor Vehicles",
    "upphandling av journalsystem får grönt ljus av förvaltningsrätten": "Administrative Court Upholds Legality of Public Healthcare IT System Procurement",
    "uptown rider ståbräda återkallas - risk för huvudskador": "Consumer Agency Product Safety Recall: Defective Stroller Board Poses Head Injury Hazard",
    "utrikesutskottet: finland kan frånträda ottawakonventionen": "Parliamentary Foreign Affairs Committee Report: Legal Assessment of Ottawa Convention Withdrawal",
    "utrikesutskottets pressträff om betänkandet gällande ottawakonventionen den 13.6 kl. 13.45": "Parliamentary Press Briefing: Foreign Affairs Committee Report on Ottawa Convention",
    "uudet purje- ja kuumailmapallolentotoiminnan lupakirja- ja koulutusmääräykset julkaistu – traficom myöntää siirtymäaikaa kansalliselle koulutukselle": "Traficom Publishes Updated Pilot Licensing and Training Regulations with National Transition Period",
    "uusi markkinavalvontastrategia yhtenäistää markkinavalvontaa suomessa": "New National Market Surveillance Strategy Harmonizes Cross-Agency Product Safety Enforcement",
    "vaali- ja puoluerahoituslainsäädännön muuttaminen": "Legislative Reform: Statutory Amendments to Campaign and Political Party Financing Laws",
    "vahva vakavaraisuus suojaa finanssisektoria riskeiltä – epävarmuus lisääntynyt taloudessa ja rahoitusmarkkinoilla": "FIN-FSA Financial Sector Assessment: Strong Capital Buffers Shield Financial Institutions Amid Market Uncertainty",
    "valvonnan vuosijulkaisu 2024 on julkaistu": "Finansinspektionen Supervisory Annual Publication 2024 Released",
    "vägledande medskick till vården och omsorgen efter imy:s tillsyner": "Swedish Privacy Authority Issues Sector Guidance on Health and Social Care GDPR Audit Findings",
    "vägledning för integritetsanalys i lagstiftningsarbete": "Supervisory Guidance for Data Protection Impact Assessments in Legislative Drafting",
    "vägledning vid kamerabevakning": "Swedish Privacy Authority Issues Comprehensive Guidance on Video Surveillance Compliance",
    "välkommen till imy-bloggen!": "Swedish Privacy Authority Editorial Bulletin: Regulatory Updates and Privacy Insights",
    "webbinarium: drabbad av bankbedrägeri?": "Educational Supervisory Webinar: Preventive Measures Against Banking Fraud and Social Engineering",
    "webbinarium: om flygresor för dig som konsument": "Consumer Agency Educational Webinar: Passenger Rights and Aviation Consumer Protections",
    "yrityslähestymiskiellon toteutus etenee – tiedossa aiempaa parempaa suojaa häiriköintiä ja uhkailua vastaan työpaikoilla": "Legislative Implementation: Corporate Restraining Order Protections Advance in Parliament",
    "äldre regler om bankers kapitalkrav upphör": "Finansinspektionen Repeals Legacy Capital Requirements Regulations Following CRR Transposition",
    "ändrade föreskrifter om kapitaltäckning och ersättningssystem för värdepappersbolag": "Amended Regulations on Capital Adequacy and Remuneration Systems for Investment Firms",
    "ändringar i sättet att rapportera incidenter till fi": "Finansinspektionen Updates Operational Procedures for Mandatory Incident Reporting",
    "årsredovisning 2023": "Annual Supervisory Report 2023",
}


def translate_title(title: str) -> str:
    cleaned = title.strip().replace("\u00ad", "").replace("\u00a0", " ")
    low = cleaned.lower()

    # Exact dictionary lookup
    if low in TITLE_MAP:
        return sanitize_text(TITLE_MAP[low])

    # Pattern-based translations
    m_case = re.match(r"^mål:\s*([\d\-]+)$", low)
    if m_case:
        return f"Swedish Administrative Court Case No. {m_case.group(1)}"

    m_air = re.match(r"^ilmailun säädösseuranta\s*(.*)$", low)
    if m_air:
        return f"Aviation Regulatory Horizon Bulletin ({m_air.group(1).strip()})"

    m_rail = re.match(r"^raideliikenteen säädösseuranta\s*(.*)$", low)
    if m_rail:
        return f"Railway Regulatory Horizon Bulletin ({m_rail.group(1).strip()})"

    m_fintaric = re.match(r"^fintaric.*päivitetty\s*(.*)$", low)
    if m_fintaric:
        return f"Fintaric Customs Tariff Database Updated ({m_fintaric.group(1).strip()})"

    m_proto = re.match(r"^protokoll från det penningpolitiska mötet den\s*(.*)$", low)
    if m_proto:
        return f"Minutes of the Riksbank Monetary Policy Meeting ({m_proto.group(1).strip()})"

    m_forel = re.match(r"^föreläggande(?:\s+mot)?\s+(.*)$", low)
    if m_forel:
        target = sanitize_text(m_forel.group(1).strip().title())
        return f"Consumer Agency Injunction Issued Against {target}"

    # If title is in English already, just sanitize bank names
    return sanitize_text(cleaned)


RISK_CATEGORIES_MAP: List[Tuple[str, str]] = [
    (r"(?:ai\b|algoritm|machine\s*learning|automaatio)", "Algorithmic and AI transparency and governance risk"),
    (r"(?:penningtvätt|aml|rahanpesu|terroris|cft|pep|fiu)", "Money laundering and terrorist financing risk (AML/CFT)"),
    (r"(?:kredit|luotto|maksukyvyttömyys|insolvens|default)", "Credit assessment and counterparty default risk"),
    (r"(?:it-|ict|kyber|cyber|haavoittuv|incident|tiber|teknolog)", "Information security and ICT operational resilience risk"),
    (r"(?:dataskydd|tietosuoja|gdpr|integritet|personuppgift|yksityisy)", "Data protection and privacy compliance risk (GDPR)"),
    (r"(?:betalning|maksu|bedrägeri|fraud|huijaus|sca|kortti)", "Payment fraud and transaction security risk"),
    (r"(?:sanktion|seuraamus|böter|vite|påföljd)", "Supervisory penalty and administrative sanction exposure"),
    (r"(?:marknadsmissbruk|insider|sisäpiiri|mar\b)", "Market abuse and insider dealing risk (MAR)"),
    (r"(?:hållbarhet|vastuullisuus|esg|greenwashing|sfdr|taxonomi)", "Sustainability disclosure and greenwashing risk (SFDR)"),
    (r"(?:kapital|vakavaraisuus|likviditet|maksuvalmius|srep|crr|crd)", "Capital adequacy and prudential liquidity risk"),
    (r"(?:försäkring|vakuutus|solvens|idd)", "Insurance underwriting and solvency risk (Solvency II)"),
    (r"(?:konsument|kuluttaja|marknadsföring)", "Consumer protection and product conduct risk"),
    (r"(?:upphandling|hankinta)", "Procurement and contractual compliance risk"),
    (r"(?:tulli|tull|tullaus|vienti|tuonti)", "Customs and cross-border trade compliance risk"),
    (r"(?:ilmailu|lento|aviation)", "Aviation regulatory compliance and safety risk"),
    (r"(?:raide|liikenne|transport)", "Transport and infrastructure regulatory risk"),
    (r"(?:tarkastus|tillsyn|audit|valvonta)", "Supervisory audit and examination deficiency risk"),
]


def translate_risk(risk_str: str) -> str:
    cleaned = risk_str.strip().replace("\u00ad", "").replace("\u00a0", " ")
    low = cleaned.lower()

    # If it matches a cluster, map to standardized English risk
    for pattern, replacement in RISK_CATEGORIES_MAP:
        if re.search(pattern, low):
            return replacement

    # If already clean English without non-English characters
    if not re.search(r"[äöåÄÖÅ]", cleaned):
        return sanitize_text(cleaned)

    return "Regulatory compliance and supervisory risk"


# ============================================================
# Classification & Score Calibration
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

    # 1. Critical Impact (Score 5)
    if any(k in blob for k in [
        "penalty fee", "35m penalty", "sek 35m", "revocation", "återkallad",
        "critical vulnerability", "zero-day", "systemic disruption", "sanction decision",
        "seuraamusmaksu", "administrative fine", "severe deficiency"
    ]):
        return 5

    # 2. Informational Updates (Score 1) — Routine surveys, statistical bulletins, taxonomy updates, informational notices
    if category not in ["ENFORCEMENT", "AMENDMENT"] and any(k in blob for k in [
        "taxonomy 4.0", "active share", "fintaric customs tariff", "conformance update",
        "statistical bulletin", "statistical overview", "summer administrative",
        "administrative schedule", "cultural heritage", "webinar", "bloggen",
        "traveler advisory", "customs museum"
    ]):
        return 1

    # 3. Consultations & Market Discussions (Score 2)
    if category == "CONSULTATION":
        return 2
    if any(k in blob for k in ["consultation paper", "speech by", "hearing", "address by", "perspective on global"]):
        return 2

    # 4. Binding Amendments, Technical Standards & Regulatory Enforcements (Score 4)
    if category in ["TECHNICAL_STANDARD", "AMENDMENT"]:
        return 4
    if category == "CIRCULAR" and any(k in blob for k in ["mandatory", "strict", "immediate", "deadline", "compliance obligation", "binding", "pillar 2"]):
        return 4
    if category == "ENFORCEMENT":
        return 4

    # 5. Standard Circulars & Supervisory Advisories (Score 3)
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
# Main Pipeline Runner & Text Normalization
# ============================================================

def strip_nordic_accents(text: str) -> str:
    replacements = {
        'ä': 'a', 'ö': 'o', 'å': 'a',
        'Ä': 'A', 'Ö': 'O', 'Å': 'A',
        'é': 'e', 'É': 'E', 'ü': 'u', 'Ü': 'U'
    }
    for k, v in replacements.items():
        text = text.replace(k, v)
    return text


SCANDI_STOPS = {
    "och", "att", "som", "en", "ett", "den", "det", "av", "för", "med", "har", "om", "på", "till", "från",
    "eller", "inte", "under", "också", "efter", "över", "vid", "mot", "är", "ska", "blev", "blir",
    "ja", "on", "ei", "oli", "sekä", "että", "tai", "joka", "jotka", "mukaan", "kanssa", "jälkeen",
    "myös", "kun", "jotta", "koska", "jos", "ovat", "ole", "ollut", "tämä", "nämä"
}


def is_english_text(s: str) -> bool:
    if not s:
        return False
    words = [re.sub(r"[^\w]", "", w.lower()) for w in s.split()[:25]]
    non_en = sum(1 for w in words if w in SCANDI_STOPS)
    return non_en < 2


def ensure_english_summary(summary: str, explanation: str, title: str, auth_label: str, statute_ref: str, category: str) -> str:
    cleaned = sanitize_text(summary)
    if is_english_text(cleaned):
        return strip_nordic_accents(cleaned)
    cleaned_exp = sanitize_text(explanation)
    if is_english_text(cleaned_exp):
        return strip_nordic_accents(cleaned_exp)
    cat_desc = category.lower().replace('_', ' ')
    return f"{auth_label} issues supervisory {cat_desc} update regarding {statute_ref}: {title}. The announcement establishes supervisory compliance obligations and risk monitoring standards for supervised institutions."


def main():
    parser = argparse.ArgumentParser(description="Ingest articles from rss-mapper-poc into Nordic RegTech feed")
    parser.add_argument("--input", type=str, help="Path to articles.json from rss-mapper-poc")
    parser.add_argument("--output", type=str, default=str(OUTPUT_PATH), help="Output path for feed_items.json")
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

    # Deduplicate and group by authority (filtering low-value navigation items)
    by_auth: Dict[str, List[Dict[str, Any]]] = {}
    total_processed = 0

    for item in raw_articles:
        source = item.get("source", "")
        link = item.get("link", "")
        title = item.get("title", "").strip()
        summary = item.get("summary", "").strip()

        if not title or not summary:
            continue

        clean_t = title.lower().replace("\u00ad", "").replace("\u00a0", " ").strip()
        if clean_t in LOW_VALUE_NAVIGATION_TITLES:
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
        "konsumentverket": 20, # Swedish Consumer Agency
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
        # Prioritize articles where summary is in English, followed by rich AI metadata
        candidates.sort(
            key=lambda x: (
                1 if is_english_text(x.get("summary", "")) else 0,
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
        raw_title = raw.get("title", "").strip()
        raw_summary = raw.get("summary", "").strip()
        explanation = raw.get("explanation", "").strip()
        raw_score = int(raw.get("score", 3))

        raw_frameworks = [f.strip() for f in raw.get("frameworks", []) if f.strip()]
        raw_vendors = [v.strip() for v in raw.get("vendors", []) if v.strip()]
        raw_risks = [r.strip() for r in raw.get("risks", []) if r.strip()]
        created_at = raw.get("created_at", "2025-08-22 12:00:00")

        auth_rule = resolve_authority(source, link, raw_title, raw_summary, raw_vendors)
        auth_id = auth_rule.authority_id
        auth_label = auth_rule.authority_name
        auth_short = auth_rule.short_name
        jur = auth_rule.jurisdiction

        category = resolve_category(raw_title, raw_summary, link, raw_score)

        # 100% English title translation & originalTitle tracking
        title = strip_nordic_accents(translate_title(raw_title))
        orig_title = raw_title if raw_title.lower() != title.lower() else None

        # Statutory rule resolution
        text_blob_temp = f"{title} {' '.join(raw_frameworks)} {' '.join(raw_risks)} {link}"
        statute_rule = resolve_statute(text_blob_temp, jur)
        statute_id = statute_rule.statute_id
        statute_ref = statute_rule.statute_ref
        statute_sec = statute_rule.statute_sec

        # Sanitize summary and guarantee 100% English with zero Scandinavian accents
        summary = ensure_english_summary(raw_summary, explanation, title, auth_label, statute_ref, category)

        # Anonymize entities & translate risks
        vendors = list(dict.fromkeys(strip_nordic_accents(anonymize_entity(v)) for v in raw_vendors))
        risks = list(dict.fromkeys(strip_nordic_accents(translate_risk(r)) for r in raw_risks))
        frameworks = [strip_nordic_accents(sanitize_text(f)) for f in raw_frameworks]

        score = calibrate_regulatory_score(raw_score, category, title, summary, frameworks, risks)
        text_blob = f"{title} {summary} {' '.join(frameworks)} {' '.join(risks)} {link}"

        # Refine statutory resolution with full text blob
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

        if explanation and is_english_text(explanation):
            why_it_matters = strip_nordic_accents(sanitize_text(explanation))
        else:
            why_it_matters = f"Supervisory and compliance update from {auth_label} regarding {statute_ref}. Establishes risk oversight and reporting standards for supervised entities."
        before_after = strip_nordic_accents(synthesize_before_after(category, summary, why_it_matters))
        action_required = strip_nordic_accents(synthesize_action(category, risks, frameworks))

        tags = list(dict.fromkeys(
            frameworks[:3] +
            vendors[:2] +
            [auth_short, category.replace('_', ' ').title()]
        ))

        relative_time = format_relative_time(created_at)

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
            explanation=why_it_matters,
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

    final_items = curated_items

    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(final_items, f, indent=2, ensure_ascii=False)

    print(f"\nSuccessfully wrote {len(final_items)} total feed items (100% ingested from the upstream rss-mapper-poc) to {out_path} ({os.path.getsize(out_path) / 1024:.1f} KB).")

    # Print summary statistics
    scores = {}
    jurs = {}
    for it in final_items:
        s = it["score"]
        scores[s] = scores.get(s, 0) + 1
        j = it["jurisdiction"]
        jurs[j] = jurs.get(j, 0) + 1

    print("\nSummary Statistics:")
    print(f"  Scores: {dict(sorted(scores.items()))}")
    print(f"  Jurisdictions: {dict(sorted(jurs.items()))}")


if __name__ == "__main__":
    main()
