import { colors, typography } from '@hangul-route/design-system/tokens';
import type { ReactNode } from 'react';

export interface SiteDocumentProps {
  lang: string;
  children: ReactNode;
  /**
   * Extra attributes on `<html>`. The locale layout passes `HIDDEN_LOCALE_ATTR` for a locale that has not
   * shipped, so the postbuild step removes its pages from the export.
   */
  htmlAttrs?: Readonly<Record<string, string>>;
}

/**
 * The `<html>` and `<body>` every root layout renders (F-I18N-001 §3.4, PR 11b). The app has three root
 * layouts — `(en)`, `(loc)/[locale]` and `(console)` — so the static HTML can carry the right
 * `<html lang>` without middleware; this keeps their body one and the same.
 */
/**
 * The system sans stack. Roboto, Helvetica Neue and Arial come before `system-ui` so a Linux browser (and the CI
 * runner that measures the F-SITE-002 §3.11 height budgets) uses a sans with the metrics of the phones and desktops
 * the site is for, instead of fontconfig's wide default (DejaVu Sans). Apple, Windows and Android pick their own
 * system font earlier in the list, as before.
 */
export const SYSTEM_SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, system-ui, sans-serif';

export function SiteDocument({ lang, children, htmlAttrs }: SiteDocumentProps): JSX.Element {
  return (
    <html lang={lang} {...htmlAttrs}>
      <body
        style={{
          margin: 0,
          backgroundColor: colors.surface.canvas,
          color: colors.text.primary,
          fontFamily: typography.family.sans === 'System' ? SYSTEM_SANS : typography.family.sans,
          fontSize: typography.size.body,
          lineHeight: typography.leading.normal,
        }}
      >
        {children}
      </body>
    </html>
  );
}
