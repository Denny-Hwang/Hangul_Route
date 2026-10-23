import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState, type ReactElement } from 'react';
import { memoryRecordsFor } from '../../logic/memory/boot';
import type { RootStackParamList } from '../../navigation/types';
import { useCurrFlag } from '../../store/remote-config-store';
import { LessonWaiting } from '../lesson-content';
import { OopsScreen } from '../system/OopsScreen';

/*
 * The start bundle's door to the Cell Check (F-CURR-002 sections 4.5, 10 and 12.2, row CM-21). The session logic is the
 * memory chunk's (`cellCheckApi()`); the cell page's block, the Test out line and the screen are a chunk of their own
 * (`./cell-check-chunk.tsx`, marker `screen-chunk:cell-check`), reached only through the literal `import()` below.
 * Gate: `cellCheck` (which covers the test-out) and `memoryRecord` for a learner; the block also draws the mastery
 * level while `mastery` is on. Off, nothing loads; the latched results stay.
 */

type Chunk = typeof import('./cell-check-chunk');
let loading: Promise<Chunk> | null = null;
let loaded: Chunk | null = null;

function loadChunk(): Promise<Chunk> {
  loading ??= import('./cell-check-chunk').then(
    (chunk) => (loaded = chunk),
    (error: unknown) => {
      loading = null;
      throw error;
    },
  );
  return loading;
}

function useChunk(on: boolean): { chunk: Chunk | null; failed: boolean; retry: () => void } {
  const [chunk, setChunk] = useState<Chunk | null>(loaded);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!on || chunk !== null || failed) return undefined;
    let live = true;
    loadChunk().then(
      (c) => live && setChunk(c),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [on, chunk, failed]);
  return { chunk: on ? chunk : null, failed, retry: () => setFailed(false) };
}

/**
 * `cellCheck` and `mastery`, each with `memoryRecord`, for this learner (subscribed, so a remote turn re-renders): the
 * Check's switch (which covers the test-out) and the mastery block's.
 */
export function useSwitches(profileId: string | null): [check: boolean, mastery: boolean] {
  const record = useCurrFlag('memoryRecord') && memoryRecordsFor(profileId);
  const check = useCurrFlag('cellCheck');
  const mastery = useCurrFlag('mastery');
  return [check && record, mastery && record];
}

export interface CellCheckSlotProps {
  /** `top`: the block under the header (A, A2, the mastery block); `bottom`: the Test out line under the quests (B). */
  place: 'top' | 'bottom';
  profileId: string | null;
  episodeId: string;
  stage: string;
  theme: string;
  /** Each quest's stars and whether it is open, in order. */
  stars: readonly number[];
  open: readonly boolean[];
}

/** The cell page's Cell Check block or Test out line; nothing while every switch is off or the chunk is loading. */
export function CellCheckSlot(props: CellCheckSlotProps): ReactElement | null {
  const [checkOn, masteryOn] = useSwitches(props.profileId);
  const ui = useChunk(checkOn || (props.place === 'top' && masteryOn)).chunk;
  return ui === null ? null : <ui.CellCheckBlock {...props} checkOn={checkOn} masteryOn={masteryOn} />;
}

type Props = NativeStackScreenProps<RootStackParamList, 'CellCheck'>;

/** The `CellCheck` route: draws the chunk's screen once it is in; one that cannot load shows the crash screen's Try again. */
export function CellCheckRoute(props: Props): ReactElement {
  const { chunk, failed, retry } = useChunk(true);
  if (failed) return <OopsScreen onRetry={retry} />;
  if (chunk === null) return <LessonWaiting />;
  const { CellCheckScreen } = chunk;
  return <CellCheckScreen {...props} />;
}
