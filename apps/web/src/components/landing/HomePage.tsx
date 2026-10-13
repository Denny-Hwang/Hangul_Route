import { JAMO_SOUND_VALUES } from '@hangul-route/content-schema';
import { HoyaSvg } from '@hangul-route/design-system/scene-art/dom';
import { borderWidth, colors, radii, spacing, touchTarget, typography } from '@hangul-route/design-system/tokens';
import { DEFAULT_LOCALE, getMessages, type UiLocale } from '@hangul-route/i18n';
import Link from 'next/link';
import { localeBannerOffers } from '../../data/landing-copy';
import { SITE_CLAIMS, showsClaim, type SiteClaims } from '../../data/site-claims';
import { learnerStart } from '../../lib/site-links';
import { shownSiteLocales } from '../../lib/site-metadata';
import { sitePath } from '../../lib/site-path';
import { HIT, SITE_SIZES, VISUALLY_HIDDEN, cardShadow, rem } from '../../lib/site-style';
import { LocaleBanner } from './LocaleBanner';
import { PERSONA_PAGES } from './SiteHeader';
import { SiteShell } from './SiteShell';
import { WaitlistForm } from './WaitlistForm';
import { Body, PrimaryAction, Section } from './site-parts';

/** The first letter Hoya introduces: taught Korean, passed into the bubble with its romanization (never in a message). */
const FIRST_LETTER = 'ㄱ';
/** The letter's teaching sound value (`g/k`), the romanization taught Korean always carries (CLAUDE.md §1). */
const FIRST_LETTER_ROMANIZATION = JAMO_SOUND_VALUES[FIRST_LETTER]?.[0] ?? '';

export interface HomePageProps {
  locale?: UiLocale;
  /** Which feature lines show (F-SITE-002 §3.9); tests render every state. */
  claims?: Readonly<SiteClaims>;
}

/**
 * The layered home `/` (F-SITE-002 §3.3, appendix B.1; wireframe design/wireframes/site/home.md; mock
 * design/screens/site/home-hero.md and persona-card.md). L0: the tagline as the only h1, one sentence of what you do,
 * Start learning, the in-page link to `#who`, the facts line and Hoya waving. L1: the persona chooser, How it works,
 * the three promise titles, the cost line and the launch news on its band (the unchanged `WaitlistForm`). Each
 * persona is explained on its own page, so `/` has no questions block. The locale banner stays above the hero.
 */
export function HomePage({ locale = DEFAULT_LOCALE, claims = SITE_CLAIMS }: HomePageProps): JSX.Element {
  const t = getMessages(locale).landing;
  const H = t.home;
  const shown = shownSiteLocales();
  const start = learnerStart(locale);
  const steps = [
    H.how.steps.start,
    H.how.steps.quests,
    { title: H.how.steps.collect.title, body: showsClaim(claims, 'learningRoute') ? H.how.routeBody : H.how.steps.collect.body },
  ];
  return (
    <SiteShell locale={locale} page="/">
      {/* "View in …" on `/` only, once a second locale ships; client-only, so the static HTML is unchanged. */}
      {locale === DEFAULT_LOCALE && shown.length > 1 ? <LocaleBanner offers={localeBannerOffers(shown)} /> : null}

      <section aria-labelledby="home-title" className="hr-site-hero" style={{ display: 'grid' }}>
        <div>
          <h1 id="home-title" className="hr-site-h1" style={{ margin: 0, lineHeight: typography.leading.tight, color: colors.text.primary }}>
            {H.hero.title}
          </h1>
          <p
            className="hr-site-lead"
            style={{ margin: `${spacing.md}px 0 0`, lineHeight: typography.leading.relaxed, color: colors.text.secondary, maxWidth: SITE_SIZES.leadMeasure }}
          >
            {H.hero.lead}
          </p>
          <div className="hr-site-actions" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: spacing.md, marginTop: spacing.xl }}>
            <PrimaryAction href={start}>{H.hero.start}</PrimaryAction>
          </div>
          <a
            href="#who"
            className="hr-site-text-link"
            style={{
              ...HIT,
              justifyContent: 'flex-start',
              marginTop: spacing.xs,
              fontWeight: typography.weight.semibold,
              textDecorationLine: 'underline',
              textDecorationThickness: borderWidth.thin,
              textUnderlineOffset: spacing.xs,
            }}
          >
            {H.hero.grownUps}
          </a>
          <p style={{ margin: `${spacing.xs}px 0 0`, fontSize: rem(typography.size.caption), color: colors.text.muted }}>{H.hero.facts}</p>
        </div>
        <div
          aria-hidden="true"
          className="hr-site-hero-art"
          style={{
            position: 'relative',
            justifySelf: 'center',
            width: '100%',
            aspectRatio: '1 / 1',
            backgroundColor: colors.brand.primaryLight,
            borderRadius: radii.xxl,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          <span style={{ display: 'flex', width: SITE_SIZES.hoyaShare, aspectRatio: '1 / 1', marginBottom: spacing.xl }}>
            <HoyaSvg pose="waving" size="100%" />
          </span>
          <span
            className="hr-site-bubble"
            style={{
              position: 'absolute',
              left: spacing.md,
              right: spacing.md,
              bottom: spacing.md,
              borderRadius: radii.pill,
              backgroundColor: colors.surface.paper,
              boxShadow: cardShadow(),
              fontWeight: typography.weight.semibold,
              textAlign: 'center',
            }}
          >
            {H.hero.bubble(FIRST_LETTER, FIRST_LETTER_ROMANIZATION)}
          </span>
        </div>
      </section>

      {/* tabIndex -1: the hero's in-page link moves keyboard focus here, not only the scroll position. */}
      <section id="who" tabIndex={-1} aria-labelledby="home-who" className="hr-site-section" style={{ outline: 'none' }}>
        <h2 id="home-who" className="hr-site-h2" style={{ margin: `0 0 ${spacing.md}px`, lineHeight: typography.leading.tight }}>
          {H.who.title}
        </h2>
        <ul className="hr-site-persona-list" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid' }}>
          {PERSONA_PAGES.map((persona) => {
            const item = H.who.items[persona];
            return (
              <li key={persona}>
                <Link
                  href={sitePath(locale, `/${persona}`)}
                  className="hr-site-persona-card"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1fr) auto',
                    alignItems: 'start',
                    columnGap: spacing.md,
                    minHeight: touchTarget.child,
                    height: '100%',
                    padding: spacing.lg,
                    backgroundColor: colors.surface.paper,
                    borderWidth: borderWidth.base,
                    borderStyle: 'solid',
                    borderRadius: radii.lg,
                    boxShadow: cardShadow(),
                  }}
                >
                  <span>
                    <span style={{ display: 'block', fontSize: rem(typography.size.bodyLg), fontWeight: typography.weight.bold, lineHeight: typography.leading.tight }}>
                      {item.title}
                    </span>{' '}
                    <span style={{ display: 'block', marginTop: spacing.xs, color: colors.text.secondary, lineHeight: typography.leading.normal }}>{item.body}</span>
                  </span>
                  <span
                    aria-hidden="true"
                    className="hr-site-persona-chev"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      alignSelf: 'center',
                      width: spacing.xxl,
                      height: spacing.xxl,
                      borderRadius: radii.circle,
                    }}
                  >
                    <svg width={spacing.lg} height={spacing.lg} viewBox="0 0 16 16" fill="none" focusable="false">
                      <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth={borderWidth.base} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <Section id="home-how" title={H.how.title}>
        <ol className="hr-site-steps hr-site-steps-wide" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: spacing.md }}>
          {steps.map((step, i) => (
            <li key={step.title} style={{ display: 'grid', gridTemplateColumns: `${spacing.xxl}px minmax(0, 1fr)`, columnGap: spacing.md, alignItems: 'start' }}>
              <span
                aria-hidden="true"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: spacing.xxl,
                  height: spacing.xxl,
                  borderRadius: radii.circle,
                  backgroundColor: colors.brand.primaryLight,
                  color: colors.brand.primaryDark,
                  fontWeight: typography.weight.bold,
                }}
              >
                {i + 1}
              </span>
              <span>
                <span style={{ display: 'block', fontWeight: typography.weight.bold }}>{step.title}</span>{' '}
                <span style={{ display: 'block', color: colors.text.secondary, lineHeight: typography.leading.normal }}>{step.body}</span>
              </span>
            </li>
          ))}
        </ol>
      </Section>

      <section aria-labelledby="home-promises" className="hr-site-section hr-site-promises">
        <h2 id="home-promises" style={VISUALLY_HIDDEN}>
          {H.promises.label}
        </h2>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexWrap: 'wrap', gap: spacing.sm }}>
          {[H.promises.items.ads, H.promises.items.safety, H.promises.items.noRed].map((title) => (
            <li
              key={title}
              style={{
                padding: `${spacing.sm}px ${spacing.lg}px`,
                borderRadius: radii.pill,
                backgroundColor: colors.surface.paper,
                border: `${borderWidth.base}px solid ${colors.border.subtle}`,
                fontWeight: typography.weight.semibold,
              }}
            >
              {title}
            </li>
          ))}
        </ul>
      </section>

      <Section id="home-cost" title={t.plans.title}>
        {/* Two keys in one paragraph: each stays its own text node, so a locale can word each one alone. */}
        <Body>
          <span>{t.plans.free.stage1}</span> <span>{t.plans.paid[claims.paidPlans]}</span>
        </Body>
      </Section>

      <section
        id="news"
        aria-labelledby="home-news"
        className="hr-site-news"
        style={{ backgroundColor: colors.brand.primary, color: colors.text.onPrimary, borderRadius: radii.xxl, textAlign: 'center' }}
      >
        <h2 id="home-news" className="hr-site-h2" style={{ margin: `0 0 ${spacing.sm}px`, lineHeight: typography.leading.tight, color: colors.text.onPrimary }}>
          {H.news.title}
        </h2>
        <p style={{ margin: `0 auto ${spacing.lg}px`, maxWidth: SITE_SIZES.leadMeasure, lineHeight: typography.leading.relaxed }}>{H.news.body}</p>
        <WaitlistForm words={t.waitlist} locale={locale} />
      </section>
    </SiteShell>
  );
}
