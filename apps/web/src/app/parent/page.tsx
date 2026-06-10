import { colors, radii, spacing, typography } from '@hangul-route/design-system/tokens';
import Link from 'next/link';
import { mockFamily } from '@/data/mock-family';

export default function ParentPage(): JSX.Element {
  const family = mockFamily();

  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: `${spacing.xl}px ${spacing.lg}px` }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xxl }}>
        <div>
          <Link href="/" style={{ color: colors.text.muted, fontSize: typography.size.caption }}>
            ← Hangul Route
          </Link>
          <h1 style={{ fontSize: typography.size.display, margin: `${spacing.xs}px 0 0` }}>
            Family Dashboard
          </h1>
          <p style={{ color: colors.text.secondary, margin: `${spacing.xs}px 0 0` }}>
            Demo preview — the stats below are sample data. The live dashboard
            reads your kids&apos; progress from this device.
          </p>
        </div>
        <span
          style={{
            padding: `${spacing.xs}px ${spacing.md}px`,
            backgroundColor: colors.feedback.nudgeLight,
            color: colors.text.primary,
            borderRadius: radii.pill,
            fontWeight: 700,
            fontSize: typography.size.caption,
          }}
        >
          Sample data
        </span>
      </header>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing.md, marginBottom: spacing.xxl }}>
        {[
          { label: 'Profiles', value: family.profiles.length },
          { label: 'Total cards', value: family.totals.cards },
          { label: 'This week (min)', value: family.totals.weekMinutes },
          { label: 'Longest streak', value: family.totals.streak },
        ].map((s) => (
          <div
            key={s.label}
            style={{
              padding: spacing.lg,
              backgroundColor: colors.surface.paper,
              borderRadius: radii.lg,
              border: `1px solid ${colors.border.subtle}`,
            }}
          >
            <div style={{ fontSize: typography.size.caption, color: colors.text.muted, textTransform: 'uppercase' }}>
              {s.label}
            </div>
            <div style={{ fontSize: typography.size.display, fontWeight: 800, marginTop: spacing.xs }}>
              {s.value}
            </div>
          </div>
        ))}
      </section>

      <h2 style={{ marginBottom: spacing.md }}>Kids</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: spacing.lg }}>
        {family.profiles.map((p) => (
          <article
            key={p.id}
            style={{
              padding: spacing.lg,
              backgroundColor: colors.surface.paper,
              borderRadius: radii.lg,
              border: `1px solid ${colors.border.subtle}`,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>{p.displayName}</h3>
              <span
                style={{
                  fontSize: typography.size.caption,
                  padding: `${spacing.xxs}px ${spacing.sm}px`,
                  backgroundColor: colors.surface.sunken,
                  color: colors.text.secondary,
                  borderRadius: radii.pill,
                }}
              >
                Age {p.ageGroup}
              </span>
            </div>
            <p style={{ color: colors.text.secondary, margin: `${spacing.xs}px 0` }}>
              {p.questsCompleted} quests · {p.cards} cards · {p.streak}-day streak
            </p>
            <Link
              href={`/parent/${p.id}`}
              style={{
                display: 'inline-block',
                marginTop: spacing.sm,
                padding: `${spacing.sm}px ${spacing.md}px`,
                backgroundColor: colors.brand.primary,
                color: colors.text.inverse,
                borderRadius: radii.pill,
                fontWeight: 700,
                fontSize: typography.size.bodySm,
              }}
            >
              View progress →
            </Link>
          </article>
        ))}
      </div>

      <section style={{ marginTop: spacing.xxl }}>
        <h2>Privacy</h2>
        <ul style={{ color: colors.text.secondary, lineHeight: 1.8 }}>
          <li>By default, all learning data stays on your device.</li>
          <li>If you opt in to cloud sync, data is stored encrypted in our backend.</li>
          <li>We never sell or share children&apos;s data with third parties.</li>
          <li>You can export or delete all data with one tap.</li>
        </ul>
      </section>
    </main>
  );
}
