import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');

test('Regulatory Feed Data: FEED_ITEMS, categories and authorities integrity', () => {
  const feedJs = fs.readFileSync(path.join(ROOT, 'src/data/feed.js'), 'utf-8');

  assert.ok(feedJs.includes('export const FEED_ITEMS'), 'feed.js must export FEED_ITEMS');
  assert.ok(feedJs.includes('export const FEED_CATEGORIES'), 'feed.js must export FEED_CATEGORIES');
  assert.ok(feedJs.includes('export const FEED_AUTHORITIES'), 'feed.js must export FEED_AUTHORITIES');

  // Verify key authorities and categories are present
  assert.ok(feedJs.includes('Finansinspektionen'), 'Must include Finansinspektionen');
  assert.ok(feedJs.includes('Sveriges Riksdag'), 'Must include Riksdagen');
  assert.ok(feedJs.includes('FIN-FSA'), 'Must include FIN-FSA');
  assert.ok(feedJs.includes('European Banking Authority'), 'Must include EBA');
  assert.ok(feedJs.includes('AMENDMENT'), 'Must include AMENDMENT category');
  assert.ok(feedJs.includes('CIRCULAR'), 'Must include CIRCULAR category');
  assert.ok(feedJs.includes('ENFORCEMENT'), 'Must include ENFORCEMENT category');
});

test('Regulatory Feed Shell & Router: navigation and route registration', () => {
  const layoutJs = fs.readFileSync(path.join(ROOT, 'src/shell/layout.js'), 'utf-8');
  const renderJs = fs.readFileSync(path.join(ROOT, 'src/shell/render.js'), 'utf-8');

  // Route registration
  assert.ok(renderJs.includes("feed: 'Regulatory Feed'"), 'render.js must register feed route name');
  assert.ok(renderJs.includes("feed: 'newspaper'") || renderJs.includes("feed: 'rss'"), 'render.js must register feed route icon');

  // Page handler
  assert.ok(layoutJs.includes('feed: pageFeed'), 'layout.js must map feed route to pageFeed');

  // Sidebar item
  assert.ok(layoutJs.includes("sItem('feed', 'Regulatory Feed'"), 'layout.js sidebar must contain Regulatory Feed item');
});

test('Regulatory Feed Actions: drawer, task creation, and filtering', () => {
  const actionsJs = fs.readFileSync(path.join(ROOT, 'src/actions/actions.js'), 'utf-8');

  assert.ok(actionsJs.includes('A.openFeedDrawer'), 'actions.js must define A.openFeedDrawer');
  assert.ok(actionsJs.includes('A.closeFeedDrawer'), 'actions.js must define A.closeFeedDrawer');
  assert.ok(actionsJs.includes('A.createTaskFromFeed'), 'actions.js must define A.createTaskFromFeed');
  assert.ok(actionsJs.includes('A.ackFeedItem'), 'actions.js must define A.ackFeedItem');
  assert.ok(actionsJs.includes('A.clearFeedFilters'), 'actions.js must define A.clearFeedFilters');
  assert.ok(actionsJs.includes('f.taskId = newId'), 'actions.js must associate created mitigation task with feed item');
  assert.ok(actionsJs.includes('ensureMutableFeedItem'), 'actions.js must isolate state mutations to action handlers');
  assert.ok(actionsJs.includes("targetRegId.replace(/^reg-/, '')"), 'actions.js must normalize statute prefix in openRegInReader');
});

test('Regulatory Feed Styling: dedicated css and import in index.css', () => {
  const indexCss = fs.readFileSync(path.join(ROOT, 'src/styles/index.css'), 'utf-8');
  assert.ok(indexCss.includes("@import './views/feed.css';"), 'index.css must import feed.css');

  const feedCss = fs.readFileSync(path.join(ROOT, 'src/styles/views/feed.css'), 'utf-8');
  assert.ok(feedCss.includes('.feed-grid'), 'feed.css must define .feed-grid');
  assert.ok(feedCss.includes('.feed-card'), 'feed.css must define .feed-card');
  assert.ok(feedCss.includes('.feed-score-5'), 'feed.css must define .feed-score-5');
});

test('Regulatory Feed Review Standards: layer separation, pure store getters, and select classes', () => {
  const actionsJs = fs.readFileSync(path.join(ROOT, 'src/actions/actions.js'), 'utf-8');
  const keyboardJs = fs.readFileSync(path.join(ROOT, 'src/actions/keyboard.js'), 'utf-8');
  const feedJs = fs.readFileSync(path.join(ROOT, 'src/data/feed.js'), 'utf-8');
  const helpersJs = fs.readFileSync(path.join(ROOT, 'src/ui/helpers.js'), 'utf-8');
  const storeJs = fs.readFileSync(path.join(ROOT, 'src/core/store.js'), 'utf-8');
  const feedPageJs = fs.readFileSync(path.join(ROOT, 'src/pages/feed.js'), 'utf-8');

  // Input handlers registered
  assert.ok(actionsJs.includes('IN.feedQ'), 'actions.js must register IN.feedQ');
  assert.ok(actionsJs.includes('IN.feedCat'), 'actions.js must register IN.feedCat');
  assert.ok(actionsJs.includes('IN.feedAuth'), 'actions.js must register IN.feedAuth');
  assert.ok(actionsJs.includes('IN.feedScore'), 'actions.js must register IN.feedScore');

  // Keyboard Escape handler dismisses feedDrawer
  assert.ok(keyboardJs.includes('A.closeFeedDrawer()'), 'keyboard.js must dismiss S.ui.feedDrawer via A.closeFeedDrawer() on Escape');

  // Shared score helpers exported from UI layer with unified tier lookup
  assert.ok(helpersJs.includes('export function feedScoreClass'), 'helpers.js must export feedScoreClass');
  assert.ok(helpersJs.includes('export function feedScoreLabel'), 'helpers.js must export feedScoreLabel');
  assert.ok(helpersJs.includes('export function getFeedCat'), 'helpers.js must export getFeedCat');
  assert.ok(helpersJs.includes('export function getFeedAuth'), 'helpers.js must export getFeedAuth');
  assert.ok(helpersJs.includes("from '../core/store.js'"), 'helpers.js must import feed metadata from store.js');

  // Data layer must remain pure (no presentation functions)
  assert.ok(!feedJs.includes('export function feedScoreClass'), 'feed.js must not export presentation helpers');
  assert.ok(!feedJs.includes('export function feedScoreLabel'), 'feed.js must not export presentation helpers');

  // Store getter allFeedItems must be a pure reader without lazy D().feed = mutation
  assert.ok(!storeJs.includes('D().feed = FEED_ITEMS'), 'store.js allFeedItems must not mutate D().feed in getter');

  // Feed page selects must use class="select" for design-system popover styling
  assert.ok(!feedPageJs.includes('class="input input-sm" data-in="feedScore"'), 'feed.js must use class="select"');
  assert.ok(feedPageJs.includes('class="select" data-in="feedScore"'), 'feed.js must use class="select" for score filter');
  assert.ok(feedPageJs.includes('class="select" data-in="feedCat"'), 'feed.js must use class="select" for category filter');
  assert.ok(feedPageJs.includes('class="select" data-in="feedAuth"'), 'feed.js must use class="select" for authority filter');
});

test('Regulatory Feed Pipeline Connection & Data Integrity: FIN-FSA, anonymity, English copy, and governance causality', () => {
  const feedItemsPath = path.join(ROOT, 'src/data/feed_items.json');
  assert.ok(fs.existsSync(feedItemsPath), 'src/data/feed_items.json must exist');

  const items = JSON.parse(fs.readFileSync(feedItemsPath, 'utf-8'));
  assert.ok(items.length >= 250, `Must contain rich real article dataset (found ${items.length})`);

  // Verify real articles from key Nordic authorities including FIN-FSA
  const authorities = new Set(items.map(i => i.authorityId));
  assert.ok(authorities.has('fi'), 'Must contain Finansinspektionen items');
  assert.ok(authorities.has('fiva') || authorities.has('fin-fsa'), 'Must contain FIN-FSA items');
  assert.ok(authorities.has('traficom'), 'Must contain Traficom items');
  assert.ok(authorities.has('imy'), 'Must contain IMY items');
  assert.ok(authorities.has('konsumentverket'), 'Must contain Konsumentverket items');
  assert.ok(authorities.has('eduskunta'), 'Must contain Eduskunta items');

  const fivaItems = items.filter(i => i.authorityId === 'fiva' || i.authorityId === 'fin-fsa');
  assert.ok(fivaItems.length >= 15, `Must contain substantial real FIN-FSA items (found ${fivaItems.length})`);

  // Verify Client Anonymity: NO real commercial banks in market participants
  const forbiddenBanks = ['nordea', 'swedbank', 'seb', 'handelsbanken', 'klarna'];
  for (const item of items) {
    for (const v of item.vendors || []) {
      for (const b of forbiddenBanks) {
        assert.ok(!v.toLowerCase().includes(b), `Found forbidden real bank "${b}" in vendor tag: "${v}" (item ${item.id})`);
      }
    }
  }

  // Verify 100% English Language standard across operational risks
  for (const item of items) {
    for (const r of item.risks || []) {
      assert.ok(!/[äöå]/.test(r), `Found non-English characters in risk: "${r}" (item ${item.id})`);
    }
  }

  // Verify Governance Matrix Causality: 100% of policyIds, controlIds, and riskIds match real governance items
  const validPolicies = new Set(['pol-alg-01', 'pol-dora-01', 'pol-aml-01']);
  const validControls = new Set(['ctl-alg-01', 'ctl-alg-02', 'ctl-alg-03', 'ctl-dora-01', 'ctl-dora-02', 'ctl-aml-01', 'ctl-aml-02']);
  const validRisks = new Set(['rsk-alg-01', 'rsk-dora-01', 'rsk-aml-01']);

  for (const item of items) {
    assert.ok(item.policyIds && item.policyIds.length > 0, `Item ${item.id} must have policyIds`);
    assert.ok(item.controlIds && item.controlIds.length > 0, `Item ${item.id} must have controlIds`);
    assert.ok(item.riskIds && item.riskIds.length > 0, `Item ${item.id} must have riskIds`);

    for (const p of item.policyIds) {
      assert.ok(validPolicies.has(p), `Invalid policyId "${p}" in item ${item.id}`);
    }
    for (const c of item.controlIds) {
      assert.ok(validControls.has(c), `Invalid controlId "${c}" in item ${item.id}`);
    }
    for (const r of item.riskIds) {
      assert.ok(validRisks.has(r), `Invalid riskId "${r}" in item ${item.id}`);
    }
  }

  // Verify presence of AI-extracted frameworks, vendors, risks, and real source URLs
  const withFrameworks = items.filter(i => i.frameworks && i.frameworks.length > 0);
  const withVendors = items.filter(i => i.vendors && i.vendors.length > 0);
  const withRisks = items.filter(i => i.risks && i.risks.length > 0);
  const withSourceUrl = items.filter(i => i.sourceUrl && i.sourceUrl.startsWith('http'));

  assert.ok(withFrameworks.length > 50, 'Must have AI-extracted frameworks');
  assert.ok(withVendors.length > 50, 'Must have identified market entities/vendors');
  assert.ok(withRisks.length > 50, 'Must have classified compliance risks');
  assert.ok(withSourceUrl.length > 100, 'Must have official source URLs');
});
