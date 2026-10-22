import type { ReviewEntry, UiLocale } from '@hangul-route/content-schema';
import type { TelemetryEvent } from '../../platform/telemetry';
import type { MemoryFile } from '../memory/memory-file';
import type { MemoryAnswer } from '../memory/memory-runtime';
import { localDay, vocabOf } from '../vocab/progress';
import {
  afterSession,
  dailyEntry,
  dailyReviewCompleteEvent,
  dailyReviewStartEvent,
  dailyReviewSummary,
  dayReviewLog,
  memoryAnswerOf,
  nextSessionKind,
  planSession,
  sessionResult,
  strongerCount,
  type AfterSession,
  type DailySessionKind,
  type PlannedSession,
  type RoundAnswer,
} from './daily-review';
import { engineStates, gradeTyped, type EngineContext, type SourceVisibility, type TypedGrade } from './engine';
import { glossFrom, surfaceIndex, type ReviewRound } from './review-rounds';
import type { ReviewItemIndex } from './review-items-store';

/**
 * The Daily Review's side of the stores (F-CURR-002 row CM-14). It reads the learner's memory store and the review
 * items, the snapshot's topic words and `reviews[]`, the flags and the device voice, and writes one answer per round
 * (`recordAnswers`, the CM-12 spacing rule), the `daily` entry and the telemetry.
 *
 * It lives in the memory chunk (`logic/memory/memory-chunk.ts` builds it with the runtime and the item store), with the
 * review engine, so no module of the scheduler is shared by two chunks (Metro would hoist it into the start bundle).
 * The screen's chunk and Home reach it through `logic/memory/boot.ts` (`memoryChunk()`), never a static import.
 */

export interface DailyReviewDeps {
  /** The learner's memory store as held (null when it cannot be read). */
  file(profileId: string): Promise<MemoryFile | null>;
  ensureSeeded(profileId: string): Promise<void>;
  items(): Promise<ReviewItemIndex>;
  /** `dailyReview` and `memoryRecord` for the profile (a learner, not a grown-up persona). */
  on(profileId: string): boolean;
  visibility(profileId: string): SourceVisibility;
  /** A Korean voice and the sound on (F-AUDIO-004): without it the ladder has two rungs. */
  voice(): boolean;
  hydrate(profileId: string): Promise<void>;
  reviews(profileId: string): readonly ReviewEntry[] | undefined;
  vocab(profileId: string): Parameters<typeof vocabOf>[0] | undefined;
  recordReview(profileId: string, entry: ReviewEntry): void;
  recordAnswers(profileId: string, answers: readonly MemoryAnswer[]): Promise<void>;
  track(event: TelemetryEvent): void;
  /** The es and ko meanings of the lesson items: the content overlays of a UI locale. */
  overlays(locale: 'es' | 'ko'): Readonly<Record<string, Readonly<Record<string, string>>>>;
  /** Loads a lesson cell's chunk (its glosses); rejects when it cannot load (offline and not cached). */
  ensureCell(cell: string): Promise<void>;
  random(): number;
}

export interface ReviewWorld {
  profileId: string;
  ctx: EngineContext;
  reviews: readonly ReviewEntry[];
}

export type WorldRead = { kind: 'off' } | { kind: 'unreadable' } | { kind: 'ready'; world: ReviewWorld };

export interface FinishedSession {
  stars: 1 | 2 | 3;
  /** Items whose best box rose; null when the store could not be read again (the line is then left out). */
  stronger: number | null;
  after: AfterSession;
}

export interface DailyReviewApi {
  readWorld(profileId: string | null, now?: Date): Promise<WorldRead>;
  /** Home's card and line: null with the review off or the store unreadable. */
  homeDailyReview(profileId: string | null): Promise<{ due: number; done: boolean; reviewFirst: boolean } | null>;
  /** The opening page: the Daily Review, or the done-today page once it is finished. */
  openingKind(world: ReviewWorld): DailySessionKind;
  doneTodayOffer(world: ReviewWorld): AfterSession;
  startSession(world: ReviewWorld, kind: DailySessionKind, locale: UiLocale): Promise<PlannedSession | null>;
  /**
   * Records a round's first answer now, so a stopped review keeps it. The memory store adds the credit inside sentences
   * to every batch it records (section 4.3).
   */
  recordRound(world: ReviewWorld, plan: PlannedSession, index: number, answer: RoundAnswer): Promise<void>;
  /** A stopped Daily Review writes no entry; the due items it drew still count toward the day's 20. */
  noteStopped(world: ReviewWorld, plan: PlannedSession, answered: Iterable<number>): void;
  finishSession(world: ReviewWorld, plan: PlannedSession, answers: ReadonlyMap<number, RoundAnswer>, recorded: readonly Promise<void>[], now?: Date): Promise<{ finished: FinishedSession; world: ReviewWorld }>;
  gradeTyped(target: string, typed: string): TypedGrade;
}

export function createDailyReviewApi(deps: DailyReviewDeps): DailyReviewApi {
  /** Due items the stopped Daily Reviews of a profile and local day drew (this app session; section 4.8 step 3). */
  const stoppedDrawn = new Map<string, number>();
  const drawnKey = (profileId: string, day: string): string => `${profileId}|${day}`;

  async function readWorld(profileId: string | null, now: Date = new Date()): Promise<WorldRead> {
    if (profileId === null || !deps.on(profileId)) return { kind: 'off' };
    try {
      await deps.hydrate(profileId);
      const index = await deps.items();
      await deps.ensureSeeded(profileId);
      const file = await deps.file(profileId);
      if (file === null) return { kind: 'unreadable' };
      const today = localDay(now);
      const vocab = deps.vocab(profileId);
      const ctx: EngineContext = {
        index: surfaceIndex(index),
        states: engineStates(file.rows, vocab ? vocabOf(vocab) : undefined),
        today,
        voice: deps.voice(),
        seed: `${profileId}|${today}`,
        visibility: deps.visibility(profileId),
      };
      return { kind: 'ready', world: { profileId, ctx, reviews: deps.reviews(profileId) ?? [] } };
    } catch {
      return { kind: 'unreadable' };
    }
  }

  /** The lesson chunks hold the es and ko meanings; a cell that cannot load leaves out the items only it teaches. */
  async function failedCells(rounds: readonly ReviewRound[], ctx: EngineContext): Promise<Set<string>> {
    const cells = new Set<string>();
    for (const r of rounds) for (const cell of ctx.index.byId.get(r.question.itemId)?.cells ?? []) if (cell.startsWith('episode:')) cells.add(cell);
    const failed = await Promise.all([...cells].map((cell) => deps.ensureCell(cell).then(() => null, () => cell)));
    return new Set(failed.filter((c): c is string => c !== null));
  }

  return {
    readWorld,

    async homeDailyReview(profileId) {
      const read = await readWorld(profileId);
      return read.kind === 'ready' ? dailyReviewSummary(read.world.ctx, read.world.reviews) : null;
    },

    openingKind: (world) => nextSessionKind(world.reviews, world.ctx.today),

    doneTodayOffer: (world) => afterSession(world.ctx, dayReviewLog(world.reviews, world.ctx.today)),

    async startSession(world, kind, locale) {
      const { ctx, reviews, profileId } = world;
      const log = dayReviewLog(reviews, ctx.today, stoppedDrawn.get(drawnKey(profileId, ctx.today)) ?? 0);
      const seed = ctx.seed ?? '';
      let plan = planSession(ctx, log, kind, { gloss: glossFrom(undefined), seed });
      if (plan !== null && locale !== 'en') {
        // The meanings come from the lesson chunks: load them, then build the rounds in the UI language. An item none of
        // whose lesson chunks loaded (offline, not yet cached) is skipped silently, as an unplayable one.
        const failed = await failedCells(plan.rounds, ctx);
        const out = new Set(
          plan.rounds.map((r) => r.question.itemId).filter((id) => {
            const cells = (ctx.index.byId.get(id)?.cells ?? []).filter((c) => c.startsWith('episode:'));
            return cells.length > 0 && cells.every((c) => failed.has(c));
          }),
        );
        plan = planSession(ctx, log, kind, { gloss: glossFrom(deps.overlays(locale)), seed }, out);
      }
      if (plan !== null) deps.track(dailyReviewStartEvent(profileId));
      return plan;
    },

    recordRound(world, plan, index, answer) {
      const round = plan.rounds[index];
      if (round === undefined) return Promise.resolve();
      return deps.recordAnswers(world.profileId, [memoryAnswerOf(round, answer)]);
    },

    noteStopped(world, plan, answered) {
      if (plan.kind !== 'daily') return;
      let due = 0;
      for (const i of answered) if (plan.rounds[i]?.question.stretch === false) due += 1;
      if (due === 0) return;
      const key = drawnKey(world.profileId, world.ctx.today);
      stoppedDrawn.set(key, (stoppedDrawn.get(key) ?? 0) + due);
    },

    async finishSession(world, plan, answers, recorded, now = new Date()) {
      const { profileId, ctx } = world;
      await Promise.all(recorded);
      const result = sessionResult(plan.rounds, answers);
      // A random id: never a profile id, a name or a time in clear. The 3 or 2 points join with CM-17's points API.
      deps.recordReview(profileId, dailyEntry({ result, day: ctx.today, now, nonce: Math.floor(deps.random() * 0x7fffffff).toString(36) }));
      deps.track(dailyReviewCompleteEvent(profileId, result.stars));
      const read = await readWorld(profileId, now);
      if (read.kind !== 'ready') {
        return { finished: { stars: result.stars, stronger: null, after: 'empty' }, world: { ...world, reviews: deps.reviews(profileId) ?? world.reviews } };
      }
      const next: ReviewWorld = { ...read.world, ctx: { ...read.world.ctx, today: ctx.today, seed: ctx.seed } };
      const stronger = strongerCount(ctx.states, next.ctx.states);
      return { finished: { stars: result.stars, stronger, after: afterSession(next.ctx, dayReviewLog(next.reviews, ctx.today)) }, world: next };
    },

    gradeTyped,
  };
}
