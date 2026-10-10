/* ---------- STATUTORY REGULATIONS DATA MODEL ---------- */
import swedishRegs from './swedish_regulations.json' with { type: 'json' };

export const REGULATIONS = swedishRegs;

let _sectionIndex = null;
let _regIndex = null;
let _regLowerIndex = null;

function ensureIndexes() {
  if (_sectionIndex) return;
  _sectionIndex = new Map();
  _regIndex = new Map();
  _regLowerIndex = new Map();
  for (const reg of REGULATIONS) {
    if (reg.id) {
      _regIndex.set(reg.id, reg);
      _regLowerIndex.set(reg.id.toLowerCase(), reg);
    }
    if (reg.code && !_regIndex.has(reg.code)) {
      _regIndex.set(reg.code, reg);
      _regLowerIndex.set(reg.code.toLowerCase(), reg);
    }
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
  const lowerMatch = _regLowerIndex.get(low);
  if (lowerMatch) return lowerMatch;

  if (low.startsWith('reg-')) {
    const stripped = low.replace(/^reg-/, '');
    return _regLowerIndex.get(stripped) || null;
  }
  return _regLowerIndex.get(`reg-${low}`) || null;
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

export const REGULATION_STATUSES = [
  { id: 'all', label: 'All Rules' },
  { id: 'substantive', label: 'Substantive Rules Only' },
  { id: 'amended', label: 'Amended Statutes' },
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
  { id: 'relevance', label: 'Relevance' },
  { id: 'year_desc', label: 'Year: Newest First' },
  { id: 'year_asc', label: 'Year: Oldest First' },
  { id: 'title_asc', label: 'Title & Code (A–Z)' },
  { id: 'sections_desc', label: 'Most Sections First' },
];
