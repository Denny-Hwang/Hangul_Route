import { colors, radii, spacing, typography } from '@hangul-route/design-system/tokens';
import { DEFAULT_LOCALE, getMessages, type UiLocale } from '@hangul-route/i18n';
import Link from 'next/link';
import { CONTACT_EMAIL } from '../../data/contact';
import { sitePath } from '../../lib/site-path';

export function AboutPage({ locale = DEFAULT_LOCALE }: { locale?: UiLocale }): JSX.Element {
  const t = getMessages(locale).landing.about;
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: `${spacing.xxl}px ${spacing.lg}px` }}>
      <Link href={sitePath(locale, '/')} style={{ color: colors.brand.primary, fontWeight: 600 }}>
        {t.backHome}
      </Link>
      <h1 style={{ fontSize: typography.size.display, marginTop: spacing.lg }}>{t.title}</h1>
      <p style={{ fontSize: typography.size.bodyLg, color: colors.text.secondary }}>
        {t.lead}
      </p>

      <section style={{ marginTop: spacing.xl }}>
        <h2>{t.promises.title}</h2>
        <ul style={{ lineHeight: 1.8 }}>
          <li>{t.promises.plainEnglish}</li>
          <li>{t.promises.koreanTaught}</li>
          <li>{t.promises.noRed}</li>
          <li>{t.promises.noAds}</li>
          <li>{t.promises.localFirst}</li>
          <li>{t.promises.gate}</li>
        </ul>
      </section>

      <section style={{ marginTop: spacing.xl, padding: spacing.lg, backgroundColor: colors.brand.primaryLight, borderRadius: radii.lg }}>
        <h3 style={{ marginTop: 0 }}>{t.feedback.title}</h3>
        <p style={{ margin: 0 }}>{t.feedback.body(CONTACT_EMAIL)}</p>
      </section>

      <footer style={{ marginTop: spacing.jumbo, color: colors.text.muted, fontSize: typography.size.caption }}>
        <Link href={sitePath(locale, '/privacy')} style={{ color: colors.text.secondary, fontWeight: 600 }}>
          {t.privacy}
        </Link>{' '}
        ·{' '}
        <Link href={sitePath(locale, '/terms')} style={{ color: colors.text.secondary, fontWeight: 600 }}>
          {t.terms}
        </Link>
      </footer>
    </main>
  );
}
