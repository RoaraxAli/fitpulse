'use strict';

const express = require('express');
const { getDb, toObjectId } = require('../db');
const { post, reply, publicUser } = require('../serializers');
const { requireAuth } = require('../auth');
const {
  badRequest,
  notFound,
  str,
  escapeRegex,
  pagination,
  paginated,
  assertOk,
} = require('../utils');
const { notify } = require('../services/notifications');

const router = express.Router();

const CATEGORIES = ['general', 'training', 'nutrition', 'progress', 'motivation', 'question'];

const authorProjection = { username: 1, name: 1, avatar: 1, bio: 1, location: 1, isPublic: 1, createdAt: 1 };

async function decorate(db, docs, viewerId) {
  if (!docs.length) return [];
  const ids = docs.map((doc) => doc._id);
  const [authors, likeCounts, replyCounts, myLikes] = await Promise.all([
    db.collection('users').find({ _id: { $in: docs.map((d) => d.userId) } }, { projection: authorProjection }).toArray(),
    db
      .collection('likes')
      .aggregate([{ $match: { postId: { $in: ids } } }, { $group: { _id: '$postId', count: { $sum: 1 } } }])
      .toArray(),
    db
      .collection('replies')
      .aggregate([{ $match: { postId: { $in: ids } } }, { $group: { _id: '$postId', count: { $sum: 1 } } }])
      .toArray(),
    viewerId
      ? db.collection('likes').find({ postId: { $in: ids }, userId: viewerId }).toArray()
      : Promise.resolve([]),
  ]);
  const authorMap = new Map(authors.map((a) => [String(a._id), publicUser(a)]));
  const likeMap = new Map(likeCounts.map((l) => [String(l._id), l.count]));
  const replyMap = new Map(replyCounts.map((r) => [String(r._id), r.count]));
  const liked = new Set(myLikes.map((like) => String(like.postId)));
  return docs.map((doc) => ({
    id: String(doc._id),
    title: doc.title,
    body: doc.body,
    category: doc.category,
    author: authorMap.get(String(doc.userId)) || null,
    likes: likeMap.get(String(doc._id)) || 0,
    replies: replyMap.get(String(doc._id)) || 0,
    likedByMe: liked.has(String(doc._id)),
    createdAt: doc.createdAt,
  }));
}

router.get('/meta', (req, res) => res.json({ categories: CATEGORIES }));

router.get('/posts', async (req, res) => {
  const q = str(req.query.q, 80);
  const category = str(req.query.category, 20);
  const sort = str(req.query.sort, 20) || 'recent';
  const { page, limit, skip } = pagination(req.query, 10, 50);
  const db = getDb();

  const pipeline = [];
  const filter = {};
  if (q) {
    filter.$or = [{ title: new RegExp(escapeRegex(q), 'i') }, { body: new RegExp(escapeRegex(q), 'i') }];
  }
  if (category && category !== 'all') filter.category = category;
  pipeline.push({ $match: filter });
  pipeline.push({ $sort: sort === 'popular' ? { createdAt: -1 } : { createdAt: -1 } });
  pipeline.push({ $skip: skip }, { $limit: limit });
  const docs = await db.collection('posts').aggregate(pipeline).toArray();
  const total = await db.collection('posts').countDocuments(filter);
  const items = await decorate(db, docs, req.user?._id);
  if (sort === 'popular') items.sort((a, b) => b.likes + b.replies - (a.likes + a.replies));
  res.json(paginated(items, total, page, limit));
});

router.get('/feed', requireAuth, async (req, res) => {
  const db = getDb();
  const { page, limit, skip } = pagination(req.query, 10, 50);
  const followRows = await db.collection('follows').find({ followerId: req.user._id }).toArray();
  const ids = [req.user._id, ...followRows.map((row) => row.followingId)];
  const filter = { userId: { $in: ids } };
  const [docs, total] = await Promise.all([
    db.collection('posts').find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
    db.collection('posts').countDocuments(filter),
  ]);
  const items = await decorate(db, docs, req.user._id);
  res.json(paginated(items, total, page, limit));
});

router.post('/posts', requireAuth, async (req, res) => {
  const body = req.body || {};
  const title = str(body.title, 140);
  const content = str(body.body, 5000);
  const category = str(body.category, 20) || 'general';
  assertOk(title.length > 0, 'Give your post a title.', 'title');
  assertOk(content.length > 0, 'Write something in your post.', 'body');
  assertOk(CATEGORIES.includes(category), 'Choose a valid category.', 'category');

  const db = getDb();
  const now = new Date();
  const doc = { userId: req.user._id, title, body: content, category, createdAt: now, updatedAt: now };
  const result = await db.collection('posts').insertOne(doc);
  doc._id = result.insertedId;

  // Let followers know about new posts (capped to keep notifications sane).
  const followers = await db.collection('follows').find({ followingId: req.user._id }).limit(50).toArray();
  await Promise.all(
    followers.map((follow) =>
      notify(follow.followerId, {
        type: 'social',
        title: `${req.user.name} posted: ${title}`,
        body: content.slice(0, 120),
        icon: 'message',
        link: '/community',
      })
    )
  );

  const [item] = await decorate(db, [doc], req.user._id);
  res.status(201).json({ post: item });
});

router.get('/posts/:id', async (req, res) => {
  const id = toObjectId(req.params.id);
  if (!id) throw notFound('Post not found.');
  const db = getDb();
  const doc = await db.collection('posts').findOne({ _id: id });
  if (!doc) throw notFound('Post not found.');
  const [item] = await decorate(db, [doc], req.user?._id);
  const replies = await db.collection('replies').find({ postId: id }).sort({ createdAt: 1 }).limit(200).toArray();
  const authors = await db
    .collection('users')
    .find({ _id: { $in: replies.map((r) => r.userId) } }, { projection: authorProjection })
    .toArray();
  const authorMap = new Map(authors.map((a) => [String(a._id), publicUser(a)]));
  res.json({
    post: item,
    replies: replies.map((r) => ({
      id: String(r._id),
      body: r.body,
      author: authorMap.get(String(r.userId)) || null,
      createdAt: r.createdAt,
      isMine: req.user ? String(r.userId) === String(req.user._id) : false,
    })),
  });
});

router.delete('/posts/:id', requireAuth, async (req, res) => {
  const id = toObjectId(req.params.id);
  if (!id) throw notFound('Post not found.');
  const db = getDb();
  const doc = await db.collection('posts').findOne({ _id: id });
  if (!doc) throw notFound('Post not found.');
  if (String(doc.userId) !== String(req.user._id) && req.user.role !== 'admin') throw notFound('Post not found.');
  await Promise.all([
    db.collection('posts').deleteOne({ _id: id }),
    db.collection('replies').deleteMany({ postId: id }),
    db.collection('likes').deleteMany({ postId: id }),
  ]);
  res.json({ ok: true });
});

router.post('/posts/:id/replies', requireAuth, async (req, res) => {
  const id = toObjectId(req.params.id);
  if (!id) throw notFound('Post not found.');
  const body = str(req.body?.body, 2000);
  assertOk(body.length > 0, 'Write a reply first.', 'body');
  const db = getDb();
  const doc = await db.collection('posts').findOne({ _id: id });
  if (!doc) throw notFound('Post not found.');

  const now = new Date();
  const replyDoc = { postId: id, userId: req.user._id, body, createdAt: now };
  const result = await db.collection('replies').insertOne(replyDoc);
  replyDoc._id = result.insertedId;

  if (String(doc.userId) !== String(req.user._id)) {
    await notify(doc.userId, {
      type: 'social',
      title: `${req.user.name} replied to "${doc.title}"`,
      body: body.slice(0, 140),
      icon: 'message',
      link: '/community',
    });
  }
  res.status(201).json({
    reply: { id: String(replyDoc._id), body, author: publicUser(req.user), createdAt: now, isMine: true },
  });
});

router.post('/posts/:id/like', requireAuth, async (req, res) => {
  const id = toObjectId(req.params.id);
  if (!id) throw notFound('Post not found.');
  const db = getDb();
  const doc = await db.collection('posts').findOne({ _id: id });
  if (!doc) throw notFound('Post not found.');
  const existing = await db.collection('likes').findOne({ postId: id, userId: req.user._id });
  if (existing) {
    await db.collection('likes').deleteOne({ _id: existing._id });
    return res.json({ liked: false });
  }
  try {
    await db.collection('likes').insertOne({ postId: id, userId: req.user._id, createdAt: new Date() });
    if (String(doc.userId) !== String(req.user._id)) {
      await notify(doc.userId, {
        type: 'social',
        title: `${req.user.name} liked your post`,
        body: doc.title,
        icon: 'heart',
        link: '/community',
      });
    }
  } catch (error) {
    if (error.code !== 11000) throw error;
  }
  return res.json({ liked: true });
});

module.exports = { router, CATEGORIES };
