'use client';

import { IconSvg } from '@hangul-route/design-system/icon-glyphs/dom';
import { borderWidth, colors, layout, radii, shadows, spacing, touchTarget, typography } from '@hangul-route/design-system/tokens';
import { useId, type CSSProperties, type ReactNode } from 'react';

/**
 * The parts of `/signin` and the grown-up routers (F-APP-001 A-4b; design mock
 * design/screens/app-shell/signin.md, wireframe design/wireframes/shell/signin.md). Presentational
 * only: every word arrives as a prop from `console.signIn.*`, every value is a token. `/signin` is
 * exempt from the lock and has no adult frame: one centred column at every width, like the lock.
 */

/** `shadows.card` (a React Native shadow tuple) as a CSS box shadow: the colour token with the token's opacity as alpha. */
const alphaHex = Math.round(shadows.card.shadowOpacity * 255)
  .toString(16)
  .padStart(2, '0');
const cardShadow = `0 ${shadows.card.shadowOffset.height}px ${shadows.card.shadowRadius}px ${shadows.card.shadowColor}${alphaHex}`;

const pageStyle: CSSProperties = {
  minHeight: '100vh',
  boxSizing: 'border-box',
  padding: `${spacing.lg}px ${layout.gutter.compact}px ${spacing.xxxl}px`,
  backgroundColor: colors.surface.canvas,
  color: colors.text.primary,
};

const columnStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: spacing.md,
  maxWidth: layout.maxWidth.reading,
  margin: '0 auto',
  textAlign: 'center',
};

/** The single centred column of `/signin` and the router pages. */
export function SignInColumn({ children }: { children: ReactNode }): JSX.Element {
  return (
    <main style={pageStyle}>
      <div style={columnStyle}>{children}</div>
    </main>
  );
}

const buttonBase: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: spacing.sm,
  minHeight: touchTarget.min,
  boxSizing: 'border-box',
  padding: `${spacing.sm}px ${spacing.xl}px`,
  borderRadius: radii.pill,
  fontSize: typography.size.body,
  fontWeight: typography.weight.bold,
  cursor: 'pointer',
};

/** Back to learning / Back to sign in: a quiet button, top left, with the `arrow-left` glyph. */
export function QuietBack({ label, onClick, testId }: { label: string; onClick: () => void; testId: string }): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      style={{ ...buttonBase, alignSelf: 'flex-start', paddingLeft: spacing.sm, backgroundColor: 'transparent', color: colors.text.secondary, border: 'none' }}
    >
      <IconSvg name="arrow-left" size={spacing.xl} color={colors.text.secondary} />
      {label}
    </button>
  );
}

/** The brand mark (the site header's circle, design pass D1: no Hoya on grown-up pages), the title and the intro line. */
export function SignInHead({ mark, title, intro }: { mark: string; title: string; intro?: string }): JSX.Element {
  return (
    <>
      <span
        aria-hidden="true"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: spacing.xxxl,
          height: spacing.xxxl,
          borderRadius: radii.circle,
          backgroundColor: colors.brand.primary,
          color: colors.text.inverse,
          fontSize: typography.size.bodyLg,
          fontWeight: typography.weight.bold,
          flex: 'none',
        }}
      >
        {mark}
      </span>
      <h1 style={{ margin: 0, fontSize: typography.size.title, fontWeight: typography.weight.bold, lineHeight: typography.leading.tight }}>{title}</h1>
      {intro ? <p style={{ margin: 0, color: colors.text.secondary, lineHeight: typography.leading.relaxed }}>{intro}</p> : null}
    </>
  );
}

/** The Clerk widget's box: at most `layout.pane.master` (400) wide, so `/signin` and the lock line up. */
export function WidgetBox({ children, testId }: { children: ReactNode; testId?: string }): JSX.Element {
  return (
    <div
      data-testid={testId}
      style={{
        width: '100%',
        maxWidth: layout.pane.master,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        gap: spacing.md,
        padding: spacing.md,
        backgroundColor: colors.surface.paper,
        border: `${borderWidth.thin}px solid ${colors.border.subtle}`,
        borderRadius: radii.lg,
        boxShadow: cardShadow,
        textAlign: 'left',
      }}
    >
      {children}
    </div>
  );
}

const textLinkStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: touchTarget.min,
  minWidth: touchTarget.min,
  boxSizing: 'border-box',
  paddingInline: spacing.sm,
  color: colors.brand.secondaryDark,
  fontWeight: typography.weight.semibold,
  textDecoration: 'underline',
  textUnderlineOffset: spacing.xs,
};

/** A text link of at least 64 x 64 (`touchTarget.min`), so a short one such as "Go now" is still a full target. */
export function TextLink({ href, children, testId }: { href: string; children: ReactNode; testId?: string }): JSX.Element {
  return (
    <a href={href} data-testid={testId} style={textLinkStyle}>
      {children}
    </a>
  );
}

/** Under the widget: the create link (sign-up only behind the adult step), the learners line, I'm here to learn. */
export function BelowWidget(props: { createHref: string; createLabel: string; learnersLine: string; learnHref: string; learnLabel: string }): JSX.Element {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: spacing.xs }}>
      <TextLink href={props.createHref} testId="signin-create">
        {props.createLabel}
      </TextLink>
      <p style={{ margin: 0, maxWidth: layout.pane.master, color: colors.text.muted, fontSize: typography.size.bodySm, lineHeight: typography.leading.relaxed }}>{props.learnersLine}</p>
      <TextLink href={props.learnHref} testId="signin-learn">
        {props.learnLabel}
      </TextLink>
    </div>
  );
}

const primaryStyle: CSSProperties = {
  ...buttonBase,
  width: '100%',
  backgroundColor: colors.brand.primary,
  color: colors.text.onPrimary,
  border: `${borderWidth.thin}px solid ${colors.brand.primary}`,
};

const disabledStyle: CSSProperties = {
  ...buttonBase,
  width: '100%',
  backgroundColor: colors.surface.sunken,
  color: colors.text.muted,
  border: `${borderWidth.thin}px solid ${colors.surface.sunken}`,
  cursor: 'not-allowed',
};

/**
 * The adult step (`?mode=create`, OD-13): the lead, one labelled checkbox and a real disabled
 * Continue until it is ticked. The lead is the checkbox's description.
 */
export function AdultStep(props: { lead: string; affirm: string; continueLabel: string; ticked: boolean; onTick: (ticked: boolean) => void; onContinue: () => void }): JSX.Element {
  const leadId = useId();
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (props.ticked) props.onContinue();
      }}
      style={{ width: '100%', maxWidth: layout.pane.master, display: 'flex', flexDirection: 'column', gap: spacing.md, textAlign: 'left' }}
    >
      <p id={leadId} style={{ margin: 0, fontSize: typography.size.bodyLg, fontWeight: typography.weight.bold, lineHeight: typography.leading.normal }}>
        {props.lead}
      </p>
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing.md,
          minHeight: touchTarget.min,
          boxSizing: 'border-box',
          padding: `${spacing.sm}px ${spacing.lg}px`,
          backgroundColor: colors.surface.paper,
          border: `${borderWidth.base}px solid ${props.ticked ? colors.brand.primary : colors.border.strong}`,
          borderRadius: radii.md,
          cursor: 'pointer',
        }}
      >
        <input
          type="checkbox"
          checked={props.ticked}
          onChange={(event) => props.onTick(event.target.checked)}
          aria-describedby={leadId}
          data-testid="signin-affirm"
          style={{ width: spacing.xl, height: spacing.xl, margin: 0, flex: 'none', accentColor: colors.brand.primary }}
        />
        <span>{props.affirm}</span>
      </label>
      <button type="submit" disabled={!props.ticked} data-testid="signin-affirm-continue" style={props.ticked ? primaryStyle : disabledStyle}>
        {props.continueLabel}
      </button>
    </form>
  );
}

/** Router (Panel B): one polite line and a visible link, `spacing.jumbo` above and below. */
export function RouterPanel({ line, goNowLabel, href }: { line: string; goNowLabel: string; href: string | null }): JSX.Element {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: spacing.sm, paddingBlock: spacing.jumbo }} data-testid="signin-router">
      <p role="status" aria-live="polite" style={{ margin: 0, color: colors.text.secondary }}>
        {line}
      </p>
      {href ? (
        <TextLink href={href} testId="signin-go-now">
          {goNowLabel}
        </TextLink>
      ) : null}
    </div>
  );
}

const smallButtonStyle: CSSProperties = {
  ...buttonBase,
  fontSize: typography.size.bodySm,
  backgroundColor: colors.surface.paper,
  color: colors.text.primary,
  border: `${borderWidth.thin}px solid ${colors.border.strong}`,
};

/** One line and Try again: Clerk unreachable (in the widget's place) or the spaces fetch failed (router). */
export function RetryPanel({ line, retryLabel, onRetry, testId }: { line: string; retryLabel: string; onRetry: () => void; testId: string }): JSX.Element {
  return (
    <div
      role="alert"
      data-testid={testId}
      style={{
        width: '100%',
        maxWidth: layout.pane.master,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: spacing.md,
        padding: spacing.lg,
        backgroundColor: colors.surface.paper,
        border: `${borderWidth.thin}px solid ${colors.border.subtle}`,
        borderRadius: radii.lg,
      }}
    >
      <p style={{ margin: 0 }}>{line}</p>
      <button type="button" onClick={onRetry} style={smallButtonStyle} data-testid={`${testId}-retry`}>
        {retryLabel}
      </button>
    </div>
  );
}

/** An info line above the widget (`feedback.infoLight`): the installed PWA's "Finish signing in here with an email code". */
export function InfoLine({ children }: { children: ReactNode }): JSX.Element {
  return (
    <p role="status" data-testid="signin-standalone-finish" style={{ margin: 0, padding: `${spacing.md}px ${spacing.lg}px`, backgroundColor: colors.feedback.infoLight, borderRadius: radii.md, textAlign: 'left' }}>
      {children}
    </p>
  );
}

/**
 * Reverification (Panel D, OAuth on a device with learner profiles): a paper card like the
 * lock's, the title, the line that names no factor, Clerk's reverification, and Back to learning.
 */
export function ReverifyPanel(props: { title: string; line: string; backLabel: string; onBack: () => void; children?: ReactNode }): JSX.Element {
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      data-testid="signin-reverify"
      style={{
        width: '100%',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: spacing.md,
        marginTop: spacing.xl,
        padding: `${spacing.xxl}px ${spacing.lg}px`,
        backgroundColor: colors.surface.paper,
        border: `${borderWidth.thin}px solid ${colors.border.subtle}`,
        borderRadius: radii.lg,
      }}
    >
      <h1 id={titleId} style={{ margin: 0, fontSize: typography.size.title, fontWeight: typography.weight.bold, lineHeight: typography.leading.tight }}>
        {props.title}
      </h1>
      <p style={{ margin: 0, color: colors.text.secondary, lineHeight: typography.leading.relaxed }}>{props.line}</p>
      {props.children}
      <button
        type="button"
        onClick={props.onBack}
        data-testid="signin-reverify-back"
        style={{ ...buttonBase, width: '100%', maxWidth: layout.pane.master, backgroundColor: colors.surface.paper, color: colors.text.primary, border: `${borderWidth.thin}px solid ${colors.border.strong}` }}
      >
        {props.backLabel}
      </button>
    </section>
  );
}
