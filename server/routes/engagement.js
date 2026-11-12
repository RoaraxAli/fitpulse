'use strict';

const express = require('express');
const { getDb, toObjectId } = require('../db');
const { notification, reminder } = require('../serializers');
const { requireAuth } = require('../auth');
const {
  notFound,
  str,
  int,
  clamp,
  bool,
  pagination,
  paginated,
  assertOk,
  isISODate,
} = require('../utils');
const { notify } = require('../services/notifications');

const notifications = express.Router();
const reminders = express.Router();

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------
notifications.get('/', requireAuth, async (req, res) => {
  const db = getDb();
  const filter = { userId: req.user._id };
  if (req.query.filter === 'unread') filter.isRead = false;
  const { page, limit, skip } = pagination(req.query, 20, 60);
  const [docs, total, unread] = await Promise.all([
    db.collection('notifications').find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
    db.collection('notifications').countDocuments(filter),
    db.collection('notifications').countDocuments({ userId: req.user._id, isRead: false }),
  ]);
  res.json({ ...paginated(docs.map(notification), total, page, limit), unread });
});

notifications.get('/count', requireAuth, async (req, res) => {
  const unread = await getDb().collection('notifications').countDocuments({ userId: req.user._id, isRead: false });
  res.json({ unread });
});

notifications.patch('/:id/read', requireAuth, async (req, res) => {
  const id = toObjectId(req.params.id);
  if (!id) throw notFound('Notification not found.');
  const result = await getDb()
    .collection('notifications')
    .updateOne({ _id: id, userId: req.user._id }, { $set: { isRead: true } });
  if (!result.matchedCount) throw notFound('Notification not found.');
  res.json({ ok: true });
});

notifications.post('/read-all', requireAuth, async (req, res) => {
  await getDb().collection('notifications').updateMany({ userId: req.user._id, isRead: false }, { $set: { isRead: true } });
  res.json({ ok: true });
});

notifications.delete('/:id', requireAuth, async (req, res) => {
  const id = toObjectId(req.params.id);
  if (!id) throw notFound('Notification not found.');
  const result = await getDb().collection('notifications').deleteOne({ _id: id, userId: req.user._id });
  if (!result.deletedCount) throw notFound('Notification not found.');
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Reminders
// ---------------------------------------------------------------------------
const REMINDER_TYPES = ['workout', 'meal', 'water', 'sleep', 'custom'];

function normalizeTime(value) {
  const time = str(value, 5);
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(time) ? time : '18:00';
}

function normalizeDays(value) {
  if (!Array.isArray(value)) return [0, 1, 2, 3, 4, 5, 6];
  return [...new Set(value.map((day) => int(day, -1)).filter((day) => day >= 0 && day <= 6))].sort();
}

reminders.get('/', requireAuth, async (req, res) => {
  const docs = await getDb().collection('reminders').find({ userId: req.user._id }).sort({ timeOfDay: 1 }).toArray();
  res.json({ items: docs.map(reminder) });
});

reminders.post('/', requireAuth, async (req, res) => {
  const body = req.body || {};
  const title = str(body.title, 80);
  assertOk(title.length > 0, 'Give your reminder a title.', 'title');
  const type = str(body.type, 20) || 'workout';
  assertOk(REMINDER_TYPES.includes(type), 'Choose a valid reminder type.', 'type');
  const doc = {
    userId: req.user._id,
    title,
    type,
    timeOfDay: normalizeTime(body.timeOfDay),
    days: normalizeDays(body.days),
    enabled: bool(body.enabled, true),
    lastFiredAt: null,
    createdAt: new Date(),
  };
  const result = await getDb().collection('reminders').insertOne(doc);
  doc._id = result.insertedId;
  res.status(201).json({ reminder: reminder(doc) });
});

reminders.patch('/:id', requireAuth, async (req, res) => {
  const id = toObjectId(req.params.id);
  if (!id) throw notFound('Reminder not found.');
  const body = req.body || {};
  const updates = {};
  if (body.title !== undefined) {
    const title = str(body.title, 80);
    assertOk(title.length > 0, 'Title cannot be empty.', 'title');
    updates.title = title;
  }
  if (body.type !== undefined) {
    assertOk(REMINDER_TYPES.includes(body.type), 'Choose a valid reminder type.', 'type');
    updates.type = body.type;
  }
  if (body.timeOfDay !== undefined) updates.timeOfDay = normalizeTime(body.timeOfDay);
  if (body.days !== undefined) updates.days = normalizeDays(body.days);
  if (body.enabled !== undefined) updates.enabled = bool(body.enabled, true);
  if (!Object.keys(updates).length) throw notFound('Nothing to update.');
  const updated = await getDb().collection('reminders').findOneAndUpdate(
    { _id: id, userId: req.user._id },
    { $set: updates },
    { returnDocument: 'after' }
  );
  if (!updated) throw notFound('Reminder not found.');
  res.json({ reminder: reminder(updated) });
});

reminders.delete('/:id', requireAuth, async (req, res) => {
  const id = toObjectId(req.params.id);
  if (!id) throw notFound('Reminder not found.');
  const result = await getDb().collection('reminders').deleteOne({ _id: id, userId: req.user._id });
  if (!result.deletedCount) throw notFound('Reminder not found.');
  res.json({ ok: true });
});

reminders.get('/due', requireAuth, async (req, res) => {
  const db = getDb();
  const timezone = req.user.settings?.timezone || 'UTC';
  let local;
  try {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      weekday: 'short',
    });
    const parts = Object.fromEntries(formatter.formatToParts(new Date()).map((p) => [p.type, p.value]));
    const weekdayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    local = {
      date: `${parts.year}-${parts.month}-${parts.day}`,
      time: `${parts.hour === '24' ? '00' : parts.hour}:${parts.minute}`,
      weekday: weekdayMap[parts.weekday] ?? new Date().getUTCDay(),
      minutes: Number(parts.hour === '24' ? 0 : parts.hour) * 60 + Number(parts.minute),
    };
  } catch {
    const now = new Date();
    local = {
      date: now.toISOString().slice(0, 10),
      time: now.toISOString().slice(11, 16),
      weekday: now.getUTCDay(),
      minutes: now.getUTCHours() * 60 + now.getUTCMinutes(),
    };
  }

  const docs = await db.collection('reminders').find({ userId: req.user._id, enabled: true }).toArray();
  const fired = [];
  for (const doc of docs) {
    if (!Array.isArray(doc.days) || !doc.days.includes(local.weekday)) continue;
    const [hour, minute] = String(doc.timeOfDay || '18:00').split(':').map(Number);
    const reminderMinutes = hour * 60 + minute;
    const diff = local.minutes - reminderMinutes;
    if (diff < 0 || diff > 15) continue;
    if (doc.lastFiredAt === local.date) continue;
    const created = await notify(doc.userId, {
      type: doc.type === 'meal' ? 'meal' : 'reminder',
      title: doc.title,
      body: `It's ${doc.timeOfDay} — a gentle nudge from FitPulse.`,
      icon: doc.type === 'meal' ? 'utensils' : doc.type === 'water' ? 'droplet' : 'bell',
      link: doc.type === 'meal' ? '/nutrition' : '/workouts',
    });
    await db.collection('reminders').updateOne({ _id: doc._id }, { $set: { lastFiredAt: local.date } });
    if (created) fired.push(notification(created));
  }

  res.json({ localTime: local.time, localDate: local.date, fired, firedCount: fired.length });
});

module.exports = { notifications, reminders, REMINDER_TYPES };
