import Big from 'big.js';
import createError from 'http-errors';
import crypto from 'node:crypto';

export function generateChallenge() {
  return crypto.randomBytes(64);
}

export function generateUser(id) {
  return crypto.createHash('sha1')
    .update(id)
    .digest('hex');
}

export function asyncWrapper(fn) {
  return (res, req, next) => {
    Promise.resolve(fn(res, req, next))
      .catch(next);
  };
}

function getProxyHost(req) {
  return req.get('X-Forwarded-Host')?.split(',')[0]?.trim() || req.get('Host');
}

function getCandidateOrigins(req) {
  const origins = new Set();
  const host = req.get('Host');
  const forwardedHost = req.get('X-Forwarded-Host')?.split(',')[0]?.trim();
  const forwardedProto = req.get('X-Forwarded-Proto')?.split(',')[0]?.trim();

  if (req.protocol && host) {
    origins.add(`${req.protocol}://${host}`);
  }
  if (forwardedHost) {
    origins.add(`https://${forwardedHost}`);
    if (forwardedProto) {
      origins.add(`${forwardedProto}://${forwardedHost}`);
    }
    if (req.protocol) {
      origins.add(`${req.protocol}://${forwardedHost}`);
    }
    origins.add(`http://${forwardedHost}`);
  }
  for (const envUrl of [process.env.SITE_URL, process.env.SITE_URL_TOR, process.env.APP_URL]) {
    if (envUrl) {
      try {
        origins.add(new URL(envUrl).origin);
      } catch { /* ignore invalid env url */ }
    }
  }
  for (const headerName of ['Origin', 'Referer']) {
    const headerVal = req.get(headerName);
    if (headerVal) {
      try {
        const parsed = new URL(headerVal);
        if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
          const matchesForwarded = forwardedHost && parsed.host === forwardedHost;
          const matchesHost = host && parsed.host === host;
          const isAllowedProxyOrigin = parsed.hostname.endsWith('.run.app')
            || parsed.hostname === 'localhost'
            || parsed.hostname === '127.0.0.1';
          if (matchesForwarded || matchesHost || isAllowedProxyOrigin) {
            origins.add(parsed.origin);
          }
        }
      } catch { /* ignore malformed header */ }
    }
  }
  return [...origins];
}

export function getWebAuthnConfig(req, defaultOrigins, defaultRpId) {
  const origins = new Set(defaultOrigins);
  let rpID = defaultRpId;
  const originHeader = req?.get('Origin');
  if (originHeader) {
    try {
      const parsed = new URL(originHeader);
      origins.add(parsed.origin);
      rpID = parsed.hostname;
    } catch { /* ignore */ }
  }
  const proxyHost = req ? getProxyHost(req) : undefined;
  if (proxyHost) {
    const hostname = proxyHost.split(':')[0];
    if (hostname && hostname !== 'localhost') {
      origins.add(`https://${proxyHost}`);
      if (!originHeader) {
        rpID = hostname;
      }
    } else if (hostname) {
      origins.add(`${req.protocol || 'http'}://${proxyHost}`);
    }
  }
  return {
    rpID,
    expectedOrigins: [...origins],
  };
}

export async function verifyReq(key, req) {
  try {
    const sigHeader = req.get('Signature');
    if (!sigHeader) {
      return Promise.reject(createError(401, 'Invalid signature'));
    }

    const pubKey = await crypto.webcrypto.subtle
      .importKey('raw', Buffer.from(key, 'hex'), { name: 'Ed25519' }, false, ['verify']);
    const signature = Buffer.from(sigHeader, 'hex');
    const method = req.method.toLowerCase();
    const xDate = req.get('X-Date') || '';
    const xRelease = req.get('X-Release');

    for (const origin of getCandidateOrigins(req)) {
      const base = [
        method,
        `${origin}${req.originalUrl}`,
        xDate,
      ];
      if (xRelease !== undefined) {
        base.push(xRelease);
      }
      if (req.bodyHash) {
        base.push(req.bodyHash);
      }
      const data = Buffer.from(base.join(' '), 'utf8');
      if (crypto.verify(null, data, pubKey, signature)) {
        return true;
      }
    }

    return Promise.reject(createError(401, 'Invalid signature'));
  } catch (err) {
    throw createError(400, err.message, { expose: false });
  }
}

export function mapAuthenticator(authenticator) {
  return {
    id: Buffer.from(authenticator.credentialID, 'base64url'),
    type: 'public-key',
    transports: authenticator.transports || undefined,
  };
}

export function normalizeNumber(n, decimals) {
  return Big(n).round(decimals ?? 8).toFixed();
}

export function getUserId(walletId, salt) {
  return crypto
    .createHmac('sha256', salt)
    .update(walletId)
    .digest('hex');
}
