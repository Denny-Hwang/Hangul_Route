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
  borderWidth,
  colors,
  radii,
  spacing,
  touchTarget,
  typography,
  useMediaSize,
  KOREAN_LINE_BREAK,
  useTypeScale,
} from '@hangul-route/design-system';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { Pressable, Text, View } from 'react-native';
import { PromptPanel } from '../../components/PromptPanel';
import { VoiceHelpSheet } from '../../components/VoiceHelpSheet';
import { usePromptSlot } from '../../components/use-prompt-slot';
import { useMessages } from '../../i18n/use-messages';
import type { MinigameScope } from '../../logic/minigame-config';
import type { RoundAsked } from '../../logic/memory/asked';
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
 *
 * Touch (AMENDMENTS-TOUCH 6.2, row KT-4a): either side may be picked first; a tap on the same side moves the
 * pick, a tap on the selected card keeps it, a tap on the other side tries the pair. A pair is scored under its
 * Korean card, whichever side came first. The wrong flash's timer is kept in a ref, cleared by any new pick and on
 * unmount, and when it fires it lets go only of the pick that missed, so it never un-selects the next pick.
 */

type CardSide = 'ko' | 'en';

interface CardPick {
  side: CardSide;
  idx: number;
}

/** A wrong pair stays amber this long; then the pick that missed is let go. */
const WRONG_FLASH_MS = 600;
/** Last pair matched -> the step completes. */
const FINISH_DELAY_MS = 800;

const samePick = (a: CardPick | null, b: CardPick): boolean => a !== null && a.side === b.side && a.idx === b.idx;

/** The word a pair asks, read as Korean to meaning (F-CURR-002 row CM-12). */
function askedPair(pairs: readonly { ko: string }[], idx: number): RoundAsked | undefined {
  const ko = pairs[idx]?.ko;
  return ko ? { texts: [ko], rung: 'read' } : undefined;
}

export function CardMatchGame({ scope, onFinish }: Props): ReactElement {
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

  const [selected, setSelected] = useState<CardPick | null>(null);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [wrongFlash, setWrongFlash] = useState<{ ko: number; en: number } | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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
    // Scheduled once: a re-render with a new `onFinish` must not finish the step twice.
    if (finishTimer.current !== null) return;
    if (matched.size === pairs.length && pairs.length > 0) {
      finishTimer.current = setTimeout(() => {
        markStepComplete();
        onFinish();
      }, FINISH_DELAY_MS);
    }
  }, [matched, pairs.length, markStepComplete, onFinish]);

  // Leaving the game (Back, Skip, the end) stops both timers.
  useEffect(
    () => () => {
      if (flashTimer.current !== null) clearTimeout(flashTimer.current);
      if (finishTimer.current !== null) clearTimeout(finishTimer.current);
    },
    [],
  );

  const stopFlash = (): void => {
    if (flashTimer.current !== null) clearTimeout(flashTimer.current);
    flashTimer.current = null;
    setWrongFlash(null);
  };

  const pick = (card: CardPick): void => {
    if (matched.has(card.idx)) return;
    if (card.side === 'ko') hear(card.idx);
    // The selected card again: a bounce or a double tap keeps the pick (and a running flash) as it is.
    if (samePick(selected, card)) return;
    stopFlash();
    if (selected === null || selected.side === card.side) {
      setSelected(card);
      return;
    }
    const koIdx = card.side === 'ko' ? card.idx : selected.idx;
    const enIdx = card.side === 'en' ? card.idx : selected.idx;
    if (koIdx === enIdx) {
      success();
      answerRound(pairRoundKey(koIdx), true, askedPair(pairs, koIdx));
      setMatched(new Set([...matched, koIdx]));
      setSelected(null);
      return;
    }
    nudge();
    answerRound(pairRoundKey(koIdx), false, askedPair(pairs, koIdx));
    setWrongFlash({ ko: koIdx, en: enIdx });
    const missed = selected;
    flashTimer.current = setTimeout(() => {
      flashTimer.current = null;
      setWrongFlash(null);
      setSelected((current) => (current !== null && samePick(missed, current) ? null : current));
    }, WRONG_FLASH_MS);
  };

  const cardStyle = (state: { matched: boolean; selected: boolean; wrong: boolean }) => ({
    minHeight: touchTarget.min,
    justifyContent: 'center' as const,
    padding: cardPadding,
    borderRadius: radii.lg,
    backgroundColor: state.matched
      ? colors.feedback.successLight
      : state.selected
        ? colors.brand.primaryLight
        : state.wrong
          ? colors.feedback.nudgeLight
          : colors.surface.paper,
    borderWidth: borderWidth.base,
    borderColor: state.matched
      ? colors.feedback.success
      : state.selected
        ? colors.brand.primary
        : state.wrong
          ? colors.feedback.nudge
          : colors.border.subtle,
    opacity: state.matched ? 0.5 : 1,
  });

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
            const isSelected = samePick(selected, { side: 'ko', idx: p.idx });
            const isWrong = wrongFlash?.ko === p.idx;
            return (
              <Pressable
                key={`ko-${p.idx}`}
                testID={`card-match-ko-${p.idx}`}
                onPress={() => pick({ side: 'ko', idx: p.idx })}
                accessibilityRole="button"
                accessibilityLabel={m.a11y.minigame.koreanWord(p.romanization ?? p.ko)}
                accessibilityState={{ selected: isSelected, disabled: isMatched }}
                aria-selected={isSelected}
                disabled={isMatched}
                style={cardStyle({ matched: isMatched, selected: isSelected, wrong: isWrong })}
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
            const isSelected = samePick(selected, { side: 'en', idx: p.idx });
            const isWrong = wrongFlash?.en === p.idx;
            return (
              <Pressable
                key={`en-${p.idx}`}
                testID={`card-match-en-${p.idx}`}
                onPress={() => pick({ side: 'en', idx: p.idx })}
                accessibilityRole="button"
                accessibilityLabel={m.a11y.minigame.meaning(p.en)}
                accessibilityState={{ selected: isSelected, disabled: isMatched }}
                aria-selected={isSelected}
                disabled={isMatched}
                style={cardStyle({ matched: isMatched, selected: isSelected, wrong: isWrong })}
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

      {/* Hoya's "now its meaning" fits a Korean pick only; a meaning picked first needs no new line (AMENDMENTS-TOUCH section 9). */}
      {selected?.side === 'ko' && !matched.has(selected.idx) ? (
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
