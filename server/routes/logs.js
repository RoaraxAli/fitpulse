'use strict';

const express = require('express');
const { getDb, toObjectId } = require('../db');
const { workoutLog } = require('../serializers');
const { requireAuth } = require('../auth');
const {
  notFound,
  str,
  num,
  int,
  clamp,
  escapeRegex,
  pagination,
  paginated,
  assertOk,
  isISODate,
  todayISO,
} = require('../utils');
const { notify } = require('../services/notifications');
const { checkAchievements } = require('../services/achievements');
const { applyGoalProgress } = require('../services/goals');

const router = express.Router();

function normalizeSets(input) {
  if (!Array.isArray(input)) return [];
  return input.slice(0, 300).map((set, index) => ({
    exerciseName: str(set?.exerciseName, 80),
    setNumber: clamp(int(set?.setNumber, index + 1), 1, 100),
    reps: clamp(int(set?.reps, 0), 0, 1000),
    weight: clamp(num(set?.weight, 0), 0, 2000),
    notes: str(set?.notes, 200),
  })).filter((set) => set.exerciseName.length > 0);
}

router.get('/', requireAuth, async (req, res) => {
  const db = getDb();
  const q = str(req.query.q, 80);
  const category = str(req.query.category, 20);
  const from = isISODate(req.query.from) ? req.query.from : null;
  const to = isISODate(req.query.to) ? req.query.to : null;
  const { page, limit, skip } = pagination(req.query, 15, 100);

  const filter = { userId: req.user._id };
  if (q) filter.name = new RegExp(escapeRegex(q), 'i');
  if (category && category !== 'all') filter.category = category;
  if (from || to) filter.performedAt = {};
  if (from) filter.performedAt.$gte = from;
  if (to) filter.performedAt.$lte = to;

  const [docs, total] = await Promise.all([
    db.collection('workoutlogs').find(filter).sort({ performedAt: -1, createdAt: -1 }).skip(skip).limit(limit).toArray(),
    db.collection('workoutlogs').countDocuments(filter),
  ]);
  res.json(paginated(docs.map(workoutLog), total, page, limit));
});

router.get('/prs', requireAuth, async (req, res) => {
  const rows = await getDb()
    .collection('workoutlogs')
    .aggregate([
      { $match: { userId: req.user._id } },
      { $unwind: '$sets' },
      { $match: { 'sets.weight': { $gt: 0 } } },
      { $sort: { 'sets.weight': -1, 'sets.reps': -1 } },
      {
        $group: {
          _id: '$sets.exerciseName',
          weight: { $first: '$sets.weight' },
          reps: { $first: '$sets.reps' },
          date: { $first: '$performedAt' },
        },
      },
      { $sort: { _id: 1 } },
    ])
    .toArray();

  const items = rows.map((row) => ({
    exerciseName: row._id,
    weight: row.weight,
    reps: row.reps,
    date: row.date,
    estimated1RM: Math.round(row.weight * (1 + row.reps / 30) * 10) / 10,
  }));
  res.json({ items });
});

router.get('/:id', requireAuth, async (req, res) => {
  const id = toObjectId(req.params.id);
  if (!id) throw notFound('Workout log not found.');
  const doc = await getDb().collection('workoutlogs').findOne({ _id: id, userId: req.user._id });
  if (!doc) throw notFound('Workout log not found.');
  res.json({ log: workoutLog(doc) });
});

router.post('/', requireAuth, async (req, res) => {
  const body = req.body || {};
  const db = getDb();
  const performedAt = isISODate(body.performedAt) ? body.performedAt : todayISO();
  let name = str(body.name, 80);
  let category = str(body.category, 20) || 'strength';
  let sets = normalizeSets(body.sets);
  let workoutId = null;

  if (body.workoutId) {
    workoutId = toObjectId(body.workoutId);
    assertOk(Boolean(workoutId), 'That routine could not be found.', 'workoutId');
    const routine = await db.collection('workouts').findOne({ _id: workoutId });
    assertOk(Boolean(routine), 'That routine could not be found.', 'workoutId');
    assertOk(String(routine.userId) === String(req.user._id) || routine.isPublic, 'That routine could not be found.', 'workoutId');
    workoutId = routine._id;
    name = name || routine.name;
    category = routine.category;
    if (!sets.length) {
      routine.exercises.forEach((exercise) => {
        for (let index = 1; index <= exercise.sets; index += 1) {
          sets.push({
            exerciseName: exercise.name,
            setNumber: index,
            reps: exercise.reps,
            weight: exercise.weight,
            notes: '',
          });
        }
      });
    }
  }

  assertOk(name.length > 0, 'Give this workout a name.', 'name');
  assertOk(sets.length > 0, 'Add at least one set.', 'sets');

  let volume = 0;
  sets.forEach((set) => {
    volume += set.reps * set.weight;
  });

  const doc = {
    userId: req.user._id,
    workoutId,
    name,
    category,
    performedAt,
    durationMin: clamp(int(body.durationMin, 0), 0, 600),
    caloriesBurned: clamp(int(body.caloriesBurned, 0), 0, 5000),
    rating: clamp(int(body.rating, 0), 0, 5),
    notes: str(body.notes, 1000),
    sets,
    createdAt: new Date(),
  };
  const result = await db.collection('workoutlogs').insertOne(doc);
  doc._id = result.insertedId;

  const summary = `${doc.durationMin ? `${doc.durationMin} min` : `${sets.length} sets`}${volume ? ` · ${Math.round(volume)} kg volume` : ''}`;
  await notify(req.user._id, {
    type: 'workout',
    title: `Workout logged: ${name}`,
    body: summary,
    icon: 'dumbbell',
    link: '/workouts',
  });
  await applyGoalProgress(req.user._id, 'workouts', 1);
  await checkAchievements(req.user._id);

  res.status(201).json({ log: workoutLog(doc), volume: Math.round(volume) });
});

router.delete('/:id', requireAuth, async (req, res) => {
  const id = toObjectId(req.params.id);
  if (!id) throw notFound('Workout log not found.');
  const result = await getDb().collection('workoutlogs').deleteOne({ _id: id, userId: req.user._id });
  if (!result.deletedCount) throw notFound('Workout log not found.');
  res.json({ ok: true });
});

module.exports = { router };
