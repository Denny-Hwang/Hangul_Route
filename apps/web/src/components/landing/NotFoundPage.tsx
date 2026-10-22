import { colors, typography } from '@hangul-route/design-system/tokens';
import { HoyaSvg } from '@hangul-route/design-system/scene-art/dom';
import { DEFAULT_LOCALE, getMessages, type UiLocale } from '@hangul-route/i18n';
import { learnerStart } from '../../lib/site-links';
import { sitePath } from '../../lib/site-path';
import { SITE_SIZES, rem } from '../../lib/site-style';
import { PrimaryAction, TextLink } from './site-parts';
import { SiteShell } from './SiteShell';

/**
 * The site's 404 body in `locale` (F-SITE-002 §3.7; AMENDMENTS-SITE-NEWUSER §3.7, row SN-2; mock
 * `design/screens/site/newuser/mock/<locale>/404.html`): inside the site header and footer, Hoya waving (decorative;
 * OD-SN-7: a missing page is not the visitor's miss), the page's one h1 (`notFound.title`), a line that says the link
 * may be old, the text link to the home page of the same locale, then Start learning (`PrimaryAction`, the learner
 * app). Sizes and spacing that change at 45em are the `hr-site-404*` rules of `globals.css`. English at
 * `out/404.html` (`app/not-found.tsx`); `/es` and `/ko` at `out/es/404.html` and `out/ko/404.html` (`[locale]/404`).
 */
export function NotFoundPage({ locale = DEFAULT_LOCALE }: { locale?: UiLocale }): JSX.Element {
  const t = getMessages(locale).landing.notFound;
  return (
    <SiteShell locale={locale} page="/" notFound>
      <section aria-labelledby="page-title" className="hr-site-404">
        <span className="hr-site-404-hoya" aria-hidden="true">
          <HoyaSvg pose="waving" size="100%" />
        </span>
        <h1 id="page-title" style={{ fontSize: rem(typography.size.display), lineHeight: typography.leading.tight, color: colors.text.primary }}>
          {t.title}
        </h1>
        <p
          style={{
            margin: 0,
            color: colors.text.secondary,
            lineHeight: typography.leading.relaxed,
            maxWidth: SITE_SIZES.notFoundMeasure,
          }}
        >
          {t.body}
        </p>
        <TextLink href={sitePath(locale, '/')}>{t.home}</TextLink>
        <PrimaryAction href={learnerStart(locale)}>{t.start}</PrimaryAction>
      </section>
    </SiteShell>
  );
}
