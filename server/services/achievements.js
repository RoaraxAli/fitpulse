'use strict';

const { getDb } = require('../db');
const { notify } = require('./notifications');
const { streakFromDates, round } = require('../utils');

/**
 * Achievement definitions. Each is checked after relevant activity and granted
 * at most once per user (enforced by a unique index on {userId, key}).
 */
const ACHIEVEMENTS = {
  first_workout: {
    title: 'First rep logged',
    body: 'You logged your first workout. The journey starts here!',
    icon: 'trophy',
    check: (s) => s.workouts >= 1,
  },
  workouts_10: {
    title: '10 workouts strong',
    body: 'Ten sessions in the books. Consistency is compounding.',
    icon: 'flame',
    check: (s) => s.workouts >= 10,
  },
  workouts_25: {
    title: '25 workouts',
    body: 'A quarter century of sessions completed.',
    icon: 'flame',
    check: (s) => s.workouts >= 25,
  },
  workouts_50: {
    title: 'Half century club',
    body: '50 workouts logged. Incredible dedication.',
    icon: 'medal',
    check: (s) => s.workouts >= 50,
  },
  streak_3: {
    title: '3-day streak',
    body: 'Three days in a row. Momentum is on your side.',
    icon: 'flame',
    check: (s) => s.streak.current >= 3,
  },
  streak_7: {
    title: '7-day streak',
    body: 'A full week of consistency. Outstanding!',
    icon: 'flame',
    check: (s) => s.streak.current >= 7,
  },
  streak_30: {
    title: '30-day streak',
    body: 'Thirty days without missing. Legendary.',
    icon: 'medal',
    check: (s) => s.streak.current >= 30,
  },
  first_measurement: {
    title: 'Baseline captured',
    body: 'Your first body measurement is recorded. Track the change.',
    icon: 'ruler',
    check: (s) => s.measurements >= 1,
  },
  goal_completed: {
    title: 'Goal crushed',
    body: 'You completed a fitness goal. Time to set the next one.',
    icon: 'target',
    check: (s) => s.goalsCompleted >= 1,
  },
};

async function gatherStats(userId) {
  const db = getDb();
  const [workouts, measurements, goalsCompleted, recentLogs] = await Promise.all([
    db.collection('workoutlogs').countDocuments({ userId }),
    db.collection('measurements').countDocuments({ userId }),
    db.collection('goals').countDocuments({ userId, status: 'completed' }),
    db
      .collection('workoutlogs')
      .find({ userId }, { projection: { performedAt: 1 }, sort: { performedAt: -1 }, limit: 200 })
      .toArray(),
  ]);
  const streak = streakFromDates(recentLogs.map((l) => l.performedAt));
  return { workouts, measurements, goalsCompleted, streak };
}

async function checkAchievements(userId) {
  const db = getDb();
  const stats = await gatherStats(userId);
  const unlocked = [];
  for (const [key, definition] of Object.entries(ACHIEVEMENTS)) {
    if (!definition.check(stats)) continue;
    try {
      const result = await db.collection('achievements').updateOne(
        { userId, key },
        { $setOnInsert: { unlockedAt: new Date() } },
        { upsert: true }
      );
      if (result.upsertedCount > 0) {
        unlocked.push(key);
        await notify(userId, {
          type: 'achievement',
          title: definition.title,
          body: definition.body,
          icon: definition.icon,
          link: '/progress',
        });
      }
    } catch (error) {
      if (error.code !== 11000) throw error;
    }
  }
  return unlocked;
}

async function listAchievements(userId) {
  const db = getDb();
  const docs = await db.collection('achievements').find({ userId }).toArray();
  const byKey = new Map(docs.map((d) => [d.key, d.unlockedAt]));
  return Object.entries(ACHIEVEMENTS).map(([key, def]) => ({
    key,
    title: def.title,
    body: def.body,
    icon: def.icon,
    unlocked: byKey.has(key),
    unlockedAt: byKey.get(key) || null,
  }));
}

module.exports = { checkAchievements, listAchievements, gatherStats, round };
