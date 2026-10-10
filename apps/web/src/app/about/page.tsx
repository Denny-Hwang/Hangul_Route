import { colors, radii, spacing, typography } from '@hangul-route/design-system/tokens';
import Link from 'next/link';
import { CONTACT_EMAIL } from '../../data/contact';

export default function AboutPage(): JSX.Element {
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: `${spacing.xxl}px ${spacing.lg}px` }}>
      <Link href="/" style={{ color: colors.brand.primary, fontWeight: 600 }}>
        ← Back home
      </Link>
      <h1 style={{ fontSize: typography.size.display, marginTop: spacing.lg }}>About Hangul Route</h1>
      <p style={{ fontSize: typography.size.bodyLg, color: colors.text.secondary }}>
        Made by a small team (mostly one person and a tiger). For anyone learning
        Hangul from zero, at any age — heritage families whose parents or
        grandparents speak Korean, fans of K-pop, K-food and K-anything, and
        curious beginners — who want a gentle, anti-shame way in.
      </p>

      <section style={{ marginTop: spacing.xl }}>
        <h2>Our promises</h2>
        <ul style={{ lineHeight: 1.8 }}>
          <li>Menus and instructions use plain, simple English (CEFR Pre-A1).</li>
          <li>Korean is only used for the content being taught.</li>
          <li>No red ❌ for wrong answers — Hoya nudges with amber.</li>
          <li>No ads, ever. No ads designed at children. Period.</li>
          <li>Local-first: data stays on the device until you sign in.</li>
          <li>Parent-gate behind multiplication for any commerce or destructive action.</li>
        </ul>
      </section>

      <section style={{ marginTop: spacing.xl, padding: spacing.lg, backgroundColor: colors.brand.primaryLight, borderRadius: radii.lg }}>
        <h3 style={{ marginTop: 0 }}>Have feedback?</h3>
        <p style={{ margin: 0 }}>Email {CONTACT_EMAIL} — we read everything.</p>
      </section>

      <footer style={{ marginTop: spacing.jumbo, color: colors.text.muted, fontSize: typography.size.caption }}>
        <Link href="/privacy" style={{ color: colors.text.secondary, fontWeight: 600 }}>
          Privacy
        </Link>{' '}
        ·{' '}
        <Link href="/terms" style={{ color: colors.text.secondary, fontWeight: 600 }}>
          Terms
        </Link>
      </footer>
    </main>
  );
}
