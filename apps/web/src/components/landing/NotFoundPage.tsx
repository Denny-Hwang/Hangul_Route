import { colors, spacing, typography } from '@hangul-route/design-system/tokens';
import { HoyaSvg } from '@hangul-route/design-system/scene-art/dom';
import { DEFAULT_LOCALE, getMessages, type UiLocale } from '@hangul-route/i18n';
import { learnerStart } from '../../lib/site-links';
import { sitePath } from '../../lib/site-path';
import { SITE_SIZES, rem } from '../../lib/site-style';
import { PrimaryAction, SecondaryAction } from './site-parts';
import { SiteShell } from './SiteShell';

/** Hoya's square on the 404 page: `spacing.jumbo + spacing.xxl` (96 px), so both ways on stay on a 320 x 568 screen. */
const HOYA_SIZE = spacing.jumbo + spacing.xxl;

/**
 * The site's 404 body in `locale` (F-SITE-002 §3.7; AMENDMENTS-SITE-NEWUSER SN-2): inside the site header and footer,
 * Hoya thinking (never a red or failure picture), the page's one h1 (`notFound.title`), a line that says the link may be
 * old, and two ways on: Start learning (the learner app, primary) and the home page of the same locale. English at
 * `out/404.html` (`app/not-found.tsx`); `/es` and `/ko` at `out/es/404.html` and `out/ko/404.html` (`[locale]/404`).
 */
export function NotFoundPage({ locale = DEFAULT_LOCALE }: { locale?: UiLocale }): JSX.Element {
  const t = getMessages(locale).landing.notFound;
  return (
    <SiteShell locale={locale} page="/">
      <section
        aria-labelledby="page-title"
        className="hr-site-404"
        style={{ display: 'grid', justifyItems: 'center', gap: spacing.md, textAlign: 'center', paddingBlock: spacing.lg }}
      >
        <span style={{ display: 'flex', width: HOYA_SIZE, height: HOYA_SIZE }}>
          <HoyaSvg pose="thinking" size="100%" />
        </span>
        <h1 id="page-title" className="hr-site-h1" style={{ margin: 0, lineHeight: typography.leading.tight, color: colors.text.primary }}>
          {t.title}
        </h1>
        <p style={{ margin: 0, color: colors.text.secondary, fontSize: rem(typography.size.bodyLg), maxWidth: SITE_SIZES.leadMeasure }}>{t.body}</p>
        <div className="hr-site-actions" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.md, marginTop: spacing.md }}>
          <PrimaryAction href={learnerStart(locale)}>{t.start}</PrimaryAction>
          <SecondaryAction href={sitePath(locale, '/')}>{t.home}</SecondaryAction>
        </div>
      </section>
    </SiteShell>
  );
}
