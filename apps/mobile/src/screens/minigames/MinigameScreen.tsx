import { Body, Screen } from '@hangul-route/design-system';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { questById } from '../../content';
import { scopeFor } from '../../logic/minigame-config';
import type { RootStackParamList } from '../../navigation/types';
import { BuildLetterGame } from './BuildLetterGame';
import { CardMatchGame } from './CardMatchGame';
import { CultureQuizGame } from './CultureQuizGame';
import { MatchSoundGame } from './MatchSoundGame';
import { OddOneOutGame } from './OddOneOutGame';
import { StorySequenceGame } from './StorySequenceGame';
import { TapRespondGame } from './TapRespondGame';
import { TraceStrokeGame } from './TraceStrokeGame';
import { VoiceEchoGame } from './VoiceEchoGame';

type Props = NativeStackScreenProps<RootStackParamList, 'Minigame'>;

export function MinigameScreen({ route, navigation }: Props): React.ReactElement {
  const { questId, stepIndex } = route.params;
  const quest = questById(questId);
  const step = quest?.steps[stepIndex];
  const ref = step?.minigameRef;
  const scope = ref ? scopeFor(ref) : undefined;

  const close = (): void => navigation.goBack();

  if (!quest || !step || !scope) {
    return (
      <Screen>
        <Body>Minigame not found.</Body>
      </Screen>
    );
  }

  switch (scope.kind) {
    case 'match-sound':
      return <MatchSoundGame scope={scope} onFinish={close} />;
    case 'build-letter':
      return <BuildLetterGame scope={scope} onFinish={close} />;
    case 'trace-stroke':
      return <TraceStrokeGame scope={scope} onFinish={close} />;
    case 'card-match':
      return <CardMatchGame scope={scope} onFinish={close} />;
    case 'story-sequence':
      return <StorySequenceGame scope={scope} onFinish={close} />;
    case 'voice-echo':
      return <VoiceEchoGame scope={scope} onFinish={close} />;
    case 'odd-one-out':
      return <OddOneOutGame scope={scope} onFinish={close} />;
    case 'culture-quiz':
      return <CultureQuizGame scope={scope} onFinish={close} />;
    case 'tap-respond':
      return <TapRespondGame scope={scope} onFinish={close} />;
    default:
      return (
        <Screen>
          <Body>This minigame is coming soon.</Body>
        </Screen>
      );
  }
}
