import type { Quest, ReviewEntry, StageKey } from '@hangul-route/content-schema';
import type { Messages } from '@hangul-route/i18n';
import { episodesAll } from '../../content/episodes';
import { findJamo } from '../../content/jamo';
import type { TelemetryEvent } from '../../platform/telemetry';
import { reviewStars } from '../reviews/star-calc';
import type { ResumePoint } from '../reviews/saved-check';
import { STAGE1_QUESTS, teachingQuestFor } from './curriculum';
import { isSymbolItem } from './hangul-check';

/**
 * The behaviour behind `StageReviewScreen` (F-QUEST-002 §3.9), as a reducer and view-models so
 * the screen only renders them: the intro (no romanization switch: the Check holds the romanization until each answer, AMENDMENTS-STAGE1-DECODING-CHECK DC-1a), five chunks
 * with a Hoya pause between them, a confirm before stopping, and the stars-only result. Also the
 * first-try tally, the caregiver entry (`recordReview`) and the two telemetry events. Pure.
 */

/**
 * [LR] AMENDMENTS-QUEST-LEAVE-RESUME row LR-3a (section 3.4): `reading` (the intro's Hoya and title while the stored check
 * is read, at most the read's limit) and `resume` ("Pick up where you left off?") come before the intro.
 */
export type ReviewPhase = 'reading' | 'resume' | 'intro' | 'playing' | 'pause' | 'result';

export interface ReviewFlowState {
  phase: ReviewPhase;
  /** The chunk being played, or just finished during a pause. */
  chunk: number;
  /** [LR] Items of `chunk` already answered when a check was resumed in the middle of it (0 otherwise, and after a pause). */
  from: number;
  chunks: number;
  /** The "Stop the check?" question is open. */
  leaving: boolean;
}

export type ReviewFlowEvent =
  /** [LR] The stored check was read: `found` when a resumable one is there. Before the intro it picks the page; on the intro, before Let's go, it offers the resume page late. */
  | { type: 'read'; found: boolean }
  /** [LR] Continue on the resume page: at a chunk and offset, or null (every item answered: straight to the finish). */
  | { type: 'continue'; at: ResumePoint | null }
  /** [LR] Start again on the resume page: the normal intro; nothing is cleared until Let's go. */
  | { type: 'start-again' }
  | { type: 'start' }
  | { type: 'chunk-done' }
  | { type: 'keep-going' }
  | { type: 'leave' }
  | { type: 'stay' }
  | { type: 'confirm-leave' };

export type ReviewFlowEffect = { type: 'started' } | { type: 'finished' } | { type: 'exit' };

export interface ReviewFlowStep {
  state: ReviewFlowState;
  effects: ReviewFlowEffect[];
}

export function startReviewFlow({ chunks, reading = false }: { chunks: number; reading?: boolean }): ReviewFlowState {
  return { phase: reading ? 'reading' : 'intro', chunk: 0, from: 0, chunks, leaving: false };
}

const same = (state: ReviewFlowState): ReviewFlowStep => ({ state, effects: [] });

export function stepReviewFlow(state: ReviewFlowState, event: ReviewFlowEvent): ReviewFlowStep {
  switch (event.type) {
    case 'read':
      // A read that lands while the intro shows and nothing has started offers the resume page late; after Let's go it is ignored.
      if (state.phase === 'reading') return same({ ...state, phase: event.found ? 'resume' : 'intro' });
      if (state.phase === 'intro' && event.found) return same({ ...state, phase: 'resume' });
      return same(state);
    case 'continue':
      if (state.phase !== 'resume') return same(state);
      if (event.at === null) return { state: { ...state, phase: 'result', leaving: false }, effects: [{ type: 'finished' }] };
      return same({ ...state, phase: 'playing', chunk: event.at.chunk, from: event.at.from });
    case 'start-again':
      return state.phase === 'resume' ? same({ ...state, phase: 'intro' }) : same(state);
    case 'start':
      if (state.phase !== 'intro') return same(state);
      return { state: { ...state, phase: 'playing', chunk: 0, from: 0 }, effects: [{ type: 'started' }] };
    case 'chunk-done':
      if (state.phase !== 'playing') return same(state);
      if (state.chunk + 1 >= state.chunks) return { state: { ...state, phase: 'result', leaving: false }, effects: [{ type: 'finished' }] };
      return same({ ...state, phase: 'pause' });
    case 'keep-going':
      return state.phase === 'pause' ? same({ ...state, phase: 'playing', chunk: state.chunk + 1, from: 0 }) : same(state);
    case 'leave':
      // Nothing to lose before the start (or on the resume page, which keeps the stored check) or after the result: leave at once.
      if (!guardsBack(state)) return { state, effects: [{ type: 'exit' }] };
      return same({ ...state, leaving: true });
    case 'stay':
      return same({ ...state, leaving: false });
    case 'confirm-leave':
      return state.leaving ? { state: { ...state, leaving: false }, effects: [{ type: 'exit' }] } : same(state);
  }
}

/** A system back (Android back, swipe-back) asks before leaving only while there is a run to lose. */
export function guardsBack(state: ReviewFlowState): boolean {
  return state.phase === 'playing' || state.phase === 'pause';
}

/** One item's first-try record (the review run store keeps these). */
export interface ReviewAnswer {
  /** Right on the first answer. */
  first: boolean;
  /** Answers after the first one. */
  retries: number;
}

export interface ReviewTally {
  correct: number;
  total: number;
  symbolsCorrect: number;
  wordsCorrect: number;
  retries: number;
  /** Items answered wrong on the first try, in item order (the learner's tips come from these). */
  missedItemIds: string[];
  /**
   * Items the run never asked (a round the game could not play), in item order. Not right on the
   * first try, so the caregiver entry lists them as missed; never a tip on the learner screen.
   */
  unansweredItemIds: string[];
}

export function tallyReview(itemIds: readonly string[], answers: Readonly<Record<string, ReviewAnswer>>): ReviewTally {
  let symbolsCorrect = 0;
  let wordsCorrect = 0;
  let retries = 0;
  const missedItemIds: string[] = [];
  const unansweredItemIds: string[] = [];
  for (const id of itemIds) {
    const answer = answers[id];
    if (!answer) {
      unansweredItemIds.push(id);
      continue;
    }
    retries += answer.retries;
    if (!answer.first) missedItemIds.push(id);
    else if (isSymbolItem(id)) symbolsCorrect += 1;
    else wordsCorrect += 1;
  }
  return { correct: symbolsCorrect + wordsCorrect, total: itemIds.length, symbolsCorrect, wordsCorrect, retries, missedItemIds, unansweredItemIds };
}

/** A tip letter on the result: tapping it opens the quest that teaches it. */
export interface TipLetter {
  jamoId: string;
  char: string;
  /** The sound value (`t`, the final's `ng`). */
  romanization: string;
  /** A final consonant: its screen-reader label names it as a final (`a11y.practiceFinal`). */
  final: boolean;
  questId: string;
  episodeId: string;
}

export interface ReviewResultView {
  stars: 1 | 2 | 3;
  /** Up to three symbols missed on the first try; word misses are not tips. */
  tips: TipLetter[];
  /** No symbol missed: "Every letter!". */
  everyLetter: boolean;
}

const MAX_TIPS = 3;

export function reviewResultView(tally: ReviewTally, quests: readonly Quest[] = STAGE1_QUESTS): ReviewResultView {
  const missedSymbols = tally.missedItemIds.filter(isSymbolItem);
  const tips: TipLetter[] = [];
  for (const jamoId of missedSymbols) {
    if (tips.length === MAX_TIPS) break;
    const jamo = findJamo(jamoId);
    const quest = teachingQuestFor(jamoId, quests);
    const episode = quest && episodesAll.find((e) => e.questIds.includes(quest.id));
    if (!jamo || !quest || !episode) continue;
    tips.push({ jamoId, char: jamo.char, romanization: jamo.romanization, final: jamo.kind === 'batchim', questId: quest.id, episodeId: episode.id });
  }
  return { stars: reviewStars(tally.correct, tally.total), tips, everyLetter: missedSymbols.length === 0 };
}

export function resultHeadline(stars: 1 | 2 | 3, m: Messages['learner']['stageReview']['result']['headline']): string {
  return stars === 3 ? m.three : stars === 2 ? m.two : m.one;
}

/** Hoya's line after part `chunk` (0-based); the fourth line from the fourth part on. */
export function pauseLine(chunk: number, m: Messages['learner']['stageReview']['pause']): string {
  return [m.first, m.second, m.third][chunk] ?? m.fourth;
}

/**
 * [LR] The id of a Hangul Check's entry. It comes from the check's start time (kept by a resumed check), so a check that
 * is finished twice, a stored run surviving its own result, is the same entry and is never recorded a second time.
 */
export function stageCertificateId(startedAt: string): string {
  return `review:stage1:${startedAt}`;
}

/**
 * The caregiver channel's entry (`recordReview`): one per attempt, the numbers stay off the learner
 * screen. `missedItemIds` means "not right on the first try": the misses and any item never asked.
 */
export function stageCertificateEntry({ itemIds, tally, now, startedAt }: { itemIds: readonly string[]; tally: ReviewTally; now: Date; startedAt?: string }): ReviewEntry {
  const at = now.toISOString();
  const notRight = new Set([...tally.missedItemIds, ...tally.unansweredItemIds]);
  return {
    id: stageCertificateId(startedAt ?? at),
    kind: 'stage-certificate',
    generatedAt: at,
    scope: 'stage1',
    itemIds: [...itemIds],
    resultStars: reviewStars(tally.correct, tally.total),
    missedItemIds: itemIds.filter((id) => notRight.has(id)),
  };
}

/** The Hangul Check opens only for Stage 1, once Stage 1 is complete (`completeStages`); any other route param is the not-ready state. */
export function hangulCheckOpens(stageKey: StageKey, complete: ReadonlySet<StageKey>): boolean {
  return stageKey === 'stage1' && complete.has('stage1');
}

/** `review.start { kind, stageKey }` when the check begins (the `hideRomanization` flag went with the switch, DC-1a). */
export function reviewStartEvent(profileId: string): TelemetryEvent {
  return { name: 'review.start', profileId, payload: { kind: 'stage-certificate', stageKey: 'stage1' } };
}

/** `review.complete` with the counts: internal analytics only, never on a learner screen. */
export function reviewCompleteEvent(profileId: string, tally: ReviewTally): TelemetryEvent {
  return {
    name: 'review.complete',
    profileId,
    payload: {
      kind: 'stage-certificate',
      stageKey: 'stage1',
      symbolsCorrect: tally.symbolsCorrect,
      wordsCorrect: tally.wordsCorrect,
      retries: tally.retries,
      stars: reviewStars(tally.correct, tally.total),
    },
  };
}
