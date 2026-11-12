'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer, registerUser, todayISO } = require('./helpers');

let server;
let client;
const anonymous = () => server.client();

test.before(async () => {
  server = await startTestServer();
  client = server.client();
  await registerUser(client, { username: 'exporter_lena', email: 'lena@example.com' });
  await client.post('/api/measurements', { measuredOn: todayISO(), weightKg: 70.4, waistCm: 74 });
  await client.post('/api/nutrition', {
    date: todayISO(),
    meal: 'lunch',
    foodName: 'Rice Bowl',
    calories: 540,
    protein: 28,
    carbs: 68,
    fat: 16,
  });
  await client.post('/api/goals', { title: 'Run 50km', type: 'custom', targetValue: 50, currentValue: 12, unit: 'km' });
  const routine = await client.post('/api/workouts', {
    name: 'Export Routine',
    exercises: [{ name: 'Squat', sets: 3, reps: 5, weight: 100 }],
  });
  await client.post('/api/workout-logs', { workoutId: routine.body.workout.id, performedAt: todayISO() });
});

test('CSV exports stream real data with download headers', async () => {
  for (const file of ['measurements', 'nutrition', 'workouts', 'goals']) {
    const res = await client.get(`/api/reports/${file}.csv`);
    assert.equal(res.status, 200, `${file}.csv responds`);
    assert.match(res.headers.get('content-type'), /text\/csv/);
    assert.match(res.headers.get('content-disposition'), /attachment; filename="fitpulse-/);
    assert.match(res.body, /^"?[A-Z][^\n]*\n/, `${file}.csv starts with a header row`);
    assert.ok(res.body.split('\n').length > 1, `${file}.csv has at least one data row`);
  }

  const workouts = await client.get('/api/reports/workouts.csv');
  assert.match(workouts.body, /Export Routine/);

  const measurements = await client.get('/api/reports/measurements.csv');
  assert.match(measurements.body, /70\.4/);
});

test('PDF summary export produces a valid document', async () => {
  const res = await client.get('/api/reports/summary.pdf');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /application\/pdf/);
  assert.match(res.headers.get('content-disposition'), /attachment; filename="fitpulse-report-/);

  const pdf = Buffer.isBuffer(res.body) ? res.body : Buffer.from(res.body);
  assert.equal(pdf.subarray(0, 5).toString('latin1'), '%PDF-', 'starts with the PDF magic number');
  assert.ok(pdf.length > 2000, 'PDF contains more than an empty shell');
  assert.ok(pdf.subarray(-8).toString('latin1').includes('%%EOF'), 'ends with the PDF trailer');
});

test('reports require authentication', async () => {
  const guest = anonymous();
  for (const path of ['measurements.csv', 'nutrition.csv', 'workouts.csv', 'goals.csv', 'summary.pdf']) {
    const res = await guest.get(`/api/reports/${path}`);
    assert.equal(res.status, 401, `${path} is protected`);
  }
});
