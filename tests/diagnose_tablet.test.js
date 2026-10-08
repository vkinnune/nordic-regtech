import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');

test('Tablet Diagnosis: finlex-tree-sec must have flex-shrink: 0 or non-shrinking display to prevent WebKit squash', () => {
  const css = fs.readFileSync(path.join(ROOT, 'src/styles/views/finlex.css'), 'utf-8');

  // Extract .finlex-tree-sec block
  const secMatch = css.match(/\.finlex-tree-sec\s*\{([^}]+)\}/);
  assert.ok(secMatch, '.finlex-tree-sec CSS rule must exist');
  const secRules = secMatch[1];

  // In WebKit, buttons inside a column flex container will squash down to 2px unless flex-shrink: 0 is explicitly set
  const hasNoShrink =
    secRules.includes('flex-shrink: 0') ||
    !css.includes('.finlex-toc-tree {\n  flex: 1;\n  overflow-y: auto;\n  padding: 8px 6px;\n  display: flex;\n  flex-direction: column;');
  assert.equal(hasNoShrink, true, '.finlex-tree-sec must have flex-shrink: 0 to prevent squashing in WebKit / iPad Safari');
});

test('Tablet Diagnosis: finlex-toc-act-label must not duplicate title when code equals shortTitle', () => {
  const js = fs.readFileSync(path.join(ROOT, 'src/pages/regulations.js'), 'utf-8');

  // Check the TOC act label template
  const match = js.match(/<div class="finlex-toc-act-label">([\s\S]*?)<\/div>/);
  assert.ok(match, 'finlex-toc-act-label block must exist');
  const labelBlock = match[1];

  // It shouldn't unconditionally print shortTitle when shortTitle === code
  const preventsDuplicate =
    labelBlock.includes('curAct.shortTitle !== curAct.code') ||
    labelBlock.includes('code !== (curAct.shortTitle') ||
    labelBlock.includes('curAct.title && curAct.shortTitle === curAct.code');
  assert.equal(preventsDuplicate, true, 'finlex-toc-act-label must deduplicate title when shortTitle equals code');
});

test('Tablet Diagnosis: finlex-toc must support collapsible toggle and responsive tablet widths', () => {
  const css = fs.readFileSync(path.join(ROOT, 'src/styles/views/finlex.css'), 'utf-8');
  const js = fs.readFileSync(path.join(ROOT, 'src/pages/regulations.js'), 'utf-8');

  // Must have a toggle action for TOC
  assert.ok(js.includes('toggleRegToc'), 'regulations.js must provide a toggleRegToc action or button');
  // CSS must support collapsed TOC
  assert.ok(css.includes('.finlex-toc.collapsed') || css.includes('.finlex-container.toc-collapsed'), 'CSS must support collapsed TOC state');
  // CSS must have tablet breakpoint for reader layout (e.g. <= 1100px)
  assert.ok(css.includes('1100px') || css.includes('1024px'), 'CSS must adjust TOC / reader layout for tablet viewports (1024px - 1100px)');
});
