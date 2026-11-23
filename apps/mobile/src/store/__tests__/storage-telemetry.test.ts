import { STORAGE_TELEMETRY_PAYLOADS, STORAGE_WRITE_TRIES_MAX, type StorageTelemetryName } from '@hangul-route/content-schema/storage-telemetry';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * [DP] AMENDMENTS-DURABLE-PROGRESS section 3.9 (row DP-3): the storage events the learner app sends. Codes only, never a
 * profile id; every payload parses against the Worker's strict schema; and none floods: a profile record's failure is
 * sent once per record, cause and `kept` in a launch, a fresh start once per learner, and `write_failed` once per run.
 */
type Sent = { name: string; profileId?: string; payload?: Record<string, unknown> };
const sent = vi.hoisted(() => [] as Sent[]);
vi.mock('../../platform/telemetry', () => ({
  track: vi.fn(async (event: Sent) => {
    sent.push(event);
    return true;
  }),
}));

import { notifyProfileRemoved } from '../profile-removal';
import { PROFILES_KEY, PROFILE_TOMBSTONES_KEY } from '../profile-store';
import {
  PROFILE_RECORD_OF_KEY,
  SAVE_TRIES_MAX,
  resetStorageTelemetryForTests,
  trackProfileRecordReadFailed,
  trackProgressReadFailed,
  trackProgressStartedFresh,
  trackSaveFailed,
  trackSaveLanded,
  trackSaveTried,
} from '../storage-telemetry';

beforeEach(() => {
  sent.length = 0;
  resetStorageTelemetryForTests();
});

/** Every event sent so far parses against its strict schema and carries no profile id. */
function expectCodesOnly(): void {
  for (const event of sent) {
    expect(event.profileId, event.name).toBeUndefined();
    expect(Object.keys(event).sort(), event.name).toEqual(['name', 'payload']);
    const schema = STORAGE_TELEMETRY_PAYLOADS[event.name as StorageTelemetryName];
    expect(schema, event.name).toBeDefined();
    expect(schema.safeParse(event.payload).success, JSON.stringify(event)).toBe(true);
  }
}

describe('[DP] storage.read_failed for the profile records (section 3.1)', () => {
  it('names each record by its storage key, and no other key', () => {
    expect(PROFILE_RECORD_OF_KEY).toEqual({ [PROFILES_KEY]: 'profiles', 'profiles:active': 'active', [PROFILE_TOMBSTONES_KEY]: 'tombstones' });
    trackProfileRecordReadFailed(PROFILES_KEY, 'parse', true);
    trackProfileRecordReadFailed('profiles:active', 'read', false);
    trackProfileRecordReadFailed(PROFILE_TOMBSTONES_KEY, 'parse', false);
    // The copy, its mark and any other key are not profile records: nothing is sent.
    trackProfileRecordReadFailed('profiles-corrupt', 'parse', false);
    trackProfileRecordReadFailed('profiles-corrupt:settled', 'read', false);
    trackProfileRecordReadFailed('progress:profile:suni', 'read', false);
    trackProfileRecordReadFailed('constructor', 'read', false);
    expect(sent).toEqual([
      { name: 'storage.read_failed', payload: { record: 'profiles', cause: 'parse', kept: true } },
      { name: 'storage.read_failed', payload: { record: 'active', cause: 'read', kept: false } },
      { name: 'storage.read_failed', payload: { record: 'tombstones', cause: 'parse', kept: false } },
    ]);
    expectCodesOnly();
  });

  it('sends one event per record, cause and kept in a launch, so Try again and every held list write do not flood', () => {
    for (let i = 0; i < 5; i += 1) {
      trackProfileRecordReadFailed(PROFILES_KEY, 'read', false);
      trackProfileRecordReadFailed(PROFILE_TOMBSTONES_KEY, 'read', false);
    }
    trackProfileRecordReadFailed(PROFILES_KEY, 'parse', true);
    trackProfileRecordReadFailed(PROFILES_KEY, 'parse', false);
    trackProfileRecordReadFailed(PROFILES_KEY, 'parse', true);
    expect(sent.map((e) => e.payload)).toEqual([
      { record: 'profiles', cause: 'read', kept: false },
      { record: 'tombstones', cause: 'read', kept: false },
      { record: 'profiles', cause: 'parse', kept: true },
      { record: 'profiles', cause: 'parse', kept: false },
    ]);
  });
});

describe('[DP] storage.read_failed for progress (section 3.2)', () => {
  it('sends the cause and kept as given (the store calls it on the way into loadFailedFor only)', () => {
    trackProgressReadFailed('read', false);
    trackProgressReadFailed('parse', false);
    trackProgressReadFailed('parse', true);
    expect(sent).toEqual([
      { name: 'storage.read_failed', payload: { record: 'progress', cause: 'read', kept: false } },
      { name: 'storage.read_failed', payload: { record: 'progress', cause: 'parse', kept: false } },
      { name: 'storage.read_failed', payload: { record: 'progress', cause: 'parse', kept: true } },
    ]);
    expectCodesOnly();
  });

  it('a fresh start is cause parse with the copy kept, once per learner per launch', () => {
    trackProgressStartedFresh('profile:a');
    trackProgressStartedFresh('profile:a');
    trackProgressStartedFresh('profile:b');
    trackProgressStartedFresh('profile:a');
    expect(sent).toEqual([
      { name: 'storage.read_failed', payload: { record: 'progress', cause: 'parse', kept: true } },
      { name: 'storage.read_failed', payload: { record: 'progress', cause: 'parse', kept: true } },
    ]);
    expectCodesOnly();
    expect(JSON.stringify(sent)).not.toMatch(/profile:/);
  });
});

describe('[DP] storage.write_failed and storage.write_recovered (section 3.7)', () => {
  it('a save that lands on the next write: one failure, then tries 1', () => {
    trackSaveFailed('profile:a');
    trackSaveLanded('profile:a');
    expect(sent).toEqual([
      { name: 'storage.write_failed', payload: { record: 'progress' } },
      { name: 'storage.write_recovered', payload: { record: 'progress', tries: 1 } },
    ]);
    expectCodesOnly();
  });

  it('counts every write that ran after the failure, the landing one included, up to 4 (four or more)', () => {
    expect(SAVE_TRIES_MAX).toBe(STORAGE_WRITE_TRIES_MAX);
    for (const misses of [1, 2, 3, 4, 9]) {
      sent.length = 0;
      trackSaveFailed('profile:a');
      for (let i = 0; i < misses; i += 1) trackSaveTried('profile:a');
      trackSaveLanded('profile:a');
      expect(sent.at(-1), String(misses)).toEqual({ name: 'storage.write_recovered', payload: { record: 'progress', tries: Math.min(misses + 1, 4) } });
      expectCodesOnly();
    }
  });

  it('keeps each learner apart, and a new run starts its count again', () => {
    trackSaveFailed('profile:a');
    trackSaveFailed('profile:b');
    trackSaveTried('profile:a');
    trackSaveTried('profile:a');
    trackSaveLanded('profile:b');
    trackSaveLanded('profile:a');
    trackSaveFailed('profile:a');
    trackSaveLanded('profile:a');
    expect(sent.map((e) => [e.name, e.payload?.tries])).toEqual([
      ['storage.write_failed', undefined],
      ['storage.write_failed', undefined],
      ['storage.write_recovered', 1],
      ['storage.write_recovered', 3],
      ['storage.write_failed', undefined],
      ['storage.write_recovered', 1],
    ]);
  });

  it('a learner removed from this device is forgotten: a restore of the same id starts afresh', () => {
    trackProgressStartedFresh('profile:a');
    trackSaveFailed('profile:a');
    trackSaveTried('profile:a');
    notifyProfileRemoved('profile:a');
    // The failed run went with the learner: a landing after the removal sends nothing.
    trackSaveLanded('profile:a');
    trackProgressStartedFresh('profile:a');
    expect(sent.map((e) => e.name)).toEqual(['storage.read_failed', 'storage.write_failed', 'storage.read_failed']);
  });

  it('a landing or a try with no failure before it sends nothing', () => {
    trackSaveTried('profile:a');
    trackSaveLanded('profile:a');
    trackSaveFailed('profile:b');
    trackSaveLanded('profile:b');
    trackSaveLanded('profile:b');
    expect(sent.map((e) => e.name)).toEqual(['storage.write_failed', 'storage.write_recovered']);
  });
});
