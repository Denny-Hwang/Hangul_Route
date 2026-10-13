import { useLayoutClass } from '@hangul-route/design-system';
import { CommonActions } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useState } from 'react';
import { questById } from '../../content';
import { playerGuard } from '../../logic/episode-access';
import { learnerQuestExits, learnerQuestSession, type QuestPlayerPorts } from '../../logic/quest-flow/quest-player-ports';
import { track } from '../../platform/telemetry';
import type { RootStackParamList } from '../../navigation/types';
import { activeProfileSelector, useProfileStore } from '../../store/profile-store';
import { holdLearnerSession } from '../../store/learner-session';
import { settledPlayerGuard } from '../../store/player-guard-settle';
import { useStoryStore } from '../../store/story-store';
import { useQuestAccess } from '../../store/tier-store';
import { QuestPlayerView } from './QuestPlayerView';

type Props = NativeStackScreenProps<RootStackParamList, 'QuestPlayer'>;

/**
 * The learner's quest player: `QuestPlayerView` with the learner ports (F-BROWSE-001 BR-5a). A study
 * session runs for the active profile, a finished run resets to Results, and Leave returns to the
 * episode (its Journey pane on two panes, unless the quest was opened from another screen).
 */
export function QuestPlayerScreen({ route, navigation }: Props): React.ReactElement | null {
  const { questId, episodeId, resume } = route.params;
  const profile = useProfileStore(activeProfileSelector);
  const { panes } = useLayoutClass();
  // The guard at the point of play (F-ENT-003 section 3.6), read on mount: a closed quest never
  // starts; the player replaces itself with the lesson page in preview. A quest that closes mid-run
  // (a lapse) keeps playing; the next open is guarded. A closed answer is checked again once the
  // learner's tier and memberships are read, so an owned quest is never sent to the preview because
  // the player mounted before those stores hydrated.
  const questOpen = useQuestAccess();
  const [guard, setGuard] = useState(() => playerGuard(questOpen, questId, episodeId));
  const [settled, setSettled] = useState(() => guard === null);
  const learnerId = profile ? profile.id : null;
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
  useEffect(() => {
    if (settled && guard) navigation.replace('EpisodeDetail', guard);
  }, [settled, guard, navigation]);

  // Stable while the profile and the resume flag stay the same, so the run is not restarted.
  const session = useMemo(
    () =>
      learnerQuestSession({
        profileId: profile ? profile.id : null,
        resume,
        questById,
        bookmarkOf: (profileId, storyId) => useStoryStore.getState().getResumableBookmark(profileId, storyId),
        holdSession: holdLearnerSession,
      }),
    [profile, resume],
  );

  const ports: QuestPlayerPorts = {
    ...session,
    ...learnerQuestExits({
      questId,
      episodeId,
      profileId: profile?.id,
      panes,
      under: () => {
        const state = navigation.getState();
        return state.routes[state.index - 1]?.name;
      },
      toResults: (state) => navigation.dispatch(CommonActions.reset(state)),
      toJourneyPane: (id) => navigation.navigate('Main', { screen: 'Journey', params: { episodeId: id } }),
      toEpisodeScreen: (id) => navigation.replace('EpisodeDetail', { episodeId: id }),
      track,
    }),
  };

  if (!settled || guard) return null;

  return (
    <QuestPlayerView
      questId={questId}
      episodeId={episodeId}
      ports={ports}
      onOpenGame={(stepIndex) => navigation.navigate('Minigame', { questId, episodeId, stepIndex })}
      onBack={() => navigation.goBack()}
    />
  );
}
