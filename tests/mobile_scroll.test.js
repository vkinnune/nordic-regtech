import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');

test('Mobile Scroll Diagnosis: .changes-view-container must not trap or clip scroll with unconditional overflow: hidden', () => {
  const finlexCss = fs.readFileSync(path.join(ROOT, 'src/styles/views/finlex.css'), 'utf-8');
  const responsiveCss = fs.readFileSync(path.join(ROOT, 'src/styles/responsive.css'), 'utf-8');

  // Check the definition of .changes-view-container
  const match = finlexCss.match(/\.changes-view-container\s*\{([^}]+)\}/);
  assert.ok(match, '.changes-view-container must be defined in CSS');
  const rules = match[1];

  // If finlex.css defines overflow: hidden on .changes-view-container, responsive.css or finlex.css
  // must override it on mobile, OR .changes-view-container must allow overflow/scrolling
  const hasMobileOverride =
    responsiveCss.includes('.changes-view-container') ||
    finlexCss.includes('@media (max-width: 900px)') ||
    finlexCss.includes('@media (max-width: 840px)') ||
    finlexCss.includes('@media (max-width: 640px)');

  const allowsMobileScroll =
    hasMobileOverride &&
    (responsiveCss.match(/\.changes-view-container\s*\{[^}]*overflow(-y)?\s*:\s*(auto|visible)/) ||
      finlexCss.match(/@media[^{]*\{[\s\S]*?\.changes-view-container\s*\{[^}]*overflow(-y)?\s*:\s*(auto|visible)/));

  assert.ok(
    !rules.includes('overflow: hidden') || allowsMobileScroll,
    '.changes-view-container has unconditional "overflow: hidden" which locks and clips mobile scrolling. It must permit scrolling or vertical expansion on mobile viewports.',
  );
});

test('Mobile Scroll Diagnosis: .page.flush must allow vertical expansion and scrolling on mobile viewports', () => {
  const shellCss = fs.readFileSync(path.join(ROOT, 'src/styles/shell.css'), 'utf-8');
  const responsiveCss = fs.readFileSync(path.join(ROOT, 'src/styles/responsive.css'), 'utf-8');

  // In shell.css, .page.flush has height: 100%.
  // On mobile (<= 900px or <= 640px), .page.flush must allow height: auto and min-height: 100%
  // so that tall views (calendar month grid + header + filters) can scroll within .content
  const mobileSection = responsiveCss.match(/@media\s*\(max-width:\s*(900px|640px)\)\s*\{([\s\S]*?)\}(?=\s*@media|\s*$)/g) || [];
  const mobileCss = mobileSection.join('\n');

  const hasFlushOverride = mobileCss.includes('.page.flush') || shellCss.match(/@media\s*\(max-width:[^)]+\)\s*\{[\s\S]*?\.page\.flush/);

  assert.ok(
    hasFlushOverride,
    '.page.flush is locked to "height: 100%" without a mobile override. On mobile viewports (<= 900px or <= 640px), .page.flush must allow height: auto / min-height: 100% to scroll vertically.',
  );
});

test('Mobile Scroll Diagnosis: mobile calendar and changes view must have bottom clearance for .bottomnav', () => {
  const responsiveCss = fs.readFileSync(path.join(ROOT, 'src/styles/responsive.css'), 'utf-8');
  const finlexCss = fs.readFileSync(path.join(ROOT, 'src/styles/views/finlex.css'), 'utf-8');
  const allCss = responsiveCss + '\n' + finlexCss;

  // The bottom navigation bar is fixed at the bottom with height ~56px.
  // The changes page / calendar container must have bottom padding on mobile so weeks 4-6 are not hidden behind .bottomnav.
  const hasBottomClearance = allCss.match(
    /(\.changes-view-container|\.changes-cal-wrap|\.page\.flush|\.cal)[\s\S]*?padding-bottom\s*:\s*(calc\([^)]+\)|[6-9]\dpx|1\d\dpx)/,
  );

  assert.ok(
    hasBottomClearance,
    'Mobile calendar / changes view must have padding-bottom (>= 72px) to clear the fixed .bottomnav bar so the bottom weeks are fully visible.',
  );
});

test('Mobile Scroll Diagnosis: changes calendar view in changes.js must use scroll-capable container', () => {
  const changesJs = fs.readFileSync(path.join(ROOT, 'src/pages/changes.js'), 'utf-8');

  // If changes-cal-wrap is defined with overflow-y: auto in CSS, changes.js should use it,
  // or wrap calBody in a scroll-capable container
  const usesCalWrap = changesJs.includes('changes-cal-wrap') || changesJs.includes('changes-calendar-scroll') || changesJs.includes('cal-wrap');

  assert.ok(
    usesCalWrap,
    'src/pages/changes.js calendar view must be wrapped in a scroll container (like .changes-cal-wrap) so that month and week views can scroll when taller than viewport.',
  );
});
