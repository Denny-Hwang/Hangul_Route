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
  useMediaSize,
  KOREAN_LINE_BREAK,
  useTypeScale,
} from '@hangul-route/design-system';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { PromptPanel } from '../../components/PromptPanel';
import { VoiceHelpSheet } from '../../components/VoiceHelpSheet';
import { usePromptSlot } from '../../components/use-prompt-slot';
import { useMessages } from '../../i18n/use-messages';
import type { MinigameScope } from '../../logic/minigame-config';
import { pairRoundKey } from '../../logic/round-keys';
import { koSpeech } from '../../logic/audio/ko-speech';
import { playPrompt } from '../../platform/audio';
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
  const textScale = useTypeScale();
  const m = useMessages();
  const copy = m.learner.minigame;
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

  const answerRound = useQuestRunStore((s) => s.answerRound);
  const markStepComplete = useQuestRunStore((s) => s.markStepComplete);

  const [selectedKo, setSelectedKo] = useState<number | null>(null);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [wrongFlash, setWrongFlash] = useState<{ ko: number; en: number } | null>(null);
  // F-LAYOUT-001 §3.6: the cards grow with the window (their padding scales; the words keep their type size).
  const cardPadding = useMediaSize(spacing.md);
  // Each Korean word is printed on its card; the panel only says why it is silent (F-AUDIO-004 A-5b).
  const slot = usePromptSlot({ source: 'card-match', textOnScreen: true });
  const [heardIdx, setHeardIdx] = useState<number | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  const hear = (idx: number): void => {
    const pair = pairs[idx];
    if (!pair) return;
    // A different word is a new prompt slot: what the last one could not play no longer applies.
    if (idx !== heardIdx) slot.reset();
    setHeardIdx(idx);
    void slot.play(() => playPrompt(koSpeech(pair, 'word', 'card-match')));
  };

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
      answerRound(pairRoundKey(selectedKo), true);
      setMatched(new Set([...matched, selectedKo]));
      setSelectedKo(null);
    } else {
      nudge();
      answerRound(pairRoundKey(selectedKo), false);
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
        <Pill label={copy.progress.pill(matched.size, pairs.length)} size="sm" />
      </View>

      <Spacer size="lg" />
      <Heading level="prompt">{copy.cardMatch.heading}</Heading>
      <Caption tone="muted">{copy.cardMatch.instruction}</Caption>

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
                  hear(p.idx);
                }}
                accessibilityLabel={m.a11y.minigame.koreanWord(p.romanization ?? p.ko)}
                disabled={isMatched}
                style={{
                  padding: cardPadding,
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
                <Text {...KOREAN_LINE_BREAK} style={{ fontSize: textScale.size.bodyLg, fontWeight: '700', color: colors.text.primary }}>
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
                accessibilityLabel={m.a11y.minigame.meaning(p.en)}
                disabled={isMatched}
                style={{
                  padding: cardPadding,
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
                <Text {...KOREAN_LINE_BREAK} style={{ fontSize: textScale.size.bodyLg, fontWeight: '600', color: colors.text.primary }}>
                  {p.en}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Spacer size="md" />
      <PromptPanel
        variant="status"
        view={slot.view}
        onAction={(action) => slot.act(action, () => (heardIdx !== null ? hear(heardIdx) : undefined))}
        onHelp={() => setHelpOpen(true)}
      />
      <VoiceHelpSheet visible={helpOpen} onClose={() => setHelpOpen(false)} />

      {selectedKo !== null && !matched.has(selectedKo) ? (
        <>
          <Spacer size="lg" />
          <HoyaBubble tone="idle" message={copy.cardMatch.nowMeaning} />
        </>
      ) : null}

      <Spacer size="xl" />
      <Button label={copy.skip.cta} tone="ghost" size="md" fullWidth onPress={() => { markStepComplete(); onFinish(); }} />
    </Screen>
  );
}
