/**
 * Type on the grown-up pages is written in rem from the px tokens (owner items 6 and 7), so the
 * device's chosen text size, applied as `html { font-size: calc(100% * var(--hr-text-scale, 1)) }`
 * (set on `<html>` by the locale provider), grows every text with it, and so does the browser's own
 * text size.
 */
export const ROOT_FONT_PX = 16;

/** `px` from a token, as rem of the 16 px root. */
export function rem(px: number): string {
  return `${px / ROOT_FONT_PX}rem`;
}

/** The root font size the provider puts on `<html>`: it follows the chosen step (1 when unset). */
export const ROOT_FONT_SIZE = 'calc(100% * var(--hr-text-scale, 1))';
