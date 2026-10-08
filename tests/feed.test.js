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
  assert.ok(actionsJs.includes('A.setFeedJuris'), 'actions.js must define A.setFeedJuris');
});

test('Regulatory Feed Styling: dedicated css and import in index.css', () => {
  const indexCss = fs.readFileSync(path.join(ROOT, 'src/styles/index.css'), 'utf-8');
  assert.ok(indexCss.includes("@import './views/feed.css';"), 'index.css must import feed.css');

  const feedCss = fs.readFileSync(path.join(ROOT, 'src/styles/views/feed.css'), 'utf-8');
  assert.ok(feedCss.includes('.feed-grid'), 'feed.css must define .feed-grid');
  assert.ok(feedCss.includes('.feed-card'), 'feed.css must define .feed-card');
  assert.ok(feedCss.includes('.feed-score-5'), 'feed.css must define .feed-score-5');
});
