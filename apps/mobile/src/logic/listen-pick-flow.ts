import type { ListenPickRound, RomanizationMode } from '@hangul-route/content-schema';
import type { Messages } from '@hangul-route/i18n';
import type { PlayResult } from '../platform/audio';
import type { HostMode } from '../screens/minigames/host';

/**
 * Listen & Pick flow (F-QUEST-002 §3.10): the reducer and view-models behind
 * `ListenPickGame`. Pure, so the screen only renders what this returns and
 * runs the effects it asks for (the test lanes cannot render components, §5).
 * The words are `learner.minigame` and `a11y.minigame` (F-I18N-001 PR 7b),
 * passed in by the screen.
 *
 * Rules in one place: round 1 never autoplays (first audio needs a gesture),
 * round 2 on does; replay is unlimited; a wrong tap locks that option, ends
 * nothing, nudges, and replays the prompt after 800 ms unless the learner acts
 * first; a second miss rings the right option; the right tap resolves the
 * round and the next one opens 700 ms later; the first answer in a round is
 * the scored one (the run store keeps later ones as retries, `first-try.ts`);
 * only the first touch in a 50 ms window counts (F-001 §3.4).
 */

export const LISTEN_PICK_TIMING = {
  /** Wrong tap -> the prompt plays again. */
  replayDelayMs: 800,
  /** Right tap -> the next round opens. */
  advanceDelayMs: 700,
  /** Touches inside this window after an accepted one are dropped. */
  touchWindowMs: 50,
} as const;

export type MinigameCopy = Messages['learner']['minigame'];
export type MinigameA11y = Messages['a11y']['minigame'];

export interface ListenPickFlowState {
  /** `empty`: no playable round. `resolved`: right answer tapped, waiting to advance. `done`: after the last round. */
  status: 'empty' | 'asking' | 'resolved' | 'done';
  roundIdx: number;
  total: number;
  /** Options already tried this round, in order; they stay locked. */
  wrongIds: readonly string[];
  /** The right option is ringed (after the second wrong one). */
  hint: boolean;
  /** The prompt is shown as text because it cannot be played (unavailable or muted). */
  textPrompt: boolean;
  /** When the last accepted tap arrived, for the 50 ms window. */
  lastTapAt: number | null;
}

export type FlowEvent =
  | { type: 'hear' }
  | { type: 'audio'; round: number; result: PlayResult }
  | { type: 'tap'; optionId: string; answerId: string; at: number }
  | { type: 'replay-due' }
  | { type: 'advance' };

export type FlowEffect =
  | { type: 'play'; why: 'autoplay' | 'manual' | 'replay' | 'confirm' }
  | { type: 'answer'; roundKey: number; correct: boolean }
  | { type: 'haptic'; kind: 'success' | 'nudge' }
  | { type: 'schedule-replay'; ms: number }
  | { type: 'cancel-replay' }
  | { type: 'schedule-advance'; ms: number }
  | { type: 'complete' };

export interface FlowStep {
  state: ListenPickFlowState;
  effects: FlowEffect[];
}

/** A fresh flow on round 1: nothing is played until the learner taps the speaker. */
export function startFlow(total: number): ListenPickFlowState {
  return {
    status: total < 1 ? 'empty' : 'asking',
    roundIdx: 0,
    total: Math.max(0, total),
    wrongIds: [],
    hint: false,
    textPrompt: false,
    lastTapAt: null,
  };
}

const unchanged = (state: ListenPickFlowState): FlowStep => ({ state, effects: [] });

function tapStep(state: ListenPickFlowState, event: Extract<FlowEvent, { type: 'tap' }>): FlowStep {
  if (state.status !== 'asking' || state.wrongIds.includes(event.optionId)) return unchanged(state);
  if (state.lastTapAt !== null && event.at - state.lastTapAt < LISTEN_PICK_TIMING.touchWindowMs) {
    return unchanged(state);
  }

  if (event.optionId === event.answerId) {
    return {
      state: { ...state, status: 'resolved', lastTapAt: event.at },
      effects: [
        { type: 'answer', roundKey: state.roundIdx, correct: true },
        { type: 'haptic', kind: 'success' },
        { type: 'cancel-replay' },
        { type: 'play', why: 'confirm' },
        { type: 'schedule-advance', ms: LISTEN_PICK_TIMING.advanceDelayMs },
      ],
    };
  }

  const wrongIds = [...state.wrongIds, event.optionId];
  return {
    state: { ...state, wrongIds, hint: wrongIds.length >= 2, lastTapAt: event.at },
    effects: [
      { type: 'answer', roundKey: state.roundIdx, correct: false },
      { type: 'haptic', kind: 'nudge' },
      { type: 'cancel-replay' },
      { type: 'schedule-replay', ms: LISTEN_PICK_TIMING.replayDelayMs },
    ],
  };
}

function advanceStep(state: ListenPickFlowState): FlowStep {
  if (state.status !== 'resolved') return unchanged(state);
  if (state.roundIdx >= state.total - 1) {
    return { state: { ...state, status: 'done' }, effects: [{ type: 'complete' }] };
  }
  return {
    state: {
      ...state,
      status: 'asking',
      roundIdx: state.roundIdx + 1,
      wrongIds: [],
      hint: false,
      textPrompt: false,
      lastTapAt: null,
    },
    effects: [{ type: 'play', why: 'autoplay' }],
  };
}

/** One event in, the next state and the effects the screen must run out. */
export function stepFlow(state: ListenPickFlowState, event: FlowEvent): FlowStep {
  if (state.status === 'empty') return unchanged(state);
  switch (event.type) {
    case 'hear':
      return { state, effects: [{ type: 'cancel-replay' }, { type: 'play', why: 'manual' }] };
    case 'audio': {
      // A result for an earlier round says nothing about this one; the text stays once shown.
      if (event.round !== state.roundIdx || event.result === 'played') return unchanged(state);
      return { state: { ...state, textPrompt: true }, effects: [] };
    }
    case 'tap':
      return tapStep(state, event);
    case 'replay-due':
      return state.status === 'asking' ? { state, effects: [{ type: 'play', why: 'replay' }] } : unchanged(state);
    case 'advance':
      return advanceStep(state);
  }
}

// ---------------------------------------------------------------------------
// View-models

export interface HeaderView {
  kind: 'bar' | 'dots';
  title: string | undefined;
  /** Filled units: dots only ever fill (anti-shame, F-001). */
  value: number;
  max: number;
  label: string | undefined;
}

/** Check: two fill-only dots and "Quick check"; every other mode: a bar and "n / N". */
export function headerView(mode: HostMode, state: ListenPickFlowState, copy: MinigameCopy): HeaderView {
  if (mode === 'check') {
    const finished = state.status === 'resolved' || state.status === 'done' ? 1 : 0;
    return {
      kind: 'dots',
      title: copy.listenPick.checkTitle.pill,
      value: Math.min(state.total, state.roundIdx + finished),
      max: state.total,
      label: undefined,
    };
  }
  const shown = Math.min(state.total, state.roundIdx + 1);
  return { kind: 'bar', title: undefined, value: shown, max: state.total, label: copy.progress.pill(shown, state.total) };
}

export interface PromptContent {
  ko: string;
  romanization: string;
  gloss: string | undefined;
}

export interface PromptView {
  /** The sound cannot be played: the line "No sound? Read it here." goes with `content`. */
  showText: boolean;
  /** Korean text for the prompt zone, or `undefined` while the round must not give the answer away. */
  content: PromptContent | undefined;
}

/**
 * What the prompt zone shows. Nothing while asking with sound; the Korean and
 * its romanization (no gloss) as the no-sound fallback; the gloss once the
 * round resolved. The review gives no per-item feedback text, so it never
 * shows the gloss (it still shows the fallback text, so a missing voice does
 * not block the item).
 */
export function promptView(round: ListenPickRound, state: ListenPickFlowState, mode: HostMode): PromptView {
  const resolved = state.status === 'resolved' || state.status === 'done';
  const showGloss = resolved && mode !== 'review';
  if (!state.textPrompt && !showGloss) return { showText: false, content: undefined };
  return {
    showText: state.textPrompt,
    content: {
      ko: round.prompt.ko,
      romanization: round.prompt.romanization,
      gloss: showGloss ? round.prompt.en : undefined,
    },
  };
}

type ListenPickOption = ListenPickRound['options'][number];

export type OptionCardState = 'idle' | 'correct' | 'wrong' | 'hint' | 'disabled';

export interface OptionView {
  id: string;
  cardState: OptionCardState;
  ko: string | undefined;
  /** Empty string draws no line (ChoiceCard). */
  romanization: string;
  label: string | undefined;
  pictureRef: string | undefined;
  /** English gloss of a picture: its text fallback and accessible name. */
  gloss: string | undefined;
  accessibilityLabel: string;
}

export interface OptionViewContext {
  mode: HostMode;
  romanizationMode: RomanizationMode;
}

function cardStateOf(round: ListenPickRound, option: ListenPickOption, state: ListenPickFlowState, mode: HostMode): OptionCardState {
  const resolved = state.status === 'resolved' || state.status === 'done';
  const isAnswer = option.id === round.answerId;
  if (resolved && isAnswer) return 'correct';
  if (state.wrongIds.includes(option.id)) return 'wrong';
  if (resolved) return 'disabled';
  if (state.hint && isAnswer && mode !== 'review') return 'hint';
  return 'idle';
}

/** How one option card looks and is announced in the current state. */
export function optionView(
  round: ListenPickRound,
  option: ListenPickOption,
  state: ListenPickFlowState,
  context: OptionViewContext,
  a11y: MinigameA11y,
): OptionView {
  const cardState = cardStateOf(round, option, state, context.mode);
  const touched = cardState === 'wrong' || cardState === 'correct';
  const isPicture = option.pictureRef !== undefined;

  let view: Omit<OptionView, 'accessibilityLabel'>;
  let base: string;
  if (isPicture) {
    const label = option.labelEn ?? option.text?.en;
    const gloss = label ?? a11y.picture;
    view = { id: option.id, cardState, ko: undefined, romanization: '', label, pictureRef: option.pictureRef, gloss };
    base = gloss;
  } else {
    const text = option.text!;
    const romanization = context.romanizationMode === 'always' || touched ? text.romanization : '';
    view = {
      id: option.id,
      cardState,
      ko: text.ko,
      romanization,
      label: undefined,
      pictureRef: undefined,
      gloss: undefined,
    };
    base = romanization === '' ? text.ko : `${text.ko}, ${romanization}`;
  }

  const announced = cardState === 'correct' || cardState === 'wrong' || cardState === 'hint' ? a11y.option[cardState](base) : base;
  return { ...view, accessibilityLabel: announced };
}

/** Narrow phones (below this width, dp) get one column. */
const NARROW_WIDTH = 340;
/** Text options up to this many glyphs sit two to a row. */
const SHORT_TEXT_GLYPHS = 8;

/** 2 columns for pictures and for short text, 1 for long text or a narrow phone. */
export function optionColumns(round: ListenPickRound, width: number): 1 | 2 {
  if (width < NARROW_WIDTH) return 1;
  if (round.options.some((o) => o.pictureRef !== undefined)) return 2;
  const longest = Math.max(...round.options.map((o) => [...(o.text?.ko ?? '')].length));
  return longest <= SHORT_TEXT_GLYPHS ? 2 : 1;
}
