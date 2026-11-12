'use strict';

const config = require('./config');
const logger = require('./utils/logger');
const { HttpError } = require('./utils');

function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  if (!config.isProduction) {
    res.setHeader('X-Robots-Tag', 'noindex');
  }
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.googleusercontent.com",
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
  res.setHeader('Content-Security-Policy', csp);
  next();
}

function rateLimit({ windowMs = 60_000, max = 300, message = 'Too many requests. Please slow down.' } = {}) {
  const buckets = new Map();
  const sweeper = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (bucket.reset <= now) buckets.delete(key);
    }
  }, Math.max(windowMs, 30_000));
  if (sweeper.unref) sweeper.unref();

  return (req, res, next) => {
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || bucket.reset <= now) {
      bucket = { count: 0, reset: now + windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - bucket.count)));
    if (bucket.count > max) {
      res.setHeader('Retry-After', String(Math.ceil((bucket.reset - now) / 1000)));
      return next(new HttpError(429, 'rate_limited', message));
    }
    return next();
  };
}

function requestLogger(req, res, next) {
  if (req.path.startsWith('/assets/') || req.path.startsWith('/uploads/')) return next();
  const started = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    const line = `${req.method} ${req.originalUrl} ${res.statusCode} ${ms.toFixed(1)}ms`;
    if (res.statusCode >= 500) logger.error(line);
    else if (!config.isProduction || res.statusCode >= 400) logger.info(line);
  });
  return next();
}

function notFound(req, res) {
  res.status(404).json({ error: { code: 'not_found', message: `No route for ${req.method} ${req.originalUrl}` } });
}

function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  if (res.headersSent) return;

  if (err instanceof HttpError || (err && err.status && err.code)) {
    return res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details || undefined },
    });
  }

  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'invalid_json', message: 'Request body must be valid JSON.' } });
  }

  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({ error: { code: 'payload_too_large', message: 'That request is too large.' } });
  }

  if (err && err.code === 11000) {
    return res.status(409).json({ error: { code: 'conflict', message: 'That value is already in use.' } });
  }

  logger.error(`Unhandled error on ${req.method} ${req.originalUrl}:`, err);
  return res.status(500).json({
    error: { code: 'server_error', message: 'Something went wrong on our side. Please try again.' },
  });
}

module.exports = { securityHeaders, rateLimit, requestLogger, notFound, errorHandler };
