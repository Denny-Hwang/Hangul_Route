import { colors, spacing, typography } from '@hangul-route/design-system/tokens';
import { getMessages, type UiLocale } from '@hangul-route/i18n';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { CONTACT_EMAIL } from '../../data/contact';
import { learnerStart, signIn } from '../../lib/site-links';
import { shownSiteLocales, type SitePage } from '../../lib/site-metadata';
import { sitePath } from '../../lib/site-path';
import { HIT, WRAP, rem } from '../../lib/site-style';
import { LocaleSwitcher } from './LocaleSwitcher';
import { SHIPPED_PERSONA_PAGES, type PersonaPage, type SiteChromeVariant } from './SiteHeader';

export interface SiteFooterProps {
  locale: UiLocale;
  /** The page being shown: the locale switcher links the same page in each shown locale. */
  page: SitePage;
  /** The persona page being shown: its Guide link carries `aria-current="page"` (on phones the header nav is hidden). */
  current?: PersonaPage;
  variant?: SiteChromeVariant;
}

/** A footer link: 64 px tall, left-aligned; its colours change on hover, so they are the stylesheet's. */
const FOOTER_LINK = { ...HIT, justifyContent: 'flex-start' } as const;

/** The current page's Guide link: bold in the primary text colour (a weight change, not colour alone). */
const FOOTER_CURRENT = { color: colors.text.primary, fontWeight: typography.weight.bold } as const;

/**
 * One footer group: a small h2 and a list of links. Only Guide is a landmark (`nav`, the site's page navigation on
 * phones, where the header nav is hidden); App and Company are plain groups, so the footer adds no region landmarks.
 * `role="list"` keeps the unstyled list a list for VoiceOver in Safari.
 */
function Group({ id, title, nav = false, children }: { id: string; title: string; nav?: boolean; children: ReactNode }): JSX.Element {
  const heading = (
    <h2 id={id} style={{ margin: 0, fontSize: rem(typography.size.bodySm), fontWeight: typography.weight.bold, color: colors.text.primary }}>
      {title}
    </h2>
  );
  const list = (
    <ul role="list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      {children}
    </ul>
  );
  return nav ? (
    <nav aria-labelledby={id}>
      {heading}
      {list}
    </nav>
  ) : (
    <div>
      {heading}
      {list}
    </div>
  );
}

/**
 * The site footer (F-SITE-002 §3.2; wireframe design/wireframes/site/header-footer.md; mock
 * design/screens/site/header.md). Three groups in one DOM order, Guide, App, Company: on phones Guide and App stack
 * in the left column and Company sits on the right, on wide screens they are three columns (`hr-site-footer-*` in
 * `globals.css`). Guide links the shipped persona pages only. Then the copyright line and the locale switcher (shown once a second locale ships). The legal
 * variant drops the App group (OD-14). No console, demo or billing link, and no old in-page anchors.
 */
export function SiteFooter({ locale, page, current, variant = 'default' }: SiteFooterProps): JSX.Element {
  const t = getMessages(locale).landing;
  const link = (href: string, label: ReactNode, internal: boolean): JSX.Element => (
    <li>
      {internal ? (
        <Link href={href} className="hr-site-footer-link" style={FOOTER_LINK}>
          {label}
        </Link>
      ) : (
        <a href={href} className="hr-site-footer-link" style={FOOTER_LINK}>
          {label}
        </a>
      )}
    </li>
  );
  return (
    <footer style={{ backgroundColor: colors.surface.sunken, paddingTop: spacing.xxl, paddingBottom: spacing.xl }}>
      <div className="hr-site-wrap" style={WRAP}>
        <p style={{ margin: `0 0 ${spacing.lg}px`, color: colors.text.secondary }}>
          <strong style={{ color: colors.text.primary }}>{t.brand.name}</strong> · {t.meta.tagline}
        </p>
        <div className="hr-site-footer-groups">
          <div className="hr-site-footer-col">
            <Group id="footer-guide" title={t.footer.guide} nav>
              {SHIPPED_PERSONA_PAGES.map((persona) => (
                <li key={persona}>
                  <Link
                    href={sitePath(locale, `/${persona}`)}
                    className="hr-site-footer-link"
                    aria-current={persona === current ? 'page' : undefined}
                    style={persona === current ? { ...FOOTER_LINK, ...FOOTER_CURRENT } : FOOTER_LINK}
                  >
                    {t.nav[persona]}
                  </Link>
                </li>
              ))}
            </Group>
            {variant === 'default' ? (
              <Group id="footer-app" title={t.footer.app}>
                {link(learnerStart(locale), t.nav.start, false)}
                {link(signIn(), t.nav.signIn, false)}
              </Group>
            ) : null}
          </div>
          <div className="hr-site-footer-col">
            <Group id="footer-company" title={t.footer.company}>
              <li>
                <Link href={sitePath(locale, '/about')} className="hr-site-footer-link" style={FOOTER_LINK}>
                  {t.footer.about}
                </Link>
              </li>
              <li>
                <Link href={sitePath(locale, '/privacy')} className="hr-site-footer-link" style={FOOTER_LINK}>
                  {t.footer.privacy}
                </Link>
              </li>
              <li>
                <Link href={sitePath(locale, '/terms')} className="hr-site-footer-link" style={FOOTER_LINK}>
                  {t.footer.terms}
                </Link>
              </li>
              {link(
                `mailto:${CONTACT_EMAIL}`,
                <span style={{ display: 'grid' }}>
                  <span>{t.footer.contact}</span>
                  <span data-contact="email" style={{ fontSize: rem(typography.size.caption) }}>
                    {CONTACT_EMAIL}
                  </span>
                </span>,
                false,
              )}
            </Group>
          </div>
        </div>
        <p style={{ margin: `${spacing.lg}px 0 0`, fontSize: rem(typography.size.caption), color: colors.text.muted }}>
          {t.footer.copyright(new Date().getFullYear())}
        </p>
        {/* One row (label, then each locale), so the switcher adds one line once a second locale ships. */}
        <div className="hr-site-locales">
          <LocaleSwitcher locale={locale} page={page} label={t.footer.language} shown={shownSiteLocales()} linkStyle={FOOTER_LINK} />
        </div>
      </div>
    </footer>
  );
}
