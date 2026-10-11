'use client';

import { UiLocaleSchema } from '@hangul-route/content-schema';
import { colors, radii, spacing, typography } from '@hangul-route/design-system/tokens';
import { LOCALE_META } from '@hangul-route/i18n';
import { useConsoleLocale } from '@/lib/i18n/locale-context';

/**
 * Console header language select — F-I18N-001 §3.3; wireframe
 * `design/wireframes/profile/language-picker.md` §C ("[ Language v ]" first in the
 * header nav, a native select of endonyms). Rendered only when more than one locale
 * is available, the same `LOCALE_STATUS` rule as the mobile pickers, so it stays
 * hidden until Spanish or Korean ships (or on a `NEXT_PUBLIC_SHOW_ALL_LOCALES=1`
 * QA build). Each option carries its own `lang` so a screen reader speaks the
 * endonym in that language.
 */
export function LanguageSelect(): JSX.Element | null {
  const { locale, available, messages, setLocale } = useConsoleLocale();
  if (available.length < 2) return null;
  return (
    <select
      aria-label={messages.console.language.label}
      value={locale}
      data-testid="console-language"
      onChange={(event) => {
        const next = UiLocaleSchema.safeParse(event.target.value);
        if (next.success) setLocale(next.data);
      }}
      style={{
        padding: `${spacing.sm}px ${spacing.md}px`,
        borderRadius: radii.pill,
        border: `1px solid ${colors.border.strong}`,
        backgroundColor: colors.surface.paper,
        color: colors.text.primary,
        fontSize: typography.size.bodySm,
        fontWeight: typography.weight.bold,
        cursor: 'pointer',
      }}
    >
      {available.map((option) => (
        <option key={option} value={option} lang={LOCALE_META[option].htmlLang}>
          {LOCALE_META[option].endonym}
        </option>
      ))}
    </select>
  );
}
