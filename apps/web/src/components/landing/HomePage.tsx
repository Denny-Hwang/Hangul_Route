import { JAMO_SOUND_VALUES } from '@hangul-route/content-schema';
import { HoyaSvg } from '@hangul-route/design-system/scene-art/dom';
import { borderWidth, colors, radii, spacing, touchTarget, typography } from '@hangul-route/design-system/tokens';
import { DEFAULT_LOCALE, getMessages, type UiLocale } from '@hangul-route/i18n';
import Link from 'next/link';
import { SITE_CLAIMS, showsClaim, type SiteClaims } from '../../data/site-claims';
import { learnerStart } from '../../lib/site-links';
import { sitePath } from '../../lib/site-path';
import { SITE_SIZES, VISUALLY_HIDDEN, cardShadow, rem } from '../../lib/site-style';
import { PERSONA_PAGES } from './SiteHeader';
import { SiteCapture } from './SiteCapture';
import { SiteShell } from './SiteShell';
import { WaitlistForm } from './WaitlistForm';
import { PrimaryAction, Section, TextLink } from './site-parts';

/**
 * The first letter Hoya introduces: taught Korean, passed into the bubble with its romanization (never in a message).
 * ㅏ, because quest 1 (`quest:stage1-letters-q1`, "Meet a, eo, g, n") teaches it first (F-QUEST-002 §3.6).
 */
export const FIRST_LETTER = 'ㅏ';
/** The letter's teaching sound value (`a`), the romanization taught Korean always carries (CLAUDE.md §1). */
const FIRST_LETTER_ROMANIZATION = JAMO_SOUND_VALUES[FIRST_LETTER]?.[0] ?? '';

export interface HomePageProps {
  locale?: UiLocale;
  /** Which feature lines show (F-SITE-002 §3.9); tests render every state. */
  claims?: Readonly<SiteClaims>;
}

/**
 * The layered home `/` (F-SITE-002 §3.3, appendix B.1, amended by AMENDMENTS-SITE-NEWUSER §3.3; wireframes
 * design/wireframes/site/home.md and newuser-home.md; mocks design/screens/site/home-hero.md, persona-card.md and
 * design/screens/site/newuser/mock/<locale>/home.html). L0: the tagline as the only h1, one sentence of what you do,
 * Start learning, the facts line right under it, then two direct links "I'm a parent" / "I'm a teacher" (SN-D4), and
 * the hero art: the first quest's Discover page in a phone frame (a real capture in the page's locale, a tighter crop
 * below 45em), Hoya waving beside it (SN-D5). L1: the persona chooser, How it works, the three promise titles, then the
 * closing band, an invitation to Start learning (SN-D6), and the launch news after it in a quiet plain section
 * (`WaitlistForm tone="plain"`). The cost block left `/` (OD-SN-3): its free line opens the band, and the plan lines
 * live on `/parents` and `/teachers`. Each persona is explained on its own page, so `/` has no questions block. The
 * locale banner is the shell's (every English page).
 */
export function HomePage({ locale = DEFAULT_LOCALE, claims = SITE_CLAIMS }: HomePageProps): JSX.Element {
  const t = getMessages(locale).landing;
  const H = t.home;
  const start = learnerStart(locale);
  // Step 1 names the level check while its claim is on (F-PLC-001: placement is on for every platform).
  const steps = [
    { title: H.how.steps.start.title, body: showsClaim(claims, 'levelCheck', locale) ? H.how.levelBody : H.how.steps.start.body },
    H.how.steps.quests,
    { title: H.how.steps.collect.title, body: showsClaim(claims, 'learningRoute', locale) ? H.how.routeBody : H.how.steps.collect.body },
  ];
  return (
    <SiteShell locale={locale} page="/">
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
          {/* [SN] The facts line right under the action, then the two grown-up links (each a 64 px tall text link). */}
          <p style={{ margin: `${spacing.sm}px 0 0`, fontSize: rem(typography.size.caption), color: colors.text.muted }}>{H.hero.facts}</p>
          <div className="hr-site-hero-links" style={{ display: 'flex', flexWrap: 'wrap', columnGap: spacing.lg, marginTop: spacing.xs }}>
            <TextLink href={sitePath(locale, '/parents')}>{H.hero.forParents}</TextLink>
            <TextLink href={sitePath(locale, '/teachers')}>{H.hero.forTeachers}</TextLink>
          </div>
        </div>
        {/* [SN] The hero art (§3.3 item 2): every size inside the box is a percentage of it, so 200 % text never widens
            the page. The capture is the only part with alt text; Hoya and the bubble stay decorative. */}
        <div
          className="hr-site-hero-art"
          style={{
            position: 'relative',
            justifySelf: 'center',
            width: '100%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-end',
            backgroundColor: colors.brand.primaryLight,
            borderRadius: radii.xxl,
            overflow: 'hidden',
          }}
        >
          <div
            className="hr-site-hero-phone"
            style={{
              backgroundColor: colors.text.primary,
              padding: `${spacing.xs}px ${spacing.xs}px 0`,
              borderRadius: `${radii.xl}px ${radii.xl}px 0 0`,
            }}
          >
            <SiteCapture
              locale={locale}
              name="discover-narrow"
              wide="discover"
              alt={t.captures.discover(FIRST_LETTER, FIRST_LETTER_ROMANIZATION)}
              priority
              className="hr-site-hero-capture"
              style={{ borderRadius: `${radii.xl - spacing.xs}px ${radii.xl - spacing.xs}px 0 0` }}
            />
          </div>
          <span aria-hidden="true" className="hr-site-hero-hoya" style={{ position: 'absolute', width: SITE_SIZES.heroHoyaShare, aspectRatio: '1 / 1', display: 'flex' }}>
            <HoyaSvg pose="waving" size="100%" />
          </span>
          <span
            aria-hidden="true"
            className="hr-site-bubble"
            style={{
              position: 'absolute',
              borderRadius: radii.lg,
              backgroundColor: colors.surface.paper,
              boxShadow: cardShadow(),
              fontWeight: typography.weight.semibold,
              lineHeight: typography.leading.normal,
            }}
          >
            {H.hero.bubble(FIRST_LETTER, FIRST_LETTER_ROMANIZATION)}
          </span>
        </div>
      </section>

      {/* tabIndex -1: old `#who` links still move keyboard focus here, not only the scroll position. */}
      <section id="who" tabIndex={-1} aria-labelledby="home-who" className="hr-site-section" style={{ outline: 'none' }}>
        <h2 id="home-who" className="hr-site-h2" style={{ margin: `0 0 ${spacing.md}px`, lineHeight: typography.leading.tight }}>
          {H.who.title}
        </h2>
        <ul role="list" className="hr-site-persona-list" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid' }}>
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
        <ol role="list" className="hr-site-steps hr-site-steps-wide" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: spacing.md }}>
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
        <ul role="list" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexWrap: 'wrap', gap: spacing.sm }}>
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

      {/* [SN] The closing band (§3.3 item 5): the last block asks for the one action that matters. On brand.primary the
          focus ring is text.onPrimary (`hr-site-band`, the S-D band rule). */}
      <section
        aria-labelledby="home-closing"
        className="hr-site-band"
        style={{
          display: 'grid',
          justifyItems: 'center',
          gap: spacing.md,
          backgroundColor: colors.brand.primary,
          color: colors.text.onPrimary,
          borderRadius: radii.xxl,
          textAlign: 'center',
        }}
      >
        <h2 id="home-closing" style={{ margin: 0, fontSize: rem(typography.size.title), lineHeight: typography.leading.tight, color: colors.text.onPrimary }}>
          {H.closing.title}
        </h2>
        <p style={{ margin: 0, maxWidth: SITE_SIZES.leadMeasure, lineHeight: typography.leading.relaxed }}>{H.closing.body}</p>
        <a
          href={start}
          className="hr-site-band-action"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: touchTarget.child,
            minWidth: touchTarget.min,
            maxWidth: SITE_SIZES.bandActionMax,
            padding: `0 ${spacing.xxl}px`,
            backgroundColor: colors.surface.paper,
            color: colors.brand.primaryDark,
            borderRadius: radii.pill,
            fontWeight: typography.weight.bold,
            fontSize: rem(typography.size.bodyLg),
            textAlign: 'center',
          }}
        >
          {t.nav.start}
        </a>
      </section>

      {/* [SN] Launch news, quiet (§3.3 item 6): a plain section after the band, set apart by spacing.xl above its rule,
          so it reads as optional news and not as part of the band's "no email" promise. */}
      <section id="news" aria-labelledby="home-news" className="hr-site-section hr-site-news" style={{ marginTop: spacing.xl }}>
        <h2 id="home-news" className="hr-site-h2" style={{ margin: `0 0 ${spacing.sm}px`, lineHeight: typography.leading.tight, color: colors.text.primary }}>
          {H.news.title}
        </h2>
        <p style={{ margin: 0, maxWidth: SITE_SIZES.leadMeasure, lineHeight: typography.leading.relaxed, color: colors.text.secondary }}>{H.news.body}</p>
        {/* The pre-S-5 waitlist anchor: links shared as hangulroute.com/#get still land on the form. */}
        <span id="get" aria-hidden="true" />
        <WaitlistForm words={t.waitlist} locale={locale} tone="plain" />
      </section>
    </SiteShell>
  );
}
