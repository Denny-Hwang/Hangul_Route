import { Body, Button, Screen, Spacer } from '@hangul-route/design-system';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useMemo } from 'react';
import { flags } from '../../config/flags';
import { questById } from '../../content';
import { useLocale, useMessages } from '../../i18n/use-messages';
import { localizeQuest, localizeScope } from '../../logic/content-locale';
import { minigameFinishedEvent } from '../../logic/minigame-finished';
import { scopeFor } from '../../logic/minigame-config';
import { resolveOptionalExit, resolveScreenExits, type ScreenExitProps } from '../../logic/navigation/screen-exits';
import { patternNoteOf } from '../../logic/sentence-builder/view';
import type { RootStackParamList } from '../../navigation/types';
import { track } from '../../platform/telemetry';
import { useQuestRunStore } from '../../store/quest-run-store';
import { activeProfileSelector, useProfileStore } from '../../store/profile-store';
import { usePracticeSession } from '../use-practice-session';
import { BuildLetterGame } from './BuildLetterGame';
import { CardMatchGame } from './CardMatchGame';
import { CultureQuizGame } from './CultureQuizGame';
import type { MinigameHost } from './host';
import { ListenPickGame } from './ListenPickGame';
import { MatchSoundGame } from './MatchSoundGame';
import { OddOneOutGame } from './OddOneOutGame';
import { PicWordMatchGame } from './PicWordMatchGame';
import { RealiaReadGame } from './RealiaReadGame';
import { SentenceBuilderGame } from './SentenceBuilderGame';
import { StoryCheckGame } from './StoryCheckGame';
import { StoryReadGame } from './StoryReadGame';
import { StorySequenceGame } from './StorySequenceGame';
import { TapRespondGame } from './TapRespondGame';
import { TraceStrokeGame } from './TraceStrokeGame';
import { TypeHangulGame } from './TypeHangulGame';
import { VoiceEchoGame } from './VoiceEchoGame';
import { WriteFrameGame } from './WriteFrameGame';

/**
 * The learner stack passes `route` and `navigation`; another host (All lessons, F-BROWSE-001 §4.7)
 * passes `route` and the exits instead, so the screen never names a learner route there.
 */
type Props = {
  route: { params: RootStackParamList['Minigame'] };
  navigation?: Pick<NativeStackScreenProps<RootStackParamList, 'Minigame'>['navigation'], 'goBack' | 'push'>;
  /**
   * The story step's "More in Culture notes" (F-STORY-004 PR 4.7); the learner default pushes
   * `CultureNotes { noteId, from: 'quest' }` (Back only, so the quest run is never unwound).
   * `null`, or no learner stack, draws no button.
   */
  onOpenCultureNote?: ((noteId: string) => void) | null;
  /**
   * The grown-up preview (All lessons, F-BROWSE-001) hosts the game: the games keep their quest or
   * Check host mode, and Write Frame opens its name round on the cast name (F-CURR-001 §3.7).
   */
  inPreview?: boolean;
} & ScreenExitProps;

export function MinigameScreen({ route, navigation, onOpenCultureNote, inPreview = false, ...exitProps }: Props): React.ReactElement {
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
  // Sentence Builder shows the quest's own Discover pattern note again under a particle miss (F-CURR-001 §3.4).
  const patternNote = useMemo(() => (scope?.kind === 'order-it' && quest ? patternNoteOf(localizeQuest(quest, locale)) : undefined), [scope, quest, locale]);
  const activeProfileId = useProfileStore((s) => activeProfileSelector(s)?.id);
  // Practice time on the learner stack only (F-REPORT-001 section 3.3.2); inside a quest it joins the
  // quest's session. Another host (All lessons) passes no navigation and records nothing.
  usePracticeSession(activeProfileId, navigation ? `minigame:${questId}:${stepIndex}` : null);
  const copy = useMessages().learner.minigame;
  // Learner default: back to the quest player. A game has no home or link exit of its own.
  const learnerBack = (): void => navigation?.goBack();
  const exits = resolveScreenExits(exitProps, { back: learnerBack, home: learnerBack, openLink: () => undefined });
  const openCultureNote = resolveOptionalExit(
    onOpenCultureNote,
    navigation ? (noteId: string): void => navigation.push('CultureNotes', { noteId, from: 'quest' }) : undefined,
  );

  const close = (): void => {
    if (scope) {
      void track(minigameFinishedEvent(scope.kind, questId, stepIndex, activeProfileId));
    }
    exits.back();
  };

  // Every non-game state keeps a way out (wireframe minigame/shell: no dead ends).
  const fallback = (message: string): React.ReactElement => (
    <Screen>
      <Body>{message}</Body>
      <Spacer size="lg" />
      <Button label={copy.backToQuest.cta} tone="secondary" size="md" onPress={exits.back} />
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
      return <ListenPickGame scope={scope} host={host} onBack={exits.back} />;
    case 'pic-word-match':
      return <PicWordMatchGame scope={scope} host={host} onBack={exits.back} />;
    case 'tap-respond':
      return <TapRespondGame scope={scope} onFinish={close} />;
    case 'story-read':
      return <StoryReadGame scope={scope} onFinish={close} onBack={exits.back} onOpenCultureNote={openCultureNote} />;
    case 'story-check':
      return <StoryCheckGame scope={scope} onFinish={close} onBack={exits.back} />;
    case 'order-it':
      return <SentenceBuilderGame scope={scope} host={host} patternNote={patternNote} onBack={exits.back} />;
    case 'realia-read':
      return <RealiaReadGame scope={scope} host={host} onBack={exits.back} />;
    case 'type-hangul':
      return <TypeHangulGame scope={scope} host={host} onBack={exits.back} />;
    case 'write-frame':
      return <WriteFrameGame scope={scope} host={host} onBack={exits.back} inPreview={inPreview} />;
    default:
      return fallback(copy.comingSoon);
  }
}
