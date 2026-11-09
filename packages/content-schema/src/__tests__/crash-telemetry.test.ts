import { describe, expect, it } from 'vitest';
import { TELEMETRY_EVENT_NAMES, isTelemetryEventName } from '../index';
import { CRASH_MESSAGE_MAX, CRASH_SURFACES, CRASH_TELEMETRY_NAMES, CRASH_TELEMETRY_PAYLOADS } from '../schemas/crash-telemetry';

/** `app.crash` (TELEMETRY-NAMES-2 section U): a strict, learner-free payload. */
const schema = CRASH_TELEMETRY_PAYLOADS['app.crash'];
const GOOD = { surface: 'learner', route: 'Home', errorName: 'TypeError', message: "Cannot read properties of undefined (reading 'x')", chunk: false, appVersion: '1.0.0' };

describe('app.crash payload', () => {
  it('is listed once, last, and is a known name', () => {
    expect(CRASH_TELEMETRY_NAMES).toEqual(['app.crash']);
    expect(TELEMETRY_EVENT_NAMES.filter((n) => n === 'app.crash')).toHaveLength(1);
    expect(isTelemetryEventName('app.crash')).toBe(true);
    expect(isTelemetryEventName('app.crashed')).toBe(false);
  });

  it('accepts each root and a good payload', () => {
    for (const surface of CRASH_SURFACES) expect(schema.safeParse({ ...GOOD, surface }).success).toBe(true);
    expect(schema.safeParse(GOOD).success).toBe(true);
  });

  it('rejects an extra key, a bad root, a route with a path or query, and a bad version', () => {
    expect(schema.safeParse({ ...GOOD, profileId: 'p' }).success).toBe(false);
    expect(schema.safeParse({ ...GOOD, surface: 'kiosk' }).success).toBe(false);
    expect(schema.safeParse({ ...GOOD, route: 'Quest/abc' }).success).toBe(false);
    expect(schema.safeParse({ ...GOOD, route: '' }).success).toBe(false);
    expect(schema.safeParse({ ...GOOD, errorName: 'x'.repeat(41) }).success).toBe(false);
    expect(schema.safeParse({ ...GOOD, appVersion: '1.0' }).success).toBe(false);
  });

  it('holds the message to 120 printable ASCII characters with no address, link or long number', () => {
    expect(schema.safeParse({ ...GOOD, message: 'x'.repeat(CRASH_MESSAGE_MAX) }).success).toBe(true);
    expect(schema.safeParse({ ...GOOD, message: 'x'.repeat(CRASH_MESSAGE_MAX + 1) }).success).toBe(false);
    expect(schema.safeParse({ ...GOOD, message: 'mail a@b.c' }).success).toBe(false);
    expect(schema.safeParse({ ...GOOD, message: 'https://x.test/a' }).success).toBe(false);
    expect(schema.safeParse({ ...GOOD, message: 'code 123456' }).success).toBe(false);
    expect(schema.safeParse({ ...GOOD, message: 'code 12345' }).success).toBe(true);
    expect(schema.safeParse({ ...GOOD, message: 'café' }).success).toBe(false);
  });
});
