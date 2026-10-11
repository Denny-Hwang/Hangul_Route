import { colors, spacing, typography } from '@hangul-route/design-system/tokens';
import { LOCALE_META, type UiLocale } from '@hangul-route/i18n';
import type { SitePage } from '../../lib/site-metadata';
import { sitePath } from '../../lib/site-path';

/**
 * The footer's locale switcher (F-I18N-001 §3.3, PR 11c; wireframe profile/language-picker C): plain links to
 * the same page in each shown locale, named by their endonyms (fixed constants, so a visitor who cannot read
 * the current language still finds their own), each with `hreflang` and `lang`. Plain `<a>`: each locale is
 * its own document (`<html lang>`), so a switch loads a new page. Renders nothing while only English ships.
 */
export function LocaleSwitcher({ locale, page, label, shown }: { locale: UiLocale; page: SitePage; label: string; shown: readonly UiLocale[] }): JSX.Element | null {
  if (shown.length < 2) return null;
  return (
    <nav aria-label={label}>
      <div
        style={{
          fontWeight: typography.weight.bold,
          color: colors.text.primary,
          marginBottom: spacing.xs,
        }}
      >
        {label}
      </div>
      {shown.map((target) => {
        const { endonym, htmlLang } = LOCALE_META[target];
        const current = target === locale;
        return (
          <div key={target}>
            <a
              href={sitePath(target, page)}
              hrefLang={htmlLang}
              lang={htmlLang}
              aria-current={current ? 'page' : undefined}
              style={{ color: current ? colors.text.primary : colors.text.secondary, fontWeight: current ? typography.weight.bold : typography.weight.regular }}
            >
              {endonym}
            </a>
          </div>
        );
      })}
    </nav>
  );
}
