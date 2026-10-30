import { blockParts, CURR_TELEMETRY_PAYLOADS, REPRESENTATIVE_FINALS, SyllableBuildRoundSchema, type BlockParts, type SyllableBuildRound } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { askedOfScope } from '../../memory/resolve';
import { fnv1a32 } from '../../remote-config/remote-config';
import { blockOptions, fallbackScope, syllableBuildToListenPick } from '../fallback';
import { DRILL_BLOCKS, isProbeBlock, isRealBlock, PROBE_BLOCKS, PROBE_FORMS, REAL_BLOCKS, soundKeyOf } from '../pool';
import {
  CLOCK_START,
  drillBlocksShown,
  EMPTY_RECORD,
  finishSprint,
  holdClock,
  isHeldOut,
  parseRecord,
  perMinute,
  planSprint,
  PROBE_ROUNDS,
  probeFormOf,
  probeRate,
  runClock,
  secondsLeft,
  SPRINT_MS,
  timeUp,
  elapsedMs,
  remainingMs,
} from '../sprint';
import { shuffled, tilesFor, tilesSound } from '../tiles';

/** F-CURR-002 section 7.1 F3 and F9, OD-8, section 11.3, row CM-32: the tiles, the fallback round and the sprint. */
const parts = (ko: string) => blockParts(ko) as BlockParts;

describe('tile rows the app builds', () => {
  it('for every real block: the target parts are tiles, rows of 4, 4 and 3, and the round schema accepts them', () => {
    for (const ko of REAL_BLOCKS) {
      for (const seed of [1, 7, 42]) {
        const rows = tilesFor(parts(ko), seed);
        expect(rows.firstTiles).toHaveLength(4);
        expect(rows.vowelTiles).toHaveLength(4);
        expect(rows.finalTiles).toHaveLength(3);
        expect(tilesSound({ ko }, rows), `${ko} ${JSON.stringify(rows)}`).toBe(true);
        const round: SyllableBuildRound = { id: `sb:${ko}`, target: { ko, romanization: 'x' }, ...rows };
        expect(SyllableBuildRoundSchema.safeParse(round).success, ko).toBe(true);
        for (const f of rows.finalTiles) expect(REPRESENTATIVE_FINALS).toContain(f);
      }
    }
  });

  it('is deterministic for a seed and varies with it', () => {
    expect(tilesFor(parts('밥'), 3)).toEqual(tilesFor(parts('밥'), 3));
    const orders = new Set([1, 2, 3, 4, 5, 6].map((s) => tilesFor(parts('밥'), s).firstTiles.join('')));
    expect(orders.size).toBeGreaterThan(1);
    expect(shuffled([1, 2, 3], 9)).toEqual(shuffled([1, 2, 3], 9));
  });
});

const bap: SyllableBuildRound = {
  id: 'sb:bap',
  target: { ko: '밥', romanization: 'bap', en: 'rice, a meal' },
  firstTiles: ['ㄱ', 'ㅂ', 'ㅁ', 'ㄷ'],
  vowelTiles: ['ㅏ', 'ㅓ', 'ㅗ', 'ㅜ'],
  finalTiles: ['ㅂ', 'ㄴ', 'ㅇ'],
};

describe('the fallback round: Listen & Pick on the built block (game.syllable-build off)', () => {
  it('the target and real blocks one zone away from it, from its own tiles, never two that sound the same', () => {
    const round = syllableBuildToListenPick(bap, 1);
    // A word block records against its cell's item, as the game does; a bare block against its `syl` item.
    expect(round.id).toBe('lp:sbw:sb:bap');
    const bare = { ...bap, id: 'sb:ba', target: { ko: '밥', romanization: 'bap' } };
    expect(syllableBuildToListenPick(bare, 1).id).toBe('lp:syl:sb:ba');
    for (const r of [bap, bare]) {
      const game = askedOfScope({ kind: 'syllable-build', syllableBuild: { rounds: [r] } }, r.id);
      const fallback = fallbackScope({ kind: 'syllable-build', syllableBuild: { rounds: [r] } });
      const picked = askedOfScope(fallback, fallback.listenPick!.rounds[0]!.id);
      expect(picked?.texts, r.id).toEqual(game?.texts);
    }
    expect(round.answerId).toBe('밥');
    expect(round.prompt).toEqual({ ko: '밥', romanization: 'bap', en: 'rice, a meal' });
    const ids = round.options.map((o) => o.id);
    expect(ids).toContain('밥');
    expect(ids.length).toBeGreaterThanOrEqual(3);
    expect(ids.length).toBeLessThanOrEqual(4);
    expect(new Set(ids.map(soundKeyOf)).size).toBe(ids.length);
    for (const ko of ids.filter((k) => k !== '밥')) {
      expect(isRealBlock(ko), ko).toBe(true);
      const p = parts(ko);
      const differ = (['first', 'vowel', 'final'] as const).filter((z) => p[z] !== parts('밥')[z]).length;
      expect(differ, ko).toBe(1);
    }
    // One option per zone where the tiles allow: 반 or 방 (final), 법 or 봅 (vowel), 답 or 갑 (first letter) kinds.
    expect(ids.some((k) => parts(k).final !== 'ㅂ')).toBe(true);
    expect(round.options.find((o) => o.id === '밥')!.text).toEqual({ ko: '밥', romanization: 'bap', en: 'rice, a meal' });
  });

  it('every real block as a target gets at least 3 options, each real, each sounding different', () => {
    for (const ko of REAL_BLOCKS) {
      const rows = tilesFor(parts(ko), 5);
      const options = blockOptions(ko, rows, 5);
      expect(options.length, ko).toBeGreaterThanOrEqual(3);
      expect(new Set(options.map(soundKeyOf)).size).toBe(options.length);
      for (const o of options) expect(isRealBlock(o), `${ko}: ${o}`).toBe(true);
    }
  });

  it('a scope with rounds becomes a Listen & Pick scope; a recording rides on the prompt; a target that is no block plays alone', () => {
    const scope = fallbackScope({ kind: 'syllable-build', syllableBuild: { rounds: [bap, { ...bap, id: 'sb:2', target: { ...bap.target, audioRef: 'a.mp3', spokenKo: '밥' } }] } });
    expect(scope.kind).toBe('listen-pick');
    expect(scope.listenPick?.rounds).toHaveLength(2);
    expect(scope.listenPick?.rounds[1]?.prompt).toMatchObject({ audioRef: 'a.mp3', spokenKo: '밥' });
    expect(fallbackScope({ kind: 'syllable-build' }).listenPick?.rounds).toEqual([]);
    expect(blockOptions('ab', bap, 1)).toEqual(['ab']);
  });
});

describe('the Decoding Sprint plan', () => {
  it('the probe is drawn from undrilled blocks only, and no drill round shows a probe block, as answer or option', () => {
    for (const seed of [1, 2, 3, 99, 12345]) {
      for (const build of [true, false]) {
        const plan = planSprint(seed, build);
        expect(plan.probe).toHaveLength(PROBE_ROUNDS);
        for (const r of plan.probe) {
          expect(PROBE_BLOCKS).toContain(r.target);
          expect(r.kind).toBe('pick');
          expect(r.options).toContain(r.target);
          expect(new Set(r.options.map(soundKeyOf)).size).toBe(r.options.length);
        }
        for (const ko of drillBlocksShown(plan)) {
          expect(isHeldOut(ko), `${ko} is held out`).toBe(false);
          expect(DRILL_BLOCKS, ko).toContain(ko);
        }
      }
    }
  });

  it('the n-th sprint probes form (n - 1) mod 4: the first four sprints each probe blocks never shown before', () => {
    expect([1, 2, 3, 4, 5, 8, 9].map((n) => probeFormOf(n))).toEqual([0, 1, 2, 3, 0, 3, 0]);
    expect(probeFormOf(0)).toBe(0);
    const seen = new Set<string>();
    for (let n = 1; n <= 4; n += 1) {
      const plan = planSprint(77 + n, true, n);
      const targets = plan.probe.map((r) => r.target);
      expect([...targets].sort()).toEqual([...(PROBE_FORMS[n - 1] as readonly string[])].sort());
      for (const ko of targets) expect(seen.has(ko), `${ko} probed again in sprint ${n}`).toBe(false);
      // Nothing a probe round shows is a probe block but its own target: its options are drill blocks.
      for (const r of plan.probe) for (const o of r.options) expect(o === r.target || !isProbeBlock(o), `${r.target}: ${o}`).toBe(true);
      for (const r of plan.probe) {
        for (const o of r.options) seen.add(o);
        expect(r.options.length, r.target).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('a learner starts on a form of their own, then takes the four in turn, so a sprint index spreads over every form', () => {
    // Offset 2: sprints 1-4 probe forms 2, 3, 0, 1, each once.
    expect([1, 2, 3, 4, 5].map((n) => probeFormOf(n, 2))).toEqual([2, 3, 0, 1, 2]);
    expect(probeFormOf(1, 4_000_000_001)).toBe(4_000_000_001 % 4);
    expect(probeFormOf(1, Number.NaN)).toBe(0);
    for (let offset = 0; offset < 4; offset += 1) {
      const forms = [1, 2, 3, 4].map((n) => probeFormOf(n, offset));
      expect(new Set(forms).size, `offset ${offset}`).toBe(4);
      expect(planSprint(9, false, 1, offset).probe.map((r) => r.target).sort()).toEqual([...(PROBE_FORMS[offset] as readonly string[])].sort());
    }
    // Across learners the first sprint lands on every form (the hash the screen uses, over a few profile ids).
    const firstForms = new Set(Array.from({ length: 40 }, (_, i) => probeFormOf(1, fnv1a32(`profile:${i}|decode-sprint-form`))));
    expect(firstForms.size).toBe(4);
  });

  it('real blocks only; with game.syllable-build on every other drill round builds, off they are all picks', () => {
    const on = planSprint(4, true);
    const off = planSprint(4, false);
    expect(off.drill.every((r) => r.kind === 'pick')).toBe(true);
    expect(on.drill.filter((r) => r.kind === 'build').length).toBeGreaterThan(on.drill.length / 3);
    for (const r of on.drill) {
      expect(isRealBlock(r.target)).toBe(true);
      if (r.kind === 'build') expect(tilesSound({ ko: r.target }, r.tiles)).toBe(true);
      if (r.kind === 'pick') expect(r.options.length).toBeGreaterThanOrEqual(3);
    }
    // The drill holds more rounds than a minute can play, without repeating a block before the pool is used up.
    expect(new Set(on.drill.slice(0, 40).map((r) => r.target)).size).toBe(40);
  });

  it('is deterministic for a seed (the profile and the sprint index), whatever the time zone', () => {
    const before = process.env.TZ;
    const plans = ['UTC', 'Pacific/Kiritimati', 'Etc/GMT+12', 'Asia/Seoul', 'America/Los_Angeles'].map((tz) => {
      process.env.TZ = tz;
      return JSON.stringify(planSprint(77, true));
    });
    process.env.TZ = before;
    expect(new Set(plans).size).toBe(1);
    expect(JSON.stringify(planSprint(78, true))).not.toBe(plans[0]);
  });
});

describe('the sprint clock: one clock for the minute, active play only', () => {
  it('runs while a round is up, holds while an answer shows or the sprint is paused, and ends at 60 s', () => {
    let c = runClock(CLOCK_START, 1000);
    expect(runClock(c, 5000)).toBe(c);
    expect(secondsLeft(c, 1000)).toBe(60);
    expect(secondsLeft(c, 1001)).toBe(60);
    expect(secondsLeft(c, 2000)).toBe(59);
    c = holdClock(c, 11_000);
    expect(holdClock(c, 99_000)).toBe(c);
    expect(elapsedMs(c, 99_000)).toBe(10_000);
    c = runClock(c, 100_000);
    expect(timeUp(c, 149_999)).toBe(false);
    expect(timeUp(c, 150_000)).toBe(true);
    expect(elapsedMs(c, 500_000)).toBe(SPRINT_MS);
    expect(secondsLeft(c, 500_000)).toBe(0);
    // A clock that moved back never runs time backwards.
    expect(elapsedMs(runClock(CLOCK_START, 10_000), 5_000)).toBe(0);
    expect(holdClock(runClock(CLOCK_START, 10_000), 5_000).activeMs).toBe(0);
  });

  it('gives the time left for the vocab Challenge clock view', () => {
    const c = runClock(CLOCK_START, 0);
    expect(remainingMs(c, 0)).toBe(SPRINT_MS);
    expect(remainingMs(c, 18_000)).toBe(42_000);
    expect(remainingMs(c, 90_000)).toBe(0);
  });
});

describe('the result, the private best and the event', () => {
  const tally = { drillRight: 14, drillMs: SPRINT_MS, probeRight: 5, probeMs: 15_000, probeRounds: 6 };

  it('rates are right first tries per minute; a probe too fast to be real is read at a floor pace', () => {
    expect(perMinute(14, 60_000)).toBe(14);
    expect(perMinute(0, 60_000)).toBe(0);
    expect(perMinute(3, 0)).toBe(0);
    expect(probeRate(tally)).toBe(20);
    expect(probeRate({ ...tally, probeRight: 6, probeMs: 600 })).toBe(75);
  });

  it('a first sprint shows the count and no best line; later sprints the own best and New best only above it', () => {
    const first = finishSprint(tally, EMPTY_RECORD, 'p1');
    expect(first).toMatchObject({ read: 14, newBest: false, best: null, record: { v: 1, sprints: 1, best: 14 } });
    const second = finishSprint({ ...tally, drillRight: 16 }, first.record, 'p1');
    expect(second).toMatchObject({ read: 16, newBest: true, best: 16, record: { sprints: 2, best: 16 } });
    const third = finishSprint({ ...tally, drillRight: 9 }, second.record, 'p1');
    expect(third).toMatchObject({ read: 9, newBest: false, best: 16, record: { sprints: 3, best: 16 } });
  });

  it('the private best never reaches telemetry beyond buckets: the payload parses and holds only the three codes', () => {
    const before = { v: 1 as const, sprints: 3, best: 23 };
    const out = finishSprint(tally, before, 'p1');
    expect(out.event).toEqual({ name: 'decode.sprint.finished', profileId: 'p1', payload: { rateBucket: '13-14', probeRateBucket: '18-20', sprintIndexBucket: '4' } });
    expect(CURR_TELEMETRY_PAYLOADS['decode.sprint.finished'].safeParse(out.event!.payload).success).toBe(true);
    const text = JSON.stringify(out.event);
    for (const raw of ['"14"', ':14', '23', '"best"', '"sprints"', 'drill', '밥']) expect(text).not.toContain(raw);
    expect(finishSprint({ ...tally, drillRight: 200 }, { v: 1, sprints: 30, best: 0 }, undefined).event?.payload).toEqual({ rateBucket: '75+', probeRateBucket: '18-20', sprintIndexBucket: '20+' });
  });

  it('a sprint whose probe was read, not heard (no sound), sends no event and still keeps the best', () => {
    const out = finishSprint({ ...tally, probeHeard: false }, EMPTY_RECORD, 'p1');
    expect(out.event).toBeNull();
    expect(out.record).toEqual({ v: 1, sprints: 1, best: 14 });
    expect(finishSprint({ ...tally, probeHeard: true }, EMPTY_RECORD, 'p1').event).not.toBeNull();
  });

  it('a stored record reads back; anything damaged is no record yet', () => {
    expect(parseRecord({ v: 1, sprints: 2, best: 9 })).toEqual({ v: 1, sprints: 2, best: 9 });
    for (const bad of [null, 'x', {}, { v: 2, sprints: 1, best: 1 }, { v: 1, sprints: -1, best: 1 }, { v: 1, sprints: 1.5, best: 1 }, { v: 1, sprints: 1 }]) {
      expect(parseRecord(bad)).toEqual(EMPTY_RECORD);
    }
  });
});
