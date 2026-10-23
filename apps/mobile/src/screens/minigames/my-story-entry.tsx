import { useEffect, useState, type ReactElement } from 'react';
import type { MinigameScope } from '../../logic/minigame-config';
import { myStoryToWriteFrame } from '../../logic/my-story/fallback';
import { LessonWaiting } from '../lesson-content';
import type { MinigameHost } from './host';
import { WriteFrameGame } from './WriteFrameGame';

/*
 * The start bundle's door to My Story (F-CURR-002 §7.1 F8 and §10, row CM-38): the game is a chunk of its own
 * (`./my-story-chunk.tsx`, marker `screen-chunk:my-story`), reached only through the literal `import()` below. The
 * switch is read by MinigameScreen (`game.my-story`, built-in pct 0): off, the step plays Write Frame on the first
 * frame and this chunk never loads.
 */

type Chunk = typeof import('./my-story-chunk');
let loading: Promise<Chunk> | null = null;
let loaded: Chunk | null = null;

/** Loads the chunk once (and again after a failed load); the fixture build's e2e host reads its fixture chain this way. */
export function loadMyStoryChunk(): Promise<Chunk> {
  loading ??= import('./my-story-chunk').then(
    (chunk) => (loaded = chunk),
    (error: unknown) => {
      loading = null;
      throw error;
    },
  );
  return loading;
}

export interface MyStoryRouteProps {
  scope: MinigameScope;
  host: MinigameHost;
  onBack?: () => void;
}

/**
 * My Story once its chunk is in, and the calm waiting state while it loads. If the chunk cannot load (offline before
 * the precache filled), the step is never a dead end: it plays the switch-off fallback, Write Frame on the first frame,
 * which is in the start bundle.
 */
export function MyStoryRoute(props: MyStoryRouteProps): ReactElement {
  const [chunk, setChunk] = useState<Chunk | null>(loaded);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (chunk !== null || failed) return undefined;
    let live = true;
    loadMyStoryChunk().then(
      (c) => live && setChunk(c),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [chunk, failed]);
  if (failed) return <WriteFrameGame scope={myStoryToWriteFrame(props.scope)} host={props.host} onBack={props.onBack} />;
  if (chunk === null) return <LessonWaiting />;
  const { MyStoryGame } = chunk;
  return <MyStoryGame {...props} />;
}
