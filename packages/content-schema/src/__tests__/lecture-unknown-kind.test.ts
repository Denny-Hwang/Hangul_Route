import { describe, expect, it } from 'vitest';
import { LECTURE_DECODE_FAILURES, decodeDeck, encodeDeck, isNewerDeckFailure, type LectureDeckInput } from '../index';

/**
 * F-CURR-002 §8 (row CM-36): a deck that names a block kind or preset this presenter does not know comes from a newer
 * console, so it decodes to its own failure, `unknown_kind`, and the presenter shows the update notice it shows for
 * `unsupported_version`, never the broken-link page. The deck shape is unchanged (the Hidden Heritage slides build from
 * a quest block), so the deck `v` stays.
 */

const b64url = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fragmentOf = (v: number, json: unknown): string => `${v}.${b64url(new TextEncoder().encode(JSON.stringify(json)))}`;

const deck = (over: Partial<LectureDeckInput> = {}): LectureDeckInput => ({
  v: 1,
  id: 'lecture:abc123',
  title: 'Market words',
  createdAt: '2026-10-23T09:00:00.000Z',
  seed: 7,
  blocks: [{ kind: 'quest', id: 'quest:stage2-life-q1' }],
  ...over,
});

describe('unknown_kind: a newer deck this presenter cannot draw (§8)', () => {
  it('is a decode failure the Worker allowlist reads (the same list)', () => {
    expect(LECTURE_DECODE_FAILURES).toContain('unknown_kind');
    expect(LECTURE_DECODE_FAILURES.at(-1)).toBe('unknown_kind');
  });

  it('a block kind this build does not know (a later game block)', () => {
    const blocks = [{ kind: 'quest', id: 'quest:stage2-life-q1' }, { kind: 'game', preset: 'hidden-heritage-big' }];
    expect(decodeDeck(fragmentOf(1, { ...deck(), blocks }))).toEqual({ ok: false, reason: 'unknown_kind' });
  });

  it('an activity preset or a deck preset this build does not know', () => {
    const activity = [{ kind: 'activity', preset: 'yut-race', minutes: 5 }];
    expect(decodeDeck(fragmentOf(1, { ...deck(), blocks: activity }))).toEqual({ ok: false, reason: 'unknown_kind' });
    const v2 = { ...deck({ v: 2 }), blocks: [{ kind: 'word-review', questIds: ['quest:stage2-life-q1'], vocabIds: [], rounds: 4 }], preset: 'class-review' };
    expect(decodeDeck(fragmentOf(2, v2))).toEqual({ ok: false, reason: 'unknown_kind' });
  });

  it('a known kind with a bad field is still invalid, and a good deck still opens', () => {
    const bad = decodeDeck(fragmentOf(1, { ...deck(), blocks: [{ kind: 'quest', id: 'nope' }] }));
    expect(bad.ok === false && bad.reason).toBe('invalid');
    const missing = decodeDeck(fragmentOf(1, { ...deck(), blocks: [{ id: 'quest:stage2-life-q1' }] }));
    expect(missing.ok === false && missing.reason).toBe('invalid');
    expect(decodeDeck(encodeDeck(deck())).ok).toBe(true);
  });

  it('the presenter shows the update notice for it, as for a later version', () => {
    expect(isNewerDeckFailure('unknown_kind')).toBe(true);
    expect(isNewerDeckFailure('unsupported_version')).toBe(true);
    for (const reason of ['empty', 'too_large', 'bad_encoding', 'bad_json', 'invalid'] as const) expect(isNewerDeckFailure(reason)).toBe(false);
  });
});
