import { describe, it, expect } from 'vitest';
import {
  normalizePass,
  effectiveStatus,
  isCurrentlyValid,
  routeLine,
  defaultTitle,
  newId,
} from '../src/data/schema.js';
import { computeAlerts, alertBadgeCount } from '../src/data/alerts.js';

describe('normalizePass', () => {
  it('fills in every field from an empty object', () => {
    const pass = normalizePass({});
    expect(pass.id).toBeTruthy();
    expect(pass.stops).toEqual([]);
    expect(pass.status).toBe('pending');
    expect(pass.returnTrip).toBe(true);
    expect(typeof pass.createdAt).toBe('string');
  });

  it('trims strings and drops empty stops', () => {
    const pass = normalizePass({ name: '  ASHA  ', stops: ['  Kopari ', '', '   '] });
    expect(pass.name).toBe('ASHA');
    expect(pass.stops).toEqual(['Kopari']);
  });

  it('falls back to a known status when handed nonsense', () => {
    expect(normalizePass({ status: 'approved-ish' }).status).toBe('pending');
  });

  it('coerces non-string values rather than throwing', () => {
    const pass = normalizePass({ name: 12345, employeeId: 678, stops: 'not-an-array' });
    expect(pass.name).toBe('12345');
    expect(pass.employeeId).toBe('678');
    expect(pass.stops).toEqual([]);
  });

  it('preserves an id it is given', () => {
    expect(normalizePass({ id: 'keep-me' }).id).toBe('keep-me');
  });
});

describe('newId', () => {
  it('does not collide across many calls', () => {
    const ids = new Set(Array.from({ length: 2000 }, () => newId()));
    expect(ids.size).toBe(2000);
  });
});

describe('effectiveStatus', () => {
  const pass = (overrides) =>
    normalizePass({ startDate: '2026-10-01', endDate: '2026-10-31', ...overrides });

  it('reports a confirmed pass past its end date as expired', () => {
    expect(effectiveStatus(pass({ status: 'confirmed' }), '2026-11-01')).toBe('expired');
  });

  it('leaves a confirmed pass inside its window alone', () => {
    expect(effectiveStatus(pass({ status: 'confirmed' }), '2026-10-15')).toBe('confirmed');
  });

  it('counts the end date itself as still valid', () => {
    expect(effectiveStatus(pass({ status: 'confirmed' }), '2026-10-31')).toBe('confirmed');
  });

  it('does not expire a pending pass', () => {
    expect(effectiveStatus(pass({ status: 'pending' }), '2027-01-01')).toBe('pending');
  });
});

describe('isCurrentlyValid', () => {
  const pass = normalizePass({
    status: 'confirmed',
    startDate: '2026-10-01',
    endDate: '2026-10-31',
  });

  it('is true on the boundary days and inside the window', () => {
    expect(isCurrentlyValid(pass, '2026-10-01')).toBe(true);
    expect(isCurrentlyValid(pass, '2026-10-31')).toBe(true);
    expect(isCurrentlyValid(pass, '2026-10-15')).toBe(true);
  });

  it('is false outside the window', () => {
    expect(isCurrentlyValid(pass, '2026-09-30')).toBe(false);
    expect(isCurrentlyValid(pass, '2026-11-01')).toBe(false);
  });
});

describe('routeLine', () => {
  it('reproduces the line the original page printed', () => {
    const pass = normalizePass({
      busStop: 'Thane Stn. E Kopari',
      destination: 'TCS Olympus',
      serviceType: 'FAST',
      returnTrip: true,
    });
    expect(routeLine(pass)).toBe('Thane Stn. E Kopari To TCS Olympus And Return Via-FAST');
  });

  it('drops the return wording for a one-way pass', () => {
    const pass = normalizePass({
      busStop: 'A',
      destination: 'B',
      serviceType: 'SLOW',
      returnTrip: false,
    });
    expect(routeLine(pass)).toBe('A To B Via-SLOW');
  });
});

describe('defaultTitle', () => {
  it('names a pass after its stop and month', () => {
    expect(defaultTitle({ busStop: 'Mulund West', startDate: '2026-11-01' })).toBe(
      'Mulund West (2026-11)'
    );
  });
});

describe('computeAlerts', () => {
  const make = (overrides) =>
    normalizePass({
      title: 'Test pass',
      startDate: '2026-10-01',
      endDate: '2026-10-31',
      status: 'confirmed',
      ...overrides,
    });

  it('is silent when a pass is comfortably valid', () => {
    expect(computeAlerts([make({})], '2026-10-01')).toEqual([]);
  });

  it('warns in the last week', () => {
    const alerts = computeAlerts([make({})], '2026-10-28');
    expect(alerts).toHaveLength(1);
    expect(alerts[0].level).toBe('warn');
  });

  it('reports an expired pass as needing action', () => {
    const alerts = computeAlerts([make({})], '2026-11-05');
    expect(alerts[0].level).toBe('error');
    expect(alerts[0].title).toMatch(/expired/i);
  });

  it('mentions a pending pass without counting it on the badge', () => {
    const alerts = computeAlerts([make({ status: 'pending' })], '2026-10-10');
    expect(alerts[0].level).toBe('info');
    expect(alertBadgeCount(alerts)).toBe(0);
  });

  it('counts errors and warnings on the badge', () => {
    const alerts = computeAlerts(
      [make({ title: 'A' }), make({ title: 'B', status: 'rejected' })],
      '2026-11-05'
    );
    expect(alertBadgeCount(alerts)).toBe(2);
  });

  it('does not warn about a pass that has not started yet', () => {
    const alerts = computeAlerts([make({ startDate: '2026-12-01', endDate: '2026-12-05' })], '2026-10-01');
    expect(alerts).toEqual([]);
  });
});
