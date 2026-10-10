import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hashToRoute,
  parseHash,
  routeToHash,
  formatHash,
  normalizeHash,
  restoreRoute,
  applyRoute,
  syncHash,
  initRouter,
  destroyRouter,
  goAuth,
  go,
  safeDecode,
  safeReplaceHash,
  AUTH_SCREENS,
  SINGULAR_ROUTE_MAP,
} from '../src/core/router.js';
import { S } from '../src/core/store.js';

test('Router: normalizeHash strips leading hashes, slashes, queries, and extra fragments', () => {
  assert.equal(normalizeHash(''), '');
  assert.equal(normalizeHash('#'), '');
  assert.equal(normalizeHash('#/'), '');
  assert.equal(normalizeHash('/'), '');
  assert.equal(normalizeHash('#/inbox'), 'inbox');
  assert.equal(normalizeHash('#inbox'), 'inbox');
  assert.equal(normalizeHash('/inbox'), 'inbox');
  assert.equal(normalizeHash('#/projects/p1/board?filter=active'), 'projects/p1/board');
  assert.equal(normalizeHash('#/projects/p1/board#secondary'), 'projects/p1/board');
  assert.equal(normalizeHash('   #/tasks   '), 'tasks');
});

test('Router: hashToRoute handles root and default route correctly', () => {
  const r1 = hashToRoute('');
  assert.equal(r1.route, 'home');
  assert.deepEqual(r1.params, {});
  assert.equal(r1.auth, null);

  const r2 = hashToRoute('#');
  assert.equal(r2.route, 'home');

  const r3 = hashToRoute('#/');
  assert.equal(r3.route, 'home');

  const r4 = hashToRoute(null);
  assert.equal(r4.route, 'home');

  const rCustom = hashToRoute('', { defaultHome: 'inbox' });
  assert.equal(rCustom.route, 'inbox');
});

test('Router: hashToRoute parses all standard sidebar routes', () => {
  const routes = [
    'home',
    'inbox',
    'mytasks',
    'favorites',
    'notifications',
    'search',
    'overview',
    'regulations',
    'policies',
    'controls',
    'risks',
    'projects',
    'tasks',
    'calendar',
    'timeline',
    'members',
    'teams',
    'activity',
    'settings',
    'system',
    'states',
    'archive',
  ];

  for (const r of routes) {
    const res = hashToRoute(`#/${r}`);
    assert.equal(res.route, r, `Should parse #/${r}`);
    assert.deepEqual(res.params, {});
    assert.equal(res.auth, null);

    // Also verify without leading slash
    const resNoSlash = hashToRoute(`#${r}`);
    assert.equal(resNoSlash.route, r, `Should parse #${r}`);
  }
});

test('Router: hashToRoute parses parameterized project routes with tabs', () => {
  // Acceptance criterion: Booting with #/project/proj-1/table
  const r1 = hashToRoute('#/project/proj-1/table');
  assert.equal(r1.route, 'project');
  assert.equal(r1.params.id, 'proj-1');
  assert.equal(r1.params.tab, 'table');
  assert.equal(r1.auth, null);

  // Plural variant from R1: #/projects/:id/:tab
  const r2 = hashToRoute('#/projects/proj-1/board');
  assert.equal(r2.route, 'project');
  assert.equal(r2.params.id, 'proj-1');
  assert.equal(r2.params.tab, 'board');

  // Timeline tab
  const r3 = hashToRoute('#/project/proj-2/timeline');
  assert.equal(r3.route, 'project');
  assert.equal(r3.params.id, 'proj-2');
  assert.equal(r3.params.tab, 'timeline');

  // Saved view tab (v:v1 encoded or literal)
  const r4 = hashToRoute('#/project/proj-1/v:v1');
  assert.equal(r4.route, 'project');
  assert.equal(r4.params.id, 'proj-1');
  assert.equal(r4.params.tab, 'v:v1');

  // Default tab when omitted
  const r5 = hashToRoute('#/project/proj-1');
  assert.equal(r5.route, 'project');
  assert.equal(r5.params.id, 'proj-1');
  assert.equal(r5.params.tab, 'board');

  const r6 = hashToRoute('#/projects/proj-1');
  assert.equal(r6.route, 'project');
  assert.equal(r6.params.id, 'proj-1');
  assert.equal(r6.params.tab, 'board');

  // Project list without ID
  const r7 = hashToRoute('#/projects');
  assert.equal(r7.route, 'projects');
  assert.deepEqual(r7.params, {});
});

test('Router: hashToRoute parses parameterized member and team routes', () => {
  const m1 = hashToRoute('#/member/m-123');
  assert.equal(m1.route, 'member');
  assert.equal(m1.params.id, 'm-123');

  const m2 = hashToRoute('#/members/m-123');
  assert.equal(m2.route, 'member');
  assert.equal(m2.params.id, 'm-123');

  const t1 = hashToRoute('#/team/t-eng');
  assert.equal(t1.route, 'team');
  assert.equal(t1.params.id, 't-eng');

  const t2 = hashToRoute('#/teams/t-eng');
  assert.equal(t2.route, 'team');
  assert.equal(t2.params.id, 't-eng');
});

test('Router: hashToRoute parses regulations reader deep links', () => {
  const regLib = hashToRoute('#/regulations');
  assert.equal(regLib.route, 'regulations');
  assert.deepEqual(regLib.params, {});

  const regAct = hashToRoute('#/regulations/sfs-2004-46');
  assert.equal(regAct.route, 'regulations');
  assert.equal(regAct.params.id, 'sfs-2004-46');

  const regSec = hashToRoute('#/regulations/sfs-2004-46/sec-1');
  assert.equal(regSec.route, 'regulations');
  assert.equal(regSec.params.id, 'sfs-2004-46');
  assert.equal(regSec.params.sec, 'sec-1');
});

test('Router: hashToRoute parses all distinct auth views', () => {
  for (const screen of AUTH_SCREENS) {
    const res = hashToRoute(`#/auth/${screen}`);
    assert.equal(res.auth, screen, `Should parse #/auth/${screen}`);
    assert.deepEqual(res.params, {});

    // Also support legacy/shorthand #/:screen
    const resShort = hashToRoute(`#/${screen}`);
    assert.equal(resShort.auth, screen, `Should parse shorthand #/${screen}`);
  }

  // Bare #/auth defaults to login
  const bareAuth = hashToRoute('#/auth');
  assert.equal(bareAuth.auth, 'login');

  // Invalid auth screen defaults gracefully to login
  const invalidAuth = hashToRoute('#/auth/not-a-screen');
  assert.equal(invalidAuth.auth, 'login');
});

test('Router: hashToRoute gracefully routes invalid or unmapped hashes to 404 state', () => {
  const r1 = hashToRoute('#/unknown-route-xyz');
  assert.equal(r1.route, '404');
  assert.equal(r1.params.path, 'unknown-route-xyz');

  const r2 = hashToRoute('#/deep/invalid/path/test');
  assert.equal(r2.route, '404');
  assert.equal(r2.params.path, 'deep/invalid/path/test');
});

test('Router: routeToHash serializes routes to canonical URL hashes', () => {
  assert.equal(routeToHash({ route: 'home' }), '#/home');
  assert.equal(routeToHash({ route: 'inbox' }), '#/inbox');
  assert.equal(routeToHash({ route: 'mytasks' }), '#/mytasks');
  assert.equal(routeToHash({ route: 'projects' }), '#/projects');

  // Project with tab
  assert.equal(routeToHash({ route: 'project', params: { id: 'proj-1', tab: 'table' } }), '#/project/proj-1/table');
  assert.equal(routeToHash({ route: 'project', params: { id: 'proj-1', tab: 'board' } }), '#/project/proj-1/board');
  assert.equal(routeToHash({ route: 'project', params: { id: 'proj-1', tab: 'timeline' } }), '#/project/proj-1/timeline');

  // Project plural input canonicalizes
  assert.equal(routeToHash({ route: 'projects', params: { id: 'proj-1', tab: 'table' } }), '#/project/proj-1/table');

  // Member & Team
  assert.equal(routeToHash({ route: 'member', params: { id: 'm1' } }), '#/member/m1');
  assert.equal(routeToHash({ route: 'team', params: { id: 't1' } }), '#/team/t1');

  // Regulations
  assert.equal(routeToHash({ route: 'regulations' }), '#/regulations');
  assert.equal(routeToHash({ route: 'regulations', params: { id: 'sfs-2004-46' } }), '#/regulations/sfs-2004-46');
  assert.equal(routeToHash({ route: 'regulations', params: { id: 'sfs-2004-46', sec: 'sec-1' } }), '#/regulations/sfs-2004-46/sec-1');

  // Auth views
  for (const screen of AUTH_SCREENS) {
    assert.equal(routeToHash({ auth: screen }), `#/auth/${screen}`);
  }

  // 404
  assert.equal(routeToHash({ route: '404' }), '#/404');
});

test('Router: Round-trip serialization and parsing', () => {
  const testCases = [
    '#/home',
    '#/inbox',
    '#/mytasks',
    '#/projects',
    '#/project/proj-1/table',
    '#/project/proj-1/board',
    '#/project/proj-1/timeline',
    '#/member/m-1',
    '#/team/t-1',
    '#/regulations',
    '#/regulations/sfs-2004-46',
    '#/regulations/sfs-2004-46/sec-1',
    '#/auth/login',
    '#/auth/signup',
    '#/auth/forgot',
    '#/auth/reset',
    '#/auth/verify',
    '#/auth/onboarding',
    '#/404',
  ];

  for (const hash of testCases) {
    const parsed = hashToRoute(hash);
    const serialized = routeToHash(parsed);
    assert.equal(serialized, hash, `Round-trip for ${hash}`);

    const reparsed = hashToRoute(serialized);
    assert.deepEqual(reparsed, parsed, `Reparsed match for ${hash}`);
  }
});

test('Router: parseHash and formatHash are exported aliases', () => {
  assert.equal(parseHash, hashToRoute);
  assert.equal(formatHash, routeToHash);
});

test('Router: restoreRoute / applyRoute updates store state directly', () => {
  // Restore a regular route
  restoreRoute('#/mytasks');
  assert.equal(S.ui.route, 'mytasks');
  assert.equal(S.ui.auth, null);

  // Restore parameterized project route
  restoreRoute('#/project/p1/table');
  assert.equal(S.ui.route, 'project');
  assert.equal(S.ui.params.id, 'p1');
  assert.equal(S.ui.params.tab, 'table');
  assert.equal(S.ui.auth, null);

  // Restore regulations reader route
  restoreRoute('#/regulations/sfs-2004-46/sec-2');
  assert.equal(S.ui.route, 'regulations');
  assert.equal(S.ui.regSel, 'sfs-2004-46');
  assert.equal(S.ui.regSec, 'sec-2');
  assert.equal(S.ui.pendingScrollSec, 'sec-2');
  assert.equal(S.ui.regView, 'reader');

  // Restore regulations library
  restoreRoute('#/regulations');
  assert.equal(S.ui.route, 'regulations');
  assert.equal(S.ui.regView, 'library');
  assert.equal(S.ui.regSec, undefined);

  // Restore auth view
  restoreRoute('#/auth/signup');
  assert.equal(S.ui.auth, 'signup');

  // Restore 404 view
  restoreRoute('#/some-invalid-page');
  assert.equal(S.ui.route, '404');
  assert.equal(S.ui.auth, null);
});

test('Router: Browser navigation mock test (hashchange, popstate, Back/Forward)', () => {
  const listeners = {};
  let currentHash = '#/home';
  let historyEntries = ['#/home'];
  let historyIndex = 0;
  let renderCount = 0;

  const mockWindow = {
    location: {
      get hash() {
        return currentHash;
      },
      set hash(val) {
        currentHash = val;
        historyEntries = historyEntries.slice(0, historyIndex + 1);
        historyEntries.push(val);
        historyIndex = historyEntries.length - 1;
        // Trigger hashchange event
        if (listeners.hashchange) {
          listeners.hashchange.forEach(cb => cb({ type: 'hashchange', newURL: val }));
        }
      },
    },
    history: {
      get length() {
        return historyEntries.length;
      },
      back() {
        if (historyIndex > 0) {
          historyIndex--;
          currentHash = historyEntries[historyIndex];
          if (listeners.popstate) {
            listeners.popstate.forEach(cb => cb({ type: 'popstate' }));
          }
          if (listeners.hashchange) {
            listeners.hashchange.forEach(cb => cb({ type: 'hashchange' }));
          }
        }
      },
      forward() {
        if (historyIndex < historyEntries.length - 1) {
          historyIndex++;
          currentHash = historyEntries[historyIndex];
          if (listeners.popstate) {
            listeners.popstate.forEach(cb => cb({ type: 'popstate' }));
          }
          if (listeners.hashchange) {
            listeners.hashchange.forEach(cb => cb({ type: 'hashchange' }));
          }
        }
      },
      replaceState(_state, _title, url) {
        currentHash = url;
        historyEntries[historyIndex] = url;
      },
    },
    addEventListener(event, cb) {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(cb);
    },
    removeEventListener(event, cb) {
      if (!listeners[event]) return;
      listeners[event] = listeners[event].filter(fn => fn !== cb);
    },
  };

  // Temporarily bind global window to mockWindow
  const originalWindow = globalThis.window;
  globalThis.window = mockWindow;

  try {
    initRouter(() => {
      renderCount++;
    });

    // 1. Initial boot with #/home
    assert.equal(S.ui.route, 'home');
    const bootRenders = renderCount;
    assert.ok(bootRenders >= 1, 'Boot should trigger initial render');

    // 2. Programmatic navigation via syncHash to #/inbox
    syncHash({ route: 'inbox' });
    assert.equal(mockWindow.location.hash, '#/inbox');

    // 3. Navigate to a project tab
    syncHash({ route: 'project', params: { id: 'p1', tab: 'table' } });
    assert.equal(mockWindow.location.hash, '#/project/p1/table');

    // 4. Switch project tab to timeline
    syncHash({ route: 'project', params: { id: 'p1', tab: 'timeline' } });
    assert.equal(mockWindow.location.hash, '#/project/p1/timeline');

    // 5. Navigate to auth screen
    goAuth('login');
    assert.equal(mockWindow.location.hash, '#/auth/login');
    assert.equal(S.ui.auth, 'login');

    // 6. Test browser BACK
    mockWindow.history.back(); // Back to #/project/p1/timeline
    assert.equal(mockWindow.location.hash, '#/project/p1/timeline');
    assert.equal(S.ui.route, 'project');
    assert.equal(S.ui.params.tab, 'timeline');
    assert.equal(S.ui.auth, null);

    mockWindow.history.back(); // Back to #/project/p1/table
    assert.equal(mockWindow.location.hash, '#/project/p1/table');
    assert.equal(S.ui.params.tab, 'table');

    mockWindow.history.back(); // Back to #/inbox
    assert.equal(mockWindow.location.hash, '#/inbox');
    assert.equal(S.ui.route, 'inbox');

    // 7. Test browser FORWARD
    mockWindow.history.forward(); // Forward to #/project/p1/table
    assert.equal(mockWindow.location.hash, '#/project/p1/table');
    assert.equal(S.ui.route, 'project');
    assert.equal(S.ui.params.tab, 'table');

    mockWindow.history.forward(); // Forward to #/project/p1/timeline
    assert.equal(mockWindow.location.hash, '#/project/p1/timeline');
    assert.equal(S.ui.params.tab, 'timeline');

    mockWindow.history.forward(); // Forward to #/auth/login
    assert.equal(mockWindow.location.hash, '#/auth/login');
    assert.equal(S.ui.auth, 'login');
  } finally {
    destroyRouter();
    globalThis.window = originalWindow;
  }
});

test('Router: go() integrates with window.location.hash synchronization', () => {
  let locationHash = '#/home';
  const mockWindow = {
    location: {
      get hash() {
        return locationHash;
      },
      set hash(val) {
        locationHash = val;
      },
    },
    history: {
      replaceState(_state, _title, val) {
        locationHash = val;
      },
    },
    addEventListener() {},
    removeEventListener() {},
  };

  const originalWindow = globalThis.window;
  const originalDoc = globalThis.document;

  globalThis.window = mockWindow;
  globalThis.document = {
    activeElement: null,
    title: '',
    documentElement: { lang: 'en' },
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
    getElementById() {
      return null;
    },
  };

  try {
    // Calling go('mytasks') should update location.hash
    go('mytasks');
    assert.equal(locationHash, '#/mytasks');
    assert.equal(S.ui.route, 'mytasks');

    // Calling go('project', { id: 'proj-1', tab: 'board' }) should update location.hash
    go('project', { id: 'proj-1', tab: 'board' });
    assert.equal(locationHash, '#/project/proj-1/board');
    assert.equal(S.ui.route, 'project');
    assert.equal(S.ui.params.id, 'proj-1');
    assert.equal(S.ui.params.tab, 'board');

    // Switching tab via go('project', { id: 'proj-1', tab: 'table' }) should update location.hash
    go('project', { id: 'proj-1', tab: 'table' }, { tab: true });
    assert.equal(locationHash, '#/project/proj-1/table');
    assert.equal(S.ui.params.tab, 'table');
  } finally {
    destroyRouter();
    globalThis.window = originalWindow;
    globalThis.document = originalDoc;
  }
});

test('Router: Edge cases (empty inputs, slashes, query strings, encoded URIs, invalid routes)', () => {
  // Empty, spaces, hashes
  assert.equal(hashToRoute('   ').route, 'home');
  assert.equal(hashToRoute('#///').route, 'home');
  assert.equal(hashToRoute('////').route, 'home');
  assert.equal(hashToRoute('#/project//proj-1///timeline//').route, 'project');
  assert.equal(hashToRoute('#/project//proj-1///timeline//').params.id, 'proj-1');
  assert.equal(hashToRoute('#/project//proj-1///timeline//').params.tab, 'timeline');

  // URL encoded components
  const encRoute = hashToRoute('#/project/proj%201/v%3Av1');
  assert.equal(encRoute.route, 'project');
  assert.equal(encRoute.params.id, 'proj 1');
  assert.equal(encRoute.params.tab, 'v:v1');

  // Query strings on hash are stripped safely
  const queryRoute = hashToRoute('#/projects?sort=recent&limit=10');
  assert.equal(queryRoute.route, 'projects');
  assert.deepEqual(queryRoute.params, {});

  // Hash fragment inside hash is stripped safely
  const fragmentRoute = hashToRoute('#/regulations#section-top');
  assert.equal(fragmentRoute.route, 'regulations');
  assert.deepEqual(fragmentRoute.params, {});

  // Project with no ID defaults to projects list
  const bareProject = hashToRoute('#/project');
  assert.equal(bareProject.route, 'projects');

  // Serialization of URI-encoded components
  const serialized = routeToHash({ route: 'project', params: { id: 'proj 1', tab: 'v:v1' } });
  assert.equal(serialized, '#/project/proj%201/v%3Av1');
  const roundTrip = hashToRoute(serialized);
  assert.equal(roundTrip.params.id, 'proj 1');
  assert.equal(roundTrip.params.tab, 'v:v1');
});

test('Router: Settings sub-sections parsing, formatting, round-trip, and state restoration', () => {
  // Parsing bare settings
  const s0 = hashToRoute('#/settings');
  assert.equal(s0.route, 'settings');
  assert.deepEqual(s0.params, {});

  // Parsing settings sections
  const sections = [
    'workspace',
    'appearance',
    'language',
    'datetime',
    'members',
    'teams',
    'projects',
    'permissions',
    'notif-email',
    'profile',
    'security',
    'billing',
  ];
  for (const sec of sections) {
    const res = hashToRoute(`#/settings/${sec}`);
    assert.equal(res.route, 'settings');
    assert.equal(res.params.sec, sec);

    // Serialization
    const hash = routeToHash(res);
    assert.equal(hash, `#/settings/${sec}`);

    // Round-trip
    const re = hashToRoute(hash);
    assert.deepEqual(re, res);
  }

  // State restoration updates S.ui.settings
  restoreRoute('#/settings/workspace');
  assert.equal(S.ui.route, 'settings');
  assert.equal(S.ui.settings, 'workspace');

  restoreRoute('#/settings/appearance');
  assert.equal(S.ui.route, 'settings');
  assert.equal(S.ui.settings, 'appearance');
});

test('Router: Preserves case for custom and saved view identifiers in project tabs', () => {
  const customView = hashToRoute('#/project/p1/v:CustomViewAlpha');
  assert.equal(customView.route, 'project');
  assert.equal(customView.params.id, 'p1');
  assert.equal(customView.params.tab, 'v:CustomViewAlpha');

  const standardTab = hashToRoute('#/project/p1/TABLE');
  assert.equal(standardTab.params.tab, 'table', 'Standard tab should be normalized to lowercase');
});

test('Router: Regulations deep linking and library restoration', () => {
  // Navigate into reader section
  restoreRoute('#/regulations/sfs-2004-46/sec-99');
  assert.equal(S.ui.route, 'regulations');
  assert.equal(S.ui.regSel, 'sfs-2004-46');
  assert.equal(S.ui.regSec, 'sec-99');
  assert.equal(S.ui.pendingScrollSec, 'sec-99');
  assert.equal(S.ui.regView, 'reader');

  // Navigate back to regulations library
  restoreRoute('#/regulations');
  assert.equal(S.ui.route, 'regulations');
  assert.equal(S.ui.regView, 'library');
  assert.equal(S.ui.regSec, undefined);
  assert.equal(S.ui.pendingScrollSec, undefined);
});

test('Router: Normalization of hashbangs, consecutive slashes, and trailing slashes', () => {
  assert.equal(normalizeHash('#!/inbox'), 'inbox');
  assert.equal(normalizeHash('#!/settings/workspace/'), 'settings/workspace');
  assert.equal(normalizeHash('#/project/p1/table/'), 'project/p1/table');
  assert.equal(normalizeHash('   #!/tasks///   '), 'tasks');

  const hbRoute = hashToRoute('#!/inbox');
  assert.equal(hbRoute.route, 'inbox');

  const trailingSlashRoute = hashToRoute('#/project/p1/board/');
  assert.equal(trailingSlashRoute.route, 'project');
  assert.equal(trailingSlashRoute.params.id, 'p1');
  assert.equal(trailingSlashRoute.params.tab, 'board');
});

test('Router: Malformed URI encoding in hash does not throw URIError and recovers gracefully', () => {
  // Malformed percent-encodings must not crash the application with unhandled URIError
  assert.doesNotThrow(() => hashToRoute('#/search/%99'));
  assert.doesNotThrow(() => hashToRoute('#/%E0%A4'));
  assert.doesNotThrow(() => hashToRoute('#/project/%99/table'));

  const r1 = hashToRoute('#/search/%99');
  assert.equal(r1.route, '404');

  const r2 = hashToRoute('#/project/%99/table');
  assert.equal(r2.route, 'project');
  assert.equal(r2.params.id, '%99');
  assert.equal(r2.params.tab, 'table');

  assert.equal(safeDecode('%99'), '%99');
  assert.equal(safeDecode('valid%20string'), 'valid string');
});

test('Router: Multiple leading hashes and bangs normalized correctly', () => {
  assert.equal(normalizeHash('###/tasks'), 'tasks');
  assert.equal(normalizeHash('##!//inbox'), 'inbox');
  assert.equal(normalizeHash('!##/overview'), 'overview');
  assert.equal(hashToRoute('###/tasks').route, 'tasks');
});

test('Router: Settings navigation resets S.ui.settings to default appearance when sec is omitted', () => {
  // First navigate into billing section
  restoreRoute('#/settings/billing');
  assert.equal(S.ui.route, 'settings');
  assert.equal(S.ui.settings, 'billing');

  // Then navigate back to bare settings
  restoreRoute('#/settings');
  assert.equal(S.ui.route, 'settings');
  assert.equal(S.ui.settings, 'appearance', 'Omitted settings sub-section must reset to appearance');
});

test('Router: Singular regulation and resource route aliases', () => {
  // Singular regulation
  const r1 = hashToRoute('#/regulation/sfs-2004-46');
  assert.equal(r1.route, 'regulations');
  assert.equal(r1.params.id, 'sfs-2004-46');

  const r2 = hashToRoute('#/regulation/sfs-2004-46/sec-1');
  assert.equal(r2.route, 'regulations');
  assert.equal(r2.params.id, 'sfs-2004-46');
  assert.equal(r2.params.sec, 'sec-1');

  const r3 = hashToRoute('#/regulation');
  assert.equal(r3.route, 'regulations');
  assert.deepEqual(r3.params, {});

  // routeToHash singular input canonicalizes to #/regulations
  assert.equal(routeToHash({ route: 'regulation', params: { id: 'sfs-2004-46' } }), '#/regulations/sfs-2004-46');

  // Singular convenience aliases for flat routes
  assert.equal(hashToRoute('#/policy').route, 'policies');
  assert.equal(hashToRoute('#/control').route, 'controls');
  assert.equal(hashToRoute('#/risk').route, 'risks');
  assert.equal(hashToRoute('#/task').route, 'tasks');
  assert.equal(hashToRoute('#/favorite').route, 'favorites');
  assert.equal(hashToRoute('#/notification').route, 'notifications');
});

test('Router: Flat routes with unexpected subpaths route gracefully to 404', () => {
  const r1 = hashToRoute('#/home/unexpected/subpath');
  assert.equal(r1.route, '404');

  const r2 = hashToRoute('#/inbox/extra');
  assert.equal(r2.route, '404');

  const r3 = hashToRoute('#/mytasks/foo/bar');
  assert.equal(r3.route, '404');
});

test('Router: Redundant navigation does not push duplicate entries to S.ui.history', () => {
  S.ui.history = [];
  S.ui.route = 'home';
  S.ui.params = {};
  S.ui.auth = null;

  // Navigating to a new route pushes an entry
  go('inbox');
  assert.equal(S.ui.history.length, 1);
  assert.equal(S.ui.history[0].route, 'home');

  // Navigating to the EXACT SAME route must NOT push duplicate entry
  go('inbox');
  assert.equal(S.ui.history.length, 1, 'Redundant go() should not push to history');

  // Navigating to another route pushes again
  go('tasks');
  assert.equal(S.ui.history.length, 2);
  assert.equal(S.ui.history[1].route, 'inbox');
});

test('Router: applyRoute sets default project tab when omitted and handles tabOnly flag', () => {
  applyRoute({ route: 'project', params: { id: 'proj-x' } }, { tab: true });
  assert.equal(S.ui.route, 'project');
  assert.equal(S.ui.params.id, 'proj-x');
  assert.equal(S.ui.params.tab, 'board');
  assert.equal(S.ui.fx?.tab, true);
  assert.equal(S.ui.fx?.tabs, true);
});

test('Router: Parameterized routes with unexpected/garbage subpaths route gracefully to 404', () => {
  // Settings with excess subpaths
  const s1 = hashToRoute('#/settings/appearance/extra/garbage');
  assert.equal(s1.route, '404');
  assert.equal(s1.params.path, 'settings/appearance/extra/garbage');

  // Projects with excess subpaths
  const p1 = hashToRoute('#/project/proj-1/board/extra/garbage');
  assert.equal(p1.route, '404');
  assert.equal(p1.params.path, 'project/proj-1/board/extra/garbage');

  const p2 = hashToRoute('#/projects/proj-1/board/extra');
  assert.equal(p2.route, '404');

  // Member with excess subpaths
  const m1 = hashToRoute('#/member/m-1/extra/garbage');
  assert.equal(m1.route, '404');

  const m2 = hashToRoute('#/members/m-1/extra');
  assert.equal(m2.route, '404');

  // Team with excess subpaths
  const t1 = hashToRoute('#/team/t-1/extra/garbage');
  assert.equal(t1.route, '404');

  const t2 = hashToRoute('#/teams/t-1/extra');
  assert.equal(t2.route, '404');

  // Regulations with excess subpaths
  const r1 = hashToRoute('#/regulations/sfs-2004-46/sec-1/extra/garbage');
  assert.equal(r1.route, '404');

  const r2 = hashToRoute('#/regulation/sfs-2004-46/sec-1/extra');
  assert.equal(r2.route, '404');

  // Auth with excess subpaths
  const a1 = hashToRoute('#/auth/login/extra/garbage');
  assert.equal(a1.route, '404');
});

test('Router: replaceState throwing SecurityError in sandboxed iframe is handled safely without throwing', () => {
  let locationHash = '#/home';
  const mockWindow = {
    location: {
      get hash() {
        return locationHash;
      },
      set hash(val) {
        locationHash = val;
      },
    },
    history: {
      replaceState() {
        throw new Error('DOMException: SecurityError: The operation is insecure.');
      },
    },
    addEventListener() {},
    removeEventListener() {},
  };

  const origWindow = globalThis.window;
  globalThis.window = mockWindow;

  try {
    // safeReplaceHash must not throw and should safely fall back to location.hash
    assert.doesNotThrow(() => safeReplaceHash('#/test-hash'));
    assert.equal(locationHash, '#/test-hash');

    // initRouter must survive SecurityError without crashing
    assert.doesNotThrow(() => {
      initRouter(() => {});
    });

    // syncHash with replace: true must survive SecurityError without crashing
    assert.doesNotThrow(() => {
      syncHash({ route: 'inbox' }, { replace: true });
    });
    assert.equal(locationHash, '#/inbox');
  } finally {
    destroyRouter();
    globalThis.window = origWindow;
  }
});

test('Router: applyRoute dismisses command palette and statutory gov drawer on route transitions', () => {
  // Test non-auth route transition
  S.ui.palette = 'commands';
  S.ui.govDrawer = { type: 'control', id: 'c1' };
  S.ui.subOpen = 'sub1';

  applyRoute({ route: 'inbox', params: {}, auth: null });

  assert.equal(S.ui.palette, null, 'Palette must be dismissed on route change');
  assert.equal(S.ui.govDrawer, undefined, 'Gov drawer must be dismissed on route change');
  assert.equal(S.ui.subOpen, null, 'SubOpen must be dismissed on route change');

  // Test auth view transition
  S.ui.palette = 'commands';
  S.ui.govDrawer = { type: 'policy', id: 'p1' };
  applyRoute({ route: 'home', params: {}, auth: 'login' });

  assert.equal(S.ui.palette, null, 'Palette must be dismissed on auth transition');
  assert.equal(S.ui.govDrawer, undefined, 'Gov drawer must be dismissed on auth transition');
});

test('Router: routeToHash canonicalizes singular flat route aliases to plural hashes', () => {
  assert.equal(routeToHash({ route: 'policy' }), '#/policies');
  assert.equal(routeToHash({ route: 'control' }), '#/controls');
  assert.equal(routeToHash({ route: 'risk' }), '#/risks');
  assert.equal(routeToHash({ route: 'task' }), '#/tasks');
  assert.equal(routeToHash({ route: 'favorite' }), '#/favorites');
  assert.equal(routeToHash({ route: 'notification' }), '#/notifications');

  // Verify round-trip parsing matches plural canonical route
  for (const singular of ['policy', 'control', 'risk', 'task', 'favorite', 'notification']) {
    const hash = routeToHash({ route: singular });
    const parsed = hashToRoute(hash);
    assert.equal(parsed.route, singular === 'policy' ? 'policies' : singular + 's');
  }
});

test('Router: SINGULAR_ROUTE_MAP correctly maps all singular entities to plural routes', () => {
  assert.deepEqual(SINGULAR_ROUTE_MAP, {
    policy: 'policies',
    control: 'controls',
    risk: 'risks',
    task: 'tasks',
    favorite: 'favorites',
    notification: 'notifications',
  });
});

test('Router: in-app back navigation safely pops history and falls back to home without escaping to external URLs', () => {
  const inAppBack = () => {
    const h = S.ui.history && S.ui.history.length ? S.ui.history.pop() : null;
    if (h) go(h.route, h.params, { back: true });
    else go('home');
  };

  // Scenario 1: in-app history has past visits
  S.ui.history = [
    { route: 'home', params: {} },
    { route: 'inbox', params: {} },
  ];
  S.ui.route = 'tasks';
  S.ui.params = {};

  inAppBack();
  assert.equal(S.ui.route, 'inbox', 'inAppBack should pop previous in-app route');
  assert.equal(S.ui.history.length, 1);

  inAppBack();
  assert.equal(S.ui.route, 'home', 'inAppBack should pop to home');
  assert.equal(S.ui.history.length, 0);

  // Scenario 2: in-app history is empty (e.g. entry from external URL or deep link)
  S.ui.history = [];
  S.ui.route = 'tasks';
  inAppBack();
  assert.equal(S.ui.route, 'home', 'inAppBack should safely fallback to home when in-app history is empty');
});
