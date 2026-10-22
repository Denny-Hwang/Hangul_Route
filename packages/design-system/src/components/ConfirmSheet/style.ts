import type { TypeScale } from '../../text-size';
import { borderWidth, colors, layout, radii, shadows, spacing, touchTarget, typography } from '../../tokens';

/**
 * ConfirmSheet's pure styles (design/components/ConfirmSheet/spec.md; AMENDMENTS-DISPLAY-NAV
 * section 8): a bottom sheet on a phone and a centred dialog of the reading width from the regular
 * class; the safe choice first as the secondary button, the confirm second as the primary one. No
 * red: a destructive action says so in its label, never by colour, except the one `danger` confirm of a grown-up's
 * destructive step ([OA] OA-0b addendum, Remove anyway).
 */

type PressState = { pressed: boolean; focused?: boolean };

/** The dim layer: the sheet at the bottom on a phone, the dialog in the middle from the regular class. */
export function backdropStyle(dialog: boolean): Record<string, unknown> {
  return { flex: 1, justifyContent: dialog ? 'center' : 'flex-end', alignItems: dialog ? 'center' : 'stretch', backgroundColor: colors.surface.overlay, padding: dialog ? spacing.lg : 0 };
}

/**
 * The sheet itself: paper, rounded top corners (all four as a dialog), the gutter inside. The bottom sheet adds the
 * safe-area bottom inset to its bottom padding, so its last button never sits under a notched iPhone's home
 * indicator or an iOS home-screen app's; the centred dialog needs none.
 */
export function sheetStyle(dialog: boolean, bottomInset = 0): Record<string, unknown> {
  return {
    width: '100%',
    maxWidth: dialog ? layout.maxWidth.reading : undefined,
    backgroundColor: colors.surface.paper,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    borderBottomLeftRadius: dialog ? radii.xl : 0,
    borderBottomRightRadius: dialog ? radii.xl : 0,
    paddingTop: spacing.xl,
    paddingBottom: dialog ? spacing.xl : spacing.xl + bottomInset,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    ...shadows.modal,
  };
}

/** The buttons: one row that wraps, each at least a touch target, stacked full width on a phone. */
export function actionsStyle(dialog: boolean): Record<string, unknown> {
  return dialog ? { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm } : { flexDirection: 'column', gap: spacing.sm };
}

/**
 * One button: the safe choice is paper with the strong border; the confirm is the primary fill, or, with `tone`
 * `danger` ([OA] a grown-up's destructive confirmation only, OA-0b addendum), `feedback.danger` with `text.onPrimary`.
 */
export function actionStyle(kind: 'cancel' | 'confirm', dialog: boolean, state: PressState, tone: 'primary' | 'danger' = 'primary'): Record<string, unknown> {
  const focused = state.focused === true;
  const confirm = kind === 'confirm';
  if (confirm && tone === 'danger') {
    return {
      ...(dialog ? { flexGrow: 1, flexShrink: 1, flexBasis: spacing.xxxl * 4 } : { width: '100%' }),
      minHeight: touchTarget.min,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderRadius: radii.pill,
      borderWidth: focused || state.pressed ? borderWidth.thick : borderWidth.base,
      borderColor: focused ? colors.border.focus : state.pressed ? colors.text.primary : colors.feedback.danger,
      backgroundColor: colors.feedback.danger,
    };
  }
  return {
    ...(dialog ? { flexGrow: 1, flexShrink: 1, flexBasis: spacing.xxxl * 4 } : { width: '100%' }),
    minHeight: touchTarget.min,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: focused ? borderWidth.thick : borderWidth.base,
    borderColor: focused ? colors.border.focus : confirm ? (state.pressed ? colors.brand.primaryDark : colors.brand.primary) : colors.border.strong,
    backgroundColor: confirm ? (state.pressed ? colors.brand.primaryDark : colors.brand.primary) : state.pressed ? colors.surface.sunken : colors.surface.paper,
  };
}

/** A button's label: body bold, at the chosen text size. */
export function actionTextStyle(kind: 'cancel' | 'confirm', scale: TypeScale): Record<string, unknown> {
  const size = scale.size.body;
  return { fontSize: size, lineHeight: scale.lineHeight(size, 'tight'), fontWeight: typography.weight.bold, textAlign: 'center', color: kind === 'confirm' ? colors.text.onPrimary : colors.text.primary };
}

/** [OA] The quiet third action (Remove anyway): underlined secondary text, no fill, at least a touch target. */
export function quietActionStyle(dialog: boolean, state: PressState): Record<string, unknown> {
  const focused = state.focused === true;
  return {
    ...(dialog ? { flexBasis: '100%' } : { width: '100%' }),
    minHeight: touchTarget.min,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: focused ? borderWidth.thick : 0,
    borderColor: focused ? colors.border.focus : 'transparent',
    backgroundColor: state.pressed ? colors.surface.sunken : 'transparent',
  };
}

/** [OA] The quiet action's label: body, `text.secondary`, underlined. */
export function quietTextStyle(scale: TypeScale): Record<string, unknown> {
  const size = scale.size.body;
  return { fontSize: size, lineHeight: scale.lineHeight(size, 'tight'), fontWeight: typography.weight.semibold, textAlign: 'center', color: colors.text.secondary, textDecorationLine: 'underline' };
}
