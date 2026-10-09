/* ---------- seed data: Nordic Financial Compliance ---------- */
import { dOff, minsAgo, uid } from '../core/utils.js';
import { POLICIES, CONTROLS, RISKS } from './governance.js';
import { FEED_ITEMS } from './feed.js';

export function seed() {
  const members = [
    {
      id: 'm1',
      name: 'Workspace Owner',
      email: 'owner@example.com',
      role: 'Owner',
      team: 'compliance',
      title: 'Lead Solutions Architect · RegTech',
      c: '#0F52BA',
      status: 'active',
      last: 0,
      tz: 'Helsinki',
    },
    {
      id: 'm2',
      name: 'Workspace Admin',
      email: 'admin@example.com',
      role: 'Admin',
      team: 'compliance',
      title: 'Client Partner · Financial Services',
      c: '#3B82C4',
      status: 'active',
      last: 5,
      tz: 'Helsinki',
    },
    {
      id: 'm3',
      name: 'Compliance Officer',
      email: 'compliance@example.com',
      role: 'Admin',
      team: 'compliance',
      title: 'Chief Compliance Officer (2nd LoD)',
      c: '#8662C9',
      status: 'active',
      last: 12,
      tz: 'Stockholm',
    },
    {
      id: 'm4',
      name: 'Risk Manager',
      email: 'risk@example.com',
      role: 'Member',
      team: 'risk',
      title: 'Head of Operational Risk & Resilience',
      c: '#C48A1E',
      status: 'active',
      last: 28,
      tz: 'Stockholm',
    },
    {
      id: 'm5',
      name: 'AML Officer',
      email: 'aml@example.com',
      role: 'Member',
      team: 'compliance',
      title: 'MLRO & Anti-Financial Crime Lead',
      c: '#C54B78',
      status: 'active',
      last: 45,
      tz: 'Helsinki',
    },
    {
      id: 'm6',
      name: 'Legal Counsel',
      email: 'legal@example.com',
      role: 'Member',
      team: 'legal',
      title: 'Senior Regulatory Counsel',
      c: '#23918A',
      status: 'active',
      last: 120,
      tz: 'Stockholm',
    },
    {
      id: 'm7',
      name: 'Fund Operations',
      email: 'funds@example.com',
      role: 'Member',
      team: 'funds',
      title: 'Head of Fund Operations & Custody',
      c: '#3D8E5F',
      status: 'active',
      last: 320,
      tz: 'Stockholm',
    },
    {
      id: 'm8',
      name: 'Security Engineer',
      email: 'security@example.com',
      role: 'Member',
      team: 'it_security',
      title: 'Lead ICT Resilience Engineer',
      c: '#6B7280',
      status: 'active',
      last: 840,
      tz: 'Helsinki',
    },
  ];

  const projects = [
    {
      id: 'p1',
      key: 'SFS46',
      name: 'SFS 2004:46 · Värdepappersfonder',
      icon: 'book-open',
      color: 'indigo',
      status: 'active',
      team: 'legal',
      lead: 'm6',
      due: dOff(18),
      start: dOff(-60),
      fav: true,
      members: ['m1', 'm2', 'm3', 'm4', 'm6', 'm7'],
      desc: 'Swedish statutory framework for UCITS funds and fund management companies. Tracking legislative amendments via Riksdagen and Finansinspektionen FFFS circulars.',
      milestones: [
        { name: 'SFS 2004:46 Statutory Review', date: dOff(14) },
        { name: 'FI Quarterly Fund Return Filing', date: dOff(45) },
      ],
      last: 8,
    },
    {
      id: 'p2',
      key: 'SFS297',
      name: 'SFS 2004:297 · Bank- och finansiering',
      icon: 'shield-check',
      color: 'blue',
      status: 'risk',
      team: 'it_security',
      lead: 'm4',
      due: dOff(35),
      start: dOff(-90),
      fav: true,
      members: ['m1', 'm3', 'm4', 'm6', 'm8'],
      desc: 'Swedish Banking and Financing Business Act. Statutory governance of credit institutions, capital adequacy, risk control, and digital operational resilience (6 kap. 2 a §).',
      milestones: [
        { name: 'SFS 2004:297 6 kap. Resilience Review', date: dOff(5) },
        { name: 'Board Risk Management Attestation', date: dOff(20) },
        { name: 'Finansinspektionen Supervisory Audit Preparation', date: dOff(48) },
      ],
      last: 15,
    },
    {
      id: 'p3',
      key: 'SFS630',
      name: 'SFS 2017:630 · Penningtvättslagen',
      icon: 'lock',
      color: 'rose',
      status: 'active',
      team: 'compliance',
      lead: 'm5',
      due: dOff(28),
      start: dOff(-40),
      fav: true,
      members: ['m1', 'm3', 'm5', 'm6', 'm7'],
      desc: 'Swedish Act on Measures against Money Laundering and Terrorist Financing, aligned with FFFS 2017:11. KYC/CDD, transaction surveillance, and PEP screening.',
      milestones: [
        { name: 'Annual General Risk Assessment (GRA)', date: dOff(8) },
        { name: 'Sanctions Screening Architecture Audit', date: dOff(28) },
      ],
      last: 42,
    },
    {
      id: 'p4',
      key: 'FFFS9',
      name: 'FFFS 2013:9 · AIFM-Föreskrifter',
      icon: 'briefcase',
      color: 'amber',
      status: 'active',
      team: 'funds',
      lead: 'm7',
      due: dOff(45),
      start: dOff(-30),
      fav: false,
      members: ['m1', 'm3', 'm6', 'm7'],
      desc: 'Finansinspektionen regulations governing Alternative Investment Fund Managers (AIFMs), depositary liability, liquidity management tools (LMTs), and illiquid valuation functions.',
      milestones: [
        { name: 'Annex IV Supervisory Filing Q3', date: dOff(10) },
        { name: 'Depositary Cash Monitoring Audit', date: dOff(32) },
      ],
      last: 90,
    },
    {
      id: 'p5',
      key: 'SFS528',
      name: 'SFS 2007:528 · Värdepappersmarknaden',
      icon: 'landmark',
      color: 'violet',
      status: 'planning',
      team: 'compliance',
      lead: 'm3',
      due: dOff(60),
      start: dOff(-15),
      fav: false,
      members: ['m1', 'm2', 'm3', 'm6', 'm7'],
      desc: 'Swedish Securities Market Act governing investment firms, algorithmic trading systems, best execution, client classification, and market conduct.',
      milestones: [{ name: 'Annual Best Execution Compliance Publication', date: dOff(25) }],
      last: 180,
    },
    {
      id: 'p6',
      key: 'SFS561',
      name: 'SFS 2013:561 · Alternativa fonder',
      icon: 'leaf',
      color: 'green',
      status: 'active',
      team: 'legal',
      lead: 'm6',
      due: dOff(75),
      start: dOff(-50),
      fav: false,
      members: ['m1', 'm6', 'm7'],
      desc: 'Swedish Alternative Investment Fund Managers Act. Depositary oversight, liquidity management, valuation rules, and supervisory reporting.',
      milestones: [{ name: 'AIFM Supervisory Reporting Validation', date: dOff(60) }],
      last: 240,
    },
  ];

  let n = 0;
  const T = [];
  const t = (p, title, status, a, prio, due, labels = [], x = {}) => {
    const proj = projects.find(q => q.id === p);
    const count = T.filter(q => q.project === p).length + 1;
    T.push(
      Object.assign(
        {
          id: 't' + ++n,
          key: x.key || proj.key + '-' + (100 + count * 5),
          project: p,
          title,
          status,
          assignee: a,
          priority: prio,
          due: due == null ? null : dOff(due),
          start: due == null ? null : dOff(due - (x.len || 5)),
          labels,
          subtasks: [],
          attachments: [],
          deps: [],
          desc: '',
          estimate: x.est || null,
          created: minsAgo(60 * 24 * (x.age || 14)),
          updated: minsAgo(60 * (x.upd || 25)),
          order: n,
          fav: false,
          recur: null,
          diff: null,
        },
        x,
      ),
    );
  };

  /* ---- Swedish Statutory Tasks & Regulatory Diffs ---- */
  t('p1', 'SFS 2007:528 § 14 kap. 1 § · Algorithmic Trading Surveillance & Controls', 'review', 'm6', 'urgent', 2, ['fi', 'funds', 'risk'], {
    key: 'SFS 14:1',
    fav: true,
    est: '2 weeks',
    len: 7,
    age: 18,
    upd: 3,
    desc: '<p><b>Swedish Securities Market Act (SFS 2007:528) 14 kap. 1 §</b> establishes statutory requirements for market participants engaging in automated and algorithmic execution on regulated trading venues.</p><p>Requires effective pre-trade risk controls, real-time error filters, continuous human oversight, and complete algorithmic decision reconstruction during Finansinspektionen audits.</p>',
    diff: {
      identifier: '14 kap. 1 §',
      regulation: 'SFS 2007:528 (Lag om värdepappersmarknaden)',
      amendingAct: 'SFS 2024:114',
      heading: 'Krav på den som deltar i handeln på en reglerad marknad',
      status: 'MODIFIED',
      additions_count: 15,
      deletions_count: 0,
      tokens: [
        {
          type: 'equal',
          text: 'En börs skall ha regler för vilka som får delta i handeln på en reglerad marknad.',
        },
        {
          type: 'insert',
          text: ' En deltagare som tillämpar algoritmisk handel ska ha effektiva system och riskkontroller.',
        },
      ],
      authority: 'Finansinspektionen & Riksdagen',
      inForce: '2024-07-01',
      plainEnglish: {
        summary:
          'Market participants utilizing algorithmic trading systems must maintain effective pre-trade risk controls, continuous oversight, and comprehensive audit trails for Finansinspektionen.',
        points: [
          'Pre-trade error filters: Automated controls must prevent erroneous order submission and price disruption.',
          'Surveillance & kill switch: Real-time monitoring with the ability to pause or halt runaway algorithmic execution.',
          'Audit reconstruction: Five-year parameter retention so regulators can reconstruct order flow in hindsight.',
        ],
        whyItMatters: 'Mandatory statutory requirement under SFS 2007:528. Violations risk supervisory sanctions and trading suspension.',
        beforeAfter: {
          before: 'General participant rules without granular automated pre-trade error filtering thresholds.',
          after: 'Mandatory pre-trade filters, automated risk limits, and verifiable kill switches for algorithmic market participants.',
        },
        translation:
          '1 § A regulated market shall establish rules for those who may participate in trading on the market. A participant utilizing algorithmic trading shall maintain effective systems and risk controls.',
      },
    },
    subtasks: [
      { id: 's1', title: 'Draft algorithmic governance policy matching FI supervisory expectations', done: true },
      { id: 's2', title: 'Establish pre-trade kill switch architecture for high-frequency execution', done: true },
      { id: 's3', title: 'Implement automated audit reconstruction ledger for algorithmic trading decisions', done: false },
      { id: 's4', title: 'Submit 2nd LoD compliance opinion to the Risk Committee', done: false },
    ],
    attachments: [
      { id: 'a1', name: 'SFS_2007_528_Lag_om_vardepappersmarknaden.pdf', type: 'pdf', size: '420 KB', by: 'm6', at: minsAgo(180) },
      { id: 'a2', name: 'Algorithmic_Supervision_Policy_v1.2.docx', type: 'doc', size: '1.4 MB', by: 'm1', at: minsAgo(400) },
    ],
  });

  t('p1', 'SFS 2024:1284 § 6 kap. 2 a § · Resiliens och IT-drift i kreditinstitut', 'progress', 'm1', 'high', 5, ['fi', 'sfs297', 'funds'], {
    key: 'SFS 6:2a',
    est: '1 week',
    len: 5,
    age: 15,
    upd: 12,
    desc: '<p>Direct statutory amendment transposing digital operational resilience standards into Swedish banking law (SFS 2004:297 6 kap. 2 a §). Mandates that credit institution network and information systems meet digital operational resilience standards.</p>',
    diff: {
      identifier: '6 kap. 2 a §',
      regulation: 'SFS 2004:297 (Lag om bank- och finansieringsrörelse)',
      amendingAct: 'SFS 2024:1284',
      heading: 'Nätverks- och informationssystem',
      status: 'ADDED',
      additions_count: 22,
      deletions_count: 0,
      tokens: [
        {
          type: 'insert',
          text: '2 a § Ett kreditinstituts nätverks- och informationssystem ska uppfylla kraven i Europaparlamentets och rådets förordning (EU) 2022/2554 av den 14 december 2022 om digital operativ motståndskraft för finanssektorn (DORA).',
        },
      ],
      authority: 'Finansinspektionen & Riksdagen',
      inForce: '2025-01-17',
      plainEnglish: {
        summary: 'Formally incorporates digital operational resilience obligations directly into Swedish statutory banking law.',
        points: [
          'Direct statutory scope: Binds Swedish financial institutions directly to operational resilience and third-party risk rules.',
          'ICT provider register: Requires maintaining comprehensive registers of critical ICT third-party service providers.',
          'Operational testing: Mandates threat-led resilience testing and business continuity architectures.',
        ],
        whyItMatters: 'Mandatory statutory law under SFS 2024:1284. Non-compliance exposes institutions to Finansinspektionen administrative fines.',
        beforeAfter: {
          before: 'General IT guidelines without direct statutory penalties in Swedish banking law.',
          after: 'Statutory mandate under SFS 2004:297 6 kap. 2 a § enforcing digital operational resilience.',
        },
        translation:
          "2 a § A credit institution's network and information systems shall comply with statutory digital operational resilience standards under Lag (2024:1284).",
      },
    },
    subtasks: [
      { id: 's5', title: 'Cross-reference statutory definitions against internal ICT taxonomy', done: true },
      { id: 's6', title: 'Update internal compliance manual section 2.1', done: false },
    ],
  });

  t('p1', 'SFS 2016:892 § 2 kap. 17 c § · Risk Management & Remuneration Policy Governance', 'done', 'm6', 'medium', -4, ['fi', 'legal'], {
    key: 'SFS 2:17c',
    est: '3 days',
    age: 24,
    desc: '<p>Statutory requirement under SFS 2004:46 2 kap. 17 c § mandating that fund management companies establish remuneration and risk systems promoting sound risk management.</p>',
    diff: {
      identifier: '2 kap. 17 c §',
      regulation: 'SFS 2004:46 (Lag om värdepappersfonder)',
      amendingAct: 'SFS 2016:892',
      heading: 'Krav på organisation av verksamheten',
      status: 'MODIFIED',
      additions_count: 14,
      deletions_count: 0,
      tokens: [
        {
          type: 'insert',
          text: '17 c § Ett fondbolag ska ha ett ersättningssystem som främjar en sund och effektiv riskhantering. Inom ramen för ersättningssystemet ska fondbolaget upprätta och tillämpa en ersättningspolicy.',
        },
      ],
      authority: 'Riksdagen & Finansinspektionen',
      inForce: '2016-11-01',
      plainEnglish: {
        summary: 'Fund management companies must operate remuneration systems and policies that promote sound and effective risk management.',
        points: [
          'Sound risk alignment: Compensation structures must not encourage excessive risk-taking.',
          'Board-approved policy: Management companies must formally maintain and apply a written remuneration policy.',
          'Supervisory compliance: Regular reporting and audit verification for Finansinspektionen.',
        ],
        whyItMatters: 'Mandatory statutory requirement under SFS 2004:46. Governs executive risk incentives and fund stability.',
        beforeAfter: {
          before: 'General organizational principles without explicit remuneration policy requirements.',
          after: 'Statutory mandate requiring formal remuneration policy promoting sound risk management.',
        },
        translation:
          '17 c § A fund management company shall maintain a remuneration system that promotes sound and effective risk management. Within the framework of the remuneration system, the fund company shall establish and apply a remuneration policy.',
      },
    },
  });

  t('p1', 'ESMA34-45-1823 · UCITS Liquidity Stress Testing (LST) Calibration', 'todo', 'm4', 'high', 8, ['funds', 'risk'], {
    key: 'ESMA §34',
    est: '1 week',
    len: 6,
    subtasks: [
      { id: 's7', title: 'Calibrate reverse stress scenarios for illiquid fixed-income buckets', done: true },
      { id: 's8', title: 'Incorporate redemptions shock scenario (top 5 institutional unit-holders)', done: false },
    ],
  });

  t('p1', 'Annual Prospectus & Key Information Document (KID) Regulatory Sweep', 'progress', 'm7', 'medium', 12, ['funds'], {
    key: 'PRIIP §7',
    est: '2 weeks',
    len: 8,
  });

  t('p1', 'Finansinspektionen FFFS 2020:20 · Remiss on Liquidity Management Tools (LMT)', 'backlog', 'm2', 'low', 30, ['fi', 'funds'], {
    key: 'FI-REMISS',
    est: '3 weeks',
  });

  /* ---- SFS 2004:297 Bank- och finansieringsrörelse ---- */
  t('p2', 'SFS 2004:297 6 kap. 2 a § · ICT Risk Management Framework Gap Analysis & Policy Overhaul', 'review', 'm4', 'urgent', 1, ['sfs297', 'risk'], {
    key: 'SFS297 §2a',
    fav: true,
    est: '4 weeks',
    len: 12,
    age: 30,
    upd: 5,
    desc: '<p>Comprehensive audit of the internal ICT risk management framework against SFS 2004:297 6 kap. 2 a § and Finansinspektionen guidelines.</p><p>Mandates formal business impact analyses (BIA), RTO/RPO metrics for critical trading and transfer agency services, and dual-center backup validation.</p>',
    subtasks: [
      { id: 's10', title: 'Audit current RTO/RPO targets for fund pricing and order routing engines', done: true },
      { id: 's11', title: 'Review ICT risk tolerance levels with Chief Risk Officer', done: true },
      { id: 's12', title: 'Complete board-approved ICT security policy documentation', done: false },
    ],
    attachments: [
      { id: 'a3', name: 'SFS_2004_297_6kap_Resilience_Framework.pdf', type: 'pdf', size: '1.8 MB', by: 'm4', at: minsAgo(1200) },
      { id: 'a4', name: 'Resilience_Gap_Analysis_2026.xlsx', type: 'sheet', size: '480 KB', by: 'm1', at: minsAgo(3400) },
    ],
  });

  t(
    'p2',
    'SFS 2004:297 6 kap. 4 § · Register of Information for Critical Third-Party ICT Providers',
    'progress',
    'm8',
    'urgent',
    4,
    ['sfs297', 'it_security'],
    {
      key: 'SFS297 §4',
      est: '3 weeks',
      len: 9,
      age: 20,
      subtasks: [
        { id: 's13', title: 'Map all cloud, market data, and core banking vendors to supervisory schema', done: true },
        { id: 's14', title: 'Assess supply chain concentration risk (Azure / AWS / Bloomberg)', done: true },
        { id: 's15', title: 'Execute mandatory audit right addendums with sub-processors', done: false },
        { id: 's16', title: 'Validate register JSON against Finansinspektionen submission portal schema', done: false },
      ],
    },
  );

  t('p2', 'SFS 2004:297 6 kap. 2 § · Major ICT-related Incident Reporting Procedure & Runbook', 'todo', 'm8', 'high', 9, ['sfs297', 'it_security'], {
    key: 'SFS297 §2',
    est: '2 weeks',
    len: 6,
    subtasks: [
      { id: 's17', title: 'Define 4-hour initial notification trigger threshold for Finansinspektionen', done: true },
      { id: 's18', title: 'Build automated incident classification calculator based on financial & user impact', done: false },
      { id: 's19', title: 'Dry-run tabletop simulation with crisis management team', done: false },
    ],
  });

  t('p2', 'TIBER-SE · Threat-Led Penetration Testing (TLPT) Scope Validation', 'todo', 'm4', 'medium', 19, ['sfs297', 'risk'], {
    key: 'TIBER §1',
    est: '2 weeks',
    len: 5,
  });

  t('p2', 'Board of Directors ICT Governance & Cybersecurity Training Curriculum', 'done', 'm3', 'medium', -7, ['sfs297', 'compliance'], {
    key: 'SFS297 §1',
    est: '1 week',
  });

  /* ---- AML & SFS 2017:630 ---- */
  t('p3', 'FFFS 2017:11 Kap 4 · General Risk Assessment (Allmän riskbedömning 2026)', 'progress', 'm5', 'urgent', 3, ['aml', 'fi', 'compliance'], {
    key: 'AML §4',
    fav: true,
    est: '3 weeks',
    len: 8,
    age: 22,
    upd: 2,
    desc: '<p>Annual statutory update of the firm-wide AML/CFT General Risk Assessment required by Finansinspektionen.</p><p>Assesses money laundering vulnerabilities across private banking, institutional mandates, distribution partners, and cross-border subscriptions from non-EEA jurisdictions.</p>',
    subtasks: [
      { id: 's20', title: 'Update geographic risk scores including high-risk third countries list', done: true },
      { id: 's21', title: 'Review transaction volume thresholds for enhanced due diligence (EDD)', done: true },
      { id: 's22', title: 'Compile MLRO annual report for Executive Management and Board', done: false },
    ],
    attachments: [{ id: 'a5', name: 'AML_General_Risk_Assessment_Draft_2026.docx', type: 'doc', size: '2.1 MB', by: 'm5', at: minsAgo(600) }],
  });

  t('p3', 'SFS 2017:630 3 kap. 1 § · Customer Due Diligence (KYC) Architecture Audit', 'todo', 'm5', 'high', 15, ['aml', 'legal'], {
    key: 'AML §1',
    est: '4 weeks',
    len: 10,
    subtasks: [
      { id: 's23', title: 'Gap analysis of current CDD measures against statutory requirements', done: false },
      { id: 's24', title: 'Evaluate enhanced customer due diligence (EDD) escalation thresholds', done: false },
    ],
  });

  t('p3', 'Real-time Sanctions Screening & Asset Freeze Automation (UN, OFAC)', 'review', 'm1', 'urgent', 0, ['aml', 'risk'], {
    key: 'AML §3',
    est: '1 week',
    len: 4,
    subtasks: [
      { id: 's25', title: 'Fuzzy-name matching benchmark on Nordic and Cyrillic transliterations', done: true },
      { id: 's26', title: 'Establish 15-minute SLA for PEP & Sanctions alert escalation', done: true },
    ],
  });

  t('p3', 'Independent 3rd-Party Internal Audit of Swedish AML Controls', 'done', 'm3', 'high', -14, ['aml', 'fi'], {
    key: 'AML-AUDIT',
    est: '2 weeks',
  });

  /* ---- AIFM FFFS 2013:9 ---- */
  t('p4', 'FFFS 2013:9 Kap 13 · Independent Valuation Governance for Private Equity Assets', 'progress', 'm7', 'high', 7, ['funds', 'risk'], {
    key: 'AIFM §13',
    est: '2 weeks',
    len: 7,
    subtasks: [
      { id: 's27', title: 'Review external valuation agent independence and conflict-of-interest disclosures', done: true },
      { id: 's28', title: 'Formalize quarterly discount-rate stress methodology for illiquid debt', done: false },
    ],
  });

  t('p4', 'Prop. 2023/24:122 · Review of Administrative Fines & Sanctions Escalation for AIFMs', 'todo', 'm6', 'medium', 16, ['legal', 'fi'], {
    key: 'PROP §122',
    est: '1 week',
    len: 4,
  });

  t('p4', 'Annex IV Supervisory Filing Q3 Automated XML Validation', 'done', 'm7', 'urgent', -2, ['funds'], {
    key: 'ANNEX-IV',
    est: '3 days',
  });

  /* ---- SFS 2007:528 & SFS 2013:561 ---- */
  t('p5', 'SFS 2007:528 8 kap. 1 § · Best Execution Surveillance & Annual Reporting', 'todo', 'm3', 'high', 21, ['sfs528', 'funds'], {
    key: 'SFS528 §8:1',
    est: '2 weeks',
    len: 8,
  });

  t('p5', 'SFS 2007:528 8 kap. 21 § · Product Governance Target Market Verification', 'backlog', 'm2', 'medium', 35, ['sfs528', 'compliance'], {
    key: 'SFS528 §8:21',
    est: '3 weeks',
  });

  t('p6', 'SFS 2013:561 8 kap. 1 § · Liquidity Risk Management & Stress Testing Framework', 'progress', 'm6', 'high', 11, ['funds', 'risk'], {
    key: 'SFS561 §8:1',
    est: '4 weeks',
    len: 10,
    subtasks: [
      { id: 's30', title: 'Calibrate liquidity profiles across alternative investment funds', done: true },
      { id: 's31', title: 'Review redemption gate thresholds with fund board', done: false },
      { id: 's32', title: 'Prepare annual liquidity risk assessment report', done: false },
    ],
    attachments: [{ id: 'a6', name: 'SFS_2013_561_Liquidity_Risk_Framework.pdf', type: 'pdf', size: '920 KB', by: 'm6', at: minsAgo(2200) }],
  });

  t('p6', 'SFS 2013:561 10 kap. 2 § · Supervisory Reporting & Valuation Verification', 'todo', 'm7', 'medium', 25, ['funds', 'legal'], {
    key: 'SFS561 §10:2',
    est: '2 weeks',
  });

  const tk = id => T.find(x => x.id === id);
  T.filter(x => x.status === 'done').forEach((x, i) => (x.completedAt = minsAgo(60 * (8 + i * 22))));

  const comments = [
    {
      id: 'c1',
      task: 't1',
      by: 'm6',
      at: minsAgo(85),
      text: 'Riksdagen updated SFS 2007:528 on market participant controls. @Workspace Owner please ensure our algorithmic risk framework addresses the requirement to reconstruct execution steps on demand.',
      re: { '👍': ['m1', 'm3'] },
    },
    {
      id: 'c2',
      task: 't1',
      by: 'm1',
      at: minsAgo(40),
      text: 'Verified. The Python parser and diff engine in the Nordic RegTech core already capture token-level changes for 14 kap. 1 §. Working with engineering to log audit decision states to PostgreSQL with pgvector.',
      re: { '🚀': ['m6', 'm2'] },
    },
    {
      id: 'c3',
      task: 't7',
      by: 'm4',
      at: minsAgo(190),
      text: 'CTPP vendor questionnaires sent to Microsoft and Bloomberg. We need legal sign-off on the standard EU contractual clauses for exit strategies before Friday.',
      re: { '👀': ['m6'] },
    },
    {
      id: 'c4',
      task: 't11',
      by: 'm5',
      at: minsAgo(240),
      text: 'The updated General Risk Assessment draft has been shared with the compliance officer. Customer risk rating models reflect the new high-risk jurisdictions.',
      re: { '👍': ['m3'] },
    },
  ];

  const A = (by, verb, task, project, m, extra = '') => ({ id: uid('a'), by, verb, task, project, at: minsAgo(m), extra });
  const activity = [
    A('m6', 'moved', 't1', 'p1', 35, 'to In review'),
    A('m1', 'commented on', 't1', 'p1', 40),
    A('m4', 'updated', 't6', 'p2', 65, 'RTS Gap Analysis completed'),
    A('m5', 'moved', 't11', 'p3', 120, 'to In progress'),
    A('m3', 'completed', 't10', 'p2', 210),
    A('m8', 'added attachment to', 't7', 'p2', 320),
    A('m2', 'created task', 't18', 'p5', 540),
    A('m7', 'completed', 't16', 'p4', 1200),
    A('m6', 'created project', null, 'p1', 45000),
    A('m4', 'created project', null, 'p2', 42000),
  ];

  const notifs = [
    {
      id: 'n1',
      type: 'mention',
      by: 'm6',
      task: 't1',
      text: 'mentioned you in',
      snippet:
        'Riksdagen updated SFS 2007:528 on market participant controls. @Workspace Owner please ensure our algorithmic risk framework addresses the requirement…',
      at: minsAgo(85),
      read: false,
    },
    {
      id: 'n2',
      type: 'update',
      by: null,
      project: 'p2',
      text: 'SFS 2004:297 Compliance Package requires attention',
      snippet: '3 critical ICT third-party provider assessments due in 5 days',
      at: minsAgo(140),
      read: false,
    },
    {
      id: 'n3',
      type: 'assign',
      by: 'm3',
      task: 't2',
      text: 'assigned you',
      snippet: 'SFS 2004:297 6 kap. 2 a § · Resiliens och IT-drift i kreditinstitut',
      at: minsAgo(260),
      read: false,
    },
    {
      id: 'n4',
      type: 'comment',
      by: 'm4',
      task: 't7',
      text: 'commented on',
      snippet: 'CTPP vendor questionnaires sent to Microsoft and Bloomberg.',
      at: minsAgo(190),
      read: true,
    },
    {
      id: 'n5',
      type: 'update',
      by: 'm6',
      task: 't1',
      text: 'moved to In review',
      snippet: 'In progress → In review',
      at: minsAgo(35),
      read: true,
    },
    {
      id: 'n6',
      type: 'update',
      by: null,
      task: 't13',
      text: 'is due today',
      snippet: 'Real-time Sanctions Screening & Asset Freeze Automation (UN, OFAC)',
      at: minsAgo(15),
      read: false,
    },
  ];

  const files = [
    { id: 'f1', project: 'p1', name: 'SFS_2007_528_Lag_om_vardepappersmarknaden.pdf', type: 'pdf', size: '420 KB', by: 'm6', at: minsAgo(180), task: 't1' },
    { id: 'f2', project: 'p1', name: 'Algorithmic_Supervision_Policy_v1.2.docx', type: 'doc', size: '1.4 MB', by: 'm1', at: minsAgo(400), task: 't1' },
    { id: 'f3', project: 'p2', name: 'SFS_2004_297_Lag_om_bank_och_finansieringsrorelse.pdf', type: 'pdf', size: '3.4 MB', by: 'm4', at: minsAgo(5000) },
    { id: 'f4', project: 'p2', name: 'SFS_2004_297_6kap_Resilience_Framework.pdf', type: 'pdf', size: '1.8 MB', by: 'm4', at: minsAgo(1200), task: 't6' },
    { id: 'f5', project: 'p2', name: 'Resilience_Gap_Analysis_2026.xlsx', type: 'sheet', size: '480 KB', by: 'm1', at: minsAgo(3400), task: 't6' },
    { id: 'f6', project: 'p3', name: 'Finansinspektionen_FFFS_2017_11_Penningtvatt.pdf', type: 'pdf', size: '890 KB', by: 'm5', at: minsAgo(8000) },
    { id: 'f7', project: 'p3', name: 'AML_General_Risk_Assessment_Draft_2026.docx', type: 'doc', size: '2.1 MB', by: 'm5', at: minsAgo(600), task: 't11' },
    { id: 'f8', project: 'p4', name: 'FFFS_2013_9_AIFM_Consolidated.pdf', type: 'pdf', size: '1.6 MB', by: 'm7', at: minsAgo(9500) },
    { id: 'f9', project: 'p6', name: 'SFS_2013_561_AIFM_Supervisory_Report.pdf', type: 'pdf', size: '920 KB', by: 'm6', at: minsAgo(2200), task: 't19' },
  ];

  const events = [
    { id: 'e1', title: 'Finansinspektionen Supervisory Dialogue · SFS 2007:528 & SFS 2004:297', date: dOff(2), time: '10:00', project: 'p1' },
    { id: 'e2', title: 'ICT Resilience Steering Committee & Outsourcing Freeze', date: dOff(5), time: '13:30', project: 'p2' },
    { id: 'e3', title: 'Executive Board Compliance & GRA Attestation', date: dOff(8), time: '15:00', project: 'p3' },
    { id: 'e4', title: 'AIFM Annex IV Supervisory Filing Deadline', date: dOff(10), time: '17:00', project: 'p4' },
    { id: 'e5', title: 'Quarterly Best Execution Review Committee', date: dOff(25), time: '11:00', project: 'p5' },
  ];

  const tmp = tk('t1');
  if (tmp) tmp.updated = minsAgo(35);

  return {
    ws: { name: 'Nordic Sovereign Bank (Mock)', url: 'nordic-sovereign', c: '#0F52BA', brand: true },
    workspaces: [
      { id: 'w1', name: 'Nordic Sovereign Bank (Mock)', c: '#0F52BA', plan: 'Enterprise', brand: true },
      { id: 'w2', name: 'Polaris Wealth Management (Mock)', c: '#23918A', plan: 'Dedicated' },
      { id: 'w3', name: 'Aura Asset Management (Mock)', c: '#5A67D8', plan: 'Dedicated' },
    ],
    me: 'm1',
    members,
    projects,
    tasks: T,
    policies: POLICIES.map(p => ({ ...p })),
    controls: CONTROLS.map(c => ({ ...c })),
    risks: RISKS.map(r => ({ ...r })),
    feed: FEED_ITEMS.map(f => ({ ...f })),
    comments,
    activity,
    notifs,
    files,
    events,
    projOrder: projects.map(p => p.id),
    savedViews: [{ id: 'v1', project: 'p1', name: 'High Priority', type: 'list', filters: [{ f: 'priority', op: 'is', v: ['urgent', 'high'] }] }],
    recentSearches: ['14 kap. 1 §', 'SFS 2004:297', 'Penningtvätt', 'SFS 2007:528'],
    sessions: [
      { id: 'se1', dev: 'MacBook Pro · Chrome (Helsinki)', loc: 'Helsinki, FI', at: 'Active now', cur: true },
      { id: 'se2', dev: 'Workstation · Linux', loc: 'Helsinki, FI', at: '15 minutes ago' },
    ],
    invoices: [
      { id: 'INV-REG-2026-001', date: dOff(-15), amt: '€12,500.00', st: 'Paid' },
      { id: 'INV-REG-2026-002', date: dOff(-45), amt: '€12,500.00', st: 'Paid' },
    ],
    tfa: true,
    notifPrefs: {
      email_mention: true,
      email_assign: true,
      email_digest: true,
      email_comment: false,
      push_mention: true,
      push_assign: true,
      push_comment: true,
      push_due: true,
      mention_all: true,
      assign_self: true,
    },
  };
}
