import {
  Body,
  Button,
  Caption,
  Card,
  Heading,
  HoyaBubble,
  Icon,
  Pill,
  Progress,
  Screen,
  Spacer,
  colors,
  spacing,
} from '@hangul-route/design-system';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { PromptPanel } from '../../components/PromptPanel';
import { VoiceHelpSheet } from '../../components/VoiceHelpSheet';
import { usePromptSlot } from '../../components/use-prompt-slot';
import { useMessages } from '../../i18n/use-messages';
import { replyOptionLabel } from '../../logic/korean-labels';
import type { MinigameScope } from '../../logic/minigame-config';
import { playPrompt } from '../../platform/audio';
import { nudge, success, tapLight } from '../../platform/haptics';
import { useQuestRunStore } from '../../store/quest-run-store';

/** The next turn waits at least this long after a right reply, and for the reply to be said. */
const ADVANCE_MIN_MS = 900;
/** Never wait longer than this for the reply to finish (the controller's own safety timeout is the real bound). */
const ADVANCE_MAX_MS = 6000;

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

interface Props {
  scope: MinigameScope;
  onFinish: () => void;
}

export function TapRespondGame({ scope, onFinish }: Props): React.ReactElement {
  const m = useMessages();
  const copy = m.learner.minigame;
  const turns = useMemo(() => scope.dialogue ?? [], [scope]);

  const answerRound = useQuestRunStore((s) => s.answerRound);
  const markStepComplete = useQuestRunStore((s) => s.markStepComplete);

  const [turnIdx, setTurnIdx] = useState(0);
  const [feedback, setFeedback] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const [lockedWrong, setLockedWrong] = useState<string[]>([]);

  const turn = turns[turnIdx];
  // The NPC line and the reply are printed on screen, so they are their own text; the panel only says
  // why they are silent (F-AUDIO-004 A-5b, audit F06 / AUD-13).
  const slot = usePromptSlot({ source: 'tap-respond', textOnScreen: true });
  const { play, reset } = slot;
  const [helpOpen, setHelpOpen] = useState(false);
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );

  const hearLine = useCallback((): void => {
    if (turn) void play(() => playPrompt({ text: turn.npcKo, kind: 'sentence', source: 'tap-respond' }));
  }, [turn, play]);

  // Each turn opens with the NPC line, said once.
  useEffect(() => {
    reset();
    hearLine();
  }, [hearLine, reset]);

  if (!turn) {
    return (
      <Screen>
        <Body>{copy.tapRespond.noDialogue}</Body>
      </Screen>
    );
  }

  const handleTap = (ko: string, isCorrect: boolean): void => {
    if (feedback === 'correct') return;
    if (isCorrect) {
      tapLight();
      success();
      answerRound(turnIdx, true);
      setFeedback('correct');
      const reply = play(() => playPrompt({ text: ko, kind: 'sentence', source: 'tap-respond' }));
      // The reply is said in full before the next line starts (a newer prompt would cut it off).
      void Promise.all([Promise.race([reply, delay(ADVANCE_MAX_MS)]), delay(ADVANCE_MIN_MS)]).then(() => {
        if (!mounted.current) return;
        if (turnIdx >= turns.length - 1) {
          markStepComplete();
          onFinish();
        } else {
          setTurnIdx(turnIdx + 1);
          setFeedback('idle');
          setLockedWrong([]);
        }
      });
    } else {
      nudge();
      answerRound(turnIdx, false);
      setFeedback('wrong');
      setLockedWrong([...lockedWrong, ko]);
    }
  };

  return (
    <Screen tone="canvas" scrollable>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <Progress value={turnIdx + 1} max={turns.length} tone="primary" />
        </View>
        <Pill label={copy.progress.pill(turnIdx + 1, turns.length)} tone="neutral" size="sm" />
      </View>

      <Spacer size="lg" />
      <Heading level="prompt">{copy.tapRespond.heading}</Heading>
      <Spacer size="md" />

      <Card padding="md">
        <Caption tone="muted">{copy.tapRespond.someoneSays}</Caption>
        <Spacer size="xs" />
        <Heading level="title">{turn.npcKo}</Heading>
        {turn.npcRomanization ? <Body tone="muted">{turn.npcRomanization}</Body> : null}
        <Spacer size="xxs" />
        <Body tone="secondary">{turn.npcEn}</Body>
        <Spacer size="sm" />
        <View style={{ alignSelf: 'flex-start' }}>
          <Button
            label={m.learner.audio.hearIt.cta}
            tone="secondary"
            size="md"
            leading={<Icon name="speaker" size={20} color={colors.text.onSecondary} />}
            onPress={hearLine}
            testID="tap-respond-hear"
          />
        </View>
      </Card>
      <Spacer size="sm" />
      <PromptPanel
        variant="status"
        view={slot.view}
        onAction={(action) => slot.act(action, hearLine)}
        onHelp={() => setHelpOpen(true)}
      />
      <VoiceHelpSheet visible={helpOpen} onClose={() => setHelpOpen(false)} />

      <Spacer size="lg" />
      <View style={{ gap: spacing.md }}>
        {turn.options.map((opt) => {
          const isWrongLocked = lockedWrong.includes(opt.ko);
          const showCorrect = feedback === 'correct' && opt.isCorrect;
          const tone = showCorrect ? 'success' : isWrongLocked ? 'nudge' : 'secondary';
          return (
            <Button
              key={opt.ko}
              label={replyOptionLabel(opt)}
              tone={tone}
              size="lg"
              fullWidth
              disabled={isWrongLocked}
              onPress={() => handleTap(opt.ko, opt.isCorrect)}
            />
          );
        })}
      </View>

      {feedback === 'wrong' ? (
        <>
          <Spacer size="lg" />
          <HoyaBubble tone="thinking" message={copy.tapRespond.tryAnother} />
        </>
      ) : null}
      <Spacer size="xl" />
    </Screen>
  );
}
