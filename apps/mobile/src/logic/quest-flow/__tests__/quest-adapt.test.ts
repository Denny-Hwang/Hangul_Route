import type { DiscoverPage } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { afterEach, describe, expect, it } from 'vitest';
import { buildDiscover } from '../../stage1/discover-flow';
import type { MinigameScope } from '../../minigame-config';
import { adaptsIn, compactView, discoverCards } from '../pacing-view';
import {
  compactFor,
  compactSource,
  hardRound,
  noteStrongRound,
  resetQuestAdaptForTests,
  shortenScope,
  strongRound,
  tallyOf,
  type StepTry,
} from '../quest-adapt';

/** F-CURR-002 section 4.6 (row CM-24): the trigger rules, the cell's strong round, the compact page and the shorter Apply. */

const tries = (step: number, right: number, wrong: number): StepTry[] => [
  ...Array.from({ length: right }, () => ({ step, correct: true })),
  ...Array.from({ length: wrong }, () => ({ step, correct: false })),
];

afterEach(() => resetQuestAdaptForTests());

describe('the strong round: 90% or more right on the first try in Practice', () => {
  it.each([
    [9, 1, true],
    [6, 0, true],
    [18, 2, true],
    [8, 1, false],
    [5, 1, false],
    [17, 2, false],
    [3, 0, true],
    [2, 0, false],
    [0, 0, false],
  ])('%i right and %i wrong first tries: strong is %s', (right, wrong, strong) => {
    expect(strongRound(tallyOf(tries(2, right, wrong), 2))).toBe(strong);
  });

  it('counts only the step asked about', () => {
    const all = [...tries(2, 6, 0), ...tries(3, 0, 4)];
    expect(tallyOf(all, 2)).toEqual({ right: 6, wrong: 0 });
    expect(tallyOf(all, 3)).toEqual({ right: 0, wrong: 4 });
    expect(tallyOf(all, 4)).toEqual({ right: 0, wrong: 0 });
  });
});

describe('the hard round: two wrong first tries in Practice', () => {
  it.each([
    [0, false],
    [1, false],
    [2, true],
    [5, true],
  ])('%i wrong first tries: hard is %s', (wrong, hard) => {
    expect(hardRound(tallyOf(tries(2, 4, wrong), 2))).toBe(hard);
  });

  it('a round can be neither (one miss in six) and strong never goes with hard', () => {
    const t = tallyOf(tries(2, 5, 1), 2);
    expect([strongRound(t), hardRound(t)]).toEqual([false, false]);
    for (let wrong = 2; wrong < 5; wrong += 1) expect(strongRound(tallyOf(tries(2, 10, wrong), 2))).toBe(false);
  });
});

describe('where the strong round lives: per profile and cell, for the later quests', () => {
  it('makes only the later quests of the same cell compact', () => {
    noteStrongRound('p1', 'episode:stage2-life', 0);
    expect(compactFor('p1', 'episode:stage2-life', 0)).toBe(false);
    expect(compactFor('p1', 'episode:stage2-life', 1)).toBe(true);
    expect(compactFor('p1', 'episode:stage2-life', 2)).toBe(true);
    expect(compactFor('p1', 'episode:stage2-nature', 1)).toBe(false);
    expect(compactFor('p2', 'episode:stage2-life', 1)).toBe(false);
  });

  it('keeps the earliest strong quest, so a strong replay of a later quest takes nothing away', () => {
    noteStrongRound('p1', 'episode:stage3-crafts', 2);
    expect(compactFor('p1', 'episode:stage3-crafts', 1)).toBe(false);
    noteStrongRound('p1', 'episode:stage3-crafts', 0);
    noteStrongRound('p1', 'episode:stage3-crafts', 1);
    expect(compactFor('p1', 'episode:stage3-crafts', 1)).toBe(true);
    noteStrongRound('p1', 'episode:stage3-crafts', -1);
    expect(compactFor('p1', 'episode:stage3-crafts', 0)).toBe(false);
  });

  it('adapts the upper-stage lesson cells only', () => {
    expect(['episode:stage2-letters', 'episode:stage4-rites', 'episode:stage6-life', 'episode:stage7-crafts'].map(adaptsIn)).toEqual([true, true, true, true]);
    expect(['episode:stage1-letters', 'episode:stage5-rites', 'episode:shelf-seollal-new-year'].map(adaptsIn)).toEqual([false, false, false]);
  });
});

const D = getMessages('en').learner.quest.discover;
const A = getMessages('en').a11y;
const w = (ko: string, en: string): DiscoverPage['items'][number] => ({ type: 'word', word: { ko, romanization: ko, en } });

describe('the compact page', () => {
  const two: DiscoverPage = { items: [w('하늘', 'sky'), w('별', 'star')] };
  const one: DiscoverPage = { items: [w('나무', 'tree')] };
  const letters: DiscoverPage = {
    items: [
      { type: 'jamo', jamoId: 'jamo:a', example: { ko: '아이', romanization: 'ai', en: 'child' } },
      { type: 'jamo', jamoId: 'jamo:eo', example: { ko: '어머니', romanization: 'eomeoni', en: 'mother' } },
    ],
  };

  it('is a page of exactly two word cards, on the built model and on the authored page alike', () => {
    const model = buildDiscover([two, one, letters], D, A);
    expect(model.pages.map(compactView)).toEqual([true, false, false]);
    expect([two, one, letters].map(compactSource)).toEqual([true, false, false]);
    expect(compactView(undefined)).toBe(false);
    expect(compactSource(undefined)).toBe(false);
  });

  it('draws both items on one card when compact, and keeps every item', () => {
    const page = buildDiscover([two], D, A).pages[0]!;
    expect(discoverCards(page, true).map((c) => c.map((i) => i.glyph))).toEqual([['하늘', '별']]);
    expect(discoverCards(page, false).map((c) => c.map((i) => i.glyph))).toEqual([['하늘'], ['별']]);
    const single = buildDiscover([one], D, A).pages[0]!;
    expect(discoverCards(single, true)).toEqual([single.items]);
  });
});

describe('Apply one round shorter', () => {
  const lp = (n: number): MinigameScope => ({
    kind: 'listen-pick',
    rounds: n,
    listenPick: {
      rounds: Array.from({ length: n }, (_, i) => ({
        id: `r${i}`,
        prompt: { ko: '물', romanization: 'mul', en: 'water' },
        options: [
          { id: 'a', text: { ko: '물', romanization: 'mul', en: 'water' } },
          { id: 'b', text: { ko: '불', romanization: 'bul', en: 'fire' } },
        ],
        answerId: 'a',
      })),
    },
  });

  it('drops only the last round and says so in the count', () => {
    const out = shortenScope(lp(4));
    expect(out?.rounds).toBe(3);
    expect(out?.listenPick?.rounds.map((r) => r.id)).toEqual(['r0', 'r1', 'r2']);
  });

  it('keeps a scope of fewer than 3 rounds, and a kind whose rounds are one piece', () => {
    expect(shortenScope(lp(2))).toBeNull();
    expect(shortenScope({ kind: 'story-sequence', rounds: 1, storySteps: [{ id: 'a', labelEn: 'a' }, { id: 'b', labelEn: 'b' }, { id: 'c', labelEn: 'c' }] })).toBeNull();
    expect(shortenScope({ kind: 'build-letter', rounds: 3, syllables: [] })).toBeNull();
    expect(shortenScope({ kind: 'realia-read' })).toBeNull();
  });

  it('shortens every kind of a shipped Apply that has rounds of its own', () => {
    const k = { ko: '물', romanization: 'mul', en: 'water' };
    const four = <T,>(make: (i: number) => T): T[] => Array.from({ length: 4 }, (_, i) => make(i));
    const scopes: MinigameScope[] = [
      { kind: 'pic-word-match', picWord: { boards: four(() => ({ pairs: [] })) } },
      { kind: 'order-it', orderIt: { rounds: four((i) => ({ id: `o${i}`, sentence: k, distractors: [] })) } },
      { kind: 'type-hangul', typeHangul: { rounds: four((i) => ({ id: `t${i}`, promptEn: 'x', target: k })) } },
      { kind: 'write-frame', writeFrame: { rounds: four((i) => ({ id: `w${i}` }) as never) } },
      { kind: 'card-match', cardPairs: four((i) => ({ ko: `${i}`, en: `${i}` })) },
      { kind: 'tap-respond', dialogue: four((i) => ({ npcKo: `${i}`, npcEn: `${i}`, options: [] })) },
    ];
    const lengths = scopes.map((s) => {
      const out = shortenScope(s)!;
      return [out.picWord?.boards, out.orderIt?.rounds, out.typeHangul?.rounds, out.writeFrame?.rounds, out.cardPairs, out.dialogue].find((l) => l !== undefined)?.length;
    });
    expect(lengths).toEqual([3, 3, 3, 3, 3, 3]);
  });
});
