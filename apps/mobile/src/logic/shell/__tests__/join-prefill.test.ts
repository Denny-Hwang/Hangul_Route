import { JOIN_HANDOFF_MS } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { joinPrefillCode } from '../join-prefill';

// F-APP-001 sections 3.6 and 3.8: the family home's "Open the app on this device" leaves
// `hr:shell:joinCode` = `{ v: 1, code, at }` in the tab; the Join screen fills the code in when it
// is shown within 30 minutes. A value that is not that record reads as nothing.
const NOW = 1_800_000_000_000;
const CODE = 'ABCD23';

function record(at: number, code = CODE): string {
  return JSON.stringify({ v: 1, code, at });
}

describe('joinPrefillCode', () => {
  it('fills the code handed over a moment ago', () => {
    expect(joinPrefillCode(record(NOW - 1000), NOW)).toBe(CODE);
    expect(joinPrefillCode(record(NOW), NOW)).toBe(CODE);
  });

  it('still fills it just inside 30 minutes, and not at 30 minutes or later', () => {
    expect(joinPrefillCode(record(NOW - JOIN_HANDOFF_MS + 1), NOW)).toBe(CODE);
    expect(joinPrefillCode(record(NOW - JOIN_HANDOFF_MS), NOW)).toBeNull();
    expect(joinPrefillCode(record(NOW - 2 * JOIN_HANDOFF_MS), NOW)).toBeNull();
  });

  it('ignores a record from the future (a clock that ran backwards)', () => {
    expect(joinPrefillCode(record(NOW + 1000), NOW)).toBeNull();
  });

  it('reads a missing, corrupt or wrong-shaped value as nothing', () => {
    expect(joinPrefillCode(null, NOW)).toBeNull();
    expect(joinPrefillCode('', NOW)).toBeNull();
    expect(joinPrefillCode('{not json', NOW)).toBeNull();
    expect(joinPrefillCode(JSON.stringify({ v: 2, code: CODE, at: NOW }), NOW)).toBeNull();
    expect(joinPrefillCode(record(NOW, 'abc'), NOW)).toBeNull();
    expect(joinPrefillCode(JSON.stringify({ v: 1, code: CODE }), NOW)).toBeNull();
  });
});
