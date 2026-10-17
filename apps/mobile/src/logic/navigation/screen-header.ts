/**
 * Which header a screen draws (AMENDMENTS-DISPLAY-NAV section 7.1, row DN-4): the route's variant
 * (`SCREEN_HEADER_VARIANTS`), whether the navigator can go back, and what the screen passed. Pure,
 * so every rule is unit-tested; `components/LearnerScreenHeader.tsx` paints it.
 *
 * - **Exceptions** (`PlacementInvite`, `FirstQuestPreview`, the end of first-run setup) draw the
 *   header with no leading control: their own buttons are the ways on.
 * - **Roots** (Welcome, the four tabs, All lessons home, BrowseAccess) have no leading control and
 *   draw a header only when the screen asks for one (a title or the Display control row).
 * - **Back and Close** are drawn only when the navigator can go back (there is somewhere to go);
 *   the header itself still draws, so the Display control is there.
 * - A root with its own way out (All lessons home's Close) names its leading control itself.
 */
export type ScreenHeaderVariant = 'back' | 'close' | 'none';

export interface ScreenHeaderInput {
  /** The route's variant; a route the table does not know reads as a stack screen (`back`). */
  variant: ScreenHeaderVariant | undefined;
  /** In `SCREEN_HEADER_EXCEPTIONS`. */
  exception: boolean;
  /** The screen passed header options (`Screen`'s `header`). */
  declared: boolean;
  canGoBack: boolean;
  /** The screen's own leading control (a root's way out), with whether it has its own action. */
  override?: { kind: ScreenHeaderVariant; hasAction: boolean };
}

export interface ScreenHeaderDecision {
  /** Whether the header is drawn at all. */
  draw: boolean;
  /** The leading control it draws. */
  leading: ScreenHeaderVariant;
}

export function screenHeaderDecision(input: ScreenHeaderInput): ScreenHeaderDecision {
  if (input.exception) return { draw: true, leading: 'none' };
  if (input.override !== undefined) {
    const { kind, hasAction } = input.override;
    return { draw: true, leading: kind === 'none' || hasAction || input.canGoBack ? kind : 'none' };
  }
  const variant = input.variant ?? 'back';
  if (variant === 'none') return { draw: input.declared, leading: 'none' };
  return { draw: true, leading: input.canGoBack ? variant : 'none' };
}
