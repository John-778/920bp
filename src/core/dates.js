/**
 * Date and time helpers.
 *
 * Dates are stored as plain 'YYYY-MM-DD' strings and times as 'HH:MM'
 * (24-hour). Both are what the native <input type="date"> / <input
 * type="time"> controls expect, and neither drags a timezone along - a
 * pass valid on the 1st is valid on the 1st wherever the phone happens
 * to be.
 */

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_24H = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** True when the string is a real calendar date in 'YYYY-MM-DD' form. */
export function isValidDate(value) {
  if (typeof value !== 'string') return false;
  const parts = ISO_DATE.exec(value);
  if (!parts) return false;
  const [, y, m, d] = parts.map(Number);
  if (m < 1 || m > 12) return false;
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}

export function isValidTime(value) {
  return typeof value === 'string' && TIME_24H.test(value);
}

/** 'YYYY-MM-DD' for today in the device's own timezone. */
export function today() {
  const now = new Date();
  return toISODate(now);
}

export function toISODate(date) {
  const y = String(date.getFullYear()).padStart(4, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** '2026-10-01' -> '01-Oct-2026' (the format the original pass displayed). */
export function formatDate(value) {
  if (!isValidDate(value)) return '--';
  const [y, m, d] = value.split('-');
  return `${d}-${MONTHS[Number(m) - 1]}-${y}`;
}

/** '2026-10-01' -> 'October 2026'. */
export function formatMonth(value) {
  if (!isValidDate(value)) return '--';
  const [y, m] = value.split('-');
  return `${MONTHS_LONG[Number(m) - 1]} ${y}`;
}

/** '07:20' -> '07:20 AM'. */
export function formatTime(value) {
  if (!isValidTime(value)) return '--';
  const [h, m] = value.split(':').map(Number);
  const suffix = h < 12 ? 'AM' : 'PM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(hour12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${suffix}`;
}

/** Negative when a < b, 0 when equal, positive when a > b. Lexical works for ISO. */
export function compareDates(a, b) {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/** Whole days from `from` up to `to`; negative when `to` is in the past. */
export function daysBetween(from, to) {
  if (!isValidDate(from) || !isValidDate(to)) return 0;
  const a = Date.UTC(...from.split('-').map((n, i) => (i === 1 ? Number(n) - 1 : Number(n))));
  const b = Date.UTC(...to.split('-').map((n, i) => (i === 1 ? Number(n) - 1 : Number(n))));
  return Math.round((b - a) / 86400000);
}

/** The first and last day of the month containing `value`. */
export function monthBounds(value) {
  if (!isValidDate(value)) return null;
  const [y, m] = value.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, '0');
  return { start: `${y}-${mm}-01`, end: `${y}-${mm}-${String(last).padStart(2, '0')}` };
}

/** Minutes between two 'HH:MM' times, wrapping past midnight when needed. */
export function minutesBetween(start, end) {
  if (!isValidTime(start) || !isValidTime(end)) return 0;
  const toMinutes = (t) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const diff = toMinutes(end) - toMinutes(start);
  return diff < 0 ? diff + 1440 : diff;
}

export { MONTHS, MONTHS_LONG };
