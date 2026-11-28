import type { DiscoverPage } from '@hangul-route/content-schema';
import {
  Body,
  Button,
  Caption,
  Card,
  Heading,
  Hoya,
  Icon,
  KoreanText,
  Pill,
  Progress,
  Spacer,
  SyllableBlock,
  borderWidth,
  colors,
  motion,
  radii,
  spacing,
  touchTarget,
  typography,
  KOREAN_LINE_BREAK,
  useTypeScale,
} from '@hangul-route/design-system';
import type { Messages } from '@hangul-route/i18n';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement, RefObject } from 'react';
import { ScrollView, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { CantHear } from '../../components/CantHear';
import { PromptPanel } from '../../components/PromptPanel';
import { VoiceHelpSheet } from '../../components/VoiceHelpSheet';
import { usePromptSlot, type PromptSlot } from '../../components/use-prompt-slot';
import { useLocale, useMessages } from '../../i18n/use-messages';
import { useRomanizationMode, useMountResolver } from '../../i18n/use-romanization-mode';
import { hasPicture } from '../../logic/picture-ref';
import {
  DISCOVER_AUDIO_SOURCE,
  actionSpecs,
  autoHearAllowed,
  autoHearId,
  buildDiscover,
  pageRender,
  playInOrder,
  startDiscover,
  stepDiscover,
  type DiscoverEffect,
  type DiscoverEvent,
  type DiscoverExchangeRender,
  type DiscoverItemRender,
  type DiscoverStart,
  type DiscoverState,
  type HearAction,
  type HearSpec,
} from '../../logic/stage1/discover-flow';
import { discoverCards } from '../../logic/quest-flow/pacing-view';
import { clipRefsOf } from '../../logic/audio/clip-refs';
import { exampleWordLabel } from '../../logic/stage1/example-label';
import { afterScreenSettles } from '../../logic/audio/settle';
import { hasClipFor, playPrompt, stop as stopAudio, warmClips, type PlayResult } from '../../platform/audio';
import { useReducedMotion } from '../../platform/motion';
import { announceAndWait, focusForScreenReader, isScreenReaderEnabled } from '../../platform/screen-reader';
import { useAudioStore } from '../../store/audio-store';
import { PICTURE_CONTEXT, PictureArt } from '../minigames/PictureArt';
import { traceArrangement, type TracePadPlan } from '../../logic/stage1/trace-pad-layout';
import { DiscoverTracePad, preloadTracePad } from './discover-trace-entry';
import { StepActions } from './StepActions';
import { useScreenContentBox } from './use-screen-content-box';

/**
 * Discover (F-QUEST-002 §3.2): teach before play. One or two new things per
 * page, each shown, named and heard on request; Continue is enabled at once.
 * [AU] AMENDMENTS-AUDIT-2026-11 row AU-10: with `autoHear` (a learner's or a guest's quest), a letter page says its
 * first letter once as it opens (the page opens after a tap, so the browser lets it sound); nothing else autoplays,
 * and Continue never waits for it. The behaviour lives in
 * `logic/stage1/discover-flow.ts` (view model, reducer, effects); this file
 * renders it and runs the effects.
 * Design: design/wireframes/quest/discover.md (S1, S2), design/components/SyllableBlock/spec.md;
 * the exchange page and its Read along: design/wireframes/quest/discover-sentences.md (S3).
 * Each item card (and the exchange) is one prompt slot (F-AUDIO-004 §3.8, A-5b): the Korean is
 * printed on the card, so a play that cannot sound shows the status panel with why and the one
 * action (Turn sound on, Tap to hear, Try again), and leaving the step stops the voice.
 */

/** A card's prompt slot, as the step reaches it to play one of the card's buttons. */
interface CardSlot {
  play: PromptSlot['play'];
}
/** The card an action id belongs to: `<item key>|sound`, `|name`, `|vowels`, `|example` or `|line<n>`. */
const cardKeyOf = (actionId: string): string => actionId.split('|')[0] ?? actionId;

interface Props {
  pages: readonly DiscoverPage[];
  /** The step's Hoya line, shown once and small. */
  hoyaLine?: string;
  /**
   * Continue on the last page: the player advances and reports `quest.discover_completed`. `written` and `writeSeconds` (the
   * letters traced and the whole seconds the trace page was shown) are there only when the step has a trace page.
   */
  onDone: (result: { pages: number; heard: number; written?: number; writeSeconds?: number }) => void;
  /** A strong round earlier in the cell: the second page, when it holds two words, draws both on one card (F-CURR-002 section 4.6). */
  compact?: boolean;
  /**
   * [AU] Row AU-10: each letter page plays its first letter's sound once when it opens, through the same play as its
   * Hear it. Off by default (the All lessons preview, where a grown-up is looking, not learning).
   */
  autoHear?: boolean;
  /**
   * [QB] The step before (AMENDMENTS-QUEST-SOUND-BACK QB-2): Previous on the first page calls it. Absent when this is
   * the quest's first step, and page 1 then has no Previous.
   */
  onPrevious?: () => void;
  /** [QB] How the step opens (QB-2): on its last page when it was reached by Previous, with full dots when it is shown again. Read once. */
  start?: DiscoverStart;
  /**
   * [TC] AMENDMENTS-STAGE1-TRACE-COVERAGE: a step whose letter cards have stroke data gets one more page, "Trace the new letters",
   * after its last letter page. Off by default, so the other screens that show a Discover step stay as they are; the quest player
   * turns it on for every Discover step it renders.
   */
  writeOnce?: boolean;
  /**
   * [TC] Tells the player which page kind shows and, on the trace page, the arrangement it took (§3.4): the player draws the title
   * slot, the step pill and the step dots by it. Called when the page changes and with `'cards'` when the step goes.
   */
  onPageKind?: (kind: 'cards' | 'trace', plan: TracePadPlan | null) => void;
}

type DiscoverMessages = Messages['learner']['quest']['discover'];

export function DiscoverStep({ pages, hoyaLine, onDone, compact = false, autoHear = false, onPrevious, start, writeOnce = false, onPageKind }: Props): ReactElement {
  const m = useMessages();
  const copy = m.learner.quest.discover;
  const locale = useLocale();
  const model = useMemo(() => buildDiscover(pages, copy, m.a11y, locale, undefined, { writeOnce }), [pages, copy, m.a11y, locale, writeOnce]);
  const hasTracePage = useMemo(() => model.pages.some((p) => p.write !== undefined), [model]);
  const actions = useMemo(() => {
    const map = new Map<string, HearAction>();
    for (const page of model.pages) {
      for (const item of page.items) {
        map.set(item.hear.id, item.hear);
        if (item.nameButton) map.set(item.nameButton.action.id, item.nameButton.action);
        if (item.vowelsButton) map.set(item.vowelsButton.action.id, item.vowelsButton.action);
        if (item.example) map.set(item.example.hear.id, item.example.hear);
      }
      for (const line of page.exchange?.lines ?? []) map.set(line.hear.id, line.hear);
      // [TC] The trace page's Hear it and Show me play each letter's own sound under `write|<jamoId>`.
      for (const letter of page.write?.letters ?? []) map.set(letter.hear.id, letter.hear);
    }
    return map;
  }, [model]);
  // Read along: each exchange line's label for the screen reader, and each item's line count.
  const exchanges = useMemo(() => {
    const labels = new Map<string, string>();
    const counts = new Map<string, number>();
    for (const page of model.pages) {
      const ex = page.exchange;
      if (!ex) continue;
      counts.set(ex.key, ex.lines.length);
      ex.lines.forEach((l, i) => labels.set(l.hear.id, copy.exchange.lineLabel(i + 1, ex.lines.length, l.speaker)));
    }
    return { labels, lineCount: (item: string): number => counts.get(item) ?? 0 };
  }, [model, copy]);

  // Recordings for every Hear it on these pages are fetched and decoded ahead (§3.10).
  useEffect(() => {
    // [SF-3] Every sound of a button that says several (Hear it with vowels), so the o and u clips do not load cold.
    void warmClips(clipRefsOf([...actions.values()].flatMap(actionSpecs)));
  }, [actions]);

  // [TC] The trace page's chunk is asked for as the step opens, so it is in long before the page shows.
  useEffect(() => {
    if (hasTracePage) preloadTracePad();
  }, [hasTracePage]);

  const romanizationMode = useRomanizationMode();
  // [RF] The item-level mode (AMENDMENTS-ROMANIZATION-FADE sections 3.3, 3.6): the resolver of the first draw, kept for the
  // whole step, so a change of phase under an open step applies from the next screen. Discover is a quest step.
  const resolver = useMountResolver();
  const romanizationModeOf = resolver.forText;

  const [state, setState] = useState<DiscoverState>(() => startDiscover(model, start));
  const stateRef = useRef(state);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const dispatchRef = useRef<(event: DiscoverEvent) => void>(() => undefined);
  const scrollRef = useRef<ScrollView | null>(null);

  const pauseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** [QS-3] Drops the page's own first sound while it still waits for the screen; `null` when none waits. */
  const pendingAutoHear = useRef<(() => void) | null>(null);
  /**
   * [SF-3] The button that says several sounds in a row (Hear it with vowels, §12.3): `run` counts plays, so a newer
   * play, a stop, a page change or leaving ends the run in progress (a cut-off prompt still resolves as `played`);
   * `series` is set while a run plays and `cancelGap` ends the wait between two of its sounds at once.
   */
  const seriesRun = useRef({ run: 0, series: false, cancelGap: null as (() => void) | null });
  const endSeries = useCallback((): number => {
    const s = seriesRun.current;
    s.run += 1;
    s.series = false;
    s.cancelGap?.();
    s.cancelGap = null;
    return s.run;
  }, []);
  const seriesGap = useCallback(
    (ms: number): Promise<void> =>
      new Promise((resolve) => {
        const handle = setTimeout(() => {
          seriesRun.current.cancelGap = null;
          resolve();
        }, ms);
        seriesRun.current.cancelGap = () => {
          clearTimeout(handle);
          resolve();
        };
      }),
    [],
  );
  // Leaving the step (Continue on the last page, Leave, Back) stops a word or sentence mid-way.
  useEffect(
    () => () => {
      if (pauseTimer.current !== null) clearTimeout(pauseTimer.current);
      endSeries();
      stopAudio();
    },
    [endSeries],
  );

  // Each card's prompt slot, and the button it played last (its panel's action plays that one again).
  const cardSlots = useRef(new Map<string, CardSlot>());
  const lastPlayed = useRef(new Map<string, string>());
  const registerSlot = useCallback((key: string, slot: CardSlot): (() => void) => {
    cardSlots.current.set(key, slot);
    return () => {
      if (cardSlots.current.get(key) === slot) cardSlots.current.delete(key);
    };
  }, []);
  const [helpOpen, setHelpOpen] = useState(false);
  const openHelp = useCallback(() => setHelpOpen(true), []);

  /**
   * [TC] `writeSeconds` of `quest.discover_completed` (OD-TC-8): the whole seconds the trace page was shown in this mount,
   * summed over its visits (Previous and Continue back). 0 without a trace page. Kept in refs: nothing renders from it.
   */
  const writeShown = useRef({ at: null as number | null, ms: 0 });
  const writeSecondsNow = useCallback((): number => {
    const shown = writeShown.current;
    const live = shown.at === null ? 0 : Date.now() - shown.at;
    return Math.floor((shown.ms + live) / 1000);
  }, []);

  /** Runs one effect; the returned promise settles when the next effect of the same batch may start. */
  const runEffect = useCallback(
    (effect: DiscoverEffect): Promise<void> | void => {
      switch (effect.type) {
        case 'done':
          onDoneRef.current({
            pages: effect.pages,
            heard: effect.heard,
            ...(hasTracePage ? { written: effect.written, writeSeconds: writeSecondsNow() } : {}),
          });
          return;
        case 'stopAudio':
          if (pauseTimer.current !== null) clearTimeout(pauseTimer.current);
          endSeries();
          stopAudio();
          return;
        case 'pause':
          pauseTimer.current = setTimeout(() => dispatchRef.current({ type: 'readAlongNext', run: effect.run }), motion.duration.slow);
          return;
        case 'announce':
          // Announce, then play: the line's audio starts once the screen reader has said the label.
          return announceAndWait(exchanges.labels.get(effect.id) ?? '', motion.duration.slow);
        case 'play': {
          const action = actions.get(effect.id);
          if (!action) return;
          pendingAutoHear.current?.(); // [QS-3] a tap came first
          pendingAutoHear.current = null;
          const card = cardKeyOf(effect.id);
          lastPlayed.current.set(card, effect.id);
          // [SF-3] Any play ends a run of Hear it with vowels still going; a new one starts its own.
          const mine = endSeries();
          const say = (spec: HearSpec): Promise<PlayResult> => playPrompt({ ...spec, kind: action.kind, source: DISCOVER_AUDIO_SOURCE });
          let superseded = false;
          const { series } = action;
          const run = series
            ? async (): Promise<PlayResult> => {
                seriesRun.current.series = true;
                const result = await playInOrder(series, say, { wait: seriesGap, live: () => seriesRun.current.run === mine });
                if (seriesRun.current.run === mine) seriesRun.current.series = false;
                // A run ended by something newer reports nothing: no heard mark, no text line.
                if (result === 'superseded') {
                  superseded = true;
                  return 'played';
                }
                return result;
              }
            : () => say(action.spec);
          const slot = cardSlots.current.get(card);
          void (slot ? slot.play(run) : run()).then((result) => {
            if (superseded) return;
            dispatchRef.current({ type: 'audio', id: effect.id, result, ...(effect.run === undefined ? {} : { run: effect.run }) });
          });
          return;
        }
      }
    },
    [actions, exchanges, endSeries, seriesGap, writeSecondsNow, hasTracePage],
  );

  const dispatch = useCallback(
    (event: DiscoverEvent): void => {
      const out = stepDiscover(stateRef.current, event, exchanges.lineCount);
      stateRef.current = out.state;
      setState(out.state);
      // In order, at once until an effect has to finish first (an announce holds back the play after
      // it); if anything happened meanwhile (Stop, Continue, another line), the rest is dropped.
      const runFrom = (index: number): void => {
        for (let i = index; i < out.effects.length; i++) {
          const pending = runEffect(out.effects[i]!);
          if (pending) {
            void pending.then(() => {
              if (stateRef.current === out.state) runFrom(i + 1);
            });
            return;
          }
        }
      };
      runFrom(0);
    },
    [runEffect, exchanges],
  );
  dispatchRef.current = dispatch;

  // A new page starts at the top.
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [state.page]);

  // [SF-3] A run of Hear it with vowels never outlives its page (Continue, Previous): it stops, and nothing more plays.
  useEffect(
    () => () => {
      if (!seriesRun.current.series) return;
      endSeries();
      stopAudio();
    },
    [state.page, endSeries],
  );

  // [AU] Row AU-10: a letter page says its first letter once as it opens. Once per page, whatever re-renders (a new
  // locale rebuilds the model); never with sound off, with a screen reader on or when the sound cannot play; and when
  // the page changes before it has finished, it stops.
  const autoHeard = useRef(new Set<number>());
  const modelRef = useRef(model);
  modelRef.current = model;
  const actionsRef = useRef(actions);
  actionsRef.current = actions;
  useEffect(() => {
    if (!autoHear || autoHeard.current.has(state.page)) return undefined;
    autoHeard.current.add(state.page);
    const id = autoHearId(modelRef.current, state.page);
    if (id === undefined) return undefined;
    let live = true;
    let started = false;
    const reader = isScreenReaderEnabled();
    // [QS] AMENDMENTS-QUEST-SOUND-BACK QS-3: the page has just appeared, so the sound waits for it. A tap on any
    // Hear it during the wait plays at once and drops this one (`pendingAutoHear`), so nothing is said twice.
    const cancelWait = afterScreenSettles(() => {
      pendingAutoHear.current = null;
      void reader.then((screenReader) => {
        const action = actionsRef.current.get(id);
        if (!live || !action) return;
        const audio = useAudioStore.getState();
        if (!autoHearAllowed({ muted: audio.muted, screenReader, hasClip: hasClipFor(action.spec), voiceReady: audio.tts.state === 'ready' })) return;
        started = true;
        dispatchRef.current({ type: 'autoHear', id });
      });
    });
    pendingAutoHear.current = () => {
      live = false;
      cancelWait();
    };
    return () => {
      live = false;
      cancelWait();
      pendingAutoHear.current = null;
      if (started) stopAudio();
    };
  }, [autoHear, state.page]);

  const render = pageRender(model, state, romanizationMode, copy, romanizationModeOf);
  const page = model.pages[state.page];
  // [TC] The trace page's arrangement: chosen once for the page, from the Screen content box, the text size and the page's
  // letters (a pure function, `logic/stage1/trace-pad-layout.ts`), so the canvas keeps one size across the page's letters.
  const contentBox = useScreenContentBox();
  const typeScale = useTypeScale();
  const traceCopy = m.learner.minigame.trace;
  const writeLetters = page?.write?.letters;
  const plan = useMemo<TracePadPlan | null>(() => {
    if (writeLetters === undefined) return null;
    return traceArrangement({
      box: contentBox,
      scale: typeScale,
      letters: writeLetters.length,
      page: {
        headings: writeLetters.map((l) => (l.final ? traceCopy.headingFinal(l.romanization) : traceCopy.heading(l.romanization))),
        hasFinal: writeLetters.some((l) => l.final),
      },
    });
  }, [writeLetters, contentBox, typeScale, traceCopy]);
  const kind: 'cards' | 'trace' = plan === null ? 'cards' : 'trace';
  const onPageKindRef = useRef(onPageKind);
  onPageKindRef.current = onPageKind;
  useEffect(() => {
    onPageKindRef.current?.(kind, plan);
  }, [kind, plan]);
  useEffect(
    () => () => {
      onPageKindRef.current?.('cards', null);
    },
    [],
  );
  // The seconds the trace page is on screen (telemetry): opened when it shows, closed when the page changes or the step goes.
  useEffect(() => {
    if (kind !== 'trace') return undefined;
    const shown = writeShown.current;
    shown.at = Date.now();
    return () => {
      if (shown.at !== null) shown.ms += Date.now() - shown.at;
      shown.at = null;
    };
  }, [kind, state.page]);
  const cards = page ? discoverCards(page, compact && state.page === 1) : [];
  /** The card's panel action: play the button it played last again (the main Hear it before any). */
  const replay = useCallback((card: string, fallbackId: string): void => {
    dispatchRef.current({ type: 'hear', id: lastPlayed.current.get(card) ?? fallbackId });
  }, []);

  const previous = render.hasPrevious ? () => dispatch({ type: 'prev' }) : onPrevious;
  if (render.write && plan && page?.write) {
    // [TC] The trace page: a fixed column, never a scroll view (the canvas owns vertical drags), above the pinned buttons.
    return (
      <View style={{ flex: 1 }}>
        <DiscoverTracePad
          plan={plan}
          render={render.write}
          page={{ label: copy.pageLabel(render.page, render.dots.max), dots: render.dots }}
          dispatch={dispatch}
          audio={{ register: registerSlot, replay, onHelp: openHelp }}
          headings={page.write.letters.map((l) => (l.final ? traceCopy.headingFinal(l.romanization) : traceCopy.heading(l.romanization)))}
          pinned={
            <View style={{ paddingTop: plan.rowSize === 'lg' ? spacing.md : plan.side ? spacing.xs : spacing.sm }}>
              <StepActions
                main={{ label: copy.continue.cta, size: 'lg', onPress: () => dispatch({ type: 'next' }), testID: 'discover-continue' }}
                previousLabel={m.learner.quest.previous.cta}
                onPrevious={previous}
                rowSize={plan.rowSize}
              />
              {plan.rowSize === 'lg' ? <Spacer size="lg" /> : null}
            </View>
          }
        />
        <VoiceHelpSheet visible={helpOpen} onClose={() => setHelpOpen(false)} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: spacing.lg }}
        keyboardShouldPersistTaps="handled"
      >
        {hoyaLine ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <Hoya pose="waving" size={touchTarget.min} />
              <View style={{ flex: 1 }}>
                <Body weight="semibold">{hoyaLine}</Body>
              </View>
            </View>
            <Spacer size="md" />
          </>
        ) : null}

        {render.empty ? (
          <Body testID="discover-empty">{render.emptyLine}</Body>
        ) : (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <Caption tone="secondary">{copy.pageLabel(render.page, render.dots.max)}</Caption>
              <View style={{ flex: 1 }}>
                {/* [QB] The dots keep the furthest page (they only fill); after Previous the page shown is ringed and read out (QB-1). */}
                <Progress
                  variant="dots"
                  value={render.dots.value}
                  max={render.dots.max}
                  tone="primary"
                  testID="discover-page-dots"
                  {...(render.dots.current === undefined ? {} : { current: render.dots.current, accessibilityValueText: copy.pageLabel(render.page, render.dots.max) })}
                />
              </View>
            </View>
            {render.title ? (
              <>
                <Spacer size="sm" />
                <Heading level="prompt">{render.title}</Heading>
              </>
            ) : null}
            <Spacer size="md" />
            <View key={state.page} style={{ gap: spacing.lg }}>
              {render.exchange ? (
                <ExchangeCard
                  render={render.exchange}
                  cantHear
                  dispatch={dispatch}
                  copy={copy}
                  m={m}
                  scrollRef={scrollRef}
                  audio={{ register: registerSlot, replay, onHelp: openHelp }}
                />
              ) : null}
              {cards.map((card, cardIndex) => {
                const rows = render.items
                  .filter((r) => card.includes(r.item))
                  .map((r, i) => (
                    <DiscoverItemCard
                      key={r.item.key}
                      render={r}
                      // "Can't hear it?" (CH-1d): once per page, on its first card unless the exchange card carries it.
                      cantHear={render.exchange === undefined && cardIndex === 0 && i === 0}
                      dispatch={dispatch}
                      copy={copy}
                      a11y={m.a11y}
                      audio={{ register: registerSlot, replay, onHelp: openHelp }}
                      bare={card.length > 1}
                      divided={i > 0}
                    />
                  ));
                // The compact page (section 4.6): both words on one card, each with its own Hear it.
                return card.length > 1 ? (
                  <Card key="compact" padding="lg" tone="paper" testID="discover-compact">
                    <Caption tone="secondary">{copy.compactLine}</Caption>
                    <Spacer size="sm" />
                    {rows}
                  </Card>
                ) : (
                  rows
                );
              })}
            </View>
          </>
        )}
      </ScrollView>
      <View style={{ paddingTop: spacing.md }}>
        {/* [QB] From the second page on, Previous shows the page before (QB-1); on the first page, the step before (QB-2). */}
        <StepActions
          main={{ label: copy.continue.cta, size: 'lg', disabled: !render.continueEnabled, onPress: () => dispatch({ type: 'next' }), testID: 'discover-continue' }}
          previousLabel={m.learner.quest.previous.cta}
          onPrevious={previous}
        />
        <Spacer size="lg" />
      </View>
      <VoiceHelpSheet visible={helpOpen} onClose={() => setHelpOpen(false)} />
    </View>
  );
}

/** What a card needs to own its prompt slot: register it with the step, replay, open the voice help. */
interface CardAudio {
  register: (key: string, slot: CardSlot) => () => void;
  replay: (card: string, fallbackId: string) => void;
  onHelp: () => void;
}

/**
 * One card's prompt slot (F-AUDIO-004 A-5b: the Korean is printed on the card, so the panel only says
 * why there is no sound). The step plays the card's buttons through it. The slot counts as having a
 * clip only when every button on the card has one (the sound, its name, the example; each exchange
 * line), so a button without a clip still says "No Korean voice" on a device without one.
 */
function useCardSlot(key: string, actions: readonly (HearAction | undefined)[], audio: CardAudio, cantHear = false): PromptSlot {
  // [SF-3] Every sound of every button: Hear it with vowels counts all three of its clips.
  const specs = actions.filter((a): a is HearAction => a !== undefined).flatMap(actionSpecs);
  const clip = specs.length > 0 && specs.every((spec) => hasClipFor(spec));
  // `cantHear` is the page's one guidance-only "Can't hear it?" (AMENDMENTS-AUDIO-CANT-HEAR CH-1d, OD-CH3): the card prints
  // its Korean, so the sheet has no Show the letters, and "Always show the letters" brings nothing up here.
  const slot = usePromptSlot({ source: DISCOVER_AUDIO_SOURCE, hasClip: clip, textOnScreen: true, cantHear, guidanceOnly: cantHear });
  const { play } = slot;
  const { register } = audio;
  useEffect(() => register(key, { play }), [register, key, play]);
  return slot;
}

function HearButton({
  action,
  label,
  accessibilityLabel,
  size,
  pulse,
  tone,
  dispatch,
}: {
  action: HearAction;
  label: string;
  accessibilityLabel: string;
  size: 'md' | 'lg';
  pulse?: boolean;
  tone: 'secondary' | 'ghost';
  dispatch: (event: DiscoverEvent) => void;
}): ReactElement {
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(1);
  useEffect(() => {
    if (!pulse || reducedMotion) return;
    scale.value = withSequence(
      withTiming(1.06, { duration: motion.duration.slow }),
      withTiming(1, { duration: motion.duration.slow }),
    );
  }, [pulse, reducedMotion, scale]);
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={pulse && !reducedMotion ? pulseStyle : undefined}>
      <Button
        label={label}
        accessibilityLabel={accessibilityLabel}
        tone={tone}
        size={size}
        leading={<Icon name="speaker" size={spacing.xl} />}
        onPress={() => dispatch({ type: 'hear', id: action.id })}
        testID={`discover-hear-${action.id}`}
      />
    </Animated.View>
  );
}

function DiscoverItemCard({
  render,
  dispatch,
  copy,
  a11y,
  audio,
  bare = false,
  divided = false,
  cantHear = false,
}: {
  render: DiscoverItemRender;
  dispatch: (event: DiscoverEvent) => void;
  copy: DiscoverMessages;
  a11y: Messages['a11y'];
  audio: CardAudio;
  /** One of the compact card's two rows: no card of its own; everything a card shows, the picture smaller. */
  bare?: boolean;
  /** A row under another row: a thin line above it. */
  divided?: boolean;
  /** The page's one "Can't hear it?" link lives under this card's buttons. */
  cantHear?: boolean;
}): ReactElement {
  const { item } = render;
  const audioCopy = useMessages().learner.audio;
  const slot = useCardSlot(item.key, [item.hear, item.nameButton?.action, item.vowelsButton?.action, item.example?.hear], audio, cantHear);
  const example = item.example;
  // [RF] After a word card's reveal its button is gone: the screen reader's focus goes to the word.
  const wordRef = useRef<View | null>(null);
  const wasFolded = useRef(!render.romanizationShown);
  useEffect(() => {
    if (item.kind === 'word' && wasFolded.current && render.romanizationShown) focusForScreenReader(wordRef.current);
    wasFolded.current = !render.romanizationShown;
  }, [item.kind, render.romanizationShown]);
  // The gloss each picture is given below, so "is there a picture" matches what PictureArt draws.
  const itemGloss = item.gloss ?? item.glyph;
  const itemPicture = item.kind === 'word' && hasPicture(item.picture, itemGloss, PICTURE_CONTEXT);
  const examplePicture = example !== undefined && hasPicture(item.picture, example.gloss, PICTURE_CONTEXT);

  const body = (
    <View
      testID={bare ? `discover-item-${item.key}` : undefined}
      style={[
        { alignItems: 'center', gap: spacing.md },
        divided ? { borderTopWidth: borderWidth.thin, borderTopColor: colors.border.subtle, marginTop: spacing.md, paddingTop: spacing.md } : null,
      ]}
    >
      {render.heard ? <Pill tone="success" size="sm" label={copy.heard.pill} /> : null}

      {/* [RF] A word card folds its romanization like the example word, keeping the line's room so the reveal moves nothing; a
          letter card's own sound value is never folded. The name follows what is drawn; Hear it keeps the full one. */}
      <View ref={wordRef} focusable={item.kind === 'word'} {...(item.kind === 'word' ? { tabIndex: -1 } : {})}>
        <KoreanText
          ko={item.glyph}
          romanization={item.romanization}
          {...(item.gloss === undefined ? {} : { gloss: item.gloss })}
          size={item.kind === 'symbol' ? 'lg' : 'md'}
          romanizationShown={render.romanizationShown}
          romanizationReserved={!render.romanizationShown}
          accessibilityLabel={render.romanizationShown ? item.accessibilityLabel : (item.foldedAccessibilityLabel ?? item.accessibilityLabel)}
        />
      </View>
      {item.kind === 'word' && render.showReveal ? (
        <Button label={copy.showHowToSay.cta} tone="ghost" size="md" onPress={() => dispatch({ type: 'reveal', key: item.key })} testID={`discover-reveal-${item.key}`} />
      ) : null}
      {item.soundHint ? (
        <Body tone="secondary" align="center">
          {item.soundHint}
        </Body>
      ) : null}
      {item.note ? (
        <Body tone="secondary" align="center">
          {item.note}
        </Body>
      ) : null}
      {/* Decorative: the KoreanText line above already names the word (F-VOC-002 §3.7). */}
      {/* On the compact card each row keeps its picture, smaller, so the card only regroups the page (section 4.6). */}
      {itemPicture ? <PictureArt pictureRef={item.picture} gloss={itemGloss} size={bare ? touchTarget.min : touchTarget.hero} decorative testID={`discover-picture-${item.key}`} /> : null}

      <HearButton
        action={item.hear}
        label={copy.hearIt.cta}
        accessibilityLabel={a11y.hearItLabel(item.accessibilityLabel)}
        size="lg"
        tone="secondary"
        pulse={render.pulse}
        dispatch={dispatch}
      />

      {/* What Hear it says, with its romanization (SF-1, D2): the carrier line "na = ㄴ + ㅏ" on a consonant, the letter on ㅇ and a vowel; a final its closed syllable. */}
      {item.spokenLine ? (
        <View testID={`discover-spoken-${item.key}`}>
          <KoreanText
            ko={item.spokenLine.ko}
            romanization={item.spokenLine.romanization}
            size="sm"
            // The equation holds the lone ㄱ, which a Korean screen-reader voice would read as its name: say the syllable and its romanization only.
            {...(item.nameButton ? { accessibilityLabel: `${item.hear.spec.text}, ${item.spokenLine.romanization}` } : {})}
          />
        </View>
      ) : null}
      {item.finalLine ? (
        <Body tone="secondary" align="center" testID={`discover-final-line-${item.key}`}>
          {audioCopy.finalLine(item.finalLine.letter, item.finalLine.syllable)}
        </Body>
      ) : null}

      {item.nameButton ? (
        <View style={{ alignItems: 'center', gap: spacing.sm }}>
          <HearButton
            action={item.nameButton.action}
            label={copy.hearName.cta}
            accessibilityLabel={a11y.hearNameLabel(a11y.discoverLetter(item.romanization))}
            size="md"
            tone="ghost"
            dispatch={dispatch}
          />
          {/* The letter's name with its romanization is content, never inside the UI string. */}
          <View testID={`discover-name-${item.key}`}>
            <KoreanText ko={item.nameButton.ko} romanization={item.nameButton.romanization} size="sm" />
          </View>
        </View>
      ) : null}

      {item.vowelsButton ? (
        // [SF-3] The initial ㅇ's second button, in Hear the name's place and look (AMENDMENTS-DISCOVER-SOUND-FIRST §12.5).
        <View style={{ alignItems: 'center', gap: spacing.sm }}>
          <HearButton
            action={item.vowelsButton.action}
            label={copy.hearVowels.cta}
            accessibilityLabel={a11y.hearVowelsLabel(a11y.discoverLetter(item.romanization))}
            size="md"
            tone="ghost"
            dispatch={dispatch}
          />
          {/* The three carrier lines (a = ㅇ + ㅏ, in Hangul) are content; each reads its syllable only, never the lone ㅇ by its name. */}
          <View testID={`discover-vowels-${item.key}`} style={{ alignItems: 'center', gap: spacing.xs }}>
            {item.vowelsButton.lines.map((line) => (
              <KoreanText key={line.ko} ko={line.ko} romanization={line.romanization} size="sm" accessibilityLabel={line.accessibilityLabel} />
            ))}
          </View>
        </View>
      ) : null}

      {slot.cantHear ? (
        // Centred under the buttons, as Hear it above it.
        <View style={{ alignSelf: 'center' }}>
          <CantHear guidanceOnly round={item.key} active={slot.cantHearActive} onHear={() => dispatch({ type: 'hear', id: item.hear.id })} />
        </View>
      ) : null}

      {item.block ? (
        <View style={{ alignItems: 'center', gap: spacing.sm }}>
          <SyllableBlock
            vowel={item.block.vowel}
            hasFinal={item.block.hasFinal}
            highlight={item.block.highlight}
            parts={item.block.parts}
            size="sm"
            accessibilityLabel={`${item.batchimLine ?? ''} ${item.accessibilityLabel}`.trim()}
            testID={`discover-block-${item.key}`}
          />
          {item.batchimLine ? <Body tone="secondary" align="center">{item.batchimLine}</Body> : null}
        </View>
      ) : null}

      {render.sayLines.length > 0 ? (
        <View accessibilityLiveRegion="polite" style={{ alignItems: 'center' }}>
          {render.sayLines.map((line) => (
            <Body key={line} tone="secondary" align="center" weight="semibold">
              {line}
            </Body>
          ))}
        </View>
      ) : null}
      <View style={{ alignSelf: 'stretch' }}>
        <PromptPanel
          variant="status"
          view={slot.view}
          onAction={(action) => slot.act(action, () => audio.replay(item.key, item.hear.id))}
          onHelp={audio.onHelp}
          testID={`discover-sound-${item.key}`}
        />
      </View>

      {example ? (
        <View
          style={{
            alignSelf: 'stretch',
            alignItems: 'center',
            gap: spacing.sm,
            borderTopWidth: borderWidth.thin,
            borderTopColor: colors.border.subtle,
            paddingTop: spacing.md,
          }}
        >
          {example.blocks.length > 1 ? (
            <ExampleBlocks blocks={example.blocks} />
          ) : null}
          <KoreanText
            ko={example.ko}
            romanization={example.romanization}
            gloss={example.gloss}
            size="sm"
            romanizationShown={render.exampleRomanizationShown}
            onPress={() => dispatch({ type: 'hear', id: example.hear.id })}
            accessibilityLabel={exampleWordLabel(copy, a11y, example, render.exampleRomanizationShown)}
            testID={`discover-hear-${example.hear.id}`}
          />
          {/* Decorative: the example's KoreanText line already names it. */}
          {examplePicture ? (
            <PictureArt pictureRef={item.picture} gloss={example.gloss} size={touchTarget.hero} decorative />
          ) : null}
          {render.showReveal ? (
            <Button
              label={copy.showHowToSay.cta}
              tone="ghost"
              size="md"
              onPress={() => dispatch({ type: 'reveal', key: item.key })}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
  return bare ? (
    body
  ) : (
    <Card padding="lg" tone="paper" testID={`discover-item-${item.key}`}>
      {body}
    </Card>
  );
}

/** The example's syllable blocks, the one that holds the symbol lit. Decorative: the word itself is read by KoreanText. */
function ExampleBlocks({ blocks }: { blocks: Array<{ text: string; emphasised: boolean }> }): ReactElement {
  const textScale = useTypeScale();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ flexDirection: 'row', gap: spacing.sm }}
    >
      {blocks.map((block, i) => (
        <View
          // the same syllable can repeat in a word, so the index is part of the key
          key={`${block.text}-${i}`}
          style={{
            minWidth: touchTarget.min,
            minHeight: touchTarget.min,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: radii.lg,
            borderWidth: block.emphasised ? borderWidth.thick : borderWidth.base,
            borderColor: block.emphasised ? colors.brand.primary : colors.border.subtle,
            backgroundColor: block.emphasised ? colors.brand.primaryLight : colors.surface.paper,
          }}
        >
          <Text {...KOREAN_LINE_BREAK}
            style={{
              fontFamily: typography.family.sansKr,
              fontSize: textScale.size.display,
              fontWeight: block.emphasised ? typography.weight.bold : typography.weight.regular,
              color: colors.text.primary,
            }}
          >
            {block.text}
          </Text>
        </View>
      ))}
    </View>
  );
}

/**
 * An `exchange` item (D-1 S3): two lines between named speakers, each with its own speaker button,
 * and Read along, which plays the lines in order and lights each one while it plays. The highlight is
 * a thick start border, a tint, the arrow glyph and the words "Reading now": never colour alone, and
 * the line waiting next is never dimmed.
 */
const srOnly = { position: 'absolute', width: 1, height: 1, margin: -1, overflow: 'hidden' } as const;

function ExchangeCard({
  render,
  cantHear = false,
  dispatch,
  copy,
  m,
  scrollRef,
  audio,
}: {
  render: DiscoverExchangeRender;
  /** The page's one "Can't hear it?" link lives under Read along. */
  cantHear?: boolean;
  dispatch: (event: DiscoverEvent) => void;
  copy: DiscoverMessages;
  m: Messages;
  scrollRef: RefObject<ScrollView | null>;
  audio: CardAudio;
}): ReactElement {
  const ex = copy.exchange;
  const first = render.item.lines[0];
  // One slot for the exchange: Read along and each line's own speaker. When a line cannot play, its panel
  // says why (sound off, no Korean voice, a tap needed, a failure) with the one action; nothing stays lit.
  const slot = useCardSlot(render.item.key, render.item.lines.map((l) => l.hear), audio, cantHear);
  return (
    <View style={{ gap: spacing.md }} testID={`discover-exchange-${render.item.key}`}>
      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.md }}>
        <Button
          label={render.reading ? ex.stop.cta : ex.readAlong.cta}
          tone="secondary"
          size="md"
          {...(render.reading ? {} : { leading: <Icon name="play" size={spacing.xl} /> })}
          onPress={() => dispatch({ type: 'readAlong', item: render.item.key })}
          testID="discover-read-along"
        />
        {render.heard ? <Pill tone="success" size="sm" label={copy.heard.pill} /> : null}
      </View>
      {slot.cantHear ? (
        <View style={{ alignSelf: 'flex-start' }}>
          {/* The exchange's main control is Read along, so Hear it reads the exchange once, as that button does
              (while it is already being read, there is nothing to start: Read along would stop it). */}
          <CantHear guidanceOnly round={render.item.key} active={slot.cantHearActive} onHear={() => (render.reading ? undefined : dispatch({ type: 'readAlong', item: render.item.key }))} />
        </View>
      ) : null}
      <PromptPanel
        variant="status"
        view={slot.view}
        onAction={(action) => slot.act(action, () => audio.replay(render.item.key, first?.hear.id ?? ''))}
        onHelp={audio.onHelp}
        testID="discover-read-along-status"
      />
      {/* The lit line, said politely; visually hidden (the line card carries the visible cues). */}
      <Text {...KOREAN_LINE_BREAK} aria-live="polite" accessibilityLiveRegion="polite" style={srOnly} testID="discover-read-along-live">
        {render.liveLine ?? ''}
      </Text>
      {render.lines.map((r) => (
        <ExchangeLine key={r.line.key} render={r} dispatch={dispatch} copy={copy} a11y={m.a11y} scrollRef={scrollRef} />
      ))}
    </View>
  );
}

function ExchangeLine({
  render,
  dispatch,
  copy,
  a11y,
  scrollRef,
}: {
  render: DiscoverExchangeRender['lines'][number];
  dispatch: (event: DiscoverEvent) => void;
  copy: DiscoverMessages;
  a11y: Messages['a11y'];
  scrollRef: RefObject<ScrollView | null>;
}): ReactElement {
  const { line, lit } = render;
  const reducedMotion = useReducedMotion();
  const ref = useRef<View | null>(null);
  // A lit line that is off screen scrolls into view (instantly under reduced motion).
  useEffect(() => {
    if (!lit) return;
    const scroll = scrollRef.current;
    const inner = scroll?.getInnerViewNode?.();
    if (!scroll || !inner || !ref.current) return;
    try {
      ref.current.measureLayout(
        inner,
        (_x, y) => scroll.scrollTo({ y: Math.max(0, y - spacing.lg), animated: !reducedMotion }),
        () => undefined,
      );
    } catch {
      // Not measurable here: the line is still on the page.
    }
  }, [lit, reducedMotion, scrollRef]);
  const start = line.side === 'a';
  const portrait = (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: touchTarget.min,
        height: touchTarget.min,
        borderRadius: radii.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.surface.sunken,
      }}
    >
      <Icon name="profile" size={spacing.xl} />
    </View>
  );
  return (
    <View ref={ref}>
      <Card
        padding="md"
        tone={lit ? 'brand' : 'paper'}
        testID={`discover-line-${line.key}`}
        style={{
          borderWidth: borderWidth.base,
          borderStartWidth: lit ? borderWidth.thick : borderWidth.base,
          borderColor: lit ? colors.brand.primary : colors.border.subtle,
        }}
      >
        <View style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: start ? 'row' : 'row-reverse', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm }}>
            {portrait}
            {lit ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }} testID="discover-line-reading-now">
                <Icon name="arrow-right" size={spacing.lg} />
                <Pill tone="primary" size="sm" label={copy.exchange.readingNow.pill} />
              </View>
            ) : null}
            <Body weight="semibold">{line.speaker}</Body>
          </View>
          {/* The speaker button wraps under the line when the two do not fit side by side (320 px), so a
              Korean word never breaks inside itself (F-CURR-001 §3.14 layout). */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.md }}>
            <View style={{ flexGrow: 1, flexShrink: 1, minWidth: '60%', alignItems: 'flex-start' }}>
              <KoreanText
                ko={line.ko}
                romanization={line.romanization}
                gloss={line.gloss}
                size="md"
                romanizationShown={render.romanizationShown}
                accessibilityLabel={
                  render.romanizationShown ? line.accessibilityLabel : `${line.speaker}: ${line.ko}, ${line.gloss}`
                }
              />
            </View>
            <Button
              label={copy.hearIt.cta}
              accessibilityLabel={a11y.hearItLabel(line.accessibilityLabel)}
              tone="ghost"
              size="md"
              leading={<Icon name="speaker" size={spacing.xl} />}
              onPress={() => dispatch({ type: 'hear', id: line.hear.id })}
              testID={`discover-hear-${line.hear.id}`}
            />
          </View>
          {render.showReveal ? (
            <Button label={copy.showHowToSay.cta} tone="ghost" size="md" onPress={() => dispatch({ type: 'reveal', key: line.key })} />
          ) : null}
        </View>
      </Card>
    </View>
  );
}
