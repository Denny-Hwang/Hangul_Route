import { colors, radii, shadows, spacing, typography } from '@hangul-route/design-system/tokens';
import Link from 'next/link';
import { HeritageCardsPreview } from '../components/landing/HeritageCardsPreview';
import { MeetHoya } from '../components/landing/MeetHoya';
import { MiniGamesGallery } from '../components/landing/MiniGamesGallery';

const trustItems = [
  { title: 'COPPA-compliant', body: 'No third-party tracking. Parent email is the only PII.' },
  { title: 'No ads, ever', body: 'No third-party ads. No data sold. Revenue is in-app only.' },
  { title: 'Plays offline', body: 'After first sync, the full Stage 1 plays without a connection.' },
  { title: 'Anti-shame design', body: 'Wrong answers use amber. No red. No streak guilt.' },
];

const howItWorks = [
  {
    step: '1',
    title: 'Heritage Journey',
    body: '7 stages × 5 culture themes. Your child draws their own route through Korean.',
  },
  {
    step: '2',
    title: 'Mini-games',
    body: 'Tap, build, trace, and match — five-minute games that fit a child’s attention span.',
  },
  {
    step: '3',
    title: 'Collect culture',
    body: 'Earn 24 Heritage Cards in Stage 1 — from kimchi to Chuseok to the gayageum.',
  },
];

const faqs = [
  {
    q: 'What makes this different from Duolingo Kids?',
    a: 'Duolingo teaches vocab. We teach a child’s relationship with their heritage — one collectable culture card at a time. And no red feedback, ever.',
  },
  {
    q: 'How old is this for?',
    a: 'Designed for ages 5–11. Stage 1 (Hangul) works for fluent English readers and pre-readers alike — every screen has voice and visuals.',
  },
  {
    q: 'My kid doesn’t speak any Korean. Will it work?',
    a: 'Yes — that is the audience we built for. The UI is English at a 5–7 year old reading level. Korean only appears as the thing being learned.',
  },
  {
    q: 'How long is a session?',
    a: 'One quest takes about 5 minutes. Most kids do 1–3 quests per sitting. You can stop any time — no streak shame.',
  },
  {
    q: 'How much does it cost?',
    a: 'The first 12 cards are free. After that, 12-card packs at $4.99, or lifetime full access at $29. No ads. No subscription required.',
  },
];

const ageBadges = ['Ages 5–11', 'Heritage families', 'K-culture curious'];

export default function HomePage(): JSX.Element {
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
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: spacing.xxxl,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
          <div
            aria-hidden="true"
            style={{
              width: 44,
              height: 44,
              borderRadius: radii.circle,
              backgroundColor: colors.brand.primary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: colors.text.inverse,
              fontWeight: typography.weight.bold,
              fontSize: typography.size.bodyLg,
            }}
          >
            HR
          </div>
          <span style={{ fontWeight: typography.weight.bold, fontSize: typography.size.bodyLg }}>
            Hangul Route
          </span>
        </div>
        <nav style={{ display: 'flex', gap: spacing.lg, alignItems: 'center' }}>
          <Link href="#cards" style={{ color: colors.text.secondary, fontWeight: typography.weight.semibold }}>
            Cards
          </Link>
          <Link href="#games" style={{ color: colors.text.secondary, fontWeight: typography.weight.semibold }}>
            Games
          </Link>
          <Link href="#parents" style={{ color: colors.text.secondary, fontWeight: typography.weight.semibold }}>
            For parents
          </Link>
          <Link href="/parent" style={{ color: colors.text.secondary, fontWeight: typography.weight.semibold }}>
            Dashboard
          </Link>
          <Link
            href="#get"
            style={{
              padding: `${spacing.sm}px ${spacing.lg}px`,
              backgroundColor: colors.brand.primary,
              color: colors.text.onPrimary,
              borderRadius: radii.pill,
              fontWeight: typography.weight.bold,
            }}
          >
            Get the app
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: '1.4fr 1fr',
          gap: spacing.xxl,
          alignItems: 'center',
        }}
      >
        <div>
          <div style={{ display: 'flex', gap: spacing.sm, flexWrap: 'wrap', marginBottom: spacing.md }}>
            {ageBadges.map((badge) => (
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
            Korean for kids who
            <br />
            don&apos;t speak it — yet.
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
            Hoya the tiger guides your child from ㄱ to Chuseok — five-minute
            quests, English all the way, and 24 Korean culture cards to collect
            in Stage 1 alone. Played, not taught. Never a frown.
          </p>
          <div style={{ display: 'flex', gap: spacing.md, marginTop: spacing.xl, flexWrap: 'wrap' }}>
            <a
              href="#get"
              style={{
                padding: `${spacing.md}px ${spacing.xl}px`,
                backgroundColor: colors.brand.primary,
                color: colors.text.onPrimary,
                borderRadius: radii.pill,
                fontWeight: typography.weight.bold,
                fontSize: typography.size.bodyLg,
              }}
            >
              Get the app
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
              See the cards
            </Link>
          </div>
          <p
            style={{
              marginTop: spacing.lg,
              fontSize: typography.size.bodySm,
              color: colors.text.muted,
            }}
          >
            Free for the first 12 cards · No ads · Plays offline
          </p>
        </div>
        <div
          aria-hidden="true"
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
            Annyeong! Let&apos;s meet ㄱ.
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section
        aria-label="Trust"
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
          How it works
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
            For parents
          </span>
          <h2
            id="parents-heading"
            style={{
              fontSize: typography.size.display,
              margin: `${spacing.sm}px 0 ${spacing.md}px`,
              lineHeight: typography.leading.tight,
            }}
          >
            Five minutes a day. Nothing creepy.
          </h2>
          <p
            style={{
              color: colors.text.secondary,
              fontSize: typography.size.bodyLg,
              margin: 0,
              lineHeight: typography.leading.relaxed,
            }}
          >
            Hangul Route is built for tired parents. Hand the phone to your kid
            for five minutes; come back to one new Korean letter, one heritage
            card, and a quiet child. Bring it on a long flight — the whole
            Stage 1 plays offline.
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
              <strong style={{ color: colors.text.primary }}>Local-first by default.</strong>{' '}
              All learning data stays on the device until you sign in.
            </li>
            <li>
              <strong style={{ color: colors.text.primary }}>Parent-gate.</strong>{' '}
              Anything that costs money or deletes data is behind a simple
              multiplication question.
            </li>
            <li>
              <strong style={{ color: colors.text.primary }}>One subscription, three profiles.</strong>{' '}
              Siblings share. No upsell.
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
          <h3 style={{ marginTop: 0, fontSize: typography.size.title }}>Pricing</h3>
          <ul style={{ paddingLeft: spacing.lg, color: colors.text.primary, lineHeight: typography.leading.relaxed }}>
            <li>
              <strong>First 12 cards</strong> — free
            </li>
            <li>
              <strong>12-card packs</strong> — $4.99 in-app
            </li>
            <li>
              <strong>Lifetime full access</strong> — $29 ($19 launch promo)
            </li>
            <li>
              <strong>Family</strong> — 3 child profiles included
            </li>
          </ul>
          <p
            style={{
              marginTop: spacing.lg,
              marginBottom: 0,
              fontSize: typography.size.bodySm,
              color: colors.text.secondary,
            }}
          >
            No subscription required. No third-party ads ever.
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
          Common questions
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
          Try Hangul Route this week.
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
          We&rsquo;re launching publicly on Product Hunt soon. Leave your email and
          we&rsquo;ll send a TestFlight invite and a free family code on launch day.
        </p>
        <form
          action="https://buttondown.email/api/emails/embed-subscribe/hangulroute"
          method="post"
          target="_blank"
          style={{
            display: 'flex',
            gap: spacing.sm,
            justifyContent: 'center',
            flexWrap: 'wrap',
            maxWidth: 480,
            margin: '0 auto',
          }}
        >
          <label htmlFor="email" style={{ position: 'absolute', left: -9999 }}>
            Your email
          </label>
          <input
            id="email"
            type="email"
            name="email"
            required
            placeholder="you@somewhere.com"
            style={{
              flex: '1 1 240px',
              minHeight: 48,
              padding: `${spacing.sm}px ${spacing.lg}px`,
              borderRadius: radii.pill,
              border: 'none',
              fontSize: typography.size.body,
              color: colors.text.primary,
              backgroundColor: colors.surface.paper,
            }}
          />
          <button
            type="submit"
            style={{
              minHeight: 48,
              padding: `${spacing.sm}px ${spacing.xl}px`,
              borderRadius: radii.pill,
              border: 'none',
              backgroundColor: colors.text.primary,
              color: colors.text.inverse,
              fontWeight: typography.weight.bold,
              fontSize: typography.size.body,
              cursor: 'pointer',
            }}
          >
            Send me the invite
          </button>
        </form>
        <p
          style={{
            marginTop: spacing.lg,
            fontSize: typography.size.bodySm,
            color: colors.text.onPrimary,
            opacity: 0.8,
          }}
        >
          Or scan the TestFlight QR on launch day at hangulroute.com/get.
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
            Hangul Route
          </div>
          <div>Korean for kids who don&rsquo;t speak it — yet.</div>
        </div>
        <div>
          <div
            style={{
              fontWeight: typography.weight.bold,
              color: colors.text.primary,
              marginBottom: spacing.xs,
            }}
          >
            Product
          </div>
          <div>
            <Link href="#cards" style={{ color: colors.text.secondary }}>
              Heritage cards
            </Link>
          </div>
          <div>
            <Link href="#games" style={{ color: colors.text.secondary }}>
              Mini-games
            </Link>
          </div>
          <div>
            <Link href="/parent" style={{ color: colors.text.secondary }}>
              Parent dashboard
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
            Company
          </div>
          <div>
            <Link href="/about" style={{ color: colors.text.secondary }}>
              About
            </Link>
          </div>
          <div>
            <Link href="/privacy" style={{ color: colors.text.secondary }}>
              Privacy
            </Link>
          </div>
          <div>
            <Link href="/terms" style={{ color: colors.text.secondary }}>
              Terms
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
            Contact
          </div>
          <div>feedback@hangulroute.example</div>
          <div style={{ marginTop: spacing.xs, color: colors.text.muted }}>
            © {new Date().getFullYear()} Hangul Route
          </div>
        </div>
      </footer>
    </main>
  );
}
