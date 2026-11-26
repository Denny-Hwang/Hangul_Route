import {
  Body,
  Button,
  Caption,
  Card,
  ChoiceCard,
  Heading,
  HoyaBubble,
  Icon,
  Pill,
  Progress,
  Screen,
  Spacer,
  colors,
  spacing,
  TapBoard,
} from '@hangul-route/design-system';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { View } from 'react-native';
import { PromptPanel } from '../../components/PromptPanel';
import { VoiceHelpSheet } from '../../components/VoiceHelpSheet';
import { usePromptSlot } from '../../components/use-prompt-slot';
import { useSoundPacing } from '../../components/use-sound-pacing';
import { useMessages } from '../../i18n/use-messages';
import { afterMiss, afterRightAnswer, answerItem, answerOptionLabel } from '../../logic/answer-feedback';
import { replyOptionLabel } from '../../logic/korean-labels';
import { koSpeech } from '../../logic/audio/ko-speech';
import { tapRespondTurnView } from '../../logic/tap-respond-look';
import { ADVANCE_MAX_MS, ADVANCE_MIN_MS, afterSound } from '../../logic/audio/reply-advance';
import type { MinigameScope } from '../../logic/minigame-config';
import { playPrompt, stop } from '../../platform/audio';
import { nudge, success, tapLight } from '../../platform/haptics';
import { useAudioStore } from '../../store/audio-store';
import { useQuestRunStore } from '../../store/quest-run-store';
import { AnswerAnnouncer } from './answer-announcer';
import { HeldText } from './held-line';
import { useAnswerAnnouncement } from './use-answer-announcement';
import { useRoundNext } from './use-round-next';

interface Props {
  scope: MinigameScope;
  onFinish: () => void;
  /**
   * A quest Check (AMENDMENTS-STAGE1-DECODING-CHECK section 3.3, row DC-1c): the NPC line's romanization and every reply's
   * romanization and meaning are held until the turn's right reply. Tap Respond has no host (it records through the run
   * store itself), so it takes a boolean, not a host. Default `false`: practice.
   */
  hold?: boolean;
}

export function TapRespondGame({ scope, onFinish, hold = false }: Props): ReactElement {
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
  // F-A11Y-001 AF-2: each result is said once, by the answer announcer; with a screen reader on a right reply shows Next.
  const a = useAnswerAnnouncement();
  const { clear, focusPrompt } = a;
  const next = useRoundNext();
  const mounted = useRef(false);
  /** The turn last moved on from: a second Next for the same turn does nothing, and a reply is not started after it (reader on). */
  const movedFrom = useRef(-1);
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

  const pacing = useSoundPacing();
  const hearLine = useCallback((): void => {
    if (!turn || replying.current) return;
    const line = { ko: turn.npcKo, spokenKo: turn.npcSpokenKo, audioRef: turn.npcAudioRef };
    const spec = koSpeech(line, 'sentence', 'tap-respond');
    void pacing.track(play(() => playPrompt(spec), spec));
  }, [turn, play, pacing]);

  // Each turn opens with the NPC line, said once. With sound switched off it waits for a tap, as on the
  // other A-5b screens, so a muted learner is not told "Sound is off" again on every turn.
  useEffect(() => {
    reset();
    if (useAudioStore.getState().muted) return;
    // [QS] AMENDMENTS-QUEST-SOUND-BACK QS-3: the first line waits for the screen; a tap on Hear it first drops it.
    if (turnIdx === 0) pacing.opening(hearLine);
    else hearLine();
  }, [hearLine, reset, turnIdx, pacing]);

  // A new turn empties the announcer and, with a reader on, moves focus to the turn's header node (§3.4).
  useEffect(() => {
    clear();
    if (turnIdx > 0) focusPrompt();
  }, [turnIdx, clear, focusPrompt]);

  if (!turn) {
    return (
      <Screen>
        <Body>{copy.tapRespond.noDialogue}</Body>
      </Screen>
    );
  }

  const view = tapRespondTurnView(turn, { hold, answered: feedback === 'correct' });
  const last = turnIdx >= turns.length - 1;
  const advance = (): void => {
    if (movedFrom.current === turnIdx) return;
    movedFrom.current = turnIdx;
    replying.current = false;
    next.hide();
    if (last) {
      markStepComplete();
      onFinish();
    } else {
      setTurnIdx(turnIdx + 1);
      setFeedback('idle');
      setLockedWrong([]);
    }
  };

  /** A reply is named by romanization and meaning, never its Hangul (§3.2); with no romanization, by its meaning alone. */
  const replyItem = (option: { romanization?: string; en: string }): string =>
    option.romanization ? answerItem(m.a11y, option.romanization, option.en) : option.en;

  const handleTap = (option: { ko: string; romanization?: string; en: string; spokenKo?: string; audioRef?: string }, isCorrect: boolean): void => {
    const { ko } = option;
    if (feedback === 'correct') return;
    if (isCorrect) {
      tapLight();
      success();
      answerRound(turnIdx, true, { texts: [turn.npcKo], rung: 'read' });
      setFeedback('correct');
      replying.current = true;
      const said = koSpeech(option, 'sentence', 'tap-respond');
      let reply: Promise<unknown> | null = null;
      const say = (): Promise<void> => a.announce({ kind: 'right', item: replyItem(option) });
      // The reply is said in full before the next line starts (a newer prompt would cut it off); OD-AF2 (b): at least the
      // result floor. A reader on hears the line first, then the reply, and waits for Next (OD-AF9 (b)).
      void afterRightAnswer({
        readerOn: a.readerOn,
        gameMinMs: ADVANCE_MIN_MS,
        announce: a.readerOn ? () => next.afterFocus(say) : say,
        play: () => {
          // A reader on may press Next before the line ends: the turn has moved on, so its reply is not started.
          if (movedFrom.current === turnIdx || !mounted.current) return;
          reply = pacing.track(play(() => playPrompt(said), said));
        },
        showNext: next.show,
        waitThenAdvance: (minMs) =>
          void afterSound(reply, { minMs, maxMs: ADVANCE_MAX_MS }).then(() => {
            replying.current = false;
            if (mounted.current) advance();
          }),
      });
    } else {
      nudge();
      answerRound(turnIdx, false, { texts: [turn.npcKo], rung: 'read' });
      setFeedback('wrong');
      setLockedWrong([...lockedWrong, ko]);
      afterMiss({ readerOn: a.readerOn, announce: () => a.announce({ kind: 'miss', item: replyItem(option) }) });
    }
  };

  // The turn's header node (§3.4): "Someone says" and the line, by romanization and meaning; Hear it stays outside it.
  const npcItem = turn.npcRomanization ? answerItem(m.a11y, turn.npcRomanization, turn.npcEn) : turn.npcEn;
  const turnLabel = m.a11y.answer.round(turnIdx + 1, turns.length, `${copy.tapRespond.someoneSays} ${npcItem}`);

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
        <View ref={a.promptRef} testID="tap-respond-round" accessible accessibilityRole="header" accessibilityLabel={turnLabel}>
          <Caption tone="muted">{copy.tapRespond.someoneSays}</Caption>
          <Spacer size="xs" />
          <Heading level="title">{turn.npcKo}</Heading>
          {view.npc.romanization !== '' ? (
            <Body tone="muted">{view.npc.romanization}</Body>
          ) : view.npc.romanizationHeld !== '' ? (
            <HeldText size="body" tone="muted">{view.npc.romanizationHeld}</HeldText>
          ) : null}
          <Spacer size="xxs" />
          <Body tone="secondary">{turn.npcEn}</Body>
        </View>
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
      <TapBoard lock="board" held={!slot.settled}>
        {/* One board for the answers (AMENDMENTS-TOUCH section 6, row KT-3): a graze still counts, a bounce never counts twice. */}
        <View style={{ gap: spacing.md }}>
          {turn.options.map((opt, i) => {
            const shown = view.options[i]!;
            const state = feedback === 'correct' && opt.isCorrect ? 'correct' : lockedWrong.includes(opt.ko) ? 'wrong' : 'idle';
            return (
              <ChoiceCard
                key={opt.ko}
                state={state}
                ko={opt.ko}
                // A held line (DC-1c) keeps its room, so the replies do not move when the right one is tapped.
                romanization={shown.romanizationHeld ? (opt.romanization ?? '') : shown.romanization}
                romanizationReserved={shown.romanizationHeld}
                gloss={opt.en}
                glossReserved={shown.glossHeld}
                accessibilityLabel={answerOptionLabel(state, replyOptionLabel(opt), m.a11y.minigame.option)}
                onPress={() => handleTap(opt, opt.isCorrect)}
                testID={`tap-respond-option-${opt.ko}`}
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
            testID="tap-respond-next"
          />
        </>
      ) : null}

      {feedback === 'wrong' ? (
        <>
          <Spacer size="lg" />
          {/* The announcer says the result once, so this result bubble is not a live region too (§3.3). */}
          <HoyaBubble tone="thinking" message={copy.tapRespond.tryAnother} live={false} />
        </>
      ) : null}
      <AnswerAnnouncer line={a.line} />
      <Spacer size="xl" />
    </Screen>
  );
}
