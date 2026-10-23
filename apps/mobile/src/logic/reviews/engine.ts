import type { MemoryItemState, VocabProgress } from '@hangul-route/content-schema';
import { FORMAT_RUNG, type ReviewFormat, type ReviewItem, type ReviewItemKind } from '@hangul-route/content-schema/review-items';
import type { MemoryAnswer } from '../memory/memory-runtime';
import { normalizeAskedKo } from '../memory/resolve';
import { LADDER_DONE, MEMORY_MIN_BOX, RUNGS, RUNG_INDEX, isItemDue, type Rung } from '../memory/spacing';
import type { ReviewItemIndex } from './review-items-store';

/**
 * The review engine (F-CURR-002 sections 4.3 and 4.5, row CM-13): which items a review session
 * asks, in which order, at which rung and in which format. Every session shares it: Daily Review
 * and Keep going (row CM-14), the quest warm-up and Try these again (row CM-15), and the Cell,
 * Stage and Pack Checks (rows CM-21, CM-22 and pack level 5), each behind its own flag.
 *
 * Pure, offline and deterministic for a seed: it reads the item index, the learner's item states
 * and the local day, and returns plans. It never writes a state; the answers a session gets go to
 * the memory store (`recordAnswers`), where the spacing rule (`../memory/spacing.ts`) moves the
 * boxes. So a due item is never pushed to another day by the engine.
 *
 * - **The due pool** is every item with a box and `d` <= today, not answered today, not retired,
 *   and with a source the learner can see (section 12.2: with `volumes` off an item whose only
 *   source is Volume 2 is skipped, with `topicPacks` or `pack.<key>` off one whose only source is a
 *   hidden pack). Selection order: the lowest box first, then the oldest due day, then a jitter
 *   seeded by the item id, so fragile items come first.
 * - **Stretch items** (the next rung of an item at best box 3 or higher that is not due) only fill
 *   the slots of a Daily Review the pool cannot.
 * - **Interleaving**, when the pool allows: no more than 2 consecutive items from one theme and
 *   no more than 3 in one format. When every candidate is of one theme, the theme cap is skipped.
 * - **The rung asked**: boxes 1-2 at recognize or read (the next rung `c`, at most read; the other
 *   one when that keeps the format cap), box 3 and higher at the next rung `c` (produce once the
 *   ladder is passed). With no device voice recognize and read merge into read (a two-rung
 *   ladder) and the F-AUDIO-004 sound notice shows.
 * - **The format** is one the item allows at that rung (section 4.3 rungs by kind, fixed by the
 *   build in `allowedFormats`), checked again here: a heard round needs the device voice;
 *   dictation needs one spelling for the sound and no sound change (`dictation-unambiguous`, and
 *   `soundChange` items stay out of hear mode until recordings A-9 and A-10); a heard round of an
 *   item with a homophone shows its picture or gloss.
 *
 * Never on a review screen: a percentage, an "n of m" score or a timer (section 4.5). The engine
 * returns no score and no clock; the stars come from `star-calc.ts`.
 */

// ---- tuning knobs and sizes (section 4.5; the knobs were set by the 60-day simulation gate) -----------------

/** Daily Review: 10 items (experiment E2 may try 6). */
export const DAILY_REVIEW_SIZE = 10;
/** Section 4.8 step 3: on any day the Daily Review draws at most 20 due items, seeded ones included, before it offers Keep going. */
export const DAILY_REVIEW_DUE_CAP = 20;
/** Keep going: 10 more items a round. */
export const KEEP_GOING_SIZE = 10;
/** Knob: Keep going rounds offered a day (at most 3, section 4.5). */
export const KEEP_GOING_ROUNDS_PER_DAY = 3;
/** Knob: warm-up items before a Stage 2+ quest (up to 3, section 4.5). */
export const WARMUP_SIZE = 3;
/** Knob: a right sentence or exchange also counts for the due words inside it (section 4.3). */
export const CREDIT_INSIDE_SENTENCES = true;
/** Try these again: the misses of the session, at most this many (30-60 s, section 4.5). */
export const TRY_AGAIN_MAX = 8;
/** The review-first suggestion shows when the due pool is larger than this many Daily Reviews (section 4.3). */
export const REVIEW_FIRST_FACTOR = 3;
/** The Checks ask at least this share of their items at the produce rung (section 4.5). */
export const CHECK_PRODUCE_SHARE = 0.3;
/** Interleaving caps (section 4.5). */
export const MAX_THEME_RUN = 2;
export const MAX_FORMAT_RUN = 3;

// ---- inputs ----------------------------------------------------------------------------------------------

/** One item's state as the engine reads it: the shared state and the last local day it was answered (a `MemoryRow` fits). */
export interface EngineRow {
  st: MemoryItemState;
  /** The last local day the item was answered on this device. */
  l?: string;
}

export type EngineStates = Readonly<Record<string, EngineRow | undefined>>;

/** What the learner can see (section 12.2); the CM-14 and CM-15 surfaces read their flags into it. */
export interface SourceVisibility {
  /** `volumes`: Volume 2 and later cells. */
  volumes: boolean;
  /** `topicPacks`: every pack. */
  topicPacks: boolean;
  /** `pack.<key>`: one pack; every pack is shown when absent. */
  pack?: (key: string) => boolean;
  /**
   * The volume of a cell whose id does not carry it: a Stage 5 book 2 story (row CM-46) is Volume 2
   * content, so it hides with `volumes` off. Absent, or undefined for a cell, reads the `-v<k>`
   * suffix (none is Volume 1); every story shipped today is book 1.
   */
  cellVolume?: (cell: string) => number | undefined;
}

export const ALL_VISIBLE: SourceVisibility = { volumes: true, topicPacks: true };

export interface EngineContext {
  index: Pick<ReviewItemIndex, 'items' | 'byId' | 'retired'>;
  states: EngineStates;
  /** The local day, `YYYY-MM-DD` (F-VOC-005 P5). */
  today: string;
  /** The device can speak Korean (F-AUDIO-004). Without it the ladder has two rungs. */
  voice: boolean;
  /** Varies the tie order and the format choice; the same seed gives the same plan. */
  seed?: string;
  visibility?: SourceVisibility;
  /**
   * The highest rung the session asks (row CM-15): the warm-up (30 s or less) and Try these again are quick pick
   * rounds, so an item the ladder would ask at produce is asked at read there, and the ladder moves on in the
   * Daily Review and the Checks. A spaced right answer at any rung raises the box (CM-12), so the schedule is the same.
   */
  maxRung?: Rung;
}

// ---- outputs ---------------------------------------------------------------------------------------------

export interface ReviewQuestion {
  itemId: string;
  kind: ReviewItemKind;
  /** The rung this question asks; record the answer with it. */
  rung: Rung;
  format: ReviewFormat;
  /** The theme or pack (`pack:<key>`) of the item, for the interleaving caps. */
  theme: string;
  /** A stretch item: the next rung of a held item that is not due. */
  stretch: boolean;
  /** A heard round of an item with a homophone shows this, which settles the spelling (section 4.5). */
  cue?: 'picture' | 'gloss';
  /** Asked at read where it would be heard: there is no device voice, so the sound notice shows. */
  voiceFallback: boolean;
}

export type ReviewSessionKind = 'daily' | 'keep-going' | 'warmup' | 'again' | 'check';

export interface ReviewSession {
  kind: ReviewSessionKind;
  questions: ReviewQuestion[];
  /** Fewer questions than the session's size because nothing else is due ("All refreshed today"). */
  endsEarly: boolean;
  /** The visible F-AUDIO-004 sound notice: some question fell back from a heard round. */
  soundNotice: boolean;
  /**
   * Daily Review only: the day's 20 due items (section 4.8 step 3) are drawn and due items remain, so
   * the surface offers Keep going (`canKeepGoing`) instead. A capped Daily Review with no questions
   * is never played, and is not "All refreshed today".
   */
  capped: boolean;
}

// ---- determinism -----------------------------------------------------------------------------------------

/** FNV-1a, 32 bits: the jitter of an item id under a seed. */
export function jitter(seed: string, id: string): number {
  let h = 0x811c9dc5;
  const text = `${seed}\u0000${id}`;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

// ---- sources and the hidden-source skip (section 12.2) ----------------------------------------------------

const PACK_CELL = /^episode:pack-([a-z0-9]+(?:-[a-z0-9]+)*)-s[1-7](?:-v\d+)?$/;
const VOLUME_CELL = /-v(\d+)$/;

/** Whether the learner can see a cell that teaches or asks an item. A book 1 story is always shown. */
export function cellVisible(cell: string, vis: SourceVisibility): boolean {
  const pack = PACK_CELL.exec(cell);
  if (pack) {
    if (!vis.topicPacks) return false;
    if (vis.pack && !vis.pack(pack[1] as string)) return false;
  }
  const volume = vis.cellVolume?.(cell) ?? Number(VOLUME_CELL.exec(cell)?.[1] ?? 1);
  if (volume >= 2 && !vis.volumes) return false;
  return true;
}

/** An item is skipped when every source of it (the cells that teach it and those that ask it again) is hidden. */
export function itemVisible(item: Pick<ReviewItem, 'cells' | 'asked'>, vis: SourceVisibility): boolean {
  return [...item.cells, ...item.asked].some((cell) => cellVisible(cell, vis));
}

/** An item the engine may ever ask: in the index, not retired, with a visible source. */
function askable(ctx: EngineContext, id: string): ReviewItem | undefined {
  const item = ctx.index.byId.get(id);
  if (item === undefined || ctx.index.retired.has(id)) return undefined;
  return itemVisible(item, ctx.visibility ?? ALL_VISIBLE) ? item : undefined;
}

// ---- rungs and formats ------------------------------------------------------------------------------------

/** The rung `c` names: 0 recognize, 1 read, 2 produce, 3 the ladder passed (review keeps asking at produce). */
export function rungOfC(c: number): Rung {
  return RUNGS[Math.min(RUNG_INDEX.produce, Math.max(0, Math.min(LADDER_DONE, c)))] as Rung;
}

/** The rung the ladder asks next (section 4.3): boxes 1-2 at recognize or read, box 3 and higher at `c`. */
export function rungToAsk(st: Pick<MemoryItemState, 'b' | 'c'>): Rung {
  if (st.b >= 3) return rungOfC(st.c);
  return rungOfC(Math.min(st.c, RUNG_INDEX.read));
}

/** Whether a format can be asked on this device for this item (the engine's half of `dictation-unambiguous`). */
function usable(item: ReviewItem, format: ReviewFormat, voice: boolean): boolean {
  if (format === 'hear-pick') return voice && (item.homophoneOf.length === 0 || item.picture !== undefined || item.en !== undefined);
  if (format === 'dictation') return voice && !item.soundChange && item.homophoneOf.length === 0;
  return true;
}

interface Option {
  rung: Rung;
  format: ReviewFormat;
  voiceFallback: boolean;
}

/** The formats of an item at one rung, in a seeded order, so the variety is deterministic. */
function formatsAt(item: ReviewItem, rung: Rung, voice: boolean, seed: string): ReviewFormat[] {
  return item.formats
    .filter((f) => FORMAT_RUNG[f] === rung && usable(item, f, voice))
    .sort((a, b) => jitter(seed, `${item.id}|${a}`) - jitter(seed, `${item.id}|${b}`));
}

/**
 * The ways to ask an item at a wanted rung, best first. With no device voice recognize becomes
 * read (and is marked as a fallback); a rung the item has no usable format for falls back to read.
 * `alternate` adds the other of recognize and read, for the box 1-2 choice.
 */
function optionsFor(item: ReviewItem, wanted: Rung, voice: boolean, seed: string, alternate: boolean): Option[] {
  const out: Option[] = [];
  const add = (rung: Rung, voiceFallback: boolean) => {
    for (const format of formatsAt(item, rung, voice, seed)) {
      if (!out.some((o) => o.format === format)) out.push({ rung, format, voiceFallback });
    }
  };
  const heardWanted = wanted === 'recognize' && !voice;
  const rung: Rung = heardWanted ? 'read' : wanted;
  // The sound notice shows only for an item that would have had a heard round with a device voice.
  add(rung, heardWanted && formatsAt(item, 'recognize', true, seed).length > 0);
  if (out.length === 0 && rung !== 'read') add('read', rung === 'recognize' && !voice);
  if (alternate && voice) add(rung === 'recognize' ? 'read' : 'recognize', false);
  return out;
}

// ---- the due pool and selection order (section 4.3) -------------------------------------------------------

interface Candidate {
  item: ReviewItem;
  st: MemoryItemState;
  options: Option[];
  stretch: boolean;
}

const answeredToday = (row: EngineRow, today: string): boolean => row.l === today;

const bySelection =
  (seed: string) =>
  (a: { item: ReviewItem; st: MemoryItemState }, b: { item: ReviewItem; st: MemoryItemState }): number =>
    a.st.b - b.st.b || ((a.st.d ?? '') < (b.st.d ?? '') ? -1 : (a.st.d ?? '') > (b.st.d ?? '') ? 1 : 0) || jitter(seed, a.item.id) - jitter(seed, b.item.id) || (a.item.id < b.item.id ? -1 : 1);

/** The due items in selection order: the lowest box first, then the oldest due day, then the seeded jitter. */
export function duePool(ctx: EngineContext, exclude: ReadonlySet<string> = new Set()): ReviewItem[] {
  return dueEntries(ctx, exclude).map((e) => e.item);
}

function dueEntries(ctx: EngineContext, exclude: ReadonlySet<string>): { item: ReviewItem; st: MemoryItemState }[] {
  const out: { item: ReviewItem; st: MemoryItemState }[] = [];
  for (const [id, row] of Object.entries(ctx.states)) {
    if (row === undefined || exclude.has(id) || !isItemDue(row.st, ctx.today) || answeredToday(row, ctx.today)) continue;
    const item = askable(ctx, id);
    if (item !== undefined) out.push({ item, st: row.st });
  }
  return out.sort(bySelection(ctx.seed ?? ''));
}

/** How many items are due today (the pool the review-first suggestion and `dueVolumeBucket` read). */
export function dueCount(ctx: EngineContext): number {
  return dueEntries(ctx, new Set()).length;
}

/** Section 4.3: the Today mission puts the Daily Review first when the due pool is larger than 3 Daily Reviews. A suggestion; it never blocks new content. */
export function reviewFirst(ctx: EngineContext): boolean {
  return dueCount(ctx) > REVIEW_FIRST_FACTOR * DAILY_REVIEW_SIZE;
}

/** Stretch items: held (best box 3 or higher), not due, not answered today, with a rung still to pass; the soonest due first. */
function stretchEntries(ctx: EngineContext, exclude: ReadonlySet<string>): { item: ReviewItem; st: MemoryItemState }[] {
  const out: { item: ReviewItem; st: MemoryItemState }[] = [];
  for (const [id, row] of Object.entries(ctx.states)) {
    if (row === undefined || exclude.has(id) || row.st.b < MEMORY_MIN_BOX || row.st.s < 3 || row.st.c >= LADDER_DONE) continue;
    if (isItemDue(row.st, ctx.today) || answeredToday(row, ctx.today)) continue;
    const item = askable(ctx, id);
    if (item !== undefined) out.push({ item, st: row.st });
  }
  const seed = ctx.seed ?? '';
  return out.sort((a, b) => ((a.st.d ?? '') < (b.st.d ?? '') ? -1 : (a.st.d ?? '') > (b.st.d ?? '') ? 1 : 0) || jitter(seed, a.item.id) - jitter(seed, b.item.id) || (a.item.id < b.item.id ? -1 : 1));
}

function candidate(ctx: EngineContext, item: ReviewItem, st: MemoryItemState, stretch: boolean, wanted?: Rung): Candidate {
  // A stretch item's next rung is `c` at box 3 and up; one that fell back to box 1-2 keeps the recognize-or-read rule.
  const ladder = wanted ?? rungToAsk(st);
  const rung = ctx.maxRung !== undefined && RUNG_INDEX[ladder] > RUNG_INDEX[ctx.maxRung] ? ctx.maxRung : ladder;
  const options = optionsFor(item, rung, ctx.voice, ctx.seed ?? '', wanted === undefined && !stretch && st.b < 3);
  return { item, st, options, stretch };
}

// ---- interleaving (section 4.5) ---------------------------------------------------------------------------

const runOf = (list: readonly string[], value: string): number => {
  let n = 0;
  for (let i = list.length - 1; i >= 0 && list[i] === value; i -= 1) n += 1;
  return n;
};

/**
 * Lays candidates out in order, taking at each slot the first candidate (in selection order) and its
 * first way of asking that keep both caps; when none does, the theme cap goes first, then the format
 * cap, then the first candidate as it comes. Each tier (at most `max` of it) is used only once the
 * one before is spent, so a stretch item never takes a due item's slot.
 */
function compose(tiers: readonly { cands: readonly Candidate[]; max?: number }[], size: number, themeCapOn: boolean): ReviewQuestion[] {
  const out: ReviewQuestion[] = [];
  const themes: string[] = [];
  const formats: string[] = [];
  const themeOk = (t: string) => !themeCapOn || runOf(themes, t) < MAX_THEME_RUN;
  const formatOk = (f: string) => runOf(formats, f) < MAX_FORMAT_RUN;
  const passes: ((t: string, f: string) => boolean)[] = [(t, f) => themeOk(t) && formatOk(f), (_t, f) => formatOk(f), (t) => themeOk(t), () => true];
  for (const tier of tiers) {
    const left = tier.cands.filter((c) => c.options.length > 0);
    const end = Math.min(size, out.length + (tier.max ?? size));
    while (out.length < end && left.length > 0) {
      let chosen: { at: number; option: Option } | undefined;
      for (const ok of passes) {
        for (let i = 0; i < left.length && chosen === undefined; i += 1) {
          const c = left[i] as Candidate;
          const option = c.options.find((o) => ok(c.item.home, o.format));
          if (option !== undefined) chosen = { at: i, option };
        }
        if (chosen !== undefined) break;
      }
      if (chosen === undefined) break;
      const [c] = left.splice(chosen.at, 1) as [Candidate];
      const { option } = chosen;
      const q: ReviewQuestion = { itemId: c.item.id, kind: c.item.kind, rung: option.rung, format: option.format, theme: c.item.home, stretch: c.stretch, voiceFallback: option.voiceFallback };
      if (option.format === 'hear-pick' && c.item.homophoneOf.length > 0) q.cue = c.item.picture !== undefined ? 'picture' : 'gloss';
      out.push(q);
      themes.push(c.item.home);
      formats.push(option.format);
    }
  }
  return out;
}

const oneTheme = (cands: readonly Candidate[]): boolean => new Set(cands.map((c) => c.item.home)).size <= 1;

/** The longest run of one format in a session. */
const longestFormatRun = (qs: readonly ReviewQuestion[]): number => {
  let max = 0;
  let run = 0;
  qs.forEach((q, i) => {
    run = i > 0 && qs[i - 1]?.format === q.format ? run + 1 : 1;
    max = Math.max(max, run);
  });
  return max;
};

/**
 * Row CM-25: a Check's questions laid out again when `compose` left a run of one format longer than the cap. `compose`
 * takes the selection order slot by slot, so a long Check whose produce picks come first (every item unmet, a 20-round
 * Stage Jump, or no device voice so read is the only other way) can end on one format although the questions could be
 * spread. Here each slot takes, among the questions that keep both caps (then the format cap, then the theme cap, then
 * any), the one whose format has the most questions left, the first in order on a tie. The questions themselves do not
 * change, only their order, so the produce share and the plan stay; deterministic.
 */
function spreadFormats(qs: readonly ReviewQuestion[], themeCapOn: boolean): ReviewQuestion[] {
  if (longestFormatRun(qs) <= MAX_FORMAT_RUN) return [...qs];
  const left = [...qs];
  const out: ReviewQuestion[] = [];
  const themes: string[] = [];
  const formats: string[] = [];
  const themeOk = (q: ReviewQuestion) => !themeCapOn || runOf(themes, q.theme) < MAX_THEME_RUN;
  const formatOk = (q: ReviewQuestion) => runOf(formats, q.format) < MAX_FORMAT_RUN;
  const passes: ((q: ReviewQuestion) => boolean)[] = [(q) => themeOk(q) && formatOk(q), formatOk, themeOk, () => true];
  while (left.length > 0) {
    const leftOf = new Map<string, number>();
    for (const q of left) leftOf.set(q.format, (leftOf.get(q.format) ?? 0) + 1);
    let at = -1;
    for (const ok of passes) {
      left.forEach((q, i) => {
        if (ok(q) && (at < 0 || (leftOf.get(q.format) ?? 0) > (leftOf.get((left[at] as ReviewQuestion).format) ?? 0))) at = i;
      });
      if (at >= 0) break;
    }
    const [q] = left.splice(at, 1) as [ReviewQuestion];
    out.push(q);
    themes.push(q.theme);
    formats.push(q.format);
  }
  return longestFormatRun(out) < longestFormatRun(qs) ? out : [...qs];
}

function session(kind: ReviewSessionKind, questions: ReviewQuestion[], endsEarly: boolean, capped = false): ReviewSession {
  return { kind, questions, endsEarly, soundNotice: questions.some((q) => q.voiceFallback), capped };
}

// ---- the sessions (section 4.5) ---------------------------------------------------------------------------

export interface DayReviewLog {
  /** Due items the Daily Reviews of today have drawn so far (section 4.8 step 3). */
  dailyDueDrawn: number;
  /** Keep going rounds taken today. */
  keepGoingRounds: number;
}

export const NO_REVIEWS_TODAY: DayReviewLog = { dailyDueDrawn: 0, keepGoingRounds: 0 };

/**
 * Daily Review: 10 items, the due pool in selection order, at most 20 due items a day before Keep
 * going. Stretch items fill only the slots the pool cannot, and none when the day's cap is what
 * stops it (`capped`: Keep going is then offered). It ends early when there is nothing to ask.
 */
export function buildDailyReview(ctx: EngineContext, log: DayReviewLog = NO_REVIEWS_TODAY, exclude: ReadonlySet<string> = new Set()): ReviewSession {
  const due = dueEntries(ctx, exclude).map((e) => candidate(ctx, e.item, e.st, false));
  const dueSlots = Math.max(0, Math.min(DAILY_REVIEW_SIZE, DAILY_REVIEW_DUE_CAP - log.dailyDueDrawn));
  // The pool fills every slot it is allowed, and no stretch item fills in.
  const full = due.length > dueSlots;
  // The day's cap, not the session size, stops the draw while due items remain: Keep going is offered.
  const capped = dueSlots < DAILY_REVIEW_SIZE && due.length > dueSlots;
  const dueIds = new Set(due.map((c) => c.item.id));
  const stretch = full ? [] : stretchEntries(ctx, new Set([...exclude, ...dueIds])).map((e) => candidate(ctx, e.item, e.st, true));
  const questions = compose(
    [
      { cands: due, max: dueSlots },
      { cands: stretch, max: DAILY_REVIEW_SIZE },
    ],
    DAILY_REVIEW_SIZE,
    !oneTheme([...due, ...stretch]),
  );
  return session('daily', questions, !full && questions.length < DAILY_REVIEW_SIZE, capped);
}

/** Whether to offer Keep going at the end of a review: due items remain and fewer than 3 rounds were taken today. */
export function canKeepGoing(ctx: EngineContext, log: DayReviewLog): boolean {
  return log.keepGoingRounds < KEEP_GOING_ROUNDS_PER_DAY && dueEntries(ctx, new Set()).length > 0;
}

/** Keep going: 10 more due items in the same order; never stretch, never required. Null when it is not offered. */
export function buildKeepGoing(ctx: EngineContext, log: DayReviewLog, exclude: ReadonlySet<string> = new Set()): ReviewSession | null {
  if (log.keepGoingRounds >= KEEP_GOING_ROUNDS_PER_DAY) return null;
  const due = dueEntries(ctx, exclude).map((e) => candidate(ctx, e.item, e.st, false));
  if (due.length === 0) return null;
  const questions = compose([{ cands: due }], KEEP_GOING_SIZE, !oneTheme(due));
  return session('keep-going', questions, questions.length < KEEP_GOING_SIZE);
}

export interface WarmupQuest {
  cell: string;
  stage: number;
  /**
   * Whether a cell comes before the quest's cell in route order (the quest player knows the route).
   * Absent, a cell is earlier when its stage is at most the quest's stage.
   */
  earlier?: (cell: string) => boolean;
}

/**
 * The warm-up before a Stage 2+ quest: up to 3 due items from earlier cells: taught by a cell before
 * the quest's (so a replay of an early quest never asks a later stage's items), and not taught or
 * asked again by the quest's own cell, which asks them anyway. Empty, so skipped, when none are due.
 */
export function buildWarmup(ctx: EngineContext, quest: WarmupQuest, size: number = WARMUP_SIZE): ReviewSession {
  if (quest.stage < 2 || size <= 0) return session('warmup', [], true);
  const fromEarlier = (item: ReviewItem): boolean => (quest.earlier ? item.cells.some((c) => c !== quest.cell && quest.earlier?.(c) === true) : item.stage <= quest.stage);
  const due = dueEntries(ctx, new Set())
    .filter((e) => !e.item.cells.includes(quest.cell) && !e.item.asked.includes(quest.cell) && fromEarlier(e.item))
    .map((e) => candidate(ctx, e.item, e.st, false));
  const questions = compose([{ cands: due }], size, !oneTheme(due));
  return session('warmup', questions, questions.length < size);
}

/** Try these again: the items missed in the session just played, each once, in the order missed, at most 8. */
export function buildTryAgain(ctx: EngineContext, missed: readonly string[]): ReviewSession {
  const seen = new Set<string>();
  const cands: Candidate[] = [];
  for (const id of missed) {
    if (seen.has(id)) continue;
    seen.add(id);
    const item = askable(ctx, id);
    const row = ctx.states[id];
    if (item === undefined || row === undefined || row.st.b < MEMORY_MIN_BOX) continue;
    cands.push(candidate(ctx, item, row.st, false));
  }
  const questions = compose([{ cands }], TRY_AGAIN_MAX, !oneTheme(cands));
  return session('again', questions, false);
}

export interface CheckRequest {
  /** The items the Check covers: a cell's (Cell Check, its test-out), a stage's (Stage Check) or a pack's (Pack Check). */
  itemIds: readonly string[];
  /** 10 for a Cell or Pack Check, about 20 for a Stage Check. */
  size: number;
  /** At least this share at the produce rung (0.3, section 4.5). */
  produceShare?: number;
}

/**
 * The selector the Checks use (rows CM-21, CM-22 and pack level 5 build on it). It takes the
 * request's items, met or not (a test-out asks unmet items), the lowest box first then the seeded
 * jitter, asks at least 30% of them at the produce rung (the items that allow it, the most held
 * first), and interleaves them.
 */
export function buildCheck(ctx: EngineContext, req: CheckRequest): ReviewSession {
  const seed = ctx.seed ?? '';
  const picked: { item: ReviewItem; st: MemoryItemState }[] = [];
  const seen = new Set<string>();
  for (const id of req.itemIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    const item = askable(ctx, id);
    if (item === undefined) continue;
    const st = ctx.states[id]?.st ?? { b: 0, d: null, c: 0, r: 0, n: 0, f: ctx.today, s: 0, at: '' };
    picked.push({ item, st });
  }
  const ordered = picked.sort(bySelection(seed));
  const chosen = ordered.slice(0, Math.max(0, req.size));
  const produceWanted = Math.ceil(chosen.length * (req.produceShare ?? CHECK_PRODUCE_SHARE));
  // Row CM-21: when the first `size` items cannot hold the produce share (a Stage 1 cell's symbols have no shipped
  // produce round), the next items of the request that allow it take the places of the last ones that do not.
  const producible = (e: { item: ReviewItem }): boolean => formatsAt(e.item, 'produce', ctx.voice, seed).length > 0;
  const spare = ordered.slice(chosen.length).filter(producible);
  for (let i = chosen.length - 1; i >= 0 && spare.length > 0 && chosen.filter(producible).length < produceWanted; i -= 1) {
    if (!producible(chosen[i] as { item: ReviewItem })) chosen[i] = spare.shift() as (typeof chosen)[number];
  }
  const canProduce = chosen
    .filter((e) => formatsAt(e.item, 'produce', ctx.voice, seed).length > 0)
    .sort((a, b) => b.st.s - a.st.s || jitter(seed, a.item.id) - jitter(seed, b.item.id));
  // The items the ladder asks at produce anyway, then the most held of the rest until the share is met.
  const atProduce = new Set(canProduce.filter((e) => rungToAsk(e.st) === 'produce').map((e) => e.item.id));
  for (const e of canProduce) {
    if (atProduce.size >= produceWanted) break;
    atProduce.add(e.item.id);
  }
  // Row CM-25: only the produce picks are pinned to a rung. The others keep the ladder's own rung and, in boxes 1-2, its
  // second choice between recognize and read (section 4.3), so `compose` can keep the format cap on a long Check of
  // unmet items (a 20-round Stage Jump) instead of a run of one heard format.
  const cands = chosen.map((e) => candidate(ctx, e.item, e.st, false, atProduce.has(e.item.id) ? 'produce' : undefined));
  const themeCapOn = !oneTheme(cands);
  return session('check', spreadFormats(compose([{ cands }], req.size, themeCapOn), themeCapOn), false);
}

// ---- credit inside sentences (section 4.3) ----------------------------------------------------------------

/** Particles and copula endings a taught word may carry inside a sentence, longest first. */
const ENDINGS = ['이에요', '입니다', '에서', '에게', '한테', '까지', '부터', '이랑', '하고', '으로', '예요', '이야', '은', '는', '이', '가', '을', '를', '도', '에', '의', '와', '과', '랑', '로', '만', '야'];
/** Endings that follow a vowel only (가, not 이), and those that follow a final consonant only. 로 also follows ㄹ; 으로 never does. */
const AFTER_VOWEL = new Set(['예요', '가', '는', '를', '와', '랑', '야', '로']);
const AFTER_FINAL = new Set(['이에요', '이랑', '으로', '이야', '은', '이', '을', '과']);
const FINAL_RIEUL = 8;

/**
 * Whether an ending fits the word it follows, by the word's last block: 가 after a vowel, 이 after a
 * final consonant. So a compound such as 물가 is never read as 물 with 가.
 */
function endingFits(word: string, ending: string): boolean {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  if (code < 0 || code > 0xd7a3 - 0xac00) return false;
  const final = code % 28;
  if (ending === '로') return final === 0 || final === FINAL_RIEUL;
  if (ending === '으로') return final !== 0 && final !== FINAL_RIEUL;
  if (AFTER_VOWEL.has(ending)) return final === 0;
  if (AFTER_FINAL.has(ending)) return final !== 0;
  return true;
}
const SLOT = /^_+$/;

const wordsCache = new WeakMap<object, Map<string, string[]>>();

/** The taught words by their Korean, as the build keys items. */
function lexByKo(index: EngineContext['index']): Map<string, string[]> {
  let map = wordsCache.get(index);
  if (map === undefined) {
    map = new Map();
    for (const item of index.items) {
      if (item.kind !== 'lex') continue;
      const key = normalizeAskedKo(item.ko);
      map.set(key, [...(map.get(key) ?? []), item.id]);
    }
    wordsCache.set(index, map);
  }
  return map;
}

const tokensOf = (ko: string): string[] =>
  normalizeAskedKo(ko)
    .split(' ')
    .map((t) => t.replace(/^["'“”‘’(]+|[.!?~…,"'“”‘’)]+$/g, ''))
    .filter((t) => t.length > 0);

/**
 * The taught words inside a sentence, frame or exchange (its line and its reply): a run of up to three
 * words that is a word item, or is one with a particle or copula ending that fits it on its last word. A spelling
 * shared by several word items (a homograph) names none, as the sentence cannot tell which.
 */
export function wordsInside(item: Pick<ReviewItem, 'kind' | 'ko' | 'reply'>, index: EngineContext['index']): string[] {
  if (item.kind !== 'pat' && item.kind !== 'exc') return [];
  const byKo = lexByKo(index);
  const out: string[] = [];
  const lines = [item.ko, ...(item.reply ? [item.reply.ko] : [])];
  for (const line of lines) {
    const tokens = tokensOf(line);
    for (let i = 0; i < tokens.length; i += 1) {
      for (let j = i; j < Math.min(tokens.length, i + 3); j += 1) {
        const span = tokens.slice(i, j + 1);
        if (span.some((t) => SLOT.test(t))) break;
        const phrase = span.join(' ');
        let ids = byKo.get(phrase);
        if (ids === undefined) {
          for (const ending of ENDINGS) {
            if (phrase.length > ending.length && phrase.endsWith(ending)) {
              const word = phrase.slice(0, -ending.length);
              if (!endingFits(word, ending)) continue;
              ids = byKo.get(word);
              if (ids !== undefined) break;
            }
          }
        }
        if (ids !== undefined && ids.length === 1 && !out.includes(ids[0] as string)) out.push(ids[0] as string);
      }
    }
  }
  return out;
}

/**
 * The answers of a session with the credit inside sentences added (section 4.3): a first-try,
 * unhinted right answer to a sentence or an exchange at the read or produce rung also counts as a
 * read-rung answer for each taught word inside it that is due today and not answered today. Each
 * credit follows the answer that earned it and goes through the spacing rule like any answer, so
 * it raises a word at most once a day. A word the session asks itself is not credited.
 *
 * The memory store applies it to every batch it records (`recordAnswers`, and so the quest rounds,
 * story check rounds, warm-ups, reviews and Checks alike). Applying it again to a batch that already
 * carries its credits adds nothing, because a credited word is then asked in the batch.
 */
export function withSentenceCredit(ctx: EngineContext, answers: readonly MemoryAnswer[], enabled: boolean = CREDIT_INSIDE_SENTENCES): MemoryAnswer[] {
  if (!enabled) return [...answers];
  const answered = new Set(answers.map((a) => a.itemId));
  const credited = new Set<string>();
  const out: MemoryAnswer[] = [];
  for (const a of answers) {
    out.push(a);
    if (!a.correct || a.hinted === true || (a.rung !== 'read' && a.rung !== 'produce')) continue;
    const item = askable(ctx, a.itemId);
    if (item === undefined || (item.kind !== 'pat' && item.kind !== 'exc')) continue;
    for (const id of wordsInside(item, ctx.index)) {
      const row = ctx.states[id];
      if (answered.has(id) || credited.has(id) || row === undefined || askable(ctx, id) === undefined) continue;
      if (!isItemDue(row.st, ctx.today) || answeredToday(row, ctx.today)) continue;
      credited.add(id);
      out.push({ itemId: id, correct: true, rung: 'read' });
    }
  }
  return out;
}

// ---- typing tolerance at the produce rung (section 4.3) ---------------------------------------------------

const S_BASE = 0xac00;
const S_LAST = 0xd7a3;
const INITIALS = [...'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'];
const MEDIALS = [...'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ'];
const FINALS = ['', ...'ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ'];

/** A typed or target text as jamo: each block is its first letter, vowel and final; a lone letter stands for itself in that place. */
export function jamoOf(text: string): string[] {
  const out: string[] = [];
  for (const ch of text.normalize('NFC').replace(/\s+/g, '')) {
    const code = ch.charCodeAt(0);
    if (code >= S_BASE && code <= S_LAST) {
      const offset = code - S_BASE;
      out.push(`i${INITIALS[Math.floor(offset / 588)]}`, `m${MEDIALS[Math.floor(offset / 28) % 21]}`);
      const final = FINALS[offset % 28];
      if (final !== '') out.push(`f${final}`);
    } else if (INITIALS.includes(ch)) out.push(`i${ch}`);
    else if (MEDIALS.includes(ch)) out.push(`m${ch}`);
    else out.push(ch);
  }
  return out;
}

function editDistance(a: readonly string[], b: readonly string[]): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i];
    for (let j = 1; j <= b.length; j += 1) {
      row.push(Math.min((prev[j] as number) + 1, (row[j - 1] as number) + 1, (prev[j - 1] as number) + (a[i - 1] === b[j - 1] ? 0 : 1)));
    }
    prev = row;
  }
  return prev[b.length] as number;
}

export type TypedGrade = 'right' | 'hinted' | 'miss';

/**
 * A typed answer at the produce rung: compared after NFC normalization with spaces ignored (and
 * the target's edge punctuation, which nobody types). The same text is right; one jamo away (a
 * missing 받침, a wrong vowel stroke) is hinted: no promotion, no demotion, and Hoya shows the
 * correct form with the amber nudge; two or more jamo away is a miss.
 */
export function gradeTyped(target: string, typed: string): TypedGrade {
  const want = jamoOf(normalizeAskedKo(target));
  const got = jamoOf(normalizeAskedKo(typed));
  if (got.length === 0) return 'miss';
  const d = editDistance(want, got);
  return d === 0 ? 'right' : d === 1 ? 'hinted' : 'miss';
}

/** A typed answer as the answer the memory store records. */
export function typedAnswer(itemId: string, target: string, typed: string): MemoryAnswer {
  const grade = gradeTyped(target, typed);
  return { itemId, rung: 'produce', correct: grade !== 'miss', ...(grade === 'hinted' ? { hinted: true } : {}) };
}

// ---- topic words (section 4.8 step 4) ---------------------------------------------------------------------

/**
 * The engine's states: the memory store's rows, with the topic words read where they are (the
 * `vocab` slice, F-VOC-005, boxes 0-5). A topic word has no rungs there, so review asks it at read.
 */
export function engineStates(rows: EngineStates, vocab?: Pick<VocabProgress, 'items'>): Record<string, EngineRow> {
  const out: Record<string, EngineRow> = {};
  for (const [id, row] of Object.entries(rows)) if (row !== undefined) out[id] = row;
  for (const w of vocab?.items ?? []) {
    if (out[w.id] !== undefined) continue;
    out[w.id] = { st: { b: w.box, d: w.due, c: RUNG_INDEX.read, r: 0, n: w.seen, f: w.first, s: w.bestBox, at: w.at }, l: w.last };
  }
  return out;
}
