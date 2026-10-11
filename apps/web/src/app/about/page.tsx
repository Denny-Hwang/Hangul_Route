import { colors, radii, spacing, typography } from '@hangul-route/design-system/tokens';
import { DEFAULT_LOCALE, getMessages } from '@hangul-route/i18n';
import Link from 'next/link';
import { CONTACT_EMAIL } from '../../data/contact';

/** The cross mark the page has always shown in the "no red" promise; passed in, never written into a message. */
const CROSS_MARK = '❌';

export default function AboutPage(): JSX.Element {
  const t = getMessages(DEFAULT_LOCALE).landing.about;
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: `${spacing.xxl}px ${spacing.lg}px` }}>
      <Link href="/" style={{ color: colors.brand.primary, fontWeight: 600 }}>
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
          <li>{t.promises.noRed(CROSS_MARK)}</li>
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
        <Link href="/privacy" style={{ color: colors.text.secondary, fontWeight: 600 }}>
          {t.privacy}
        </Link>{' '}
        ·{' '}
        <Link href="/terms" style={{ color: colors.text.secondary, fontWeight: 600 }}>
          {t.terms}
        </Link>
      </footer>
    </main>
  );
}
