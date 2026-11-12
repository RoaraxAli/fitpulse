'use strict';

// Google Sign-In (OAuth 2.0 authorization code flow) implemented with node:crypto
// and the built-in fetch. No SDK, no extra dependencies.
const crypto = require('crypto');
const express = require('express');
const config = require('../config');
const { getDb } = require('../db');
const { signToken, authCookie } = require('../auth');
const { defaultSettings } = require('./auth');
const { notify } = require('../services/notifications');
const logger = require('../utils/logger');

const router = express.Router();

const AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const KEYS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const STATE_TTL_MS = 10 * 60 * 1000;
const SCOPES = 'openid email profile';

const googleConfigured = () => Boolean(config.googleClientId && config.googleClientSecret && config.googleRedirectUri);

const b64url = (value) => Buffer.from(value).toString('base64url');

function signState(payload) {
  const body = b64url(JSON.stringify(payload));
  const signature = crypto.createHmac('sha256', `${config.jwtSecret}:google-state`).update(body).digest('base64url');
  return `${body}.${signature}`;
}

function verifyState(value) {
  if (typeof value !== 'string' || !value.includes('.')) return null;
  const [body, signature] = value.split('.');
  if (!body || !signature) return null;
  const expected = crypto.createHmac('sha256', `${config.jwtSecret}:google-state`).update(body).digest();
  let provided;
  try {
    provided = Buffer.from(signature, 'base64url');
  } catch {
    return null;
  }
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) return null;
  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!payload || typeof payload.t !== 'number' || payload.t > Date.now() + 60_000) return null;
  if (Date.now() - payload.t > STATE_TTL_MS) return null;
  return payload;
}

function safeNext(value) {
  const next = typeof value === 'string' ? value : '';
  if (/^\/[A-Za-z0-9_\-/?=&%.]*$/.test(next) && !next.startsWith('//')) return next;
  return '/dashboard';
}

// ---------------------------------------------------------------------------
// ID token verification (RS256 against Google's published JWKS)
// ---------------------------------------------------------------------------
let keyCache = { fetchedAt: 0, keys: [] };

async function signingKeys() {
  if (keyCache.keys.length && Date.now() - keyCache.fetchedAt < 60 * 60 * 1000) return keyCache.keys;
  const response = await fetch(KEYS_URL, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error('Could not reach Google to verify the sign-in.');
  const data = await response.json();
  keyCache = { fetchedAt: Date.now(), keys: Array.isArray(data.keys) ? data.keys : [] };
  return keyCache.keys;
}

async function verifyIdToken(idToken) {
  const parts = String(idToken || '').split('.');
  if (parts.length !== 3) throw new Error('Google returned an unreadable token.');
  const [headerB64, payloadB64, signatureB64] = parts;

  const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8'));
  const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  if (header.alg !== 'RS256') throw new Error('Unexpected Google token algorithm.');

  const keys = await signingKeys();
  const jwk = keys.find((key) => key.kid === header.kid) || (keys.length === 1 ? keys[0] : null);
  if (!jwk) throw new Error('Google signing key not found.');
  const publicKey = crypto.createPublicKey({ key: jwk, format: 'jwk' });
  const signatureOk = crypto.verify(
    'RSA-SHA256',
    Buffer.from(`${headerB64}.${payloadB64}`),
    publicKey,
    Buffer.from(signatureB64, 'base64url')
  );
  if (!signatureOk) throw new Error('Google token signature did not verify.');

  const now = Math.floor(Date.now() / 1000);
  const issuers = ['accounts.google.com', 'https://accounts.google.com'];
  if (payload.aud !== config.googleClientId) throw new Error('That Google token was issued for another application.');
  if (!issuers.includes(payload.iss)) throw new Error('Unexpected Google token issuer.');
  if (typeof payload.exp !== 'number' || payload.exp < now) throw new Error('That Google sign-in has expired.');
  if (!payload.sub || typeof payload.sub !== 'string') throw new Error('Google did not return an account id.');
  if (!payload.email || payload.email_verified !== true) throw new Error('Your Google email address is not verified.');
  return payload;
}

// ---------------------------------------------------------------------------
// Account mapping
// ---------------------------------------------------------------------------
async function uniqueUsername(db, email, name) {
  const base = String(email || name || 'fitpulse')
    .split('@')[0]
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 14);
  const stem = base.length >= 3 ? base : `${base}fit`.slice(0, 20);
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const candidate = attempt === 0 ? stem : `${stem}${crypto.randomInt(1000, 9999)}`.slice(0, 20);
    const taken = await db.collection('users').findOne({ username: candidate }, { projection: { _id: 1 } });
    if (!taken) return candidate;
  }
  return `fit${crypto.randomBytes(6).toString('hex')}`.slice(0, 20);
}

async function findOrCreateUser(profile) {
  const db = getDb();
  const email = String(profile.email).toLowerCase();
  const now = new Date();

  let user = await db.collection('users').findOne({
    $or: [{ googleId: profile.sub }, { email }],
  });

  if (user) {
    const updates = { googleId: profile.sub, lastLoginAt: now, updatedAt: now };
    const isGooglePicture = typeof profile.picture === 'string' && /^https:\/\/[a-z0-9.-]*googleusercontent\.com\//i.test(profile.picture);
    if (!user.avatar && isGooglePicture) updates.avatar = profile.picture;
    await db.collection('users').updateOne({ _id: user._id }, { $set: updates });
    return { user: { ...user, ...updates }, created: false };
  }

  const username = await uniqueUsername(db, email, profile.name);
  const doc = {
    username,
    email,
    passwordHash: null,
    googleId: profile.sub,
    name: String(profile.name || username).slice(0, 60),
    avatar: typeof profile.picture === 'string' && /^https:\/\/[a-z0-9.-]*googleusercontent\.com\//i.test(profile.picture) ? profile.picture : null,
    bio: '',
    location: '',
    birthdate: null,
    gender: null,
    heightCm: null,
    unitSystem: 'metric',
    theme: 'dark',
    isPublic: true,
    role: 'user',
    settings: defaultSettings(),
    createdAt: now,
    updatedAt: now,
    lastLoginAt: now,
  };
  const result = await db.collection('users').insertOne(doc);
  user = { ...doc, _id: result.insertedId };

  await notify(user._id, {
    type: 'system',
    title: `Welcome to FitPulse, ${doc.name.split(' ')[0]}!`,
    body: 'You signed in with Google. Log your first workout and start building momentum.',
    icon: 'sparkles',
    link: '/workouts',
  }).catch(() => {});

  return { user, created: true };
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
router.get('/start', (req, res) => {
  const next = safeNext(req.query.next);
  if (!googleConfigured()) {
    return res.status(503).type('text').send('Google sign-in is not configured.');
  }
  const state = signState({ t: Date.now(), n: crypto.randomBytes(12).toString('hex'), next });
  const params = new URLSearchParams({
    client_id: config.googleClientId,
    redirect_uri: config.googleRedirectUri,
    response_type: 'code',
    scope: SCOPES,
    state,
    prompt: 'select_account',
    access_type: 'online',
    include_granted_scopes: 'true',
  });
  res.setHeader('Cache-Control', 'no-store');
  res.redirect(`${AUTHORIZE_URL}?${params.toString()}`);
});

router.get('/callback', async (req, res) => {
  const fail = (message) => {
    const url = `${config.appBaseUrl}/#/login?error=${encodeURIComponent(message)}`;
    res.setHeader('Cache-Control', 'no-store');
    return res.redirect(url);
  };

  try {
    if (!googleConfigured()) return fail('Google sign-in is not configured.');
    if (req.query.error) return fail('Google sign-in was cancelled.');
    const state = verifyState(req.query.state);
    if (!state) return fail('That sign-in link expired. Please try again.');
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    if (!code) return fail('Google did not return an authorization code.');

    const tokenResponse = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      body: new URLSearchParams({
        code,
        client_id: config.googleClientId,
        client_secret: config.googleClientSecret,
        redirect_uri: config.googleRedirectUri,
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenResponse.ok) {
      const detail = await tokenResponse.text();
      logger.warn(`Google token exchange failed (${tokenResponse.status}):`, detail.slice(0, 300));
      return fail('Google could not complete the sign-in. Please try again.');
    }
    const tokens = await tokenResponse.json();
    const profile = await verifyIdToken(tokens.id_token);
    const { user, created } = await findOrCreateUser(profile);

    if (created) logger.info(`Created account ${user.username} from Google sign-in`);
    res.setHeader('Set-Cookie', authCookie(signToken(user)));
    res.setHeader('Cache-Control', 'no-store');
    return res.redirect(`${config.appBaseUrl}/#${state.next}`);
  } catch (error) {
    logger.error('Google sign-in failed:', error);
    return fail(error.message && error.message.length < 120 ? error.message : 'Google sign-in failed. Please try again.');
  }
});

module.exports = { router, verifyIdToken, verifyState, signState };
