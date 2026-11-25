import type { MatchShapeRound } from '@hangul-route/content-schema';
import {
  Body,
  Button,
  Caption,
  HoyaBubble,
  KOREAN_LANGUAGE,
  KOREAN_LINE_BREAK,
  TapBoard,
  TapTarget,
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
  usePressLook,
  useTypeScale,
  pressTransform,
} from '@hangul-route/design-system';
import { ShapeOriginArt } from '@hangul-route/design-system/src/components/ShapeOriginArt/ShapeOriginArt';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { Text, View } from 'react-native';
import { PromptPanel } from '../../components/PromptPanel';
import { VoiceHelpSheet } from '../../components/VoiceHelpSheet';
import { usePromptSlot } from '../../components/use-prompt-slot';
import { useSoundPacing } from '../../components/use-sound-pacing';
import { findJamo } from '../../content/jamo';
import { useMessages } from '../../i18n/use-messages';
import { afterMiss, afterRightAnswer, answerOptionLabel, lookHereLine, spokenParts } from '../../logic/answer-feedback';
import { jamoVoice } from '../../logic/audio/jamo-voice';
import { koTokenParts } from '../../logic/ko-tokens';
import type { ShapeSource } from '../../logic/match-shape/facts';
import { shapeHoyaLine, startShape, stepShape, type ShapeEffect, type ShapeEvent, type ShapeState } from '../../logic/match-shape/flow';
import { originTiles, pairHeading, pairTiles, soundSpoken, type ShapeTileLook } from '../../logic/match-shape/view';
import { shapeLetter } from '../../logic/match-shape/letters';
import { TRACE_CANVAS_MIN } from '../../logic/trace-layout';
import { hasClipFor, playJamo, stop } from '../../platform/audio';
import { nudge, success, tapLight } from '../../platform/haptics';
import { AnswerAnnouncer } from './answer-announcer';
import { DiscMark, LookHereRing } from './answer-marks';
import { useAnswerAnnouncement, type AnswerAnnouncement } from './use-answer-announcement';
import { useRoundNext } from './use-round-next';

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
 * - A miss is amber with the `replay` mark, never red; the status panel is a polite live region.
 * - Reduced motion: nothing moves; the pause after a pair round stays, so its sound is not cut off.
 *
 * Answer feedback (F-A11Y-001 row AF-4c; design/components/AnswerFeedback/spec.md D2, D4, D9): a found tile shows `check`
 * and a missed one `replay`, each on a disc straddling its corner as `Tile`'s (the 16 dp check and the amber dot are
 * gone), named with the state first; a locked tile is inactive, never disabled; the second miss rings the tiles to find
 * with the dashed look-here ring. Each result is said once by the answer announcer (a found copy by its sound, a miss by
 * the tile's sound, then Hoya's line and the difference note with its `{ko:}` read as romanization, never Hangul;
 * the miss that turns the ring on adds the look-here line); Hoya's lines are not live. After a pair round the wait is the
 * 1000 ms floor with a screen reader off, and with one on a right pair shows Next and waits for it (OD-AF9 (b)); an
 * origin round's own Continue takes focus and the letter's sound starts after the line. A quest step passes its own
 * `speech`, so its heading is the round's header node.
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
  /** The quest step's announcement hook, when its heading is the round's header node (§3.4); else the board has its own. */
  speech?: AnswerAnnouncement;
  /** Which round of the step this is, for a pair round's header node (§3.4); absent in a review round. */
  roundOf?: { n: number; total: number };
  testID?: string;
}

const koreanSpeech = { accessibilityLanguage: KOREAN_LANGUAGE, lang: KOREAN_LANGUAGE };
/** A jamo face is part of its tile's picture: half the tile, so it keeps its size at every text setting. */
const JAMO_FACE = 0.5;

const TILE_LOOK: Record<ShapeTileLook, { backgroundColor: string; borderColor: string; borderWidth: number }> = {
  plain: { backgroundColor: colors.surface.paper, borderColor: colors.border.subtle, borderWidth: borderWidth.base },
  found: { backgroundColor: colors.feedback.successLight, borderColor: colors.feedback.success, borderWidth: borderWidth.thick },
  marked: { backgroundColor: colors.feedback.nudgeLight, borderColor: colors.feedback.nudge, borderWidth: borderWidth.thick },
  // The look-here ring is drawn outside the tile (`LookHereRing`, AnswerFeedback D4); the tile keeps its quiet look.
  ring: { backgroundColor: colors.surface.paper, borderColor: colors.border.subtle, borderWidth: borderWidth.base },
};

/**
 * A tile's drawn box: its look, or while a finger that will count is down the press look (AMENDMENTS-TOUCH 4.3: a thick
 * `border.shape` outline and the shrink), never a state look. The box fills its target, so the hit area keeps its size.
 */
function tileBox(press: ReturnType<typeof usePressLook> | null, look: ShapeTileLook, size: { minHeight: number; gap?: number }) {
  return {
    flexGrow: 1,
    ...size,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    ...TILE_LOOK[look],
    ...(press ? { borderColor: press.borderColor, borderWidth: press.borderWidth } : {}),
    transform: pressTransform(press),
  } as const;
}

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

export function MatchShapeBoard({ round, sources = [], onFirst, onSolved, source, speech, roundOf, testID = 'match-shape' }: MatchShapeBoardProps): ReactElement {
  const m = useMessages();
  const copy = m.learner.minigame.matchShape;
  const a11y = m.a11y.minigame.matchShape;
  const scale = useTypeScale().size;
  const wide = useLayoutClass().width !== 'compact';
  const tileTall = useMediaSize(touchTarget.min) > touchTarget.min ? touchTarget.hero : touchTarget.min;
  const pairTall = useMediaSize(touchTarget.hero);
  const target = findJamo(round.target);
  const press = usePressLook();

  // The pair board is a letter question (AMENDMENTS-AUDIO-CLIPS JV-A1, section 6.1): the letter's name (ㄴ is nieun), from
  // its name clip when the build has one, else the device voice or the same name as text (section 3.8).
  const voice = target ? jamoVoice(target, 'letter') : undefined;
  const slot = usePromptSlot({ source, hasClip: voice !== undefined && hasClipFor(voice), reportFallback: true });
  const { play: slotPlay } = slot;
  const [helpOpen, setHelpOpen] = useState(false);
  const [state, setState] = useState<ShapeState>(() => startShape(round));
  const stateRef = useRef(state);
  // [QS] AMENDMENTS-QUEST-SOUND-BACK QS-4: the next round waits for the letter's name to be said.
  const pacing = useSoundPacing();
  const handlers = useRef({ onFirst, onSolved });
  handlers.current = { onFirst, onSolved };
  // F-A11Y-001 AF-4c: each result is said once by the answer announcer; with a screen reader on a right pair shows Next.
  const ownSpeech = useAnswerAnnouncement();
  const a = speech ?? ownSpeech;
  const aRef = useRef(a);
  aRef.current = a;
  const nextButton = useRoundNext();
  const nextRef = useRef(nextButton);
  nextRef.current = nextButton;
  const mounted = useRef(true);
  /** The round has moved on (Next, Continue, or its wait): a second press, or a late wait or sound, does nothing. */
  const moved = useRef(false);
  const latest = useRef({ a11y: m.a11y, copy });
  latest.current = { a11y: m.a11y, copy };

  /** The round moves on once: Next, Continue, or the wait that follows a right pair with the reader off. */
  const moveOn = useCallback((): void => {
    if (moved.current || !mounted.current) return;
    moved.current = true;
    nextRef.current.hide();
    handlers.current.onSolved();
  }, []);

  const say = useCallback((): void => {
    // Said by its name (giyeok, nieun, ieung), every letter alike, never a carrier syllable (na, ba): the tiles name letters,
    // and a lone letter's carrier syllable is the confusion of the owner's audio report of 2026-10-29.
    if (target) void pacing.track(slotPlay(() => playJamo(target, 'letter')));
  }, [slotPlay, target, pacing]);

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
          // An origin round's Continue is the learner's own tap; a pair round's wait is `afterRightAnswer`'s (`dispatch`).
          if (round.shape === 'origin') moveOn();
          return;
      }
    },
    [say, round.shape, moveOn],
  );

  const dispatch = useCallback(
    (event: ShapeEvent): void => {
      const before = stateRef.current;
      const out = stepShape(before, event, round);
      stateRef.current = out.state;
      setState(out.state);
      const speak = aRef.current;
      const { a11y: texts, copy: words } = latest.current;
      const target = shapeLetter(round.target);
      const targetSound = soundSpoken(target.sound, texts.minigame.matchShape);
      const isTap = event.type === 'tap' || event.type === 'tap-tile';
      const tapped = (): string => {
        if (event.type === 'tap') return soundSpoken(shapeLetter(event.id).sound, texts.minigame.matchShape);
        if (event.type === 'tap-tile' && round.shape === 'pair') return soundSpoken(shapeLetter(round.layout[event.index] === 't' ? round.target : round.lookAlike).sound, texts.minigame.matchShape);
        return '';
      };
      const right = isTap && out.effects.some((e) => e.type === 'haptic' && e.kind === 'success');
      const missed = isTap && out.effects.some((e) => e.type === 'haptic' && e.kind === 'nudge');
      if (right && out.state.status === 'found') {
        // The round is over: the letter's sound is the right answer's own, after the line and dropped if the round moved first.
        const sound = out.effects.find((e) => e.type === 'play');
        out.effects.filter((e) => e !== sound).forEach(run);
        const say = (): Promise<void> => speak.announce({ kind: 'right', item: targetSound });
        void afterRightAnswer({
          readerOn: speak.readerOn,
          gameMinMs: PAIR_SOLVED_PAUSE_MS,
          announce: speak.readerOn ? () => nextRef.current.afterFocus(say) : say,
          play: () => {
            if (moved.current || !mounted.current) return;
            if (sound) run(sound);
          },
          showNext: () => nextRef.current.show(),
          // An origin round's Continue is the learner's own tap: no wait, the button takes focus (as Next does).
          waitThenAdvance: (minMs) => {
            if (round.shape === 'pair') void pacing.after(minMs, moveOn);
          },
        });
        return;
      }
      out.effects.forEach(run);
      if (right) void speak.announce({ kind: 'right', item: tapped() });
      if (missed) {
        const hint = round.shape === 'pair' ? [words.missPair, spokenParts(koTokenParts(round.diffNoteEn))].filter((x) => x !== '').join(' ') : words.missOrigin;
        // The miss that turns the look-here ring on adds the look-here line, naming what is ringed (§3.2).
        const ringed = out.state.status === 'asking' && out.state.ring && !before.ring;
        const line = ringed ? `${hint} ${lookHereLine(texts, targetSound)}` : hint;
        afterMiss({ readerOn: speak.readerOn, announce: () => speak.announce({ kind: 'missHint', item: tapped(), hint: line }) });
      }
    },
    [round, run, pacing, moveOn],
  );

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      stop();
    };
  }, []);

  const found = state.status === 'found';
  const line = shapeHoyaLine(state);
  /** A tile's name with its state first (§3.2): "Right answer: …", "Not this one: …", "Look here: …". */
  const named = (look: ShapeTileLook, base: string): string =>
    answerOptionLabel(look === 'found' ? 'correct' : look === 'marked' ? 'wrong' : look === 'ring' ? 'hint' : 'idle', base, m.a11y.minigame.option);
  /** The tile's decorations: the disc straddling its corner (`check` found, `replay` missed) and the look-here ring. */
  const decor = (look: ShapeTileLook, tid: string): ReactElement | null =>
    look === 'found' || look === 'marked' ? (
      <DiscMark mark={look === 'found' ? 'right' : 'miss'} answerBorder={TILE_LOOK[look].borderWidth} testID={`${tid}-mark`} />
    ) : look === 'ring' ? (
      <LookHereRing radius={radii.lg} answerBorder={TILE_LOOK.ring.borderWidth} testID={`${tid}-ring`} />
    ) : null;
  const status = found ? <PromptPanel variant="status" view={slot.view} onAction={(action) => slot.act(action, say)} onHelp={() => setHelpOpen(true)} testID={`${testID}-prompt`} /> : null;
  const hoya =
    line === null ? null : (
      <HoyaBubble
        testID={`${testID}-hoya`}
        tone={line === 'found' ? 'cheering' : 'thinking'}
        message={line === 'found' ? copy.found : line === 'missOrigin' ? copy.missOrigin : copy.missPair}
        live={false}
      />
    );

  if (round.shape === 'pair' && state.shape === 'pair') {
    const tiles = pairTiles(round, state, a11y);
    const heading = pairHeading(round, a11y);
    return (
      <View testID={testID} style={{ gap: spacing.md }}>
        <View
          ref={a.promptRef}
          accessible
          accessibilityRole="header"
          // The step's round node names the round and the target's sound, never the letter's Hangul (§3.4).
          accessibilityLabel={roundOf ? m.a11y.answer.round(roundOf.n, roundOf.total, `${copy.heading.pair} ${soundSpoken(heading.sound, a11y)}`) : heading.accessibilityLabel}
          testID={`${testID}-heading`} style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: spacing.sm }}>
          <Text {...KOREAN_LINE_BREAK} style={{ fontSize: scale.prompt, fontWeight: typography.weight.bold, color: colors.text.primary }}>{copy.heading.pair}</Text>
          <Text {...KOREAN_LINE_BREAK} {...koreanSpeech} style={{ fontFamily: typography.family.sansKr, fontSize: scale.prompt, fontWeight: typography.weight.bold, color: colors.text.primary }}>
            {heading.char}
          </Text>
          <Text {...KOREAN_LINE_BREAK} style={{ fontSize: scale.body, color: colors.text.secondary, fontWeight: typography.weight.semibold }}>{heading.sound}</Text>
        </View>
        {/* One board for the tiles (AMENDMENTS-TOUCH section 6, row KT-6): a graze still counts, a bounce never counts twice. */}
        <TapBoard lock="board">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {tiles.map((t) => {
              const off = found || t.look === 'found' || t.look === 'marked';
              return (
                <TapTarget
                  key={t.index}
                  testID={`${testID}-tile-${t.index}`}
                  accessibilityLabel={named(t.look, t.accessibilityLabel)}
                  accessibilityState={{ selected: t.look === 'found' }}
                  // An answered tile is locked: inactive, still focusable, never disabled (§3.1).
                  inactive={off}
                  onCommit={() => dispatch({ type: 'tap-tile', index: t.index })}
                  style={{ flexBasis: '30%', flexGrow: 1 }}
                >
                  {({ pressed }) => (
                    <View style={tileBox(pressed && !off ? press : null, t.look, { minHeight: Math.max(touchTarget.min, pairTall) })}>
                      <Text {...KOREAN_LINE_BREAK} {...koreanSpeech} style={{ fontSize: Math.round(JAMO_FACE * Math.max(touchTarget.min, pairTall)), fontWeight: typography.weight.bold, color: colors.text.primary }}>
                        {t.char}
                      </Text>
                      {t.sound !== null ? <Caption>{t.sound}</Caption> : null}
                      {decor(t.look, `${testID}-tile-${t.index}`)}
                    </View>
                  )}
                </TapTarget>
              );
            })}
          </View>
        </TapBoard>
        {nextButton.shown ? (
          <Button pressableRef={nextButton.nextRef} label={m.learner.minigame.trace.next.cta} tone="primary" size="hero" fullWidth onPress={moveOn} testID={`${testID}-next`} />
        ) : null}
        {status}
        {helpOpen ? <VoiceHelpSheet visible onClose={() => setHelpOpen(false)} /> : null}
        {/* The announcer says the result once, so Hoya's line and the difference note are not live regions too (§3.3). */}
        <View style={{ minHeight: touchTarget.min, gap: spacing.sm }}>
          {hoya}
          {line === 'missPair' ? <TokenLine note={round.diffNoteEn} testID={`${testID}-diff`} /> : null}
        </View>
        {speech === undefined ? <AnswerAnnouncer line={a.line} /> : null}
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
      <TapBoard lock="board">
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {tiles.map((t) => {
            const off = found || t.look === 'marked';
            return (
              <TapTarget
                key={t.id}
                testID={`${testID}-tile-${t.id}`}
                accessibilityLabel={named(t.look, t.accessibilityLabel)}
                accessibilityState={{ selected: t.look === 'found' }}
                inactive={off}
                onCommit={() => dispatch({ type: 'tap', id: t.id })}
                style={{ flex: 1 }}
              >
                {({ pressed }) => (
                  <View style={tileBox(pressed && !off ? press : null, t.look, { minHeight: tileTall + spacing.xl, gap: spacing.xxs })}>
                    <Text {...KOREAN_LINE_BREAK} {...koreanSpeech} style={{ fontSize: Math.round(JAMO_FACE * tileTall), fontWeight: typography.weight.bold, color: colors.text.primary }}>
                      {t.char}
                    </Text>
                    <Caption>{t.sound}</Caption>
                    {decor(t.look, `${testID}-tile-${t.id}`)}
                  </View>
                )}
              </TapTarget>
            );
          })}
        </View>
      </TapBoard>
      {found ? <Button pressableRef={nextButton.nextRef} label={copy.continue.cta} size="lg" fullWidth onPress={() => dispatch({ type: 'continue' })} testID={`${testID}-continue`} /> : null}
      {status}
      {helpOpen ? <VoiceHelpSheet visible onClose={() => setHelpOpen(false)} /> : null}
      <View style={{ minHeight: touchTarget.min }}>{hoya}</View>
      {speech === undefined ? <AnswerAnnouncer line={a.line} /> : null}
    </View>
  );
}
