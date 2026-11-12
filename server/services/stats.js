'use strict';

const { getDb } = require('../db');
const { round, daysBetween, daysAgoISO } = require('../utils');

/** Aggregated numbers used by the dashboard, profile and analytics screens. */
async function calculateStats(user) {
  const db = getDb();
  const userId = user._id;
  const [logs, measurements, followers, following, posts] = await Promise.all([
    db
      .collection('workoutlogs')
      .find({ userId }, { projection: { performedAt: 1, durationMin: 1, caloriesBurned: 1, sets: 1 } })
      .toArray(),
    db.collection('measurements').find({ userId }).sort({ measuredOn: 1 }).toArray(),
    db.collection('follows').countDocuments({ followingId: userId }),
    db.collection('follows').countDocuments({ followerId: userId }),
    db.collection('posts').countDocuments({ userId }),
  ]);

  const totalVolume = logs.reduce(
    (sum, log) => sum + (log.sets || []).reduce((s, set) => s + (Number(set.reps) || 0) * (Number(set.weight) || 0), 0),
    0
  );
  const totalMinutes = logs.reduce((sum, log) => sum + (Number(log.durationMin) || 0), 0);
  const first = measurements[0];
  const latest = measurements[measurements.length - 1];
  const weightChange =
    first && latest && first.weightKg != null && latest.weightKg != null
      ? round(latest.weightKg - first.weightKg, 1)
      : null;

  return {
    workouts: logs.length,
    totalVolume: Math.round(totalVolume),
    totalMinutes,
    totalCalories: logs.reduce((sum, log) => sum + (Number(log.caloriesBurned) || 0), 0),
    followers,
    following,
    posts,
    latestWeightKg: latest?.weightKg ?? null,
    latestBodyFatPct: latest?.bodyFatPct ?? null,
    weightChange,
    memberDays: daysBetween((user.createdAt || new Date()).toISOString().slice(0, 10), daysAgoISO(0)) + 1,
  };
}

module.exports = { calculateStats };
