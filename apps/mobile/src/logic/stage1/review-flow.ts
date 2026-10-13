import type { Quest, RomanizationMode, ReviewEntry } from '@hangul-route/content-schema';
import type { Messages } from '@hangul-route/i18n';
import { episodesAll } from '../../content/episodes';
import { findJamo } from '../../content/jamo';
import type { TelemetryEvent } from '../../platform/telemetry';
import { reviewStars } from '../reviews/star-calc';
import { STAGE1_QUESTS, teachingQuestFor } from './curriculum';
import { isSymbolItem } from './hangul-check';

/**
 * The behaviour behind `StageReviewScreen` (F-QUEST-002 §3.9), as a reducer and view-models so
 * the screen only renders them: the intro with its per-attempt romanization switch, five chunks
 * with a Hoya pause between them, a confirm before stopping, and the stars-only result. Also the
 * first-try tally, the caregiver entry (`recordReview`) and the two telemetry events. Pure.
 */

export type ReviewPhase = 'intro' | 'playing' | 'pause' | 'result';

export interface ReviewFlowState {
  phase: ReviewPhase;
  /** The chunk being played, or just finished during a pause. */
  chunk: number;
  chunks: number;
  /** "Reading practice": hide the romanization until a tap, for this attempt only. */
  hideRomanization: boolean;
  /** The "Stop the check?" question is open. */
  leaving: boolean;
}

export type ReviewFlowEvent =
  | { type: 'toggle-romanization' }
  | { type: 'start' }
  | { type: 'chunk-done' }
  | { type: 'keep-going' }
  | { type: 'leave' }
  | { type: 'stay' }
  | { type: 'confirm-leave' };

export type ReviewFlowEffect = { type: 'started'; hideRomanization: boolean } | { type: 'finished' } | { type: 'exit' };

export interface ReviewFlowStep {
  state: ReviewFlowState;
  effects: ReviewFlowEffect[];
}

/** A profile that reads in tap mode gets the switch on without being asked (D2). */
export function startReviewFlow({ chunks, romanizationMode }: { chunks: number; romanizationMode: RomanizationMode }): ReviewFlowState {
  return { phase: 'intro', chunk: 0, chunks, hideRomanization: romanizationMode === 'tap', leaving: false };
}

const same = (state: ReviewFlowState): ReviewFlowStep => ({ state, effects: [] });

export function stepReviewFlow(state: ReviewFlowState, event: ReviewFlowEvent): ReviewFlowStep {
  switch (event.type) {
    case 'toggle-romanization':
      return state.phase === 'intro' ? same({ ...state, hideRomanization: !state.hideRomanization }) : same(state);
    case 'start':
      if (state.phase !== 'intro') return same(state);
      return { state: { ...state, phase: 'playing', chunk: 0 }, effects: [{ type: 'started', hideRomanization: state.hideRomanization }] };
    case 'chunk-done':
      if (state.phase !== 'playing') return same(state);
      if (state.chunk + 1 >= state.chunks) return { state: { ...state, phase: 'result', leaving: false }, effects: [{ type: 'finished' }] };
      return same({ ...state, phase: 'pause' });
    case 'keep-going':
      return state.phase === 'pause' ? same({ ...state, phase: 'playing', chunk: state.chunk + 1 }) : same(state);
    case 'leave':
      // Nothing to lose before the start or after the result: leave at once.
      if (state.phase === 'intro' || state.phase === 'result') return { state, effects: [{ type: 'exit' }] };
      return same({ ...state, leaving: true });
    case 'stay':
      return same({ ...state, leaving: false });
    case 'confirm-leave':
      return state.leaving ? { state: { ...state, leaving: false }, effects: [{ type: 'exit' }] } : same(state);
  }
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
  /** Items answered wrong on the first try, in item order. */
  missedItemIds: string[];
}

export function tallyReview(itemIds: readonly string[], answers: Readonly<Record<string, ReviewAnswer>>): ReviewTally {
  let symbolsCorrect = 0;
  let wordsCorrect = 0;
  let retries = 0;
  const missedItemIds: string[] = [];
  for (const id of itemIds) {
    const answer = answers[id];
    if (!answer) continue;
    retries += answer.retries;
    if (!answer.first) missedItemIds.push(id);
    else if (isSymbolItem(id)) symbolsCorrect += 1;
    else wordsCorrect += 1;
  }
  return { correct: symbolsCorrect + wordsCorrect, total: itemIds.length, symbolsCorrect, wordsCorrect, retries, missedItemIds };
}

/** A tip letter on the result: tapping it opens the quest that teaches it. */
export interface TipLetter {
  jamoId: string;
  char: string;
  /** The sound value (`t`, the final's `ng`). */
  romanization: string;
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
    tips.push({ jamoId, char: jamo.char, romanization: jamo.romanization, questId: quest.id, episodeId: episode.id });
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

/** The caregiver channel's entry (`recordReview`): one per attempt, the numbers stay off the learner screen. */
export function stageCertificateEntry({ itemIds, tally, now }: { itemIds: readonly string[]; tally: ReviewTally; now: Date }): ReviewEntry {
  const at = now.toISOString();
  return {
    id: `review:stage1:${at}`,
    kind: 'stage-certificate',
    generatedAt: at,
    scope: 'stage1',
    itemIds: [...itemIds],
    resultStars: reviewStars(tally.correct, tally.total),
    missedItemIds: tally.missedItemIds,
  };
}

/** `review.start { kind, stageKey, hideRomanization }` when the check begins. */
export function reviewStartEvent(profileId: string, hideRomanization: boolean): TelemetryEvent {
  return { name: 'review.start', profileId, payload: { kind: 'stage-certificate', stageKey: 'stage1', hideRomanization } };
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
