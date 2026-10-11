import {
  IDLE_PAUSE_MS,
  MotivationSchema,
  PlacementRunStateSchema,
  PlacementSourceSchema,
  UiLocaleSchema,
  effectiveRoute,
  hashSeed,
  placementStageNumber,
  type Motivation,
  type PlacementConfig,
  type PlacementEvent,
  type PlacementGate,
  type PlacementLevel,
  type PlacementMode,
  type PlacementResult,
  type PlacementRunState,
  type PlacementSource,
  type UiLocale,
} from '@hangul-route/content-schema';
import { z } from 'zod';
import { compareInstant } from '../sync/merge';
import { shortHintFires } from './result-view';

/**
 * The level check's screen flow (F-PLC-001 section 3.1, wireframe placement
 * A to L2) as a pure state machine. The screens render a `FlowState` and send
 * `FlowEvent`s; the adaptive run itself is the engine's
 * (`@hangul-route/content-schema` `startRun` / `apply`). Nothing here reads a
 * clock, the device or storage: capabilities arrive inside events, read by the
 * caller at the moment the options screen opens.
 */

export type FlowScreen =
  | 'invite'
  | 'language'
  | 'options'
  | 'handoff'
  | 'warmup'
  | 'sound-needed'
  | 'item'
  | 'result'
  /** "I am new to Korean": no run; the caller opens FirstQuestPreview and records the decline. */
  | 'declined'
  /** "Start learning" on the sound-needed screen: nothing recorded. */
  | 'left';

/** What the device can play, read when the options screen opens. */
export interface FlowCapability {
  /** `canPlayKorean(getCapability())`. */
  koreanAudio: boolean;
  /** `hasVoiceFor(LOCALE_META[testLocale].speechLang)` ("unknown" counts as available). */
  instructionVoice: boolean;
  /**
   * `hasVoiceFor(LOCALE_META.ko.speechLang)`: Korean instructions on reading
   * items are audio-only (section 3.2), so `ko` needs this as well as
   * `koreanAudio` (bundled clips alone make `koreanAudio` true).
   */
  koreanInstructionVoice: boolean;
}

export interface FlowState {
  screen: FlowScreen;
  source: PlacementSource;
  /** `levelOrder(profile.ageGroup)`: a reading level (0 = Pictures first), never an age. */
  levelOrder: 0 | 1 | 2 | null;
  locales: readonly UiLocale[];
  /** The language of this run only; never the UI locale or a profile setting. */
  testLocale: UiLocale;
  koreanAudio: boolean;
  /** See `FlowCapability.koreanInstructionVoice`. */
  koreanInstructionVoice: boolean;
  effectiveLevel: PlacementLevel;
  lastResult: PlacementResult | null;
  shortAvailable: boolean;
  mode: PlacementMode;
  /** C1 (one pre-filled Short card) or C2 (the full screen). */
  optionsLayout: 'card' | 'full';
  /** The run's sound guide; null until chosen (Standard and Deep never start without it). */
  revealMode: 'tap' | 'always' | null;
  takeMyTime: boolean;
  motivation: Motivation | null;
  /** Pictures first: listen-first formats in every mode, off after "Check without sound". */
  listenFirst: boolean;
  /** From the warm-up; null until it reports. */
  audio: boolean | null;
  warmupDone: boolean;
  /** Standard / Deep, not listen-first: "No sound here, so we will use pictures and reading". */
  noSoundNote: boolean;
}

export type FlowEvent =
  | { type: 'declineFork' }
  | { type: 'acceptFork'; capability: FlowCapability }
  | { type: 'pickLocale'; locale: UiLocale }
  | { type: 'confirmLanguage'; capability: FlowCapability }
  | { type: 'change' }
  | { type: 'selectMode'; mode: PlacementMode }
  | { type: 'setRevealMode'; revealMode: 'tap' | 'always' }
  | { type: 'setTakeMyTime'; on: boolean }
  | { type: 'setMotivation'; motivation: Motivation | null }
  | { type: 'next' }
  | { type: 'tapHoya' }
  | { type: 'warmupAudio'; result: 'played' | 'muted' | 'unavailable' }
  | { type: 'warmupAnswer' }
  | { type: 'tryAgain' }
  | { type: 'startLearning' }
  | { type: 'withoutSound' }
  | { type: 'runFinished' }
  /** The options screen's back arrow: to the language screen when it was shown (wireframe C, B). */
  | { type: 'back' };

const STAGE1_BAND0: PlacementLevel = { stage: 'stage1', band: 0 };

const rank = (level: PlacementLevel): number => placementStageNumber(level.stage) * 10 + level.band;

/** Short needs a Korean voice for the prompts and a voice for the instructions (section 3.1 step 3). */
export function shortAvailable(koreanAudio: boolean, instructionVoice: boolean): boolean {
  return koreanAudio && instructionVoice;
}

/**
 * The pre-selected mode: the first rule that matches (section 3.1 step 3).
 * Deep is never pre-selected; Short never once the route is above stage1 band 0.
 */
export function defaultMode(
  levelOrder: 0 | 1 | 2 | null,
  effectiveLevel: PlacementLevel,
  lastResult: PlacementResult | null,
  isShortAvailable: boolean,
): PlacementMode {
  if (lastResult !== null && shortHintFires(lastResult)) return 'standard';
  if (rank(effectiveLevel) > rank(STAGE1_BAND0)) return 'standard';
  if (levelOrder === 0 && isShortAvailable) return 'short';
  return 'standard';
}

export interface StartFlowInput {
  source: PlacementSource;
  levelOrder: 0 | 1 | 2 | null;
  /** `availableLocales()`. */
  locales: readonly UiLocale[];
  /** The effective UI locale (profile override, else device, else detected). */
  uiLocale: UiLocale;
  /** The snapshot's stored results (a missing list is `[]`). */
  placements: readonly PlacementResult[];
  /** `AccessibilityInfo.isScreenReaderEnabled()`: pre-sets Take my time, never the mode. */
  screenReader: boolean;
  /** Read now: used when the flow opens straight on the options screen. */
  capability: FlowCapability;
}

function newestOf(placements: readonly PlacementResult[]): PlacementResult | null {
  return [...placements].sort((a, b) => compareInstant(b.completedAt, a.completedAt))[0] ?? null;
}

/** `ko` can be the test language only with a Korean voice for its audio-only instructions (section 3.1 step 2). */
export function koreanSelectable(capability: Pick<FlowCapability, 'koreanAudio' | 'koreanInstructionVoice'>): boolean {
  return capability.koreanAudio && capability.koreanInstructionVoice;
}

/**
 * The test language to use: `preferred`, unless it is a `ko` that cannot be
 * chosen on this device; then English when shipped, else the first other locale.
 */
export function selectableLocale(locales: readonly UiLocale[], preferred: UiLocale, koOk: boolean): UiLocale {
  if (preferred !== 'ko' || koOk) return preferred;
  if (locales.includes('en')) return 'en';
  return locales.find((l) => l !== 'ko') ?? 'en';
}

const withCapability = (state: FlowState, capability: FlowCapability): FlowState => ({
  ...state,
  koreanAudio: capability.koreanAudio,
  koreanInstructionVoice: capability.koreanInstructionVoice,
  testLocale: selectableLocale(state.locales, state.testLocale, koreanSelectable(capability)),
});

function openOptions(state: FlowState, capability: FlowCapability): FlowState {
  const available = shortAvailable(capability.koreanAudio, capability.instructionVoice);
  const mode = defaultMode(state.levelOrder, state.effectiveLevel, state.lastResult, available);
  return {
    ...withCapability(state, capability),
    screen: 'options',
    shortAvailable: available,
    mode,
    optionsLayout: mode === 'short' ? 'card' : 'full',
    revealMode: null,
  };
}

function afterFork(state: FlowState, capability: FlowCapability): FlowState {
  if (state.locales.length > 1) return { ...withCapability(state, capability), screen: 'language' };
  // One shipped locale: the language screen is skipped and that locale is the test language.
  return openOptions({ ...state, testLocale: state.locales[0] ?? 'en' }, capability);
}

export function startFlow(input: StartFlowInput): FlowState {
  // The route seed's level does not depend on the catalogue or the tier.
  const seed = effectiveRoute(input.placements, { quests: [] }, { isEntitled: () => true, completedQuestIds: new Set() });
  const preferred = input.locales.includes(input.uiLocale) ? input.uiLocale : (input.locales[0] ?? 'en');
  const testLocale = selectableLocale(input.locales, preferred, koreanSelectable(input.capability));
  const base: FlowState = {
    screen: 'invite',
    source: input.source,
    levelOrder: input.levelOrder,
    locales: input.locales,
    testLocale,
    koreanAudio: input.capability.koreanAudio,
    koreanInstructionVoice: input.capability.koreanInstructionVoice,
    effectiveLevel: seed?.level ?? STAGE1_BAND0,
    lastResult: newestOf(input.placements),
    shortAvailable: false,
    mode: 'standard',
    optionsLayout: 'full',
    revealMode: null,
    takeMyTime: input.screenReader,
    motivation: null,
    listenFirst: input.levelOrder === 0,
    audio: null,
    warmupDone: false,
    noSoundNote: false,
  };
  return input.source === 'onboarding' ? base : afterFork(base, input.capability);
}

/** Whether NEXT / Start is enabled on the options screen. */
export function canProceed(state: FlowState): boolean {
  if (state.screen !== 'options') return false;
  return state.mode === 'short' ? state.shortAvailable : state.revealMode !== null;
}

/** The sound-guide question shows on the full screen for Standard and Deep only (Short asks none, P19). */
export function showSoundGuideQuestion(state: FlowState): boolean {
  return state.screen === 'options' && state.optionsLayout === 'full' && state.mode !== 'short';
}

/** Whether a run in this mode needs sound to start at all (Short, or any listen-first run). */
const needsSound = (state: FlowState): boolean => state.mode === 'short' || state.listenFirst;

const toQuestions = (state: FlowState): FlowState => ({ ...state, screen: state.warmupDone ? 'item' : 'warmup' });

export function flowReducer(state: FlowState, event: FlowEvent): FlowState {
  switch (state.screen) {
    case 'invite':
      if (event.type === 'declineFork') return { ...state, screen: 'declined' };
      if (event.type === 'acceptFork') return afterFork(state, event.capability);
      return state;
    case 'language':
      if (event.type === 'pickLocale') {
        if (event.locale === 'ko' && !koreanSelectable(state)) return state;
        return { ...state, testLocale: event.locale };
      }
      if (event.type === 'confirmLanguage') return openOptions(state, event.capability);
      return state;
    case 'options':
      switch (event.type) {
        case 'change':
          return { ...state, optionsLayout: 'full' };
        case 'selectMode':
          if (event.mode === 'short' && !state.shortAvailable) return state;
          return { ...state, mode: event.mode };
        case 'setRevealMode':
          return { ...state, revealMode: event.revealMode };
        case 'setTakeMyTime':
          return { ...state, takeMyTime: event.on };
        case 'setMotivation':
          return { ...state, motivation: event.motivation };
        case 'back':
          // After "Check without sound" the warm-up has run for this language: no way back to it.
          return state.locales.length > 1 && !state.warmupDone ? { ...state, screen: 'language' } : state;
        case 'next':
          if (!canProceed(state)) return state;
          if (state.mode === 'short' || state.levelOrder === 0) return { ...state, screen: 'handoff' };
          return toQuestions(state);
        default:
          return state;
      }
    case 'handoff':
      return event.type === 'tapHoya' ? toQuestions(state) : state;
    case 'warmup':
      if (event.type === 'warmupAudio') {
        if (event.result !== 'unavailable') return { ...state, audio: true };
        if (needsSound(state)) return { ...state, audio: false, screen: 'sound-needed' };
        return { ...state, audio: false, noSoundNote: true };
      }
      if (event.type === 'warmupAnswer') return { ...state, audio: state.audio ?? true, warmupDone: true, screen: 'item' };
      return state;
    case 'sound-needed':
      if (event.type === 'tryAgain') return { ...state, screen: 'warmup', audio: null, noSoundNote: false };
      if (event.type === 'startLearning') return { ...state, screen: 'left' };
      if (event.type === 'withoutSound') {
        // The grown-up's explicit choice of a Standard run with listen-first off;
        // the sound guide is asked again and the warm-up is not repeated.
        return {
          ...state,
          screen: 'options',
          optionsLayout: 'full',
          mode: 'standard',
          shortAvailable: false,
          revealMode: null,
          listenFirst: false,
          audio: false,
          warmupDone: true,
        };
      }
      return state;
    case 'item':
      return event.type === 'runFinished' ? { ...state, screen: 'result' } : state;
    default:
      return state;
  }
}

/** One tile of the language screen (section 3.1 step 2). */
export interface LanguageTile {
  locale: UiLocale;
  selected: boolean;
  /** `ko` without a Korean voice or a Korean instruction voice: its reading instructions are audio-only. */
  disabled: boolean;
  /** `learner.placement.language.<line>`. */
  line: 'noKoreanVoice' | 'noVoice' | null;
}

export function languageTiles(
  locales: readonly UiLocale[],
  selected: UiLocale,
  koreanAudio: boolean,
  hasInstructionVoice: (locale: UiLocale) => boolean,
): LanguageTile[] {
  return locales.map((locale) => {
    const disabled = locale === 'ko' && !(koreanAudio && hasInstructionVoice('ko'));
    const line = disabled ? 'noKoreanVoice' : hasInstructionVoice(locale) ? null : 'noVoice';
    return { locale, selected: locale === selected, disabled, line };
  });
}

/** One control a learner can act on: it is spoken when tapped and carries an icon, so nothing has to be read. */
export interface FlowControl {
  id: 'options.start' | 'options.change' | 'handoff.hoya';
  spoken: true;
  /** A design-system `IconName`, or `hoya` for the Hoya button itself. */
  icon: 'play' | 'pencil' | 'hoya';
  /** What the control sends to `flowReducer`. */
  event: FlowEvent;
}

/**
 * The controls on the screens a Pictures first learner passes from the
 * options card (C1) to the warm-up (section 3.1 step 3a). The P-6 screens
 * render exactly these; screens outside that path return none here (the full
 * options screen C2 is a grown-up screen).
 */
export function controlsFor(state: FlowState): readonly FlowControl[] {
  if (state.screen === 'options' && state.optionsLayout === 'card') {
    return [
      { id: 'options.start', spoken: true, icon: 'play', event: { type: 'next' } },
      { id: 'options.change', spoken: true, icon: 'pencil', event: { type: 'change' } },
    ];
  }
  if (state.screen === 'handoff') return [{ id: 'handoff.hoya', spoken: true, icon: 'hoya', event: { type: 'tapHoya' } }];
  return [];
}

export interface RunConfigContext {
  profileId: string;
  startedAtMs: number;
  screenReader: boolean;
  /** `canPlayKorean(getCapability())` when the run starts. */
  koreanAudio: boolean;
  /** `previousExclude(placements)`. */
  exclude: string[];
  resolvesPicture: (ref: string) => boolean;
  /** The bank's warm-up template (`PLACEMENT_WARMUP`). */
  warmup: { question: { tags: readonly string[] } };
}

/** The warm-up's word, never drawn as a scored question (section 3.1 step 4). */
export function warmupAvoidTags(warmup: { question: { tags: readonly string[] } }): string[] {
  return warmup.question.tags.filter((tag) => tag.startsWith('word:'));
}

/** The template ids of the newest stored result: excluded while each rung keeps three questions. */
export function previousExclude(placements: readonly PlacementResult[]): string[] {
  return newestOf(placements)?.responses.map((r) => r.questionId) ?? [];
}

/** The rungs a Korean test language with a screen reader leaves unasked. */
export const KOREAN_SCREEN_READER_SKIP: readonly PlacementGate[] = ['vocab', 'sentence'];

/** The engine configuration of the flow's choices. Short runs `tap` without a reveal button (P19). */
export function runConfig(state: FlowState, ctx: RunConfigContext): PlacementConfig {
  const revealMode = state.mode === 'short' ? 'tap' : state.revealMode;
  if (revealMode === null) throw new Error('a Standard or Deep run needs an explicit sound guide choice');
  // Korean picture options carry no text label (it would be the answer), so a
  // screen-reader user is not asked them: reported not-tested, never a failure (section 3.2).
  const unlabeledPictures = state.testLocale === 'ko' && ctx.screenReader;
  return {
    mode: state.mode,
    ...(unlabeledPictures ? { skipGates: KOREAN_SCREEN_READER_SKIP } : {}),
    listenFirst: state.listenFirst,
    avoidTags: warmupAvoidTags(ctx.warmup),
    revealMode,
    audio: state.audio === true && ctx.koreanAudio,
    visual: !ctx.screenReader,
    takeMyTime: state.takeMyTime,
    seed: hashSeed([ctx.profileId, String(ctx.startedAtMs)]),
    exclude: [...ctx.exclude],
    resolvesPicture: ctx.resolvesPicture,
  };
}

// ---------------------------------------------------------------------------
// The item screen (section 3.1 step 5)
// ---------------------------------------------------------------------------

export const FALLBACK_EXTRA_MS = 3_000;
export const FALLBACK_MAX_MS = 8_000;

/** When a Short item's choices enable if the prompt never reports its end. */
export function choicesFallbackMs(estimatedPromptMs: number): number {
  return Math.min(estimatedPromptMs + FALLBACK_EXTRA_MS, FALLBACK_MAX_MS);
}

/**
 * Short enables the choices when the prompt's playback ends or after the
 * fallback delay, whichever comes first; Standard and Deep at once. "I am
 * not sure" and the exit are always enabled.
 */
export function choicesEnabled(input: {
  mode: PlacementMode;
  playbackEnded: boolean;
  shownAtMs: number;
  nowMs: number;
  estimatedPromptMs: number;
}): boolean {
  if (input.mode !== 'short' || input.playbackEnded) return true;
  return input.nowMs - input.shownAtMs >= choicesFallbackMs(input.estimatedPromptMs);
}

/**
 * Prompts play on open (the warm-up's tap unlocked audio); the first item
 * after a resume or a cold start, and every item with a screen reader on,
 * plays on a tap of the speaker instead.
 */
export function promptPlayback(input: { screenReader: boolean; needsGesture: boolean }): 'auto' | 'tap' {
  return input.screenReader || input.needsGesture ? 'tap' : 'auto';
}

/** Short speaks the instruction on the first item of each rung only. */
export function speaksInstruction(mode: PlacementMode, indexInRung: number): boolean {
  return mode !== 'short' || indexInRung === 0;
}

/** A neutral "Got it", or in Short only the footstep trail filling. */
export function acknowledgement(mode: PlacementMode): 'got-it' | 'trail' {
  return mode === 'short' ? 'trail' : 'got-it';
}

// ---------------------------------------------------------------------------
// Pause (section 3.1 step 6)
// ---------------------------------------------------------------------------

/** `AppState` leaving the foreground opens the exit pause, so the backstop stops. */
export function appStateEvent(appState: string): PlacementEvent | null {
  return appState === 'background' || appState === 'inactive' ? { type: 'exit' } : null;
}

/** The caller's inactivity timer: 45 seconds, none with Take my time. */
export function idleTimeoutMs(takeMyTime: boolean): number | null {
  return takeMyTime ? null : IDLE_PAUSE_MS;
}

export interface PauseSheet {
  /** `pause`: "Need a break?"; `rest`: Deep's number-free rest card. */
  kind: 'pause' | 'rest';
  /** The grown-up PIN link (stop reason `grown-up`). */
  grownUpLink: boolean;
  /** "That is enough, start learning": the engine ends with `not-sure` after three "not sure", else `quit`. */
  enough: PlacementEvent;
}

export function pauseSheet(state: Pick<PlacementRunState, 'pause'>): PauseSheet | null {
  if (state.pause === null) return null;
  const enough: PlacementEvent = { type: 'quit', by: 'learner' };
  return state.pause === 'rest' ? { kind: 'rest', grownUpLink: false, enough } : { kind: 'pause', grownUpLink: true, enough };
}

// ---------------------------------------------------------------------------
// Resume (section 3.1 step 8)
// ---------------------------------------------------------------------------

export const RESUME_WINDOW_MS = 24 * 60 * 60 * 1000;

/** What `placement-run:<profileId>` holds: the engine state plus what `finishRun` needs. */
export const SavedRunSchema = z.object({
  version: z.literal(1),
  savedAtMs: z.number(),
  testLocale: UiLocaleSchema,
  source: PlacementSourceSchema,
  motivation: MotivationSchema.optional(),
  run: PlacementRunStateSchema,
});
export type SavedRun = z.infer<typeof SavedRunSchema>;

/**
 * What a saved run offers on reopening (section 3.1 step 8):
 * - `continue`: an open run saved within 24 hours from the same bank version
 *   (**Continue** / **Start again**);
 * - `finish`: a run that stopped but whose result was never recorded (the
 *   app closed between the last answer and `recordPlacement`). The caller
 *   runs `finishRun(saved.run, ...)` with `completedAt` from `saved.savedAtMs`
 *   (when the stop was saved), then `recordPlacement`, then `discard`. It
 *   needs neither the bank nor the clock window, so a finished check is never
 *   lost; recording twice is harmless (the id comes from the seed and the
 *   merge keeps one copy per id).
 * Anything else (stale, another bank, a stop with no answer, a value that
 * does not parse) is null and is discarded silently.
 */
export type ResumeOffer = { kind: 'continue'; saved: SavedRun } | { kind: 'finish'; saved: SavedRun };

export function resumableRun(saved: unknown, nowMs: number, bankVersion: number): ResumeOffer | null {
  const parsed = SavedRunSchema.safeParse(saved);
  if (!parsed.success) return null;
  const run = parsed.data;
  if (run.run.stop !== null) return run.run.responses.length > 0 ? { kind: 'finish', saved: run } : null;
  const age = nowMs - run.savedAtMs;
  if (age < 0 || age > RESUME_WINDOW_MS) return null;
  if (run.run.bankVersion !== bankVersion) return null;
  return { kind: 'continue', saved: run };
}

/**
 * The clocks of a run reopened after time away. The saved times are absolute,
 * and time away never uses up the backstop (section 3.1 step 6): the deadline
 * moves by the time since the last touch, and the idle clock and the open
 * question's `ms` start again now. A run saved with a pause open (three "not
 * sure", Deep's rest card) is left as it is: **Keep going** already moves the
 * deadline by the whole time since the pause opened.
 */
export function resumeClocks(run: PlacementRunState, nowMs: number): PlacementRunState {
  if (run.stop !== null || run.pause !== null) return run;
  const away = Math.max(0, nowMs - run.lastTouchMs);
  return {
    ...run,
    deadlineMs: run.deadlineMs === null ? null : run.deadlineMs + away,
    lastTouchMs: nowMs,
    shownAtMs: nowMs,
  };
}

/**
 * The flow of a saved run that is opened again (section 3.1 step 8):
 * `continue` goes straight to the question it stopped at, `finish` to the
 * result (the caller records it first). The run's own settings win over the
 * fresh flow's, so the screens match what the run was started with.
 */
export function resumedFlow(state: FlowState, offer: ResumeOffer): FlowState {
  const { saved } = offer;
  const config = saved.run.config;
  return {
    ...state,
    screen: offer.kind === 'continue' ? 'item' : 'result',
    source: saved.source,
    testLocale: saved.testLocale,
    mode: config.mode,
    revealMode: config.revealMode,
    takeMyTime: config.takeMyTime,
    listenFirst: config.listenFirst,
    motivation: saved.motivation ?? null,
    audio: config.audio,
    warmupDone: true,
  };
}

/**
 * "Try it with the sound guide hidden" on the result (section 3.1 step 7):
 * a new flow on the full options screen with the same length and the guide
 * hidden, which is the learner's explicit choice for this run; NEXT then
 * starts it. Short asks no sound-guide question, so a Short is left as it is.
 */
export function withGuideHidden(state: FlowState, mode: PlacementMode): FlowState {
  if (state.screen !== 'options' || mode === 'short') return state;
  return flowReducer(flowReducer(flowReducer(state, { type: 'change' }), { type: 'selectMode', mode }), {
    type: 'setRevealMode',
    revealMode: 'tap',
  });
}
