'use strict';

const express = require('express');
const { getDb } = require('../db');
const { requireAuth } = require('../auth');
const { toCsv } = require('../services/csv');
const { renderProgressReport } = require('../services/pdf');
const {
  dateRange,
  isISODate,
  daysAgoISO,
  todayISO,
  startOfWeekISO,
  addDaysISO,
  streakFromDates,
} = require('../utils');
const { dailyTotals, averageTotals } = require('../services/nutrition');

const router = express.Router();

const sendCsv = (res, filename, columns, rows) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(toCsv(columns, rows));
};

router.get('/measurements.csv', requireAuth, async (req, res) => {
  const range = dateRange(req.query.from || daysAgoISO(365), req.query.to || todayISO());
  const docs = await getDb()
    .collection('measurements')
    .find({ userId: req.user._id, measuredOn: { $gte: range.start, $lte: range.end } })
    .sort({ measuredOn: 1 })
    .toArray();
  sendCsv(
    res,
    `fitpulse-measurements-${range.start}-to-${range.end}.csv`,
    [
      { label: 'Date', value: (r) => r.measuredOn },
      { label: 'Weight (kg)', value: (r) => r.weightKg },
      { label: 'Body fat (%)', value: (r) => r.bodyFatPct },
      { label: 'Chest (cm)', value: (r) => r.chestCm },
      { label: 'Waist (cm)', value: (r) => r.waistCm },
      { label: 'Hips (cm)', value: (r) => r.hipsCm },
      { label: 'Arms (cm)', value: (r) => r.armsCm },
      { label: 'Thighs (cm)', value: (r) => r.thighsCm },
      { label: 'Notes', value: (r) => r.notes },
    ],
    docs
  );
});

router.get('/nutrition.csv', requireAuth, async (req, res) => {
  const range = dateRange(req.query.from, req.query.to || todayISO());
  const docs = await getDb()
    .collection('nutritionlogs')
    .find({ userId: req.user._id, date: { $gte: range.start, $lte: range.end } })
    .sort({ date: 1, meal: 1 })
    .toArray();
  sendCsv(
    res,
    `fitpulse-nutrition-${range.start}-to-${range.end}.csv`,
    [
      { label: 'Date', value: (r) => r.date },
      { label: 'Meal', value: (r) => r.meal },
      { label: 'Food', value: (r) => r.foodName },
      { label: 'Quantity', value: (r) => r.quantity },
      { label: 'Serving size', value: (r) => r.servingSize },
      { label: 'Unit', value: (r) => r.servingUnit },
      { label: 'Calories', value: (r) => r.calories },
      { label: 'Protein (g)', value: (r) => r.protein },
      { label: 'Carbs (g)', value: (r) => r.carbs },
      { label: 'Fat (g)', value: (r) => r.fat },
      { label: 'Notes', value: (r) => r.notes },
    ],
    docs
  );
});

router.get('/workouts.csv', requireAuth, async (req, res) => {
  const range = dateRange(req.query.from || daysAgoISO(365), req.query.to || todayISO());
  const docs = await getDb()
    .collection('workoutlogs')
    .find({ userId: req.user._id, performedAt: { $gte: range.start, $lte: range.end } })
    .sort({ performedAt: 1 })
    .toArray();
  sendCsv(
    res,
    `fitpulse-workouts-${range.start}-to-${range.end}.csv`,
    [
      { label: 'Date', value: (r) => r.performedAt },
      { label: 'Workout', value: (r) => r.name },
      { label: 'Category', value: (r) => r.category },
      { label: 'Duration (min)', value: (r) => r.durationMin },
      { label: 'Calories burned', value: (r) => r.caloriesBurned },
      { label: 'Sets', value: (r) => (r.sets || []).length },
      { label: 'Total reps', value: (r) => (r.sets || []).reduce((s, set) => s + set.reps, 0) },
      {
        label: 'Volume (kg)',
        value: (r) => Math.round((r.sets || []).reduce((s, set) => s + set.reps * set.weight, 0)),
      },
      { label: 'Rating', value: (r) => r.rating },
      { label: 'Notes', value: (r) => r.notes },
    ],
    docs
  );
});

router.get('/goals.csv', requireAuth, async (req, res) => {
  const docs = await getDb().collection('goals').find({ userId: req.user._id }).sort({ createdAt: -1 }).toArray();
  sendCsv(
    res,
    `fitpulse-goals-${todayISO()}.csv`,
    [
      { label: 'Goal', value: (r) => r.title },
      { label: 'Type', value: (r) => r.type },
      { label: 'Current', value: (r) => r.currentValue },
      { label: 'Target', value: (r) => r.targetValue },
      { label: 'Unit', value: (r) => r.unit },
      { label: 'Deadline', value: (r) => r.deadline },
      { label: 'Status', value: (r) => r.status },
    ],
    docs
  );
});

router.get('/summary.pdf', requireAuth, async (req, res) => {
  const db = getDb();
  const range = dateRange(req.query.from, req.query.to || todayISO());
  const userId = req.user._id;

  const [logs, measurements, goals, prRows, streakLogs, nutritionDays] = await Promise.all([
    db.collection('workoutlogs').find({ userId, performedAt: { $gte: range.start, $lte: range.end } }).sort({ performedAt: 1 }).toArray(),
    db
      .collection('measurements')
      .find({ userId, measuredOn: { $gte: range.start, $lte: range.end } })
      .sort({ measuredOn: 1 })
      .toArray(),
    db.collection('goals').find({ userId, status: 'active' }).limit(6).toArray(),
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
    db.collection('workoutlogs').find({ userId }, { projection: { performedAt: 1 } }).sort({ performedAt: -1 }).limit(200).toArray(),
    dailyTotals(userId, range.start, range.end),
  ]);

  const totalVolume = logs.reduce(
    (sum, log) => sum + (log.sets || []).reduce((s, set) => s + (Number(set.reps) || 0) * (Number(set.weight) || 0), 0),
    0
  );
  const totalMinutes = logs.reduce((sum, log) => sum + (Number(log.durationMin) || 0), 0);
  const firstWeight = measurements.find((m) => m.weightKg != null);
  const lastWeight = [...measurements].reverse().find((m) => m.weightKg != null);
  const averages = averageTotals(nutritionDays);

  // Weekly activity (workouts per week) for the report chart.
  const weekStartDay = req.user.settings?.weekStart ?? 1;
  const weekMap = new Map();
  logs.forEach((log) => {
    const key = startOfWeekISO(log.performedAt, weekStartDay);
    weekMap.set(key, (weekMap.get(key) || 0) + 1);
  });
  const weeklyActivity = [];
  let cursor = startOfWeekISO(range.start, weekStartDay);
  const lastWeek = startOfWeekISO(range.end, weekStartDay);
  let guard = 0;
  while (cursor <= lastWeek && guard < 16) {
    weeklyActivity.push({
      label: new Date(`${cursor}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }),
      value: weekMap.get(cursor) || 0,
    });
    cursor = addDaysISO(cursor, 7);
    guard += 1;
  }

  const pdf = renderProgressReport({
    user: req.user,
    range,
    stats: {
      workouts: logs.length,
      totalMinutes: Math.round(totalMinutes),
      totalVolume: Math.round(totalVolume),
      streak: streakFromDates(streakLogs.map((l) => l.performedAt)),
      weightChange: firstWeight && lastWeight ? Math.round((lastWeight.weightKg - firstWeight.weightKg) * 10) / 10 : null,
      latestWeightKg: lastWeight?.weightKg ?? null,
    },
    measurements: measurements.map((m) => ({
      measuredOn: m.measuredOn,
      weightKg: m.weightKg,
    })),
    weeklyActivity,
    nutrition: {
      avgCalories: averages.avgCalories,
      protein: averages.avgProtein,
      carbs: averages.avgCarbs,
      fat: averages.avgFat,
      daysLogged: averages.daysLogged,
    },
    goals: goals.map((g) => ({
      title: g.title,
      currentValue: g.currentValue,
      targetValue: g.targetValue,
      unit: g.unit,
      progress: g.targetValue ? Math.min(100, Math.round((g.currentValue / g.targetValue) * 100)) : 0,
    })),
    prs: prRows.map((row) => ({
      exerciseName: row._id,
      weight: row.weight,
      reps: row.reps,
      date: row.date,
    })),
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="fitpulse-report-${range.start}-to-${range.end}.pdf"`);
  res.send(pdf);
});

module.exports = { router };
