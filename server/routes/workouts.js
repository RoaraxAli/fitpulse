'use strict';

const express = require('express');
const { getDb, toObjectId } = require('../db');
const { workout } = require('../serializers');
const { requireAuth } = require('../auth');
const {
  badRequest,
  notFound,
  str,
  num,
  int,
  clamp,
  bool,
  escapeRegex,
  pagination,
  paginated,
  assertOk,
} = require('../utils');

const router = express.Router();

const CATEGORIES = ['strength', 'cardio', 'hiit', 'mobility', 'endurance', 'other'];

function normalizeCategory(value, fallback = 'strength') {
  const category = str(value, 20).toLowerCase() || fallback;
  return CATEGORIES.includes(category) ? category : fallback;
}

function normalizeExercises(input) {
  if (!Array.isArray(input)) return [];
  return input
    .slice(0, 40)
    .map((exercise) => ({
      name: str(exercise?.name, 80),
      sets: clamp(int(exercise?.sets, 3), 1, 50),
      reps: clamp(int(exercise?.reps, 10), 0, 1000),
      weight: clamp(num(exercise?.weight, 0), 0, 2000),
      restSeconds: clamp(int(exercise?.restSeconds, 60), 0, 3600),
      notes: str(exercise?.notes, 300),
    }))
    .filter((exercise) => exercise.name.length > 0);
}

router.get('/meta', (req, res) => {
  res.json({
    categories: CATEGORIES,
    tags: ['push', 'pull', 'legs', 'upper', 'lower', 'full-body', 'core', 'mobility', 'conditioning'],
  });
});

router.get('/meta/exercises', requireAuth, async (req, res) => {
  const db = getDb();
  const [catalog, fromWorkouts, fromLogs] = await Promise.all([
    db.collection('exerciseCatalog').find({}).sort({ name: 1 }).toArray(),
    db
      .collection('workouts')
      .aggregate([
        { $match: { userId: req.user._id } },
        { $unwind: '$exercises' },
        { $group: { _id: '$exercises.name' } },
        { $sort: { _id: 1 } },
      ])
      .toArray(),
    db
      .collection('workoutlogs')
      .aggregate([
        { $match: { userId: req.user._id } },
        { $unwind: '$sets' },
        { $group: { _id: '$sets.exerciseName' } },
      ])
      .toArray(),
  ]);
  const names = new Map();
  catalog.forEach((doc) => names.set(doc.name.toLowerCase(), { name: doc.name, category: doc.category, muscleGroup: doc.muscleGroup }));
  fromWorkouts.forEach((doc) => {
    if (doc._id && !names.has(doc._id.toLowerCase())) names.set(doc._id.toLowerCase(), { name: doc._id, category: 'custom', muscleGroup: '' });
  });
  fromLogs.forEach((doc) => {
    if (doc._id && !names.has(doc._id.toLowerCase())) names.set(doc._id.toLowerCase(), { name: doc._id, category: 'custom', muscleGroup: '' });
  });
  res.json({ items: [...names.values()] });
});

router.get('/', requireAuth, async (req, res) => {
  const db = getDb();
  const q = str(req.query.q, 80);
  const category = str(req.query.category, 20);
  const tag = str(req.query.tag, 30);
  const sort = str(req.query.sort, 20) || 'recent';
  const scope = str(req.query.scope, 20) || 'all';
  const { page, limit, skip } = pagination(req.query, 12, 60);

  const scopeFilter =
    scope === 'mine'
      ? { userId: req.user._id }
      : scope === 'templates'
        ? { isTemplate: true }
        : { $or: [{ userId: req.user._id }, { isTemplate: true }] };
  const filter = { ...scopeFilter };
  if (category && category !== 'all') filter.category = category;
  if (q) {
    filter.$or = [
      { name: new RegExp(escapeRegex(q), 'i') },
      { description: new RegExp(escapeRegex(q), 'i') },
      { tags: new RegExp(escapeRegex(q), 'i') },
      { 'exercises.name': new RegExp(escapeRegex(q), 'i') },
    ];
  }
  if (tag) filter.tags = tag;

  const sortSpec = sort === 'name' ? { name: 1 } : sort === 'oldest' ? { createdAt: 1 } : sort === 'updated' ? { updatedAt: -1 } : { createdAt: -1 };
  const [docs, total] = await Promise.all([
    db.collection('workouts').find(filter).sort(sortSpec).skip(skip).limit(limit).toArray(),
    db.collection('workouts').countDocuments(filter),
  ]);

  const items = docs.map((doc) => {
    const dto = workout(doc);
    return {
      ...dto,
      exerciseCount: dto.exercises.length,
      totalSets: dto.exercises.reduce((sum, ex) => sum + ex.sets, 0),
    };
  });
  res.json(paginated(items, total, page, limit));
});

router.post('/', requireAuth, async (req, res) => {
  const body = req.body || {};
  const name = str(body.name, 80);
  assertOk(name.length > 0, 'Give your routine a name.', 'name');
  const exercises = normalizeExercises(body.exercises);
  assertOk(exercises.length > 0, 'Add at least one exercise.', 'exercises');

  const now = new Date();
  const doc = {
    userId: req.user._id,
    name,
    category: normalizeCategory(body.category),
    description: str(body.description, 1000),
    tags: Array.isArray(body.tags)
      ? body.tags.map((tag) => str(tag, 30)).filter(Boolean).slice(0, 10)
      : [],
    isPublic: bool(body.isPublic, false),
    videoUrl: body.videoUrl === undefined ? null : str(body.videoUrl, 500) || null,
    exercises,
    createdAt: now,
    updatedAt: now,
  };
  const result = await getDb().collection('workouts').insertOne(doc);
  doc._id = result.insertedId;
  res.status(201).json({ workout: workout(doc) });
});

router.get('/:id', requireAuth, async (req, res) => {
  const id = toObjectId(req.params.id);
  if (!id) throw notFound('Routine not found.');
  const doc = await getDb().collection('workouts').findOne({ _id: id });
  if (!doc) throw notFound('Routine not found.');
  if (String(doc.userId) !== String(req.user._id) && !doc.isPublic && !doc.isTemplate) throw notFound('Routine not found.');
  res.json({ workout: workout(doc) });
});

router.put('/:id', requireAuth, async (req, res) => {
  const id = toObjectId(req.params.id);
  if (!id) throw notFound('Routine not found.');
  const db = getDb();
  const existing = await db.collection('workouts').findOne({ _id: id });
  if (!existing) throw notFound('Routine not found.');
  if (String(existing.userId) !== String(req.user._id)) throw notFound('Routine not found.');

  const body = req.body || {};
  const updates = { updatedAt: new Date() };
  if (body.name !== undefined) {
    const name = str(body.name, 80);
    assertOk(name.length > 0, 'Routine name cannot be empty.', 'name');
    updates.name = name;
  }
  if (body.category !== undefined) updates.category = normalizeCategory(body.category, existing.category);
  if (body.description !== undefined) updates.description = str(body.description, 1000);
  if (body.tags !== undefined) updates.tags = Array.isArray(body.tags) ? body.tags.map((t) => str(t, 30)).filter(Boolean).slice(0, 10) : [];
  if (body.isPublic !== undefined) updates.isPublic = bool(body.isPublic, false);
  if (body.videoUrl !== undefined) updates.videoUrl = str(body.videoUrl, 500) || null;
  if (body.exercises !== undefined) {
    const exercises = normalizeExercises(body.exercises);
    assertOk(exercises.length > 0, 'Add at least one exercise.', 'exercises');
    updates.exercises = exercises;
  }

  const updated = await db.collection('workouts').findOneAndUpdate({ _id: id }, { $set: updates }, { returnDocument: 'after' });
  res.json({ workout: workout(updated) });
});

router.delete('/:id', requireAuth, async (req, res) => {
  const id = toObjectId(req.params.id);
  if (!id) throw notFound('Routine not found.');
  const db = getDb();
  const existing = await db.collection('workouts').findOne({ _id: id });
  if (!existing) throw notFound('Routine not found.');
  if (String(existing.userId) !== String(req.user._id)) throw notFound('Routine not found.');
  await db.collection('workouts').deleteOne({ _id: id });
  await db.collection('workoutlogs').updateMany({ workoutId: id }, { $set: { workoutId: null } });
  res.json({ ok: true });
});

router.post('/:id/duplicate', requireAuth, async (req, res) => {
  const id = toObjectId(req.params.id);
  if (!id) throw notFound('Routine not found.');
  const db = getDb();
  const existing = await db.collection('workouts').findOne({ _id: id });
  if (!existing) throw notFound('Routine not found.');
  if (String(existing.userId) !== String(req.user._id) && !existing.isPublic && !existing.isTemplate) throw notFound('Routine not found.');
  const now = new Date();
  const doc = {
    userId: req.user._id,
    name: `${existing.name} (copy)`.slice(0, 80),
    category: existing.category,
    description: existing.description,
    tags: existing.tags || [],
    isPublic: false,
    videoUrl: existing.videoUrl || null,
    exercises: existing.exercises || [],
    createdAt: now,
    updatedAt: now,
  };
  const result = await db.collection('workouts').insertOne(doc);
  doc._id = result.insertedId;
  res.status(201).json({ workout: workout(doc) });
});

module.exports = { router, CATEGORIES, normalizeCategory };
