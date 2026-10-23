import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState, type ReactElement } from 'react';
import type { MinigameScope } from '../../logic/minigame-config';
import type { RootStackParamList } from '../../navigation/types';
import { useGuestStore } from '../../store/guest-store';
import { useProfileStore } from '../../store/profile-store';
import { useCurrFlag } from '../../store/remote-config-store';
import { LessonWaiting } from '../lesson-content';
import { OopsScreen } from '../system/OopsScreen';
import type { MinigameHost } from './host';

/*
 * The start bundle's door to Syllable Build and the Block Sprint (F-CURR-002 sections 7.1 F3 and F9, 10 and 12.2, row
 * CM-32). Everything they draw is a chunk of its own (`./syllable-build-chunk.tsx`, marker `screen-chunk:syllable-build`),
 * reached only through the literal `import()` below.
 *
 * - `game.syllable-build` (built-in pct 0): on, a `syllable-build` step plays the game; off, Listen & Pick on the built
 *   block, so no switch bricks a quest.
 * - `decodingSprint` (built-in pct 0): on, the Block Sprint is offered after Stage 1 (the Journey's Stage 1 footer and
 *   the Hangul Check results) to a learner; off, nothing is drawn and the route goes back.
 */

type Chunk = typeof import('./syllable-build-chunk');
let loading: Promise<Chunk> | null = null;
let loaded: Chunk | null = null;

/** The Syllable Build chunk, loaded once; the Daily Review chunk reaches the review round here. */
export function syllableBuildChunk(): Promise<Chunk> {
  if (loaded !== null) return Promise.resolve(loaded);
  loading ??= import('./syllable-build-chunk').then(
    (chunk) => (loaded = chunk),
    (error: unknown) => {
      loading = null;
      throw error;
    },
  );
  return loading;
}

export function useSyllableBuildChunk(on = true): { chunk: Chunk | null; failed: boolean; retry: () => void } {
  const [chunk, setChunk] = useState<Chunk | null>(loaded);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!on || chunk !== null || failed) return undefined;
    let live = true;
    syllableBuildChunk().then(
      (c) => live && setChunk(c),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [on, chunk, failed]);
  return { chunk: on ? chunk : null, failed, retry: () => setFailed(false) };
}

export interface SyllableBuildStepProps {
  scope: MinigameScope;
  /** The quest host for the scope the step plays (the fallback's answers are read from its own Listen & Pick scope). */
  hostFor: (played: MinigameScope) => MinigameHost;
  onBack: () => void;
}

/** A quest's `syllable-build` step: the game while `game.syllable-build` is on, Listen & Pick on the block while off. */
export function SyllableBuildStep(props: SyllableBuildStepProps): ReactElement {
  const flag = useCurrFlag('game.syllable-build');
  const { chunk, failed, retry } = useSyllableBuildChunk();
  // Read once, when the chunk is in, so a remote copy arriving mid-step never swaps the game under the learner.
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => {
    if (chunk !== null && on === null) setOn(flag);
  }, [chunk, flag, on]);
  if (failed) return <OopsScreen onRetry={retry} />;
  if (chunk === null || on === null) return <LessonWaiting />;
  const { SyllableBuildStepBody } = chunk;
  return <SyllableBuildStepBody {...props} on={on} />;
}

/** `decodingSprint` for a learner (never a guest run, whose first quest is all it plays). */
export function useDecodingSprintOn(): boolean {
  const on = useCurrFlag('decodingSprint');
  const guest = useGuestStore((s) => s.running);
  const profile = useProfileStore((s) => s.activeId);
  return on && !guest && profile !== null;
}

/** The Block Sprint's bonus line and button; nothing while `decodingSprint` is off. `onOpen` opens the `DecodingSprint` route. */
export function DecodingSprintOffer({ onOpen, testID = 'decoding-sprint-offer' }: { onOpen: () => void; testID?: string }): ReactElement | null {
  const ui = useSyllableBuildChunk(useDecodingSprintOn()).chunk;
  return ui === null ? null : <ui.SprintOffer onOpen={onOpen} testID={testID} />;
}

type RouteProps = NativeStackScreenProps<RootStackParamList, 'DecodingSprint'>;

/** The `DecodingSprint` route: the chunk's screen for the active learner; with the switch off it goes back. */
export function DecodingSprintRoute({ navigation }: RouteProps): ReactElement {
  const on = useDecodingSprintOn();
  const build = useCurrFlag('game.syllable-build');
  const profileId = useProfileStore((s) => s.activeId);
  const { chunk, failed, retry } = useSyllableBuildChunk(on);
  useEffect(() => {
    if (!on && navigation.canGoBack()) navigation.goBack();
  }, [on, navigation]);
  if (failed) return <OopsScreen onRetry={retry} />;
  if (!on || profileId === null || chunk === null) return <LessonWaiting />;
  const { DecodingSprintScreen } = chunk;
  return <DecodingSprintScreen profileId={profileId} buildOn={build} onClose={() => navigation.goBack()} />;
}
