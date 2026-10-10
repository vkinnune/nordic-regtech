import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { hashToRoute, routeToHash } from '../src/shell/router.js';
import { renderDiffHtml } from '../src/ui/diff.js';

const ROOT = path.resolve('.');

test('Changes Feed Authenticity: authentic dataset from regtech pipeline', () => {
  const feedPath = path.join(ROOT, 'src/data/changes_feed.json');
  assert.ok(fs.existsSync(feedPath), 'src/data/changes_feed.json must exist');

  const events = JSON.parse(fs.readFileSync(feedPath, 'utf-8'));
  assert.ok(events.length > 50, `Must contain authentic changes feed events (found ${events.length})`);

  for (const ev of events) {
    assert.ok(ev.id, 'Event must have id');
    assert.ok(ev.docId, 'Event must have docId');
    assert.ok(ev.code, 'Event must have code');
    assert.ok(['MODIFIED', 'ADDED', 'REPEALED'].includes(ev.status), `Invalid status ${ev.status}`);
    assert.ok(['riksdagen', 'fffs'].includes(ev.source), `Invalid source ${ev.source}`);
    assert.ok(ev.fetchedAt, 'Event must have fetchedAt');

    if (ev.diff && ev.diff.length) {
      for (const [op, text] of ev.diff) {
        assert.ok(['equal', 'delete', 'insert'].includes(op), `Invalid diff op ${op}`);
        assert.equal(typeof text, 'string');
      }
    }
  }
});

test('Diff Renderer: renders deletions and insertions cleanly without slop', () => {
  const diff = [
    ['equal', 'Kapitaltäckning ska beräknas enligt '],
    ['delete', 'lag (2006:1371)'],
    ['insert', 'förordning (EU) nr 575/2013'],
    ['equal', '.'],
  ];

  const html = renderDiffHtml(diff);
  assert.ok(html.includes('<del class="diff-token-del">lag (2006:1371)</del>'));
  assert.ok(html.includes('<ins class="diff-token-ins">förordning (EU) nr 575/2013</ins>'));
  assert.ok(html.includes('Kapitaltäckning ska beräknas enligt '));
});

test('Section Integration: sections in swedish_regulations.json contain authentic version diffs', () => {
  const regs = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/swedish_regulations.json'), 'utf-8'));
  const amendedSections = [];

  for (const reg of regs) {
    for (const ch of reg.chapters || []) {
      for (const sec of ch.sections || []) {
        if (sec.change) {
          amendedSections.push(sec);
        }
      }
    }
  }

  assert.ok(amendedSections.length > 50, `Must have amended sections with change objects (found ${amendedSections.length})`);

  const sample = amendedSections.find(s => s.change.diff && s.change.diff.length > 0);
  assert.ok(sample, 'Must have at least one section with word-level diff');
  assert.ok(sample.change.amendingAct, 'Sample must have amendingAct');
  assert.ok(sample.change.amendedDate, 'Sample must have amendedDate');
});

test('Routing Integration: changes feed route and aliases', () => {
  assert.deepStrictEqual(hashToRoute('#/changes'), { route: 'changes', params: {}, auth: null });
  assert.deepStrictEqual(hashToRoute('#/feed'), { route: 'changes', params: {}, auth: null });
  assert.deepStrictEqual(hashToRoute('#/change'), { route: 'changes', params: {}, auth: null });
  assert.equal(routeToHash({ route: 'changes' }), '#/changes');
});

test('Routing Integration: regulations diff deep-linking', () => {
  assert.deepStrictEqual(hashToRoute('#/regulations/sfs-2004-46/chapter-2-section-1/diff'), {
    route: 'regulations',
    params: { id: 'sfs-2004-46', sec: 'chapter-2-section-1', diff: true },
    auth: null,
  });
  assert.equal(
    routeToHash({ route: 'regulations', params: { id: 'sfs-2004-46', sec: 'chapter-2-section-1', diff: true } }),
    '#/regulations/sfs-2004-46/chapter-2-section-1/diff',
  );
  assert.deepStrictEqual(hashToRoute('#/regulations/sfs-2004-46/chapter-2-section-1/unknown'), {
    route: '404',
    params: { path: 'regulations/sfs-2004-46/chapter-2-section-1/unknown' },
    auth: null,
  });
});

test('Milestone Dates: changes feed contains authentic in-force amendment milestones', () => {
  const events = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/changes_feed.json'), 'utf-8'));
  const dates = events.map(e => e.amendedDate || (e.fetchedAt ? e.fetchedAt.slice(0, 10) : null)).filter(Boolean);
  assert.ok(dates.length > 50, 'Must have in-force dates for amendments');

  const futureDates = dates.filter(d => d >= '2026-10-01');
  assert.ok(futureDates.length >= 50, 'Must have future in-force milestones starting from late 2026');

  // Verify key Swedish statutory milestones (e.g. 2026-10-08, 2026-12-05, 2027-01-11, 2030-01-10)
  assert.ok(dates.includes('2026-10-08'), 'Must include 2026-10-08 fetched milestone');
  assert.ok(dates.includes('2026-12-05'), 'Must include 2026-12-05 milestone');
  assert.ok(dates.includes('2027-01-11'), 'Must include 2027-01-11 milestone');
  assert.ok(dates.includes('2030-01-10'), 'Must include 2030-01-10 milestone');
});

test('changeEvent Lookup: retrieves regulatory amendment events by id or chunkId', async () => {
  const { changeEvent } = await import('../src/data/regulations.js');
  const ev109 = changeEvent(109);
  assert.ok(ev109, 'Must find event 109 by number');
  assert.equal(ev109.id, 109);
  assert.equal(ev109.code, 'SFS 2019:742');

  const evStr = changeEvent('109');
  assert.ok(evStr, 'Must find event 109 by string');
  assert.equal(evStr.id, 109);

  if (ev109.chunkId) {
    const evChunk = changeEvent(ev109.chunkId);
    assert.ok(evChunk, 'Must find event by chunkId');
    assert.equal(evChunk.id, 109);
  }

  assert.equal(changeEvent(null), null);
  assert.equal(changeEvent('non-existent-999999'), null);
});

test('Change Drawer Architecture: overlays, actions, keyboard, and router integration', () => {
  const drawerSrc = fs.readFileSync(path.join(ROOT, 'src/overlays/drawer.js'), 'utf-8');
  assert.ok(drawerSrc.includes('changeDrawerHtml'), 'drawer.js must export changeDrawerHtml');
  assert.ok(drawerSrc.includes('u.changeDrawer && changeEvent(u.changeDrawer)'), 'renderLayer must check u.changeDrawer and changeEvent');
  assert.ok(drawerSrc.includes('data-a="closeChangeDrawer"'), 'changeDrawerHtml must include closeChangeDrawer button');
  assert.ok(drawerSrc.includes('data-a="openRegInReader"'), 'changeDrawerHtml must include openRegInReader action');
  assert.ok(drawerSrc.includes('data-a="createChangeComplianceTask"'), 'changeDrawerHtml must include createChangeComplianceTask action');
  assert.ok(drawerSrc.includes('renderDiffHtml(e.diff)'), 'changeDrawerHtml must embed redline diff renderer');

  const actionsSrc = fs.readFileSync(path.join(ROOT, 'src/actions/actions.js'), 'utf-8');
  assert.ok(actionsSrc.includes('A.openChangeDrawer ='), 'actions.js must register A.openChangeDrawer');
  assert.ok(actionsSrc.includes('A.closeChangeDrawer ='), 'actions.js must register A.closeChangeDrawer');
  assert.ok(actionsSrc.includes('A.createChangeComplianceTask ='), 'actions.js must register A.createChangeComplianceTask');
  assert.ok(actionsSrc.includes('delete S.ui.changeDrawer;'), 'actions.js must clear S.ui.changeDrawer when appropriate');

  const keyboardSrc = fs.readFileSync(path.join(ROOT, 'src/actions/keyboard.js'), 'utf-8');
  assert.ok(keyboardSrc.includes('S.ui.changeDrawer') && keyboardSrc.includes('A.closeChangeDrawer()'), 'keyboard.js must close changeDrawer on Escape key');

  const routerSrc = fs.readFileSync(path.join(ROOT, 'src/shell/router.js'), 'utf-8');
  assert.ok(routerSrc.includes('delete S.ui.changeDrawer;'), 'router.js must clear changeDrawer on route transitions');

  const changesSrc = fs.readFileSync(path.join(ROOT, 'src/pages/changes.js'), 'utf-8');
  assert.ok(changesSrc.includes('data-a="openChangeDrawer"'), 'changes.js must use data-a="openChangeDrawer" for calendar and table clicks');

  const popoversSrc = fs.readFileSync(path.join(ROOT, 'src/overlays/popovers.js'), 'utf-8');
  assert.ok(popoversSrc.includes('data-a="openChangeDrawer"'), 'popovers.js must use data-a="openChangeDrawer" in changesDaylist');
});
