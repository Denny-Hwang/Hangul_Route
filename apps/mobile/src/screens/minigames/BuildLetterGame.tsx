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
  Tile,
  colors,
  radii,
  spacing,
  typography,
} from '@hangul-route/design-system';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { jamoAll } from '../../content/jamo';
import { useMessages } from '../../i18n/use-messages';
import { blockShape, shapeHint, tileAccessibilityLabel } from '../../logic/build-letter-view';
import type { MinigameScope } from '../../logic/minigame-config';
import { buildBuildLetterRounds, type BuildLetterRound } from '../../logic/round-builder';
import { speak } from '../../platform/audio';
import { nudge, success, tapLight } from '../../platform/haptics';
import { useQuestRunStore } from '../../store/quest-run-store';

const SLOT = 72;
const HINT_CELL = 40;

interface Props {
  scope: MinigameScope;
  onFinish: () => void;
}

export function BuildLetterGame({ scope, onFinish }: Props): React.ReactElement {
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

  useEffect(() => {
    setSelected([]);
    setFeedback('idle');
  }, [roundIdx]);

  if (!round) {
    return (
      <Screen>
        <Body>{copy.noRounds}</Body>
      </Screen>
    );
  }

  const isCorrectWhenComplete = (sel: string[]): boolean => {
    if (sel.length !== round.componentJamoIds.length) return false;
    return sel.every((id, i) => id === round.componentJamoIds[i]);
  };

  const handleTile = (jamoId: string): void => {
    if (feedback === 'correct') return;
    if (selected.includes(jamoId)) {
      setSelected(selected.filter((id) => id !== jamoId));
      return;
    }
    const next = [...selected, jamoId];
    if (next.length > round.componentJamoIds.length) return;
    setSelected(next);
    tapLight();

    if (next.length === round.componentJamoIds.length) {
      if (isCorrectWhenComplete(next)) {
        success();
        answerRound(roundIdx, true);
        setFeedback('correct');
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
        answerRound(roundIdx, false);
        setFeedback('wrong');
        setTimeout(() => {
          setSelected([]);
          setFeedback('idle');
        }, 900);
      }
    }
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
        <Pressable
          onPress={() => speak(round.targetSyllable, { language: 'ko-KR' })}
          accessibilityLabel={m.a11y.minigame.hear(round.romanization)}
          style={{
            width: 160,
            height: 160,
            borderRadius: radii.xl,
            backgroundColor: feedback === 'correct' ? colors.feedback.successLight : colors.surface.paper,
            borderWidth: 3,
            borderColor: feedback === 'correct' ? colors.feedback.success : colors.brand.primary,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 80, fontWeight: '800', color: colors.text.primary }}>{round.targetSyllable}</Text>
          <Caption tone="secondary">{round.romanization}</Caption>
        </Pressable>
      </View>

      <Spacer size="lg" />
      <Caption tone="muted" align="center">
        {copy.buildLetter.slots}
      </Caption>
      <Spacer size="xs" />
      <SyllableBlock
        vowel={shape.vowel}
        hasFinal={shape.hasFinal}
        renderCell={({ index: i }) => {
          const filled = selected[i];
          const jamoChar = filled ? jamoAll.find((j) => j.id === filled)?.char ?? '' : '';
          return (
            <View
              key={i}
              style={{
                width: SLOT,
                height: SLOT,
                borderRadius: radii.lg,
                borderWidth: 2,
                borderColor: filled ? colors.brand.primary : colors.border.subtle,
                borderStyle: filled ? 'solid' : 'dashed',
                backgroundColor: filled ? colors.brand.primaryLight : colors.surface.paper,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: typography.size.display, fontWeight: '700' }}>{jamoChar}</Text>
            </View>
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
          const used = selected.includes(id);
          return (
            <Tile
              key={id}
              label={j.char}
              romanization={j.romanization}
              accessibilityLabel={tileAccessibilityLabel(j, m.a11y.minigame.finalTile)}
              size="md"
              state={used ? 'disabled' : 'idle'}
              onPress={() => handleTile(id)}
            />
          );
        })}
      </View>

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
                    width: HINT_CELL,
                    height: HINT_CELL,
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
