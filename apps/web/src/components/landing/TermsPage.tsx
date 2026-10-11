import { LEARNER_LEVELS } from '@hangul-route/content-schema';
import { colors, radii, spacing, typography } from '@hangul-route/design-system/tokens';
import { DEFAULT_LOCALE, getMessages, type LegalValues, type UiLocale } from '@hangul-route/i18n';
import Link from 'next/link';
import { CONTACT_EMAIL } from '../../data/contact';
import { sitePath } from '../../lib/site-path';

/** One legal item: a sentence, or a sentence naming the contact address or the level labels. */
type LegalItem = string | ((values: LegalValues) => string);

/**
 * Terms of Service — English-authoritative until legal review (F-I18N-001 L10).
 * The text is `landing.legal.terms` in `@hangul-route/i18n`; sections and items keep its key order.
 */
export function TermsPage({ locale = DEFAULT_LOCALE }: { locale?: UiLocale }): JSX.Element {
  const site = getMessages(locale).landing;
  const legal = site.legal;
  const t = legal.terms;
  const values: LegalValues = { email: CONTACT_EMAIL, levels: LEARNER_LEVELS.map((l) => l.label).join(' / ') };
  const text = (item: LegalItem): string => (typeof item === 'function' ? item(values) : item);
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: `${spacing.xxl}px ${spacing.lg}px` }}>
      <Link href={sitePath(locale, '/')} style={{ color: colors.brand.primary, fontWeight: 600 }}>
        {legal.backHome}
      </Link>
      <h1 style={{ fontSize: typography.size.display, marginTop: spacing.lg }}>{t.title}</h1>
      <p style={{ color: colors.text.muted, fontSize: typography.size.caption }}>
        {t.effective}
      </p>

      <div
        style={{
          marginTop: spacing.md,
          padding: spacing.md,
          backgroundColor: colors.feedback.infoLight,
          borderRadius: radii.md,
          color: colors.text.secondary,
          fontSize: typography.size.caption,
        }}
      >
        {legal.draft}
      </div>

      {Object.values(t.sections).map((section) => (
        <section key={section.heading} style={{ marginTop: spacing.xl }}>
          <h2 style={{ fontSize: typography.size.title }}>{section.heading}</h2>
          {'paragraphs' in section
            ? Object.values<LegalItem>(section.paragraphs).map((p, i) => (
                <p key={i} style={{ lineHeight: 1.7, color: colors.text.secondary }}>
                  {text(p)}
                </p>
              ))
            : null}
          {'bullets' in section ? (
            <ul style={{ lineHeight: 1.8, color: colors.text.secondary }}>
              {Object.values<LegalItem>(section.bullets).map((b, i) => (
                <li key={i}>{text(b)}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ))}

      <footer style={{ marginTop: spacing.jumbo, color: colors.text.muted, fontSize: typography.size.caption }}>
        <Link href={sitePath(locale, '/privacy')} style={{ color: colors.text.secondary, fontWeight: 600 }}>
          {t.otherDocument}
        </Link>{' '}
        · {site.footer.copyright(new Date().getFullYear())}
      </footer>
    </main>
  );
}
