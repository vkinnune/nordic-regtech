/* ---------- STATUTORY REGULATIONS DATA MODEL ---------- */
import swedishRegs from './swedish_regulations.json';

const BASE_REGULATIONS = [
  {
    id: 'reg-finlex-747-2012',
    code: '747/2012',
    title: 'Investment Services Act (747/2012)',
    shortTitle: 'Investment Services Act',
    jurisdiction: 'Finland (Eduskunta / Finlex)',
    authority: 'Financial Supervisory Authority (FIN-FSA)',
    type: 'national_act',
    inForce: '2013-01-01',
    status: 'In force',
    amendedBy: '28.12.2017/1069',
    tags: ['InvestmentServices', 'FIN-FSA', 'MiFID', 'AlgorithmicTrading'],
    summary:
      'The Finnish Investment Services Act (transposing MiFID II). Governs investment firms, exemptions from licensing, algorithmic trading obligations, structured deposits, and commodity derivative position limits.',
    projectId: 'p5',
    parts: [
      {
        number: 'Part I',
        title: 'GENERAL PROVISIONS AND RIGHT TO PROVIDE INVESTMENT SERVICES',
        chapters: [
          {
            number: 'Chapter 1',
            title: 'General provisions',
            sections: [
              {
                id: 'finlex-1-1',
                number: '1 §',
                amendingAct: '(28.12.2017/1069)',
                heading: 'Scope',
                text: 'Tätä lakia sovelletaan liiketoimintaan, jossa tarjotaan sijoituspalvelua tai harjoitetaan sijoitustoimintaa.',
                plainEnglish: {
                  summary: 'Applies to any business that offers investment services or carries out investment activities commercially in Finland.',
                  points: [
                    'Covers brokers, wealth managers, trading venues, and investment advisory firms.',
                    'Requires a formal FIN-FSA license unless an explicit legal exemption applies.',
                    'Protects clients by enforcing uniform investor protection standards across all services.',
                  ],
                },
                textEn: 'This Act applies to business operations that provide investment services or conduct investment activities.',
                crossRefs: [{ regId: 'reg-mifid', label: 'MiFID II Directive 2014/65/EU Art. 1' }],
                tags: ['Scope', 'InvestmentServices'],
                status: 'UNCHANGED',
              },
              {
                id: 'finlex-1-2',
                number: '2 §',
                amendingAct: '(28.12.2017/1069)',
                heading: 'Exemptions from scope',
                text: `Tätä lakia ei sovelleta, jos:
1) palvelua tarjotaan yksinomaan samaan konserniin kuuluvalle kirjanpitovelvolliselle;
2) toimintaa harjoitetaan satunnaisesti muun laissa säännellyssä ammattitoiminnassa kuin sijoituspalvelujen tarjoamisessa, eikä siitä peritä erillistä palkkiota;
3) kauppaa käydään omaan lukuun muilla rahoitusvälineillä kuin hyödykejohdannaisilla, päästöoikeuksilla tai päästöoikeusjohdannaisilla, paitsi jos kauppaa käyvä:
   (4.7.2025/526)
   a) toimii markkinatakaajana;
   b) on sellaisen säännellyn markkinan tai monenkeskisen kaupankäyntijärjestelmän jäsen tai osapuoli, joka ei ole finanssialan ulkopuolinen yhteisö;
   c) soveltaa huippunopeaa algoritmista kaupankäyntimenetelmää; tai
   d) käy kauppaa omaan lukuun toteuttaessaan asiakastoimeksiantoja;
4) liiketoiminnan harjoittaja käy kauppaa omaan lukuun hyödykejohdannaisilla pääasiallisen liiketoimintansa oheistoimintana; (19.11.2021/939)
5) liiketoiminnan harjoittaja tarjoaa sijoitusneuvontaa muun ammattitoiminnan yhteydessä ilman erillistä palkkiota; (19.11.2021/939)
6) kyseessä on yrityksille suunnatun joukkorahoituspalvelun tarjoaja asetuksen (EU) 2020/1503 mukaisesti. (19.11.2021/939)

Tämä laki ei koske:
1) Valtiokonttoria, Euroopan keskuspankkia, Suomen Pankkia, muita julkisia elimiä tai kansainvälisiä rahoituslaitoksia.`,
                plainEnglish: {
                  summary:
                    'Exempts internal corporate group services, incidental professional advice, and pure own-account trading from licensing requirements.',
                  points: [
                    'Intra-group exemption: Providing treasury or investment services only to companies within your own group does not require an investment firm license.',
                    'Own-account trading: Trading for your own company is exempt unless you act as a market maker, use high-frequency trading (HFT), or execute customer orders.',
                    'Central banks & public bodies: The Bank of Finland, ECB, and State Treasury are fully exempt.',
                  ],
                },
                textEn: `This Act does not apply if:
1) the service is provided solely to an accounting entity belonging to the same group;
2) the activity is carried out incidentally in the course of other regulated professional activities, and no separate fee is charged;
3) trading is conducted for own account, unless the trader acts as a market maker, uses high-frequency algorithmic trading, or executes client orders;
4) commodity derivatives trading is purely ancillary to main non-financial operations.

This Act does not apply to the State Treasury, European Central Bank, Bank of Finland, or international financial institutions.`,
                crossRefs: [{ regId: 'reg-mifid', label: 'MiFID II Art. 2 (Exemptions)' }],
                tags: ['Exemptions', 'OwnAccount', 'GroupTreasury', 'Algorithms'],
                status: 'UNCHANGED',
              },
              {
                id: 'finlex-1-3',
                number: '3 §',
                amendingAct: '(28.12.2017/1069)',
                heading: 'Partial exemptions from scope',
                text: 'Mitä tässä laissa säädetään sijoituspalveluyrityksen toimiluvan hakemisesta ja vakavaraisuusvaatimuksista, ei sovelleta sellaisiin yhteisöihin, jotka tarjoavat ainoastaan toimeksiantojen välittämistä tai sijoitusneuvontaa eivätkä pidä hallussaan asiakasvaroja.',
                plainEnglish: {
                  summary: 'Lighter licensing and capital rules apply to small advisory firms that never hold client money or assets.',
                  points: [
                    'Advisory-only firms with no custody of client funds face reduced capital adequacy requirements.',
                    'Allows boutique financial planners to operate under simplified prudential rules.',
                  ],
                },
                textEn:
                  'Licensing and capital adequacy requirements do not apply in full to entities that only receive and transmit orders or provide investment advice without holding client funds.',
                crossRefs: [],
                tags: ['Exemptions', 'Advisory', 'CapitalRequirements'],
                status: 'UNCHANGED',
              },
              {
                id: 'finlex-1-8',
                number: '8 §',
                amendingAct: '(28.12.2017/1069)',
                heading: 'Provisions applicable to structured deposits and related advice',
                text: 'Luottolaitokseen, joka myy strukturoituja talletuksia tai antaa niistä sijoitusneuvontaa asiakkaille, sovelletaan mitä 10 luvussa säädetään menettelytavoista asiakassuhteessa ja 10 a luvussa tuotehallintavaatimuksista.',
                plainEnglish: {
                  summary:
                    'Banks selling index-linked or structured deposits must follow the same strict investor protection and disclosure rules as investment firms.',
                  points: [
                    'Suitability checks: Banks must assess whether the structured deposit matches the customer knowledge and risk appetite.',
                    'Cost transparency: Full disclosure of all embedded derivative fees and capital guarantee terms before purchase.',
                  ],
                },
                textEn:
                  'A credit institution that sells structured deposits or provides investment advice on them must comply with Chapter 10 conduct of business rules and Chapter 10a product governance requirements.',
                crossRefs: [{ regId: 'reg-mifid', label: 'MiFID II Art. 24 & Product Governance' }],
                tags: ['StructuredDeposits', 'Banks', 'InvestorProtection'],
                status: 'UNCHANGED',
              },
              {
                id: 'finlex-1-9',
                number: '9 §',
                amendingAct: '(4.7.2025/526)',
                heading: 'Provisions applicable to algorithmic trading',
                text: `Algoritmista kaupankäyntiä harjoittavalla sijoituspalveluyrityksellä on oltava:
1) toimivat ja häiriönsietokykyiset järjestelmät sekä riittävä kapasiteetti, joilla varmistetaan, etteivät kaupankäyntijärjestelmät luo tai lisää markkinahäiriöitä;
2) tehokkaat kaupankäyntilimiitit ja -rajat, joilla estetään virheellisten toimeksiantojen lähettäminen;
3) toiminnan jatkuvuussuunnitelmat ja testausmenetelmät järjestelmähäiriöiden varalta;
4) velvollisuus ilmoittaa algoritmisen kaupankäynnin harjoittamisesta Finanssivalvonnalle ja asianomaiselle kauppapaikalle;
5) velvollisuus säilyttää vähintään viiden vuoden ajan tiedot algoritmien parametreista ja toimeksiannoista Finanssivalvonnan tarkastusta varten.`,
                plainEnglish: {
                  summary:
                    'Investment firms using trading algorithms must implement pre-trade risk controls, circuit breakers, test environments, and notify FIN-FSA.',
                  points: [
                    'System resilience: Trading bots must withstand extreme volume without causing market disorder or flash crashes.',
                    'Pre-trade risk filters: Hard caps on order size and price deviation to block erroneous orders.',
                    'Audit trail & logging: Must preserve algorithmic code parameters and trade history for 5 years for FIN-FSA inspection.',
                  ],
                },
                textEn: `An investment firm engaging in algorithmic trading must have:
1) effective and resilient systems with sufficient capacity to ensure trading systems do not create market disruptions;
2) pre-trade controls and limits to prevent the transmission of erroneous orders;
3) business continuity plans and thorough testing procedures;
4) an obligation to notify FIN-FSA and trading venues of algorithmic trading activities;
5) an obligation to store algorithmic parameters and orders for 5 years for FIN-FSA inspection.`,
                crossRefs: [
                  { regId: 'reg-sfs-2004-46', label: 'SFS 2004:46 1 kap. 100 § (AI & Algoritmer)' },
                  { regId: 'reg-mifid', label: 'MiFID II Art. 17 (Algorithmic Trading)' },
                ],
                tags: ['AlgorithmicTrading', 'Risk', 'HFT', 'FIN-FSA'],
                taskId: 't1',
                taskKey: 'SFS 1:100',
                status: 'MODIFIED',
              },
              {
                id: 'finlex-1-10',
                number: '10 §',
                amendingAct: '(28.12.2017/1069)',
                heading: 'Provisions applicable to commodity derivative position limits and reporting',
                text: 'Hyödykejohdannaisilla tai päästöoikeuksilla kauppaa käyvän sijoituspalveluyrityksen on noudatettava Finanssivalvonnan asettamia positiolimiittejä sekä raportoitava positionsa päivittäin Finanssivalvonnalle ja asianomaiselle kauppapaikalle.',
                plainEnglish: {
                  summary:
                    'Firms trading commodity derivatives must comply with position caps to prevent market corners and file daily position reports with FIN-FSA.',
                  points: [
                    'Position caps: Hard limits on the net size of commodity contracts held across spot and derivative markets.',
                    'Daily reporting: Automatic end-of-day electronic position filings to FIN-FSA.',
                  ],
                },
                textEn:
                  'An investment firm trading in commodity derivatives or emission allowances must comply with position limits set by FIN-FSA and report its positions daily.',
                crossRefs: [],
                tags: ['Commodities', 'Reporting', 'PositionLimits'],
                status: 'UNCHANGED',
              },
            ],
          },
        ],
      },
    ],
  },
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
      'Primary Swedish statute regulating fund management companies, UCITS funds, depositary institutions, investor disclosures, algorithmic governance, and supervisory intervention.',
    projectId: 'p1',
    parts: [
      {
        number: '1 kap.',
        title: 'Inledande bestämmelser',
        chapters: [
          {
            number: '1 kap.',
            title: 'Inledande bestämmelser',
            sections: [
              {
                id: 'sfs-1-1',
                number: '1 §',
                amendingAct: '(SFS 2026:916)',
                heading: 'Definitioner och tillämpningsområde',
                text: 'I denna lag betyder alternativ investeringsfond, behörig myndighet, derivatinstrument, EES, egna medel och förvaltningsbolag det som anges i direktiv 2009/65/EG med beaktande av DORA-kraven.',
                plainEnglish: {
                  summary: 'Formally integrates EU DORA cybersecurity and operational resilience definitions directly into Swedish fund law.',
                  points: [
                    'Scope alignment: Swedish UCITS fund managers are legally bound by EU DORA IT resilience standards.',
                    'Harmonized terms: Definitions match EU directives and European Supervisory Authority (ESA) standards.',
                  ],
                },
                textEn:
                  'In this Act, alternative investment fund, competent authority, derivative instrument, EEA, own funds, and management company have the meanings stated in Directive 2009/65/EC, taking into account DORA requirements.',
                crossRefs: [{ regId: 'reg-dora', label: 'Regulation (EU) 2022/2554 (DORA) Art. 1' }],
                tags: ['UCITS', 'Definitions', 'DORA'],
                taskId: 't2',
                taskKey: 'SFS 1:1',
                status: 'MODIFIED',
              },
              {
                id: 'sfs-1-2',
                number: '2 §',
                amendingAct: '',
                heading: 'Tillståndsplikt för fondverksamhet',
                text: 'Fondverksamhet får drivas endast av ett svenskt aktiebolag som har fått tillstånd till sådan verksamhet av Finansinspektionen (fondbolag) eller av ett utländskt förvaltningsbolag.',
                plainEnglish: {
                  summary:
                    'Only Swedish limited companies licensed by Finansinspektionen or authorized EU fund companies may operate investment funds in Sweden.',
                  points: [
                    'Mandatory license: Operating without authorization is illegal under Swedish financial law.',
                    'Cross-border passporting: EU management companies can manage Swedish funds under UCITS passport rules.',
                  ],
                },
                textEn:
                  'Fund management operations may be conducted only by a Swedish limited liability company authorized by Finansinspektionen (fund company) or by an authorized foreign management company.',
                crossRefs: [],
                tags: ['Authorization', 'Funds'],
                status: 'UNCHANGED',
              },
              {
                id: 'sfs-1-99',
                number: '99 §',
                amendingAct: '(SFS 2026:916)',
                heading: 'Övergångsbestämmelser för äldre fondbolag',
                text: 'Bestämmelserna i detta kapitel ska inte tillämpas på fondbolag som erhållit auktorisation före den 1 januari 2012 vad avser äldre förvaltningsrutiner.',
                plainEnglish: {
                  summary:
                    'Repealed transitional provision. Legacy exemptions dating back to 2012 are now removed; all funds must follow uniform modern standards.',
                  points: [
                    'Repeal of grandfathering: Older fund companies can no longer rely on legacy exemptions.',
                    'All fund managers now operate under the same strict supervisory framework.',
                  ],
                },
                textEn:
                  'The provisions of this chapter shall not apply to fund companies that obtained authorization before January 1, 2012 regarding older management routines. [REPEALED BY SFS 2026:916]',
                crossRefs: [],
                tags: ['Transitional', 'Funds'],
                taskId: 't3',
                taskKey: 'SFS 1:99',
                status: 'DELETED',
              },
              {
                id: 'sfs-1-100',
                number: '100 §',
                amendingAct: '(SFS 2026:916)',
                heading: 'Tillsyn över artificiell intelligens och algoritmer',
                text: 'Ett fondbolag som använder artificiell intelligens eller helautomatiserade handelsalgoritmer vid förvaltningen av en värdepappersfond ska säkerställa att systemen är underkastade kontinuerlig mänsklig tillsyn, att fondens riskprofil övervakas i realtid, samt att samtliga förvaltnings- och allokeringsbeslut kan rekonstrueras i efterhand på begäran av Finansinspektionen.',
                plainEnglish: {
                  summary:
                    'Fund managers using AI or automated trading bots must ensure continuous human supervision, real-time risk surveillance, and complete decision audit trails.',
                  points: [
                    'Human in the loop: A qualified individual must actively oversee AI systems and be capable of overriding or shutting them down.',
                    'Real-time risk monitoring: Live surveillance of portfolio risk parameters during execution.',
                    'Audit reconstruction: Every trade recommendation and allocation decision must be logged so regulators can reconstruct it.',
                  ],
                },
                textEn:
                  'A fund company using artificial intelligence or fully automated trading algorithms in managing an investment fund must ensure that systems are subject to continuous human oversight, that the fund risk profile is monitored in real time, and that all management and asset allocation decisions can be reconstructed in hindsight upon request by Finansinspektionen.',
                crossRefs: [
                  { regId: 'reg-finlex-747-2012', label: 'Investment Services Act Ch. 1 Sec. 9 (Algorithmic Trading)' },
                  { regId: 'reg-mifid', label: 'MiFID II Delegated Reg 2017/565 Art. 21' },
                ],
                tags: ['AI', 'AlgorithmicTrading', 'Supervision', 'Finansinspektionen'],
                taskId: 't1',
                taskKey: 'SFS 1:100',
                status: 'ADDED',
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
                amendingAct: '',
                heading: 'Likviditetsstyrning och stresstester',
                text: 'Ett fondbolag ska ha lämpliga rutiner för riskhantering och regelbundet genomföra likviditetsstresstester enligt Europeiska värdepappers- och marknadsmyndighetens riktlinjer.',
                plainEnglish: {
                  summary:
                    'Requires fund managers to establish robust liquidity risk management systems and run regular liquidity stress tests based on ESMA guidelines.',
                  points: [
                    'Periodic stress testing against severe market downturn and redemption shock scenarios.',
                    'Liquidity management tools (swing pricing, redemption gates) must be defined in fund rules.',
                  ],
                },
                textEn:
                  'A fund company must maintain suitable risk management procedures and regularly perform liquidity stress tests according to ESMA guidelines.',
                crossRefs: [{ regId: 'reg-aifm', label: 'FFFS 2013:9 8 kap. 13 §' }],
                tags: ['Risk', 'Liquidity', 'ESMA'],
                taskId: 't4',
                taskKey: 'ESMA §34',
                status: 'UNCHANGED',
              },
            ],
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
    authority: 'Joint Committee of ESAs / Finansinspektionen / FIN-FSA',
    type: 'eu_regulation',
    inForce: '2025-01-17',
    status: 'In force',
    amendedBy: '',
    tags: ['ICT-Risk', 'DORA', 'ThirdParty', 'Cyber', 'EU'],
    summary:
      'Uniform European regulation laying down consolidated requirements for the security of network and information systems of financial entities, digital operational testing, and critical third-party provider oversight.',
    projectId: 'p2',
    parts: [
      {
        number: 'Chapter II',
        title: 'ICT Risk Management',
        chapters: [
          {
            number: 'Chapter II',
            title: 'ICT Risk Management Framework',
            sections: [
              {
                id: 'dora-art-5',
                number: 'Article 5',
                amendingAct: '',
                heading: 'Governance and organization',
                text: 'Financial entities shall have in place an internal governance and control framework that ensures an effective and prudent management of ICT risk. The management body shall define, approve, oversee and be accountable for the implementation of all arrangements related to the ICT risk management framework.',
                plainEnglish: {
                  summary: 'The board of directors is ultimately accountable for digital security, IT risks, and business continuity across the entire firm.',
                  points: [
                    'Board responsibility: Directors cannot delegate ultimate legal accountability for cyber and IT risks.',
                    'Annual review: The ICT security strategy and risk tolerance must be approved by the board annually.',
                    'Mandatory training: Board members must maintain up-to-date knowledge of cybersecurity risks.',
                  ],
                },
                textEn:
                  'Financial entities shall have in place an internal governance and control framework ensuring effective and prudent management of ICT risk. The management body is accountable for all ICT risk arrangements.',
                crossRefs: [{ regId: 'reg-sfs-2004-46', label: 'SFS 2004:46 1 kap. 1 §' }],
                tags: ['Governance', 'Board', 'DORA'],
                taskId: 't6',
                taskKey: 'DORA §5',
                status: 'UNCHANGED',
              },
              {
                id: 'dora-art-17',
                number: 'Article 17',
                amendingAct: '',
                heading: 'Major ICT-related incident reporting procedure',
                text: 'Financial entities shall report major ICT-related incidents to the relevant competent authority within the established deadlines, submitting an initial notification within 4 hours of classification.',
                plainEnglish: {
                  summary:
                    'Major cyberattacks or IT outages must be reported to Finansinspektionen / FIN-FSA within strict deadlines, starting with an initial alert within 4 hours.',
                  points: [
                    '4-hour initial alert: Must notify regulators within 4 hours of classifying an incident as major.',
                    'Intermediate report: Detailed report within 72 hours.',
                    'Final root cause report: Within 1 month after service is restored.',
                  ],
                },
                textEn:
                  'Financial entities shall report major ICT-related incidents to the competent authority within established deadlines, submitting an initial notification within 4 hours of classification.',
                crossRefs: [],
                tags: ['Incidents', 'Reporting', 'Cyber'],
                taskId: 't8',
                taskKey: 'DORA §17',
                status: 'UNCHANGED',
              },
            ],
          },
          {
            number: 'Chapter IV & V',
            title: 'Testing & Third-Party Oversight',
            sections: [
              {
                id: 'dora-art-26',
                number: 'Article 26',
                amendingAct: '',
                heading: 'Advanced testing of ICT tools based on TLPT',
                text: 'Financial entities identified by competent authorities shall carry out at least every 3 years advanced threat-led penetration testing (TLPT) covering critical or important functions.',
                plainEnglish: {
                  summary:
                    'Major financial entities must undergo live red-team ethical hacking tests (TIBER-EU) at least once every 3 years on production systems.',
                  points: [
                    'Threat-Led Penetration Testing: Ethical hackers simulate real state-sponsored cyberattacks.',
                    'Scope: Must include critical third-party cloud and outsourcing providers.',
                  ],
                },
                textEn:
                  'Identified financial entities shall carry out at least every 3 years advanced threat-led penetration testing (TLPT) covering critical functions.',
                crossRefs: [],
                tags: ['Testing', 'TLPT', 'TIBER'],
                taskId: 't9',
                taskKey: 'TIBER §26',
                status: 'UNCHANGED',
              },
              {
                id: 'dora-art-28',
                number: 'Article 28',
                amendingAct: '',
                heading: 'Register of information on critical third-party providers',
                text: 'Financial entities shall maintain and update at entity level a register of information in relation to all contractual arrangements on the use of ICT services provided by ICT third-party service providers, distinguishing between critical and non-critical providers.',
                plainEnglish: {
                  summary:
                    'Firms must maintain an exhaustive database of all cloud, software, and IT contracts, flagging critical vendors for regulatory scrutiny.',
                  points: [
                    'Register of Information: Standardized European format listing every IT and cloud supplier.',
                    'Supply chain concentration: Identifies dependency on major providers like AWS, Microsoft, and Google Cloud.',
                  ],
                },
                textEn: 'Financial entities must maintain a register of information covering all ICT contracts, identifying critical third-party providers.',
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
    amendedBy: '',
    tags: ['AML', 'Sanctions', 'Finansinspektionen', 'Compliance'],
    summary:
      'Swedish anti-money laundering and counter-terrorist financing law requiring comprehensive risk assessments, customer due diligence (CDD), politically exposed persons (PEP) checks, and suspicious activity reporting.',
    projectId: 'p3',
    parts: [
      {
        number: '2 kap. & 3 kap.',
        title: 'Allmän riskbedömning och kundkännedom',
        chapters: [
          {
            number: '2 kap.',
            title: 'Allmän riskbedömning och rutiner',
            sections: [
              {
                id: 'aml-2-1',
                number: '1 §',
                amendingAct: '',
                heading: 'Allmän riskbedömning (GRA)',
                text: 'En verksamhetsutövare ska göra en dokumenterad bedömning av hur de produkter och tjänster som tillhandahålls kan utnyttjas för penningtvätt eller finansiering av terrorism (allmän riskbedömning).',
                plainEnglish: {
                  summary:
                    'Firms must document an annual enterprise-wide risk assessment evaluating how their products and client channels could be exploited for money laundering.',
                  points: [
                    'Annual update: Must be updated at least annually or when introducing new products.',
                    'Risk appetite: Drives onboarding controls and customer due diligence depth.',
                  ],
                },
                textEn:
                  'An operator shall conduct a documented assessment of how products and services could be exploited for money laundering or terrorist financing.',
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
                amendingAct: '',
                heading: 'Skärpta åtgärder vid hög risk och PEP',
                text: 'Om risken för penningtvätt bedöms som hög, ska verksamhetsutövaren vidta skärpta åtgärder för kundkännedom och realtidssanktionskontroll.',
                plainEnglish: {
                  summary:
                    'Higher-risk clients and Politically Exposed Persons (PEPs) require senior management sign-off, source of wealth verification, and continuous screening.',
                  points: [
                    'PEP screening: Check prospective clients and beneficial owners against global sanctions and PEP lists.',
                    'Source of wealth: Verify origin of funds for private banking and high-value transactions.',
                  ],
                },
                textEn:
                  'If the risk of money laundering is assessed as high, the operator must take enhanced customer due diligence and real-time sanctions screening measures.',
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
    amendedBy: '',
    tags: ['Funds', 'AIFM', 'Valuation', 'Finansinspektionen'],
    summary:
      'Finansinspektionen regulatory code governing alternative investment fund managers, valuation independence, risk liquidity metrics, and Annex IV supervisory filings.',
    projectId: 'p4',
    parts: [
      {
        number: '13 & 14 kap.',
        title: 'Värdering och rapportering',
        chapters: [
          {
            number: '13 kap.',
            title: 'Värdering av fondtillgångar',
            sections: [
              {
                id: 'aifm-13-1',
                number: '1 §',
                amendingAct: '',
                heading: 'Oberoende värderingsfunktion',
                text: 'En AIF-förvaltare ska säkerställa att värderingsfunktionen är organisatoriskt och funktionellt oberoende från portföljförvaltningen och ersättningssystemen.',
                plainEnglish: {
                  summary:
                    'Asset valuation functions must be completely separated from portfolio managers so managers cannot inflate portfolio performance or bonuses.',
                  points: [
                    'Independent function: Valuers report directly to the board or an independent risk committee.',
                    'Remuneration firewall: Valuers bonuses must not depend on fund return performance.',
                  ],
                },
                textEn:
                  'An AIFM must ensure that asset valuation is organizationally and functionally independent from portfolio management and remuneration systems.',
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
                amendingAct: '',
                heading: 'Regelbunden rapportering till FI',
                text: 'AIF-förvaltare ska kvartalsvis lämna uppgifter om de viktigaste marknader och instrument som förvaltaren handlar i samt fondens hävstångsnivåer i föreskrivet XML-format.',
                plainEnglish: {
                  summary: 'AIFMs must submit quarterly Annex IV electronic filings detailing fund leverage, portfolio composition, and counterparty risks.',
                  points: [
                    'Quarterly filing: XML file uploaded directly to Finansinspektionen reporting portal.',
                    'Leverage reporting: Gross method and commitment method calculations.',
                  ],
                },
                textEn: 'AIFMs must report quarterly on principal markets, traded instruments, and fund leverage in designated XML format.',
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
    ],
  },
  {
    id: 'reg-mifid',
    code: 'Directive 2014/65/EU (MiFID II)',
    title: 'Markets in Financial Instruments Directive & RTS 28',
    shortTitle: 'MiFID II & RTS 28',
    jurisdiction: 'European Union',
    authority: 'ESMA / Finansinspektionen / FIN-FSA',
    type: 'eu_directive',
    inForce: '2018-01-03',
    status: 'In force',
    amendedBy: '',
    tags: ['MiFID', 'BestExecution', 'Conduct', 'EU'],
    summary:
      'EU regulatory framework governing investment firms, trading venues, order execution quality, investor protection suitability assessments, and annual RTS 28 disclosures.',
    projectId: 'p5',
    parts: [
      {
        number: 'Title II',
        title: 'Operating Conditions for Investment Firms',
        chapters: [
          {
            number: 'Title II',
            title: 'Operating Conditions',
            sections: [
              {
                id: 'mifid-art-24',
                number: 'Article 24',
                amendingAct: '',
                heading: 'General principles and information to clients',
                text: 'An investment firm shall act honestly, fairly and professionally in accordance with the best interests of its clients and comply with product governance requirements.',
                plainEnglish: {
                  summary: 'Firms must always act in clients best interests, ensure product suitability, and ban hidden inducements/kickbacks.',
                  points: [
                    'Target market definition: Only distribute complex financial products to approved client archetypes.',
                    'Inducements ban: Cannot accept commissions from third parties that impair duty to clients.',
                  ],
                },
                textEn: 'An investment firm shall act honestly, fairly and professionally in the best interests of clients and comply with product governance.',
                crossRefs: [{ regId: 'reg-aml', label: 'SFS 2017:630 3 kap. 4 §' }],
                tags: ['Conduct', 'Suitability', 'POG'],
                taskId: 't18',
                taskKey: 'POG §9',
                status: 'UNCHANGED',
              },
              {
                id: 'mifid-art-27',
                number: 'Article 27',
                amendingAct: '',
                heading: 'Obligation to execute orders on terms most favourable to the client',
                text: 'Investment firms shall take all sufficient steps to obtain, when executing orders, the best possible result for their clients and publish annually the top five execution venues (RTS 28).',
                plainEnglish: {
                  summary:
                    'Best execution duty: Firms must ensure trades achieve the best possible total price (including costs, speed, and likelihood of execution).',
                  points: [
                    'Execution factors: Price, costs, speed, and market impact.',
                    'RTS 28 reporting: Must publish top 5 trading brokers/venues annually on website.',
                  ],
                },
                textEn:
                  'Investment firms shall take all sufficient steps to obtain the best possible result for clients and publish top five execution venues annually.',
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
    amendedBy: '',
    tags: ['ESG', 'SFDR', 'Taxonomy', 'Disclosures', 'EU'],
    summary:
      'Mandatory ESG transparency and sustainability disclosure regime requiring financial market participants to publish Principal Adverse Impact (PAI) statements and classify Article 8 and Article 9 funds.',
    projectId: 'p6',
    parts: [
      {
        number: 'Chapter I',
        title: 'Transparency and Sustainability Disclosures',
        chapters: [
          {
            number: 'Chapter I',
            title: 'Transparency Requirements',
            sections: [
              {
                id: 'sfdr-art-4',
                number: 'Article 4',
                amendingAct: '',
                heading: 'Transparency of adverse sustainability impacts at entity level',
                text: 'Financial market participants shall publish and maintain on their websites a statement on their due diligence policies with respect to the principal adverse impacts of investment decisions on sustainability factors (PAI statement).',
                plainEnglish: {
                  summary:
                    'Firms must disclose how their investment decisions harm sustainability factors (e.g., carbon footprint, water usage, human rights violations).',
                  points: [
                    'PAI statement: Mandatory website report detailing 14 core sustainability indicators.',
                    'Comply or explain: Large firms with >500 employees must comply without exemption.',
                  ],
                },
                textEn:
                  'Financial market participants shall publish on their websites a statement on due diligence policies regarding principal adverse impacts on sustainability factors.',
                crossRefs: [],
                tags: ['PAI', 'ESG', 'Disclosures'],
                taskId: 't19',
                taskKey: 'SFDR §14',
                status: 'UNCHANGED',
              },
              {
                id: 'sfdr-art-9',
                number: 'Article 9',
                amendingAct: '',
                heading: 'Transparency of sustainable investments in pre-contractual disclosures',
                text: 'Where a financial product has sustainable investment as its objective, the information to be disclosed shall specify how the environmental or social objective is attained and verify alignment with the EU Green Taxonomy Regulation (2020/852).',
                plainEnglish: {
                  summary: 'Dark green (Article 9) funds must have 100% sustainable investment objectives and prove alignment with EU Taxonomy criteria.',
                  points: [
                    'Do No Significant Harm (DNSH): Sustainable assets must not harm any other environmental objective.',
                    'Good governance check: Investee companies must respect labor standards and tax compliance.',
                  ],
                },
                textEn:
                  'Where a financial product has sustainable investment as its objective, pre-contractual disclosures must specify how the objective is attained and verify taxonomy alignment.',
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
    ],
  },
];

export const REGULATIONS = [...BASE_REGULATIONS, ...swedishRegs];

let _sectionIndex = null;
let _regIndex = null;

function ensureIndexes() {
  if (_sectionIndex) return;
  _sectionIndex = new Map();
  _regIndex = new Map();
  for (const reg of REGULATIONS) {
    if (reg.id) _regIndex.set(reg.id, reg);
    if (reg.code && !_regIndex.has(reg.code)) _regIndex.set(reg.code, reg);
    for (const sec of allSectionsOf(reg)) {
      if (sec.id) {
        _sectionIndex.set(sec.id, { section: sec, regulation: reg });
      }
    }
  }
}

export function allRegulations() {
  return REGULATIONS;
}

export function regulation(id) {
  if (!id) return null;
  ensureIndexes();
  return _regIndex.get(id) || null;
}

export function findSectionAndRegulation(secId) {
  if (!secId) return null;
  ensureIndexes();
  return _sectionIndex.get(secId) || null;
}

export function allChaptersOf(reg) {
  if (!reg) return [];
  const chapters = [];
  if (reg.parts && reg.parts.length) {
    reg.parts.forEach(p => {
      (p.chapters || []).forEach(ch => {
        chapters.push({ ...ch, partTitle: p.title, partNumber: p.number });
      });
    });
  } else if (reg.chapters && reg.chapters.length) {
    reg.chapters.forEach(ch => chapters.push(ch));
  }
  return chapters;
}

export function allSectionsOf(reg) {
  if (!reg) return [];
  const secs = [];
  allChaptersOf(reg).forEach(ch => {
    (ch.sections || []).forEach(s => secs.push({ ...s, chapterNumber: ch.number, chapterTitle: ch.title }));
  });
  return secs;
}

export function allTags() {
  const set = new Set();
  REGULATIONS.forEach(r => {
    (r.tags || []).forEach(t => set.add(t));
    allSectionsOf(r).forEach(s => {
      (s.tags || []).forEach(t => set.add(t));
    });
  });
  return Array.from(set).sort();
}

export function getRegulationYear(r) {
  if (!r) return 0;
  if (r.inForce) {
    const m = r.inForce.match(/(\d{4})/);
    if (m) return parseInt(m[1], 10);
  }
  if (r.code) {
    const m = r.code.match(/(\d{4})/);
    if (m) return parseInt(m[1], 10);
  }
  return 0;
}

export function getRegulationDomain(r) {
  if (!r) return 'general';
  const text = `${r.title || ''} ${r.shortTitle || ''} ${r.summary || ''} ${(r.tags || []).join(' ')}`.toLowerCase();
  if (/penningtvätt|terroristfinansiering|\baml\b|sanction|fiu|penningtvatt/.test(text)) return 'aml';
  if (/dora|resilience|cyber|it-drift|informationssäkerhet|it-system|molntjänst|ict\b/.test(text)) return 'ict';
  if (/hållbar|sfdr|taxonomy|esg|klimat|miljö/.test(text)) return 'esg';
  if (/\bfond|\baifm\b|\baif\b|ucits|värdepappersfond|kapitalförvaltning|investeringsfond/.test(text)) return 'funds';
  if (
    /värdepapper|mifid|börs|\bhandel\b|marknadsmissbruk|clearing|derivat|aktier|prospekt|short selling|finansiella instrument|fondkommission|algorithmic/.test(
      text,
    )
  )
    return 'securities';
  if (/\bbank\b|kredit|kapitaltäckning|inlåning|utlåning|bolån|insättningsgaranti|resolution|\bcrd\b|\bcrr\b|likviditet/.test(text)) return 'banking';
  if (/försäkring|pension|tjänstepension|solvens|livförsäkring|skadeförsäkring/.test(text)) return 'insurance';
  if (/betalning|betaltjänst|\bpsd\b|elektroniska pengar|e-pengar/.test(text)) return 'payments';
  return 'general';
}

export function getRegulationTier(r) {
  if (!r) return 'other';
  const t = r.type || '';
  const code = r.code || '';
  const title = (r.title || '').toLowerCase();
  if (t === 'eu_regulation' || t === 'eu_directive' || /^regulation \(eu\)|^directive/i.test(code)) return 'eu';
  if (title.startsWith('förordning') || title.includes('förordning (')) return 'ordinance';
  if (t === 'national_act' || (code.startsWith('SFS') && !title.includes('förordning')) || /act\b/i.test(title) || title.startsWith('lag (')) return 'act';
  if (t === 'fsa_regulation' || code.startsWith('FFFS') || /määräys/i.test(title)) return 'supervisory';
  return 'other';
}

export function getRegulationAuthority(r) {
  if (!r) return 'other';
  const auth = (r.authority || '').toLowerCase();
  const jur = (r.jurisdiction || '').toLowerCase();
  if (auth.includes('finansinspektionen') || jur.includes('finansinspektionen') || (r.code && r.code.startsWith('FFFS'))) return 'fi';
  if (auth.includes('fin-fsa') || auth.includes('finanssivalvonta') || jur.includes('finland')) return 'fin-fsa';
  if (auth.includes('riksdagen') || jur.includes('riksdagen')) return 'riksdagen';
  if (auth.includes('european union') || jur.includes('european union') || auth.includes('esma') || auth.includes('eba')) return 'eu';
  return 'other';
}

export function isRegulationRepeal(r) {
  if (!r) return false;
  const text = `${r.title || ''} ${r.summary || ''}`.toLowerCase();
  return text.includes('upphävande av') || text.includes('upphäva ');
}

export const REGULATION_DOMAINS = [
  { id: 'all', label: 'All Sectors' },
  { id: 'securities', label: 'Securities & Markets' },
  { id: 'banking', label: 'Banking & Credit' },
  { id: 'funds', label: 'Funds & Asset Management' },
  { id: 'insurance', label: 'Insurance & Pensions' },
  { id: 'payments', label: 'Payments & FinTech' },
  { id: 'aml', label: 'Anti-Money Laundering (AML)' },
  { id: 'ict', label: 'ICT & Resilience (DORA)' },
  { id: 'esg', label: 'ESG & Sustainability' },
  { id: 'general', label: 'General / Cross-Sector' },
];

export const REGULATION_TIERS = [
  { id: 'all', label: 'All Legal Tiers' },
  { id: 'act', label: 'Parliamentary Acts' },
  { id: 'supervisory', label: 'Supervisory Regulations' },
  { id: 'ordinance', label: 'Government Ordinances' },
  { id: 'eu', label: 'EU Directives & Regulations' },
];

export const REGULATION_AUTHORITIES = [
  { id: 'all', label: 'All Authorities' },
  { id: 'fi', label: 'Finansinspektionen (FI)' },
  { id: 'fin-fsa', label: 'FIN-FSA (Finanssivalvonta)' },
  { id: 'riksdagen', label: 'Riksdagen / Government' },
  { id: 'eu', label: 'European Union (ESMA / EBA)' },
];

export const REGULATION_GOV_SCOPES = [
  { id: 'all', label: 'All Governance Scopes' },
  { id: 'controls', label: 'With Linked Controls' },
  { id: 'policies', label: 'With Linked Policies' },
  { id: 'any_gov', label: 'Any Governance Links' },
  { id: 'amended', label: 'Amended / Needs Review' },
];

export const REGULATION_STATUSES = [
  { id: 'all', label: 'All Rules' },
  { id: 'substantive', label: 'Substantive Rules Only' },
  { id: 'repeal', label: 'Repeal Notices Only' },
];

export const REGULATION_ERAS = [
  { id: 'all', label: 'All Eras (1991–2027)' },
  { id: '2020s', label: '2020–2027 (Current)' },
  { id: '2010s', label: '2010–2019' },
  { id: '2000s', label: '2000–2009' },
  { id: '1990s', label: '1990–1999 (Historical)' },
];

export const REGULATION_SORTS = [
  { id: 'relevance', label: 'Relevance & Governance' },
  { id: 'year_desc', label: 'Year: Newest First' },
  { id: 'year_asc', label: 'Year: Oldest First' },
  { id: 'title_asc', label: 'Title & Code (A–Z)' },
  { id: 'sections_desc', label: 'Most Sections First' },
];
