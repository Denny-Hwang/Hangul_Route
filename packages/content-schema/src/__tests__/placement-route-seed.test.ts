import { describe, expect, it } from 'vitest';
import { PlacementResultSchema, effectiveRoute, priorityTokensOf, seedRoute, themeOrderFor, type AssessmentResponse, type GateResult } from '..';
import { FULL_ROUTE, STAGE1_15, STAGE1_8, ids, q, qs } from './fixtures/stage1-15';
import { makeResult } from './fixtures/placement-results';

const everyone = () => true;
const paid = { isEntitled: everyone, completedQuestIds: new Set<string>() };
const free = { isEntitled: (s: string) => s === 'stage1', completedQuestIds: new Set<string>() };
const doneOf = (...n: number[]) => ({ isEntitled: everyone, completedQuestIds: new Set(qs(...n)) });

const resp = (questionId: string, outcome: AssessmentResponse['outcome'], assisted = false): AssessmentResponse => ({
  questionId,
  outcome,
  chosenOptionId: null,
  assisted,
  ms: 1,
});
const gate = (g: GateResult['gate'], result: GateResult['result']): GateResult => ({
  gate: g,
  form: 'decode',
  asked: 3,
  correct: result === 'pass' ? 3 : 0,
  assisted: 0,
  result,
});

describe('themeOrderFor', () => {
  it('is the canonical order without a motivation', () => {
    expect(themeOrderFor(undefined)).toEqual(['letters', 'life', 'rites', 'nature', 'crafts']);
  });
  it('puts the motivation theme first (blueprint 04 section 8.1)', () => {
    expect(themeOrderFor('heritage')).toEqual(['life', 'letters', 'rites', 'nature', 'crafts']);
    expect(themeOrderFor('friends')[0]).toBe('life');
    expect(themeOrderFor('kculture')).toEqual(['rites', 'letters', 'life', 'nature', 'crafts']);
    expect(themeOrderFor('curious')).toEqual(['letters', 'life', 'rites', 'nature', 'crafts']);
  });
});

describe('priorityTokensOf', () => {
  const tags: Record<string, string[]> = {
    a: ['sym:ㅓ'],
    b: ['sym:ㄹ/final', 'syl:gal'],
    c: ['sym:ㅡ'],
    d: ['sym:ㅣ'],
    e: ['sym:ㅏ'],
    none: ['look-alike'],
  };
  const tagsOf = (id: string) => tags[id] ?? [];

  it('lists wrong symbols first, then skipped, then assisted, each once, at most three', () => {
    const rs = [resp('c', 'skipped'), resp('a', 'wrong'), resp('b', 'wrong'), resp('a', 'wrong'), resp('d', 'correct', true)];
    expect(priorityTokensOf([], rs, tagsOf)).toEqual(['sym:ㅓ', 'sym:ㄹ/final', 'sym:ㅡ']);
    expect(priorityTokensOf([], [resp('d', 'correct', true), resp('c', 'skipped')], tagsOf)).toEqual(['sym:ㅡ', 'sym:ㅣ']);
  });

  it('ignores correct unassisted answers and untagged questions', () => {
    expect(priorityTokensOf([], [resp('a', 'correct'), resp('none', 'wrong'), resp('x', 'wrong')], tagsOf)).toEqual([]);
  });

  it('adds skill:blending when syl-cv failed after sound-basic passed, or syl-cvc after sound-rest', () => {
    expect(priorityTokensOf([gate('sound-basic', 'pass'), gate('syl-cv', 'fail')], [], tagsOf)).toEqual(['skill:blending']);
    expect(priorityTokensOf([gate('sound-rest', 'pass'), gate('syl-cvc', 'fail')], [], tagsOf)).toEqual([
      'skill:blending',
      'skill:finals',
    ]);
    expect(priorityTokensOf([gate('sound-basic', 'fail'), gate('syl-cv', 'fail')], [], tagsOf)).toEqual([]);
  });

  it('a strict-rule fail with two correct (Short syl-cv 2 of 3) adds no blending token', () => {
    const nearly: GateResult = { ...gate('syl-cv', 'fail'), correct: 2 };
    expect(priorityTokensOf([gate('sound-basic', 'pass'), nearly], [], tagsOf)).toEqual([]);
  });

  it('Deep rows: a syl-cv pass followed by a failed confirming draw adds blending; a failed sound confirmation does not count as a sound pass', () => {
    expect(priorityTokensOf([gate('sound-basic', 'pass'), gate('syl-cv', 'pass'), gate('syl-cv', 'fail')], [], tagsOf)).toEqual([
      'skill:blending',
    ]);
    expect(priorityTokensOf([gate('sound-basic', 'pass'), gate('sound-basic', 'fail'), gate('syl-cv', 'fail')], [], tagsOf)).toEqual([]);
  });

  it('adds skill:finals whenever syl-cvc failed, and symbols come before skills within the cap of three', () => {
    expect(priorityTokensOf([gate('syl-cvc', 'fail')], [], tagsOf)).toEqual(['skill:finals']);
    const rs = [resp('a', 'wrong'), resp('b', 'wrong'), resp('c', 'wrong')];
    expect(priorityTokensOf([gate('sound-rest', 'pass'), gate('syl-cvc', 'fail')], rs, tagsOf)).toEqual([
      'sym:ㅓ',
      'sym:ㄹ/final',
      'sym:ㅡ',
    ]);
    const two = [resp('a', 'wrong'), resp('c', 'wrong')];
    expect(priorityTokensOf([gate('sound-rest', 'pass'), gate('syl-cvc', 'fail')], two, tagsOf)).toEqual([
      'sym:ㅓ',
      'sym:ㅡ',
      'skill:blending',
    ]);
  });
});

describe('seedRoute', () => {
  const band1 = makeResult({ level: { stage: 'stage1', band: 1 }, placedOutQuestIds: qs(1, 2, 3), priorityTokens: ['sym:ㅓ'], motivation: 'heritage' });

  it('starts at the first playable grid quest that is not placed out', () => {
    const seed = seedRoute(band1, STAGE1_15, paid);
    expect(seed.startQuestId).toBe(q(4));
    expect(seed.startEpisodeId).toBe('episode:stage1-life');
    expect(seed.placedOutQuestIds).toEqual(qs(1, 2, 3));
    expect(seed.level).toEqual({ stage: 'stage1', band: 1 });
    expect(seed.priorityTokens).toEqual(['sym:ㅓ']);
    expect(seed.themeOrder).toEqual(['life', 'letters', 'rites', 'nature', 'crafts']);
    expect(seed.needsStage).toBeNull();
    expect(seed.beyondContent).toBe(false);
  });

  it('is "the first quest not placed out", not "the first after a prefix": a cut-back quest is the start', () => {
    const cutBack = makeResult({ level: { stage: 'stage1', band: 1 }, placedOutQuestIds: qs(1, 2) });
    expect(seedRoute(cutBack, STAGE1_15, paid).startQuestId).toBe(q(3));
    const gap = makeResult({ level: { stage: 'stage1', band: 1 }, placedOutQuestIds: qs(1, 3) });
    expect(seedRoute(gap, STAGE1_15, paid).startQuestId).toBe(q(2));
  });

  it('starts at the first quest when nothing is placed out', () => {
    expect(seedRoute(makeResult(), STAGE1_15, paid).startQuestId).toBe(q(1));
    expect(seedRoute(makeResult(), STAGE1_8, paid).startQuestId).toBe('quest:stage1-letters-q1');
  });

  it('skips quests the learner already completed, and quests that are not playable or not on the grid', () => {
    expect(seedRoute(makeResult(), STAGE1_15, doneOf(1, 2)).startQuestId).toBe(q(3));
    const catalog = {
      quests: [
        { ...STAGE1_15.quests[0]!, playable: false },
        { ...STAGE1_15.quests[1]!, grid: false },
        STAGE1_15.quests[2]!,
      ],
    };
    expect(seedRoute(makeResult(), catalog, paid).startQuestId).toBe(q(3));
  });

  it('follows route order whatever the catalog array order', () => {
    const reversed = { quests: [...STAGE1_15.quests].reverse() };
    expect(seedRoute(makeResult(), reversed, paid).startQuestId).toBe(q(1));
  });

  it('stage2 level: every Stage 1 quest is placed out; the start is the first entitled later quest', () => {
    const r = makeResult({ level: { stage: 'stage2', band: 0 }, placedOutQuestIds: ids(STAGE1_15.quests) });
    const seed = seedRoute(r, FULL_ROUTE, paid);
    expect(seed.startQuestId).toBe('quest:stage2-life-q1');
    expect(seed.needsStage).toBeNull();
  });

  it('free tier at stage2: no entitled start, needsStage stage2 even with no Stage 2 quest in the catalog', () => {
    const r = makeResult({ level: { stage: 'stage2', band: 0 }, placedOutQuestIds: ids(STAGE1_15.quests) });
    const seed = seedRoute(r, STAGE1_15, free);
    expect(seed.startQuestId).toBeNull();
    expect(seed.startEpisodeId).toBeNull();
    expect(seed.needsStage).toBe('stage2');
    expect(seedRoute(r, FULL_ROUTE, free).needsStage).toBe('stage2');
  });

  it('beyondContent is true at stage3', () => {
    const r = makeResult({ level: { stage: 'stage3', band: 0 }, placedOutQuestIds: ids(STAGE1_15.quests) });
    expect(seedRoute(r, STAGE1_15, paid).beyondContent).toBe(true);
  });

  it('an entitled level with nothing entitled left to play reports the stage of what remains', () => {
    const r = makeResult({ level: { stage: 'stage1', band: 3 }, placedOutQuestIds: ids(STAGE1_15.quests) });
    const seed = seedRoute(r, FULL_ROUTE, free);
    expect(seed.startQuestId).toBeNull();
    expect(seed.needsStage).toBe('stage2');
  });

  it('an entitled level with nothing at all left has no start and no needed stage', () => {
    const r = makeResult({ level: { stage: 'stage1', band: 3 } });
    const seed = seedRoute(r, STAGE1_15, { isEntitled: everyone, completedQuestIds: new Set(ids(STAGE1_15.quests)) });
    expect(seed.startQuestId).toBeNull();
    expect(seed.needsStage).toBeNull();
  });

  it('carries the listening level and works with an unknown placed-out id (a later build)', () => {
    const r = makeResult({ oralStage: 'stage3', placedOutQuestIds: ['quest:gone'] });
    const seed = seedRoute(r, STAGE1_15, paid);
    expect(seed.oralStage).toBe('stage3');
    expect(seed.startQuestId).toBe(q(1));
  });

  it('produces a seed from a result the schema accepts', () => {
    expect(PlacementResultSchema.safeParse(band1).success).toBe(true);
  });
});

describe('effectiveRoute', () => {
  const at = (n: number) => `2026-10-1${n}T10:00:00.000Z`;
  const high = makeResult({
    id: 'placement:high',
    completedAt: at(1),
    level: { stage: 'stage1', band: 3 },
    placedOutQuestIds: qs(1, 2, 3, 4, 5, 6, 7, 8, 9, 10),
    priorityTokens: ['sym:ㅓ'],
    motivation: 'kculture',
    oralStage: 'stage2',
  });
  const low = makeResult({
    id: 'placement:low',
    completedAt: at(2),
    level: { stage: 'stage1', band: 1 },
    placedOutQuestIds: qs(1, 2, 3),
    priorityTokens: ['sym:ㅡ'],
    oralStage: null,
  });

  it('is null without a result', () => {
    expect(effectiveRoute([], STAGE1_15, paid)).toBeNull();
  });

  it('with one result it equals seedRoute', () => {
    expect(effectiveRoute([high], STAGE1_15, paid)).toEqual(seedRoute(high, STAGE1_15, paid));
  });

  it('unions every result: a lower retake keeps the start, changes only the priority tokens', () => {
    const route = effectiveRoute([high, low], STAGE1_15, paid)!;
    expect(route.startQuestId).toBe(q(11));
    expect(route.placedOutQuestIds).toEqual(qs(1, 2, 3, 4, 5, 6, 7, 8, 9, 10));
    expect(route.level).toEqual({ stage: 'stage1', band: 3 });
    expect(route.priorityTokens).toEqual(['sym:ㅡ']);
    // listening is the highest any result measured; a run that did not ask it does not lower it
    expect(route.oralStage).toBe('stage2');
  });

  it('takes the highest listening level, null only when no result measured listening', () => {
    expect(effectiveRoute([low], STAGE1_15, paid)!.oralStage).toBeNull();
    const heard = makeResult({ id: 'placement:heard', completedAt: at(3), oralStage: 'stage3' });
    expect(effectiveRoute([high, low, heard], STAGE1_15, paid)!.oralStage).toBe('stage3');
    expect(effectiveRoute([heard, makeResult({ id: 'placement:later', completedAt: at(4), oralStage: 'stage1' })], STAGE1_15, paid)!.oralStage).toBe('stage3');
  });

  it('a Short taken when the route is already at band 1 or higher does not replace the priority tokens or lower the listening level', () => {
    const short = makeResult({ id: 'placement:short', completedAt: at(3), length: 'quick', mode: 'short', priorityTokens: ['skill:blending'] });
    expect(effectiveRoute([high, short], STAGE1_15, paid)!.priorityTokens).toEqual(['sym:ㅓ']);
    // listening level: the highest any result measured (3.7, P20), so a later Short never lowers it...
    const shortHeardLess = { ...short, oralStage: 'stage1' as const };
    expect(effectiveRoute([high, shortHeardLess], STAGE1_15, paid)!.oralStage).toBe('stage2');
    const shortHeardNothing = { ...short, oralStage: null };
    expect(effectiveRoute([high, shortHeardNothing], STAGE1_15, paid)!.oralStage).toBe('stage2');
    // ...and one that measured more raises it
    const highHeardLess = { ...high, oralStage: 'stage1' as const };
    expect(effectiveRoute([highHeardLess, { ...short, oralStage: 'stage2' as const }], STAGE1_15, paid)!.oralStage).toBe('stage2');
    // a legacy quick result without `mode` reads as Short
    const { mode: _m, ...legacyQuick } = short;
    expect(effectiveRoute([high, legacyQuick], STAGE1_15, paid)!.priorityTokens).toEqual(['sym:ㅓ']);
    // while the route is still at band 0, a Short can supply tokens
    const start = makeResult({ id: 'placement:start', completedAt: at(1), priorityTokens: ['sym:ㄱ'] });
    expect(effectiveRoute([start, short], STAGE1_15, paid)!.priorityTokens).toEqual(['skill:blending']);
    // a Standard or Deep retake can still move the route, so its tokens replace older ones
    const deep = makeResult({ id: 'placement:deep', completedAt: at(3), mode: 'deep', priorityTokens: ['sym:ㅠ'] });
    expect(effectiveRoute([high, deep], STAGE1_15, paid)!.priorityTokens).toEqual(['sym:ㅠ']);
  });

  it('does not depend on the array order, only on completedAt', () => {
    expect(effectiveRoute([low, high], STAGE1_15, paid)).toEqual(effectiveRoute([high, low], STAGE1_15, paid));
  });

  it('a higher retake moves the start forward and keeps the earlier motivation when the retake has none', () => {
    const higher = makeResult({
      id: 'placement:higher',
      completedAt: at(3),
      level: { stage: 'stage2', band: 0 },
      placedOutQuestIds: ids(STAGE1_15.quests),
    });
    const route = effectiveRoute([high, higher], FULL_ROUTE, paid)!;
    expect(route.level).toEqual({ stage: 'stage2', band: 0 });
    expect(route.startQuestId).toBe('quest:stage2-life-q1');
    expect(route.themeOrder[0]).toBe('rites'); // kculture, from the older result
  });

  it('the newest motivation wins', () => {
    const newer = makeResult({ id: 'placement:n', completedAt: at(3), motivation: 'curious' });
    expect(effectiveRoute([high, newer], STAGE1_15, paid)!.themeOrder[0]).toBe('letters');
  });

  it('never touches completed quests: a completed quest is never the start', () => {
    const route = effectiveRoute([low], STAGE1_15, doneOf(4, 5))!;
    expect(route.startQuestId).toBe(q(6));
    expect(route.placedOutQuestIds).toEqual(qs(1, 2, 3));
  });

  describe('parent override', () => {
    const overridden = (startQuestId: string, over: Partial<typeof high> = {}) =>
      makeResult({ id: 'placement:o', completedAt: at(2), placedOutQuestIds: [], override: { by: 'parent', at: at(2), startQuestId }, ...over });

    it('places out every grid quest before the chosen one and puts back the chosen one and all after it', () => {
      const route = effectiveRoute([high, overridden(q(2))], STAGE1_15, paid)!;
      expect(route.placedOutQuestIds).toEqual([q(1)]);
      expect(route.startQuestId).toBe(q(2));
    });

    it('can move the start earlier (the only action that can) and later', () => {
      expect(effectiveRoute([high, overridden(q(1))], STAGE1_15, paid)!.startQuestId).toBe(q(1));
      expect(effectiveRoute([low, overridden(q(8))], STAGE1_15, paid)!.startQuestId).toBe(q(8));
    });

    it('survives a later retake: the put-back quests are not placed out again', () => {
      const retake = makeResult({
        id: 'placement:r',
        completedAt: at(3),
        level: { stage: 'stage1', band: 3 },
        placedOutQuestIds: qs(1, 2, 3, 4, 5),
      });
      const route = effectiveRoute([overridden(q(3)), retake], STAGE1_15, paid)!;
      expect(route.placedOutQuestIds).toEqual(qs(1, 2));
      expect(route.startQuestId).toBe(q(3));
    });

    it('the newest override wins', () => {
      const first = overridden(q(5));
      const second = makeResult({ id: 'placement:o2', completedAt: at(4), override: { by: 'parent', at: at(4), startQuestId: q(2) } });
      expect(effectiveRoute([first, second], STAGE1_15, paid)!.startQuestId).toBe(q(2));
      expect(effectiveRoute([second, first], STAGE1_15, paid)!.startQuestId).toBe(q(2));
    });

    it('ignores an override whose quest is unknown or not on the grid (a later build)', () => {
      expect(effectiveRoute([high, overridden('quest:gone')], STAGE1_15, paid)!.startQuestId).toBe(q(11));
      expect(effectiveRoute([high, overridden('quest:shelf-tiger-q1')], FULL_ROUTE, paid)!.startQuestId).toBe(q(11));
    });

    it('does not mark non-grid quests as placed out', () => {
      const route = effectiveRoute([overridden('quest:stage4-life-q1')], FULL_ROUTE, paid)!;
      expect(route.placedOutQuestIds).not.toContain('quest:shelf-tiger-q1');
      expect(route.placedOutQuestIds).toHaveLength(17);
    });
  });
});
