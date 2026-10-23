import { useEffect, useState, type ReactElement } from 'react';
import { useCurrFlag } from '../../store/remote-config-store';

/*
 * The start bundle's door to the Did you know? tip (F-CURR-002 §5.7 and §10, row CM-3C): the tip, its note lookup and
 * its view are a chunk of their own (`./culture-tip-chunk.tsx`, marker `screen-chunk:culture-tip`), reached only through
 * the literal `import()` below, so the start bundle does not grow by them. The tip is a reward of the upper cells, like
 * their cards, so it shows behind the `upperCards` switch (built-in pct 0 until the owner ramps it; §12.2 names no
 * switch of its own). Off, the chunk never loads and the reward step and the card page are as before.
 */

type Chunk = typeof import('./culture-tip-chunk');
let loading: Promise<Chunk> | null = null;
let loaded: Chunk | null = null;

function loadChunk(): Promise<Chunk> {
  loading ??= import('./culture-tip-chunk').then(
    (chunk) => (loaded = chunk),
    (error: unknown) => {
      loading = null;
      throw error;
    },
  );
  return loading;
}

/** The chunk while the switch is on, once it is in; null before or when off. A failed load leaves the tip out. */
function useTipChunk(): Chunk | null {
  const on = useCurrFlag('upperCards');
  const [chunk, setChunk] = useState<Chunk | null>(loaded);
  useEffect(() => {
    if (!on || chunk !== null) return undefined;
    let live = true;
    loadChunk().then(
      (c) => {
        if (live) setChunk(c);
      },
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [on, chunk]);
  return on ? chunk : null;
}

/** The reward step's tip: the quest's note of its lesson cell; nothing for a quest whose cell has none. */
export function QuestCultureTip({ questId }: { questId: string }): ReactElement | null {
  const ui = useTipChunk();
  return ui === null ? null : <ui.QuestTip questId={questId} />;
}

/**
 * A card's tip: the note of the quest that awards it in its lesson cell (else the cell's first quest), on the card's
 * back (`back`, inside the flip button) and in the fact card under it (`fact-card`, where a screen reader reaches it).
 */
export function CardCultureTip({ cardId, face }: { cardId: string; face: 'back' | 'fact-card' }): ReactElement | null {
  const ui = useTipChunk();
  return ui === null ? null : <ui.CardTip cardId={cardId} face={face} />;
}

/** Tests only: forget the loaded chunk. */
export function resetCultureTipChunkForTests(): void {
  loading = null;
  loaded = null;
}
