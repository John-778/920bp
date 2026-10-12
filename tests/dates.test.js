import { describe, it, expect } from 'vitest';
import {
  isValidDate,
  isValidTime,
  formatDate,
  formatMonth,
  formatTime,
  compareDates,
  daysBetween,
  monthBounds,
  minutesBetween,
  toISODate,
} from '../src/core/dates.js';

describe('isValidDate', () => {
  it('accepts real dates', () => {
    expect(isValidDate('2026-10-01')).toBe(true);
    expect(isValidDate('2024-02-29')).toBe(true); // leap year
  });

  it('rejects impossible dates', () => {
    expect(isValidDate('2026-02-30')).toBe(false);
    expect(isValidDate('2025-02-29')).toBe(false); // not a leap year
    expect(isValidDate('2026-13-01')).toBe(false);
    expect(isValidDate('2026-00-10')).toBe(false);
  });

  it('rejects anything that is not a plain ISO date string', () => {
    expect(isValidDate('01-Oct-2026')).toBe(false);
    expect(isValidDate('2026-1-1')).toBe(false);
    expect(isValidDate('')).toBe(false);
    expect(isValidDate(null)).toBe(false);
    expect(isValidDate(20261001)).toBe(false);
  });
});

describe('isValidTime', () => {
  it('accepts 24-hour times', () => {
    expect(isValidTime('07:20')).toBe(true);
    expect(isValidTime('00:00')).toBe(true);
    expect(isValidTime('23:59')).toBe(true);
  });

  it('rejects out-of-range and malformed times', () => {
    expect(isValidTime('24:00')).toBe(false);
    expect(isValidTime('07:60')).toBe(false);
    expect(isValidTime('7:20')).toBe(false);
    expect(isValidTime('07:20:00')).toBe(false);
  });
});

describe('formatting', () => {
  it('renders dates the way the printed pass does', () => {
    expect(formatDate('2026-10-01')).toBe('01-Oct-2026');
    expect(formatDate('2026-10-31')).toBe('31-Oct-2026');
  });

  it('falls back rather than throwing on bad input', () => {
    expect(formatDate('nonsense')).toBe('--');
    expect(formatTime('nonsense')).toBe('--');
    expect(formatMonth('')).toBe('--');
  });

  it('renders months and 12-hour times', () => {
    expect(formatMonth('2026-10-01')).toBe('October 2026');
    expect(formatTime('07:20')).toBe('07:20 AM');
    expect(formatTime('17:45')).toBe('05:45 PM');
    expect(formatTime('00:30')).toBe('12:30 AM');
    expect(formatTime('12:00')).toBe('12:00 PM');
  });
});

describe('comparison and arithmetic', () => {
  it('orders dates', () => {
    expect(compareDates('2026-10-01', '2026-10-02')).toBeLessThan(0);
    expect(compareDates('2026-10-02', '2026-10-01')).toBeGreaterThan(0);
    expect(compareDates('2026-10-01', '2026-10-01')).toBe(0);
  });

  it('counts days across month and year boundaries', () => {
    expect(daysBetween('2026-10-01', '2026-10-31')).toBe(30);
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
    expect(daysBetween('2026-10-31', '2026-10-01')).toBe(-30);
    expect(daysBetween('2024-02-28', '2024-03-01')).toBe(2); // leap year
  });

  it('finds the first and last day of a month', () => {
    expect(monthBounds('2026-10-15')).toEqual({ start: '2026-10-01', end: '2026-10-31' });
    expect(monthBounds('2026-02-05')).toEqual({ start: '2026-02-01', end: '2026-02-28' });
    expect(monthBounds('2024-02-05')).toEqual({ start: '2024-02-01', end: '2024-02-29' });
  });

  it('measures a shift, wrapping past midnight', () => {
    expect(minutesBetween('07:20', '17:45')).toBe(625);
    expect(minutesBetween('22:00', '06:00')).toBe(480);
  });
});

describe('toISODate', () => {
  it('uses local calendar fields, not UTC', () => {
    // 1 Jan at 00:30 local must stay 1 Jan even where UTC is still 31 Dec.
    const date = new Date(2026, 0, 1, 0, 30);
    expect(toISODate(date)).toBe('2026-01-01');
  });
});
