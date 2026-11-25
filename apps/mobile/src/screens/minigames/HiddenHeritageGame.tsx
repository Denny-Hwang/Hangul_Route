import {
  Body,
  Button,
  Caption,
  Heading,
  HoyaBubble,
  Icon,
  KOREAN_LANGUAGE,
  KOREAN_LINE_BREAK,
  KoreanText,
  MARK_DISC,
  Pill,
  Progress,
  Screen,
  Spacer,
  TapBoard,
  TapScroller,
  TapTarget,
  borderWidth,
  colors,
  layout,
  radii,
  resolveColor,
  spacing,
  touchTarget,
  typography,
  useLayoutClass,
  useTypeScale,
} from '@hangul-route/design-system';
import type { HiddenHeritageSpot } from '@hangul-route/content-schema';
import type { HiddenHeritageScene } from '@hangul-route/design-system/src/scene-art/hidden-heritage/types';
import { HIDDEN_HERITAGE_RINGS } from '@hangul-route/design-system/src/scene-art/hidden-heritage/types';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { ScrollView, Text, View, type LayoutChangeEvent, type ViewProps } from 'react-native';
import { PromptPanel } from '../../components/PromptPanel';
import { usePromptSlot } from '../../components/use-prompt-slot';
import { useSoundPacing } from '../../components/use-sound-pacing';
import { VoiceHelpSheet } from '../../components/VoiceHelpSheet';
import { useLocale, useMessages } from '../../i18n/use-messages';
import { useRomanizationMode } from '../../i18n/use-romanization-mode';
import { afterMiss, afterRightAnswer, answerItem, lookHereLine } from '../../logic/answer-feedback';
import { koSpeech } from '../../logic/audio/ko-speech';
import { CONTENT_OVERLAYS } from '../../logic/content-locale';
import { sceneCardBack } from '../../logic/hidden-heritage-card-back';
import {
  askedId,
  canSkip,
  endView,
  headerView,
  HINT_AFTER_MISSES,
  liveText,
  meaningOf,
  MIN_SCENE_WIDTH,
  promptView,
  ringMarkOffset,
  sceneLayout,
  showsHoya,
  slotViews,
  spotHitRects,
  spotRect,
  spotViews,
  startFlow,
  stepFlow,
  thingName,
  validRounds,
  type FlowEffect,
  type FlowEvent,
  type FlowState,
  type RingKind,
  type SpotHitRect,
  type SpotView,
} from '../../logic/hidden-heritage-flow';
import { picWordFallback } from '../../logic/hidden-heritage-fallback';
import type { MinigameScope } from '../../logic/minigame-config';
import { playPrompt, stop } from '../../platform/audio';
import { nudge, success, tapLight } from '../../platform/haptics';
import { AnswerAnnouncer } from './answer-announcer';
import { MarkDisc } from './answer-marks';
import type { MinigameHost } from './host';
import { HiddenHeritageSceneArt } from './HiddenHeritageScene';
import { PicWordMatchGame } from './PicWordMatchGame';
import { useAnswerAnnouncement } from './use-answer-announcement';
import { useRoundNext } from './use-round-next';
import { useScrollViewScroller } from './use-scroll-view-scroller';

/**
 * Hidden Heritage (F-CURR-002 §7.1 F7, row CM-36; design/wireframes/minigame/hidden-heritage.md, mock
 * design/screens/journey-topic-pages/mock/hidden-heritage.html): find the thing Hoya names in the scene. The rules live
 * in `logic/hidden-heritage-flow.ts`; this renders them and runs the effects. Every thing of the scene is a spot (a
 * button named by its meaning), in reading order, at least 48 dp; the word to find is Korean with its romanization,
 * heard and written, never an English label. Nothing moves: rings appear and clear without fading, so reduced motion
 * changes nothing. Under 256 dp of width the step plays Pic-Word Match on the same targets (`picWordFallback`).
 *
 * Answer feedback (F-A11Y-001 row AF-4c; design/components/AnswerFeedback/spec.md D6, D9): the found ring shows `check`
 * and the miss ring `replay`, each on a disc on the ring's top-end corner moved in just far enough to stay whole inside the
 * scene (`ringMarkOffset`); look-here keeps its dashed ring inside the spot with no mark. A miss stays until the learner's
 * next tap that changes the board (no timer, OD-AF7) and the missed spot is inactive meanwhile. Each result is said once by
 * the answer announcer (a found word by its romanization and meaning, a miss by the thing tapped and "Look again"; the miss
 * that rings the answer adds the look-here line), never Hangul; the visible caption stays, its live region goes. After a
 * right tap the wait is the 1000 ms floor with a screen reader off, and with one on Next shows and waits for it (OD-AF9
 * (b)); the word's sound starts after the line and is dropped if Next came first.
 */

interface Props {
  scope: MinigameScope;
  scenes: ReadonlyMap<string, HiddenHeritageScene>;
  host: MinigameHost;
  onBack?: () => void;
}

/** The surface id of Hidden Heritage for the audio telemetry (F-AUDIO-004 §3.14). */
const AUDIO_SOURCE = 'hidden-heritage';
/** The prompt column beside the scene on a landscape phone: two found slots wide. */
const COLUMN_MIN = touchTarget.min * 2 + spacing.sm;
/** The window height the scene leaves to the shell header and the screen padding on a landscape phone. */
const SHORT_CHROME = touchTarget.min + spacing.xl * 2;
/** The look-here ring sits inside its spot, the focus outline outside it. */
const HINT_INSET = spacing.xs;
const FOCUS_OFFSET = spacing.xxs;

/** The ring tokens the scene profile checks every spot against (`HIDDEN_HERITAGE_RINGS`), so the two never differ. */
const ringColour: Record<RingKind, string> = {
  found: resolveColor(HIDDEN_HERITAGE_RINGS.found),
  miss: resolveColor(HIDDEN_HERITAGE_RINGS.miss),
  hint: resolveColor(HIDDEN_HERITAGE_RINGS.hint),
};
const CASING = resolveColor(HIDDEN_HERITAGE_RINGS.casing);

/**
 * A ring at `borderWidth.thick` with a `text.primary` casing on both sides, so it reads on any fill. A found or miss ring
 * carries its disc (`check`, `replay`) on its top-end corner, kept whole inside the scene (D6); look-here has no mark.
 */
function Ring({ kind, spot, sceneWidth }: { kind: RingKind; spot: HiddenHeritageSpot; sceneWidth: number }): ReactElement {
  const inset = kind === 'hint' ? HINT_INSET : 0;
  const casing = { borderWidth: borderWidth.thin, borderColor: CASING, borderRadius: radii.md };
  const disc = kind === 'hint' ? null : ringMarkOffset(spot, sceneWidth, MARK_DISC.size);
  return (
    <>
      <View pointerEvents="none" testID={`hh-ring-${kind}`} style={{ position: 'absolute', top: inset, left: inset, right: inset, bottom: inset, ...casing }}>
        <View style={{ flex: 1, borderWidth: borderWidth.thick, borderColor: ringColour[kind], borderStyle: kind === 'hint' ? 'dashed' : 'solid', borderRadius: radii.md }}>
          <View style={{ flex: 1, ...casing }} />
        </View>
      </View>
      {disc ? (
        <MarkDisc mark={kind === 'found' ? 'right' : 'miss'} place={disc} testID={`hh-ring-${kind}-mark`} />
      ) : null}
    </>
  );
}

/**
 * One thing of the scene: a `TapTarget` on its hit rectangle (`spotHitRects`, AMENDMENTS-TOUCH 6.6: at least 64 unless
 * boxed in), with the drawn spot inside it where the found, miss and look-here rings and the focus outline sit. While a
 * finger that will count is down, the press look is a ring on the hit rectangle (`border.shape`, `borderWidth.thick`, no
 * fill, so the scene stays visible); it is never a state ring.
 */
function Spot({ view, sceneWidth, hit, onTap }: { view: SpotView; sceneWidth: number; hit: SpotHitRect; onTap: (id: string) => void }): ReactElement {
  const rect = spotRect(view.spot, sceneWidth);
  const [focused, setFocused] = useState(false);
  return (
    <View
      style={{ position: 'absolute', left: hit.left, top: hit.top, width: hit.width, height: hit.height }}
      // Keyboard focus on the button inside (react-native-web's focus events bubble): the focus outline on the drawn spot.
      {...({ onFocus: () => setFocused(true), onBlur: () => setFocused(false) } as ViewProps)}
    >
      {/* The spot that shows its miss ring is locked, still focusable, never disabled (§3.1): a tap on it is not a second miss. */}
      <TapTarget testID={`hh-spot-${view.id}`} accessibilityLabel={view.label} inactive={view.ring === 'miss'} onCommit={() => onTap(view.id)} style={{ width: hit.width, height: hit.height }}>
        {({ pressed }) => (
          <>
            <View pointerEvents="none" style={{ position: 'absolute', left: rect.left - hit.left, top: rect.top - hit.top, width: rect.width, height: rect.height }}>
              {view.ring ? <Ring kind={view.ring} spot={view.spot} sceneWidth={sceneWidth} /> : null}
              {focused ? (
                <View
                  pointerEvents="none"
                  testID="hh-focus"
                  style={{
                    position: 'absolute',
                    top: -(FOCUS_OFFSET + borderWidth.thick),
                    left: -(FOCUS_OFFSET + borderWidth.thick),
                    right: -(FOCUS_OFFSET + borderWidth.thick),
                    bottom: -(FOCUS_OFFSET + borderWidth.thick),
                    borderWidth: borderWidth.thick,
                    borderColor: colors.border.focus,
                    borderRadius: radii.md,
                  }}
                />
              ) : null}
            </View>
            {pressed ? (
              <View
                pointerEvents="none"
                testID="hh-press"
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderWidth: borderWidth.thick, borderColor: colors.border.shape, borderRadius: radii.md }}
              />
            ) : null}
          </>
        )}
      </TapTarget>
    </View>
  );
}

// Speech language for the Korean of a source line; `lang` is forwarded to the DOM on the web.
const koreanSpeech = { accessibilityLanguage: KOREAN_LANGUAGE, lang: KOREAN_LANGUAGE };

/**
 * The scene's card back (F-CURR-002 §17 Phase 4, row CM-41 S2; wireframe "Facts on the card back"): under the found
 * words, Did you know? and every fact of the scene's note in the UI language, each with its source line (the card back's
 * citation: institution and title, never a URL). A named region a screen reader can jump to, as the reward step's tip.
 * Every Volume 2 placement of a scene shows it (rows CM-41 S2 and CM-42 S2).
 */
function SceneCardBack({ scene }: { scene: HiddenHeritageScene }): ReactElement | null {
  const m = useMessages();
  const locale = useLocale();
  const textScale = useTypeScale();
  const facts = useMemo(() => sceneCardBack(scene, locale, CONTENT_OVERLAYS, m.learner.cardDetail.citation), [scene, locale, m]);
  if (facts.length === 0) return null;
  const line = { fontSize: textScale.size.bodySm, lineHeight: textScale.size.bodySm * typography.leading.relaxed, color: colors.text.secondary };
  const source = {
    fontSize: textScale.size.caption,
    lineHeight: textScale.size.caption * typography.leading.normal,
    fontWeight: typography.weight.medium,
    color: colors.text.muted,
  };
  return (
    <View
      role="region"
      aria-label={m.learner.cultureTip.region}
      testID="hh-card-back"
      style={{ alignSelf: 'stretch', backgroundColor: colors.surface.sunken, borderRadius: radii.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, gap: spacing.sm }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
        <Icon name="sparkle" size={16} color={colors.brand.primary} />
        <Heading level="caption" testID="hh-card-back-title">
          {m.learner.cultureTip.title}
        </Heading>
      </View>
      {facts.map((fact) => (
        <View key={fact.id} testID={`hh-card-back-${fact.id}`} style={{ gap: spacing.xxs }}>
          <Text {...KOREAN_LINE_BREAK} testID={`hh-fact-${fact.id}-text`} style={line}>
            {fact.claim}
          </Text>
          {fact.citation ? (
            <Text {...KOREAN_LINE_BREAK} testID={`hh-fact-${fact.id}-source`} style={source}>
              {fact.citation.runs.map((run, i) => (
                <Text {...KOREAN_LINE_BREAK} key={i} {...(run.korean ? koreanSpeech : {})}>
                  {run.text}
                </Text>
              ))}
              {fact.citation.more ? ` ${fact.citation.more}` : ''}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

export function HiddenHeritageGame({ scope, scenes, host, onBack }: Props): ReactElement {
  const rounds = useMemo(() => validRounds(scope).filter((r) => scenes.has(r.sceneId)), [scope, scenes]);
  const fallbackScope = useMemo(() => picWordFallback(scope), [scope]);
  const [seed] = useState(() => Math.floor(Math.random() * 0x7fffffff));
  const m = useMessages();
  const copy = m.learner.hiddenHeritage;
  const romanizationMode = useRomanizationMode();
  const { short, windowHeight } = useLayoutClass();
  const [contentWidth, setContentWidth] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  // The latched scene is always wider than its window (it keeps 256 dp where the window has less).
  const sideways = useScrollViewScroller('x', true);

  const [state, setState] = useState<FlowState>(() => startFlow(rounds, seed));
  const stateRef = useRef(state);
  const hostRef = useRef(host);
  hostRef.current = host;
  const timers = useRef<{ advance: (() => void) | null }>({ advance: null });
  // [QS] AMENDMENTS-QUEST-SOUND-BACK QS-3, QS-4: the first word waits for the scene; the next word waits for the found one.
  const pacing = useSoundPacing();
  const dispatchRef = useRef<(e: FlowEvent) => void>(() => undefined);
  // F-A11Y-001 AF-4c: each result is said once by the answer announcer; with a screen reader on a right tap shows Next.
  const a = useAnswerAnnouncement();
  const { clear, focusPrompt } = a;
  const aRef = useRef(a);
  aRef.current = a;
  const nextButton = useRoundNext();
  const nextRef = useRef(nextButton);
  nextRef.current = nextButton;
  const mounted = useRef(true);
  /** Counts the words moved on from: a late wait, a second Next, or a sound that comes after the move does nothing. */
  const turn = useRef(0);
  const latest = useRef({ a11y: m.a11y, copy: m.learner.hiddenHeritage });
  latest.current = { a11y: m.a11y, copy: m.learner.hiddenHeritage };

  const slot = usePromptSlot({ source: AUDIO_SOURCE, textOnScreen: true });
  const { play: slotPlay } = slot;
  const say = useCallback(
    (targetId: string): void => {
      const target = rounds[stateRef.current.roundIdx]?.targets.find((t) => t.id === targetId);
      if (!target) return;
      const spec = koSpeech(target.word, 'word', AUDIO_SOURCE);
      void pacing.track(slotPlay(() => playPrompt(spec), spec));
    },
    [rounds, slotPlay, pacing],
  );

  /** The word moves on once: Next, or the wait that follows a right tap with the reader off. */
  const moveOn = useCallback((): void => {
    if (!mounted.current || stateRef.current.pending === null) return;
    turn.current += 1;
    nextRef.current.hide();
    setRevealed(false);
    dispatchRef.current({ type: 'advance' });
  }, []);

  const runEffect = useCallback(
    (effect: FlowEffect): void => {
      switch (effect.type) {
        case 'answer':
          hostRef.current.answer(effect.roundKey, effect.correct, { itemId: effect.itemId });
          return;
        case 'play':
          say(effect.targetId);
          return;
        case 'haptic':
          if (effect.kind === 'success') {
            tapLight();
            success();
          } else nudge();
          return;
        case 'cancel-advance':
          timers.current.advance?.();
          timers.current.advance = null;
          nextRef.current.hide();
          return;
        case 'schedule-advance':
          // The flow's delay is the least wait, lifted to the result floor by the caller; the found word is said to its end
          // first (QS-4).
          timers.current.advance = pacing.after(effect.ms, () => {
            timers.current.advance = null;
            moveOn();
          });
          return;
        case 'complete':
          hostRef.current.complete();
          return;
      }
    },
    [say, pacing, moveOn],
  );

  const dispatch = useCallback(
    (event: FlowEvent): void => {
      const before = stateRef.current;
      const out = stepFlow(before, event, rounds);
      stateRef.current = out.state;
      setState(out.state);
      const speak = aRef.current;
      const { a11y: texts, copy: words } = latest.current;
      const round = rounds[before.roundIdx];
      const thing = (id: string) => round?.targets.find((t) => t.id === id);
      if (event.type === 'tap' && round !== undefined) {
        const asked = askedId(before);
        const wait = out.effects.find((e) => e.type === 'schedule-advance');
        if (wait?.type === 'schedule-advance' && asked !== null) {
          // A found word: the line, the word's sound (after it, dropped if the word moved on), then the floor and the advance.
          const target = thing(asked);
          const sound = out.effects.find((e) => e.type === 'play');
          out.effects.filter((e) => e !== sound && e !== wait).forEach(runEffect);
          const at = turn.current;
          const item = target ? answerItem(texts, target.word.romanization, meaningOf(target.word) ?? undefined) : '';
          const say = (): Promise<void> => speak.announce({ kind: 'right', item });
          void afterRightAnswer({
            readerOn: speak.readerOn,
            gameMinMs: wait.ms,
            announce: speak.readerOn ? () => nextRef.current.afterFocus(say) : say,
            play: () => {
              if (turn.current !== at || !mounted.current) return;
              if (sound) runEffect(sound);
            },
            showNext: () => nextRef.current.show(),
            waitThenAdvance: (minMs) => runEffect({ type: 'schedule-advance', ms: minMs }),
          });
          return;
        }
        out.effects.forEach(runEffect);
        if (out.effects.some((e) => e.type === 'haptic' && e.kind === 'nudge')) {
          // The thing tapped, and "Look again"; the miss that rings the answer carries the look-here line instead (§3.2).
          const tappedThing = [...round.targets, ...round.others].find((t) => t.id === event.id);
          const item = tappedThing ? thingName(tappedThing.word) : '';
          const answer = asked === null ? undefined : thing(asked);
          const ringed = asked !== null && (out.state.misses[asked] ?? 0) >= HINT_AFTER_MISSES && (before.misses[asked] ?? 0) < HINT_AFTER_MISSES;
          const hint = ringed && answer ? lookHereLine(texts, answer.word.romanization) : words.again;
          afterMiss({ readerOn: speak.readerOn, announce: () => speak.announce({ kind: 'missHint', item, hint }) });
        }
        return;
      }
      out.effects.forEach(runEffect);
    },
    [rounds, runEffect],
  );
  dispatchRef.current = dispatch;

  useEffect(() => {
    mounted.current = true;
    const t = timers.current;
    return () => {
      mounted.current = false;
      t.advance?.();
      stop();
    };
  }, []);

  const measured =
    contentWidth === null
      ? undefined
      : sceneLayout({ contentWidth, maxWidth: layout.maxWidth.reading, short, heightForScene: windowHeight - SHORT_CHROME, columnMin: COLUMN_MIN, gap: spacing.lg });
  // The fit decision is latched once the learner has answered: a window that narrows after that (a split screen opens)
  // keeps the scene at its 256 dp floor, scrolled sideways, instead of a Pic-Word Match board that would score the same
  // targets a second time under its own keys. Before the first answer, a narrow window still plays the fallback.
  const latched = state.answered > 0 || state.status !== 'playing';
  const latchedNarrow = measured === null && latched;
  const fit = latchedNarrow ? ({ arrangement: 'stack', sceneWidth: MIN_SCENE_WIDTH } as const) : measured;
  // The first word is spoken once the scene is known to fit: never before the layout, and never when the step turns out
  // to be the Pic-Word Match fallback (that game speaks its own prompts). A step that later narrows into the fallback
  // stops this game's voice and timers, since this component stays mounted under it.
  const sceneFits = fit !== undefined && fit !== null;
  const narrowed = fit === null;
  const started = useRef(false);
  useEffect(() => {
    if (sceneFits && !started.current) {
      started.current = true;
      // [QS-3] The scene has just appeared: its first word waits for it. A tap on Hear it first plays at once.
      pacing.opening(() => dispatchRef.current({ type: 'start' }));
    } else if (narrowed && started.current) {
      timers.current.advance = null;
      pacing.dispose();
      stop();
    }
  }, [sceneFits, narrowed]);

  // A new word empties the announcer and, with a reader on, moves focus to the word's header node (§3.4).
  const wordKey = `${state.roundIdx}:${state.at}`;
  const firstWord = useRef(wordKey);
  useEffect(() => {
    clear();
    if (wordKey !== firstWord.current) focusPrompt();
  }, [wordKey, clear, focusPrompt]);

  const round = rounds[state.roundIdx];
  const scene = round ? scenes.get(round.sceneId) : undefined;
  if (state.status === 'empty' || !round || !scene) {
    return (
      <Screen>
        <Body>{m.learner.minigame.picWord.empty}</Body>
        {onBack ? (
          <>
            <Spacer size="lg" />
            <Button label={m.learner.minigame.backToQuest.cta} tone="secondary" size="md" onPress={onBack} />
          </>
        ) : null}
      </Screen>
    );
  }

  const measure = (e: LayoutChangeEvent): void => setContentWidth(Math.floor(e.nativeEvent.layout.width));
  // Too narrow for a 256 dp scene (a split screen): the same targets as a Pic-Word Match board.
  if (fit === null) return <PicWordMatchGame scope={fallbackScope} host={host} onBack={onBack} />;

  const header = headerView(state, rounds, m.learner.minigame);
  const sceneBox = (views: readonly SpotView[], tappable: boolean, width: number): ReactElement => {
    const hits = tappable ? spotHitRects(views.map((v) => v.spot), width, touchTarget.min) : [];
    return (
      <View
        testID="hh-scene"
        accessible={!tappable}
        accessibilityRole={tappable ? undefined : 'image'}
        accessibilityLabel={tappable ? undefined : round.altEn}
        style={{ width, height: (width * 3) / 4, alignSelf: 'center', borderRadius: radii.lg, overflow: 'hidden' }}
      >
        {tappable ? (
          // One board for the scene (AMENDMENTS-TOUCH 6.6, row KT-6): a graze still counts, a bounce never counts twice.
          <TapBoard lock="board">
            {/* While playing, the setting is still told first: the art is one image named by the alt text, before the spots. */}
            <View testID="hh-scene-art" accessible accessibilityRole="image" accessibilityLabel={round.altEn}>
              <HiddenHeritageSceneArt scene={scene} width={width} />
            </View>
            {views.map((v, i) => (
              <Spot key={v.id} view={v} sceneWidth={width} hit={hits[i]!} onTap={(id) => dispatch({ type: 'tap', id })} />
            ))}
          </TapBoard>
        ) : (
          <>
            <HiddenHeritageSceneArt scene={scene} width={width} />
            {views.map((v) =>
              v.ring ? (
                <View key={v.id} pointerEvents="none" style={{ position: 'absolute', ...spotRect(v.spot, width) }}>
                  <Ring kind={v.ring} spot={v.spot} sceneWidth={width} />
                </View>
              ) : null,
            )}
          </>
        )}
      </View>
    );
  };
  // In the narrow latch the scene scrolls sideways; its board drives that scroller (a sideways drag past 32 px).
  const sceneView = (views: readonly SpotView[], tappable: boolean): ReactElement | null =>
    fit === undefined ? null : latchedNarrow ? (
      <ScrollView horizontal testID="hh-scene-scroll" {...sideways.props}>
        <TapScroller scroller={sideways.scroller}>{sceneBox(views, tappable, fit.sceneWidth)}</TapScroller>
      </ScrollView>
    ) : (
      sceneBox(views, tappable, fit.sceneWidth)
    );

  const headerRow = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      <View style={{ flex: 1 }}>
        <Progress value={header.value} max={header.max} tone="primary" />
      </View>
      <Pill label={header.label} tone="neutral" size="sm" />
      {canSkip(state) ? <Button label={m.learner.minigame.skip.cta} tone="ghost" size="sm" onPress={() => dispatch({ type: 'skip' })} testID="hh-skip" /> : null}
    </View>
  );

  if (state.status === 'end' || state.status === 'done') {
    return (
      <Screen tone="canvas" scrollable>
        <View onLayout={measure}>
          {headerRow}
          <Spacer size="lg" />
          <Heading level="title">{copy.allFound}</Heading>
          <Spacer size="md" />
          {sceneView(spotViews(round, state, m.a11y.hiddenHeritage, m.a11y.minigame.option), false)}
          <Spacer size="md" />
          <View testID="hh-end" style={{ gap: spacing.sm }}>
            {endView(round).map((e) => (
              <View key={e.id} style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.md }}>
                <KoreanText ko={e.word.ko} romanization={e.word.romanization} size="sm" romanizationShown={romanizationMode === 'always'} />
                {e.meaning !== null ? <Body>{e.meaning}</Body> : null}
              </View>
            ))}
          </View>
          <Spacer size="md" />
          <SceneCardBack scene={scene} />
          <Spacer size="lg" />
          <Button label={m.common.buttons.continue} tone="primary" size="lg" onPress={() => dispatch({ type: 'continue' })} testID="hh-continue" />
          <Spacer size="xl" />
        </View>
      </Screen>
    );
  }

  const prompt = promptView(round, state);
  const views = spotViews(round, state, m.a11y.hiddenHeritage, m.a11y.minigame.option);
  const hear = (): void => {
    setRevealed(true);
    dispatch({ type: 'hear' });
  };
  const promptBlock = (
    <View>
      {/* The word's header node (§3.4): "Find this" and the word's romanization, never the Hangul; the word itself stays its own button. */}
      <View
        ref={a.promptRef}
        testID="hh-round"
        accessible
        accessibilityRole="header"
        accessibilityLabel={m.a11y.answer.round(Math.min(header.max, header.value + 1), header.max, [copy.prompt, prompt?.word.romanization].filter((part): part is string => part !== undefined).join(' '))}
      >
        <Caption tone="secondary">{copy.prompt}</Caption>
      </View>
      <Spacer size="xs" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.md }}>
        {prompt ? (
          <KoreanText
            ko={prompt.word.ko}
            romanization={prompt.word.romanization}
            gloss={prompt.meaning ?? undefined}
            size="md"
            romanizationShown={romanizationMode === 'always' || revealed}
            onPress={hear}
            accessibilityLabel={`${prompt.word.ko}, ${prompt.word.romanization}. ${m.a11y.minigame.hearAgain}`}
            testID="hh-prompt"
          />
        ) : null}
      </View>
      {/* The visible caption stays; the announcer says the result once, so it is not a live region too (§3.3). */}
      <View>
        <Caption tone="muted">{liveText(round, state, m.a11y.hiddenHeritage, copy)}</Caption>
      </View>
    </View>
  );
  const slots = (
    <View testID="hh-found" style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm }}>
      <Caption tone="secondary">{copy.found}</Caption>
      {slotViews(round, state).map((s) =>
        s.word ? (
          <View key={s.key} testID={`hh-${s.key}`} style={{ minWidth: touchTarget.min, padding: spacing.xs, borderRadius: radii.md, borderWidth: borderWidth.thin, borderColor: colors.border.subtle, backgroundColor: colors.surface.paper }}>
            <KoreanText ko={s.word.ko} romanization={s.word.romanization} size="sm" romanizationShown={romanizationMode === 'always'} />
          </View>
        ) : (
          <View
            key={s.key}
            testID={`hh-${s.key}`}
            accessible
            accessibilityLabel={m.a11y.hiddenHeritage.slotEmpty}
            style={{ width: touchTarget.min, height: touchTarget.min, borderRadius: radii.md, borderWidth: borderWidth.thin, borderColor: colors.border.subtle, backgroundColor: colors.surface.sunken }}
          />
        ),
      )}
    </View>
  );
  // Not a live region: the announcer says "Look again" once (§3.3).
  const hoya = (
    <View>
      {showsHoya(state) ? (
        <>
          <Spacer size="md" />
          <HoyaBubble tone="thinking" message={copy.again} live={false} />
        </>
      ) : null}
    </View>
  );
  // Next (a reader on): the word moves on once pressed (§3.4, OD-AF9 (b)); under the scene's found slots.
  const next = nextButton.shown ? (
    <Button pressableRef={nextButton.nextRef} label={m.learner.minigame.trace.next.cta} tone="primary" size="hero" fullWidth onPress={moveOn} testID="hh-next" />
  ) : null;
  const panel = (
    <PromptPanel
      variant="status"
      view={slot.view}
      onAction={(action) => slot.act(action, () => dispatch({ type: 'hear' }))}
      onHelp={() => setHelpOpen(true)}
      testID="hh-sound"
    />
  );

  return (
    <Screen tone="canvas" scrollable>
      <View onLayout={measure}>
        {headerRow}
        <Spacer size="md" />
        {fit?.arrangement === 'beside' ? (
          <View style={{ flexDirection: 'row', gap: spacing.lg }}>
            <View style={{ flex: 1, minWidth: COLUMN_MIN, gap: spacing.md }}>
              {promptBlock}
              {slots}
              {next}
              {panel}
              {hoya}
            </View>
            {sceneView(views, true)}
          </View>
        ) : (
          <>
            {promptBlock}
            <Spacer size="md" />
            {sceneView(views, true)}
            <Spacer size="md" />
            {slots}
            {next ? (
              <>
                <Spacer size="md" />
                {next}
              </>
            ) : null}
            <Spacer size="sm" />
            {panel}
            {hoya}
          </>
        )}
        <Spacer size="xl" />
      </View>
      <VoiceHelpSheet visible={helpOpen} onClose={() => setHelpOpen(false)} />
      <AnswerAnnouncer line={a.line} />
    </Screen>
  );
}
