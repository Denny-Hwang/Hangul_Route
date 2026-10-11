'use client';

import { colors, spacing, typography } from '@hangul-route/design-system/tokens';
import Link from 'next/link';
import { buttonBase } from '@/components/console/ui';
import type { RosterSummary } from '@/lib/console/api';
import { startingSpotChanged, startingSpotLine, suggestStartHref } from '@/lib/console/placement';
import { useConsoleLocale } from '@/lib/i18n/locale-context';

/**
 * The starting-spot line on a roster card (F-PLC-001 section 3.9, P-9; wireframe
 * `design/wireframes/placement/placement.md` K): "Starting spot: Stage 1 · Letters and sounds ·
 * Oct 9", a quiet "Changed by a grown-up" when the start was changed, and **Suggest a different
 * start**, which opens the existing plan builder with a one-quest plan for this learner only.
 * The control is one link styled as a button, named with the learner ("Suggest a different
 * start for Sam") so a list of the roster's links tells the cards apart.
 * Nothing when the summary has no level-check result. Every word comes from the dictionary.
 */
export function StartingSpot({
  summary,
  spaceId,
  learnerId,
  learnerName,
}: {
  summary: Pick<RosterSummary, 'placement'> | null;
  spaceId: string;
  learnerId: string;
  learnerName: string;
}): JSX.Element | null {
  const { messages, locale } = useConsoleLocale();
  const line = startingSpotLine(summary, locale);
  if (line === null) return null;
  const changed = startingSpotChanged(summary, locale);
  return (
    <div data-testid="starting-spot" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs, margin: `${spacing.xxs}px 0` }}>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block' }}>{line}</span>
        {changed ? <span style={{ display: 'block', color: colors.text.muted, fontSize: typography.size.caption }}>{changed}</span> : null}
      </span>
      <Link
        href={suggestStartHref(spaceId, learnerId)}
        data-testid="suggest-start"
        aria-label={messages.console.placement.suggest.label(learnerName.trim())}
        style={{ ...buttonBase, display: 'inline-block', textDecoration: 'none' }}
      >
        {messages.console.placement.suggest.cta}
      </Link>
    </div>
  );
}
