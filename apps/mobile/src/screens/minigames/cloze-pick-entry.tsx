import { useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MinigameScope } from '../../logic/minigame-config';
import type { RootStackParamList } from '../../navigation/types';
import { useCurrFlagDecided } from '../../store/remote-config-store';
import { LessonWaiting } from '../lesson-content';
import { OopsScreen } from '../system/OopsScreen';
import type { MinigameHost } from './host';

/*
 * The start bundle's door to Cloze Pick (F-CURR-002 sections 7.1, 10 and 12.2, row CM-30). The game and its
 * fallback are a chunk of their own (`./cloze-pick-chunk.tsx`, marker `screen-chunk:cloze-pick`), reached only
 * through the literal `import()` below, so the start bundle carries this door alone.
 *
 * - **Gate:** `game.cloze-pick` (`currFlagOn`, built-in pct 0, the `EXPO_PUBLIC_CURR_GAMES_OFF` build floor), read
 *   once when the step opens, so a remote change never swaps the game in the middle of a round.
 * - **Off:** every round plays its fallback, the shipped Listen & Pick in its text prompt mode on the same tiles,
 *   answer and scoring (section 12.2: no switch bricks a quest), with its answers on the same round ids.
 * - The chunk is precached with the app; one that cannot load shows the crash screen's Try again, as the Cell Check.
 */

type Chunk = typeof import('./cloze-pick-chunk');
let loading: Promise<Chunk> | null = null;
let loaded: Chunk | null = null;

function loadChunk(): Promise<Chunk> {
  loading ??= import('./cloze-pick-chunk').then(
    (chunk) => (loaded = chunk),
    (error: unknown) => {
      loading = null;
      throw error;
    },
  );
  return loading;
}

function useChunk(): { chunk: Chunk | null; failed: boolean; retry: () => void } {
  const [chunk, setChunk] = useState<Chunk | null>(loaded);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (chunk !== null || failed) return undefined;
    let live = true;
    loadChunk().then(
      (c) => live && setChunk(c),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [chunk, failed]);
  return { chunk, failed, retry: () => setFailed(false) };
}

export type ClozePickRendered = 'cloze-pick' | 'listen-pick';

export interface ClozePickStepProps {
  scope: MinigameScope;
  host: MinigameHost;
  onBack?: () => void;
  /** Which game drew the step (`minigame.finished` names the kind rendered); called once it is known. */
  onRendered?: (kind: ClozePickRendered) => void;
}

/** A `cloze-pick` step: the game while its switch is on, else its Listen & Pick fallback. */
export function ClozePickStep(props: ClozePickStepProps): ReactElement {
  const now = useCurrFlagDecided('game.cloze-pick');
  const on = useRef<boolean | null>(null);
  if (on.current === null && now !== null) on.current = now;
  const { chunk, failed, retry } = useChunk();
  if (failed) return <OopsScreen onRetry={retry} />;
  if (chunk === null || on.current === null) return <LessonWaiting />;
  const { ClozePickStepBody } = chunk;
  return <ClozePickStepBody {...props} on={on.current} />;
}

/** Fixture builds only (`navigation/cloze-pick-e2e.tsx`, in the chunk): the `window.__hrClozePickE2E` hook. */
export function ClozePickE2eHook(): ReactElement | null {
  const { chunk } = useChunk();
  if (chunk === null) return null;
  const { ClozePickE2eHookBody } = chunk;
  return <ClozePickE2eHookBody />;
}

/** Fixture builds only: a Cloze Pick step on the fixture rounds. */
export function ClozePickE2eScreen({ route, navigation }: NativeStackScreenProps<RootStackParamList, 'ClozePickE2e'>): ReactElement {
  const { chunk } = useChunk();
  if (chunk === null) return <LessonWaiting />;
  const { ClozePickE2eBody } = chunk;
  return <ClozePickE2eBody key={route.key} rounds={route.params.rounds} onBack={() => navigation.goBack()} />;
}
