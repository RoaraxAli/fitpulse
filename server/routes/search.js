'use strict';

const express = require('express');
const { getDb } = require('../db');
const { requireAuth } = require('../auth');
const { publicUser, workout, food, nutritionLog, post } = require('../serializers');
const { str, escapeRegex, assertOk, pagination, paginated } = require('../utils');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  const q = str(req.query.q, 80);
  assertOk(q.length >= 2, 'Type at least two characters to search.', 'q');
  const type = str(req.query.type, 20) || 'all';
  const limit = 5;
  const regex = new RegExp(escapeRegex(q), 'i');
  const db = getDb();
  const userId = req.user._id;

  const wants = (name) => type === 'all' || type === name;
  const [workouts, nutrition, users, foods, posts] = await Promise.all([
    wants('workouts')
      ? db
          .collection('workouts')
          .find({ userId, $or: [{ name: regex }, { description: regex }, { tags: regex }, { 'exercises.name': regex }] })
          .limit(limit)
          .toArray()
      : [],
    wants('nutrition')
      ? db.collection('nutritionlogs').find({ userId, foodName: regex }).sort({ createdAt: -1 }).limit(limit).toArray()
      : [],
    wants('users')
      ? db
          .collection('users')
          .find({ $or: [{ username: regex }, { name: regex }] }, { projection: { username: 1, name: 1, avatar: 1, bio: 1, isPublic: 1, createdAt: 1 } })
          .limit(limit)
          .toArray()
      : [],
    wants('foods')
      ? db
          .collection('foods')
          .find({ $or: [{ createdBy: null }, { createdBy: userId }], name: regex })
          .limit(limit)
          .toArray()
      : [],
    wants('posts')
      ? db.collection('posts').find({ $or: [{ title: regex }, { body: regex }] }).sort({ createdAt: -1 }).limit(limit).toArray()
      : [],
  ]);

  const results = {
    workouts: workouts.map(workout),
    nutrition: nutrition.map(nutritionLog),
    users: users.map(publicUser),
    foods: foods.map(food),
    posts: posts.map((doc) => ({
      id: String(doc._id),
      title: doc.title,
      body: doc.body.slice(0, 160),
      category: doc.category,
      createdAt: doc.createdAt,
    })),
  };
  const total = Object.values(results).reduce((sum, list) => sum + list.length, 0);
  res.json({ query: q, type, total, results });
});

module.exports = { router };
