'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Load .env without extra dependencies.
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  for (const rawLine of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

const bool = (value, fallback) => {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
};

const env = process.env.NODE_ENV || 'development';

let jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret === 'change-me-in-production') {
  if (env === 'production') {
    jwtSecret = crypto.randomBytes(32).toString('hex');
    // eslint-disable-next-line no-console
    console.warn('[config] JWT_SECRET is not configured; using an ephemeral secret for this process.');
  } else {
    jwtSecret = 'fitpulse-development-secret';
  }
}

module.exports = {
  env,
  isProduction: env === 'production',
  port: Number(process.env.PORT || 3100),
  host: process.env.HOST || '127.0.0.1',
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017',
  mongoFallbackUri: process.env.MONGODB_FALLBACK_URI || '',
  dbName: process.env.MONGODB_DB || 'fitpulse',
  jwtSecret,
  jwtTtlSeconds: 7 * 24 * 60 * 60,
  cookieName: 'fp_token',
  seedOnEmpty: bool(process.env.SEED_ON_EMPTY, true),
  uploadDir: process.env.UPLOAD_DIR || (process.env.VERCEL ? '/tmp/fitpulse-uploads' : path.join(__dirname, '..', 'data', 'uploads')),
  maxBody: '6mb',
  appName: 'FitPulse',
  version: '1.0.0',
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  googleRedirectUri: process.env.GOOGLE_REDIRECT_URI || '',
  appBaseUrl: (process.env.APP_BASE_URL || 'https://84.12.151.204.nip.io/fitness').replace(/\/$/, ''),
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-3.5-flash',
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
};
