import { Body, Button, ConfirmSheet, Screen, Spacer } from '@hangul-route/design-system';
import type { MinigameKind } from '@hangul-route/content-schema';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { flags } from '../../config/flags';
import { questById } from '../../content';
import { useLocale, useMessages } from '../../i18n/use-messages';
import { RomanizationCheckScope } from '../../i18n/use-romanization-mode';
import { localizeQuest, localizeScope } from '../../logic/content-locale';
import { gameFlagOf, playedScope as fallbackScope } from '../../logic/game-fallback';
import { holdsRomanization } from '../../logic/locale/check-hold';
import { gameFinishIsReported, minigameFinishedEvent } from '../../logic/minigame-finished';
import { scopeFor, type MinigameScope } from '../../logic/minigame-config';
import { resolveOptionalExit, resolveScreenExits, type ScreenExitProps } from '../../logic/navigation/screen-exits';
import { playedScope } from '../../logic/role-play/fallback';
import { patternNoteOf } from '../../logic/sentence-builder/view';
import type { RootStackParamList } from '../../navigation/types';
import { stop } from '../../platform/audio';
import { track } from '../../platform/telemetry';
import { useQuestRunStore } from '../../store/quest-run-store';
import { useActiveLearnerId } from '../../store/active-learner';
import { useCurrFlag, useFrozenCurrFlag } from '../../store/remote-config-store';
import { BackGuardScopeContext, useBackGuardScope } from '../use-back-guard';
import { usePracticeSession } from '../use-practice-session';
import { BuildLetterGame } from './BuildLetterGame';
import { CardMatchGame } from './CardMatchGame';
import { ClozePickStep } from './cloze-pick-entry';
import { CultureQuizGame } from './CultureQuizGame';
import type { MinigameHost } from './host';
import { HiddenHeritageStep } from './hidden-heritage-entry';
import { ListenPickGame } from './ListenPickGame';
import { MatchSoundGame } from './MatchSoundGame';
import { OddOneOutGame } from './OddOneOutGame';
import { PicWordMatchGame } from './PicWordMatchGame';
import { RealiaReadGame } from './realia-read-entry';
import { SentenceBuilderGame } from './sentence-builder-entry';
import { StoryCheckGame } from './StoryCheckGame';
import { StoryReadGame } from './StoryReadGame';
import { StorySequenceGame } from './StorySequenceGame';
import { StoryOrderStep } from './story-order/StoryOrderStep';
import { MatchShapeStep } from './match-shape-entry';
import { SyllableBuildStep } from './syllable-build-entry';
import { TapRespondGame } from './TapRespondGame';
import { TraceStrokeGame } from './TraceStrokeGame';
import { TraceWordGame } from './trace-word-entry';
import { TypeHangulGame, WriteFrameGame } from './writing-entry';
import { VoiceEchoGame } from './VoiceEchoGame';
import { useSwitchedScope } from './dictation-entry';
import { RolePlayStep } from './role-play/role-play-entry';
import { MyStoryRoute } from './my-story-entry';
import { LaterNeedsInternet, LessonWaiting, combinedChunkState, useLessonQuestState } from '../lesson-content';
import { useStoryQuestState } from '../story-content';
import { useLessonClips } from '../../platform/audio-assets-store';

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
  const state = combinedChunkState(useLessonQuestState(props.route.params.questId), useStoryQuestState(questById(props.route.params.questId)));
  // The game's clip packs (AMENDMENTS-AUDIO-CLIPS AC-B6), also when it is opened straight (a resume, a reload).
  useLessonClips(props.route.params.questId, props.route.params.episodeId);
  // One body per step: the step's `game.<kind>` switches and its dictation chunk are decided once, as it opens (row CM-31).
  const { questId, stepIndex } = props.route.params;
  // A later volume that is not on the device and cannot load (row CM-5B) says so calmly, with a way back.
  if (state === 'needs-internet') {
    const nav = props.navigation;
    return <LaterNeedsInternet onBack={props.onBack ?? (nav === undefined ? undefined : () => nav.goBack())} />;
  }
  return state === 'ready' ? <MinigameBody key={`${questId}:${stepIndex}`} {...props} /> : <LessonWaiting />;
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
  const rolePlayStep = ref !== undefined && scopeFor(ref)?.kind === 'role-play';
  const waitsForSwitch = rolePlayOn === null && rolePlayStep;
  // Only a role-play step's scope depends on the switch, so every other game keeps its rounds when the read lands.
  const playsRolePlay = rolePlayStep && rolePlayOn === true;
  // Pairs, step labels and dialogue lines in the UI language (F-I18N-001 §3.6); memoised so a
  // game's rounds are not rebuilt (and reshuffled) on every render.
  const localized = useMemo(() => {
    // A strong round earlier in the cell plays this Apply one round shorter (F-CURR-002 section 4.6, row CM-24).
    const { questId: running, short } = useQuestRunStore.getState();
    const source = running === questId && short?.step === stepIndex ? short.scope : ref ? scopeFor(ref) : undefined;
    const scoped = source && ref ? localizeScope(source, ref, locale) : source;
    return scoped && playedScope(scoped, playsRolePlay);
  }, [ref, locale, questId, stepIndex, playsRolePlay]);
  // A new format's `game.<kind>` switch (F-CURR-002 §12.2): off, the step plays its fallback round of a shipped kind
  // (My Story: Write Frame on the first frame, row CM-38), and `minigame.finished` names the kind that was played.
  // The step decides once, when it opens: a remote copy that lands mid-step never swaps the game under the learner.
  const gameOnNow = useCurrFlag(gameFlagOf(localized?.kind ?? 'write-frame'));
  const [gameOn] = useState(gameOnNow);
  const ownScope = useMemo(() => (localized ? fallbackScope(localized, () => gameOn) : undefined), [localized, gameOn]);
  // A game whose chunk cannot load plays its fallback instead (My Story: Write Frame on the first frame); answers and
  // `minigame.finished` then go with the scope that was played (review of PR #849).
  const fellBackTo = useRef<MinigameScope | null>(null);
  const onFallback = useCallback((played: MinigameScope): void => {
    fellBackTo.current = played;
  }, []);
  // The `game.<kind>` switches, decided as the step opens, and the dictation chunk when a round plays from it (row CM-31).
  const switched = useSwitchedScope(ownScope);
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

  // [LR] AMENDMENTS-QUEST-LEAVE-RESUME LR-1 (section 3.1): a back on a game that has an answer asks first. The learner and
  // guest stacks only (they pass `navigation`), never the All lessons preview, never a story-read step (its bookmark keeps
  // the scene). "Has an answer" is `answersGiven` now against what it was when this step's body mounted (one body per step).
  const guarding = navigation !== undefined && !inPreview && scope?.kind !== 'story-read';
  const [answersAtOpen] = useState(() => useQuestRunStore.getState().answersGiven);
  const answered = useQuestRunStore((state) => state.answersGiven) > answersAtOpen;
  const [asking, setAsking] = useState(false);
  const askingNow = useRef(false);
  const ask = useCallback((value: boolean): void => {
    askingNow.current = value;
    setAsking(value);
  }, []);
  // The screen's own exits (a game that ends, Back to quest on an empty game) pass the guard: set before each of them.
  const leaving = useRef(false);
  const exitBack = (): void => {
    // One way out per body: a double tap on Leave, or a game's finish after Leave, goes back once.
    if (leaving.current) return;
    leaving.current = true;
    exits.back();
  };
  const gameBack = (): boolean => {
    if (!guarding || leaving.current) return false;
    // A back while the sheet is open is Keep playing: it closes, never a second sheet.
    if (askingNow.current) {
      ask(false);
      return true;
    }
    if (useQuestRunStore.getState().answersGiven <= answersAtOpen) return false;
    // The sheet stops the game's sound as leaving does; Keep playing does not start it again (the speaker plays it).
    stop();
    ask(true);
    return true;
  };
  // Where the screen does not guard (the All lessons preview, a story-read step) it names no state, so the owner leaves the
  // gesture alone; a guard a game adds (Story Check's recap) still answers through the owner.
  const backScope = useBackGuardScope(gameBack, guarding ? answered : undefined);
  const leaveCopy = useMessages().learner.quest.leave;

  // [QB] AMENDMENTS-QUEST-SOUND-BACK QB-3: `minigame.finished` goes out once per step per run. A game played again on a
  // step shown after Previous sends nothing; a skipped game played after all sends it then, for the first time.
  const finishIsSent = (): boolean => gameFinishIsReported(useQuestRunStore.getState(), questId, stepIndex);
  const close = (): void => {
    if (scope && finishIsSent()) {
      void track(minigameFinishedEvent(fellBackTo.current?.kind ?? renderedKind.current ?? scope.kind, questId, stepIndex, activeProfileId));
    }
    exitBack();
  };
  /**
   * A switch played another kind's rounds (Story Order's fallback, row CM-34; a switched-off format's fallback, Listen &
   * Pick on the block, row CM-32, or Read Pick, row CM-33): the event names the game that played.
   */
  const closeAs = (played: MinigameKind): void => {
    if (played === scope?.kind) return close();
    if (finishIsSent()) void track(minigameFinishedEvent(played, questId, stepIndex, activeProfileId));
    exitBack();
  };

  // Every non-game state keeps a way out (wireframe minigame/shell: no dead ends).
  const fallback = (message: string): ReactElement => (
    <Screen>
      <Body>{message}</Body>
      <Spacer size="lg" />
      <Button label={copy.backToQuest.cta} tone="secondary" size="md" onPress={exitBack} />
    </Screen>
  );

  // [LR] Every frame the screen draws (a waiting frame, Back to quest, the game) sits in the guard scope with the sheet, so
  // a guard a game adds later (Story Check's recap) answers through the owner whatever mounted first.
  const drawn = (): ReactElement => {
    if (waitsForSwitch || switched?.kind === 'loading') return <LessonWaiting />;
    if (!quest || !step || !scope) {
      return fallback(copy.notFound);
    }

    // The quest host for the games that take one (F-QUEST-002 §3.12): answers go to the run store
    // (first answer per round scores), `complete` ends the step as the older games do.
    // `played` is the scope the game plays: the step's own, or a fallback's (rows CM-32 and CM-33), whose rounds name what was asked.
    const hostFor = (played: typeof scope): MinigameHost => ({
      mode: step.kind === 'check' ? 'check' : 'quest',
      // What the round asked goes with the answer, for the memory store (F-CURR-002 row CM-12); a preview records nothing.
      answer: (roundKey, correct, meta) =>
        useQuestRunStore
          .getState()
          .answerRound(
            roundKey,
            correct,
            inPreview || meta?.itemId === undefined ? undefined : { scope: fellBackTo.current ?? played, itemId: meta.itemId, ...(meta.hinted === true ? { hinted: true } : {}) },
            // F-CURR-002 section 4.3: Type Hangul's hint (Dictation's Show how it sounds, or a typed answer one letter off,
            // row CM-31) is a hinted right answer whatever it scored; the other games' hints (Story Order's Show meanings,
            // row CM-34; Role Play's, row CM-35; Syllable Build's Show how it sounds, row CM-32) are help shown, so a wrong
            // answer with one is still a plain miss (row CM-3A S6).
            meta?.hinted === true && (correct || (fellBackTo.current ?? played).kind === 'type-hangul'),
          ),
      complete: () => {
        useQuestRunStore.getState().markStepComplete();
        closeAs(played.kind);
      },
    });
    const host = hostFor(scope);

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
        return <ListenPickGame key={kit === null ? 'plain' : 'kit'} scope={scope} host={host} onBack={exitBack} spelling={kit} />;
      case 'pic-word-match':
        return <PicWordMatchGame scope={scope} host={host} onBack={exitBack} />;
      case 'tap-respond':
        // No host (it records through the run store itself): a quest Check holds the romanization and the glosses until the right reply (DC-1c).
        return <TapRespondGame scope={scope} onFinish={close} hold={holdsRomanization(step.kind === 'check' ? 'quest-check' : 'practice')} />;
      case 'story-read':
        return <StoryReadGame scope={scope} onFinish={close} onBack={exitBack} onOpenCultureNote={openCultureNote} />;
      case 'story-check':
        return <StoryCheckGame scope={scope} onFinish={close} />;
      case 'order-it':
        return <SentenceBuilderGame scope={scope} host={host} patternNote={patternNote} onBack={exitBack} />;
      case 'realia-read':
        return <RealiaReadGame scope={scope} host={host} onBack={exitBack} />;
      case 'type-hangul':
        // Keyed on the chunk, so the game never changes its hooks while mounted (the chunk is fixed for its life).
        return <TypeHangulGame key={kit === null ? 'plain' : 'kit'} scope={scope} host={host} onBack={exitBack} hear={kit} />;
      case 'trace-word':
        return <TraceWordGame scope={scope} host={host} onBack={exitBack} />;
      case 'write-frame':
        return <WriteFrameGame scope={scope} host={host} onBack={exitBack} inPreview={inPreview} />;
      // F-CURR-002 row CM-30: the game behind `game.cloze-pick`, else its Listen & Pick fallback.
      case 'cloze-pick':
        return <ClozePickStep scope={scope} host={host} onBack={exitBack} onRendered={(kind) => (renderedKind.current = kind)} />;
      // F-CURR-002 row CM-34: behind `game.story-order`; off, its rounds play as Story Sequence (text cards).
      case 'story-order':
        return <StoryOrderStep scope={scope} host={host} sequenceId={ref ?? ''} onFallbackFinish={() => closeAs('story-sequence')} />;
      case 'role-play':
        return <RolePlayStep scope={scope} host={host} onBack={exitBack} />;
      case 'hidden-heritage':
        return <HiddenHeritageStep scope={scope} host={host} onBack={exitBack} />;
      // F-CURR-002 row CM-32: from its own chunk; Listen & Pick on the block while `game.syllable-build` is off.
      case 'syllable-build':
        return <SyllableBuildStep scope={scope} hostFor={hostFor} onBack={exitBack} />;
      // F-CURR-002 row CM-33: from its own chunk; Read Pick while `game.match-shape` is off.
      case 'match-shape':
        return <MatchShapeStep scope={scope} hostFor={hostFor} onBack={exitBack} />;
      case 'my-story':
        return <MyStoryRoute scope={scope} host={host} onBack={exitBack} onFallback={onFallback} />;
      default:
        return fallback(copy.comingSoon);
    }
  };

  return (
    <BackGuardScopeContext.Provider value={backScope}>
      {/* A quest's Check reads the romanization `check` mode (RF section 3.7); the one wrapper, shared with DC's hold. */}
      <RomanizationCheckScope active={step?.kind === 'check'}>{drawn()}</RomanizationCheckScope>
      {guarding ? (
        <ConfirmSheet
          visible={asking}
          title={copy.leave.title}
          message={copy.leave.message}
          cancelLabel={leaveCopy.keep.cta}
          confirmLabel={leaveCopy.confirm.cta}
          onCancel={() => ask(false)}
          onConfirm={exitBack}
          testID="minigame-leave"
        />
      ) : null}
    </BackGuardScopeContext.Provider>
  );
}
