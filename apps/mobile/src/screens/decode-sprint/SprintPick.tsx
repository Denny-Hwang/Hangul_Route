import { Body, ChoiceCard, Heading, Icon, KoreanText, borderWidth, colors, radii, spacing, touchTarget, type ChoiceCardState } from '@hangul-route/design-system';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { Pressable, View } from 'react-native';
import { PromptPanel } from '../../components/PromptPanel';
import { VoiceHelpSheet } from '../../components/VoiceHelpSheet';
import { usePromptSlot } from '../../components/use-prompt-slot';
import { useMessages } from '../../i18n/use-messages';
import type { PickRoundPlan } from '../../logic/syllable-build/sprint';
import { playPrompt, stop } from '../../platform/audio';
import { nudge, success, tapLight } from '../../platform/haptics';

/**
 * A Block Sprint pick round (F-CURR-002 section 7.1 F9, row CM-32): hear a real block, tap how it is written. Listen &
 * Pick on the block, the format the sprint shares with Syllable Build's fallback; a quick round, as the Speed round's:
 * one tap, then the answer shows (the right card checked; a tapped miss amber with the dash, never red, never an X) and
 * the round moves on by itself. The options show the Korean only, so the round is read, never matched by romanization.
 * With no device voice the prompt is the romanization (`bap`) with the sound notice, and the learner finds the block.
 */

/** How long the answer shows before the next round: a right answer, a miss. */
export const RIGHT_REVEAL_MS = 600;
export const MISS_REVEAL_MS = 1000;

interface Props {
  round: PickRoundPlan;
  /** The first tap: right or not. The sprint holds its clock from here. */
  onAnswer: (correct: boolean) => void;
  /** The answer has shown: on to the next round. */
  onDone: () => void;
  testID?: string;
}

export function SprintPick({ round, onAnswer, onDone, testID = 'sprint-pick' }: Props): ReactElement {
  const m = useMessages();
  const slot = usePromptSlot({ source: 'decoding-sprint' });
  const { play } = slot;
  const [helpOpen, setHelpOpen] = useState(false);
  const [tapped, setTapped] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const done = useRef(onDone);
  done.current = onDone;

  const say = useCallback(() => {
    void play(() => playPrompt({ text: round.target, kind: 'word', source: 'decoding-sprint' }));
  }, [play, round.target]);

  useEffect(() => {
    say();
    return () => {
      if (timer.current) clearTimeout(timer.current);
      stop();
    };
    // Once per round: the round is keyed by its place in the sprint.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tap = (ko: string): void => {
    if (tapped !== null) return;
    setTapped(ko);
    const right = ko === round.target;
    if (right) {
      tapLight();
      success();
    } else nudge();
    onAnswer(right);
    timer.current = setTimeout(() => done.current(), right ? RIGHT_REVEAL_MS : MISS_REVEAL_MS);
  };

  const stateOf = (ko: string): ChoiceCardState => {
    if (tapped === null) return 'idle';
    if (ko === round.target) return 'correct';
    return ko === tapped ? 'wrong' : 'disabled';
  };
  const option = m.a11y.minigame.option;
  const labelOf = (ko: string): string => {
    const s = stateOf(ko);
    return s === 'correct' ? option.correct(ko) : s === 'wrong' ? option.wrong(ko) : ko;
  };
  const speakerLabel = slot.view.reason === 'muted' || slot.view.reason === 'blocked' ? slot.view.speakerLabel : m.a11y.minigame.hearAgain;

  return (
    <View testID={testID} style={{ gap: spacing.md }}>
      <Heading level="prompt">{m.learner.minigame.listenPick.heading}</Heading>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Pressable
          testID={`${testID}-speaker`}
          onPress={say}
          accessibilityRole="button"
          accessibilityLabel={speakerLabel}
          style={{
            width: touchTarget.min,
            height: touchTarget.min,
            borderRadius: radii.pill,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.brand.secondaryLight,
            borderColor: colors.brand.secondary,
            borderWidth: borderWidth.base,
          }}
        >
          <Icon name="speaker" size={spacing.xl} color={colors.brand.secondaryDark} />
        </Pressable>
        <View accessibilityLiveRegion="polite" style={{ flex: 1 }}>
          {tapped !== null ? (
            <KoreanText ko={round.target} romanization={round.romanization} size="md" testID={`${testID}-answer`} />
          ) : slot.view.textShown ? (
            // No sound: the learner reads the sound and finds its block, so only the romanization is shown.
            <Body weight="bold" testID={`${testID}-sound`}>
              {round.romanization}
            </Body>
          ) : null}
        </View>
      </View>
      {slot.view.textShown ? <PromptPanel view={slot.view} onAction={(action) => slot.act(action, say)} onHelp={() => setHelpOpen(true)} testID={`${testID}-prompt`} /> : null}
      <VoiceHelpSheet visible={helpOpen} onClose={() => setHelpOpen(false)} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
        {round.options.map((ko) => (
          <View key={ko} style={{ flexGrow: 1, flexBasis: '45%', minWidth: touchTarget.hero }}>
            <ChoiceCard
              testID={`${testID}-option-${ko}`}
              state={stateOf(ko)}
              wrongMark="dash"
              ko={ko}
              accessibilityLabel={labelOf(ko)}
              onPress={() => tap(ko)}
            />
          </View>
        ))}
      </View>
    </View>
  );
}
