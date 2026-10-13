/**
 * The pass data model, its defaults, and the seed record.
 *
 * The seed reproduces exactly the pass that was hard-coded into the
 * original index.html, so an existing user opens the new build and finds
 * their own pass already there rather than an empty app.
 */
import { today, compareDates, monthBounds } from '../core/dates.js';

export const SCHEMA_VERSION = 1;

export const STATUSES = /** @type {const} */ (['confirmed', 'pending', 'rejected']);

export const STATUS_LABELS = {
  confirmed: 'Confirmed Pass',
  pending: 'Pending Approval',
  rejected: 'Not Approved',
  expired: 'Expired Pass',
};

export const ROUTE_TYPES = ['A', 'B', 'C', 'D', 'E', 'F'];

/** Service patterns seen on the printed pass. */
export const SERVICE_TYPES = ['FAST', 'SLOW', 'DIRECT', 'SHUTTLE'];

let idCounter = 0;

/** Collision-resistant id that does not need crypto to be present. */
export function newId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  idCounter += 1;
  return `p_${Date.now().toString(36)}_${idCounter}_${Math.random().toString(36).slice(2, 8)}`;
}

/** A blank pass, ready for the create form. */
export function emptyPass(profile = {}) {
  const bounds = monthBounds(today());
  return {
    id: newId(),
    title: '',
    name: profile.name || '',
    employeeId: profile.employeeId || '',
    busStop: profile.defaultBusStop || '',
    destination: profile.defaultDestination || '',
    routeType: 'B',
    serviceType: 'FAST',
    returnTrip: true,
    stops: [],
    startDate: bounds.start,
    endDate: bounds.end,
    inTime: '07:20',
    outTime: '17:45',
    status: 'pending',
    notes: '',
    qrImage: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Coerce whatever came out of storage into a complete, correctly typed
 * pass. Guards against hand-edited exports and records written by an
 * older build.
 */
export function normalizePass(input = {}) {
  const base = {
    id: typeof input.id === 'string' && input.id ? input.id : newId(),
    title: str(input.title),
    name: str(input.name),
    employeeId: str(input.employeeId),
    busStop: str(input.busStop),
    destination: str(input.destination),
    routeType: str(input.routeType) || 'B',
    serviceType: str(input.serviceType) || 'FAST',
    returnTrip: input.returnTrip !== false,
    stops: Array.isArray(input.stops)
      ? input.stops.map((s) => str(s)).filter(Boolean).slice(0, 40)
      : [],
    startDate: str(input.startDate),
    endDate: str(input.endDate),
    inTime: str(input.inTime),
    outTime: str(input.outTime),
    status: STATUSES.includes(input.status) ? input.status : 'pending',
    notes: str(input.notes, 2000),
    qrImage: typeof input.qrImage === 'string' && input.qrImage ? input.qrImage : null,
    createdAt: str(input.createdAt) || new Date().toISOString(),
    updatedAt: str(input.updatedAt) || new Date().toISOString(),
  };
  if (!base.title) base.title = defaultTitle(base);
  return base;
}

function str(value, max = 200) {
  if (value === null || value === undefined) return '';
  return String(value).trim().slice(0, max);
}

/** 'Oct 2026 - Thane Stn. E Kopari' style fallback name for a pass. */
export function defaultTitle(pass) {
  const month = pass.startDate ? pass.startDate.slice(0, 7) : '';
  const where = pass.busStop || 'Bus pass';
  return month ? `${where} (${month})` : where;
}

/**
 * The status to show, which is not always the stored one: a confirmed
 * pass whose end date has gone by reads as expired.
 */
export function effectiveStatus(pass, now = today()) {
  if (pass.status === 'confirmed' && pass.endDate && compareDates(pass.endDate, now) < 0) {
    return 'expired';
  }
  return pass.status;
}

export function isCurrentlyValid(pass, now = today()) {
  return (
    pass.status === 'confirmed' &&
    !!pass.startDate &&
    !!pass.endDate &&
    compareDates(pass.startDate, now) <= 0 &&
    compareDates(pass.endDate, now) >= 0
  );
}

/** The one-line route description shown on the pass. */
export function routeLine(pass) {
  const from = pass.busStop || '--';
  const to = pass.destination || '--';
  const head = `${from} To ${to}`;
  const tail = pass.returnTrip ? ' And Return' : '';
  const via = pass.serviceType ? ` Via-${pass.serviceType}` : '';
  return `${head}${tail}${via}`;
}

export function emptyProfile() {
  return {
    name: '',
    employeeId: '',
    defaultBusStop: '',
    defaultDestination: '',
    email: '',
    phone: '',
  };
}

export function defaultSettings() {
  return {
    activePassId: null,
    defaultView: 'qr', // 'qr' | 'details'
    confirmBeforeDelete: true,
  };
}

/**
 * The pass that was hard-coded in the original page. Written once, on the
 * very first run, and never again.
 */
export function seedData() {
  const now = new Date().toISOString();
  const pass = normalizePass({
    id: newId(),
    title: 'Thane Stn. E Kopari (2026-10)',
    name: 'JOHN DOE',
    employeeId: '1000001',
    busStop: 'Thane Stn. E Kopari',
    destination: 'TCS Olympus',
    routeType: 'B',
    serviceType: 'FAST',
    returnTrip: true,
    stops: [],
    startDate: '2026-10-01',
    endDate: '2026-10-31',
    inTime: '07:20',
    outTime: '17:45',
    status: 'confirmed',
    notes: '',
    createdAt: now,
    updatedAt: now,
  });

  return {
    passes: [pass],
    profile: {
      ...emptyProfile(),
      name: pass.name,
      employeeId: pass.employeeId,
      defaultBusStop: pass.busStop,
      defaultDestination: pass.destination,
    },
    settings: { ...defaultSettings(), activePassId: pass.id },
  };
}
