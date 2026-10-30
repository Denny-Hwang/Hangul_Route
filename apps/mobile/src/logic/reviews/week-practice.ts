import type { UiLocale } from '@hangul-route/content-schema';
import type { MemoryFile } from '../memory/memory-file';
import type { MemoryAnswer } from '../memory/memory-runtime';
import { localDay, vocabOf } from '../vocab/progress';
import { memoryAnswerOf, type RoundAnswer } from './daily-review';
import { buildCheck, engineStates, type EngineContext, type SourceVisibility } from './engine';
import { glossFrom, roundFor, surfaceIndex, type ReviewRound } from './review-rounds';
import type { ReviewItemIndex } from './review-items-store';

/**
 * The practice of a "This week in Korea" drop (F-CURR-002 §5.7, row CM-48; design/wireframes/home/this-week-in-korea.md
 * C): about 5 quick rounds over the drop's own items (the items whose `cells` name `week:<monday>`), planned by the
 * review engine's Check selector at the recognize or read rung (`maxRung: 'read'`, the warm-up's quick picks) and drawn
 * with the shipped round views. Each round's first answer goes to the memory store (`recordAnswers`, the CM-12 spacing
 * rule), so the words enter review in the `week` shard (section 4.8); with `memoryRecord` off the practice still plays
 * from no states and records nothing.
 *
 * It lives in the memory chunk (`logic/memory/memory-chunk.ts` builds it), with the engine, so no scheduler module is
 * shared by two chunks; the drop's screen chunk reaches it through `memoryChunk()` of the boot module.
 */

/** Fewer playable rounds than this and the practice is skipped (the Meet page goes straight to Done). */
export const WEEK_PRACTICE_MIN_ROUNDS = 3;
/** At most this many rounds: one per item of a drop (section 5.7: about 5 items). */
export const WEEK_PRACTICE_MAX_ROUNDS = 6;
const REBUILD_TRIES = 4;

export interface WeekPractice {
  cell: string;
  rounds: ReviewRound[];
  /** The engine's sound notice (F-AUDIO-004). */
  soundNotice: boolean;
}

export interface WeekPracticeDeps {
  items(): Promise<ReviewItemIndex>;
  /** Whether the profile's answers are recorded now (`memoryRecord`, a learner). */
  records(profileId: string): boolean;
  hydrate(profileId: string): Promise<void>;
  ensureSeeded(profileId: string): Promise<void>;
  file(profileId: string): Promise<MemoryFile | null>;
  vocab(profileId: string): Parameters<typeof vocabOf>[0] | undefined;
  voice(): boolean;
  visibility(profileId: string): SourceVisibility;
  overlays(locale: 'es' | 'ko'): Readonly<Record<string, Readonly<Record<string, string>>>>;
  /** Loads the chunk that holds a cell's es and ko meanings (a lesson cell, or the week drops); rejects when it cannot. */
  ensureCell(cell: string): Promise<void>;
  recordAnswers(profileId: string, answers: readonly MemoryAnswer[]): Promise<void>;
}

export interface WeekPracticeApi {
  /** The practice of the drop's cell; null when fewer than 3 rounds can be played (the items cannot load, say). */
  plan(profileId: string, cell: string, locale: UiLocale, now?: Date): Promise<WeekPractice | null>;
  /** Records a round's first answer now (only while the profile records), so a stopped practice keeps it. */
  record(profileId: string, practice: WeekPractice, index: number, answer: RoundAnswer): Promise<void>;
}

/** The items a drop teaches, in index order (retired ones left out). */
export function weekItemIds(index: EngineContext['index'], cell: string): string[] {
  return index.items.filter((i) => i.cells.includes(cell) && !index.retired.has(i.id)).map((i) => i.id);
}

/** Pure: the rounds the engine's Check selector gives over the drop's items, leaving out any that cannot be drawn. */
export function planWeekPractice(ctx: EngineContext, cell: string, gloss: ReturnType<typeof glossFrom>, exclude: ReadonlySet<string> = new Set()): WeekPractice | null {
  const skipped = new Set<string>(exclude);
  const seed = `${ctx.seed ?? ''}|${cell}`;
  let best: ReviewRound[] = [];
  for (let attempt = 0; attempt < REBUILD_TRIES; attempt += 1) {
    const ids = weekItemIds(ctx.index, cell).filter((id) => !skipped.has(id));
    const session = buildCheck(ctx, { itemIds: ids, size: WEEK_PRACTICE_MAX_ROUNDS, produceShare: 0 });
    if (session.questions.length === 0) break;
    const built = session.questions.map((q) => ({ q, round: roundFor(q, { gloss, seed, index: ctx.index, states: ctx.states }) }));
    best = built.flatMap((b) => (b.round ? [b.round] : []));
    if (best.length === session.questions.length) break;
    for (const b of built) if (b.round === null) skipped.add(b.q.itemId);
  }
  return best.length < WEEK_PRACTICE_MIN_ROUNDS ? null : { cell, rounds: best, soundNotice: best.some((r) => r.question.voiceFallback) };
}

export function createWeekPracticeApi(deps: WeekPracticeDeps): WeekPracticeApi {
  /** The cells whose chunks hold an item's es and ko meanings: its lesson cells and its week drops. */
  const glossCells = (ctx: EngineContext, id: string): string[] => (ctx.index.byId.get(id)?.cells ?? []).filter((c) => c.startsWith('episode:') || c.startsWith('week:'));

  async function contextOf(profileId: string, now: Date): Promise<EngineContext> {
    const index = await deps.items();
    let rows: MemoryFile['rows'] = {};
    if (deps.records(profileId)) {
      await deps.hydrate(profileId);
      await deps.ensureSeeded(profileId);
      rows = (await deps.file(profileId))?.rows ?? {};
    }
    const vocab = deps.vocab(profileId);
    const states = engineStates(rows, vocab ? vocabOf(vocab) : undefined);
    const today = localDay(now);
    // The drop's own surface is open, so its cells are shown whatever the rest of the visibility says.
    return { index: surfaceIndex(index, {}, states), states, today, voice: deps.voice(), seed: `${profileId}|${today}`, visibility: { ...deps.visibility(profileId), weeklyDrop: true }, maxRung: 'read' };
  }

  return {
    async plan(profileId, cell, locale, now = new Date()) {
      let ctx: EngineContext;
      try {
        ctx = await contextOf(profileId, now);
      } catch {
        return null;
      }
      let plan = planWeekPractice(ctx, cell, glossFrom(undefined));
      if (plan === null || locale === 'en') return plan;
      // As the Daily Review: a meaning missing in the UI language is never shown in English. The drop's own chunk and
      // the lesson chunks of the options beside each answer load first; an item none of whose chunks loads is left out.
      const tried = new Map<string, boolean>();
      const load = async (ids: readonly string[]): Promise<void> => {
        const cells = [...new Set(ids.flatMap((id) => glossCells(ctx, id)))].filter((c) => !tried.has(c));
        const loaded = await Promise.all(cells.map((c) => deps.ensureCell(c).then(() => true, () => false)));
        cells.forEach((c, i) => tried.set(c, loaded[i] === true));
      };
      const items = (p: WeekPractice): string[] => p.rounds.flatMap((r) => [r.question.itemId, ...(r.type === 'pick' ? r.options.map((o) => o.id) : [])]);
      await load(items(plan));
      const out = new Set(weekItemIds(ctx.index, cell).filter((id) => glossCells(ctx, id).every((c) => tried.get(c) === false)));
      plan = planWeekPractice(ctx, cell, glossFrom(deps.overlays(locale)), out);
      if (plan !== null) {
        await load(items(plan));
        plan = planWeekPractice(ctx, cell, glossFrom(deps.overlays(locale)), out);
      }
      return plan;
    },

    record(profileId, practice, index, answer) {
      const round = practice.rounds[index];
      if (round === undefined || !deps.records(profileId)) return Promise.resolve();
      return deps.recordAnswers(profileId, [memoryAnswerOf(round, answer)]);
    },
  };
}
