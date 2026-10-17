import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');

test('Regulations Data Authenticity: genuine Nordic regulations and ZERO mock acts', () => {
  const regulationsJs = fs.readFileSync(path.join(ROOT, 'src/data/regulations.js'), 'utf-8');
  const swedishRegs = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/swedish_regulations.json'), 'utf-8'));

  // Ensure export is directly swedishRegs and no BASE_REGULATIONS
  assert.ok(regulationsJs.includes('export const REGULATIONS = swedishRegs;'), 'regulations.js must export swedishRegs directly');
  assert.ok(!regulationsJs.includes('BASE_REGULATIONS'), 'regulations.js must not contain BASE_REGULATIONS');

  // Verify dataset size and authentic contents
  assert.ok(swedishRegs.length >= 422, 'Must contain at least 422 authentic Swedish regulations');

  // Verify 0 mock acts in dataset
  const mockActIds = ['reg-finlex-747-2012', 'reg-sfs-2004-46', 'reg-dora', 'reg-aml', 'reg-aifm', 'reg-mifid', 'reg-sfdr'];
  for (const mockId of mockActIds) {
    const found = swedishRegs.find(r => r.id === mockId);
    assert.equal(found, undefined, `Must not contain mock act "${mockId}"`);
    assert.ok(!regulationsJs.includes(`id: '${mockId}'`), `regulations.js must not define mock act "${mockId}"`);
  }

  // Ensure every regulation belongs to an explicitly supported jurisdiction.
  const allowedJurisdictions = new Set(['Sweden (Finansinspektionen)', 'Sweden (Riksdagen)', 'Finland (Finanssivalvonta)', 'European Union (EUR-Lex)']);
  for (const reg of swedishRegs) {
    assert.ok(allowedJurisdictions.has(reg.jurisdiction), `Regulation ${reg.id} has non-Swedish jurisdiction: ${reg.jurisdiction}`);
  }

  // Ensure every regulation belongs to an explicitly supported authority.
  const allowedAuthorities = new Set(['Finansinspektionen (FI)', 'Riksdagen', 'Finanssivalvonta (FIVA)', 'EUR-Lex (Publications Office)']);
  for (const reg of swedishRegs) {
    assert.ok(allowedAuthorities.has(reg.authority), `Regulation ${reg.id} has non-Swedish authority: ${reg.authority}`);
  }
});

test('Regulations Section Authenticity: ZERO mock sections or synthetic AI kill switches', () => {
  const swedishRegs = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/swedish_regulations.json'), 'utf-8'));

  // Collect all sections across all regulations
  const allSections = [];
  for (const reg of swedishRegs) {
    if (reg.chapters) {
      for (const ch of reg.chapters) {
        if (ch.sections) {
          allSections.push(...ch.sections);
        }
      }
    }
  }

  assert.ok(allSections.length > 5000, `Must contain thousands of authentic sections (found ${allSections.length})`);

  // Verify ZERO mock section IDs
  const mockSecIds = ['sfs-1-100', 'finlex-1-1', 'finlex-1-9', 'dora-28', 'dora-art-28', 'aml-3-1', 'aml-2-1'];
  for (const mockSec of mockSecIds) {
    const found = allSections.find(s => s.id === mockSec);
    assert.equal(found, undefined, `Must not contain mock section "${mockSec}"`);
  }

  // Verify that real SFS 2004:46 contains 317 authentic sections and NO synthetic AI kill switch section 100 §
  const sfs2004 = swedishRegs.find(r => r.id === 'sfs-2004-46');
  assert.ok(sfs2004, 'Must contain real SFS 2004:46');
  const sfsSecs = (sfs2004.chapters || []).flatMap(c => c.sections || []);
  assert.equal(sfsSecs.length, 317, 'SFS 2004:46 must contain exactly 317 authentic sections');

  const killSwitchSec = sfsSecs.find(s => (s.heading || '').includes('artificiell intelligens') || (s.text || '').includes('automated kill switch'));
  assert.equal(killSwitchSec, undefined, 'SFS 2004:46 must NOT contain fake AI kill-switch section');
});

test('Regulations Shell & Reader Defaults: sfs-2004-46 as authentic default regulation', () => {
  const layoutJs = fs.readFileSync(path.join(ROOT, 'src/shell/layout.js'), 'utf-8');
  const regPageJs = fs.readFileSync(path.join(ROOT, 'src/pages/regulations.js'), 'utf-8');
  const drawerJs = fs.readFileSync(path.join(ROOT, 'src/overlays/drawer.js'), 'utf-8');

  // Must not reference reg-finlex-747-2012
  assert.ok(!layoutJs.includes('reg-finlex-747-2012'), 'layout.js must not reference reg-finlex-747-2012');
  assert.ok(!regPageJs.includes('reg-finlex-747-2012'), 'regulations.js must not reference reg-finlex-747-2012');
  assert.ok(!drawerJs.includes('reg-finlex-747-2012'), 'drawer.js must not reference reg-finlex-747-2012');

  // Must default to sfs-2004-46
  assert.ok(layoutJs.includes("u.regSel || 'sfs-2004-46'"), 'layout.js must default to sfs-2004-46');
  assert.ok(regPageJs.includes("u.regSel || 'sfs-2004-46'"), 'regulations.js must default to sfs-2004-46');
  assert.ok(drawerJs.includes("reg ? reg.id : 'sfs-2004-46'"), 'drawer.js must fallback to sfs-2004-46');
});

test('Regulations Authorities & Legal Tiers: supported authorities and authentic legal tiers', () => {
  const regulationsJs = fs.readFileSync(path.join(ROOT, 'src/data/regulations.js'), 'utf-8');

  // Ensure the supported authorities are available in REGULATION_AUTHORITIES.
  assert.ok(regulationsJs.includes("id: 'fi', label: 'Finansinspektionen (FI)'"), 'Must include Finansinspektionen');
  assert.ok(regulationsJs.includes("id: 'riksdagen', label: 'Riksdagen / Parliament'"), 'Must include Riksdagen');
  assert.ok(!regulationsJs.includes("id: 'fin-fsa'"), 'Must not include FIN-FSA');
  assert.ok(regulationsJs.includes("id: 'fiva', label: 'Finanssivalvonta (FIVA)'"), 'Must include FIN-FSA');
  assert.ok(regulationsJs.includes("id: 'eu', label: 'EUR-Lex (European Union)'"), 'Must include EUR-Lex');

  // Ensure REGULATION_TIERS has authentic tiers
  assert.ok(regulationsJs.includes("id: 'act', label: 'Parliamentary Acts (SFS)'"), 'Must include Parliamentary Acts');
  assert.ok(regulationsJs.includes("id: 'supervisory', label: 'Supervisory Regulations (FFFS / FIVA)'"), 'Must include Supervisory Regulations');
  assert.ok(!regulationsJs.includes("id: 'eu', label: 'EU Directives"), 'Must not include EU Directives tier');
});

test('Governance Matrix Linkages: 100% authentic Swedish section IDs', () => {
  const govJs = fs.readFileSync(path.join(ROOT, 'src/data/governance.js'), 'utf-8');
  const swedishRegs = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/swedish_regulations.json'), 'utf-8'));

  // Build section ID lookup from swedishRegs
  const sectionLookup = new Map();
  for (const reg of swedishRegs) {
    if (reg.chapters) {
      for (const ch of reg.chapters) {
        if (ch.sections) {
          for (const s of ch.sections) {
            sectionLookup.set(s.id, reg.id);
          }
        }
      }
    }
  }

  // Ensure NO mock section IDs appear in governance.js
  const forbiddenMockIds = ['finlex-1-9', 'sfs-1-100', 'dora-28', 'sfs-1-1', 'aml-3-1', 'aml-3-2'];
  for (const m of forbiddenMockIds) {
    assert.ok(!govJs.includes(`'${m}'`), `governance.js must not contain mock section ID "${m}"`);
  }

  // Verify that all authentic section IDs in governance.js exist in swedish_regulations.json
  const requiredSwedishSections = [
    'riksdagen_sfs-2007-528_k14_p1',
    'riksdagen_sfs-2007-528_k13_p7',
    'riksdagen_sfs-2004-297_k6_p2a',
    'riksdagen_sfs-2004-46_k2_p17c',
    'riksdagen_sfs-2017-630_k3_p1',
    'riksdagen_sfs-2017-630_k4_p1',
  ];

  for (const secId of requiredSwedishSections) {
    assert.ok(govJs.includes(`'${secId}'`), `governance.js must reference authentic section "${secId}"`);
    assert.ok(sectionLookup.has(secId), `Section "${secId}" must exist in swedish_regulations.json`);
  }

  // Ensure authorities in risks are Finansinspektionen
  assert.ok(!govJs.includes('FIN-FSA'), 'governance.js must not reference FIN-FSA');
  assert.ok(!govJs.includes('European Supervisory Authorities'), 'governance.js must not reference ESAs');
});

test('Projects & Seed Integrity: 100% authentic Swedish statutes and ZERO Finnish or EU projects', () => {
  const seedJs = fs.readFileSync(path.join(ROOT, 'src/data/seed.js'), 'utf-8');

  // Forbidden project titles
  assert.ok(!seedJs.includes('Sijoituspalvelulaki'), 'seed.js must not contain Sijoituspalvelulaki');
  assert.ok(!seedJs.includes('747/2012'), 'seed.js must not contain 747/2012');
  assert.ok(!seedJs.includes("name: 'Regulation (EU)"), 'seed.js must not contain Regulation (EU) project');
  assert.ok(!seedJs.includes("name: 'SFDR"), 'seed.js must not contain SFDR project');
  assert.ok(!seedJs.includes('Fiva'), 'seed.js must not reference Fiva');

  // Required Swedish projects
  assert.ok(seedJs.includes('SFS 2004:46 · Värdepappersfonder'), 'Must include SFS 2004:46 project');
  assert.ok(seedJs.includes('SFS 2004:297 · Bank- och finansiering'), 'Must include SFS 2004:297 project');
  assert.ok(seedJs.includes('SFS 2017:630 · Penningtvättslagen'), 'Must include SFS 2017:630 project');
  assert.ok(seedJs.includes('FFFS 2013:9 · AIFM-Föreskrifter'), 'Must include FFFS 2013:9 project');
  assert.ok(seedJs.includes('SFS 2007:528 · Värdepappersmarknaden'), 'Must include SFS 2007:528 project');
  assert.ok(seedJs.includes('SFS 2013:561 · Alternativa fonder'), 'Must include SFS 2013:561 project');
});

test('Regulations UI & View Engine: Nordic authority segmentation and country filters', () => {
  const regPageJs = fs.readFileSync(path.join(ROOT, 'src/pages/regulations.js'), 'utf-8');
  const viewEngineJs = fs.readFileSync(path.join(ROOT, 'src/shell/view-engine.js'), 'utf-8');
  const storeJs = fs.readFileSync(path.join(ROOT, 'src/core/store.js'), 'utf-8');

  // Verify UI copy and segmented controls in regulations.js
  assert.ok(regPageJs.includes('Nordic financial regulations from Sweden and Finland'), 'Must have Nordic library subtitle');
  assert.ok(regPageJs.includes('Swedish & Finnish rules'), 'Must have Nordic regulations metric label');
  assert.ok(regPageJs.includes('Finansinspektionen (${fffsCount})'), 'Must have Finansinspektionen segment tab');
  assert.ok(regPageJs.includes('Riksdagen Acts (${sfsCount})'), 'Must have Riksdagen Acts segment tab');
  assert.ok(regPageJs.includes('data-k="regLibAuth"'), 'Must use regLibAuth data-k attribute on segment buttons');
  assert.ok(regPageJs.includes('Finanssivalvonta (FIVA) (${fivaCount})'), 'Must have FIN-FSA segment button');
  assert.ok(regPageJs.includes('European Union (${euCount})'), 'Must have EU segment button');

  // Verify view-engine has no legacy jurisdiction field in REG_FIELDS
  assert.ok(!viewEngineJs.includes('jurisdiction: {'), 'view-engine.js must not define jurisdiction in REG_FIELDS');
  assert.ok(viewEngineJs.includes("f.f !== 'jurisdiction'"), 'view-engine.js must sanitize legacy jurisdiction filters');

  // Verify store version bump and cache sanitization
  assert.ok(storeJs.includes("STORE_KEY = 'regtech.studio.v8'"), 'store.js must be bumped to v8');
  assert.ok(storeJs.includes('regtech.studio.v7'), 'store.js must purge legacy v7 cache');

  // Verify English naming and single-word sidemenu label standards
  const constantsJs = fs.readFileSync(path.join(ROOT, 'src/core/constants.js'), 'utf-8');
  const layoutJs = fs.readFileSync(path.join(ROOT, 'src/shell/layout.js'), 'utf-8');
  const renderJs = fs.readFileSync(path.join(ROOT, 'src/shell/render.js'), 'utf-8');
  const regJs = fs.readFileSync(path.join(ROOT, 'src/data/regulations.js'), 'utf-8');

  assert.ok(constantsJs.includes("name: 'Swedish Parliament'"), 'constants.js must use Swedish Parliament');
  assert.ok(!constantsJs.includes("'Sveriges Riksdag'"), 'constants.js must not contain Sveriges Riksdag');
  assert.ok(layoutJs.includes("sItem('mytasks', 'Assigned'"), 'layout.js must use single-word Assigned label');
  assert.ok(renderJs.includes("mytasks: 'Assigned'"), 'render.js must use single-word Assigned label');
  assert.ok(!regJs.includes('FRAMEWORK_MAPPINGS'), 'regulations.js must not contain FRAMEWORK_MAPPINGS');
});

test('Complete Purge of rss-mapper-poc: strictly 100% RegTech Swedish law dataset and zero feed artifacts', () => {
  // 1. Verify files are completely deleted from filesystem
  assert.ok(!fs.existsSync(path.join(ROOT, 'src/pages/feed.js')), 'src/pages/feed.js must be deleted');
  assert.ok(!fs.existsSync(path.join(ROOT, 'src/data/feed.js')), 'src/data/feed.js must be deleted');
  assert.ok(!fs.existsSync(path.join(ROOT, 'src/data/feed_items.json')), 'src/data/feed_items.json must be deleted');
  assert.ok(!fs.existsSync(path.join(ROOT, 'src/styles/views/feed.css')), 'src/styles/views/feed.css must be deleted');
  assert.ok(!fs.existsSync(path.join(ROOT, 'pipeline/ingest_rss_feed.py')), 'pipeline/ingest_rss_feed.py must be deleted');
  assert.ok(!fs.existsSync(path.join(ROOT, 'pipeline/tests/test_feed_ingest.py')), 'pipeline/tests/test_feed_ingest.py must be deleted');

  // 2. Verify layout, router and index.css have no feed references
  const layoutJs = fs.readFileSync(path.join(ROOT, 'src/shell/layout.js'), 'utf-8');
  const renderJs = fs.readFileSync(path.join(ROOT, 'src/shell/render.js'), 'utf-8');
  const actionsJs = fs.readFileSync(path.join(ROOT, 'src/actions/actions.js'), 'utf-8');
  const indexCss = fs.readFileSync(path.join(ROOT, 'src/styles/index.css'), 'utf-8');
  const packageJson = fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8');
  const seedJs = fs.readFileSync(path.join(ROOT, 'src/data/seed.js'), 'utf-8');
  const regPageJs = fs.readFileSync(path.join(ROOT, 'src/pages/regulations.js'), 'utf-8');

  assert.ok(!layoutJs.includes('pageFeed'), 'layout.js must not reference pageFeed');
  assert.ok(!layoutJs.includes("sItem('feed'"), 'layout.js must not contain feed sidebar item');
  assert.ok(!renderJs.includes("feed: 'Feed'"), 'render.js must not register feed route name');
  assert.ok(!actionsJs.includes('openRegFromFramework'), 'actions.js must not contain openRegFromFramework');
  assert.ok(!indexCss.includes('feed.css'), 'index.css must not import feed.css');
  assert.ok(!packageJson.includes('feed:ingest'), 'package.json must not have feed:ingest script');
  assert.ok(!seedJs.includes('Resiliens och IT-drift'), 'seed.js must not contain Swedish task titles');
  assert.ok(!seedJs.includes("'Penningtvätt'"), 'seed.js must not contain Swedish search terms');
  assert.ok(!regPageJs.includes('regLibJuris'), 'regulations.js must not contain obsolete regLibJuris fallback');
});

test('Regulations Feature: Zero mock controls or policies in header, cards, list, or reader', () => {
  const regPageJs = fs.readFileSync(path.join(ROOT, 'src/pages/regulations.js'), 'utf-8');
  const viewEngineJs = fs.readFileSync(path.join(ROOT, 'src/shell/view-engine.js'), 'utf-8');
  const regJs = fs.readFileSync(path.join(ROOT, 'src/data/regulations.js'), 'utf-8');
  const storeJs = fs.readFileSync(path.join(ROOT, 'src/core/store.js'), 'utf-8');

  // Must not have mock stats in header
  assert.ok(!regPageJs.includes('Governing Policies'), 'regulations.js must not display Governing Policies stat');
  assert.ok(!regPageJs.includes('Enforcing Controls'), 'regulations.js must not display Enforcing Controls stat');
  assert.ok(!regPageJs.includes('linked compliance standards'), 'regulations.js must not display linked compliance standards');
  assert.ok(!regPageJs.includes('operational safeguards'), 'regulations.js must not display operational safeguards');

  // Must have authentic statutory breakdown
  assert.ok(regPageJs.includes('Acts & Ordinances'), 'regulations.js must display Acts & Ordinances metric');
  assert.ok(regPageJs.includes('Supervisory Rules'), 'regulations.js must display Supervisory Rules metric');

  // Must not decorate cards or table with mock governance badges
  assert.ok(!regPageJs.includes('finlex-gov-badge'), 'regulations.js must not render finlex-gov-badge');
  assert.ok(!regPageJs.includes('linkedControlsCount'), 'regulations.js must not reference linkedControlsCount');
  assert.ok(!regPageJs.includes('linkedPoliciesCount'), 'regulations.js must not reference linkedPoliciesCount');

  // Must not render section governance strip in reader
  assert.ok(!regPageJs.includes('renderSectionGovernanceStrip'), 'regulations.js must not call or define renderSectionGovernanceStrip');
  assert.ok(!regPageJs.includes('finlex-gov-strip'), 'regulations.js must not render finlex-gov-strip');

  // Must not have mock sort boost or gov filter
  assert.ok(!viewEngineJs.includes('item.linkedControlsCount'), 'view-engine.js must not boost linkedControlsCount');
  assert.ok(!viewEngineJs.includes('REGULATION_GOV_SCOPES'), 'view-engine.js must not reference REGULATION_GOV_SCOPES');
  assert.ok(!storeJs.includes('REGULATION_GOV_SCOPES'), 'store.js must not export REGULATION_GOV_SCOPES');
  assert.ok(!regJs.includes('REGULATION_GOV_SCOPES'), 'regulations.js must not define REGULATION_GOV_SCOPES');
  assert.ok(regJs.includes("label: 'Relevance'"), 'regulations.js must use clean Relevance sort label');

  // Must not render Plain English toggle or plain English box
  assert.ok(!regPageJs.includes('Plain English'), 'regulations.js must not contain Plain English button or label');
  assert.ok(!regPageJs.includes('toggleRegPlain'), 'regulations.js must not contain toggleRegPlain');
  assert.ok(!regPageJs.includes('finlex-plain-box'), 'regulations.js must not contain finlex-plain-box');
  const actionsJs = fs.readFileSync(path.join(ROOT, 'src/actions/actions.js'), 'utf-8');
  assert.ok(!actionsJs.includes('A.toggleRegPlain'), 'actions.js must not define A.toggleRegPlain');

  // Must not render repetitive Binding Rule badges, only highlight General Guidance exceptions
  assert.ok(!regPageJs.includes('Binding Rule'), 'regulations.js must not contain Binding Rule badge');
  assert.ok(!regPageJs.includes('Binding rule'), 'regulations.js must not contain Binding rule badge');
  assert.ok(regPageJs.includes('General Guidance · comply or explain'), 'regulations.js must preserve General Guidance badge for advisory rules');
});

test('Table of Contents: chapter outline, zero trailing hyphens, and intermediate heading deduplication', () => {
  const regPageJs = fs.readFileSync(path.join(ROOT, 'src/pages/regulations.js'), 'utf-8');
  const actionsJs = fs.readFileSync(path.join(ROOT, 'src/actions/actions.js'), 'utf-8');
  const css = fs.readFileSync(path.join(ROOT, 'src/styles/views/finlex.css'), 'utf-8');

  // Verify chapter and outline helpers
  assert.ok(regPageJs.includes('formatChapterNo'), 'regulations.js must define formatChapterNo');
  assert.ok(regPageJs.includes('formatChapterTitle'), 'regulations.js must define formatChapterTitle');
  assert.ok(regPageJs.includes('finlex-outline-item'), 'regulations.js must render finlex-outline-item');
  assert.ok(regPageJs.includes('finlex-mellanrubrik'), 'regulations.js must render finlex-mellanrubrik');

  // Zero dumb trailing hyphens
  assert.ok(!regPageJs.includes('${esc(ch.number)} - ${esc(ch.title)}'), 'Must not render trailing hyphen on chapters without titles');
  assert.ok(!regPageJs.includes('${esc(s.number)} - ${esc(heading)}'), 'Must not render trailing hyphen on sections without headings');

  // Interactive TOC outline navigation
  assert.ok(actionsJs.includes('A.scrollToChap'), 'actions.js must register A.scrollToChap');
  assert.ok(actionsJs.includes('A.toggleRegTocExpand'), 'actions.js must register A.toggleRegTocExpand');
  assert.ok(actionsJs.includes('A.toggleChapExpand'), 'actions.js must register A.toggleChapExpand');

  // CSS outline styles
  assert.ok(css.includes('.finlex-outline-item'), 'finlex.css must define .finlex-outline-item');
  assert.ok(css.includes('.finlex-outline-row'), 'finlex.css must define .finlex-outline-row');
  assert.ok(css.includes('.finlex-mellanrubrik'), 'finlex.css must define .finlex-mellanrubrik');
});
