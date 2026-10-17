import type { WidthClass } from '../../layout';
import type { TypeScale } from '../../text-size';
import { borderWidth, colors, radii, spacing, touchTarget, typography } from '../../tokens';
import type { IconName } from '../Icon/types';
import type { ScreenHeaderLeading, ScreenHeaderTitleSize } from './types';

/**
 * ScreenHeader's pure parts (design/components/ScreenHeader/spec.md, AMENDMENTS-DISPLAY-NAV
 * section 7.1): which glyph and test id a leading control has, where the title sits, and every
 * style, so they are unit-tested without a renderer. Tokens only.
 */

/** The leading glyph: `arrow-left` for Back, `close` for Close, none for a root. */
export function leadingIcon(kind: ScreenHeaderLeading): IconName | null {
  if (kind === 'back') return 'arrow-left';
  if (kind === 'close') return 'close';
  return null;
}

/** One test id per leading kind, the same on every screen (`screen-header-back`, `screen-header-close`). */
export function leadingTestId(kind: Exclude<ScreenHeaderLeading, 'none'>): string {
  return `screen-header-${kind}`;
}

/** The leading glyph's size (the mock's 24 on the 24 grid). */
export const LEADING_GLYPH = spacing.xl;

/**
 * Where the title sits. On a phone it takes its own line under the controls row, so a long title
 * (or Largest text) wraps at words across the whole width instead of in the gap between Back and
 * Aa (the fit rule, AMENDMENTS-DISPLAY-NAV section 4). From the regular class it sits in the row.
 * A flow's middle part (a quest's step dots) holds the row's middle, so a title then goes under it.
 */
export function titleInline(width: WidthClass, hasMiddle: boolean, forced = false): boolean {
  if (hasMiddle) return false;
  return forced || width !== 'compact';
}

type PressState = { pressed: boolean; focused?: boolean };

/**
 * The header block: the controls row (and the title under it on a phone), then a small gap before the content. A
 * title in the row already sits in the middle of a touch-target-tall row, so it needs no gap under it.
 */
export function headerStyle(titleInRow: boolean): Record<string, unknown> {
  return { marginBottom: titleInRow ? 0 : spacing.xs, gap: spacing.xs };
}

/**
 * The controls row: leading, the title or middle part, then the trailing controls at the right end. It wraps only
 * when the controls themselves cannot share one line (Close, Aa and the Romanization chip at 320 with Largest text):
 * the title and the middle part grow from nothing, so they never push a wrap; the trailing group then takes the next
 * line, still at the right.
 */
export const rowStyle = {
  flexDirection: 'row',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: spacing.sm,
  minHeight: touchTarget.min,
} as const;

/** The space between the leading control and the trailing ones when nothing else holds it. */
export const fillStyle = { flex: 1, minWidth: 0 } as const;

/** The trailing controls: the Display control, then at most one more; they keep their size and wrap as a group. */
export const trailingStyle = { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center', gap: spacing.sm, flexShrink: 0, maxWidth: '100%', marginLeft: 'auto' } as const;

/**
 * The leading control: the glyph and the visible word, a pill of at least one touch target both
 * ways, pulled `spacing.xs` into the gutter so the glyph lines up with the content edge. The focus
 * ring is a constant-width border that only changes colour, so focus never moves the row.
 */
export function leadingStyle(state: PressState): Record<string, unknown> {
  const focused = state.focused === true;
  return {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    gap: spacing.xs,
    minHeight: touchTarget.min,
    minWidth: touchTarget.min,
    paddingLeft: spacing.xs,
    paddingRight: spacing.md,
    marginLeft: -spacing.xs,
    borderRadius: radii.pill,
    borderWidth: borderWidth.thick,
    borderColor: focused ? colors.border.focus : 'transparent',
    backgroundColor: state.pressed ? colors.surface.sunken : 'transparent',
  };
}

/** The leading word: body, bold, primary text, at the chosen text size. */
export function leadingTextStyle(scale: TypeScale): Record<string, unknown> {
  const size = scale.size.body;
  return { fontSize: size, lineHeight: scale.lineHeight(size, 'tight'), fontWeight: typography.weight.bold, color: colors.text.primary };
}

/** The h1: `title` (or `prompt` for a long content title) at the chosen size (headings by the half rule), bold, tight. */
export function titleTextStyle(scale: TypeScale, size: ScreenHeaderTitleSize, inline: boolean): Record<string, unknown> {
  const fontSize = scale.size[size];
  return {
    ...(inline ? { flex: 1, minWidth: 0 } : null),
    fontSize,
    lineHeight: scale.lineHeight(fontSize, 'tight'),
    fontWeight: typography.weight.bold,
    color: colors.text.primary,
  };
}

/** How much a border grows when focus thickens it from `base` to `thick`. */
const FOCUS_GROW = borderWidth.thick - borderWidth.base;

/**
 * A border that thickens on focus (`base` to `thick`) and keeps the control's box: the padding gives back what the
 * border takes, across and down. Every control of the header row draws its ring this way, so focus never moves it.
 * The row wraps only when its controls cannot share one line; a control that grew on focus at that edge would jump to
 * the next line between a press and its release, and the tap would do nothing (AMENDMENTS-DISPLAY-NAV section 7.1).
 */
export function steadyFocusBorder(focused: boolean, paddingHorizontal: number): { borderWidth: number; paddingHorizontal: number; paddingVertical: number } {
  return {
    borderWidth: focused ? borderWidth.thick : borderWidth.base,
    paddingHorizontal: paddingHorizontal - (focused ? FOCUS_GROW : 0),
    paddingVertical: focused ? 0 : FOCUS_GROW,
  };
}

/**
 * The Display (Aa) control: a paper pill of at least one touch target with the strong border; the
 * focus ring thickens and recolours the border inside the same box. The sign is bodyLg bold at the chosen size.
 */
export function displayControlStyle(state: PressState): Record<string, unknown> {
  const focused = state.focused === true;
  return {
    minHeight: touchTarget.min,
    minWidth: touchTarget.min,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    backgroundColor: state.pressed ? colors.surface.sunken : colors.surface.paper,
    ...steadyFocusBorder(focused, spacing.md),
    borderColor: focused ? colors.border.focus : colors.border.strong,
  };
}

/** The Display control's sign. */
export function displayTextStyle(scale: TypeScale): Record<string, unknown> {
  return { fontSize: scale.size.bodyLg, fontWeight: typography.weight.bold, color: colors.text.primary };
}
