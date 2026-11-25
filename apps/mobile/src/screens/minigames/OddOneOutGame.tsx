import {
  Body,
  Button,
  Heading,
  HoyaBubble,
  Pill,
  Progress,
  Screen,
  Spacer,
  Tile,
  spacing,
  touchTarget,
  useLayoutClass,
  useMediaSize,
  TapBoard,
} from '@hangul-route/design-system';
import { a11yRomanization } from '@hangul-route/content-schema';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { View } from 'react-native';
import { useSoundPacing } from '../../components/use-sound-pacing';
import { useMessages } from '../../i18n/use-messages';
import { afterMiss, afterRightAnswer, answerOptionLabel } from '../../logic/answer-feedback';
import { jamoTileA11yLabel } from '../../logic/korean-labels';
import { gameArrangement, tileGridWidth } from '../../logic/layout/game-layout';
import type { MinigameScope } from '../../logic/minigame-config';
import { buildOddOneOutRounds, type OddOneOutRound } from '../../logic/round-builder';
import { nudge, success, tapLight } from '../../platform/haptics';
import { useQuestRunStore } from '../../store/quest-run-store';
import { AnswerAnnouncer } from './answer-announcer';
import { GameColumns } from './GameColumns';
import { useAnswerAnnouncement } from './use-answer-announcement';
import { useRoundNext } from './use-round-next';

interface Props {
  scope: MinigameScope;
  onFinish: () => void;
}

export function OddOneOutGame({ scope, onFinish }: Props): ReactElement {
  const rounds = useMemo<OddOneOutRound[]>(
    () => buildOddOneOutRounds({ scopeJamoIds: scope.jamoIds ?? [], rounds: scope.rounds ?? 4 }),
    [scope],
  );

  const m = useMessages();
  const copy = m.learner.minigame;
  const answerRound = useQuestRunStore((s) => s.answerRound);
  const markStepComplete = useQuestRunStore((s) => s.markStepComplete);

  const [roundIdx, setRoundIdx] = useState(0);
  const [feedback, setFeedback] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const [lockedWrongIds, setLockedWrongIds] = useState<string[]>([]);
  // F-LAYOUT-001 §3.6: tiles scale with the window; prompt left, tiles right on a wide landscape window.
  const layoutClass = useLayoutClass();
  const tile = useMediaSize(touchTarget.hero);
  const gridWidth = tileGridWidth(layoutClass, tile, spacing.md);

  // F-A11Y-001 AF-4a: each result is said once, by the answer announcer; with a screen reader on a right answer shows Next.
  const a = useAnswerAnnouncement();
  const { clear, focusPrompt } = a;
  const next = useRoundNext();
  // The wait after a right answer is paced and dropped when the game is left (it was a bare `setTimeout`).
  const pacing = useSoundPacing();
  /** The round last moved on from: a second Next (or a late wait) for the same round does nothing (the last round ends the step once). */
  const movedFrom = useRef(-1);
  // A new round empties the announcer and, with a reader on, moves focus to the round's header node (§3.4).
  useEffect(() => {
    clear();
    if (roundIdx > 0) focusPrompt();
  }, [roundIdx, clear, focusPrompt]);

  const round = rounds[roundIdx];
  if (!round) {
    return (
      <Screen>
        <Body>{copy.noRounds}</Body>
      </Screen>
    );
  }

  const last = roundIdx >= rounds.length - 1;
  const advance = (): void => {
    if (movedFrom.current === roundIdx) return;
    movedFrom.current = roundIdx;
    next.hide();
    if (last) {
      markStepComplete();
      onFinish();
    } else {
      setRoundIdx(roundIdx + 1);
      setFeedback('idle');
      setLockedWrongIds([]);
    }
  };

  /** A tile's sound value: what the announcer and an answered tile's name call it (never its Hangul). */
  const soundOf = (romanization: string): string => a11yRomanization(romanization, m.a11y.romanizationOr);

  const handleTap = (jamoId: string): void => {
    // A locked wrong tile takes no tap (AMENDMENTS-TOUCH R3): a bounce on it is never another miss, nudge or replay.
    if (feedback === 'correct' || lockedWrongIds.includes(jamoId)) return;
    const tapped = round.tiles.find((j) => j.id === jamoId);
    const item = soundOf(tapped?.romanization ?? '');
    if (jamoId === round.oddJamo.id) {
      tapLight();
      success();
      answerRound(roundIdx, true);
      setFeedback('correct');
      const say = (): Promise<void> => a.announce({ kind: 'right', item });
      // OD-AF2 (b): at least the result floor, on `pacing.after`, so the wait is dropped when the game is left. A reader on
      // waits for Next instead (OD-AF9 (b)), the last round included.
      void afterRightAnswer({
        readerOn: a.readerOn,
        gameMinMs: 700,
        announce: a.readerOn ? () => next.afterFocus(say) : say,
        showNext: next.show,
        waitThenAdvance: (minMs) => void pacing.after(minMs, advance),
      });
    } else {
      nudge();
      answerRound(roundIdx, false);
      setFeedback('wrong');
      setLockedWrongIds([...lockedWrongIds, jamoId]);
      afterMiss({ readerOn: a.readerOn, announce: () => a.announce({ kind: 'missHint', item, hint: copy.oddOneOut.lookAgain }) });
    }
  };

  // The round's header node (§3.4): the heading and the instruction; no Hangul, no button.
  const roundLabel = m.a11y.answer.round(roundIdx + 1, rounds.length, `${copy.oddOneOut.heading} ${copy.oddOneOut.instruction}`);

  return (
    <Screen tone="canvas">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <Progress value={roundIdx + 1} max={rounds.length} tone="primary" />
        </View>
        <Pill label={copy.progress.pill(roundIdx + 1, rounds.length)} tone="neutral" size="sm" />
      </View>

      <Spacer size="lg" />
      <GameColumns
        arrangement={gameArrangement(layoutClass)}
        prompt={
          <View ref={a.promptRef} testID="odd-one-out-round" accessible accessibilityRole="header" accessibilityLabel={roundLabel}>
            <Heading level="prompt">{copy.oddOneOut.heading}</Heading>
            <Spacer size="xs" />
            <Body tone="secondary">{copy.oddOneOut.instruction}</Body>
          </View>
        }
        answers={
          <>
          <TapBoard lock="board">
            {/* One board for the tiles (AMENDMENTS-TOUCH section 6, row KT-3): a graze still counts, a bounce never counts twice, and a locked wrong tile takes no tap (R3). */}
            <View
              testID="odd-one-out-tiles"
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                justifyContent: 'center',
                gap: spacing.md,
                ...(gridWidth !== undefined ? { width: gridWidth, alignSelf: 'center' } : null),
              }}
            >
              {round.tiles.map((j) => {
                let state: 'idle' | 'correct' | 'wrong' | 'disabled' = 'idle';
                if (lockedWrongIds.includes(j.id)) state = 'wrong';
                if (feedback === 'correct' && j.id === round.oddJamo.id) state = 'correct';
                return (
                  <Tile
                    key={j.id}
                    label={j.char}
                    romanization={j.romanization}
                    state={state}
                    size="lg"
                    dimension={tile}
                    accessibilityLabel={
                      state === 'idle'
                        ? jamoTileA11yLabel(j.romanization, m.a11y.tile, m.a11y.romanizationOr)
                        : answerOptionLabel(state === 'correct' ? 'correct' : 'wrong', soundOf(j.romanization), m.a11y.minigame.option)
                    }
                    locked={state !== 'idle'}
                    testID={`odd-one-out-tile-${j.id}`}
                    onPress={() => handleTap(j.id)}
                  />
                );
              })}
            </View>
          </TapBoard>
          {next.shown ? (
            <>
              <Spacer size="lg" />
              <Button
                pressableRef={next.nextRef}
                label={copy.trace.next.cta}
                tone="primary"
                size="hero"
                fullWidth
                onPress={advance}
                testID="odd-one-out-next"
              />
            </>
          ) : null}
          </>
        }
        feedback={
          feedback === 'wrong' ? (
            <>
              <Spacer size="lg" />
              {/* The announcer says the result once, so this result bubble is not a live region too (§3.3). */}
              <HoyaBubble tone="thinking" message={copy.oddOneOut.lookAgain} live={false} />
            </>
          ) : null
        }
      />
      <AnswerAnnouncer line={a.line} />
      <Spacer size="xl" />
    </Screen>
  );
}
