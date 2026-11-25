import { Body, Button, ChoiceCard, Heading, HoyaBubble, KOREAN_LANGUAGE, KOREAN_LINE_BREAK, Pill, Screen, Spacer, colors, motion, spacing, typography, useLayoutClass, useTypeScale, type ChoiceCardState, TapBoard } from '@hangul-route/design-system';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { Text, View } from 'react-native';
import { findJamo } from '../../content/jamo';
import { useMessages } from '../../i18n/use-messages';
import { afterMiss, afterRightAnswer, answerOptionLabel } from '../../logic/answer-feedback';
import type { ReadPickOption } from '../../logic/match-shape/fallback';
import { soundSpoken } from '../../logic/match-shape/view';
import type { MinigameScope } from '../../logic/minigame-config';
import { shuffleSeeded } from '../../logic/story/seeded-order';
import { playJamo, stop } from '../../platform/audio';
import { useSoundPacing } from '../../components/use-sound-pacing';
import { nudge, success } from '../../platform/haptics';
import { AnswerAnnouncer } from './answer-announcer';
import type { MinigameHost } from './host';
import { useAnswerAnnouncement } from './use-answer-announcement';
import { useRoundNext } from './use-round-next';

/**
 * Read Pick, Match Shape's fallback round while `game.match-shape` is off (F-CURR-002 sections 7.1 F4 and 12.2, row
 * CM-33; design/wireframes/minigame/match-shape.md, Fallback round; board M3 of the variety mocks): see the letter,
 * pick its sound among 3 on the Listen & Pick option cards (`ChoiceCard`), the `sym` read rung. Its options keep
 * `read-pick-values-distinct` (`matchShapeToReadPick`). The first tap of a round is scored, at the read rung; a miss is
 * the amber nudge with Hoya's line and the round stays open; the right card says the letter's sound once and the next
 * round follows after a short pause. The letter alone is the prompt: no romanization is drawn under it, since that
 * would answer the round.
 *
 * Answer feedback (F-A11Y-001 row AF-4b): a right card shows `check` and a locked miss `replay`, each named with its state
 * first and never `disabled`; each result is said once by the answer announcer and Hoya's miss line is not live. The
 * next round waits for the sound and the 1000 ms result floor, reduced motion included (OD-AF2 (b): it asks for less
 * motion, not less time to see the mark); with a screen reader on, a right card shows Next (OD-AF9 (b)), the last round
 * included, and the round's header node takes focus.
 */

const koreanSpeech = { accessibilityLanguage: KOREAN_LANGUAGE, lang: KOREAN_LANGUAGE };

interface Props {
  scope: MinigameScope;
  host: MinigameHost;
  onBack?: () => void;
}

export function ReadPickGame({ scope, host, onBack }: Props): ReactElement {
  const m = useMessages();
  const copy = m.learner.minigame;
  const scale = useTypeScale().size;
  const lc = useLayoutClass();
  const [seed] = useState(() => Math.floor(Math.random() * 0x7fffffff));
  const rounds = useMemo(() => (scope.readPick?.rounds ?? []).map((r, i) => ({ ...r, options: shuffleSeeded(r.options, seed + i) })), [scope, seed]);
  const [index, setIndex] = useState(0);
  const [wrong, setWrong] = useState<readonly string[]>([]);
  const [solved, setSolved] = useState(false);
  const answered = useRef(false);
  // [QS] AMENDMENTS-QUEST-SOUND-BACK QS-4: the next round, or the end of the step, waits for the letter's sound (dropped with the screen).
  const pacing = useSoundPacing();
  const done = useRef(false);
  // F-A11Y-001 AF-4b: each result is said once, by the answer announcer; with a screen reader on a right card shows Next.
  const a = useAnswerAnnouncement();
  const { clear, focusPrompt } = a;
  const nextButton = useRoundNext();
  /** The round last moved on from: a second Next (or a late wait) for the same round does nothing (the last round ends the step once). */
  const movedFrom = useRef(-1);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      stop();
    };
  }, []);
  // A new round empties the announcer and, with a reader on, moves focus to the round's header node (§3.4).
  useEffect(() => {
    clear();
    if (index > 0) focusPrompt();
  }, [index, clear, focusPrompt]);

  const round = rounds[index];
  if (round === undefined) {
    return (
      <Screen>
        <Body>{copy.listenPick.empty}</Body>
        {onBack ? (
          <>
            <Spacer size="lg" />
            <Button label={copy.backToQuest.cta} tone="secondary" size="md" onPress={onBack} />
          </>
        ) : null}
      </Screen>
    );
  }
  const letter = findJamo(round.target);

  const next = (): void => {
    if (movedFrom.current === index) return;
    movedFrom.current = index;
    nextButton.hide();
    answered.current = false;
    setWrong([]);
    setSolved(false);
    if (index + 1 < rounds.length) setIndex(index + 1);
    else if (!done.current) {
      done.current = true;
      host.complete();
    }
  };

  /** A sound value as it is said: "g or k", never a slash (§3.2). */
  const spoken = (option: ReadPickOption): string => soundSpoken(option.sound, m.a11y.minigame.matchShape);

  const tap = (option: ReadPickOption): void => {
    if (solved) return;
    const right = option.id === round.answerId;
    if (!answered.current) {
      answered.current = true;
      host.answer(round.id, right, { itemId: round.id });
    }
    if (right) {
      success();
      setSolved(true);
      const say = (): Promise<void> => a.announce({ kind: 'right', item: spoken(option) });
      // Read Pick is a sound question (AMENDMENTS-AUDIO-CLIPS JV-A1, section 6.1): the learner saw the letter and picked
      // its sound, so the confirmation says the letter's sound syllable (ㄴ is na, ㅏ is a), never a name on a sound pick.
      // OD-AF2 (b): at least the result floor, reduced motion's 0 included. A reader on waits for Next instead (OD-AF9 (b)),
      // the last round included, and hears the line before the sound.
      void afterRightAnswer({
        readerOn: a.readerOn,
        gameMinMs: motion.duration.celebration,
        announce: a.readerOn ? () => nextButton.afterFocus(say) : say,
        play: () => {
          // A reader on may press Next before the line ends: the round has moved on, so its sound is not started.
          if (movedFrom.current === index || !mounted.current) return;
          pacing.track(letter ? playJamo(letter, 'sound') : undefined);
        },
        showNext: nextButton.show,
        waitThenAdvance: (minMs) => void pacing.after(minMs, next),
      });
    } else if (!wrong.includes(option.id)) {
      nudge();
      setWrong([...wrong, option.id]);
      afterMiss({ readerOn: a.readerOn, announce: () => a.announce({ kind: 'miss', item: spoken(option) }) });
    }
  };

  /** The card's name: the sound it stands for, with its state first once it is answered (§3.2). */
  const labelOf = (option: ReadPickOption, state: ChoiceCardState): string =>
    answerOptionLabel(state === 'correct' ? 'correct' : state === 'wrong' ? 'wrong' : 'idle', spoken(option), m.a11y.minigame.option);

  const stateOf = (option: ReadPickOption): ChoiceCardState => {
    if (option.id === round.answerId) return solved ? 'correct' : 'idle';
    return wrong.includes(option.id) ? 'wrong' : solved ? 'disabled' : 'idle';
  };

  return (
    <Screen tone="canvas" testID="read-pick-game">
      <Pill label={copy.progress.pill(index + 1, rounds.length)} size="sm" />
      <Spacer size="md" />
      {/* The round's header node (§3.4): the heading and the letter as it is on screen. The letter is read as a sound (never named). */}
      <View ref={a.promptRef} testID="read-pick-round" accessible accessibilityRole="header" accessibilityLabel={m.a11y.answer.round(index + 1, rounds.length, copy.matchShape.readPick.heading)}>
        <Heading level="prompt">{copy.matchShape.readPick.heading}</Heading>
      </View>
      <Spacer size="lg" />
      <View style={{ alignItems: 'center' }}>
        <Text {...KOREAN_LINE_BREAK} {...koreanSpeech} testID="read-pick-letter" style={{ fontFamily: typography.family.sansKr, fontSize: scale.hero, fontWeight: typography.weight.bold, color: colors.text.primary }}>
          {letter?.char ?? ''}
        </Text>
      </View>
      <Spacer size="lg" />
      <TapBoard lock="board">
        {/* One board for the answers (AMENDMENTS-TOUCH section 6, row KT-3): a graze still counts, a bounce never counts twice. */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {round.options.map((option) => {
            const state = stateOf(option);
            return (
              <View key={option.id} style={{ flexGrow: 1, flexBasis: lc.width === 'compact' ? '30%' : '20%', minWidth: 0 }}>
                <ChoiceCard
                  state={state}
                  label={option.sound}
                  onPress={() => tap(option)}
                  accessibilityLabel={labelOf(option, state)}
                  testID={`read-pick-option-${option.id}`}
                />
              </View>
            );
          })}
        </View>
      </TapBoard>
      {nextButton.shown ? (
        <>
          <Spacer size="lg" />
          <Button
            pressableRef={nextButton.nextRef}
            label={copy.trace.next.cta}
            tone="primary"
            size="hero"
            fullWidth
            onPress={next}
            testID="read-pick-next"
          />
        </>
      ) : null}
      <Spacer size="lg" />
      <View>
        {/* The announcer says the result once, so Hoya's miss line is not a live region too (§3.3). */}
        {wrong.length > 0 && !solved ? <HoyaBubble tone="thinking" message={copy.matchShape.readPick.miss} live={false} testID="read-pick-hoya" /> : null}
      </View>
      <AnswerAnnouncer line={a.line} />
    </Screen>
  );
}
