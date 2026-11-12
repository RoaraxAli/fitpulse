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

module.exports = { router };
