'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer, registerUser } = require('./helpers');

let server;
let client;

test.before(async () => {
  server = await startTestServer();
  client = server.client();
});

test.after(async () => {
  await server.stop();
});

test('registration creates an account and signs the user in', async () => {
  const res = await registerUser(client, { username: 'runner_anna', email: 'anna@example.com', name: 'Anna Bell' });

  assert.equal(res.status, 201);
  assert.equal(res.body.user.username, 'runner_anna');
  assert.equal(res.body.user.name, 'Anna Bell');
  assert.ok(res.body.token, 'a JWT is returned for API clients');
  assert.equal(res.body.user.passwordHash, undefined, 'password hashes never leave the server');
  assert.ok(client.jar.get('fp_token'), 'an auth cookie is set');

  const me = await client.get('/api/auth/me');
  assert.equal(me.status, 200);
  assert.equal(me.body.user.email, 'anna@example.com');
});

test('registration rejects weak passwords and duplicate accounts', async () => {
  const weak = await registerUser(client, {
    username: 'weak_pass',
    email: 'weak@example.com',
    password: 'short',
  });
  assert.equal(weak.status, 400);
  assert.equal(weak.body.error.code, 'bad_request');

  const duplicate = await registerUser(client, {
    username: 'runner_anna',
    email: 'other@example.com',
  });
  assert.equal(duplicate.status, 409);
  assert.match(duplicate.body.error.message, /username/i);
});

test('login accepts username or email and rejects bad credentials', async () => {
  const byEmail = await client.post('/api/auth/login', { identifier: 'anna@example.com', password: 'FitPulse123!' });
  assert.equal(byEmail.status, 200);
  assert.equal(byEmail.body.user.username, 'runner_anna');

  const bad = await client.post('/api/auth/login', { identifier: 'runner_anna', password: 'WrongPass123' });
  assert.equal(bad.status, 401);
  assert.equal(bad.body.error.code, 'unauthorized');
});

test('logout clears the session and protected routes reject anonymous callers', async () => {
  const res = await client.post('/api/auth/logout');
  assert.equal(res.status, 200);

  const me = await client.get('/api/auth/me');
  assert.equal(me.status, 401);

  const dashboard = await client.get('/api/dashboard');
  assert.equal(dashboard.status, 401);
  assert.equal(dashboard.body.error.code, 'unauthorized');
});

test('password change invalidates the old password', async () => {
  const fresh = server.client();
  await registerUser(fresh, { username: 'cyclist_jo', email: 'jo@example.com' });

  const badCurrent = await fresh.patch('/api/auth/password', { currentPassword: 'nope', newPassword: 'NewSecret123' });
  assert.equal(badCurrent.status, 400);

  const changed = await fresh.patch('/api/auth/password', { currentPassword: 'FitPulse123!', newPassword: 'NewSecret123' });
  assert.equal(changed.status, 200);

  const stale = await fresh.post('/api/auth/login', { identifier: 'cyclist_jo', password: 'FitPulse123!' });
  assert.equal(stale.status, 401);

  const ok = await fresh.post('/api/auth/login', { identifier: 'cyclist_jo', password: 'NewSecret123' });
  assert.equal(ok.status, 200);
});
