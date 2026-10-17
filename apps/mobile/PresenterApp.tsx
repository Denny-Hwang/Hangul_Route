import { WORD_ART_KEYS, colors, presenter, supportedCardIds } from '@hangul-route/design-system';
import { LOCALE_META, availableLocales, dictionaryLocale, getMessages, type UiLocale } from '@hangul-route/i18n';
import { encodeDeck, type LectureDeck } from '@hangul-route/content-schema';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { View, useWindowDimensions } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { canPlayKorean, type AudioCapability } from './src/logic/audio/capability';
import { lectureBundle } from './src/logic/lecture/content';
import { lectureStories } from './src/logic/lecture/sources/story';
import { readToMePlan } from './src/logic/lecture/story-slides';
import { createAudioRunner } from './src/logic/story/audio-runner';
import { initialPresenterState, reduce, type PresenterEvent, type PresenterState } from './src/logic/lecture/controls';
import { expandDeck, withBuilds, type Slide } from './src/logic/lecture/deck-builder';
import type { KeyCommand } from './src/logic/lecture/keymap';
import { recentView } from './src/logic/lecture/home-view';
import { quickSource } from './src/logic/lecture/quick-source';
import { commitRecent, emptyRecent, forgetDeck, readRecent, rememberDeck, setLastSlide, type LoadedRecent, type RecentList, type RecentStore } from './src/logic/lecture/recent';
import { languageOptions } from './src/logic/locale/language-picker';
import {
  completePayload,
  homeStart,
  nextStrokePlay,
  presenterLocale,
  resolveBoot,
  runDeck,
  SHELL_SLIDE_KINDS,
  startPayload,
  startTally,
  strokeTokenFor,
  tallyStep,
  voiceCheck,
  type BootResult,
  type RunTally,
  type StartSource,
  type StrokePlay,
  type HomeChoice,
  voiceState,
} from './src/logic/lecture/shell';
import { BAR_SHOW_GRACE_MS, FONT_WAIT_MS, TIMER_TICK_MS, isPhoneWindow, stageBox } from './src/logic/lecture/stage-constants';
import { initialTimer, justFinished, reduceTimer, type TimerEvent, type TimerState } from './src/logic/lecture/timer';
import { firstUses, fullscreenToggle, gridItems, helpLanguageChips, narrationStops, sayItShown, statusChips, timerOpenEvent, toolsOpened, type LectureTool } from './src/logic/lecture/tools';
import { BAR_BAND, PHONE_RULE, PHONE_STAGE_BOUNDS, STAGE_BOUNDS } from './src/screens/presenter/stage-metrics';
import { slideSound } from './src/logic/lecture/slide-view';
import { stageScale } from './src/logic/lecture/stage-scale';
import { getCapability, playPrompt, refreshCapability, stop as stopAudio, subscribeCapability, unlockAudio } from './src/platform/audio';
import { setDocumentLang } from './src/platform/locale';
import { coarsePointer } from './src/platform/orientation';
import { isOnline, subscribeOnline } from './src/platform/online';
import { useReducedMotion } from './src/platform/motion';
import {
  checkForUpdate,
  enterFullscreenLandscape,
  enterPresenterStep,
  exitFullscreen,
  fullscreenSupported,
  isFullscreen,
  keepScreenAwake,
  forgetOpenDeck,
  leavePresenter,
  playChime,
  releaseScreenAwake,
  reloadForUpdate,
  reloadOnDeckLink,
  returnToPresenterHome,
  setPresenterDocTitle,
  subscribeActivity,
  subscribeFullscreen,
  subscribeKeys,
  subscribePresenterPop,
  type StepEntry,
  takeDeckFragment,
  unlockChime,
  unlockOrientation,
  waitForPresenterFont,
  wakeLockSupported,
  type DeckAddress,
} from './src/platform/presenter';
import { applyUpdate, isOfflineReady, subscribePwa } from './src/platform/pwa';
import { readJsonExact, writeJson } from './src/platform/storage';
import { flushQueue, track } from './src/platform/telemetry';
import { ControlBar } from './src/screens/presenter/ControlBar';
import { ExitConfirm } from './src/screens/presenter/ExitConfirm';
import { PresenterHomeScreen } from './src/screens/presenter/HomeScreen';
import { BlankOverlay, PauseOverlay } from './src/screens/presenter/overlays/BlankOverlay';
import { GridOverlay } from './src/screens/presenter/overlays/GridOverlay';
import { HelpOverlay } from './src/screens/presenter/overlays/HelpOverlay';
import { TimerOverlay, type TimerControls } from './src/screens/presenter/overlays/TimerOverlay';
import { PresenterViewProvider, type PresenterView } from './src/screens/presenter/presenter-context';
import { Stage, StageHint } from './src/screens/presenter/Stage';
import { StartScreen } from './src/screens/presenter/StartScreen';
import { StatePage } from './src/screens/presenter/StatePage';
import { useAudioStore } from './src/store/audio-store';
import { activeLocale, useLocaleStore } from './src/store/locale-store';

/**
 * The lecture presenter, the `/present` root of the learner web build (F-TCH-004 PR 6; spec
 * sections 3.1 to 3.9; design/screens/presenter/). Chosen before anything mounts (`index.ts`,
 * `platform/app-root.web.ts`), so none of the learner boot runs: no profile, progress, sync,
 * inbox or plan store is read or written, and `PwaBanners` is not mounted, so no update applies
 * mid-lesson (a waiting update applies on the Exit confirm).
 *
 * Boot: the `#d=` deck fragment is read and taken out of the address before the first paint; a
 * reload reopens the tab's open lesson from Recent at its slide. It hydrates the audio settings
 * and the device locale only (section 3.9). The start screen checks the device, waits for the
 * presenter font, and its Start tap unlocks audio. Fullscreen, the wake lock and landscape are
 * asked for, `lecture.start` is sent and Recent is written only when the first slide is actually
 * shown, so a Start on a phone held upright (the turn-sideways page) or in a window too small is
 * neither counted nor stored until the stage appears. Writes: `lecture:recent` (a deck has no name
 * field) and the telemetry queue.
 *
 * Phones (owner report 2026-10-16 items 1 and 3): a phone window gets the whole window as the
 * stage (less the safe-area insets) with the compact bar floating over its bottom edge, and is too
 * small only below `PHONE_COMPACT_WIDTH`. Every step has a way back: one history entry each for
 * the home, the start screen and the lesson, so the browser's Back goes lesson -> Exit confirm (a
 * second Back confirms), start screen -> home, home -> the page before; the home has its own Back.
 * A deck's `options.uiLocale` seeds the session language, so Back and Exit keep the start
 * screen's language.
 *
 * The class tools (PR 9): the timer (corner or full), Blank and its Pause, the slide grid and Keys
 * and controls, each reported once per lecture as `lecture.tool_used` (the tool name only). The
 * timer lives in memory for this lecture and is dropped on Exit. The helper picker is gone (LV-H):
 * a deck from an older link may still name one, and the presenter ignores it.
 */

// The strict read throws on a failed or damaged read, so Recent is then never written over (`readRecent`).
const recentStore: RecentStore = { readJson: (key) => readJsonExact<unknown>(key), writeJson: (key, value) => writeJson(key, value) };

let bootRead: { address: DeckAddress | null } | null = null;

/** The address is read once per page, before the first paint (the fragment then leaves it). */
function readAddress(): DeckAddress | null {
  if (bootRead === null) bootRead = { address: takeDeckFragment() };
  return bootRead.address;
}

/** `fresh`: Start over held the deck to open at its first slide on a reload before Start. */
type ReadyPhase = { kind: 'ready'; deck: LectureDeck; source: StartSource; resumeKey?: string; fresh?: true };

type Phase =
  | { kind: 'boot' }
  | { kind: 'invalid'; stale?: true }
  | { kind: 'home' }
  | ReadyPhase
  /** `from`: the start screen it came from, for the turn-sideways page's Back. */
  | { kind: 'running'; deck: LectureDeck; source: StartSource; from: ReadyPhase };

function phaseOf(result: BootResult, address: DeckAddress | null): Phase {
  if (result.kind === 'deck') {
    return {
      kind: 'ready',
      deck: result.deck,
      source: result.source,
      ...(result.resumeKey !== undefined ? { resumeKey: result.resumeKey } : {}),
      ...(address?.fresh === true ? { fresh: true as const } : {}),
    };
  }
  // A link from a newer presenter (AMENDMENTS-LECTURE-V2 section 4.5): the page offers Reload.
  if (result.kind === 'invalid') return result.reason === 'unsupported_version' ? { kind: 'invalid', stale: true } : { kind: 'invalid' };
  return { kind: result.kind };
}

/** The presenter root: the gesture and safe-area providers, then the presenter (`useSafeAreaInsets` needs the provider above it). */
export default function PresenterApp(): React.ReactElement {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Presenter />
        <StatusBar style="dark" />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function Presenter(): React.ReactElement {
  const address = useMemo(readAddress, []);
  // A link opens at once; a reloaded deck waits for Recent (it may resume at its slide); no deck is the home.
  const [phase, setPhase] = useState<Phase>(() =>
    address === null ? { kind: 'home' } : address.reloaded ? { kind: 'boot' } : phaseOf(resolveBoot(address, emptyRecent()), address),
  );
  // Recent lessons, read once at boot; every change chains on the read, so a fast Start never saves over it.
  const recent = useRef<Promise<LoadedRecent>>(Promise.resolve({ list: emptyRecent(), writable: false }));
  // What the home draws: null until the boot read lands, then every committed change.
  const [recentLoaded, setRecentLoaded] = useState<LoadedRecent | null>(null);
  const updateRecent = useCallback((change: (list: RecentList) => RecentList) => {
    recent.current = recent.current
      .then((loaded) => commitRecent(recentStore, loaded, change))
      .then((next) => {
        setRecentLoaded(next);
        return next;
      });
  }, []);
  const deviceLocale = useLocaleStore((s) => activeLocale(s, null));
  // A language chip on the home holds for this session only (memory; section 3.12).
  const [sessionLocale, setSessionLocale] = useState<UiLocale | null>(null);
  const available = useMemo(() => availableLocales(), []);
  const deck = phase.kind === 'ready' || phase.kind === 'running' ? phase.deck : null;
  const locale: UiLocale = presenterLocale({ deck, session: sessionLocale, device: deviceLocale, available });
  const messages = useMemo(() => getMessages(dictionaryLocale(locale)), [locale]);
  // A deck's language seeds this session's language (memory only), so Back and Exit keep the start
  // screen's language instead of falling back to the device's; a chip already chosen wins.
  const deckLocale = deck?.options.uiLocale;
  useEffect(() => {
    if (deckLocale !== undefined && available.includes(deckLocale)) setSessionLocale((current) => current ?? deckLocale);
  }, [deckLocale, available]);
  const reducedMotion = useReducedMotion();
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // A phone window: the compact bar over the stage and the phone's too-small width (owner report 2026-10-16).
  const phone = isPhoneWindow(window.width, window.height, PHONE_RULE);
  const upright = window.height > window.width;
  // Touch is the device's main input: Help starts with How to use, and a focused bar button does not hold the bar.
  const touch = useMemo(coarsePointer, []);
  const [band, setBand] = useState<number>(BAR_BAND);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreOpenRef = useRef(moreOpen);
  moreOpenRef.current = moreOpen;
  const [capability, setCapability] = useState<AudioCapability>(getCapability);
  const [voiceChecked, setVoiceChecked] = useState(false);
  const muted = useAudioStore((s) => s.muted);
  const [updateWaiting, setUpdateWaiting] = useState(false);
  // After Exit or an invalid link the home takes focus on its h1 (design home.md).
  const [homeFocus, setHomeFocus] = useState(false);
  // Keys and help on the presenter home (home.md): the Help overlay with no lesson open.
  const [homeHelp, setHomeHelp] = useState(false);
  // The bar's Offline chip (section 3.8): the lesson keeps working; only the chip changes.
  const [online, setOnline] = useState(isOnline);
  useEffect(() => subscribeOnline(setOnline), []);
  // The browser blocked the last sound (a long idle): the speaker reads "Tap to hear" (section 3.7).
  const [soundBlocked, setSoundBlocked] = useState(false);

  // Boot: the audio settings and the device locale only (no profile), the voice check, the queue.
  useEffect(() => {
    let live = true;
    void useAudioStore.getState().hydrate().catch(() => undefined);
    // A `?lang=` hand-off is held for this page only: the presenter never writes the device locale (section 3.9).
    void useLocaleStore.getState().hydrate([], { handoff: 'session' }).catch(() => undefined);
    const offCapability = subscribeCapability(setCapability);
    void refreshCapability()
      .catch(() => undefined)
      .then(() => {
        if (live) setVoiceChecked(true);
      });
    void flushQueue();
    recent.current = readRecent(recentStore);
    void recent.current.then((loaded) => {
      if (live) setRecentLoaded(loaded);
    });
    if (address?.reloaded) {
      void recent.current.then(({ list }) => {
        if (live) setPhase(phaseOf(resolveBoot(address, list), address));
      });
    }
    const offLink = reloadOnDeckLink();
    const offPwa = subscribePwa((event) => {
      if (event === 'back-online') void flushQueue();
      if (event === 'update-ready') setUpdateWaiting(true);
    });
    return () => {
      live = false;
      offCapability();
      offPwa();
      offLink();
    };
  }, [address]);

  // The fixed tab title and the page language follow the presenter locale; never the deck title.
  useEffect(() => {
    setPresenterDocTitle(messages.learner.presenter.docTitle);
    setDocumentLang(LOCALE_META[locale].htmlLang);
  }, [messages, locale]);

  const bundle = useMemo(() => lectureBundle(locale), [locale]);
  // Story scenes for the story slides: art, theme, accessible name and Read-to-me's voice (PR 11).
  const stories = useMemo(() => lectureStories(locale), [locale]);
  const narrator = useMemo(() => createAudioRunner({ playPrompt, stop: stopAudio }), []);
  const canPlay = canPlayKorean(capability);
  const expanded = useMemo(() => (deck ? expandDeck(deck, bundle, { canPlayKorean: canPlay }) : null), [deck, bundle, canPlay]);
  const run = useMemo(() => (deck && expanded ? runDeck(deck, expanded, SHELL_SLIDE_KINDS, supportedCardIds, WORD_ART_KEYS) : null), [deck, expanded]);

  // A link that does not decode, or a deck with nothing to show: the invalid screen, once per page.
  const rejected = useRef(false);
  // One Reload at a time: a second tap while the newer presenter installs starts nothing new.
  const reloading = useRef(false);
  useEffect(() => {
    if (phase.kind === 'invalid' && !rejected.current && address !== null) {
      rejected.current = true;
      const decoded = resolveBoot(address, emptyRecent());
      void track({ name: 'lecture.deck_rejected', payload: { reason: decoded.kind === 'invalid' ? decoded.reason : 'invalid' } });
      forgetOpenDeck();
      // Look for the newer presenter now, so Reload finds it installed.
      if (phase.stale) void checkForUpdate();
    }
    if (phase.kind === 'ready' && run !== null && run.slides.length === 0) {
      if (!rejected.current) {
        rejected.current = true;
        void track({ name: 'lecture.deck_rejected', payload: { reason: 'invalid' } });
      }
      forgetOpenDeck();
      setPhase({ kind: 'invalid' });
    }
  }, [phase, run, address]);

  const view: PresenterView = useMemo(() => ({ messages, locale, unit: 0, reducedMotion, soundBlocked }), [messages, locale, reducedMotion, soundBlocked]);

  // ---- the start screen ----
  const [fontReady, setFontReady] = useState(false);
  useEffect(() => {
    if (phase.kind !== 'ready') return undefined;
    let live = true;
    void waitForPresenterFont(FONT_WAIT_MS, presenter.font).then(() => {
      if (live) setFontReady(true);
    });
    return () => {
      live = false;
    };
  }, [phase.kind]);

  // ---- running ----
  const [pstate, setPstate] = useState<PresenterState | null>(null);
  const stateRef = useRef<PresenterState | null>(null);
  const tally = useRef<RunTally | null>(null);
  const [romanization, setRomanization] = useState<'always' | 'tap' | null>(null);
  const [strokePlay, setStrokePlay] = useState<StrokePlay | null>(null);
  const [fullscreen, setFullscreen] = useState(isFullscreen);
  const exitRef = useRef<View>(null);
  const finishRef = useRef<View>(null);
  // The lesson began: its first slide was shown (fullscreen asked, Recent written, lecture.start sent).
  const begun = useRef(false);

  // ---- the class tools (PR 9; TD5: teacher tools, nothing about a learner is kept or sent) ----
  const toolsUsed = useRef<ReadonlySet<LectureTool>>(new Set());
  const reportTools = useCallback((tools: readonly LectureTool[]) => {
    const { used, fresh } = firstUses(toolsUsed.current, tools);
    toolsUsed.current = used;
    for (const tool of fresh) void track({ name: 'lecture.tool_used', payload: { tool } });
  }, []);
  const [timer, setTimer] = useState<TimerState>(initialTimer);
  const timerRef = useRef<TimerState>(timer);
  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  const stepTimer = useCallback((event: TimerEvent) => {
    const before = timerRef.current;
    const after = reduceTimer(before, event);
    if (after === before) return;
    timerRef.current = after;
    setTimer(after);
    // At zero: the soft chime, unless muted; never speech, never an alarm (section 3.5).
    if (justFinished(before, after)) playChime(mutedRef.current);
  }, []);
  useEffect(() => {
    if (timer.status !== 'running') return undefined;
    const id = setInterval(() => stepTimer({ type: 'tick', now: Date.now() }), TIMER_TICK_MS);
    return () => clearInterval(id);
  }, [timer.status, stepTimer]);
  const [showNumbers, setShowNumbers] = useState(true);
  const [keepVisible, setKeepVisible] = useState(false);
  const keepVisibleRef = useRef(keepVisible);
  keepVisibleRef.current = keepVisible;
  const slides: Slide[] = useMemo(() => {
    if (!deck || !run) return [];
    const mode = romanization ?? deck.options.romanization;
    return mode === deck.options.romanization ? run.slides : withBuilds(run.slides, { romanization: mode, strokeGuide: deck.options.strokeGuide });
  }, [deck, run, romanization]);

  const playSound = useCallback(
    (slide: Slide | undefined) => {
      if (!slide || !deck?.options.sound) return;
      if (slide.kind === 'story') {
        // Read-to-me (S or Sound): the narration in its own voice, keyword chips in Korean, with the
        // story reader's voice rules; the text is on the slide either way (D6).
        const narrationLang = stories.scene(slide.storyId, slide.sceneId)?.narrationLang ?? 'en-US';
        const plan = readToMePlan(slide, { sound: deck.options.sound, canPlayKorean: canPlay, voiceChecked, narrationLang });
        if (plan) void narrator.play(plan.steps, plan.options);
        return;
      }
      const spoken = slideSound(slide);
      if (!spoken) return;
      const { text, audioRef } = spoken;
      const at = Date.now();
      void playPrompt({ text, ...(audioRef !== undefined ? { audioRef } : {}), kind: 'sound', source: 'presenter' }).then((result) => {
        const failure = useAudioStore.getState().lastFailure;
        setSoundBlocked(result !== 'played' && failure !== null && failure.reason === 'blocked' && failure.at >= at);
      });
    },
    [deck, stories, narrator, canPlay, voiceChecked],
  );

  const dispatch = useCallback(
    (event: PresenterEvent) => {
      const before = stateRef.current;
      if (!before || slides.length === 0) return;
      const { state, effect } = reduce(before, event, { slides });
      stateRef.current = state;
      setPstate(state);
      reportTools(toolsOpened(before, state));
      if (effect?.type === 'start-timer') stepTimer({ type: 'start', ms: effect.ms, now: Date.now() });
      if (tally.current) tally.current = tallyStep(tally.current, before, state, slides);
      // A story's Read-to-me never runs on into the next slide, nor under an overlay or the full timer.
      if (narrationStops(before, state)) narrator.stop();
      if (state.slideIdx !== before.slideIdx && deck && begun.current) {
        const key = slides[state.slideIdx]!.key;
        updateRecent((list) => setLastSlide(list, deck.id, key));
      }
      // Next on the End slide moves focus to its [ Finish ] (the bar stays visible there).
      const atEnd = event === 'next' && state === before && before.overlay === null && before.slideIdx === slides.length - 1;
      if (atEnd) finishRef.current?.focus?.();
      // The stroke guide plays only on a forward stroke reveal or a replay; any other slide change
      // drops it, so going back to a complete slide is silent (section 3.5 amendment point 2).
      const revealedBuild = effect?.type === 'revealed' ? slides[state.slideIdx]?.builds[effect.build] : undefined;
      const playStroke = revealedBuild === 'stroke' || effect?.type === 'play-stroke';
      const slideKey = slides[state.slideIdx]!.key;
      setStrokePlay((current) => nextStrokePlay(current, { slideKey, play: playStroke }));
      if (revealedBuild === 'sound' || effect?.type === 'play-sound') playSound(slides[state.slideIdx]);
    },
    [slides, deck, playSound, updateRecent, reportTools, stepTimer, narrator],
  );

  const toggleFullscreen = useCallback(() => {
    // Leaving is a use too: Start already entered full screen, so the first press usually leaves it.
    const { action, tools } = fullscreenToggle(isFullscreen());
    void (action === 'exit' ? exitFullscreen() : enterFullscreenLandscape());
    reportTools(tools);
  }, [reportTools]);

  useEffect(() => subscribeFullscreen(() => setFullscreen(isFullscreen())), []);

  const onStart = useCallback(() => {
    if (phase.kind !== 'ready' || !run || slides.length === 0) return;
    // Gesture-bound unlocks in the tap itself (section 3.5); each is feature-detected and may be refused.
    unlockAudio();
    unlockChime();
    const state = initialPresenterState({ slides }, phase.resumeKey);
    stateRef.current = state;
    setPstate(state);
    toolsUsed.current = new Set();
    begun.current = false;
    setMoreOpen(false);
    setPhase({ kind: 'running', deck: phase.deck, source: phase.source, from: phase });
    const first = slides[state.slideIdx]!;
    setStrokePlay(first.builds[0] === 'stroke' ? nextStrokePlay(null, { slideKey: first.key, play: true }) : null);
  }, [phase, run, slides]);

  /**
   * The lesson begins when its first slide is actually on screen (owner report 2026-10-16): only
   * then fullscreen and landscape are asked for, the wake lock taken, the lesson saved to Recent,
   * the lesson entry pushed and `lecture.start` sent, so a Start the window could not show (a phone
   * held upright, a window too small) is neither counted nor stored.
   */
  const begin = useCallback(() => {
    if (phase.kind !== 'running' || begun.current || !run || !stateRef.current) return;
    begun.current = true;
    // Landscape is asked for once fullscreen settles (Android Chrome locks only in fullscreen).
    void enterFullscreenLandscape();
    void keepScreenAwake();
    const state = stateRef.current;
    tally.current = startTally(Date.now(), slides[state.slideIdx]?.key);
    const savedAt = new Date().toISOString();
    const key = slides[state.slideIdx]!.key;
    const { deck: started } = phase;
    // Every start, a resumed one too, moves the lesson to the top of Recent with today's day (section 3.12).
    updateRecent((list) => setLastSlide(rememberDeck(list, started, savedAt), started.id, key));
    // The lesson's own history entry: the browser's Back now asks before leaving. A reload resumes at the open slide.
    let raw: string | null = null;
    try {
      raw = encodeDeck(started);
    } catch {
      // A deck too long for a link still runs; a reload then shows the home.
    }
    enterPresenterStep('lesson', raw);
    void track({
      name: 'lecture.start',
      payload: { ...startPayload({ deck: started, run, source: phase.source, capability, offlineReady: isOfflineReady() }) },
    });
  }, [phase, run, slides, capability, updateRecent]);

  /** Out of the lesson (or the page that stood in for it) to the home: the class tools and the history steps go. */
  const leaveLesson = useCallback(() => {
    narrator.stop();
    stateRef.current = null;
    setPstate(null);
    // The class tools end with the lesson: the timer and the tool tally are dropped.
    timerRef.current = initialTimer();
    setTimer(timerRef.current);
    setShowNumbers(true);
    toolsUsed.current = new Set();
    setRomanization(null);
    setMoreOpen(false);
    returnToPresenterHome();
    setHomeFocus(true);
    setPhase({ kind: 'home' });
  }, [narrator]);

  const onExit = useCallback(() => {
    const started = begun.current;
    begun.current = false;
    leaveLesson();
    // A Start the window never showed was not a lesson: nothing to release, count or apply.
    if (!started) return;
    void exitFullscreen();
    void releaseScreenAwake();
    unlockOrientation();
    const payload = tally.current ? completePayload(tally.current, Date.now()) : { slidesShown: 0, minutes: 0, reveals: 0 };
    tally.current = null;
    void track({ name: 'lecture.complete', payload }).finally(() => {
      // A waiting update applies only now, never mid-lesson (section 3.8).
      if (updateWaiting) applyUpdate();
    });
  }, [updateWaiting, leaveLesson]);

  /** The turn-sideways page's Back: the start screen again, with the same deck (nothing was started). */
  const backToStart = useCallback(() => {
    if (phase.kind !== 'running' || begun.current) return;
    stateRef.current = null;
    setPstate(null);
    setMoreOpen(false);
    setPhase(phase.from);
  }, [phase]);

  // Leaving the page stops Read-to-me too.
  useEffect(() => () => narrator.stop(), [narrator]);

  // Keys (section 3.5), the class tools included.
  useEffect(() => {
    if (phase.kind !== 'running') return undefined;
    return subscribeKeys((command: KeyCommand) => {
      // An open overlay takes no romanization or fullscreen key; the Exit confirm takes no tool key.
      const overlayOpen = stateRef.current?.overlay != null;
      if ((command === 'toggle-romanization' || command === 'fullscreen') && overlayOpen) return;
      if (command === 'toggle-romanization') {
        setRomanization((current) => ((current ?? phase.deck.options.romanization) === 'always' ? 'tap' : 'always'));
        return;
      }
      if (command === 'fullscreen') {
        toggleFullscreen();
        return;
      }
      // Esc closes the compact bar's More sheet first.
      if (command === 'escape' && moreOpenRef.current) {
        setMoreOpen(false);
        return;
      }
      if (typeof command === 'object') {
        if (stateRef.current?.overlay === 'exit') return;
        if (command.overlay === 'timer') {
          if (stateRef.current) dispatch(timerOpenEvent(stateRef.current, timerRef.current));
          return;
        }
        dispatch(command);
        return;
      }
      dispatch(command);
    });
  }, [phase, dispatch, toggleFullscreen]);

  // The home's Help overlay closes with Esc or H, as in a lesson. Every other key keeps its browser
  // meaning (arrows, PageDown and Space scroll the overlay on a short viewport).
  useEffect(() => {
    if (phase.kind !== 'home' || !homeHelp) return undefined;
    return subscribeKeys((command: KeyCommand) => {
      if (command !== 'escape' && !(typeof command === 'object' && command.overlay === 'help')) return false;
      setHomeHelp(false);
      return true;
    });
  }, [phase.kind, homeHelp]);

  // The bar hides after `presenter.autoHideMs` without pointer, touch or key, unless a bar button has
  // keyboard focus, its More sheet is open, or the End slide is on (its [ Finish ] and Exit stay in reach).
  const [barHidden, setBarHidden] = useState(false);
  const barFocused = useRef(false);
  // When the bar was last hidden or shown: a touch that began on its strip within the grace of being
  // shown began on a hidden bar (the pointer that brought it back comes before the stage's touch).
  const barHiddenRef = useRef(false);
  const barShownAt = useRef(0);
  const compactBarHeightRef = useRef(0);
  const [compactBarHeight, setCompactBarHeight] = useState(0);
  useEffect(() => {
    barHiddenRef.current = barHidden;
    if (!barHidden) barShownAt.current = Date.now();
  }, [barHidden]);
  const hiddenBarStrip = useCallback(
    () => (barHiddenRef.current || Date.now() - barShownAt.current < BAR_SHOW_GRACE_MS ? compactBarHeightRef.current : 0),
    [],
  );
  const atEndRef = useRef(false);
  atEndRef.current = pstate !== null && slides.length > 0 && pstate.slideIdx === slides.length - 1;
  useEffect(() => {
    if (atEndRef.current) setBarHidden(false);
  }, [pstate?.slideIdx]);
  useEffect(() => {
    if (phase.kind !== 'running') return undefined;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const arm = (): void => {
      // Marked at once: the stage reads it as the touch begins, before the re-render.
      if (barHiddenRef.current) barShownAt.current = Date.now();
      barHiddenRef.current = false;
      setBarHidden(false);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        if (barFocused.current || keepVisibleRef.current || moreOpenRef.current || atEndRef.current) return;
        barHiddenRef.current = true;
        setBarHidden(true);
      }, presenter.autoHideMs);
    };
    arm();
    const stop = subscribeActivity(arm);
    return () => {
      stop();
      if (timer) clearTimeout(timer);
    };
  }, [phase.kind]);

  // ---- the presenter home (section 3.12) ----
  const quick = useMemo(() => quickSource(locale), [locale]);
  const languages = useMemo(() => languageOptions(available), [available]);
  const openFromHome = useCallback((choice: HomeChoice) => {
    const next = homeStart(choice);
    rejected.current = false;
    setHomeFocus(false);
    setHomeHelp(false);
    // The start screen's history entry holds the deck, as a link does, so a reload reopens it (section 3.2).
    setPhase(choice.kind === 'start-over' ? { ...next, fresh: true } : next);
  }, []);
  // Back to lessons on the start screen: nothing started, so nothing is saved or sent (design start-screen.md).
  const backToHome = useCallback(() => {
    returnToPresenterHome();
    setHomeFocus(true);
    setPhase({ kind: 'home' });
  }, []);

  // The start screen's own history entry, holding the deck (a reload reopens it).
  useEffect(() => {
    if (phase.kind !== 'ready') return;
    let raw: string | null = null;
    try {
      raw = encodeDeck(phase.deck);
    } catch {
      // A deck too long for a link still runs; a reload then shows the home.
    }
    enterPresenterStep('start', raw, { fresh: phase.fresh === true });
  }, [phase]);

  // The browser's Back (owner report 2026-10-16 item 3): in a lesson it asks first (the Exit confirm,
  // and the lesson entry again, so a second Back confirms); on the start screen, or the page that
  // stands in for a lesson not yet begun, it goes to the home; on the home it leaves as usual.
  const onPop = useRef<(landed: StepEntry) => void>(() => undefined);
  onPop.current = (landed) => {
    if (phase.kind === 'running' && begun.current) {
      if (stateRef.current?.overlay === 'exit') {
        onExit();
        return;
      }
      dispatch({ overlay: 'exit' });
      let raw: string | null = null;
      try {
        raw = encodeDeck(phase.deck);
      } catch {
        raw = null;
      }
      enterPresenterStep('lesson', raw);
      return;
    }
    if (phase.kind === 'running') {
      leaveLesson();
      return;
    }
    if (phase.kind === 'ready') {
      // Landed on the home entry (or, after a reload, one more start entry below it): the home, with no deck held.
      if (landed.depth > 0) returnToPresenterHome();
      else forgetOpenDeck();
      setHomeFocus(true);
      setPhase({ kind: 'home' });
    }
  };
  useEffect(() => subscribePresenterPop((landed) => onPop.current(landed)), []);

  // ---- render ----
  // A phone window has no band: its compact bar floats over the stage, so the stage is the window less
  // the safe area, judged on the phone's width alone. On the End slide the bar stays on screen, so there
  // it takes its own band and the slide fits above it, when the phone is wide enough for that (too small
  // is judged without the band, so End never turns into the hint page). Elsewhere too small is judged on the one-row band, so a bar that wraps cannot
  // decide it; then the hint page takes the whole window, and no bar is drawn.
  const onEnd = phase.kind === 'running' && pstate !== null && slides.length > 0 && pstate.slideIdx === slides.length - 1;
  // Only while the stage above the band keeps the phone's width; on the smallest phones the bar floats over End too.
  const endBand = phone && onEnd ? compactBarHeight : 0;
  const phoneBand = endBand > 0 && !stageScale(stageBox(window, endBand, insets), PHONE_STAGE_BOUNDS).tooSmall ? endBand : 0;
  const box = stageBox(window, phone ? phoneBand : band, insets);
  const scale = stageScale(box, phone ? PHONE_STAGE_BOUNDS : STAGE_BOUNDS);
  const tooSmall = phone
    ? stageScale(stageBox(window, 0, insets), PHONE_STAGE_BOUNDS).tooSmall
    : stageScale(stageBox(window, BAR_BAND, insets), STAGE_BOUNDS).tooSmall || scale.tooSmall;
  const stageView: PresenterView = { ...view, unit: scale.unit, phone };
  // The first slide is on screen: the lesson begins (see `begin`).
  const slideShown = phase.kind === 'running' && !tooSmall && pstate !== null && slides[pstate.slideIdx] !== undefined;
  useEffect(() => {
    if (slideShown) begin();
  }, [slideShown, begin]);

  const partTitle = useCallback(
    (blockIndex: number | null): string | null => {
      const block = blockIndex === null ? undefined : deck?.blocks[blockIndex];
      if (block?.kind === 'episode') return bundle.episodeById(block.id)?.titleEn ?? null;
      if (block?.kind === 'quest') return bundle.questById(block.id)?.titleEn ?? null;
      return null;
    },
    [deck, bundle],
  );

  let body: React.ReactElement;
  if (phase.kind === 'boot') {
    body = <StatePage testID="presenter-loading" pose="idle" status={messages.learner.presenter.state.loading} />;
  } else if (phase.kind === 'invalid') {
    const m = messages.learner.presenter.state.invalid;
    const openHome = (): void => {
      setHomeFocus(true);
      setPhase({ kind: 'home' });
    };
    const raw = address?.raw;
    body =
      phase.stale && raw !== undefined ? (
        <StatePage
          testID="presenter-invalid"
          pose="thinking"
          title={m.title}
          line={m.staleLine}
          cta={m.reload}
          onCta={() => {
            if (reloading.current) return;
            reloading.current = true;
            void reloadForUpdate(raw).finally(() => {
              reloading.current = false;
            });
          }}
          secondary={{ label: m.cta, onPress: openHome, testID: 'presenter-invalid-home' }}
        />
      ) : (
        <StatePage testID="presenter-invalid" pose="thinking" title={m.title} line={m.line} cta={m.cta} onCta={openHome} />
      );
  } else if (phase.kind === 'home') {
    body = (
      <View style={{ flex: 1 }}>
        <PresenterHomeScreen
          messages={messages}
          locale={locale}
          languages={languages}
          sessionLocale={sessionLocale}
          onLanguage={setSessionLocale}
          recent={recentView(recentLoaded)}
          onResume={(item) => openFromHome({ kind: 'resume', item })}
          onStartOver={(item) => openFromHome({ kind: 'start-over', item })}
          onRemove={(deckId) => updateRecent((list) => forgetDeck(list, deckId))}
          quick={quick}
          onBuild={(built) => openFromHome({ kind: 'quick', deck: built })}
          onHelp={() => setHomeHelp(true)}
          onBack={() => leavePresenter()}
          focusTitle={homeFocus}
        />
        {homeHelp ? (
          <HelpOverlay
            romanization={null}
            onRomanization={() => undefined}
            languages={helpLanguageChips(languages)}
            locale={locale}
            onLanguage={setSessionLocale}
            keepVisible={keepVisible}
            onKeepVisible={setKeepVisible}
            onClose={() => setHomeHelp(false)}
            touch={touch}
          />
        ) : null}
      </View>
    );
  } else if (phase.kind === 'ready') {
    body =
      run === null || run.slides.length === 0 ? (
        <StatePage testID="presenter-loading" pose="idle" status={messages.learner.presenter.state.loading} />
      ) : (
        <StartScreen
          deckTitle={phase.deck.title}
          slides={run.slides.length}
          minutes={run.minutes}
          parts={run.parts}
          partTitle={partTitle}
          offlineReady={isOfflineReady()}
          voice={voiceCheck(capability, voiceChecked)}
          fullscreenSupported={fullscreenSupported()}
          wakeLockSupported={wakeLockSupported()}
          fontReady={fontReady}
          onStart={onStart}
          onBack={backToHome}
          phone={phone}
          portrait={upright}
        />
      );
  } else {
    const p = pstate ?? initialPresenterState({ slides });
    const slide = slides[p.slideIdx];
    const reveal = slide ? Math.min(p.reveal, slide.builds.length - 1) : 0;
    const revealNext = slide !== undefined && reveal < slide.builds.length - 1;
    const deckNow = phase.deck;
    const romanizationNow = romanization ?? deckNow.options.romanization;
    const chips = statusChips({ voice: voiceState(capability), muted, online, updateWaiting });
    const sayIt = sayItShown({ textPrompt: false, canPlay, muted, sound: deckNow.options.sound });
    const timerControls: TimerControls = {
      onPreset: (ms) => stepTimer({ type: 'start', ms, now: Date.now() }),
      onAdd: () => stepTimer({ type: 'add', now: Date.now() }),
      onPause: () => stepTimer({ type: 'pause', now: Date.now() }),
      onResume: () => stepTimer({ type: 'resume', now: Date.now() }),
      onReset: () => stepTimer({ type: 'reset' }),
      onMode: (mode) => dispatch({ timerMode: mode }),
      onClose: () => dispatch('close-timer'),
      onToggleNumbers: () => setShowNumbers((on) => !on),
    };
    const state = messages.learner.presenter.state;
    const page =
      tooSmall && phone && upright && touch ? (
        // A phone held upright: turn it (owner report 2026-10-16 item 1). Back is the start screen again,
        // with the same deck; Exit is the home. Nothing has started, so nothing was counted or stored.
        <StatePage
          testID="presenter-rotate"
          pose="waving"
          line={state.rotatePhone}
          hint={state.rotateLock}
          cta={messages.common.buttons.back}
          onCta={backToStart}
          secondary={{ label: messages.learner.presenter.bar.exit.cta, onPress: onExit, testID: 'presenter-rotate-exit' }}
        />
      ) : tooSmall || !slide ? (
        <StatePage
          testID="presenter-too-small"
          pose="thinking"
          line={state.tooSmallWindow}
          cta={messages.learner.presenter.bar.exit.cta}
          onCta={() => dispatch({ overlay: 'exit' })}
        />
      ) : null;
    const bar = tooSmall ? null : (
      <ControlBar
        hidden={barHidden}
        revealNext={revealNext}
        muted={muted}
        fullscreenSupported={fullscreenSupported()}
        fullscreen={fullscreen}
        onBack={() => dispatch('prev')}
        onNext={() => dispatch('next')}
        onSound={() => dispatch('replay-sound')}
        onFullscreen={toggleFullscreen}
        onExit={() => dispatch({ overlay: 'exit' })}
        onTimer={() => dispatch(timerOpenEvent(p, timerRef.current))}
        onBlank={() => dispatch({ overlay: 'blank' })}
        onGrid={() => dispatch({ overlay: 'grid' })}
        chips={chips}
        onTurnSoundOn={() => useAudioStore.getState().setMuted(false, 'fallback_panel')}
        onFocusWithin={(focused) => {
          // A keyboard user's focus holds the bar; a touch on a bar button does not keep it on screen.
          barFocused.current = focused && !touch;
          if (focused) setBarHidden(false);
        }}
        onBandHeight={
          phone
            ? (height) => {
                compactBarHeightRef.current = height;
                setCompactBarHeight(height);
              }
            : setBand
        }
        exitRef={exitRef}
        compact={phone}
        insets={insets}
        moreOpen={moreOpen}
        onMore={setMoreOpen}
      />
    );
    const stageAndTools = (
      <>
        {page ?? (
          <PresenterViewProvider value={stageView}>
            <Stage
              scale={scale}
              slides={slides}
              slideIdx={p.slideIdx}
              reveal={reveal}
              deckTitle={phase.deck.title}
              strokeToken={strokeTokenFor(strokePlay, slide?.key)}
              joinCta={messages.caregiver.spaces.join.cta}
              onCommand={dispatch}
              onPlaySound={() => dispatch('replay-sound')}
              onStartTimer={(ms) => dispatch({ startTimer: ms })}
              romanization={romanizationNow}
              sayIt={sayIt}
              storyScene={stories.scene}
              {...(phone ? { hiddenBarHeight: hiddenBarStrip } : {})}
              onFinish={onExit}
              finishRef={finishRef}
            />
          </PresenterViewProvider>
        )}
        {scale.portrait && !tooSmall ? <StageHint text={state.portrait} /> : null}
        {/* Class tools over the stage box (the bar stays): the full timer, a covering tool, then the
            corner timer, which stays on screen over a covering tool (section 3.5 amendment 1). */}
        {!tooSmall ? (
          <PresenterViewProvider value={stageView}>
            {p.timerOpen && p.timerMode === 'full' ? <TimerOverlay mode="full" timer={timer} showNumbers={showNumbers} controls={timerControls} /> : null}
            {p.overlay === 'blank' ? <BlankOverlay onPause={() => dispatch({ overlay: 'pause' })} /> : null}
            {p.overlay === 'pause' ? <PauseOverlay /> : null}
            {p.overlay === 'grid' ? (
              <GridOverlay
                items={gridItems(slides, p, { activity: (preset) => messages.learner.presenter.activity[preset] })}
                onGoto={(idx) => dispatch({ goto: idx })}
                onToggle={(key) => dispatch({ toggleSkip: key })}
                onClose={() => dispatch('close')}
              />
            ) : null}
            {p.overlay === 'help' ? (
              <HelpOverlay
                romanization={romanizationNow}
                onRomanization={setRomanization}
                languages={helpLanguageChips(languages)}
                locale={locale}
                onLanguage={setSessionLocale}
                keepVisible={keepVisible}
                onKeepVisible={(on) => {
                  setKeepVisible(on);
                  if (on) setBarHidden(false);
                }}
                onClose={() => dispatch('close')}
                touch={touch}
              />
            ) : null}
            {p.timerOpen && p.timerMode === 'corner' ? <TimerOverlay mode="corner" timer={timer} showNumbers={showNumbers} controls={timerControls} /> : null}
          </PresenterViewProvider>
        ) : null}
      </>
    );
    body = phone ? (
      // The whole window, less the safe area, is the stage box; the compact bar floats over its
      // bottom edge, after the class tools, so a touch can always clear or leave them.
      <View style={{ flex: 1, backgroundColor: colors.surface.paper }}>
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingTop: insets.top,
            paddingBottom: insets.bottom + phoneBand,
            paddingLeft: insets.left,
            paddingRight: insets.right,
          }}
        >
          {stageAndTools}
          {bar}
        </View>
        {p.overlay === 'exit' ? <ExitConfirm onKeepGoing={() => dispatch('close')} onExit={onExit} /> : null}
      </View>
    ) : (
      // The bar comes first in the DOM, so focus order is the bar, then the stage (README D3, section
      // 3.13); `column-reverse` still draws it in its band under the stage.
      <View style={{ flex: 1, flexDirection: 'column-reverse', backgroundColor: colors.surface.paper }}>
        {bar}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right }}>
          {stageAndTools}
        </View>
        {p.overlay === 'exit' ? <ExitConfirm onKeepGoing={() => dispatch('close')} onExit={onExit} /> : null}
      </View>
    );
  }

  return (
    <PresenterViewProvider value={view}>
      {/* The presenter's own fallback, in the presenter locale (not the app's OopsScreen, which reads the profile locale). */}
      <ErrorBoundary
        fallbackRender={({ resetErrorBoundary }) => (
          <StatePage
            testID="presenter-oops"
            pose="thinking"
            title={messages.learner.oops.title}
            line={messages.learner.oops.body}
            cta={messages.common.buttons.tryAgain}
            onCta={resetErrorBoundary}
          />
        )}
      >
        <View style={{ flex: 1, backgroundColor: colors.surface.paper }}>{body}</View>
      </ErrorBoundary>
    </PresenterViewProvider>
  );
}
