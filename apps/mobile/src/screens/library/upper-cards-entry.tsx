import type { HeritageCard } from '@hangul-route/content-schema';
import { useEffect, useState, type ReactElement, type ReactNode } from 'react';
import { useCurrFlag } from '../../store/remote-config-store';

/*
 * The start bundle's door to the upper-cell cards (F-CURR-002 §7.2, §10 and §12.2, row CM-23): the card drawings
 * (`UpperCellCardArt`) and the Library's albums are a chunk of their own (`./upper-cards-chunk.tsx`, marker
 * `screen-chunk:upper-cards`), reached only through the literal `import()` below, while `upperCards` is on. Off, nothing
 * loads: a held upper-cell card keeps its Korean-word face, and the albums are not drawn.
 */

type Chunk = typeof import('./upper-cards-chunk');
let loading: Promise<Chunk> | null = null;
let loaded: Chunk | null = null;

function loadChunk(): Promise<Chunk> {
  loading ??= import('./upper-cards-chunk').then(
    (chunk) => (loaded = chunk),
    (error: unknown) => {
      loading = null;
      throw error;
    },
  );
  return loading;
}

/** The chunk while `on`, once it is in; null before, when off, or after a failed load (the caller keeps its fallback). */
function useChunk(on: boolean): Chunk | null {
  const [chunk, setChunk] = useState<Chunk | null>(loaded);
  useEffect(() => {
    if (!on || chunk !== null) return undefined;
    let live = true;
    loadChunk().then(
      (c) => live && setChunk(c),
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [on, chunk]);
  return on ? chunk : null;
}

/** An upper-cell card's drawing; `fallback` (the Korean-word face) while `upperCards` is off or the chunk is loading. */
export function UpperCardArtSlot({ cardId, size, fallback }: { cardId: string; size: number; fallback: ReactNode }): ReactElement {
  const ui = useChunk(useCurrFlag('upperCards'));
  return ui === null ? <>{fallback}</> : <ui.UpperCellCardArt cardId={cardId} size={size} accessibilityLabel="" />;
}

export interface AlbumsSlotProps {
  /** `upperCards` for the learner (the Library reads it once for its list too). */
  on: boolean;
  owned: ReadonlySet<string>;
  onOpenCard: (card: HeritageCard) => void;
}

/** The Library's albums; nothing while `upperCards` is off or the chunk is loading. */
export function AlbumsSlot({ on, owned, onOpenCard }: AlbumsSlotProps): ReactElement | null {
  const ui = useChunk(on);
  return ui === null ? null : <ui.AlbumsSection owned={owned} onOpenCard={onOpenCard} />;
}
