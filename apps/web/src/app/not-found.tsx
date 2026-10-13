// Next's own 404 body, the page the export has always written to out/404.html (the Worker serves it for
// unknown paths), inside the site's header and footer, with our line and two ways on under it (F-SITE-002 §3.7,
// S-5): the home page and Start learning. English, like the document around it (see layout.tsx).
import { colors, spacing, typography } from '@hangul-route/design-system/tokens';
import { getMessages } from '@hangul-route/i18n';
import NotFound from 'next/dist/client/components/not-found-error';
import { SiteDocument } from '../components/SiteDocument';
import { SiteShell } from '../components/landing/SiteShell';
import { learnerStart } from '../lib/site-links';
import { HIT, PRIMARY_ACTION } from '../lib/site-style';

export default function NotFoundPage(): JSX.Element {
  const t = getMessages('en').landing;
  return (
    <SiteDocument lang="en">
      <SiteShell locale="en" page="/">
        {/* Next's body is a full-screen box; `hr-site-404` sizes it to its content so the links stay on screen. */}
        <div className="hr-site-404">
          <NotFound />
        </div>
        <div style={{ display: 'grid', justifyItems: 'center', gap: spacing.md, paddingBottom: spacing.xxl }}>
          <p style={{ margin: 0, color: colors.text.secondary, textAlign: 'center' }}>{t.notFound.body}</p>
          <a href="/" style={{ ...HIT, padding: `0 ${spacing.lg}px`, color: colors.brand.primaryDark, fontWeight: typography.weight.semibold, textDecorationLine: 'underline' }}>
            {t.notFound.home}
          </a>
          <a href={learnerStart('en')} className="hr-site-primary" style={PRIMARY_ACTION}>
            {t.notFound.start}
          </a>
        </div>
      </SiteShell>
    </SiteDocument>
  );
}
