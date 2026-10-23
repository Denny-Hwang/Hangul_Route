import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import type { RootStackParamList } from '../../navigation/types';
import { LessonWaiting } from '../lesson-content';
import { OopsScreen } from '../system/OopsScreen';

/**
 * The `DailyReview` route in the start bundle (F-CURR-002 §10, row CM-14): it loads the Daily Review chunk (a literal
 * `import()`, so the screen, its rounds and the review engine stay out of the start bundle) and draws the screen once it
 * is in. The chunk is precached, so this is a frame or two; one that cannot load shows the crash screen's Try again.
 */

type Props = NativeStackScreenProps<RootStackParamList, 'DailyReview'>;
type Chunk = typeof import('./daily-review-chunk');

let loaded: Chunk | null = null;
const loadChunk = (): Promise<Chunk> =>
  import('./daily-review-chunk').then((chunk) => {
    loaded = chunk;
    return chunk;
  });

/** The Daily Review chunk, loaded once; the Cell Check's chunk reaches its rounds here (row CM-21). */
export function dailyReviewChunk(): Promise<Chunk> {
  return loaded === null ? loadChunk() : Promise.resolve(loaded);
}

export function DailyReviewRoute(props: Props): React.ReactElement {
  const [chunk, setChunk] = useState<Chunk | null>(loaded);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (chunk !== null || failed) return undefined;
    let alive = true;
    dailyReviewChunk().then(
      (c) => alive && setChunk(c),
      () => alive && setFailed(true),
    );
    return () => {
      alive = false;
    };
  }, [chunk, failed]);
  if (failed) return <OopsScreen onRetry={() => setFailed(false)} />;
  if (chunk === null) return <LessonWaiting />;
  const { DailyReviewScreen } = chunk;
  return <DailyReviewScreen {...props} />;
}
