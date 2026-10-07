/* ---------- seed data: Digia RegTech & Nordic Financial Compliance ---------- */
import { dOff, minsAgo, uid } from '../core/utils.js';

export function seed() {
  const members = [
    {
      id: 'm1',
      name: 'Workspace Owner',
      email: 'valtteri@digia.com',
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
      name: 'Petter',
      email: 'petter@digia.com',
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
      email: 'ann-sofie.lindqvist@evli.com',
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
      email: 'henrik.borgstrom@unitedbankers.fi',
      role: 'Member',
      team: 'risk',
      title: 'Head of Operational Risk & DORA Lead',
      c: '#C48A1E',
      status: 'active',
      last: 28,
      tz: 'Stockholm',
    },
    {
      id: 'm5',
      name: 'AML Officer',
      email: 'matti.korhonen@digia.com',
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
      email: 'sofia.nygard@digia.com',
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
      email: 'johan.eklund@evli.com',
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
      email: 'tuomas.lehtonen@digia.com',
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
      desc: 'Swedish statutory framework for UCITS funds and fund management companies. Tracking legislative amendments via Riksdagen SFS 2026:916 and Finansinspektionen FFFS circulars.',
      milestones: [
        { name: 'SFS 2026:916 In-force Date', date: dOff(14) },
        { name: 'FI Quarterly Fund Return Filing', date: dOff(45) },
      ],
      last: 8,
    },
    {
      id: 'p2',
      key: 'DORA',
      name: 'Regulation (EU) 2022/2554 · DORA',
      icon: 'shield-check',
      color: 'blue',
      status: 'risk',
      team: 'it_security',
      lead: 'm4',
      due: dOff(35),
      start: dOff(-90),
      fav: true,
      members: ['m1', 'm3', 'm4', 'm6', 'm8'],
      desc: 'Digital Operational Resilience Act compliance program across Nordic entities. Covers ICT risk frameworks, major incident reporting, register of information for critical ICT third parties, and TIBER-SE digital resilience testing.',
      milestones: [
        { name: 'ICT Third-Party Register Freeze', date: dOff(5) },
        { name: 'Board Resilience Attestation', date: dOff(20) },
        { name: 'Supervisory Dry Run with FI/Fiva', date: dOff(48) },
      ],
      last: 15,
    },
    {
      id: 'p3',
      key: 'AML',
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
      desc: 'Swedish Act on Measures against Money Laundering and Terrorist Financing, aligned with FFFS 2017:11 and the new EU AMLR 2024/1624 package. KYC/CDD, transaction surveillance, and PEP screening.',
      milestones: [
        { name: 'Annual General Risk Assessment (GRA)', date: dOff(8) },
        { name: 'Sanctions Screening Architecture Audit', date: dOff(28) },
      ],
      last: 42,
    },
    {
      id: 'p4',
      key: 'AIFM',
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
      key: 'MIFID',
      name: 'Sijoituspalvelulaki 747/2012 · MiFID II',
      icon: 'landmark',
      color: 'violet',
      status: 'planning',
      team: 'compliance',
      lead: 'm3',
      due: dOff(60),
      start: dOff(-15),
      fav: false,
      members: ['m1', 'm2', 'm3', 'm6', 'm7'],
      desc: 'Nordic securities markets and investment services conduct. Best execution, client classification, suitability assessments, and annual RTS 28 disclosure packages.',
      milestones: [{ name: 'Annual Best Execution RTS 28 Publication', date: dOff(25) }],
      last: 180,
    },
    {
      id: 'p6',
      key: 'ESG',
      name: 'SFDR 2019/2088 & Green Taxonomy',
      icon: 'leaf',
      color: 'green',
      status: 'active',
      team: 'legal',
      lead: 'm6',
      due: dOff(75),
      start: dOff(-50),
      fav: false,
      members: ['m1', 'm6', 'm7'],
      desc: 'Sustainable Finance Disclosure Regulation and EU Taxonomy Regulation (2020/852). Pre-contractual information, website disclosures, and entity-level Principal Adverse Impacts (PAI) reporting.',
      milestones: [{ name: 'Entity-level PAI Statement Validation', date: dOff(60) }],
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

  /* ---- SFS 2004:46 Tasks & Statutory Diffs ---- */
  t('p1', 'SFS 2026:916 § 1 kap. 100 § · AI & Algorithmic Trading Supervision', 'review', 'm6', 'urgent', 2, ['fi', 'funds', 'risk'], {
    key: 'SFS 1:100',
    fav: true,
    est: 'Tier 1 Sanction',
    len: 7,
    age: 18,
    upd: 3,
    desc: '<p><b>Riksdagen legislative amendment SFS 2026:916</b> introduces a statutory requirement for Swedish fund management companies utilizing artificial intelligence or automated execution algorithms.</p><p>Requires real-time risk profile surveillance, continuous human-in-the-loop controls, and complete algorithmic decision reconstruction during Finansinspektionen audits.</p>',
    diff: {
      identifier: '1 kap. 100 §',
      regulation: 'SFS 2004:46 (Lag om värdepappersfonder)',
      amendingAct: 'SFS 2026:916',
      heading: 'Tillsyn över artificiell intelligens och algoritmer',
      status: 'ADDED',
      additions_count: 30,
      deletions_count: 0,
      tokens: [
        {
          type: 'insert',
          text: '100 § Ett fondbolag som använder artificiell intelligens eller helautomatiserade handelsalgoritmer vid förvaltningen av en värdepappersfond ska säkerställa att systemen är underkastade kontinuerlig mänsklig tillsyn, att fondens riskprofil övervakas i realtid, samt att samtliga förvaltnings- och allokeringsbeslut kan rekonstrueras i efterhand på begäran av Finansinspektionen.',
        },
      ],
      authority: 'Finansinspektionen & Riksdagen',
      inForce: '2026-11-01',
    },
    subtasks: [
      { id: 's1', title: 'Draft algorithmic governance policy matching FI supervisory expectations', done: true },
      { id: 's2', title: 'Establish pre-trade kill switch architecture for high-frequency execution', done: true },
      { id: 's3', title: 'Implement automated audit reconstruction ledger for AI trading decisions', done: false },
      { id: 's4', title: 'Submit 2nd LoD compliance opinion to the Risk Committee', done: false },
    ],
    attachments: [
      { id: 'a1', name: 'SFS_2026_916_Amending_Act_Riksdagen.pdf', type: 'pdf', size: '420 KB', by: 'm6', at: minsAgo(180) },
      { id: 'a2', name: 'Algorithmic_Supervision_Policy_v1.2.docx', type: 'doc', size: '1.4 MB', by: 'm1', at: minsAgo(400) },
    ],
  });

  t('p1', 'SFS 2026:916 § 1 kap. 1 § · DORA Scope Harmonization in Swedish Fund Law', 'progress', 'm1', 'high', 5, ['fi', 'dora', 'funds'], {
    key: 'SFS 1:1',
    est: 'Scope Alignment',
    len: 5,
    age: 15,
    upd: 12,
    desc: '<p>Direct statutory amendment explicitly harmonizing definitions in 1 kap. 1 § with Regulation (EU) 2022/2554 (DORA). Mandates that operational risk rules apply to all authorized UCITS management entities under DORA standards.</p>',
    diff: {
      identifier: '1 kap. 1 §',
      regulation: 'SFS 2004:46 (Lag om värdepappersfonder)',
      amendingAct: 'SFS 2026:916',
      heading: 'Definitioner (DORA-anpassning)',
      status: 'MODIFIED',
      additions_count: 4,
      deletions_count: 0,
      tokens: [
        { type: 'equal', text: 'I denna lag betyder' },
        { type: 'insert', text: ' (med beaktande av DORA-kraven)' },
        {
          type: 'equal',
          text: '\n\n1. alternativ investeringsfond: detsamma som i 1 kap. 2 § lagen (2013:561) om förvaltare av alternativa investeringsfonder,\n\n2. behörig myndighet: utländsk myndighet som har behörighet att utöva tillsyn över fondföretag eller förvaltningsbolag,\n\n3. derivatinstrument: optioner, terminer och swappar samt andra likartade finansiella instrument,\n\n4. EES: Europeiska ekonomiska samarbetsområdet,\n\n5. egna medel: detsamma som i artikel 2.1 l i Europaparlamentets och rådets direktiv 2009/65/EG…',
        },
      ],
      authority: 'Finansdepartementet / Finansinspektionen',
      inForce: '2026-11-01',
    },
    subtasks: [
      { id: 's5', title: 'Cross-reference statutory definitions against internal fund taxonomy', done: true },
      { id: 's6', title: 'Update internal compliance manual section 2.1', done: false },
    ],
  });

  t('p1', 'SFS 2026:916 § 1 kap. 99 § · Repeal of Grandfathering Clauses for Older UCITS', 'done', 'm6', 'medium', -4, ['fi', 'legal'], {
    key: 'SFS 1:99',
    est: 'Repealed Rule',
    age: 24,
    desc: '<p>Statutory deletion of transitional provisions from 2012. All funds must now operate strictly under uniform supervisory standards without historic legacy carve-outs.</p>',
    diff: {
      identifier: '1 kap. 99 §',
      regulation: 'SFS 2004:46 (Lag om värdepappersfonder)',
      amendingAct: 'SFS 2026:916',
      heading: 'Övergångsbestämmelser för äldre fondbolag',
      status: 'DELETED',
      additions_count: 0,
      deletions_count: 8,
      tokens: [
        {
          type: 'delete',
          text: '99 § Bestämmelserna i detta kapitel ska inte tillämpas på fondbolag som erhållit auktorisation före den 1 januari 2012 vad avser äldre förvaltningsrutiner.',
        },
      ],
      authority: 'Riksdagen',
      inForce: '2026-11-01',
    },
  });

  t('p1', 'ESMA34-45-1823 · UCITS Liquidity Stress Testing (LST) Calibration', 'todo', 'm4', 'high', 8, ['funds', 'risk'], {
    key: 'ESMA §34',
    est: 'Stress Scenario',
    len: 6,
    subtasks: [
      { id: 's7', title: 'Calibrate reverse stress scenarios for illiquid fixed-income buckets', done: true },
      { id: 's8', title: 'Incorporate redemptions shock scenario (top 5 institutional unit-holders)', done: false },
    ],
  });

  t('p1', 'Annual Prospectus & Key Information Document (KID) Regulatory Sweep', 'progress', 'm7', 'medium', 12, ['funds'], {
    key: 'PRIIP §7',
    est: 'Periodic Sweep',
    len: 8,
  });

  t('p1', 'Finansinspektionen FFFS 2020:20 · Remiss on Liquidity Management Tools (LMT)', 'backlog', 'm2', 'low', 30, ['fi', 'funds'], {
    key: 'FI-REMISS',
    est: 'Consultation',
  });

  /* ---- DORA Regulation (EU) 2022/2554 ---- */
  t('p2', 'DORA Art. 5-16 · ICT Risk Management Framework Gap Analysis & Policy Overhaul', 'review', 'm4', 'urgent', 1, ['dora', 'risk'], {
    key: 'DORA §5',
    fav: true,
    est: 'Tier 1 Framework',
    len: 12,
    age: 30,
    upd: 5,
    desc: '<p>Comprehensive audit of the internal ICT risk management framework against the Regulatory Technical Standards (RTS) under Articles 5-16 of DORA.</p><p>Mandates formal business impact analyses (BIA), RTO/RPO metrics for critical trading and transfer agency services, and dual-center backup validation.</p>',
    subtasks: [
      { id: 's10', title: 'Audit current RTO/RPO targets for fund pricing and order routing engines', done: true },
      { id: 's11', title: 'Review ICT risk tolerance levels with Chief Risk Officer', done: true },
      { id: 's12', title: 'Complete board-approved ICT security policy documentation', done: false },
    ],
    attachments: [
      { id: 'a3', name: 'DORA_RTS_ICT_Risk_Management_Framework.pdf', type: 'pdf', size: '1.8 MB', by: 'm4', at: minsAgo(1200) },
      { id: 'a4', name: 'Digia_Resilience_Gap_Analysis_2026.xlsx', type: 'sheet', size: '480 KB', by: 'm1', at: minsAgo(3400) },
    ],
  });

  t('p2', 'DORA Art. 28 · Register of Information for Critical Third-Party ICT Providers (CTPPs)', 'progress', 'm8', 'urgent', 4, ['dora', 'it_security'], {
    key: 'DORA §28',
    est: 'Mandatory Register',
    len: 9,
    age: 20,
    subtasks: [
      { id: 's13', title: 'Map all cloud, market data, and core banking vendors to EBA standard schema', done: true },
      { id: 's14', title: 'Assess supply chain concentration risk (Azure / AWS / Bloomberg)', done: true },
      { id: 's15', title: 'Execute mandatory audit right addendums with sub-processors', done: false },
      { id: 's16', title: 'Validate register JSON against FI / ESMA submission portal schema', done: false },
    ],
  });

  t('p2', 'DORA Art. 17-23 · Major ICT-related Incident Reporting Procedure & Runbook', 'todo', 'm8', 'high', 9, ['dora', 'it_security'], {
    key: 'DORA §17',
    est: '4h Incident SLA',
    len: 6,
    subtasks: [
      { id: 's17', title: 'Define 4-hour initial notification trigger threshold for Finansinspektionen / Fiva', done: true },
      { id: 's18', title: 'Build automated incident classification calculator based on financial & user impact', done: false },
      { id: 's19', title: 'Dry-run tabletop simulation with crisis management team', done: false },
    ],
  });

  t('p2', 'TIBER-SE / DORA Art. 26 · Threat-Led Penetration Testing (TLPT) Scope Validation', 'todo', 'm4', 'medium', 19, ['dora', 'risk'], {
    key: 'TIBER §26',
    est: 'Red Team Scope',
    len: 5,
  });

  t('p2', 'Board of Directors ICT Governance & Cybersecurity Training Curriculum', 'done', 'm3', 'medium', -7, ['dora', 'compliance'], {
    key: 'DORA §4',
    est: 'Board Attestation',
  });

  /* ---- AML & SFS 2017:630 ---- */
  t('p3', 'FFFS 2017:11 Kap 4 · General Risk Assessment (Allmän riskbedömning 2026)', 'progress', 'm5', 'urgent', 3, ['aml', 'fi', 'compliance'], {
    key: 'AML §4',
    fav: true,
    est: 'Annual GRA Audit',
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

  t('p3', 'AMLR (EU) 2024/1624 · Transition Roadmap for the Unified EU AML Rulebook & AMLA', 'todo', 'm5', 'high', 15, ['aml', 'legal'], {
    key: 'AMLR §1',
    est: 'AMLA Transition',
    len: 10,
    subtasks: [
      { id: 's23', title: 'Gap analysis of current CDD measures against new direct-acting EU regulation', done: false },
      { id: 's24', title: 'Evaluate AMLA direct supervision thresholds for cross-border wealth operations', done: false },
    ],
  });

  t('p3', 'Real-time Sanctions Screening & Asset Freeze Automation (EU, UN, OFAC)', 'review', 'm1', 'urgent', 0, ['aml', 'risk'], {
    key: 'AML §3',
    est: 'Zero Tolerance Freeze',
    len: 4,
    subtasks: [
      { id: 's25', title: 'Fuzzy-name matching benchmark on Nordic and Cyrillic transliterations', done: true },
      { id: 's26', title: 'Establish 15-minute SLA for PEP & Sanctions alert escalation', done: true },
    ],
  });

  t('p3', 'Independent 3rd-Party Internal Audit of Swedish AML Controls', 'done', 'm3', 'high', -14, ['aml', 'fi'], {
    key: 'AML-AUDIT',
    est: 'Audit Passed',
  });

  /* ---- AIFM FFFS 2013:9 ---- */
  t('p4', 'FFFS 2013:9 Kap 13 · Independent Valuation Governance for Private Equity Assets', 'progress', 'm7', 'high', 7, ['funds', 'risk'], {
    key: 'AIFM §13',
    est: 'Tier 2 Governance',
    len: 7,
    subtasks: [
      { id: 's27', title: 'Review external valuation agent independence and conflict-of-interest disclosures', done: true },
      { id: 's28', title: 'Formalize quarterly discount-rate stress methodology for illiquid debt', done: false },
    ],
  });

  t('p4', 'Prop. 2023/24:122 · Review of Administrative Fines & Sanctions Escalation for AIFMs', 'todo', 'm6', 'medium', 16, ['legal', 'fi'], {
    key: 'PROP §122',
    est: 'Sanction Escalation',
    len: 4,
  });

  t('p4', 'Annex IV Supervisory Filing Q3 Automated XML Validation', 'done', 'm7', 'urgent', -2, ['funds'], {
    key: 'ANNEX-IV',
    est: 'Regulatory XML',
  });

  /* ---- MiFID II & SFDR ---- */
  t('p5', 'MiFID II Delegated Reg 2017/565 · Best Execution Surveillance & Annual RTS 28 Publication', 'todo', 'm3', 'high', 21, ['mifid', 'funds'], {
    key: 'RTS §28',
    est: 'Best Execution',
    len: 8,
  });

  t('p5', 'Product Governance (POG) Target Market Verification for Complex Structured Notes', 'backlog', 'm2', 'medium', 35, ['mifid', 'compliance'], {
    key: 'POG §9',
    est: 'Investor Protection',
  });

  t('p6', 'SFDR RTS Art. 14 · Principal Adverse Impact (PAI) Statement for Article 8/9 Funds', 'progress', 'm6', 'high', 11, ['esg', 'legal'], {
    key: 'SFDR §14',
    est: 'PAI Disclosure',
    len: 10,
    subtasks: [
      { id: 's30', title: 'Collect scope 1, 2, and 3 GHG emissions data across underlying portfolio companies', done: true },
      { id: 's31', title: 'Review water emissions and hazardous waste metrics with ESG data vendor', done: false },
      { id: 's32', title: 'Prepare website disclosure summary in Swedish and English', done: false },
    ],
    attachments: [{ id: 'a6', name: 'SFDR_PAI_Consolidated_Statement_2026.pdf', type: 'pdf', size: '920 KB', by: 'm6', at: minsAgo(2200) }],
  });

  t('p6', 'EU Green Taxonomy Alignment Verification for Nordic Climate Infrastructure Fund', 'todo', 'm7', 'medium', 25, ['esg'], {
    key: 'TAXON §3',
    est: 'Green Verification',
  });

  const tk = id => T.find(x => x.id === id);
  T.filter(x => x.status === 'done').forEach((x, i) => (x.completedAt = minsAgo(60 * (8 + i * 22))));

  const comments = [
    {
      id: 'c1',
      task: 't1',
      by: 'm6',
      at: minsAgo(85),
      text: 'Riksdagen passed SFS 2026:916 with immediate effect on Section 100. @Workspace Owner please ensure our algorithmic risk framework addresses the requirement to reconstruct execution steps on demand.',
      re: { '👍': ['m1', 'm3'] },
    },
    {
      id: 'c2',
      task: 't1',
      by: 'm1',
      at: minsAgo(40),
      text: 'Verified. The Python parser and diff engine in the Nordic RegTech core already capture token-level changes for 1 kap. 100 §. Working with engineering to log audit decision states to PostgreSQL with pgvector.',
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
    A('m6', 'moved', 't1', 'p1', 35, 'to Legal & 2nd LoD Review'),
    A('m1', 'commented on', 't1', 'p1', 40),
    A('m4', 'updated', 't6', 'p2', 65, 'RTS Gap Analysis completed'),
    A('m5', 'moved', 't11', 'p3', 120, 'to Policy & Redline'),
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
        'Riksdagen passed SFS 2026:916 with immediate effect on Section 100. @Workspace Owner please ensure our algorithmic risk framework addresses the requirement…',
      at: minsAgo(85),
      read: false,
    },
    {
      id: 'n2',
      type: 'update',
      by: null,
      project: 'p2',
      text: 'DORA Compliance Package requires attention',
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
      snippet: 'SFS 2026:916 § 1 kap. 1 § · DORA Scope Harmonization in Swedish Fund Law',
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
      text: 'moved to Legal & 2nd LoD Review',
      snippet: 'Policy & Redline → Legal & 2nd LoD',
      at: minsAgo(35),
      read: true,
    },
    {
      id: 'n6',
      type: 'update',
      by: null,
      task: 't13',
      text: 'is due today',
      snippet: 'Real-time Sanctions Screening & Asset Freeze Automation (EU, UN, OFAC)',
      at: minsAgo(15),
      read: false,
    },
  ];

  const files = [
    { id: 'f1', project: 'p1', name: 'SFS_2026_916_Amending_Act_Riksdagen.pdf', type: 'pdf', size: '420 KB', by: 'm6', at: minsAgo(180), task: 't1' },
    { id: 'f2', project: 'p1', name: 'Algorithmic_Supervision_Policy_v1.2.docx', type: 'doc', size: '1.4 MB', by: 'm1', at: minsAgo(400), task: 't1' },
    { id: 'f3', project: 'p2', name: 'DORA_Regulation_EU_2022_2554_Official_Journal.pdf', type: 'pdf', size: '3.4 MB', by: 'm4', at: minsAgo(5000) },
    { id: 'f4', project: 'p2', name: 'DORA_RTS_ICT_Risk_Management_Framework.pdf', type: 'pdf', size: '1.8 MB', by: 'm4', at: minsAgo(1200), task: 't6' },
    { id: 'f5', project: 'p2', name: 'Digia_Resilience_Gap_Analysis_2026.xlsx', type: 'sheet', size: '480 KB', by: 'm1', at: minsAgo(3400), task: 't6' },
    { id: 'f6', project: 'p3', name: 'Finansinspektionen_FFFS_2017_11_Penningtvatt.pdf', type: 'pdf', size: '890 KB', by: 'm5', at: minsAgo(8000) },
    { id: 'f7', project: 'p3', name: 'AML_General_Risk_Assessment_Draft_2026.docx', type: 'doc', size: '2.1 MB', by: 'm5', at: minsAgo(600), task: 't11' },
    { id: 'f8', project: 'p4', name: 'FFFS_2013_9_AIFM_Consolidated.pdf', type: 'pdf', size: '1.6 MB', by: 'm7', at: minsAgo(9500) },
    { id: 'f9', project: 'p6', name: 'SFDR_PAI_Consolidated_Statement_2026.pdf', type: 'pdf', size: '920 KB', by: 'm6', at: minsAgo(2200), task: 't19' },
  ];

  const events = [
    { id: 'e1', title: 'Finansinspektionen Supervisory Dialogue · SFS 2026:916', date: dOff(2), time: '10:00', project: 'p1' },
    { id: 'e2', title: 'DORA Steering Committee & CTPP Freeze', date: dOff(5), time: '13:30', project: 'p2' },
    { id: 'e3', title: 'Executive Board Compliance & GRA Attestation', date: dOff(8), time: '15:00', project: 'p3' },
    { id: 'e4', title: 'AIFM Annex IV Supervisory Filing Deadline', date: dOff(10), time: '17:00', project: 'p4' },
    { id: 'e5', title: 'Quarterly Best Execution Review Committee', date: dOff(25), time: '11:00', project: 'p5' },
  ];

  const tmp = tk('t1');
  if (tmp) tmp.updated = minsAgo(35);

  return {
    ws: { name: 'Digia RegTech Hub (Nordic Wealth)', url: 'digia-regtech', c: '#0F52BA', brand: true },
    workspaces: [
      { id: 'w1', name: 'Digia RegTech Hub (Nordic Wealth)', c: '#0F52BA', plan: 'Enterprise', brand: true },
      { id: 'w2', name: 'Evli Wealth Management (Sandbox)', c: '#23918A', plan: 'Dedicated' },
      { id: 'w3', name: 'United Bankers Asset Mgmt', c: '#5A67D8', plan: 'Dedicated' },
    ],
    me: 'm1',
    members,
    projects,
    tasks: T,
    comments,
    activity,
    notifs,
    files,
    events,
    projOrder: projects.map(p => p.id),
    savedViews: [{ id: 'v1', project: 'p1', name: 'Critical Obligations', type: 'list', filters: [{ f: 'priority', op: 'is', v: ['urgent', 'high'] }] }],
    recentSearches: ['1 kap. 100 §', 'DORA', 'Penningtvätt', 'SFS 2026:916'],
    sessions: [
      { id: 'se1', dev: 'MacBook Pro · Chrome (Helsinki)', loc: 'Helsinki, FI', at: 'Active now', cur: true },
      { id: 'se2', dev: 'Digia Workstation · Linux', loc: 'Helsinki, FI', at: '15 minutes ago' },
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
