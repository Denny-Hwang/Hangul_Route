import { CRASH_MESSAGE_MAX, CRASH_TELEMETRY_PAYLOADS } from '@hangul-route/content-schema/crash-telemetry';
import { describe, expect, it } from 'vitest';
import { crashPayload, isChunkLoadError, scrubMessage } from '../crash-report';

const ctx = { surface: 'learner', route: 'QuestPlayer', appVersion: '1.0.0' } as const;
const schema = CRASH_TELEMETRY_PAYLOADS['app.crash'];

describe('scrubMessage', () => {
  it('drops links, addresses and long numbers, and anything but printable ASCII', () => {
    expect(scrubMessage('GET https://app.hangulroute.com/_expo/x.js?id=1 failed')).toBe('GET <url> failed');
    expect(scrubMessage('no profile for dami@example.com')).toBe('no profile for <address>');
    expect(scrubMessage('card 1234567890 and 12345')).toBe('card # and 12345');
    expect(scrubMessage('Dami ☃\n\tlost')).toBe('Dami ? lost');
  });
  it('cuts to 120 characters and reads a non-string as empty', () => {
    expect(scrubMessage('x'.repeat(500))).toHaveLength(CRASH_MESSAGE_MAX);
    expect(CRASH_MESSAGE_MAX).toBe(120);
    expect(scrubMessage(undefined)).toBe('');
    expect(scrubMessage(42)).toBe('');
  });
});

describe('isChunkLoadError', () => {
  const named = (name: string, message = 'boom'): Error => Object.assign(new Error(message), { name });
  it('knows the chunk failures of Metro, the browser and the app', () => {
    for (const name of ['AsyncRequireError', 'ChunkLoadError', 'LessonChunkMismatch', 'LessonChunkTimeout', 'RootChunkTimeout']) expect(isChunkLoadError(named(name)), name).toBe(true);
    expect(isChunkLoadError(new Error('Requiring unknown module "123"'))).toBe(true);
    expect(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module'))).toBe(true);
    expect(isChunkLoadError(new Error('Loading module failed'))).toBe(true);
  });
  it('leaves a render error and a thrown non-error alone', () => {
    expect(isChunkLoadError(new TypeError("Cannot read properties of undefined (reading 'x')"))).toBe(false);
    expect(isChunkLoadError('Loading module failed')).toBe(false);
    expect(isChunkLoadError(undefined)).toBe(false);
  });
});

describe('crashPayload', () => {
  it('builds a payload the Worker schema accepts, with the route, error class and chunk flag', () => {
    const payload = crashPayload(Object.assign(new Error('Loading module from https://x.test/a.js failed'), { name: 'AsyncRequireError' }), ctx);
    expect(payload).toEqual({ surface: 'learner', route: 'QuestPlayer', errorName: 'AsyncRequireError', message: 'Loading module from <url> failed', chunk: true, appVersion: '1.0.0' });
    expect(schema.safeParse(payload).success).toBe(true);
  });
  it('falls back for an unknown route and a thrown string, and never carries a profile id', () => {
    const payload = crashPayload('oops from dami@example.com', { ...ctx, route: undefined });
    expect(payload).toEqual({ surface: 'learner', route: 'Unknown', errorName: 'string', message: 'oops from <address>', chunk: false, appVersion: '1.0.0' });
    expect(Object.keys(payload)).not.toContain('profileId');
  });
  it('turns an odd route or error name into a plain code', () => {
    const payload = crashPayload(Object.assign(new Error('x'), { name: '9 weird/name!' }), { ...ctx, route: 'Quest/abc?x=1' });
    expect(payload.errorName).toBe('Error');
    expect(payload.route).toBe('Questabcx1');
    expect(schema.safeParse(payload).success).toBe(true);
    expect(crashPayload(null, { ...ctx, surface: 'presenter' }).errorName).toBe('object');
  });
});
