import { colors, radii, spacing, typography } from '@hangul-route/design-system/tokens';

/**
 * The localized line above the Privacy Policy and Terms on `/es` and `/ko` (F-I18N-001 decision L10, §4):
 * the document below stays in English until legal review, and the English version is the one that applies.
 * The words come from the page's locale (`landing.legal.englishAuthoritative`); the English pages never show it.
 */
export function EnglishAuthoritativeNotice({ text }: { text: string }): JSX.Element {
  return (
    <p
      role="note"
      data-testid="english-authoritative"
      style={{
        marginTop: spacing.lg,
        marginBottom: 0,
        padding: spacing.md,
        backgroundColor: colors.feedback.nudgeLight,
        borderRadius: radii.md,
        color: colors.text.primary,
        fontSize: typography.size.body,
        fontWeight: typography.weight.bold,
      }}
    >
      {text}
    </p>
  );
}
