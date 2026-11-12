'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { addDaysISO } = require('../server/utils');
const { startTestServer, registerUser, todayISO } = require('./helpers');

let server;
let client;

test.before(async () => {
  server = await startTestServer();
  client = server.client();
  await registerUser(client, { username: 'tracker_kai', email: 'kai@example.com' });
});

test.after(async () => {
  await server.stop();
});

test('measurements can be upserted per day and listed in a range', async () => {
  const start = addDaysISO(todayISO(), -30);

  const first = await client.post('/api/measurements', {
    measuredOn: start,
    weightKg: 84.5,
    bodyFatPct: 21,
    waistCm: 88,
  });
  assert.equal(first.status, 201);
  assert.equal(first.body.measurement.weightKg, 84.5);

  const latest = await client.post('/api/measurements', {
    measuredOn: todayISO(),
    weightKg: 82.1,
    bodyFatPct: 19.4,
    waistCm: 85,
  });
  assert.equal(latest.status, 201);
  const id = latest.body.measurement.id;

  const sameDay = await client.post('/api/measurements', {
    measuredOn: todayISO(),
    weightKg: 82,
  });
  assert.equal(sameDay.body.measurement.id, id, 'one measurement per day is upserted');
  assert.equal(sameDay.body.measurement.weightKg, 82);

  const list = await client.get(`/api/measurements?from=${start}&to=${todayISO()}`);
  assert.equal(list.status, 200);
  assert.equal(list.body.items.length, 2);

  const newest = await client.get('/api/measurements/latest');
  assert.equal(newest.body.measurement.weightKg, 82);

  const empty = await client.post('/api/measurements', { notes: 'nothing measured' });
  assert.equal(empty.status, 400);
});

test('custom metrics track arbitrary values', async () => {
  const created = await client.post('/api/metrics', { metric: 'Resting HR', value: 58, unit: 'bpm' });
  assert.equal(created.status, 201);

  const list = await client.get('/api/metrics');
  assert.equal(list.status, 200);
  assert.ok(list.body.items.some((item) => item.metric === 'Resting HR' && item.value === 58));
});

test('goals progress toward their target and complete automatically', async () => {
  const created = await client.post('/api/goals', {
    title: 'Bench 100kg',
    type: 'strength',
    targetValue: 100,
    currentValue: 20,
    unit: 'kg',
    deadline: addDaysISO(todayISO(), 60),
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.goal.status, 'active');
  assert.equal(created.body.goal.progress, 20);
  const id = created.body.goal.id;

  const halfway = await client.patch(`/api/goals/${id}`, { currentValue: 60 });
  assert.equal(halfway.status, 200);
  assert.equal(halfway.body.goal.progress, 60);
  assert.equal(halfway.body.goal.status, 'active');

  const achieved = await client.patch(`/api/goals/${id}`, { currentValue: 105 });
  assert.equal(achieved.body.goal.status, 'completed');
  assert.equal(achieved.body.goal.currentValue, 100, 'current value is capped at the target');

  const list = await client.get('/api/goals?status=completed');
  assert.equal(list.body.items.length, 1);
  assert.equal(list.body.summary.completed, 1);
});

test('progress summary reports weight change, PRs and goals', async () => {
  await client.post('/api/workout-logs', {
    name: 'Deadlift Day',
    performedAt: todayISO(),
    sets: [{ exerciseName: 'Deadlift', setNumber: 1, reps: 5, weight: 140 }],
  });

  const res = await client.get(`/api/progress?from=${addDaysISO(todayISO(), -30)}&to=${todayISO()}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.weightChange, -2.5);
  assert.equal(res.body.startWeightKg, 84.5);
  assert.ok(res.body.measurements.length >= 2);
  assert.ok(res.body.prs.some((pr) => pr.exerciseName === 'Deadlift' && pr.weight === 140));
  assert.ok(Array.isArray(res.body.goals));
  assert.ok(Array.isArray(res.body.achievements));
});

test('goals reject invalid targets', async () => {
  const res = await client.post('/api/goals', { title: 'Impossible', targetValue: 0 });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'bad_request');
});
