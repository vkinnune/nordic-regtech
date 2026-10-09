import json
import re
import sys
from pathlib import Path

# Add pipeline directory to path
PIPELINE_ROOT = Path(__file__).resolve().parent.parent
if str(PIPELINE_ROOT) not in sys.path:
    sys.path.insert(0, str(PIPELINE_ROOT))

import pytest
from pydantic import ValidationError

from ingest_rss_feed import (
    AuthorityRule,
    FeedItemModel,
    PlainEnglishAnalysis,
    StatuteRule,
    anonymize_entity,
    calibrate_regulatory_score,
    ensure_english_summary,
    resolve_authority,
    resolve_category,
    resolve_governance_linkages,
    resolve_statute,
    sanitize_text,
    strip_nordic_accents,
    translate_risk,
    translate_title,
)


def test_pydantic_feed_item_model_valid():
    """Verify that FeedItemModel validates and serializes correctly."""
    item = FeedItemModel(
        id="feed-fi-test01",
        title="Finansinspektionen Issues Supervisory Guidance",
        authority="Finansinspektionen (Swedish FSA)",
        authorityId="fi",
        jurisdiction="SE",
        category="CIRCULAR",
        score=4,
        publishedAt="2026-03-24T12:00:00Z",
        relativeTime="Today",
        statuteId="sfs-2007-528",
        statuteSec="riksdagen_sfs-2007-528_k1_p1",
        statuteRef="SFS 2007:528 1 kap. 1 §",
        summary="Test summary of regulatory circular.",
        plainEnglish=PlainEnglishAnalysis(
            whyItMatters="Impacts investment firm licensing.",
            beforeAfter="Replaces discretionary practices with binding SLAs.",
            actionRequired="Update internal compliance policies.",
        ),
        frameworks=["MiFID II"],
        vendors=["Nordic Sovereign Bank"],
        risks=["Regulatory compliance and supervisory risk"],
        policyIds=["pol-alg-01"],
        controlIds=["ctl-alg-01"],
        riskIds=["rsk-alg-01"],
        sourceUrl="https://www.fi.se/test",
        source="www.fi.se",
        tags=["MiFID II", "FI"],
        status="UNREVIEWED",
    )

    dumped = item.model_dump()
    assert dumped["id"] == "feed-fi-test01"
    assert dumped["score"] == 4
    assert dumped["plainEnglish"]["whyItMatters"] == "Impacts investment firm licensing."


def test_pydantic_feed_item_model_invalid_missing_fields():
    """Verify that FeedItemModel enforces required fields."""
    with pytest.raises(ValidationError):
        FeedItemModel(
            id="incomplete-item",
            # missing required fields like title, authority, etc.
        )


def test_resolve_authority_domain_first():
    """Verify that domain matching strictly takes precedence over vendor tags."""
    # Swedish FI article referencing FIN-FSA in vendors must NOT be misclassified as fiva
    auth_sweden_with_fiva_vendor = resolve_authority(
        "www.fi.se",
        "https://www.fi.se/sv/publicerat/nyheter/2026/memorandum-nordic-supervision/",
        title="Nordic Supervisory Agreement on Branch Supervision",
        vendors=["Finansinspektionen", "Finanssivalvonta (FIN-FSA)"],
    )
    assert auth_sweden_with_fiva_vendor is not None
    assert auth_sweden_with_fiva_vendor.authority_id == "fi"
    assert auth_sweden_with_fiva_vendor.jurisdiction == "SE"

    # Direct FIN-FSA link
    auth_fiva = resolve_authority("www.finanssivalvonta.fi", "https://www.finanssivalvonta.fi/tiedotteet/test")
    assert auth_fiva is not None
    assert auth_fiva.authority_id == "fiva"
    assert auth_fiva.jurisdiction == "FI"

    # STT Info release for Finanssivalvonta
    auth_stt = resolve_authority(
        "www.sttinfo.fi",
        "https://www.sttinfo.fi/tiedote/70280942/roble-services",
        title="Finanssivalvonnan arvio luottolaitoksille",
        vendors=["Finanssivalvonta (FIN-FSA)"],
    )
    assert auth_stt is not None
    assert auth_stt.authority_id == "fiva"


def test_client_anonymity_strict_three_mock_entities():
    """Verify that commercial institutions are strictly mapped to the 3 mock entities."""
    # 1. Banks & Credit Institutions -> Nordic Sovereign Bank
    assert anonymize_entity("Nordea Bank Abp") == "Nordic Sovereign Bank"
    assert anonymize_entity("Handelsbanken") == "Nordic Sovereign Bank"
    assert anonymize_entity("Danske Bank") == "Nordic Sovereign Bank"
    assert anonymize_entity("Klarna Bank AB") == "Nordic Sovereign Bank"
    assert anonymize_entity("Aktia Pankki") == "Nordic Sovereign Bank"
    assert anonymize_entity("Alisa Pankki") == "Nordic Sovereign Bank"
    assert anonymize_entity("Roble Services Oy") == "Nordic Sovereign Bank"
    assert anonymize_entity("Ambrion Finans AB") == "Nordic Sovereign Bank"

    # 2. Wealth Managers & Retail Brokers -> Polaris Wealth
    assert anonymize_entity("Swedbank AB") == "Polaris Wealth"
    assert anonymize_entity("Avanza Bank") == "Polaris Wealth"
    assert anonymize_entity("Nordnet Bank") == "Polaris Wealth"
    assert anonymize_entity("Ermitage Partners") == "Polaris Wealth"

    # 3. Asset Managers & Insurers -> Aura Asset Management
    assert anonymize_entity("SEB") == "Aura Asset Management"
    assert anonymize_entity("Skandinaviska Enskilda Banken") == "Aura Asset Management"
    assert anonymize_entity("Coeli Asset Management") == "Aura Asset Management"
    assert anonymize_entity("Dina Försäkringar") == "Aura Asset Management"


def test_full_text_sanitization():
    """Verify that sanitize_text strips real bank names from titles and summaries."""
    raw_title = "Nordea Hypotek AB övrigt systemviktigt företag"
    clean_title = sanitize_text(raw_title)
    assert "Nordea" not in clean_title
    assert "Nordic Sovereign Bank" in clean_title

    raw_sum = "A joint initiative by Konsumentverket, the Swedish Police and major banks (Handelsbanken, Nordea, SEB, Swedbank)."
    clean_sum = sanitize_text(raw_sum)
    assert "Handelsbanken" not in clean_sum
    assert "Nordea" not in clean_sum
    assert "SEB" not in clean_sum
    assert "Swedbank" not in clean_sum
    assert "Nordic Sovereign Bank" in clean_sum
    assert "Polaris Wealth" in clean_sum
    assert "Aura Asset Management" in clean_sum


def test_language_standard_title_translation():
    """Verify that Swedish and Finnish titles are translated into 100% English."""
    t1 = translate_title("FI har beslutat om nya och ändrade föreskrifter")
    assert t1 == "Swedish Financial Supervisory Authority (FI) Enacts New and Amending Supervisory Regulations (FFFS)"

    t2 = translate_title("Eurooppalaiset ja kotimaiset stressitestit valmistuneet: pankeilla hyvä kestokyky myös geopoliittisten jännitteiden tuomille toimintaympäristön muutoksille")
    assert "EU and Domestic Bank Stress Tests Completed" in t2
    assert not re.search(r"[äöåÄÖÅ]", t2)

    t3 = translate_title("Mål: 4320-24")
    assert t3 == "Swedish Administrative Court Case No. 4320-24"


def test_language_standard_risk_translation():
    """Verify that non-English operational risk strings are translated to English."""
    swe_risk = "Regulatorisk efterlevnadsrisk för försäkringsföretag (implementering av Solvens II-krav)"
    trans = translate_risk(swe_risk)
    assert trans == "Insurance underwriting and solvency risk (Solvency II)"
    assert not re.search(r"[äöåÄÖÅ]", trans)

    swe_fraud = "Betalningsbedrägerier (kontoöverföringar, kortbaserade transaktioner, e‑pengar)"
    trans_fraud = translate_risk(swe_fraud)
    assert trans_fraud == "Payment fraud and transaction security risk"

    swe_aml = "Rahanpesun ja terrorismin rahoittamisen estämisen puutteet"
    trans_aml = translate_risk(swe_aml)
    assert trans_aml == "Money laundering and terrorist financing risk (AML/CFT)"


def test_statutory_and_governance_matrix_linkages():
    """Verify statutory provision resolution and governance causality to real IDs."""
    statute_aml = resolve_statute("Penningtvätt och finansiering av terrorism SFS 2017:630", "SE")
    assert statute_aml.statute_id == "sfs-2017-630"
    assert statute_aml.statute_sec == "riksdagen_sfs-2017-630_k3_p1"

    policies, controls, risks = resolve_governance_linkages(statute_aml.statute_id, "penningtvätt")
    assert "pol-aml-01" in policies
    assert "ctl-aml-01" in controls
    assert "rsk-aml-01" in risks

    # DORA
    statute_dora = resolve_statute("Digital operational resilience DORA ICT third-party risk", "EU")
    assert statute_dora.statute_id == "reg-dora"
    assert statute_dora.statute_sec == "dora-art-28"

    pol_dora, ctl_dora, rsk_dora = resolve_governance_linkages(statute_dora.statute_id, "dora cloud")
    assert "pol-dora-01" in pol_dora
    assert "ctl-dora-01" in ctl_dora
    assert "rsk-dora-01" in rsk_dora


def test_score_calibration():
    """Verify calibrated regulatory impact scores across critical, high, and informational tiers."""
    # Critical penalty (Score 5)
    score_crit = calibrate_regulatory_score(3, "ENFORCEMENT", "SEK 35M penalty fee imposed", "Alert backlogs", [], ["Sanction risk"])
    assert score_crit == 5

    # Consultation paper (Score 2)
    score_cons = calibrate_regulatory_score(4, "CONSULTATION", "EBA launches consultation paper on liquidity", "Hearing", [], [])
    assert score_cons == 2

    # Informational / statistical / taxonomy update (Score 1)
    score_info = calibrate_regulatory_score(1, "TECHNICAL_STANDARD", "Taxonomy 4.0 Reporting Timeline Update", "Conformance update", [], [])
    assert score_info == 1


def test_ingested_dataset_anonymity_and_english():
    """Verify that the generated feed_items.json strictly obeys client anonymity and 100% English."""
    feed_path = PIPELINE_ROOT.parent / "src/data/feed_items.json"
    if not feed_path.exists():
        pytest.skip("feed_items.json not generated yet")

    with open(feed_path, "r", encoding="utf-8") as f:
        items = json.load(f)

    forbidden_banks = ["nordea", "swedbank", "seb", "handelsbanken", "klarna", "aktia", "alisa pankki", "danske", "op osuuskunta", "op ryhmä"]

    score_1_count = 0
    for it in items:
        if it.get("score") == 1:
            score_1_count += 1

        # Client Anonymity across title, summary, vendors
        for b in forbidden_banks:
            pattern = r"\b" + re.escape(b) + r"\b"
            assert not re.search(pattern, it["title"], re.IGNORECASE), f"Found '{b}' in title: {it['title']}"
            assert not re.search(pattern, it["summary"], re.IGNORECASE), f"Found '{b}' in summary: {it['summary']}"
            for v in it.get("vendors", []):
                assert not re.search(pattern, v, re.IGNORECASE), f"Found '{b}' in vendor: {v}"

        # 100% English Language across title, summary, risks, vendors
        assert not re.search(r"[äöåÄÖÅ]", it["title"]), f"Scandinavian char in title: {it['title']}"
        assert not re.search(r"[äöåÄÖÅ]", it["summary"]), f"Scandinavian char in summary: {it['summary']}"
        for r in it.get("risks", []):
            assert not re.search(r"[äöåÄÖÅ]", r), f"Scandinavian char in risk: {r}"
        for v in it.get("vendors", []):
            assert not re.search(r"[äöåÄÖÅ]", v), f"Scandinavian char in vendor: {v}"

    # Verify Score 1 items exist
    assert score_1_count >= 5, f"Expected at least 5 Score 1 items, got {score_1_count}"
