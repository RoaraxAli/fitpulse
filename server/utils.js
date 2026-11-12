'use strict';

const { toObjectId } = require('./db');

class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message || code);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const badRequest = (message, details) => new HttpError(400, 'bad_request', message, details);
const unauthorized = (message = 'Authentication required') => new HttpError(401, 'unauthorized', message);
const forbidden = (message = 'You do not have access to this resource') => new HttpError(403, 'forbidden', message);
const notFound = (message = 'Not found') => new HttpError(404, 'not_found', message);
const conflict = (message) => new HttpError(409, 'conflict', message);

const assertOk = (condition, message, details) => {
  if (!condition) throw badRequest(message, details);
};

const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;
const str = (value, max = 500) => (typeof value === 'string' ? value.trim().slice(0, max) : '');
const num = (value, fallback = null) => {
  if (value === '' || value === null || value === undefined) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};
const int = (value, fallback = 0) => {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
};
const bool = (value, fallback = false) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'boolean') return value;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
};
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const round = (value, digits = 1) => {
  const factor = 10 ** digits;
  return Math.round((Number(value) || 0) * factor) / factor;
};

const escapeRegex = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const todayISO = () => new Date().toISOString().slice(0, 10);

const daysAgoISO = (days) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
};

const addDaysISO = (iso, days) => {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const isISODate = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);

const dateRange = (from, to) => {
  const start = isISODate(from) ? from : daysAgoISO(29);
  const end = isISODate(to) ? to : todayISO();
  return start <= end ? { start, end } : { start: end, end: start };
};

const daysBetween = (startISO, endISO) => {
  const ms = new Date(`${endISO}T00:00:00Z`) - new Date(`${startISO}T00:00:00Z`);
  return Math.round(ms / 86400000);
};

// Inclusive list of ISO dates between two dates (max 400 entries).
const enumerateDates = (startISO, endISO) => {
  const out = [];
  let cursor = startISO;
  let guard = 0;
  while (cursor <= endISO && guard < 400) {
    out.push(cursor);
    cursor = addDaysISO(cursor, 1);
    guard += 1;
  }
  return out;
};

const pagination = (query, defaultLimit = 20, maxLimit = 100) => {
  const page = clamp(int(query.page, 1), 1, 10000);
  const limit = clamp(int(query.limit, defaultLimit), 1, maxLimit);
  return { page, limit, skip: (page - 1) * limit };
};

const paginated = (items, total, page, limit) => ({
  items,
  total,
  page,
  limit,
  pages: Math.max(1, Math.ceil(total / limit)),
});

const startOfWeekISO = (isoDate, weekStartsOn = 1) => {
  const date = new Date(`${isoDate}T00:00:00Z`);
  const day = date.getUTCDay();
  const diff = (day - weekStartsOn + 7) % 7;
  date.setUTCDate(date.getUTCDate() - diff);
  return date.toISOString().slice(0, 10);
};

const streakFromDates = (dateStrings) => {
  const unique = [...new Set(dateStrings)].sort().reverse();
  if (!unique.length) return { current: 0, best: 0 };
  const today = todayISO();
  const yesterday = daysAgoISO(1);
  let current = 0;
  if (unique[0] === today || unique[0] === yesterday) {
    let cursor = unique[0];
    current = 1;
    for (let i = 1; i < unique.length; i += 1) {
      if (unique[i] === addDaysISO(cursor, -1)) {
        current += 1;
        cursor = unique[i];
      } else break;
    }
  }
  let best = 1;
  let run = 1;
  for (let i = 1; i < unique.length; i += 1) {
    if (unique[i] === addDaysISO(unique[i - 1], -1)) {
      run += 1;
      best = Math.max(best, run);
    } else {
      run = 1;
    }
  }
  return { current, best };
};

module.exports = {
  HttpError,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  assertOk,
  isNonEmptyString,
  str,
  num,
  int,
  bool,
  clamp,
  round,
  escapeRegex,
  todayISO,
  daysAgoISO,
  addDaysISO,
  isISODate,
  dateRange,
  daysBetween,
  enumerateDates,
  pagination,
  paginated,
  startOfWeekISO,
  streakFromDates,
  toObjectId,
};
