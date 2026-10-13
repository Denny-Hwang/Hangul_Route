// Next's own 404 body, the page the export has always written to out/404.html (the Worker serves it for
// unknown paths), with our line and two ways on under it (F-SITE-002 §3.7): the home page and Start learning.
// English, like the document around it (see layout.tsx).
import { colors, spacing, typography } from '@hangul-route/design-system/tokens';
import { getMessages } from '@hangul-route/i18n';
import NotFound from 'next/dist/client/components/not-found-error';
import { SiteDocument } from '../components/SiteDocument';
import { learnerStart } from '../lib/site-links';
import { HIT, PRIMARY_ACTION, siteCssVars } from '../lib/site-style';

export default function NotFoundPage(): JSX.Element {
  const t = getMessages('en').landing;
  return (
    <SiteDocument lang="en">
      <NotFound />
      <nav aria-label={t.nav.label} className="hr-site" style={{ ...siteCssVars(), display: 'grid', justifyItems: 'center', gap: spacing.md, padding: `0 ${spacing.lg}px ${spacing.xxl}px` }}>
        <p style={{ margin: 0, color: colors.text.secondary, textAlign: 'center' }}>{t.notFound.body}</p>
        <a href="/" style={{ ...HIT, padding: `0 ${spacing.lg}px`, color: colors.brand.primaryDark, fontWeight: typography.weight.semibold, textDecorationLine: 'underline' }}>
          {t.notFound.home}
        </a>
        <a href={learnerStart('en')} className="hr-site-primary" style={PRIMARY_ACTION}>
          {t.notFound.start}
        </a>
      </nav>
    </SiteDocument>
  );
}
