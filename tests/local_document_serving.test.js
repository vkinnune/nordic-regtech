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

  const withPdf = regs.filter(r => r.localPdf || r.pdfUrl);
  const withMemo = regs.filter(r => r.localMemo || r.memoUrl);
  const withSource = regs.filter(r => r.localSource || r.sourceUrl);

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

test('Local Document Serving: Cloudflare Pages Functions routes serve documents directly', () => {
  const docHandlerPath = path.join(ROOT, 'functions/doc/[id]/[type].js');
  const filesHandlerPath = path.join(ROOT, 'functions/files/[[path]].js');
  const manifestPath = path.join(ROOT, 'functions/doc_manifest.js');
  const middlewarePath = path.join(ROOT, 'functions/_middleware.js');

  assert.ok(fs.existsSync(docHandlerPath), 'functions/doc/[id]/[type].js must exist');
  assert.ok(fs.existsSync(filesHandlerPath), 'functions/files/[[path]].js must exist');
  assert.ok(fs.existsSync(manifestPath), 'functions/doc_manifest.js must exist');

  const docHandlerJs = fs.readFileSync(docHandlerPath, 'utf-8');
  assert.ok(docHandlerJs.includes("type === 'pdf'"), 'Must handle PDF requests');
  assert.ok(docHandlerJs.includes("type === 'memo'"), 'Must handle Memo requests');
  assert.ok(docHandlerJs.includes("type === 'raw'"), 'Must handle Raw requests');
  assert.ok(docHandlerJs.includes('application/pdf'), 'Must return application/pdf');

  const middlewareJs = fs.readFileSync(middlewarePath, 'utf-8');
  assert.ok(middlewareJs.includes("url.pathname.startsWith('/doc/')"), 'Must bypass lock screen for /doc/');
  assert.ok(middlewareJs.includes("url.pathname.startsWith('/files/')"), 'Must bypass lock screen for /files/');
});

test('Local Document Serving: regulations reader renders clean local attachments with zero online external links', () => {
  const regPageJs = fs.readFileSync(path.join(ROOT, 'src/pages/regulations.js'), 'utf-8');

  assert.ok(regPageJs.includes('/doc/${esc(curAct.id)}/pdf'), 'Must link to /doc/{id}/pdf');
  assert.ok(regPageJs.includes('/doc/${esc(curAct.id)}/memo'), 'Must link to /doc/{id}/memo');
  assert.ok(regPageJs.includes('/doc/${esc(curAct.id)}/raw'), 'Must link to /doc/{id}/raw');
  assert.ok(regPageJs.includes('data-a="previewDoc"'), 'Must provide previewDoc trigger');

  // Verify zero external online links in the attachments toolbar
  assert.ok(!regPageJs.includes('finlex-attach-sublink'), 'Must not render online external sublinks');
  assert.ok(!regPageJs.includes('Official Page'), 'Must not render external Official Page link in attachments');
});

test('Local Document Serving: actions and modals support document previewer', () => {
  const actionsJs = fs.readFileSync(path.join(ROOT, 'src/actions/actions.js'), 'utf-8');
  const modalsJs = fs.readFileSync(path.join(ROOT, 'src/overlays/modals.js'), 'utf-8');

  assert.ok(actionsJs.includes('A.previewDoc'), 'actions.js must register A.previewDoc');
  assert.ok(modalsJs.includes('previewDocModal'), 'modals.js must export previewDocModal');
  assert.ok(modalsJs.includes("case 'previewDoc':"), 'modalHtml must handle previewDoc');
});

test('Diff Engine: Newly added sections do not duplicate entire section text in an accordion', () => {
  const diffJs = fs.readFileSync(path.join(ROOT, 'src/ui/diff.js'), 'utf-8');
  assert.ok(!diffJs.includes('View newly added statutory text'), 'Must not duplicate added text in an accordion');
});
