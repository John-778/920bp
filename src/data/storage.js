/**
 * Key/value persistence.
 *
 * Backed by @capacitor/preferences, which maps to SharedPreferences on
 * Android and UserDefaults on iOS, and to localStorage in the browser.
 * That gives the web build and both native builds one storage contract,
 * and on device the data survives a WebView cache clear.
 *
 * The backend is swappable so the tests can run against a plain object.
 */
import { Preferences } from '@capacitor/preferences';

const NAMESPACE = 'dbp';

/** @type {{get(k:string):Promise<string|null>, set(k:string,v:string):Promise<void>, remove(k:string):Promise<void>, keys():Promise<string[]>}} */
let backend = {
  async get(key) {
    const { value } = await Preferences.get({ key });
    return value ?? null;
  },
  async set(key, value) {
    await Preferences.set({ key, value });
  },
  async remove(key) {
    await Preferences.remove({ key });
  },
  async keys() {
    const { keys } = await Preferences.keys();
    return keys;
  },
};

/** Replace the backend (tests). */
export function setBackend(next) {
  backend = next;
}

const fullKey = (key) => `${NAMESPACE}:${key}`;

/**
 * Read and JSON-parse a value.
 * Corrupt JSON resolves to the fallback rather than throwing, so one bad
 * record can never leave the app stuck on a blank screen.
 */
export async function readJSON(key, fallback = null) {
  try {
    const raw = await backend.get(fullKey(key));
    if (raw === null || raw === undefined) return fallback;
    return JSON.parse(raw);
  } catch (error) {
    console.error(`[storage] could not read "${key}"`, error);
    return fallback;
  }
}

/**
 * JSON-serialise and store a value.
 * @throws when the device refuses the write (quota, private mode).
 */
export async function writeJSON(key, value) {
  try {
    await backend.set(fullKey(key), JSON.stringify(value));
  } catch (error) {
    console.error(`[storage] could not write "${key}"`, error);
    throw new Error(
      'Could not save to this device. Storage may be full or blocked by private browsing.'
    );
  }
}

export async function removeKey(key) {
  try {
    await backend.remove(fullKey(key));
  } catch (error) {
    console.error(`[storage] could not remove "${key}"`, error);
  }
}

/** Probe whether persistence actually works on this device. */
export async function isAvailable() {
  const probe = '__probe__';
  try {
    await backend.set(fullKey(probe), '1');
    await backend.remove(fullKey(probe));
    return true;
  } catch {
    return false;
  }
}

export const KEYS = {
  passes: 'passes',
  profile: 'profile',
  settings: 'settings',
  schema: 'schemaVersion',
};
