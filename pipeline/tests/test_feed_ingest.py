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
    resolve_authority,
    resolve_category,
    resolve_governance_linkages,
    resolve_statute,
    translate_risk,
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


def test_resolve_authority_fin_fsa_and_swedish():
    """Verify accurate detection of FIN-FSA and Finansinspektionen."""
    # Direct FIN-FSA link
    auth = resolve_authority("www.finanssivalvonta.fi", "https://www.finanssivalvonta.fi/tiedotteet/test")
    assert auth is not None
    assert auth.authority_id == "fiva"
    assert auth.jurisdiction == "FI"

    # STT Info release for Finanssivalvonta
    auth_stt = resolve_authority(
        "www.sttinfo.fi",
        "https://www.sttinfo.fi/tiedote/70280942/roble-services",
        title="Finanssivalvonnan arvio luottolaitoksille",
        vendors=["Finanssivalvonta (FIN-FSA)"],
    )
    assert auth_stt is not None
    assert auth_stt.authority_id == "fiva"

    # Swedish FI
    auth_fi = resolve_authority("www.fi.se", "https://www.fi.se/sv/nyheter/2026/test")
    assert auth_fi is not None
    assert auth_fi.authority_id == "fi"
    assert auth_fi.jurisdiction == "SE"


def test_client_anonymity_mock_entities():
    """Verify that commercial banks are mapped to mock entities."""
    assert anonymize_entity("Nordea Bank") == "Nordic Sovereign Bank"
    assert anonymize_entity("Swedbank AB") == "Polaris Wealth"
    assert anonymize_entity("SEB") == "Aura Asset Management"
    assert anonymize_entity("Klarna Bank AB") == "Nordic Fintech Services"
    assert anonymize_entity("Danske Bank") == "Nordic Credit Institution"
    assert anonymize_entity("Roble Services Oy") == "Licensed Payment Intermediary"


def test_language_standard_risk_translation():
    """Verify that non-English operational risk strings are translated to English."""
    swe_risk = "Regulatorisk efterlevnadsrisk för försäkringsföretag (implementering av Solvens II-krav)"
    trans = translate_risk(swe_risk)
    assert trans == "Regulatory compliance risk for insurance undertakings (Solvency II)"

    swe_fraud = "Betalningsbedrägerier (kontoöverföringar, kortbaserade transaktioner, e‑pengar)"
    assert translate_risk(swe_fraud) == "Payment fraud risk (account transfers, card transactions, e-money)"

    generic_nordic = "Tillsyns- och sanktionsexponering om riktlinjer/föreskrifter inte följs"
    assert translate_risk(generic_nordic) == "Supervisory sanction and enforcement exposure for regulatory non-compliance"


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
    """Verify calibrated regulatory impact scores."""
    # Critical penalty
    score_crit = calibrate_regulatory_score(3, "ENFORCEMENT", "SEK 35M penalty fee imposed", "Alert backlogs", [], ["Sanction risk"])
    assert score_crit == 5

    # Consultation paper
    score_cons = calibrate_regulatory_score(4, "CONSULTATION", "EBA launches consultation paper on liquidity", "Hearing", [], [])
    assert score_cons == 2
