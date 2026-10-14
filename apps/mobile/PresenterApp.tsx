import { WORD_ART_KEYS, colors, presenter, supportedCardIds } from '@hangul-route/design-system';
import { LOCALE_META, availableLocales, dictionaryLocale, getMessages, type UiLocale } from '@hangul-route/i18n';
import { encodeDeck, type LectureDeck, type PickerMode } from '@hangul-route/content-schema';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { View, useWindowDimensions } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { canPlayKorean, type AudioCapability } from './src/logic/audio/capability';
import { lectureBundle } from './src/logic/lecture/content';
import { initialPresenterState, reduce, type PresenterEvent, type PresenterState } from './src/logic/lecture/controls';
import { expandDeck, withBuilds, type Slide } from './src/logic/lecture/deck-builder';
import type { KeyCommand } from './src/logic/lecture/keymap';
import { createPicker, reducePicker, type PickerEvent, type PickerState } from './src/logic/lecture/picker';
import { clearPickerLabels, heldLabels } from './src/logic/lecture/picker-labels';
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
import { FONT_WAIT_MS, TIMER_TICK_MS, stageBox } from './src/logic/lecture/stage-constants';
import { initialTimer, justFinished, reduceTimer, type TimerEvent, type TimerState } from './src/logic/lecture/timer';
import { firstUses, gridItems, pickerModes, sayItShown, statusChips, timerOpenEvent, toolsOpened, type LectureTool } from './src/logic/lecture/tools';
import { BAR_BAND, STAGE_BOUNDS } from './src/screens/presenter/stage-metrics';
import { slideSound } from './src/logic/lecture/slide-view';
import { stageScale } from './src/logic/lecture/stage-scale';
import { getCapability, playPrompt, refreshCapability, subscribeCapability, unlockAudio } from './src/platform/audio';
import { setDocumentLang } from './src/platform/locale';
import { isOnline, subscribeOnline } from './src/platform/online';
import { useReducedMotion } from './src/platform/motion';
import {
  announceReady,
  enterFullscreen,
  exitFullscreen,
  fullscreenSupported,
  hasOpener,
  isFullscreen,
  keepScreenAwake,
  listenForRoster,
  lockLandscape,
  forgetOpenDeck,
  holdOpenDeck,
  playChime,
  releaseScreenAwake,
  reloadOnDeckLink,
  setPresenterDocTitle,
  subscribeActivity,
  subscribeFullscreen,
  subscribeKeys,
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
import { PickerOverlay } from './src/screens/presenter/overlays/PickerOverlay';
import { TimerOverlay, type TimerControls } from './src/screens/presenter/overlays/TimerOverlay';
import { PresenterViewProvider, type PresenterView } from './src/screens/presenter/presenter-context';
import { Stage, StageHint } from './src/screens/presenter/Stage';
import { StartScreen, type PickerRow } from './src/screens/presenter/StartScreen';
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
 * presenter font, and its Start tap unlocks audio and asks for fullscreen, the wake lock and
 * landscape. Writes: `lecture:recent` (a deck has no name field) and the telemetry queue.
 * Picker labels arrive only from the console tab that opened this one and stay in memory.
 *
 * The class tools (PR 9): the timer (corner or full), the helper picker, Blank and its Pause, the
 * slide grid and Keys and controls, each reported once per lecture as `lecture.tool_used` (the
 * tool name only). The picker's bag and the timer live in memory for this lecture and are dropped
 * on Exit; nothing about who was drawn is kept, shown or sent.
 */

// The strict read throws on a failed or damaged read, so Recent is then never written over (`readRecent`).
const recentStore: RecentStore = { readJson: (key) => readJsonExact<unknown>(key), writeJson: (key, value) => writeJson(key, value) };

let bootRead: { address: DeckAddress | null } | null = null;

/** The address is read once per page, before the first paint (the fragment then leaves it). */
function readAddress(): DeckAddress | null {
  if (bootRead === null) bootRead = { address: takeDeckFragment() };
  return bootRead.address;
}

type Phase =
  | { kind: 'boot' }
  | { kind: 'invalid' }
  | { kind: 'home' }
  | { kind: 'ready'; deck: LectureDeck; source: StartSource; resumeKey?: string }
  | { kind: 'running'; deck: LectureDeck; source: StartSource };

function phaseOf(result: BootResult): Phase {
  if (result.kind === 'deck') return { kind: 'ready', deck: result.deck, source: result.source, ...(result.resumeKey !== undefined ? { resumeKey: result.resumeKey } : {}) };
  return { kind: result.kind };
}

export default function PresenterApp(): React.ReactElement {
  const address = useMemo(readAddress, []);
  // A link opens at once; a reloaded deck waits for Recent (it may resume at its slide); no deck is the home.
  const [phase, setPhase] = useState<Phase>(() =>
    address === null ? { kind: 'home' } : address.reloaded ? { kind: 'boot' } : phaseOf(resolveBoot(address, emptyRecent())),
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
  const reducedMotion = useReducedMotion();
  const window = useWindowDimensions();
  const [band, setBand] = useState<number>(BAR_BAND);
  const [capability, setCapability] = useState<AudioCapability>(getCapability);
  const [voiceChecked, setVoiceChecked] = useState(false);
  const muted = useAudioStore((s) => s.muted);
  const [updateWaiting, setUpdateWaiting] = useState(false);
  // After Exit or an invalid link the home takes focus on its h1 (design home.md).
  const [homeFocus, setHomeFocus] = useState(false);
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
        if (live) setPhase(phaseOf(resolveBoot(address, list)));
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
  const canPlay = canPlayKorean(capability);
  const expanded = useMemo(() => (deck ? expandDeck(deck, bundle, { canPlayKorean: canPlay }) : null), [deck, bundle, canPlay]);
  const run = useMemo(() => (deck && expanded ? runDeck(deck, expanded, SHELL_SLIDE_KINDS, supportedCardIds, WORD_ART_KEYS) : null), [deck, expanded]);

  // A link that does not decode, or a deck with nothing to show: the invalid screen, once per page.
  const rejected = useRef(false);
  useEffect(() => {
    if (phase.kind === 'invalid' && !rejected.current && address !== null) {
      rejected.current = true;
      const decoded = resolveBoot(address, emptyRecent());
      void track({ name: 'lecture.deck_rejected', payload: { reason: decoded.kind === 'invalid' ? decoded.reason : 'invalid' } });
      forgetOpenDeck();
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

  // Roster hand-off: tell the opener we are ready (again on every load) and hold a valid answer in memory.
  const [rosterTick, setRosterTick] = useState(0);
  useEffect(() => {
    if (!deck) return undefined;
    const stop = listenForRoster(deck, () => setRosterTick((n) => n + 1));
    announceReady(deck);
    return stop;
  }, [deck]);
  const labels = useMemo(() => (deck ? heldLabels(deck) : null), [deck, rosterTick]);
  const [pickerCount, setPickerCount] = useState<number | null>(null);

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
  const [endHint, setEndHint] = useState(false);
  const [fullscreen, setFullscreen] = useState(isFullscreen);
  const exitRef = useRef<View>(null);

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
  // The helper picker's bag, for this lecture only: made when the picker first opens.
  const [picker, setPicker] = useState<PickerState | null>(null);
  const pickerOpen = pstate?.overlay === 'picker';
  useEffect(() => {
    if (!pickerOpen || picker !== null || !deck?.picker) return;
    const count = pickerCount ?? deck.picker.count;
    setPicker(createPicker({ mode: labels !== null ? deck.picker.mode : 'numbers', count, labels }, Math.random));
  }, [pickerOpen, picker, deck, labels, pickerCount]);
  // Names delivered again (the console re-sends them after a reload) make a new bag.
  useEffect(() => setPicker(null), [labels]);
  const onPickerEvent = useCallback((event: PickerEvent) => setPicker((current) => (current ? reducePicker(current, event, Math.random) : current)), []);
  const onPickerMode = useCallback(
    (mode: PickerMode) => {
      if (!deck?.picker) return;
      setPicker(createPicker({ mode, count: pickerCount ?? deck.picker.count, labels }, Math.random));
    },
    [deck, labels, pickerCount],
  );

  const slides: Slide[] = useMemo(() => {
    if (!deck || !run) return [];
    const mode = romanization ?? deck.options.romanization;
    return mode === deck.options.romanization ? run.slides : withBuilds(run.slides, { romanization: mode, strokeGuide: deck.options.strokeGuide });
  }, [deck, run, romanization]);

  const playSound = useCallback(
    (slide: Slide | undefined) => {
      const spoken = slideSound(slide);
      if (!spoken || !deck?.options.sound) return;
      const { text, audioRef } = spoken;
      const at = Date.now();
      void playPrompt({ text, ...(audioRef !== undefined ? { audioRef } : {}), kind: 'sound', source: 'presenter' }).then((result) => {
        const failure = useAudioStore.getState().lastFailure;
        setSoundBlocked(result !== 'played' && failure !== null && failure.reason === 'blocked' && failure.at >= at);
      });
    },
    [deck],
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
      if (state.slideIdx !== before.slideIdx && deck) {
        const key = slides[state.slideIdx]!.key;
        updateRecent((list) => setLastSlide(list, deck.id, key));
      }
      const atEnd = event === 'next' && state === before && before.overlay === null && before.slideIdx === slides.length - 1;
      setEndHint(atEnd);
      if (atEnd) exitRef.current?.focus?.();
      // The stroke guide plays only on a forward stroke reveal or a replay; any other slide change
      // drops it, so going back to a complete slide is silent (section 3.5 amendment point 2).
      const revealedBuild = effect?.type === 'revealed' ? slides[state.slideIdx]?.builds[effect.build] : undefined;
      const playStroke = revealedBuild === 'stroke' || effect?.type === 'play-stroke';
      const slideKey = slides[state.slideIdx]!.key;
      setStrokePlay((current) => nextStrokePlay(current, { slideKey, play: playStroke }));
      if (revealedBuild === 'sound' || effect?.type === 'play-sound') playSound(slides[state.slideIdx]);
    },
    [slides, deck, playSound, updateRecent, reportTools, stepTimer],
  );

  const toggleFullscreen = useCallback(() => {
    if (isFullscreen()) {
      void exitFullscreen();
      return;
    }
    void enterFullscreen();
    reportTools(['fullscreen']);
  }, [reportTools]);

  useEffect(() => subscribeFullscreen(() => setFullscreen(isFullscreen())), []);

  const pickerMode = deck?.picker == null ? 'none' : labels !== null ? deck.picker.mode : 'numbers';

  const onStart = useCallback(() => {
    if (phase.kind !== 'ready' || !run || slides.length === 0) return;
    // Gesture-bound requests first, in the tap itself (section 3.5); each is feature-detected and may be refused.
    unlockAudio();
    unlockChime();
    void enterFullscreen();
    void keepScreenAwake();
    void lockLandscape();
    const state = initialPresenterState({ slides }, phase.resumeKey);
    stateRef.current = state;
    setPstate(state);
    toolsUsed.current = new Set();
    tally.current = startTally(Date.now(), slides[state.slideIdx]?.key);
    const savedAt = new Date().toISOString();
    const firstKey = slides[state.slideIdx]!.key;
    const { deck: started } = phase;
    // Every start, a resumed one too, moves the lesson to the top of Recent with today's day (section 3.12).
    updateRecent((list) => setLastSlide(rememberDeck(list, started, savedAt), started.id, firstKey));
    // From now on a reload resumes at the open slide, also after Start over (which held the deck as fresh).
    try {
      holdOpenDeck(encodeDeck(started));
    } catch {
      // A deck too long for a link still runs; a reload then shows the home.
    }
    void track({
      name: 'lecture.start',
      payload: { ...startPayload({ deck: phase.deck, run, source: phase.source, pickerMode, capability, offlineReady: isOfflineReady() }) },
    });
    setPhase({ kind: 'running', deck: phase.deck, source: phase.source });
    const first = slides[state.slideIdx]!;
    setStrokePlay(first.builds[0] === 'stroke' ? nextStrokePlay(null, { slideKey: first.key, play: true }) : null);
  }, [phase, run, slides, pickerMode, capability, updateRecent]);

  const onExit = useCallback(() => {
    void exitFullscreen();
    void releaseScreenAwake();
    unlockOrientation();
    const payload = tally.current ? completePayload(tally.current, Date.now()) : { slidesShown: 0, minutes: 0, reveals: 0 };
    tally.current = null;
    clearPickerLabels();
    forgetOpenDeck();
    stateRef.current = null;
    setPstate(null);
    // The class tools end with the lesson: the bag, the timer and the tool tally are dropped.
    setPicker(null);
    timerRef.current = initialTimer();
    setTimer(timerRef.current);
    setShowNumbers(true);
    toolsUsed.current = new Set();
    setRomanization(null);
    setEndHint(false);
    setHomeFocus(true);
    setPhase({ kind: 'home' });
    void track({ name: 'lecture.complete', payload }).finally(() => {
      // A waiting update applies only now, never mid-lesson (section 3.8).
      if (updateWaiting) applyUpdate();
    });
  }, [updateWaiting]);

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
      if (typeof command === 'object') {
        if (stateRef.current?.overlay === 'exit') return;
        if (command.overlay === 'picker' && phase.deck.picker === null) return;
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

  // The bar hides after `presenter.autoHideMs` without pointer, touch or key, unless a bar button has focus.
  const [barHidden, setBarHidden] = useState(false);
  const barFocused = useRef(false);
  useEffect(() => {
    if (phase.kind !== 'running') return undefined;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const arm = (): void => {
      setBarHidden(false);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        if (!barFocused.current && !keepVisibleRef.current) setBarHidden(true);
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
    // The tab holds the deck, as a link does, so a reload reopens this lesson (section 3.2).
    try {
      holdOpenDeck(encodeDeck(next.deck), { fresh: choice.kind === 'start-over' });
    } catch {
      // A deck too long for a link still runs; a reload then shows the home.
    }
    rejected.current = false;
    setPickerCount(null);
    setHomeFocus(false);
    setPhase(next);
  }, []);
  // Back to lessons on the start screen: nothing started, so nothing is saved or sent (design start-screen.md).
  const backToHome = useCallback(() => {
    clearPickerLabels();
    forgetOpenDeck();
    setPickerCount(null);
    setHomeFocus(true);
    setPhase({ kind: 'home' });
  }, []);

  // ---- render ----
  const box = stageBox(window, band);
  const scale = stageScale(box, STAGE_BOUNDS);
  // Too small is judged on the one-row band, so a bar that wraps on a phone cannot decide it; then the
  // hint page takes the whole window with its own Exit, and the bar is not drawn (states.md).
  const tooSmall = stageScale(stageBox(window, BAR_BAND), STAGE_BOUNDS).tooSmall || scale.tooSmall;
  const stageView: PresenterView = { ...view, unit: scale.unit };

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
    body = (
      <StatePage
        testID="presenter-invalid"
        pose="thinking"
        title={m.title}
        line={m.line}
        cta={m.cta}
        onCta={() => {
          setHomeFocus(true);
          setPhase({ kind: 'home' });
        }}
      />
    );
  } else if (phase.kind === 'home') {
    body = (
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
        focusTitle={homeFocus}
      />
    );
  } else if (phase.kind === 'ready') {
    const count = pickerCount ?? phase.deck.picker?.count ?? 0;
    const pickerRow: PickerRow =
      phase.deck.picker === null
        ? null
        : labels !== null && phase.deck.picker.mode !== 'numbers'
          ? { kind: 'received', mode: phase.deck.picker.mode, count: labels.length }
          : {
              kind: 'numbers',
              count,
              line: phase.deck.picker.mode === 'numbers' ? null : phase.source === 'recent' ? 'notKept' : hasOpener() ? null : 'noOpener',
            };
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
          picker={pickerRow}
          onPickerCount={setPickerCount}
          fontReady={fontReady}
          onStart={onStart}
          onBack={backToHome}
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
        {...(deckNow.picker !== null ? { onPicker: () => dispatch({ overlay: 'picker' }) } : {})}
        onBlank={() => dispatch({ overlay: 'blank' })}
        onGrid={() => dispatch({ overlay: 'grid' })}
        chips={chips}
        onTurnSoundOn={() => useAudioStore.getState().setMuted(false, 'fallback_panel')}
        onFocusWithin={(focused) => {
          barFocused.current = focused;
          if (focused) setBarHidden(false);
        }}
        onBandHeight={setBand}
        exitRef={exitRef}
      />
    );
    // The bar comes first in the DOM, so focus order is the bar, then the stage (README D3, section
    // 3.13); `column-reverse` still draws it in its band under the stage.
    body = (
      <View style={{ flex: 1, flexDirection: 'column-reverse', backgroundColor: colors.surface.paper }}>
        {bar}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          {tooSmall || !slide ? (
            <StatePage
              testID="presenter-too-small"
              pose="thinking"
              line={messages.learner.presenter.state.tooSmall}
              cta={messages.learner.presenter.bar.exit.cta}
              onCta={() => dispatch({ overlay: 'exit' })}
            />
          ) : (
            <PresenterViewProvider value={stageView}>
              <Stage
                scale={scale}
                slides={slides}
                slideIdx={p.slideIdx}
                reveal={reveal}
                deckTitle={phase.deck.title}
                strokeToken={strokeTokenFor(strokePlay, slide.key)}
                joinCta={messages.caregiver.spaces.join.cta}
                onCommand={dispatch}
                onPlaySound={() => dispatch('replay-sound')}
                onStartTimer={(ms) => dispatch({ startTimer: ms })}
                romanization={romanizationNow}
                sayIt={sayIt}
              />
            </PresenterViewProvider>
          )}
          {scale.portrait && !tooSmall ? <StageHint text={messages.learner.presenter.state.portrait} /> : null}
          {endHint ? <StageHint text={messages.learner.presenter.slide.end.exitHint} bottom /> : null}
          {/* Class tools over the stage box (the bar stays): the full timer, a covering tool, then the
              corner timer, which stays on screen over a covering tool (section 3.5 amendment 1). */}
          {!tooSmall ? (
            <PresenterViewProvider value={stageView}>
              {p.timerOpen && p.timerMode === 'full' ? <TimerOverlay mode="full" timer={timer} showNumbers={showNumbers} controls={timerControls} /> : null}
              {p.overlay === 'blank' ? <BlankOverlay onPause={() => dispatch({ overlay: 'pause' })} /> : null}
              {p.overlay === 'pause' ? <PauseOverlay /> : null}
              {p.overlay === 'picker' && picker !== null ? (
                <PickerOverlay
                  picker={picker}
                  modes={deckNow.picker ? pickerModes(deckNow.picker.mode, labels !== null) : ['numbers']}
                  onEvent={onPickerEvent}
                  onMode={onPickerMode}
                  onClose={() => dispatch('close')}
                />
              ) : null}
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
                  keepVisible={keepVisible}
                  onKeepVisible={(on) => {
                    setKeepVisible(on);
                    if (on) setBarHidden(false);
                  }}
                  onClose={() => dispatch('close')}
                />
              ) : null}
              {p.timerOpen && p.timerMode === 'corner' ? <TimerOverlay mode="corner" timer={timer} showNumbers={showNumbers} controls={timerControls} /> : null}
            </PresenterViewProvider>
          ) : null}
        </View>
        {p.overlay === 'exit' ? <ExitConfirm onKeepGoing={() => dispatch('close')} onExit={onExit} /> : null}
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
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
        <StatusBar style="dark" />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
