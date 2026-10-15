import {
  discoverItemTexts,
  LECTURE_MAX_BLOCKS,
  LectureDeckSchema,
  StoryLevelSchema,
  WORD_REVIEW_MAX_QUESTS,
  WORD_REVIEW_MAX_WORDS,
  type Episode,
  type LectureBlock,
  type StageKey,
  type ThemeKey,
} from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { episodesAll, gridEpisodes } from '../../../content';
import { VOCAB_ITEMS, VOCAB_TOPICS } from '../../../content/__generated__/vocab';
import { questsAll } from '../../../content/quests';
import { storiesAll } from '../../../content/stories';
import { buildStoryIndex } from '../../story/story-index';
import type { MinigameScope } from '../../minigame-config';
import { lectureBundle } from '../content';
import { expandDeck, type LectureBundle } from '../deck-builder';

/**
 * Deck coverage ratchet (AMENDMENTS-LECTURE-V2 sections 1 and 14, row LV-2): the section 1 walk
 * over every shipped grid episode. One deck per episode (`{ kind: 'episode', id }`, seed 1, the
 * English bundle, a Korean voice present); each quest's steps go through `bundle.scopeFor` to
 * name the step kinds the builder skips and the rounds they hold.
 *
 * `BASELINE` is the section 1 table as committed by LV-0 (measured at `3b52a3969`). Per cell,
 * the `unsupported-step` skips may never exceed it, kind by kind (count and rounds); each LV-S
 * row lowers its kinds, and after LV-S4 every skip list is empty. Since LV-2 (`seenWords`) no
 * deck shows the same word card twice.
 */

type Skips = Readonly<Record<string, readonly [steps: number, rounds: number]>>;

interface CellRow {
  quests: number;
  slides: number;
  wordCards: number;
  differentWords: number;
  quiz: number;
  skipped: Skips;
  /**
   * Upper-stage Discover items that reach the class only as plain word cards, by item type: the
   * built deck has a word card for one of the item's texts and no other slide of its Discover step
   * holds any of them (so an LV-S row that gives the item a slide of its own lowers the count).
   */
  flattened: Readonly<Record<string, number>>;
}

/** Section 1, verbatim. Stage 5 is the five books together. */
const BASELINE: Readonly<Record<string, CellRow>> = {
  'stage1:letters': { quests: 3, slides: 43, wordCards: 0, differentWords: 0, quiz: 19, skipped: { 'listen-pick check': [3, 6] }, flattened: {} },
  'stage1:life': { quests: 3, slides: 49, wordCards: 12, differentWords: 12, quiz: 19, skipped: { 'listen-pick check': [3, 6] }, flattened: {} },
  'stage1:rites': { quests: 3, slides: 36, wordCards: 4, differentWords: 4, quiz: 5, skipped: { 'listen-pick': [2, 12], 'listen-pick check': [3, 6] }, flattened: {} },
  'stage1:nature': { quests: 3, slides: 32, wordCards: 16, differentWords: 14, quiz: 0, skipped: { 'listen-pick': [3, 18], 'listen-pick check': [3, 6] }, flattened: {} },
  'stage1:crafts': { quests: 3, slides: 38, wordCards: 20, differentWords: 17, quiz: 0, skipped: { 'listen-pick': [2, 12], 'listen-pick check': [3, 6] }, flattened: {} },
  'stage2:letters': { quests: 6, slides: 172, wordCards: 139, differentWords: 75, quiz: 0, skipped: { 'listen-pick check': [6, 12] }, flattened: {} },
  'stage2:life': { quests: 3, slides: 86, wordCards: 76, differentWords: 19, quiz: 0, skipped: { 'listen-pick check': [3, 6] }, flattened: {} },
  'stage2:rites': { quests: 3, slides: 83, wordCards: 70, differentWords: 15, quiz: 0, skipped: { 'listen-pick check': [3, 6] }, flattened: {} },
  'stage2:nature': { quests: 3, slides: 84, wordCards: 70, differentWords: 17, quiz: 0, skipped: { 'listen-pick check': [3, 6] }, flattened: {} },
  'stage2:crafts': { quests: 3, slides: 83, wordCards: 78, differentWords: 18, quiz: 0, skipped: { 'listen-pick check': [3, 6] }, flattened: {} },
  'stage3:letters': {
    quests: 3, slides: 16, wordCards: 11, differentWords: 11, quiz: 0,
    skipped: { 'order-it': [3, 15], 'listen-pick': [3, 12], 'listen-pick check': [3, 6] },
    flattened: { sentence: 5, pattern: 3 },
  },
  'stage3:life': { quests: 3, slides: 53, wordCards: 48, differentWords: 31, quiz: 0, skipped: { 'order-it': [3, 15], 'listen-pick check': [3, 6] }, flattened: { sentence: 6, pattern: 3 } },
  'stage3:rites': {
    quests: 3, slides: 19, wordCards: 14, differentWords: 14, quiz: 0,
    skipped: { 'order-it': [3, 15], 'listen-pick': [3, 12], 'listen-pick check': [3, 6] },
    flattened: { sentence: 6, pattern: 3 },
  },
  'stage3:nature': {
    quests: 3, slides: 17, wordCards: 12, differentWords: 12, quiz: 0,
    skipped: { 'order-it': [3, 15], 'listen-pick': [3, 12], 'listen-pick check': [3, 6] },
    flattened: { sentence: 6, pattern: 3 },
  },
  'stage3:crafts': { quests: 3, slides: 53, wordCards: 48, differentWords: 15, quiz: 0, skipped: { 'order-it': [3, 15], 'listen-pick check': [3, 6] }, flattened: { sentence: 6, pattern: 3 } },
  'stage4:letters': { quests: 3, slides: 20, wordCards: 12, differentWords: 12, quiz: 0, skipped: { 'tap-respond': [3, 9], 'listen-pick check': [3, 6] }, flattened: { exchange: 6 } },
  'stage4:life': { quests: 3, slides: 20, wordCards: 12, differentWords: 12, quiz: 0, skipped: { 'tap-respond': [3, 9], 'listen-pick check': [3, 6] }, flattened: { exchange: 6 } },
  'stage4:rites': { quests: 3, slides: 21, wordCards: 12, differentWords: 12, quiz: 0, skipped: { 'tap-respond': [3, 9], 'listen-pick check': [3, 6] }, flattened: { exchange: 6 } },
  'stage4:nature': { quests: 3, slides: 20, wordCards: 12, differentWords: 11, quiz: 0, skipped: { 'tap-respond': [3, 9], 'listen-pick check': [3, 6] }, flattened: { exchange: 6 } },
  'stage4:crafts': { quests: 3, slides: 20, wordCards: 12, differentWords: 10, quiz: 0, skipped: { 'tap-respond': [3, 9], 'listen-pick check': [3, 6] }, flattened: { exchange: 6 } },
  stage5: { quests: 14, slides: 186, wordCards: 0, differentWords: 0, quiz: 42, skipped: {}, flattened: {} },
  'stage6:letters': {
    quests: 3, slides: 16, wordCards: 11, differentWords: 11, quiz: 0,
    skipped: { 'realia-read': [3, 12], 'type-hangul': [3, 9], 'listen-pick check': [3, 6] },
    flattened: { realia: 5 },
  },
  'stage6:life': {
    quests: 3, slides: 33, wordCards: 28, differentWords: 27, quiz: 0,
    skipped: { 'realia-read': [3, 13], 'tap-respond': [2, 8], 'type-hangul': [1, 3], 'listen-pick check': [3, 6] },
    flattened: { realia: 3, exchange: 4, sentence: 2 },
  },
  'stage6:rites': {
    quests: 3, slides: 22, wordCards: 17, differentWords: 17, quiz: 0,
    skipped: { 'realia-read': [3, 15], 'type-hangul': [3, 9], 'listen-pick check': [3, 6] },
    flattened: { realia: 3 },
  },
  'stage6:nature': {
    quests: 3, slides: 20, wordCards: 15, differentWords: 15, quiz: 0,
    skipped: { 'realia-read': [3, 12], 'type-hangul': [2, 8], 'tap-respond': [1, 4], 'listen-pick check': [3, 6] },
    flattened: { realia: 4, exchange: 3 },
  },
  'stage6:crafts': {
    quests: 3, slides: 23, wordCards: 18, differentWords: 17, quiz: 0,
    skipped: { 'realia-read': [3, 12], 'type-hangul': [2, 6], 'tap-respond': [1, 4], 'listen-pick check': [3, 6] },
    flattened: { realia: 4, sentence: 5 },
  },
  'stage7:letters': {
    quests: 3, slides: 15, wordCards: 10, differentWords: 9, quiz: 0,
    skipped: { 'type-hangul': [2, 7], 'trace-word': [2, 8], 'order-it': [1, 4], 'write-frame': [1, 3], 'order-it check': [3, 6] },
    flattened: { sentence: 2, pattern: 2 },
  },
  'stage7:life': {
    quests: 3, slides: 20, wordCards: 15, differentWords: 15, quiz: 0,
    skipped: { 'type-hangul': [2, 8], 'write-frame': [2, 6], 'trace-word': [1, 4], 'order-it': [1, 4], 'order-it check': [3, 6] },
    flattened: { sentence: 2, pattern: 3 },
  },
  'stage7:rites': {
    quests: 3, slides: 19, wordCards: 14, differentWords: 13, quiz: 0,
    skipped: { 'order-it': [2, 8], 'write-frame': [2, 6], 'type-hangul': [1, 4], 'trace-word': [1, 4], 'order-it check': [3, 6] },
    flattened: { sentence: 4, pattern: 3 },
  },
  'stage7:nature': {
    quests: 3, slides: 17, wordCards: 12, differentWords: 12, quiz: 0,
    skipped: { 'order-it': [2, 8], 'type-hangul': [2, 7], 'trace-word': [1, 4], 'write-frame': [1, 3], 'order-it check': [3, 6] },
    flattened: { sentence: 6, pattern: 3 },
  },
  'stage7:crafts': {
    quests: 3, slides: 17, wordCards: 12, differentWords: 12, quiz: 0,
    skipped: { 'type-hangul': [3, 12], 'order-it': [2, 6], 'write-frame': [1, 3], 'order-it check': [3, 6] },
    flattened: { sentence: 6, pattern: 3 },
  },
};

/** The rounds a step's scope holds (section 1 counts them beside the skipped steps). */
function roundsOf(scope: MinigameScope): number {
  return (
    scope.listenPick?.rounds.length ??
    scope.orderIt?.rounds.length ??
    scope.realiaRead?.rounds.length ??
    scope.typeHangul?.rounds.length ??
    scope.traceWord?.rounds.length ??
    scope.writeFrame?.rounds.length ??
    scope.dialogue?.length ??
    scope.rounds ??
    0
  );
}

const UPPER_DISCOVER = new Set(['sentence', 'pattern', 'exchange', 'realia']);

/**
 * Every Korean text field the given slides hold (`ko` at any depth: a slide's own text, a prompt,
 * an option, a line), whole. A Discover item counts as held only when one of its texts is one of
 * these exactly, never a substring of a longer title, label or option.
 */
function koreanFields(slides: readonly unknown[]): Set<string> {
  const out = new Set<string>();
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const v of value) walk(v);
      return;
    }
    if (value === null || typeof value !== 'object') return;
    for (const [key, v] of Object.entries(value)) {
      if (key === 'ko' && typeof v === 'string') out.add(v);
      else walk(v);
    }
  };
  walk(slides);
  return out;
}

/**
 * The Worker's `lecture.*` slide bound (`LECTURE_SLIDES_MAX` in
 * `packages/backend/src/lib/server-events.ts`, AMENDMENTS-LECTURE-V2 section 11). The Worker is
 * not a dependency of the app, so the value is restated here; `server-events.test.ts` pins it there.
 */
const WORKER_SLIDES_MAX = 10_000;

interface Measured extends CellRow {
  /** Word cards beyond the first of each word in the deck. */
  repeatedWordCards: number;
}

function measure(episodes: readonly Episode[], bundle: LectureBundle): Measured {
  const row: Measured = { quests: 0, slides: 0, wordCards: 0, differentWords: 0, quiz: 0, skipped: {}, flattened: {}, repeatedWordCards: 0 };
  const skipped: Record<string, [number, number]> = {};
  const flattened: Record<string, number> = {};
  for (const episode of episodes) {
    const deck = LectureDeckSchema.parse({
      v: 1,
      id: 'lecture:coverage',
      title: 'Coverage',
      createdAt: '2026-10-15T00:00:00Z',
      seed: 1,
      blocks: [{ kind: 'episode', id: episode.id }],
    });
    const expanded = expandDeck(deck, bundle, { canPlayKorean: true });
    const words = expanded.slides.flatMap((s) => (s.kind === 'vocab' ? [s.word.ko] : []));
    row.slides += expanded.slides.length;
    row.wordCards += words.length;
    row.differentWords += new Set(words).size;
    row.repeatedWordCards += words.length - new Set(words).size;
    row.quiz += expanded.slides.filter((s) => s.kind === 'quiz').length;
    const cardKo = new Set(words);
    const ownSlides = (questId: string, stepId: string): Set<string> =>
      koreanFields(expanded.slides.filter((s) => s.kind !== 'vocab' && s.key.includes(`/${questId}/${stepId}/`)));
    const skippedRefs = expanded.skipped.filter((s) => s.reason === 'unsupported-step').map((s) => s.ref);
    for (const questId of episode.questIds) {
      const quest = bundle.questById(questId);
      if (!quest) continue;
      row.quests += 1;
      for (const step of quest.steps) {
        const stepSlides = ownSlides(questId, step.id);
        for (const item of step.discover?.pages.flatMap((p) => p.items) ?? []) {
          if (!UPPER_DISCOVER.has(item.type)) continue;
          const texts = discoverItemTexts(item).map((t) => t.ko);
          if (texts.some((ko) => cardKo.has(ko)) && !texts.some((ko) => stepSlides.has(ko))) flattened[item.type] = (flattened[item.type] ?? 0) + 1;
        }
        const scope = step.minigameRef === undefined ? undefined : bundle.scopeFor(step.minigameRef);
        if (!scope || step.minigameRef === undefined) continue;
        const at = skippedRefs.indexOf(step.minigameRef);
        if (at === -1) continue;
        skippedRefs.splice(at, 1);
        const label = step.kind === 'check' ? `${scope.kind} check` : scope.kind;
        const entry = (skipped[label] ??= [0, 0]);
        entry[0] += 1;
        entry[1] += roundsOf(scope);
      }
    }
    // A skip the walk could not name (a step with no game) still counts against the ratchet.
    for (const ref of skippedRefs) (skipped[`unnamed ${ref}`] ??= [0, 0])[0] += 1;
  }
  return { ...row, skipped, flattened };
}

function shippedCells(): Map<string, Episode[]> {
  const cells = new Map<string, Episode[]>();
  for (const episode of gridEpisodes(episodesAll)) {
    if (episode.status === 'preview' || episode.questIds.length === 0) continue;
    const key = episode.stage === 'stage5' ? 'stage5' : `${episode.stage satisfies StageKey}:${episode.theme satisfies ThemeKey}`;
    cells.set(key, [...(cells.get(key) ?? []), episode]);
  }
  return cells;
}

describe('deck coverage ratchet (AMENDMENTS-LECTURE-V2 section 1, LV-2)', () => {
  const bundle = lectureBundle('en');
  const cells = shippedCells();
  const measured = new Map([...cells].map(([key, episodes]) => [key, measure(episodes, bundle)]));

  it('walks every cell of the committed table, and no cell outside it', () => {
    expect([...cells.keys()].sort()).toEqual(Object.keys(BASELINE).sort());
    for (const [key, row] of measured) expect(row.quests, key).toBe(BASELINE[key]!.quests);
  });

  it.each(Object.keys(BASELINE))('%s: unsupported-step skips never exceed the committed table, kind by kind', (key) => {
    const now = measured.get(key)!.skipped;
    const base = BASELINE[key]!.skipped;
    for (const [kind, [steps, rounds]] of Object.entries(now)) {
      const [baseSteps, baseRounds] = base[kind] ?? [0, 0];
      expect(steps, `${key} ${kind} steps`).toBeLessThanOrEqual(baseSteps);
      expect(rounds, `${key} ${kind} rounds`).toBeLessThanOrEqual(baseRounds);
    }
  });

  it.each(Object.keys(BASELINE))('%s: one card per word per deck, and no fewer question slides than the table', (key) => {
    const row = measured.get(key)!;
    expect(row.repeatedWordCards).toBe(0);
    expect(row.wordCards).toBe(row.differentWords);
    expect(row.quiz).toBeGreaterThanOrEqual(BASELINE[key]!.quiz);
  });

  it('Discover items are flattened no more than the table counts', () => {
    for (const [key, row] of measured) {
      for (const [type, n] of Object.entries(row.flattened)) expect(n, `${key} ${type}`).toBeLessThanOrEqual(BASELINE[key]!.flattened[type] ?? 0);
    }
  });

  it('LECTURE_MAX_BLOCKS times the largest one-block deck stays under the Worker slide bound (section 11)', () => {
    const slidesOf = (v: 1 | 2, block: LectureBlock): number =>
      expandDeck(
        LectureDeckSchema.parse({ v, id: 'lecture:coverage', title: 'Coverage', createdAt: '2026-10-15T00:00:00Z', seed: 1, blocks: [block] }),
        bundle,
        { canPlayKorean: true },
      ).slides.length;
    const blocks: Array<[1 | 2, LectureBlock]> = [];
    const questIds = [...new Set([...cells.values()].flat().flatMap((e) => e.questIds))];
    for (const episodes of cells.values()) for (const e of episodes) blocks.push([1, { kind: 'episode', id: e.id }]);
    for (const id of questIds) blocks.push([1, { kind: 'quest', id }]);
    const storyIds = [...new Set(buildStoryIndex({ stories: storiesAll, episodes: episodesAll, quests: questsAll, showUnreviewed: false }).map((e) => e.storyId))];
    for (const storyId of storyIds) for (const level of StoryLevelSchema.options) blocks.push([1, { kind: 'story', storyId, level, checks: true }]);
    const readyTopics = VOCAB_TOPICS.filter((t) => t.status === 'ready' || t.status === 'shipped');
    for (const t of readyTopics) blocks.push([1, { kind: 'vocab', topicId: t.id }]);
    const readyKeys = new Set<string>(readyTopics.map((t) => t.key));
    const vocabIds = VOCAB_ITEMS.filter((i) => (i.topics as readonly string[]).some((k) => readyKeys.has(k)))
      .slice(0, WORD_REVIEW_MAX_WORDS)
      .map((i) => i.id);
    const fullReview: LectureBlock = { kind: 'word-review', questIds: questIds.slice(0, WORD_REVIEW_MAX_QUESTS), vocabIds, rounds: 10 };
    blocks.push([2, fullReview]);
    // A full Word review is 20 cards, 10 quiz slides and the End slide.
    expect(slidesOf(2, fullReview)).toBe(31);
    expect(storyIds.length).toBeGreaterThan(0);
    expect(readyTopics.length).toBeGreaterThan(0);
    const largest = Math.max(...blocks.map(([v, b]) => slidesOf(v, b)));
    expect(largest).toBeGreaterThanOrEqual(31);
    expect(LECTURE_MAX_BLOCKS * largest).toBeLessThan(WORKER_SLIDES_MAX);
  });

  it('the BASELINE constant matches the section 1 totals (pins the table text, not the builder)', () => {
    const upper = Object.entries(BASELINE).filter(([key]) => /^stage[23467]:/.test(key));
    expect(upper).toHaveLength(25);
    const steps = upper.reduce((n, [, row]) => n + Object.values(row.skipped).reduce((m, [s]) => m + s, 0), 0);
    const rounds = upper.reduce((n, [, row]) => n + Object.values(row.skipped).reduce((m, [, r]) => m + r, 0), 0);
    const flat = upper.reduce((n, [, row]) => n + Object.values(row.flattened).reduce((m, k) => m + k, 0), 0);
    expect({ slides: upper.reduce((n, [, row]) => n + row.slides, 0), steps, rounds, flat }).toEqual({ slides: 969, steps: 177, rounds: 536, flat: 141 });
  });
});
