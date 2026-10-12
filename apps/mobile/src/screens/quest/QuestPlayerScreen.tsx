import { useLayoutClass } from '@hangul-route/design-system';
import { CommonActions } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useMemo } from 'react';
import { questById } from '../../content';
import { learnerQuestExits, learnerQuestSession, type QuestPlayerPorts } from '../../logic/quest-flow/quest-player-ports';
import { track } from '../../platform/telemetry';
import type { RootStackParamList } from '../../navigation/types';
import { activeProfileSelector, useProfileStore } from '../../store/profile-store';
import { holdLearnerSession } from '../../store/learner-session';
import { useStoryStore } from '../../store/story-store';
import { QuestPlayerView } from './QuestPlayerView';

type Props = NativeStackScreenProps<RootStackParamList, 'QuestPlayer'>;

/**
 * The learner's quest player: `QuestPlayerView` with the learner ports (F-BROWSE-001 BR-5a). A study
 * session runs for the active profile, a finished run resets to Results, and Leave returns to the
 * episode (its Journey pane on two panes, unless the quest was opened from another screen).
 */
export function QuestPlayerScreen({ route, navigation }: Props): React.ReactElement {
  const { questId, episodeId, resume } = route.params;
  const profile = useProfileStore(activeProfileSelector);
  const { panes } = useLayoutClass();

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
