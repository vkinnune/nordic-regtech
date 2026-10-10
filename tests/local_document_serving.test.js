import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');

test('Local Document Serving: swedish_regulations.json maps local assets for offline serving', () => {
  const filePath = path.join(ROOT, 'src/data/swedish_regulations.json');
  assert.ok(fs.existsSync(filePath), 'swedish_regulations.json must exist');

  const regs = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const fffsRegs = regs.filter(r => r.code && r.code.startsWith('FFFS'));
  assert.ok(fffsRegs.length > 300, 'Must have > 300 FFFS circulars');

  const withPdf = regs.filter(r => r.localPdf);
  const withMemo = regs.filter(r => r.localMemo);
  const withSource = regs.filter(r => r.localSource);

  assert.ok(withPdf.length >= 350, `Expected >= 350 local PDFs, got ${withPdf.length}`);
  assert.ok(withMemo.length >= 300, `Expected >= 300 local decision memos, got ${withMemo.length}`);
  assert.ok(withSource.length >= 400, `Expected >= 400 local source docs, got ${withSource.length}`);
});

test('Local Document Serving: vite.config.js proxies /files, /doc, and /api to regtech backend', () => {
  const viteConfig = fs.readFileSync(path.join(ROOT, 'vite.config.js'), 'utf-8');

  assert.ok(viteConfig.includes("'/files'"), 'vite.config.js must proxy /files');
  assert.ok(viteConfig.includes("'/doc'"), 'vite.config.js must proxy /doc');
  assert.ok(viteConfig.includes("'/api'"), 'vite.config.js must proxy /api');
  assert.ok(viteConfig.includes('8000'), 'vite.config.js proxy target must be port 8000');
});

test('Local Document Serving: regulations reader renders local PDF, memo, raw, and preview actions', () => {
  const regPageJs = fs.readFileSync(path.join(ROOT, 'src/pages/regulations.js'), 'utf-8');

  assert.ok(regPageJs.includes('curAct.localPdf'), 'Must handle curAct.localPdf');
  assert.ok(regPageJs.includes('curAct.localMemo'), 'Must handle curAct.localMemo');
  assert.ok(regPageJs.includes('curAct.localSource'), 'Must handle curAct.localSource');
  assert.ok(regPageJs.includes('/doc/${esc(curAct.id)}/pdf'), 'Must link to /doc/{id}/pdf');
  assert.ok(regPageJs.includes('/doc/${esc(curAct.id)}/memo'), 'Must link to /doc/{id}/memo');
  assert.ok(regPageJs.includes('/doc/${esc(curAct.id)}/raw'), 'Must link to /doc/{id}/raw');
  assert.ok(regPageJs.includes('data-a="previewDoc"'), 'Must provide previewDoc trigger');
});

test('Local Document Serving: actions and modals support document previewer', () => {
  const actionsJs = fs.readFileSync(path.join(ROOT, 'src/actions/actions.js'), 'utf-8');
  const modalsJs = fs.readFileSync(path.join(ROOT, 'src/overlays/modals.js'), 'utf-8');

  assert.ok(actionsJs.includes('A.previewDoc'), 'actions.js must register A.previewDoc');
  assert.ok(modalsJs.includes('previewDocModal'), 'modals.js must export previewDocModal');
  assert.ok(modalsJs.includes("case 'previewDoc':"), 'modalHtml must handle previewDoc');
});
