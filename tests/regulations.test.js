import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');

test('Regulations Data Authenticity: 100% genuine Swedish regulations and ZERO mock acts', () => {
  const regulationsJs = fs.readFileSync(path.join(ROOT, 'src/data/regulations.js'), 'utf-8');
  const swedishRegs = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/swedish_regulations.json'), 'utf-8'));

  // Ensure export is directly swedishRegs and no BASE_REGULATIONS
  assert.ok(regulationsJs.includes('export const REGULATIONS = swedishRegs;'), 'regulations.js must export swedishRegs directly');
  assert.ok(!regulationsJs.includes('BASE_REGULATIONS'), 'regulations.js must not contain BASE_REGULATIONS');

  // Verify dataset size and authentic contents
  assert.equal(swedishRegs.length, 422, 'Must contain 422 authentic Swedish regulations');

  // Verify 0 mock acts in dataset
  const mockActIds = ['reg-finlex-747-2012', 'reg-sfs-2004-46', 'reg-dora', 'reg-aml', 'reg-aifm', 'reg-mifid', 'reg-sfdr'];
  for (const mockId of mockActIds) {
    const found = swedishRegs.find(r => r.id === mockId);
    assert.equal(found, undefined, `Must not contain mock act "${mockId}"`);
    assert.ok(!regulationsJs.includes(`id: '${mockId}'`), `regulations.js must not define mock act "${mockId}"`);
  }

  // Ensure 100% of regulations belong to Swedish jurisdictions
  const allowedJurisdictions = new Set(['Sweden (Finansinspektionen)', 'Sweden (Riksdagen)']);
  for (const reg of swedishRegs) {
    assert.ok(allowedJurisdictions.has(reg.jurisdiction), `Regulation ${reg.id} has non-Swedish jurisdiction: ${reg.jurisdiction}`);
  }

  // Ensure 100% of regulations belong to Swedish authorities
  const allowedAuthorities = new Set(['Finansinspektionen (FI)', 'Riksdagen']);
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

test('Regulations Authorities & Legal Tiers: strictly Swedish supervisory authorities and national tiers', () => {
  const regulationsJs = fs.readFileSync(path.join(ROOT, 'src/data/regulations.js'), 'utf-8');

  // Ensure REGULATION_AUTHORITIES only has Swedish authorities
  assert.ok(regulationsJs.includes("id: 'fi', label: 'Finansinspektionen (FI)'"), 'Must include Finansinspektionen');
  assert.ok(regulationsJs.includes("id: 'riksdagen', label: 'Riksdagen / Parliament'"), 'Must include Riksdagen');
  assert.ok(!regulationsJs.includes("id: 'fin-fsa'"), 'Must not include FIN-FSA');
  assert.ok(!regulationsJs.includes("id: 'eu'"), 'Must not include European Union in REGULATION_AUTHORITIES');

  // Ensure REGULATION_TIERS has authentic tiers
  assert.ok(regulationsJs.includes("id: 'act', label: 'Parliamentary Acts (SFS)'"), 'Must include Parliamentary Acts');
  assert.ok(regulationsJs.includes("id: 'supervisory', label: 'Supervisory Regulations (FFFS)'"), 'Must include Supervisory Regulations');
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

test('Regulations UI & View Engine: Swedish authority segmentation and ZERO Finnish/EU jurisdiction filters', () => {
  const regPageJs = fs.readFileSync(path.join(ROOT, 'src/pages/regulations.js'), 'utf-8');
  const viewEngineJs = fs.readFileSync(path.join(ROOT, 'src/shell/view-engine.js'), 'utf-8');
  const storeJs = fs.readFileSync(path.join(ROOT, 'src/core/store.js'), 'utf-8');

  // Verify UI copy and segmented controls in regulations.js
  assert.ok(regPageJs.includes('Swedish financial statutory library and supervisory regulations'), 'Must have Swedish library subtitle');
  assert.ok(regPageJs.includes('Swedish acts & FFFS circulars'), 'Must have Swedish acts metric label');
  assert.ok(regPageJs.includes('Finansinspektionen (${fffsCount})'), 'Must have Finansinspektionen segment tab');
  assert.ok(regPageJs.includes('Riksdagen Acts (${sfsCount})'), 'Must have Riksdagen Acts segment tab');
  assert.ok(!regPageJs.includes('>Finland</button>'), 'Must not have Finland segment button');
  assert.ok(!regPageJs.includes('>European Union</button>'), 'Must not have European Union segment button');

  // Verify view-engine has no legacy jurisdiction field in REG_FIELDS
  assert.ok(!viewEngineJs.includes('jurisdiction: {'), 'view-engine.js must not define jurisdiction in REG_FIELDS');
  assert.ok(viewEngineJs.includes("f.f !== 'jurisdiction'"), 'view-engine.js must sanitize legacy jurisdiction filters in viewOf');

  // Verify store version bump and cache sanitization
  assert.ok(storeJs.includes("STORE_KEY = 'regtech.studio.v8'"), 'store.js must be bumped to v8');
  assert.ok(storeJs.includes('regtech.studio.v7'), 'store.js must purge legacy v7 cache');
});
