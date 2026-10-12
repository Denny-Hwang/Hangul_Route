/**
 * The navigation adapter (F-BROWSE-001 §4.7, BR-5c). `MinigameScreen`,
 * `StoryReaderScreen` and `StorySourcesScreen` leave through these exits
 * instead of naming learner routes, so another stack (All lessons) can host
 * them. Each prop is optional: left out, the screen keeps its learner route.
 */
export interface ScreenExitProps {
  /** Leave the screen (the previous screen). */
  onBack?: () => void;
  /** The home of the stack hosting the screen. */
  onHome?: () => void;
  /** Open a link a story cites; `null` makes links copy-only (no Open action). */
  onOpenLink?: ((url: string) => void) | null;
}

export interface ScreenExits {
  back: () => void;
  home: () => void;
  openLink: ((url: string) => void) | null;
}

export interface LearnerExits {
  back: () => void;
  home: () => void;
  openLink: (url: string) => void;
}

/** The exits a screen uses: each given prop, else its learner default. */
export function resolveScreenExits(props: ScreenExitProps, learner: LearnerExits): ScreenExits {
  return {
    back: props.onBack ?? learner.back,
    home: props.onHome ?? learner.home,
    openLink: props.onOpenLink === undefined ? learner.openLink : props.onOpenLink,
  };
}

/** The previous screen when the stack has one, else `home` (a reload or a deep link lands with no history). */
export function backOrHome(stack: { canGoBack(): boolean; goBack(): void }, home: () => void): void {
  if (stack.canGoBack()) stack.goBack();
  else home();
}
