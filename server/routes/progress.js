'use strict';

const express = require('express');
const { getDb, toObjectId } = require('../db');
const { measurement, metric, goal } = require('../serializers');
const { requireAuth } = require('../auth');
const {
  badRequest,
  notFound,
  str,
  num,
  int,
  clamp,
  assertOk,
  isISODate,
  todayISO,
  dateRange,
  daysAgoISO,
  round,
  pagination,
  paginated,
} = require('../utils');
const { checkAchievements, listAchievements } = require('../services/achievements');
const { applyMeasurementProgress } = require('../services/goals');
const { notify } = require('../services/notifications');

const measurements = express.Router();
const metrics = express.Router();
const goals = express.Router();
const summary = express.Router();

const optionalNumber = (value, min, max, field) => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const parsed = num(value);
  assertOk(parsed !== null && parsed >= min && parsed <= max, `${field} must be between ${min} and ${max}.`, field);
  return parsed;
};

// ---------------------------------------------------------------------------
// Measurements
// ---------------------------------------------------------------------------
measurements.get('/', requireAuth, async (req, res) => {
  const from = isISODate(req.query.from) ? req.query.from : daysAgoISO(180);
  const to = isISODate(req.query.to) ? req.query.to : todayISO();
  const limit = clamp(int(req.query.limit, 200), 1, 400);
  const docs = await getDb()
    .collection('measurements')
    .find({ userId: req.user._id, measuredOn: { $gte: from, $lte: to } })
    .sort({ measuredOn: 1 })
    .limit(limit)
    .toArray();
  res.json({ items: docs.map(measurement), range: { start: from, end: to } });
});

measurements.get('/latest', requireAuth, async (req, res) => {
  const doc = await getDb().collection('measurements').findOne({ userId: req.user._id }, { sort: { measuredOn: -1 } });
  res.json({ measurement: measurement(doc) });
});

measurements.post('/', requireAuth, async (req, res) => {
  const body = req.body || {};
  const measuredOn = isISODate(body.measuredOn) ? body.measuredOn : todayISO();
  const fields = {
    weightKg: optionalNumber(body.weightKg, 20, 400, 'Weight'),
    bodyFatPct: optionalNumber(body.bodyFatPct, 1, 70, 'Body fat'),
    chestCm: optionalNumber(body.chestCm, 20, 300, 'Chest'),
    waistCm: optionalNumber(body.waistCm, 20, 300, 'Waist'),
    hipsCm: optionalNumber(body.hipsCm, 20, 300, 'Hips'),
    armsCm: optionalNumber(body.armsCm, 10, 100, 'Arms'),
    thighsCm: optionalNumber(body.thighsCm, 10, 150, 'Thighs'),
  };
  const provided = Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
  assertOk(Object.keys(provided).length > 0, 'Enter at least one measurement.', 'fields');

  const db = getDb();
  const update = { ...provided, notes: str(body.notes, 300), createdAt: new Date() };
  const doc = await db
    .collection('measurements')
    .findOneAndUpdate(
      { userId: req.user._id, measuredOn },
      { $set: update },
      { upsert: true, returnDocument: 'after', includeResultMetadata: false }
    );

  if (provided.weightKg) {
    await applyMeasurementProgress(req.user._id, provided.weightKg);
  }
  await checkAchievements(req.user._id);
  res.status(201).json({ measurement: measurement(doc) });
});

measurements.put('/:id', requireAuth, async (req, res) => {
  const id = toObjectId(req.params.id);
  if (!id) throw notFound('Measurement not found.');
  const body = req.body || {};
  const updates = {};
  const fields = {
    weightKg: [20, 400, 'Weight'],
    bodyFatPct: [1, 70, 'Body fat'],
    chestCm: [20, 300, 'Chest'],
    waistCm: [20, 300, 'Waist'],
    hipsCm: [20, 300, 'Hips'],
    armsCm: [10, 100, 'Arms'],
    thighsCm: [10, 150, 'Thighs'],
  };
  for (const [key, [min, max, label]] of Object.entries(fields)) {
    if (body[key] === undefined) continue;
    const value = optionalNumber(body[key], min, max, label);
    if (value !== null) updates[key] = value;
  }
  if (body.notes !== undefined) updates.notes = str(body.notes, 300);
  if (!Object.keys(updates).length) throw badRequest('Nothing to update.');
  const doc = await getDb().collection('measurements').findOneAndUpdate(
    { _id: id, userId: req.user._id },
    { $set: updates },
    { returnDocument: 'after' }
  );
  if (!doc) throw notFound('Measurement not found.');
  res.json({ measurement: measurement(doc) });
});

measurements.delete('/:id', requireAuth, async (req, res) => {
  const id = toObjectId(req.params.id);
  if (!id) throw notFound('Measurement not found.');
  const result = await getDb().collection('measurements').deleteOne({ _id: id, userId: req.user._id });
  if (!result.deletedCount) throw notFound('Measurement not found.');
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Performance metrics
// ---------------------------------------------------------------------------
metrics.get('/types', requireAuth, async (req, res) => {
  const rows = await getDb()
    .collection('metrics')
    .aggregate([
      { $match: { userId: req.user._id } },
      { $sort: { recordedOn: -1 } },
      {
        $group: {
          _id: { $toLower: '$metric' },
          name: { $first: '$metric' },
          unit: { $first: '$unit' },
          latest: { $first: '$value' },
          date: { $first: '$recordedOn' },
          best: { $max: '$value' },
          count: { $sum: 1 },
        },
      },
      { $sort: { name: 1 } },
    ])
    .toArray();
  res.json({ items: rows });
});

metrics.get('/', requireAuth, async (req, res) => {
  const filter = { userId: req.user._id };
  if (req.query.metric) filter.metric = new RegExp(`^${String(req.query.metric).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
  const from = isISODate(req.query.from) ? req.query.from : daysAgoISO(365);
  const to = isISODate(req.query.to) ? req.query.to : todayISO();
  filter.recordedOn = { $gte: from, $lte: to };
  const docs = await getDb().collection('metrics').find(filter).sort({ recordedOn: 1 }).limit(400).toArray();
  res.json({ items: docs.map(metric) });
});

metrics.post('/', requireAuth, async (req, res) => {
  const body = req.body || {};
  const name = str(body.metric, 60);
  assertOk(name.length > 0, 'Name this performance metric.', 'metric');
  const value = num(body.value);
  assertOk(value !== null, 'Enter a numeric value.', 'value');
  const doc = {
    userId: req.user._id,
    metric: name,
    value: clamp(value, -1000000, 1000000),
    unit: str(body.unit, 20),
    recordedOn: isISODate(body.recordedOn) ? body.recordedOn : todayISO(),
    notes: str(body.notes, 300),
    createdAt: new Date(),
  };
  const result = await getDb().collection('metrics').insertOne(doc);
  doc._id = result.insertedId;
  res.status(201).json({ metric: metric(doc) });
});

metrics.delete('/:id', requireAuth, async (req, res) => {
  const id = toObjectId(req.params.id);
  if (!id) throw notFound('Metric not found.');
  const result = await getDb().collection('metrics').deleteOne({ _id: id, userId: req.user._id });
  if (!result.deletedCount) throw notFound('Metric not found.');
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Goals
// ---------------------------------------------------------------------------
const GOAL_TYPES = ['workouts', 'weight_loss', 'weight', 'strength', 'nutrition', 'custom'];
const GOAL_STATUSES = ['active', 'completed', 'archived'];

goals.get('/', requireAuth, async (req, res) => {
  const status = str(req.query.status, 20) || 'all';
  const filter = { userId: req.user._id };
  if (status !== 'all') {
    assertOk(GOAL_STATUSES.includes(status), 'Invalid goal status.', 'status');
    filter.status = status;
  }
  const docs = await getDb().collection('goals').find(filter).sort({ status: 1, createdAt: -1 }).toArray();
  const items = docs.map(goal);
  res.json({
    items,
    summary: {
      active: items.filter((g) => g.status === 'active').length,
      completed: items.filter((g) => g.status === 'completed').length,
      averageProgress: items.length
        ? Math.round(items.reduce((sum, g) => sum + g.progress, 0) / items.length)
        : 0,
    },
  });
});

goals.post('/', requireAuth, async (req, res) => {
  const body = req.body || {};
  const title = str(body.title, 100);
  assertOk(title.length > 0, 'Give your goal a title.', 'title');
  const type = str(body.type, 20) || 'custom';
  assertOk(GOAL_TYPES.includes(type), 'Choose a valid goal type.', 'type');
  const targetValue = num(body.targetValue);
  assertOk(targetValue !== null && targetValue > 0, 'Target must be greater than zero.', 'targetValue');

  let startValue = num(body.startValue, null);
  if (startValue === null && ['weight_loss', 'weight'].includes(type)) {
    const latest = await getDb().collection('measurements').findOne({ userId: req.user._id }, { sort: { measuredOn: -1 } });
    startValue = latest?.weightKg ?? null;
  }

  const now = new Date();
  const doc = {
    userId: req.user._id,
    title,
    type,
    targetValue,
    currentValue: clamp(num(body.currentValue, 0), 0, 1e6),
    unit: str(body.unit, 12),
    deadline: isISODate(body.deadline) ? body.deadline : null,
    startValue,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };
  const result = await getDb().collection('goals').insertOne(doc);
  doc._id = result.insertedId;
  res.status(201).json({ goal: goal(doc) });
});

goals.patch('/:id', requireAuth, async (req, res) => {
  const id = toObjectId(req.params.id);
  if (!id) throw notFound('Goal not found.');
  const db = getDb();
  const existing = await db.collection('goals').findOne({ _id: id, userId: req.user._id });
  if (!existing) throw notFound('Goal not found.');

  const body = req.body || {};
  const updates = { updatedAt: new Date() };
  if (body.title !== undefined) {
    const title = str(body.title, 100);
    assertOk(title.length > 0, 'Title cannot be empty.', 'title');
    updates.title = title;
  }
  if (body.targetValue !== undefined) {
    const target = num(body.targetValue);
    assertOk(target !== null && target > 0, 'Target must be greater than zero.', 'targetValue');
    updates.targetValue = target;
  }
  if (body.currentValue !== undefined) updates.currentValue = clamp(num(body.currentValue, 0), 0, 1e6);
  if (body.unit !== undefined) updates.unit = str(body.unit, 12);
  if (body.deadline !== undefined) updates.deadline = isISODate(body.deadline) ? body.deadline : null;
  if (body.status !== undefined) {
    assertOk(GOAL_STATUSES.includes(body.status), 'Invalid goal status.', 'status');
    updates.status = body.status;
  }

  const target = updates.targetValue ?? existing.targetValue;
  const current = updates.currentValue ?? existing.currentValue;
  const wasActive = existing.status === 'active';
  if (body.status === undefined && wasActive && target > 0 && current >= target) {
    updates.status = 'completed';
    updates.currentValue = target;
  }

  const updated = await db.collection('goals').findOneAndUpdate({ _id: id }, { $set: updates }, { returnDocument: 'after' });
  if (wasActive && updated.status === 'completed') {
    await notify(req.user._id, {
      type: 'goal',
      title: `Goal achieved: ${updated.title}`,
      body: `Target of ${updated.targetValue}${updated.unit ? ` ${updated.unit}` : ''} reached.`,
      icon: 'target',
      link: '/progress',
    });
    await checkAchievements(req.user._id);
  }
  res.json({ goal: goal(updated) });
});

goals.delete('/:id', requireAuth, async (req, res) => {
  const id = toObjectId(req.params.id);
  if (!id) throw notFound('Goal not found.');
  const result = await getDb().collection('goals').deleteOne({ _id: id, userId: req.user._id });
  if (!result.deletedCount) throw notFound('Goal not found.');
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Combined progress summary
// ---------------------------------------------------------------------------
summary.get('/', requireAuth, async (req, res) => {
  const range = dateRange(req.query.from, req.query.to || todayISO());
  const userId = req.user._id;
  const db = getDb();
  const [measurementDocs, allMeasurements, prRows, goalsDocs, achievements] = await Promise.all([
    db.collection('measurements').find({ userId, measuredOn: { $gte: range.start, $lte: range.end } }).sort({ measuredOn: 1 }).toArray(),
    db.collection('measurements').find({ userId }).sort({ measuredOn: 1 }).limit(400).toArray(),
    db
      .collection('workoutlogs')
      .aggregate([
        { $match: { userId } },
        { $unwind: '$sets' },
        { $match: { 'sets.weight': { $gt: 0 } } },
        { $sort: { 'sets.weight': -1, 'sets.reps': -1 } },
        { $group: { _id: '$sets.exerciseName', weight: { $first: '$sets.weight' }, reps: { $first: '$sets.reps' }, date: { $first: '$performedAt' } } },
        { $sort: { _id: 1 } },
      ])
      .toArray(),
    db.collection('goals').find({ userId }).sort({ status: 1, createdAt: -1 }).toArray(),
    listAchievements(userId),
  ]);

  const first = measurementDocs[0];
  const latest = allMeasurements[allMeasurements.length - 1];
  const weightChange =
    first?.weightKg != null && latest?.weightKg != null ? round(latest.weightKg - first.weightKg, 1) : null;

  res.json({
    range,
    measurements: measurementDocs.map(measurement),
    latest: measurement(latest),
    weightChange,
    startWeightKg: first?.weightKg ?? null,
    prs: prRows.map((row) => ({
      exerciseName: row._id,
      weight: row.weight,
      reps: row.reps,
      date: row.date,
      estimated1RM: round(row.weight * (1 + row.reps / 30), 1),
    })),
    goals: goalsDocs.map(goal),
    achievements,
  });
});

module.exports = { measurements, metrics, goals, summary };
