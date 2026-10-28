import type { ReviewItem } from '@hangul-route/content-schema/review-items';
import type { MemoryAnswer } from '../../memory/memory-runtime';
import type { MemoryRow } from '../../memory/memory-file';
import { cellOfEpisode } from '../../memory/resolve';
import { applyAnswer, type Rung } from '../../memory/spacing';
import { addDays } from '../../vocab/srs';
import { INDEX, LESSON_QUESTS } from '../../memory/__tests__/fixtures';
import {
  CREDIT_INSIDE_SENTENCES,
  KEEP_GOING_ROUNDS_PER_DAY,
  WARMUP_SIZE,
  NO_REVIEWS_TODAY,
  buildDailyReview,
  buildKeepGoing,
  buildWarmup,
  canKeepGoing,
  dueCount,
  reviewFirst,
  withSentenceCredit,
  type DayReviewLog,
  type EngineContext,
  type ReviewSession,
} from '../engine';

/**
 * The 60-day simulation of the review engine (F-CURR-002 section 4.3, row CM-13). A simulated
 * learner plays quests of the shipped catalogue in route order and the review sessions the
 * scenario names, on the review items of this build; every answer goes through the spacing rule
 * exactly as the memory store records it (`applyAnswer`, with the device-only day facts). The
 * learner's answers come from a seeded generator, so a run is deterministic.
 */

export const START_DAY = '2026-11-02';

/** A seeded generator (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** How often the simulated learner answers right first try, by rung and box: about 85% overall. */
const P_RIGHT: Readonly<Record<Rung, number>> = { recognize: 0.9, read: 0.87, produce: 0.75 };
const P_HINTED = 0.05;

export interface QuestPlan {
  questId: string;
  cell: string;
  stage: number;
  /** The items this quest introduces (its share of the items its cell teaches first). */
  introduces: string[];
  /** The earlier items its cell asks again in recycle rounds. */
  recycles: string[];
}

const stageOf = (cell: string): number => Number(/stage(\d)/.exec(cell)?.[1] ?? 1);

/**
 * The quests that introduce no item: the Stage 1 additions of F-CURR-002 section 4.2 (row CM-33) ask letters earlier
 * quests teach and have no Discover page, so a cell's items are not split onto them; they only ask again (recycles).
 */
const INTRODUCE_NONE: ReadonlySet<string> = new Set(['quest:stage1-crafts-q4']);

/** The lesson quests in route order, each with the items it introduces: a cell's items split evenly over its quests. */
export function questPlans(items: readonly ReviewItem[] = INDEX.items): QuestPlan[] {
  const firstCell = (item: ReviewItem): string | undefined => item.cells.find((c) => c.startsWith('episode:'));
  const byCell = new Map<string, string[]>();
  for (const item of items) {
    const cell = firstCell(item);
    if (cell !== undefined) byCell.set(cell, [...(byCell.get(cell) ?? []), item.id]);
  }
  const questsOf = new Map<string, string[]>();
  const lastOf = new Map<string, string>();
  for (const q of LESSON_QUESTS) {
    const cell = cellOfEpisode(q.episodeId);
    lastOf.set(cell, q.id);
    if (!INTRODUCE_NONE.has(q.id)) questsOf.set(cell, [...(questsOf.get(cell) ?? []), q.id]);
  }
  return LESSON_QUESTS.map((q) => {
    const cell = cellOfEpisode(q.episodeId);
    const quests = questsOf.get(cell) ?? [q.id];
    const at = quests.indexOf(q.id);
    const own = byCell.get(cell) ?? [];
    const per = Math.ceil(own.length / quests.length);
    const recycles = items.filter((i) => i.asked.includes(cell)).map((i) => i.id);
    const introduces = at < 0 ? [] : own.slice(at * per, (at + 1) * per);
    return { questId: q.id, cell, stage: stageOf(cell), introduces, recycles: lastOf.get(cell) === q.id ? recycles : [] };
  });
}

export interface DayRecord {
  day: number;
  /** The due pool when the day starts. */
  pool: number;
  /** The due pool left when the day ends. */
  left: number;
  reviewFirst: boolean;
  answered: number;
}

/** The tuning knobs of section 4.3, as the engine ships them unless a run overrides one. */
export interface Knobs {
  keepGoingRounds: number;
  warmupSize: number;
  credit: boolean;
  voice: boolean;
}

export const DEFAULT_KNOBS: Knobs = { keepGoingRounds: KEEP_GOING_ROUNDS_PER_DAY, warmupSize: WARMUP_SIZE, credit: CREDIT_INSIDE_SENTENCES, voice: true };

export class Sim {
  rows: Record<string, MemoryRow> = {};
  readonly intro = new Map<string, number>();
  /** The day index of every spaced answer, by item. */
  readonly spaced = new Map<string, number[]>();
  /** The first day index an item's best box reached 3. */
  readonly held3 = new Map<string, number>();
  readonly days: DayRecord[] = [];
  private readonly random: () => number;
  private quest = 0;
  private dayIndex = 0;
  private log: DayReviewLog = NO_REVIEWS_TODAY;
  private answeredToday = 0;
  private readonly plans: readonly QuestPlan[];

  constructor(
    seed: number,
    readonly knobs: Knobs = DEFAULT_KNOBS,
    plans: readonly QuestPlan[] = questPlans(),
  ) {
    this.random = rng(seed);
    this.plans = plans;
  }

  get today(): string {
    return addDays(START_DAY, this.dayIndex);
  }

  ctx(): EngineContext {
    return { index: INDEX, states: this.rows, today: this.today, voice: this.knobs.voice, seed: `sim:${this.today}` };
  }

  private answerOf(itemId: string, rung: Rung): MemoryAnswer {
    const box = this.rows[itemId]?.st.b ?? 0;
    const right = this.random() < Math.min(0.97, P_RIGHT[rung] + 0.01 * Math.min(box, 5));
    const hinted = right && rung === 'produce' && this.random() < P_HINTED;
    return { itemId, rung, correct: right, ...(hinted ? { hinted: true } : {}) };
  }

  /** Records answers as the memory store does (`recordAnswers`), the credit inside sentences included. */
  record(answers: readonly MemoryAnswer[]): void {
    const day = this.today;
    const at = `${day}T12:00:00.000Z`;
    for (const a of withSentenceCredit(this.ctx(), answers, this.knobs.credit)) {
      const item = INDEX.byId.get(a.itemId);
      if (!item || INDEX.retired.has(item.id)) continue;
      const row = this.rows[item.id];
      const out = applyAnswer(row?.st, row ?? {}, a, day, at);
      this.rows[item.id] = { sh: row?.sh ?? 'stage1', st: out.state, ...out.facts };
      if (out.met && !this.intro.has(item.id)) this.intro.set(item.id, this.dayIndex);
      if (out.spaced) this.spaced.set(item.id, [...(this.spaced.get(item.id) ?? []), this.dayIndex]);
      if (out.state.s >= 3 && !this.held3.has(item.id)) this.held3.set(item.id, this.dayIndex);
      this.answeredToday += 1;
    }
  }

  /** Plays a review session: every question answered by the learner. Returns the due items it drew. */
  play(session: ReviewSession | null): number {
    if (session === null) return 0;
    this.record(session.questions.map((q) => this.answerOf(q.itemId, q.rung)));
    return session.questions.filter((q) => !q.stretch).length;
  }

  /** One lesson quest: the warm-up (Stage 2 and up), the new items met and practised, and the cell's recycle rounds. */
  playQuest(): boolean {
    const plan = this.plans[this.quest];
    if (plan === undefined) return false;
    this.quest += 1;
    this.play(buildWarmup(this.ctx(), { cell: plan.cell, stage: plan.stage }, this.knobs.warmupSize));
    for (const id of plan.introduces) this.record([this.answerOf(id, 'recognize'), this.answerOf(id, 'read')]);
    this.record(plan.recycles.filter((id) => this.rows[id] !== undefined).map((id) => this.answerOf(id, 'read')));
    return true;
  }

  /** Plays one Daily Review; returns the due items it drew. */
  dailyReview(): number {
    const drawn = this.play(buildDailyReview(this.ctx(), this.log));
    this.log = { ...this.log, dailyDueDrawn: this.log.dailyDueDrawn + drawn };
    return drawn;
  }

  /** What today's reviews have drawn so far. */
  dayLog(): DayReviewLog {
    return this.log;
  }

  keepGoing(): boolean {
    if (this.log.keepGoingRounds >= this.knobs.keepGoingRounds || !canKeepGoing(this.ctx(), this.log)) return false;
    this.play(buildKeepGoing(this.ctx(), this.log));
    this.log = { ...this.log, keepGoingRounds: this.log.keepGoingRounds + 1 };
    return true;
  }

  /** Runs one day: `act` sees the day's opening pool and the review-first suggestion. */
  day(act: (start: { pool: number; reviewFirst: boolean }) => void): void {
    this.log = NO_REVIEWS_TODAY;
    this.answeredToday = 0;
    const ctx = this.ctx();
    const start = { pool: dueCount(ctx), reviewFirst: reviewFirst(ctx) };
    act(start);
    this.days.push({ day: this.dayIndex, ...start, left: dueCount(this.ctx()), answered: this.answeredToday });
    this.dayIndex += 1;
  }

  /** Spaced answers an item got within `window` days of the day it was met. */
  spacedWithin(id: string, window: number): number {
    const met = this.intro.get(id);
    if (met === undefined) return 0;
    return (this.spaced.get(id) ?? []).filter((d) => d - met <= window).length;
  }
}

/** Scenario S-a: one quest a day, the Daily Review every day, one Keep going on days the pool is over 20. */
export function scenarioA(sim: Sim, days: number): void {
  for (let i = 0; i < days; i += 1) {
    sim.day(({ pool }) => {
      sim.playQuest();
      sim.dailyReview();
      if (pool > 20) while (sim.keepGoing());
    });
  }
}

/** Scenario S-b: two quests a day; on days the review-first suggestion shows, the Daily Review and Keep going replace the second quest. */
export function scenarioB(sim: Sim, days: number): void {
  for (let i = 0; i < days; i += 1) {
    sim.day(({ reviewFirst: first }) => {
      sim.playQuest();
      if (!first) {
        sim.playQuest();
        return;
      }
      sim.dailyReview();
      while (sim.keepGoing());
    });
  }
}
