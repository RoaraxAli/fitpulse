'use strict';

const { getDb } = require('../db');

/**
 * Create an in-app notification while respecting the user's preferences.
 * Preference keys map onto the user's embedded settings object.
 */
const PREFERENCE_BY_TYPE = {
  social: 'notifySocial',
  goal: 'notifyGoals',
  reminder: 'notifyWorkout',
  meal: 'notifyMeal',
  workout: 'notifyWorkout',
};

async function notify(userId, { type = 'system', title, body = '', icon = 'bell', link = '' }) {
  const db = getDb();
  const user = await db.collection('users').findOne({ _id: userId }, { projection: { settings: 1 } });
  if (!user) return null;
  const prefKey = PREFERENCE_BY_TYPE[type];
  if (prefKey && user.settings && user.settings[prefKey] === false) return null;
  const doc = {
    userId,
    type,
    title,
    body,
    icon,
    link,
    isRead: false,
    createdAt: new Date(),
  };
  const result = await db.collection('notifications').insertOne(doc);
  doc._id = result.insertedId;
  return doc;
}

async function unreadCount(userId) {
  return getDb().collection('notifications').countDocuments({ userId, isRead: false });
}

module.exports = { notify, unreadCount };
