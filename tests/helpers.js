'use strict';

// Tests run against a throwaway Mongo database; never touch the demo database.
process.env.NODE_ENV = 'test';

const { connect, close, getDb } = require('../server/db');
const { createApp } = require('../server/app');

async function startTestServer() {
  const dbName = `fitpulse_test_${process.pid}_${Date.now().toString(36)}`;
  await connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017', dbName);

  const app = createApp();
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  const base = `http://127.0.0.1:${server.address().port}`;

  return {
    base,
    db: getDb(),
    client: () => createClient(base),
    async stop() {
      await new Promise((resolve) => {
        // Resolve even if a keep-alive socket refuses to drain, so a hung
        // connection can never block the whole test run.
        const fallback = setTimeout(resolve, 1500);
        server.close(() => {
          clearTimeout(fallback);
          resolve();
        });
        if (typeof server.closeIdleConnections === 'function') server.closeIdleConnections();
        if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
      });
      try {
        await getDb().dropDatabase();
      } finally {
        await close();
      }
    },
  };
}

function createClient(base) {
  const jar = new Map();

  function cookieHeader() {
    return [...jar.entries()].map(([name, value]) => `${name}=${value}`).join('; ');
  }

  function absorbCookies(res) {
    const cookies = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
    for (const raw of cookies) {
      const pair = raw.split(';')[0];
      const index = pair.indexOf('=');
      if (index === -1) continue;
      const name = pair.slice(0, index).trim();
      const value = pair.slice(index + 1).trim();
      if (!value || /expires=thu, 01 jan 1970/i.test(raw) || /max-age=0/i.test(raw)) jar.delete(name);
      else jar.set(name, value);
    }
  }

  async function request(method, path, body) {
    const headers = { accept: 'application/json' };
    if (body !== undefined) headers['content-type'] = 'application/json';
    const cookie = cookieHeader();
    if (cookie) headers.cookie = cookie;

    const res = await fetch(`${base}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: 'manual',
    });
    absorbCookies(res);

    const type = res.headers.get('content-type') || '';
    let parsed;
    if (type.includes('application/json')) parsed = await res.json();
    else if (type.includes('text/') || type.includes('csv')) parsed = await res.text();
    else parsed = Buffer.from(await res.arrayBuffer());

    return { status: res.status, headers: res.headers, body: parsed };
  }

  return {
    jar,
    request,
    get: (path) => request('GET', path),
    post: (path, body = {}) => request('POST', path, body),
    put: (path, body = {}) => request('PUT', path, body),
    patch: (path, body = {}) => request('PATCH', path, body),
    del: (path) => request('DELETE', path),
  };
}

let counter = 0;

function nextSuffix() {
  counter += 1;
  return `${Date.now().toString(36)}${counter}`.slice(-7);
}

async function registerUser(client, overrides = {}) {
  const suffix = nextSuffix();
  const account = {
    username: `tester_${suffix}`.slice(0, 20),
    email: `tester_${suffix}@example.com`,
    name: 'Test Person',
    password: 'FitPulse123!',
    ...overrides,
  };
  const res = await client.post('/api/auth/register', account);
  return { ...res, account };
}

async function loginUser(client, username, password) {
  return client.post('/api/auth/login', { username, password });
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

module.exports = { startTestServer, registerUser, loginUser, todayISO };
