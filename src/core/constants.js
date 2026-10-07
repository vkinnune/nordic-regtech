/* ---------- vocab: Digia RegTech & Nordic Financial Compliance ---------- */
export const STATUSES = [
  { id: 'backlog', name: 'Horizon Alert' },
  { id: 'todo', name: 'Triage & RIA' },
  { id: 'progress', name: 'Policy & Redline' },
  { id: 'review', name: 'Legal & 2nd LoD' },
  { id: 'done', name: 'Audit Ready' },
];
export const ST = Object.fromEntries(STATUSES.map(s => [s.id, s]));
export const PRIOS = [
  { id: 'urgent', name: 'Tier 1 · Critical Sanction', w: 4 },
  { id: 'high', name: 'Tier 2 · High Risk / Capital', w: 3 },
  { id: 'medium', name: 'Tier 3 · Reporting & Ops', w: 2 },
  { id: 'low', name: 'Tier 4 · Informational', w: 1 },
  { id: 'none', name: 'Unrated', w: 0 },
];
export const PR = Object.fromEntries(PRIOS.map(p => [p.id, p]));
export const LABELS = [
  { id: 'dora', name: 'DORA · ICT Risk', c: 'var(--blue)' },
  { id: 'aml', name: 'AML / CFT & Sanctions', c: 'var(--red)' },
  { id: 'funds', name: 'Fund Ops & AIFM', c: 'var(--violet)' },
  { id: 'risk', name: 'Risk & Liquidity', c: 'var(--amber)' },
  { id: 'mifid', name: 'MiFID II & Conduct', c: 'var(--teal)' },
  { id: 'esg', name: 'SFDR & Green Taxonomy', c: 'var(--green)' },
  { id: 'fi', name: 'Finansinspektionen (FI)', c: 'var(--orange)' },
  { id: 'fiva', name: 'FIN-FSA (Fiva)', c: 'var(--rose)' },
];
export const LB = Object.fromEntries(LABELS.map(l => [l.id, l]));
export const PSTAT = {
  planning: { name: 'Consultation / Draft', c: 'var(--gray)' },
  active: { name: 'In Force / Monitoring', c: 'var(--blue)' },
  risk: { name: 'Audit Scrutiny', c: 'var(--red)' },
  hold: { name: 'Legislative Delay', c: 'var(--amber)' },
  complete: { name: 'Transposed & Audited', c: 'var(--green)' },
};
export const PCOLORS = {
  indigo: '#5A67D8',
  blue: '#3B82C4',
  violet: '#8662C9',
  teal: '#23918A',
  rose: '#C54B78',
  amber: '#C48A1E',
  green: '#3D8E5F',
  slate: '#6B7280',
};
export const PICONS = [
  'scale',
  'landmark',
  'shield-check',
  'book-open',
  'server',
  'briefcase',
  'lock',
  'leaf',
  'file-text',
  'globe',
  'component',
  'building-2',
  'target',
  'layers',
  'folder',
  'sparkles',
];
export const ROLES = ['Owner', 'Admin', 'Member', 'Guest'];
export const TEAMS_SEED = [
  {
    id: 'compliance',
    name: 'Regulatory Affairs & 2nd LoD',
    icon: 'shield-check',
    c: '#8662C9',
    desc: 'Regulatory horizon scanning, supervisory filings (FI/Fiva), and 2nd LoD oversight',
  },
  {
    id: 'risk',
    name: 'Operational Risk & Capital',
    icon: 'triangle-alert',
    c: '#C48A1E',
    desc: 'Risk matrices, scenario testing, liquidity stress tests, and capital adequacy',
  },
  {
    id: 'legal',
    name: 'Legal Counsel & Transposition',
    icon: 'scale',
    c: '#3B82C4',
    desc: 'Statutory interpretation, fund documentation, and supervisory liaison',
  },
  {
    id: 'it_security',
    name: 'ICT Resilience & DORA Ops',
    icon: 'server',
    c: '#23918A',
    desc: 'Digital operational resilience, major incident reporting, and third-party risk',
  },
  {
    id: 'funds',
    name: 'Fund Operations & Trading',
    icon: 'briefcase',
    c: '#C54B78',
    desc: 'Portfolio management, best execution, NAV calculations, and depositary oversight',
  },
];
