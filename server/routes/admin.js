'use strict';

const express = require('express');
const { getDb, toObjectId } = require('../db');
const { requireAuth, requireAdmin } = require('../auth');
const { str, int, clamp, pagination, paginated } = require('../utils');

const router = express.Router();
router.use(requireAuth, requireAdmin);

// Overview stats
router.get('/stats', async (req, res) => {
  const db = getDb();
  const [users, workouts, logs, posts, nutrition, measurements, goals, tickets] = await Promise.all([
    db.collection('users').countDocuments(),
    db.collection('workouts').countDocuments(),
    db.collection('workoutlogs').countDocuments(),
    db.collection('posts').countDocuments(),
    db.collection('nutritionlogs').countDocuments(),
    db.collection('measurements').countDocuments(),
    db.collection('goals').countDocuments(),
    db.collection('tickets').countDocuments(),
  ]);
  const admins = await db.collection('users').countDocuments({ role: 'admin' });
  res.json({ stats: { users, admins, workouts, logs, posts, nutrition, measurements, goals, tickets } });
});

// Users
router.get('/users', async (req, res) => {
  const db = getDb();
  const q = str(req.query.q, 80);
  const { page, limit, skip } = pagination(req.query, 20, 100);
  const filter = {};
  if (q) filter.$or = [{ username: new RegExp(q, 'i') }, { email: new RegExp(q, 'i') }, { name: new RegExp(q, 'i') }];
  const [docs, total] = await Promise.all([
    db.collection('users').find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
    db.collection('users').countDocuments(filter),
  ]);
  res.json(paginated(docs.map((u) => ({
    id: String(u._id),
    username: u.username,
    name: u.name,
    email: u.email,
    role: u.role || 'user',
    avatar: u.avatar || null,
    createdAt: u.createdAt,
    lastLoginAt: u.lastLoginAt,
  })), total, page, limit));
});

router.patch('/users/:id', async (req, res) => {
  const id = toObjectId(req.params.id);
  if (!id) return res.status(404).json({ error: { code: 'not_found', message: 'User not found.' } });
  const db = getDb();
  const updates = {};
  if (req.body?.role !== undefined) {
    if (!['user', 'admin'].includes(req.body.role)) {
      return res.status(400).json({ error: { code: 'bad_request', message: 'Role must be user or admin.' } });
    }
    updates.role = req.body.role;
  }
  if (req.body?.isPublic !== undefined) updates.isPublic = Boolean(req.body.isPublic);
  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: { code: 'bad_request', message: 'Nothing to update.' } });
  }
  updates.updatedAt = new Date();
  const result = await db.collection('users').findOneAndUpdate({ _id: id }, { $set: updates }, { returnDocument: 'after' });
  if (!result) return res.status(404).json({ error: { code: 'not_found', message: 'User not found.' } });
  res.json({ user: { id: String(result._id), username: result.username, role: result.role } });
});

router.delete('/users/:id', async (req, res) => {
  const id = toObjectId(req.params.id);
  if (!id) return res.status(404).json({ error: { code: 'not_found', message: 'User not found.' } });
  if (String(id) === String(req.user._id)) {
    return res.status(400).json({ error: { code: 'bad_request', message: 'Cannot delete your own account.' } });
  }
  const db = getDb();
  await Promise.all([
    db.collection('users').deleteOne({ _id: id }),
    db.collection('workouts').deleteMany({ userId: id }),
    db.collection('workoutlogs').deleteMany({ userId: id }),
    db.collection('nutritionlogs').deleteMany({ userId: id }),
    db.collection('measurements').deleteMany({ userId: id }),
    db.collection('goals').deleteMany({ userId: id }),
    db.collection('posts').deleteMany({ userId: id }),
    db.collection('chatMessages').deleteMany({ userId: id }),
  ]);
  res.json({ ok: true });
});

// Workouts (all)
router.get('/workouts', async (req, res) => {
  const db = getDb();
  const { page, limit, skip } = pagination(req.query, 20, 100);
  const [docs, total] = await Promise.all([
    db.collection('workouts').find({}).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
    db.collection('workouts').countDocuments({}),
  ]);
  const { workout } = require('../serializers');
  res.json(paginated(docs.map(workout), total, page, limit));
});

router.delete('/workouts/:id', async (req, res) => {
  const id = toObjectId(req.params.id);
  if (!id) return res.status(404).json({ error: { code: 'not_found', message: 'Routine not found.' } });
  await getDb().collection('workouts').deleteOne({ _id: id });
  res.json({ ok: true });
});

// Posts (all)
router.get('/posts', async (req, res) => {
  const db = getDb();
  const { page, limit, skip } = pagination(req.query, 20, 100);
  const [docs, total] = await Promise.all([
    db.collection('posts').find({}).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
    db.collection('posts').countDocuments({}),
  ]);
  res.json(paginated(docs.map((p) => ({
    id: String(p._id),
    userId: String(p.userId),
    title: p.title,
    category: p.category,
    createdAt: p.createdAt,
  })), total, page, limit));
});

router.delete('/posts/:id', async (req, res) => {
  const id = toObjectId(req.params.id);
  if (!id) return res.status(404).json({ error: { code: 'not_found', message: 'Post not found.' } });
  const db = getDb();
  await db.collection('posts').deleteOne({ _id: id });
  await db.collection('replies').deleteMany({ postId: id });
  res.json({ ok: true });
});

// Logs (recent)
router.get('/logs', async (req, res) => {
  const db = getDb();
  const { page, limit, skip } = pagination(req.query, 30, 100);
  const [docs, total] = await Promise.all([
    db.collection('workoutlogs').find({}).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
    db.collection('workoutlogs').countDocuments({}),
  ]);
  res.json(paginated(docs.map((l) => ({
    id: String(l._id),
    userId: String(l.userId),
    name: l.name,
    category: l.category,
    performedAt: l.performedAt,
    volume: l.volume || 0,
    createdAt: l.createdAt,
  })), total, page, limit));
});

// Tickets (all)
router.get('/tickets', async (req, res) => {
  const db = getDb();
  const { page, limit, skip } = pagination(req.query, 30, 100);
  const [docs, total] = await Promise.all([
    db.collection('tickets').find({}).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
    db.collection('tickets').countDocuments({}),
  ]);
  res.json(paginated(docs, total, page, limit));
});


// ===========================================================================
// Foods (catalog)
// ===========================================================================
router.get('/foods', async (req, res) => {
  const db = getDb();
  const { page, limit, skip } = pagination(req.query, 30, 200);
  const q = str(req.query.q, 80);
  const filter = q ? { name: new RegExp(q, 'i') } : {};
  const [docs, total] = await Promise.all([
    db.collection('foods').find(filter).sort({ name: 1 }).skip(skip).limit(limit).toArray(),
    db.collection('foods').countDocuments(filter),
  ]);
  res.json(paginated(docs.map((f) => ({ id: String(f._id), name: f.name, brand: f.brand, calories: f.calories, protein: f.protein, carbs: f.carbs, fat: f.fat, servingSize: f.servingSize, servingUnit: f.servingUnit })), total, page, limit));
});

router.post('/foods', async (req, res) => {
  const body = req.body || {};
  const name = str(body.name, 80);
  if (!name) return res.status(400).json({ error: { code: 'bad_request', message: 'Name required.' } });
  const doc = {
    name,
    brand: str(body.brand, 60),
    calories: Number(body.calories) || 0,
    protein: Number(body.protein) || 0,
    carbs: Number(body.carbs) || 0,
    fat: Number(body.fat) || 0,
    servingSize: Number(body.servingSize) || 100,
    servingUnit: str(body.servingUnit, 10) || 'g',
    createdAt: new Date(),
  };
  const r = await getDb().collection('foods').insertOne(doc);
  doc._id = r.insertedId;
  res.status(201).json({ food: { id: String(doc._id), ...doc } });
});

router.delete('/foods/:id', async (req, res) => {
  const id = toObjectId(req.params.id);
  if (!id) return res.status(404).json({ error: { code: 'not_found', message: 'Food not found.' } });
  await getDb().collection('foods').deleteOne({ _id: id });
  res.json({ ok: true });
});

// ===========================================================================
// Exercises (catalog)
// ===========================================================================
router.get('/exercises', async (req, res) => {
  const db = getDb();
  const { page, limit, skip } = pagination(req.query, 30, 200);
  const q = str(req.query.q, 80);
  const filter = q ? { name: new RegExp(q, 'i') } : {};
  const [docs, total] = await Promise.all([
    db.collection('exerciseCatalog').find(filter).sort({ name: 1 }).skip(skip).limit(limit).toArray(),
    db.collection('exerciseCatalog').countDocuments(filter),
  ]);
  res.json(paginated(docs.map((e) => ({ id: String(e._id), name: e.name, category: e.category, muscleGroup: e.muscleGroup })), total, page, limit));
});

router.delete('/exercises/:id', async (req, res) => {
  const id = toObjectId(req.params.id);
  if (!id) return res.status(404).json({ error: { code: 'not_found', message: 'Exercise not found.' } });
  await getDb().collection('exerciseCatalog').deleteOne({ _id: id });
  res.json({ ok: true });
});

// ===========================================================================
// Goals (all)
// ===========================================================================
router.get('/goals', async (req, res) => {
  const db = getDb();
  const { page, limit, skip } = pagination(req.query, 30, 200);
  const [docs, total] = await Promise.all([
    db.collection('goals').find({}).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
    db.collection('goals').countDocuments({}),
  ]);
  res.json(paginated(docs.map((g) => ({ id: String(g._id), userId: String(g.userId), title: g.title, type: g.type, currentValue: g.currentValue, targetValue: g.targetValue, unit: g.unit, progress: g.progress, status: g.status, createdAt: g.createdAt })), total, page, limit));
});

router.delete('/goals/:id', async (req, res) => {
  const id = toObjectId(req.params.id);
  if (!id) return res.status(404).json({ error: { code: 'not_found', message: 'Goal not found.' } });
  await getDb().collection('goals').deleteOne({ _id: id });
  res.json({ ok: true });
});

// ===========================================================================
// Measurements (all)
// ===========================================================================
router.get('/measurements', async (req, res) => {
  const db = getDb();
  const { page, limit, skip } = pagination(req.query, 30, 200);
  const [docs, total] = await Promise.all([
    db.collection('measurements').find({}).sort({ measuredOn: -1 }).skip(skip).limit(limit).toArray(),
    db.collection('measurements').countDocuments({}),
  ]);
  res.json(paginated(docs.map((m) => ({ id: String(m._id), userId: String(m.userId), weightKg: m.weightKg, bodyFatPct: m.bodyFatPct, measuredOn: m.measuredOn, createdAt: m.createdAt })), total, page, limit));
});

// ===========================================================================
// Replies (all)
// ===========================================================================
router.get('/replies', async (req, res) => {
  const db = getDb();
  const { page, limit, skip } = pagination(req.query, 30, 200);
  const [docs, total] = await Promise.all([
    db.collection('replies').find({}).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
    db.collection('replies').countDocuments({}),
  ]);
  res.json(paginated(docs.map((r) => ({ id: String(r._id), postId: String(r.postId), userId: String(r.userId), body: r.body, createdAt: r.createdAt })), total, page, limit));
});

router.delete('/replies/:id', async (req, res) => {
  const id = toObjectId(req.params.id);
  if (!id) return res.status(404).json({ error: { code: 'not_found', message: 'Reply not found.' } });
  await getDb().collection('replies').deleteOne({ _id: id });
  res.json({ ok: true });
});

// ===========================================================================
// Nutrition logs (all)
// ===========================================================================
router.get('/nutrition', async (req, res) => {
  const db = getDb();
  const { page, limit, skip } = pagination(req.query, 30, 200);
  const [docs, total] = await Promise.all([
    db.collection('nutritionlogs').find({}).sort({ date: -1 }).skip(skip).limit(limit).toArray(),
    db.collection('nutritionlogs').countDocuments({}),
  ]);
  res.json(paginated(docs.map((n) => ({ id: String(n._id), userId: String(n.userId), date: n.date, meal: n.meal, foodName: n.foodName, calories: n.calories, protein: n.protein, carbs: n.carbs, fat: n.fat, quantity: n.quantity })), total, page, limit));
});

router.delete('/nutrition/:id', async (req, res) => {
  const id = toObjectId(req.params.id);
  if (!id) return res.status(404).json({ error: { code: 'not_found', message: 'Entry not found.' } });
  await getDb().collection('nutritionlogs').deleteOne({ _id: id });
  res.json({ ok: true });
});

// ===========================================================================
// User detail
// ===========================================================================
router.get('/users/:id', async (req, res) => {
  const id = toObjectId(req.params.id);
  if (!id) return res.status(404).json({ error: { code: 'not_found', message: 'User not found.' } });
  const db = getDb();
  const user = await db.collection('users').findOne({ _id: id });
  if (!user) return res.status(404).json({ error: { code: 'not_found', message: 'User not found.' } });
  const [workouts, logs, posts, goals, measurements, tickets] = await Promise.all([
    db.collection('workouts').countDocuments({ userId: id }),
    db.collection('workoutlogs').countDocuments({ userId: id }),
    db.collection('posts').countDocuments({ userId: id }),
    db.collection('goals').countDocuments({ userId: id }),
    db.collection('measurements').countDocuments({ userId: id }),
    db.collection('tickets').countDocuments({ userId: id }),
  ]);
  res.json({
    user: { id: String(user._id), username: user.username, name: user.name, email: user.email, role: user.role || 'user', avatar: user.avatar, bio: user.bio, location: user.location, createdAt: user.createdAt, lastLoginAt: user.lastLoginAt, settings: user.settings },
    counts: { workouts, logs, posts, goals, measurements, tickets },
  });
});

// ===========================================================================
// Tickets status update
// ===========================================================================
router.patch('/tickets/:id', async (req, res) => {
  const id = toObjectId(req.params.id);
  if (!id) return res.status(404).json({ error: { code: 'not_found', message: 'Ticket not found.' } });
  const status = str(req.body?.status, 20);
  if (!['open', 'in_progress', 'resolved', 'closed'].includes(status)) {
    return res.status(400).json({ error: { code: 'bad_request', message: 'Invalid status.' } });
  }
  await getDb().collection('tickets').updateOne({ _id: id }, { $set: { status, updatedAt: new Date() } });
  res.json({ ok: true });
});

// ===========================================================================
// Broadcast notification
// ===========================================================================
router.post('/notify', async (req, res) => {
  const title = str(req.body?.title, 120);
  const message = str(req.body?.message, 2000);
  if (!title || !message) return res.status(400).json({ error: { code: 'bad_request', message: 'Title and message required.' } });
  const db = getDb();
  const users = await db.collection('users').find({}).project({ _id: 1 }).toArray();
  const docs = users.map((u) => ({
    userId: u._id,
    type: 'announcement',
    title,
    message,
    isRead: false,
    createdAt: new Date(),
  }));
  if (docs.length) await db.collection('notifications').insertMany(docs);
  res.json({ ok: true, sent: docs.length });
});

// ===========================================================================
// Analytics
// ===========================================================================
router.get('/analytics', async (req, res) => {
  const db = getDb();
  const days = clamp(parseInt(req.query.days || '14', 10) || 14, 1, 90);
  const since = new Date(Date.now() - days * 86400000);
  const [signups, logs, posts] = await Promise.all([
    db.collection('users').aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]).toArray(),
    db.collection('workoutlogs').aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]).toArray(),
    db.collection('posts').aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]).toArray(),
  ]);
  res.json({ days, signups, logs, posts });
});

module.exports = { router };
