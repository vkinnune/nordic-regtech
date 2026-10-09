/* ---------- STATUTORY REGULATIONS DATA MODEL ---------- */
import swedishRegs from './swedish_regulations.json';

export const REGULATIONS = swedishRegs;

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
  const direct = _regIndex.get(id);
  if (direct) return direct;

  const low = String(id).toLowerCase().trim();
  for (const [k, v] of _regIndex.entries()) {
    if (k.toLowerCase() === low) return v;
  }
  if (low.startsWith('reg-')) {
    const stripped = low.replace(/^reg-/, '');
    for (const [k, v] of _regIndex.entries()) {
      if (k.toLowerCase() === stripped) return v;
    }
  } else {
    const prefixed = `reg-${low}`;
    for (const [k, v] of _regIndex.entries()) {
      if (k.toLowerCase() === prefixed) return v;
    }
  }
  return null;
}

export function resolveFrameworkToRegulation(fw) {
  if (!fw) return null;
  const f = String(fw).toLowerCase().trim();

  // Direct code or ID match
  const direct = regulation(fw);
  if (direct) return { regId: direct.id, view: 'reader' };

  // DORA (Digital Operational Resilience Act) -> transposed via SFS 2004:297 6 kap. 2 a §
  if (f.includes('dora') || f.includes('2022/2554')) {
    return { regId: 'sfs-2004-297', secId: 'riksdagen_sfs-2004-297_k6_p2a', view: 'reader' };
  }
  // AML / Anti-Money Laundering -> Swedish AML Act SFS 2017:630 3 kap. 1 §
  if (
    f.includes('aml') ||
    f.includes('penningtvatt') ||
    f.includes('money laundering') ||
    f.includes('2017:630') ||
    f.includes('rahanpesu') ||
    f.includes('444/2017')
  ) {
    return { regId: 'sfs-2017-630', secId: 'riksdagen_sfs-2017-630_k3_p1', view: 'reader' };
  }
  // Market Abuse / MAR -> Swedish Market Abuse Penal Act SFS 2016:1306 1 kap. 1 §
  if (f.includes('mar') || f.includes('market abuse') || f.includes('2016:1306') || f.includes('marknadsmissbruk')) {
    return { regId: 'sfs-2016-1306', secId: 'riksdagen_sfs-2016-1306_k1_p1', view: 'reader' };
  }
  // MiFID / Securities Market / Investment Services -> Swedish Securities Market Act SFS 2007:528 1 kap. 1 §
  if (
    f.includes('mifid') ||
    f.includes('mifir') ||
    f.includes('2007:528') ||
    f.includes('vardepappersmarknad') ||
    f.includes('investment services') ||
    f.includes('747/2012')
  ) {
    return { regId: 'sfs-2007-528', secId: 'riksdagen_sfs-2007-528_k1_p1', view: 'reader' };
  }
  // Funds / UCITS -> Swedish Investment Funds Act SFS 2004:46 1 kap. 1 §
  if (f.includes('ucits') || f.includes('2004:46') || f.includes('vardepappersfonder') || f.includes('investeringsfond')) {
    return { regId: 'sfs-2004-46', secId: 'riksdagen_sfs-2004-46_k1_p1', view: 'reader' };
  }
  // AIFMD -> Alternative Investment Fund Managers Act SFS 2013:561 1 kap. 1 §
  if (f.includes('aif') || f.includes('2013:561')) {
    return { regId: 'sfs-2013-561', secId: 'riksdagen_sfs-2013-561_k1_p1', view: 'reader' };
  }
  // Banking / Credit Institutions / CRD / CRR / Capital Requirements
  if (
    f.includes('2004:297') ||
    f.includes('bank- och finansiering') ||
    f.includes('kreditinstitut') ||
    f.includes('crd') ||
    f.includes('crr') ||
    f.includes('kapitaltackning') ||
    f.includes('consumer credit') ||
    f.includes('konsumentkredit')
  ) {
    return { regId: 'sfs-2004-297', secId: 'riksdagen_sfs-2004-297_k1_p1', view: 'reader' };
  }
  if (f.includes('2014:968')) {
    return { regId: 'sfs-2014-968', secId: 'riksdagen_sfs-2014-968_k1_p1', view: 'reader' };
  }
  // Payment Services / PSD2
  if (f.includes('payment') || f.includes('psd2') || f.includes('2010:751') || f.includes('betaltjanst')) {
    return { regId: 'sfs-2010-751', secId: 'riksdagen_sfs-2010-751_k1_p1', view: 'reader' };
  }
  // Insurance / Solvency II / IDD
  if (f.includes('solvens') || f.includes('solvency') || f.includes('2010:2043') || f.includes('forsakringsrorelse')) {
    return { regId: 'sfs-2010-2043', secId: 'riksdagen_sfs-2010-2043_k1_p1', view: 'reader' };
  }
  if (f.includes('idd') || f.includes('2018:1219') || f.includes('forsakringsdistribution')) {
    return { regId: 'sfs-2018-1219', secId: 'riksdagen_sfs-2018-1219_k1_p1', view: 'reader' };
  }
  if (f.includes('iorp') || f.includes('2019:742') || f.includes('tjanstepension')) {
    return { regId: 'sfs-2019-742', secId: 'riksdagen_sfs-2019-742_k1_p1', view: 'reader' };
  }
  // SFDR / Sustainability / ESG / Taxonomy -> SFS 2004:46 1 kap. 1 §
  if (
    f.includes('sfdr') ||
    f.includes('2019/2088') ||
    f.includes('taxonomy') ||
    f.includes('greenwashing') ||
    f.includes('sustainability') ||
    f.includes('hallbarhet')
  ) {
    return { regId: 'sfs-2004-46', secId: 'riksdagen_sfs-2004-46_k1_p1', view: 'reader' };
  }
  // FFFS regulation code matching (e.g. "FFFS 2014:12" or "FFFS 2019:21")
  const fffsMatch = f.match(/fffs\s*(\d{4}):(\d+)/i);
  if (fffsMatch) {
    const fffsId = `fffs-${fffsMatch[1]}-${fffsMatch[2]}`;
    const fffsReg = regulation(fffsId);
    if (fffsReg) return { regId: fffsReg.id, view: 'reader' };
  }
  // SFS statute matching (e.g. "SFS 2017:630" or "Lag 2004:46" or "2017:630")
  const sfsMatch = f.match(/sfs\s*(\d{4}):(\d+)/i) || f.match(/(\d{4}):(\d+)/);
  if (sfsMatch) {
    const sfsId = `sfs-${sfsMatch[1]}-${sfsMatch[2]}`;
    const sfsReg = regulation(sfsId) || regulation(`reg-${sfsId}`);
    if (sfsReg) return { regId: sfsReg.id, view: 'reader' };
  }

  // Fallback: search in library for this framework term
  return { query: fw, view: 'library' };
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
  if (title.startsWith('förordning') || title.includes('förordning (')) return 'ordinance';
  if (t === 'national_act' || (code.startsWith('SFS') && !title.includes('förordning')) || /act\b/i.test(title) || title.startsWith('lag (')) return 'act';
  if (t === 'fsa_regulation' || code.startsWith('FFFS')) return 'supervisory';
  return 'other';
}

export function getRegulationAuthority(r) {
  if (!r) return 'other';
  const auth = (r.authority || '').toLowerCase();
  const jur = (r.jurisdiction || '').toLowerCase();
  if (auth.includes('finansinspektionen') || jur.includes('finansinspektionen') || (r.code && r.code.startsWith('FFFS'))) return 'fi';
  if (auth.includes('riksdagen') || jur.includes('riksdagen') || (r.code && r.code.startsWith('SFS'))) return 'riksdagen';
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
  { id: 'act', label: 'Parliamentary Acts (SFS)' },
  { id: 'supervisory', label: 'Supervisory Regulations (FFFS)' },
  { id: 'ordinance', label: 'Government Ordinances' },
];

export const REGULATION_AUTHORITIES = [
  { id: 'all', label: 'All Authorities' },
  { id: 'fi', label: 'Finansinspektionen (FI)' },
  { id: 'riksdagen', label: 'Riksdagen / Parliament' },
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
