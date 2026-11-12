'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer, registerUser, todayISO } = require('./helpers');

let server;
let client;

test.before(async () => {
  server = await startTestServer();
  client = server.client();
  await registerUser(client, { username: 'eater_ivy', email: 'ivy@example.com' });
});

test.after(async () => {
  await server.stop();
});

test('custom foods are searchable and scoped to their creator', async () => {
  const created = await client.post('/api/foods', {
    name: 'Ivys Protein Oats',
    servingSize: 50,
    servingUnit: 'g',
    calories: 190,
    protein: 12,
    carbs: 26,
    fat: 4,
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.food.isCustom, true);

  const search = await client.get('/api/foods?q=protein%20oats');
  assert.equal(search.status, 200);
  assert.ok(search.body.items.some((food) => food.name === 'Ivys Protein Oats'));

  const other = server.client();
  await registerUser(other, { username: 'eater_omar', email: 'omar@example.com' });
  const hidden = await other.get('/api/foods?q=protein%20oats');
  assert.ok(!hidden.body.items.some((food) => food.name === 'Ivys Protein Oats'));
});

test('nutrition entries update daily totals', async () => {
  const food = await client.post('/api/foods', {
    name: 'Ivys Recovery Shake',
    servingSize: 1,
    servingUnit: 'serving',
    calories: 220,
    protein: 30,
    carbs: 12,
    fat: 5,
  });
  const foodId = food.body.food.id;
  const date = todayISO();

  const byFood = await client.post('/api/nutrition', { date, meal: 'breakfast', foodId, quantity: 2 });
  assert.equal(byFood.status, 201);
  assert.equal(byFood.body.entry.calories, 440);
  assert.equal(byFood.body.entry.protein, 60);

  const manual = await client.post('/api/nutrition', {
    date,
    meal: 'lunch',
    foodName: 'Chicken & Rice',
    servingSize: 350,
    calories: 620,
    protein: 48,
    carbs: 70,
    fat: 14,
  });
  assert.equal(manual.status, 201);

  const day = await client.get(`/api/nutrition?date=${date}`);
  assert.equal(day.status, 200);
  assert.equal(day.body.entries.length, 2);
  assert.equal(day.body.totals.calories, 1060);
  assert.equal(day.body.totals.protein, 108);
  assert.ok(day.body.goals.calories > 0);

  const week = await client.get(`/api/nutrition/week?date=${date}`);
  assert.equal(week.status, 200);
  assert.equal(week.body.days.length, 7);
  assert.equal(week.body.days.at(-1).calories, 1060);

  const updated = await client.put(`/api/nutrition/${manual.body.entry.id}`, { quantity: 1 });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.entry.calories, 620);

  const removed = await client.del(`/api/nutrition/${manual.body.entry.id}`);
  assert.equal(removed.status, 200);

  const after = await client.get(`/api/nutrition?date=${date}`);
  assert.equal(after.body.entries.length, 1);
  assert.equal(after.body.totals.calories, 440);
});

test('nutrition validation rejects invalid meals and empty entries', async () => {
  const badMeal = await client.post('/api/nutrition', { foodName: 'Mystery', calories: 100, meal: 'brunch' });
  assert.equal(badMeal.status, 400);

  const empty = await client.post('/api/nutrition', { meal: 'snack' });
  assert.equal(empty.status, 400);
  assert.equal(empty.body.error.code, 'bad_request');
});

test('nutrition summary covers the requested range', async () => {
  const res = await client.get(`/api/nutrition/summary?from=${todayISO()}&to=${todayISO()}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.days.length, 1);
  assert.ok(res.body.averages.avgCalories > 0);
});
