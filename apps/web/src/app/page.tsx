import { colors, radii, spacing, typography } from '@hangul-route/design-system/tokens';
import Link from 'next/link';

export default function HomePage(): JSX.Element {
  return (
    <main
      style={{
        minHeight: '100vh',
        maxWidth: 1100,
        margin: '0 auto',
        padding: `${spacing.xxl}px ${spacing.lg}px`,
      }}
    >
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xxxl }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: radii.circle,
              backgroundColor: colors.brand.primary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: colors.text.inverse,
              fontWeight: 800,
              fontSize: typography.size.bodyLg,
            }}
          >
            HR
          </div>
          <span style={{ fontWeight: 700, fontSize: typography.size.bodyLg }}>Hangul Route</span>
        </div>
        <nav style={{ display: 'flex', gap: spacing.lg }}>
          <Link href="/parent" style={{ color: colors.text.secondary, fontWeight: 600 }}>
            Parent dashboard
          </Link>
          <Link href="/about" style={{ color: colors.text.secondary, fontWeight: 600 }}>
            About
          </Link>
        </nav>
      </header>

      <section style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: spacing.xxl, alignItems: 'center' }}>
        <div>
          <span
            style={{
              display: 'inline-block',
              padding: `${spacing.xs}px ${spacing.md}px`,
              backgroundColor: colors.brand.primaryLight,
              color: colors.brand.primaryDark,
              borderRadius: radii.pill,
              fontWeight: 700,
              marginBottom: spacing.md,
            }}
          >
            For heritage &amp; K-culture kids · ages 5–11
          </span>
          <h1 style={{ fontSize: typography.size.hero, lineHeight: typography.leading.tight, margin: 0 }}>
            The only Korean app
            <br />
            for kids who don&apos;t speak it — yet.
          </h1>
          <p
            style={{
              marginTop: spacing.lg,
              fontSize: typography.size.bodyLg,
              color: colors.text.secondary,
              maxWidth: 480,
            }}
          >
            Hoya the tiger guides your child from ㄱ to Chuseok — five-minute quests, English all the
            way, and Korean culture cards to collect. Played, not taught. Never a frown.
          </p>
          <div style={{ display: 'flex', gap: spacing.md, marginTop: spacing.xl }}>
            <a
              href="#download"
              style={{
                padding: `${spacing.md}px ${spacing.xl}px`,
                backgroundColor: colors.brand.primary,
                color: colors.text.inverse,
                borderRadius: radii.pill,
                fontWeight: 700,
              }}
            >
              Get the app
            </a>
            <Link
              href="/parent"
              style={{
                padding: `${spacing.md}px ${spacing.xl}px`,
                border: `2px solid ${colors.brand.primary}`,
                color: colors.brand.primary,
                borderRadius: radii.pill,
                fontWeight: 700,
              }}
            >
              Parent dashboard
            </Link>
          </div>
        </div>
        <div
          style={{
            aspectRatio: '1 / 1',
            backgroundColor: colors.brand.primaryLight,
            borderRadius: radii.xxl,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 180,
          }}
        >
          🐯
        </div>
      </section>

      <section style={{ marginTop: spacing.jumbo }}>
        <h2 style={{ fontSize: typography.size.display, marginBottom: spacing.xl }}>How it works</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: spacing.lg }}>
          {[
            { title: '1. Heritage Journey', body: '7 stages × 5 culture themes. Your child draws their own route through Korean.' },
            { title: '2. Mini-games', body: 'Tap, build, trace, and match — short games that fit a five-minute attention span.' },
            { title: '3. Collect culture', body: 'Earn 30 Heritage cards — from kimchi to Seollal to the gayageum.' },
          ].map((b) => (
            <article
              key={b.title}
              style={{
                backgroundColor: colors.surface.paper,
                padding: spacing.lg,
                borderRadius: radii.lg,
                border: `1px solid ${colors.border.subtle}`,
              }}
            >
              <h3 style={{ marginTop: 0 }}>{b.title}</h3>
              <p style={{ color: colors.text.secondary, margin: 0 }}>{b.body}</p>
            </article>
          ))}
        </div>
      </section>

      <footer style={{ marginTop: spacing.jumbo, color: colors.text.muted, fontSize: typography.size.caption }}>
        <Link href="/privacy" style={{ color: colors.text.secondary, fontWeight: 600 }}>
          Privacy
        </Link>{' '}
        ·{' '}
        <Link href="/terms" style={{ color: colors.text.secondary, fontWeight: 600 }}>
          Terms
        </Link>{' '}
        · © {new Date().getFullYear()} Hangul Route · All learning data lives on your device by default.
      </footer>
    </main>
  );
}
