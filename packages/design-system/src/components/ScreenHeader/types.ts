import type { ReactNode } from 'react';

/**
 * The leading control (AMENDMENTS-DISPLAY-NAV section 7.1): `back` for stack screens, `close` for
 * modals and flows that ask before leaving, `none` for roots and the exception list.
 */
export type ScreenHeaderLeading = 'back' | 'close' | 'none';

/** The title's type size: `title` for a screen name, `prompt` for a long content title (a topic, a story). */
export type ScreenHeaderTitleSize = 'title' | 'prompt';

export interface ScreenHeaderProps {
  leading: ScreenHeaderLeading;
  /** The leading control's visible label and accessible name (`common.buttons.back` / `.close`). */
  leadingLabel?: string;
  /** `navigation.goBack()`, through the screen's `beforeRemove` guard. */
  onLeading?: () => void;
  /** The screen's h1; wraps, never truncates. On a phone it sits under the controls row. */
  title?: string;
  titleSize?: ScreenHeaderTitleSize;
  /** The title's language when it is not the UI language (a Korean content title). */
  titleLang?: string;
  /**
   * The title stays in the controls row at every width (it wraps there): for a short screen name on a screen that
   * budgets its height (a tab root's name beside the Display control, the PIN screen), so the header costs no row.
   */
  titleInline?: boolean;
  /** A flow's own middle part (a quest's step dots); drawn between the controls, never with `title` inline. */
  middle?: ReactNode;
  /** The Display control's visible sign (`common.display.button`, "Aa"). */
  displayLabel?: string;
  /** Its accessible name, which begins with the visible sign (`common.display.a11y`, WCAG 2.5.3). */
  displayA11y?: string;
  /** Opens the Display sheet; absent: no Display control. */
  onDisplay?: () => void;
  /** Hidden while a session clock runs (a Speed Round in Challenge mode, a Daily test, a timed placement item). */
  displayHidden?: boolean;
  /** At most one more control after the Display control (Home's Profile button). */
  trailing?: ReactNode;
  /** The header block's height once laid out (a screen that budgets the window's height, the PIN pad). */
  onHeight?: (height: number) => void;
  testID?: string;
}

/**
 * What a screen tells the header its route draws (the `header` prop of `Screen`): the route decides
 * the leading control (the app's `SCREEN_HEADER_VARIANTS`), the screen adds its title, a middle
 * part, one trailing control, and whether the Display control hides for a running clock.
 */
export interface ScreenHeaderOptions {
  title?: string;
  titleSize?: ScreenHeaderTitleSize;
  titleLang?: string;
  titleInline?: boolean;
  middle?: ReactNode;
  trailing?: ReactNode;
  displayHidden?: boolean;
  /** The header block's height once laid out, for a screen that budgets the window's height (the PIN pad). */
  onHeight?: (height: number) => void;
  /**
   * The screen draws the header itself, inside its own layout (the level check's item side by side on a short
   * landscape window, where a row above both columns would take the choices' height); `Screen` then draws none.
   */
  drawnByScreen?: boolean;
  /**
   * A leading control that is not the navigator's way back (All lessons home's Close, which leaves
   * All lessons for the page that opened it). Only for a root that has its own way out.
   */
  leading?: { kind: ScreenHeaderLeading; label?: string; onPress?: () => void };
}
