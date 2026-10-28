import { Body, Button, Screen, Spacer } from '@hangul-route/design-system';
import type { MinigameKind } from '@hangul-route/content-schema';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { flags } from '../../config/flags';
import { questById } from '../../content';
import { useLocale, useMessages } from '../../i18n/use-messages';
import { localizeQuest, localizeScope } from '../../logic/content-locale';
import { minigameFinishedEvent } from '../../logic/minigame-finished';
import { scopeFor } from '../../logic/minigame-config';
import { resolveOptionalExit, resolveScreenExits, type ScreenExitProps } from '../../logic/navigation/screen-exits';
import { playedScope } from '../../logic/role-play/fallback';
import { patternNoteOf } from '../../logic/sentence-builder/view';
import type { RootStackParamList } from '../../navigation/types';
import { stop } from '../../platform/audio';
import { track } from '../../platform/telemetry';
import { useQuestRunStore } from '../../store/quest-run-store';
import { useActiveLearnerId } from '../../store/active-learner';
import { useFrozenCurrFlag } from '../../store/remote-config-store';
import { usePracticeSession } from '../use-practice-session';
import { BuildLetterGame } from './BuildLetterGame';
import { CardMatchGame } from './CardMatchGame';
import { ClozePickStep } from './cloze-pick-entry';
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
import { StoryOrderStep } from './story-order/StoryOrderStep';
import { TapRespondGame } from './TapRespondGame';
import { TraceStrokeGame } from './TraceStrokeGame';
import { TraceWordGame } from './TraceWordGame';
import { TypeHangulGame } from './TypeHangulGame';
import { VoiceEchoGame } from './VoiceEchoGame';
import { WriteFrameGame } from './WriteFrameGame';
import { useSwitchedScope } from './dictation-entry';
import { RolePlayStep } from './role-play/role-play-entry';
import { LessonWaiting, useLessonQuestReady } from '../lesson-content';
import { useStoryQuestReady } from '../story-content';

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

export function MinigameScreen(props: Props): ReactElement {
  // A lesson game's scope and its quest's steps come from the cell's chunk, and a story game's story from the
  // story's chunk (F-CURR-002 §10): until it is in, the screen draws only its header (and a calm status line if it
  // takes longer), so the way back is always there.
  const lessonReady = useLessonQuestReady(props.route.params.questId);
  const storyReady = useStoryQuestReady(questById(props.route.params.questId));
  // One body per step: the step's `game.<kind>` switches and its dictation chunk are decided once, as it opens (row CM-31).
  const { questId, stepIndex } = props.route.params;
  return lessonReady && storyReady ? <MinigameBody key={`${questId}:${stepIndex}`} {...props} /> : <LessonWaiting />;
}

function MinigameBody({ route, navigation, onOpenCultureNote, inPreview = false, ...exitProps }: Props): ReactElement {
  const { questId, stepIndex } = route.params;
  const quest = questById(questId);
  const step = quest?.steps[stepIndex];
  const ref = step?.minigameRef;
  const locale = useLocale();
  // `game.role-play` (F-CURR-002 section 12.2, row CM-35), read once the stored copy is in and then kept for the step,
  // so a config that arrives mid-step never swaps the game under the learner; off, a role-play step plays Tap to Respond
  // on the same turns. A role-play step waits for that read (a cold start reads off before it, which would freeze off).
  const rolePlayOn = useFrozenCurrFlag('game.role-play');
  const waitsForSwitch = rolePlayOn === null && ref !== undefined && scopeFor(ref)?.kind === 'role-play';
  // Pairs, step labels and dialogue lines in the UI language (F-I18N-001 §3.6); memoised so a
  // game's rounds are not rebuilt (and reshuffled) on every render.
  const localized = useMemo(() => {
    // A strong round earlier in the cell plays this Apply one round shorter (F-CURR-002 section 4.6, row CM-24).
    const { questId: running, short } = useQuestRunStore.getState();
    const source = running === questId && short?.step === stepIndex ? short.scope : ref ? scopeFor(ref) : undefined;
    const scoped = source && ref ? localizeScope(source, ref, locale) : source;
    return scoped && playedScope(scoped, rolePlayOn === true);
  }, [ref, locale, questId, stepIndex, rolePlayOn]);
  // The `game.<kind>` switches, decided as the step opens, and the dictation chunk when a round plays from it (row CM-31).
  const switched = useSwitchedScope(localized);
  const scope = switched?.kind === 'ready' ? switched.scope : undefined;
  const kit = switched?.kind === 'ready' ? switched.kit : null;
  // Sentence Builder shows the quest's own Discover pattern note again under a particle miss (F-CURR-001 §3.4).
  const patternNote = useMemo(() => (scope?.kind === 'order-it' && quest ? patternNoteOf(localizeQuest(quest, locale)) : undefined), [scope, quest, locale]);
  // [GU] The active learner: the guest's id in a guest run (AMENDMENTS-GUEST-FIRST-LESSON 5.3, row GU-3).
  const activeProfileId = useActiveLearnerId() ?? undefined;
  // Practice time on the learner stack only (F-REPORT-001 section 3.3.2); inside a quest it joins the
  // quest's session. Another host (All lessons) passes no navigation and records nothing.
  usePracticeSession(activeProfileId, navigation ? `minigame:${questId}:${stepIndex}` : null);
  const copy = useMessages().learner.minigame;
  // The kind a step drew when it is not its scope's (a switched-off Cloze Pick plays Listen & Pick, row CM-30).
  const renderedKind = useRef<MinigameKind | null>(null);
  // Leaving a game (Back, finishing it, Skip) stops a sound mid-way, whatever the game left running.
  useEffect(() => () => stop(), []);
  // Learner default: back to the quest player. A game has no home or link exit of its own.
  const learnerBack = (): void => navigation?.goBack();
  const exits = resolveScreenExits(exitProps, { back: learnerBack, home: learnerBack, openLink: () => undefined });
  const openCultureNote = resolveOptionalExit(
    onOpenCultureNote,
    navigation ? (noteId: string): void => navigation.push('CultureNotes', { noteId, from: 'quest' }) : undefined,
  );

  const close = (): void => {
    if (scope) {
      void track(minigameFinishedEvent(renderedKind.current ?? scope.kind, questId, stepIndex, activeProfileId));
    }
    exits.back();
  };
  /** A switch played another kind's rounds (Story Order's fallback, row CM-34): the event names the game that played. */
  const closeAs = (kind: MinigameKind): void => {
    void track(minigameFinishedEvent(kind, questId, stepIndex, activeProfileId));
    exits.back();
  };

  // Every non-game state keeps a way out (wireframe minigame/shell: no dead ends).
  const fallback = (message: string): ReactElement => (
    <Screen>
      <Body>{message}</Body>
      <Spacer size="lg" />
      <Button label={copy.backToQuest.cta} tone="secondary" size="md" onPress={exits.back} />
    </Screen>
  );

  if (waitsForSwitch || switched?.kind === 'loading') return <LessonWaiting />;
  if (!quest || !step || !scope) {
    return fallback(copy.notFound);
  }

  // The quest host for the games that take one (F-QUEST-002 §3.12): answers go to the run store
  // (first answer per round scores), `complete` ends the step as the older games do.
  const host: MinigameHost = {
    mode: step.kind === 'check' ? 'check' : 'quest',
    // What the round asked goes with the answer, for the memory store (F-CURR-002 row CM-12); a preview records nothing.
    answer: (roundKey, correct, meta) =>
      useQuestRunStore.getState().answerRound(roundKey, correct, inPreview || meta?.itemId === undefined ? undefined : { scope, itemId: meta.itemId }, meta?.hinted === true),
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
      return <ListenPickGame key={kit === null ? 'plain' : 'kit'} scope={scope} host={host} onBack={exits.back} spelling={kit} />;
    case 'pic-word-match':
      return <PicWordMatchGame scope={scope} host={host} onBack={exits.back} />;
    case 'tap-respond':
      return <TapRespondGame scope={scope} onFinish={close} />;
    case 'story-read':
      return <StoryReadGame scope={scope} onFinish={close} onBack={exits.back} onOpenCultureNote={openCultureNote} />;
    case 'story-check':
      return <StoryCheckGame scope={scope} onFinish={close} />;
    case 'order-it':
      return <SentenceBuilderGame scope={scope} host={host} patternNote={patternNote} onBack={exits.back} />;
    case 'realia-read':
      return <RealiaReadGame scope={scope} host={host} onBack={exits.back} />;
    case 'type-hangul':
      // Keyed on the chunk, so the game never changes its hooks while mounted (the chunk is fixed for its life).
      return <TypeHangulGame key={kit === null ? 'plain' : 'kit'} scope={scope} host={host} onBack={exits.back} hear={kit} />;
    case 'trace-word':
      return <TraceWordGame scope={scope} host={host} onBack={exits.back} />;
    case 'write-frame':
      return <WriteFrameGame scope={scope} host={host} onBack={exits.back} inPreview={inPreview} />;
    // F-CURR-002 row CM-30: the game behind `game.cloze-pick`, else its Listen & Pick fallback.
    case 'cloze-pick':
      return <ClozePickStep scope={scope} host={host} onBack={exits.back} onRendered={(kind) => (renderedKind.current = kind)} />;
    // F-CURR-002 row CM-34: behind `game.story-order`; off, its rounds play as Story Sequence (text cards).
    case 'story-order':
      return <StoryOrderStep scope={scope} host={host} sequenceId={ref ?? ''} onFallbackFinish={() => closeAs('story-sequence')} />;
    case 'role-play':
      return <RolePlayStep scope={scope} host={host} onBack={exits.back} />;
    default:
      return fallback(copy.comingSoon);
  }
}
