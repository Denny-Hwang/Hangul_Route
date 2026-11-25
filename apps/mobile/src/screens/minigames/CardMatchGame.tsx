import {
  Body,
  Button,
  Caption,
  Heading,
  HoyaBubble,
  Icon,
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
import { useMemo, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { Text, View } from 'react-native';
import { PromptPanel } from '../../components/PromptPanel';
import { VoiceHelpSheet } from '../../components/VoiceHelpSheet';
import { usePromptSlot } from '../../components/use-prompt-slot';
import { useSoundPacing } from '../../components/use-sound-pacing';
import { useMessages } from '../../i18n/use-messages';
import { afterRightAnswer, answerItem, answerOptionLabel } from '../../logic/answer-feedback';
import { CARD_MARK, PICK_RING, cardMatchStyle, cardTopPadding, type CardMatchState } from '../../logic/card-match-style';
import type { MinigameScope } from '../../logic/minigame-config';
import type { RoundAsked } from '../../logic/memory/asked';
import { pairRoundKey } from '../../logic/round-keys';
import { koSpeech } from '../../logic/audio/ko-speech';
import { playPrompt } from '../../platform/audio';
import { nudge, success } from '../../platform/haptics';
import { useQuestRunStore } from '../../store/quest-run-store';
import { AnswerAnnouncer } from './answer-announcer';
import { useAnswerAnnouncement } from './use-answer-announcement';
import { useRoundNext } from './use-round-next';

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
 * picked card again keeps it.
 *
 * A miss stays (F-A11Y-001 OD-AF6 (a), row AF-3; amends KT-4a): the meaning tried shows the miss look (amber and a
 * `replay`), is inactive and is named "Not this one: …", and stays while the same Korean word is picked; a second wrong
 * meaning for that word is marked too. The Korean pick is held (no timer lets it go, so none can un-select the next
 * pick), and Hoya shows `thinking` with a bubble that is not live, because the announcer says the result. The marks
 * clear when that word is matched or another Korean word is picked. A bounce on a marked meaning is not a second miss
 * (it is inactive).
 *
 * Right pairs: `check` on both cards at full opacity, inactive (never `disabled`), named "Right answer: …". Each result
 * is said once by the answer announcer. The last pair ends the step after the 1000 ms result floor with a screen reader
 * off, and with one on shows Next and waits for it (OD-AF9 (b)); no pair before it moves focus.
 *
 * Row KT-4b: both columns are `TapTarget`s on two `target` TapBoards (a graze still counts, a bounce on one card
 * never counts twice, a quick tap on a different card does), with the press look (section 4.3) on the drawn card, never
 * on the hit area. A meaning is `inactive` (claimed, no press look, still focusable) while no Korean card is picked, while
 * it shows a miss and once it is matched, so a no-op tap never looks chosen. The pair that ends the round also locks the
 * app-level clock (`lock(TAP_LOCK_MS)`, KT-D5), since the step then moves on.
 */

/** The hit area of a card: the full column width and at least the 64 floor (KT-D8); the drawn card fills it. */
const TARGET = { alignSelf: 'stretch', minHeight: touchTarget.min } as const;

/** Last pair matched -> the step completes (reader off; the result floor of OD-AF2 (b) is the least wait). */
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
  // The meanings tried for the picked Korean word, each marked until that word is matched or another word is picked.
  const [misses, setMisses] = useState<{ ko: number; en: readonly number[] } | null>(null);
  // [QS] AMENDMENTS-QUEST-SOUND-BACK QS-4: the step ends once a word that is still being said has ended.
  const pacing = useSoundPacing();
  const finishing = useRef(false);
  // F-A11Y-001 AF-3: each result is said once, by the answer announcer; with a screen reader on the last pair shows Next.
  const a = useAnswerAnnouncement();
  const { clear } = a;
  const next = useRoundNext();
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
    const spec = koSpeech(pair, 'word', 'card-match');
    void pacing.track(slot.play(() => playPrompt(spec), spec));
  };

  /** Ends the step once: the timed wait (reader off) and Next (reader on) both come here, and a second call does nothing. */
  const finish = (): void => {
    if (finishing.current) return;
    finishing.current = true;
    next.hide();
    markStepComplete();
    onFinish();
  };

  const pickKorean = (idx: number): void => {
    if (matched.has(idx)) return;
    hear(idx);
    // The picked card again: a bounce or a double tap keeps the pick and the marks of the meanings tried.
    if (selectedKo === idx) return;
    // Another word: the marks of the last one go, and so does its stale result line.
    setMisses(null);
    clear();
    setSelectedKo(idx);
  };

  const pickMeaning = (enIdx: number): void => {
    // Korean card first, as today: a meaning with no Korean pick does nothing and scores nothing.
    if (selectedKo === null || matched.has(selectedKo) || matched.has(enIdx)) return;
    // A meaning already marked for this word is `inactive`, so the board never commits it: a bounce on it is not a second miss.
    const pair = pairs[selectedKo];
    if (selectedKo === enIdx) {
      success();
      answerRound(pairRoundKey(selectedKo), true, askedPair(pairs, selectedKo));
      setMatched(new Set([...matched, selectedKo]));
      setSelectedKo(null);
      setMisses(null);
      // "Right answer: geune, swing." names the word and its meaning, never its Hangul (§3.2); with no romanization, the meaning.
      const item = pair?.romanization ? answerItem(m.a11y, pair.romanization, pair.en) : (pair?.en ?? '');
      const say = (): Promise<void> => a.announce({ kind: 'right', item });
      if (matched.size + 1 < pairs.length) {
        // A pair before the last: said once, no Next, focus stays where it is (§3.4).
        void say();
        return;
      }
      // The round-ending commit: the step moves on, so a bounce must not reach what comes next (KT-D5).
      appLock.lock(TAP_LOCK_MS);
      // OD-AF2 (b): at least the result floor. A reader on waits for Next instead (OD-AF9 (b)), the last pair included.
      void afterRightAnswer({
        readerOn: a.readerOn,
        gameMinMs: FINISH_DELAY_MS,
        announce: a.readerOn ? () => next.afterFocus(say) : say,
        showNext: next.show,
        waitThenAdvance: (minMs) => void pacing.after(minMs, finish),
      });
      return;
    }
    nudge();
    answerRound(pairRoundKey(selectedKo), false, askedPair(pairs, selectedKo));
    setMisses({ ko: selectedKo, en: misses?.ko === selectedKo ? [...misses.en, enIdx] : [enIdx] });
    // "Not a match: geune and sand. Try another." names the word by romanization; with none, only the meaning tried.
    const tried = pairs[enIdx]?.en ?? '';
    void a.announce(pair?.romanization ? { kind: 'notMatched', word: pair.romanization, meaning: tried } : { kind: 'miss', item: tried });
  };

  const cardState = (s: { matched: boolean; picked: boolean; wrong: boolean }): CardMatchState =>
    s.matched ? 'matched' : s.wrong ? 'wrong' : s.picked ? 'picked' : 'idle';

  // The drawn card; the press look (a thicker `border.shape` outline that grows inward, and the shrink) goes here, never
  // on the target the board measures. Full opacity in every state (the matched fade is gone); the top band holds the mark.
  const cardStyle = (state: CardMatchState, pressed: boolean) => {
    const look = cardMatchStyle(state);
    const inset = pressInset(pressed ? press : null, borderWidth.base);
    return {
      minHeight: touchTarget.min,
      justifyContent: 'center' as const,
      paddingTop: cardTopPadding(cardPadding) - inset,
      paddingBottom: cardPadding - inset,
      paddingHorizontal: cardPadding - inset,
      borderRadius: radii.lg,
      backgroundColor: look.backgroundColor,
      borderWidth: pressed ? press.borderWidth : borderWidth.base,
      borderColor: pressed ? press.borderColor : look.borderColor,
      transform: pressTransform(pressed ? press : null),
    };
  };

  /** The decorative mark in the card's top-end corner; the card's name carries the state. */
  const cardMark = (state: CardMatchState): ReactElement | null => {
    const mark = cardMatchStyle(state).mark;
    if (mark === null) return null;
    return (
      <View
        aria-hidden
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
        style={{ position: 'absolute', top: CARD_MARK.inset, right: CARD_MARK.inset, pointerEvents: 'none' }}
        testID={`card-match-mark-${mark.icon}`}
      >
        <Icon name={mark.icon} size={CARD_MARK.size} color={mark.color} />
      </View>
    );
  };

  const pickedMissed = selectedKo !== null && !matched.has(selectedKo) && misses?.ko === selectedKo;

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
                const state = cardState({ matched: isMatched, picked: isSelected, wrong: false });
                const name = m.a11y.minigame.koreanWord(p.romanization ?? p.ko);
                return (
                  // The picked card's solid second ring (AnswerFeedback D5): a wrapper with a negative margin, so it costs no
                  // layout and is no part of the hit area. Its padding and border always add up to the ring's width.
                  <View
                    key={`ko-${p.idx}`}
                    testID={`card-match-ko-ring-${p.idx}`}
                    style={{
                      pointerEvents: 'box-none',
                      margin: -PICK_RING.total,
                      padding: isSelected ? PICK_RING.gap : PICK_RING.total,
                      borderWidth: isSelected ? PICK_RING.width : 0,
                      borderColor: PICK_RING.color,
                      borderRadius: radii.lg + PICK_RING.total,
                    }}
                  >
                    <TapTarget
                      testID={`card-match-ko-${p.idx}`}
                      onCommit={() => pickKorean(p.idx)}
                      accessibilityLabel={answerOptionLabel(isMatched ? 'correct' : 'idle', name, m.a11y.minigame.option)}
                      accessibilityState={{ selected: isSelected }}
                      ariaSelected={isSelected}
                      // A matched card is claimed by the board and stays focusable: inactive, never `disabled` (§3.1).
                      inactive={isMatched}
                      style={TARGET}
                    >
                      {({ pressed }) => (
                        <View style={cardStyle(state, pressed)}>
                          <Text {...KOREAN_LINE_BREAK} style={{ fontSize: textScale.size.bodyLg, fontWeight: '700', color: colors.text.primary }}>
                            {p.ko}
                          </Text>
                          {p.romanization ? (
                            <Caption tone="secondary" style={{ fontStyle: 'italic' }}>
                              {p.romanization}
                            </Caption>
                          ) : null}
                          {cardMark(state)}
                        </View>
                      )}
                    </TapTarget>
                  </View>
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
                const isMarked = misses !== null && misses.ko === selectedKo && misses.en.includes(p.idx);
                const state = cardState({ matched: isMatched, picked: false, wrong: isMarked });
                const name = m.a11y.minigame.meaning(p.en);
                return (
                  <TapTarget
                    key={`en-${p.idx}`}
                    testID={`card-match-en-${p.idx}`}
                    onCommit={() => pickMeaning(p.idx)}
                    accessibilityLabel={answerOptionLabel(isMatched ? 'correct' : isMarked ? 'wrong' : 'idle', name, m.a11y.minigame.option)}
                    // With no Korean card picked, while this meaning shows a miss and once it is matched, a tap is a no-op: the
                    // board claims it with no press look, so it never looks chosen and then does nothing (F1). Never `disabled`.
                    inactive={selectedKo === null || isMarked || isMatched}
                    style={TARGET}
                  >
                    {({ pressed }) => (
                      <View style={cardStyle(state, pressed)}>
                        <Text {...KOREAN_LINE_BREAK} style={{ fontSize: textScale.size.bodyLg, fontWeight: '600', color: colors.text.primary }}>
                          {p.en}
                        </Text>
                        {cardMark(state)}
                      </View>
                    )}
                  </TapTarget>
                );
              })}
            </View>
          </TapBoard>
        </View>
      </View>

      {next.shown ? (
        <>
          <Spacer size="lg" />
          <Button
            pressableRef={next.nextRef}
            label={copy.trace.next.cta}
            tone="primary"
            size="hero"
            fullWidth
            onPress={finish}
            testID="card-match-next"
          />
        </>
      ) : null}

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
          {pickedMissed ? (
            // A miss: Hoya thinks. The announcer says the result once, so this bubble is not a live region too (§3.3).
            <HoyaBubble key="miss" tone="thinking" message={copy.cardMatch.tryAnother} live={false} />
          ) : (
            // The pick prompt is status, not a result: it stays live.
            <HoyaBubble key="idle" tone="idle" message={copy.cardMatch.nowMeaning} />
          )}
        </>
      ) : null}

      <AnswerAnnouncer line={a.line} />
      <Spacer size="xl" />
      <Button label={copy.skip.cta} tone="ghost" size="md" fullWidth onPress={() => { markStepComplete(); onFinish(); }} />
    </Screen>
  );
}
