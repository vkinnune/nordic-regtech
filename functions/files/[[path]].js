import { DOC_MANIFEST } from '../doc_manifest.js';

export async function onRequest(context) {
  const { request, params } = context;
  const rawPath = Array.isArray(params.path) ? params.path.join('/') : params.path || '';

  // Match e.g. fi_fffs/fffs-2026-24/regulation.pdf or fffs-2026-24/regulation.pdf
  const parts = rawPath.split('/');
  let docId = null;
  let fileType = 'pdf';

  for (const part of parts) {
    if (part.startsWith('fffs-') || part.startsWith('sfs-')) {
      docId = part.replace(/\.[^/.]+$/, '').toLowerCase();
      break;
    }
  }

  const lastPart = parts[parts.length - 1].toLowerCase();
  if (lastPart.includes('memo')) {
    fileType = 'memo';
  } else if (lastPart.endsWith('.html') || lastPart.endsWith('.json')) {
    fileType = 'raw';
  }

  if (!docId || !DOC_MANIFEST[docId]) {
    return new Response(JSON.stringify({ error: `File not found: ${rawPath}` }), {
      status: 404,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  const doc = DOC_MANIFEST[docId];
  let targetUrl = null;

  if (fileType === 'pdf') {
    targetUrl = doc.pdfUrl;
  } else if (fileType === 'memo') {
    targetUrl = doc.memoUrl;
  } else {
    targetUrl = doc.sourceUrl || (doc.isSfs ? `https://data.riksdagen.se/dokument/${docId}.html` : null);
  }

  if (!targetUrl) {
    return new Response(JSON.stringify({ error: `No asset available for ${rawPath}` }), {
      status: 404,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  try {
    const upstream = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: fileType === 'raw' ? 'text/html,*/*' : 'application/pdf,*/*',
      },
    });

    if (!upstream.ok) {
      return new Response(JSON.stringify({ error: `Upstream error: ${upstream.status}` }), {
        status: upstream.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const headers = new Headers();
    headers.set('Content-Type', upstream.headers.get('Content-Type') || (fileType === 'raw' ? 'text/html; charset=utf-8' : 'application/pdf'));
    headers.set('Cache-Control', 'public, max-age=604800, immutable');
    headers.set('Access-Control-Allow-Origin', '*');

    if (request.method === 'HEAD') {
      return new Response(null, { status: 200, headers });
    }

    return new Response(upstream.body, { status: 200, headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: `Network error: ${err.message}` }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
