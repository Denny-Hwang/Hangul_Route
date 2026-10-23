import type { HeritageCard } from '@hangul-route/content-schema';
import { colors } from '@hangul-route/design-system';
import { useEffect, useState, type ReactElement, type ReactNode } from 'react';
import { View } from 'react-native';
import { UPPER_CARD_GATED_IDS } from '../../content/heritage-cards';
import { useCurrFlag } from '../../store/remote-config-store';

/*
 * The start bundle's door to the upper-cell cards (F-CURR-002 §7.2, §10 and §12.2, row CM-23): the card drawings
 * (`UpperCellCardArt`), the card backs and the Library's albums are a chunk of their own (`./upper-cards-chunk.tsx`,
 * marker `screen-chunk:upper-cards`), reached only through the literal `import()` below. The drawings and the albums
 * load while `upperCards` is on; off, a held upper-cell card keeps its Korean-word face and no album is drawn. A card
 * page loads the chunk for an upper-cell card's back whatever the switch, so a held card always shows its fact.
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

/**
 * The chunk while `on`, once it is in; null before, when off, or while a failed load waits for its retry (the caller
 * keeps its fallback). A failed load (a cold cache on a flaky network) is tried again every 5 s while mounted.
 */
function useChunk(on: boolean): Chunk | null {
  const [chunk, setChunk] = useState<Chunk | null>(loaded);
  const [tries, setTries] = useState(0);
  useEffect(() => {
    if (!on || chunk !== null) return undefined;
    let live = true;
    let retry: ReturnType<typeof setTimeout> | undefined;
    loadChunk().then(
      (c) => live && setChunk(c),
      () => {
        if (live) retry = setTimeout(() => setTries(tries + 1), 5000);
      },
    );
    return () => {
      live = false;
      clearTimeout(retry);
    };
  }, [on, chunk, tries]);
  return on ? chunk : null;
}

/**
 * An upper-cell card's drawing on paper; `fallback` (the Korean-word face) while `upperCards` is off, the chunk is
 * loading, or the chunk draws no such card.
 */
export function UpperCardArtSlot({ cardId, size, fallback }: { cardId: string; size: number; fallback: ReactNode }): ReactElement {
  const ui = useChunk(useCurrFlag('upperCards'));
  if (ui === null || !ui.hasUpperCellArt(cardId)) return <>{fallback}</>;
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, width: size, height: size, backgroundColor: colors.surface.paper }}>
      <ui.UpperCellCardArt cardId={cardId} size={size} accessibilityLabel="" />
    </View>
  );
}

/**
 * An upper-cell card with its back (blurb, fact, source line) once the chunk is in, and whether it is in; any other card
 * as it is, ready. The card page waits for it before the card flips or shares, as it does for a story card's chunk.
 * `hidden`: `upperCards` is off for the learner and the card is not `held`, so the page shows "not found".
 */
export function useUpperCardBack(card: HeritageCard | undefined, held: boolean): { card: HeritageCard | undefined; ready: boolean; hidden: boolean } {
  const on = useCurrFlag('upperCards');
  const upper = card !== undefined && UPPER_CARD_GATED_IDS.has(card.id);
  const hidden = upper && !held && !on;
  // The chunk is asked for (and so non-null) only for a shown upper-cell card.
  const ui = useChunk(upper && !hidden);
  return { card: ui && card ? ui.withUpperBack(card) : card, ready: !upper || ui !== null, hidden };
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
