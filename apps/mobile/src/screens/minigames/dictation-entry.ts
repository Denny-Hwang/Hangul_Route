import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CurrFlagName } from '../../config/flags';
import { applyGameSwitches, needsDictationChunk } from '../../logic/game-switches';
import type { MinigameScope } from '../../logic/minigame-config';
import { currFlagOn } from '../../store/remote-config-store';

/*
 * The start bundle's door to the dictation chunk (F-CURR-002 sections 10 and 12.2, row CM-31): Dictation (Type Hangul
 * `hear`) and the spelling round's prompt live in `dictation-chunk.tsx`, reached only through the literal `import()`
 * below, so the start bundle carries this file and the switch step only.
 */

export type DictationKit = typeof import('./dictation-chunk');

let loading: Promise<DictationKit> | null = null;
let loaded: DictationKit | null = null;

/** The dictation chunk, loaded once; a failed load (offline before the precache) is tried again on the next call. */
export function loadDictationKit(): Promise<DictationKit> {
  loading ??= import('./dictation-chunk').then(
    (chunk) => {
      loaded = chunk;
      return chunk;
    },
    (error: unknown) => {
      loading = null;
      throw error;
    },
  );
  return loading;
}

/**
 * The chunk when `needed` (null while it loads), `'failed'` when it could not load; null when not needed. A failure
 * stands for the life of the hook: it is never tried again in the same mount, so a step that opened on its fallback
 * never turns into the switched step under the learner (and a game never changes its hooks); the next step's mount
 * tries again.
 */
export function useDictationKit(needed: boolean): DictationKit | 'failed' | null {
  const [kit, setKit] = useState<DictationKit | 'failed' | null>(loaded);
  useEffect(() => {
    if (!needed || kit !== null) return undefined;
    let live = true;
    loadDictationKit().then(
      (chunk) => {
        if (live) setKit(chunk);
      },
      () => {
        if (live) setKit('failed');
      },
    );
    return () => {
      live = false;
    };
  }, [needed, kit]);
  return needed ? kit : null;
}

export type SwitchedScope = { kind: 'ready'; scope: MinigameScope; kit: DictationKit | null } | { kind: 'loading' };

/**
 * A step's scope with the `game.<kind>` switches applied when the step opens (a switch turned off later takes effect
 * at the next step, never inside an open round), and the dictation chunk when the scope plays from it. While the chunk
 * loads the step waits; when it cannot load, the step plays every round as its shipped fallback.
 */
export function useSwitchedScope<S extends MinigameScope | undefined>(scope: S): S extends MinigameScope ? SwitchedScope : undefined;
export function useSwitchedScope(scope: MinigameScope | undefined): SwitchedScope | undefined {
  // Each switch is read once per mount (the step), so a new scope object for the same step (the UI language changed)
  // keeps the step's decision even if remote config changed the switch in between.
  const decided = useRef(new Map<CurrFlagName, boolean>());
  const on = useCallback((flag: CurrFlagName): boolean => {
    const held = decided.current.get(flag);
    if (held !== undefined) return held;
    const value = currFlagOn(flag);
    decided.current.set(flag, value);
    return value;
  }, []);
  const switched = useMemo(() => (scope === undefined ? undefined : applyGameSwitches(scope, on)), [scope, on]);
  const needed = switched !== undefined && needsDictationChunk(switched);
  const kit = useDictationKit(needed);
  return useMemo(() => {
    if (scope === undefined || switched === undefined) return undefined;
    if (!needed) return { kind: 'ready', scope: switched, kit: null };
    if (kit === null) return { kind: 'loading' };
    if (kit === 'failed') return { kind: 'ready', scope: applyGameSwitches(scope, () => false), kit: null };
    return { kind: 'ready', scope: switched, kit };
  }, [scope, switched, needed, kit]);
}
