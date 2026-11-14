'use strict';

const express = require('express');
const { getDb, toObjectId } = require('../db');
const { requireAuth } = require('../auth');
const { str, assertOk, isISODate } = require('../utils');
const { defaultSettings } = require('./auth');

const router = express.Router();

const TICKET_TYPES = ['support', 'bug', 'feedback', 'feature'];

// Support -------------------------------------------------------------------
router.post('/support/tickets', requireAuth, async (req, res) => {
  const body = req.body || {};
  const subject = str(body.subject, 120);
  const message = str(body.message, 4000);
  const type = str(body.type, 20) || 'support';
  assertOk(subject.length > 0, 'Add a short subject.', 'subject');
  assertOk(message.length > 0, 'Tell us a little more.', 'message');
  assertOk(TICKET_TYPES.includes(type), 'Choose a valid request type.', 'type');
  const doc = {
    userId: req.user._id,
    type,
    subject,
    message,
    status: 'open',
    createdAt: new Date(),
  };
  const result = await getDb().collection('tickets').insertOne(doc);
  res.status(201).json({ ticket: { id: String(result.insertedId), ...doc, userId: undefined } });
});

router.get('/support/tickets', requireAuth, async (req, res) => {
  const docs = await getDb()
    .collection('tickets')
    .find({ userId: req.user._id })
    .sort({ createdAt: -1 })
    .limit(50)
    .toArray();
  res.json({
    items: docs.map((doc) => ({
      id: String(doc._id),
      type: doc.type,
      subject: doc.subject,
      message: doc.message,
      status: doc.status,
      createdAt: doc.createdAt,
    })),
  });
});

// Settings ------------------------------------------------------------------
router.get('/settings', requireAuth, async (req, res) => {
  res.json({
    settings: { ...defaultSettings(), ...(req.user.settings || {}) },
    profile: {
      unitSystem: req.user.unitSystem || 'metric',
      theme: req.user.theme || 'dark',
      isPublic: req.user.isPublic !== false,
      heightCm: req.user.heightCm ?? null,
      timezone: req.user.settings?.timezone || 'UTC',
    },
  });
});

router.patch('/settings', requireAuth, async (req, res) => {
  const body = req.body || {};
  const db = getDb();
  const updates = { updatedAt: new Date() };
  const current = { ...defaultSettings(), ...(req.user.settings || {}) };
  const settings = { ...current };

  const booleanKeys = ['notifyWorkout', 'notifyMeal', 'notifyGoals', 'notifySocial', 'notifyEmail'];
  const numberKeys = ['calorieGoal', 'proteinGoal', 'carbsGoal', 'fatGoal', 'waterGoal', 'stepGoal'];

  for (const key of booleanKeys) {
    if (body[key] === undefined) continue;
    settings[key] = Boolean(body[key]);
  }
  for (const key of numberKeys) {
    if (body[key] === undefined) continue;
    const value = Number(body[key]);
    assertOk(Number.isFinite(value) && value >= 0 && value <= 20000, `${key} must be a positive number.`, key);
    settings[key] = Math.round(value);
  }
  if (body.timezone !== undefined) {
    const timezone = str(body.timezone, 60) || 'UTC';
    try {
      new Intl.DateTimeFormat('en-GB', { timeZone: timezone });
    } catch {
      assertOk(false, 'That timezone is not recognised.', 'timezone');
    }
    settings.timezone = timezone;
  }
  if (body.weekStart !== undefined) {
    const day = Number(body.weekStart);
    assertOk(Number.isInteger(day) && day >= 0 && day <= 6, 'Week start must be a weekday.', 'weekStart');
    settings.weekStart = day;
  }
  updates.settings = settings;

  if (body.unitSystem !== undefined) {
    assertOk(['metric', 'imperial'].includes(body.unitSystem), 'Units must be metric or imperial.', 'unitSystem');
    updates.unitSystem = body.unitSystem;
  }
  if (body.theme !== undefined) {
    assertOk(['dark', 'light'].includes(body.theme), 'Theme must be dark or light.', 'theme');
    updates.theme = body.theme;
  }
  if (body.isPublic !== undefined) updates.isPublic = Boolean(body.isPublic);
  if (body.heightCm !== undefined) {
    if (body.heightCm === null || body.heightCm === '') updates.heightCm = null;
    else {
      const height = Number(body.heightCm);
      assertOk(Number.isFinite(height) && height >= 50 && height <= 260, 'Height must be between 50 and 260 cm.', 'heightCm');
      updates.heightCm = height;
    }
  }

  const updated = await db.collection('users').findOneAndUpdate({ _id: req.user._id }, { $set: updates }, { returnDocument: 'after' });
  res.json({
    settings: updated.settings,
    profile: {
      unitSystem: updated.unitSystem,
      theme: updated.theme,
      isPublic: updated.isPublic,
      heightCm: updated.heightCm ?? null,
    },
  });
});

module.exports = { router };
