import { describe, expect, it } from 'vitest';
import {
  MAX_HONOURED_MAX_AGE_S,
  REFETCH_MIN_AGE_MS,
  RETRY_AFTER_FAILURE_MS,
  bucketOf,
  fmix32,
  fnv1a32,
  parentFlagOf,
  parseConfigBody,
  parseMaxAge,
  parseStoredConfig,
  refetchDue,
  remoteFlagValue,
  resolveRemoteFlag,
  retryWaiting,
  type RemoteConfigCache,
  type RemoteFlagValue,
} from '../remote-config';

/**
 * Remote config on the device (F-CURR-002 section 12.2 and 11.4, row CM-2): value order, only-reduce, per-profile
 * buckets and the refetch age. Pure; the store (store/remote-config-store.ts) fetches and keeps the cache.
 */
const MIN = 60 * 1000;
const cache = (flags: Record<string, RemoteFlagValue>, fetchedAt = 0, maxAgeS = 300): RemoteConfigCache => ({ v: 1, fetchedAt, maxAgeS, flags });

describe('bucketOf · per profile, stable, no new identifier', () => {
  it('FNV-1a 32-bit matches the published test vectors, so buckets never move between releases', () => {
    expect(fnv1a32('')).toBe(0x811c9dc5);
    expect(fnv1a32('a')).toBe(0xe40c292c);
    expect(fnv1a32('foobar')).toBe(0xbf9cf968);
  });

  it('fmix32 matches murmur3 fmix32, so buckets never move between releases', () => {
    expect(fmix32(0)).toBe(0);
    expect(fmix32(1)).toBe(0x514e28b7);
    expect(fmix32(0xdeadbeef)).toBe(0x0de5c6a9);
  });

  it('is hash(profileId + flag) mod 100, in 0-99, and the same on every call', () => {
    for (const [profile, flag] of [['p1', 'dailyReview'], ['abc123xy', 'pack.k-culture'], ['profile-9', 'game.cloze-pick']] as const) {
      const b = bucketOf(profile, flag);
      expect(b).toBe(fmix32(fnv1a32(profile + flag)) % 100);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThan(100);
      for (let i = 0; i < 5; i += 1) expect(bucketOf(profile, flag)).toBe(b);
    }
  });

  it('pins known buckets (a change here moves learners between arms)', () => {
    expect([bucketOf('k7f3x9qa', 'dailyReview'), bucketOf('k7f3x9qa', 'mastery'), bucketOf('m2p8w1zt', 'dailyReview')]).toEqual([
      fmix32(fnv1a32('k7f3x9qadailyReview')) % 100,
      fmix32(fnv1a32('k7f3x9qamastery')) % 100,
      fmix32(fnv1a32('m2p8w1ztdailyReview')) % 100,
    ]);
    expect([bucketOf('k7f3x9qa', 'dailyReview'), bucketOf('k7f3x9qa', 'mastery'), bucketOf('m2p8w1zt', 'dailyReview')]).toEqual([85, 33, 15]);
  });

  it('two profiles on one device get their own buckets; one profile gets independent buckets per flag', () => {
    const profiles = Array.from({ length: 400 }, (_, i) => `profile${i}`);
    const buckets = new Set(profiles.map((p) => bucketOf(p, 'dailyReview')));
    expect(buckets.size).toBeGreaterThan(80);
    const sameAcrossFlags = profiles.filter((p) => bucketOf(p, 'dailyReview') === bucketOf(p, 'mastery')).length;
    expect(sameAcrossFlags).toBeLessThan(20);
  });

  it("a profile's buckets for two flags are independent (no shared low bits: all 16 mod-4 pairs, joint 10%/10% near 1%)", () => {
    const n = 20000;
    const pairs = new Set<string>();
    let both = 0;
    for (let i = 0; i < n; i += 1) {
      const p = `p${i.toString(36)}x`;
      const a = bucketOf(p, 'dailyReview');
      const b = bucketOf(p, 'memoryRecord');
      pairs.add(`${a % 4}:${b % 4}`);
      if (a < 10 && b < 10) both += 1;
    }
    expect(pairs.size).toBe(16);
    expect(both / n).toBeGreaterThan(0.007);
    expect(both / n).toBeLessThan(0.013);
  });

  it('spreads profiles evenly enough that a 10% ramp reaches about 10%', () => {
    const n = 5000;
    const inRamp = Array.from({ length: n }, (_, i) => `p${i.toString(36)}x`).filter((p) => bucketOf(p, 'memoryRecord') < 10).length;
    expect(inRamp / n).toBeGreaterThan(0.08);
    expect(inRamp / n).toBeLessThan(0.12);
  });

  it('a wider ramp keeps everyone who was already in (bucket < pct is monotone)', () => {
    const profiles = Array.from({ length: 300 }, (_, i) => `q${i}`);
    const at = (pct: number) => new Set(profiles.filter((p) => resolveRemoteFlag({ flag: 'goals', buildOn: true, builtInPct: 0, remote: { goals: { on: true, pct } }, profileId: p })));
    const ten = at(10);
    const fifty = at(50);
    for (const p of ten) expect(fifty.has(p)).toBe(true);
    expect(at(100).size).toBe(profiles.length);
  });
});

describe('resolveRemoteFlag · value order', () => {
  const base = { flag: 'dailyReview', buildOn: true, profileId: 'p1' } as const;

  it('never fetched: the built-in pct (0 during a ramp, 100 after it)', () => {
    expect(resolveRemoteFlag({ ...base, builtInPct: 0, remote: null })).toBe(false);
    expect(resolveRemoteFlag({ ...base, builtInPct: 100, remote: null })).toBe(true);
  });

  it('fetched or offline (the last known copy): the remote value', () => {
    expect(resolveRemoteFlag({ ...base, builtInPct: 0, remote: { dailyReview: { on: true, pct: 100 } } })).toBe(true);
    expect(resolveRemoteFlag({ ...base, builtInPct: 100, remote: { dailyReview: { on: false, pct: 100 } } })).toBe(false);
    expect(resolveRemoteFlag({ ...base, builtInPct: 100, remote: { dailyReview: { on: true, pct: 0 } } })).toBe(false);
  });

  it('a fetched copy without the flag: the built-in pct', () => {
    expect(resolveRemoteFlag({ ...base, builtInPct: 0, remote: { mastery: { on: true, pct: 100 } } })).toBe(false);
    expect(resolveRemoteFlag({ ...base, builtInPct: 100, remote: {} })).toBe(true);
  });

  it('a partial pct follows the profile bucket; no profile yet is off', () => {
    const remote = { dailyReview: { on: true, pct: 37 } };
    const p = Array.from({ length: 50 }, (_, i) => `r${i}`);
    for (const id of p) expect(resolveRemoteFlag({ ...base, profileId: id, builtInPct: 0, remote })).toBe(bucketOf(id, 'dailyReview') < 37);
    expect(resolveRemoteFlag({ ...base, profileId: null, builtInPct: 0, remote })).toBe(false);
    expect(resolveRemoteFlag({ ...base, profileId: '', builtInPct: 0, remote })).toBe(false);
    expect(resolveRemoteFlag({ ...base, profileId: null, builtInPct: 0, remote: { dailyReview: { on: true, pct: 100 } } })).toBe(true);
  });
});

describe('resolveRemoteFlag · remote can only reduce, in every combination', () => {
  const remotes: (Record<string, RemoteFlagValue> | null)[] = [
    null,
    {},
    { goals: { on: false, pct: 0 } },
    { goals: { on: false, pct: 100 } },
    { goals: { on: true, pct: 0 } },
    { goals: { on: true, pct: 1 } },
    { goals: { on: true, pct: 50 } },
    { goals: { on: true, pct: 99 } },
    { goals: { on: true, pct: 100 } },
  ];
  const builtIns = [0, 10, 50, 100];
  const profiles = [null, 'p1', 'p2', 'zz9', 'k7f3x9qa'];

  it('a build that has the flag off is off whatever the remote says', () => {
    for (const remote of remotes) {
      for (const builtInPct of builtIns) {
        for (const profileId of profiles) {
          expect(resolveRemoteFlag({ flag: 'goals', buildOn: false, builtInPct, remote, profileId }), JSON.stringify({ remote, builtInPct, profileId })).toBe(false);
        }
      }
    }
  });

  it('on: false is off whatever the pct, the built-in pct or the profile', () => {
    for (const pct of [0, 50, 100]) {
      for (const builtInPct of builtIns) {
        for (const profileId of profiles) {
          expect(resolveRemoteFlag({ flag: 'goals', buildOn: true, builtInPct, remote: { goals: { on: false, pct } }, profileId })).toBe(false);
        }
      }
    }
  });

  it('a lower remote pct never adds a profile (narrows only)', () => {
    const ids = Array.from({ length: 200 }, (_, i) => `n${i}`);
    for (const [hi, lo] of [[100, 50], [50, 10], [10, 0], [100, 0]] as const) {
      for (const profileId of ids) {
        const atLo = resolveRemoteFlag({ flag: 'goals', buildOn: true, builtInPct: 0, remote: { goals: { on: true, pct: lo } }, profileId });
        const atHi = resolveRemoteFlag({ flag: 'goals', buildOn: true, builtInPct: 0, remote: { goals: { on: true, pct: hi } }, profileId });
        if (atLo) expect(atHi).toBe(true);
      }
    }
  });

  it('the result is never on where the build is off (exhaustive table)', () => {
    let checked = 0;
    for (const buildOn of [true, false]) {
      for (const remote of remotes) {
        for (const builtInPct of builtIns) {
          for (const profileId of profiles) {
            const on = resolveRemoteFlag({ flag: 'goals', buildOn, builtInPct, remote, profileId });
            if (on) expect(buildOn).toBe(true);
            checked += 1;
          }
        }
      }
    }
    expect(checked).toBe(2 * remotes.length * builtIns.length * profiles.length);
  });
});

describe('parentFlagOf and remoteFlagValue', () => {
  it('a pack flag sits under topicPacks; other flags have no parent', () => {
    expect(parentFlagOf('pack.k-culture')).toBe('topicPacks');
    expect(parentFlagOf('game.cloze-pick')).toBeNull();
    expect(parentFlagOf('dailyReview')).toBeNull();
  });

  it('reads a flag from a copy without inheriting object keys', () => {
    expect(remoteFlagValue({ goals: { on: true, pct: 5 } }, 'goals')).toEqual({ on: true, pct: 5 });
    expect(remoteFlagValue({}, 'toString')).toBeUndefined();
    expect(remoteFlagValue(null, 'goals')).toBeUndefined();
  });
});

describe('parseConfigBody', () => {
  it('reads the envelope { ok, data: { flags } }', () => {
    expect(parseConfigBody({ ok: true, data: { flags: { goals: { on: true, pct: 20 }, 'pack.k-culture': { on: false, pct: 100 } } } })).toEqual({
      goals: { on: true, pct: 20 },
      'pack.k-culture': { on: false, pct: 100 },
    });
    expect(parseConfigBody({ ok: true, data: { flags: {} } })).toEqual({});
  });

  it('a body it cannot read is null (the device keeps its last copy)', () => {
    for (const body of [null, undefined, 'x', 1, [], {}, { ok: false }, { ok: true }, { ok: true, data: null }, { ok: true, data: { flags: [] } }, { ok: true, data: { flags: 'x' } }, { ok: false, data: { flags: {} } }]) {
      expect(parseConfigBody(body), JSON.stringify(body)).toBeNull();
    }
  });

  it('an entry it cannot read is off (fails toward off), a pct outside 0-100 is 0 (never 100); a bad name is dropped', () => {
    expect(
      parseConfigBody({ ok: true, data: { flags: { goals: { on: 'yes', pct: 50 }, mastery: { on: true, pct: 'all' }, volumes: null, cellCheck: { on: true, pct: 150 }, upperCards: { on: true, pct: -4 }, stageChecks: { on: true, pct: 12.7 }, 'Bad Name': { on: true, pct: 100 }, __proto__x: { on: true, pct: 1 } } } }),
    ).toEqual({ goals: { on: false, pct: 0 }, mastery: { on: false, pct: 0 }, volumes: { on: false, pct: 0 }, cellCheck: { on: true, pct: 0 }, upperCards: { on: true, pct: 0 }, stageChecks: { on: true, pct: 12 } });
  });
});

describe('parseMaxAge', () => {
  it('reads max-age from Cache-Control', () => {
    expect(parseMaxAge('public, max-age=300')).toBe(300);
    expect(parseMaxAge('max-age=60, public')).toBe(60);
    expect(parseMaxAge('Public, MAX-AGE=900')).toBe(900);
    expect(parseMaxAge('no-store')).toBeNull();
    expect(parseMaxAge(null)).toBeNull();
    expect(parseMaxAge('max-age=abc')).toBeNull();
  });
});

describe('refetchDue · on foreground, older than 15 minutes, honouring max-age', () => {
  it('never fetched is due', () => {
    expect(refetchDue(null, 0)).toBe(true);
  });

  it('is due from 15 minutes, not before', () => {
    const c = cache({}, 1_000_000, 300);
    expect(REFETCH_MIN_AGE_MS).toBe(15 * MIN);
    expect(refetchDue(c, 1_000_000)).toBe(false);
    expect(refetchDue(c, 1_000_000 + 5 * MIN)).toBe(false);
    expect(refetchDue(c, 1_000_000 + 15 * MIN - 1)).toBe(false);
    expect(refetchDue(c, 1_000_000 + 15 * MIN)).toBe(true);
    expect(refetchDue(c, 1_000_000 + 3 * 60 * MIN)).toBe(true);
  });

  it('a longer max-age waits for it; a shorter one still waits 15 minutes', () => {
    expect(refetchDue(cache({}, 0, 1800), 20 * MIN)).toBe(false);
    expect(refetchDue(cache({}, 0, 1800), 30 * MIN)).toBe(true);
    expect(refetchDue(cache({}, 0, 60), 10 * MIN)).toBe(false);
  });

  it('a huge max-age is capped, so a bad header cannot freeze the config', () => {
    expect(MAX_HONOURED_MAX_AGE_S).toBe(6 * 60 * 60);
    expect(refetchDue(cache({}, 0, 10 ** 9), 6 * 60 * MIN)).toBe(true);
  });

  it('a clock moved back before the fetch is due', () => {
    expect(refetchDue(cache({}, 10 * MIN), 5 * MIN)).toBe(true);
  });
});

describe('parseStoredConfig', () => {
  it('reads back what the store wrote', () => {
    const c = cache({ goals: { on: true, pct: 10 } }, 123, 300);
    expect(parseStoredConfig(JSON.parse(JSON.stringify(c)))).toEqual(c);
  });

  it('a damaged or older copy is null (never fetched)', () => {
    for (const v of [null, 1, 'x', {}, { v: 2, fetchedAt: 1, maxAgeS: 300, flags: {} }, { v: 1, fetchedAt: 'x', maxAgeS: 300, flags: {} }, { v: 1, fetchedAt: 1, maxAgeS: -1, flags: {} }, { v: 1, fetchedAt: 1, maxAgeS: 300, flags: null }]) {
      expect(parseStoredConfig(v), JSON.stringify(v)).toBeNull();
    }
  });

  it('an entry it cannot read is off', () => {
    expect(parseStoredConfig({ v: 1, fetchedAt: 1, maxAgeS: 300, flags: { goals: { on: 1, pct: 100 } } })?.flags).toEqual({ goals: { on: false, pct: 0 } });
  });
});

describe('retryWaiting · a short wait after a failed fetch', () => {
  it('waits 5 minutes after a failure, never without one, and never when the clock moved back', () => {
    expect(RETRY_AFTER_FAILURE_MS).toBe(5 * MIN);
    expect(retryWaiting(null, 0)).toBe(false);
    expect(retryWaiting(1000, 1000)).toBe(true);
    expect(retryWaiting(1000, 1000 + 5 * MIN - 1)).toBe(true);
    expect(retryWaiting(1000, 1000 + 5 * MIN)).toBe(false);
    expect(retryWaiting(1000, 999)).toBe(false);
  });
});
