import { colors, radii, shadows, spacing, typography } from '@hangul-route/design-system/tokens';
import { DEFAULT_LOCALE, getMessages } from '@hangul-route/i18n';
import Link from 'next/link';
import { HeritageCardsPreview } from '../components/landing/HeritageCardsPreview';
import { MeetHoya } from '../components/landing/MeetHoya';
import { MiniGamesGallery } from '../components/landing/MiniGamesGallery';
import { WaitlistForm } from '../components/landing/WaitlistForm';
import { CONTACT_EMAIL } from '../data/contact';
import { landingCopy } from '../data/landing-copy';

/** The learner web app (PWA). Overridable per deployment. */
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.hangulroute.com';

/** The first letter Hoya introduces: taught Korean, passed into the hero sentences (never written into a message). */
const FIRST_LETTER = 'ㄱ';

export default function HomePage(): JSX.Element {
  const t = getMessages(DEFAULT_LOCALE).landing;
  // One landing subtree for one locale: the words and the ordered lists (11b passes its locale here).
  const { tagline, audienceBadges, trustItems, howItWorks, faqs, pricingLines, sharedDeviceBullet, pricingFootnote } = landingCopy(DEFAULT_LOCALE);
  return (
    <main
      style={{
        minHeight: '100vh',
        maxWidth: 1180,
        margin: '0 auto',
        padding: `${spacing.xxl}px ${spacing.lg}px`,
      }}
    >
      {/* Top nav */}
      <header
        className="hr-landing-header"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          columnGap: spacing.md,
          rowGap: spacing.md,
          marginBottom: spacing.xxxl,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
          <div
            aria-hidden="true"
            className="hr-landing-logo-mark"
            style={{
              width: 44,
              height: 44,
              borderRadius: radii.circle,
              backgroundColor: colors.brand.primary,
              alignItems: 'center',
              justifyContent: 'center',
              color: colors.text.inverse,
              fontWeight: typography.weight.bold,
              fontSize: typography.size.bodyLg,
            }}
          >
            {t.brand.mark}
          </div>
          <span style={{ fontWeight: typography.weight.bold, fontSize: typography.size.bodyLg }}>
            {t.brand.name}
          </span>
        </div>
        {/* DOM order is visual order at every width (WCAG 2.4.3 / 1.3.2): brand,
            "Play now", then the section links. globals.css never uses `order`. */}
        <a
          href={APP_URL}
          className="hr-landing-cta"
          style={{
            padding: `${spacing.sm}px ${spacing.lg}px`,
            backgroundColor: colors.brand.primary,
            color: colors.text.onPrimary,
            borderRadius: radii.pill,
            fontWeight: typography.weight.bold,
            whiteSpace: 'nowrap',
          }}
        >
          {t.nav.playNow.cta}
        </a>
        <nav
          aria-label={t.nav.label}
          className="hr-landing-nav"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            columnGap: spacing.lg,
            rowGap: spacing.xs,
          }}
        >
          <Link href="#cards" style={{ color: colors.text.secondary, fontWeight: typography.weight.semibold }}>
            {t.nav.cards}
          </Link>
          <Link href="#games" style={{ color: colors.text.secondary, fontWeight: typography.weight.semibold }}>
            {t.nav.games}
          </Link>
          <Link href="#parents" style={{ color: colors.text.secondary, fontWeight: typography.weight.semibold }}>
            {t.nav.parents}
          </Link>
          <Link href="/parent" style={{ color: colors.text.secondary, fontWeight: typography.weight.semibold }}>
            {t.nav.dashboard}
          </Link>
          <Link href="/teach" style={{ color: colors.text.secondary, fontWeight: typography.weight.semibold }}>
            {t.nav.teachers}
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section
        className="hr-landing-hero"
        style={{
          display: 'grid',
          gap: spacing.xxl,
          alignItems: 'center',
        }}
      >
        <div>
          <div style={{ display: 'flex', gap: spacing.sm, flexWrap: 'wrap', marginBottom: spacing.md }}>
            {audienceBadges.map((badge) => (
              <span
                key={badge}
                style={{
                  padding: `${spacing.xs}px ${spacing.md}px`,
                  backgroundColor: colors.brand.primaryLight,
                  color: colors.brand.primaryDark,
                  borderRadius: radii.pill,
                  fontWeight: typography.weight.bold,
                  fontSize: typography.size.caption,
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                }}
              >
                {badge}
              </span>
            ))}
          </div>
          <h1
            style={{
              fontSize: typography.size.hero,
              lineHeight: typography.leading.tight,
              margin: 0,
              color: colors.text.primary,
            }}
          >
            {t.hero.titleLines[0]}
            <br />
            {t.hero.titleLines[1]}
          </h1>
          <p
            style={{
              marginTop: spacing.lg,
              fontSize: typography.size.bodyLg,
              color: colors.text.secondary,
              maxWidth: 520,
              lineHeight: typography.leading.relaxed,
            }}
          >
            {t.hero.lead(FIRST_LETTER)}
          </p>
          <div style={{ display: 'flex', gap: spacing.md, marginTop: spacing.xl, flexWrap: 'wrap' }}>
            <a
              href={APP_URL}
              style={{
                padding: `${spacing.md}px ${spacing.xl}px`,
                backgroundColor: colors.brand.primary,
                color: colors.text.onPrimary,
                borderRadius: radii.pill,
                fontWeight: typography.weight.bold,
                fontSize: typography.size.bodyLg,
              }}
            >
              {t.hero.play.cta}
            </a>
            <Link
              href="#cards"
              style={{
                padding: `${spacing.md}px ${spacing.xl}px`,
                border: `2px solid ${colors.brand.primary}`,
                color: colors.brand.primary,
                borderRadius: radii.pill,
                fontWeight: typography.weight.bold,
                fontSize: typography.size.bodyLg,
              }}
            >
              {t.hero.seeCards.cta}
            </Link>
          </div>
          <p
            style={{
              marginTop: spacing.lg,
              fontSize: typography.size.bodySm,
              color: colors.text.muted,
            }}
          >
            {t.hero.facts}
          </p>
        </div>
        <div
          aria-hidden="true"
          className="hr-landing-hero-art"
          style={{
            aspectRatio: '1 / 1',
            backgroundColor: colors.brand.primaryLight,
            borderRadius: radii.xxl,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 180,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <span style={{ position: 'relative', zIndex: 1 }}>🐯</span>
          <div
            style={{
              position: 'absolute',
              bottom: spacing.md,
              left: spacing.md,
              right: spacing.md,
              backgroundColor: colors.surface.paper,
              padding: `${spacing.sm}px ${spacing.md}px`,
              borderRadius: radii.pill,
              fontSize: typography.size.bodySm,
              fontWeight: typography.weight.semibold,
              color: colors.text.primary,
              textAlign: 'center',
              boxShadow: `0 ${shadows.card.shadowOffset.height}px ${shadows.card.shadowRadius}px rgba(42, 31, 20, ${shadows.card.shadowOpacity})`,
            }}
          >
            {t.hero.bubble(FIRST_LETTER)}
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section
        aria-label={t.trust.label}
        style={{
          marginTop: spacing.xxl,
          padding: spacing.lg,
          backgroundColor: colors.surface.sunken,
          borderRadius: radii.lg,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: spacing.lg,
        }}
      >
        {trustItems.map((item) => (
          <div key={item.title}>
            <div
              style={{
                fontWeight: typography.weight.bold,
                color: colors.text.primary,
                marginBottom: spacing.xxs,
              }}
            >
              {item.title}
            </div>
            <div
              style={{
                fontSize: typography.size.bodySm,
                color: colors.text.secondary,
                lineHeight: typography.leading.normal,
              }}
            >
              {item.body}
            </div>
          </div>
        ))}
      </section>

      {/* How it works */}
      <section style={{ marginTop: spacing.jumbo }}>
        <h2
          style={{
            fontSize: typography.size.display,
            marginBottom: spacing.xl,
            lineHeight: typography.leading.tight,
          }}
        >
          {t.how.title}
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: spacing.lg,
          }}
        >
          {howItWorks.map((card) => (
            <article
              key={card.title}
              style={{
                backgroundColor: colors.surface.paper,
                padding: spacing.lg,
                borderRadius: radii.lg,
                border: `1px solid ${colors.border.subtle}`,
              }}
            >
              <div
                aria-hidden="true"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: radii.circle,
                  backgroundColor: colors.brand.primary,
                  color: colors.text.onPrimary,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: typography.weight.bold,
                  marginBottom: spacing.sm,
                }}
              >
                {card.step}
              </div>
              <h3 style={{ marginTop: 0, marginBottom: spacing.xs, fontSize: typography.size.title }}>
                {card.title}
              </h3>
              <p
                style={{
                  color: colors.text.secondary,
                  margin: 0,
                  lineHeight: typography.leading.relaxed,
                }}
              >
                {card.body}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* Cards preview */}
      <div id="cards">
        <HeritageCardsPreview />
      </div>

      {/* Games gallery */}
      <div id="games">
        <MiniGamesGallery />
      </div>

      {/* Meet Hoya */}
      <MeetHoya />

      {/* For parents */}
      <section
        id="parents"
        aria-labelledby="parents-heading"
        style={{
          marginTop: spacing.jumbo,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: spacing.xxl,
          alignItems: 'flex-start',
        }}
      >
        <div>
          <span
            style={{
              display: 'inline-block',
              padding: `${spacing.xs}px ${spacing.md}px`,
              backgroundColor: colors.feedback.infoLight,
              color: colors.feedback.info,
              borderRadius: radii.pill,
              fontWeight: typography.weight.bold,
              fontSize: typography.size.caption,
              textTransform: 'uppercase',
              letterSpacing: 1,
            }}
          >
            {t.parents.eyebrow}
          </span>
          <h2
            id="parents-heading"
            style={{
              fontSize: typography.size.display,
              margin: `${spacing.sm}px 0 ${spacing.md}px`,
              lineHeight: typography.leading.tight,
            }}
          >
            {t.parents.title}
          </h2>
          <p
            style={{
              color: colors.text.secondary,
              fontSize: typography.size.bodyLg,
              margin: 0,
              lineHeight: typography.leading.relaxed,
            }}
          >
            {t.parents.body}
          </p>
          <ul
            style={{
              marginTop: spacing.lg,
              paddingLeft: spacing.lg,
              color: colors.text.secondary,
              fontSize: typography.size.body,
              lineHeight: typography.leading.relaxed,
            }}
          >
            <li>
              <strong style={{ color: colors.text.primary }}>{t.parents.points.localFirst.title}</strong>{' '}
              {t.parents.points.localFirst.body}
            </li>
            <li>
              <strong style={{ color: colors.text.primary }}>{t.parents.points.gate.title}</strong>{' '}
              {t.parents.points.gate.body}
            </li>
            <li>
              <strong style={{ color: colors.text.primary }}>{sharedDeviceBullet.title}</strong>{' '}
              {sharedDeviceBullet.body}
            </li>
          </ul>
        </div>

        <aside
          style={{
            backgroundColor: colors.brand.primaryLight,
            borderRadius: radii.xxl,
            padding: spacing.xl,
          }}
        >
          <h3 style={{ marginTop: 0, fontSize: typography.size.title }}>{t.pricing.title}</h3>
          <ul style={{ paddingLeft: spacing.lg, color: colors.text.primary, lineHeight: typography.leading.relaxed }}>
            {pricingLines.map((line) => (
              <li key={line.name}>
                <strong>{line.name}</strong> — {line.detail}
              </li>
            ))}
          </ul>
          <p
            style={{
              marginTop: spacing.lg,
              marginBottom: 0,
              fontSize: typography.size.bodySm,
              color: colors.text.secondary,
            }}
          >
            {pricingFootnote}
          </p>
        </aside>
      </section>

      {/* FAQ */}
      <section aria-labelledby="faq-heading" style={{ marginTop: spacing.jumbo }}>
        <h2
          id="faq-heading"
          style={{
            fontSize: typography.size.display,
            marginBottom: spacing.xl,
            lineHeight: typography.leading.tight,
          }}
        >
          {t.faq.title}
        </h2>
        <div style={{ display: 'grid', gap: spacing.md }}>
          {faqs.map((faq) => (
            <details
              key={faq.q}
              style={{
                backgroundColor: colors.surface.paper,
                border: `1px solid ${colors.border.subtle}`,
                borderRadius: radii.lg,
                padding: `${spacing.md}px ${spacing.lg}px`,
              }}
            >
              <summary
                style={{
                  fontWeight: typography.weight.semibold,
                  color: colors.text.primary,
                  fontSize: typography.size.bodyLg,
                  cursor: 'pointer',
                }}
              >
                {faq.q}
              </summary>
              <p
                style={{
                  marginTop: spacing.sm,
                  marginBottom: 0,
                  color: colors.text.secondary,
                  lineHeight: typography.leading.relaxed,
                }}
              >
                {faq.a}
              </p>
            </details>
          ))}
        </div>
      </section>

      {/* Email signup / get */}
      <section
        id="get"
        aria-labelledby="get-heading"
        style={{
          marginTop: spacing.jumbo,
          backgroundColor: colors.brand.primary,
          color: colors.text.onPrimary,
          borderRadius: radii.xxl,
          padding: spacing.xxl,
          textAlign: 'center',
        }}
      >
        <h2
          id="get-heading"
          style={{
            fontSize: typography.size.display,
            margin: 0,
            lineHeight: typography.leading.tight,
            color: colors.text.onPrimary,
          }}
        >
          {t.get.title}
        </h2>
        <p
          style={{
            marginTop: spacing.md,
            marginBottom: spacing.xl,
            color: colors.text.onPrimary,
            opacity: 0.92,
            fontSize: typography.size.bodyLg,
            maxWidth: 560,
            marginInline: 'auto',
            lineHeight: typography.leading.relaxed,
          }}
        >
          {t.get.body}
        </p>
        <a
          href={APP_URL}
          style={{
            display: 'inline-block',
            marginBottom: spacing.xl,
            padding: `${spacing.md}px ${spacing.xxl}px`,
            backgroundColor: colors.surface.paper,
            color: colors.brand.primary,
            borderRadius: radii.pill,
            fontWeight: typography.weight.bold,
            fontSize: typography.size.bodyLg,
          }}
        >
          {t.get.play.cta}
        </a>
        <WaitlistForm words={t.waitlist} locale={DEFAULT_LOCALE} />
        <p
          style={{
            marginTop: spacing.lg,
            fontSize: typography.size.bodySm,
            color: colors.text.onPrimary,
            opacity: 0.8,
          }}
        >
          {t.get.devices}
        </p>
      </section>

      {/* Footer */}
      <footer
        style={{
          marginTop: spacing.jumbo,
          paddingTop: spacing.xl,
          borderTop: `1px solid ${colors.border.subtle}`,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: spacing.lg,
          color: colors.text.secondary,
          fontSize: typography.size.bodySm,
        }}
      >
        <div>
          <div
            style={{
              fontWeight: typography.weight.bold,
              color: colors.text.primary,
              marginBottom: spacing.xs,
            }}
          >
            {t.brand.name}
          </div>
          <div>{tagline}</div>
        </div>
        <div>
          <div
            style={{
              fontWeight: typography.weight.bold,
              color: colors.text.primary,
              marginBottom: spacing.xs,
            }}
          >
            {t.footer.product}
          </div>
          <div>
            <Link href="#cards" style={{ color: colors.text.secondary }}>
              {t.footer.cards}
            </Link>
          </div>
          <div>
            <Link href="#games" style={{ color: colors.text.secondary }}>
              {t.footer.games}
            </Link>
          </div>
          <div>
            <Link href="/parent" style={{ color: colors.text.secondary }}>
              {t.footer.dashboard}
            </Link>
          </div>
          <div>
            <Link href="/teach" style={{ color: colors.text.secondary }}>
              {t.footer.console}
            </Link>
          </div>
        </div>
        <div>
          <div
            style={{
              fontWeight: typography.weight.bold,
              color: colors.text.primary,
              marginBottom: spacing.xs,
            }}
          >
            {t.footer.company}
          </div>
          <div>
            <Link href="/about" style={{ color: colors.text.secondary }}>
              {t.footer.about}
            </Link>
          </div>
          <div>
            <Link href="/privacy" style={{ color: colors.text.secondary }}>
              {t.footer.privacy}
            </Link>
          </div>
          <div>
            <Link href="/terms" style={{ color: colors.text.secondary }}>
              {t.footer.terms}
            </Link>
          </div>
        </div>
        <div>
          <div
            style={{
              fontWeight: typography.weight.bold,
              color: colors.text.primary,
              marginBottom: spacing.xs,
            }}
          >
            {t.footer.contact}
          </div>
          <div data-contact="email" style={{ overflowWrap: 'anywhere' }}>
            {CONTACT_EMAIL}
          </div>
          <div style={{ marginTop: spacing.xs, color: colors.text.muted }}>
            {t.footer.copyright(new Date().getFullYear())}
          </div>
        </div>
      </footer>
    </main>
  );
}
