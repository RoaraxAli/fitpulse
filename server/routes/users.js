'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('../config');
const { getDb, toObjectId } = require('../db');
const { publicUser, selfUser } = require('../serializers');
const { badRequest, notFound, str, num, bool, escapeRegex, pagination, paginated, assertOk, int } = require('../utils');
const { requireAuth } = require('../auth');
const { calculateStats } = require('../services/stats');
const { listAchievements } = require('../services/achievements');
const { notify } = require('../services/notifications');

const router = express.Router();

const AVATAR_RE = /^data:image\/(png|jpe?g|webp|gif);base64,([A-Za-z0-9+/=\s]+)$/;

async function followingIds(userId) {
  const rows = await getDb().collection('follows').find({ followerId: userId }, { projection: { followingId: 1 } }).toArray();
  return rows.map((r) => r.followingId);
}

router.patch('/me', requireAuth, async (req, res) => {
  const body = req.body || {};
  const updates = { updatedAt: new Date() };

  if (body.name !== undefined) {
    const name = str(body.name, 60);
    assertOk(name.length > 0, 'Name cannot be empty.', 'name');
    updates.name = name;
  }
  if (body.bio !== undefined) updates.bio = str(body.bio, 500);
  if (body.location !== undefined) updates.location = str(body.location, 80);
  if (body.birthdate !== undefined) {
    const value = body.birthdate === null || body.birthdate === '' ? null : str(body.birthdate, 10);
    assertOk(value === null || /^\d{4}-\d{2}-\d{2}$/.test(value), 'Birthdate must be YYYY-MM-DD.', 'birthdate');
    updates.birthdate = value;
  }
  if (body.gender !== undefined) {
    const value = body.gender === null || body.gender === '' ? null : str(body.gender, 30);
    assertOk(value === null || ['male', 'female', 'non_binary', 'prefer_not_to_say'].includes(value), 'Choose a valid gender option.', 'gender');
    updates.gender = value;
  }
  if (body.heightCm !== undefined) {
    const value = body.heightCm === null || body.heightCm === '' ? null : num(body.heightCm);
    assertOk(value === null || (value >= 50 && value <= 260), 'Height must be between 50 and 260 cm.', 'heightCm');
    updates.heightCm = value;
  }
  if (body.unitSystem !== undefined) {
    assertOk(['metric', 'imperial'].includes(body.unitSystem), 'Units must be metric or imperial.', 'unitSystem');
    updates.unitSystem = body.unitSystem;
  }
  if (body.theme !== undefined) {
    assertOk(['dark', 'light', 'system'].includes(body.theme), 'Theme must be dark, light or system.', 'theme');
    updates.theme = body.theme;
  }
  if (body.isPublic !== undefined) updates.isPublic = bool(body.isPublic, true);

  if (body.settings && typeof body.settings === 'object') {
    const allowed = [
      'notifyWorkout',
      'notifyMeal',
      'notifyGoals',
      'notifySocial',
      'notifyEmail',
      'timezone',
      'weekStart',
      'calorieGoal',
      'proteinGoal',
      'carbsGoal',
      'fatGoal',
      'waterGoal',
      'stepGoal',
    ];
    const settings = {};
    for (const key of allowed) {
      if (body.settings[key] === undefined) continue;
      if (key.startsWith('notify')) settings[key] = bool(body.settings[key], true);
      else if (key === 'timezone') settings[key] = str(body.settings[key], 60) || 'UTC';
      else {
        const value = int(body.settings[key], 0);
        settings[key] = Math.max(0, Math.min(key === 'weekStart' ? 6 : 20000, value));
      }
    }
    if (Object.keys(settings).length) {
      updates.settings = { ...(req.user.settings || {}), ...settings };
    }
  }

  const updated = await getDb().collection('users').findOneAndUpdate({ _id: req.user._id }, { $set: updates }, { returnDocument: 'after' });
  return res.json({ user: selfUser(updated) });
});

router.post('/me/avatar', requireAuth, async (req, res) => {
  const image = typeof req.body?.image === 'string' ? req.body.image : '';
  assertOk(image.length > 0, 'Choose an image to upload.', 'image');
  const match = AVATAR_RE.exec(image.trim());
  assertOk(match, 'Images must be JPG, PNG, WebP or GIF.', 'image');
  const extension = match[1] === 'jpeg' ? 'jpg' : match[1];
  let buffer;
  try {
    buffer = Buffer.from(match[2], 'base64');
  } catch {
    throw badRequest('That image could not be decoded.', 'image');
  }
  assertOk(buffer.length > 0 && buffer.length <= 3 * 1024 * 1024, 'Images must be 3 MB or smaller.', 'image');

  fs.mkdirSync(config.uploadDir, { recursive: true });
  const filename = `avatar-${req.user._id}-${crypto.randomBytes(6).toString('hex')}.${extension}`;
  fs.writeFileSync(path.join(config.uploadDir, filename), buffer);
  const url = `/uploads/${filename}`;

  const previous = req.user.avatar;
  await getDb().collection('users').updateOne({ _id: req.user._id }, { $set: { avatar: url, updatedAt: new Date() } });
  if (previous && previous.startsWith('/uploads/')) {
    const oldPath = path.join(config.uploadDir, path.basename(previous));
    fs.promises.unlink(oldPath).catch(() => {});
  }
  return res.json({ avatar: url });
});

router.delete('/me/avatar', requireAuth, async (req, res) => {
  const previous = req.user.avatar;
  await getDb().collection('users').updateOne({ _id: req.user._id }, { $set: { avatar: null, updatedAt: new Date() } });
  if (previous && previous.startsWith('/uploads/')) {
    fs.promises.unlink(path.join(config.uploadDir, path.basename(previous))).catch(() => {});
  }
  res.json({ ok: true });
});

router.get('/', async (req, res) => {
  const q = str(req.query.q, 60);
  const { page, limit, skip } = pagination(req.query, 12, 50);
  const filter = q
    ? { $or: [{ username: new RegExp(escapeRegex(q), 'i') }, { name: new RegExp(escapeRegex(q), 'i') }] }
    : {};
  const db = getDb();
  const [docs, total] = await Promise.all([
    db.collection('users').find(filter, { projection: { username: 1, name: 1, avatar: 1, bio: 1, isPublic: 1, createdAt: 1 } }).sort({ createdAt: 1 }).skip(skip).limit(limit).toArray(),
    db.collection('users').countDocuments(filter),
  ]);
  const ids = await followingIds(req.user?._id);
  const following = new Set(ids.map(String));
  const items = docs.map((doc) => ({ ...publicUser(doc), isFollowing: following.has(String(doc._id)) }));
  res.json(paginated(items, total, page, limit));
});

router.get('/:id', async (req, res) => {
  const id = toObjectId(req.params.id);
  if (!id) throw notFound('That user could not be found.');
  const db = getDb();
  const user = await db.collection('users').findOne({ _id: id });
  if (!user) throw notFound('That user could not be found.');

  const isSelf = req.user && String(req.user._id) === String(user._id);
  const follow = req.user ? await db.collection('follows').findOne({ followerId: req.user._id, followingId: id }) : null;
  const isFollowing = Boolean(follow);

  if (!user.isPublic && !isSelf && !isFollowing) {
    return res.json({
      user: { id: String(user._id), username: user.username, name: user.name, avatar: user.avatar || null, isPublic: false },
      private: true,
      isSelf: false,
      isFollowing: false,
      stats: null,
    });
  }

  const [stats, achievements, posts, followers, following] = await Promise.all([
    calculateStats(user),
    listAchievements(id),
    db.collection('posts').find({ userId: id }).sort({ createdAt: -1 }).limit(5).toArray(),
    db.collection('follows').countDocuments({ followingId: id }),
    db.collection('follows').countDocuments({ followerId: id }),
  ]);

  res.json({
    user: publicUser(user),
    private: false,
    isSelf,
    isFollowing,
    stats: { ...stats, followers, following },
    achievements: achievements.filter((a) => a.unlocked),
    posts: posts.map((p) => ({ id: String(p._id), title: p.title, body: p.body, category: p.category, createdAt: p.createdAt })),
  });
});

router.post('/:id/follow', requireAuth, async (req, res) => {
  const id = toObjectId(req.params.id);
  if (!id) throw notFound('That user could not be found.');
  assertOk(String(id) !== String(req.user._id), 'You cannot follow yourself.');
  const db = getDb();
  const target = await db.collection('users').findOne({ _id: id }, { projection: { name: 1, username: 1 } });
  if (!target) throw notFound('That user could not be found.');
  try {
    await db.collection('follows').insertOne({ followerId: req.user._id, followingId: id, createdAt: new Date() });
    await notify(id, {
      type: 'social',
      title: `${req.user.name} started following you`,
      body: 'Check out their profile and follow back if you like.',
      icon: 'users',
      link: `/profile/${target.username}`,
    });
  } catch (error) {
    if (error.code !== 11000) throw error;
  }
  res.json({ following: true });
});

router.delete('/:id/follow', requireAuth, async (req, res) => {
  const id = toObjectId(req.params.id);
  if (!id) throw notFound('That user could not be found.');
  await getDb().collection('follows').deleteOne({ followerId: req.user._id, followingId: id });
  res.json({ following: false });
});

router.get('/:id/followers', async (req, res) => {
  const id = toObjectId(req.params.id);
  if (!id) throw notFound('That user could not be found.');
  const db = getDb();
  const links = await db.collection('follows').find({ followingId: id }).limit(100).toArray();
  const users = await db
    .collection('users')
    .find({ _id: { $in: links.map((l) => l.followerId) } })
    .toArray();
  res.json({ items: users.map(publicUser) });
});

router.get('/:id/following', async (req, res) => {
  const id = toObjectId(req.params.id);
  if (!id) throw notFound('That user could not be found.');
  const db = getDb();
  const links = await db.collection('follows').find({ followerId: id }).limit(100).toArray();
  const users = await db
    .collection('users')
    .find({ _id: { $in: links.map((l) => l.followingId) } })
    .toArray();
  res.json({ items: users.map(publicUser) });
});

module.exports = { router };
