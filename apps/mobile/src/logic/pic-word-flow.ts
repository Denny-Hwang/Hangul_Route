import type { PicWordRound, RomanizationMode } from '@hangul-route/content-schema';
import type { Messages } from '@hangul-route/i18n';
import { seededRandom } from './listen-pick';
import type { MinigameScope } from './minigame-config';

/**
 * Pic-Word Match flow (F-QUEST-002 §3.11): the reducer and view-models behind
 * `PicWordMatchGame`. Pure, so the screen only renders what this returns and
 * runs the effects it asks for (the test lanes cannot render components, §5).
 *
 * Rules in one place: pairing is tap-tap in either order (no drag); a tap on
 * the selected tile clears it; a wrong pair ambers the SECOND tile for 600 ms
 * and leaves the first selected, and is scored against the FIRST-selected
 * tile's pair (key `b<board>:<pairId>`, so a miss and the later match share one
 * key and the run store keeps the later answer as a retry); after a pair's
 * second miss its partner is ringed; a right pair locks both tiles under one
 * number badge and speaks the word; the board ends 700 ms after its last pair;
 * Skip appears after the first answer and marks nothing.
 */

export const PIC_WORD_TIMING = {
  /** A wrong second tile stays amber this long. */
  missClearMs: 600,
  /** Last pair matched -> the next board (or the end). */
  advanceDelayMs: 700,
} as const;

/** The most pairs a board shows (the schema allows 3-5). */
const MAX_PAIRS = 5;
const MIN_PAIRS = 3;
/** Misses on one pair before its partner is ringed. */
const HINT_AFTER_MISSES = 2;

/** The words are `learner.minigame` and `a11y.minigame` (F-I18N-001 PR 7b), passed in by the screen. */
export type MinigameCopy = Messages['learner']['minigame'];
export type MinigameA11y = Messages['a11y']['minigame'];

export type Side = 'picture' | 'word';

export interface Selection {
  side: Side;
  pairId: string;
}

export interface PicWordFlowState {
  /** `empty`: no playable board. `resolved`: last pair matched, waiting to advance. `done`: after the last board. */
  status: 'empty' | 'playing' | 'resolved' | 'done';
  boardIdx: number;
  /** Pairs on each board, in play order (for the header). */
  pairCounts: readonly number[];
  /** The first tile of a pair attempt; it stays selected through a miss. */
  selected: Selection | null;
  /** Pair ids matched on this board, in match order (the number badge is index + 1). */
  matched: readonly string[];
  /** Misses per scored pair on this board. */
  missCounts: Readonly<Record<string, number>>;
  /** The second tile of a wrong pair, amber for `missClearMs`. */
  flash: Selection | null;
  /** Any answer has been given in this run (Skip appears). */
  answered: boolean;
}

export type FlowEvent =
  | { type: 'select'; side: Side; pairId: string }
  | { type: 'clear-flash' }
  | { type: 'advance' }
  | { type: 'skip' };

export type FlowEffect =
  | { type: 'answer'; roundKey: string; correct: boolean; pairId: string }
  | { type: 'haptic'; kind: 'success' | 'nudge' }
  | { type: 'play'; pairId: string }
  | { type: 'schedule-clear'; ms: number }
  | { type: 'cancel-clear' }
  | { type: 'schedule-advance'; ms: number }
  | { type: 'complete' };

export interface FlowStep {
  state: PicWordFlowState;
  effects: FlowEffect[];
}

/** The scoring key of a pair: `b<board>:<pairId>` (the same convention as Card Match's `pairRoundKey`). */
export function pairRoundKey(boardIdx: number, pairId: string): string {
  return `b${boardIdx}:${pairId}`;
}

/** A fresh flow on board 1; `pairCounts` lists the pairs of each board. */
export function startFlow(pairCounts: readonly number[]): PicWordFlowState {
  return {
    status: pairCounts.length < 1 ? 'empty' : 'playing',
    boardIdx: 0,
    pairCounts,
    selected: null,
    matched: [],
    missCounts: {},
    flash: null,
    answered: false,
  };
}

const unchanged = (state: PicWordFlowState): FlowStep => ({ state, effects: [] });

const other = (side: Side): Side => (side === 'picture' ? 'word' : 'picture');

/** Drops the amber flash and, if one was showing, its timer. */
function withoutFlash(state: PicWordFlowState): { state: PicWordFlowState; effects: FlowEffect[] } {
  return state.flash === null
    ? { state, effects: [] }
    : { state: { ...state, flash: null }, effects: [{ type: 'cancel-clear' }] };
}

function selectStep(state: PicWordFlowState, event: Extract<FlowEvent, { type: 'select' }>): FlowStep {
  if (state.status !== 'playing' || state.matched.includes(event.pairId)) return unchanged(state);
  const first = state.selected;

  // First tile, a tile on the same side, or the selected tile again: no pair is attempted.
  if (first === null || first.side === event.side) {
    const cleared = first !== null && first.pairId === event.pairId;
    const dropped = withoutFlash(state);
    return {
      state: { ...dropped.state, selected: cleared ? null : { side: event.side, pairId: event.pairId } },
      effects: dropped.effects,
    };
  }

  const roundKey = pairRoundKey(state.boardIdx, first.pairId);

  if (first.pairId === event.pairId) {
    const dropped = withoutFlash(state);
    const matched = [...state.matched, first.pairId];
    const finished = matched.length >= state.pairCounts[state.boardIdx]!;
    return {
      state: {
        ...dropped.state,
        selected: null,
        matched,
        answered: true,
        status: finished ? 'resolved' : 'playing',
      },
      effects: [
        { type: 'answer', roundKey, correct: true, pairId: first.pairId },
        { type: 'haptic', kind: 'success' },
        ...dropped.effects,
        { type: 'play', pairId: first.pairId },
        ...(finished ? [{ type: 'schedule-advance', ms: PIC_WORD_TIMING.advanceDelayMs } as const] : []),
      ],
    };
  }

  return {
    state: {
      ...state,
      flash: { side: event.side, pairId: event.pairId },
      missCounts: { ...state.missCounts, [first.pairId]: (state.missCounts[first.pairId] ?? 0) + 1 },
      answered: true,
    },
    effects: [
      { type: 'answer', roundKey, correct: false, pairId: first.pairId },
      { type: 'haptic', kind: 'nudge' },
      { type: 'cancel-clear' },
      { type: 'schedule-clear', ms: PIC_WORD_TIMING.missClearMs },
    ],
  };
}

function advanceStep(state: PicWordFlowState): FlowStep {
  if (state.status !== 'resolved') return unchanged(state);
  if (state.boardIdx >= state.pairCounts.length - 1) {
    return { state: { ...state, status: 'done' }, effects: [{ type: 'complete' }] };
  }
  return {
    state: {
      ...state,
      status: 'playing',
      boardIdx: state.boardIdx + 1,
      selected: null,
      matched: [],
      missCounts: {},
      flash: null,
    },
    effects: [],
  };
}

/** One event in, the next state and the effects the screen must run out. */
export function stepFlow(state: PicWordFlowState, event: FlowEvent): FlowStep {
  if (state.status === 'empty') return unchanged(state);
  switch (event.type) {
    case 'select':
      return selectStep(state, event);
    case 'clear-flash':
      return state.flash === null ? unchanged(state) : { state: { ...state, flash: null }, effects: [] };
    case 'advance':
      return advanceStep(state);
    case 'skip':
      if (!canSkip(state)) return unchanged(state);
      return { state: { ...state, status: 'done' }, effects: [{ type: 'cancel-clear' }, { type: 'complete' }] };
  }
}

/** Skip (ghost) is offered after the first answer, while a board is open. */
export function canSkip(state: PicWordFlowState): boolean {
  return state.answered && state.status === 'playing';
}

/** The tile to ring: the partner of the selected tile once its pair was missed twice. */
export function hintTarget(state: PicWordFlowState): Selection | null {
  const first = state.selected;
  if (first === null || (state.missCounts[first.pairId] ?? 0) < HINT_AFTER_MISSES) return null;
  return { side: other(first.side), pairId: first.pairId };
}

// ---------------------------------------------------------------------------
// Boards

type PicWordPair = PicWordRound['pairs'][number];

/** A playable pair has an id and a Korean word, and does not repeat an earlier id or word. */
function playablePairs(board: PicWordRound): PicWordPair[] {
  const ids = new Set<string>();
  const words = new Set<string>();
  const out: PicWordPair[] = [];
  for (const pair of board.pairs) {
    const id = pair.id.trim();
    const word = pair.word.ko.trim();
    if (id === '' || word === '' || ids.has(pair.id) || words.has(pair.word.ko)) continue;
    ids.add(pair.id);
    words.add(pair.word.ko);
    out.push(pair);
  }
  return out.slice(0, MAX_PAIRS);
}

/**
 * The scope's playable boards: each reduced to its playable pairs (at most
 * five), and dropped when fewer than three remain (the content test fails on
 * it; the learner sees "Nothing to play here" only if no board is left).
 */
export function validBoards(scope: Pick<MinigameScope, 'picWord'>): PicWordRound[] {
  return (scope.picWord?.boards ?? [])
    .map((board) => ({ ...board, pairs: playablePairs(board) }))
    .filter((board) => board.pairs.length >= MIN_PAIRS);
}

/** How many boards the scope plays. */
export function boardCount(scope: Pick<MinigameScope, 'picWord'>): number {
  return validBoards(scope).length;
}

export interface BoardOrder {
  /** Pair ids, top to bottom in the picture column. */
  pictureOrder: string[];
  /** Pair ids, top to bottom in the word column. */
  wordOrder: string[];
}

/**
 * Both columns in a deterministic order for `seed`, each shuffled on its own,
 * and never aligned: no word sits across from its own picture. The word column
 * is a Sattolo shuffle of the picture column (a single-cycle permutation has no
 * fixed point), so there is no retry loop.
 */
export function shuffleBoard(board: PicWordRound, seed: number): BoardOrder {
  const next = seededRandom(seed);
  const pictureOrder = board.pairs.map((p) => p.id);
  for (let i = pictureOrder.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [pictureOrder[i], pictureOrder[j]] = [pictureOrder[j]!, pictureOrder[i]!];
  }
  const wordOrder = [...pictureOrder];
  for (let i = wordOrder.length - 1; i > 0; i--) {
    const j = Math.floor(next() * i);
    [wordOrder[i], wordOrder[j]] = [wordOrder[j]!, wordOrder[i]!];
  }
  return { pictureOrder, wordOrder };
}

// ---------------------------------------------------------------------------
// View-models

export interface HeaderView {
  /** Pairs matched over every board; the bar only fills (anti-shame, F-001). */
  value: number;
  max: number;
  label: string;
}

export function headerView(state: PicWordFlowState, copy: MinigameCopy): HeaderView {
  const max = state.pairCounts.reduce((sum, n) => sum + n, 0);
  const before = state.pairCounts.slice(0, state.boardIdx).reduce((sum, n) => sum + n, 0);
  const value = Math.min(max, before + state.matched.length);
  return { value, max, label: copy.progress.pill(value, max) };
}

export type TileCardState = 'idle' | 'correct' | 'wrong' | 'hint';

interface TileBase {
  pairId: string;
  cardState: TileCardState;
  /** The learner picked this tile and has not chosen its partner yet (drawn as a ring). */
  selected: boolean;
  /** Match order, shared by both tiles of a pair. */
  badge: number | undefined;
  accessibilityLabel: string;
}

export interface PictureTileView extends TileBase {
  pictureRef: string | undefined;
  /** English gloss of the pair: the text fallback of the picture and its accessible name. */
  gloss: string;
}

export interface WordTileView extends TileBase {
  ko: string;
  /** Empty string draws no line (ChoiceCard). */
  romanization: string;
  /** The meaning shows only once the pair is matched (it would give the answer away). */
  gloss: string | undefined;
}

type Announce = (label: string) => string;

function tileBase(
  pairId: string,
  side: Side,
  state: PicWordFlowState,
  a11y: MinigameA11y,
): Omit<TileBase, 'accessibilityLabel'> & { announce: Announce } {
  const matchedAt = state.matched.indexOf(pairId);
  const badge = matchedAt >= 0 ? matchedAt + 1 : undefined;
  const isFlash = state.flash?.side === side && state.flash.pairId === pairId;
  const hint = hintTarget(state);
  const isHint = hint?.side === side && hint.pairId === pairId;
  const selected = state.selected?.side === side && state.selected.pairId === pairId;

  let cardState: TileCardState = 'idle';
  let announce: Announce = (label) => label;
  if (badge !== undefined) {
    cardState = 'correct';
    announce = (label) => a11y.option.matched(badge, label);
  } else if (isFlash) {
    cardState = 'wrong';
    announce = a11y.option.wrong;
  } else if (isHint) {
    cardState = 'hint';
    announce = a11y.option.hint;
  } else if (selected) {
    announce = a11y.option.selected;
  }
  return { pairId, cardState, selected, badge, announce };
}

/** How one picture tile looks and is announced in the current state. */
export function pictureTileView(pair: PicWordPair, state: PicWordFlowState, a11y: MinigameA11y): PictureTileView {
  const { announce, ...base } = tileBase(pair.id, 'picture', state, a11y);
  return {
    ...base,
    pictureRef: pair.pictureRef,
    gloss: pair.word.en,
    accessibilityLabel: announce(pair.word.en),
  };
}

/** How one word tile looks and is announced in the current state. */
export function wordTileView(
  pair: PicWordPair,
  state: PicWordFlowState,
  context: { romanizationMode: RomanizationMode },
  a11y: MinigameA11y,
): WordTileView {
  const { announce, ...base } = tileBase(pair.id, 'word', state, a11y);
  const touched = base.selected || base.cardState === 'correct' || base.cardState === 'wrong';
  const romanization = context.romanizationMode === 'always' || touched ? pair.word.romanization : '';
  const gloss = base.cardState === 'correct' ? pair.word.en : undefined;
  const spoken = [pair.word.ko, romanization, gloss].filter((part) => part !== undefined && part !== '').join(', ');
  return { ...base, ko: pair.word.ko, romanization, gloss, accessibilityLabel: announce(spoken) };
}

/** The line under the board (a live region): what is selected and what to do next. */
export function announcement(state: PicWordFlowState, board: PicWordRound, copy: MinigameCopy): string {
  const first = state.selected;
  const pair = first === null ? undefined : board.pairs.find((p) => p.id === first.pairId);
  if (first === null || pair === undefined) return copy.picWord.instruction;
  return first.side === 'picture' ? copy.picWord.pictureSelected(pair.word.en) : copy.picWord.wordSelected(pair.word.ko);
}

/**
 * Size step of a picture tile, a `touchTarget` key: `hero` on a roomy portrait
 * phone, `min` when the phone is narrow or on its side (the board scrolls
 * rather than shrinking tiles below `touchTarget.min`).
 */
export function pictureSide(width: number, height: number): 'min' | 'hero' {
  return width > height || width < ROOMY_WIDTH ? 'min' : 'hero';
}

/** Portrait widths (dp) from which the two columns fit the hero-size picture. */
const ROOMY_WIDTH = 380;
