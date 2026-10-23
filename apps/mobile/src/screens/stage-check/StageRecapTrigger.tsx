import { useIsFocused, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { episodesAll } from '../../content';
import { RECAP_SYNC_GRACE_MS, recapStages, recapSyncSettled } from '../../logic/reviews/stage-ceremony';
import type { RootStackParamList } from '../../navigation/types';
import { useProgressStore } from '../../store/progress-store';
import { useSyncStore } from '../../store/sync-store';
import { stageRecapShown } from './stage-ceremony-latch';

/** How long Home waits between tries (a dropped navigation is asked again). */
const RECAP_RETRY_MS = 400;
const RECAP_TRIES = 5;

/**
 * Home's trigger for the one retroactive summary (F-CURR-002 section 4.8 step 7, panel G; row CM-22), part of the
 * Stage Check's chunk (Home draws it through the entry's `StageRecapSlot` while `stageChecks` is on for a learner).
 * When Home is in front, the snapshot is read, this session's sync of the learner has settled (`recapSyncSettled`: a
 * key another device latched is pulled first) and some finished Stage 2-7 has no `stageCeremonyAt` key, it opens the
 * summary once. The summary writes the keys, so it is never shown again on this or any other device. Draws nothing.
 */
export function StageRecapTrigger({ profileId }: { profileId: string }): null {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const focused = useIsFocused();
  const hydrated = useProgressStore((s) => s.hydratedFor.has(profileId));
  const snap = useProgressStore((s) => s.byProfile[profileId]);
  const status = useSyncStore((s) => s.byLearner[profileId]?.status);
  const [graceOver, setGraceOver] = useState(false);
  useEffect(() => {
    // The grace starts again whenever a sync runs: a sync that starts late is still waited for.
    setGraceOver(false);
    if (status === 'syncing') return undefined;
    const timer = setTimeout(() => setGraceOver(true), RECAP_SYNC_GRACE_MS);
    return () => clearTimeout(timer);
  }, [status]);
  const settled = recapSyncSettled(status, graceOver);
  const pending = hydrated && snap !== undefined && !stageRecapShown(profileId) && recapStages(snap, episodesAll).length > 0;
  useEffect(() => {
    if (!pending || !focused || !settled) return undefined;
    // A navigation asked while the app is still settling its first screen can be dropped, so it is asked again,
    // a few times, until the summary marks itself shown.
    let tries = 0;
    const ask = (): void => {
      if (stageRecapShown(profileId) || tries >= RECAP_TRIES) return;
      tries += 1;
      navigation.navigate('StageRecap');
      timer = setTimeout(ask, RECAP_RETRY_MS);
    };
    let timer = setTimeout(ask, RECAP_RETRY_MS);
    return () => clearTimeout(timer);
  }, [pending, focused, settled, profileId, navigation]);
  return null;
}
