import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, type ReactElement } from 'react';
import type { RootStackParamList } from '../../navigation/types';
import { useProfileStore } from '../../store/profile-store';
import { useCurrFlag } from '../../store/remote-config-store';
import { LessonWaiting } from '../lesson-content';
import { useDecodingSprintOn, useSyllableBuildChunk } from '../minigames/syllable-build-entry';
import { OopsScreen } from '../system/OopsScreen';

/*
 * The `DecodingSprint` root route (F-CURR-002 section 7.1 F9, row CM-32). It lives outside `screens/minigames/`, whose
 * files the guest stack renders and which navigate only through injected props (CS-G1): this route is never registered
 * in the guest stack, and it is the one place that resets the root to Home. Its screen is the Syllable Build chunk's.
 */

type RouteProps = NativeStackScreenProps<RootStackParamList, 'DecodingSprint'>;

/** The chunk's screen for the active learner; with the switch off it goes back (or Home, with nothing to go back to). */
export function DecodingSprintRoute({ navigation }: RouteProps): ReactElement {
  const on = useDecodingSprintOn();
  const build = useCurrFlag('game.syllable-build');
  const profileId = useProfileStore((s) => s.activeId);
  const { chunk, failed, retry } = useSyllableBuildChunk(on);
  // Off, or closed: back where the learner came from, or Home when there is nothing to go back to (a reload on the route).
  const leave = useCallback((): void => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
  }, [navigation]);
  useEffect(() => {
    if (!on) leave();
  }, [on, leave]);
  if (failed) return <OopsScreen onRetry={retry} />;
  if (!on || profileId === null || chunk === null) return <LessonWaiting />;
  const { DecodingSprintScreen } = chunk;
  return <DecodingSprintScreen profileId={profileId} buildOn={build} onClose={leave} />;
}
