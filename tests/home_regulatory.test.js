import test from 'node:test';
import assert from 'node:assert/strict';
import { buildHomeBriefing, filterHomeBriefing, normalizeHomeScope, sourceDate } from '../src/features/home-regulatory-model.js';
import { REGULATIONS, CHANGES_FEED } from '../src/data/regulations.js';
import { seed } from '../src/data/seed.js';
const regulation = { id: 'sfs-2026-1', code: 'SFS 2026:1', title: 'Bank requirements', jurisdiction: 'Sweden (Riksdagen)', inForce: '2026-11-01' };
const event = {
  id: 1,
  docId: regulation.id,
  code: regulation.code,
  level: 'section',
  chapter: '1',
  section: '1',
  status: 'MODIFIED',
  amendedDate: '2026-11-20',
  amendingAct: 'SFS 2026:2',
  fetchedAt: '2026-10-17T12:00:00Z',
};
const fixture = patch => ({ regulations: [regulation], events: [event], now: '2026-10-18', ...patch });
test('source dates validate calendar dates and never substitute ingestion for effective dates', () => {
  assert.equal(sourceDate('2026-02-31'), null);
  assert.equal(sourceDate('2026-10-18T12:00:00Z'), '2026-10-18');
  assert.equal(sourceDate('2026'), null);
  const b = buildHomeBriefing(fixture({ events: [{ ...event, amendedDate: null }] }));
  assert.equal(b.changes[0].date, null);
  assert.equal(b.changes[0].phase, 'undated');
  assert.equal(b.latestFetch, '2026-10-17');
  assert.equal(b.upcoming.filter(g => g.kind === 'change').length, 0);
});
test('grouping combines sections of the same amendment without merging distinct acts or effective dates', () => {
  const events = [
    event,
    { ...event, id: 2, section: '2', status: 'ADDED' },
    { ...event, id: 3, amendingAct: 'SFS 2026:3' },
    { ...event, id: 4, amendedDate: '2026-12-01' },
    event,
  ];
  const b = buildHomeBriefing(fixture({ events }));
  assert.equal(b.changes.length, 3);
  assert.deepEqual(
    b.changes.find(g => g.events.length === 2).events.map(e => e.id),
    [1, 2],
  );
});
test('document imports are separate from new legislation and use the first recorded import', () => {
  const old = { ...regulation, inForce: '2001-01-01' };
  const b = buildHomeBriefing(
    fixture({
      regulations: [old],
      events: [
        { ...event, level: 'document', status: 'ADDED', amendedDate: '2001-01-01' },
        { ...event, id: 2, level: 'document', status: 'ADDED', fetchedAt: '2026-10-01T00:00:00Z' },
      ],
    }),
  );
  assert.equal(b.changes.length, 0);
  assert.equal(b.newRegulations.length, 0);
  assert.equal(b.library.length, 1);
  assert.equal(b.library[0].added, '2026-10-01');
  assert.equal(b.library[0].date, '2001-01-01');
});
test('future timing comes from dates even when the imported upcoming flag is false', () => {
  const b = buildHomeBriefing(fixture({ events: [{ ...event, upcoming: false }] }));
  assert.equal(b.changes[0].phase, 'upcoming');
  assert.equal(b.changes[0].days, 33);
});
test('new regulations exclude amendment and repeal instruments and require a known date within one year', () => {
  const regulations = [
    regulation,
    { ...regulation, id: 'amendment', amendsId: regulation.id },
    { ...regulation, id: 'repeal', title: 'Föreskrifter om upphävande av bankkrav' },
    { ...regulation, id: 'old', inForce: '2000-01-01' },
    { ...regulation, id: 'unknown', inForce: null },
    { ...regulation, id: 'far', inForce: '2030-01-01' },
  ];
  assert.deepEqual(
    buildHomeBriefing(fixture({ regulations })).newRegulations.map(g => g.reg.id),
    [regulation.id],
  );
});
test('matching requires market and topic, while explicit linked records remain included', () => {
  const scope = { markets: ['Finland'], topics: ['banking'] };
  assert.equal(buildHomeBriefing(fixture({ scope })).changes.length, 0);
  const projects = [{ id: 'p1', name: `${regulation.code} · Banking project` }];
  const b = buildHomeBriefing(fixture({ scope, projects }));
  assert.equal(b.changes.length, 1);
  assert.equal(b.changes[0].context.linked, true);
  assert.equal(b.changes[0].context.projects[0].id, 'p1');
});
test('project code matching does not confuse a short code with a longer one', () => {
  const b = buildHomeBriefing(fixture({ scope: { markets: [], topics: [] }, projects: [{ id: 'p1', name: 'SFS 2026:10 · Other project' }] }));
  assert.equal(b.changes.length, 0);
});
test('governance links resolve regulation context and exclude archived records', () => {
  const policies = [
    { id: 'p1', projectId: 'project1', statuteSections: ['riksdagen_sfs-2026-1_k1_p1'] },
    { id: 'p2', status: 'RETIRED', statuteSections: ['riksdagen_sfs-2026-1_k1_p1'] },
  ];
  const controls = [{ id: 'c1', statuteSections: ['riksdagen_sfs-2026-1_k1_p2'] }];
  const b = buildHomeBriefing(fixture({ policies, controls, projects: [{ id: 'project1', name: 'Implementation' }], scope: { markets: [], topics: [] } }));
  const c = b.changes[0].context;
  assert.deepEqual(
    c.policies.map(p => p.id),
    ['p1'],
  );
  assert.deepEqual(
    c.controls.map(p => p.id),
    ['c1'],
  );
  assert.equal(c.projects.length, 1);
  assert.equal(buildHomeBriefing(fixture({ policies: [policies[1]], scope: { markets: [], topics: [] } })).changes.length, 0);
});
test('scope normalization preserves an intentional empty scope and drops unsupported values', () => {
  assert.deepEqual(normalizeHomeScope({ markets: [], topics: [] }), { markets: [], topics: [] });
  assert.deepEqual(normalizeHomeScope({ markets: ['Sweden', 'Sweden', 'Unknown'], topics: ['banking', 'fake'] }), { markets: ['Sweden'], topics: ['banking'] });
});
test('recent window, filters, search, and sorting use effective dates', () => {
  const events = [
    event,
    { ...event, id: 2, amendedDate: '2026-10-01' },
    { ...event, id: 3, amendedDate: '2020-01-01' },
    { ...event, id: 4, amendedDate: '2027-04-01' },
  ];
  const b = buildHomeBriefing(fixture({ events }));
  assert.deepEqual(
    b.changes.map(g => g.date),
    ['2026-11-20', '2026-10-01', '2027-04-01', '2020-01-01'],
  );
  assert.equal(filterHomeBriefing(b).length, 3);
  assert.equal(filterHomeBriefing(b, { period: 'all' }).length, 4);
  assert.equal(filterHomeBriefing(b, { period: 'recent' }).length, 1);
  assert.equal(filterHomeBriefing(b, { period: 'upcoming' }).length, 2);
  assert.equal(filterHomeBriefing(b, { query: 'no match' }).length, 0);
  assert.equal(filterHomeBriefing(b, { query: 'SFS 2026:2' }).length, 3);
});
test('missing catalog records do not create broken navigation and inputs stay unchanged', () => {
  const input = fixture({ events: [event, { ...event, id: 2, docId: 'missing', code: 'MISSING' }] });
  const before = structuredClone(input);
  const b = buildHomeBriefing(input);
  assert.equal(b.changes.length, 1);
  assert.deepEqual(input, before);
});
test('real snapshot produces linked amendments, standalone regulations and separately labeled imports', () => {
  const data = seed();
  const b = buildHomeBriefing({ ...data, regulations: REGULATIONS, events: CHANGES_FEED, now: '2026-10-18' });
  assert.ok(b.changes.length > 0);
  assert.ok(b.changes.some(g => g.context.projects.length > 0));
  assert.ok(b.newRegulations.some(g => g.reg.id === 'fffs-2026-11'));
  const dora = b.library.find(g => g.reg.id === 'eu-2022-2554');
  assert.equal(dora.added, '2026-10-17');
  assert.equal(b.latestFetch, '2026-10-17');
  for (const g of b.changes) assert.ok(g.events.every(e => CHANGES_FEED.includes(e)));
});

test('a standalone framework that also amends other laws remains a new regulation', () => {
  const reg = { ...regulation, title: 'Regulation on digital operational resilience and amending other regulations' };
  assert.equal(buildHomeBriefing(fixture({ regulations: [reg] })).newRegulations.length, 1);
});
