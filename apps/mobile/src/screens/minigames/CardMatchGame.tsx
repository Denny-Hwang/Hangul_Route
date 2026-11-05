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
  TAP_LOCK_MS,
  TapBoard,
  TapTarget,
  borderWidth,
  colors,
  radii,
  spacing,
  touchTarget,
  typography,
  useMediaSize,
  KOREAN_LINE_BREAK,
  pressInset,
  pressTransform,
  usePressLook,
  useTapLock,
  useTypeScale,
} from '@hangul-route/design-system';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { Text, View } from 'react-native';
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
 * Touch (AMENDMENTS-TOUCH 6.2, row KT-4a): a Korean card first, then its meaning, as the instruction says. A
 * meaning tapped with no Korean card picked is a no-op and scores nothing. Another Korean card moves the pick; the
 * picked card again keeps it. The wrong flash's timer is kept in a ref, cleared by any new pick and on unmount, and
 * when it fires it lets go only of the pick that missed (unless the child re-tapped it), so it never un-selects the
 * next pick. A bounce on the amber meaning of a miss, while it shows, is not a second miss.
 *
 * Row KT-4b: both columns are `TapTarget`s on two `target` TapBoards (a graze still counts, a bounce on one card
 * never counts twice, a quick tap on a different card does), with the press look (section 4.3) on the drawn card, never
 * on the hit area. A meaning is `inactive` (claimed, no press look, still focusable) while no Korean card is picked and
 * while it shows a miss's amber, so a no-op tap never looks chosen. The pair that ends the round also locks the app-level clock (`lock(TAP_LOCK_MS)`, KT-D5), since
 * the step then moves on.
 */

/** The hit area of a card: the full column width and at least the 64 floor (KT-D8); the drawn card fills it. */
const TARGET = { alignSelf: 'stretch', minHeight: touchTarget.min } as const;

/** A wrong pair stays amber this long; then the pick that missed is let go. */
const WRONG_FLASH_MS = 600;
/** Last pair matched -> the step completes. */
const FINISH_DELAY_MS = 800;

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

  const press = usePressLook();
  const appLock = useTapLock();
  const answerRound = useQuestRunStore((s) => s.answerRound);
  const markStepComplete = useQuestRunStore((s) => s.markStepComplete);

  const [selectedKo, setSelectedKo] = useState<number | null>(null);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [wrongFlash, setWrongFlash] = useState<{ ko: number; en: number } | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The Korean pick the running flash lets go of when it ends; a re-tap on that pick keeps it (sets this to null).
  const flashRelease = useRef<number | null>(null);
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
      flashTimer.current = null;
      finishTimer.current = null;
    },
    [],
  );

  const stopFlash = (): void => {
    if (flashTimer.current !== null) clearTimeout(flashTimer.current);
    flashTimer.current = null;
    flashRelease.current = null;
    setWrongFlash(null);
  };

  const pickKorean = (idx: number): void => {
    if (matched.has(idx)) return;
    hear(idx);
    // The picked card again: a bounce or a double tap keeps the pick and a running flash; during the flash it also
    // keeps the pick that missed past the flash, so a child who re-taps it to try again is not let go.
    if (selectedKo === idx) {
      flashRelease.current = null;
      return;
    }
    stopFlash();
    setSelectedKo(idx);
  };

  const pickMeaning = (enIdx: number): void => {
    // Korean card first, as today: a meaning with no Korean pick does nothing and scores nothing.
    if (selectedKo === null || matched.has(selectedKo) || matched.has(enIdx)) return;
    // The amber meaning of the miss just made, while it still shows: a bounce on it is not a second miss.
    if (flashTimer.current !== null && wrongFlash?.en === enIdx) return;
    stopFlash();
    if (selectedKo === enIdx) {
      success();
      answerRound(pairRoundKey(selectedKo), true, askedPair(pairs, selectedKo));
      setMatched(new Set([...matched, selectedKo]));
      setSelectedKo(null);
      // The round-ending commit: the step moves on, so a bounce must not reach what comes next (KT-D5).
      if (matched.size + 1 === pairs.length) appLock.lock(TAP_LOCK_MS);
      return;
    }
    nudge();
    answerRound(pairRoundKey(selectedKo), false, askedPair(pairs, selectedKo));
    setWrongFlash({ ko: selectedKo, en: enIdx });
    flashRelease.current = selectedKo;
    flashTimer.current = setTimeout(() => {
      const missed = flashRelease.current;
      flashTimer.current = null;
      flashRelease.current = null;
      setWrongFlash(null);
      setSelectedKo((current) => (missed !== null && current === missed ? null : current));
    }, WRONG_FLASH_MS);
  };

  // The drawn card; the press look (a thicker `border.shape` outline that grows inward, and the shrink) goes here, never
  // on the target the board measures.
  const cardStyle = (state: { matched: boolean; selected: boolean; wrong: boolean }, pressed: boolean) => ({
    minHeight: touchTarget.min,
    justifyContent: 'center' as const,
    padding: cardPadding - pressInset(pressed ? press : null, borderWidth.base),
    borderRadius: radii.lg,
    backgroundColor: state.matched
      ? colors.feedback.successLight
      : state.selected
        ? colors.brand.primaryLight
        : state.wrong
          ? colors.feedback.nudgeLight
          : colors.surface.paper,
    borderWidth: pressed ? press.borderWidth : borderWidth.base,
    borderColor: pressed
      ? press.borderColor
      : state.matched
        ? colors.feedback.success
        : state.selected
          ? colors.brand.primary
          : state.wrong
            ? colors.feedback.nudge
            : colors.border.subtle,
    opacity: state.matched ? 0.5 : 1,
    transform: pressTransform(pressed ? press : null),
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
        <View style={{ flex: 1 }}>
          <TapBoard lock="target" testID="card-match-ko-board">
            <View style={{ gap: spacing.sm }}>
              {koList.map((p) => {
                const isMatched = matched.has(p.idx);
                const isSelected = selectedKo === p.idx;
                const isWrong = wrongFlash?.ko === p.idx;
                return (
                  <TapTarget
                    key={`ko-${p.idx}`}
                    testID={`card-match-ko-${p.idx}`}
                    onCommit={() => pickKorean(p.idx)}
                    accessibilityLabel={m.a11y.minigame.koreanWord(p.romanization ?? p.ko)}
                    accessibilityState={{ selected: isSelected }}
                    ariaSelected={isSelected}
                    disabled={isMatched}
                    style={TARGET}
                  >
                    {({ pressed }) => (
                      <View style={cardStyle({ matched: isMatched, selected: isSelected, wrong: isWrong }, pressed)}>
                        <Text {...KOREAN_LINE_BREAK} style={{ fontSize: textScale.size.bodyLg, fontWeight: '700', color: colors.text.primary }}>
                          {p.ko}
                        </Text>
                        {p.romanization ? (
                          <Caption tone="secondary" style={{ fontStyle: 'italic' }}>
                            {p.romanization}
                          </Caption>
                        ) : null}
                      </View>
                    )}
                  </TapTarget>
                );
              })}
            </View>
          </TapBoard>
        </View>
        <View style={{ flex: 1 }}>
          <TapBoard lock="target" testID="card-match-en-board">
            <View style={{ gap: spacing.sm }}>
              {enList.map((p) => {
                const isMatched = matched.has(p.idx);
                const isWrong = wrongFlash?.en === p.idx;
                return (
                  <TapTarget
                    key={`en-${p.idx}`}
                    testID={`card-match-en-${p.idx}`}
                    onCommit={() => pickMeaning(p.idx)}
                    accessibilityLabel={m.a11y.minigame.meaning(p.en)}
                    disabled={isMatched}
                    // With no Korean card picked, or while this meaning shows a miss's amber, a tap is a no-op: the
                    // board claims it with no press look, so it never looks chosen and then does nothing (F1).
                    inactive={selectedKo === null || isWrong}
                    style={TARGET}
                  >
                    {({ pressed }) => (
                      <View style={cardStyle({ matched: isMatched, selected: false, wrong: isWrong }, pressed)}>
                        <Text {...KOREAN_LINE_BREAK} style={{ fontSize: textScale.size.bodyLg, fontWeight: '600', color: colors.text.primary }}>
                          {p.en}
                        </Text>
                      </View>
                    )}
                  </TapTarget>
                );
              })}
            </View>
          </TapBoard>
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
