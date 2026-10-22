import { FAMILY_LIFETIME_LEARNERS, GROUP_LICENSE_LEARNERS } from '@hangul-route/content-schema';
import { borderWidth, colors, radii, spacing, typography } from '@hangul-route/design-system/tokens';
import { getMessages, type UiLocale } from '@hangul-route/i18n';
import Link from 'next/link';
import type { ReactNode } from 'react';
import type { SiteClaims } from '../../data/site-claims';
import { HIT, PRIMARY_ACTION, SECONDARY_ACTION, SITE_SIZES, VISUALLY_HIDDEN, rem } from '../../lib/site-style';

/**
 * The parts every page of the layered site is built from (F-SITE-002 §3.1 rules, §3.4 to §3.6; mock
 * design/screens/site/persona-page.md). Server components with inline token styles; what changes at the 720 px
 * breakpoint (padding, heading sizes, columns, button widths) and on hover is in the `hr-site-*` rules of `globals.css`.
 * Every word comes in as a prop from the dictionary.
 */

/** The page's primary action (the hero pill). A plain `<a>`: actions leave the site route group. */
export function PrimaryAction({ href, children }: { href: string; children: ReactNode }): JSX.Element {
  return (
    <a href={href} className="hr-site-primary" style={PRIMARY_ACTION}>
      {children}
    </a>
  );
}

/** A secondary action: the outline pill, next to the primary action. */
export function SecondaryAction({ href, children }: { href: string; children: ReactNode }): JSX.Element {
  return (
    <a href={href} className="hr-site-secondary" style={SECONDARY_ACTION}>
      {children}
    </a>
  );
}

/**
 * The page head: the page's only h1, its lead line and its actions (primary first). `after` sits under the action row
 * ([SN] the grown-up pages' "Already have an account? Sign in", AMENDMENTS-SITE-NEWUSER §3.5).
 */
export function PageHead({ title, lead, after, children }: { title: string; lead: string; after?: ReactNode; children: ReactNode }): JSX.Element {
  return (
    <section aria-labelledby="page-title" className="hr-site-page-head">
      <h1 id="page-title" className="hr-site-h1" style={{ margin: 0, lineHeight: typography.leading.tight, color: colors.text.primary }}>
        {title}
      </h1>
      <p
        className="hr-site-lead"
        style={{
          margin: `${spacing.md}px 0 0`,
          lineHeight: typography.leading.relaxed,
          color: colors.text.secondary,
          maxWidth: SITE_SIZES.leadMeasure,
        }}
      >
        {lead}
      </p>
      <div className="hr-site-actions" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: spacing.md, marginTop: spacing.xl }}>
        {children}
      </div>
      {after ? <div style={{ marginTop: spacing.xs }}>{after}</div> : null}
    </section>
  );
}

/** One section: an h2 and at most three lines or four bullets (rule 2). `hiddenTitle` keeps the outline for folds. */
export function Section({ id, title, hiddenTitle = false, children }: { id: string; title: string; hiddenTitle?: boolean; children: ReactNode }): JSX.Element {
  return (
    <section aria-labelledby={id} className="hr-site-section">
      <h2
        id={id}
        className={hiddenTitle ? undefined : 'hr-site-h2'}
        style={hiddenTitle ? VISUALLY_HIDDEN : { margin: `0 0 ${spacing.md}px`, lineHeight: typography.leading.tight, color: colors.text.primary }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

/** A section's one-line body. */
export function Body({ children }: { children: ReactNode }): JSX.Element {
  return <p style={{ margin: 0, lineHeight: typography.leading.relaxed }}>{children}</p>;
}

/**
 * A short bullet list: a decorative `brand.primary` dot, then the line. `role="list"`: Safari with VoiceOver drops the
 * list role of a list with `list-style: none` (the same on `Steps` and the `/learners` card tiles).
 */
export function Bullets({ items }: { items: readonly string[] }): JSX.Element {
  return (
    <ul role="list" style={{ listStyle: 'none', margin: `${spacing.md}px 0 0`, padding: 0, display: 'grid', gap: spacing.sm }}>
      {items.map((item) => (
        <li key={item} style={{ display: 'grid', gridTemplateColumns: `${spacing.sm}px minmax(0, 1fr)`, columnGap: spacing.md, lineHeight: typography.leading.normal }}>
          <span
            aria-hidden="true"
            style={{ width: spacing.sm, height: spacing.sm, marginTop: spacing.sm, borderRadius: radii.circle, backgroundColor: colors.brand.primary }}
          />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/** Numbered steps, one line each; `wide` puts them in three columns from 720 px. */
export function Steps({ items, wide = false }: { items: readonly string[]; wide?: boolean }): JSX.Element {
  return (
    <ol role="list" className={wide ? 'hr-site-steps hr-site-steps-wide' : 'hr-site-steps'} style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: spacing.md }}>
      {items.map((item, i) => (
        <li key={item} style={{ display: 'grid', gridTemplateColumns: `${spacing.xxl}px minmax(0, 1fr)`, columnGap: spacing.md, alignItems: 'start' }}>
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
          <span style={{ lineHeight: typography.leading.normal }}>{item}</span>
        </li>
      ))}
    </ol>
  );
}

/**
 * A native fold (works without JavaScript). The summary stays a block: older WebKit (iOS 14 and 15 Safari) does not
 * reliably lay out a summary that is itself a grid or flex container, so its inner span does the layout and draws the
 * chevron (`hr-site-fold-q::after`, turned when open, no animation).
 */
export function Fold({ summary, children }: { summary: string; children: ReactNode }): JSX.Element {
  return (
    <details
      className="hr-site-fold"
      style={{ backgroundColor: colors.surface.paper, border: `${borderWidth.base}px solid ${colors.border.subtle}`, borderRadius: radii.md }}
    >
      <summary className="hr-site-summary" style={{ fontWeight: typography.weight.semibold, cursor: 'pointer', listStyle: 'none' }}>
        <span className="hr-site-fold-q">{summary}</span>
      </summary>
      <div style={{ padding: `0 ${spacing.lg}px ${spacing.lg}px`, color: colors.text.secondary, lineHeight: typography.leading.relaxed }}>{children}</div>
    </details>
  );
}

/** A column of folds, `spacing.sm` apart. */
export function Folds({ children }: { children: ReactNode }): JSX.Element {
  return <div style={{ display: 'grid', gap: spacing.sm }}>{children}</div>;
}

/**
 * The closing block every persona page ends with: one line, labelling the block, and the primary action. [SN] The
 * grown-up pages pass their actions inside `ClosingActions` (Create, then the have-account link under it).
 */
export function Closing({ id, line, children }: { id: string; line: string; children: ReactNode }): JSX.Element {
  return (
    <section aria-labelledby={id} className="hr-site-closing" style={{ backgroundColor: colors.brand.primaryLight, borderRadius: radii.xl }}>
      <p id={id} style={{ margin: 0, fontSize: rem(typography.size.prompt), fontWeight: typography.weight.bold, lineHeight: typography.leading.tight }}>
        {line}
      </p>
      {children}
    </section>
  );
}

/** [SN] The closing block's action stack (AMENDMENTS-SITE-NEWUSER §3.5): the primary action, then a text link under it. */
export function ClosingActions({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div className="hr-site-closing-actions" style={{ display: 'grid', rowGap: spacing.xs }}>
      {children}
    </div>
  );
}

/** A section's lines: its base line and any claim lines after it, `spacing.sm` apart (one style, no badge). */
export function Lines({ items }: { items: readonly string[] }): JSX.Element {
  return (
    <div style={{ display: 'grid', gap: spacing.sm }}>
      {items.map((line) => (
        <Body key={line}>{line}</Body>
      ))}
    </div>
  );
}

const TEXT_LINK = {
  ...HIT,
  justifyContent: 'flex-start',
  fontWeight: typography.weight.semibold,
  textDecorationLine: 'underline',
  textDecorationThickness: borderWidth.thin,
  textUnderlineOffset: spacing.xs,
} as const;

/**
 * [SN] A text link that leaves the site for the app (a plain `<a>`, as every app link), styled as `TextLink`: the
 * grown-up pages' "Already have an account? Sign in" (AMENDMENTS-SITE-NEWUSER §3.5, §3.6), 64 px tall.
 */
export function AppTextLink({ href, children }: { href: string; children: ReactNode }): JSX.Element {
  return (
    <a href={href} className="hr-site-text-link" style={TEXT_LINK}>
      {children}
    </a>
  );
}

/** An in-page text link to another site page (`next/link`, inside the site route group), with a 64 px hit area. */
export function TextLink({ href, children }: { href: string; children: ReactNode }): JSX.Element {
  return (
    <Link href={href} className="hr-site-text-link" style={TEXT_LINK}>
      {children}
    </Link>
  );
}

/**
 * Two columns from 720 px (the grown-up pages' sections, mock design/screens/site/persona-page.md): one column on
 * phones, where each section keeps its top rule; on wide screens the rule sits above the pair (`hr-site-row-2*`).
 */
export function TwoColumns({ left, right }: { left: ReactNode; right: ReactNode }): JSX.Element {
  return (
    <div className="hr-site-row-2-wrap">
      <div className="hr-site-row-2">
        <div>{left}</div>
        <div>{right}</div>
      </div>
    </div>
  );
}

/**
 * The Plans block of a persona page (F-SITE-002 §3.5, §3.6): the free line, the paid line only while paid plans are
 * coming (once they are on sale, the managed line already says where), then the managed line, so the app host is named
 * once. No price, no plan term and no billing link, ever. [SA] AMENDMENTS-SEATS-ADMINS section 4 (SA-6): once plans
 * are on sale, the sizes line takes the paid line's place, with the learner limits from content-schema.
 */
export function PlansBlock({ locale, claims, id }: { locale: UiLocale; claims: Readonly<SiteClaims>; id: string }): JSX.Element {
  const t = getMessages(locale).landing;
  return (
    <Section id={id} title={t.persona.plansTitle}>
      <div style={{ display: 'grid', gap: spacing.sm }}>
        {/* Two keys in one paragraph: each stays its own text node, so a locale can word each one alone. */}
        <Body>
          <span>{t.plans.free.stage1}</span>
          {' '}
          <span>
            {claims.paidPlans === 'coming' ? t.plans.paid.coming : t.plans.sizes(FAMILY_LIFETIME_LEARNERS, GROUP_LICENSE_LEARNERS)}
          </span>
        </Body>
        <Body>{t.plans.managedInApp}</Body>
      </div>
    </Section>
  );
}
