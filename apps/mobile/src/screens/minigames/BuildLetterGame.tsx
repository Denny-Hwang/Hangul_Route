import {
  Body,
  Button,
  Caption,
  Heading,
  HoyaBubble,
  Pill,
  Progress,
  Screen,
  Spacer,
  SyllableBlock,
  TAP_LOCK_MS,
  TapBoard,
  TapTarget,
  Tile,
  borderWidth,
  colors,
  pressTransform,
  usePressLook,
  useTapLock,
  radii,
  spacing,
  touchTarget,
  typography,
  useMediaSize,
  KOREAN_LINE_BREAK,
  GuardedPressable,
  Icon,
  KEY_BOUNCE_MS,
  useTypeScale,
} from '@hangul-route/design-system';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { Text, View } from 'react-native';
import { PromptPanel } from '../../components/PromptPanel';
import { VoiceHelpSheet } from '../../components/VoiceHelpSheet';
import { usePromptSlot } from '../../components/use-prompt-slot';
import { afterMiss, afterRightAnswer } from '../../logic/answer-feedback';
import { afterSound } from '../../logic/audio/reply-advance';
import { jamoAll } from '../../content/jamo';
import { useMessages } from '../../i18n/use-messages';
import { blockShape, removeLastTile, shapeHint, shapePlaceHeight, tileAccessibilityLabel } from '../../logic/build-letter-view';
import type { MinigameScope } from '../../logic/minigame-config';
import { buildBuildLetterRounds, type BuildLetterRound } from '../../logic/round-builder';
import { hasClipFor, playPrompt } from '../../platform/audio';
import { nudge, success, tapLight } from '../../platform/haptics';
import { useQuestRunStore } from '../../store/quest-run-store';
import { AnswerAnnouncer } from './answer-announcer';
import { useAnswerAnnouncement } from './use-answer-announcement';
import { useRoundNext } from './use-round-next';

// Phone sizes; a tablet multiplies them by its media scale (F-LAYOUT-001 §3.6).
const TARGET = 160;
const TARGET_GLYPH = 80;
const SLOT = 72;
const HINT_CELL = 40;

interface Props {
  scope: MinigameScope;
  onFinish: () => void;
}

export function BuildLetterGame({ scope, onFinish }: Props): ReactElement {
  const m = useMessages();
  const copy = m.learner.minigame;
  const rounds = useMemo<BuildLetterRound[]>(
    () => buildBuildLetterRounds({ syllables: scope.syllables ?? [] }),
    [scope],
  );
  const [roundIdx, setRoundIdx] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const answerRound = useQuestRunStore((s) => s.answerRound);
  const markStepComplete = useQuestRunStore((s) => s.markStepComplete);
  const round = rounds[roundIdx];
  const shape = useMemo(() => blockShape(round?.componentJamoIds ?? []), [round]);
  // F-LAYOUT-001 §3.6: the target, the slots and the tiles (and the letters drawn in them) grow with the window; captions keep their type size.
  const target = useMediaSize(TARGET);
  const targetGlyph = useMediaSize(TARGET_GLYPH);
  const slotSize = useMediaSize(SLOT);
  const slotGlyph = useMediaSize(typography.size.display);
  const hintCell = useMediaSize(HINT_CELL);
  const tile = useMediaSize(touchTarget.child);
  // The syllable is printed in the box, so that is its text; the panel only says why it is silent (F-AUDIO-004 A-5b).
  // [AU] AU-13: the speaker plays the syllable's recorded say clip first (`playPrompt`, AMENDMENTS-AUDIO-CLIPS AC-B7), so
  // the slot is told when there is one: a device with no Korean voice then never says "No Korean voice" over a clip.
  const slot = usePromptSlot({
    source: 'build-letter',
    hasClip: round !== undefined && hasClipFor({ text: round.targetSyllable }),
    textOnScreen: true,
  });
  const { play, reset } = slot;
  /** The syllable's play that may still be sounding when the answer comes (QS-4). */
  const sounding = useRef<Promise<unknown> | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const tapLock = useTapLock();
  const press = usePressLook();
  const bodySize = useTypeScale().size.body;
  // F-A11Y-001 AF-4a: each result is said once, by the answer announcer; with a screen reader on a right block shows Next.
  const a = useAnswerAnnouncement();
  const { clear, focusPrompt } = a;
  const roundNext = useRoundNext();
  const mounted = useRef(false);
  /** The round last moved on from: a second Next (or a late wait) for the same round does nothing (the last round ends the step once). */
  const movedFrom = useRef(-1);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    setSelected([]);
    setFeedback('idle');
    reset();
    // A new round empties the announcer and, with a reader on, moves focus to the round's header node (§3.4).
    clear();
    if (roundIdx > 0) focusPrompt();
  }, [roundIdx, reset, clear, focusPrompt]);

  if (!round) {
    return (
      <Screen>
        <Body>{copy.noRounds}</Body>
      </Screen>
    );
  }

  const roundLabel = m.a11y.answer.round(roundIdx + 1, rounds.length, `${copy.buildLetter.heading} ${round.romanization}`);

  const hear = (): void => {
    sounding.current = play(() => playPrompt({ text: round.targetSyllable, kind: 'sound', source: 'build-letter' }));
  };

  const isCorrectWhenComplete = (sel: string[]): boolean => {
    if (sel.length !== round.componentJamoIds.length) return false;
    return sel.every((id, i) => id === round.componentJamoIds[i]);
  };

  const last = roundIdx >= rounds.length - 1;
  const advance = (): void => {
    if (movedFrom.current === roundIdx) return;
    movedFrom.current = roundIdx;
    roundNext.hide();
    if (last) {
      markStepComplete();
      onFinish();
    } else {
      setRoundIdx(roundIdx + 1);
    }
  };

  // AMENDMENTS-TOUCH 6.5 (R2): a used tray tile stays disabled, so a second tap on it never takes it back; a tile comes
  // back only from its filled slot (`takeBack`). Nothing is taken while the right block shows. A wrong build stays
  // (F-A11Y-001 OD-AF7 (i)): an unused tray tile empties the slots and starts a new build with that tile.
  const handleTile = (jamoId: string): void => {
    if (feedback === 'correct' || selected.includes(jamoId)) return;
    // A tap on a tray tile while the wrong build shows starts over with that tile; otherwise it adds to the build.
    const next = feedback === 'wrong' ? [jamoId] : [...selected, jamoId];
    if (next.length > round.componentJamoIds.length) return;
    setSelected(next);
    if (feedback === 'wrong') setFeedback('idle');
    tapLight();

    if (next.length === round.componentJamoIds.length) {
      if (isCorrectWhenComplete(next)) {
        success();
        answerRound(roundIdx, true, { texts: [round.targetSyllable], rung: 'produce' });
        setFeedback('correct');
        // The round-ending commit locks the app clock, so the next round's board mounts locked (KT-D5).
        tapLock.lock(TAP_LOCK_MS);
        const say = (): Promise<void> => a.announce({ kind: 'right', item: round.romanization });
        // [QS] AMENDMENTS-QUEST-SOUND-BACK QS-4: nothing is said on an answer here, so the wait is for a prompt that is still sounding.
        // OD-AF2 (b): at least the result floor. A reader on waits for Next instead (OD-AF9 (b)), the last round included.
        void afterRightAnswer({
          readerOn: a.readerOn,
          gameMinMs: 900,
          announce: a.readerOn ? () => roundNext.afterFocus(say) : say,
          showNext: roundNext.show,
          waitThenAdvance: (minMs) =>
            void afterSound(sounding.current, { minMs }).then(() => {
              if (mounted.current) advance();
            }),
        });
      } else {
        nudge();
        answerRound(roundIdx, false, { texts: [round.targetSyllable], rung: 'produce' });
        setFeedback('wrong');
        // The wrong build stays until the learner acts, so nothing is locked for long: only the bounce guard of any commit.
        tapLock.lock(TAP_LOCK_MS);
        afterMiss({ readerOn: a.readerOn, announce: () => a.announce({ kind: 'line', text: copy.buildLetter.notQuite(shapeHint(shape, copy.buildLetter.shape)) }) });
      }
    }
  };

  /** A tap on a filled slot: that tile goes back to the tray, and the tiles after it shift left. A wrong build ends. */
  const takeBack = (slot: number): void => {
    if (feedback === 'correct' || selected[slot] === undefined) return;
    setSelected(selected.filter((_, i) => i !== slot));
    setFeedback('idle');
    tapLight();
  };

  /**
   * Undo (OW-1-undo): a backspace for the last placed tile, one tap one tile. It is a take-back, not an attempt, so it scores
   * nothing and shows nothing of the answer; it waits while the right block shows, and it ends a wrong build.
   */
  const undoLast = (): void => {
    if (feedback === 'correct' || selected.length === 0) return;
    setSelected(removeLastTile(selected));
    setFeedback('idle');
    tapLight();
  };
  const canUndo = feedback !== 'correct' && selected.length > 0;

  return (
    <Screen tone="canvas">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <Progress value={roundIdx + 1} max={rounds.length} tone="primary" />
        </View>
        <Pill label={copy.progress.pill(roundIdx + 1, rounds.length)} size="sm" />
      </View>

      <Spacer size="lg" />
      {/* The round's header node (§3.4): the heading and the target's romanization, never a button and never the raw Hangul. */}
      <View ref={a.promptRef} testID="build-letter-round" accessible accessibilityRole="header" accessibilityLabel={roundLabel}>
        <Heading level="prompt">{copy.buildLetter.heading}</Heading>
      </View>
      <Spacer size="md" />

      <View style={{ alignItems: 'center' }}>
        <GuardedPressable
          setsLock={false}
          onPress={hear}
          accessibilityRole="button"
          accessibilityLabel={m.a11y.minigame.hear(round.romanization)}
          testID="build-letter-speaker"
          style={{
            width: target,
            height: target,
            borderRadius: radii.xl,
            backgroundColor: feedback === 'correct' ? colors.feedback.successLight : colors.surface.paper,
            borderWidth: 3,
            borderColor: feedback === 'correct' ? colors.feedback.success : colors.brand.primary,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text {...KOREAN_LINE_BREAK} style={{ fontSize: targetGlyph, fontWeight: '800', color: colors.text.primary }}>{round.targetSyllable}</Text>
          <Caption tone="secondary">{round.romanization}</Caption>
          {feedback === 'correct' ? (
            // A right block is not told by the green box alone (F-A11Y-001 §3.1): a `check` inside the box's corner (24, inset
            // `spacing.sm`, AnswerFeedback D1). Decorative: the target keeps its "Hear …" name.
            <View
              aria-hidden
              importantForAccessibility="no-hide-descendants"
              accessibilityElementsHidden
              pointerEvents="none"
              style={{ position: 'absolute', top: spacing.sm, right: spacing.sm }}
            >
              <Icon name="check" size={spacing.xl} color={colors.feedback.success} />
            </View>
          ) : null}
        </GuardedPressable>
      </View>
      <Spacer size="sm" />
      <PromptPanel
        variant="status"
        view={slot.view}
        onAction={(action) => slot.act(action, hear)}
        onHelp={() => setHelpOpen(true)}
      />
      <VoiceHelpSheet visible={helpOpen} onClose={() => setHelpOpen(false)} />

      <Spacer size="lg" />
      <Caption tone="muted" align="center">
        {copy.buildLetter.slots}
      </Caption>
      <Spacer size="xs" />
      {/* One board for the slots and the tray (AMENDMENTS-TOUCH 6.5, row KT-6), `target` lock: a filled slot is a take-back
          target that gap fill never reaches, so a bounce on the tray never lands on it. */}
      <TapBoard lock="target">
        <SyllableBlock
          vowel={shape.vowel}
          hasFinal={shape.hasFinal}
          renderCell={({ index: i }) => {
            const filled = selected[i];
            const j = filled ? jamoAll.find((x) => x.id === filled) : undefined;
            const slotBox = (p: ReturnType<typeof usePressLook> | null): ReactElement => (
              <View
                style={{
                  width: slotSize,
                  height: slotSize,
                  borderRadius: radii.lg,
                  borderWidth: p?.borderWidth ?? borderWidth.base,
                  // A wrong build takes the amber nudge look and no mark: the slots stay tappable, so `replay` would say "locked"
                  // (F-A11Y-001 §3.5, AnswerFeedback D7).
                  borderColor: p?.borderColor ?? (filled ? (feedback === 'wrong' ? colors.feedback.nudge : colors.brand.primary) : colors.border.subtle),
                  borderStyle: filled ? 'solid' : 'dashed',
                  backgroundColor: filled ? (feedback === 'wrong' ? colors.feedback.nudgeLight : colors.brand.primaryLight) : colors.surface.paper,
                  alignItems: 'center',
                  justifyContent: 'center',
                  transform: pressTransform(p),
                }}
              >
                <Text {...KOREAN_LINE_BREAK} style={{ fontSize: slotGlyph, fontWeight: '700' }}>{j?.char ?? ''}</Text>
              </View>
            );
            if (!j) return <View key={i} testID={`build-letter-slot-${i}`}>{slotBox(null)}</View>;
            return (
              <TapTarget
                key={i}
                testID={`build-letter-slot-${i}`}
                gapFill={false}
                disabled={feedback === 'correct'}
                accessibilityLabel={copy.buildLetter.takeBack(tileAccessibilityLabel(j, m.a11y.minigame.finalTile) ?? j.romanization)}
                onCommit={() => takeBack(i)}
              >
                {({ pressed }) => slotBox(pressed && feedback !== 'correct' ? press : null)}
              </TapTarget>
            );
          }}
        />

        {/* The shape picture's place, kept under the slots in every state at the block's own height, so the picture appearing
            after a miss is the cue and nothing moves (F-A11Y-001 §3.5; AnswerFeedback D7). */}
        <Spacer size="sm" />
        <View testID="build-letter-shape-place" style={{ height: shapePlaceHeight(shape, hintCell, spacing.sm), alignItems: 'center', justifyContent: 'center' }}>
          {feedback === 'wrong' ? (
            <View
              testID="build-letter-shape"
              accessible
              accessibilityLabel={m.a11y.minigame.blockShape(shapeHint(shape, copy.buildLetter.shape))}
            >
              <SyllableBlock
                vowel={shape.vowel}
                hasFinal={shape.hasFinal}
                renderCell={({ index: i }) => (
                  <View
                    key={i}
                    style={{
                      width: hintCell,
                      height: hintCell,
                      borderRadius: radii.md,
                      borderWidth: 2,
                      borderColor: colors.brand.primary,
                      backgroundColor: colors.brand.primaryLight,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Caption tone="secondary">{String(i + 1)}</Caption>
                  </View>
                )}
              />
            </View>
          ) : null}
        </View>

        <Spacer size="sm" />
        {/* Always on screen so it is found at once; dimmed and inert while there is nothing to take back. One more target of
            the board, a short bounce so a held-down finger or quick taps clear tile after tile (a keyboard's Delete). */}
        <View style={{ alignItems: 'center' }}>
          <TapTarget
            testID="build-letter-undo"
            lockMs={KEY_BOUNCE_MS}
            gapFill={false}
            disabled={!canUndo}
            accessibilityLabel={copy.buildLetter.undo.name}
            onCommit={undoLast}
            style={({ pressed }) => ({
              minHeight: touchTarget.min,
              minWidth: touchTarget.min,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.sm,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.sm,
              borderRadius: radii.pill,
              borderWidth: borderWidth.base,
              borderColor: !canUndo ? colors.border.subtle : pressed ? colors.border.focus : colors.border.strong,
              backgroundColor: !canUndo ? colors.surface.sunken : pressed ? colors.brand.primaryLight : colors.surface.paper,
              opacity: canUndo ? 1 : 0.6,
            })}
          >
            {() => (
              <>
                <Icon name="backspace" size={spacing.xl} color={canUndo ? colors.text.primary : colors.text.muted} />
                <Text {...KOREAN_LINE_BREAK} style={{ fontSize: bodySize, fontWeight: typography.weight.semibold, color: canUndo ? colors.text.primary : colors.text.muted }}>
                  {copy.buildLetter.undo.label}
                </Text>
              </>
            )}
          </TapTarget>
        </View>

        <Spacer size="lg" />
        <Caption tone="muted" align="center">
          {copy.buildLetter.tiles}
        </Caption>
        <Spacer size="xs" />
        <View style={{ flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: spacing.sm }}>
          {round.tileJamoIds.map((id) => {
            const j = jamoAll.find((x) => x.id === id);
            if (!j) return null;
            const label = tileAccessibilityLabel(j, m.a11y.minigame.finalTile);
            const used = selected.includes(id);
            // A used tile stays a (disabled) target of the board, so a second tap on it is claimed and does nothing:
            // it never reaches a neighbour through gap fill (KT-D6).
            return used ? (
              <TapTarget key={id} testID={`build-letter-tile-${id}`} disabled accessibilityLabel={label ?? j.char} onCommit={() => undefined}>
                {() => <Tile label={j.char} romanization={j.romanization} accessibilityLabel={label} size="md" dimension={tile} state="disabled" />}
              </TapTarget>
            ) : (
              <Tile
                key={id}
                testID={`build-letter-tile-${id}`}
                label={j.char}
                romanization={j.romanization}
                accessibilityLabel={label}
                size="md"
                dimension={tile}
                state="idle"
                onPress={() => handleTile(id)}
              />
            );
          })}
        </View>
      </TapBoard>

      {roundNext.shown ? (
        <>
          <Spacer size="lg" />
          <Button pressableRef={roundNext.nextRef} label={copy.trace.next.cta} tone="primary" size="hero" fullWidth onPress={advance} testID="build-letter-next" />
        </>
      ) : null}
      {feedback === 'wrong' ? (
        <>
          <Spacer size="lg" />
          {/* The announcer says the result once, so this result bubble is not a live region too (§3.3). */}
          <HoyaBubble testID="build-letter-hoya" tone="thinking" message={copy.buildLetter.notQuite(shapeHint(shape, copy.buildLetter.shape))} live={false} />
        </>
      ) : null}
      <AnswerAnnouncer line={a.line} />
      <Spacer size="xl" />
      <Button label={copy.skip.cta} tone="ghost" size="md" fullWidth onPress={() => { markStepComplete(); onFinish(); }} />
      <Spacer size="lg" />
    </Screen>
  );
}
