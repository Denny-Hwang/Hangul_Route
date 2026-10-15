import {
  Body,
  Button,
  Caption,
  Card,
  Heading,
  HoyaBubble,
  Icon,
  KoreanText,
  Pill,
  Progress,
  Screen,
  Spacer,
  borderWidth,
  colors,
  layout,
  motion,
  radii,
  spacing,
  touchTarget,
  typography,
  useLayoutClass,
  useMediaSize,
  KOREAN_LINE_BREAK,
} from '@hangul-route/design-system';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, Text, View, type TextStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';
import { PromptPanel } from '../../components/PromptPanel';
import { VoiceHelpSheet } from '../../components/VoiceHelpSheet';
import { usePromptSlot } from '../../components/use-prompt-slot';
import { useMessages } from '../../i18n/use-messages';
import { useRomanizationMode } from '../../i18n/use-romanization-mode';
import { clipRefsOf } from '../../logic/audio/clip-refs';
import { cubicBezierPoints } from '../../logic/flip';
import type { MinigameScope } from '../../logic/minigame-config';
import { buildRounds, type SbRound, type SbTile } from '../../logic/sentence-builder/progression';
import { startFlow, stepFlow, type SbEffect, type SbEvent, type SbState } from '../../logic/sentence-builder/reducer';
import {
  doneView,
  headerView,
  hintView,
  instructionOf,
  lineView,
  placedAnnouncement,
  showSkip,
  trayView,
  widestTile,
  type LineUnitView,
  type NotePart,
  type TileView,
} from '../../logic/sentence-builder/view';
import { hasClip, playPrompt, stop, warmClips } from '../../platform/audio';
import { nudge, success, tapLight } from '../../platform/haptics';
import { useReducedMotion } from '../../platform/motion';
import type { MinigameHost } from './host';
import { PictureArt } from './PictureArt';

/**
 * Sentence Builder (`order-it`, F-CURR-001 §3.4, §3.7, §3.11): read what the sentence means,
 * tap its Korean words in order, or pick the particle that fits. The rules live in
 * `logic/sentence-builder/` (rounds, reducer, scoring, view-models); this file renders them and
 * runs the effects. One component serves a practice step and, for a Stage 7 quest, the
 * two-question Check, through `host`. Stacked at every width (the line reads left to right
 * across one column). Design: design/wireframes/minigame/sentence-builder.md and
 * design/screens/minigame-sentence-builder/v1/.
 */

interface Props {
  scope: MinigameScope;
  host: MinigameHost;
  /** The quest's own Discover pattern note (`{ko:}` tokens), shown again under a particle miss. */
  patternNote?: string;
  /** Leave an empty scope (never a dead end). */
  onBack?: () => void;
}

/** The narrowest slot and tile: a one-syllable word plus padding (spec.md "Constants": touchTarget.child). */
const SLOT_MIN = touchTarget.child;
/** The attached particle slot shares its border with the stem before it (spec.md: -borderWidth.base). */
const ATTACHED_OVERLAP = -borderWidth.base;
/** How far a wrong tile rises toward the line before it slides back. */
const RISE = spacing.xl;
/**
 * Motion (spec.md "Constants"): a tile slides in `base`, a wrong tile waits `fast` before it slides
 * back; with no sound the next round opens `crawl` after the sentence is built.
 */
const SLIDE_MS = motion.duration.base;
const HOLD_MS = motion.duration.fast;
const RETURN_MS = SLIDE_MS + HOLD_MS + SLIDE_MS;
const NO_SOUND_ADVANCE_MS = motion.duration.crawl;
/** The motion.easing.standard token; `Easing.ease` only if the token ever stops being a cubic-bezier. */
const STANDARD = cubicBezierPoints(motion.easing.standard);
const EASE = STANDARD ? Easing.bezier(...STANDARD) : Easing.ease;
/** A pressed tile grows as the design system's `Tile` does (Tile.tsx); none under reduced motion. */
const PRESS_SCALE = 1.04;

const koreanSpeech = { accessibilityLanguage: 'ko', lang: 'ko' };
/** One tile is one word: on the web its Korean never breaks inside the word (§3.14, word-break keep-all); native Text keeps a spaceless word whole. */
const wholeWord = (Platform.OS === 'web' ? { whiteSpace: 'nowrap' } : {}) as unknown as TextStyle;
/** Read by assistive tech, not drawn (a 1 px clipped box), as NotePage's live line. */
const srOnly = { position: 'absolute', width: 1, height: 1, margin: -1, overflow: 'hidden' } as const;

export function SentenceBuilderGame({ scope, host, patternNote, onBack }: Props): React.ReactElement {
  const [seed] = useState(() => Math.floor(Math.random() * 0x7fffffff));
  const rounds = useMemo(() => buildRounds(scope.orderIt?.rounds, seed), [scope, seed]);
  const m = useMessages();
  const copy = m.learner.minigame;
  const romanizationMode = useRomanizationMode();
  const reducedMotion = useReducedMotion();
  const picture = useMediaSize(touchTarget.hero);
  const tileMin = useMediaSize(SLOT_MIN);
  const attachedMin = useMediaSize(touchTarget.min);
  // On a phone Hear it spans the meaning card; from the regular window up it keeps its own width (mock F).
  const wideHear = useLayoutClass().windowWidth < layout.breakpoint.regular;

  const [state, setState] = useState<SbState>(() => startFlow(rounds.length));
  const stateRef = useRef(state);
  const roundsRef = useRef(rounds);
  roundsRef.current = rounds;
  const hostRef = useRef(host);
  hostRef.current = host;
  const reducedRef = useRef(reducedMotion);
  reducedRef.current = reducedMotion;
  const timers = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const mounted = useRef(true);
  const completed = useRef(false);
  const dispatchRef = useRef<(event: SbEvent) => void>(() => undefined);

  // The current round's sentence may have a bundled recording: then a missing Korean voice is not a missing sound (as Match Sound).
  const slot = usePromptSlot({ source: 'sentence-builder', hasClip: hasClip(rounds[state.roundIdx]?.sentence.audioRef), textOnScreen: true });
  const { play, reset } = slot;
  const [helpOpen, setHelpOpen] = useState(false);

  // Bundled sentence recordings start without a fetch (as Match Sound and Discover warm theirs).
  useEffect(() => {
    void warmClips(clipRefsOf(rounds.map((r) => r.sentence)));
  }, [rounds]);

  const later = (ms: number, run: () => void): void => {
    timers.current.push(setTimeout(run, ms));
  };

  const hear = useCallback((): Promise<unknown> => {
    const round = roundsRef.current[stateRef.current.roundIdx];
    if (!round) return Promise.resolve();
    const { sentence } = round;
    return play(() => playPrompt({ text: sentence.spokenKo ?? sentence.ko, audioRef: sentence.audioRef, kind: 'sentence', source: 'sentence-builder' }));
  }, [play]);

  const runEffect = useCallback(
    (effect: SbEffect): void => {
      switch (effect.type) {
        case 'answer': {
          const round = roundsRef.current[effect.roundKey];
          hostRef.current.answer(effect.roundKey, effect.correct, round ? { itemId: round.id } : undefined);
          return;
        }
        case 'haptic':
          if (effect.kind === 'nudge') nudge();
          else {
            tapLight();
            if (effect.kind === 'success') success();
          }
          return;
        case 'schedule-settle':
          later(reducedRef.current ? 0 : RETURN_MS, () => dispatchRef.current({ type: 'settle' }));
          return;
        case 'play-sentence': {
          // The built sentence is heard once, in full; with no sound the next round opens after a short pause.
          const heard = hear().then(
            () => undefined,
            () => undefined,
          );
          const pause = new Promise<void>((resolve) => later(NO_SOUND_ADVANCE_MS, resolve));
          void Promise.all([heard, pause]).then(() => {
            if (mounted.current) dispatchRef.current({ type: 'advance' });
          });
          return;
        }
        case 'complete':
          // The flow emits it once; the guard keeps the host to one call whatever the timing.
          if (completed.current) return;
          completed.current = true;
          hostRef.current.complete();
          return;
      }
    },
    [hear],
  );

  const dispatch = useCallback(
    (event: SbEvent): void => {
      const out = stepFlow(stateRef.current, roundsRef.current, event);
      stateRef.current = out.state;
      setState(out.state);
      out.effects.forEach(runEffect);
    },
    [runEffect],
  );
  dispatchRef.current = dispatch;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      timers.current.forEach(clearTimeout);
      stop();
    };
  }, []);

  const roundIdx = state.roundIdx;
  useEffect(() => {
    reset();
  }, [roundIdx, reset]);

  const round = rounds[roundIdx];
  if (state.status === 'empty' || !round) {
    return (
      <Screen>
        <Body>{copy.sentenceBuilder.empty}</Body>
        {onBack ? (
          <>
            <Spacer size="lg" />
            <Button label={copy.backToQuest.cta} tone="secondary" size="md" onPress={onBack} />
          </>
        ) : null}
      </Screen>
    );
  }

  const header = headerView(host.mode, state, copy);
  const ctx = { romanizationMode };
  const line = lineView(round, state, ctx, m.a11y.minigame);
  const tray = trayView(round, state, ctx, m.a11y.minigame);
  const hint = hintView(state, copy, patternNote);
  const done = doneView(round, state, copy);
  const widest = widestTile(round, ctx);
  const announcement = placedAnnouncement(round, state, m.a11y.minigame);
  const gloss = round.sentence.en;

  return (
    <Screen tone="canvas">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          {header.kind === 'dots' ? (
            <Progress variant="dots" value={header.value} max={header.max} tone="primary" />
          ) : (
            <Progress value={header.value} max={header.max} tone="primary" />
          )}
        </View>
        {header.title ? <Pill label={header.title} tone="primary" size="sm" /> : null}
        {header.label ? <Pill label={header.label} tone="neutral" size="sm" /> : null}
      </View>

      <Spacer size="lg" />
      <Heading level="prompt">{copy.sentenceBuilder.heading}</Heading>
      <Body tone="secondary">{instructionOf(round, copy)}</Body>
      <Spacer size="lg" />

      <Card padding="lg" testID="sentence-builder-meaning">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.lg }}>
          {round.pictureRef !== undefined ? <PictureArt pictureRef={round.pictureRef} gloss={gloss} size={picture} decorative /> : null}
          <View style={{ flexGrow: 1, flexShrink: 1, flexBasis: touchTarget.hero, gap: spacing.xxs }}>
            <Caption tone="secondary">{copy.sentenceBuilder.meaning}</Caption>
            <Text {...KOREAN_LINE_BREAK}
              testID="sentence-builder-gloss"
              style={{ fontSize: typography.size.bodyLg, fontWeight: typography.weight.semibold, color: colors.text.primary, lineHeight: typography.size.bodyLg * typography.leading.normal }}
            >
              {gloss}
            </Text>
          </View>
        </View>
        <Spacer size="md" />
        <View style={wideHear ? undefined : { alignSelf: 'flex-start' }}>
          <Button
            label={m.learner.audio.hearIt.cta}
            tone="secondary"
            size="md"
            fullWidth={wideHear}
            leading={<Icon name="speaker" size={spacing.xl} color={colors.text.onSecondary} />}
            onPress={() => void hear()}
            testID="sentence-builder-hear"
          />
        </View>
      </Card>
      <Spacer size="sm" />
      <PromptPanel variant="status" view={slot.view} onAction={(action) => slot.act(action, () => void hear())} onHelp={() => setHelpOpen(true)} />
      <VoiceHelpSheet visible={helpOpen} onClose={() => setHelpOpen(false)} />

      <Spacer size="lg" />
      <View testID="sentence-builder-line" style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.md }}>
        {line.map((unit) => (
          <LineUnit key={unit.key} unit={unit} widest={widest} tileMin={tileMin} attachedMin={attachedMin} complete={done !== null} reducedMotion={reducedMotion} />
        ))}
        {done !== null ? <Icon name="check" size={spacing.xxl} color={colors.feedback.successDark} /> : null}
      </View>

      {/* A right tile landing is announced by its place (wireframe "States", screen reader). */}
      <Text {...KOREAN_LINE_BREAK} testID="sentence-builder-live" style={srOnly} accessibilityLiveRegion="polite" {...{ 'aria-live': 'polite' }}>
        {announcement}
      </Text>

      {done === null ? (
        <>
          <Spacer size="md" />
          <View style={{ borderTopWidth: borderWidth.base, borderStyle: 'dashed', borderColor: colors.border.subtle }} />
          <Spacer size="md" />
          <View testID="sentence-builder-tray" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
            {tray.map((tile) => (
              <TrayTile
                key={tile.id}
                tile={tile}
                tileMin={tileMin}
                reducedMotion={reducedMotion}
                onPress={() => dispatch({ type: 'tap', tileId: tile.id, at: Date.now() })}
              />
            ))}
          </View>
        </>
      ) : (
        <View accessibilityLiveRegion="polite" testID="sentence-builder-done" style={{ gap: spacing.sm }}>
          <Spacer size="md" />
          <Body>{done.line}</Body>
          <View style={{ alignSelf: 'flex-start' }}>
            <KoreanText ko={done.sentence.ko} romanization={done.sentence.romanization} gloss={done.sentence.en} size="md" testID="sentence-builder-sentence" />
          </View>
        </View>
      )}

      <View accessibilityLiveRegion="polite">
        {hint ? (
          <>
            <Spacer size="lg" />
            <HoyaBubble tone="thinking" message={hint.line} testID="sentence-builder-hint" />
            {hint.note ? <NoteLine parts={hint.note} /> : null}
          </>
        ) : null}
      </View>

      {showSkip(host.mode) && state.status !== 'done' ? (
        <>
          <Spacer size="xl" />
          <View style={{ alignSelf: 'flex-start' }}>
            <Button label={copy.skip.cta} tone="ghost" size="md" onPress={() => dispatch({ type: 'skip' })} testID="sentence-builder-skip" />
          </View>
        </>
      ) : null}
      <Spacer size="xl" />
    </Screen>
  );
}

/** The Korean of a tile (or a placed word) with its romanization line under it. */
function TileFace({ ko, romanization }: { ko: string; romanization: string }): React.ReactElement {
  return (
    <>
      <Text {...KOREAN_LINE_BREAK}
        {...koreanSpeech}
        style={{
          ...wholeWord,
          fontFamily: typography.family.sansKr,
          fontSize: typography.size.prompt,
          fontWeight: typography.weight.bold,
          color: colors.text.primary,
          lineHeight: typography.size.prompt * typography.leading.tight,
        }}
      >
        {ko}
      </Text>
      {romanization !== '' ? (
        <Text {...KOREAN_LINE_BREAK} style={{ fontSize: typography.size.caption, color: colors.text.muted, fontWeight: typography.weight.medium }}>{romanization}</Text>
      ) : null}
    </>
  );
}

const tileBox = (min: number) =>
  ({
    minWidth: min,
    minHeight: min,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    borderWidth: borderWidth.base,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxs,
  }) as const;

/** A small status glyph in the tile's top corner: colour is never the only cue. */
function Mark({ name, color }: { name: 'check' | 'dash'; color: string }): React.ReactElement {
  return (
    <View style={{ position: 'absolute', top: spacing.xs, right: spacing.xs }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Icon name={name} size={spacing.lg} color={color} />
    </View>
  );
}

interface LineUnitProps {
  unit: LineUnitView;
  widest: SbTile | undefined;
  tileMin: number;
  attachedMin: number;
  complete: boolean;
  reducedMotion: boolean;
}

/** A placed tile slides up from the tray into its place (`motion.duration.base`, `easing.standard`); reduced motion places it at once. */
function SlideIn({ reducedMotion, children }: { reducedMotion: boolean; children: React.ReactNode }): React.ReactElement {
  const offset = useSharedValue(reducedMotion ? 0 : RISE);
  useEffect(() => {
    offset.value = reducedMotion ? 0 : withTiming(0, { duration: SLIDE_MS, easing: EASE });
  }, [offset, reducedMotion]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: offset.value }] }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

function LineUnit({ unit, widest, tileMin, attachedMin, complete, reducedMotion }: LineUnitProps): React.ReactElement {
  if (unit.kind !== 'slot') {
    const placed = unit.kind === 'placed';
    const box = (
      <View
        accessible
        accessibilityLabel={unit.accessibilityLabel}
        testID={`sentence-builder-${unit.kind}`}
        style={{
          ...tileBox(tileMin),
          paddingRight: placed ? spacing.xl : spacing.lg,
          borderColor: placed || complete ? colors.feedback.success : colors.border.shape,
          backgroundColor: placed || complete ? colors.feedback.successLight : colors.surface.sunken,
        }}
      >
        <TileFace ko={unit.ko} romanization={unit.romanization} />
        {placed ? <Mark name="check" color={colors.feedback.successDark} /> : null}
      </View>
    );
    // Only a tile the learner placed slides in; a word a particle round gives stands still.
    return placed ? <SlideIn reducedMotion={reducedMotion}>{box}</SlideIn> : box;
  }
  const slotBox = (
    <View
      accessible
      accessibilityLabel={unit.accessibilityLabel}
      testID={unit.next ? 'sentence-builder-slot-next' : 'sentence-builder-slot'}
      style={{
        ...tileBox(unit.attached ? attachedMin : tileMin),
        borderStyle: 'dashed',
        borderColor: unit.next ? colors.border.focus : colors.border.shape,
        backgroundColor: colors.surface.paper,
        ...(unit.attached ? { marginLeft: ATTACHED_OVERLAP, borderTopLeftRadius: radii.none, borderBottomLeftRadius: radii.none } : {}),
      }}
    >
      {/* Every empty slot is as wide as the round's widest tile, so no width gives a tile away. */}
      {widest && !unit.attached ? (
        <View style={{ opacity: 0, alignItems: 'center', gap: spacing.xxs }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <TileFace ko={widest.ko} romanization={widest.romanization} />
        </View>
      ) : null}
    </View>
  );
  if (!unit.attached || unit.stem === undefined) return slotBox;
  return (
    <View style={{ flexDirection: 'row' }}>
      <View
        accessible
        accessibilityLabel={unit.stem}
        {...koreanSpeech}
        testID="sentence-builder-stem"
        style={{
          ...tileBox(tileMin),
          borderColor: colors.border.shape,
          backgroundColor: colors.surface.sunken,
          borderTopRightRadius: radii.none,
          borderBottomRightRadius: radii.none,
        }}
      >
        <TileFace ko={unit.stem} romanization="" />
      </View>
      {slotBox}
    </View>
  );
}

function TrayTile({ tile, tileMin, reducedMotion, onPress }: { tile: TileView; tileMin: number; reducedMotion: boolean; onPress: () => void }): React.ReactElement {
  const rise = useSharedValue(0);
  useEffect(() => {
    if (!tile.returning || reducedMotion) return;
    // Slides toward the line, waits, slides back; reduced motion keeps it in place.
    rise.value = withSequence(
      withTiming(-RISE, { duration: SLIDE_MS, easing: EASE }),
      withDelay(HOLD_MS, withTiming(0, { duration: SLIDE_MS, easing: EASE })),
    );
  }, [tile.returning, reducedMotion, rise]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: rise.value }] }));
  const tried = tile.look === 'tried';
  // The look-here ring: a focus-coloured frame around the tile (a transparent one otherwise, so nothing moves).
  return (
    <Animated.View
      testID={tile.look === 'ring' ? 'sentence-builder-ring' : tile.returning ? 'sentence-builder-returning' : undefined}
      style={[
        style,
        { padding: spacing.xs, margin: -spacing.xs, borderRadius: radii.lg, borderWidth: borderWidth.thick, borderColor: tile.look === 'ring' ? colors.border.focus : 'transparent' },
      ]}
    >
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={tile.accessibilityLabel}
        testID={`sentence-builder-tile-${tile.id}`}
        hitSlop={spacing.xs}
        style={({ pressed }) => ({
          ...tileBox(tileMin),
          paddingRight: tried ? spacing.xl : spacing.lg,
          borderColor: tried ? colors.feedback.nudge : colors.border.strong,
          backgroundColor: tried ? colors.feedback.nudgeLight : colors.surface.paper,
          transform: [{ scale: pressed && !reducedMotion ? PRESS_SCALE : 1 }],
        })}
      >
        <TileFace ko={tile.ko} romanization={tile.romanization} />
        {tried ? <Mark name="dash" color={colors.text.secondary} /> : null}
      </Pressable>
    </Animated.View>
  );
}

/**
 * The Discover note under a particle miss: one line of UI text in which each `{ko:}` token is taught
 * Korean (Hangul on a sunken chip) followed by its romanization, so the line wraps like a sentence.
 */
function NoteLine({ parts }: { parts: NotePart[] }): React.ReactElement {
  return (
    <Text {...KOREAN_LINE_BREAK}
      testID="sentence-builder-note"
      style={{ marginTop: spacing.sm, fontSize: typography.size.bodySm, color: colors.text.secondary, lineHeight: typography.size.bodySm * typography.leading.relaxed }}
    >
      {parts.map((part, i) =>
        'text' in part ? (
          <Text {...KOREAN_LINE_BREAK} key={i}>{part.text}</Text>
        ) : (
          <Text {...KOREAN_LINE_BREAK} key={i}>
            <Text {...KOREAN_LINE_BREAK} {...koreanSpeech} style={{ fontWeight: typography.weight.semibold, color: colors.text.primary, backgroundColor: colors.surface.sunken }}>
              {` ${part.ko} `}
            </Text>
            {part.romanization !== '' ? <Text {...KOREAN_LINE_BREAK} style={{ fontSize: typography.size.caption }}>{` ${part.romanization}`}</Text> : null}
          </Text>
        ),
      )}
    </Text>
  );
}
