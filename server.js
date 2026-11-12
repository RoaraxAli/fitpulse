'use strict';

const fs = require('fs');
const config = require('./server/config');
const { connect, close } = require('./server/db');
const { createApp } = require('./server/app');
const { seedIfEmpty } = require('./server/seed');
const logger = require('./server/utils/logger');

// Never print credentials from a connection string into the logs.
const redact = (uri) => uri.replace(/\/\/([^:@/]+):([^@/]+)@/, '//***:***@');

async function openDatabase() {
  try {
    await connect(config.mongoUri, config.dbName);
    logger.info(`Connected to MongoDB (${redact(config.mongoUri)}/${config.dbName})`);
    return;
  } catch (error) {
    if (!config.mongoFallbackUri) throw error;
    logger.warn(`Primary database unreachable (${error.message.split('\n')[0]}). Falling back to ${redact(config.mongoFallbackUri)}.`);
    await connect(config.mongoFallbackUri, config.dbName);
    logger.info(`Connected to fallback MongoDB (${redact(config.mongoFallbackUri)}/${config.dbName})`);
  }
}

async function main() {
  fs.mkdirSync(config.uploadDir, { recursive: true });
  await openDatabase();

  if (config.seedOnEmpty) {
    const result = await seedIfEmpty();
    if (result.seeded) logger.info(`Seeded demo data (${result.users} users, ${result.workouts} workouts, ${result.logs} workout logs)`);
  }

  const app = createApp();
  const server = app.listen(config.port, config.host, () => {
    logger.info(`FitPulse listening on http://${config.host}:${config.port} (${config.env})`);
  });

  const shutdown = async (signal) => {
    logger.info(`${signal} received, shutting down…`);
    server.close(async () => {
      await close();
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((error) => {
  logger.error('Failed to start FitPulse:', error);
  process.exit(1);
});
