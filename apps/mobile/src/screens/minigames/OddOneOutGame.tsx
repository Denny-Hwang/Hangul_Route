import {
  Body,
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
} from '@hangul-route/design-system';
import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useMessages } from '../../i18n/use-messages';
import { jamoTileA11yLabel } from '../../logic/korean-labels';
import { gameArrangement, tileGridWidth } from '../../logic/layout/game-layout';
import type { MinigameScope } from '../../logic/minigame-config';
import { buildOddOneOutRounds, type OddOneOutRound } from '../../logic/round-builder';
import { nudge, success, tapLight } from '../../platform/haptics';
import { useQuestRunStore } from '../../store/quest-run-store';
import { GameColumns } from './GameColumns';

interface Props {
  scope: MinigameScope;
  onFinish: () => void;
}

export function OddOneOutGame({ scope, onFinish }: Props): React.ReactElement {
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
  const gridWidth = tileGridWidth(layoutClass.width, tile, spacing.md);

  const round = rounds[roundIdx];
  if (!round) {
    return (
      <Screen>
        <Body>{copy.noRounds}</Body>
      </Screen>
    );
  }

  const handleTap = (jamoId: string): void => {
    if (feedback === 'correct') return;
    if (jamoId === round.oddJamo.id) {
      tapLight();
      success();
      answerRound(roundIdx, true);
      setFeedback('correct');
      setTimeout(() => {
        if (roundIdx >= rounds.length - 1) {
          markStepComplete();
          onFinish();
        } else {
          setRoundIdx(roundIdx + 1);
          setFeedback('idle');
          setLockedWrongIds([]);
        }
      }, 700);
    } else {
      nudge();
      answerRound(roundIdx, false);
      setFeedback('wrong');
      setLockedWrongIds([...lockedWrongIds, jamoId]);
    }
  };

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
          <>
            <Heading level="prompt">{copy.oddOneOut.heading}</Heading>
            <Spacer size="xs" />
            <Body tone="secondary">{copy.oddOneOut.instruction}</Body>
          </>
        }
        answers={
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
                  accessibilityLabel={jamoTileA11yLabel(j.romanization, m.a11y.tile)}
                  onPress={() => handleTap(j.id)}
                />
              );
            })}
          </View>
        }
        feedback={
          feedback === 'wrong' ? (
            <>
              <Spacer size="lg" />
              <HoyaBubble tone="thinking" message={copy.oddOneOut.lookAgain} />
            </>
          ) : null
        }
      />
      <Spacer size="xl" />
    </Screen>
  );
}
