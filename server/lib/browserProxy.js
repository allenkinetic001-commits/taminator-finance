import dns from 'node:dns/promises';
import net from 'node:net';
import express from 'express';

const router = express.Router();

const MAX_REDIRECTS = 5;
const MAX_BODY_BYTES = 10 * 1024 * 1024; // 10 MB
const FETCH_TIMEOUT_MS = 15000;

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata.google.internal',
  'metadata',
]);

function isPrivateIpv4(ip) {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b] = parts;
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
  if (a === 127) return true; // 127.0.0.0/8 loopback
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local / metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 0 && parts[2] === 0) return true; // 192.0.0.0/24
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15 benchmark
  if (a >= 224) return true; // multicast & reserved
  return false;
}

function isPrivateIp(ip) {
  const normalized = ip.toLowerCase().replace(/^\[|\]$/g, '');
  if (net.isIPv4(normalized)) {
    return isPrivateIpv4(normalized);
  }
  if (net.isIPv6(normalized)) {
    if (normalized === '::' || normalized === '::1') return true;
    if (normalized.startsWith('::ffff:')) {
      return isPrivateIpv4(normalized.slice(7));
    }
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true; // ULA fc00::/7
    if (/^fe[89ab][0-9a-f]:/i.test(normalized) || /^fe[89ab][0-9a-f]$/i.test(normalized)) return true; // link-local fe80::/10
    if (normalized.startsWith('ff')) return true; // multicast
    return false;
  }
  return true;
}

async function assertSafePublicUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('Invalid URL');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only HTTP and HTTPS URLs are allowed');
  }
  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!hostname || BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith('.local') || hostname.endsWith('.internal') || hostname.endsWith('.localhost')) {
    throw new Error('Access to local or internal hosts is blocked');
  }
  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      throw new Error('Access to private IP addresses is blocked');
    }
    return parsed;
  }
  const records = await dns.lookup(hostname, { all: true });
  if (!records.length) {
    throw new Error('Could not resolve hostname');
  }
  for (const rec of records) {
    if (isPrivateIp(rec.address)) {
      throw new Error('Access to private IP addresses is blocked');
    }
  }
  return parsed;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildErrorHtml(targetUrl, title, message) {
  const safeUrl = escapeHtml(targetUrl);
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeTitle}</title>
  <style>
    body {
      margin: 0;
      padding: 32px 20px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #f8fafc;
      color: #0f172a;
      display: flex;
      justify-content: center;
    }
    .card {
      max-width: 480px;
      width: 100%;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 24px;
      box-sizing: border-box;
    }
    h1 {
      margin: 0 0 8px;
      font-size: 18px;
      font-weight: 600;
    }
    p {
      margin: 0 0 16px;
      font-size: 14px;
      line-height: 1.5;
      color: #475569;
      word-break: break-word;
    }
    .btn {
      display: inline-block;
      padding: 10px 16px;
      border-radius: 8px;
      background: #0066ff;
      color: #ffffff;
      text-decoration: none;
      font-size: 14px;
      font-weight: 500;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>${safeTitle}</h1>
    <p>${safeMessage}</p>
    ${targetUrl ? `<a class="btn" href="${safeUrl}" target="_blank" rel="noopener noreferrer">Open in new tab</a>` : ''}
  </div>
</body>
</html>`;
}

function injectProxyHooks(html, finalUrl) {
  const safeBase = escapeHtml(finalUrl);
  const safeUrlJson = JSON.stringify(finalUrl).replace(/</g, '\\u003c');
  const injectedHead = `<base href="${safeBase}">
<script>
(function () {
  var CURRENT_URL = ${safeUrlJson};
  function notify(type, payload) {
    try {
      window.parent.postMessage(Object.assign({ type: type }, payload || {}), '*');
    } catch (e) {}
  }
  window.addEventListener('DOMContentLoaded', function () {
    notify('taminator-browser-loaded', { url: CURRENT_URL, title: document.title || '' });
  });
  document.addEventListener('click', function (e) {
    var anchor = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!anchor) return;
    var rawHref = anchor.getAttribute('href');
    if (!rawHref || rawHref.charAt(0) === '#' || /^javascript:/i.test(rawHref) || /^mailto:/i.test(rawHref) || /^tel:/i.test(rawHref)) {
      return;
    }
    if (anchor.target === '_blank') return;
    try {
      var resolved = new URL(rawHref, CURRENT_URL).href;
      if (/^https?:\\/\\//i.test(resolved)) {
        e.preventDefault();
        notify('taminator-browser-navigate', { url: resolved });
      }
    } catch (err) {}
  }, true);
  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (!form || form.tagName !== 'FORM') return;
    var method = (form.getAttribute('method') || 'get').toLowerCase();
    if (method !== 'get') return;
    try {
      var rawAction = form.getAttribute('action') || CURRENT_URL;
      var actionUrl = new URL(rawAction, CURRENT_URL);
      var data = new FormData(form);
      if (e.submitter && e.submitter.name) {
        data.append(e.submitter.name, e.submitter.value || '');
      }
      var params = new URLSearchParams();
      data.forEach(function (val, key) {
        if (typeof val === 'string') params.append(key, val);
      });
      actionUrl.search = params.toString();
      e.preventDefault();
      notify('taminator-browser-navigate', { url: actionUrl.href });
    } catch (err) {}
  }, true);
})();
</script>`;

  let output = html.replace(/<base\b[^>]*>/gi, '');
  if (/<head(\s[^>]*)?>/i.test(output)) {
    output = output.replace(/<head(\s[^>]*)?>/i, (match) => `${match}\n${injectedHead}`);
  } else {
    output = `${injectedHead}\n${output}`;
  }
  return output;
}

router.get('/proxy', async (req, res) => {
  const rawUrl = typeof req.query.url === 'string' ? req.query.url.trim() : '';
  if (!rawUrl) {
    return res.status(400).type('html').send(buildErrorHtml('', 'Missing URL', 'Enter a website URL to open in the browser.'));
  }

  let currentUrl;
  try {
    currentUrl = (await assertSafePublicUrl(rawUrl)).href;
  } catch (err) {
    return res.status(400).type('html').send(buildErrorHtml('', 'Blocked or invalid URL', err.message));
  }

  try {
    let response;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      response = await fetch(currentUrl, {
        method: 'GET',
        redirect: 'manual',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) break;
        const nextUrl = new URL(location, currentUrl).href;
        currentUrl = (await assertSafePublicUrl(nextUrl)).href;
        continue;
      }
      break;
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const contentLength = Number(response.headers.get('content-length') || '0');
    if (contentLength > MAX_BODY_BYTES) {
      return res.status(413).type('html').send(buildErrorHtml(currentUrl, 'Page too large', 'This resource exceeds the 10 MB preview limit. Open it in a new browser tab instead.'));
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > MAX_BODY_BYTES) {
      return res.status(413).type('html').send(buildErrorHtml(currentUrl, 'Page too large', 'This resource exceeds the 10 MB preview limit. Open it in a new browser tab instead.'));
    }

    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Proxied-URL', currentUrl);

    if (/text\/html|application\/xhtml\+xml/i.test(contentType)) {
      if (response.status === 403 || response.status === 429) {
        const text = buffer.toString('utf8');
        if (text.length < 20000 || /cloudflare|just a moment|access denied|captcha/i.test(text)) {
          return res.status(200).type('html').send(
            buildErrorHtml(
              currentUrl,
              'Site blocked embedded proxy access',
              `The destination (${currentUrl}) returned HTTP ${response.status} to server requests. Open it directly in a new tab.`
            )
          );
        }
      }
      const html = injectProxyHooks(buffer.toString('utf8'), currentUrl);
      return res.status(response.status >= 400 && response.status < 600 ? 200 : response.status)
        .set('Content-Type', 'text/html; charset=utf-8')
        .send(html);
    }

    return res.status(response.status).set('Content-Type', contentType).send(buffer);
  } catch (err) {
    return res.status(502).type('html').send(
      buildErrorHtml(currentUrl, 'Unable to load page', err?.message || 'The destination site could not be reached.')
    );
  }
});

export default router;
