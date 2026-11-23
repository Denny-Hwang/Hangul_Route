import { describe, expect, it } from 'vitest';
import { TELEMETRY_EVENT_NAMES, isServerOnlyTelemetryName, isTelemetryEventName } from '../index';
import {
  STORAGE_READ_CAUSES,
  STORAGE_RECORDS,
  STORAGE_TELEMETRY_NAMES,
  STORAGE_TELEMETRY_PAYLOADS,
  STORAGE_WRITE_RECORDS,
  STORAGE_WRITE_TRIES_MAX,
} from '../schemas/storage-telemetry';

/**
 * [DP] AMENDMENTS-DURABLE-PROGRESS section 3.9 (row DP-3, TELEMETRY-NAMES-2 section W, Worker first): three strict,
 * code-only payloads. Never a profile id, a learner name, a key name, the damaged bytes or an error message.
 */
const NAMES = ['storage.read_failed', 'storage.write_failed', 'storage.write_recovered'] as const;

const VALID: Record<(typeof NAMES)[number], Record<string, unknown>> = {
  'storage.read_failed': { record: 'progress', cause: 'parse', kept: true },
  'storage.write_failed': { record: 'progress' },
  'storage.write_recovered': { record: 'progress', tries: 2 },
};

describe('[DP] storage.* names (section 3.9)', () => {
  it('appends the three names, once each, right after auth.native.* (the list is append-only)', () => {
    expect(STORAGE_TELEMETRY_NAMES).toEqual([...NAMES]);
    const at = TELEMETRY_EVENT_NAMES.indexOf('auth.native.home');
    expect(TELEMETRY_EVENT_NAMES.slice(at, at + 4)).toEqual(['auth.native.home', ...NAMES]);
    for (const name of NAMES) {
      expect(isTelemetryEventName(name), name).toBe(true);
      expect(TELEMETRY_EVENT_NAMES.filter((n) => n === name), name).toHaveLength(1);
      // The learner app sends them: never server-only.
      expect(isServerOnlyTelemetryName(name), name).toBe(false);
    }
    expect(isTelemetryEventName('storage.read_failure')).toBe(false);
    expect(isTelemetryEventName('storage.write_retried')).toBe(false);
  });

  it('documents the codes of each payload', () => {
    expect(STORAGE_RECORDS).toEqual(['progress', 'profiles', 'active', 'tombstones']);
    expect(STORAGE_READ_CAUSES).toEqual(['read', 'parse']);
    expect(STORAGE_WRITE_RECORDS).toEqual(['progress']);
    expect(STORAGE_WRITE_TRIES_MAX).toBe(4);
    expect(Object.keys(STORAGE_TELEMETRY_PAYLOADS['storage.read_failed'].shape)).toEqual(['record', 'cause', 'kept']);
    expect(Object.keys(STORAGE_TELEMETRY_PAYLOADS['storage.write_failed'].shape)).toEqual(['record']);
    expect(Object.keys(STORAGE_TELEMETRY_PAYLOADS['storage.write_recovered'].shape)).toEqual(['record', 'tries']);
  });

  it('every schema takes its example and every listed value', () => {
    for (const name of NAMES) expect(STORAGE_TELEMETRY_PAYLOADS[name].safeParse(VALID[name]).success, name).toBe(true);
    const read = STORAGE_TELEMETRY_PAYLOADS['storage.read_failed'];
    for (const record of STORAGE_RECORDS) {
      for (const cause of STORAGE_READ_CAUSES) {
        for (const kept of [true, false]) expect(read.safeParse({ record, cause, kept }).success, `${record} ${cause} ${kept}`).toBe(true);
      }
    }
    for (let tries = 1; tries <= STORAGE_WRITE_TRIES_MAX; tries += 1) {
      expect(STORAGE_TELEMETRY_PAYLOADS['storage.write_recovered'].safeParse({ record: 'progress', tries }).success, String(tries)).toBe(true);
    }
  });

  it('refuses a profile id, a key name, an extra key, a missing key and an off-list value', () => {
    for (const name of NAMES) {
      const schema = STORAGE_TELEMETRY_PAYLOADS[name];
      expect(schema.safeParse({ ...VALID[name], profileId: 'profile:suni' }).success, name).toBe(false);
      expect(schema.safeParse({ ...VALID[name], key: 'hr:progress:profile:suni' }).success, name).toBe(false);
      expect(schema.safeParse({ ...VALID[name], message: 'QuotaExceededError' }).success, name).toBe(false);
      for (const key of Object.keys(VALID[name])) {
        expect(schema.safeParse({ ...VALID[name], [key]: 'profile:suni' }).success, `${name}.${key}`).toBe(false);
        const { [key]: _dropped, ...missing } = VALID[name];
        expect(schema.safeParse(missing).success, `${name} without ${key}`).toBe(false);
      }
    }
    const read = STORAGE_TELEMETRY_PAYLOADS['storage.read_failed'];
    expect(read.safeParse({ record: 'stories', cause: 'read', kept: false }).success).toBe(false);
    expect(read.safeParse({ record: 'progress', cause: 'quota', kept: false }).success).toBe(false);
    expect(read.safeParse({ record: 'progress', cause: 'read', kept: 'false' }).success).toBe(false);
    // Only progress has a write event.
    expect(STORAGE_TELEMETRY_PAYLOADS['storage.write_failed'].safeParse({ record: 'profiles' }).success).toBe(false);
    expect(STORAGE_TELEMETRY_PAYLOADS['storage.write_recovered'].safeParse({ record: 'profiles', tries: 1 }).success).toBe(false);
  });

  it('holds tries to a whole number from 1 to 4', () => {
    const recovered = STORAGE_TELEMETRY_PAYLOADS['storage.write_recovered'];
    for (const tries of [0, 5, 1.5, -1, Number.NaN, '2', 1_700_000_000_000]) {
      expect(recovered.safeParse({ record: 'progress', tries }).success, String(tries)).toBe(false);
    }
  });
});
