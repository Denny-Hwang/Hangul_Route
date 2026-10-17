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
import { koSpeech } from '../../logic/audio/ko-speech';
import { afterReply } from '../../logic/audio/reply-advance';
import type { MinigameScope } from '../../logic/minigame-config';
import { playPrompt, stop } from '../../platform/audio';
import { nudge, success, tapLight } from '../../platform/haptics';
import { useAudioStore } from '../../store/audio-store';
import { useQuestRunStore } from '../../store/quest-run-store';

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
  const mounted = useRef(false);
  // While a right reply is being said, nothing may start the NPC line again (it would cut the reply off).
  const replying = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      // Leaving mid-line (Back, or the last reply's onFinish) must not leave Korean playing over the next screen.
      stop();
    };
  }, []);

  const hearLine = useCallback((): void => {
    if (!turn || replying.current) return;
    const line = { ko: turn.npcKo, spokenKo: turn.npcSpokenKo, audioRef: turn.npcAudioRef };
    void play(() => playPrompt(koSpeech(line, 'sentence', 'tap-respond')));
  }, [turn, play]);

  // Each turn opens with the NPC line, said once. With sound switched off it waits for a tap, as on the
  // other A-5b screens, so a muted learner is not told "Sound is off" again on every turn.
  useEffect(() => {
    reset();
    if (!useAudioStore.getState().muted) hearLine();
  }, [hearLine, reset]);

  if (!turn) {
    return (
      <Screen>
        <Body>{copy.tapRespond.noDialogue}</Body>
      </Screen>
    );
  }

  const handleTap = (option: { ko: string; spokenKo?: string; audioRef?: string }, isCorrect: boolean): void => {
    const { ko } = option;
    if (feedback === 'correct') return;
    if (isCorrect) {
      tapLight();
      success();
      answerRound(turnIdx, true);
      setFeedback('correct');
      replying.current = true;
      const reply = play(() => playPrompt(koSpeech(option, 'sentence', 'tap-respond')));
      // The reply is said in full before the next line starts (a newer prompt would cut it off).
      void afterReply(reply).then(() => {
        replying.current = false;
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
            accessibilityLabel={m.a11y.minigame.hear(turn.npcRomanization ?? turn.npcKo)}
            disabled={feedback === 'correct'}
            onPress={hearLine}
            testID="tap-respond-hear"
          />
        </View>
      </Card>
      <Spacer size="sm" />
      <PromptPanel
        variant="status"
        view={slot.view}
        onAction={(action) => {
          if (!replying.current) slot.act(action, hearLine);
        }}
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
              onPress={() => handleTap(opt, opt.isCorrect)}
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
