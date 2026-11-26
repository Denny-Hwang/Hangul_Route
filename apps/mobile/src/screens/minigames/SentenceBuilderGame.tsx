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
  MARK_MIN,
  useTypeScale,
  TapBoard,
  TapTarget,
  pressInset,
  pressTransform,
  usePressLook,
  useTapLock,
} from '@hangul-route/design-system';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { Platform, Text, View, type TextStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';
import { PromptPanel } from '../../components/PromptPanel';
import { VoiceHelpSheet } from '../../components/VoiceHelpSheet';
import { usePromptSlot } from '../../components/use-prompt-slot';
import { useMessages } from '../../i18n/use-messages';
import { afterMiss, afterRightAnswer, answerItem, spokenParts } from '../../logic/answer-feedback';
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
  showSkip,
  trayView,
  widestTile,
  type LineUnitView,
  type NotePart,
  type TileView,
} from '../../logic/sentence-builder/view';
import { hasClipFor, playPrompt, stop, warmClips, type PlaySpec } from '../../platform/audio';
import { nudge, success, tapLight } from '../../platform/haptics';
import { useReducedMotion } from '../../platform/motion';
import { AnswerAnnouncer } from './answer-announcer';
import { DiscMark, LookHereRing } from './answer-marks';
import { holdsRomanization, hostSurface } from '../../logic/locale/check-hold';
import { HeldText } from './held-line';
import type { MinigameHost } from './host';
import { PictureArt } from './PictureArt';
import { useAnswerAnnouncement } from './use-answer-announcement';
import { useRoundNext } from './use-round-next';

/**
 * Sentence Builder (`order-it`, F-CURR-001 §3.4, §3.7, §3.11): read what the sentence means,
 * tap its Korean words in order, or pick the particle that fits. The rules live in
 * `logic/sentence-builder/` (rounds, reducer, scoring, view-models); this file renders them and
 * runs the effects. One component serves a practice step and, for a Stage 7 quest, the
 * two-question Check, through `host`. Stacked at every width (the line reads left to right
 * across one column). Design: design/wireframes/minigame/sentence-builder.md and
 * design/screens/minigame-sentence-builder/v1/.
 *
 * Answer feedback (F-A11Y-001 row AF-4c; design/components/AnswerFeedback/spec.md D2, D4, D9; OD-AF8 (c)): a tile tried
 * for a place keeps `dash` (it stays tappable, so it is not `replay`), now on a disc straddling its corner in
 * `text.primary`; a placed tile's check is 20; look-here is the one dashed ring outside the tile. Each result is said once
 * by the answer announcer (a placed tile as its place and romanization, a miss by the tile and Hoya's line with its
 * `{ko:}` read as romanization, never Hangul); the placed line, the built panel and the hint are not live. After the last
 * tile the wait is the 1000 ms floor and the sentence's sound with a screen reader off; with one on, Next shows and waits
 * for it (OD-AF9 (b)), the last round included, and the sentence's sound starts after the line.
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

/** What a round's sentence plays: its spoken Korean and its own recording, if any (AMENDMENTS-AUDIO-CLIPS AC-B7). */
function sentenceSpeech(sentence: SbRound['sentence']): PlaySpec {
  return { text: sentence.spokenKo ?? sentence.ko, audioRef: sentence.audioRef, kind: 'sentence', source: 'sentence-builder' };
}

const koreanSpeech = { accessibilityLanguage: 'ko', lang: 'ko' };
/** One tile is one word: on the web its Korean never breaks inside the word (§3.14, word-break keep-all); native Text keeps a spaceless word whole. */
const wholeWord = (Platform.OS === 'web' ? { whiteSpace: 'nowrap' } : {}) as unknown as TextStyle;

export function SentenceBuilderGame({ scope, host, patternNote, onBack }: Props): ReactElement {
  const textScale = useTypeScale();
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
  // The app-level `board` lock (AMENDMENTS-TOUCH 6.3, KT-D5): the tray's commits set it, the slide back extends it,
  // and Skip, outside the tray, waits on it.
  const tapLock = useTapLock();
  const tapLockRef = useRef(tapLock);
  tapLockRef.current = tapLock;
  const timers = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const mounted = useRef(true);
  const completed = useRef(false);
  const dispatchRef = useRef<(event: SbEvent) => void>(() => undefined);
  // F-A11Y-001 AF-4c: each result is said once by the answer announcer; with a screen reader on a built sentence shows Next.
  const speech = useAnswerAnnouncement();
  const { clear } = speech;
  const speechRef = useRef(speech);
  speechRef.current = speech;
  const nextButton = useRoundNext();
  const nextRef = useRef(nextButton);
  nextRef.current = nextButton;
  /** Counts the rounds moved on from: a late wait, a second Next, or a sound that comes after the move does nothing. */
  const turn = useRef(0);
  const patternRef = useRef(patternNote);
  patternRef.current = patternNote;
  const textRef = useRef({ a11y: m.a11y, copy });
  textRef.current = { a11y: m.a11y, copy };

  // The current round's sentence may have a bundled recording: then a missing Korean voice is not a missing sound (as Match Sound).
  const slotRound = rounds[state.roundIdx];
  const slot = usePromptSlot({ source: 'sentence-builder', hasClip: slotRound !== undefined && hasClipFor(sentenceSpeech(slotRound.sentence)), textOnScreen: true });
  const { play, reset } = slot;
  const [helpOpen, setHelpOpen] = useState(false);

  // Bundled sentence recordings start without a fetch (as Match Sound and Discover warm theirs).
  useEffect(() => {
    void warmClips(clipRefsOf(rounds.map((r) => sentenceSpeech(r.sentence))));
  }, [rounds]);

  const later = (ms: number, run: () => void): void => {
    timers.current.push(setTimeout(run, ms));
  };

  const hear = useCallback((): Promise<unknown> => {
    const round = roundsRef.current[stateRef.current.roundIdx];
    if (!round) return Promise.resolve();
    const { sentence } = round;
    return play(() => playPrompt(sentenceSpeech(sentence)));
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
        case 'schedule-settle': {
          const ms = reducedRef.current ? 0 : RETURN_MS;
          // No tile can be tapped while one slides back, so no press look shows on any, and Skip waits too.
          if (ms > 0) tapLockRef.current.lock(ms);
          later(ms, () => dispatchRef.current({ type: 'settle' }));
          return;
        }
        case 'play-sentence':
          // The built sentence is the right answer's own sound: `dispatch` runs it after the line (§3.4).
          return;
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

  /** The next round, or the end of the step: once, whether Next or the wait asks (a second press does nothing). */
  const moveOn = useCallback((): void => {
    if (!mounted.current || stateRef.current.status !== 'complete') return;
    turn.current += 1;
    nextRef.current.hide();
    dispatchRef.current({ type: 'advance' });
  }, []);

  const dispatch = useCallback(
    (event: SbEvent): void => {
      const before = stateRef.current;
      const out = stepFlow(before, roundsRef.current, event);
      stateRef.current = out.state;
      setState(out.state);
      const round = roundsRef.current[before.roundIdx];
      const tile = event.type === 'tap' && round ? round.tray.find((t) => t.id === event.tileId) : undefined;
      const { a11y: texts, copy: words } = textRef.current;
      const speak = speechRef.current;
      const finished = out.effects.some((e) => e.type === 'play-sentence');
      if (tile && round && finished) {
        // The last tile: the line, the sentence's sound (after it, dropped if the round moved on), then the floor and the advance.
        out.effects.forEach(runEffect);
        const at = turn.current;
        const place = round.open[before.placed.length];
        // The place and the word placed (a particle round's word is the stem and the piece: "chaegi", not "i").
        const placedWord = (place === undefined ? undefined : round.words[place]?.romanization) ?? tile.romanization;
        const say = (): Promise<void> =>
          speak.announce({ kind: 'right', item: texts.minigame.sentenceBuilder.slotFilled((place ?? 0) + 1, round.words.length, answerItem(texts, placedWord)) });
        let heard: Promise<void> = Promise.resolve();
        void afterRightAnswer({
          readerOn: speak.readerOn,
          gameMinMs: NO_SOUND_ADVANCE_MS,
          announce: speak.readerOn ? () => nextRef.current.afterFocus(say) : say,
          play: () => {
            if (turn.current !== at || !mounted.current) return;
            heard = hear().then(
              () => undefined,
              () => undefined,
            );
          },
          showNext: () => nextRef.current.show(),
          waitThenAdvance: (minMs) => {
            const pause = new Promise<void>((resolve) => later(minMs, resolve));
            void Promise.all([heard, pause]).then(() => {
              if (turn.current === at) moveOn();
            });
          },
        });
        return;
      }
      out.effects.forEach(runEffect);
      if (!tile || !round) return;
      if (out.effects.some((e) => e.type === 'haptic' && e.kind === 'nudge')) {
        // A miss: the tile tried, and Hoya's line (a particle miss adds the quest's note), `{ko:}` as romanization (§3.2).
        const hint = hintView(out.state, words, patternRef.current);
        const spoken = hint === null ? '' : [hint.line, hint.note ? spokenParts(hint.note) : ''].filter((x) => x !== '').join(' ');
        afterMiss({ readerOn: speak.readerOn, announce: () => speak.announce({ kind: 'missHint', item: tile.romanization, hint: spoken }) });
      } else if (before.placed.length < out.state.placed.length) {
        // A right tile that is not the last: its place and romanization.
        const place = round.open[before.placed.length];
        const placedWord = (place === undefined ? undefined : round.words[place]?.romanization) ?? tile.romanization;
        void speak.announce({ kind: 'right', item: texts.minigame.sentenceBuilder.slotFilled((place ?? 0) + 1, round.words.length, answerItem(texts, placedWord)) });
      }
    },
    [runEffect, hear, moveOn],
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
    clear();
  }, [roundIdx, reset, clear]);

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
  // A quest Check holds every tile's and word's romanization until the sentence is built (AMENDMENTS-STAGE1-DECODING-CHECK DC-1c).
  const ctx = { romanizationMode, hold: holdsRomanization(hostSurface(host.mode)) };
  const line = lineView(round, state, ctx, m.a11y.minigame);
  const tray = trayView(round, state, ctx, m.a11y.minigame);
  const hint = hintView(state, copy, patternNote);
  const done = doneView(round, state, copy);
  const widest = widestTile(round, ctx);
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
              style={{ fontSize: textScale.size.bodyLg, fontWeight: typography.weight.semibold, color: colors.text.primary, lineHeight: textScale.size.bodyLg * typography.leading.normal }}
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

      {/* A right tile landing is said once by the answer announcer, as its place and romanization (§3.3). */}
      <AnswerAnnouncer line={speech.line} testID="sentence-builder-live" />

      {done === null ? (
        <>
          <Spacer size="md" />
          <View style={{ borderTopWidth: borderWidth.base, borderStyle: 'dashed', borderColor: colors.border.subtle }} />
          <Spacer size="md" />
          <TapBoard lock="board">
            {/* The tray only is one board (AMENDMENTS-TOUCH 6.3): a graze still counts, and a bounce never taps the tile that slid under the finger (F5). */}
            <View testID="sentence-builder-tray" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
              {tray.map((tile) => (
                <TrayTile key={tile.id} tile={tile} tileMin={tileMin} reducedMotion={reducedMotion} onPress={() => dispatch({ type: 'tap', tileId: tile.id, at: Date.now() })} />
              ))}
            </View>
          </TapBoard>
        </>
      ) : (
        <>
          {/* Not a live region: the announcer says the result once (§3.3). */}
          <View testID="sentence-builder-done" style={{ gap: spacing.sm }}>
            <Spacer size="md" />
            <Body>{done.line}</Body>
            <View style={{ alignSelf: 'flex-start' }}>
              <KoreanText ko={done.sentence.ko} romanization={done.sentence.romanization} gloss={done.sentence.en} size="md" testID="sentence-builder-sentence" />
            </View>
          </View>
          {nextButton.shown ? (
            <>
              <Spacer size="lg" />
              <Button pressableRef={nextButton.nextRef} label={copy.trace.next.cta} tone="primary" size="hero" fullWidth onPress={moveOn} testID="sentence-builder-next" />
            </>
          ) : null}
        </>
      )}

      <View>
        {hint ? (
          <>
            <Spacer size="lg" />
            <HoyaBubble tone="thinking" message={hint.line} live={false} testID="sentence-builder-hint" />
            {hint.note ? <NoteLine parts={hint.note} /> : null}
          </>
        ) : null}
      </View>

      {showSkip(host.mode) && state.status !== 'done' ? (
        <>
          <Spacer size="xl" />
          <View style={{ alignSelf: 'flex-start' }}>
            {/* Outside the tray, Skip ignores a press while the app lock runs (a bounce off a tile, a slide back), with no visual change (F5). */}
            <Button label={copy.skip.cta} tone="ghost" size="md" onPress={() => (tapLock.locked ? undefined : dispatch({ type: 'skip' }))} testID="sentence-builder-skip" />
          </View>
        </>
      ) : null}
      <Spacer size="xl" />
    </Screen>
  );
}

/** The Korean of a tile (or a placed word) with its romanization line under it. */
function TileFace({ ko, romanization, held = '' }: { ko: string; romanization: string; /** The line a Check holds: its room is kept, nothing is drawn. */ held?: string }): ReactElement {
  const textScale = useTypeScale();
  return (
    <>
      <Text {...KOREAN_LINE_BREAK}
        {...koreanSpeech}
        style={{
          ...wholeWord,
          fontFamily: typography.family.sansKr,
          fontSize: textScale.size.prompt,
          fontWeight: typography.weight.bold,
          color: colors.text.primary,
          lineHeight: textScale.size.prompt * typography.leading.tight,
        }}
      >
        {ko}
      </Text>
      {romanization !== '' ? (
        <Text {...KOREAN_LINE_BREAK} style={{ fontSize: textScale.size.caption, color: colors.text.muted, fontWeight: typography.weight.medium }}>{romanization}</Text>
      ) : held !== '' ? (
        <HeldText size="caption" tone="muted" weight="medium" leading="none">{held}</HeldText>
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

/** A placed tile's check in its top corner (20, `MARK_MIN`: colour is never the only cue); its tile keeps 24 of end padding. */
function PlacedMark(): ReactElement {
  return (
    <View style={{ position: 'absolute', top: spacing.xs, right: spacing.xs }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Icon name="check" size={MARK_MIN} color={colors.feedback.successDark} />
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
function SlideIn({ reducedMotion, children }: { reducedMotion: boolean; children: ReactNode }): ReactElement {
  const offset = useSharedValue(reducedMotion ? 0 : RISE);
  useEffect(() => {
    offset.value = reducedMotion ? 0 : withTiming(0, { duration: SLIDE_MS, easing: EASE });
  }, [offset, reducedMotion]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: offset.value }] }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

function LineUnit({ unit, widest, tileMin, attachedMin, complete, reducedMotion }: LineUnitProps): ReactElement {
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
        <TileFace ko={unit.ko} romanization={unit.romanization} held={unit.heldRomanization} />
        {placed ? <PlacedMark /> : null}
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

function TrayTile({ tile, tileMin, reducedMotion, onPress }: { tile: TileView; tileMin: number; reducedMotion: boolean; onPress: () => void }): ReactElement {
  const press = usePressLook();
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
  // The wrapper keeps the room the look-here ring takes (a transparent frame, so nothing moves); the ring itself is the one
  // dashed look-here shape, drawn outside the tile (AnswerFeedback D4).
  return (
    <Animated.View
      testID={tile.look === 'ring' ? 'sentence-builder-ring' : tile.returning ? 'sentence-builder-returning' : undefined}
      style={[style, { padding: spacing.xs, margin: -spacing.xs, borderRadius: radii.lg, borderWidth: borderWidth.thick, borderColor: 'transparent' }]}
    >
      <TapTarget onCommit={onPress} accessibilityLabel={tile.accessibilityLabel} testID={`sentence-builder-tile-${tile.id}`}>
        {({ pressed }) => {
          // The press look (AMENDMENTS-TOUCH 4.3) on the drawn box, never a state look; the hit area keeps its size.
          const p = pressed ? press : null;
          return (
            <View
              style={{
                ...tileBox(tileMin),
                paddingVertical: spacing.sm - pressInset(p, borderWidth.base),
                paddingLeft: spacing.lg - pressInset(p, borderWidth.base),
                paddingRight: (tried ? spacing.xl : spacing.lg) - pressInset(p, borderWidth.base),
                borderWidth: p?.borderWidth ?? borderWidth.base,
                borderColor: p?.borderColor ?? (tried ? colors.feedback.nudge : colors.border.strong),
                backgroundColor: tried ? colors.feedback.nudgeLight : colors.surface.paper,
                transform: pressTransform(p),
              }}
            >
              <TileFace ko={tile.ko} romanization={tile.romanization} held={tile.heldRomanization} />
              {/* Tried here, still tappable (OD-AF8 (c)): `dash` on a disc straddling the corner, in `text.primary`. */}
              {tried ? <DiscMark mark="tried" answerBorder={p?.borderWidth ?? borderWidth.base} testID={`sentence-builder-tried-${tile.id}`} /> : null}
              {tile.look === 'ring' ? <LookHereRing radius={radii.md} answerBorder={p?.borderWidth ?? borderWidth.base} testID="sentence-builder-ring-dashed" /> : null}
            </View>
          );
        }}
      </TapTarget>
    </Animated.View>
  );
}

/**
 * The Discover note under a particle miss: one line of UI text in which each `{ko:}` token is taught
 * Korean (Hangul on a sunken chip) followed by its romanization, so the line wraps like a sentence.
 */
function NoteLine({ parts }: { parts: NotePart[] }): ReactElement {
  const textScale = useTypeScale();
  return (
    <Text {...KOREAN_LINE_BREAK}
      testID="sentence-builder-note"
      style={{ marginTop: spacing.sm, fontSize: textScale.size.bodySm, color: colors.text.secondary, lineHeight: textScale.size.bodySm * typography.leading.relaxed }}
    >
      {parts.map((part, i) =>
        'text' in part ? (
          <Text {...KOREAN_LINE_BREAK} key={i}>{part.text}</Text>
        ) : (
          <Text {...KOREAN_LINE_BREAK} key={i}>
            <Text {...KOREAN_LINE_BREAK} {...koreanSpeech} style={{ fontWeight: typography.weight.semibold, color: colors.text.primary, backgroundColor: colors.surface.sunken }}>
              {` ${part.ko} `}
            </Text>
            {part.romanization !== '' ? <Text {...KOREAN_LINE_BREAK} style={{ fontSize: textScale.size.caption }}>{` ${part.romanization}`}</Text> : null}
          </Text>
        ),
      )}
    </Text>
  );
}
