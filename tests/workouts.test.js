'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer, registerUser, todayISO } = require('./helpers');

let server;
let owner;
let stranger;

test.before(async () => {
  server = await startTestServer();
  owner = server.client();
  stranger = server.client();
  await registerUser(owner, { username: 'lifter_max', email: 'max@example.com' });
  await registerUser(stranger, { username: 'lifter_sam', email: 'sam@example.com' });
});

test.after(async () => {
  await server.stop();
});

const routine = {
  name: 'Push Day',
  category: 'strength',
  description: 'Chest, shoulders, triceps',
  tags: ['push', 'upper'],
  exercises: [
    { name: 'Bench Press', sets: 4, reps: 8, weight: 80 },
    { name: 'Overhead Press', sets: 3, reps: 10, weight: 40 },
  ],
};

test('routines can be created, listed, updated and deleted by their owner', async () => {
  const created = await owner.post('/api/workouts', routine);
  assert.equal(created.status, 201);
  assert.equal(created.body.workout.name, 'Push Day');
  assert.equal(created.body.workout.exercises.length, 2);
  const id = created.body.workout.id;

  const list = await owner.get('/api/workouts');
  assert.equal(list.status, 200);
  assert.ok(list.body.items.some((item) => item.id === id));
  assert.equal(list.body.total, 1);

  const fetched = await owner.get(`/api/workouts/${id}`);
  assert.equal(fetched.status, 200);
  assert.equal(fetched.body.workout.category, 'strength');

  const updated = await owner.put(`/api/workouts/${id}`, { ...routine, name: 'Push Day A' });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.workout.name, 'Push Day A');

  const duplicate = await owner.post(`/api/workouts/${id}/duplicate`);
  assert.equal(duplicate.status, 201);
  assert.notEqual(duplicate.body.workout.id, id);

  const removed = await owner.del(`/api/workouts/${id}`);
  assert.equal(removed.status, 200);
  assert.equal((await owner.get(`/api/workouts/${id}`)).status, 404);
});

test('routine validation rejects empty payloads', async () => {
  const noName = await owner.post('/api/workouts', { exercises: routine.exercises });
  assert.equal(noName.status, 400);

  const noExercises = await owner.post('/api/workouts', { name: 'Empty' });
  assert.equal(noExercises.status, 400);
  assert.equal(noExercises.body.error.code, 'bad_request');
});

test('owners alone can read, edit and delete their routine', async () => {
  const created = await owner.post('/api/workouts', { ...routine, name: 'Leg Day' });
  const id = created.body.workout.id;

  assert.equal((await stranger.get(`/api/workouts/${id}`)).status, 404);
  assert.equal((await stranger.put(`/api/workouts/${id}`, { name: 'Hijacked' })).status, 404);
  assert.equal((await stranger.del(`/api/workouts/${id}`)).status, 404);

  const survivor = await owner.get(`/api/workouts/${id}`);
  assert.equal(survivor.status, 200);
  assert.equal(survivor.body.workout.name, 'Leg Day');
});

test('workout logs record volume and personal records', async () => {
  const created = await owner.post('/api/workout-logs', {
    name: 'Bench Session',
    category: 'strength',
    performedAt: todayISO(),
    durationMin: 45,
    sets: [
      { exerciseName: 'Bench Press', setNumber: 1, reps: 8, weight: 80 },
      { exerciseName: 'Bench Press', setNumber: 2, reps: 6, weight: 90 },
    ],
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.log.volume, 8 * 80 + 6 * 90);
  const logId = created.body.log.id;

  const list = await owner.get('/api/workout-logs');
  assert.equal(list.status, 200);
  assert.ok(list.body.items.some((entry) => entry.id === logId));

  const prs = await owner.get('/api/workout-logs/prs');
  assert.equal(prs.status, 200);
  assert.ok(prs.body.items.some((pr) => pr.exerciseName === 'Bench Press' && pr.weight === 90));

  assert.equal((await stranger.get(`/api/workout-logs/${logId}`)).status, 404);
  assert.equal((await owner.del(`/api/workout-logs/${logId}`)).status, 200);
});

test('logging a workout from a routine copies its sets', async () => {
  const routineRes = await owner.post('/api/workouts', { ...routine, name: 'Full Body' });
  const routineId = routineRes.body.workout.id;

  const logged = await owner.post('/api/workout-logs', { workoutId: routineId, performedAt: todayISO() });
  assert.equal(logged.status, 201);
  assert.equal(logged.body.log.name, 'Full Body');
  assert.equal(logged.body.log.sets.length, 7, '4 bench sets + 3 press sets');
  assert.ok(logged.body.log.volume > 0);
});
