import { colors, presenter } from '@hangul-route/design-system';
import { LOCALE_META, dictionaryLocale, getMessages, type UiLocale } from '@hangul-route/i18n';
import type { LectureDeck } from '@hangul-route/content-schema';
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
import { clearPickerLabels, heldLabels } from './src/logic/lecture/picker-labels';
import { emptyRecent, loadRecent, rememberDeck, saveRecent, setLastSlide, type RecentList, type RecentStore } from './src/logic/lecture/recent';
import {
  completePayload,
  resolveBoot,
  runDeck,
  startPayload,
  startTally,
  tallyStep,
  type BootResult,
  type RunTally,
  type StartSource,
} from './src/logic/lecture/shell';
import { BAR_BAND, FONT_WAIT_MS, stageBox } from './src/logic/lecture/stage-constants';
import { stageScale } from './src/logic/lecture/stage-scale';
import { getCapability, playPrompt, refreshCapability, subscribeCapability, unlockAudio } from './src/platform/audio';
import { setDocumentLang } from './src/platform/locale';
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
  markOpenDeck,
  openDeckId,
  releaseScreenAwake,
  setPresenterDocTitle,
  subscribeActivity,
  subscribeFullscreen,
  subscribeKeys,
  takeDeckFragment,
  unlockOrientation,
  waitForPresenterFont,
  wakeLockSupported,
} from './src/platform/presenter';
import { applyUpdate, isOfflineReady, subscribePwa } from './src/platform/pwa';
import { readJson, writeJson } from './src/platform/storage';
import { flushQueue, track } from './src/platform/telemetry';
import { ControlBar } from './src/screens/presenter/ControlBar';
import { ExitConfirm } from './src/screens/presenter/ExitConfirm';
import { PresenterViewProvider, type PresenterView } from './src/screens/presenter/presenter-context';
import { Stage, StageHint } from './src/screens/presenter/Stage';
import { StartScreen, type PickerRow, type VoiceCheck } from './src/screens/presenter/StartScreen';
import { StatePage } from './src/screens/presenter/StatePage';
import { OopsScreen } from './src/screens/system/OopsScreen';
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
 */

const recentStore: RecentStore = { readJson: (key) => readJson<unknown>(key), writeJson: (key, value) => writeJson(key, value) };

let bootRead: { raw: string | null; openId: string | null } | null = null;

/** The address is read once per page, before the first paint (the fragment then leaves it). */
function readAddress(): { raw: string | null; openId: string | null } {
  if (bootRead === null) {
    const openId = openDeckId();
    bootRead = { raw: takeDeckFragment(), openId };
  }
  return bootRead;
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

function voiceCheck(capability: AudioCapability, checked: boolean): VoiceCheck {
  const tts = capability.tts;
  if (tts.state === 'ready') return { kind: tts.local ? 'local' : 'network', name: tts.voiceName };
  if (capability.clips) return { kind: 'local', name: '' };
  if (tts.state === 'none') return tts.reason === 'offline_network_only' ? { kind: 'needs-internet' } : { kind: 'none' };
  return checked ? { kind: 'none' } : { kind: 'checking' };
}

export default function PresenterApp(): React.ReactElement {
  const address = useMemo(readAddress, []);
  const [phase, setPhase] = useState<Phase>(() => (address.raw !== null ? phaseOf(resolveBoot(address.raw, null, emptyRecent())) : { kind: 'boot' }));
  const recent = useRef<RecentList>(emptyRecent());
  const deviceLocale = useLocaleStore((s) => activeLocale(s, null));
  const deck = phase.kind === 'ready' || phase.kind === 'running' ? phase.deck : null;
  const locale: UiLocale = deck?.options.uiLocale ?? deviceLocale;
  const messages = useMemo(() => getMessages(dictionaryLocale(locale)), [locale]);
  const reducedMotion = useReducedMotion();
  const window = useWindowDimensions();
  const [band, setBand] = useState<number>(BAR_BAND);
  const [capability, setCapability] = useState<AudioCapability>(getCapability);
  const [voiceChecked, setVoiceChecked] = useState(false);
  const muted = useAudioStore((s) => s.muted);
  const [updateWaiting, setUpdateWaiting] = useState(false);

  // Boot: the audio settings and the device locale only (no profile), the voice check, the queue.
  useEffect(() => {
    let live = true;
    void useAudioStore.getState().hydrate().catch(() => undefined);
    void useLocaleStore.getState().hydrate([]).catch(() => undefined);
    const offCapability = subscribeCapability(setCapability);
    void refreshCapability()
      .catch(() => undefined)
      .then(() => {
        if (live) setVoiceChecked(true);
      });
    void flushQueue();
    if (address.raw === null) {
      void loadRecent(recentStore).then((list) => {
        recent.current = list;
        if (live) setPhase(phaseOf(resolveBoot(null, address.openId, list)));
      });
    } else {
      void loadRecent(recentStore).then((list) => {
        recent.current = list;
      });
    }
    const offPwa = subscribePwa((event) => {
      if (event === 'back-online') void flushQueue();
      if (event === 'update-ready') setUpdateWaiting(true);
    });
    return () => {
      live = false;
      offCapability();
      offPwa();
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
  const run = useMemo(() => (deck && expanded ? runDeck(deck, expanded) : null), [deck, expanded]);

  // A link that does not decode, or a deck with nothing to show: the invalid screen, once per page.
  const rejected = useRef(false);
  useEffect(() => {
    if (phase.kind === 'invalid' && !rejected.current && address.raw !== null) {
      rejected.current = true;
      const decoded = resolveBoot(address.raw, null, emptyRecent());
      void track({ name: 'lecture.deck_rejected', payload: { reason: decoded.kind === 'invalid' ? decoded.reason : 'invalid' } });
    }
    if (phase.kind === 'ready' && run !== null && run.slides.length === 0) {
      if (!rejected.current) {
        rejected.current = true;
        void track({ name: 'lecture.deck_rejected', payload: { reason: 'invalid' } });
      }
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

  const view: PresenterView = useMemo(() => ({ messages, locale, unit: 0, reducedMotion }), [messages, locale, reducedMotion]);

  // ---- the start screen ----
  const [fontReady, setFontReady] = useState(false);
  useEffect(() => {
    if (phase.kind !== 'ready') return undefined;
    let live = true;
    void waitForPresenterFont(FONT_WAIT_MS).then(() => {
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
  const [strokeToken, setStrokeToken] = useState(0);
  const [endHint, setEndHint] = useState(false);
  const [fullscreen, setFullscreen] = useState(isFullscreen);
  const exitRef = useRef<View>(null);

  const slides: Slide[] = useMemo(() => {
    if (!deck || !run) return [];
    const mode = romanization ?? deck.options.romanization;
    return mode === deck.options.romanization ? run.slides : withBuilds(run.slides, { romanization: mode, strokeGuide: deck.options.strokeGuide });
  }, [deck, run, romanization]);

  const playSound = useCallback(
    (slide: Slide | undefined) => {
      if (!slide || slide.kind !== 'letter' || !deck?.options.sound) return;
      const { text, audioRef } = slide.spoken;
      void playPrompt({ text, ...(audioRef !== undefined ? { audioRef } : {}), kind: 'sound', source: 'presenter' });
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
      if (tally.current) tally.current = tallyStep(tally.current, before, state, slides);
      if (state.slideIdx !== before.slideIdx && deck) {
        const key = slides[state.slideIdx]!.key;
        recent.current = setLastSlide(recent.current, deck.id, key);
        void saveRecent(recentStore, recent.current);
      }
      const atEnd = event === 'next' && state === before && before.overlay === null && before.slideIdx === slides.length - 1;
      setEndHint(atEnd);
      if (atEnd) exitRef.current?.focus?.();
      if (!effect) return;
      if (effect.type === 'revealed') {
        const build = slides[state.slideIdx]?.builds[effect.build];
        if (build === 'sound') playSound(slides[state.slideIdx]);
        if (build === 'stroke') setStrokeToken((n) => n + 1);
      } else if (effect.type === 'play-sound') {
        playSound(slides[state.slideIdx]);
      } else if (effect.type === 'play-stroke') {
        setStrokeToken((n) => n + 1);
      }
    },
    [slides, deck, playSound],
  );

  const toggleFullscreen = useCallback(() => {
    if (isFullscreen()) void exitFullscreen();
    else void enterFullscreen();
  }, []);

  useEffect(() => subscribeFullscreen(() => setFullscreen(isFullscreen())), []);

  const pickerMode = deck?.picker == null ? 'none' : labels !== null ? deck.picker.mode : 'numbers';

  const onStart = useCallback(() => {
    if (phase.kind !== 'ready' || !run || slides.length === 0) return;
    // Gesture-bound requests first, in the tap itself (section 3.5); each is feature-detected and may be refused.
    unlockAudio();
    void enterFullscreen();
    void keepScreenAwake();
    void lockLandscape();
    const state = initialPresenterState({ slides }, phase.resumeKey);
    stateRef.current = state;
    setPstate(state);
    tally.current = startTally(Date.now(), slides[state.slideIdx]?.key);
    if (phase.source !== 'recent') {
      recent.current = rememberDeck(recent.current, phase.deck, new Date().toISOString());
    }
    recent.current = setLastSlide(recent.current, phase.deck.id, slides[state.slideIdx]!.key);
    void saveRecent(recentStore, recent.current);
    markOpenDeck(phase.deck.id);
    void track({
      name: 'lecture.start',
      payload: { ...startPayload({ deck: phase.deck, run, source: phase.source, pickerMode, capability, offlineReady: isOfflineReady() }) },
    });
    setPhase({ kind: 'running', deck: phase.deck, source: phase.source });
    const first = slides[state.slideIdx]!;
    if (first.builds[0] === 'stroke') setStrokeToken((n) => n + 1);
  }, [phase, run, slides, pickerMode, capability]);

  const onExit = useCallback(() => {
    void exitFullscreen();
    void releaseScreenAwake();
    unlockOrientation();
    const payload = tally.current ? completePayload(tally.current, Date.now()) : { slidesShown: 0, minutes: 0, reveals: 0 };
    tally.current = null;
    clearPickerLabels();
    markOpenDeck(null);
    stateRef.current = null;
    setPstate(null);
    setRomanization(null);
    setEndHint(false);
    setPhase({ kind: 'home' });
    void track({ name: 'lecture.complete', payload }).finally(() => {
      // A waiting update applies only now, never mid-lesson (section 3.8).
      if (updateWaiting) applyUpdate();
    });
  }, [updateWaiting]);

  // Keys (section 3.5); the class tools (timer, picker, blank, grid, help) arrive with their overlays in PR 9.
  useEffect(() => {
    if (phase.kind !== 'running') return undefined;
    return subscribeKeys((command: KeyCommand) => {
      if (command === 'toggle-romanization') {
        setRomanization((current) => ((current ?? phase.deck.options.romanization) === 'always' ? 'tap' : 'always'));
        return;
      }
      if (command === 'fullscreen') {
        toggleFullscreen();
        return;
      }
      if (typeof command === 'object') return;
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
        if (!barFocused.current) setBarHidden(true);
      }, presenter.autoHideMs);
    };
    arm();
    const stop = subscribeActivity(arm);
    return () => {
      stop();
      if (timer) clearTimeout(timer);
    };
  }, [phase.kind]);

  // ---- render ----
  const box = stageBox(window, band);
  const scale = stageScale(box, presenter.stage);
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
    body = <StatePage testID="presenter-invalid" pose="thinking" title={m.title} line={m.line} cta={m.cta} onCta={() => setPhase({ kind: 'home' })} />;
  } else if (phase.kind === 'home') {
    // The presenter home (Recent lessons and Quick lesson) is F-TCH-004 PR 8; until then it names where lessons come from.
    body = <StatePage testID="presenter-home" pose="waving" title={messages.learner.presenter.home.title} line={messages.learner.presenter.state.invalid.line} />;
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
        />
      );
  } else {
    const p = pstate ?? initialPresenterState({ slides });
    const slide = slides[p.slideIdx];
    const reveal = slide ? Math.min(p.reveal, slide.builds.length - 1) : 0;
    const revealNext = slide !== undefined && reveal < slide.builds.length - 1;
    body = (
      <View style={{ flex: 1, backgroundColor: colors.surface.paper }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          {scale.tooSmall || !slide ? (
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
                strokeToken={strokeToken}
                joinCta={messages.caregiver.spaces.join.cta}
                onCommand={dispatch}
                onPlaySound={() => dispatch('replay-sound')}
              />
            </PresenterViewProvider>
          )}
          {scale.portrait && !scale.tooSmall ? <StageHint text={messages.learner.presenter.state.portrait} /> : null}
          {endHint ? <StageHint text={messages.learner.presenter.slide.end.exitHint} bottom /> : null}
        </View>
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
          onFocusWithin={(focused) => {
            barFocused.current = focused;
            if (focused) setBarHidden(false);
          }}
          onBandHeight={setBand}
          exitRef={exitRef}
        />
        {p.overlay === 'exit' ? <ExitConfirm onKeepGoing={() => dispatch('close')} onExit={onExit} /> : null}
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ErrorBoundary fallbackRender={({ resetErrorBoundary }) => <OopsScreen onRetry={resetErrorBoundary} />}>
          <PresenterViewProvider value={view}>
            <View style={{ flex: 1, backgroundColor: colors.surface.paper }}>{body}</View>
          </PresenterViewProvider>
          <StatusBar style="dark" />
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
