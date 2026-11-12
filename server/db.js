'use strict';

const { MongoClient, ObjectId } = require('mongodb');
const config = require('./config');

let client = null;
let database = null;

async function ensureIndexes(db) {
  await Promise.all([
    db.collection('users').createIndexes([
      { key: { username: 1 }, unique: true, name: 'username_unique' },
      { key: { email: 1 }, unique: true, name: 'email_unique' },
    ]),
    db.collection('workouts').createIndex({ userId: 1, createdAt: -1 }),
    db.collection('workoutlogs').createIndex({ userId: 1, performedAt: -1 }),
    db.collection('nutritionlogs').createIndex({ userId: 1, date: -1 }),
    db.collection('foods').createIndex({ name: 1 }),
    db.collection('foods').createIndex({ createdBy: 1 }),
    db.collection('measurements').createIndex({ userId: 1, measuredOn: -1 }),
    db.collection('metrics').createIndex({ userId: 1, metric: 1, recordedOn: -1 }),
    db.collection('goals').createIndex({ userId: 1, status: 1 }),
    db.collection('achievements').createIndex({ userId: 1, key: 1 }, { unique: true }),
    db.collection('follows').createIndex({ followerId: 1, followingId: 1 }, { unique: true }),
    db.collection('follows').createIndex({ followingId: 1 }),
    db.collection('posts').createIndex({ createdAt: -1 }),
    db.collection('replies').createIndex({ postId: 1, createdAt: 1 }),
    db.collection('likes').createIndex({ postId: 1, userId: 1 }, { unique: true }),
    db.collection('notifications').createIndex({ userId: 1, createdAt: -1 }),
    db.collection('notifications').createIndex({ userId: 1, isRead: 1 }),
    db.collection('reminders').createIndex({ userId: 1 }),
    db.collection('tickets').createIndex({ userId: 1, createdAt: -1 }),
    db.collection('exerciseCatalog').createIndex({ name: 1 }, { unique: true }),
  ]);
}

async function connect(uri = config.mongoUri, dbName = config.dbName) {
  if (database) return database;
  client = new MongoClient(uri, { maxPoolSize: 20, serverSelectionTimeoutMS: 10000 });
  await client.connect();
  database = client.db(dbName);
  await ensureIndexes(database);
  return database;
}

function getDb() {
  if (!database) throw new Error('Database has not been connected yet');
  return database;
}

async function close() {
  if (client) await client.close();
  client = null;
  database = null;
}

function toObjectId(value) {
  if (!value) return null;
  if (value instanceof ObjectId) return value;
  if (typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value)) return new ObjectId(value);
  return null;
}

module.exports = { connect, getDb, close, toObjectId, ObjectId };
