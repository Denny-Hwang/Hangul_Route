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
} from '@hangul-route/design-system';
import { useEffect, useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import { Text, View } from 'react-native';
import { PromptPanel } from '../../components/PromptPanel';
import { VoiceHelpSheet } from '../../components/VoiceHelpSheet';
import { usePromptSlot } from '../../components/use-prompt-slot';
import { jamoAll } from '../../content/jamo';
import { useMessages } from '../../i18n/use-messages';
import { blockShape, shapeHint, tileAccessibilityLabel } from '../../logic/build-letter-view';
import type { MinigameScope } from '../../logic/minigame-config';
import { buildBuildLetterRounds, type BuildLetterRound } from '../../logic/round-builder';
import { playPrompt } from '../../platform/audio';
import { nudge, success, tapLight } from '../../platform/haptics';
import { useQuestRunStore } from '../../store/quest-run-store';

// Phone sizes; a tablet multiplies them by its media scale (F-LAYOUT-001 §3.6).
const TARGET = 160;
const TARGET_GLYPH = 80;
const SLOT = 72;
const HINT_CELL = 40;
/** The wrong attempt shows its hint this long, then the slots empty (the board is locked meanwhile, AMENDMENTS-TOUCH 6.5). */
const WRONG_RESET_MS = 900;

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
  const slot = usePromptSlot({ source: 'build-letter', textOnScreen: true });
  const { play, reset } = slot;
  const [helpOpen, setHelpOpen] = useState(false);
  const tapLock = useTapLock();
  const press = usePressLook();

  useEffect(() => {
    setSelected([]);
    setFeedback('idle');
    reset();
  }, [roundIdx, reset]);

  if (!round) {
    return (
      <Screen>
        <Body>{copy.noRounds}</Body>
      </Screen>
    );
  }

  const hear = (): void => {
    void play(() => playPrompt({ text: round.targetSyllable, kind: 'sound', source: 'build-letter' }));
  };

  const isCorrectWhenComplete = (sel: string[]): boolean => {
    if (sel.length !== round.componentJamoIds.length) return false;
    return sel.every((id, i) => id === round.componentJamoIds[i]);
  };

  // AMENDMENTS-TOUCH 6.5 (R2): a used tray tile stays disabled, so a second tap on it never takes it back; a tile comes
  // back only from its filled slot (`takeBack`). Nothing is taken while the right block shows or the wrong one resets.
  const handleTile = (jamoId: string): void => {
    if (feedback !== 'idle' || selected.includes(jamoId)) return;
    const next = [...selected, jamoId];
    if (next.length > round.componentJamoIds.length) return;
    setSelected(next);
    tapLight();

    if (next.length === round.componentJamoIds.length) {
      if (isCorrectWhenComplete(next)) {
        success();
        answerRound(roundIdx, true, { texts: [round.targetSyllable], rung: 'produce' });
        setFeedback('correct');
        // The round-ending commit locks the app clock, so the next round's board mounts locked (KT-D5).
        tapLock.lock(TAP_LOCK_MS);
        setTimeout(() => {
          if (roundIdx >= rounds.length - 1) {
            markStepComplete();
            onFinish();
          } else {
            setRoundIdx(roundIdx + 1);
          }
        }, 900);
      } else {
        nudge();
        answerRound(roundIdx, false, { texts: [round.targetSyllable], rung: 'produce' });
        setFeedback('wrong');
        // Taps during the reset are swallowed, not accepted and then wiped.
        tapLock.lock(WRONG_RESET_MS);
        setTimeout(() => {
          setSelected([]);
          setFeedback('idle');
        }, WRONG_RESET_MS);
      }
    }
  };

  /** A tap on a filled slot: that tile goes back to the tray, and the tiles after it shift left. */
  const takeBack = (slot: number): void => {
    if (feedback !== 'idle' || selected[slot] === undefined) return;
    setSelected(selected.filter((_, i) => i !== slot));
    tapLight();
  };

  return (
    <Screen tone="canvas">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <Progress value={roundIdx + 1} max={rounds.length} tone="primary" />
        </View>
        <Pill label={copy.progress.pill(roundIdx + 1, rounds.length)} size="sm" />
      </View>

      <Spacer size="lg" />
      <Heading level="prompt">{copy.buildLetter.heading}</Heading>
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
                  borderColor: p?.borderColor ?? (filled ? colors.brand.primary : colors.border.subtle),
                  borderStyle: filled ? 'solid' : 'dashed',
                  backgroundColor: filled ? colors.brand.primaryLight : colors.surface.paper,
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
                disabled={feedback !== 'idle'}
                accessibilityLabel={copy.buildLetter.takeBack(tileAccessibilityLabel(j, m.a11y.minigame.finalTile) ?? j.char)}
                onCommit={() => takeBack(i)}
              >
                {({ pressed }) => slotBox(pressed && feedback === 'idle' ? press : null)}
              </TapTarget>
            );
          }}
        />

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

      {feedback === 'wrong' ? (
        <>
          <Spacer size="lg" />
          <HoyaBubble tone="thinking" message={copy.buildLetter.notQuite(shapeHint(shape, copy.buildLetter.shape))} />
          <Spacer size="md" />
          <View
            style={{ alignItems: 'center' }}
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
        </>
      ) : null}
      <Spacer size="xl" />
      <Button label={copy.skip.cta} tone="ghost" size="md" fullWidth onPress={() => { markStepComplete(); onFinish(); }} />
      <Spacer size="lg" />
    </Screen>
  );
}
