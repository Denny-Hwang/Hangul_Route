import {
  CATALOG,
  discoverItemTexts,
  LECTURE_MAX_BLOCKS,
  LECTURE_PRESETS,
  LectureDeckSchema,
  PRESET_LENGTHS,
  presetDeck,
  resolvePreset,
  StageKeySchema,
  StoryLevelSchema,
  WORD_REVIEW_MAX_QUESTS,
  WORD_REVIEW_MAX_WORDS,
  type Episode,
  type LectureBlock,
  type PresetContext,
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
import { expandDeck, readingSlideKey, type LectureBundle } from '../deck-builder';

/**
 * Deck coverage ratchet (AMENDMENTS-LECTURE-V2 sections 1 and 14, row LV-2): the section 1 walk
 * over every shipped grid episode. One deck per episode (`{ kind: 'episode', id }`, seed 1, the
 * English bundle, a Korean voice present); each quest's steps go through `bundle.scopeFor` to
 * name the step kinds the builder skips and the rounds they hold.
 *
 * `BASELINE` is the section 1 table as committed by LV-0 (measured at `3b52a3969`). Per cell,
 * the `unsupported-step` skips may never exceed it, kind by kind (count and rounds); each LV-S
 * row lowers its kinds, and after LV-S4 every skip list is empty. Since LV-2 (`seenWords`) no
 * deck shows the same word card twice. LV-S1 lowered every `flattened` count to zero: each
 * upper-stage Discover sentence, pattern, exchange and realia item has a reading slide of its own
 * (section 1 counted 141 at LV-0: 56 sentences, 37 exchanges, 29 patterns, 19 realia). LV-S2
 * emptied the listen-pick (practice, apply and Check), tap-respond and realia-read entries: each
 * round is a question slide now, and each cell's `quiz` column is the floor it builds since then.
 * LV-S3 emptied the order-it entries (practice, apply and the Stage 7 Check): each round is a
 * sentence-build slide now. LV-S4 emptied the last ones, type-hangul, trace-word and write-frame:
 * each round is a write-together slide now, so the table is all zero (section 5.1: "expected count
 * after LV-S4: 0"), and any skipped step fails.
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

/**
 * Section 1, verbatim, with the rows the LV-S rows lowered (LV-S1: no Discover item flattened; LV-S2:
 * no listen-pick, tap-respond or realia-read step skipped, and each cell's question floor raised to
 * what it builds now; LV-S3: no order-it step skipped; LV-S4: no step skipped at all). Stage 5 is the five books together.
 */
const BASELINE: Readonly<Record<string, CellRow>> = {
  'stage1:letters': { quests: 3, slides: 43, wordCards: 0, differentWords: 0, quiz: 25, skipped: {}, flattened: {} },
  'stage1:life': { quests: 3, slides: 49, wordCards: 12, differentWords: 12, quiz: 25, skipped: {}, flattened: {} },
  'stage1:rites': { quests: 3, slides: 36, wordCards: 4, differentWords: 4, quiz: 23, skipped: {}, flattened: {} },
  'stage1:nature': { quests: 3, slides: 32, wordCards: 16, differentWords: 14, quiz: 24, skipped: {}, flattened: {} },
  'stage1:crafts': { quests: 3, slides: 38, wordCards: 20, differentWords: 17, quiz: 18, skipped: {}, flattened: {} },
  'stage2:letters': { quests: 6, slides: 172, wordCards: 139, differentWords: 75, quiz: 16, skipped: {}, flattened: {} },
  'stage2:life': { quests: 3, slides: 86, wordCards: 76, differentWords: 19, quiz: 19, skipped: {}, flattened: {} },
  'stage2:rites': { quests: 3, slides: 83, wordCards: 70, differentWords: 15, quiz: 20, skipped: {}, flattened: {} },
  'stage2:nature': { quests: 3, slides: 84, wordCards: 70, differentWords: 17, quiz: 15, skipped: {}, flattened: {} },
  'stage2:crafts': { quests: 3, slides: 83, wordCards: 78, differentWords: 18, quiz: 28, skipped: {}, flattened: {} },
  'stage3:letters': {
    quests: 3, slides: 16, wordCards: 11, differentWords: 11, quiz: 18,
    skipped: {},
    flattened: {},
  },
  'stage3:life': { quests: 3, slides: 53, wordCards: 48, differentWords: 31, quiz: 6, skipped: {}, flattened: {} },
  'stage3:rites': {
    quests: 3, slides: 19, wordCards: 14, differentWords: 14, quiz: 18,
    skipped: {},
    flattened: {},
  },
  'stage3:nature': {
    quests: 3, slides: 17, wordCards: 12, differentWords: 12, quiz: 18,
    skipped: {},
    flattened: {},
  },
  'stage3:crafts': { quests: 3, slides: 53, wordCards: 48, differentWords: 15, quiz: 10, skipped: {}, flattened: {} },
  'stage4:letters': { quests: 3, slides: 20, wordCards: 12, differentWords: 12, quiz: 15, skipped: {}, flattened: {} },
  'stage4:life': { quests: 3, slides: 20, wordCards: 12, differentWords: 12, quiz: 15, skipped: {}, flattened: {} },
  'stage4:rites': { quests: 3, slides: 21, wordCards: 12, differentWords: 12, quiz: 15, skipped: {}, flattened: {} },
  'stage4:nature': { quests: 3, slides: 20, wordCards: 12, differentWords: 11, quiz: 15, skipped: {}, flattened: {} },
  'stage4:crafts': { quests: 3, slides: 20, wordCards: 12, differentWords: 10, quiz: 15, skipped: {}, flattened: {} },
  stage5: { quests: 14, slides: 186, wordCards: 0, differentWords: 0, quiz: 42, skipped: {}, flattened: {} },
  'stage6:letters': {
    quests: 3, slides: 16, wordCards: 11, differentWords: 11, quiz: 18,
    skipped: {},
    flattened: {},
  },
  'stage6:life': {
    quests: 3, slides: 33, wordCards: 28, differentWords: 27, quiz: 27,
    skipped: {},
    flattened: {},
  },
  'stage6:rites': {
    quests: 3, slides: 22, wordCards: 17, differentWords: 17, quiz: 21,
    skipped: {},
    flattened: {},
  },
  'stage6:nature': {
    quests: 3, slides: 20, wordCards: 15, differentWords: 15, quiz: 22,
    skipped: {},
    flattened: {},
  },
  'stage6:crafts': {
    quests: 3, slides: 23, wordCards: 18, differentWords: 17, quiz: 22,
    skipped: {},
    flattened: {},
  },
  'stage7:letters': {
    quests: 3, slides: 15, wordCards: 10, differentWords: 9, quiz: 0,
    skipped: {},
    flattened: {},
  },
  'stage7:life': {
    quests: 3, slides: 20, wordCards: 15, differentWords: 15, quiz: 0,
    skipped: {},
    flattened: {},
  },
  'stage7:rites': {
    quests: 3, slides: 19, wordCards: 14, differentWords: 13, quiz: 0,
    skipped: {},
    flattened: {},
  },
  'stage7:nature': {
    quests: 3, slides: 17, wordCards: 12, differentWords: 12, quiz: 0,
    skipped: {},
    flattened: {},
  },
  'stage7:crafts': {
    quests: 3, slides: 17, wordCards: 12, differentWords: 12, quiz: 0,
    skipped: {},
    flattened: {},
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

  it('Discover items are flattened no more than the table counts (none since LV-S1)', () => {
    for (const [key, row] of measured) {
      for (const [type, n] of Object.entries(row.flattened)) expect(n, `${key} ${type}`).toBeLessThanOrEqual(BASELINE[key]!.flattened[type] ?? 0);
      expect(row.flattened, key).toEqual({});
    }
  });

  it('every upper-stage Discover sentence, pattern, exchange and realia item has its own reading slide (LV-S1)', () => {
    const want = { sentence: 'sentence', pattern: 'pattern', exchange: 'read-along', realia: 'realia' } as const;
    const counts = { sentence: 0, pattern: 0, exchange: 0, realia: 0 };
    for (const episodes of cells.values()) {
      for (const episode of episodes) {
        const deck = LectureDeckSchema.parse({ v: 1, id: 'lecture:coverage', title: 'Coverage', createdAt: '2026-10-15T00:00:00Z', seed: 1, blocks: [{ kind: 'episode', id: episode.id }] });
        const expanded = expandDeck(deck, bundle, { canPlayKorean: true });
        for (const questId of episode.questIds) {
          for (const step of bundle.questById(questId)?.steps ?? []) {
            step.discover?.pages.forEach((page, p) =>
              page.items.forEach((item, i) => {
                if (!(item.type in want)) return;
                const type = item.type as keyof typeof want;
                counts[type] += 1;
                const own = `/${questId}/${step.id}/${readingSlideKey(item, p, i)}`;
                const slide = expanded.slides.find((s) => s.key.replace(/#\d+$/, '').endsWith(own) && s.kind === want[type]);
                expect(slide?.kind, `${questId} ${step.id} ${type} ${p + 1}-${i + 1}`).toBe(want[type]);
              }),
            );
          }
        }
        expect(expanded.skipped.filter((s) => s.reason === 'no-romanization'), episode.id).toEqual([]);
        // Every key is a saveable resume key (recent.ts: at most 256 characters).
        for (const s of expanded.slides) expect(s.key.length, s.key).toBeLessThanOrEqual(256);
      }
    }
    // Section 1 counted 141 flattened items; Discover pages hold these and more (a sentence a card already showed was never counted).
    expect(counts.sentence + counts.pattern + counts.exchange + counts.realia).toBeGreaterThanOrEqual(141);
  });

  it('after LV-S4 the committed table is all zero, and no cell skips a step (section 5.1: expected count after LV-S4: 0)', () => {
    for (const [key, row] of Object.entries(BASELINE)) expect(row.skipped, key).toEqual({});
    for (const [key, row] of measured) expect(row.skipped, key).toEqual({});
  });

  it('every shipped type-hangul, trace-word and write-frame round has its own write-together slide (LV-S4)', () => {
    const counts = { type: 0, trace: 0, frame: 0, 'own-name': 0 };
    let rounds = 0;
    for (const episodes of cells.values()) {
      for (const episode of episodes) {
        const deck = LectureDeckSchema.parse({ v: 1, id: 'lecture:coverage', title: 'Coverage', createdAt: '2026-10-15T00:00:00Z', seed: 1, blocks: [{ kind: 'episode', id: episode.id }] });
        const expanded = expandDeck(deck, bundle, { canPlayKorean: true });
        for (const questId of episode.questIds) {
          for (const step of bundle.questById(questId)?.steps ?? []) {
            const scope = step.minigameRef === undefined ? undefined : bundle.scopeFor(step.minigameRef);
            const ids = [...(scope?.typeHangul?.rounds ?? []), ...(scope?.traceWord?.rounds ?? []), ...(scope?.writeFrame?.rounds ?? [])].map((r) => r.id);
            for (const id of ids) {
              rounds += 1;
              const slide = expanded.slides.find((s) => s.kind === 'write-together' && s.key.replace(/#\d+$/, '').endsWith(`/${questId}/${step.id}/${id}`));
              expect(slide?.kind, `${questId} ${step.id} ${id}`).toBe('write-together');
              if (slide?.kind === 'write-together') counts[slide.variant] += 1;
            }
          }
        }
      }
    }
    // Section 1: type-hangul 21 steps holding 73 rounds, write-frame 7 holding 21, trace-word 5 holding 20; one write-frame round is the name round.
    expect({ rounds, ...counts }).toEqual({ rounds: 114, type: 73, trace: 20, frame: 20, 'own-name': 1 });
  });

  it('every shipped order-it round, the Stage 7 Checks included, has its own sentence-build slide (LV-S3)', () => {
    let rounds = 0;
    let built = 0;
    for (const episodes of cells.values()) {
      for (const episode of episodes) {
        const deck = LectureDeckSchema.parse({ v: 1, id: 'lecture:coverage', title: 'Coverage', createdAt: '2026-10-15T00:00:00Z', seed: 1, blocks: [{ kind: 'episode', id: episode.id }] });
        const expanded = expandDeck(deck, bundle, { canPlayKorean: true });
        for (const questId of episode.questIds) {
          for (const step of bundle.questById(questId)?.steps ?? []) {
            const scope = step.minigameRef === undefined ? undefined : bundle.scopeFor(step.minigameRef);
            for (const round of scope?.orderIt?.rounds ?? []) {
              rounds += 1;
              const slide = expanded.slides.find((s) => s.kind === 'sentence-build' && s.key.replace(/#\d+$/, '').endsWith(`/${questId}/${step.id}/${round.id}`));
              if (slide?.kind !== 'sentence-build') continue;
              built += 1;
              // Its tiles are the sentence's words, and its bank holds each of them once.
              expect(slide.tiles.map((t) => t.ko).join(' '), slide.key).toBe(round.sentence.ko.replace(/[.?!]+$/, ''));
              expect(slide.bank.flatMap((p) => ('tile' in p ? [p.tile] : [])).sort(), slide.key).toEqual(slide.tiles.map((_, i) => i));
            }
          }
        }
      }
    }
    // Section 1: 23 order-it steps holding 105 rounds and 15 Stage 7 Checks holding 30.
    expect({ rounds, built }).toEqual({ rounds: 135, built: 135 });
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

  /**
   * Section 16 "Upper-stage pace", measured after LV-S4: every preset at every length, on a first visit and
   * at each stage, against a room's pace of `ROOM_PACE` slides a minute (rule 12's own count for blocks that
   * are not quests: `ceil(slides / 2)` minutes, section 4.4). Section 16: when a preset runs more than 50 %
   * over (more than 1.5 times that pace), a follow-up adds a per-preset slide cap. As measured at LV-S4 (PR
   * body): By stage runs over at Stage 2 at every length (51, 108 and 137 slides for 10, 20 and 30 minutes:
   * 2.55, 2.70 and 2.28 times) and, by a little, at Stage 1 (1.55 to 1.70 times) and Stage 3 at 10 and 30
   * minutes (1.55, 1.62); so does Next lesson at 10 minutes (with no plan or position it starts at Stage 1:
   * 31 slides, 1.55 times); every other preset is within. This test keeps the measurement running and fails only past `PACE_CEILING`, three times
   * the pace, which no preset is near; the cap itself is the follow-up's.
   */
  it('section 16 upper-stage pace: every preset and length measured against a room pace, none past the ceiling', () => {
    const ROOM_PACE = 2;
    const PACE_CEILING = 3;
    const meta = { id: 'lecture:pace0001', title: 'Pace', createdAt: '2026-10-20T09:00:00Z', seed: 7, source: 'quick' as const };
    const contexts: PresetContext[] = [{ catalog: CATALOG }, ...StageKeySchema.options.map((stage): PresetContext => ({ catalog: CATALOG, stage }))];
    const over: string[] = [];
    let measuredDecks = 0;
    for (const preset of LECTURE_PRESETS) {
      for (const length of PRESET_LENGTHS[preset]) {
        for (const ctx of contexts) {
          const resolved = resolvePreset(preset, length, ctx);
          const slides = expandDeck(LectureDeckSchema.parse(presetDeck(resolved, meta)), bundle, { canPlayKorean: true }).slides.length;
          measuredDecks += 1;
          expect(slides, `${preset} ${length}`).toBeGreaterThan(0);
          const pace = slides / (ROOM_PACE * resolved.minutes);
          if (pace > PACE_CEILING) over.push(`${preset} ${length} ${ctx.stage ?? 'first visit'}: ${slides} slides`);
        }
      }
    }
    expect(measuredDecks).toBe(Object.values(PRESET_LENGTHS).reduce((n, lengths) => n + lengths.length, 0) * contexts.length);
    expect(over).toEqual([]);
  });

  it('the BASELINE constant matches the section 1 totals, less what the LV-S rows lowered (pins the table text, not the builder)', () => {
    const upper = Object.entries(BASELINE).filter(([key]) => /^stage[23467]:/.test(key));
    expect(upper).toHaveLength(25);
    const steps = upper.reduce((n, [, row]) => n + Object.values(row.skipped).reduce((m, [s]) => m + s, 0), 0);
    const rounds = upper.reduce((n, [, row]) => n + Object.values(row.skipped).reduce((m, [, r]) => m + r, 0), 0);
    const flat = upper.reduce((n, [, row]) => n + Object.values(row.flattened).reduce((m, k) => m + k, 0), 0);
    // Section 1: 969 slides, 177 skipped steps holding 536 rounds and 141 flattened Discover items; LV-S1 lowered the 141 to 0;
    // LV-S2 took out the 106 listen-pick, tap-respond and realia-read steps (287 rounds); LV-S3 the 38 order-it steps (135 rounds:
    // 23 practice and apply steps holding 105, 15 Stage 7 Checks holding 30); LV-S4 the last 33 (114 rounds: type-hangul 21 / 73,
    // write-frame 7 / 21, trace-word 5 / 20).
    expect({ slides: upper.reduce((n, [, row]) => n + row.slides, 0), steps, rounds, flat }).toEqual({ slides: 969, steps: 0, rounds: 0, flat: 0 });
  });
});
