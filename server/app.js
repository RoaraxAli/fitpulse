'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const { getDb } = require('./db');
const { attachUser } = require('./auth');
const { securityHeaders, rateLimit, requestLogger, notFound, errorHandler } = require('./middleware');
const { router: authRouter } = require('./routes/auth');
const { router: googleRouter } = require('./routes/google');
const { router: usersRouter } = require('./routes/users');
const { router: workoutsRouter } = require('./routes/workouts');
const { router: logsRouter } = require('./routes/logs');
const { router: nutritionRouter, foods: foodsRouter } = require('./routes/nutrition');
const { measurements, metrics, goals, summary } = require('./routes/progress');
const { router: analyticsRouter } = require('./routes/analytics');
const { router: dashboardRouter } = require('./routes/dashboard');
const { router: socialRouter } = require('./routes/social');
const { notifications, reminders } = require('./routes/engagement');
const { router: searchRouter } = require('./routes/search');
const { router: reportsRouter } = require('./routes/reports');
const { router: accountRouter } = require('./routes/account');
const { router: chatRouter } = require('./routes/chat');

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(securityHeaders);
  app.use(express.json({ limit: config.maxBody }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));
  app.use(requestLogger);

  app.use('/api/auth/login', rateLimit({ windowMs: 60_000, max: 15, message: 'Too many sign-in attempts. Try again in a minute.' }));
  app.use('/api/auth/register', rateLimit({ windowMs: 60_000, max: 10, message: 'Too many sign-up attempts. Try again in a minute.' }));
  app.use('/api/chat', rateLimit({ windowMs: 60_000, max: 30, message: 'Slow down — too many messages. Try again in a minute.' }));
  app.use('/api', rateLimit({ windowMs: 60_000, max: 900 }));

  app.use(attachUser);

  app.get('/api/health', async (req, res) => {
    try {
      const db = getDb();
      await db.command({ ping: 1 });
      res.json({ ok: true, service: 'fitpulse', version: config.version, database: db.databaseName, uptime: Math.round(process.uptime()) });
    } catch (error) {
      res.status(503).json({ ok: false, error: 'database_unavailable' });
    }
  });

  app.use('/api/auth/google', googleRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/workouts', workoutsRouter);
  app.use('/api/workout-logs', logsRouter);
  app.use('/api/nutrition', nutritionRouter);
  app.use('/api/foods', foodsRouter);
  app.use('/api/measurements', measurements);
  app.use('/api/metrics', metrics);
  app.use('/api/goals', goals);
  app.use('/api/progress', summary);
  app.use('/api/analytics', analyticsRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/notifications', notifications);
  app.use('/api/reminders', reminders);
  app.use('/api/search', searchRouter);
  app.use('/api/reports', reportsRouter);
  app.use('/api/chat', chatRouter);
  app.use('/api', socialRouter);
  app.use('/api', accountRouter);
  app.use('/api', notFound);

  // Uploaded avatars
  fs.mkdirSync(config.uploadDir, { recursive: true });
  app.use(
    '/uploads',
    express.static(config.uploadDir, {
      maxAge: '30d',
      immutable: true,
      setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff'),
    })
  );

  // Built React client
  const distDir = path.join(__dirname, '..', 'dist');
  app.use(
    express.static(distDir, {
      index: false,
      maxAge: '1y',
      immutable: true,
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache');
      },
    })
  );

  app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    const indexPath = path.join(distDir, 'index.html');
    if (!fs.existsSync(indexPath)) {
      return res.status(503).type('text').send('FitPulse UI has not been built yet. Run `npm run build`.');
    }
    res.setHeader('Cache-Control', 'no-cache');
    return res.sendFile(indexPath);
  });

  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
