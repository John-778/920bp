import { describe, it, expect, beforeEach } from 'vitest';
import { setBackend } from '../src/data/storage.js';
import * as repo from '../src/data/repository.js';

/** In-memory stand-in for Capacitor Preferences. */
function memoryBackend(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    map,
    async get(key) {
      return map.has(key) ? map.get(key) : null;
    },
    async set(key, value) {
      map.set(key, value);
    },
    async remove(key) {
      map.delete(key);
    },
    async keys() {
      return Array.from(map.keys());
    },
  };
}

let backend;

beforeEach(async () => {
  backend = memoryBackend();
  setBackend(backend);
  repo.__resetStateForTests();
  await repo.init();
});

describe('first run', () => {
  it('seeds the pass that was hard-coded in the original page', () => {
    const passes = repo.getPasses();
    expect(passes).toHaveLength(1);
    expect(passes[0]).toMatchObject({
      name: 'JOHN DOE',
      employeeId: '1000001',
      busStop: 'Thane Stn. E Kopari',
      destination: 'TCS Olympus',
      routeType: 'B',
      startDate: '2026-10-01',
      endDate: '2026-10-31',
      inTime: '07:20',
      outTime: '17:45',
      status: 'confirmed',
    });
  });

  it('makes the seeded pass the active one', () => {
    expect(repo.getActivePass().id).toBe(repo.getPasses()[0].id);
  });

  it('writes the seed to storage so it survives a reload', async () => {
    repo.__resetStateForTests();
    await repo.init();
    expect(repo.getPasses()).toHaveLength(1);
  });

  it('does not re-seed over data the user already has', async () => {
    await repo.deletePass(repo.getPasses()[0].id);
    repo.__resetStateForTests();
    await repo.init();
    expect(repo.getPasses()).toHaveLength(0);
  });
});

describe('createPass', () => {
  it('stores a valid pass and persists it', async () => {
    const created = await repo.createPass({
      name: 'ASHA RAO',
      employeeId: '1234567',
      busStop: 'Mulund West',
      destination: 'TCS Yantra Park',
      routeType: 'A',
      startDate: '2026-11-01',
      endDate: '2026-11-30',
      inTime: '08:00',
      outTime: '18:00',
      status: 'pending',
    });

    expect(created.id).toBeTruthy();
    expect(repo.getPasses()).toHaveLength(2);

    repo.__resetStateForTests();
    await repo.init();
    expect(repo.getPasses()).toHaveLength(2);
  });

  it('rejects an invalid pass without writing anything', async () => {
    await expect(repo.createPass({ name: '' })).rejects.toMatchObject({ name: 'ValidationError' });
    expect(repo.getPasses()).toHaveLength(1);
  });

  it('gives a pass a default title when none is supplied', async () => {
    const created = await repo.createPass({
      name: 'ASHA RAO',
      employeeId: '1234567',
      busStop: 'Mulund West',
      destination: 'TCS Yantra Park',
      routeType: 'A',
      startDate: '2026-11-01',
      endDate: '2026-11-30',
      inTime: '08:00',
      outTime: '18:00',
      status: 'pending',
    });
    expect(created.title).toBe('Mulund West (2026-11)');
  });
});

describe('updatePass', () => {
  it('changes one field and leaves the rest alone', async () => {
    const before = repo.getPasses()[0];
    const after = await repo.updatePass(before.id, { busStop: 'Thane Stn. W' });

    expect(after.busStop).toBe('Thane Stn. W');
    expect(after.name).toBe(before.name);
    expect(after.employeeId).toBe(before.employeeId);
    expect(after.startDate).toBe(before.startDate);
    expect(after.inTime).toBe(before.inTime);
  });

  it('keeps the id and creation time, and moves the update time forward', async () => {
    const before = repo.getPasses()[0];
    await new Promise((resolve) => setTimeout(resolve, 5));
    const after = await repo.updatePass(before.id, { notes: 'renewed' });

    expect(after.id).toBe(before.id);
    expect(after.createdAt).toBe(before.createdAt);
    expect(new Date(after.updatedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(before.updatedAt).getTime()
    );
  });

  it('refuses an edit that would make the record invalid, leaving it untouched', async () => {
    const before = repo.getPasses()[0];
    await expect(repo.updatePass(before.id, { endDate: '2020-01-01' })).rejects.toMatchObject({
      name: 'ValidationError',
    });
    expect(repo.getPass(before.id).endDate).toBe(before.endDate);
  });

  it('reports a clear error for a pass that is gone', async () => {
    await expect(repo.updatePass('does-not-exist', { notes: 'x' })).rejects.toThrow(
      /no longer exists/i
    );
  });

  it('persists the change across a reload', async () => {
    const id = repo.getPasses()[0].id;
    await repo.updatePass(id, { busStop: 'Ghatkopar' });
    repo.__resetStateForTests();
    await repo.init();
    expect(repo.getPass(id).busStop).toBe('Ghatkopar');
  });
});

describe('deletePass', () => {
  it('removes the pass and hands the active slot to another one', async () => {
    const first = repo.getPasses()[0];
    const second = await repo.createPass({
      name: 'ASHA RAO',
      employeeId: '1234567',
      busStop: 'Mulund West',
      destination: 'TCS Yantra Park',
      routeType: 'A',
      startDate: '2026-11-01',
      endDate: '2026-11-30',
      inTime: '08:00',
      outTime: '18:00',
      status: 'confirmed',
    });

    await repo.setActivePass(first.id);
    await repo.deletePass(first.id);

    expect(repo.getPasses()).toHaveLength(1);
    expect(repo.getActivePass().id).toBe(second.id);
  });

  it('leaves no active pass when the last one goes', async () => {
    await repo.deletePass(repo.getPasses()[0].id);
    expect(repo.getActivePass()).toBeNull();
    expect(repo.getSettings().activePassId).toBeNull();
  });
});

describe('change notifications', () => {
  it('fires once per write so every screen can refresh', async () => {
    const seen = [];
    const off = repo.onChange((event) => seen.push(event.reason));

    const id = repo.getPasses()[0].id;
    await repo.updatePass(id, { notes: 'a' });
    await repo.deletePass(id);
    off();
    await repo.createPass({
      name: 'ASHA RAO',
      employeeId: '1234567',
      busStop: 'Mulund West',
      destination: 'TCS Yantra Park',
      routeType: 'A',
      startDate: '2026-11-01',
      endDate: '2026-11-30',
      inTime: '08:00',
      outTime: '18:00',
      status: 'pending',
    });

    expect(seen).toEqual(['update', 'delete']);
  });
});

describe('backup', () => {
  it('round-trips through export and import', async () => {
    const exported = repo.exportData();
    await repo.resetAll();
    await repo.importData(exported, { merge: false });

    expect(repo.getPasses()).toHaveLength(exported.passes.length);
    expect(repo.getPasses()[0].employeeId).toBe('1000001');
  });

  it('merges without losing what is already stored', async () => {
    const exported = repo.exportData();
    await repo.createPass({
      name: 'ASHA RAO',
      employeeId: '1234567',
      busStop: 'Mulund West',
      destination: 'TCS Yantra Park',
      routeType: 'A',
      startDate: '2026-11-01',
      endDate: '2026-11-30',
      inTime: '08:00',
      outTime: '18:00',
      status: 'pending',
    });

    const result = await repo.importData(exported, { merge: true });
    expect(result.imported).toBe(1);
    expect(repo.getPasses()).toHaveLength(2);
  });

  it('rejects a file that is not a backup', async () => {
    await expect(repo.importData({ hello: 'world' })).rejects.toThrow(/not a bus pass backup/i);
    await expect(repo.importData(null)).rejects.toThrow();
  });

  it('skips unreadable records rather than failing the whole restore', async () => {
    const payload = {
      passes: [
        { ...repo.getPasses()[0], id: 'good-1' },
        { id: 'bad-1', name: '', employeeId: '' },
      ],
    };
    const result = await repo.importData(payload, { merge: false });
    expect(result.imported).toBe(1);
    expect(result.skipped).toBe(1);
  });
});

describe('corrupt storage', () => {
  it('starts with an empty list rather than crashing', async () => {
    backend.map.set('dbp:passes', '{ this is not json');
    backend.map.set('dbp:schemaVersion', '1');
    repo.__resetStateForTests();
    await repo.init();
    expect(repo.getPasses()).toEqual([]);
  });
});

describe('ordering', () => {
  it('lists the most recent validity window first', async () => {
    await repo.createPass({
      name: 'ASHA RAO',
      employeeId: '1234567',
      busStop: 'Mulund West',
      destination: 'TCS Yantra Park',
      routeType: 'A',
      startDate: '2027-01-01',
      endDate: '2027-01-31',
      inTime: '08:00',
      outTime: '18:00',
      status: 'pending',
    });
    const [first, second] = repo.getPasses();
    expect(first.startDate).toBe('2027-01-01');
    expect(second.startDate).toBe('2026-10-01');
  });
});
