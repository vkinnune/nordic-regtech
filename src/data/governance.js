/* ---------- STATUTORY GOVERNANCE DATA MODEL: POLICIES, CONTROLS, AND RISKS ---------- */

export const POLICIES = [
  {
    id: 'pol-alg-01',
    code: 'POL-ALG-01',
    title: 'Algorithmic and Automated Trading Governance Principles',
    shortTitle: 'Algorithmic Trading Policy',
    category: 'Trading & Market Conduct',
    owner: 'Workspace Admin',
    ownerRole: 'Head of Trading & Market Infrastructure',
    version: '3.1',
    status: 'NEEDS_REVIEW', // NEEDS_REVIEW, ACTIVE, DRAFT, RETIRED
    lastReviewDate: '2025-11-15',
    nextReviewDue: '2026-05-01',
    summary:
      'Defines mandatory testing requirements, pre-trade filters, risk limits, and 5-year order parameter retention for algorithmic and automated execution under Swedish securities market law.',
    statuteSections: ['riksdagen_sfs-2007-528_k14_p1', 'riksdagen_sfs-2007-528_k13_p7'],
    controlIds: ['ctl-alg-01', 'ctl-alg-02', 'ctl-alg-03'],
    riskIds: ['rsk-alg-01'],
    projectId: 'p5',
  },
  {
    id: 'pol-dora-01',
    code: 'POL-DORA-01',
    title: 'ICT Systems Risk & Digital Operational Resilience Principles',
    shortTitle: 'ICT Resilience & Third-Party Policy',
    category: 'Operational Resilience & ICT',
    owner: 'Workspace Owner',
    ownerRole: 'Chief Technology & Risk Officer',
    version: '2.0',
    status: 'NEEDS_REVIEW',
    lastReviewDate: '2026-01-10',
    nextReviewDue: '2026-06-30',
    summary:
      'Sets mandatory obligations under Swedish statutory transposition SFS 2024:1284 (SFS 2004:297 6 kap. 2 a §) for maintaining registers of critical ICT third-party providers, multi-cloud exit strategies, and digital operational testing.',
    statuteSections: ['riksdagen_sfs-2004-297_k6_p2a', 'riksdagen_sfs-2004-46_k2_p17c'],
    controlIds: ['ctl-dora-01', 'ctl-dora-02'],
    riskIds: ['rsk-dora-01'],
    projectId: 'p2',
  },
  {
    id: 'pol-aml-01',
    code: 'POL-AML-01',
    title: 'Anti-Money Laundering & Counter-Terrorist Financing Governance Policy (AML/CFT)',
    shortTitle: 'AML/CFT Governance Policy',
    category: 'Financial Crime & Sanctions',
    owner: 'Aura Kujanpää',
    ownerRole: 'MLRO / Senior AML Counsel',
    version: '4.0',
    status: 'ACTIVE',
    lastReviewDate: '2026-02-01',
    nextReviewDue: '2027-02-01',
    summary:
      'Defines customer due diligence (KYC), beneficial ownership identification, real-time PEP and sanctions screening procedures, and mandatory suspicious transaction reporting under SFS 2017:630.',
    statuteSections: ['riksdagen_sfs-2017-630_k3_p1', 'riksdagen_sfs-2017-630_k4_p1'],
    controlIds: ['ctl-aml-01', 'ctl-aml-02'],
    riskIds: ['rsk-aml-01'],
    projectId: 'p3',
  },
];

export const CONTROLS = [
  {
    id: 'ctl-alg-01',
    code: 'CTL-ALG-01',
    title: 'Pre-trade Order Limits and Automated Error Filters (Pre-trade Filters)',
    category: 'Algorithmic Trading',
    type: 'AUTOMATED', // AUTOMATED, MANUAL, REPORTING
    status: 'DEFICIENT', // EFFECTIVE, DEFICIENT, UNIMPLEMENTED
    frequency: 'Real-time / Transactional',
    owner: 'Workspace Admin',
    policyId: 'pol-alg-01',
    statuteSections: ['riksdagen_sfs-2007-528_k14_p1', 'riksdagen_sfs-2007-528_k13_p7'],
    riskId: 'rsk-alg-01',
    taskId: 't1',
    impactedByAmendment: 'SFS 2007:528 / FFFS 2023:12',
    amendmentAlert:
      'Finansinspektionen regulatory guidelines tighten algorithmic market surveillance and pre-trade limit enforcement. Real-time price deviation tolerances require calibration.',
    specification:
      'The system must automatically reject orders deviating more than 2.5% from the latest market price or exceeding 250,000 EUR in notional value.',
  },
  {
    id: 'ctl-alg-02',
    code: 'CTL-ALG-02',
    title: 'Algorithmic Parameter & Order Audit Log 5-Year Archival',
    category: 'Algorithmic Trading',
    type: 'AUTOMATED',
    status: 'EFFECTIVE',
    frequency: 'Continuous / Automated Archival',
    owner: 'Workspace Admin',
    policyId: 'pol-alg-01',
    statuteSections: ['riksdagen_sfs-2007-528_k14_p1', 'riksdagen_sfs-2007-528_k13_p7'],
    riskId: 'rsk-alg-01',
    taskId: null,
    specification:
      'All versioned algorithm parameters, submitted order data, and executed trades must be preserved in immutable WORM storage for at least 5 years for Finansinspektionen audits.',
  },
  {
    id: 'ctl-alg-03',
    code: 'CTL-ALG-03',
    title: 'Emergency Trading Kill Switch & Volatility Testing (Kill Switch)',
    category: 'Algorithmic Trading',
    type: 'MANUAL',
    status: 'DEFICIENT',
    frequency: 'Quarterly Simulation',
    owner: 'Workspace Admin',
    policyId: 'pol-alg-01',
    statuteSections: ['riksdagen_sfs-2007-528_k14_p1', 'riksdagen_sfs-2007-528_k13_p7'],
    riskId: 'rsk-alg-01',
    taskId: 't1',
    impactedByAmendment: 'SFS 2007:528 22 kap. 1 §',
    amendmentAlert:
      'Statutory provisions require verified emergency market suspension protocols and operational halt procedures under high-stress market conditions.',
    specification:
      'Trading infrastructure must feature a centralized emergency kill switch capable of cancelling all open orders across active venues within 200 milliseconds.',
  },
  {
    id: 'ctl-dora-01',
    code: 'CTL-DORA-01',
    title: 'Critical ICT Third-Party Provider Register & Multi-Cloud Exit Plans',
    category: 'Digital Operational Resilience',
    type: 'REPORTING',
    status: 'DEFICIENT',
    frequency: 'Semi-annual Update',
    owner: 'Workspace Owner',
    policyId: 'pol-dora-01',
    statuteSections: ['riksdagen_sfs-2004-297_k6_p2a', 'riksdagen_sfs-2004-46_k2_p17c'],
    riskId: 'rsk-dora-01',
    taskId: 't2',
    impactedByAmendment: 'SFS 2024:1284 / DORA',
    amendmentAlert:
      'Swedish statutory transposition SFS 2024:1284 (SFS 2004:297 6 kap. 2 a §) mandates formal contractual audit clauses and standardized registers of critical ICT third-party providers.',
    specification:
      'Audit rights, transition periods, and alternative providers must be mapped and board-approved for all ICT service contracts supporting critical or important business functions.',
  },
  {
    id: 'ctl-dora-02',
    code: 'CTL-DORA-02',
    title: 'Threat-Led Penetration Testing (TLPT) & Cyber Resilience',
    category: 'Digital Operational Resilience',
    type: 'MANUAL',
    status: 'EFFECTIVE',
    frequency: 'Annual',
    owner: 'Workspace Owner',
    policyId: 'pol-dora-01',
    statuteSections: ['riksdagen_sfs-2004-297_k6_p2a', 'riksdagen_sfs-2004-46_k2_p17c'],
    riskId: 'rsk-dora-01',
    taskId: null,
    specification: 'Independent third-party Red Teaming testing across critical core systems conducted in accordance with TIBER-SE frameworks.',
  },
  {
    id: 'ctl-aml-01',
    code: 'CTL-AML-01',
    title: 'Real-time Sanctions Screening & PEP Identification',
    category: 'Anti-Money Laundering',
    type: 'AUTOMATED',
    status: 'EFFECTIVE',
    frequency: 'Real-time & Daily Batch',
    owner: 'Aura Kujanpää',
    policyId: 'pol-aml-01',
    statuteSections: ['riksdagen_sfs-2017-630_k3_p1', 'riksdagen_sfs-2017-630_k4_p1'],
    riskId: 'rsk-aml-01',
    taskId: null,
    specification:
      'All counterparties, account owners, and beneficial owners screened against EU, UN, and OFAC sanctions lists prior to onboarding and re-screened daily under SFS 2017:630 3 kap.',
  },
  {
    id: 'ctl-aml-02',
    code: 'CTL-AML-02',
    title: 'Automated Suspicious Activity Monitoring & STR Dispatch',
    category: 'Anti-Money Laundering',
    type: 'AUTOMATED',
    status: 'EFFECTIVE',
    frequency: 'Real-time Alerting',
    owner: 'Aura Kujanpää',
    policyId: 'pol-aml-01',
    statuteSections: ['riksdagen_sfs-2017-630_k3_p1', 'riksdagen_sfs-2017-630_k4_p1'],
    riskId: 'rsk-aml-01',
    taskId: null,
    specification:
      'Rule-based anomaly detection flags unusual transaction volumes, velocity surges, or high-risk jurisdictions, triggering immediate investigative dossiers for the MLRO under SFS 2017:630 4 kap.',
  },
];

export const RISKS = [
  {
    id: 'rsk-alg-01',
    code: 'RSK-ALG-01',
    title: 'Supervisory Administrative Sanctions & Trading Suspension',
    category: 'Supervisory Enforcement & Market Disruption',
    severity: 'CRITICAL', // CRITICAL, HIGH, MEDIUM, LOW
    likelihood: 'MEDIUM', // HIGH, MEDIUM, LOW
    exposureScore: 85,
    authority: 'Finansinspektionen (FI)',
    consequence:
      'Algorithmic market disruption or failure to notify supervisory authorities may result in public reprimands, administrative fines up to 10% of turnover, and temporary suspension of algorithmic trading authorization under SFS 2007:528.',
    statuteSections: ['riksdagen_sfs-2007-528_k14_p1', 'riksdagen_sfs-2007-528_k13_p7'],
    policyIds: ['pol-alg-01'],
    controlIds: ['ctl-alg-01', 'ctl-alg-02', 'ctl-alg-03'],
    gapStatus: 'OPEN_GAPS', // COVERED, OPEN_GAPS, AT_RISK
    gapSummary: '2 controls require review following updated market surveillance guidance.',
  },
  {
    id: 'rsk-dora-01',
    code: 'RSK-DORA-01',
    title: 'Critical Cloud Service Outage & DORA Non-Compliance Sanctions',
    category: 'ICT Resilience & Third-Party Risk',
    severity: 'HIGH',
    likelihood: 'HIGH',
    exposureScore: 78,
    authority: 'Finansinspektionen (FI)',
    consequence:
      'Unplanned service disruption in core banking or portfolio management without DORA-compliant redundancy leads to direct regulatory penalties and client liabilities under SFS 2004:297 6 kap. 2 a §.',
    statuteSections: ['riksdagen_sfs-2004-297_k6_p2a', 'riksdagen_sfs-2004-46_k2_p17c'],
    policyIds: ['pol-dora-01'],
    controlIds: ['ctl-dora-01', 'ctl-dora-02'],
    gapStatus: 'OPEN_GAPS',
    gapSummary: 'Multi-cloud exit strategies and ICT provider register require completion under SFS 2024:1284.',
  },
  {
    id: 'rsk-aml-01',
    code: 'RSK-AML-01',
    title: 'AML System Failure Sanctions & Severe Reputational Damage',
    category: 'Legal & Financial Crime Penalty',
    severity: 'CRITICAL',
    likelihood: 'LOW',
    exposureScore: 92,
    authority: 'Finansinspektionen (FI)',
    consequence:
      'Deficiencies in sanctions screening or failure to verify beneficial owners exposes the firm to administrative fines of up to 10% of annual turnover and severe reputational harm under SFS 2017:630.',
    statuteSections: ['riksdagen_sfs-2017-630_k3_p1', 'riksdagen_sfs-2017-630_k4_p1'],
    policyIds: ['pol-aml-01'],
    controlIds: ['ctl-aml-01', 'ctl-aml-02'],
    gapStatus: 'COVERED',
    gapSummary: 'All identified statutory requirements covered by effective automated controls.',
  },
];

/* ============================================================
   DEEP GOVERNANCE MATRIX: O(1) Statutory Mapping & Gap Analysis
   ============================================================ */

export class GovernanceMatrix {
  constructor(policies = [], controls = [], risks = []) {
    this.policies = policies;
    this.controls = controls;
    this.risks = risks;

    this._secPolicies = new Map();
    this._secControls = new Map();
    this._secRisks = new Map();
    this._policyControls = new Map();
    this._riskControls = new Map();

    this.reindex();
  }

  reindex() {
    this._secPolicies.clear();
    this._secControls.clear();
    this._secRisks.clear();
    this._policyControls.clear();
    this._riskControls.clear();

    for (const p of this.policies) {
      for (const sec of p.statuteSections || []) {
        if (!this._secPolicies.has(sec)) this._secPolicies.set(sec, []);
        this._secPolicies.get(sec).push(p);
      }
    }

    for (const c of this.controls) {
      for (const sec of c.statuteSections || []) {
        if (!this._secControls.has(sec)) this._secControls.set(sec, []);
        this._secControls.get(sec).push(c);
      }
      if (c.policyId) {
        if (!this._policyControls.has(c.policyId)) this._policyControls.set(c.policyId, []);
        this._policyControls.get(c.policyId).push(c);
      }
      for (const riskId of new Set([c.riskId, ...(c.riskIds || [])].filter(Boolean))) {
        if (!this._riskControls.has(riskId)) this._riskControls.set(riskId, []);
        this._riskControls.get(riskId).push(c);
      }
    }

    for (const r of this.risks) {
      for (const sec of r.statuteSections || []) {
        if (!this._secRisks.has(sec)) this._secRisks.set(sec, []);
        this._secRisks.get(sec).push(r);
      }
      for (const ctlId of r.controlIds || []) {
        const ctl = this.controls.find(c => c.id === ctlId);
        if (ctl) {
          if (!this._riskControls.has(r.id)) this._riskControls.set(r.id, []);
          const existing = this._riskControls.get(r.id);
          if (!existing.includes(ctl)) existing.push(ctl);
        }
      }
    }
  }

  getSectionObligations(secId) {
    if (!secId) return { policies: [], controls: [], risks: [] };
    return {
      policies: this._secPolicies.get(secId) || [],
      controls: this._secControls.get(secId) || [],
      risks: this._secRisks.get(secId) || [],
    };
  }

  getComplianceGap(secId) {
    const ob = this.getSectionObligations(secId);
    const hasControls = ob.controls.length > 0;
    const hasPolicies = ob.policies.length > 0;
    const isCovered = hasControls && hasPolicies;

    return {
      isCovered,
      hasControls,
      hasPolicies,
      controlsCount: ob.controls.length,
      policiesCount: ob.policies.length,
      gapStatus: isCovered ? 'COVERED' : 'OPEN_GAPS',
    };
  }

  getPolicyControls(policyId) {
    return this._policyControls.get(policyId) || [];
  }

  getRiskControls(riskId) {
    return this._riskControls.get(riskId) || [];
  }

  getRiskExposure(r) {
    if (!r) return { score: 0, gapStatus: 'AT_RISK' };
    const ctls = this.getRiskControls(r.id);
    const baseScore = r.exposureScore || 70;
    if (!ctls.length) {
      return { score: baseScore, gapStatus: r.gapStatus || 'AT_RISK' };
    }
    const hasDeficient = ctls.some(c => c.status !== 'EFFECTIVE');
    const gapStatus = hasDeficient ? 'OPEN_GAPS' : 'COVERED';
    return { score: baseScore, gapStatus };
  }

  linkSection(secId, { type, id }) {
    if (!secId || !id) return false;
    let target = null;
    let map = null;

    if (type === 'control') {
      target = this.controls.find(c => c.id === id);
      map = this._secControls;
    } else if (type === 'policy') {
      target = this.policies.find(p => p.id === id);
      map = this._secPolicies;
    } else if (type === 'risk') {
      target = this.risks.find(r => r.id === id);
      map = this._secRisks;
    }

    if (!target) return false;
    if (!target.statuteSections) target.statuteSections = [];
    if (target.statuteSections.includes(secId)) return false;

    target.statuteSections.push(secId);
    if (!map.has(secId)) map.set(secId, []);
    map.get(secId).push(target);
    return true;
  }

  unlinkSection(secId, { type, id }) {
    if (!secId || !id) return false;
    let target = null;
    let map = null;

    if (type === 'control') {
      target = this.controls.find(c => c.id === id);
      map = this._secControls;
    } else if (type === 'policy') {
      target = this.policies.find(p => p.id === id);
      map = this._secPolicies;
    } else if (type === 'risk') {
      target = this.risks.find(r => r.id === id);
      map = this._secRisks;
    }

    if (!target || !target.statuteSections) return false;
    const idx = target.statuteSections.indexOf(secId);
    if (idx === -1) return false;

    target.statuteSections.splice(idx, 1);
    if (map.has(secId)) {
      const list = map.get(secId).filter(item => item.id !== id);
      map.set(secId, list);
    }
    return true;
  }
}

export function createGovernanceMatrix(policies, controls, risks) {
  return new GovernanceMatrix(policies, controls, risks);
}

export const defaultGovernanceMatrix = new GovernanceMatrix(POLICIES, CONTROLS, RISKS);
