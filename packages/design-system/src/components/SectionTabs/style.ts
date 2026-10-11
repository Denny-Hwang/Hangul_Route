import { borderWidth, colors, radii, spacing, touchTarget, typography } from '../../tokens';

/**
 * Pure state styles behind `SectionTabs` (F-STORY-004 §3.3). The component only
 * paints what this returns, so both looks are unit-tested without a renderer.
 * Tokens only. Every tab is at least `touchTarget.min` (64) tall: the theme
 * filter chips (~36 dp, audit UX-25) are not reused. The selected tab differs
 * by fill, label weight and `accessibilityState.selected`, never by hue alone.
 */
export interface SectionTabStyle {
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
  borderRadius: number;
  minHeight: number;
  paddingHorizontal: number;
  textColor: string;
  fontSize: number;
  fontWeight: (typeof typography.weight)[keyof typeof typography.weight];
}

export function sectionTabStyle(selected: boolean): SectionTabStyle {
  return {
    backgroundColor: selected ? colors.brand.primary : colors.surface.paper,
    borderColor: selected ? colors.brand.primary : colors.border.strong,
    borderWidth: borderWidth.base,
    borderRadius: radii.pill,
    minHeight: touchTarget.min,
    paddingHorizontal: spacing.xl,
    textColor: selected ? colors.text.onPrimary : colors.text.primary,
    fontSize: typography.size.body,
    fontWeight: selected ? typography.weight.bold : typography.weight.semibold,
  };
}
