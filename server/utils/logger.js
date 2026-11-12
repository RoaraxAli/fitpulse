'use strict';

const fs = require('fs');
const path = require('path');

const logDir = path.join(__dirname, '..', '..', 'data', 'logs');
const errorLog = path.join(logDir, 'error.log');

function write(level, args) {
  const line = `${new Date().toISOString()} [${level}] ${args
    .map((arg) =>
      arg instanceof Error ? arg.stack || arg.message : typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    )
    .join(' ')}`;
  (level === 'error' ? process.stderr : process.stdout).write(`${line}\n`);
  if (level === 'error') {
    try {
      fs.mkdirSync(logDir, { recursive: true });
      fs.appendFileSync(errorLog, `${line}\n`);
    } catch {
      /* never let logging break a request */
    }
  }
}

module.exports = {
  info: (...args) => write('info', args),
  warn: (...args) => write('warn', args),
  error: (...args) => write('error', args),
};
