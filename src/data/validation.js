/**
 * Field validation for passes and the profile.
 *
 * Returns a plain `{ field: message }` map. The same functions run before
 * every write in the repository, so a value that fails here cannot reach
 * storage even if a caller skips the form.
 */
import { isValidDate, isValidTime, compareDates, daysBetween } from '../core/dates.js';
import { STATUSES } from './schema.js';

export const LIMITS = {
  nameMin: 2,
  nameMax: 60,
  employeeIdMin: 3,
  employeeIdMax: 15,
  stopMax: 80,
  titleMax: 80,
  notesMax: 2000,
  maxPassDays: 400,
  maxStops: 40,
};

const NAME_OK = /^[\p{L}\p{M}][\p{L}\p{M}\s.''-]*$/u;
const EMPLOYEE_ID_OK = /^[A-Za-z0-9-]+$/;
const PLACE_OK = /^[\p{L}\p{M}\p{N}\s.,'()&/-]+$/u;
const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_OK = /^[+]?[\d\s()-]{7,20}$/;

/**
 * @param {object} pass
 * @returns {Record<string,string>} empty when the pass is valid
 */
export function validatePass(pass) {
  const errors = {};
  const value = (key) => String(pass?.[key] ?? '').trim();

  // --- Identity ---
  const name = value('name');
  if (!name) {
    errors.name = 'Enter the pass holder name.';
  } else if (name.length < LIMITS.nameMin) {
    errors.name = `Name must be at least ${LIMITS.nameMin} characters.`;
  } else if (name.length > LIMITS.nameMax) {
    errors.name = `Name must be ${LIMITS.nameMax} characters or fewer.`;
  } else if (!NAME_OK.test(name)) {
    errors.name = 'Use letters, spaces, apostrophes and hyphens only.';
  }

  const employeeId = value('employeeId');
  if (!employeeId) {
    errors.employeeId = 'Enter the employee ID.';
  } else if (employeeId.length < LIMITS.employeeIdMin || employeeId.length > LIMITS.employeeIdMax) {
    errors.employeeId = `Employee ID must be ${LIMITS.employeeIdMin}-${LIMITS.employeeIdMax} characters.`;
  } else if (!EMPLOYEE_ID_OK.test(employeeId)) {
    errors.employeeId = 'Use letters, numbers and hyphens only.';
  }

  const title = value('title');
  if (title.length > LIMITS.titleMax) {
    errors.title = `Pass name must be ${LIMITS.titleMax} characters or fewer.`;
  }

  // --- Route ---
  const busStop = value('busStop');
  if (!busStop) {
    errors.busStop = 'Enter the boarding stop.';
  } else if (!PLACE_OK.test(busStop)) {
    errors.busStop = 'This stop name contains characters that are not allowed.';
  }

  const destination = value('destination');
  if (!destination) {
    errors.destination = 'Enter the destination.';
  } else if (!PLACE_OK.test(destination)) {
    errors.destination = 'This destination contains characters that are not allowed.';
  }

  if (busStop && destination && busStop.toLowerCase() === destination.toLowerCase()) {
    errors.destination = 'Destination must be different from the boarding stop.';
  }

  if (!value('routeType')) errors.routeType = 'Choose a route type.';

  const stops = Array.isArray(pass?.stops) ? pass.stops : [];
  if (stops.length > LIMITS.maxStops) {
    errors.stops = `Add at most ${LIMITS.maxStops} stops.`;
  } else if (stops.some((stop) => String(stop).trim().length > LIMITS.stopMax)) {
    errors.stops = `Each stop must be ${LIMITS.stopMax} characters or fewer.`;
  } else {
    const seen = new Set();
    for (const stop of stops) {
      const key = String(stop).trim().toLowerCase();
      if (!key) continue;
      if (seen.has(key)) {
        errors.stops = 'Remove the duplicate stop.';
        break;
      }
      seen.add(key);
    }
  }

  // --- Validity window ---
  const startDate = value('startDate');
  const endDate = value('endDate');

  if (!startDate) {
    errors.startDate = 'Choose a start date.';
  } else if (!isValidDate(startDate)) {
    errors.startDate = 'Enter a real date.';
  }

  if (!endDate) {
    errors.endDate = 'Choose an end date.';
  } else if (!isValidDate(endDate)) {
    errors.endDate = 'Enter a real date.';
  }

  if (isValidDate(startDate) && isValidDate(endDate)) {
    if (compareDates(endDate, startDate) < 0) {
      errors.endDate = 'The end date cannot be before the start date.';
    } else if (daysBetween(startDate, endDate) > LIMITS.maxPassDays) {
      errors.endDate = `A pass cannot run longer than ${LIMITS.maxPassDays} days.`;
    }
  }

  // --- Timings ---
  const inTime = value('inTime');
  const outTime = value('outTime');

  if (!inTime) {
    errors.inTime = 'Enter the office in time.';
  } else if (!isValidTime(inTime)) {
    errors.inTime = 'Use a 24-hour time such as 07:20.';
  }

  if (!outTime) {
    errors.outTime = 'Enter the office out time.';
  } else if (!isValidTime(outTime)) {
    errors.outTime = 'Use a 24-hour time such as 17:45.';
  }

  if (isValidTime(inTime) && isValidTime(outTime) && inTime === outTime) {
    errors.outTime = 'The out time must be different from the in time.';
  }

  // --- Misc ---
  if (!STATUSES.includes(pass?.status)) errors.status = 'Choose a status.';
  if (value('notes').length > LIMITS.notesMax) {
    errors.notes = `Notes must be ${LIMITS.notesMax} characters or fewer.`;
  }

  return errors;
}

/**
 * Non-blocking advice. Shown next to the field but never stops a save -
 * an overnight shift is unusual, not wrong.
 */
export function passWarnings(pass) {
  const warnings = {};
  const { inTime, outTime } = pass || {};
  if (isValidTime(inTime) && isValidTime(outTime) && outTime < inTime) {
    warnings.outTime = 'This out time is earlier in the day than the in time, so it is treated as an overnight shift.';
  }
  return warnings;
}

export function validateProfile(profile) {
  const errors = {};
  const value = (key) => String(profile?.[key] ?? '').trim();

  const name = value('name');
  if (name && (name.length < LIMITS.nameMin || name.length > LIMITS.nameMax)) {
    errors.name = `Name must be ${LIMITS.nameMin}-${LIMITS.nameMax} characters.`;
  }

  const employeeId = value('employeeId');
  if (employeeId && !EMPLOYEE_ID_OK.test(employeeId)) {
    errors.employeeId = 'Use letters, numbers and hyphens only.';
  }

  const email = value('email');
  if (email && !EMAIL_OK.test(email)) errors.email = 'Enter a valid email address.';

  const phone = value('phone');
  if (phone && !PHONE_OK.test(phone)) errors.phone = 'Enter a valid phone number.';

  return errors;
}

export const hasErrors = (errors) => Object.keys(errors).length > 0;
