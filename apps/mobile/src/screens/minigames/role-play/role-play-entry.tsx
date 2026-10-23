import { useEffect, useState, type ComponentProps, type ReactElement } from 'react';
import type { MinigameScope } from '../../../logic/minigame-config';
import { LessonWaiting } from '../../lesson-content';
import { OopsScreen } from '../../system/OopsScreen';
import type { MinigameHost } from '../host';

/*
 * The start bundle's door to Role Play (F-CURR-002 sections 7.1 F6, 10 and 12.2, row CM-35). The game (its branch
 * reducer, views and renderer) is a chunk of its own (`./role-play-chunk.tsx`, marker `screen-chunk:role-play`),
 * reached only through the literal `import()` below, precached so a quest step opens offline. The quest screen has
 * already decided the switch: with `game.role-play` off the step plays Tap to Respond on the same turns
 * (`logic/role-play/fallback.ts`) and this door is never reached.
 */

type Chunk = typeof import('./role-play-chunk');
let loading: Promise<Chunk> | null = null;
let loaded: Chunk | null = null;

function loadChunk(): Promise<Chunk> {
  loading ??= import('./role-play-chunk').then(
    (chunk) => (loaded = chunk),
    (error: unknown) => {
      loading = null;
      throw error;
    },
  );
  return loading;
}

export interface RolePlayStepProps {
  scope: MinigameScope;
  host: MinigameHost;
  /** Leave an empty scope (never a dead end). */
  onBack: () => void;
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

/** A Role Play step: the chunk's game once it is in; the calm waiting line until then; Try again if it cannot load. */
export function RolePlayStep(props: RolePlayStepProps): ReactElement {
  const { chunk, failed, retry } = useChunk();
  if (failed) return <OopsScreen onRetry={retry} />;
  if (chunk === null) return <LessonWaiting />;
  const { RolePlayGame } = chunk;
  return <RolePlayGame {...props} />;
}

/** The fixture build's Role Play route (`navigation/role-play-e2e.tsx`): the chunk's host screen. */
export function RolePlayE2eDoor(props: ComponentProps<Chunk['RolePlayE2eScreen']>): ReactElement {
  const { chunk, failed, retry } = useChunk();
  if (failed) return <OopsScreen onRetry={retry} />;
  if (chunk === null) return <LessonWaiting />;
  const { RolePlayE2eScreen } = chunk;
  return <RolePlayE2eScreen {...props} />;
}
