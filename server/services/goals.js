'use strict';

const { getDb } = require('../db');
const { notify } = require('./notifications');

/**
 * Advance every active goal of a given type and complete it when the target
 * is reached. Returns summaries of goals that were completed.
 */
async function applyGoalProgress(userId, type, amount = 1) {
  const db = getDb();
  const goals = await db.collection('goals').find({ userId, type, status: 'active' }).toArray();
  const completed = [];
  for (const goal of goals) {
    const next = (Number(goal.currentValue) || 0) + amount;
    const target = Number(goal.targetValue) || 0;
    const isComplete = target > 0 && next >= target;
    await db.collection('goals').updateOne(
      { _id: goal._id },
      {
        $set: {
          currentValue: isComplete ? Math.max(next, target) : next,
          status: isComplete ? 'completed' : 'active',
          updatedAt: new Date(),
        },
      }
    );
    if (isComplete) {
      completed.push({ ...goal, currentValue: Math.max(next, target) });
      await notify(userId, {
        type: 'goal',
        title: `Goal achieved: ${goal.title}`,
        body: `You hit ${target}${goal.unit ? ` ${goal.unit}` : ''}. Outstanding work.`,
        icon: 'target',
        link: '/progress',
      });
    }
  }
  return completed;
}

async function applyMeasurementProgress(userId, latestWeightKg) {
  if (!Number.isFinite(latestWeightKg)) return [];
  const db = getDb();
  const goals = await db
    .collection('goals')
    .find({ userId, status: 'active', type: { $in: ['weight_loss', 'weight'] } })
    .toArray();
  const completed = [];
  for (const goal of goals) {
    if (!goal.startValue) continue;
    const lost = Number(goal.startValue) - latestWeightKg;
    const next = Math.max(0, Math.round(lost * 10) / 10);
    const target = Number(goal.targetValue) || 0;
    const isComplete = target > 0 && next >= target;
    await db.collection('goals').updateOne(
      { _id: goal._id },
      { $set: { currentValue: isComplete ? target : next, status: isComplete ? 'completed' : 'active', updatedAt: new Date() } }
    );
    if (isComplete) {
      completed.push(goal);
      await notify(userId, {
        type: 'goal',
        title: `Goal achieved: ${goal.title}`,
        body: `You reached your target. That is ${target}${goal.unit ? ` ${goal.unit}` : ''} down!`,
        icon: 'target',
        link: '/progress',
      });
    }
  }
  return completed;
}

module.exports = { applyGoalProgress, applyMeasurementProgress };
