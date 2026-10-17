import { TextSizeProvider, useTypeScale, WORD_ART_KEYS, borderWidth, colors, layout, presenter, radii, spacing, supportedCardIds, KOREAN_LINE_BREAK } from '@hangul-route/design-system';
import { LOCALE_META, availableLocales, dictionaryLocale, getMessages, type UiLocale } from '@hangul-route/i18n';
import { DeviceDisplaySheet } from './src/components/DeviceDisplaySheet';
import { decodeDeck, encodeDeck, type LectureDeck } from '@hangul-route/content-schema';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { Text, View, useWindowDimensions } from 'react-native';
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
import {
  completePayload,
  homeStart,
  nextStrokePlay,
  presenterLocale,
  resolveBoot,
  slideLocale,
  runDeck,
  SHELL_SLIDE_KINDS,
  SOUND_CHECK,
  soundCheckOutcome,
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
  type SoundCheckOutcome,
  voiceState,
} from './src/logic/lecture/shell';
import { FONT_WAIT_MS, TIMER_TICK_MS, stageBox } from './src/logic/lecture/stage-constants';
import { popPlan, type HistoryEntry } from './src/logic/lecture/history';
import { initialTimer, justFinished, reduceTimer, type TimerEvent, type TimerState } from './src/logic/lecture/timer';
import { firstUses, fullscreenToggle, gridItems, narrationStops, sayItShown, statusChips, timerOpenEvent, toolsOpened, type LectureTool } from './src/logic/lecture/tools';
import { BAR_BAND, PHONE_BAR_STRIP, PHONE_RULE, PHONE_STAGE_BOUNDS, STAGE_BOUNDS } from './src/screens/presenter/stage-metrics';
import { slideSound, soundFlashFor, soundPress, soundPrompt } from './src/logic/lecture/slide-view';
import { isPhoneWindow, stageScale, stageView } from './src/logic/lecture/stage-scale';
import { getCapability, installGestureUnlock, playPrompt, refreshCapability, stop as stopAudio, subscribeCapability, unlockAudio } from './src/platform/audio';
import { setDocumentLang } from './src/platform/locale';
import { coarsePointer, deviceScreen } from './src/platform/orientation';
import { isOnline, subscribeOnline } from './src/platform/online';
import { useReducedMotion } from './src/platform/motion';
import {
  checkForUpdate,
  clearPresenterForward,
  enterFullscreenLandscape,
  exitFullscreen,
  fullscreenSupported,
  isFullscreen,
  keepScreenAwake,
  forgetOpenDeck,
  leavePresenter,
  playChime,
  pushPresenterEntry,
  releaseScreenAwake,
  reloadForUpdate,
  reloadOnDeckLink,
  returnToPresenterHome,
  setPresenterDocTitle,
  stepBackPresenter,
  subscribeActivity,
  subscribeFullscreen,
  subscribeInputKind,
  subscribeKeys,
  subscribePresenterPop,
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
import { activeLocale, followDeviceSettings, useLocaleStore } from './src/store/locale-store';

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
 * presenter font, and its Start tap runs the gestures that need one (audio, fullscreen and then
 * landscape, the screen wake lock; section 3.5) and pushes the lesson's history entry. Recent is
 * written and `lecture.start` sent only when the first slide is actually shown, so a Start on a
 * phone held upright (the rotate page) or in a window too small is neither counted nor stored until
 * the stage appears. Writes: `lecture:recent` (a deck has no name field), the telemetry queue and,
 * only when someone chooses on the Display (Aa) sheet of the home or the start screen, the device's
 * display record (`device:settings`, owner items 6 and 7).
 *
 * Phones (F-TCH-004 section 3.6 phone exception; owner report 2026-10-16 item 1): in a phone window
 * (`isPhoneWindow`: window, screen and a coarse pointer) the stage is the whole window less the
 * safe-area insets, judged too small only below `PHONE_STAGE_MIN`; upright, a lesson shows the
 * rotate page. The compact bar floats over the stage bottom and never covers a new slide: every
 * step hides it at once, a stage tap never shows it; it shows at the start of the lesson, on a tap
 * in its strip (the grabber marks it) and while keyboard or screen-reader focus is inside it.
 *
 * The way back (section 3.5 "History"; item 3): one history entry per phase (`logic/lecture/
 * history.ts`), so the browser or phone back goes lesson -> Exit confirm (a covering overlay closes
 * first; a second back exits), start screen -> home, home -> the page before; the home has its own
 * Back. After a back in a lesson the lesson's entry is pushed again only at the next user
 * activation (Keep going, a stage tap, a bar button, a key).
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
  // A link that does not decode pushes no start-screen entry (section 3.5 "History" rule 6).
  if (bootRead === null) bootRead = { address: takeDeckFragment(undefined, (raw) => decodeDeck(raw).ok) };
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
  // One UI language per device (owner items 6 and 7): the chrome speaks the device record's language,
  // never the deck's; a deck's explicit `options.uiLocale` drives the slide text only.
  const deviceLocale = useLocaleStore(activeLocale);
  const textSize = useLocaleStore((s) => s.textSize);
  const available = useMemo(() => availableLocales(), []);
  const deck = phase.kind === 'ready' || phase.kind === 'running' ? phase.deck : null;
  const locale: UiLocale = presenterLocale({ device: deviceLocale, available });
  const slidesIn: UiLocale = slideLocale({ deck, device: deviceLocale, available });
  const messages = useMemo(() => getMessages(dictionaryLocale(locale)), [locale]);
  const slideMessages = useMemo(() => getMessages(dictionaryLocale(slidesIn)), [slidesIn]);
  // The Display (Aa) sheet of the home and the start screen.
  const [displayOpen, setDisplayOpen] = useState(false);
  const reducedMotion = useReducedMotion();
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // A phone window (F-TCH-004 section 3.6): a phone-sized window on a phone-sized screen with a coarse pointer.
  const coarse = useMemo(coarsePointer, []);
  const screen = deviceScreen();
  const phone = isPhoneWindow({ w: window.width, h: window.height, screenW: screen?.width ?? null, screenH: screen?.height ?? null, coarse }, PHONE_RULE);
  const phoneRef = useRef(phone);
  phoneRef.current = phone;
  const upright = window.height > window.width;
  // A short window (a phone sideways): the phone start screen steps its title and Start down.
  const short = window.height < layout.shortHeight;
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
    // A `?lang=` is taken out of the address and never used or stored: the presenter speaks the device's language (section 3.9).
    void useLocaleStore.getState().hydrate([], { handoff: 'ignore' }).catch(() => undefined);
    // A language or text size chosen in another tab of this origin applies here live.
    const unfollow = followDeviceSettings();
    // Speech unlocks on the first activation anywhere (F-AUDIO-004 section 3.6), a hidden page stops
    // every sound, and each tap offers a suspended clip context a restart.
    const offGesture = installGestureUnlock();
    const offCapability = subscribeCapability(setCapability);
    // The voice list can land between the first render's read and this subscription (a browser that has
    // it at once): read it again, or the start screen keeps "unknown" and says there is no Korean voice.
    setCapability(getCapability());
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
      unfollow();
      offGesture();
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

  // The slide content speaks the slide language (the deck's explicit one, else the device's).
  const bundle = useMemo(() => lectureBundle(slidesIn), [slidesIn]);
  // Story scenes for the story slides: art, theme, accessible name and Read-to-me's voice (PR 11).
  const stories = useMemo(() => lectureStories(slidesIn), [slidesIn]);
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
      // Its start-screen entry goes: the invalid page sits on the home entry (rule 6).
      void returnToPresenterHome();
      setPhase({ kind: 'invalid' });
    }
  }, [phase, run, address]);

  const view: PresenterView = useMemo(() => ({ messages, locale, unit: 0, reducedMotion, soundBlocked }), [messages, locale, reducedMotion, soundBlocked]);

  // ---- the start screen ----
  const [fontReady, setFontReady] = useState(false);
  // Test the sound (section 3.7): the outcome under the button; a newer tap replaces an older result.
  const [soundCheck, setSoundCheck] = useState<SoundCheckOutcome | null>(null);
  const soundCheckRun = useRef(0);
  const onTestSound = useCallback(() => {
    // In the tap itself: the unlock, then the word, so the browser lets it play (section 3.5).
    unlockAudio();
    const run = ++soundCheckRun.current;
    setSoundCheck(null);
    void playPrompt(SOUND_CHECK).then((result) => {
      if (run === soundCheckRun.current) setSoundCheck(soundCheckOutcome(result));
    });
  }, []);
  const onTestSoundOn = useCallback(() => {
    useAudioStore.getState().setMuted(false, 'fallback_panel');
    onTestSound();
  }, [onTestSound]);
  // A result belongs to the start screen it was asked on.
  useEffect(() => {
    if (phase.kind === 'ready') return;
    soundCheckRun.current += 1;
    setSoundCheck(null);
  }, [phase.kind]);
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
  // Next on the End slide: the hint, and focus on the docked bar's Exit or the compact bar's More (which holds Exit).
  const exitRef = useRef<View>(null);
  const [endHint, setEndHint] = useState(false);
  // On a phone the no-voice chip shows for a moment at the top of the stage when a sound build cannot play (section 3.6);
  // on both bars an explicit Sound press that has nothing to play, or does not play, says so there (section 3.7).
  const [soundFlash, setSoundFlash] = useState<{ key: SoundFlashKey; at: number } | null>(null);
  // The lesson began: its first slide was shown (Recent written, lecture.start sent).
  const begun = useRef(false);
  // After a browser back in the lesson (section 3.5 "History" rule 4) the lesson's entry is pushed
  // again at the next user activation, never from the popstate itself.
  const repush = useRef(false);

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

  // ---- the control bar's visibility (README D3; F-TCH-004 section 3.6 on a phone) ----
  const [barHidden, setBarHidden] = useState(false);
  // A keyboard, switch or screen-reader focus inside the bar holds it on screen (a press's own focus does not, on a phone).
  const barHeld = useRef(false);
  // The last input on the page: a focus given back after a tap (More's sheet closing) is the pointer's too.
  const lastInput = useRef<'pointer' | 'key' | null>(null);
  useEffect(() => subscribeInputKind((kind) => (lastInput.current = kind)), []);
  const barTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearBarTimer = useCallback(() => {
    if (barTimer.current) clearTimeout(barTimer.current);
    barTimer.current = null;
  }, []);
  /** Shows the bar and hides it again after `presenter.autoHideMs` unless something holds it. */
  const showBar = useCallback(() => {
    setBarHidden(false);
    clearBarTimer();
    barTimer.current = setTimeout(() => {
      barTimer.current = null;
      if (barHeld.current || keepVisibleRef.current || moreOpenRef.current) return;
      setBarHidden(true);
    }, presenter.autoHideMs);
  }, [clearBarTimer]);
  /** A phone step: the bar goes at once, so the new slide is seen whole (unless Keep controls visible or a focus holds it). */
  const hideBarNow = useCallback(() => {
    if (keepVisibleRef.current || barHeld.current) return;
    clearBarTimer();
    setBarHidden(true);
  }, [clearBarTimer]);
  useEffect(() => clearBarTimer, [clearBarTimer]);

  /**
   * The slide's sound (section 3.4 amendment 2026-10-17: the Korean it shows, at its own rate).
   * `explicit`: the bar's Sound, S or a stage speaker, which always answers (section 3.7): while
   * muted it turns the device sound on first, and nothing to play or a play that fails flashes.
   */
  const playSound = useCallback(
    (slide: Slide | undefined, { explicit }: { explicit: boolean }) => {
      if (!slide || !deck) return;
      const flash = (key: SoundFlashKey): void => setSoundFlash({ key, at: Date.now() });
      const sound = slide.kind === 'story' ? undefined : slideSound(slide, stateRef.current?.reveal);
      const press = soundPress({ hasSound: slide.kind === 'story' || sound !== undefined, explicit, muted: useAudioStore.getState().muted, deckSound: deck.options.sound });
      if (press === 'skip') return;
      if (press === 'flash-no-sound') {
        flash('noSound');
        return;
      }
      // The device-wide mute the learner app shares: the same action as the chip's Turn sound on.
      if (press === 'unmute-then-play') useAudioStore.getState().setMuted(false, 'fallback_panel');
      if (slide.kind === 'story') {
        // Read-to-me (S or Sound): the narration in its own voice, keyword chips in Korean, with the
        // story reader's voice rules; the text is on the slide either way (D6).
        const narrationLang = stories.scene(slide.storyId, slide.sceneId)?.narrationLang ?? 'en-US';
        const plan = readToMePlan(slide, { sound: deck.options.sound, canPlayKorean: canPlay, voiceChecked, narrationLang });
        if (plan) void narrator.play(plan.steps, plan.options);
        return;
      }
      if (!sound) return;
      const at = Date.now();
      void playPrompt({ ...soundPrompt(sound), source: 'presenter' }).then((result) => {
        const failure = useAudioStore.getState().lastFailure;
        const reason = failure !== null && failure.at >= at ? failure.reason : null;
        setSoundBlocked(result !== 'played' && reason === 'blocked');
        const shown = explicit ? soundFlashFor(result, reason) : null;
        if (shown !== null) flash(shown === 'no-voice' ? 'noVoice' : 'soundFailed');
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
      // A phone step hides the compact bar at once: it never covers a new slide or build (section 3.6).
      const stepped = event === 'next' || event === 'prev' || event === 'first' || event === 'last' || (typeof event === 'object' && 'goto' in event);
      if (phoneRef.current && stepped) hideBarNow();
      // Next on the End slide: the hint, and focus on Exit (the docked bar) or More, which holds it (the phone bar, shown).
      const atEnd = event === 'next' && state === before && before.overlay === null && before.slideIdx === slides.length - 1;
      setEndHint(atEnd);
      if (atEnd) {
        if (phoneRef.current) showBar();
        exitRef.current?.focus?.();
      }
      // The stroke guide plays only on a forward stroke reveal or a replay; any other slide change
      // drops it, so going back to a complete slide is silent (section 3.5 amendment point 2).
      const revealedBuild = effect?.type === 'revealed' ? slides[state.slideIdx]?.builds[effect.build] : undefined;
      const playStroke = revealedBuild === 'stroke' || effect?.type === 'play-stroke';
      const slideKey = slides[state.slideIdx]!.key;
      setStrokePlay((current) => nextStrokePlay(current, { slideKey, play: playStroke }));
      const sound = revealedBuild === 'sound' || effect?.type === 'play-sound';
      const explicit = effect?.type === 'play-sound';
      if (sound) playSound(slides[state.slideIdx], { explicit });
      // A press answers from its own result (on both bars); a forward sound build flashes here, on a phone.
      if (sound && !explicit && phoneRef.current && !canPlay && slideSound(slides[state.slideIdx], state.reveal) !== undefined) {
        setSoundFlash({ key: 'noVoice', at: Date.now() });
      }
    },
    [slides, deck, playSound, updateRecent, reportTools, stepTimer, narrator, hideBarNow, showBar, canPlay],
  );

  /** The lesson's raw fragment for its history entry (null: a deck too long for a link, which still runs). */
  const rawOf = useCallback((of: LectureDeck): string | null => {
    try {
      return encodeDeck(of);
    } catch {
      return null;
    }
  }, []);

  /** A user activation in the lesson: the lesson's entry is pushed again if a browser back took it (rule 4). */
  const activate = useCallback(() => {
    if (!repush.current || phase.kind !== 'running') return;
    repush.current = false;
    void pushPresenterEntry('running', rawOf(phase.deck));
  }, [phase, rawOf]);
  /** A press, a tap or a key in the lesson: an activation, then the event. */
  const userDispatch = useCallback(
    (event: PresenterEvent) => {
      activate();
      dispatch(event);
    },
    [activate, dispatch],
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
    // Gesture-bound requests in the tap itself (section 3.5): audio, the chime, fullscreen and then
    // landscape once it settles (Android Chrome locks only in fullscreen, and turns an upright phone
    // sideways), and the screen wake lock; each is feature-detected and may be refused.
    unlockAudio();
    unlockChime();
    void enterFullscreenLandscape();
    void keepScreenAwake();
    // The lesson's own history entry, pushed in the tap: the browser's Back now asks before leaving.
    void pushPresenterEntry('running', rawOf(phase.deck));
    repush.current = false;
    const state = initialPresenterState({ slides }, phase.resumeKey);
    stateRef.current = state;
    setPstate(state);
    toolsUsed.current = new Set();
    begun.current = false;
    setMoreOpen(false);
    setEndHint(false);
    setPhase({ kind: 'running', deck: phase.deck, source: phase.source, from: phase });
    const first = slides[state.slideIdx]!;
    setStrokePlay(first.builds[0] === 'stroke' ? nextStrokePlay(null, { slideKey: first.key, play: true }) : null);
  }, [phase, run, slides, rawOf]);

  /**
   * The lesson begins when its first slide is actually on screen: only then it is saved to Recent
   * and `lecture.start` sent, so a Start the window could not show (a phone held upright, a window
   * too small) is neither counted nor stored.
   */
  const begin = useCallback(() => {
    if (phase.kind !== 'running' || begun.current || !run || !stateRef.current) return;
    begun.current = true;
    const state = stateRef.current;
    tally.current = startTally(Date.now(), slides[state.slideIdx]?.key);
    const savedAt = new Date().toISOString();
    const key = slides[state.slideIdx]!.key;
    const { deck: started } = phase;
    // Every start, a resumed one too, moves the lesson to the top of Recent with today's day (section 3.12).
    updateRecent((list) => setLastSlide(rememberDeck(list, started, savedAt), started.id, key));
    void track({
      name: 'lecture.start',
      payload: { ...startPayload({ deck: started, run, source: phase.source, capability, offlineReady: isOfflineReady() }) },
    });
  }, [phase, run, slides, capability, updateRecent]);

  /** What the Start tap asked of the device, given back. */
  const releaseDevice = useCallback(() => {
    void exitFullscreen();
    void releaseScreenAwake();
    unlockOrientation();
  }, []);

  /** Out of the lesson (or the page that stood in for it) to the home: the class tools go, the history goes back to the home. */
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
    setEndHint(false);
    repush.current = false;
    void returnToPresenterHome();
    setHomeFocus(true);
    setPhase({ kind: 'home' });
  }, [narrator]);

  const onExit = useCallback(() => {
    const started = begun.current;
    begun.current = false;
    leaveLesson();
    releaseDevice();
    // A Start the window never showed was not a lesson: nothing to count or apply.
    if (!started) return;
    const payload = tally.current ? completePayload(tally.current, Date.now()) : { slidesShown: 0, minutes: 0, reveals: 0 };
    tally.current = null;
    void track({ name: 'lecture.complete', payload }).finally(() => {
      // A waiting update applies only now, never mid-lesson (section 3.8).
      if (updateWaiting) applyUpdate();
    });
  }, [updateWaiting, leaveLesson, releaseDevice]);

  /**
   * A lesson not yet begun (the rotate page or the too-small page before the first slide) back to
   * its start screen, with the same deck: nothing was counted or stored. `fromPop`: the browser is
   * already on the start screen's entry.
   */
  const backToStart = useCallback(
    (fromPop: boolean) => {
      if (phase.kind !== 'running' || begun.current) return;
      stateRef.current = null;
      setPstate(null);
      setMoreOpen(false);
      releaseDevice();
      if (!fromPop) void stepBackPresenter();
      setPhase(phase.from);
    },
    [phase, releaseDevice],
  );

  // Leaving the page stops Read-to-me too.
  useEffect(() => () => narrator.stop(), [narrator]);

  // Keys (section 3.5), the class tools included. A key is a user activation (rule 4).
  useEffect(() => {
    if (phase.kind !== 'running') return undefined;
    return subscribeKeys((command: KeyCommand) => {
      activate();
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
        showBar();
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
  }, [phase, dispatch, toggleFullscreen, activate, showBar]);

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

  // A covering overlay (blank, pause, grid, help, the full timer) or the phone's More sheet: the browser's Back closes it first.
  const covering = pstate !== null && ((pstate.overlay !== null && pstate.overlay !== 'exit') || (pstate.timerOpen && pstate.timerMode === 'full'));
  const coveringRef = useRef(covering);
  coveringRef.current = covering;

  // The docked bar hides after `presenter.autoHideMs` without pointer, touch or key and returns on any
  // of them (README D3). The phone bar does not follow page activity (a stage tap never shows it):
  // only while a covering tool is open, which changes no slide, does a touch bring it back, so the
  // tool can be cleared or left.
  useEffect(() => {
    if (phase.kind !== 'running' || (phone && !covering)) return undefined;
    showBar();
    return subscribeActivity(showBar);
  }, [phase.kind, phone, covering, showBar]);

  // ---- the presenter home (section 3.12) ----
  const quick = useMemo(() => quickSource(locale), [locale]);
  const openFromHome = useCallback(
    (choice: HomeChoice) => {
      const next = homeStart(choice);
      // The start screen's history entry holds the deck, as a link does, so a reload reopens it (rule 2, section 3.2).
      void pushPresenterEntry('ready', rawOf(next.deck), { fresh: choice.kind === 'start-over' });
      rejected.current = false;
      setHomeFocus(false);
      setHomeHelp(false);
      setPhase(choice.kind === 'start-over' ? { ...next, fresh: true } : next);
    },
    [rawOf],
  );
  // Back to lessons and the phone footer's Back: nothing started, so nothing is saved or sent (rule 3).
  const backToHome = useCallback(() => {
    void returnToPresenterHome();
    setHomeFocus(true);
    setPhase({ kind: 'home' });
  }, []);

  // The browser's or phone's back (section 3.5 "History", `popPlan`).
  const onPop = useRef<(landed: HistoryEntry | null) => void>(() => undefined);
  onPop.current = (landed) => {
    const overlay = moreOpenRef.current || coveringRef.current ? 'covering' : stateRef.current?.overlay === 'exit' ? 'exit' : 'none';
    const action = popPlan(landed, { phase: phase.kind, begun: begun.current, overlay });
    switch (action.kind) {
      case 'home':
        void clearPresenterForward();
        setHomeFocus(true);
        setPhase({ kind: 'home' });
        return;
      case 'exit':
        onExit();
        return;
      case 'close-overlay':
        repush.current = true;
        if (moreOpenRef.current) setMoreOpen(false);
        else dispatch('close');
        return;
      case 'confirm':
        repush.current = true;
        if (stateRef.current?.overlay !== 'exit') dispatch({ overlay: 'exit' });
        return;
      case 'ready':
        backToStart(true);
        return;
      case 'resume':
        repush.current = false;
        if (stateRef.current?.overlay === 'exit') dispatch('close');
        return;
      case 'step-back':
        void stepBackPresenter();
        return;
      case 'none':
        return;
    }
  };
  useEffect(() => subscribePresenterPop((landed) => onPop.current(landed)), []);

  // ---- render ----
  // A phone window has no band: its compact bar floats over the stage, so the stage is the window less
  // the safe area, judged on the phone gate alone. Elsewhere too small is judged on the one-row band, so
  // a bar that wraps cannot decide it; then the too-small page takes the whole window, and no bar is drawn.
  const box = stageBox(window, phone ? 0 : band, insets);
  const scale = stageScale(box, phone ? PHONE_STAGE_BOUNDS : STAGE_BOUNDS);
  const tooSmall = phone ? scale.tooSmall : stageScale(stageBox(window, BAR_BAND, insets), STAGE_BOUNDS).tooSmall || scale.tooSmall;
  const stageShows = stageView({ phone, window, tooSmall });
  const stageViewContext: PresenterView = { ...view, unit: scale.unit, phone };
  // The bar's overlays speak the chrome language; only the stage (the slides) speaks the slide language.
  const slideViewContext: PresenterView = { ...stageViewContext, messages: slideMessages, locale: slidesIn };
  // The first slide is on screen: the lesson begins (see `begin`).
  const slideShown = phase.kind === 'running' && stageShows === 'slide' && pstate !== null && slides[pstate.slideIdx] !== undefined;
  useEffect(() => {
    if (slideShown) begin();
  }, [slideShown, begin]);
  // On a phone the bar shows when the slide does (the start of the lesson, or back from the rotate page), so its place is learned.
  useEffect(() => {
    if (slideShown && phone) showBar();
  }, [slideShown, phone, showBar]);

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
          onDisplay={() => setDisplayOpen(true)}
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
            keepVisible={keepVisible}
            onKeepVisible={setKeepVisible}
            onClose={() => setHomeHelp(false)}
            phone={phone}
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
          onDisplay={() => setDisplayOpen(true)}
          onTestSound={onTestSound}
          soundCheck={soundCheck}
          onTurnSoundOn={onTestSoundOn}
          phone={phone}
          portrait={upright}
          short={short}
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
      onMode: (mode) => userDispatch({ timerMode: mode }),
      onClose: () => userDispatch('close-timer'),
      onToggleNumbers: () => setShowNumbers((on) => !on),
    };
    const state = messages.learner.presenter.state;
    const page =
      stageShows === 'rotate' ? (
        // A phone held upright during a lesson (section 3.6): turn it; turning back returns to the same
        // slide and build. Back opens the Exit confirm (rule 4), or before the first slide was shown,
        // returns to the start screen with the same deck (nothing started, so nothing was counted or stored).
        <StatePage
          testID="presenter-rotate"
          pose="idle"
          title={state.rotate.title}
          line={state.rotate.line}
          back={{
            label: messages.common.buttons.back,
            onPress: () => (begun.current ? userDispatch({ overlay: 'exit' }) : backToStart(false)),
            testID: 'presenter-rotate-back',
          }}
        />
      ) : stageShows === 'too-small' || !slide ? (
        <StatePage testID="presenter-too-small" pose="thinking" line={state.tooSmall} cta={messages.learner.presenter.bar.exit.cta} onCta={() => userDispatch({ overlay: 'exit' })} />
      ) : null;
    const bar =
      page !== null ? null : (
        <ControlBar
          hidden={phone ? barHidden || moreOpen : barHidden}
          revealNext={revealNext}
          muted={muted}
          fullscreenSupported={fullscreenSupported()}
          fullscreen={fullscreen}
          onPrev={() => userDispatch('prev')}
          onNext={() => userDispatch('next')}
          onSound={() => userDispatch('replay-sound')}
          onFullscreen={() => {
            activate();
            toggleFullscreen();
          }}
          onExit={() => userDispatch({ overlay: 'exit' })}
          onTimer={() => userDispatch(timerOpenEvent(p, timerRef.current))}
          onBlank={() => userDispatch({ overlay: 'blank' })}
          onGrid={() => userDispatch({ overlay: 'grid' })}
          onHelp={() => userDispatch({ overlay: 'help' })}
          chips={chips}
          onTurnSoundOn={() => {
            activate();
            useAudioStore.getState().setMuted(false, 'fallback_panel');
          }}
          onFocusWithin={(focused, pointer) => {
            // A keyboard, switch or screen-reader focus holds the bar on every device; on a phone a
            // press's own focus does not (the step it made hides the bar), on the docked bar it does.
            barHeld.current = focused && (!phone || !(pointer || lastInput.current === 'pointer'));
            if (!focused) {
              if (!barHidden) showBar();
              return;
            }
            if (barHeld.current) {
              clearBarTimer();
              setBarHidden(false);
            }
          }}
          {...(phone ? {} : { onBandHeight: setBand })}
          exitRef={exitRef}
          compact={phone}
          insets={insets}
          moreOpen={moreOpen}
          onMore={(open) => {
            activate();
            setMoreOpen(open);
            if (!open) showBar();
          }}
        />
      );
    const stageAndTools = (
      <>
        {page ?? (
          <PresenterViewProvider value={slideViewContext}>
            {/* Slides keep their stage units: the chosen text size never reaches the stage. */}
            <TextSizeProvider step="standard">
            <Stage
              scale={scale}
              slides={slides}
              slideIdx={p.slideIdx}
              reveal={reveal}
              deckTitle={phase.deck.title}
              strokeToken={strokeTokenFor(strokePlay, slide?.key)}
              joinCta={slideMessages.caregiver.spaces.join.cta}
              onCommand={userDispatch}
              onPlaySound={() => userDispatch('replay-sound')}
              onStartTimer={(ms) => userDispatch({ startTimer: ms })}
              romanization={romanizationNow}
              sayIt={sayIt}
              storyScene={stories.scene}
              {...(phone
                ? {
                    barStrip: PHONE_BAR_STRIP,
                    onStripTap: () => {
                      activate();
                      if (barHidden) showBar();
                      else hideBarNow();
                    },
                  }
                : {})}
            />
            </TextSizeProvider>
          </PresenterViewProvider>
        )}
        {scale.portrait && page === null ? <StageHint text={state.portrait} /> : null}
        {endHint && page === null ? <StageHint text={messages.learner.presenter.slide.end.exitHint} bottom={!phone} /> : null}
        {page === null && soundFlash !== null ? (
          <SoundFlash key={soundFlash.at} text={messages.learner.presenter.bar[soundFlash.key]} testID={SOUND_FLASH_TEST_IDS[soundFlash.key]} />
        ) : null}
        {/* Class tools over the stage box (the bar stays): the full timer, a covering tool, then the
            corner timer, which stays on screen over a covering tool (section 3.5 amendment 1). */}
        {page === null ? (
          <PresenterViewProvider value={stageViewContext}>
            {p.timerOpen && p.timerMode === 'full' ? <TimerOverlay mode="full" timer={timer} showNumbers={showNumbers} controls={timerControls} /> : null}
            {p.overlay === 'blank' ? <BlankOverlay onPause={() => userDispatch({ overlay: 'pause' })} /> : null}
            {p.overlay === 'pause' ? <PauseOverlay /> : null}
            {p.overlay === 'grid' ? (
              <GridOverlay
                items={gridItems(slides, p, { activity: (preset) => messages.learner.presenter.activity[preset] })}
                onGoto={(idx) => userDispatch({ goto: idx })}
                onToggle={(key) => userDispatch({ toggleSkip: key })}
                onClose={() => userDispatch('close')}
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
                onClose={() => userDispatch('close')}
                phone={phone}
              />
            ) : null}
            {p.timerOpen && p.timerMode === 'corner' ? <TimerOverlay mode="corner" timer={timer} showNumbers={showNumbers} controls={timerControls} /> : null}
          </PresenterViewProvider>
        ) : null}
      </>
    );
    const exitConfirm = p.overlay === 'exit' ? <ExitConfirm onKeepGoing={() => userDispatch('close')} onExit={onExit} /> : null;
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
            paddingBottom: insets.bottom,
            paddingLeft: insets.left,
            paddingRight: insets.right,
          }}
        >
          {stageAndTools}
        </View>
        {bar}
        {exitConfirm}
      </View>
    ) : (
      // The bar comes first in the DOM, so focus order is the bar, then the stage (README D3, section
      // 3.13); `column-reverse` still draws it in its band under the stage.
      <View style={{ flex: 1, flexDirection: 'column-reverse', backgroundColor: colors.surface.paper }}>
        {bar}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right }}>
          {stageAndTools}
        </View>
        {exitConfirm}
      </View>
    );
  }

  return (
    <TextSizeProvider step={textSize}>
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
      {phase.kind === 'home' || phase.kind === 'ready' ? (
        <DeviceDisplaySheet visible={displayOpen} onClose={() => setDisplayOpen(false)} testID="presenter-display-sheet" reportLocale={false} />
      ) : null}
    </PresenterViewProvider>
    </TextSizeProvider>
  );
}

/** The three sound flashes (section 3.7 amendment 2026-10-17), keyed by their `learner.presenter.bar` message. */
type SoundFlashKey = 'noVoice' | 'noSound' | 'soundFailed';
const SOUND_FLASH_TEST_IDS: Readonly<Record<SoundFlashKey, string>> = {
  noVoice: 'presenter-no-voice-flash',
  noSound: 'presenter-no-sound-flash',
  soundFailed: 'presenter-sound-failed-flash',
};

/**
 * A sound flash at the top of the stage, for `presenter.autoHideMs`: the no-voice chip when a sound
 * build cannot play on a phone (F-TCH-004 section 3.6; the bar, where the chip lives, is hidden),
 * and on both bars after a Sound press with nothing to play or a play that failed (section 3.7).
 * Status only: it takes no touch.
 */
function SoundFlash({ text, testID }: { text: string; testID: string }): React.ReactElement | null {
  // The bar's no-voice chip, shown over the stage: chrome, so it follows the chosen text size.
  const textScale = useTypeScale();
  const [on, setOn] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setOn(false), presenter.autoHideMs);
    return () => clearTimeout(timer);
  }, []);
  if (!on) return null;
  return (
    <View
      testID={testID}
      role="status"
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: spacing.md,
        alignSelf: 'center',
        maxWidth: '90%',
        backgroundColor: colors.surface.paper,
        borderRadius: radii.pill,
        borderWidth: borderWidth.base,
        borderColor: colors.border.strong,
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.lg,
      }}
    >
      <Text {...KOREAN_LINE_BREAK} style={{ fontSize: textScale.size.body, color: colors.text.primary }}>
        {text}
      </Text>
    </View>
  );
}
