import { JOIN_CODE_RE } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { JOIN_CODE_TTL_MS, generateJoinCode, isJoinCodeLive, joinCodeExpiry, randomJoinCode } from '../join-code';

describe('join code (F-SPACE-001 §3.2)', () => {
  it('generates six alphabet characters', () => {
    for (let i = 0; i < 50; i += 1) expect(randomJoinCode()).toMatch(JOIN_CODE_RE);
  });

  it('skips codes that are taken and gives up after maxTries', () => {
    const seen = new Set<string>();
    const first = generateJoinCode((c) => seen.has(c));
    seen.add(first);
    const second = generateJoinCode((c) => seen.has(c));
    expect(second).not.toBe(first);
    expect(() => generateJoinCode(() => true, 3)).toThrow(/exhausted/);
  });

  it('expires after 30 days and reports liveness', () => {
    const now = new Date('2026-09-21T00:00:00.000Z');
    const expiresAt = joinCodeExpiry(now);
    expect(Date.parse(expiresAt) - now.getTime()).toBe(JOIN_CODE_TTL_MS);
    expect(isJoinCodeLive({ joinCode: 'K7M2X9', joinCodeExpiresAt: expiresAt }, now)).toBe(true);
    expect(isJoinCodeLive({ joinCode: 'K7M2X9', joinCodeExpiresAt: expiresAt }, new Date(Date.parse(expiresAt)))).toBe(false);
    expect(isJoinCodeLive({ joinCode: null, joinCodeExpiresAt: expiresAt }, now)).toBe(false);
    expect(isJoinCodeLive({ joinCode: 'K7M2X9', joinCodeExpiresAt: null }, now)).toBe(false);
  });
});
