import type { TypeScale } from '../../text-size';
import { borderWidth, colors, layout, radii, shadows, spacing, touchTarget, typography } from '../../tokens';

/**
 * ConfirmSheet's pure styles (design/components/ConfirmSheet/spec.md; AMENDMENTS-DISPLAY-NAV
 * section 8): a bottom sheet on a phone and a centred dialog of the reading width from the regular
 * class; the safe choice first as the secondary button, the confirm second as the primary one. No
 * red: a destructive action says so in its label, never by colour.
 */

type PressState = { pressed: boolean; focused?: boolean };

/** The dim layer: the sheet at the bottom on a phone, the dialog in the middle from the regular class. */
export function backdropStyle(dialog: boolean): Record<string, unknown> {
  return { flex: 1, justifyContent: dialog ? 'center' : 'flex-end', alignItems: dialog ? 'center' : 'stretch', backgroundColor: colors.surface.overlay, padding: dialog ? spacing.lg : 0 };
}

/** The sheet itself: paper, rounded top corners (all four as a dialog), the gutter inside. */
export function sheetStyle(dialog: boolean): Record<string, unknown> {
  return {
    width: '100%',
    maxWidth: dialog ? layout.maxWidth.reading : undefined,
    backgroundColor: colors.surface.paper,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    borderBottomLeftRadius: dialog ? radii.xl : 0,
    borderBottomRightRadius: dialog ? radii.xl : 0,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    ...shadows.modal,
  };
}

/** The buttons: one row that wraps, each at least a touch target, stacked full width on a phone. */
export function actionsStyle(dialog: boolean): Record<string, unknown> {
  return dialog ? { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm } : { flexDirection: 'column', gap: spacing.sm };
}

/** One button: the safe choice is paper with the strong border; the confirm is the primary fill. */
export function actionStyle(kind: 'cancel' | 'confirm', dialog: boolean, state: PressState): Record<string, unknown> {
  const focused = state.focused === true;
  const confirm = kind === 'confirm';
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
