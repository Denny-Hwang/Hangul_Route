/**
 * PipRow types (F-ROUTE-001 R-2b; design/components/PipRow/spec.md). The pip
 * states are the same five as `PipState` in `apps/mobile/src/logic/my-route/`;
 * the design system does not import the app, so the union is restated here.
 */

/** done = finished; known = placed out by the level check (not done); open = playable; new = joined a Complete stage; later = not shipped. */
export type PipState = 'done' | 'known' | 'open' | 'new' | 'later';

/** `stage`: 20 dp pips in a stage row. `cell`: 24 dp pips in a cell row (expanded stage). */
export type PipContext = 'stage' | 'cell';

/** One pip to draw. */
export interface PipView {
  /** Stable React key (the quest id or the cell key). */
  key: string;
  state: PipState;
  /** The quest the learner plays next: a drawn marker above the pip. */
  isCursor?: boolean;
  /** "You started here": a drawn pin below the pip. */
  isStart?: boolean;
}

export interface PipRowProps {
  /**
   * Pips in route order, in groups drawn with a wider gap between them (for
   * example the earned group, then the new quests that joined a Complete
   * stage). Empty groups are skipped. The row wraps onto more lines when it
   * runs out of width; it never draws a track or a fixed count of slots.
   */
  groups: readonly (readonly PipView[])[];
  /** Default `stage` (20 dp). Sizes scale with the layout class (`useMediaSize`). */
  context?: PipContext;
  /** Fill of a done pip: a colour token, usually `colors.stage[stage]` (decoration only). Default `colors.border.shape`. */
  accent?: string;
  /**
   * Measure the row and reserve the cursor and start bands per line, not for
   * every line (LR-11: the route card's two lines of pips at 320). Default
   * false: the row wraps by itself and every line keeps the bands.
   */
  bandsPerLine?: boolean;
  testID?: string;
}

export interface PipProps {
  state: PipState;
  /** Default `stage` (20 dp). */
  context?: PipContext;
  /** Fill of a done pip (a colour token). Default `colors.border.shape`. */
  accent?: string;
  testID?: string;
}
