import { useLayoutClass } from '@hangul-route/design-system';
import { CommonActions } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import { questById } from '../../content';
import { playerGuard } from '../../logic/episode-access';
import { isLaterVolumeQuest } from '../../logic/episode/volumes';
import { learnerQuestExits, learnerQuestSession, type QuestPlayerPorts } from '../../logic/quest-flow/quest-player-ports';
import { track } from '../../platform/telemetry';
import type { RootStackParamList } from '../../navigation/types';
import { useActiveLearnerId } from '../../store/active-learner';
import { holdLearnerSession } from '../../store/learner-session';
import { clearSavedRun, keepRunSaved, readSavedRun } from '../../store/quest-run-saved';
import { settledPlayerGuard } from '../../store/player-guard-settle';
import { useFrozenCurrFlag } from '../../store/remote-config-store';
import { useStoryStore } from '../../store/story-store';
import { useQuestAccess } from '../../store/tier-store';
import { LessonWaiting } from '../lesson-content';
import { QuestPlayerView } from './QuestPlayerView';
import { holdsCard, profileCompletesEpisode } from './reward-card-note';

type Props = NativeStackScreenProps<RootStackParamList, 'QuestPlayer'>;

/**
 * The learner's quest player: `QuestPlayerView` with the learner ports (F-BROWSE-001 BR-5a). A study
 * session runs for the active learner, a finished run resets to Results, and Leave returns to the
 * episode (its Journey pane on two panes, unless the quest was opened from another screen).
 * [GU] Row GU-3: the learner is `useActiveLearnerId()` (the guest's id in a guest run, AMENDMENTS-GUEST-FIRST-LESSON
 * section 5.3). The `Guest` stack plays its quest with the guest ports instead (`screens/guest/GuestQuestPlayer.tsx`,
 * section 7.1), which name no route outside that stack.
 * [AU] AMENDMENTS-AUDIT-2026-11 row AU-12: the run is kept on the device at each step change, so a quest left by a
 * reload goes on from its step when it is started again within 24 hours (`store/quest-run-saved.ts`); finishing it or
 * choosing Leave forgets it. The player itself has no screen and no word of its own for it.
 * [LR] AMENDMENTS-QUEST-LEAVE-RESUME row LR-2: Home's hero now says that the lesson goes on and offers Start again
 * (`screens/home/NextLessonCard.tsx`, `use-hero-resume.ts`); the saved run is read through `durableRead`.
 */
export function QuestPlayerScreen({ route, navigation }: Props): ReactElement | null {
  const { questId, episodeId, resume } = route.params;
  const learnerId = useActiveLearnerId();
  const { panes } = useLayoutClass();
  // The guard at the point of play (F-ENT-003 section 3.6), read on mount: a closed quest never
  // starts; the player replaces itself with the lesson page in preview. A quest that closes mid-run
  // (a lapse) keeps playing; the next open is guarded. A closed answer is checked again once the
  // learner's tier and memberships are read, so an owned quest is never sent to the preview because
  // the player mounted before those stores hydrated.
  const questOpen = useQuestAccess();
  const [guard, setGuard] = useState(() => playerGuard(questOpen, questId, episodeId));
  const [settled, setSettled] = useState(() => guard === null);
  useEffect(() => {
    if (settled) return undefined;
    let live = true;
    void settledPlayerGuard({ learnerId, questId, episodeId }).then((next) => {
      if (!live) return;
      setGuard(next);
      setSettled(true);
    });
    return () => {
      live = false;
    };
  }, [settled, learnerId, questId, episodeId]);
  // A later volume plays only while `volumes` is on (F-CURR-002 row CM-41 S2): the switch is read once it can be
  // decided and kept for the run, so a copy that arrives mid-run never stops it; while it is off the player shows the
  // episode page, which shows the cell's first volume.
  const laterVolume = isLaterVolumeQuest(questId, episodeId);
  const volumesOn = useFrozenCurrFlag('volumes');
  const volumeClosed = laterVolume && volumesOn === false;
  useEffect(() => {
    if (volumeClosed) navigation.replace('EpisodeDetail', { episodeId, from: 'player' });
  }, [volumeClosed, episodeId, navigation]);
  useEffect(() => {
    if (settled && guard && !volumeClosed) navigation.replace('EpisodeDetail', guard);
  }, [settled, guard, volumeClosed, navigation]);

  // [AU] Row AU-12: the run a reload interrupted, read once before the quest starts (`{ value }` once read; a read
  // that fails or stalls answers null, and the quest starts fresh).
  const [saved, setSaved] = useState<{ value: unknown } | null>(() => (learnerId === null ? { value: null } : null));
  useEffect(() => {
    if (learnerId === null) return undefined;
    let live = true;
    void readSavedRun(learnerId).then((value) => {
      if (live) setSaved({ value });
    });
    return () => {
      live = false;
    };
  }, [learnerId]);
  const savedRead = saved !== null;
  const savedValue = saved?.value ?? null;

  // Stable while the learner and the resume flag stay the same, so the run is not restarted.
  const session = useMemo(
    () =>
      learnerQuestSession({
        profileId: learnerId,
        resume,
        questById,
        bookmarkOf: (profileId, storyId) => useStoryStore.getState().getResumableBookmark(profileId, storyId),
        holdSession: holdLearnerSession,
        savedRun: savedValue,
      }),
    [learnerId, resume, savedValue],
  );

  // [AU] Row AU-12: from the moment the player shows, the run is stored when it begins and at each step change.
  const playing = savedRead && settled && !guard && !(laterVolume && volumesOn !== true);
  useEffect(() => {
    if (!playing || learnerId === null) return undefined;
    return keepRunSaved(learnerId, questId, () => questById(questId)?.steps);
  }, [playing, learnerId, questId]);

  const ports: QuestPlayerPorts = {
    ...session,
    ownsCard: (cardId) => holdsCard(learnerId, cardId),
    completesEpisode: (episode, quest) => profileCompletesEpisode(learnerId, episode, quest),
    ...learnerQuestExits({
      questId,
      episodeId,
      profileId: learnerId ?? undefined,
      panes,
      under: () => {
        const state = navigation.getState();
        return state.routes[state.index - 1]?.name;
      },
      toResults: (state) => navigation.dispatch(CommonActions.reset(state)),
      toJourneyPane: (id) => navigation.navigate('Main', { screen: 'Journey', params: { episodeId: id } }),
      toEpisodeScreen: (id) => navigation.replace('EpisodeDetail', { episodeId: id }),
      track,
      clearSavedRun: () => {
        if (learnerId !== null) void clearSavedRun(learnerId);
      },
    }),
  };

  if (!settled || guard || (laterVolume && volumesOn !== true)) return null;
  // [AU] The saved run is read first (row AU-12), so the run starts once, on the right step: a moment (the read has a
  // time limit) on the lesson's own waiting screen, which keeps the header and its way back.
  if (!savedRead) return <LessonWaiting />;

  return (
    <QuestPlayerView
      questId={questId}
      episodeId={episodeId}
      ports={ports}
      onOpenGame={(stepIndex) => navigation.navigate('Minigame', { questId, episodeId, stepIndex })}
      onBack={() => navigation.goBack()}
      reviewsFor={learnerId}
      autoHear
    />
  );
}
