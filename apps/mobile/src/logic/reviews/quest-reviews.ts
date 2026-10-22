import type { ReviewItem } from '@hangul-route/content-schema/review-items';
import type { RoundAsked } from '../memory/asked';
import { normalizeAskedKo, resolveItems, resolveRound, type ItemLookup } from '../memory/resolve';
import type { Rung } from '../memory/spacing';
import { buildTryAgain, buildWarmup, itemVisible, jitter, ALL_VISIBLE, type EngineContext, type ReviewQuestion, type WarmupQuest } from './engine';
import type { PickOption, PickRound, QuestReviewKind, QuestReviewPlan } from './quest-review-session';

/**
 * The quest warm-up and Try these again (F-CURR-002 section 4.5, row CM-15), pure: the plans. They are built in the
 * memory store's chunk, where the review engine lives (`quest-review-planner.ts`); what a session leaves behind is
 * `quest-review-session.ts`, which the sessions' own chunk reads, so no module sits in both chunks. Both sit outside the
 * quest's six steps, so its timing (F-CURR-001 U-5) and its stars do not change.
 *
 * - **Warm-up**: before the first step of a Stage 2+ quest, up to 3 due items from earlier cells (the
 *   engine's `buildWarmup`), 30 s or less. Nothing scored: the learner sees only a soft "Warmed up". It is
 *   skipped when nothing is due, and never on a quest that resumes past its first step.
 * - **Try these again**: on the quest's reward step, the items the learner missed on the first try in this
 *   play (the engine's `buildTryAgain`, kind `feedback`), 30-60 s, then stars only. It is the default
 *   suggestion only when there were misses; See results (and with it Play again) stays one tap away.
 *
 * Both ask quick pick rounds, recognize or read (`maxRung`), so they keep their length: hear it and pick it,
 * or see it and pick its sound, picture or meaning. Their answers count like any answer (section 4.3): they go
 * to the memory store, where the spacing rule decides which are spaced. Never on these screens: a percentage,
 * a count of misses or a timer.
 */

/** The highest rung both sessions ask (they are quick pick rounds). */
export const QUICK_MAX_RUNG: Rung = 'read';
/** Options per pick round: the answer and two others, so a round takes a few seconds. */
export const PICK_OPTIONS = 3;

/** An item's meaning in the UI language, or undefined when it has none here (the overlay is not loaded). */
export type GlossOf = (item: ReviewItem) => string | undefined;

// ---- the misses of the play ---------------------------------------------------------------------------

/** The items the learner missed on the first try in this play, each once, in the order missed. */
export function missedItemIds(lookup: ItemLookup, cell: string, missed: readonly RoundAsked[]): string[] {
  const out: string[] = [];
  for (const asked of missed) {
    const round = resolveRound(asked);
    if (!round) continue;
    for (const item of resolveItems(lookup, cell, round)) if (!out.includes(item.id)) out.push(item.id);
  }
  return out;
}

// ---- pick rounds ----------------------------------------------------------------------------------------

/** The face an option shows, to keep the options apart; undefined when the item cannot be an option. */
type Face = (item: ReviewItem) => string | undefined;

const sameSound = (a: ReviewItem, b: ReviewItem): boolean =>
  normalizeAskedKo(a.ko) === normalizeAskedKo(b.ko) || a.homophoneOf.includes(b.id) || b.homophoneOf.includes(a.id);

/**
 * Two other items of the same kind to stand beside the answer, with a face of their own: the items the learner
 * has met first, then those of an earlier or the same stage, in a seeded order. Fewer than two: no round.
 */
function others(item: ReviewItem, ctx: EngineContext, face: Face, heard: boolean, seed: string): ReviewItem[] | null {
  const mine = face(item);
  if (mine === undefined) return null;
  const vis = ctx.visibility ?? ALL_VISIBLE;
  const rank = (c: ReviewItem): number => ((ctx.states[c.id]?.st.b ?? 0) >= 1 ? 0 : 2) + (c.stage <= item.stage ? 0 : 1);
  const pool = ctx.index.items
    .filter((c) => c.kind === item.kind && c.id !== item.id && !ctx.index.retired.has(c.id) && itemVisible(c, vis))
    .filter((c) => !(heard && sameSound(c, item)))
    .sort((a, b) => rank(a) - rank(b) || jitter(seed, a.id) - jitter(seed, b.id) || (a.id < b.id ? -1 : 1));
  const chosen: ReviewItem[] = [];
  const faces = new Set([mine.toLowerCase()]);
  for (const c of pool) {
    const f = face(c);
    if (f === undefined || faces.has(f.toLowerCase())) continue;
    if (heard && chosen.some((o) => sameSound(o, c))) continue;
    faces.add(f.toLowerCase());
    chosen.push(c);
    if (chosen.length === PICK_OPTIONS - 1) break;
  }
  return chosen.length === PICK_OPTIONS - 1 ? chosen : null;
}

/** The answer and the others in a seeded order. */
function shuffled(options: PickOption[], seed: string): PickOption[] {
  return [...options].sort((a, b) => jitter(seed, a.id) - jitter(seed, b.id) || (a.id < b.id ? -1 : 1));
}

/**
 * One review question as a pick round: hear it and pick it (Korean options, or an exchange's replies), or see it
 * and pick its sound (a symbol, a block), its picture or its meaning (a word, a sentence), or an exchange's reply.
 * A realia card needs its own card and is left out here, as is any item without two other options.
 */
export function pickRound(q: ReviewQuestion, n: number, kind: QuestReviewKind, ctx: EngineContext, glossOf: GlossOf, seed: string): PickRound | null {
  const item = ctx.index.byId.get(q.itemId);
  if (!item || item.kind === 'rea' || q.rung === 'produce') return null;
  const base: { key: string; itemId: string; rung: Rung; answerId: string } = { key: `${kind}:${n}:${item.id}`, itemId: item.id, rung: q.rung, answerId: item.id };
  const roundSeed = `${seed}:${n}`;
  const koOption = (c: ReviewItem): PickOption => ({ id: c.id, ko: c.ko, romanization: c.romanization });
  const replyOption = (c: ReviewItem): PickOption => ({ id: c.id, ko: c.reply?.ko ?? c.ko, romanization: c.reply?.romanization ?? c.romanization });
  const replyFace: Face = (c) => (c.reply ? normalizeAskedKo(c.reply.ko) : undefined);

  // A symbol is heard by its sound, which the voice cannot say from the letter alone: it is read instead.
  if (q.rung === 'recognize' && item.kind !== 'sym') {
    if (item.kind === 'exc') {
      const rest = others(item, ctx, replyFace, false, roundSeed);
      if (!rest) return null;
      return { ...base, instruction: 'hearReply', mode: 'hear', ko: item.ko, romanization: item.romanization, showRomanization: false, options: shuffled([item, ...rest].map(replyOption), roundSeed) };
    }
    const rest = others(item, ctx, (c) => normalizeAskedKo(c.ko), true, roundSeed);
    if (!rest) return null;
    const round: PickRound = { ...base, instruction: 'hearPick', mode: 'hear', ko: item.ko, romanization: item.romanization, showRomanization: false, options: shuffled([item, ...rest].map(koOption), roundSeed) };
    if (q.cue !== undefined) {
      const gloss = glossOf(item) ?? item.en ?? '';
      round.cue = q.cue === 'picture' && item.picture !== undefined ? { pictureRef: item.picture, gloss } : { gloss };
      if (round.cue.gloss === '' && round.cue.pictureRef === undefined) return null;
    }
    return round;
  }

  // The read rung: see it (and the answer is recorded at read).
  if (base.rung === 'recognize') base.rung = 'read';
  const see = { mode: 'see' as const, ko: item.ko, romanization: item.romanization };
  if (item.kind === 'sym' || item.kind === 'syl') {
    const rest = others(item, ctx, (c) => c.romanization, false, roundSeed);
    if (!rest) return null;
    const options = [item, ...rest].map((c) => ({ id: c.id, label: c.romanization }));
    // The romanization is the answer here, so it stays off the prompt.
    return { ...base, ...see, instruction: 'seeSound', showRomanization: false, options: shuffled(options, roundSeed) };
  }
  if (item.kind === 'exc') {
    const rest = others(item, ctx, replyFace, false, roundSeed);
    if (!rest) return null;
    return { ...base, ...see, instruction: 'seeReply', showRomanization: true, options: shuffled([item, ...rest].map(replyOption), roundSeed) };
  }
  if (item.picture !== undefined) {
    const rest = others(item, ctx, (c) => c.picture, false, roundSeed);
    if (rest) {
      const options = [item, ...rest].map((c) => ({ id: c.id, pictureRef: c.picture as string, label: glossOf(c) ?? c.en ?? '' }));
      return { ...base, ...see, instruction: 'seePicture', showRomanization: true, options: shuffled(options, roundSeed) };
    }
  }
  const meaning = glossOf(item) ?? item.en;
  if (meaning === undefined) return null;
  // The others need a meaning in the UI language of their own; the answer may fall back to its English.
  const rest = others(item, ctx, (c) => (c.id === item.id ? meaning : glossOf(c)), false, roundSeed);
  if (!rest) return null;
  const options = [{ id: item.id, label: meaning }, ...rest.map((c) => ({ id: c.id, label: glossOf(c) as string }))];
  return { ...base, ...see, instruction: 'seeMeaning', showRomanization: true, options: shuffled(options, roundSeed) };
}

function plan(kind: QuestReviewKind, questions: readonly ReviewQuestion[], ctx: EngineContext, glossOf: GlossOf): QuestReviewPlan {
  const seed = ctx.seed ?? '';
  const rounds: PickRound[] = [];
  let soundNotice = false;
  questions.forEach((q) => {
    const round = pickRound(q, rounds.length, kind, ctx, glossOf, seed);
    if (!round) return;
    rounds.push(round);
    soundNotice ||= q.voiceFallback;
  });
  return { kind, rounds, soundNotice, ctx };
}

/** The warm-up of a quest: empty (so skipped) when nothing from an earlier cell is due, and before Stage 2. */
export function planWarmup(ctx: EngineContext, quest: WarmupQuest, glossOf: GlossOf): QuestReviewPlan {
  const quick = { ...ctx, maxRung: QUICK_MAX_RUNG };
  return plan('warmup', buildWarmup(quick, quest).questions, quick, glossOf);
}

/** Try these again: the misses of the play just finished, each once, in the order missed, at most 8. */
export function planTryAgain(ctx: EngineContext, missed: readonly string[], glossOf: GlossOf): QuestReviewPlan {
  const quick = { ...ctx, maxRung: QUICK_MAX_RUNG };
  return plan('again', buildTryAgain(quick, missed).questions, quick, glossOf);
}
