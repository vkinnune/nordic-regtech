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

  // Verify Swedish authorities and categories are present
  assert.ok(feedJs.includes('Finansinspektionen'), 'Must include Finansinspektionen');
  assert.ok(feedJs.includes('Sveriges Riksdag'), 'Must include Riksdagen');
  assert.ok(feedJs.includes('Swedish Consumer Agency'), 'Must include Swedish Consumer Agency');
  assert.ok(feedJs.includes('Swedish Privacy Authority'), 'Must include Swedish Privacy Authority');
  assert.ok(feedJs.includes('Sveriges Riksbank'), 'Must include Sveriges Riksbank');
  assert.ok(feedJs.includes('Swedish Courts'), 'Must include Swedish Courts');

  // Ensure Finnish and EU authorities are purged
  assert.ok(!feedJs.includes('FIN-FSA'), 'Must not include FIN-FSA');
  assert.ok(!feedJs.includes('European Banking Authority'), 'Must not include EBA');
  assert.ok(!feedJs.includes('Traficom'), 'Must not include Traficom');
  assert.ok(!feedJs.includes('Eduskunta'), 'Must not include Eduskunta');

  assert.ok(feedJs.includes('AMENDMENT'), 'Must include AMENDMENT category');
  assert.ok(feedJs.includes('CIRCULAR'), 'Must include CIRCULAR category');
  assert.ok(feedJs.includes('ENFORCEMENT'), 'Must include ENFORCEMENT category');
});

test('Regulatory Feed Shell & Router: navigation and route registration', () => {
  const layoutJs = fs.readFileSync(path.join(ROOT, 'src/shell/layout.js'), 'utf-8');
  const renderJs = fs.readFileSync(path.join(ROOT, 'src/shell/render.js'), 'utf-8');

  // Route registration
  assert.ok(renderJs.includes("feed: 'Feed'"), 'render.js must register feed route name');
  assert.ok(renderJs.includes("feed: 'newspaper'") || renderJs.includes("feed: 'rss'"), 'render.js must register feed route icon');

  // Page handler
  assert.ok(layoutJs.includes('feed: pageFeed'), 'layout.js must map feed route to pageFeed');

  // Sidebar item
  assert.ok(layoutJs.includes("sItem('feed', 'Feed'"), 'layout.js sidebar must contain Feed item');
});

test('Regulatory Feed Actions: drawer, assessment, and filtering', () => {
  const actionsJs = fs.readFileSync(path.join(ROOT, 'src/actions/actions.js'), 'utf-8');

  assert.ok(actionsJs.includes('A.openFeedDrawer'), 'actions.js must define A.openFeedDrawer');
  assert.ok(actionsJs.includes('A.closeFeedDrawer'), 'actions.js must define A.closeFeedDrawer');
  assert.ok(actionsJs.includes('A.ackFeedItem'), 'actions.js must define A.ackFeedItem');
  assert.ok(actionsJs.includes('A.clearFeedFilters'), 'actions.js must define A.clearFeedFilters');
  assert.ok(!actionsJs.includes('A.createTaskFromFeed'), 'actions.js must not define synthetic A.createTaskFromFeed');
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

test('Regulatory Feed Pipeline Connection & Data Integrity: 100% Swedish supervisory stream, anonymity, English copy, and governance causality', () => {
  const feedItemsPath = path.join(ROOT, 'src/data/feed_items.json');
  assert.ok(fs.existsSync(feedItemsPath), 'src/data/feed_items.json must exist');

  const items = JSON.parse(fs.readFileSync(feedItemsPath, 'utf-8'));
  assert.ok(items.length >= 250, `Must contain rich real article dataset (found ${items.length})`);

  // Assert 100% of feed items have jurisdiction === 'SE'
  assert.ok(
    items.every(i => i.jurisdiction === 'SE'),
    '100% of items in feed_items.json must have jurisdiction === "SE"',
  );

  // Exactly 0 items from Finnish or EU authorities exist
  const authorities = new Set(items.map(i => i.authorityId));
  assert.ok(!authorities.has('fiva'), 'Must not contain FIN-FSA items');
  assert.ok(!authorities.has('fin-fsa'), 'Must not contain FIN-FSA items');
  assert.ok(!authorities.has('traficom'), 'Must not contain Traficom items');
  assert.ok(!authorities.has('eduskunta'), 'Must not contain Eduskunta items');
  assert.ok(!authorities.has('tulli'), 'Must not contain Tulli items');
  assert.ok(!authorities.has('tietosuoja'), 'Must not contain Tietosuoja items');
  assert.ok(!authorities.has('eba'), 'Must not contain EBA items');
  assert.ok(!authorities.has('esma'), 'Must not contain ESMA items');

  const nonSweItems = items.filter(i => i.jurisdiction !== 'SE');
  assert.equal(nonSweItems.length, 0, 'Must contain exactly 0 non-Swedish items');

  // Verify real articles from Swedish authorities
  assert.ok(authorities.has('fi'), 'Must contain Finansinspektionen items');
  assert.ok(authorities.has('riksdagen'), 'Must contain Riksdagen items');
  assert.ok(authorities.has('imy'), 'Must contain IMY items');
  assert.ok(authorities.has('konsumentverket'), 'Must contain Konsumentverket items');
  assert.ok(authorities.has('riksbank'), 'Must contain Riksbank items');
  assert.ok(authorities.has('domstol'), 'Must contain Domstol items');

  const fiItems = items.filter(i => i.authorityId === 'fi');
  assert.ok(fiItems.length >= 50, `Must contain substantial real Finansinspektionen items (found ${fiItems.length})`);

  // Every article traces to authentic Swedish regulator URLs
  const swedishDomains = new Set([
    'www.fi.se',
    'www.government.se',
    'data.riksdagen.se',
    'www.imy.se',
    'www.konsumentverket.se',
    'www.riksbank.se',
    'www.domstol.se',
  ]);
  for (const item of items) {
    assert.ok(item.sourceUrl && item.sourceUrl.startsWith('http'), `Item ${item.id} must have a valid source URL`);
    const parsedUrl = new URL(item.sourceUrl);
    assert.ok(swedishDomains.has(parsedUrl.hostname), `Item ${item.id} has unauthorized host: ${parsedUrl.hostname}`);
  }

  // Verify Client Anonymity: NO real commercial banks in title, summary, or vendors
  const forbiddenBanks = ['nordea', 'swedbank', 'seb', 'handelsbanken', 'klarna', 'aktia', 'danske'];
  for (const item of items) {
    for (const b of forbiddenBanks) {
      const re = new RegExp(`\\b${b}\\b`, 'i');
      assert.ok(!re.test(item.title), `Found forbidden real bank "${b}" in title: "${item.title}" (item ${item.id})`);
      assert.ok(!re.test(item.summary), `Found forbidden real bank "${b}" in summary: "${item.summary}" (item ${item.id})`);
    }
    for (const v of item.vendors || []) {
      for (const b of forbiddenBanks) {
        const re = new RegExp(`\\b${b}\\b`, 'i');
        assert.ok(!re.test(v), `Found forbidden real bank "${b}" in vendor tag: "${v}" (item ${item.id})`);
      }
    }
  }

  // Verify 100% English Language standard across titles, summaries, and operational risks
  for (const item of items) {
    assert.ok(!/[äöåÄÖÅ]/.test(item.title), `Found non-English characters in title: "${item.title}" (item ${item.id})`);
    assert.ok(!/[äöåÄÖÅ]/.test(item.summary), `Found non-English characters in summary: "${item.summary}" (item ${item.id})`);
    for (const r of item.risks || []) {
      assert.ok(!/[äöåÄÖÅ]/.test(r), `Found non-English characters in risk: "${r}" (item ${item.id})`);
    }
    for (const v of item.vendors || []) {
      assert.ok(!/[äöåÄÖÅ]/.test(v), `Found non-English characters in vendor: "${v}" (item ${item.id})`);
    }
  }

  // Verify Score 1 (Informational) items exist in dataset
  const score1Items = items.filter(i => i.score === 1);
  assert.ok(score1Items.length >= 5, `Must have calibrated Score 1 (Informational) items (found ${score1Items.length})`);

  // Verify Zero Synthetic Mock Fields: 100% of feed items contain ZERO fake statutory links, governance links, tasks, or boilerplate
  const mockKeys = ['statuteId', 'statuteSec', 'statuteRef', 'policyIds', 'controlIds', 'riskIds', 'plainEnglish', 'taskId'];
  for (const item of items) {
    for (const key of mockKeys) {
      assert.equal(item[key], undefined, `Item ${item.id} must not contain synthetic mock field "${key}"`);
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

  // Verify UI Exposure: Swedish authority segmentation in feed page toolbar and stats strip
  const feedPageJs = fs.readFileSync(path.join(ROOT, 'src/pages/feed.js'), 'utf-8');
  assert.ok(feedPageJs.includes('data-k="feedAuthSeg" data-v="all"'), 'Toolbar must have All segment');
  assert.ok(feedPageJs.includes('data-k="feedAuthSeg" data-v="fi"'), 'Toolbar must have FI segment');
  assert.ok(feedPageJs.includes('data-k="feedAuthSeg" data-v="riksdagen"'), 'Toolbar must have Riksdagen segment');
  assert.ok(feedPageJs.includes('data-k="feedAuthSeg" data-v="consumer_imy"'), 'Toolbar must have Consumer / IMY segment');
  assert.ok(feedPageJs.includes('data-k="feedAuthSeg" data-v="riksbank"'), 'Toolbar must have Riksbank segment');
  assert.ok(feedPageJs.includes('Finansinspektionen'), 'Toolbar must display Finansinspektionen');
  assert.ok(feedPageJs.includes('Consumer / IMY'), 'Toolbar must display Consumer / IMY');

  // Verify stats strip has Swedish supervisory metrics without FI/EU counters
  assert.ok(!feedPageJs.includes('${euCount}'), 'Stats strip must not contain euCount');
  assert.ok(!feedPageJs.includes('FIN-FSA'), 'Stats strip must not contain FIN-FSA');
  assert.ok(!feedPageJs.includes('EU Directives & Cross-Border'), 'Stats strip must not contain EU Directives card');
  assert.ok(feedPageJs.includes('100% Swedish supervisory stream'), 'Stats strip must indicate Swedish supervisory stream');
  assert.ok(feedPageJs.includes('FSA supervisory notices'), 'Stats strip must indicate FSA supervisory notices');
  assert.ok(feedPageJs.includes('Riksdagen & Agencies'), 'Stats strip must include Riksdagen & Agencies');
});

test('Regulatory Feed Unslop & Regulation Navigation: pure real data, authentic explanations, and 1-click reader jumps', () => {
  const feedItemsPath = path.join(ROOT, 'src/data/feed_items.json');
  const items = JSON.parse(fs.readFileSync(feedItemsPath, 'utf-8'));
  const drawerJs = fs.readFileSync(path.join(ROOT, 'src/overlays/drawer.js'), 'utf-8');
  const feedPageJs = fs.readFileSync(path.join(ROOT, 'src/pages/feed.js'), 'utf-8');
  const actionsJs = fs.readFileSync(path.join(ROOT, 'src/actions/actions.js'), 'utf-8');
  const regulationsJs = fs.readFileSync(path.join(ROOT, 'src/data/regulations.js'), 'utf-8');

  // 1. Zero synthetic mock kill-switch items
  for (const item of items) {
    assert.notEqual(item.id, 'feed-sfs-2026-916', 'Must not have mock anchor item feed-sfs-2026-916');
    assert.ok(!item.summary.toLowerCase().includes('kill switch'), `Must not have fake kill-switch text in summary of ${item.id}`);
    assert.ok(!item.title.toLowerCase().includes('automated kill switches'), `Must not have fake kill-switch text in title of ${item.id}`);
  }

  // 2. All items carry authentic compliance explanation from the upstream pipeline
  const withExplanation = items.filter(i => i.explanation && i.explanation.trim().length > 10);
  assert.ok(withExplanation.length >= 250, `Substantially all items must have authentic compliance explanation (found ${withExplanation.length})`);

  // 3. Drawer HTML must be unslopped with zero mock governance/statute sections
  assert.ok(!drawerJs.includes('Supervisory Synopsis'), 'drawer.js must not contain "Supervisory Synopsis"');
  assert.ok(!drawerJs.includes('feed-analysis-grid'), 'drawer.js must not contain the 3-box feed-analysis-grid boilerplate');
  assert.ok(!drawerJs.includes('Executive Impact Assessment'), 'drawer.js must not contain fake "Executive Impact Assessment"');
  assert.ok(!drawerJs.includes('Internal Governance Matrix Linkages'), 'drawer.js must not contain mock governance matrix linkages');
  assert.ok(!drawerJs.includes('Statutory Citation & Direct Reader Link'), 'drawer.js must not contain mock statutory linkage');
  assert.ok(!drawerJs.includes('createTaskFromFeed'), 'drawer.js must not contain createTaskFromFeed');
  assert.ok(drawerJs.includes('Summary'), 'drawer.js must contain clean Summary header');
  assert.ok(drawerJs.includes('Compliance & Supervisory Impact'), 'drawer.js must contain Compliance & Supervisory Impact');
  assert.ok(drawerJs.includes('Official Supervisory Source'), 'drawer.js must contain Official Supervisory Source');
  assert.ok(drawerJs.includes('feed-explanation-box'), 'drawer.js must use clean feed-explanation-box');
  assert.ok(drawerJs.includes('data-a="openRegFromFramework"'), 'drawer.js must render clickable framework buttons');

  // 4. Feed page cards and list view must have zero mock tasks/statutes and have clickable framework buttons
  assert.ok(!feedPageJs.includes('feed-statute-pill'), 'feed.js must not contain mock feed-statute-pill');
  assert.ok(!feedPageJs.includes('createTaskFromFeed'), 'feed.js must not contain mock createTaskFromFeed');
  assert.ok(feedPageJs.includes('data-a="openRegFromFramework" data-fw="${esc(fw)}"'), 'Feed cards must have clickable framework buttons');
  assert.ok(feedPageJs.includes('Official notice ↗'), 'Feed cards must have direct link to official notice');
  assert.ok(feedPageJs.includes('data-a="openRegFromFramework" data-fw="${esc(item.frameworks[0])}"'), 'Feed list must have clickable framework tag buttons');

  // 5. Actions and Regulations mapping integrity
  assert.ok(actionsJs.includes('A.openRegFromFramework'), 'actions.js must define A.openRegFromFramework');
  assert.ok(regulationsJs.includes('export function resolveFrameworkToRegulation'), 'regulations.js must export resolveFrameworkToRegulation');
});
