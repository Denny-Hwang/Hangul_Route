import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState, type ReactElement } from 'react';
import type { RootStackParamList } from '../../navigation/types';
import { LessonWaiting } from '../lesson-content';
import { OopsScreen } from '../system/OopsScreen';
import { retryLoad } from '../../logic/lessons/chunk-retry';

/*
 * The start bundle's door to the grown-up reports (F-CURR-002 section 10): the learner report (`LearnerReport`, behind
 * `flags.reportsEnabled`) and the level-check report (`PlacementReport`) are a chunk of their own
 * (`./reports-chunk.tsx`, marker `screen-chunk:reports`), reached only through the literal `import()` below and
 * precached like every chunk, so they open offline. The route waits on the lesson waiting screen until the chunk is in
 * and offers the crash screen's Try again when it cannot load.
 */

type Chunk = typeof import('./reports-chunk');
let loading: Promise<Chunk> | null = null;
let loaded: Chunk | null = null;

function loadChunk(): Promise<Chunk> {
  loading ??= retryLoad(() => import('./reports-chunk')).then(
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

/** The `LearnerReport` route: the learner report once the chunk is in. */
export function LearnerReportRoute(props: NativeStackScreenProps<RootStackParamList, 'LearnerReport'>): ReactElement {
  const { chunk, failed, retry } = useChunk();
  if (failed) return <OopsScreen onRetry={retry} />;
  if (chunk === null) return <LessonWaiting />;
  const { LearnerReportScreen } = chunk;
  return <LearnerReportScreen {...props} />;
}

/** The `PlacementReport` route: the level-check report once the chunk is in. */
export function PlacementReportRoute(props: NativeStackScreenProps<RootStackParamList, 'PlacementReport'>): ReactElement {
  const { chunk, failed, retry } = useChunk();
  if (failed) return <OopsScreen onRetry={retry} />;
  if (chunk === null) return <LessonWaiting />;
  const { PlacementReportScreen } = chunk;
  return <PlacementReportScreen {...props} />;
}
