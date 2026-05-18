import { colors, radii, spacing, typography } from '@hangul-route/design-system/tokens';
import Link from 'next/link';
import { mockFamily } from '@/data/mock-family';
import { notFound } from 'next/navigation';

export default function ChildDetailPage({ params }: { params: { childId: string } }): JSX.Element {
  const family = mockFamily();
  const child = family.profiles.find((p) => p.id === params.childId);
  if (!child) notFound();

  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: `${spacing.xl}px ${spacing.lg}px` }}>
      <Link href="/parent" style={{ color: colors.brand.primary, fontWeight: 600 }}>
        ← Family Dashboard
      </Link>

      <header style={{ marginTop: spacing.lg, marginBottom: spacing.xxl }}>
        <h1 style={{ fontSize: typography.size.display, margin: 0 }}>{child.displayName}</h1>
        <p style={{ color: colors.text.secondary, margin: `${spacing.xs}px 0 0` }}>
          Age {child.ageGroup} · {child.questsCompleted} quests · {child.cards} cards
        </p>
      </header>

      <section style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: spacing.xl }}>
        <div>
          <h2>Recent activity</h2>
          <div style={{ backgroundColor: colors.surface.paper, padding: spacing.lg, borderRadius: radii.lg, border: `1px solid ${colors.border.subtle}` }}>
            {child.recentQuests.length === 0 ? (
              <p style={{ color: colors.text.muted }}>No recent quests.</p>
            ) : (
              <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                {child.recentQuests.map((q) => (
                  <li
                    key={q.id}
                    style={{
                      padding: `${spacing.sm}px 0`,
                      borderBottom: `1px solid ${colors.border.subtle}`,
                      display: 'flex',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600 }}>{q.title}</div>
                      <div style={{ fontSize: typography.size.caption, color: colors.text.muted }}>{q.completedAt}</div>
                    </div>
                    <div style={{ color: colors.feedback.nudge, fontWeight: 700 }}>{q.stars}★</div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <h2 style={{ marginTop: spacing.xl }}>Weekly time</h2>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: spacing.sm, height: 140, padding: spacing.md, backgroundColor: colors.surface.paper, borderRadius: radii.lg, border: `1px solid ${colors.border.subtle}` }}>
            {child.weekly.map((m, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: spacing.xs }}>
                <div
                  style={{
                    width: '100%',
                    height: `${Math.min(100, (m.minutes / 30) * 100)}%`,
                    backgroundColor: colors.brand.primary,
                    borderRadius: radii.sm,
                    minHeight: 4,
                  }}
                />
                <span style={{ fontSize: typography.size.caption, color: colors.text.muted }}>{m.day}</span>
              </div>
            ))}
          </div>
        </div>

        <aside>
          <h2>Cards collected</h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: spacing.sm,
              padding: spacing.md,
              backgroundColor: colors.surface.paper,
              borderRadius: radii.lg,
              border: `1px solid ${colors.border.subtle}`,
            }}
          >
            {child.recentCards.map((c) => (
              <div
                key={c.id}
                style={{
                  padding: spacing.sm,
                  backgroundColor: colors.surface.canvas,
                  borderRadius: radii.md,
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: typography.size.title }}>{c.emoji}</div>
                <div style={{ fontSize: typography.size.caption, fontWeight: 600 }}>{c.title}</div>
              </div>
            ))}
          </div>

          <h2 style={{ marginTop: spacing.xl }}>Send homework</h2>
          <button
            type="button"
            style={{
              width: '100%',
              padding: spacing.md,
              backgroundColor: colors.brand.secondary,
              color: colors.text.inverse,
              border: 'none',
              borderRadius: radii.pill,
              fontWeight: 700,
              fontSize: typography.size.body,
            }}
          >
            + Assign a quest
          </button>
          <p style={{ fontSize: typography.size.caption, color: colors.text.muted, marginTop: spacing.sm }}>
            Coming soon — for now, Hoya picks the next quest.
          </p>
        </aside>
      </section>
    </main>
  );
}
