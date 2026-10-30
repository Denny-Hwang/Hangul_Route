import type { MatchShapeRound } from '@hangul-route/content-schema';
import {
  Body,
  Button,
  Caption,
  HoyaBubble,
  Icon,
  KOREAN_LANGUAGE,
  KOREAN_LINE_BREAK,
  borderWidth,
  colors,
  motion,
  radii,
  shadows,
  spacing,
  touchTarget,
  typography,
  useLayoutClass,
  useMediaSize,
  useTypeScale,
} from '@hangul-route/design-system';
import { ShapeOriginArt } from '@hangul-route/design-system/src/components/ShapeOriginArt/ShapeOriginArt';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { Pressable, Text, View } from 'react-native';
import { PromptPanel } from '../../components/PromptPanel';
import { VoiceHelpSheet } from '../../components/VoiceHelpSheet';
import { usePromptSlot } from '../../components/use-prompt-slot';
import { findJamo } from '../../content/jamo';
import { useMessages } from '../../i18n/use-messages';
import { koTokenParts } from '../../logic/ko-tokens';
import type { ShapeSource } from '../../logic/match-shape/facts';
import { shapeHoyaLine, startShape, stepShape, type ShapeEffect, type ShapeEvent, type ShapeState } from '../../logic/match-shape/flow';
import { originTiles, pairHeading, pairTiles, type ShapeTileLook } from '../../logic/match-shape/view';
import { TRACE_CANVAS_MIN } from '../../logic/trace-layout';
import { playJamo, stop } from '../../platform/audio';
import { nudge, success, tapLight } from '../../platform/haptics';

/**
 * One Match Shape round (F-CURR-002 section 7.1 F4, row CM-33; design/wireframes/minigame/match-shape.md, the mock
 * design/screens/minigame-variety/mock/match-shape.html and D6 of its README). The behaviour is
 * `logic/match-shape/flow.ts`; this file draws it and runs its effects. It serves a quest step (`MatchShapeGame`) and a
 * review round at the produce rung (`ShapeRoundView`).
 *
 * - **Origin**: the picture card (the drawn picture, facing left, and the sourced line), then three letter tiles a
 *   third of the column wide. The right tile shows the letter beside the picture, says its sound, and the round waits
 *   for Continue, never a timer. "Where this comes from" expands the sources in place, plain text, never a link.
 * - **Pair**: six letter-only tiles, 3 x 2, at `touchTarget.hero` tall where the window allows; a found tile shows its
 *   sound and the check; after the last copy the round moves on by itself.
 * - A miss is amber with the mark, never red; Hoya's line and the status panel are polite live regions.
 * - Reduced motion: nothing moves; the pause after a pair round stays, so its sound is not cut off.
 */

/** How long a found pair stays on screen, with its sound, before the next round. */
export const PAIR_SOLVED_PAUSE_MS = motion.duration.celebration;

export interface MatchShapeBoardProps {
  /** The round, its lines in the UI language. */
  round: MatchShapeRound;
  /** An origin round's sources ("Where this comes from"). */
  sources?: readonly ShapeSource[];
  /** The first answer: the scored one. */
  onFirst: (correct: boolean) => void;
  /** The round is over: on to the next. */
  onSolved: () => void;
  /** The surface id for the sound notice's telemetry (`audio.fallback_shown`). */
  source: string;
  testID?: string;
}

const MARK = spacing.md;
const koreanSpeech = { accessibilityLanguage: KOREAN_LANGUAGE, lang: KOREAN_LANGUAGE };
/** A jamo face is part of its tile's picture: half the tile, so it keeps its size at every text setting. */
const JAMO_FACE = 0.5;

function Mark({ look }: { look: ShapeTileLook }): ReactElement | null {
  if (look === 'found') {
    return (
      <View style={{ position: 'absolute', top: spacing.xxs, right: spacing.xxs }}>
        <Icon name="check" size={MARK + spacing.xs} color={colors.feedback.success} />
      </View>
    );
  }
  if (look !== 'marked') return null;
  return (
    <View
      style={{
        position: 'absolute',
        top: spacing.xxs,
        right: spacing.xxs,
        width: MARK,
        height: MARK,
        borderRadius: radii.circle,
        backgroundColor: colors.feedback.nudge,
        borderWidth: borderWidth.thin,
        borderColor: colors.text.primary,
      }}
    />
  );
}

const TILE_LOOK: Record<ShapeTileLook, { backgroundColor: string; borderColor: string; borderWidth: number }> = {
  plain: { backgroundColor: colors.surface.paper, borderColor: colors.border.subtle, borderWidth: borderWidth.base },
  found: { backgroundColor: colors.feedback.successLight, borderColor: colors.feedback.success, borderWidth: borderWidth.thick },
  marked: { backgroundColor: colors.feedback.nudgeLight, borderColor: colors.feedback.nudge, borderWidth: borderWidth.thick },
  ring: { backgroundColor: colors.surface.paper, borderColor: colors.border.focus, borderWidth: borderWidth.thick },
};

/** A `{ko:}` note: its UI text, its letters drawn as Korean (the voice says them in Korean). */
function TokenLine({ note, testID }: { note: string; testID?: string }): ReactElement {
  const scale = useTypeScale().size;
  return (
    <Text {...KOREAN_LINE_BREAK} testID={testID} style={{ fontSize: scale.body, color: colors.text.primary }}>
      {koTokenParts(note).map((part, i) =>
        'text' in part ? (
          <Text {...KOREAN_LINE_BREAK} key={i}>{part.text}</Text>
        ) : (
          <Text {...KOREAN_LINE_BREAK} key={i} {...koreanSpeech} style={{ fontFamily: typography.family.sansKr, fontWeight: typography.weight.bold }}>
            {part.ko}
          </Text>
        ),
      )}
    </Text>
  );
}

export function MatchShapeBoard({ round, sources = [], onFirst, onSolved, source, testID = 'match-shape' }: MatchShapeBoardProps): ReactElement {
  const m = useMessages();
  const copy = m.learner.minigame.matchShape;
  const a11y = m.a11y.minigame.matchShape;
  const scale = useTypeScale().size;
  const wide = useLayoutClass().width !== 'compact';
  const tileTall = useMediaSize(touchTarget.min) > touchTarget.min ? touchTarget.hero : touchTarget.min;
  const pairTall = useMediaSize(touchTarget.hero);
  const target = findJamo(round.target);

  const slot = usePromptSlot({ source, hasClip: target?.audioRef !== undefined, reportFallback: true });
  const { play: slotPlay } = slot;
  const [helpOpen, setHelpOpen] = useState(false);
  const [state, setState] = useState<ShapeState>(() => startShape(round));
  const stateRef = useRef(state);
  const solvedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handlers = useRef({ onFirst, onSolved });
  handlers.current = { onFirst, onSolved };

  const say = useCallback((): void => {
    // Said by its name (giyeok, nieun, ieung), every letter alike, never a carrier syllable (na, ba): the tiles name letters,
    // and a lone letter's carrier syllable is the confusion of the owner's audio report of 2026-10-29.
    if (target) void slotPlay(() => playJamo(target, 'name'));
  }, [slotPlay, target]);

  const run = useCallback(
    (effect: ShapeEffect): void => {
      switch (effect.type) {
        case 'answer':
          handlers.current.onFirst(effect.correct);
          return;
        case 'play':
          say();
          return;
        case 'haptic':
          if (effect.kind === 'success') {
            tapLight();
            success();
          } else nudge();
          return;
        case 'solved':
          // A pair moves on by itself after the pause; an origin round's Continue is the learner's own tap.
          if (round.shape === 'pair') solvedTimer.current = setTimeout(() => handlers.current.onSolved(), PAIR_SOLVED_PAUSE_MS);
          else handlers.current.onSolved();
          return;
      }
    },
    [say, round.shape],
  );

  const dispatch = useCallback(
    (event: ShapeEvent): void => {
      const out = stepShape(stateRef.current, event, round);
      stateRef.current = out.state;
      setState(out.state);
      out.effects.forEach(run);
    },
    [round, run],
  );

  useEffect(
    () => () => {
      if (solvedTimer.current) clearTimeout(solvedTimer.current);
      stop();
    },
    [],
  );

  const found = state.status === 'found';
  const line = shapeHoyaLine(state);
  const status = found ? <PromptPanel variant="status" view={slot.view} onAction={(action) => slot.act(action, say)} onHelp={() => setHelpOpen(true)} testID={`${testID}-prompt`} /> : null;
  const hoya =
    line === null ? null : (
      <HoyaBubble
        testID={`${testID}-hoya`}
        tone={line === 'found' ? 'cheering' : 'thinking'}
        message={line === 'found' ? copy.found : line === 'missOrigin' ? copy.missOrigin : copy.missPair}
      />
    );

  if (round.shape === 'pair' && state.shape === 'pair') {
    const tiles = pairTiles(round, state, a11y);
    const heading = pairHeading(round, a11y);
    return (
      <View testID={testID} style={{ gap: spacing.md }}>
        <View accessible accessibilityRole="header" accessibilityLabel={heading.accessibilityLabel} testID={`${testID}-heading`} style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: spacing.sm }}>
          <Text {...KOREAN_LINE_BREAK} style={{ fontSize: scale.prompt, fontWeight: typography.weight.bold, color: colors.text.primary }}>{copy.heading.pair}</Text>
          <Text {...KOREAN_LINE_BREAK} {...koreanSpeech} style={{ fontFamily: typography.family.sansKr, fontSize: scale.prompt, fontWeight: typography.weight.bold, color: colors.text.primary }}>
            {heading.char}
          </Text>
          <Text {...KOREAN_LINE_BREAK} style={{ fontSize: scale.body, color: colors.text.secondary, fontWeight: typography.weight.semibold }}>{heading.sound}</Text>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {tiles.map((t) => (
            <Pressable
              key={t.index}
              testID={`${testID}-tile-${t.index}`}
              accessibilityRole="button"
              accessibilityLabel={t.accessibilityLabel}
              accessibilityState={{ selected: t.look === 'found', disabled: found || t.look === 'found' || t.look === 'marked' }}
              disabled={found || t.look === 'found' || t.look === 'marked'}
              onPress={() => dispatch({ type: 'tap-tile', index: t.index })}
              style={{
                flexBasis: '30%',
                flexGrow: 1,
                minHeight: Math.max(touchTarget.min, pairTall),
                borderRadius: radii.lg,
                alignItems: 'center',
                justifyContent: 'center',
                ...TILE_LOOK[t.look],
              }}
            >
              <Text {...KOREAN_LINE_BREAK} {...koreanSpeech} style={{ fontSize: Math.round(JAMO_FACE * Math.max(touchTarget.min, pairTall)), fontWeight: typography.weight.bold, color: colors.text.primary }}>
                {t.char}
              </Text>
              {t.sound !== null ? <Caption>{t.sound}</Caption> : null}
              <Mark look={t.look} />
            </Pressable>
          ))}
        </View>
        {status}
        {helpOpen ? <VoiceHelpSheet visible onClose={() => setHelpOpen(false)} /> : null}
        <View accessibilityLiveRegion="polite" style={{ minHeight: touchTarget.min, gap: spacing.sm }}>
          {hoya}
          {line === 'missPair' ? <TokenLine note={round.diffNoteEn} testID={`${testID}-diff`} /> : null}
        </View>
      </View>
    );
  }

  if (round.shape !== 'origin' || state.shape !== 'origin') return <View testID={testID} />;
  const tiles = originTiles(round, state, a11y);
  const artWidth = wide ? 2 * TRACE_CANVAS_MIN : (TRACE_CANVAS_MIN * 5) / 4;
  const letter = tiles.find((t) => t.id === round.target);
  return (
    <View testID={testID} style={{ gap: spacing.md }}>
      <View
        testID={`${testID}-card`}
        style={{
          backgroundColor: colors.surface.paper,
          borderColor: colors.border.subtle,
          borderWidth: borderWidth.thin,
          borderRadius: radii.lg,
          padding: spacing.lg,
          gap: spacing.md,
          ...shadows.card,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.lg, flexWrap: 'wrap' }}>
          <ShapeOriginArt refId={round.picture} width={artWidth} accessibilityLabel={round.noteEn} testID={`${testID}-art`} />
          {found && letter ? (
            <View testID={`${testID}-letter`} accessible accessibilityLabel={letter.accessibilityLabel} style={{ alignItems: 'center' }}>
              <Text {...KOREAN_LINE_BREAK} {...koreanSpeech} style={{ fontFamily: typography.family.sansKr, fontSize: Math.round(JAMO_FACE * touchTarget.hero * 2), fontWeight: typography.weight.bold, color: colors.text.primary }}>
                {letter.char}
              </Text>
              <Body tone="secondary">{letter.sound}</Body>
            </View>
          ) : null}
        </View>
        <Body testID={`${testID}-note`}>{round.noteEn}</Body>
        {found && sources.length > 0 ? (
          <View style={{ gap: spacing.xs }}>
            <View style={{ alignSelf: 'flex-start' }}>
              <Button
                label={m.learner.storyShelf.cultureNotes.whereFrom}
                tone="ghost"
                size="md"
                expanded={state.sourcesOpen}
                onPress={() => dispatch({ type: 'sources' })}
                testID={`${testID}-sources`}
              />
            </View>
            {state.sourcesOpen
              ? sources.map((s) => (
                  <Caption key={s.url} testID={`${testID}-source`}>
                    {m.learner.storyShelf.cultureNotes.source(s.title, s.publisher)}
                  </Caption>
                ))
              : null}
          </View>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {tiles.map((t) => (
          <Pressable
            key={t.id}
            testID={`${testID}-tile-${t.id}`}
            accessibilityRole="button"
            accessibilityLabel={t.accessibilityLabel}
            accessibilityState={{ selected: t.look === 'found', disabled: found || t.look === 'marked' }}
            disabled={found || t.look === 'marked'}
            onPress={() => dispatch({ type: 'tap', id: t.id })}
            style={{ flex: 1, minHeight: tileTall + spacing.xl, borderRadius: radii.lg, alignItems: 'center', justifyContent: 'center', gap: spacing.xxs, ...TILE_LOOK[t.look] }}
          >
            <Text {...KOREAN_LINE_BREAK} {...koreanSpeech} style={{ fontSize: Math.round(JAMO_FACE * tileTall), fontWeight: typography.weight.bold, color: colors.text.primary }}>
              {t.char}
            </Text>
            <Caption>{t.sound}</Caption>
            <Mark look={t.look} />
          </Pressable>
        ))}
      </View>
      {found ? <Button label={copy.continue.cta} size="lg" fullWidth onPress={() => dispatch({ type: 'continue' })} testID={`${testID}-continue`} /> : null}
      {status}
      {helpOpen ? <VoiceHelpSheet visible onClose={() => setHelpOpen(false)} /> : null}
      <View accessibilityLiveRegion="polite" style={{ minHeight: touchTarget.min }}>
        {hoya}
      </View>
    </View>
  );
}
