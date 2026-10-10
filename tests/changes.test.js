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
