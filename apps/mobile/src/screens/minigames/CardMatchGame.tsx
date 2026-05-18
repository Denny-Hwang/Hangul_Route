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
  colors,
  radii,
  spacing,
  typography,
} from '@hangul-route/design-system';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { MinigameScope } from '../../logic/minigame-config';
import { speak } from '../../platform/audio';
import { nudge, success } from '../../platform/haptics';
import { useQuestRunStore } from '../../store/quest-run-store';

interface Props {
  scope: MinigameScope;
  onFinish: () => void;
}

/**
 * CardMatch — present Korean words on the left, English meanings on the right.
 * Child taps matching pairs. Game completes when all pairs are matched.
 */
export function CardMatchGame({ scope, onFinish }: Props): React.ReactElement {
  const pairs = useMemo(() => scope.cardPairs ?? [], [scope]);
  const koList = useMemo(() => pairs.map((p, i) => ({ ...p, idx: i })), [pairs]);
  const enList = useMemo(() => {
    const indexed = pairs.map((p, i) => ({ ...p, idx: i }));
    // Shuffle the English column so it doesn't sit directly across from its Korean pair.
    for (let i = indexed.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = indexed[i]!;
      indexed[i] = indexed[j]!;
      indexed[j] = tmp;
    }
    return indexed;
  }, [pairs]);

  const recordRound = useQuestRunStore((s) => s.recordRound);
  const markStepComplete = useQuestRunStore((s) => s.markStepComplete);

  const [selectedKo, setSelectedKo] = useState<number | null>(null);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [wrongFlash, setWrongFlash] = useState<{ ko: number; en: number } | null>(null);

  useEffect(() => {
    if (matched.size === pairs.length && pairs.length > 0) {
      setTimeout(() => {
        markStepComplete();
        onFinish();
      }, 800);
    }
  }, [matched, pairs.length, markStepComplete, onFinish]);

  const tryMatch = (enIdx: number): void => {
    if (selectedKo === null) return;
    if (matched.has(selectedKo)) return;
    if (selectedKo === enIdx) {
      success();
      recordRound(true);
      setMatched(new Set([...matched, selectedKo]));
      setSelectedKo(null);
    } else {
      nudge();
      recordRound(false);
      setWrongFlash({ ko: selectedKo, en: enIdx });
      setTimeout(() => {
        setWrongFlash(null);
        setSelectedKo(null);
      }, 600);
    }
  };

  return (
    <Screen tone="canvas" scrollable>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <Progress value={matched.size} max={pairs.length} tone="primary" />
        </View>
        <Pill label={`${matched.size} / ${pairs.length}`} size="sm" />
      </View>

      <Spacer size="lg" />
      <Heading level="prompt">Match the meaning</Heading>
      <Caption tone="muted">Tap a Korean word, then its English meaning.</Caption>

      <Spacer size="lg" />
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <View style={{ flex: 1, gap: spacing.sm }}>
          {koList.map((p) => {
            const isMatched = matched.has(p.idx);
            const isSelected = selectedKo === p.idx;
            const isWrong = wrongFlash?.ko === p.idx;
            return (
              <Pressable
                key={`ko-${p.idx}`}
                onPress={() => {
                  if (isMatched) return;
                  setSelectedKo(p.idx);
                  speak(p.ko, { language: 'ko-KR' });
                }}
                accessibilityLabel={`Korean word ${p.romanization ?? p.ko}`}
                disabled={isMatched}
                style={{
                  padding: spacing.md,
                  borderRadius: radii.lg,
                  backgroundColor: isMatched
                    ? colors.feedback.successLight
                    : isSelected
                      ? colors.brand.primaryLight
                      : isWrong
                        ? colors.feedback.nudgeLight
                        : colors.surface.paper,
                  borderWidth: 2,
                  borderColor: isMatched
                    ? colors.feedback.success
                    : isSelected
                      ? colors.brand.primary
                      : isWrong
                        ? colors.feedback.nudge
                        : colors.border.subtle,
                  opacity: isMatched ? 0.5 : 1,
                }}
              >
                <Text style={{ fontSize: typography.size.bodyLg, fontWeight: '700', color: colors.text.primary }}>
                  {p.ko}
                </Text>
                {p.romanization ? (
                  <Caption tone="secondary" style={{ fontStyle: 'italic' }}>
                    {p.romanization}
                  </Caption>
                ) : null}
              </Pressable>
            );
          })}
        </View>
        <View style={{ flex: 1, gap: spacing.sm }}>
          {enList.map((p) => {
            const isMatched = matched.has(p.idx);
            const isWrong = wrongFlash?.en === p.idx;
            return (
              <Pressable
                key={`en-${p.idx}`}
                onPress={() => tryMatch(p.idx)}
                accessibilityLabel={`English meaning ${p.en}`}
                disabled={isMatched}
                style={{
                  padding: spacing.md,
                  borderRadius: radii.lg,
                  backgroundColor: isMatched
                    ? colors.feedback.successLight
                    : isWrong
                      ? colors.feedback.nudgeLight
                      : colors.surface.paper,
                  borderWidth: 2,
                  borderColor: isMatched
                    ? colors.feedback.success
                    : isWrong
                      ? colors.feedback.nudge
                      : colors.border.subtle,
                  opacity: isMatched ? 0.5 : 1,
                }}
              >
                <Text style={{ fontSize: typography.size.bodyLg, fontWeight: '600', color: colors.text.primary }}>
                  {p.en}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {selectedKo !== null && !matched.has(selectedKo) ? (
        <>
          <Spacer size="lg" />
          <HoyaBubble tone="idle" message="Now tap its meaning on the right." />
        </>
      ) : null}

      <Spacer size="xl" />
      <Button label="Skip" tone="ghost" size="md" fullWidth onPress={() => { markStepComplete(); onFinish(); }} />
    </Screen>
  );
}
