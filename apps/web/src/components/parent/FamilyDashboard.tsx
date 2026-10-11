'use client';

import { colors, radii, spacing, typography } from '@hangul-route/design-system/tokens';
import Link from 'next/link';
import type { MockFamily } from '@/data/mock-family';
import { levelPillLabel } from '@/lib/console/level-label';
import { useMessages } from '@/lib/i18n/locale-context';

/**
 * The `/parent` demo dashboard (F-CONSOLE-001 §3.7) on sample data. Every word comes from the
 * dictionary (`console.parent`, F-I18N-001 PR 10c) in the console's locale (`parent/layout.tsx`);
 * the demo family is data and level labels come from content-schema.
 */
export function FamilyDashboard({ family }: { family: MockFamily }): JSX.Element {
  const c = useMessages().console;
  const p = c.parent;

  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: `${spacing.xl}px ${spacing.lg}px` }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xxl }}>
        <div>
          <a href="/" style={{ color: colors.text.muted, fontSize: typography.size.caption }}>
            {c.shell.backToSite}
          </a>
          <h1 style={{ fontSize: typography.size.display, margin: `${spacing.xs}px 0 0` }}>
            {p.title}
          </h1>
          <p style={{ color: colors.text.secondary, margin: `${spacing.xs}px 0 0` }}>
            {p.demoNote}
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
          {p.sample.pill}
        </span>
      </header>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing.md, marginBottom: spacing.xxl }}>
        {[
          { key: 'profiles', label: p.stats.profiles, value: family.profiles.length },
          { key: 'cards', label: p.stats.cards, value: family.totals.cards },
          { key: 'weekMinutes', label: p.stats.weekMinutes, value: family.totals.weekMinutes },
          { key: 'streak', label: p.stats.streak, value: family.totals.streak },
        ].map((s) => (
          <div
            key={s.key}
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

      <h2 style={{ marginBottom: spacing.md }}>{p.kidsTitle}</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: spacing.lg }}>
        {family.profiles.map((profile) => (
          <article
            key={profile.id}
            style={{
              padding: spacing.lg,
              backgroundColor: colors.surface.paper,
              borderRadius: radii.lg,
              border: `1px solid ${colors.border.subtle}`,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>{profile.displayName}</h3>
              {levelPillLabel(profile.ageGroup) ? (
                <span
                  style={{
                    fontSize: typography.size.caption,
                    padding: `${spacing.xxs}px ${spacing.sm}px`,
                    backgroundColor: colors.surface.sunken,
                    color: colors.text.secondary,
                    borderRadius: radii.pill,
                  }}
                >
                  {levelPillLabel(profile.ageGroup)}
                </span>
              ) : null}
            </div>
            <p style={{ color: colors.text.secondary, margin: `${spacing.xs}px 0` }}>
              {p.kidLine(profile.questsCompleted, profile.cards, profile.streak)}
            </p>
            <Link
              href={`/parent/${profile.slug}`}
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
              {p.viewProgress.cta}
            </Link>
          </article>
        ))}
      </div>

      <section style={{ marginTop: spacing.xxl }}>
        <h2>{p.privacy.title}</h2>
        <ul style={{ color: colors.text.secondary, lineHeight: 1.8 }}>
          {p.privacy.points.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
