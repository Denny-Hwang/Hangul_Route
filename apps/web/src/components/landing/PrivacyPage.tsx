import { LEARNER_LEVELS } from '@hangul-route/content-schema';
import { colors, layout, spacing, typography } from '@hangul-route/design-system/tokens';
import { DEFAULT_LOCALE, getMessages, type LegalValues, type UiLocale } from '@hangul-route/i18n';
import Link from 'next/link';
import { CONTACT_EMAIL } from '../../data/contact';
import { sitePath } from '../../lib/site-path';
import { HIT, rem } from '../../lib/site-style';
import { EnglishAuthoritativeNotice } from './EnglishAuthoritativeNotice';
import { SiteShell } from './SiteShell';

/** One legal item: a sentence, or a sentence naming the contact address or the level labels. */
type LegalItem = string | ((values: LegalValues) => string);

/**
 * Privacy Policy — English-authoritative until legal review (F-I18N-001 L10).
 * The text is `landing.legal.privacy` in `@hangul-route/i18n`; sections and items keep its key order.
 */
export function PrivacyPage({ locale = DEFAULT_LOCALE }: { locale?: UiLocale }): JSX.Element {
  const legal = getMessages(locale).landing.legal;
  const t = legal.privacy;
  // English level names on purpose: the legal body stays English in every locale (L10), so it quotes the English
  // `LEARNER_LEVELS` labels, not `common.levels` (the UI-locale words the app and console draw).
  const values: LegalValues = { email: CONTACT_EMAIL, levels: LEARNER_LEVELS.map((l) => l.label).join(' / ') };
  const text = (item: LegalItem): string => (typeof item === 'function' ? item(values) : item);
  // The document stays English in every locale (L10): marked `lang="en"` inside a `/es` or `/ko` page, unmarked on the English page.
  const docLang = locale === DEFAULT_LOCALE ? undefined : 'en';
  return (
    <SiteShell locale={locale} page="/privacy" variant="legal">
      <div style={{ maxWidth: layout.maxWidth.reading, margin: '0 auto', paddingBlock: spacing.xl }}>
        <Link href={sitePath(locale, '/')} style={{ ...HIT, justifyContent: 'flex-start', color: colors.brand.primary, fontWeight: typography.weight.semibold }}>
          {legal.backHome}
        </Link>
        {docLang ? <EnglishAuthoritativeNotice text={legal.englishAuthoritative} /> : null}
        <h1 lang={docLang} style={{ fontSize: rem(typography.size.display), marginTop: spacing.lg }}>{t.title}</h1>
        <p lang={docLang} style={{ color: colors.text.muted, fontSize: rem(typography.size.caption) }}>
          {t.effective}
        </p>

        {Object.values(t.sections).map((section) => (
          <section key={section.heading} lang={docLang} style={{ marginTop: spacing.xl }}>
            <h2 style={{ fontSize: rem(typography.size.title) }}>{section.heading}</h2>
            {'paragraphs' in section
              ? Object.values<LegalItem>(section.paragraphs).map((p, i) => (
                  <p key={i} style={{ lineHeight: typography.leading.relaxed, color: colors.text.secondary }}>
                    {text(p)}
                  </p>
                ))
              : null}
            {'bullets' in section ? (
              <ul style={{ lineHeight: typography.leading.relaxed, color: colors.text.secondary }}>
                {Object.values<LegalItem>(section.bullets).map((b, i) => (
                  <li key={i}>{text(b)}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}

        <footer style={{ marginTop: spacing.jumbo, color: colors.text.muted, fontSize: rem(typography.size.caption) }}>
          <Link href={sitePath(locale, '/terms')} lang={docLang} style={{ ...HIT, justifyContent: 'flex-start', color: colors.text.secondary, fontWeight: typography.weight.semibold }}>
            {t.otherDocument}
          </Link>
        </footer>
      </div>
    </SiteShell>
  );
}
