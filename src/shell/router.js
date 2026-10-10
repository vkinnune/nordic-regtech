/* =====================================================================
   ROUTER: client-side hash routing, parsing, serialization, and history sync
   ===================================================================== */
import { S } from '../core/store.js';

export const AUTH_SCREENS = ['login', 'signup', 'forgot', 'forgot-sent', 'reset', 'reset-done', 'verify', 'onboarding'];

export const ROUTE_NAMES = {
  home: 'Home',
  inbox: 'Inbox',
  mytasks: 'Assigned',
  favorites: 'Favorites',
  notifications: 'Notifications',
  search: 'Search',
  overview: 'Overview',
  regulations: 'Regulations',
  changes: 'Changes',
  policies: 'Policies',
  controls: 'Controls',
  risks: 'Risks',
  projects: 'Projects',
  project: 'Project',
  tasks: 'Tasks',
  calendar: 'Calendar',
  timeline: 'Timeline',
  members: 'Team',
  member: 'Member',
  teams: 'Teams',
  team: 'Team',
  activity: 'Activity',
  settings: 'Settings',
  system: 'Design system',
  states: 'System states',
  archive: 'Archive',
};

export const SINGULAR_ROUTE_MAP = {
  policy: 'policies',
  control: 'controls',
  risk: 'risks',
  task: 'tasks',
  favorite: 'favorites',
  notification: 'notifications',
};

export function safeDecode(str) {
  try {
    return decodeURIComponent(str);
  } catch {
    return str;
  }
}

export function safeReplaceHash(hash) {
  if (typeof window === 'undefined') return;
  try {
    if (window.history && typeof window.history.replaceState === 'function') {
      window.history.replaceState(null, '', hash);
      return;
    }
  } catch {
    // replaceState can throw SecurityError in sandboxed iframes or cross-origin contexts
  }
  try {
    if (window.location) {
      window.location.hash = hash;
    }
  } catch {
    // safe fallback if location.hash is also restricted
  }
}

export function normalizeHash(hash) {
  if (typeof hash !== 'string') return '';
  let str = hash.trim();
  while (str.startsWith('#') || str.startsWith('!')) str = str.slice(1);
  while (str.startsWith('/')) str = str.slice(1);
  const qIdx = str.indexOf('?');
  if (qIdx !== -1) str = str.slice(0, qIdx);
  const hIdx = str.indexOf('#');
  if (hIdx !== -1) str = str.slice(0, hIdx);
  while (str.endsWith('/')) str = str.slice(0, -1);
  return str;
}

export function hashToRoute(hash, options = {}) {
  const defaultHome = options.defaultHome || (typeof S !== 'undefined' && S.prefs?.home) || 'home';
  const defaultTab = options.defaultTab || (typeof S !== 'undefined' && S.prefs?.defaultTab) || 'board';

  const clean = normalizeHash(hash);
  if (!clean) {
    return { route: defaultHome, params: {}, auth: null };
  }

  const parts = clean.split('/').map(safeDecode).filter(Boolean);
  if (!parts.length) {
    return { route: defaultHome, params: {}, auth: null };
  }

  const p0 = parts[0].toLowerCase();

  // Auth routes: #/auth/:screen or shorthand #/login, #/signup, etc.
  if (p0 === 'auth') {
    if (parts.length > 2) {
      return { route: '404', params: { path: clean }, auth: null };
    }
    const screen = parts[1] ? parts[1].toLowerCase() : 'login';
    const validScreen = AUTH_SCREENS.includes(screen) ? screen : 'login';
    return { route: defaultHome, params: {}, auth: validScreen };
  }
  if (parts.length === 1 && AUTH_SCREENS.includes(p0)) {
    return { route: defaultHome, params: {}, auth: p0 };
  }

  // Project parameterized route: #/project/:id/:tab? or #/projects/:id/:tab?
  if (p0 === 'project' || p0 === 'projects') {
    if (parts.length > 3) {
      return { route: '404', params: { path: clean }, auth: null };
    }
    if (parts[1]) {
      const id = parts[1];
      const tab = parts[2] ? (parts[2].startsWith('v:') ? parts[2] : parts[2].toLowerCase()) : defaultTab;
      return { route: 'project', params: { id, tab }, auth: null };
    }
    return { route: 'projects', params: {}, auth: null };
  }

  // Member parameterized route: #/member/:id or #/members/:id
  if (p0 === 'member' || p0 === 'members') {
    if (parts.length > 2) {
      return { route: '404', params: { path: clean }, auth: null };
    }
    if (parts[1]) {
      return { route: 'member', params: { id: parts[1] }, auth: null };
    }
    return { route: 'members', params: {}, auth: null };
  }

  // Team parameterized route: #/team/:id or #/teams/:id
  if (p0 === 'team' || p0 === 'teams') {
    if (parts.length > 2) {
      return { route: '404', params: { path: clean }, auth: null };
    }
    if (parts[1]) {
      return { route: 'team', params: { id: parts[1] }, auth: null };
    }
    return { route: 'teams', params: {}, auth: null };
  }

  // Settings route: #/settings or #/settings/:sec
  if (p0 === 'settings') {
    if (parts.length > 2) {
      return { route: '404', params: { path: clean }, auth: null };
    }
    if (parts[1]) {
      return { route: 'settings', params: { sec: parts[1].toLowerCase() }, auth: null };
    }
    return { route: 'settings', params: {}, auth: null };
  }

  // Regulations route: #/regulations, #/regulation, #/regulations/:id, #/regulations/:id/:sec, #/regulations/:id/:sec/diff
  if (p0 === 'regulations' || p0 === 'regulation') {
    if (parts.length > 4) {
      return { route: '404', params: { path: clean }, auth: null };
    }
    if (parts[1]) {
      const params = { id: parts[1] };
      if (parts[2]) params.sec = parts[2];
      if (parts[3]) {
        if (parts[3].toLowerCase() === 'diff') {
          params.diff = true;
        } else {
          return { route: '404', params: { path: clean }, auth: null };
        }
      }
      return { route: 'regulations', params, auth: null };
    }
    return { route: 'regulations', params: {}, auth: null };
  }

  // Singular convenience aliases for flat sidebar routes
  if (parts.length === 1 && SINGULAR_ROUTE_MAP[p0]) {
    return { route: SINGULAR_ROUTE_MAP[p0], params: {}, auth: null };
  }
  if (parts.length === 1 && (p0 === 'feed' || p0 === 'change')) {
    return { route: 'changes', params: {}, auth: null };
  }

  // Known route names: reject unexpected deep paths on unparameterized routes
  if (ROUTE_NAMES[p0]) {
    if (parts.length === 1) {
      return { route: p0, params: {}, auth: null };
    }
    return { route: '404', params: { path: clean }, auth: null };
  }

  // Unknown / unmapped route defaults gracefully to 404
  return { route: '404', params: { path: clean }, auth: null };
}

export const parseHash = hashToRoute;

export function routeToHash(state = null, options = {}) {
  const defaultTab = options.defaultTab || (typeof S !== 'undefined' && S.prefs?.defaultTab) || 'board';
  const defaultHome = options.defaultHome || (typeof S !== 'undefined' && S.prefs?.home) || 'home';

  const s =
    state ||
    (typeof S !== 'undefined'
      ? {
          route: S.ui?.route,
          params: S.ui?.params,
          auth: S.ui?.auth,
        }
      : { route: defaultHome, params: {}, auth: null });

  if (s.auth) {
    return `#/auth/${encodeURIComponent(s.auth)}`;
  }

  const r = (s.route || defaultHome).toLowerCase();

  if (r === 'project' || (r === 'projects' && s.params?.id)) {
    if (s.params?.id) {
      const id = encodeURIComponent(s.params.id);
      const tab = encodeURIComponent(s.params.tab || defaultTab);
      return `#/project/${id}/${tab}`;
    }
    return '#/projects';
  }

  if (r === 'member' || (r === 'members' && s.params?.id)) {
    if (s.params?.id) {
      return `#/member/${encodeURIComponent(s.params.id)}`;
    }
    return '#/members';
  }

  if (r === 'team' || (r === 'teams' && s.params?.id)) {
    if (s.params?.id) {
      return `#/team/${encodeURIComponent(s.params.id)}`;
    }
    return '#/teams';
  }

  if (r === 'settings') {
    if (s.params?.sec) {
      return `#/settings/${encodeURIComponent(s.params.sec)}`;
    }
    return '#/settings';
  }

  if (r === 'regulations' || r === 'regulation') {
    if (s.params?.id && s.params?.sec) {
      const diffSuffix = s.params?.diff ? '/diff' : '';
      return `#/regulations/${encodeURIComponent(s.params.id)}/${encodeURIComponent(s.params.sec)}${diffSuffix}`;
    }
    if (s.params?.id) {
      return `#/regulations/${encodeURIComponent(s.params.id)}`;
    }
    return '#/regulations';
  }

  // Canonicalize singular flat aliases to their plural routes
  if (SINGULAR_ROUTE_MAP[r]) {
    return `#/${SINGULAR_ROUTE_MAP[r]}`;
  }

  if (ROUTE_NAMES[r]) {
    return `#/${r}`;
  }

  if (r === '404') {
    return '#/404';
  }

  return `#/${encodeURIComponent(r)}`;
}

export const formatHash = routeToHash;

export function applyRoute(target, opt = {}) {
  if (!target || typeof S === 'undefined') return;

  if (target.auth) {
    const sameAuth = S.ui.auth === target.auth;
    S.ui.auth = target.auth;
    S.ui.errors = {};
    S.ui.pop = null;
    S.ui.palette = null;
    S.ui.subOpen = null;
    delete S.ui.govDrawer;
    if (!sameAuth && S.ui.fx) S.ui.fx[target.auth === 'onboarding' ? 'step' : 'auth'] = true;
  } else {
    if (target.route === 'project' && !target.params?.tab) {
      target.params = { ...target.params, tab: (typeof S !== 'undefined' && S.prefs?.defaultTab) || 'board' };
    }
    const prevRoute = S.ui.route;
    const prevParams = S.ui.params || {};
    const same = prevRoute === target.route && JSON.stringify(prevParams) === JSON.stringify(target.params) && S.ui.auth === null;
    const tabOnly = opt.tab || (target.route === 'project' && prevRoute === 'project' && prevParams.id === target.params?.id);

    S.ui.auth = null;
    S.ui.route = target.route;
    S.ui.params = target.params || {};

    if (target.route === 'regulations' || target.route === 'regulation') {
      if (target.params?.id) {
        S.ui.regSel = target.params.id;
        S.ui.regView = 'reader';
        if (target.params.sec) {
          S.ui.regSec = target.params.sec;
          S.ui.pendingScrollSec = target.params.sec;
        } else {
          delete S.ui.regSec;
          delete S.ui.pendingScrollSec;
        }
      } else {
        S.ui.regView = 'library';
        delete S.ui.regSec;
        delete S.ui.pendingScrollSec;
      }
    }

    if (target.route === 'settings') {
      S.ui.settings = target.params?.sec || 'appearance';
    }

    S.ui.mnav = false;
    S.ui.sel?.clear?.();
    S.ui.pop = null;
    S.ui.palette = null;
    S.ui.subOpen = null;
    delete S.ui.govDrawer;
    S.ui.composer = null;
    S.ui.editCell = null;
    if (!opt.keepDrawer && S.ui.drawer && typeof innerWidth !== 'undefined' && innerWidth < 900) S.ui.drawer = null;
    S.ui.loading = false;

    if (!same && S.ui.fx) {
      if (tabOnly) {
        S.ui.fx.tab = true;
        S.ui.fx.tabs = true;
      } else {
        S.ui.fx.route = true;
        S.ui.fx.tabs = true;
      }
    }
    const c = typeof document !== 'undefined' ? document.querySelector('.content') : null;
    if (c && !same) c.scrollTop = 0;
  }
}

export function restoreRoute(hash, opt = {}) {
  const target = hashToRoute(hash);
  applyRoute(target, opt);
  return target;
}

let _lastHandledHash = null;
let _renderFn = null;

export function setRenderFn(fn) {
  _renderFn = fn;
}

export function syncHash(state = null, opt = {}) {
  if (typeof window === 'undefined' || !window.location) return;
  const targetHash = routeToHash(state);
  const currentHash = window.location.hash || '';

  if (normalizeHash(currentHash) !== normalizeHash(targetHash)) {
    _lastHandledHash = targetHash;
    if (opt.replace) {
      safeReplaceHash(targetHash);
    } else {
      try {
        window.location.hash = targetHash;
      } catch {
        safeReplaceHash(targetHash);
      }
    }
  }
}

export function handleHashChange() {
  if (typeof window === 'undefined') return;
  const h = window.location.hash || '';

  if (normalizeHash(h) === normalizeHash(_lastHandledHash)) return;
  _lastHandledHash = h;

  const target = hashToRoute(h);
  if (typeof S !== 'undefined' && S.ui?.history && S.ui.history.length) {
    const last = S.ui.history[S.ui.history.length - 1];
    if (last.route === target.route && JSON.stringify(last.params || {}) === JSON.stringify(target.params || {})) {
      S.ui.history.pop();
    }
  }
  applyRoute(target, { isHistory: true });
  if (_renderFn) _renderFn();
}

export function goAuth(screen, opt = {}) {
  if (typeof S !== 'undefined') {
    S.ui.auth = screen;
    S.ui.errors = {};
    S.ui.pwNew = '';
    if (S.ui.fx) S.ui.fx[screen === 'onboarding' ? 'step' : 'auth'] = true;
  }
  if (!opt.skipHash) {
    syncHash(
      { route: typeof S !== 'undefined' ? S.ui.route : 'home', params: typeof S !== 'undefined' ? S.ui.params : {}, auth: screen },
      { replace: opt.replace },
    );
  }
  if (_renderFn) _renderFn();
  if (typeof document !== 'undefined') {
    setTimeout(() => document.querySelector('.auth input')?.focus(), 20);
  }
}

export function initRouter(renderFn = null) {
  if (renderFn) setRenderFn(renderFn);

  if (typeof window !== 'undefined') {
    window.removeEventListener('hashchange', handleHashChange);
    window.removeEventListener('popstate', handleHashChange);
    window.addEventListener('hashchange', handleHashChange);
    window.addEventListener('popstate', handleHashChange);

    const initialHash = window.location.hash || '';
    if (initialHash && initialHash !== '#' && initialHash !== '#/') {
      const target = hashToRoute(initialHash);
      applyRoute(target, { initial: true });
      const canonicalHash = routeToHash(target);
      _lastHandledHash = canonicalHash;
      if (initialHash !== canonicalHash) {
        safeReplaceHash(canonicalHash);
      }
    } else {
      const defaultRoute = (typeof S !== 'undefined' && S.prefs?.home) || 'home';
      applyRoute({ route: defaultRoute, params: {}, auth: null }, { initial: true });
      const canonicalHash = '#/' + defaultRoute;
      _lastHandledHash = canonicalHash;
      safeReplaceHash(canonicalHash);
    }
  }

  if (_renderFn) _renderFn();
}

export function destroyRouter() {
  if (typeof window !== 'undefined') {
    window.removeEventListener('hashchange', handleHashChange);
    window.removeEventListener('popstate', handleHashChange);
  }
  _lastHandledHash = null;
  _renderFn = null;
}

export function go(route, params = {}, opt = {}) {
  if (route === 'project' && !params.tab) params.tab = (typeof S !== 'undefined' && S.prefs?.defaultTab) || 'board';
  if (typeof S !== 'undefined') {
    const same = S.ui.route === route && JSON.stringify(S.ui.params) === JSON.stringify(params) && S.ui.auth === null;
    if (!opt.back && !same && S.ui.history) S.ui.history.push({ route: S.ui.route, params: S.ui.params });
    applyRoute({ route, params, auth: null }, opt);
  }
  if (!opt.skipHash) {
    syncHash({ route, params, auth: null }, { replace: opt.replace });
  }
  if (_renderFn) _renderFn();
}
