import { colors, layout, radii, spacing, typography } from '@hangul-route/design-system/tokens';
import { DEFAULT_LOCALE, getMessages, type UiLocale } from '@hangul-route/i18n';
import Link from 'next/link';
import { CONTACT_EMAIL } from '../../data/contact';
import { sitePath } from '../../lib/site-path';
import { HIT, rem } from '../../lib/site-style';
import { SiteShell } from './SiteShell';

/**
 * `/about` (F-SITE-002 §3.7): its body as before, inside the site header and footer. "Back home" stays; the links to
 * Privacy and Terms are the footer's (Company group), so the page no longer repeats them under its body.
 */
export function AboutPage({ locale = DEFAULT_LOCALE }: { locale?: UiLocale }): JSX.Element {
  const t = getMessages(locale).landing.about;
  return (
    <SiteShell locale={locale} page="/about">
      <div style={{ maxWidth: layout.maxWidth.reading, margin: '0 auto', paddingBlock: spacing.xl }}>
        <Link href={sitePath(locale, '/')} style={{ ...HIT, justifyContent: 'flex-start', color: colors.brand.primary, fontWeight: typography.weight.semibold }}>
          {t.backHome}
        </Link>
        <h1 style={{ fontSize: rem(typography.size.display), marginTop: spacing.lg }}>{t.title}</h1>
        <p style={{ fontSize: rem(typography.size.bodyLg), color: colors.text.secondary }}>{t.lead}</p>

        <section style={{ marginTop: spacing.xl }}>
          <h2>{t.promises.title}</h2>
          <ul style={{ lineHeight: typography.leading.relaxed }}>
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
      </div>
    </SiteShell>
  );
}
