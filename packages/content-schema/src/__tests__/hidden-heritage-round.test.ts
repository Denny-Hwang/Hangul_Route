import { describe, expect, it } from 'vitest';
import { lessonOccurrences } from '../review-items/extract';
import {
  localize,
  overlayTargets,
  HIDDEN_HERITAGE_SPOT,
  HiddenHeritageRoundSchema,
  LessonScopeSchema,
  MinigameKindSchema,
  RoundSchema,
  scopeRoundCount,
  spotGap,
  type HiddenHeritageRound,
} from '../index';

/**
 * Hidden Heritage (F-CURR-002 §7.1 F7, row CM-36; design/wireframes/minigame/hidden-heritage.md): the round names
 * one scene and every thing in it with a hit area, its targets with their taught Korean word and the bundled picture
 * the Pic-Word Match fallback draws, and the other things with the word whose meaning names their spot.
 */

const word = (ko: string, romanization: string, en: string) => ({ ko, romanization, en });
const spot = (x: number, y: number, w = 80, h = 80) => ({ x, y, w, h });

/** The Food market scene's reference round, in the shape a lesson writes it. */
function round(): HiddenHeritageRound {
  return {
    id: 'hh1',
    sceneId: 'scene:food-market',
    altEn: 'A food stall on a market day.',
    targets: [
      { id: 'bap', word: word('밥', 'bap', 'rice'), spot: spot(10, 170), picture: 'card:bap' },
      { id: 'guk', word: word('국', 'guk', 'soup'), spot: spot(105, 170), picture: 'word:guk' },
      { id: 'sutgarak', word: word('숟가락', 'sutgarak', 'spoon'), spot: spot(300, 170), picture: 'word:sutgarak' },
    ],
    others: [
      { id: 'banchan', word: word('반찬', 'banchan', 'side dishes'), spot: spot(200, 170) },
      { id: 'hangari', word: word('항아리', 'hangari', 'jar'), spot: spot(40, 50) },
      { id: 'baguni', word: word('바구니', 'baguni', 'basket'), spot: spot(280, 50) },
    ],
  };
}

const issues = (value: unknown): string[] => {
  const result = HiddenHeritageRoundSchema.safeParse(value);
  return result.success ? [] : result.error.issues.map((i) => i.message);
};

describe('the hidden-heritage kind (row CM-36)', () => {
  it('is added at the end of the kind list, after every kind that shipped', () => {
    expect(MinigameKindSchema.options.at(-1)).toBe('hidden-heritage');
    expect(MinigameKindSchema.options.indexOf('write-frame')).toBeLessThan(MinigameKindSchema.options.indexOf('hidden-heritage'));
  });

  it('is a Round kind and a lesson scope kind; a scope plays one find per target', () => {
    expect(RoundSchema.safeParse({ kind: 'hidden-heritage', data: round() }).success).toBe(true);
    const scope = LessonScopeSchema.parse({ ref: 'minigame:s2-life-q1-practice', kind: 'hidden-heritage', rounds: [round()] });
    expect(scopeRoundCount(scope)).toBe(3);
  });
});

describe('HiddenHeritageRoundSchema', () => {
  it('accepts the reference round', () => {
    expect(issues(round())).toEqual([]);
  });

  it('holds 3-5 targets and 3-6 other things, never fewer others than targets', () => {
    const r = round();
    expect(issues({ ...r, targets: r.targets.slice(0, 2) }).length).toBeGreaterThan(0);
    expect(issues({ ...r, others: r.others.slice(0, 2) }).length).toBeGreaterThan(0);
    const fourTargets = { ...r, targets: [...r.targets, { id: 'jeotgarak', word: word('젓가락', 'jeotgarak', 'chopsticks'), spot: spot(300, 50 + 0), picture: 'word:jeotgarak' }] };
    // Moved clear of the basket so only the count rule speaks.
    fourTargets.targets[3]!.spot = spot(170, 50);
    expect(issues(fourTargets)).toContain('fewer other things than targets');
  });

  it('needs a picture for every target, the Pic-Word Match fallback board (wireframe "States")', () => {
    const r = round();
    const { picture: _gone, ...noPicture } = r.targets[0]!;
    expect(issues({ ...r, targets: [noPicture, ...r.targets.slice(1)] }).length).toBeGreaterThan(0);
  });

  it('keeps every thing id unique and never asks one word twice', () => {
    const r = round();
    expect(issues({ ...r, others: [{ ...r.others[0]!, id: 'bap' }, ...r.others.slice(1)] })).toContain('thing ids repeat');
    expect(issues({ ...r, others: [{ ...r.others[0]!, word: word('국', 'guk', 'soup') }, ...r.others.slice(1)] })).toContain('two things share a word');
  });

  it('H-1: every spot is at least 75 x 75 canvas units', () => {
    expect(HIDDEN_HERITAGE_SPOT.min).toBe(75);
    const r = round();
    r.others[1]!.spot = spot(40, 50, 74, 80);
    expect(issues(r).length).toBeGreaterThan(0);
  });

  it('H-4: every spot lies inside the 400 x 300 canvas', () => {
    const r = round();
    r.others[2]!.spot = spot(330, 50);
    expect(issues(r)).toContain('a spot lies inside the 400 x 300 canvas');
  });

  it('H-2: spots never overlap and keep 11 units apart', () => {
    expect(HIDDEN_HERITAGE_SPOT.gap).toBe(11);
    expect(spotGap(spot(0, 0), spot(91, 0))).toBe(11);
    expect(spotGap(spot(0, 0), spot(40, 40))).toBe(0);
    const r = round();
    r.targets[1]!.spot = spot(100, 170);
    expect(issues(r)).toContain('spots bap and guk too close');
  });

  it('has no focal point: at least one target in each half of the scene', () => {
    const r = round();
    r.targets[2]!.spot = spot(10, 50);
    r.others[1]!.spot = spot(300, 170);
    expect(issues(r)).toContain('a target in each half');
  });

  it('describes the setting in the alt text, never the things, with no Hangul and no "Image of"', () => {
    expect(issues({ ...round(), altEn: 'Image of a market.' })).toContain('altEn: no Hangul, no "Image of"');
    expect(issues({ ...round(), altEn: '시장 A market.' })).toContain('altEn: no Hangul, no "Image of"');
    expect(issues({ ...round(), altEn: 'x'.repeat(141) }).length).toBeGreaterThan(0);
  });
});

describe('a lesson scope of Hidden Heritage in the overlays and the review items', () => {
  const scope = { kind: 'hidden-heritage', hiddenHeritage: { rounds: [round()] } };
  const ref = 'minigame:s2-life-q1-practice';

  it('translates the alt text and the meaning of every thing, never its Korean (the minigame overlay fields)', () => {
    const fields = {
      'hiddenHeritage.rounds.hh1.alt': 'Un puesto de comida en un día de mercado.',
      'hiddenHeritage.rounds.hh1.targets.bap.word.gloss': 'arroz cocido',
      'hiddenHeritage.rounds.hh1.others.hangari.word.gloss': 'tinaja',
    };
    for (const field of Object.keys(fields)) expect(overlayTargets(scope, field), field).toHaveLength(1);
    const out = localize(scope, ref, 'es', { es: { [ref]: fields }, ko: {} });
    const r = out.hiddenHeritage.rounds[0]!;
    expect(r.altEn).toBe('Un puesto de comida en un día de mercado.');
    expect(r.targets[0]!.word).toEqual({ ko: '밥', romanization: 'bap', en: 'arroz cocido' });
    expect(r.others[1]!.word.en).toBe('tinaja');
    expect(r.targets[1]!.word.en).toBe('soup');
  });

  it('makes each target an item of the round, glossed at its overlay field, and leaves the other things out', () => {
    const body = {
      quests: [
        {
          id: 'quest:stage2-life-q1',
          steps: [{ id: 's3', kind: 'practice', minigameRef: ref }],
          scopes: [{ ref, kind: 'hidden-heritage', rounds: [round()] }],
        },
      ],
    };
    const occs = lessonOccurrences({ file: 'content/episodes/stage-2/life.json', body, cellId: 'episode:stage2-life', stage: 2, home: 'life', volume: 2 }, []);
    expect(occs.filter((o) => o.source === 'round').map((o) => [o.ko, o.glossKey, o.picture])).toEqual([
      ['밥', `${ref}#hiddenHeritage.rounds.hh1.targets.bap.word.gloss`, 'card:bap'],
      ['국', `${ref}#hiddenHeritage.rounds.hh1.targets.guk.word.gloss`, 'word:guk'],
      ['숟가락', `${ref}#hiddenHeritage.rounds.hh1.targets.sutgarak.word.gloss`, 'word:sutgarak'],
    ]);
  });
});
