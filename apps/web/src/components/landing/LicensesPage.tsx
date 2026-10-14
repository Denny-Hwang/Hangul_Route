import { colors, layout, radii, spacing, typography } from '@hangul-route/design-system/tokens';
import { DEFAULT_LOCALE, getMessages, type UiLocale } from '@hangul-route/i18n';
import Link from 'next/link';
import { sitePath } from '../../lib/site-path';
import { HIT, rem } from '../../lib/site-style';
import { THIRD_PARTY_NOTICES, assetLicenses, licenseGroups, type NoticeWhere, type ThirdPartyNotices } from '../../lib/third-party-notices';
import { EnglishAuthoritativeNotice } from './EnglishAuthoritativeNotice';
import { SiteShell } from './SiteShell';
import { Fold, Folds } from './site-parts';

/** A license text or NOTICE file: kept as written, wrapped so it never scrolls sideways on a phone. */
const PRE = {
  margin: 0,
  whiteSpace: 'pre-wrap',
  overflowWrap: 'anywhere',
  fontFamily: typography.family.mono,
  fontSize: rem(typography.size.caption),
  lineHeight: typography.leading.normal,
  color: colors.text.secondary,
} as const;

const LIST = { listStyle: 'none', margin: `${spacing.sm}px 0 ${spacing.md}px`, padding: 0, display: 'grid', gap: spacing.xs, overflowWrap: 'anywhere' } as const;
/** A caption line under a package or font name (`hr-site-licenses-meta` in globals.css: muted, caption size, wraps anywhere). */
const META = 'hr-site-licenses-meta';

/**
 * `/licenses`: the open-source notices of the shipped apps (owner decision 2026-10-14, the proprietary LICENSE;
 * wireframe design/wireframes/site/licenses.md). The words around the list come from `landing.licenses`; the list
 * (packages, copyright lines, NOTICE files, license texts) is English legal text from the generated
 * `third-party-notices.json`, marked `lang="en"` under the localized English-authoritative line on `/es` and `/ko`,
 * as the Privacy Policy and Terms are. Legal variant of the site chrome (no App group, no Start in the header).
 */
export function LicensesPage({ locale = DEFAULT_LOCALE, notices = THIRD_PARTY_NOTICES }: { locale?: UiLocale; notices?: ThirdPartyNotices }): JSX.Element {
  const m = getMessages(locale).landing;
  const t = m.licenses;
  const docLang = locale === DEFAULT_LOCALE ? undefined : 'en';
  const where = (list: readonly NoticeWhere[]): string => `${t.usedIn}: ${list.map((w) => t.where[w]).join(', ')}`;
  return (
    <SiteShell locale={locale} page="/licenses" variant="legal">
      <div style={{ maxWidth: layout.maxWidth.reading, margin: '0 auto', paddingBlock: spacing.xl }}>
        <Link href={sitePath(locale, '/')} style={{ ...HIT, justifyContent: 'flex-start', color: colors.brand.primary, fontWeight: typography.weight.semibold }}>
          {m.legal.backHome}
        </Link>
        {docLang ? <EnglishAuthoritativeNotice text={m.legal.englishAuthoritative} /> : null}
        <h1 style={{ fontSize: rem(typography.size.display), marginTop: spacing.lg }}>{t.title}</h1>
        <p style={{ fontSize: rem(typography.size.bodyLg), color: colors.text.secondary, lineHeight: typography.leading.relaxed }}>{t.lead}</p>
        <p
          data-testid="licenses-owner"
          style={{ padding: spacing.md, backgroundColor: colors.surface.sunken, borderRadius: radii.md, color: colors.text.primary }}
        >
          {t.notOpen} {t.copyright}
        </p>

        <section aria-labelledby="licenses-software" style={{ marginTop: spacing.xl }}>
          <h2 id="licenses-software" style={{ fontSize: rem(typography.size.title) }}>
            {t.softwareTitle}
          </h2>
          {licenseGroups(notices).map(({ license, packages }) => (
            <section key={license.id} lang={docLang} data-license={license.id} style={{ marginTop: spacing.lg }}>
              <h3 style={{ fontSize: rem(typography.size.bodyLg), marginBottom: 0 }}>
                {license.name} ({packages.length})
              </h3>
              <ul role="list" style={LIST}>
                {packages.map((p) => (
                  <li key={`${p.name}@${p.version}`}>
                    <strong>{p.name}</strong> {p.version}
                    <span className={META}>{p.copyright}</span>
                    {p.note ? <span className={META}>{p.note}</span> : null}
                    <span className={META} lang={docLang ? locale : undefined}>
                      {where(p.usedIn)}
                    </span>
                  </li>
                ))}
              </ul>
              <Folds>
                <Fold summary={t.fullText}>
                  <pre style={PRE}>{license.text}</pre>
                </Fold>
              </Folds>
            </section>
          ))}
        </section>

        <section aria-labelledby="licenses-fonts" style={{ marginTop: spacing.xxl }}>
          <h2 id="licenses-fonts" style={{ fontSize: rem(typography.size.title) }}>
            {t.fontsTitle}
          </h2>
          <ul role="list" lang={docLang} style={LIST}>
            {notices.assets.map((a) => (
              <li key={a.path}>
                <strong>{a.source}</strong>
                <span className={META}>{a.license}</span>
                <span className={META}>{a.attribution}</span>
                <span className={META}>{a.url}</span>
              </li>
            ))}
          </ul>
          <Folds>
            {assetLicenses(notices).map((l) => (
              <Fold key={l.id} summary={`${t.fullText}: ${l.name}`}>
                <pre lang={docLang} style={PRE}>
                  {l.text}
                </pre>
              </Fold>
            ))}
          </Folds>
        </section>

        {notices.notices.length > 0 ? (
          <section aria-labelledby="licenses-notices" style={{ marginTop: spacing.xxl }}>
            <h2 id="licenses-notices" style={{ fontSize: rem(typography.size.title) }}>
              {t.noticesTitle}
            </h2>
            <Folds>
              {notices.notices.map((n) => (
                <Fold key={`${n.name}@${n.version}`} summary={`${n.name} ${n.version}`}>
                  <pre lang={docLang} style={PRE}>
                    {n.text}
                  </pre>
                </Fold>
              ))}
            </Folds>
          </section>
        ) : null}
      </div>
    </SiteShell>
  );
}
