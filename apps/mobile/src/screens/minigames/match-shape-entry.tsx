import { useEffect, useState, type ReactElement } from 'react';
import type { MinigameScope } from '../../logic/minigame-config';
import { useCurrFlag } from '../../store/remote-config-store';
import { LessonWaiting } from '../lesson-content';
import { OopsScreen } from '../system/OopsScreen';
import type { MinigameHost } from './host';

/*
 * The start bundle's door to Match Shape (F-CURR-002 sections 7.1 F4, 10 and 12.2, row CM-33). Everything it draws is
 * a chunk of its own (`./match-shape-chunk.tsx`, marker `screen-chunk:match-shape`), reached only through the literal
 * `import()` below. `game.match-shape` (built-in pct 0, so the row merges dark): on, a `match-shape` step plays the
 * game; off, Read Pick, so no switch bricks a quest.
 */

type Chunk = typeof import('./match-shape-chunk');
let loading: Promise<Chunk> | null = null;
let loaded: Chunk | null = null;

/** The Match Shape chunk, loaded once; the Daily Review chunk reaches the review round here. */
export function matchShapeChunk(): Promise<Chunk> {
  if (loaded !== null) return Promise.resolve(loaded);
  loading ??= import('./match-shape-chunk').then(
    (chunk) => (loaded = chunk),
    (error: unknown) => {
      loading = null;
      throw error;
    },
  );
  return loading;
}

export function useMatchShapeChunk(): { chunk: Chunk | null; failed: boolean; retry: () => void } {
  const [chunk, setChunk] = useState<Chunk | null>(loaded);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (chunk !== null || failed) return undefined;
    let live = true;
    matchShapeChunk().then(
      (c) => live && setChunk(c),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [chunk, failed]);
  return { chunk, failed, retry: () => setFailed(false) };
}

export interface MatchShapeStepProps {
  scope: MinigameScope;
  /** The quest host for the scope the step plays (the fallback's answers are read from its own Read Pick scope). */
  hostFor: (played: MinigameScope) => MinigameHost;
  onBack: () => void;
}

/** A quest's `match-shape` step: the game while `game.match-shape` is on, Read Pick while off. */
export function MatchShapeStep(props: MatchShapeStepProps): ReactElement {
  const flag = useCurrFlag('game.match-shape');
  const { chunk, failed, retry } = useMatchShapeChunk();
  // Read once, when the chunk is in, so a remote copy arriving mid-step never swaps the game under the learner. Before
  // the stored copy is read the switch reads off, so that step plays Read Pick: it fails safe, and its result is
  // reported as `listen-pick`, so a ramp counts what was played, never a game that was not shown.
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => {
    if (chunk !== null && on === null) setOn(flag);
  }, [chunk, flag, on]);
  if (failed) return <OopsScreen onRetry={retry} />;
  if (chunk === null || on === null) return <LessonWaiting />;
  const { MatchShapeStepBody } = chunk;
  return <MatchShapeStepBody {...props} on={on} />;
}
