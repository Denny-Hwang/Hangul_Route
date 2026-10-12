'use client';

import { colors, spacing, touchTarget, typography } from '@hangul-route/design-system/tokens';
import Link from 'next/link';
import { useId } from 'react';
import type { RosterFreeLine } from '@/lib/console/free-lessons-line-view';

/**
 * The free-lessons line on a console roster card (F-ENT-003 section 3.9.2, E3-12; wireframe
 * `design/wireframes/console/free-lessons-line.md` box A). Plain body text read after the card's
 * figures, then a real **Open billing** link with its text as its name, a touch target tall on a
 * phone. The link is described by its line (`aria-describedby`), so a roster with several cards
 * never lists identical links without context (WCAG 2.4.4). Nothing renders without a line.
 * Tokens only; the words come from `console.access` through `rosterFreeLessonsLine`.
 */
export function FreeLessonsLine({ line }: { line: RosterFreeLine | null }): JSX.Element | null {
  const id = useId();
  if (!line) return null;
  return (
    <div data-testid="free-lessons-line" style={{ marginTop: spacing.sm, color: colors.text.primary, fontSize: typography.size.bodySm, lineHeight: typography.leading.relaxed }}>
      <p id={id} style={{ margin: 0 }}>{line.text}</p>
      <Link href={line.billing.href} aria-describedby={id} style={{ display: 'inline-flex', alignItems: 'center', minHeight: touchTarget.min, fontWeight: typography.weight.bold, color: colors.text.primary, textDecoration: 'underline' }}>
        {line.billing.label}
      </Link>
    </div>
  );
}
