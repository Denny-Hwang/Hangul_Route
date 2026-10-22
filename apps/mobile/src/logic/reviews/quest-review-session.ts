import type { ReviewEntry } from '@hangul-route/content-schema';
import type { TelemetryEvent } from '../../platform/telemetry';
import type { MemoryAnswer } from '../memory/memory-runtime';
import type { Rung } from '../memory/spacing';
import type { EngineContext } from './engine';
import { reviewStars } from './star-calc';

/**
 * The quest warm-up and Try these again (F-CURR-002 section 4.5, row CM-15): the shape of a planned session and
 * what a played one leaves behind (the answers, one `reviews[]` entry a day, the stars, `review.start` and
 * `review.complete`). Pure and free of the review engine: the sessions' chunk reads it, and the plans are built
 * in the memory store's chunk (`quest-reviews.ts`), so no module sits in both chunks.
 */

export type QuestReviewKind = 'warmup' | 'again';

/** Which shipped instruction line a round shows (the existing strings; nothing new to translate). */
export type PickInstruction = 'hearPick' | 'hearReply' | 'seeSound' | 'seePicture' | 'seeMeaning' | 'seeReply';

export interface PickOption {
  /** The item the option shows (the answer's id is the round's item). */
  id: string;
  /** A Korean option (a word, a block, a symbol, a reply). */
  ko?: string;
  romanization?: string;
  /** A text option in the UI language: a meaning, or a sound in romanization. */
  label?: string;
  /** A picture option; `label` is its accessible name (its meaning). */
  pictureRef?: string;
}

export interface PickRound {
  /** `<kind>:<n>:<itemId>`: the round's key for the first-try rule. */
  key: string;
  itemId: string;
  rung: Rung;
  instruction: PickInstruction;
  /** `hear`: the Korean is played (and shown only as the F-AUDIO-004 fallback); `see`: shown. */
  mode: 'hear' | 'see';
  ko: string;
  romanization: string;
  /** Shown under a `see` prompt; never when the round asks for the sound itself. */
  showRomanization: boolean;
  /** A heard item with a homophone shows its picture or meaning, which settles the spelling (section 4.5). */
  cue?: { pictureRef?: string; gloss: string };
  options: PickOption[];
  answerId: string;
}

export interface QuestReviewPlan {
  kind: QuestReviewKind;
  rounds: PickRound[];
  /** No device voice: recognize was asked at read, and the sound notice shows (F-AUDIO-004). */
  soundNotice: boolean;
  /** The context the plan was built on (its local day names the session's `reviews[]` entry). */
  ctx: EngineContext;
}

// ---- what a session leaves behind ----------------------------------------------------------------------

/** One first try: the option tapped first decides; a hint never shows before it, so none is hinted. */
export function firstTryAnswer(round: Pick<PickRound, 'itemId' | 'answerId' | 'rung'>, optionId: string): MemoryAnswer {
  return { itemId: round.itemId, correct: optionId === round.answerId, rung: round.rung };
}

/** Try these again's stars (F-RVW-001 section 3.1): right on the first try out of the rounds answered, never 0. */
export function tryAgainStars(answers: readonly MemoryAnswer[]): 1 | 2 | 3 {
  return reviewStars(answers.filter((a) => a.correct).length, answers.length);
}

/** The review kind each session is written as (section 4.5: Try these again is `feedback`). */
export const ENTRY_KIND = { warmup: 'warmup', again: 'feedback' } as const satisfies Record<QuestReviewKind, ReviewEntry['kind']>;

/**
 * The `reviews[]` entry of a finished session: one per kind and local day (`warmup:<day>`, `feedback:<day>`), so
 * the day's sessions merge into it (`mergeReview`) and the 14-day retention bounds the list (section 4.8). The
 * warm-up carries no stars; Try these again carries its stars and the items not right on the first try.
 */
export function sessionEntry(kind: QuestReviewKind, day: string, answers: readonly MemoryAnswer[], at: Date): ReviewEntry | null {
  if (answers.length === 0) return null;
  const entryKind = ENTRY_KIND[kind];
  const itemIds = [...new Set(answers.map((a) => a.itemId))];
  const entry: ReviewEntry = { id: `${entryKind}:${day}`, kind: entryKind, generatedAt: at.toISOString(), scope: day, itemIds };
  if (kind === 'again') {
    entry.resultStars = tryAgainStars(answers);
    entry.missedItemIds = [...new Set(answers.filter((a) => !a.correct).map((a) => a.itemId))];
  }
  return entry;
}

/** `review.start` (section 11.3): the kind and how many rounds; no item, no text. */
export function reviewStartEvent(profileId: string, kind: QuestReviewKind, rounds: number): TelemetryEvent {
  return { name: 'review.start', profileId, payload: { kind: ENTRY_KIND[kind], items: rounds } };
}

/** `review.complete` (internal analytics, never on a learner screen): rounds answered, retries, and Try these again's stars. */
export function reviewCompleteEvent(profileId: string, kind: QuestReviewKind, answers: readonly MemoryAnswer[], retries: number): TelemetryEvent {
  const payload: Record<string, unknown> = { kind: ENTRY_KIND[kind], items: answers.length, retries };
  if (kind === 'again') payload.stars = tryAgainStars(answers);
  return { name: 'review.complete', profileId, payload };
}
