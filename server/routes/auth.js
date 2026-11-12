'use strict';

const express = require('express');
const { getDb } = require('../db');
const { hashPassword, verifyPassword, signToken, authCookie, clearAuthCookie } = require('../auth');
const { selfUser } = require('../serializers');
const { badRequest, unauthorized, conflict, str, isNonEmptyString, assertOk } = require('../utils');
const { calculateStats } = require('../services/stats');
const { notify } = require('../services/notifications');

const router = express.Router();

const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const defaultSettings = () => ({
  notifyWorkout: true,
  notifyMeal: true,
  notifyGoals: true,
  notifySocial: true,
  notifyEmail: false,
  timezone: 'UTC',
  weekStart: 1,
  calorieGoal: 2200,
  proteinGoal: 150,
  carbsGoal: 250,
  fatGoal: 70,
  waterGoal: 2500,
  stepGoal: 8000,
});

function validatePassword(password) {
  assertOk(typeof password === 'string' && password.length >= 8, 'Password must be at least 8 characters.', 'password');
  assertOk(password.length <= 72, 'Password must be 72 characters or fewer.', 'password');
  assertOk(/[A-Za-z]/.test(password), 'Password must include at least one letter.', 'password');
  assertOk(/\d/.test(password), 'Password must include at least one number.', 'password');
}

router.post('/register', async (req, res) => {
  const body = req.body || {};
  const username = str(body.username, 20).toLowerCase();
  const email = str(body.email, 254).toLowerCase();
  const name = str(body.name, 60);
  const password = typeof body.password === 'string' ? body.password : '';

  assertOk(USERNAME_RE.test(username), 'Username must be 3-20 characters: letters, numbers or underscores.', 'username');
  assertOk(EMAIL_RE.test(email), 'Please enter a valid email address.', 'email');
  assertOk(isNonEmptyString(name), 'Please tell us your name.', 'name');
  validatePassword(password);

  const db = getDb();
  const existing = await db.collection('users').findOne(
    { $or: [{ username }, { email }] },
    { projection: { username: 1, email: 1 } }
  );
  if (existing) {
    throw conflict(existing.username === username ? 'That username is already taken.' : 'An account with that email already exists.');
  }

  const now = new Date();
  const doc = {
    username,
    email,
    passwordHash: await hashPassword(password),
    name,
    avatar: null,
    bio: '',
    location: '',
    birthdate: null,
    gender: null,
    heightCm: null,
    unitSystem: 'metric',
    theme: 'dark',
    isPublic: true,
    role: 'user',
    settings: defaultSettings(),
    createdAt: now,
    updatedAt: now,
    lastLoginAt: now,
  };
  const result = await db.collection('users').insertOne(doc);
  doc._id = result.insertedId;

  await notify(result.insertedId, {
    type: 'system',
    title: `Welcome to FitPulse, ${name.split(' ')[0]}!`,
    body: 'Log your first workout and start building momentum.',
    icon: 'sparkles',
    link: '/workouts',
  });

  const token = signToken(doc);
  res.setHeader('Set-Cookie', authCookie(token));
  return res.status(201).json({ user: selfUser(doc), token });
});

router.post('/login', async (req, res) => {
  const body = req.body || {};
  const identifier = str(body.identifier || body.username || body.email, 254).toLowerCase();
  const password = typeof body.password === 'string' ? body.password : '';
  assertOk(isNonEmptyString(identifier) && isNonEmptyString(password), 'Enter your username/email and password.', 'identifier');

  const db = getDb();
  const user = await db.collection('users').findOne({ $or: [{ username: identifier }, { email: identifier }] });
  if (!user) throw unauthorized('Those credentials do not match an account.');
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) throw unauthorized('Those credentials do not match an account.');

  await db.collection('users').updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });
  user.lastLoginAt = new Date();
  const token = signToken(user);
  res.setHeader('Set-Cookie', authCookie(token));
  return res.json({ user: selfUser(user), token });
});

router.post('/logout', (req, res) => {
  res.setHeader('Set-Cookie', clearAuthCookie());
  res.json({ ok: true });
});

router.get('/me', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: { code: 'unauthorized', message: 'Not signed in.' } });
  const stats = await calculateStats(req.user);
  return res.json({ user: selfUser(req.user), stats });
});

router.patch('/password', async (req, res) => {
  if (!req.user) throw unauthorized();
  const { currentPassword, newPassword } = req.body || {};
  assertOk(typeof currentPassword === 'string' && currentPassword.length > 0, 'Enter your current password.', 'currentPassword');
  validatePassword(newPassword);
  const valid = await verifyPassword(currentPassword, req.user.passwordHash);
  if (!valid) throw badRequest('Your current password is incorrect.', 'currentPassword');
  await getDb()
    .collection('users')
    .updateOne({ _id: req.user._id }, { $set: { passwordHash: await hashPassword(newPassword), updatedAt: new Date() } });
  res.json({ ok: true });
});

module.exports = { router, defaultSettings };
