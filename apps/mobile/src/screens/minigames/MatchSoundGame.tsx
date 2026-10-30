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
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { Pressable, View } from 'react-native';
import { PromptPanel } from '../../components/PromptPanel';
import { VoiceHelpSheet } from '../../components/VoiceHelpSheet';
import { usePromptSlot } from '../../components/use-prompt-slot';
import { useMessages } from '../../i18n/use-messages';
import { clipRefsOf } from '../../logic/audio/clip-refs';
import { loneLetterQuestion, loneLetterVoice } from '../../logic/audio/jamo-lines';
import { wrongAnswerBubble, shouldAutoReplay } from '../../logic/audio/prompt-view';
import { jamoTileA11yLabel } from '../../logic/korean-labels';
import { gameArrangement, tileGridWidth } from '../../logic/layout/game-layout';
import { buildMatchSoundRounds, type MatchSoundRound } from '../../logic/round-builder';
import type { MinigameScope } from '../../logic/minigame-config';
import { hasClip, playJamo, warmClips } from '../../platform/audio';
import { nudge, success, tapLight } from '../../platform/haptics';
import { useQuestRunStore } from '../../store/quest-run-store';
import { GameColumns } from './GameColumns';

interface Props {
  scope: MinigameScope;
  onFinish: () => void;
}

export function MatchSoundGame({ scope, onFinish }: Props): ReactElement {
  const rounds = useMemo<MatchSoundRound[]>(
    () =>
      buildMatchSoundRounds({
        scopeJamoIds: scope.jamoIds ?? [],
        rounds: scope.rounds ?? 4,
        ...(scope.focusJamoIds ? { focusJamoIds: scope.focusJamoIds } : {}),
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
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // F-LAYOUT-001 §3.6: tiles scale with the window; prompt left, tiles right on a wide landscape window.
  const layoutClass = useLayoutClass();
  const tile = useMediaSize(touchTarget.hero);
  const gridWidth = tileGridWidth(layoutClass, tile, spacing.md);

  const round = rounds[roundIdx];
  // A letter question (AMENDMENTS-AUDIO-CLIPS JV-A1): the letter's name (ㄴ is 니은), or the same name as
  // text (§3.8). A final, never asked by name, says its closed syllable (안).
  const voice = round ? loneLetterVoice(round.promptJamo) : undefined;
  const slot = usePromptSlot({ source: 'match-sound', hasClip: hasClip(voice?.audioRef) });
  const { view, play, reset } = slot;
  const viewRef = useRef(view);
  viewRef.current = view;
  // `hear` reads the round on screen through a ref, so a replay scheduled on an earlier round can never say its prompt (M6).
  const roundRef = useRef(round);
  roundRef.current = round;

  const clearReplay = (): void => {
    if (replayTimer.current) clearTimeout(replayTimer.current);
    replayTimer.current = null;
  };

  const hear = (): Promise<unknown> | undefined => {
    const now = roundRef.current;
    return now ? play(() => playJamo(now.promptJamo, loneLetterQuestion(now.promptJamo))) : undefined;
  };

  useEffect(() => {
    if (!round) return;
    // A new round drops the replay the last one scheduled after a miss (M6).
    clearReplay();
    setLockedWrongIds([]);
    setFeedback('idle');
    reset();
    void play(() => playJamo(round.promptJamo, loneLetterQuestion(round.promptJamo)));
  }, [roundIdx, round, play, reset]);

  // Recordings for this game's letters are fetched and decoded before their round (§3.10).
  useEffect(() => {
    void warmClips(clipRefsOf(rounds.map((r) => loneLetterVoice(r.promptJamo))));
  }, [rounds]);

  useEffect(() => {
    return () => {
      if (replayTimer.current) clearTimeout(replayTimer.current);
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
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
      answerRound(roundIdx, true, { jamoIds: [round.promptJamo.id], rung: 'recognize' });
      setFeedback('correct');
      // Answered: the replay a miss just scheduled would say this prompt again over the next round (M6).
      clearReplay();
      advanceTimer.current = setTimeout(() => {
        advanceTimer.current = null;
        if (roundIdx >= rounds.length - 1) {
          markStepComplete();
          onFinish();
        } else {
          setRoundIdx(roundIdx + 1);
        }
      }, 700);
    } else {
      nudge();
      answerRound(roundIdx, false, { jamoIds: [round.promptJamo.id], rung: 'recognize' });
      setFeedback('wrong');
      setLockedWrongIds([...lockedWrongIds, jamoId]);
      clearReplay();
      replayTimer.current = setTimeout(() => {
        replayTimer.current = null;
        if (shouldAutoReplay(viewRef.current)) void hear();
      }, 800);
    }
  };

  const spoken = loneLetterVoice(round.promptJamo);
  const bubble = wrongAnswerBubble(round.promptJamo, m.learner.audio);

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
              ko={spoken.shown}
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
                  testID={`match-sound-tile-${j.id}`}
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
                testID="match-sound-bubble"
                tone="thinking"
                message={bubble.message}
                {...(bubble.korean === undefined ? {} : { korean: bubble.korean })}
                {...(bubble.romanization === undefined ? {} : { romanization: bubble.romanization })}
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
