import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');

test('Regulations Mobile Crash: swedish_regulations.json must not exceed mobile memory budget (< 16 MB)', () => {
  const filePath = path.join(ROOT, 'src/data/swedish_regulations.json');
  assert.ok(fs.existsSync(filePath), 'src/data/swedish_regulations.json must exist');

  const stat = fs.statSync(filePath);
  const sizeMb = stat.size / (1024 * 1024);

  // 30MB JSON creates a 21MB JS bundle which crashes mobile Safari (Jetsam OOM SIGKILL).
  // It must be optimized under 16 MB.
  assert.ok(
    sizeMb < 16,
    `src/data/swedish_regulations.json is ${sizeMb.toFixed(2)} MB, exceeding the mobile memory safety limit (16 MB). It must be optimized to prevent mobile Safari WebProcess crash.`,
  );
});

test('Regulations Mobile Crash: renderRegulationsLibrary must not reallocate 20,000 section objects on every render', () => {
  const regPageJs = fs.readFileSync(path.join(ROOT, 'src/pages/regulations.js'), 'utf-8');

  // renderRegulationsLibrary should not call allSectionsOf in reduce and map loops over all 423 acts
  const hasHeavyReduce = regPageJs.includes('allActs.reduce((sum, a) => sum + allSectionsOf(a).length');
  const hasHeavyMap =
    regPageJs.includes('allActs.map(r => {\n    const secs = allSectionsOf(r);') ||
    regPageJs.includes('allActs.map(r => {\r\n    const secs = allSectionsOf(r);');

  assert.ok(
    !hasHeavyReduce && !hasHeavyMap,
    'renderRegulationsLibrary creates tens of thousands of shallow-copied section objects in reduce/map loops. It must use lightweight length checks or cached section counts.',
  );
});

test('Regulations Mobile Crash: regulations library must window/paginate cards to prevent DOM node memory explosion', () => {
  const regPageJs = fs.readFileSync(path.join(ROOT, 'src/pages/regulations.js'), 'utf-8');

  // The library view must have a card limit / pagination (e.g. regLibLimit or loadMoreRegs or PAGE_SIZE)
  // rather than dumping all 423 complex card articles (6,500+ DOM nodes) into innerHTML at once
  const hasWindowing =
    regPageJs.includes('regLibLimit') || regPageJs.includes('loadMoreRegs') || regPageJs.includes('REG_PAGE_SIZE') || regPageJs.includes('renderedActs');

  assert.ok(
    hasWindowing,
    'renderRegulationsGrid renders all 423 cards (6,500+ DOM nodes) into innerHTML simultaneously, causing mobile WebKit memory exhaustion. It must paginate or window cards.',
  );
});

test('Regulations Mobile Crash: allSectionsOf in regulations.js must cache section lists', () => {
  const regJs = fs.readFileSync(path.join(ROOT, 'src/data/regulations.js'), 'utf-8');

  // allSectionsOf should cache its results on the regulation object rather than recreating arrays on every call
  const hasCache = regJs.includes('_cachedSections') || regJs.includes('_sections') || regJs.includes('reg._secs');

  assert.ok(
    hasCache,
    'allSectionsOf in src/data/regulations.js must cache section arrays on the regulation object to avoid repeated thousands-object allocations.',
  );
});
