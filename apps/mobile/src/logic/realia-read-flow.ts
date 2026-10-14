import {
  a11yRomanization,
  type KoText,
  type Realia,
  type RealiaEntry,
  type RealiaReadRound,
  type RomanizationMode,
} from '@hangul-route/content-schema';
import type { Messages } from '@hangul-route/i18n';
import type { HostMode } from '../screens/minigames/host';
import { seededRandom } from './listen-pick';
import type { MinigameScope } from './minigame-config';

/**
 * Realia Read flow (F-CURR-001 §3.6, row G-2; design/wireframes/minigame/realia-read.md):
 * the reducer and view-models behind `RealiaReadGame`. Pure, so the screen only renders what
 * this returns and runs the effects it asks for.
 *
 * Rules in one place: the realia stays on screen for the whole step; a question is answered by
 * tapping an option (the first answer in a question is the scored one, as in Listen & Pick); a
 * miss locks that option, nudges and leaves the realia unchanged; a second miss rings the realia
 * line that holds the answer ("look here"), never the right option, so the learner still reads;
 * the right tap marks that line found with its gloss, speaks the option once and opens the next
 * question 700 ms later; after the last question the step is complete. A line tap plays the line
 * and, in `tap` romanization mode, reveals its romanization for the rest of the step; it never
 * scores, never selects and is not a hint (wireframe "A line tap is not a hint"). Only the first
 * touch in a 50 ms window counts. No timer, no score number, no red.
 */

export const REALIA_READ_TIMING = {
  /** Right tap -> the next question opens. */
  advanceDelayMs: 700,
  /** Touches inside this window after an accepted one are dropped. */
  touchWindowMs: 50,
} as const;

export type MinigameCopy = Messages['learner']['minigame'];
export type MinigameA11y = Messages['a11y']['minigame'];

/** The scope's realia and its playable questions (`null`: nothing to play, the empty state). */
export interface RealiaReadPlay {
  realia: Realia;
  rounds: RealiaReadRound[];
}

/**
 * The questions a scope can play: two or more options with unique ids, an `answerId` among them,
 * and an `answerEntryId`, when given, that is a line of the realia. A question that fails this is
 * skipped (the content tests catch it). A realia with no lines, or no playable question, is empty.
 */
export function playableRealia(scope: Pick<MinigameScope, 'realiaRead'>): RealiaReadPlay | null {
  const play = scope.realiaRead;
  if (!play || play.realia.entries.length === 0) return null;
  const entryIds = new Set(play.realia.entries.map((e) => e.id));
  const rounds = play.rounds.filter((r) => {
    const ids = r.options.map((o) => o.id);
    return (
      ids.length >= 2 &&
      new Set(ids).size === ids.length &&
      ids.includes(r.answerId) &&
      (r.answerEntryId === undefined || entryIds.has(r.answerEntryId))
    );
  });
  return rounds.length === 0 ? null : { realia: play.realia, rounds };
}

/** The question with its options in a deterministic order for `seed` (authors write the answer first). */
export function shuffleRealiaOptions(round: RealiaReadRound, seed: number): RealiaReadRound {
  const next = seededRandom(seed);
  const options = [...round.options];
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [options[i], options[j]] = [options[j]!, options[i]!];
  }
  return { ...round, options };
}

// ---------------------------------------------------------------------------
// Reducer

export interface RealiaReadState {
  /** `empty`: nothing to play. `resolved`: right answer tapped, waiting to advance. `done`: after the last question. */
  status: 'empty' | 'asking' | 'resolved' | 'done';
  roundIdx: number;
  total: number;
  /** Options already tried in this question, in order; they stay locked. */
  wrongIds: readonly string[];
  /** The answer's line is ringed (after the second miss). */
  lookHere: boolean;
  /** Lines whose romanization a tap revealed (`tap` mode); kept for the whole step. */
  revealed: readonly string[];
  /** When the last accepted option tap arrived, for the 50 ms window. */
  lastTapAt: number | null;
}

export type RealiaReadEvent =
  | { type: 'tap'; optionId: string; answerId: string; at: number }
  | { type: 'line'; entryId: string }
  | { type: 'advance' };

export type RealiaReadEffect =
  | { type: 'answer'; roundKey: number; correct: boolean }
  | { type: 'haptic'; kind: 'success' | 'nudge' | 'light' }
  | { type: 'play-line'; entryId: string }
  | { type: 'play-option'; optionId: string }
  | { type: 'schedule-advance'; ms: number }
  | { type: 'complete' };

export interface RealiaReadStep {
  state: RealiaReadState;
  effects: RealiaReadEffect[];
}

export function startRealiaRead(total: number): RealiaReadState {
  return {
    status: total < 1 ? 'empty' : 'asking',
    roundIdx: 0,
    total: Math.max(0, total),
    wrongIds: [],
    lookHere: false,
    revealed: [],
    lastTapAt: null,
  };
}

const unchanged = (state: RealiaReadState): RealiaReadStep => ({ state, effects: [] });

function tapStep(state: RealiaReadState, event: Extract<RealiaReadEvent, { type: 'tap' }>): RealiaReadStep {
  if (state.status !== 'asking' || state.wrongIds.includes(event.optionId)) return unchanged(state);
  if (state.lastTapAt !== null && event.at - state.lastTapAt < REALIA_READ_TIMING.touchWindowMs) return unchanged(state);

  if (event.optionId === event.answerId) {
    return {
      state: { ...state, status: 'resolved', lastTapAt: event.at },
      effects: [
        { type: 'answer', roundKey: state.roundIdx, correct: true },
        { type: 'haptic', kind: 'success' },
        { type: 'play-option', optionId: event.optionId },
        { type: 'schedule-advance', ms: REALIA_READ_TIMING.advanceDelayMs },
      ],
    };
  }

  const wrongIds = [...state.wrongIds, event.optionId];
  return {
    state: { ...state, wrongIds, lookHere: wrongIds.length >= 2, lastTapAt: event.at },
    effects: [
      { type: 'answer', roundKey: state.roundIdx, correct: false },
      { type: 'haptic', kind: 'nudge' },
    ],
  };
}

function lineStep(state: RealiaReadState, entryId: string): RealiaReadStep {
  // Any time a question is open; ignored in the 0.7 s after a hit and once the step is done.
  if (state.status !== 'asking') return unchanged(state);
  const revealed = state.revealed.includes(entryId) ? state.revealed : [...state.revealed, entryId];
  return {
    state: revealed === state.revealed ? state : { ...state, revealed },
    effects: [
      { type: 'haptic', kind: 'light' },
      { type: 'play-line', entryId },
    ],
  };
}

function advanceStep(state: RealiaReadState): RealiaReadStep {
  if (state.status !== 'resolved') return unchanged(state);
  if (state.roundIdx >= state.total - 1) {
    return { state: { ...state, status: 'done' }, effects: [{ type: 'complete' }] };
  }
  return {
    state: { ...state, status: 'asking', roundIdx: state.roundIdx + 1, wrongIds: [], lookHere: false, lastTapAt: null },
    effects: [],
  };
}

/** One event in, the next state and the effects the screen must run. */
export function stepRealiaRead(state: RealiaReadState, event: RealiaReadEvent): RealiaReadStep {
  if (state.status === 'empty') return unchanged(state);
  switch (event.type) {
    case 'tap':
      return tapStep(state, event);
    case 'line':
      return lineStep(state, event.entryId);
    case 'advance':
      return advanceStep(state);
  }
}

// ---------------------------------------------------------------------------
// View-models

export type RealiaSheetKindView = 'menu' | 'ticket' | 'sign' | 'price-card' | 'plain';

export interface RealiaHeaderView {
  kind: 'bar' | 'dots';
  title: string | undefined;
  /** Filled units: they only ever fill (anti-shame). */
  value: number;
  max: number;
  label: string | undefined;
}

/** A practice step: a bar and "n / N"; a Check or review: fill-only dots. */
export function realiaHeaderView(mode: HostMode, state: RealiaReadState, copy: MinigameCopy): RealiaHeaderView {
  if (mode === 'check' || mode === 'review') {
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

/**
 * The realia beside the question from window width 700 (`layout.sideBySideMin`) up, portrait
 * tablets and landscape phones included, so the text stays in view while the options change
 * (wireframe "Tablet and phone landscape"); below it, one column.
 */
export function realiaArrangement(windowWidth: number, sideBySideMin: number): 'side' | 'stacked' {
  return windowWidth >= sideBySideMin ? 'side' : 'stacked';
}

/** The layout the realia is drawn in; a realia with no kind is the plain sheet. */
export function sheetKind(realia: Realia): RealiaSheetKindView {
  return realia.kind ?? 'plain';
}

/** The group's name: "Menu, 4 lines". */
export function sheetSummary(realia: Realia, a11y: MinigameA11y): string {
  const names = a11y.realia.kind;
  const kind = sheetKind(realia);
  const name = kind === 'price-card' ? names.priceCards : names[kind];
  return a11y.realia.summary(name, realia.entries.length);
}

/** Korean and romanization for a screen reader, the slash of a sound value read as "or". */
const spoken = (text: KoText): string[] => [text.ko, a11yRomanization(text.romanization)];

/** A line's name without a mark: its Korean, romanization, value and direction. */
export function lineBaseLabel(entry: RealiaEntry, a11y: MinigameA11y): string {
  const parts = [...spoken(entry.text), ...(entry.value ? spoken(entry.value) : [])];
  if (entry.dir) parts.push(a11y.realia.dir[entry.dir]);
  return parts.join(', ');
}

/** The UI-language gloss of a line, shown when it is found: "instant noodles, 3,000 won". */
export function lineGloss(entry: RealiaEntry): string {
  return entry.value ? `${entry.text.en}, ${entry.value.en}` : entry.text.en;
}

export type RealiaLineMarkView = 'none' | 'found' | 'lookHere';

export interface RealiaLineView {
  id: string;
  text: { ko: string; romanization: string };
  value: { ko: string; romanization: string } | undefined;
  dir: 'left' | 'right' | undefined;
  goods: 'apples' | 'fan' | 'hanji' | undefined;
  mark: RealiaLineMarkView;
  /** Only on a found line (no gloss while a question is open: it could give the answer away). */
  gloss: string | undefined;
  accessibilityLabel: string;
}

export interface RealiaViewContext {
  romanizationMode: RomanizationMode;
}

function markOf(entry: RealiaEntry, round: RealiaReadRound | undefined, state: RealiaReadState): RealiaLineMarkView {
  if (!round || round.answerEntryId !== entry.id) return 'none';
  if (state.status === 'resolved' || state.status === 'done') return 'found';
  return state.status === 'asking' && state.lookHere ? 'lookHere' : 'none';
}

/** How every line of the realia looks and is announced in the current question. */
export function lineViews(
  realia: Realia,
  round: RealiaReadRound | undefined,
  state: RealiaReadState,
  context: RealiaViewContext,
  a11y: MinigameA11y,
): RealiaLineView[] {
  return realia.entries.map((entry) => {
    const mark = markOf(entry, round, state);
    const shown = context.romanizationMode === 'always' || state.revealed.includes(entry.id);
    const base = lineBaseLabel(entry, a11y);
    const gloss = mark === 'found' ? lineGloss(entry) : undefined;
    // The romanization setting hides a visual line, not information: the name always carries it.
    const accessibilityLabel =
      mark === 'found' ? `${base}. ${gloss}. ${a11y.realia.found}` : mark === 'lookHere' ? `${base}. ${a11y.realia.lookHere}` : base;
    return {
      id: entry.id,
      text: { ko: entry.text.ko, romanization: shown ? entry.text.romanization : '' },
      value: entry.value ? { ko: entry.value.ko, romanization: shown ? entry.value.romanization : '' } : undefined,
      dir: entry.dir,
      goods: entry.goods,
      mark,
      gloss,
      accessibilityLabel,
    };
  });
}

/** The realia's title with its romanization (hidden in `tap` mode) and its name. */
export function titleView(realia: Realia, context: RealiaViewContext): { ko: string; romanization: string; label: string } | undefined {
  const { title } = realia;
  if (!title) return undefined;
  return {
    ko: title.ko,
    romanization: context.romanizationMode === 'always' ? title.romanization : '',
    label: spoken(title).join(', '),
  };
}

/** The text a line tap speaks (`playPrompt`): the line's Korean, then its value. */
export function lineSpeech(entry: RealiaEntry): { text: string; audioRef: string | undefined } {
  const say = (t: KoText): string => t.spokenKo ?? t.ko;
  return { text: entry.value ? `${say(entry.text)} ${say(entry.value)}` : say(entry.text), audioRef: entry.value ? undefined : entry.text.audioRef };
}

type RealiaOption = RealiaReadRound['options'][number];

export type RealiaOptionCardState = 'idle' | 'correct' | 'wrong' | 'disabled';

export interface RealiaOptionView {
  id: string;
  cardState: RealiaOptionCardState;
  ko: string | undefined;
  /** Empty string draws no line (ChoiceCard). */
  romanization: string;
  /** A figure ("3:00") or a picture's name. */
  label: string | undefined;
  pictureRef: string | undefined;
  accessibilityLabel: string;
}

function optionState(round: RealiaReadRound, option: RealiaOption, state: RealiaReadState): RealiaOptionCardState {
  const resolved = state.status === 'resolved' || state.status === 'done';
  if (resolved && option.id === round.answerId) return 'correct';
  if (state.wrongIds.includes(option.id)) return 'wrong';
  return resolved ? 'disabled' : 'idle';
}

/**
 * How one option card looks and is announced. The right option is never ringed (the line is):
 * the learner still reads the realia to answer. Answered cards use the shipped state names
 * ("Right answer: ...", "Not this one: ...").
 */
export function realiaOptionView(
  round: RealiaReadRound,
  option: RealiaOption,
  state: RealiaReadState,
  context: RealiaViewContext,
  a11y: MinigameA11y,
  koreanItem: Messages['a11y']['koreanItem'],
): RealiaOptionView {
  const cardState = optionState(round, option, state);
  const touched = cardState === 'wrong' || cardState === 'correct';
  let view: Omit<RealiaOptionView, 'accessibilityLabel'>;
  let base: string;
  if (option.text) {
    const romanization = context.romanizationMode === 'always' || touched ? option.text.romanization : '';
    view = { id: option.id, cardState, ko: option.text.ko, romanization, label: undefined, pictureRef: undefined };
    base = koreanItem({ ko: option.text.ko, romanization: a11yRomanization(option.text.romanization) });
  } else if (option.pictureRef !== undefined) {
    const name = option.labelEn ?? a11y.picture;
    view = { id: option.id, cardState, ko: undefined, romanization: '', label: name, pictureRef: option.pictureRef };
    base = name;
  } else {
    const figure = option.figure ?? '';
    view = { id: option.id, cardState, ko: undefined, romanization: '', label: figure, pictureRef: undefined };
    base = figure;
  }
  const accessibilityLabel = cardState === 'correct' || cardState === 'wrong' ? a11y.option[cardState](base) : base;
  return { ...view, accessibilityLabel };
}

/**
 * The accessible name of the question's key word: read the same way as that word on the sheet
 * and in the options (a slash in its romanization is read as "or").
 */
export function realiaKeyLabel(key: KoText, koreanItem: Messages['a11y']['koreanItem']): string {
  return koreanItem({ ko: key.ko, romanization: a11yRomanization(key.romanization) });
}

/** Narrow phones (below this width, dp) get one column. */
const NARROW_WIDTH = 340;
/** Text options up to this many glyphs sit two to a row. */
const SHORT_TEXT_GLYPHS = 8;

/** 2 columns for pictures and short options, 1 for long text or a narrow phone. */
export function realiaOptionColumns(round: RealiaReadRound, width: number): 1 | 2 {
  if (width < NARROW_WIDTH) return 1;
  if (round.options.some((o) => o.pictureRef !== undefined)) return 2;
  const longest = Math.max(...round.options.map((o) => [...(o.text?.ko ?? o.figure ?? '')].length));
  return longest <= SHORT_TEXT_GLYPHS ? 2 : 1;
}

export interface RealiaStatusView {
  /** Hoya's thinking line after a miss, or nothing. */
  hoya: string | undefined;
  /** After the second miss: "Look here: <line>", so a screen-reader user on the options hears which line to read. */
  lookHere: string | undefined;
}

/** The live region under the options. */
export function realiaStatus(
  realia: Realia,
  round: RealiaReadRound | undefined,
  state: RealiaReadState,
  mode: HostMode,
  copy: MinigameCopy,
  a11y: MinigameA11y,
): RealiaStatusView {
  if (mode === 'review' || state.status !== 'asking' || state.wrongIds.length === 0) return { hoya: undefined, lookHere: undefined };
  const entry = state.lookHere && round?.answerEntryId !== undefined ? realia.entries.find((e) => e.id === round.answerEntryId) : undefined;
  return { hoya: copy.realia.missHoya, lookHere: entry ? a11y.option.hint(lineBaseLabel(entry, a11y)) : undefined };
}
