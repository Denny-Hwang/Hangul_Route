import { Body, Button, Screen, Spacer } from '@hangul-route/design-system';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useMemo } from 'react';
import { flags } from '../../config/flags';
import { questById } from '../../content';
import { useLocale, useMessages } from '../../i18n/use-messages';
import { localizeScope } from '../../logic/content-locale';
import { scopeFor } from '../../logic/minigame-config';
import type { RootStackParamList } from '../../navigation/types';
import { track } from '../../platform/telemetry';
import { useQuestRunStore } from '../../store/quest-run-store';
import { activeProfileSelector, useProfileStore } from '../../store/profile-store';
import { BuildLetterGame } from './BuildLetterGame';
import { CardMatchGame } from './CardMatchGame';
import { CultureQuizGame } from './CultureQuizGame';
import type { MinigameHost } from './host';
import { ListenPickGame } from './ListenPickGame';
import { MatchSoundGame } from './MatchSoundGame';
import { OddOneOutGame } from './OddOneOutGame';
import { PicWordMatchGame } from './PicWordMatchGame';
import { StoryCheckGame } from './StoryCheckGame';
import { StoryReadGame } from './StoryReadGame';
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
  const locale = useLocale();
  // Pairs, step labels and dialogue lines in the UI language (F-I18N-001 §3.6); memoised so a
  // game's rounds are not rebuilt (and reshuffled) on every render.
  const scope = useMemo(() => {
    const source = ref ? scopeFor(ref) : undefined;
    return source && ref ? localizeScope(source, ref, locale) : source;
  }, [ref, locale]);
  const activeProfileId = useProfileStore((s) => activeProfileSelector(s)?.id);
  const copy = useMessages().learner.minigame;

  const close = (): void => {
    if (scope) {
      void track({
        name: 'minigame.finished',
        profileId: activeProfileId,
        payload: { kind: scope.kind, questId, stepIndex },
      });
    }
    navigation.goBack();
  };

  // Every non-game state keeps a way out (wireframe minigame/shell: no dead ends).
  const fallback = (message: string): React.ReactElement => (
    <Screen>
      <Body>{message}</Body>
      <Spacer size="lg" />
      <Button label={copy.backToQuest.cta} tone="secondary" size="md" onPress={() => navigation.goBack()} />
    </Screen>
  );

  if (!quest || !step || !scope) {
    return fallback(copy.notFound);
  }

  // The quest host for the games that take one (F-QUEST-002 §3.12): answers go to the run store
  // (first answer per round scores), `complete` ends the step as the older games do.
  const host: MinigameHost = {
    mode: step.kind === 'check' ? 'check' : 'quest',
    answer: (roundKey, correct) => useQuestRunStore.getState().answerRound(roundKey, correct),
    complete: () => {
      useQuestRunStore.getState().markStepComplete();
      close();
    },
  };

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
      return <StorySequenceGame scope={scope} onFinish={close} sequenceId={ref} />;
    case 'voice-echo':
      if (!flags.voiceEchoEnabled) {
        return fallback(copy.voiceSoon);
      }
      return <VoiceEchoGame scope={scope} onFinish={close} />;
    case 'odd-one-out':
      return <OddOneOutGame scope={scope} onFinish={close} />;
    case 'culture-quiz':
      return <CultureQuizGame scope={scope} onFinish={close} />;
    case 'listen-pick':
      return <ListenPickGame scope={scope} host={host} onBack={() => navigation.goBack()} />;
    case 'pic-word-match':
      return <PicWordMatchGame scope={scope} host={host} onBack={() => navigation.goBack()} />;
    case 'tap-respond':
      return <TapRespondGame scope={scope} onFinish={close} />;
    case 'story-read':
      return <StoryReadGame scope={scope} onFinish={close} onBack={() => navigation.goBack()} />;
    case 'story-check':
      return <StoryCheckGame scope={scope} onFinish={close} />;
    default:
      return fallback(copy.comingSoon);
  }
}
