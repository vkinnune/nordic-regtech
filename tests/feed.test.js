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
});

test('Regulatory Feed Styling: dedicated css and import in index.css', () => {
  const indexCss = fs.readFileSync(path.join(ROOT, 'src/styles/index.css'), 'utf-8');
  assert.ok(indexCss.includes("@import './views/feed.css';"), 'index.css must import feed.css');

  const feedCss = fs.readFileSync(path.join(ROOT, 'src/styles/views/feed.css'), 'utf-8');
  assert.ok(feedCss.includes('.feed-grid'), 'feed.css must define .feed-grid');
  assert.ok(feedCss.includes('.feed-card'), 'feed.css must define .feed-card');
  assert.ok(feedCss.includes('.feed-score-5'), 'feed.css must define .feed-score-5');
});

test('Regulatory Feed Review Standards: input handlers, helpers, and escape handling', () => {
  const actionsJs = fs.readFileSync(path.join(ROOT, 'src/actions/actions.js'), 'utf-8');
  const keyboardJs = fs.readFileSync(path.join(ROOT, 'src/actions/keyboard.js'), 'utf-8');
  const feedJs = fs.readFileSync(path.join(ROOT, 'src/data/feed.js'), 'utf-8');
  const helpersJs = fs.readFileSync(path.join(ROOT, 'src/ui/helpers.js'), 'utf-8');

  // Input handlers registered
  assert.ok(actionsJs.includes('IN.feedQ'), 'actions.js must register IN.feedQ');
  assert.ok(actionsJs.includes('IN.feedCat'), 'actions.js must register IN.feedCat');
  assert.ok(actionsJs.includes('IN.feedAuth'), 'actions.js must register IN.feedAuth');

  // Keyboard Escape handler dismisses feedDrawer
  assert.ok(keyboardJs.includes('A.closeFeedDrawer()'), 'keyboard.js must dismiss S.ui.feedDrawer via A.closeFeedDrawer() on Escape');

  // Shared score helpers exported from UI layer (layer separation)
  assert.ok(helpersJs.includes('export function feedScoreClass'), 'helpers.js must export feedScoreClass');
  assert.ok(helpersJs.includes('export function feedScoreLabel'), 'helpers.js must export feedScoreLabel');
  assert.ok(helpersJs.includes('export function getFeedCat'), 'helpers.js must export getFeedCat');
  assert.ok(helpersJs.includes('export function getFeedAuth'), 'helpers.js must export getFeedAuth');

  // Data layer must remain pure (no presentation functions)
  assert.ok(!feedJs.includes('export function feedScoreClass'), 'feed.js must not export presentation helpers');
  assert.ok(!feedJs.includes('export function feedScoreLabel'), 'feed.js must not export presentation helpers');
});

test('Regulatory Feed Pipeline Connection: real RSS articles from rss-mapper-poc', () => {
  const feedItemsPath = path.join(ROOT, 'src/data/feed_items.json');
  assert.ok(fs.existsSync(feedItemsPath), 'src/data/feed_items.json must exist');

  const items = JSON.parse(fs.readFileSync(feedItemsPath, 'utf-8'));
  assert.ok(items.length >= 200, `Must contain rich real article dataset (found ${items.length})`);

  // Verify real articles from key Nordic authorities
  const authorities = new Set(items.map(i => i.authorityId));
  assert.ok(authorities.has('fi'), 'Must contain Finansinspektionen items');
  assert.ok(authorities.has('traficom'), 'Must contain Traficom items');
  assert.ok(authorities.has('imy'), 'Must contain IMY items');
  assert.ok(authorities.has('konsumentverket'), 'Must contain Konsumentverket items');
  assert.ok(authorities.has('eduskunta'), 'Must contain Eduskunta items');

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
