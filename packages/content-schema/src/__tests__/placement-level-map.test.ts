import { describe, expect, it } from 'vitest';
import {
  coveredSymbols,
  placedOutQuestIds,
  placementLevelRank,
  placementStageNumber,
  questsPlacedOutAtLevel,
  RUNG_SYMBOLS,
  type AssessmentResponse,
  type GateResult,
  type PlacementLevel,
} from '..';
import { FULL_ROUTE, STAGE1_15, STAGE1_8, ids, q, qs } from './fixtures/stage1-15';

const pass = (gate: GateResult['gate'], form: GateResult['form'] = 'decode'): GateResult => ({
  gate,
  form,
  asked: 3,
  correct: 3,
  assisted: 0,
  result: 'pass',
});
const fail = (gate: GateResult['gate'], form: GateResult['form'] = 'decode'): GateResult => ({
  gate,
  form,
  asked: 3,
  correct: 0,
  assisted: 0,
  result: 'fail',
});

const resp = (questionId: string, outcome: AssessmentResponse['outcome'], assisted = false): AssessmentResponse => ({
  questionId,
  outcome,
  chosenOptionId: outcome === 'skipped' ? null : 'o',
  assisted,
  ms: 900,
});

const tags: Record<string, string[]> = {
  'pitem:a': ['sym:ㅏ', 'sym:ㄱ', 'syl:ga'],
  'pitem:eu': ['sym:ㅡ', 'group:basic'],
  'pitem:rest': ['sym:ㅈ', 'group:rest'],
  'pitem:fin': ['sym:ㅇ/final', 'syl:gang'],
  'pitem:plain': ['look-alike'],
};
const tagsOf = (id: string): readonly string[] => tags[id] ?? [];

const BASIC_LADDER = [pass('recog'), pass('sound-basic'), pass('syl-cv')];
const REST_LADDER = [...BASIC_LADDER, pass('sound-rest')];
const FINALS_LADDER = [...REST_LADDER, pass('syl-cvc')];

describe('placementStageNumber', () => {
  it('maps a stage key to 1 to 7', () => {
    expect(placementStageNumber('stage1')).toBe(1);
    expect(placementStageNumber('stage4')).toBe(4);
    expect(placementStageNumber('stage7')).toBe(7);
  });
});

describe('placementLevelRank', () => {
  it('orders levels by stage, then band', () => {
    const levels: PlacementLevel[] = [
      { stage: 'stage1', band: 0 },
      { stage: 'stage1', band: 3 },
      { stage: 'stage2', band: 0 },
      { stage: 'stage2', band: 1 },
      { stage: 'stage7', band: 0 },
    ];
    const ranks = levels.map(placementLevelRank);
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
    expect(new Set(ranks).size).toBe(levels.length);
  });
});

describe('coveredSymbols', () => {
  const covered = (gates: GateResult[], responses: AssessmentResponse[] = []) =>
    coveredSymbols({ gates, responses }, tagsOf);

  it('covers nothing without a pass of the owning rung', () => {
    expect(covered([]).size).toBe(0);
    expect(covered([pass('sound-basic')]).size).toBe(0); // basic needs syl-cv too
    expect(covered([pass('syl-cv')]).size).toBe(0);
    expect(covered([fail('sound-basic'), fail('syl-cv')]).size).toBe(0);
  });

  it('covers the 12 basic symbols after sound-basic and syl-cv', () => {
    expect([...covered(BASIC_LADDER)].sort()).toEqual([...RUNG_SYMBOLS.basic].sort());
  });

  it('adds the rest symbols after sound-rest and the finals after syl-cvc', () => {
    expect(covered(REST_LADDER).size).toBe(24);
    expect(covered(FINALS_LADDER).size).toBe(30);
  });

  it('credits a rung only when every earlier main rung passed (as levelOf does): a pass beyond the end of the ladder covers nothing', () => {
    expect(covered([pass('sound-rest')]).size).toBe(0);
    expect(covered([pass('syl-cvc')]).size).toBe(0);
    expect(covered([...REST_LADDER.filter((g) => g.gate !== 'syl-cv'), pass('syl-cvc')]).size).toBe(0);
    // Deep: the syl-cv confirmation failed after sound-rest's first (unconfirmed) pass
    expect(covered([...REST_LADDER, fail('syl-cv')]).size).toBe(0);
    // Deep: the sound-rest confirmation failed after syl-cvc's first (unconfirmed) pass
    expect([...covered([...FINALS_LADDER, fail('sound-rest')])].sort()).toEqual([...RUNG_SYMBOLS.basic].sort());
  });

  it('does not cut a symbol back for a prompt that could not play (noSound, section 3.11)', () => {
    const silent: AssessmentResponse = { ...resp('pitem:a', 'skipped'), noSound: true };
    expect([...covered(BASIC_LADDER, [silent])].sort()).toEqual([...RUNG_SYMBOLS.basic].sort());
  });

  it('cuts a symbol back after a wrong, skipped or assisted answer on a template tagged with it', () => {
    const wrong = covered(BASIC_LADDER, [resp('pitem:eu', 'wrong')]);
    expect(wrong.has('ㅡ')).toBe(false);
    expect(wrong.size).toBe(11);
    expect(covered(BASIC_LADDER, [resp('pitem:a', 'skipped')]).has('ㅏ')).toBe(false);
    expect(covered(BASIC_LADDER, [resp('pitem:a', 'skipped')]).has('ㄱ')).toBe(false);
    const assisted = covered(BASIC_LADDER, [resp('pitem:a', 'correct', true)]);
    expect(assisted.has('ㅏ')).toBe(false);
    expect(assisted.has('ㅡ')).toBe(true);
  });

  it('keeps a symbol covered after an unassisted correct answer, and ignores untagged or unknown questions', () => {
    const ok = covered(BASIC_LADDER, [resp('pitem:a', 'correct'), resp('pitem:plain', 'wrong'), resp('pitem:nope', 'wrong')]);
    expect(ok.size).toBe(12);
  });

  it('treats a final and its consonant as different keys', () => {
    const r = covered(FINALS_LADDER, [resp('pitem:fin', 'wrong')]);
    expect(r.has('ㅇ/final')).toBe(false);
    expect(r.has('ㅇ')).toBe(true);
    expect(covered(REST_LADDER, [resp('pitem:rest', 'wrong')]).has('ㅈ')).toBe(false);
  });
});

describe('placedOutQuestIds on the 15-quest fixture (spec 3.6 table)', () => {
  const placed = (level: PlacementLevel, covered: string[]) => placedOutQuestIds(level, new Set(covered), STAGE1_15);
  const ALL = [...RUNG_SYMBOLS.basic, ...RUNG_SYMBOLS.rest, ...RUNG_SYMBOLS.finals];

  it('row 1: nothing covered -> none placed out', () => {
    expect(placed({ stage: 'stage1', band: 0 }, [])).toEqual([]);
  });

  it('row 2: basic covered -> q1 q2 q3', () => {
    expect(placed({ stage: 'stage1', band: 1 }, [...RUNG_SYMBOLS.basic])).toEqual(qs(1, 2, 3));
  });

  it('row 3: + rest -> q1 to q6', () => {
    expect(placed({ stage: 'stage1', band: 2 }, [...RUNG_SYMBOLS.basic, ...RUNG_SYMBOLS.rest])).toEqual(qs(1, 2, 3, 4, 5, 6));
  });

  it('row 4: + finals -> q1 to q10 (q8 and q9 teach consonants and finals, all covered); q11 to q15 stay', () => {
    expect(placed({ stage: 'stage1', band: 3 }, ALL)).toEqual(qs(1, 2, 3, 4, 5, 6, 7, 8, 9, 10));
  });

  it('row 5: vocab read passed -> all 15 Stage 1 quests', () => {
    expect(placed({ stage: 'stage2', band: 0 }, ALL)).toEqual(ids(STAGE1_15.quests));
  });

  it('a wrong symbol cuts its quest back: ㅡ missing -> q3 stays, start would be q3', () => {
    const covered = RUNG_SYMBOLS.basic.filter((s) => s !== 'ㅡ');
    expect(placed({ stage: 'stage1', band: 1 }, covered)).toEqual(qs(1, 2));
  });

  it('a quest that teaches a final is cut back when only the final is missing', () => {
    const covered = ALL.filter((s) => s !== 'ㅇ/final');
    expect(placed({ stage: 'stage1', band: 3 }, covered)).toEqual(qs(1, 2, 3, 4, 5, 6, 7, 9, 10));
  });

  it('never places out a consolidation quest (empty teaches) below stage2', () => {
    expect(placed({ stage: 'stage1', band: 3 }, ALL)).not.toContain(q(11));
    expect(placed({ stage: 'stage2', band: 0 }, [])).toContain(q(11));
  });

  it('works through teaches on the 8-quest layout of today\'s bundle', () => {
    const basicOnly = placedOutQuestIds({ stage: 'stage1', band: 1 }, new Set(RUNG_SYMBOLS.basic), STAGE1_8);
    expect(basicOnly).toEqual(['quest:stage1-letters-q1', 'quest:stage1-letters-q3']); // q2 has ㅂ ㅅ (rest)
    const all = placedOutQuestIds({ stage: 'stage2', band: 0 }, new Set(), STAGE1_8);
    expect(all).toHaveLength(8);
  });

  it('stage3 also places out Stage 2 grid quests, never non-grid quests, never Stage 4', () => {
    const out = placedOutQuestIds({ stage: 'stage3', band: 0 }, new Set(), FULL_ROUTE);
    expect(out).toContain('quest:stage2-life-q1');
    expect(out).toContain('quest:stage2-nature-q1');
    expect(out).not.toContain('quest:stage4-life-q1');
    expect(out).not.toContain('quest:shelf-tiger-q1');
    const atStage2 = placedOutQuestIds({ stage: 'stage2', band: 0 }, new Set(), FULL_ROUTE);
    expect(atStage2).not.toContain('quest:stage2-life-q1');
  });

  it('keeps catalog order between quests with the same order', () => {
    const [a, b, c] = STAGE1_15.quests as [(typeof STAGE1_15.quests)[number], (typeof STAGE1_15.quests)[number], (typeof STAGE1_15.quests)[number]];
    const tied = { quests: [{ ...c, order: 1 }, { ...a, order: 1 }, { ...b, order: 1 }] };
    expect(placedOutQuestIds({ stage: 'stage2', band: 0 }, new Set(), tied)).toEqual([c.id, a.id, b.id]);
  });

  it('returns ids in route order whatever the catalog array order', () => {
    const shuffled = { quests: [...STAGE1_15.quests].reverse() };
    expect(placedOutQuestIds({ stage: 'stage1', band: 1 }, new Set(RUNG_SYMBOLS.basic), shuffled)).toEqual(qs(1, 2, 3));
  });
});

describe('questsPlacedOutAtLevel (coarse mapping without evidence)', () => {
  const at = (stage: PlacementLevel['stage'], band: PlacementLevel['band'], catalog = STAGE1_15) =>
    questsPlacedOutAtLevel({ stage, band }, catalog);

  it('returns exactly the "Placed out" column of the table', () => {
    expect(at('stage1', 0)).toEqual([]);
    expect(at('stage1', 1)).toEqual(qs(1, 2, 3));
    expect(at('stage1', 2)).toEqual(qs(1, 2, 3, 4, 5, 6));
    expect(at('stage1', 3)).toEqual(qs(1, 2, 3, 4, 5, 6, 7, 8, 9, 10));
    expect(at('stage2', 0)).toEqual(ids(STAGE1_15.quests));
  });

  it('places out Stage 2 grid quests from stage3', () => {
    expect(at('stage3', 0, FULL_ROUTE)).toEqual([...ids(STAGE1_15.quests), 'quest:stage2-life-q1', 'quest:stage2-nature-q1']);
  });

  it('does not place out anything beyond the level', () => {
    expect(at('stage2', 0, FULL_ROUTE)).toEqual(ids(STAGE1_15.quests));
  });
});
