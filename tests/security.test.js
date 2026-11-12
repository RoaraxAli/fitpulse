'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer } = require('./helpers');

let server;

test.before(async () => {
  server = await startTestServer();
});

test.after(async () => {
  await server.stop();
});

test('responses carry hardening headers', async () => {
  const res = await server.client().get('/api/health');
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(res.headers.get('x-frame-options'), 'DENY');
  assert.match(res.headers.get('content-security-policy'), /default-src 'self'/);
  assert.equal(res.headers.get('x-powered-by'), null);
  assert.match(res.headers.get('referrer-policy'), /strict-origin/);
});

test('the HTTP surface is JSON-only and refuses unknown routes', async () => {
  const res = await server.client().get('/api/does-not-exist');
  assert.equal(res.status, 404);
  assert.equal(res.body.error.code, 'not_found');
});

test('malformed JSON bodies are rejected cleanly', async () => {
  const res = await fetch(`${server.base}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{"username": ',
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error.code, 'invalid_json');
});

test('login attempts are rate limited', async () => {
  const client = server.client();
  let limited = null;
  for (let attempt = 1; attempt <= 16; attempt += 1) {
    const res = await client.post('/api/auth/login', { identifier: 'nobody', password: `Wrong${attempt}pass` });
    if (res.status === 429) {
      limited = res;
      break;
    }
    assert.equal(res.status, 401);
  }
  assert.ok(limited, 'the 16th attempt is throttled');
  assert.equal(limited.body.error.code, 'rate_limited');
  assert.ok(Number(limited.headers.get('retry-after')) > 0);
});
