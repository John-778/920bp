import { describe, it, expect } from 'vitest';
import { validatePass, validateProfile, passWarnings, hasErrors, LIMITS } from '../src/data/validation.js';
import { normalizePass } from '../src/data/schema.js';

/** The pass the original page shipped with - the baseline that must stay valid. */
const basePass = () =>
  normalizePass({
    name: 'JOHN DOE',
    employeeId: '1000001',
    busStop: 'Thane Stn. E Kopari',
    destination: 'TCS Olympus',
    routeType: 'B',
    serviceType: 'FAST',
    returnTrip: true,
    startDate: '2026-10-01',
    endDate: '2026-10-31',
    inTime: '07:20',
    outTime: '17:45',
    status: 'confirmed',
  });

describe('validatePass', () => {
  it('accepts the original pass unchanged', () => {
    expect(validatePass(basePass())).toEqual({});
  });

  it('requires the identity fields', () => {
    const errors = validatePass({ ...basePass(), name: '', employeeId: '' });
    expect(errors.name).toBeTruthy();
    expect(errors.employeeId).toBeTruthy();
  });

  it('rejects a name made of symbols', () => {
    expect(validatePass({ ...basePass(), name: '<<<>>>' }).name).toBeTruthy();
  });

  it('accepts names with accents, apostrophes and hyphens', () => {
    for (const name of ["O'Brien", 'Jean-Luc', 'José Álvarez', 'Ananya Iyer']) {
      expect(validatePass({ ...basePass(), name })).toEqual({});
    }
  });

  it('bounds the employee ID', () => {
    expect(validatePass({ ...basePass(), employeeId: 'ab' }).employeeId).toBeTruthy();
    expect(validatePass({ ...basePass(), employeeId: '1'.repeat(16) }).employeeId).toBeTruthy();
    expect(validatePass({ ...basePass(), employeeId: 'EMP-1000001' })).toEqual({});
  });

  it('requires both ends of the route and refuses a round trip to nowhere', () => {
    expect(validatePass({ ...basePass(), busStop: '' }).busStop).toBeTruthy();
    expect(validatePass({ ...basePass(), destination: '' }).destination).toBeTruthy();
    expect(
      validatePass({ ...basePass(), busStop: 'TCS Olympus', destination: 'tcs olympus' }).destination
    ).toBeTruthy();
  });

  it('rejects an end date before the start date', () => {
    const errors = validatePass({ ...basePass(), startDate: '2026-10-31', endDate: '2026-10-01' });
    expect(errors.endDate).toBeTruthy();
  });

  it('allows a single-day pass', () => {
    expect(validatePass({ ...basePass(), startDate: '2026-10-05', endDate: '2026-10-05' })).toEqual({});
  });

  it('rejects an absurdly long validity window', () => {
    const errors = validatePass({ ...basePass(), startDate: '2026-01-01', endDate: '2029-01-01' });
    expect(errors.endDate).toBeTruthy();
  });

  it('rejects impossible calendar dates', () => {
    expect(validatePass({ ...basePass(), startDate: '2026-02-30' }).startDate).toBeTruthy();
  });

  it('requires well-formed timings that differ from each other', () => {
    expect(validatePass({ ...basePass(), inTime: '7:20' }).inTime).toBeTruthy();
    expect(validatePass({ ...basePass(), outTime: '' }).outTime).toBeTruthy();
    expect(validatePass({ ...basePass(), inTime: '09:00', outTime: '09:00' }).outTime).toBeTruthy();
  });

  it('allows an overnight shift but flags it as a warning, not an error', () => {
    const pass = { ...basePass(), inTime: '22:00', outTime: '06:00' };
    expect(validatePass(pass)).toEqual({});
    expect(passWarnings(pass).outTime).toBeTruthy();
  });

  it('rejects duplicate and oversized stops', () => {
    expect(validatePass({ ...basePass(), stops: ['Kopari', 'Kopari'] }).stops).toBeTruthy();
    expect(validatePass({ ...basePass(), stops: ['x'.repeat(200)] }).stops).toBeTruthy();
    expect(validatePass({ ...basePass(), stops: ['Kopari', 'Vikhroli'] })).toEqual({});
  });

  it('caps the number of stops', () => {
    const stops = Array.from({ length: LIMITS.maxStops + 1 }, (_, i) => `Stop ${i}`);
    expect(validatePass({ ...basePass(), stops }).stops).toBeTruthy();
  });

  it('rejects an unknown status', () => {
    expect(validatePass({ ...basePass(), status: 'whatever' }).status).toBeTruthy();
  });
});

describe('validateProfile', () => {
  it('treats every field as optional', () => {
    expect(validateProfile({})).toEqual({});
  });

  it('checks the format of what is filled in', () => {
    expect(validateProfile({ email: 'not-an-email' }).email).toBeTruthy();
    expect(validateProfile({ email: 'vidul@example.com' })).toEqual({});
    expect(validateProfile({ phone: 'abc' }).phone).toBeTruthy();
    expect(validateProfile({ phone: '+91 98765 43210' })).toEqual({});
  });
});

describe('hasErrors', () => {
  it('distinguishes an empty error map from a populated one', () => {
    expect(hasErrors({})).toBe(false);
    expect(hasErrors({ name: 'required' })).toBe(true);
  });
});
