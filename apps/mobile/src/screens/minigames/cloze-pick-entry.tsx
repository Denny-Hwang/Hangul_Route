import { useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MinigameScope } from '../../logic/minigame-config';
import type { RootStackParamList } from '../../navigation/types';
import { abandonPendingChunk } from '../../platform/lesson-chunk-abandon';
import { useCurrFlagDecided } from '../../store/remote-config-store';
import { LessonWaiting } from '../lesson-content';
import { ClozePickFallback } from './cloze-pick-fallback';
import type { MinigameHost } from './host';

/*
 * The start bundle's door to Cloze Pick (F-CURR-002 sections 7.1, 10 and 12.2, row CM-30). The game is a chunk of its
 * own (`./cloze-pick-chunk.tsx`, marker `screen-chunk:cloze-pick`), reached only through the literal `import()` below;
 * the door and the fallback (`./cloze-pick-fallback.tsx`) are in the start bundle.
 *
 * - **Gate:** `game.cloze-pick` (`currFlagOn`, built-in pct 0, the `EXPO_PUBLIC_CURR_GAMES_OFF` build floor), read
 *   once when the step opens, so a remote change never swaps the game in the middle of a round. A switch still
 *   undecided after `FLAG_DECIDE_TIMEOUT_MS` counts as off.
 * - **Off:** every round plays its fallback, the shipped Listen & Pick in its text prompt mode on the same tiles,
 *   answer and scoring (section 12.2: no switch bricks a quest), with its answers on the same round ids. Nothing is
 *   loaded: the switch never depends on the code it guards.
 * - **On:** the chunk loads (it is precached with the app). One that cannot load, or does not answer within
 *   `CHUNK_TIMEOUT_MS`, plays the fallback as well, so a broken or hung chunk never leaves the quest step stuck.
 */

/** A chunk load that has not answered by then is given up (the lesson chunks' timeout) and the step plays its fallback. */
export const CHUNK_TIMEOUT_MS = 15_000;
/**
 * A switch still undecided by then (the stored copy never read and no fetch answered) counts as off, as on every other
 * surface, and the step plays its fallback rather than waiting on a screen with no way out.
 */
export const FLAG_DECIDE_TIMEOUT_MS = 5_000;
/** The chunk's web bundle name (`SCREEN_CHUNKS` in scripts/pwa/lesson-chunks.mjs). */
const CHUNK_BUNDLE = 'cloze-pick-chunk';

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

/** The chunk, loaded only while `wanted`; `failed` once it rejected or timed out. */
function useChunk(wanted: boolean): { chunk: Chunk | null; failed: boolean } {
  const [chunk, setChunk] = useState<Chunk | null>(loaded);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!wanted || chunk !== null || failed) return undefined;
    let live = true;
    const timer = setTimeout(() => {
      if (!live) return;
      live = false;
      // Metro's web loader would hand the same hung request to the next try: fail it so a later step asks again.
      loading = null;
      abandonPendingChunk(CHUNK_BUNDLE);
      setFailed(true);
    }, CHUNK_TIMEOUT_MS);
    loadChunk().then(
      (c) => {
        if (live) setChunk(c);
      },
      () => {
        if (live) setFailed(true);
      },
    );
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [wanted, chunk, failed]);
  return { chunk, failed };
}

export type ClozePickRendered = 'cloze-pick' | 'listen-pick';

export interface ClozePickStepProps {
  scope: MinigameScope;
  host: MinigameHost;
  onBack?: () => void;
  /** Which game drew the step (`minigame.finished` names the kind rendered); called once it is known. */
  onRendered?: (kind: ClozePickRendered) => void;
}

/** A `cloze-pick` step: the game while its switch is on and its chunk is in, else its Listen & Pick fallback. */
export function ClozePickStep({ onRendered, ...props }: ClozePickStepProps): ReactElement {
  const now = useCurrFlagDecided('game.cloze-pick');
  const on = useRef<boolean | null>(null);
  const [undecidedTooLong, setUndecidedTooLong] = useState(false);
  if (on.current === null && now !== null) on.current = now;
  if (on.current === null && undecidedTooLong) on.current = false;
  const deciding = on.current === null;
  useEffect(() => {
    if (!deciding) return undefined;
    const timer = setTimeout(() => setUndecidedTooLong(true), FLAG_DECIDE_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [deciding]);
  const { chunk, failed } = useChunk(on.current === true);
  const rendered: ClozePickRendered | null = on.current === null ? null : on.current && !failed ? (chunk === null ? null : 'cloze-pick') : 'listen-pick';
  useEffect(() => {
    if (rendered !== null) onRendered?.(rendered);
  }, [rendered, onRendered]);
  if (rendered === null) return <LessonWaiting />;
  if (rendered === 'listen-pick' || chunk === null) return <ClozePickFallback {...props} />;
  const { ClozePickGame } = chunk;
  return <ClozePickGame {...props} />;
}

/** Fixture builds only (`navigation/cloze-pick-e2e.tsx`, in the chunk): the `window.__hrClozePickE2E` hook. */
export function ClozePickE2eHook(): ReactElement | null {
  const { chunk } = useChunk(true);
  if (chunk === null) return null;
  const { ClozePickE2eHookBody } = chunk;
  return <ClozePickE2eHookBody />;
}

/** Fixture builds only: a Cloze Pick step on the fixture rounds. */
export function ClozePickE2eScreen({ route, navigation }: NativeStackScreenProps<RootStackParamList, 'ClozePickE2e'>): ReactElement {
  const { chunk } = useChunk(true);
  if (chunk === null) return <LessonWaiting />;
  const { ClozePickE2eBody } = chunk;
  return <ClozePickE2eBody key={route.key} rounds={route.params.rounds} onBack={() => navigation.goBack()} />;
}
