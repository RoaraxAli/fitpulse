'use strict';

const { getDb } = require('../db');
const { enumerateDates, round } = require('../utils');

const emptyDay = (date) => ({ date, calories: 0, protein: 0, carbs: 0, fat: 0, entries: 0 });

/** Daily nutrition totals for every day in a range (missing days zero-filled). */
async function dailyTotals(userId, from, to) {
  const rows = await getDb()
    .collection('nutritionlogs')
    .aggregate([
      { $match: { userId, date: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: '$date',
          calories: { $sum: '$calories' },
          protein: { $sum: '$protein' },
          carbs: { $sum: '$carbs' },
          fat: { $sum: '$fat' },
          entries: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ])
    .toArray();

  const map = new Map(rows.map((row) => [row._id, row]));
  return enumerateDates(from, to).map((date) => {
    const row = map.get(date);
    if (!row) return emptyDay(date);
    return {
      date,
      calories: Math.round(row.calories),
      protein: round(row.protein),
      carbs: round(row.carbs),
      fat: round(row.fat),
      entries: row.entries,
    };
  });
}

async function dailyTotalsForUser(user, from, to) {
  return dailyTotals(user._id, from, to);
}

async function mealBreakdown(userId, from, to) {
  const rows = await getDb()
    .collection('nutritionlogs')
    .aggregate([
      { $match: { userId, date: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: '$meal',
          calories: { $sum: '$calories' },
          protein: { $sum: '$protein' },
          carbs: { $sum: '$carbs' },
          fat: { $sum: '$fat' },
          entries: { $sum: 1 },
        },
      },
    ])
    .toArray();
  const order = ['breakfast', 'lunch', 'dinner', 'snack'];
  return order.map((meal) => {
    const row = rows.find((r) => r._id === meal);
    return {
      meal,
      calories: Math.round(row?.calories || 0),
      protein: round(row?.protein || 0),
      carbs: round(row?.carbs || 0),
      fat: round(row?.fat || 0),
      entries: row?.entries || 0,
    };
  });
}

async function topFoods(userId, from, to, limit = 8) {
  const rows = await getDb()
    .collection('nutritionlogs')
    .aggregate([
      { $match: { userId, date: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: { $toLower: '$foodName' },
          name: { $first: '$foodName' },
          calories: { $sum: '$calories' },
          protein: { $sum: '$protein' },
          carbs: { $sum: '$carbs' },
          fat: { $sum: '$fat' },
          servings: { $sum: '$quantity' },
        },
      },
      { $sort: { calories: -1 } },
      { $limit: limit },
    ])
    .toArray();
  return rows.map((row) => ({
    name: row.name,
    calories: Math.round(row.calories),
    protein: round(row.protein),
    carbs: round(row.carbs),
    fat: round(row.fat),
    servings: round(row.servings),
  }));
}

function averageTotals(days) {
  const logged = days.filter((day) => day.entries > 0);
  const divisor = logged.length || 1;
  return {
    daysLogged: logged.length,
    avgCalories: Math.round(logged.reduce((sum, day) => sum + day.calories, 0) / divisor),
    avgProtein: round(logged.reduce((sum, day) => sum + day.protein, 0) / divisor),
    avgCarbs: round(logged.reduce((sum, day) => sum + day.carbs, 0) / divisor),
    avgFat: round(logged.reduce((sum, day) => sum + day.fat, 0) / divisor),
    totalCalories: Math.round(logged.reduce((sum, day) => sum + day.calories, 0)),
  };
}

module.exports = { dailyTotals, dailyTotalsForUser, mealBreakdown, topFoods, averageTotals };
