/* ---------- statutory regulation data model ---------- */
export const REGULATIONS = [
  {
    id: 'reg-sfs-2004-46',
    code: 'SFS 2004:46',
    title: 'Lag (2004:46) om värdepappersfonder',
    shortTitle: 'Värdepappersfondslagen',
    jurisdiction: 'Sweden (Riksdagen)',
    authority: 'Finansinspektionen',
    type: 'national_act',
    inForce: '2004-04-01',
    status: 'In force',
    amendedBy: 'SFS 2026:916',
    tags: ['Funds', 'UCITS', 'Finansinspektionen', 'AI', 'Risk'],
    summary:
      'Primary Swedish statute regulating fund management companies, UCITS funds, depositary institutions, investor disclosures, and supervisory intervention.',
    projectId: 'p1',
    chapters: [
      {
        number: '1 kap.',
        title: 'Inledande bestämmelser',
        sections: [
          {
            id: 'sfs-1-1',
            number: '1 §',
            heading: 'Definitioner och tillämpningsområde',
            text: 'I denna lag betyder alternativ investeringsfond, behörig myndighet, derivatinstrument, EES, egna medel och förvaltningsbolag det som anges i direktiv 2009/65/EG med beaktande av DORA-kraven.',
            crossRefs: [{ regId: 'reg-dora', label: 'Regulation (EU) 2022/2554 (DORA) Art. 1' }],
            tags: ['UCITS', 'Definitions', 'DORA'],
            taskId: 't2',
            taskKey: 'SFS 1:1',
            status: 'MODIFIED',
            amendingAct: 'SFS 2026:916',
          },
          {
            id: 'sfs-1-2',
            number: '2 §',
            heading: 'Tillståndsplikt för fondverksamhet',
            text: 'Fondverksamhet får drivas endast av ett svenskt aktiebolag som har fått tillstånd till sådan verksamhet av Finansinspektionen (fondbolag) eller av ett utländskt förvaltningsbolag.',
            crossRefs: [],
            tags: ['Authorization', 'Funds'],
            status: 'UNCHANGED',
          },
          {
            id: 'sfs-1-99',
            number: '99 §',
            heading: 'Övergångsbestämmelser för äldre fondbolag',
            text: 'Bestämmelserna i detta kapitel ska inte tillämpas på fondbolag som erhållit auktorisation före den 1 januari 2012 vad avser äldre förvaltningsrutiner.',
            crossRefs: [],
            tags: ['Transitional', 'Funds'],
            taskId: 't3',
            taskKey: 'SFS 1:99',
            status: 'DELETED',
            amendingAct: 'SFS 2026:916',
          },
          {
            id: 'sfs-1-100',
            number: '100 §',
            heading: 'Tillsyn över artificiell intelligens och algoritmer',
            text: 'Ett fondbolag som använder artificiell intelligens eller helautomatiserade handelsalgoritmer vid förvaltningen av en värdepappersfond ska säkerställa att systemen är underkastade kontinuerlig mänsklig tillsyn, att fondens riskprofil övervakas i realtid, samt att samtliga förvaltnings- och allokeringsbeslut kan rekonstrueras i efterhand på begäran av Finansinspektionen.',
            crossRefs: [{ regId: 'reg-mifid', label: 'MiFID II Delegated Reg 2017/565 Art. 21' }],
            tags: ['AI', 'AlgorithmicTrading', 'Supervision', 'Finansinspektionen'],
            taskId: 't1',
            taskKey: 'SFS 1:100',
            status: 'ADDED',
            amendingAct: 'SFS 2026:916',
          },
        ],
      },
      {
        number: '2 kap.',
        title: 'Verksamhetskrav och riskhantering',
        sections: [
          {
            id: 'sfs-2-13',
            number: '13 §',
            heading: 'Likviditetsstyrning och stresstester',
            text: 'Ett fondbolag ska ha lämpliga rutiner för riskhantering och regelbundet genomföra likviditetsstresstester enligt Europeiska värdepappers- och marknadsmyndighetens riktlinjer.',
            crossRefs: [{ regId: 'reg-aifm', label: 'FFFS 2013:9 Kap 13' }],
            tags: ['Risk', 'Liquidity', 'ESMA'],
            taskId: 't4',
            taskKey: 'ESMA §34',
            status: 'UNCHANGED',
          },
        ],
      },
    ],
  },
  {
    id: 'reg-dora',
    code: 'Regulation (EU) 2022/2554',
    title: 'Digital Operational Resilience Act (DORA)',
    shortTitle: 'DORA',
    jurisdiction: 'European Union',
    authority: 'Joint Committee of ESAs / Finansinspektionen',
    type: 'eu_regulation',
    inForce: '2025-01-17',
    status: 'In force',
    tags: ['ICT-Risk', 'DORA', 'ThirdParty', 'Cyber', 'EU'],
    summary:
      'Uniform European regulation laying down consolidated requirements for the security of network and information systems of financial entities, digital operational testing, and critical third-party provider oversight.',
    projectId: 'p2',
    chapters: [
      {
        number: 'Chapter II',
        title: 'ICT Risk Management',
        sections: [
          {
            id: 'dora-art-5',
            number: 'Article 5',
            heading: 'Governance and organization',
            text: 'Financial entities shall have in place an internal governance and control framework that ensures an effective and prudent management of ICT risk. The management body shall define, approve, oversee and be accountable for the implementation of all arrangements related to the ICT risk management framework.',
            crossRefs: [{ regId: 'reg-sfs-2004-46', label: 'SFS 2004:46 1 kap. 1 §' }],
            tags: ['Governance', 'Board', 'DORA'],
            taskId: 't6',
            taskKey: 'DORA §5',
            status: 'UNCHANGED',
          },
          {
            id: 'dora-art-17',
            number: 'Article 17',
            heading: 'Major ICT-related incident reporting procedure',
            text: 'Financial entities shall report major ICT-related incidents to the relevant competent authority within the established deadlines, submitting an initial notification within 4 hours of classification.',
            crossRefs: [],
            tags: ['Incidents', 'Reporting', 'Cyber'],
            taskId: 't8',
            taskKey: 'DORA §17',
            status: 'UNCHANGED',
          },
        ],
      },
      {
        number: 'Chapter IV',
        title: 'Digital Operational Resilience Testing',
        sections: [
          {
            id: 'dora-art-26',
            number: 'Article 26',
            heading: 'Advanced testing of ICT tools based on TLPT',
            text: 'Financial entities identified by competent authorities shall carry out at least every 3 years advanced threat-led penetration testing (TLPT) covering critical or important functions.',
            crossRefs: [],
            tags: ['Testing', 'TLPT', 'TIBER'],
            taskId: 't9',
            taskKey: 'TIBER §26',
            status: 'UNCHANGED',
          },
        ],
      },
      {
        number: 'Chapter V',
        title: 'Managing ICT Third-Party Risk',
        sections: [
          {
            id: 'dora-art-28',
            number: 'Article 28',
            heading: 'Register of information on critical third-party providers',
            text: 'Financial entities shall maintain and update at entity level a register of information in relation to all contractual arrangements on the use of ICT services provided by ICT third-party service providers, distinguishing between critical and non-critical providers.',
            crossRefs: [{ regId: 'reg-sfs-2004-46', label: 'SFS 2004:46 1 kap. 1 §' }],
            tags: ['ThirdParty', 'CTPP', 'Cloud'],
            taskId: 't7',
            taskKey: 'DORA §28',
            status: 'UNCHANGED',
          },
        ],
      },
    ],
  },
  {
    id: 'reg-aml',
    code: 'SFS 2017:630',
    title: 'Lag (2017:630) om åtgärder mot penningtvätt och finansiering av terrorism',
    shortTitle: 'Penningtvättslagen',
    jurisdiction: 'Sweden (Riksdagen)',
    authority: 'Finansinspektionen / Polisen',
    type: 'national_act',
    inForce: '2017-08-01',
    status: 'In force',
    tags: ['AML', 'Sanctions', 'Finansinspektionen', 'Compliance'],
    summary:
      'Swedish anti-money laundering and counter-terrorist financing law requiring comprehensive risk assessments, customer due diligence (CDD), politically exposed persons (PEP) checks, and suspicious activity reporting.',
    projectId: 'p3',
    chapters: [
      {
        number: '2 kap.',
        title: 'Allmän riskbedömning och rutiner',
        sections: [
          {
            id: 'aml-2-1',
            number: '1 §',
            heading: 'Allmän riskbedömning (GRA)',
            text: 'En verksamhetsutövare ska göra en dokumenterad bedömning av hur de produkter och tjänster som tillhandahålls kan utnyttjas för penningtvätt eller finansiering av terrorism (allmän riskbedömning).',
            crossRefs: [],
            tags: ['RiskAssessment', 'AML', 'GRA'],
            taskId: 't11',
            taskKey: 'AML §4',
            status: 'UNCHANGED',
          },
        ],
      },
      {
        number: '3 kap.',
        title: 'Kundkännedom (CDD)',
        sections: [
          {
            id: 'aml-3-4',
            number: '4 §',
            heading: 'Skärpta åtgärder vid hög risk och PEP',
            text: 'Om risken för penningtvätt bedöms som hög, ska verksamhetsutövaren vidta skärpta åtgärder för kundkännedom och realtidssanktionskontroll.',
            crossRefs: [{ regId: 'reg-mifid', label: 'MiFID II Art. 24' }],
            tags: ['PEP', 'Sanctions', 'CDD'],
            taskId: 't13',
            taskKey: 'AML §3',
            status: 'UNCHANGED',
          },
        ],
      },
    ],
  },
  {
    id: 'reg-aifm',
    code: 'FFFS 2013:9',
    title: 'Föreskrifter om förvaltare av alternativa investeringsfonder',
    shortTitle: 'AIFM-Föreskrifter',
    jurisdiction: 'Sweden (Finansinspektionen)',
    authority: 'Finansinspektionen',
    type: 'supervisory_regulation',
    inForce: '2013-07-22',
    status: 'In force',
    tags: ['Funds', 'AIFM', 'Valuation', 'Finansinspektionen'],
    summary:
      'Finansinspektionen regulatory code governing alternative investment fund managers, valuation independence, risk liquidity metrics, and Annex IV supervisory filings.',
    projectId: 'p4',
    chapters: [
      {
        number: '13 kap.',
        title: 'Värdering av fondtillgångar',
        sections: [
          {
            id: 'aifm-13-1',
            number: '1 §',
            heading: 'Oberoende värderingsfunktion',
            text: 'En AIF-förvaltare ska säkerställa att värderingsfunktionen är organisatoriskt och funktionellt oberoende från portföljförvaltningen och ersättningssystemen.',
            crossRefs: [{ regId: 'reg-sfs-2004-46', label: 'SFS 2004:46 2 kap. 13 §' }],
            tags: ['Valuation', 'Governance', 'AIFM'],
            taskId: 't14',
            taskKey: 'AIFM §13',
            status: 'UNCHANGED',
          },
        ],
      },
      {
        number: '14 kap.',
        title: 'Tillsynsrapportering (Annex IV)',
        sections: [
          {
            id: 'aifm-14-1',
            number: '1 §',
            heading: 'Regelbunden rapportering till FI',
            text: 'AIF-förvaltare ska kvartalsvis lämna uppgifter om de viktigaste marknader och instrument som förvaltaren handlar i samt fondens hävstångsnivåer i föreskrivet XML-format.',
            crossRefs: [],
            tags: ['Reporting', 'AnnexIV', 'XML'],
            taskId: 't16',
            taskKey: 'ANNEX-IV',
            status: 'UNCHANGED',
          },
        ],
      },
    ],
  },
  {
    id: 'reg-mifid',
    code: 'Directive 2014/65/EU (MiFID II)',
    title: 'Markets in Financial Instruments Directive & RTS 28',
    shortTitle: 'MiFID II & RTS 28',
    jurisdiction: 'European Union',
    authority: 'ESMA / Finansinspektionen',
    type: 'eu_directive',
    inForce: '2018-01-03',
    status: 'In force',
    tags: ['MiFID', 'BestExecution', 'Conduct', 'EU'],
    summary:
      'EU regulatory framework governing investment firms, trading venues, order execution quality, investor protection suitability assessments, and annual RTS 28 disclosures.',
    projectId: 'p5',
    chapters: [
      {
        number: 'Title II',
        title: 'Operating Conditions for Investment Firms',
        sections: [
          {
            id: 'mifid-art-24',
            number: 'Article 24',
            heading: 'General principles and information to clients',
            text: 'An investment firm shall act honestly, fairly and professionally in accordance with the best interests of its clients and comply with product governance requirements.',
            crossRefs: [{ regId: 'reg-aml', label: 'SFS 2017:630 3 kap. 4 §' }],
            tags: ['Conduct', 'Suitability', 'POG'],
            taskId: 't18',
            taskKey: 'POG §9',
            status: 'UNCHANGED',
          },
          {
            id: 'mifid-art-27',
            number: 'Article 27',
            heading: 'Obligation to execute orders on terms most favourable to the client',
            text: 'Investment firms shall take all sufficient steps to obtain, when executing orders, the best possible result for their clients and publish annually the top five execution venues (RTS 28).',
            crossRefs: [{ regId: 'reg-sfs-2004-46', label: 'SFS 2004:46 1 kap. 100 §' }],
            tags: ['BestExecution', 'RTS28', 'Trading'],
            taskId: 't17',
            taskKey: 'RTS §28',
            status: 'UNCHANGED',
          },
        ],
      },
    ],
  },
  {
    id: 'reg-sfdr',
    code: 'Regulation (EU) 2019/2088 (SFDR)',
    title: 'Sustainable Finance Disclosure Regulation & Taxonomy',
    shortTitle: 'SFDR & Taxonomy',
    jurisdiction: 'European Union',
    authority: 'Joint Committee of ESAs',
    type: 'eu_regulation',
    inForce: '2021-03-10',
    status: 'In force',
    tags: ['ESG', 'SFDR', 'Taxonomy', 'Disclosures', 'EU'],
    summary:
      'Mandatory ESG transparency and sustainability disclosure regime requiring financial market participants to publish Principal Adverse Impact (PAI) statements and classify Article 8 and Article 9 funds.',
    projectId: 'p6',
    chapters: [
      {
        number: 'Chapter I',
        title: 'Transparency and Sustainability Disclosures',
        sections: [
          {
            id: 'sfdr-art-4',
            number: 'Article 4',
            heading: 'Transparency of adverse sustainability impacts at entity level',
            text: 'Financial market participants shall publish and maintain on their websites a statement on their due diligence policies with respect to the principal adverse impacts of investment decisions on sustainability factors (PAI statement).',
            crossRefs: [],
            tags: ['PAI', 'ESG', 'Disclosures'],
            taskId: 't19',
            taskKey: 'SFDR §14',
            status: 'UNCHANGED',
          },
          {
            id: 'sfdr-art-9',
            number: 'Article 9',
            heading: 'Transparency of sustainable investments in pre-contractual disclosures',
            text: 'Where a financial product has sustainable investment as its objective, the information to be disclosed shall specify how the environmental or social objective is attained and verify alignment with the EU Green Taxonomy Regulation (2020/852).',
            crossRefs: [{ regId: 'reg-sfs-2004-46', label: 'SFS 2004:46 1 kap. 1 §' }],
            tags: ['Taxonomy', 'Article9', 'Green'],
            taskId: 't20',
            taskKey: 'TAXON §3',
            status: 'UNCHANGED',
          },
        ],
      },
    ],
  },
];

export function allRegulations() {
  return REGULATIONS;
}

export function regulation(id) {
  return REGULATIONS.find(r => r.id === id || r.code === id);
}

export function allTags() {
  const set = new Set();
  REGULATIONS.forEach(r => {
    (r.tags || []).forEach(t => set.add(t));
    (r.chapters || []).forEach(ch => {
      (ch.sections || []).forEach(s => {
        (s.tags || []).forEach(t => set.add(t));
      });
    });
  });
  return Array.from(set).sort();
}
