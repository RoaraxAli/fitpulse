'use strict';

const express = require('express');
const { getDb } = require('../db');
const { requireAuth } = require('../auth');
const {
  clamp,
  int,
  round,
  todayISO,
  addDaysISO,
  daysAgoISO,
  dateRange,
  startOfWeekISO,
  escapeRegex,
  isISODate,
  assertOk,
} = require('../utils');
const { dailyTotals, averageTotals, mealBreakdown, topFoods } = require('../services/nutrition');

const router = express.Router();

const sum = (items, selector) => items.reduce((total, item) => total + (Number(selector(item)) || 0), 0);
const volumeOf = (log) => (log.sets || []).reduce((total, set) => total + (Number(set.reps) || 0) * (Number(set.weight) || 0), 0);
const percentChange = (current, previous) => {
  if (!previous) return current ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
};
const shortDate = (iso) => {
  const date = new Date(`${iso}T00:00:00Z`);
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
};

async function loadLogs(userId, from, to) {
  return getDb()
    .collection('workoutlogs')
    .find({ userId, performedAt: { $gte: from, $lte: to } })
    .sort({ performedAt: 1 })
    .toArray();
}

router.get('/overview', requireAuth, async (req, res) => {
  const days = clamp(int(req.query.range, 30), 7, 365);
  const end = todayISO();
  const start = addDaysISO(end, -(days - 1));
  const prevStart = addDaysISO(start, -days);
  const prevEnd = addDaysISO(start, -1);

  const [logs, prevLogs, nutritionDays, prevNutrition, measurements] = await Promise.all([
    loadLogs(req.user._id, start, end),
    loadLogs(req.user._id, prevStart, prevEnd),
    dailyTotals(req.user._id, start, end),
    dailyTotals(req.user._id, prevStart, prevEnd),
    getDb()
      .collection('measurements')
      .find({ userId: req.user._id, measuredOn: { $gte: start, $lte: end } })
      .sort({ measuredOn: 1 })
      .toArray(),
  ]);

  const workouts = logs.length;
  const minutes = Math.round(sum(logs, (l) => l.durationMin));
  const calories = Math.round(sum(logs, (l) => l.caloriesBurned));
  const volume = Math.round(sum(logs, volumeOf));
  const activeDays = new Set(logs.map((l) => l.performedAt)).size;
  const prevWorkouts = prevLogs.length;
  const prevMinutes = Math.round(sum(prevLogs, (l) => l.durationMin));
  const prevVolume = Math.round(sum(prevLogs, volumeOf));
  const avgNutrition = averageTotals(nutritionDays);
  const prevAvgNutrition = averageTotals(prevNutrition);
  const weightStart = measurements.find((m) => m.weightKg != null)?.weightKg ?? null;
  const weightEnd = [...measurements].reverse().find((m) => m.weightKg != null)?.weightKg ?? null;

  // Daily workout minutes (capped at 31 buckets so charts stay legible).
  const bucketDays = Math.min(days, 31);
  const trendStart = addDaysISO(end, -(bucketDays - 1));
  const trendMap = new Map();
  logs.forEach((log) => {
    const current = trendMap.get(log.performedAt) || { minutes: 0, volume: 0 };
    current.minutes += Number(log.durationMin) || 0;
    current.volume += volumeOf(log);
    trendMap.set(log.performedAt, current);
  });
  const workoutTrend = [];
  for (let i = 0; i < bucketDays; i += 1) {
    const iso = addDaysISO(trendStart, i);
    const bucket = trendMap.get(iso) || { minutes: 0, volume: 0 };
    workoutTrend.push({ date: iso, label: shortDate(iso), minutes: Math.round(bucket.minutes), volume: Math.round(bucket.volume) });
  }

  res.json({
    range: { start, end, days },
    cards: {
      workouts: { value: workouts, previous: prevWorkouts, change: percentChange(workouts, prevWorkouts) },
      minutes: { value: minutes, previous: prevMinutes, change: percentChange(minutes, prevMinutes) },
      calories: { value: calories },
      volume: { value: volume, previous: prevVolume, change: percentChange(volume, prevVolume) },
      activeDays: { value: activeDays, of: days },
      avgCalories: { value: avgNutrition.avgCalories, previous: prevAvgNutrition.avgCalories, change: percentChange(avgNutrition.avgCalories, prevAvgNutrition.avgCalories) },
      avgProtein: { value: avgNutrition.avgProtein },
      weightChange: weightStart != null && weightEnd != null ? round(weightEnd - weightStart, 1) : null,
    },
    workoutTrend,
    nutritionTrend: nutritionDays.map((day) => ({ date: day.date, label: shortDate(day.date), calories: day.calories, protein: day.protein })),
    goals: {
      calorieGoal: req.user.settings?.calorieGoal ?? 2200,
      proteinGoal: req.user.settings?.proteinGoal ?? 150,
    },
  });
});

router.get('/workouts', requireAuth, async (req, res) => {
  const { start, end } = dateRange(req.query.from, req.query.to || todayISO());
  const logs = await loadLogs(req.user._id, start, end);
  const weekStart = req.user.settings?.weekStart ?? 1;

  // Weekly buckets
  const weekMap = new Map();
  logs.forEach((log) => {
    const key = startOfWeekISO(log.performedAt, weekStart);
    const bucket = weekMap.get(key) || { workouts: 0, minutes: 0, volume: 0, calories: 0 };
    bucket.workouts += 1;
    bucket.minutes += Number(log.durationMin) || 0;
    bucket.volume += volumeOf(log);
    bucket.calories += Number(log.caloriesBurned) || 0;
    weekMap.set(key, bucket);
  });
  const weeks = [];
  let cursor = startOfWeekISO(start, weekStart);
  const lastWeek = startOfWeekISO(end, weekStart);
  let guard = 0;
  while (cursor <= lastWeek && guard < 60) {
    const bucket = weekMap.get(cursor) || { workouts: 0, minutes: 0, volume: 0, calories: 0 };
    weeks.push({
      week: cursor,
      label: shortDate(cursor),
      workouts: bucket.workouts,
      minutes: Math.round(bucket.minutes),
      volume: Math.round(bucket.volume),
      calories: Math.round(bucket.calories),
    });
    cursor = addDaysISO(cursor, 7);
    guard += 1;
  }

  const weekday = [0, 0, 0, 0, 0, 0, 0];
  logs.forEach((log) => {
    const day = new Date(`${log.performedAt}T00:00:00Z`).getUTCDay();
    weekday[day] += 1;
  });
  const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const weekdayOrder = Array.from({ length: 7 }, (_, index) => (index + weekStart) % 7);

  const categories = new Map();
  logs.forEach((log) => {
    const bucket = categories.get(log.category) || { category: log.category, workouts: 0, minutes: 0 };
    bucket.workouts += 1;
    bucket.minutes += Number(log.durationMin) || 0;
    categories.set(log.category, bucket);
  });

  const exerciseMap = new Map();
  logs.forEach((log) => {
    (log.sets || []).forEach((set) => {
      const key = set.exerciseName;
      const bucket = exerciseMap.get(key) || { exerciseName: key, sets: 0, reps: 0, volume: 0, bestWeight: 0, sessions: new Set() };
      bucket.sets += 1;
      bucket.reps += Number(set.reps) || 0;
      bucket.volume += (Number(set.reps) || 0) * (Number(set.weight) || 0);
      bucket.bestWeight = Math.max(bucket.bestWeight, Number(set.weight) || 0);
      bucket.sessions.add(log.performedAt);
      exerciseMap.set(key, bucket);
    });
  });
  const topExercises = [...exerciseMap.values()]
    .map((bucket) => ({
      exerciseName: bucket.exerciseName,
      sets: bucket.sets,
      reps: bucket.reps,
      volume: Math.round(bucket.volume),
      bestWeight: bucket.bestWeight,
      sessions: bucket.sessions.size,
    }))
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 8);

  res.json({
    range: { start, end },
    totals: {
      workouts: logs.length,
      minutes: Math.round(sum(logs, (l) => l.durationMin)),
      calories: Math.round(sum(logs, (l) => l.caloriesBurned)),
      volume: Math.round(sum(logs, volumeOf)),
      activeDays: new Set(logs.map((l) => l.performedAt)).size,
      avgDuration: logs.length ? Math.round(sum(logs, (l) => l.durationMin) / logs.length) : 0,
    },
    weeks,
    weekday: weekdayOrder.map((index) => ({ label: weekdayLabels[index], workouts: weekday[index] })),
    categories: [...categories.values()].sort((a, b) => b.workouts - a.workouts),
    topExercises,
  });
});

router.get('/nutrition', requireAuth, async (req, res) => {
  const { start, end } = dateRange(req.query.from, req.query.to || todayISO());
  const [days, meals, foods] = await Promise.all([
    dailyTotals(req.user._id, start, end),
    mealBreakdown(req.user._id, start, end),
    topFoods(req.user._id, start, end, 8),
  ]);
  const averages = averageTotals(days);
  const totals = days.reduce(
    (acc, day) => ({
      protein: acc.protein + day.protein,
      carbs: acc.carbs + day.carbs,
      fat: acc.fat + day.fat,
    }),
    { protein: 0, carbs: 0, fat: 0 }
  );
  const macroCalories = {
    protein: totals.protein * 4,
    carbs: totals.carbs * 4,
    fat: totals.fat * 9,
  };
  const macroTotal = macroCalories.protein + macroCalories.carbs + macroCalories.fat || 1;
  const calorieGoal = req.user.settings?.calorieGoal ?? 2200;
  const adherence = days.filter((day) => day.entries > 0 && Math.abs(day.calories - calorieGoal) <= calorieGoal * 0.1).length;

  res.json({
    range: { start, end },
    days,
    averages,
    totals: {
      protein: round(totals.protein),
      carbs: round(totals.carbs),
      fat: round(totals.fat),
    },
    macros: {
      protein: { grams: round(totals.protein), calories: Math.round(macroCalories.protein), percent: Math.round((macroCalories.protein / macroTotal) * 100) },
      carbs: { grams: round(totals.carbs), calories: Math.round(macroCalories.carbs), percent: Math.round((macroCalories.carbs / macroTotal) * 100) },
      fat: { grams: round(totals.fat), calories: Math.round(macroCalories.fat), percent: Math.round((macroCalories.fat / macroTotal) * 100) },
    },
    meals,
    topFoods: foods,
    adherence: { daysOnTarget: adherence, daysLogged: averages.daysLogged },
    calorieGoal,
  });
});

router.get('/exercise', requireAuth, async (req, res) => {
  const name = String(req.query.name || '').trim();
  assertOk(name.length > 0, 'Choose an exercise to chart.', 'name');
  const { start, end } = dateRange(req.query.from, req.query.to || todayISO());
  const logs = await getDb()
    .collection('workoutlogs')
    .find({ userId: req.user._id, performedAt: { $gte: start, $lte: end }, 'sets.exerciseName': new RegExp(`^${escapeRegex(name)}$`, 'i') })
    .sort({ performedAt: 1 })
    .toArray();

  const points = logs.map((log) => {
    const sets = log.sets.filter((set) => set.exerciseName.toLowerCase() === name.toLowerCase());
    const best = sets.reduce((max, set) => Math.max(max, Number(set.weight) || 0), 0);
    const bestSet = sets.find((set) => (Number(set.weight) || 0) === best) || sets[0];
    return {
      date: log.performedAt,
      label: shortDate(log.performedAt),
      bestWeight: best,
      bestReps: bestSet?.reps ?? 0,
      volume: Math.round(sets.reduce((total, set) => total + (Number(set.reps) || 0) * (Number(set.weight) || 0), 0)),
      sets: sets.length,
    };
  });

  const pr = points.reduce((best, point) => (point.bestWeight > (best?.bestWeight || 0) ? point : best), null);
  res.json({ exercise: name, points, pr, range: { start, end } });
});

router.get('/heatmap', requireAuth, async (req, res) => {
  const days = clamp(int(req.query.days, 120), 7, 365);
  const end = isISODate(req.query.to) ? req.query.to : todayISO();
  const start = addDaysISO(end, -(days - 1));
  const logs = await loadLogs(req.user._id, start, end);
  const map = new Map();
  logs.forEach((log) => {
    const bucket = map.get(log.performedAt) || { minutes: 0, workouts: 0 };
    bucket.minutes += Number(log.durationMin) || 0;
    bucket.workouts += 1;
    map.set(log.performedAt, bucket);
  });
  const items = [];
  for (let i = 0; i < days; i += 1) {
    const iso = addDaysISO(start, i);
    const bucket = map.get(iso);
    items.push({ date: iso, workouts: bucket?.workouts || 0, minutes: Math.round(bucket?.minutes || 0) });
  }
  res.json({ start, end, items });
});

module.exports = { router };
