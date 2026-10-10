// Edge gate: Cloudflare Pages Functions middleware for password protection
const DEFAULT_PASSWORD = 'nordic2026';
const DEFAULT_USERNAME = 'admin';
const COOKIE_NAME = 'nordic_auth_token';

async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str + ':nordic-regtech-salt'));
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function getCookie(request, name) {
  const header = request.headers.get('Cookie');
  if (!header) return null;
  const parts = header.split(';');
  for (const part of parts) {
    const [k, v] = part.trim().split('=');
    if (k === name) return v;
  }
  return null;
}

function renderLockScreen(errorMessage = '') {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>Nordic RegTech · Access Restricted</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&display=swap" rel="stylesheet" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: #090d16;
      color: #f1f5f9;
      font-family: 'Geist', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px;
      -webkit-font-smoothing: antialiased;
    }
    .card {
      width: 100%;
      max-width: 380px;
      background: #111726;
      border: 1px solid rgba(255, 255, 255, 0.08);
      box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.6);
      border-radius: 14px;
      padding: 32px 28px;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .brand-icon {
      width: 34px;
      height: 34px;
      border-radius: 8px;
      background: #1e293b;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    .brand-title {
      font-size: 15px;
      font-weight: 600;
      color: #f8fafc;
      letter-spacing: -0.01em;
    }
    .brand-subtitle {
      font-size: 12px;
      color: #94a3b8;
    }
    .header h1 {
      font-size: 20px;
      font-weight: 600;
      letter-spacing: -0.02em;
      color: #ffffff;
      margin-bottom: 6px;
    }
    .header p {
      font-size: 13.5px;
      color: #94a3b8;
      line-height: 1.45;
    }
    .alert-error {
      background: rgba(239, 68, 68, 0.12);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #fca5a5;
      font-size: 13px;
      border-radius: 8px;
      padding: 10px 12px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    form {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .field {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    label {
      font-size: 12.5px;
      font-weight: 500;
      color: #cbd5e1;
    }
    input[type="password"] {
      background: #0a0f1d;
      border: 1px solid #1e293b;
      border-radius: 8px;
      color: #f8fafc;
      font-size: 14px;
      padding: 10px 14px;
      outline: none;
      transition: border-color 0.15s, box-shadow 0.15s;
      width: 100%;
    }
    input[type="password"]:focus {
      border-color: #3b82f6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
    }
    .btn {
      background: #2563eb;
      color: #ffffff;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      padding: 11px 16px;
      cursor: pointer;
      transition: background-color 0.15s, transform 0.05s;
    }
    .btn:hover {
      background: #1d4ed8;
    }
    .btn:active {
      transform: scale(0.99);
    }
    .footer {
      text-align: center;
      font-size: 12px;
      color: #64748b;
      margin-top: 16px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="brand">
      <div class="brand-icon">
        <svg width="20" height="20" viewBox="0 0 332 332" fill="none">
          <path d="M99.1 184.6C94 182.4 85.7 181.1 76.3 179.8C69.5 178.8 67.8 178.4 67.8 176.2C67.8 174.3 69.5 173.6 76.9 173.5C99.2 173.3 105.3 167.4 105.3 156.3C105.3 150.8 103.4 146.5 97.9 144.2L107.2 142.5L107.4 131H79.5C52.3 131 47.9 142.5 47.9 152.4C47.9 160.3 49.7 166.5 57.7 170.1C49.5 171.5 46.6 174.6 46.6 179.9C46.6 188.2 55.4 189.7 67.3 191.5C76.8 192.9 86.1 192.8 86.1 197.6C86.1 200.2 83.9 202.3 77.8 202.3C68.4 202.3 67.7 199 67.5 195.1H46C46 209.5 53 216.5 77.7 216.5C101.9 216.5 107.8 206.9 107.8 197C107.8 190.5 104.9 187 99.1 184.6ZM67.5 145.6H84.7V161.7H67.5V145.6Z" fill="#38bdf8"/>
          <path d="M131.1 138.3L127.4 131H115.1V191.2H137.2V161.2C137.2 153.5 138.9 147.6 152 149.1V129.9C140.2 128.9 134.7 132.4 131.1 138.3Z" fill="#38bdf8"/>
        </svg>
      </div>
      <div>
        <div class="brand-title">Nordic RegTech</div>
        <div class="brand-subtitle">Statutory Compliance Studio</div>
      </div>
    </div>

    <div class="header">
      <h1>Private Preview</h1>
      <p>This workspace is restricted to authorized personnel. Enter your password to continue.</p>
    </div>

    ${
      errorMessage
        ? `<div class="alert-error">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <span>${errorMessage}</span>
      </div>`
        : ''
    }

    <form method="POST" action="">
      <div class="field">
        <label for="password">Access Password</label>
        <input type="password" id="password" name="password" required autofocus autocomplete="current-password" placeholder="Enter password" />
      </div>
      <button type="submit" class="btn">Unlock Workspace</button>
    </form>
  </div>
  <div class="footer">
    © 2026 Nordic RegTech · Stockholm & Helsinki
  </div>
</body>
</html>`;
}

export async function onRequest(context) {
  const { request, next, env } = context;
  const url = new URL(request.url);

  // Allow static favicon and document serving endpoints
  if (url.pathname === '/favicon.svg' || url.pathname.startsWith('/doc/') || url.pathname.startsWith('/files/')) {
    return next();
  }

  const expectedPassword = env.AUTH_PASSWORD || DEFAULT_PASSWORD;
  const expectedUsername = env.AUTH_USERNAME || DEFAULT_USERNAME;
  const validToken = await sha256(expectedPassword);

  // Logout handling
  if (url.searchParams.has('logout')) {
    url.searchParams.delete('logout');
    return new Response(null, {
      status: 302,
      headers: {
        Location: url.pathname,
        'Set-Cookie': `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
      },
    });
  }

  // 1. Check HTTP Basic Auth header if present
  const authHeader = request.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Basic ')) {
    try {
      const decoded = atob(authHeader.slice(6));
      const [u, p] = decoded.split(':');
      if (p === expectedPassword && (!expectedUsername || u === expectedUsername)) {
        return next();
      }
    } catch {
      // invalid header, proceed to check cookie/form
    }
  }

  // 2. Check session cookie
  const cookieToken = getCookie(request, COOKIE_NAME);
  if (cookieToken && cookieToken === validToken) {
    return next();
  }

  // 3. Handle login POST request
  if (request.method === 'POST') {
    try {
      const formData = await request.formData();
      const submittedPassword = formData.get('password') || '';
      if (submittedPassword === expectedPassword) {
        return new Response(null, {
          status: 302,
          headers: {
            Location: url.pathname + url.search,
            'Set-Cookie': `${COOKIE_NAME}=${validToken}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`, // 30 days
          },
        });
      }
      return new Response(renderLockScreen('Incorrect password. Please try again.'), {
        status: 401,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    } catch {
      return new Response(renderLockScreen('Submission error. Please try again.'), {
        status: 400,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }
  }

  // 4. Return lock screen for unauthenticated GET requests
  return new Response(renderLockScreen(), {
    status: 401,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
