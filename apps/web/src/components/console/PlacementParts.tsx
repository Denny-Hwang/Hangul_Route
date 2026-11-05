'use client';

import { colors, spacing, typography } from '@hangul-route/design-system/tokens';
import type { SpaceKind } from '@hangul-route/content-schema';
import Link from 'next/link';
import { buttonBase } from '@/components/console/ui';
import type { RosterSummary } from '@/lib/console/api';
import { startingSpotChanged, startingSpotLine, suggestStartHref } from '@/lib/console/placement';
import { useConsoleLocale } from '@/lib/i18n/locale-context';
import { rem } from '@/lib/console/rem';

/**
 * The starting-spot line on a roster card (F-PLC-001 section 3.9, P-9; wireframe
 * `design/wireframes/placement/placement.md` K): "Starting spot: Stage 1 · Letters and sounds ·
 * Oct 9", a quiet "Changed by a grown-up" when the start was changed, and **Suggest a different
 * start**, which opens the existing plan builder with a one-quest plan for this learner only.
 * The control is one link styled as a button, named with the learner ("Suggest a different
 * start for Sam") so a list of the roster's links tells the cards apart.
 * Nothing when the summary has no level-check result. Every word comes from the dictionary.
 * `link={false}` (the class page's compact card, AMENDMENTS-GROWNUP-UX GX-7 review): the line alone; the card draws
 * `SuggestStartLink` in its one row of buttons with See report and Send a note.
 */
export function StartingSpot({
  summary,
  spaceId,
  learnerId,
  learnerName,
  kind,
  link = true,
}: {
  summary: Pick<RosterSummary, 'placement'> | null;
  spaceId: string;
  learnerId: string;
  learnerName: string;
  /** The space kind, so the link uses its persona prefix (F-APP-001 A-5b). */
  kind?: SpaceKind;
  /** false: the line without Suggest a different start (the card puts that link in its button row). */
  link?: boolean;
}): JSX.Element | null {
  const { locale } = useConsoleLocale();
  const line = startingSpotLine(summary, locale);
  if (line === null) return null;
  const changed = startingSpotChanged(summary, locale);
  return (
    <div data-testid="starting-spot" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs, margin: `${spacing.xxs}px 0` }}>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block' }}>{line}</span>
        {changed ? <span style={{ display: 'block', color: colors.text.muted, fontSize: rem(typography.size.caption) }}>{changed}</span> : null}
      </span>
      {link ? <SuggestStartLink summary={summary} spaceId={spaceId} learnerId={learnerId} learnerName={learnerName} kind={kind} /> : null}
    </div>
  );
}

/** **Suggest a different start**, one link named with the learner; nothing when the card has no starting-spot line. */
export function SuggestStartLink({
  summary,
  spaceId,
  learnerId,
  learnerName,
  kind,
}: {
  summary: Pick<RosterSummary, 'placement'> | null;
  spaceId: string;
  learnerId: string;
  learnerName: string;
  kind?: SpaceKind;
}): JSX.Element | null {
  const { messages, locale } = useConsoleLocale();
  if (startingSpotLine(summary, locale) === null) return null;
  return (
    <Link
      href={suggestStartHref(spaceId, learnerId, kind)}
      data-testid="suggest-start"
      aria-label={messages.console.placement.suggest.label(learnerName.trim())}
      style={buttonBase}
    >
      {messages.console.placement.suggest.cta}
    </Link>
  );
}
