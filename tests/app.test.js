'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer, registerUser, todayISO } = require('./helpers');

let server;
let client;

test.before(async () => {
  server = await startTestServer();
  client = server.client();
  await registerUser(client, { username: 'smoke_tess', email: 'tess@example.com', name: 'Tess Moreau' });

  await client.post('/api/workout-logs', {
    name: 'Morning Run',
    category: 'cardio',
    performedAt: todayISO(),
    durationMin: 32,
    caloriesBurned: 310,
    sets: [{ exerciseName: 'Running', setNumber: 1, reps: 1, weight: 0 }],
  });
  await client.post('/api/nutrition', {
    date: todayISO(),
    meal: 'breakfast',
    foodName: 'Greek Yogurt',
    calories: 180,
    protein: 18,
    carbs: 9,
    fat: 7,
  });
  await client.post('/api/measurements', { measuredOn: todayISO(), weightKg: 64.2 });
  await client.post('/api/goals', { title: 'Workout 4x weekly', type: 'workouts', targetValue: 4, currentValue: 1 });
});

test.after(async () => {
  await server.stop();
});

test('dashboard returns every panel the UI needs', async () => {
  const res = await client.get('/api/dashboard');
  assert.equal(res.status, 200);
  const body = res.body;
  assert.equal(typeof body.greetingName, 'string');
  assert.ok(body.today.totals.calories >= 180);
  assert.ok(body.today.goals.calories > 0);
  assert.ok(body.weekStats);
  assert.equal(typeof body.streak, 'object');
  assert.ok(body.weight);
  assert.ok(Array.isArray(body.goals));
  assert.ok(Array.isArray(body.recentWorkouts));
  assert.equal(typeof body.meals, 'object');
  assert.equal(body.meals.breakfast.length, 1);
  assert.ok(Array.isArray(body.activity));
  assert.ok(Array.isArray(body.calorieWeek));
  assert.equal(typeof body.unreadNotifications, 'number');
  assert.equal(typeof body.unlockedAchievements, 'number');
});

test('analytics endpoints power all charts', async () => {
  const paths = [
    '/api/analytics/overview?range=30',
    '/api/analytics/workouts?range=30',
    '/api/analytics/nutrition?range=30',
    '/api/analytics/exercise?name=Running&range=90',
    '/api/analytics/heatmap?range=180',
  ];
  for (const path of paths) {
    const res = await client.get(path);
    assert.equal(res.status, 200, `${path} responds`);
    assert.equal(typeof res.body, 'object');
  }

  const overview = await client.get('/api/analytics/overview?range=30');
  assert.ok(overview.body.cards.workouts, 'overview exposes period cards');
});

test('notifications and reminders are available to members', async () => {
  const notifications = await client.get('/api/notifications');
  assert.equal(notifications.status, 200);
  assert.ok(Array.isArray(notifications.body.items));
  assert.ok(notifications.body.items.length > 0, 'signup and workout notifications exist');

  const unread = await client.get('/api/notifications?filter=unread');
  assert.ok(Array.isArray(unread.body.items));

  const readAll = await client.post('/api/notifications/read-all');
  assert.equal(readAll.status, 200);

  const reminders = await client.get('/api/reminders');
  assert.equal(reminders.status, 200);
  assert.ok(Array.isArray(reminders.body.items));
});

test('global search finds workouts, logs and people', async () => {
  const res = await client.get('/api/search?q=greek');
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.results.nutrition));
  assert.ok(res.body.results.nutrition.length >= 1);

  const short = await client.get('/api/search?q=m');
  assert.equal(short.status, 400);
});

test('community feed supports posts, replies, likes and follows', async () => {
  const post = await client.post('/api/posts', {
    title: 'First 10k of the season',
    body: 'Legs are toast but very happy with that pace.',
    category: 'progress',
  });
  assert.equal(post.status, 201);
  const postId = post.body.post.id;

  const feed = await client.get('/api/posts');
  assert.equal(feed.status, 200);
  assert.ok(feed.body.items.some((item) => item.id === postId));

  const reply = await client.post(`/api/posts/${postId}/replies`, { body: 'Great pace!' });
  assert.equal(reply.status, 201);

  const like = await client.post(`/api/posts/${postId}/like`);
  assert.equal(like.status, 200);
  assert.equal(like.body.liked, true);

  const unlike = await client.post(`/api/posts/${postId}/like`);
  assert.equal(unlike.body.liked, false);

  const people = await client.get('/api/users?q=smoke');
  assert.equal(people.status, 200);
  assert.ok(people.body.items.some((user) => user.username === 'smoke_tess'));

  const me = await client.get('/api/auth/me');
  const profile = await client.get(`/api/users/${me.body.user.id}`);
  assert.equal(profile.status, 200);
  assert.equal(profile.body.user.username, 'smoke_tess');
});

test('settings and support tickets work end to end', async () => {
  const settings = await client.get('/api/settings');
  assert.equal(settings.status, 200);
  assert.ok(settings.body.settings);

  const updated = await client.patch('/api/settings', {
    theme: 'light',
    unitSystem: 'imperial',
    calorieGoal: 2400,
    waterGoal: 3000,
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.settings.calorieGoal, 2400);

  const invalid = await client.patch('/api/settings', { theme: 'neon' });
  assert.equal(invalid.status, 400);

  const ticket = await client.post('/api/support/tickets', {
    subject: 'Feature request',
    message: 'Please add an interval timer to the workout screen.',
    type: 'feature',
  });
  assert.equal(ticket.status, 201);

  const tickets = await client.get('/api/support/tickets');
  assert.equal(tickets.status, 200);
  assert.ok(tickets.body.items.some((item) => item.subject === 'Feature request'));
});

test('profile updates are validated and avatar uploads are stored', async () => {
  const patch = await client.patch('/api/users/me', { name: 'Tess M.', bio: 'Marathon in progress', location: 'Lisbon' });
  assert.equal(patch.status, 200);
  assert.equal(patch.body.user.name, 'Tess M.');

  const invalid = await client.patch('/api/users/me', { heightCm: 500 });
  assert.equal(invalid.status, 400);

  const png =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const avatar = await client.post('/api/users/me/avatar', { image: png });
  assert.equal(avatar.status, 200);
  assert.match(avatar.body.avatar, /^\/uploads\//);
});

test('the SPA shell is served for client routes', async () => {
  const res = await client.get('/dashboard');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/html/);
  assert.match(res.body, /<div id="root">/);
});
