import {
  Body,
  Button,
  Caption,
  Heading,
  HoyaBubble,
  KoreanText,
  Pill,
  Progress,
  Screen,
  Spacer,
  borderWidth,
  colors,
  layout,
  radii,
  resolveColor,
  spacing,
  touchTarget,
  useLayoutClass,
} from '@hangul-route/design-system';
import type { HiddenHeritageScene } from '@hangul-route/design-system/src/scene-art/hidden-heritage/types';
import { HIDDEN_HERITAGE_RINGS } from '@hangul-route/design-system/src/scene-art/hidden-heritage/types';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { Pressable, View, type LayoutChangeEvent, type PressableStateCallbackType } from 'react-native';
import { PromptPanel } from '../../components/PromptPanel';
import { usePromptSlot } from '../../components/use-prompt-slot';
import { VoiceHelpSheet } from '../../components/VoiceHelpSheet';
import { useMessages } from '../../i18n/use-messages';
import { useRomanizationMode } from '../../i18n/use-romanization-mode';
import { koSpeech } from '../../logic/audio/ko-speech';
import {
  canSkip,
  endView,
  headerView,
  liveText,
  promptView,
  sceneLayout,
  showsHoya,
  slotViews,
  spotRect,
  spotViews,
  startFlow,
  stepFlow,
  validRounds,
  type FlowEffect,
  type FlowEvent,
  type FlowState,
  type RingKind,
  type SpotView,
} from '../../logic/hidden-heritage-flow';
import { picWordFallback } from '../../logic/hidden-heritage-fallback';
import type { MinigameScope } from '../../logic/minigame-config';
import { playPrompt, stop } from '../../platform/audio';
import { nudge, success, tapLight } from '../../platform/haptics';
import type { MinigameHost } from './host';
import { HiddenHeritageSceneArt } from './HiddenHeritageScene';
import { PicWordMatchGame } from './PicWordMatchGame';

/**
 * Hidden Heritage (F-CURR-002 §7.1 F7, row CM-36; design/wireframes/minigame/hidden-heritage.md, mock
 * design/screens/journey-topic-pages/mock/hidden-heritage.html): find the thing Hoya names in the scene. The rules live
 * in `logic/hidden-heritage-flow.ts`; this renders them and runs the effects. Every thing of the scene is a spot (a
 * button named by its meaning), in reading order, at least 48 dp; the word to find is Korean with its romanization,
 * heard and written, never an English label. Nothing moves: rings appear and clear without fading, so reduced motion
 * changes nothing. Under 256 dp of width the step plays Pic-Word Match on the same targets (`picWordFallback`).
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

type SpotState = PressableStateCallbackType & { focused?: boolean };

/** The ring tokens the scene profile checks every spot against (`HIDDEN_HERITAGE_RINGS`), so the two never differ. */
const ringColour: Record<RingKind, string> = {
  found: resolveColor(HIDDEN_HERITAGE_RINGS.found),
  miss: resolveColor(HIDDEN_HERITAGE_RINGS.miss),
  hint: resolveColor(HIDDEN_HERITAGE_RINGS.hint),
};
const CASING = resolveColor(HIDDEN_HERITAGE_RINGS.casing);

/** A ring at `borderWidth.thick` with a `text.primary` casing on both sides, so it reads on any fill. */
function Ring({ kind }: { kind: RingKind }): ReactElement {
  const inset = kind === 'hint' ? HINT_INSET : 0;
  const casing = { borderWidth: borderWidth.thin, borderColor: CASING, borderRadius: radii.md };
  return (
    <View pointerEvents="none" testID={`hh-ring-${kind}`} style={{ position: 'absolute', top: inset, left: inset, right: inset, bottom: inset, ...casing }}>
      <View style={{ flex: 1, borderWidth: borderWidth.thick, borderColor: ringColour[kind], borderStyle: kind === 'hint' ? 'dashed' : 'solid', borderRadius: radii.md }}>
        <View style={{ flex: 1, ...casing }} />
      </View>
    </View>
  );
}

function Spot({ view, sceneWidth, onTap }: { view: SpotView; sceneWidth: number; onTap: (id: string) => void }): ReactElement {
  const rect = spotRect(view.spot, sceneWidth);
  return (
    <Pressable
      testID={`hh-spot-${view.id}`}
      accessibilityRole="button"
      accessibilityLabel={view.label}
      onPress={() => onTap(view.id)}
      style={{ position: 'absolute', ...rect }}
    >
      {({ focused }: SpotState) => (
        <>
          {view.ring ? <Ring kind={view.ring} /> : null}
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
        </>
      )}
    </Pressable>
  );
}

export function HiddenHeritageGame({ scope, scenes, host, onBack }: Props): ReactElement {
  const rounds = useMemo(() => validRounds(scope).filter((r) => scenes.has(r.sceneId)), [scope, scenes]);
  const [seed] = useState(() => Math.floor(Math.random() * 0x7fffffff));
  const m = useMessages();
  const copy = m.learner.hiddenHeritage;
  const romanizationMode = useRomanizationMode();
  const { short, windowHeight } = useLayoutClass();
  const [contentWidth, setContentWidth] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const [state, setState] = useState<FlowState>(() => startFlow(rounds, seed));
  const stateRef = useRef(state);
  const hostRef = useRef(host);
  hostRef.current = host;
  const timers = useRef<{ clear: ReturnType<typeof setTimeout> | null; advance: ReturnType<typeof setTimeout> | null }>({ clear: null, advance: null });
  const dispatchRef = useRef<(e: FlowEvent) => void>(() => undefined);

  const slot = usePromptSlot({ source: AUDIO_SOURCE, textOnScreen: true });
  const { play: slotPlay } = slot;
  const say = useCallback(
    (targetId: string): void => {
      const target = rounds[stateRef.current.roundIdx]?.targets.find((t) => t.id === targetId);
      if (target) void slotPlay(() => playPrompt(koSpeech(target.word, 'word', AUDIO_SOURCE)));
    },
    [rounds, slotPlay],
  );

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
        case 'cancel-clear':
          if (timers.current.clear) clearTimeout(timers.current.clear);
          timers.current.clear = null;
          return;
        case 'schedule-clear':
          timers.current.clear = setTimeout(() => dispatchRef.current({ type: 'clear-flash' }), effect.ms);
          return;
        case 'schedule-advance':
          timers.current.advance = setTimeout(() => {
            setRevealed(false);
            dispatchRef.current({ type: 'advance' });
          }, effect.ms);
          return;
        case 'complete':
          hostRef.current.complete();
          return;
      }
    },
    [say],
  );

  const dispatch = useCallback(
    (event: FlowEvent): void => {
      const out = stepFlow(stateRef.current, event, rounds);
      stateRef.current = out.state;
      setState(out.state);
      out.effects.forEach(runEffect);
    },
    [rounds, runEffect],
  );
  dispatchRef.current = dispatch;

  useEffect(() => {
    dispatchRef.current({ type: 'start' });
    const t = timers.current;
    return () => {
      if (t.clear) clearTimeout(t.clear);
      if (t.advance) clearTimeout(t.advance);
      stop();
    };
  }, []);

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
  const fit =
    contentWidth === null
      ? undefined
      : sceneLayout({ contentWidth, maxWidth: layout.maxWidth.reading, short, heightForScene: windowHeight - SHORT_CHROME, columnMin: COLUMN_MIN, gap: spacing.lg });
  // Too narrow for a 256 dp scene (a split screen): the same targets as a Pic-Word Match board.
  if (fit === null) return <PicWordMatchGame scope={picWordFallback(scope)} host={host} onBack={onBack} />;

  const header = headerView(state, rounds, m.learner.minigame);
  const sceneView = (views: readonly SpotView[], tappable: boolean): ReactElement | null =>
    fit === undefined ? null : (
      <View
        testID="hh-scene"
        accessible={!tappable}
        accessibilityRole={tappable ? undefined : 'image'}
        accessibilityLabel={round.altEn}
        style={{ width: fit.sceneWidth, height: (fit.sceneWidth * 3) / 4, alignSelf: 'center', borderRadius: radii.lg, overflow: 'hidden' }}
      >
        <HiddenHeritageSceneArt scene={scene} width={fit.sceneWidth} />
        {views.map((v) =>
          tappable ? (
            <Spot key={v.id} view={v} sceneWidth={fit.sceneWidth} onTap={(id) => dispatch({ type: 'tap', id })} />
          ) : v.ring ? (
            <View key={v.id} pointerEvents="none" style={{ position: 'absolute', ...spotRect(v.spot, fit.sceneWidth) }}>
              <Ring kind={v.ring} />
            </View>
          ) : null,
        )}
      </View>
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
          {sceneView(spotViews(round, state, m.a11y.hiddenHeritage), false)}
          <Spacer size="md" />
          <View testID="hh-end" style={{ gap: spacing.sm }}>
            {endView(round).map((e) => (
              <View key={e.id} style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.md }}>
                <KoreanText ko={e.word.ko} romanization={e.word.romanization} size="sm" romanizationShown={romanizationMode === 'always'} />
                {e.meaning !== null ? <Body>{e.meaning}</Body> : null}
              </View>
            ))}
          </View>
          <Spacer size="lg" />
          <Button label={m.common.buttons.continue} tone="primary" size="lg" onPress={() => dispatch({ type: 'continue' })} testID="hh-continue" />
          <Spacer size="xl" />
        </View>
      </Screen>
    );
  }

  const prompt = promptView(round, state);
  const views = spotViews(round, state, m.a11y.hiddenHeritage);
  const hear = (): void => {
    setRevealed(true);
    dispatch({ type: 'hear' });
  };
  const promptBlock = (
    <View>
      <Caption tone="secondary">{copy.prompt}</Caption>
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
      <View accessibilityLiveRegion="polite">
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
  const hoya = (
    <View accessibilityLiveRegion="polite">
      {showsHoya(state) ? (
        <>
          <Spacer size="md" />
          <HoyaBubble tone="thinking" message={copy.again} />
        </>
      ) : null}
    </View>
  );
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
            <Spacer size="sm" />
            {panel}
            {hoya}
          </>
        )}
        <Spacer size="xl" />
      </View>
      <VoiceHelpSheet visible={helpOpen} onClose={() => setHelpOpen(false)} />
    </Screen>
  );
}
