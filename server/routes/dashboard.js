'use strict';

const express = require('express');
const { getDb } = require('../db');
const { requireAuth } = require('../auth');
const { goal, measurement, notification, workoutLog } = require('../serializers');
const {
  todayISO,
  isISODate,
  addDaysISO,
  daysAgoISO,
  startOfWeekISO,
  streakFromDates,
  round,
  daysBetween,
} = require('../utils');
const { dailyTotals } = require('../services/nutrition');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  const date = isISODate(req.query.date) ? req.query.date : todayISO();
  const userId = req.user._id;
  const db = getDb();
  const weekStartDay = req.user.settings?.weekStart ?? 1;
  const weekStart = startOfWeekISO(date, weekStartDay);
  const weekEnd = addDaysISO(weekStart, 6);
  const lookback = addDaysISO(date, -119);

  const [todayDocs, weekLogs, recentLogs, streakLogs, goalDocs, latestMeasurements, weekNutrition, unread, unlocked] =
    await Promise.all([
      db.collection('nutritionlogs').find({ userId, date }).sort({ createdAt: 1 }).toArray(),
      db.collection('workoutlogs').find({ userId, performedAt: { $gte: weekStart, $lte: weekEnd } }).toArray(),
      db.collection('workoutlogs').find({ userId }).sort({ performedAt: -1, createdAt: -1 }).limit(5).toArray(),
      db.collection('workoutlogs').find({ userId, performedAt: { $gte: lookback, $lte: date } }, { projection: { performedAt: 1 } }).toArray(),
      db.collection('goals').find({ userId, status: 'active' }).sort({ deadline: 1, createdAt: -1 }).limit(4).toArray(),
      db.collection('measurements').find({ userId }).sort({ measuredOn: -1 }).limit(30).toArray(),
      dailyTotals(userId, addDaysISO(date, -6), date),
      db.collection('notifications').countDocuments({ userId, isRead: false }),
      db.collection('achievements').countDocuments({ userId }),
    ]);

  const meals = { breakfast: [], lunch: [], dinner: [], snack: [] };
  todayDocs.forEach((entry) => {
    if (meals[entry.meal]) meals[entry.meal].push(entry);
  });
  const todayTotals = todayDocs.reduce(
    (acc, entry) => ({
      calories: acc.calories + (Number(entry.calories) || 0),
      protein: acc.protein + (Number(entry.protein) || 0),
      carbs: acc.carbs + (Number(entry.carbs) || 0),
      fat: acc.fat + (Number(entry.fat) || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const weekMinutes = weekLogs.reduce((sum, log) => sum + (Number(log.durationMin) || 0), 0);
  const weekVolume = weekLogs.reduce(
    (sum, log) => sum + (log.sets || []).reduce((total, set) => total + (Number(set.reps) || 0) * (Number(set.weight) || 0), 0),
    0
  );
  const weekBurned = weekLogs.reduce((sum, log) => sum + (Number(log.caloriesBurned) || 0), 0);
  const streak = streakFromDates(streakLogs.map((log) => log.performedAt));

  const latestWeight = latestMeasurements.find((m) => m.weightKg != null) || null;
  const oldestWeight = [...latestMeasurements].reverse().find((m) => m.weightKg != null) || null;
  const weightChange =
    latestWeight && oldestWeight && latestWeight.measuredOn !== oldestWeight.measuredOn
      ? round(latestWeight.weightKg - oldestWeight.weightKg, 1)
      : null;

  // Last 7 days activity for the mini chart.
  const activity = [];
  const activityMap = new Map();
  weekNutrition.forEach((day) => activityMap.set(day.date, { minutes: 0, volume: 0 }));
  weekLogs.forEach((log) => {
    const bucket = activityMap.get(log.performedAt);
    if (!bucket) return;
    bucket.minutes += Number(log.durationMin) || 0;
    bucket.volume += (log.sets || []).reduce((total, set) => total + (Number(set.reps) || 0) * (Number(set.weight) || 0), 0);
  });
  for (let i = 6; i >= 0; i -= 1) {
    const iso = addDaysISO(date, -i);
    const bucket = activityMap.get(iso) || { minutes: 0, volume: 0 };
    activity.push({ date: iso, minutes: Math.round(bucket.minutes), volume: Math.round(bucket.volume) });
  }

  const calorieWeek = weekNutrition.map((day) => ({ date: day.date, calories: day.calories }));

  const settings = req.user.settings || {};
  res.json({
    date,
    greetingName: req.user.name.split(' ')[0],
    week: { start: weekStart, end: weekEnd },
    today: {
      totals: {
        calories: Math.round(todayTotals.calories),
        protein: round(todayTotals.protein),
        carbs: round(todayTotals.carbs),
        fat: round(todayTotals.fat),
      },
      goals: {
        calories: settings.calorieGoal ?? 2200,
        protein: settings.proteinGoal ?? 150,
        carbs: settings.carbsGoal ?? 250,
        fat: settings.fatGoal ?? 70,
        water: settings.waterGoal ?? 2500,
      },
      entries: todayDocs.length,
    },
    weekStats: {
      workouts: weekLogs.length,
      minutes: Math.round(weekMinutes),
      volume: Math.round(weekVolume),
      caloriesBurned: Math.round(weekBurned),
      activeDays: new Set(weekLogs.map((log) => log.performedAt)).size,
    },
    streak,
    weight: {
      latestKg: latestWeight?.weightKg ?? null,
      changeKg: weightChange,
      measuredOn: latestWeight?.measuredOn ?? null,
      goalKg: null,
    },
    goals: goalDocs.map(goal),
    recentWorkouts: recentLogs.map(workoutLog),
    meals: Object.fromEntries(
      Object.entries(meals).map(([meal, entries]) => [
        meal,
        entries.map((entry) => ({
          id: String(entry._id),
          foodName: entry.foodName,
          quantity: entry.quantity,
          servingUnit: entry.servingUnit,
          calories: entry.calories,
          protein: entry.protein,
          carbs: entry.carbs,
          fat: entry.fat,
        })),
      ])
    ),
    activity,
    calorieWeek,
    unreadNotifications: unread,
    unlockedAchievements: unlocked,
    memberDays: daysBetween((req.user.createdAt || new Date()).toISOString().slice(0, 10), todayISO()) + 1,
  });
});

module.exports = { router };
