export const CATEGORIES = ['strength', 'cardio', 'hiit', 'mobility', 'endurance', 'other'];
export const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'];
export const GOAL_TYPES = ['workouts', 'weight_loss', 'strength', 'nutrition', 'custom'];
export const REMINDER_TYPES = ['workout', 'meal', 'water', 'sleep', 'custom'];
export const POST_CATEGORIES = ['general', 'training', 'nutrition', 'progress', 'motivation', 'question'];

export const MEAL_META = {
  breakfast: { label: 'Breakfast', icon: 'sunrise' },
  lunch: { label: 'Lunch', icon: 'sun' },
  dinner: { label: 'Dinner', icon: 'moon' },
  snack: { label: 'Snacks', icon: 'apple' },
};

export const CATEGORY_META = {
  strength: { label: 'Strength', color: 'var(--accent)' },
  cardio: { label: 'Cardio', color: 'var(--teal)' },
  hiit: { label: 'HIIT', color: 'var(--orange)' },
  mobility: { label: 'Mobility', color: 'var(--violet)' },
  endurance: { label: 'Endurance', color: 'var(--blue)' },
  other: { label: 'Other', color: 'var(--muted)' },
};

export const MACRO_COLORS = {
  protein: 'var(--teal)',
  carbs: 'var(--orange)',
  fat: 'var(--violet)',
};

const pad = (value) => String(value).padStart(2, '0');

export function todayISO() {
  const date = new Date();
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseISODate(iso) {
  if (!iso) return null;
  const [year, month, day] = String(iso).slice(0, 10).split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

export function addDays(iso, amount) {
  const date = parseISODate(iso) || new Date();
  date.setDate(date.getDate() + amount);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function daysAgoISO(amount) {
  return addDays(todayISO(), -amount);
}

export function fmtDate(iso, options = {}) {
  if (!iso) return '—';
  const date = typeof iso === 'string' ? parseISODate(iso) : new Date(iso);
  if (!date || Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...options });
}

export function fmtDateLong(value) {
  if (!value) return '—';
  const date = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? parseISODate(value) : new Date(value);
  if (!date || Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

export function fmtNumber(value, digits = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '0';
  return number.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function fmtCompact(value) {
  const number = Number(value) || 0;
  if (Math.abs(number) >= 1000000) return `${(number / 1000000).toFixed(1)}m`;
  if (Math.abs(number) >= 1000) return `${(number / 1000).toFixed(number >= 10000 ? 0 : 1)}k`;
  return String(Math.round(number));
}

export function fmtDuration(minutes) {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  if (total < 60) return `${total} min`;
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  return mins ? `${hours}h ${mins}m` : `${hours}h`;
}

export function timeAgo(value) {
  if (!value) return '';
  const timestamp = new Date(value).getTime();
  const diff = Date.now() - timestamp;
  if (Number.isNaN(diff)) return '';
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.round(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return fmtDate(value, { year: 'numeric' });
}

export function initials(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || '?';
}

export function avatarGradient(name = '') {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) % 360;
  return `linear-gradient(135deg, hsl(${hash} 65% 45%), hsl(${(hash + 48) % 360} 70% 35%))`;
}

export function kgToDisplay(kg, unitSystem = 'metric') {
  if (kg === null || kg === undefined || kg === '') return null;
  const value = Number(kg);
  if (!Number.isFinite(value)) return null;
  return unitSystem === 'imperial' ? Math.round(value * 2.20462 * 10) / 10 : Math.round(value * 10) / 10;
}

export function displayToKg(value, unitSystem = 'metric') {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return unitSystem === 'imperial' ? Math.round((number / 2.20462) * 100) / 100 : number;
}

export function weightUnit(unitSystem = 'metric') {
  return unitSystem === 'imperial' ? 'lb' : 'kg';
}

export function cmToDisplay(cm, unitSystem = 'metric') {
  if (cm === null || cm === undefined || cm === '') return null;
  const value = Number(cm);
  if (!Number.isFinite(value)) return null;
  return unitSystem === 'imperial' ? Math.round((value / 2.54) * 10) / 10 : Math.round(value * 10) / 10;
}

export function lengthUnit(unitSystem = 'metric') {
  return unitSystem === 'imperial' ? 'in' : 'cm';
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function classNames(...values) {
  return values.filter(Boolean).join(' ');
}

export function changeLabel(change) {
  if (change === null || change === undefined) return null;
  return `${change > 0 ? '+' : ''}${change}%`;
}

export function percent(value, total) {
  if (!total) return 0;
  return clamp(Math.round((value / total) * 100), 0, 100);
}
