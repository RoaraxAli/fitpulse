'use strict';

const express = require('express');
const crypto = require('crypto');
const { getDb } = require('../db');
const { requireAuth } = require('../auth');
const config = require('../config');
const { assertOk, HttpError } = require('../utils');

const router = express.Router();
const PRICE_CENTS = 500;

function stripeConfigured() {
  return Boolean(config.stripeSecretKey);
}

async function stripeRequest(path, params, method = 'POST') {
  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${config.stripeSecretKey}`,
      ...(method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
    ...(method === 'POST' ? { body: new URLSearchParams(params).toString() } : {}),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const stripeError = data?.error || {};
    // Keep Stripe's diagnostic useful in Vercel function logs without ever
    // logging the Authorization header or secret key.
    console.error('Stripe API request failed:', JSON.stringify({
      status: response.status,
      type: stripeError.type,
      code: stripeError.code,
      message: stripeError.message,
      requestId: response.headers.get('request-id'),
    }));
    throw new HttpError(
      502,
      'stripe_request_failed',
      stripeError.message || 'Stripe could not create the checkout session.'
    );
  }
  return data;
}

async function grantPro(session) {
  if (!session || session.payment_status !== 'paid' || session.mode !== 'payment') return false;
  const userId = session.metadata?.userId;
  if (!userId || !/^[a-f\d]{24}$/i.test(userId)) return false;
  const db = getDb();
  const { toObjectId } = require('../db');
  await db.collection('users').updateOne(
    { _id: toObjectId(userId) },
    { $set: { coachPro: { active: true, purchasedAt: new Date(), checkoutSessionId: session.id } } }
  );
  return true;
}

router.get('/status', requireAuth, (req, res) => {
  res.json({ active: req.user.coachPro?.active === true, priceCents: PRICE_CENTS, currency: 'usd' });
});

router.post('/checkout', requireAuth, async (req, res) => {
  assertOk(stripeConfigured(), 'Payments are not configured yet.', 'billing_unavailable');
  if (req.user.coachPro?.active === true) return res.json({ active: true });
  const session = await stripeRequest('/checkout/sessions', {
    mode: 'payment',
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': 'usd',
    'line_items[0][price_data][unit_amount]': String(PRICE_CENTS),
    'line_items[0][price_data][product_data][name]': 'FitPulse Coach Pro',
    'line_items[0][price_data][product_data][description]': 'One-time unlock for FitPulse AI Coach',
    customer_email: req.user.email,
    client_reference_id: String(req.user._id),
    'metadata[userId]': String(req.user._id),
    success_url: `${config.appBaseUrl}/#/coach?checkout_session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${config.appBaseUrl}/#/coach?checkout=cancelled`,
  });
  res.json({ url: session.url });
});

router.post('/verify', requireAuth, async (req, res) => {
  assertOk(stripeConfigured(), 'Payments are not configured yet.', 'billing_unavailable');
  const sessionId = typeof req.body?.sessionId === 'string' ? req.body.sessionId : '';
  assertOk(/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId), 'Invalid checkout session.', 'sessionId');
  const session = await stripeRequest(`/checkout/sessions/${encodeURIComponent(sessionId)}`, undefined, 'GET');
  assertOk(session.metadata?.userId === String(req.user._id), 'Checkout session does not belong to this account.', 'forbidden');
  if (session.payment_status === 'paid') await grantPro(session);
  res.json({ active: session.payment_status === 'paid' });
});

function verifyWebhook(rawBody, signatureHeader) {
  if (!config.stripeWebhookSecret || !signatureHeader) return false;
  const parts = Object.fromEntries(signatureHeader.split(',').map((part) => part.split('=')));
  const timestamp = Number(parts.t);
  if (!timestamp || Math.abs(Date.now() / 1000 - timestamp) > 300 || !parts.v1) return false;
  const expected = crypto.createHmac('sha256', config.stripeWebhookSecret).update(`${timestamp}.`).update(rawBody).digest('hex');
  const provided = Buffer.from(parts.v1, 'hex');
  const calculated = Buffer.from(expected, 'hex');
  return provided.length === calculated.length && crypto.timingSafeEqual(provided, calculated);
}

async function webhook(req, res) {
  if (!verifyWebhook(req.body, req.headers['stripe-signature'])) return res.status(400).send('Invalid Stripe signature.');
  let event;
  try { event = JSON.parse(req.body.toString('utf8')); } catch { return res.status(400).send('Invalid event.'); }
  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
    await grantPro(event.data.object);
  }
  res.json({ received: true });
}

module.exports = { router, webhook };
