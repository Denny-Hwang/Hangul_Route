import { CommonActions } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useState } from 'react';
import { questById } from '../../content';
import { useMessages } from '../../i18n/use-messages';
import { playerGuard } from '../../logic/episode-access';
import { guestQuestExits } from '../../logic/guest/guest-run';
import { learnerQuestSession, type QuestPlayerPorts } from '../../logic/quest-flow/quest-player-ports';
import type { GuestStackParamList } from '../../navigation/types';
import { track } from '../../platform/telemetry';
import { useActiveLearnerId } from '../../store/active-learner';
import { noteGuestStep } from '../../store/guest-launch';
import { useGuestStore } from '../../store/guest-store';
import { holdLearnerSession } from '../../store/learner-session';
import { settledPlayerGuard } from '../../store/player-guard-settle';
import { useQuestRunStore } from '../../store/quest-run-store';
import { useQuestAccess } from '../../store/tier-store';
import { QuestPlayerView } from '../quest/QuestPlayerView';
import { leaveGuestRun } from './guest-exits';

export type GuestQuestPlayerProps = NativeStackScreenProps<GuestStackParamList, 'QuestPlayer'>;

/**
 * [GU] AMENDMENTS-GUEST-FIRST-LESSON sections 6.2, 6.4, 7.1 and 7.2 (row GU-3; mock
 * `design/screens/onboarding/guest-first-quest.md`): the shipped quest player with the guest ports. The learner is
 * the guest's id (`useActiveLearnerId`, no profile record); a finished run opens the guest's Results in this stack; the
 * leave sheet's Leave ends the run (`guest.left { at: 'quest' }`) and the root goes to Welcome or the chooser. The
 * quest opens the stack, so the header draws its own Close. Each step entered moves `lastAt` (a reload within 30
 * minutes reopens), the first Discover page of a new run sends `guest.first_letter`, and while this browser cannot keep
 * the record the storage-blocked line sits under Hoya's hello. The access guard runs as for any learner (quest 1 is in
 * the free plan); a closed answer ends the run instead of opening an episode page, which is not in this stack.
 */
export function GuestQuestPlayer({ route, navigation }: GuestQuestPlayerProps): React.ReactElement | null {
  const { questId, episodeId } = route.params;
  const learnerId = useActiveLearnerId();
  const memoryOnly = useGuestStore((s) => s.memoryOnly);
  const note = useMessages().learner.guest.memoryOnly;
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
  useEffect(() => {
    if (settled && guard) leaveGuestRun(navigation, null);
  }, [settled, guard, navigation]);

  // The run is the guest's (GU-D2): the session and every write are under the guest's id. No story bookmark: quest 1
  // is a grid lesson.
  const session = useMemo(
    () => learnerQuestSession({ profileId: learnerId, resume: undefined, questById, bookmarkOf: () => undefined, holdSession: holdLearnerSession }),
    [learnerId],
  );
  const ports: QuestPlayerPorts = {
    ...session,
    ...guestQuestExits({
      questId,
      episodeId,
      toResults: (state) => navigation.dispatch(CommonActions.reset(state)),
      leave: () => leaveGuestRun(navigation, 'quest'),
      track,
    }),
  };

  const stepIndex = useQuestRunStore((s) => s.stepIndex);
  const runQuest = useQuestRunStore((s) => s.questId);
  useEffect(() => {
    if (runQuest === questId) noteGuestStep(questById(questId)?.steps, stepIndex);
  }, [runQuest, questId, stepIndex]);

  if (!settled || guard) return null;

  return (
    <QuestPlayerView
      questId={questId}
      episodeId={episodeId}
      ports={ports}
      onOpenGame={(index) => navigation.navigate('Minigame', { questId, episodeId, stepIndex: index })}
      onBack={() => leaveGuestRun(navigation, null)}
      introNote={memoryOnly ? note : undefined}
      ownClose
    />
  );
}
