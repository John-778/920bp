/**
 * The single source of truth for pass data.
 *
 * Screens never touch storage directly: they read from here and listen for
 * 'change', which is what makes an edit on one screen show up immediately
 * everywhere the same record is displayed.
 */
import { createEmitter } from '../core/events.js';
import { compareDates } from '../core/dates.js';
import { readJSON, writeJSON, removeKey, KEYS, isAvailable } from './storage.js';
import {
  SCHEMA_VERSION,
  normalizePass,
  emptyProfile,
  defaultSettings,
  seedData,
  effectiveStatus,
  isCurrentlyValid,
  defaultTitle,
} from './schema.js';
import { validatePass, validateProfile, hasErrors } from './validation.js';

/** Thrown when a write is rejected; `fields` maps field name to message. */
export class ValidationError extends Error {
  constructor(fields) {
    super('Please correct the highlighted fields.');
    this.name = 'ValidationError';
    this.fields = fields;
  }
}

const emitter = createEmitter();

const state = {
  ready: false,
  persistent: true,
  /** @type {Array<object>} */
  passes: [],
  profile: emptyProfile(),
  settings: defaultSettings(),
};

export const onChange = (handler) => emitter.on('change', handler);

function announce(reason) {
  emitter.emit('change', { reason, ...snapshot() });
}

function snapshot() {
  return {
    passes: state.passes.map((p) => ({ ...p })),
    profile: { ...state.profile },
    settings: { ...state.settings },
  };
}

/** Newest validity window first; ties broken by last edit. */
function sortPasses(passes) {
  return [...passes].sort((a, b) => {
    const byStart = compareDates(b.startDate || '', a.startDate || '');
    if (byStart !== 0) return byStart;
    return (b.updatedAt || '').localeCompare(a.updatedAt || '');
  });
}

async function persistPasses() {
  await writeJSON(KEYS.passes, state.passes);
}

async function persistSettings() {
  await writeJSON(KEYS.settings, state.settings);
}

/** Load everything, seeding the original pass on a first run. */
export async function init() {
  state.persistent = await isAvailable();

  const version = await readJSON(KEYS.schema, null);
  const storedPasses = await readJSON(KEYS.passes, null);

  if (version === null && storedPasses === null) {
    const seed = seedData();
    state.passes = seed.passes;
    state.profile = seed.profile;
    state.settings = seed.settings;
    if (state.persistent) {
      await writeJSON(KEYS.passes, state.passes);
      await writeJSON(KEYS.profile, state.profile);
      await writeJSON(KEYS.settings, state.settings);
      await writeJSON(KEYS.schema, SCHEMA_VERSION);
    }
  } else {
    state.passes = Array.isArray(storedPasses) ? storedPasses.map(normalizePass) : [];
    state.profile = { ...emptyProfile(), ...(await readJSON(KEYS.profile, {})) };
    state.settings = { ...defaultSettings(), ...(await readJSON(KEYS.settings, {})) };
    if (version !== SCHEMA_VERSION && state.persistent) {
      await writeJSON(KEYS.schema, SCHEMA_VERSION);
    }
  }

  state.passes = sortPasses(state.passes);
  reconcileActive();
  state.ready = true;
  announce('init');
  return snapshot();
}

/** Keep settings.activePassId pointing at a pass that actually exists. */
function reconcileActive() {
  const exists = state.passes.some((p) => p.id === state.settings.activePassId);
  if (exists) return false;
  const preferred =
    state.passes.find((p) => isCurrentlyValid(p)) ||
    state.passes.find((p) => p.status === 'confirmed') ||
    state.passes[0];
  state.settings.activePassId = preferred ? preferred.id : null;
  return true;
}

// --- Reads -----------------------------------------------------------------

export const isReady = () => state.ready;
export const isPersistent = () => state.persistent;
export const getPasses = () => state.passes.map((p) => ({ ...p }));
export const getProfile = () => ({ ...state.profile });
export const getSettings = () => ({ ...state.settings });

export function getPass(id) {
  const found = state.passes.find((p) => p.id === id);
  return found ? { ...found } : null;
}

export function getActivePass() {
  return getPass(state.settings.activePassId);
}

export function countByStatus() {
  const counts = { all: state.passes.length, confirmed: 0, pending: 0, rejected: 0, expired: 0 };
  for (const pass of state.passes) counts[effectiveStatus(pass)] += 1;
  return counts;
}

// --- Writes ----------------------------------------------------------------

/**
 * @param {object} input
 * @returns {Promise<object>} the stored pass
 * @throws {ValidationError}
 */
export async function createPass(input) {
  const candidate = normalizePass({ ...input, createdAt: undefined, updatedAt: undefined });
  if (!candidate.title) candidate.title = defaultTitle(candidate);

  const errors = validatePass(candidate);
  if (hasErrors(errors)) throw new ValidationError(errors);

  const now = new Date().toISOString();
  candidate.createdAt = now;
  candidate.updatedAt = now;

  state.passes = sortPasses([...state.passes, candidate]);
  if (!state.settings.activePassId) state.settings.activePassId = candidate.id;

  await persistPasses();
  await persistSettings();
  announce('create');
  return { ...candidate };
}

/**
 * Merge a patch into one pass.
 * @throws {ValidationError} when the merged result would be invalid
 */
export async function updatePass(id, patch) {
  const index = state.passes.findIndex((p) => p.id === id);
  if (index === -1) throw new Error('That pass no longer exists. It may have been deleted.');

  const existing = state.passes[index];
  const merged = normalizePass({
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
  });
  if (!merged.title) merged.title = defaultTitle(merged);

  const errors = validatePass(merged);
  if (hasErrors(errors)) throw new ValidationError(errors);

  merged.updatedAt = new Date().toISOString();

  const next = [...state.passes];
  next[index] = merged;
  state.passes = sortPasses(next);

  await persistPasses();
  announce('update');
  return { ...merged };
}

export async function deletePass(id) {
  const existing = state.passes.find((p) => p.id === id);
  if (!existing) throw new Error('That pass no longer exists.');

  state.passes = state.passes.filter((p) => p.id !== id);
  const activeChanged = reconcileActive();

  await persistPasses();
  if (activeChanged) await persistSettings();
  announce('delete');
  return { ...existing };
}

export async function setActivePass(id) {
  if (!state.passes.some((p) => p.id === id)) {
    throw new Error('That pass no longer exists.');
  }
  state.settings.activePassId = id;
  await persistSettings();
  announce('active');
  return id;
}

export async function updateSettings(patch) {
  state.settings = { ...state.settings, ...patch };
  await persistSettings();
  announce('settings');
  return getSettings();
}

export async function updateProfile(patch) {
  const merged = { ...state.profile, ...patch };
  const errors = validateProfile(merged);
  if (hasErrors(errors)) throw new ValidationError(errors);

  state.profile = merged;
  await writeJSON(KEYS.profile, state.profile);
  announce('profile');
  return getProfile();
}

// --- Backup ----------------------------------------------------------------

export function exportData() {
  return {
    app: 'digital-bus-pass',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    passes: state.passes,
    profile: state.profile,
    settings: state.settings,
  };
}

/**
 * Restore from an export.
 * @param {object} payload
 * @param {{ merge?: boolean }} options  merge keeps existing passes and adds
 *        the incoming ones; otherwise the incoming set replaces them.
 */
export async function importData(payload, { merge = false } = {}) {
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.passes)) {
    throw new Error('That file is not a bus pass backup.');
  }

  const incoming = payload.passes.map(normalizePass);
  const invalid = incoming.filter((pass) => hasErrors(validatePass(pass)));
  if (invalid.length === incoming.length && incoming.length > 0) {
    throw new Error('None of the passes in that file could be read.');
  }
  const usable = incoming.filter((pass) => !hasErrors(validatePass(pass)));

  if (merge) {
    const byId = new Map(state.passes.map((p) => [p.id, p]));
    for (const pass of usable) byId.set(pass.id, pass);
    state.passes = sortPasses(Array.from(byId.values()));
  } else {
    state.passes = sortPasses(usable);
    if (payload.profile) state.profile = { ...emptyProfile(), ...payload.profile };
    if (payload.settings) state.settings = { ...defaultSettings(), ...payload.settings };
  }

  reconcileActive();
  await persistPasses();
  await writeJSON(KEYS.profile, state.profile);
  await persistSettings();
  announce('import');

  return { imported: usable.length, skipped: incoming.length - usable.length };
}

/** Wipe everything this app stored and re-seed. */
export async function resetAll() {
  await removeKey(KEYS.passes);
  await removeKey(KEYS.profile);
  await removeKey(KEYS.settings);
  await removeKey(KEYS.schema);
  state.ready = false;
  return init();
}

/** Tests only: drop the in-memory cache. */
export function __resetStateForTests() {
  state.ready = false;
  state.passes = [];
  state.profile = emptyProfile();
  state.settings = defaultSettings();
  emitter.clear();
}
