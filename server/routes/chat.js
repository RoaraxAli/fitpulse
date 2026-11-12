'use strict';

const express = require('express');
const { getDb, toObjectId } = require('../db');
const { requireAuth } = require('../auth');
const config = require('../config');
const {
  notFound,
  str,
  clamp,
} = require('../utils');

const router = express.Router();

const MAX_HISTORY = 40;
const MAX_MESSAGE_CHARS = 4000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function historyCollection() {
  return getDb().collection('chatMessages');
}

async function loadHistory(userId) {
  const docs = await historyCollection()
    .find({ userId })
    .sort({ createdAt: 1 })
    .limit(MAX_HISTORY)
    .toArray();
  return docs;
}

async function buildUserContext(user) {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);
  const lines = [];
  lines.push(`Name: ${user.name || user.username}`);
  lines.push(`Username: ${user.username}`);
  if (user.unitSystem) lines.push(`Units: ${user.unitSystem}`);
  if (user.settings?.calorieGoal) lines.push(`Calorie goal: ${user.settings.calorieGoal} kcal/day`);
  if (user.settings?.proteinGoal) lines.push(`Protein goal: ${user.settings.proteinGoal} g/day`);

  try {
    const recentWorkouts = await db
      .collection('workoutLogs')
      .find({ userId: user._id })
      .sort({ performedAt: -1 })
      .limit(5)
      .toArray();
    if (recentWorkouts.length) {
      lines.push('Recent workouts:');
      recentWorkouts.forEach((w) => {
        lines.push(`  - ${w.name || 'Workout'} on ${String(w.performedAt).slice(0, 10)}: ${w.durationMin || 0} min, ${w.totalSets || 0} sets, ${Math.round(w.volume || 0)} kg volume`);
      });
    } else {
      lines.push('Recent workouts: none logged yet.');
    }
  } catch (e) { /* ignore */ }

  try {
    const entries = await db
      .collection('nutritionEntries')
      .find({ userId: user._id, date: today })
      .toArray();
    const totals = entries.reduce(
      (acc, e) => {
        acc.calories += Number(e.calories) || 0;
        acc.protein += Number(e.protein) || 0;
        acc.carbs += Number(e.carbs) || 0;
        acc.fat += Number(e.fat) || 0;
        return acc;
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
    lines.push(`Today's nutrition (${today}): ${Math.round(totals.calories)} kcal, ${Math.round(totals.protein)}g protein, ${Math.round(totals.carbs)}g carbs, ${Math.round(totals.fat)}g fat across ${entries.length} entries.`);
  } catch (e) { /* ignore */ }

  try {
    const goals = await db
      .collection('goals')
      .find({ userId: user._id, status: { $ne: 'completed' } })
      .limit(6)
      .toArray();
    if (goals.length) {
      lines.push('Active goals:');
      goals.forEach((g) => {
        lines.push(`  - ${g.title}: ${g.currentValue}/${g.targetValue} ${g.unit || ''} (${Math.round(g.progress || 0)}%)`);
      });
    }
  } catch (e) { /* ignore */ }

  try {
    const latest = await db
      .collection('measurements')
      .find({ userId: user._id })
      .sort({ measuredOn: -1 })
      .limit(1)
      .toArray();
    if (latest.length) {
      const m = latest[0];
      if (m.weightKg) lines.push(`Latest body weight: ${m.weightKg} kg (${m.measuredOn})`);
    }
  } catch (e) { /* ignore */ }

  return lines.join('\n');
}

const SYSTEM_PROMPT = (context) => `You are FitPulse Coach — an expert personal trainer and sports nutritionist built into the FitPulse fitness tracker app.

PERSONA
- Warm, encouraging, concise. Short paragraphs and bullet points. Never lecture.
- Address the user by first name when known.
- Expert in strength training, cardio, mobility, nutrition, sleep, recovery, and habit building.

WHAT YOU CAN DO
- Answer fitness and nutrition questions.
- Suggest workouts, exercises, progressions, and form cues.
- Interpret the user's tracked data (provided below) and give personalized, data-driven advice.
- Help set goals, plan weeks, and troubleshoot plateaus.

SAFETY (non-negotiable)
- You are not a doctor. For pain, injury, medical conditions, eating disorders, medications, or pregnancy, advise consulting a qualified healthcare professional. Never diagnose.
- Do not prescribe extreme diets, dangerous training volumes, or anything that risks harm. Keep advice evidence-based and sustainable.
- If asked for something harmful, refuse briefly and redirect to safe alternatives.

USER DATA (may be partial or empty)
${context}

GUIDELINES
- Reference the user's actual data when relevant ("You logged 3 workouts this week...").
- Give concrete, actionable next steps (sets/reps, grams of protein, minutes, kg).
- Keep replies under ~220 words unless the user asks for more detail.
- If you don't know, say so honestly.
- Stay on topic (fitness, nutrition, health, the FitPulse app). Politely decline off-topic requests.
- Format with markdown: short headings, bullets, bold for key numbers.`;

// ---------------------------------------------------------------------------
// GET /api/chat — load history
// ---------------------------------------------------------------------------
router.get('/', requireAuth, async (req, res) => {
  const docs = await loadHistory(req.user._id);
  res.json({
    messages: docs.map((d) => ({ role: d.role, content: d.content, createdAt: d.createdAt })),
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/chat — clear history
// ---------------------------------------------------------------------------
router.delete('/', requireAuth, async (req, res) => {
  await historyCollection().deleteMany({ userId: req.user._id });
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// POST /api/chat — send a message, stream reply
// ---------------------------------------------------------------------------
router.post('/', requireAuth, async (req, res) => {
  const apiKey = config.geminiApiKey;
  if (!apiKey) {
    res.status(503).json({ error: { code: 'chat_unavailable', message: 'Chat is not configured.' } });
    return;
  }

  const message = str(req.body?.message, MAX_MESSAGE_CHARS).trim();
  if (!message) {
    res.status(400).json({ error: { code: 'bad_request', message: 'Message is required.' } });
    return;
  }

  const user = req.user;
  const context = await buildUserContext(user);

  // Persist user message
  const now = new Date();
  await historyCollection().insertOne({
    userId: user._id,
    role: 'user',
    content: message,
    createdAt: now,
  });

  // Build contents from history
  const history = await loadHistory(user._id);
  const contents = history
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

  const model = config.geminiModel || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (typeof res.flushHeaders === 'function') res.flushHeaders();

  let assistantText = '';
  let aborted = false;
  req.on('close', () => { aborted = true; });

  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT(context) }] },
        contents,
        generationConfig: {
          temperature: 0.7,
          topP: 0.9,
          maxOutputTokens: 700,
        },
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        ],
      }),
    });

    if (!upstream.ok || !upstream.body) {
      const text = await upstream.text().catch(() => '');
      res.write(`event: error\ndata: ${JSON.stringify({ message: `Upstream error (${upstream.status}): ${text.slice(0, 200)}` })}\n\n`);
      res.end();
      return;
    }

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      if (aborted) break;
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        let json;
        try { json = JSON.parse(payload); } catch { continue; }
        const chunk = json?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
        if (chunk) {
          assistantText += chunk;
          res.write(`event: token\ndata: ${JSON.stringify({ text: chunk })}\n\n`);
        }
        const finish = json?.candidates?.[0]?.finishReason;
        if (finish && finish !== 'STOP') {
          // non-fatal; continue
        }
      }
    }

    if (!aborted && assistantText.trim()) {
      await historyCollection().insertOne({
        userId: user._id,
        role: 'assistant',
        content: assistantText.trim(),
        createdAt: new Date(),
      });
    }
    res.write(`event: done\ndata: ${JSON.stringify({ ok: true })}\n\n`);
    res.end();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('chat stream error:', error && error.message ? error.message : error);
    if (!res.writableEnded) {
      res.write(`event: error\ndata: ${JSON.stringify({ message: 'Chat failed. Please try again.' })}\n\n`);
      res.end();
    }
  }
});

module.exports = { router };
