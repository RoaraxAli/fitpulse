'use strict';

const crypto = require('crypto');
const { promisify } = require('util');
const config = require('./config');
const { getDb, toObjectId } = require('./db');

const scryptAsync = promisify(crypto.scrypt);
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64, maxmem: 96 * 1024 * 1024 };

// ---------------------------------------------------------------------------
// Passwords (scrypt, built into Node — no external crypto dependency)
// ---------------------------------------------------------------------------
async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scryptAsync(String(password), salt, SCRYPT.keylen, SCRYPT);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${key.toString('base64')}`;
}

async function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return false;
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, N, r, p, saltB64, hashB64] = parts;
  const salt = Buffer.from(saltB64, 'base64');
  const expected = Buffer.from(hashB64, 'base64');
  try {
    const key = await scryptAsync(String(password), salt, expected.length, {
      N: Number(N),
      r: Number(r),
      p: Number(p),
      maxmem: SCRYPT.maxmem,
    });
    return key.length === expected.length && crypto.timingSafeEqual(key, expected);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// JWT (HS256, implemented with node:crypto)
// ---------------------------------------------------------------------------
const b64url = (value) => Buffer.from(value).toString('base64url');
const fromB64url = (value) => Buffer.from(value, 'base64url');

function signToken(user) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64url(
    JSON.stringify({
      sub: String(user._id),
      username: user.username,
      iat: now,
      exp: now + config.jwtTtlSeconds,
    })
  );
  const data = `${header}.${payload}`;
  const signature = crypto.createHmac('sha256', config.jwtSecret).update(data).digest('base64url');
  return `${data}.${signature}`;
}

function verifyToken(token) {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;
  const data = `${header}.${payload}`;
  const expected = crypto.createHmac('sha256', config.jwtSecret).update(data).digest();
  let provided;
  try {
    provided = fromB64url(signature);
  } catch {
    return null;
  }
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) return null;
  try {
    const decoded = JSON.parse(fromB64url(payload).toString('utf8'));
    if (!decoded || typeof decoded.exp !== 'number' || decoded.exp < Math.floor(Date.now() / 1000)) return null;
    return decoded;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Cookies
// ---------------------------------------------------------------------------
function parseCookies(header = '') {
  const out = {};
  String(header)
    .split(';')
    .forEach((part) => {
      const eq = part.indexOf('=');
      if (eq === -1) return;
      const key = part.slice(0, eq).trim();
      if (!key) return;
      try {
        out[key] = decodeURIComponent(part.slice(eq + 1).trim());
      } catch {
        out[key] = part.slice(eq + 1).trim();
      }
    });
  return out;
}

const cookieAttributes = () =>
  `Path=/; SameSite=Lax; ${config.isProduction ? '' : ''}`.trim();

function authCookie(token, maxAge = config.jwtTtlSeconds) {
  return `${config.cookieName}=${encodeURIComponent(token)}; HttpOnly; ${cookieAttributes()}; Max-Age=${maxAge}`;
}

function clearAuthCookie() {
  return `${config.cookieName}=; HttpOnly; ${cookieAttributes()}; Max-Age=0`;
}

function extractToken(req) {
  const header = req.headers.authorization || '';
  if (header.toLowerCase().startsWith('bearer ')) return header.slice(7).trim();
  return parseCookies(req.headers.cookie || '')[config.cookieName] || null;
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
async function attachUser(req, res, next) {
  try {
    const token = extractToken(req);
    if (token) {
      const payload = verifyToken(token);
      const id = payload && toObjectId(payload.sub);
      if (id) {
        const user = await getDb().collection('users').findOne({ _id: id });
        if (user) {
          req.user = user;
          req.token = token;
        }
      }
    }
  } catch {
    // Anonymous access continues; protected routes will reject.
  }
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: { code: 'unauthorized', message: 'Please sign in to continue.' } });
  }
  return next();
}

module.exports = {
  hashPassword,
  verifyPassword,
  signToken,
  verifyToken,
  parseCookies,
  extractToken,
  authCookie,
  clearAuthCookie,
  attachUser,
  requireAuth,
};
