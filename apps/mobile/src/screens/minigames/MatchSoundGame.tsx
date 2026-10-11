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
  Tile,
  spacing,
  touchTarget,
  useLayoutClass,
  useMediaSize,
} from '@hangul-route/design-system';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { PromptPanel } from '../../components/PromptPanel';
import { VoiceHelpSheet } from '../../components/VoiceHelpSheet';
import { usePromptSlot } from '../../components/use-prompt-slot';
import { useMessages } from '../../i18n/use-messages';
import { wrongAnswerBubble, shouldAutoReplay } from '../../logic/audio/prompt-view';
import { spokenFor } from '../../logic/audio/spoken';
import { jamoTileA11yLabel } from '../../logic/korean-labels';
import { gameArrangement, tileGridWidth } from '../../logic/layout/game-layout';
import { buildMatchSoundRounds, type MatchSoundRound } from '../../logic/round-builder';
import type { MinigameScope } from '../../logic/minigame-config';
import { playJamo } from '../../platform/audio';
import { nudge, success, tapLight } from '../../platform/haptics';
import { useQuestRunStore } from '../../store/quest-run-store';
import { GameColumns } from './GameColumns';

interface Props {
  scope: MinigameScope;
  onFinish: () => void;
}

export function MatchSoundGame({ scope, onFinish }: Props): React.ReactElement {
  const rounds = useMemo<MatchSoundRound[]>(
    () =>
      buildMatchSoundRounds({
        scopeJamoIds: scope.jamoIds ?? [],
        rounds: scope.rounds ?? 4,
      }),
    [scope],
  );

  const m = useMessages();
  const answerRound = useQuestRunStore((s) => s.answerRound);
  const markStepComplete = useQuestRunStore((s) => s.markStepComplete);

  const [roundIdx, setRoundIdx] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);
  const [feedback, setFeedback] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const [lockedWrongIds, setLockedWrongIds] = useState<string[]>([]);
  const replayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // F-LAYOUT-001 §3.6: tiles scale with the window; prompt left, tiles right on a wide landscape window.
  const layoutClass = useLayoutClass();
  const tile = useMediaSize(touchTarget.hero);
  const gridWidth = tileGridWidth(layoutClass.width, tile, spacing.md);

  const round = rounds[roundIdx];
  // The sound of the letter (ga, never gi-yeok), or the same sound as text (F-AUDIO-004 AD1, §3.8).
  const slot = usePromptSlot({ source: 'match-sound' });
  const { view, play, reset } = slot;
  const viewRef = useRef(view);
  viewRef.current = view;

  const hear = (): Promise<unknown> | undefined => (round ? play(() => playJamo(round.promptJamo, 'sound')) : undefined);

  useEffect(() => {
    if (!round) return;
    setLockedWrongIds([]);
    setFeedback('idle');
    reset();
    void play(() => playJamo(round.promptJamo, 'sound'));
  }, [roundIdx, round, play, reset]);

  useEffect(() => {
    return () => {
      if (replayTimer.current) clearTimeout(replayTimer.current);
    };
  }, []);

  if (!round) {
    return (
      <Screen>
        <Body>{m.learner.minigame.noRounds}</Body>
      </Screen>
    );
  }

  const handleTap = (jamoId: string): void => {
    if (feedback === 'correct') return;
    if (jamoId === round.promptJamo.id) {
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
        }
      }, 700);
    } else {
      nudge();
      answerRound(roundIdx, false);
      setFeedback('wrong');
      setLockedWrongIds([...lockedWrongIds, jamoId]);
      if (replayTimer.current) clearTimeout(replayTimer.current);
      replayTimer.current = setTimeout(() => {
        if (shouldAutoReplay(viewRef.current)) void hear();
      }, 800);
    }
  };

  const spoken = spokenFor(round.promptJamo, 'sound');
  const bubble = wrongAnswerBubble(spoken, m.learner.audio);

  return (
    <Screen tone="canvas">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <Progress value={roundIdx + 1} max={rounds.length} tone="primary" />
        </View>
        <Pill label={m.learner.minigame.progress.pill(roundIdx + 1, rounds.length)} tone="neutral" size="sm" />
      </View>

      <Spacer size="lg" />
      <GameColumns
        arrangement={gameArrangement(layoutClass)}
        prompt={
          <>
            <Heading level="prompt">{view.heading}</Heading>
            <Spacer size="md" />

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, justifyContent: 'center' }}>
              <Pressable
                onPress={() => void hear()}
                accessibilityRole="button"
                accessibilityLabel={view.speakerLabel}
                testID="match-sound-speaker"
                hitSlop={spacing.md}
                style={{ padding: spacing.md }}
              >
                <Icon name="speaker" size={48} />
              </Pressable>
              <Caption tone="muted">{view.speakerCaption}</Caption>
            </View>

            <Spacer size="md" />
            <PromptPanel
              view={view}
              ko={spoken.text}
              romanization={spoken.romanization}
              onAction={(action) => slot.act(action, () => void hear())}
              onHelp={() => setHelpOpen(true)}
            />
            <VoiceHelpSheet visible={helpOpen} onClose={() => setHelpOpen(false)} />
          </>
        }
        answers={
          <View
            testID="match-sound-tiles"
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
              if (feedback === 'correct' && j.id === round.promptJamo.id) state = 'correct';
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
              <HoyaBubble
                tone="thinking"
                message={bubble.message}
                korean={bubble.korean}
                romanization={bubble.romanization}
                ctaInline={<Button label={m.learner.audio.hearIt.cta} tone="secondary" size="md" onPress={() => void hear()} />}
              />
            </>
          ) : null
        }
      />
      <Spacer size="xl" />
    </Screen>
  );
}
