'use strict';

const express = require('express');
const { getDb, toObjectId } = require('../db');
const { food, nutritionLog } = require('../serializers');
const { requireAuth } = require('../auth');
const {
  badRequest,
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
  dateRange,
  round,
  daysAgoISO,
  addDaysISO,
} = require('../utils');
const { dailyTotals, averageTotals } = require('../services/nutrition');

const router = express.Router();
const foods = express.Router();
const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'];
const UNITS = ['g', 'ml', 'oz', 'serving', 'piece'];

const scale = (value, quantity) => round((Number(value) || 0) * quantity, 1);

foods.get('/', requireAuth, async (req, res) => {
  const q = str(req.query.q, 60);
  const limit = clamp(int(req.query.limit, 20), 1, 50);
  const filter = { $or: [{ createdBy: null }, { createdBy: req.user._id }] };
  if (q) filter.name = new RegExp(escapeRegex(q), 'i');
  const docs = await getDb().collection('foods').find(filter).sort({ name: 1 }).limit(limit).toArray();
  res.json({ items: docs.map(food) });
});

foods.post('/', requireAuth, async (req, res) => {
  const body = req.body || {};
  const name = str(body.name, 100);
  assertOk(name.length > 0, 'Food name is required.', 'name');
  const servingUnit = str(body.servingUnit, 10) || 'g';
  assertOk(UNITS.includes(servingUnit), 'Choose a valid serving unit.', 'servingUnit');
  const doc = {
    name,
    brand: str(body.brand, 60),
    servingSize: clamp(num(body.servingSize, 100), 0.1, 10000),
    servingUnit,
    calories: clamp(num(body.calories, 0), 0, 10000),
    protein: clamp(num(body.protein, 0), 0, 1000),
    carbs: clamp(num(body.carbs, 0), 0, 1000),
    fat: clamp(num(body.fat, 0), 0, 1000),
    fiber: clamp(num(body.fiber, 0), 0, 1000),
    sugar: clamp(num(body.sugar, 0), 0, 1000),
    sodium: clamp(num(body.sodium, 0), 0, 100000),
    createdBy: req.user._id,
    createdAt: new Date(),
  };
  const result = await getDb().collection('foods').insertOne(doc);
  doc._id = result.insertedId;
  res.status(201).json({ food: food(doc) });
});

router.get('/', requireAuth, async (req, res) => {
  const date = isISODate(req.query.date) ? req.query.date : todayISO();
  const db = getDb();
  const docs = await db
    .collection('nutritionlogs')
    .find({ userId: req.user._id, date })
    .sort({ createdAt: 1 })
    .toArray();
  const entries = docs.map(nutritionLog);
  const totals = entries.reduce(
    (acc, entry) => ({
      calories: acc.calories + entry.calories,
      protein: acc.protein + entry.protein,
      carbs: acc.carbs + entry.carbs,
      fat: acc.fat + entry.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
  res.json({
    date,
    entries,
    totals: {
      calories: Math.round(totals.calories),
      protein: round(totals.protein),
      carbs: round(totals.carbs),
      fat: round(totals.fat),
    },
    goals: {
      calories: req.user.settings?.calorieGoal ?? 2200,
      protein: req.user.settings?.proteinGoal ?? 150,
      carbs: req.user.settings?.carbsGoal ?? 250,
      fat: req.user.settings?.fatGoal ?? 70,
    },
  });
});

router.get('/summary', requireAuth, async (req, res) => {
  const range = dateRange(req.query.from, req.query.to);
  const days = await dailyTotals(req.user._id, range.start, range.end);
  res.json({ range, days, averages: averageTotals(days) });
});

router.get('/week', requireAuth, async (req, res) => {
  const end = isISODate(req.query.date) ? req.query.date : todayISO();
  const start = addDaysISO(end, -6);
  const days = await dailyTotals(req.user._id, start, end);
  res.json({ start, end, days });
});

router.post('/', requireAuth, async (req, res) => {
  const body = req.body || {};
  const db = getDb();
  const date = isISODate(body.date) ? body.date : todayISO();
  const meal = str(body.meal, 20) || 'snack';
  assertOk(MEALS.includes(meal), 'Choose a valid meal.', 'meal');
  const quantity = clamp(num(body.quantity, 1), 0.01, 100);

  let entry;
  if (body.foodId) {
    const foodId = toObjectId(body.foodId);
    assertOk(Boolean(foodId), 'That food could not be found.', 'foodId');
    const foodDoc = await db.collection('foods').findOne({ _id: foodId });
    assertOk(Boolean(foodDoc) && (!foodDoc.createdBy || String(foodDoc.createdBy) === String(req.user._id)), 'That food could not be found.', 'foodId');
    entry = {
      foodId,
      foodName: foodDoc.name,
      quantity,
      servingSize: foodDoc.servingSize,
      servingUnit: foodDoc.servingUnit,
      calories: scale(foodDoc.calories, quantity),
      protein: scale(foodDoc.protein, quantity),
      carbs: scale(foodDoc.carbs, quantity),
      fat: scale(foodDoc.fat, quantity),
    };
  } else {
    const foodName = str(body.foodName, 100);
    assertOk(foodName.length > 0, 'What did you eat?', 'foodName');
    entry = {
      foodId: null,
      foodName,
      quantity,
      servingSize: clamp(num(body.servingSize, 100), 0.1, 10000),
      servingUnit: UNITS.includes(body.servingUnit) ? body.servingUnit : 'g',
      calories: clamp(num(body.calories, 0), 0, 10000),
      protein: clamp(num(body.protein, 0), 0, 1000),
      carbs: clamp(num(body.carbs, 0), 0, 1000),
      fat: clamp(num(body.fat, 0), 0, 1000),
    };
  }

  const doc = {
    userId: req.user._id,
    date,
    meal,
    ...entry,
    notes: str(body.notes, 300),
    createdAt: new Date(),
  };
  const result = await db.collection('nutritionlogs').insertOne(doc);
  doc._id = result.insertedId;
  res.status(201).json({ entry: nutritionLog(doc) });
});

router.put('/:id', requireAuth, async (req, res) => {
  const id = toObjectId(req.params.id);
  if (!id) throw notFound('Nutrition entry not found.');
  const db = getDb();
  const existing = await db.collection('nutritionlogs').findOne({ _id: id, userId: req.user._id });
  if (!existing) throw notFound('Nutrition entry not found.');

  const body = req.body || {};
  const updates = {};
  if (body.meal !== undefined) {
    assertOk(MEALS.includes(body.meal), 'Choose a valid meal.', 'meal');
    updates.meal = body.meal;
  }
  if (body.date !== undefined) {
    assertOk(isISODate(body.date), 'Date must be YYYY-MM-DD.', 'date');
    updates.date = body.date;
  }
  if (body.notes !== undefined) updates.notes = str(body.notes, 300);

  if (body.quantity !== undefined) {
    const quantity = clamp(num(body.quantity, existing.quantity), 0.01, 100);
    updates.quantity = quantity;
    if (existing.foodId) {
      const foodDoc = await db.collection('foods').findOne({ _id: existing.foodId });
      if (foodDoc) {
        updates.calories = scale(foodDoc.calories, quantity);
        updates.protein = scale(foodDoc.protein, quantity);
        updates.carbs = scale(foodDoc.carbs, quantity);
        updates.fat = scale(foodDoc.fat, quantity);
        updates.servingSize = foodDoc.servingSize;
        updates.servingUnit = foodDoc.servingUnit;
      }
    } else {
      const ratio = quantity / (existing.quantity || 1);
      updates.calories = round(existing.calories * ratio, 1);
      updates.protein = round(existing.protein * ratio, 1);
      updates.carbs = round(existing.carbs * ratio, 1);
      updates.fat = round(existing.fat * ratio, 1);
    }
  }

  if (Object.keys(updates).length === 0) throw badRequest('Nothing to update.');
  const updated = await db.collection('nutritionlogs').findOneAndUpdate({ _id: id }, { $set: updates }, { returnDocument: 'after' });
  res.json({ entry: nutritionLog(updated) });
});

router.delete('/:id', requireAuth, async (req, res) => {
  const id = toObjectId(req.params.id);
  if (!id) throw notFound('Nutrition entry not found.');
  const result = await getDb().collection('nutritionlogs').deleteOne({ _id: id, userId: req.user._id });
  if (!result.deletedCount) throw notFound('Nutrition entry not found.');
  res.json({ ok: true });
});

router.get('/days', requireAuth, async (req, res) => {
  const { page, limit, skip } = pagination(req.query, 14, 60);
  const days = await dailyTotals(req.user._id, daysAgoISO(365), todayISO());
  const filtered = days.filter((day) => day.entries > 0).reverse();
  res.json(paginated(filtered.slice(skip, skip + limit), filtered.length, page, limit));
});

module.exports = { router, foods };
