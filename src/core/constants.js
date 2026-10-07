/* ---------- vocab: Nordic Financial Compliance ---------- */
export const STATUSES = [
  { id: 'backlog', name: 'Backlog' },
  { id: 'todo', name: 'To do' },
  { id: 'progress', name: 'In progress' },
  { id: 'review', name: 'In review' },
  { id: 'done', name: 'Done' },
];
export const ST = Object.fromEntries(STATUSES.map(s => [s.id, s]));
export const PRIOS = [
  { id: 'urgent', name: 'Urgent', w: 4 },
  { id: 'high', name: 'High', w: 3 },
  { id: 'medium', name: 'Medium', w: 2 },
  { id: 'low', name: 'Low', w: 1 },
  { id: 'none', name: 'None', w: 0 },
];
export const PR = Object.fromEntries(PRIOS.map(p => [p.id, p]));
export const LABELS = [
  { id: 'dora', name: 'DORA', c: 'var(--blue)' },
  { id: 'aml', name: 'AML / Sanctions', c: 'var(--red)' },
  { id: 'funds', name: 'Funds & UCITS', c: 'var(--violet)' },
  { id: 'risk', name: 'Risk & Liquidity', c: 'var(--amber)' },
  { id: 'mifid', name: 'MiFID II', c: 'var(--teal)' },
  { id: 'esg', name: 'ESG & SFDR', c: 'var(--green)' },
  { id: 'fi', name: 'Finansinspektionen', c: 'var(--orange)' },
  { id: 'fiva', name: 'FIN-FSA', c: 'var(--rose)' },
];
export const LB = Object.fromEntries(LABELS.map(l => [l.id, l]));
export const PSTAT = {
  planning: { name: 'Planning', c: 'var(--gray)' },
  active: { name: 'Active', c: 'var(--blue)' },
  risk: { name: 'At risk', c: 'var(--red)' },
  hold: { name: 'On hold', c: 'var(--amber)' },
  complete: { name: 'Complete', c: 'var(--green)' },
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
    name: 'Compliance',
    icon: 'shield-check',
    c: '#8662C9',
    desc: 'Compliance and regulatory oversight',
  },
  {
    id: 'risk',
    name: 'Risk',
    icon: 'triangle-alert',
    c: '#C48A1E',
    desc: 'Risk management and internal controls',
  },
  {
    id: 'legal',
    name: 'Legal',
    icon: 'scale',
    c: '#3B82C4',
    desc: 'Legal counsel and contracts',
  },
  {
    id: 'it_security',
    name: 'Security & IT',
    icon: 'server',
    c: '#23918A',
    desc: 'IT security and operational resilience',
  },
  {
    id: 'funds',
    name: 'Fund Operations',
    icon: 'briefcase',
    c: '#C54B78',
    desc: 'Fund administration and trading',
  },
];
