import { RealiaSheet, realiaBaseKind, type RealiaSheetProps } from '@hangul-route/design-system';
import { useEffect, useState, type ReactElement } from 'react';

/*
 * The start bundle's door to the eight realia layouts of F-CURR-002 row CM-47 (a recipe card, a receipt, a food label,
 * a weather forecast, a calendar, a timetable, a map, a poster): their layouts, looks and dressings are a chunk of their
 * own (`./realia-kinds-chunk.tsx`, marker `screen-chunk:realia-kinds`), reached only through the literal `import()`
 * below, so the start bundle does not grow by them. Realia Read and Cloze Pick's realia card draw every sheet through
 * `RealiaSheetView`; the presenter's stage sheet asks for the same chunk through `useRealiaKinds` (it must not import
 * the chunk's modules itself: Metro would hoist modules two lazy bundles share into the start bundle).
 * A G-2 kind (menu, ticket, trail sign, price cards) never asks for the chunk. A CM-47 kind is the plain sheet (the same
 * lines on paper, the same buttons and names) until the chunk is in, and stays so when it cannot load (a failed load is
 * asked for again on the next mount), so a round always plays.
 */

type Chunk = typeof import('./realia-kinds-chunk');
let loading: Promise<Chunk | null> | undefined;
let loaded: Chunk | null = null;

/** Asks for the chunk once (again after a failed load): the chunk, or null when it cannot load. */
export function loadRealiaKinds(): Promise<Chunk | null> {
  loading ??= import('./realia-kinds-chunk').then(
    (chunk) => (loaded = chunk),
    () => {
      loading = undefined;
      return null;
    },
  );
  return loading;
}

/** The chunk once it is in, asked for while `wanted` (a sheet of a CM-47 kind is drawn); null before. */
export function useRealiaKinds(wanted: boolean): Chunk | null {
  const [ui, setUi] = useState(loaded);
  useEffect(() => {
    if (!wanted || ui) return undefined;
    let live = true;
    void loadRealiaKinds().then((chunk) => live && chunk && setUi(chunk));
    return () => {
      live = false;
    };
  }, [wanted, ui]);
  return ui;
}

/** A realia sheet of any kind: `RealiaSheet` for a G-2 kind, the chunk's `RealiaKindSheet` for a CM-47 one once it is in. */
export function RealiaSheetView(props: RealiaSheetProps): ReactElement {
  const added = realiaBaseKind(props.kind) !== props.kind;
  const ui = useRealiaKinds(added);
  return added && ui ? <ui.RealiaKindSheet {...props} /> : <RealiaSheet {...props} />;
}
