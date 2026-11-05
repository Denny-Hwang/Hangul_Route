'use client';

import { borderWidth, colors, radii, spacing, touchTarget, typography } from '@hangul-route/design-system/tokens';
import { useEffect, useId, useLayoutEffect, useRef, useState, type MutableRefObject, type ReactNode } from 'react';
import { useConsoleLocale } from '@/lib/i18n/locale-context';
import { rem } from '@/lib/console/rem';
import { buttonBase, panelStyle } from './ui';

/**
 * The class page's order (AMENDMENTS-GROWNUP-UX GX-7, section 8 T3 to T5; wireframe `design/wireframes/console/roster.md`
 * "Class page order (GX-7)"; mock `design/screens/approvals/mock/class-*.html`): the action bar with More, the Invite
 * students disclosure around the join code, and the empty class's first steps. Which buttons go where is
 * `classActions` (`lib/console/class-page.ts`); every word comes from the dictionary.
 */

const CHEVRON = 16;

/** A layout effect in the browser (it runs before React removes the old nodes), a plain effect in the static prerender. */
const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/** A small chevron that turns when its disclosure opens; decoration only (the button says expanded or not). */
function Chevron({ open }: { open: boolean }): JSX.Element {
  return (
    <svg
      width={CHEVRON}
      height={CHEVRON}
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
      style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : undefined }}
    >
      <path d="M3 6l5 5 5-5" fill="none" stroke={colors.text.secondary} strokeWidth={borderWidth.base} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * T3: the bar keeps the everyday buttons in view (`bar`, the plan first as the primary) and folds the rest (`more`)
 * under **More**, a disclosure button (`aria-expanded`, `aria-controls`), not a menu: the folded buttons show in a row
 * right under the bar, in the reading order, so a keyboard or a screen reader reaches them next. An entry with a waiting
 * count (new devices, class moves) is never folded here: `classActions` puts it in the bar, its count in words on the
 * button (GX-7 review), so More itself never needs a waiting look. `aria-controls` is set only while the panel is
 * mounted, so it never points at a missing id.
 */
export function ClassActionBar({ bar, more }: { bar: ReactNode[]; more: ReactNode[] }): JSX.Element {
  const { messages } = useConsoleLocale();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const row = { display: 'flex', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' } as const;
  return (
    <div data-testid="class-actions" style={{ marginBottom: spacing.lg }}>
      <div style={row}>
        {bar}
        {more.length ? (
          <button
            type="button"
            data-testid="class-more-toggle"
            aria-expanded={open}
            aria-controls={open ? panelId : undefined}
            onClick={() => setOpen((was) => !was)}
            style={{ ...buttonBase, gap: spacing.xs }}
          >
            {messages.console.space.more}
            <Chevron open={open} />
          </button>
        ) : null}
      </div>
      {open && more.length ? (
        <div id={panelId} data-testid="class-more" style={{ ...row, marginTop: spacing.sm, paddingTop: spacing.sm, borderTop: `${borderWidth.thin}px solid ${colors.border.subtle}` }}>
          {more}
        </div>
      ) : null}
    </div>
  );
}

/**
 * T3 and T5: **Invite students · code {code}** at the end of the page. Collapsed while the class has learners (the
 * code no longer pushes the roster down); open from the start, with the code hero-size, while the class is empty (the
 * page then puts it first, so the code is on the first phone screen). The page passes the code panel as a function of
 * `hero`. A class that fills up remounts it (the page keys it by `empty`), so it closes once the first learner joins.
 * `focusMemo` (one ref the page keeps across both mounts): when focus was inside the old disclosure as it went away
 * (Copy, Regenerate, the join link), the new one takes focus on its button instead of leaving it on the page body.
 * `aria-controls` is set only while the body is mounted.
 */
export function InviteDisclosure({
  code,
  empty,
  focusMemo,
  children,
}: {
  code: string | null;
  empty: boolean;
  focusMemo?: MutableRefObject<boolean>;
  children: (hero: boolean) => ReactNode;
}): JSX.Element {
  const { messages } = useConsoleLocale();
  const [open, setOpen] = useState(empty);
  const bodyId = useId();
  const sectionRef = useRef<HTMLElement | null>(null);
  const toggleRef = useRef<HTMLButtonElement | null>(null);
  useIsoLayoutEffect(() => {
    const section = sectionRef.current;
    if (focusMemo?.current) {
      focusMemo.current = false;
      const active = typeof document === 'undefined' ? null : document.activeElement;
      if (active === null || active === document.body) toggleRef.current?.focus();
    }
    return () => {
      // Runs before React removes the old nodes, so the focused element is still inside.
      if (focusMemo && typeof section?.contains === 'function' && typeof document !== 'undefined') focusMemo.current = section.contains(document.activeElement);
    };
    // Once per mount: the page remounts the disclosure (its key) when the class fills up or empties.
  }, []);
  return (
    <section ref={sectionRef} data-testid="invite" style={{ ...panelStyle, padding: spacing.none, marginBottom: spacing.lg, overflow: 'hidden' }}>
      <h2 style={{ margin: 0, fontSize: rem(typography.size.bodyLg) }}>
        <button
          type="button"
          ref={toggleRef}
          data-testid="invite-toggle"
          aria-expanded={open}
          aria-controls={open ? bodyId : undefined}
          onClick={() => setOpen((was) => !was)}
          style={{
            width: '100%',
            minHeight: touchTarget.min,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: spacing.sm,
            padding: `${spacing.sm}px ${spacing.lg}px`,
            border: 'none',
            borderRadius: radii.lg,
            backgroundColor: colors.surface.paper,
            color: colors.text.primary,
            font: 'inherit',
            fontWeight: typography.weight.bold,
            textAlign: 'start',
            cursor: 'pointer',
          }}
        >
          <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{messages.console.space.invite(code ?? '—')}</span>
          <Chevron open={open} />
        </button>
      </h2>
      {open ? (
        <div id={bodyId} data-testid="invite-body" style={{ padding: `0 ${spacing.lg}px ${spacing.lg}px`, textAlign: empty ? 'center' : 'start' }}>
          {children(empty)}
        </div>
      ) : null}
    </section>
  );
}

/** T5: an empty class's three first steps (show the code, students join, plan this week), as an ordered list. */
export function FirstRunCard(): JSX.Element {
  const { messages } = useConsoleLocale();
  const words = messages.console.space.firstRun;
  return (
    <section data-testid="first-run" aria-labelledby="first-run-title" style={{ ...panelStyle, marginBottom: spacing.lg }}>
      <h2 id="first-run-title" style={{ margin: `0 0 ${spacing.sm}px`, fontSize: rem(typography.size.bodyLg) }}>
        {words.title}
      </h2>
      <ol style={{ margin: 0, paddingInlineStart: spacing.lg, color: colors.text.secondary, lineHeight: typography.leading.relaxed }}>
        {words.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </section>
  );
}
