/* ---------- store ---------- */
import { TODAY, diffD, iso, parse, uid } from './utils.js';
import { PCOLORS, TEAMS_SEED } from './constants.js';
import { seed } from '../data/seed.js';

export const STORE_KEY = 'regtech.studio.v7';
export const DEFAULT_PREFS = {
  theme: 'system',
  accent: 'indigo',
  side: 'comfortable',
  density: 'comfortable',
  weekStart: 1,
  dateFmt: 'MMM d',
  lang: 'English (Nordic / US)',
  tz: 'Europe/Helsinki',
  motion: 'system',
  home: 'home',
  openTasks: 'drawer',
  name: 'Workspace Owner',
  title: 'Lead Solutions Architect · RegTech',
};
export function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const j = JSON.parse(raw);
      if (j && j.data && j.data.tasks) return j;
    }
  } catch {
    /* storage blocked or corrupt: start from seed data */
  }
  return null;
}
export const saved = load();
export const S = {
  data: saved?.data || seed(),
  prefs: Object.assign({}, DEFAULT_PREFS, saved?.prefs || {}),
  views: saved?.views || {},
  ui: {
    fx: {},
    auth: null,
    authStep: 'login',
    onb: 0,
    onbData: { use: 'product', team: 'kanban', size: '2-10', ws: '', proj: 'Website Launch', tmpl: 'web', invites: '' },
    route: 'home',
    params: {},
    history: [],
    collapsed: !!saved?.collapsed,
    mnav: false,
    expanded: { p1: true },
    drawer: null,
    drawerFull: false,
    drawerTab: 'comments',
    modals: [],
    pop: null,
    palette: null,
    loading: false,
    offline: false,
    sel: new Set(),
    composer: null,
    editCell: null,
    openTasks: {},
    collapsedGroups: {},
    calDate: iso(TODAY),
    calMode: 'month',
    tlZoom: 'week',
    tlGroup: 'status',
    fileView: 'grid',
    projView: 'grid',
    homeTab: 'upcoming',
    inboxCat: 'all',
    inboxUnread: false,
    inboxSel: null,
    notifFilter: 'all',
    settings: 'appearance',
    searchQ: '',
    searchCat: 'all',
    myView: 'list',
    membersTab: 'members',
    collapsedCols: {},
    errors: {},
    drafts: {},
  },
};
export let _saveT;
export function save() {
  clearTimeout(_saveT);
  _saveT = setTimeout(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ data: S.data, prefs: S.prefs, views: S.views, collapsed: S.ui.collapsed }));
    } catch {
      /* storage full or blocked: keep working in memory */
    }
  }, 150);
}

/* ---------- lookups ---------- */
export const D = () => S.data;
export const me = () => D().members.find(m => m.id === D().me);
export const mem = id => D().members.find(m => m.id === id);
export const proj = id => D().projects.find(p => p.id === id);
export const task = id => D().tasks.find(t => t.id === id);
export const pColor = p => PCOLORS[p?.color] || PCOLORS.slate;
export const visibleProjects = () =>
  D()
    .projOrder.map(proj)
    .filter(Boolean)
    .filter(p => !p.archived);
export const canSee = p => !p.private || p.members.includes(D().me);
export const tasksOf = pid => D().tasks.filter(t => t.project === pid && !t.archived);
export const allTasks = () => D().tasks.filter(t => !t.archived && canSee(proj(t.project)));
export const isOver = t => t.due && t.status !== 'done' && diffD(parse(t.due), TODAY) < 0;
export const commentsOf = tid => D().comments.filter(c => c.task === tid);
export function progressOf(pid) {
  const ts = tasksOf(pid);
  if (!ts.length) return 0;
  return Math.round((ts.filter(t => t.status === 'done').length / ts.length) * 100);
}
export function taskProg(t) {
  if (t.status === 'done') return 100;
  if (t.subtasks.length) return Math.round((t.subtasks.filter(s => s.done).length / t.subtasks.length) * 100);
  return { backlog: 0, todo: 5, progress: 45, review: 80 }[t.status] || 0;
}

/* ---------- activity + notification helpers ---------- */
export function logAct(verb, t, extra = '') {
  D().activity.unshift({ id: uid('a'), by: D().me, verb, task: t?.id || null, project: t?.project || null, at: Date.now(), extra });
  if (t) t.updated = Date.now();
}

/* ---------- teams (workspace data, seeded on first use) ---------- */
export const NO_TEAM = { id: '', name: 'No team', icon: 'users', c: '#8A867E', desc: '' };
export function teamsList() {
  const d = D();
  if (!d.teams) d.teams = TEAMS_SEED.map(t => ({ ...t }));
  return d.teams;
}
export function team(id) {
  return teamsList().find(t => t.id === id) || null;
}
export const TM = new Proxy({}, { get: (_, k) => team(k) || NO_TEAM });

/* ---------- statutory regulations lookups ---------- */
import {
  REGULATIONS,
  allRegulations,
  regulation,
  allChaptersOf,
  allSectionsOf,
  allTags,
  findSectionAndRegulation,
  getRegulationYear,
  getRegulationDomain,
  getRegulationTier,
  getRegulationAuthority,
  isRegulationRepeal,
  REGULATION_DOMAINS,
  REGULATION_TIERS,
  REGULATION_AUTHORITIES,
  REGULATION_GOV_SCOPES,
  REGULATION_STATUSES,
  REGULATION_ERAS,
  REGULATION_SORTS,
} from '../data/regulations.js';
export {
  REGULATIONS,
  allRegulations,
  regulation,
  allChaptersOf,
  allSectionsOf,
  allTags,
  findSectionAndRegulation,
  getRegulationYear,
  getRegulationDomain,
  getRegulationTier,
  getRegulationAuthority,
  isRegulationRepeal,
  REGULATION_DOMAINS,
  REGULATION_TIERS,
  REGULATION_AUTHORITIES,
  REGULATION_GOV_SCOPES,
  REGULATION_STATUSES,
  REGULATION_ERAS,
  REGULATION_SORTS,
};

/* ---------- statutory governance (policies, controls, risks) ---------- */
export { POLICIES, CONTROLS, RISKS } from '../data/governance.js';

export function allPolicies() {
  return D().policies || [];
}
export function policy(id) {
  return allPolicies().find(p => p.id === id || p.code === id) || null;
}

export function allControls() {
  return D().controls || [];
}
export function control(id) {
  return allControls().find(c => c.id === id || c.code === id) || null;
}

export function allRisks() {
  return D().risks || [];
}
export function risk(id) {
  return allRisks().find(r => r.id === id || r.code === id) || null;
}

export function sectionOf(secId) {
  return findSectionAndRegulation(secId)?.section || null;
}

export function isSectionAmended(sec) {
  if (!sec) return false;
  return sec.status === 'MODIFIED' || sec.status === 'ADDED';
}

export function isControlImpacted(c) {
  if (!c) return false;
  if (c.status === 'DEFICIENT') return true;
  if (c.impactedByAmendment && !c.signedOffAt) return true;
  const sections = c.statuteSections || [];
  return sections.some(secId => {
    const sec = sectionOf(secId);
    return isSectionAmended(sec) && !c.signedOffAt;
  });
}

export function isPolicyImpacted(p) {
  if (!p) return false;
  if (p.status === 'NEEDS_REVIEW') return true;
  if (p.impactedByAmendment && !p.reviewedAt) return true;
  const sections = p.statuteSections || [];
  return sections.some(secId => {
    const sec = sectionOf(secId);
    return isSectionAmended(sec) && !p.reviewedAt;
  });
}

export function policiesForSection(secId) {
  return allPolicies().filter(p => p.statuteSections && p.statuteSections.includes(secId));
}

export function policiesNeedingReviewForSection(secId) {
  return policiesForSection(secId).filter(isPolicyImpacted);
}

export function controlsForSection(secId) {
  return allControls().filter(c => c.statuteSections && c.statuteSections.includes(secId));
}

export function risksForSection(secId) {
  return allRisks().filter(r => r.statuteSections && r.statuteSections.includes(secId));
}

export function impactedControlsForSection(secId) {
  return controlsForSection(secId).filter(isControlImpacted);
}

export function riskControls(r) {
  if (!r) return [];
  const ids = r.controlIds || [];
  return allControls().filter(c => ids.includes(c.id) || c.riskId === r.id);
}

export function riskGapStatus(r) {
  const ctls = riskControls(r);
  if (!ctls.length) return r.gapStatus || 'AT_RISK';
  const hasGaps = ctls.some(isControlImpacted);
  return hasGaps ? 'OPEN_GAPS' : 'COVERED';
}

export function riskExposureScore(r) {
  const base = r.exposureScore || 70;
  const status = riskGapStatus(r);
  if (status === 'COVERED') return Math.max(10, Math.round(base * 0.35));
  return base;
}

export function regulationOfSection(secId) {
  return findSectionAndRegulation(secId)?.regulation || null;
}

/* ---------- regulatory monitoring feed ---------- */
export { FEED_ITEMS, FEED_CATEGORIES, FEED_AUTHORITIES } from '../data/feed.js';
import { FEED_ITEMS } from '../data/feed.js';

export function allFeedItems() {
  if (!D().feed || !D().feed.length) {
    D().feed = FEED_ITEMS.map(f => ({ ...f }));
  }
  return D().feed;
}

export function feedItem(id) {
  return allFeedItems().find(f => f.id === id) || null;
}
