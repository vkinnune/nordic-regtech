import { DOC_MANIFEST } from '../../doc_manifest.js';

export async function onRequest(context) {
  const { request, params } = context;
  const id = (params.id || '').toLowerCase().trim();
  const type = (params.type || '').toLowerCase().trim();

  const doc = DOC_MANIFEST[id];
  if (!doc) {
    return new Response(JSON.stringify({ error: `Document not found: ${id}` }), {
      status: 404,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  // 1. PDF handler: /doc/{id}/pdf
  if (type === 'pdf') {
    let pdfUrl = doc.pdfUrl;
    if (!pdfUrl && doc.isSfs) {
      pdfUrl = `https://data.riksdagen.se/dokument/${id}.html`;
    }
    if (!pdfUrl) {
      return new Response(JSON.stringify({ error: `No PDF available for ${id}` }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    try {
      const upstream = await fetch(pdfUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'application/pdf,*/*',
        },
      });

      if (!upstream.ok) {
        return new Response(JSON.stringify({ error: `Upstream error fetching PDF: ${upstream.status}` }), {
          status: upstream.status,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const headers = new Headers();
      headers.set('Content-Type', upstream.headers.get('Content-Type') || 'application/pdf');
      headers.set('Content-Disposition', `inline; filename="${id}.pdf"`);
      headers.set('Cache-Control', 'public, max-age=604800, immutable');
      headers.set('Access-Control-Allow-Origin', '*');
      // Intentionally do NOT set or forward X-Frame-Options: SAMEORIGIN so iframe preview works!

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

  // 2. Decision Memo handler: /doc/{id}/memo
  if (type === 'memo') {
    const memoUrl = doc.memoUrl;
    if (!memoUrl) {
      return new Response(JSON.stringify({ error: `No decision memo available for ${id}` }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    try {
      const upstream = await fetch(memoUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'application/pdf,*/*',
        },
      });

      if (!upstream.ok) {
        return new Response(JSON.stringify({ error: `Upstream error fetching memo: ${upstream.status}` }), {
          status: upstream.status,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const headers = new Headers();
      headers.set('Content-Type', upstream.headers.get('Content-Type') || 'application/pdf');
      headers.set('Content-Disposition', `inline; filename="${id}_memo.pdf"`);
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

  // 3. Raw source handler: /doc/{id}/raw
  if (type === 'raw') {
    let rawUrl = doc.sourceUrl;
    if (doc.isSfs) {
      rawUrl = `https://data.riksdagen.se/dokument/${id}.html`;
    }

    if (!rawUrl) {
      return new Response(JSON.stringify({ error: `No raw source available for ${id}` }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    try {
      const upstream = await fetch(rawUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/json,*/*',
        },
      });

      if (!upstream.ok) {
        return new Response(JSON.stringify({ error: `Upstream error: ${upstream.status}` }), {
          status: upstream.status,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const headers = new Headers();
      headers.set('Content-Type', upstream.headers.get('Content-Type') || 'text/html; charset=utf-8');
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

  return new Response(JSON.stringify({ error: `Unknown document type: ${type}` }), {
    status: 404,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}
