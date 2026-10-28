import { useEffect, useState, type ReactElement } from 'react';
import { useCurrFlag } from '../../store/remote-config-store';
import type { TipProps } from './culture-tip-chunk';

/*
 * The start bundle's door to the Did you know? tip (F-CURR-002 §5.7 and §10, row CM-3C): the tip, its note lookup and
 * its view are a chunk of their own (`./culture-tip-chunk.tsx`, marker `screen-chunk:culture-tip`), reached only through
 * the literal `import()` below, so the start bundle does not grow by them. The tip is a reward of the upper cells, like
 * their cards, so it shows behind the `upperCards` switch (built-in pct 0 until the owner ramps it; §12.2 names no
 * switch of its own). Off, the chunk never loads and the reward step and the card page are as before. This door is kept
 * as small as it can be (the start bundle has little room under its line): one component, one shared load.
 */

type Chunk = typeof import('./culture-tip-chunk');
let loading: Promise<Chunk | null> | undefined;
let loaded: Chunk | null = null;

/**
 * The tip while `upperCards` is on, once its chunk is in; nothing before, when off, or when the chunk cannot load (a
 * failed load is asked for again on the next mount). `questId`: the reward step's tip, the quest's note of its lesson
 * cell. `cardId` and `face`: a card's tip, on its back (inside the flip button) or in the fact card under it.
 */
export function CultureTip(props: TipProps): ReactElement | null {
  const on = useCurrFlag('upperCards');
  const [ui, setUi] = useState(loaded);
  useEffect(() => {
    if (!on || ui) return undefined;
    let live = true;
    loading ??= import('./culture-tip-chunk').then(
      (chunk) => (loaded = chunk),
      () => {
        loading = undefined;
        return null;
      },
    );
    void loading.then((chunk) => live && chunk && setUi(chunk));
    return () => {
      live = false;
    };
  }, [on, ui]);
  return on && ui ? <ui.Tip {...props} /> : null;
}
