import { a11yRomanization, type ListenPickRound, type RomanizationMode } from '@hangul-route/content-schema';
import type { Messages } from '@hangul-route/i18n';
import { answerItem } from './answer-feedback';
import type { PlayResult, PlaySpec } from '../platform/audio';
import type { HostMode } from '../screens/minigames/host';
import { holdsRomanization, hostSurface } from './locale/check-hold';

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
 * first; a second miss rings the right option (a ring once on stays for the round); the right tap resolves the
 * round and the next one opens 700 ms later; the first answer in a round is
 * the scored one (the run store keeps later ones as retries, `first-try.ts`);
 * a touch inside `touchWindowMs` (350 ms, under the board's 400 ms lock) after an accepted one is a bounce and is dropped (AMENDMENTS-TOUCH KT-D5;
 * the 50 ms window of F-001 §3.4 became this lock).
 *
 * A contrast round (`contrast` on the tap, AMENDMENTS-MINIMAL-PAIRS sections 3.6 to 3.8, row MP-2a) differs in four ways: its
 * `answer` effect is tagged `scored: false` (the game then reports it to no host), a miss plays no replay of the prompt but
 * shows the two sounds side by side (`compare`: the right one, then the one tapped), a pair round ends after its miss
 * (a second tap would only be the other one) while a triple stays open, and a round whose clip did not play is dropped
 * (`drop`), the count shrinking with it.
 */

// The round's speech and its audio surface id live in a pure module (the lecture deck builder uses them too).
export { LISTEN_PICK_AUDIO_SOURCE, listenPickSpeech } from './audio/listen-pick-speech';

export const LISTEN_PICK_TIMING = {
  /** Wrong tap -> the prompt plays again. */
  replayDelayMs: 800,
  /** Right tap -> the next round opens. */
  advanceDelayMs: 700,
  /** Touches inside this window after an accepted one are a bounce and are dropped (AMENDMENTS-TOUCH KT-D5). */
  // `TAP_LOCK_MS` of the design system's tap model less a 50 ms clock slack (literals here: app code imports no
  // design-system subpath at runtime, and logic stays free of react-native; the test pins the value). The board's
  // lock is the gate at `TAP_LOCK_MS` on the touch events' own times; this window is the backstop on `Date.now()` at
  // dispatch, so a first tap whose handler ran a few ms late must not make it drop a tap the board accepted.
  touchWindowMs: 350,
  /**
   * A contrast round (row MP-2a): the least wait after a right answer, which leaves time to tap the other members
   * (each option plays its clip once the round is answered), and after a miss, which leaves the compare row's two clips
   * and its two lines their time. Both still wait for the sound that is playing (QS-4).
   */
  contrastAdvanceMs: 1800,
  contrastMissAdvanceMs: 2800,
  /** The compare row plays the right clip, then this long after it ends, the clip that was tapped. */
  compareGapMs: 400,
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
  /** When the last accepted tap arrived, for the bounce window (`touchWindowMs`). */
  lastTapAt: number | null;
  /**
   * A contrast round's miss: the right option and the one tapped, shown side by side with their clips (section 3.7). Absent
   * on every other round, and again on the next.
   */
  compare?: { rightId: string; tappedId: string };
}

/** What the flow needs to know of a contrast round's tap: how many options it has (two is a pair). */
export interface ContrastTap {
  optionCount: number;
}

export type FlowEvent =
  | { type: 'hear' }
  | { type: 'audio'; round: number; result: PlayResult }
  | { type: 'tap'; optionId: string; answerId: string; at: number; contrast?: ContrastTap }
  | { type: 'replay-due' }
  /** `total`: the rounds the game still holds (a contrast step drops the ones whose clips cannot play), else unchanged. */
  | { type: 'advance'; total?: number }
  /** Contrast: the open round's clip did not play. The game removed it; `total` is what it holds now. Nothing is scored. */
  | { type: 'drop'; total: number }
  /** Contrast: the later rounds were dropped (Can't hear it?, section 3.9). The count is what the game holds now. */
  | { type: 'total'; total: number };

export type FlowEffect =
  | { type: 'play'; why: 'autoplay' | 'manual' | 'replay' | 'confirm' }
  /** `scored: false`: a contrast round's own result, drawn and announced, reported to no host (section 3.8). */
  | { type: 'answer'; roundKey: number; correct: boolean; scored?: false }
  /** Contrast: play the right member's clip, then the tapped one's (section 3.7). */
  | { type: 'compare'; rightId: string; tappedId: string }
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

/** A round opened fresh: nothing locked, no ring, no text, no compare row. */
function openRound(state: ListenPickFlowState, roundIdx: number, total: number): ListenPickFlowState {
  const { compare: _compare, ...rest } = state;
  return { ...rest, status: 'asking', roundIdx, total, wrongIds: [], hint: false, textPrompt: false, lastTapAt: null };
}

function tapStep(state: ListenPickFlowState, event: Extract<FlowEvent, { type: 'tap' }>): FlowStep {
  if (state.status !== 'asking' || state.wrongIds.includes(event.optionId)) return unchanged(state);
  if (state.lastTapAt !== null && event.at - state.lastTapAt < LISTEN_PICK_TIMING.touchWindowMs) {
    return unchanged(state);
  }
  const { contrast } = event;
  const unscored = contrast === undefined ? {} : ({ scored: false } as const);

  if (event.optionId === event.answerId) {
    return {
      state: { ...state, status: 'resolved', lastTapAt: event.at },
      effects: [
        { type: 'answer', roundKey: state.roundIdx, correct: true, ...unscored },
        { type: 'haptic', kind: 'success' },
        { type: 'cancel-replay' },
        { type: 'play', why: 'confirm' },
        { type: 'schedule-advance', ms: contrast === undefined ? LISTEN_PICK_TIMING.advanceDelayMs : LISTEN_PICK_TIMING.contrastAdvanceMs },
      ],
    };
  }

  const wrongIds = [...state.wrongIds, event.optionId];
  if (contrast !== undefined) {
    // Listen to both (section 3.7): no replay of the prompt; the right sound, then the one tapped. A pair is over after
    // its miss (a second tap would only be the other one); a triple stays open, and its second miss rings the right option.
    const compare = { rightId: event.answerId, tappedId: event.optionId };
    const pairOver = contrast.optionCount <= 2;
    return {
      state: {
        ...state,
        status: pairOver ? 'resolved' : 'asking',
        wrongIds,
        hint: state.hint || wrongIds.length >= 2,
        lastTapAt: event.at,
        compare,
      },
      effects: [
        { type: 'answer', roundKey: state.roundIdx, correct: false, scored: false },
        { type: 'haptic', kind: 'nudge' },
        { type: 'cancel-replay' },
        { type: 'compare', ...compare },
        ...(pairOver ? [{ type: 'schedule-advance', ms: LISTEN_PICK_TIMING.contrastMissAdvanceMs } as const] : []),
      ],
    };
  }
  return {
    // Once on, the ring stays for the round (the scaffold round starts with it on, F-CURR-002 section 4.6).
    state: { ...state, wrongIds, hint: state.hint || wrongIds.length >= 2, lastTapAt: event.at },
    effects: [
      { type: 'answer', roundKey: state.roundIdx, correct: false },
      { type: 'haptic', kind: 'nudge' },
      { type: 'cancel-replay' },
      { type: 'schedule-replay', ms: LISTEN_PICK_TIMING.replayDelayMs },
    ],
  };
}

function advanceStep(state: ListenPickFlowState, total: number = state.total): FlowStep {
  if (state.status !== 'resolved') return unchanged(state);
  if (state.roundIdx >= total - 1) {
    return { state: { ...state, total, status: 'done' }, effects: [{ type: 'complete' }] };
  }
  return { state: openRound(state, state.roundIdx + 1, total), effects: [{ type: 'play', why: 'autoplay' }] };
}

/**
 * A contrast round whose clip did not play (section 3.6): it ends with nothing scored and the next one takes its place
 * (or the step completes). Only an open, untouched round drops; one the learner has answered stays as it is.
 */
function dropStep(state: ListenPickFlowState, total: number): FlowStep {
  if (state.status !== 'asking' || state.wrongIds.length > 0) return unchanged(state);
  // The index stays on a round that exists, as after any last answer, so the screen has one to draw until the step closes.
  if (state.roundIdx >= total) return { state: { ...state, total, roundIdx: Math.max(0, total - 1), status: 'done' }, effects: [{ type: 'cancel-replay' }, { type: 'complete' }] };
  return { state: openRound(state, state.roundIdx, total), effects: [{ type: 'cancel-replay' }, { type: 'play', why: 'autoplay' }] };
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
      return advanceStep(state, event.total);
    case 'drop':
      return dropStep(state, event.total);
    case 'total':
      return { state: { ...state, total: Math.max(state.roundIdx + 1, event.total) }, effects: [] };
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
  if (mode === 'check' || mode === 'review') {
    // The Check and the Hangul Check: fill-only dots, never "n / N" (D3); only the Check has a title.
    const finished = state.status === 'resolved' || state.status === 'done' ? 1 : 0;
    return {
      kind: 'dots',
      title: mode === 'check' ? copy.listenPick.checkTitle.pill : undefined,
      value: Math.min(state.total, state.roundIdx + finished),
      max: state.total,
      label: undefined,
    };
  }
  const shown = Math.min(state.total, state.roundIdx + 1);
  return { kind: 'bar', title: undefined, value: shown, max: state.total, label: copy.progress.pill(shown, state.total) };
}

export interface PromptContent {
  /** `undefined`: the romanization only, no Hangul (a Check's asked text, `askedTextIsRomanizationOnly`). */
  ko: string | undefined;
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
 * not block the item). `textFallback` is the prompt slot's `view.textShown`.
 *
 * `romanizationOnly` (AMENDMENTS-AUDIO-CANT-HEAR CH-1e, section 3.12): the text is the one the learner asked for ("Show the
 * letters", or the Always switch) in a Check whose options hold or hide their romanization. It then draws the romanization
 * alone while the question is open, so the round is a decoding item (read the sound, find its spelling) and the Hangul
 * is not printed above the options. Once the round resolved the answer is known, so the Korean shows as in any text.
 */
export function promptView(
  round: ListenPickRound,
  state: ListenPickFlowState,
  mode: HostMode,
  textFallback = false,
  romanizationOnly = false,
): PromptView {
  const resolved = state.status === 'resolved' || state.status === 'done';
  const showGloss = resolved && mode !== 'review';
  // The prompt slot (F-AUDIO-004 §3.8) shows the text at once when sound is off or there is no Korean voice.
  const showText = state.textPrompt || textFallback;
  if (!showText && !showGloss) return { showText: false, content: undefined };
  return {
    showText,
    content: {
      ko: romanizationOnly && showText && state.status === 'asking' ? undefined : round.prompt.ko,
      romanization: round.prompt.romanization,
      gloss: showGloss ? round.prompt.en : undefined,
    },
  };
}

/**
 * What a Check prints for a sound that stands in as text (AMENDMENTS-STAGE1-DECODING-CHECK section 3.2, row DC-1a, owner
 * decision 2026-11-25; it widens AMENDMENTS-AUDIO-CANT-HEAR CH-1e, section 3.12). In the quest Check and the Hangul Check,
 * whatever the learner's mode, a heard round that cannot be heard (the learner asked: Show the letters; Sound is off; there
 * is no Korean voice and no clip; the play failed or was blocked) shows the romanization only while the question is open,
 * never the Hangul. The round is then a reading item: read the sound, find its spelling among options that show none, as the
 * Decoding Sprint and Syllable Build already fall back. A practice host keeps the surface's own text (AD13).
 * `textPrompt`: a text prompt round has no sound to ask about (no link), so it is never this case.
 */
export function askedTextIsRomanizationOnly(mode: HostMode, textPrompt: boolean): boolean {
  if (textPrompt) return false;
  return checkHoldsRomanization(mode);
}

type ListenPickOption = ListenPickRound['options'][number];

export type OptionCardState = 'idle' | 'correct' | 'wrong' | 'hint' | 'disabled';

export interface OptionView {
  id: string;
  cardState: OptionCardState;
  ko: string | undefined;
  /** Empty string draws no line (ChoiceCard). */
  romanization: string;
  /**
   * A Check's open question (AMENDMENTS-AUDIT-2026-11 AU-8, AMENDMENTS-STAGE1-DECODING-CHECK DC-1a): the romanization that is held back until the
   * question is answered. The card keeps its line's room and draws nothing; '' when nothing is held.
   */
  heldRomanization: string;
  label: string | undefined;
  pictureRef: string | undefined;
  /** English gloss of a picture: its text fallback and accessible name. */
  gloss: string | undefined;
  accessibilityLabel: string;
}

export interface OptionViewContext {
  mode: HostMode;
  romanizationMode: RomanizationMode;
  /**
   * [RF] The mode of one option's Korean (AMENDMENTS-ROMANIZATION-FADE section 3.6, `RomanizationResolver.forText`): on the
   * `quest` host only, a decodable word folds in the reading phase while a theme word with an unmet letter stays shown. Every
   * other host (`check`, `review`, `vocab`, `preview`) ignores it and uses `romanizationMode`. Absent: the one mode.
   */
  romanizationModeOf?: (ko: string) => RomanizationMode;
  /**
   * The spelling round (F-CURR-002 section 4.5, row CM-31): a text option's screen-reader name, spelled block by block
   * with the letter names, because its options may sound the same. Default: the Korean and its shown romanization.
   */
  labelOf?: (text: { ko: string; romanization: string }) => string;
  /**
   * A Check (`checkHoldsRomanization`, AU-8 and DC-1a): no option shows its romanization while the question is open,
   * so the sound cannot be matched to Latin letters; every line the learner's mode shows comes at the answer. The
   * accessible name is unchanged. Absent: unchanged.
   */
  holdRomanization?: boolean;
}

/**
 * Whether a Listen & Pick host holds its romanization until the question is answered: the quest Check ("Quick check";
 * AMENDMENTS-AUDIT-2026-11 AU-8, audit EDU-3, owner decision 2026-11-15) and the Hangul Check (AMENDMENTS-STAGE1-DECODING-
 * CHECK section 3.1, row DC-1a, owner decision 2026-11-22, OD-R1). A call of the one rule, `holdsRomanization`. A text
 * prompt round holds too: its prompt's own romanization and its text options'. Practice steps, vocabulary and previews of
 * other steps are not Checks.
 */
export function checkHoldsRomanization(mode: HostMode): boolean {
  return holdsRomanization(hostSurface(mode));
}

export interface TextPromptView {
  ko: string;
  romanization: string;
  /** The romanization line is held while the question is open: the prompt keeps its room and draws nothing. */
  held: boolean;
}

/**
 * A text prompt round's prompt (Read Pick Meaning, the Cloze Pick fallback) as the surface draws it: the Korean, and its
 * romanization held back while a Check's question is open (`hold`, from `checkHoldsRomanization`), shown with the answer
 * as the surface shows it (AMENDMENTS-STAGE1-DECODING-CHECK section 3.3).
 */
export function textPromptView(round: ListenPickRound, state: ListenPickFlowState, hold: boolean): TextPromptView {
  return { ko: round.prompt.ko, romanization: round.prompt.romanization, held: hold && state.status === 'asking' };
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
    view = { id: option.id, cardState, ko: undefined, romanization: '', heldRomanization: '', label, pictureRef: option.pictureRef, gloss };
    base = gloss;
  } else {
    const text = option.text!;
    // What the learner's mode shows (`tap`, the stricter one: only a touched option), and what the name says. Once the round
    // resolves, a host that is no Check shows every option's (section 3.8 (c)): a folded romanization is always reachable.
    const mode = context.mode === 'quest' && context.romanizationModeOf ? context.romanizationModeOf(text.ko) : context.romanizationMode;
    const resolved = state.status === 'resolved' || state.status === 'done';
    const revealedAtAnswer = resolved && context.mode !== 'check' && context.mode !== 'review';
    const romanization = mode === 'always' || touched || revealedAtAnswer ? text.romanization : '';
    // AU-8: an open Check question shows none of it, a missed option's included; it all comes with the answer.
    const held = context.holdRomanization === true && state.status === 'asking';
    view = {
      id: option.id,
      cardState,
      ko: text.ko,
      romanization: held ? '' : romanization,
      heldRomanization: held ? romanization : '',
      label: undefined,
      pictureRef: undefined,
      gloss: undefined,
    };
    base = context.labelOf ? context.labelOf(text) : romanization === '' ? text.ko : `${text.ko}, ${romanization}`;
  }

  const announced = cardState === 'correct' || cardState === 'wrong' || cardState === 'hint' ? a11y.option[cardState](base) : base;
  return { ...view, accessibilityLabel: announced };
}

export interface OptionItemContext {
  /** The meaning goes with a Korean option's name: after a right answer (it is shown then), never on a miss. */
  gloss: boolean;
  /** The spelling round's name for a text option (spelled with letter names); used as is. */
  labelOf?: (text: { ko: string; romanization: string }) => string;
}

/**
 * What a result line calls an option (F-A11Y-001 §3.2): a picture by its name, a Korean option by its romanization
 * (a sound value read "g or k") and, after a right answer, its meaning; never its Hangul (OD-AF5 (a)). The spelling
 * round's options go by their letter names, since two of them may sound the same.
 */
export function optionItem(option: ListenPickOption, a11y: Messages['a11y'], context: OptionItemContext): string {
  if (option.pictureRef !== undefined) return option.labelEn ?? option.text?.en ?? a11y.minigame.picture;
  const text = option.text!;
  if (context.labelOf) return context.labelOf(text);
  return answerItem(a11y, a11yRomanization(text.romanization, a11y.romanizationOr), context.gloss ? text.en : undefined);
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
