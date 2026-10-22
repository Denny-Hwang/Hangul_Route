import { colors, spacing, typography } from '@hangul-route/design-system/tokens';
import { getMessages, type UiLocale } from '@hangul-route/i18n';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { CONTACT_EMAIL } from '../../data/contact';
import { learnerStart, signIn } from '../../lib/site-links';
import { shownSiteLocales, type SitePage } from '../../lib/site-metadata';
import { sitePath } from '../../lib/site-path';
import { CAPTION_HIT_OVERFLOW, HIT, WRAP, rem } from '../../lib/site-style';
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

/**
 * The open-source notices link beside the copyright line: caption size, a full hit area, and negative block margins of
 * half the difference between the hit area and one caption line, so the row is one caption line tall.
 */
/** How far the open-source link's hit area reaches above and below its one caption line. */
const LEGAL_OVERFLOW = CAPTION_HIT_OVERFLOW;

const LEGAL_LINK = {
  ...FOOTER_LINK,
  fontSize: rem(typography.size.caption),
  marginBlock: `calc(-1 * ${LEGAL_OVERFLOW})`,
} as const;

/**
 * The copyright row. Its hit areas never overlap a neighbour's: when the link wraps under the line (narrow screens),
 * the row gap is the overflow, so the area above the link stops at the copyright line; below, padding takes up the
 * overflow less the locale switcher's own top margin (`.hr-site-locales > nav`), so the area stops where the locale
 * links' areas start.
 */
const LEGAL_ROW = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  columnGap: spacing.md,
  rowGap: `calc(${LEGAL_OVERFLOW})`,
  marginTop: spacing.lg,
  paddingBlockEnd: `calc(${LEGAL_OVERFLOW} - ${spacing.sm}px)`,
} as const;

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
 * `globals.css`). Guide links the shipped persona pages only. Then the copyright line with the open-source notices link, and the locale switcher (shown once a second locale ships). The legal
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
                {link(signIn(undefined, locale), t.nav.signIn, false)}
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
        {/*
          The copyright line and, on the same row, the open-source notices (owner decision 2026-10-14; wireframe
          site/licenses.md): a link beside the line rather than another Company item, so the footer keeps its height
          (F-SITE-002 §3.11 budgets). The link keeps its 64 px hit area (LEGAL_LINK) but takes only one caption line of
          the row; the rest of the area lies in the margin above and the row's padding below (LEGAL_ROW), so it overlaps no
          other link. It wraps under the line where the row is too narrow.
        */}
        {/*
          The end row: the copyright row, then the locale switcher (es and ko ship, F-I18N-001 rows 15b / 16b). On
          phones the switcher is one row of its own (label, then each locale); from 45em it sits on the copyright row's
          line, caption size, each link keeping its 64 px hit area (globals.css `hr-site-footer-end`), so the wide
          page stays inside its F-SITE-002 §3.11 height budget.
        */}
        <div className="hr-site-footer-end">
          <div style={LEGAL_ROW}>
            <p style={{ margin: 0, fontSize: rem(typography.size.caption), color: colors.text.muted }}>{t.footer.copyright(new Date().getFullYear())}</p>
            <Link href={sitePath(locale, '/licenses')} className="hr-site-footer-link" style={LEGAL_LINK}>
              {t.footer.licenses}
            </Link>
          </div>
          <div className="hr-site-locales">
            <LocaleSwitcher
              locale={locale}
              page={page}
              label={t.footer.language}
              shown={shownSiteLocales()}
              linkStyle={FOOTER_LINK}
              className={{ label: 'hr-site-locale-label', link: 'hr-site-locale-link' }}
            />
          </div>
        </div>
      </div>
    </footer>
  );
}
