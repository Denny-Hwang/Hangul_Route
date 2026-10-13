'use client';

import { colors, spacing, typography } from '@hangul-route/design-system/tokens';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/console/ui';
import type { ConsoleApi, PlanView, RosterLearner } from '@/lib/console/api';
import { planUpdateOffer, reseedSaveBody, updateAskText } from '@/lib/console/curriculum';
import { useConsoleLocale } from '@/lib/i18n/locale-context';

/**
 * **Update the plan** on a family learner card (F-PLAN-002 section 3.8 step 4, FP-B5, PR P2-6b;
 * wireframe `journey/my-route-overview.md` K3 in console words): when the learner's newest level
 * check found a later start than the learner's own live route, one line ("Sam's newest check found
 * a later place to start.") and one button. The button confirms what leaves and joins the plan and
 * that the end date stays, then saves the same plan re-seeded from today (`reseed`, console mode);
 * devices pick up the new dates on their next sync. Nothing in a class or a school, nothing for an
 * earlier start. Every word comes from the dictionary.
 */
export function PlanUpdateLine({
  kind,
  learner,
  plans,
  today,
  api,
  spaceId,
  onSaved,
}: {
  kind: string;
  learner: Pick<RosterLearner, 'id' | 'displayName' | 'summary'>;
  plans: readonly PlanView[];
  today: string;
  api: Pick<ConsoleApi, 'savePlan'> | null;
  spaceId: string;
  onSaved: () => void;
}): JSX.Element | null {
  const { messages, locale } = useConsoleLocale();
  const words = messages.console.curriculum.update;
  const offer = useMemo(() => planUpdateOffer(kind, learner, plans, today), [kind, learner, plans, today]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<'done' | 'failed' | null>(null);
  const doneRef = useRef<HTMLDivElement>(null);
  // Focus follows the save onto its message, so a screen reader hears it and focus never falls to the page.
  useEffect(() => {
    if (status === 'done') doneRef.current?.focus();
  }, [status]);
  if (status === 'done') {
    return (
      <div ref={doneRef} tabIndex={-1} role="status" aria-live="polite" data-testid="plan-update-done">
        {words.done}
      </div>
    );
  }
  if (offer === null) return null;
  const name = learner.displayName.trim();

  const apply = async (): Promise<void> => {
    if (!api || busy || !window.confirm(updateAskText(offer.diff, locale))) return;
    setBusy(true);
    setStatus(null);
    let ok = false;
    try {
      const result = await api.savePlan(spaceId, reseedSaveBody(offer, today, new Date().toISOString()));
      ok = result.ok;
    } catch {
      // A plan the generator cannot re-seed, or a network throw: the failed line, never a blank card.
      ok = false;
    }
    setBusy(false);
    setStatus(ok ? 'done' : 'failed');
    if (ok) onSaved();
  };

  return (
    <div data-testid="plan-update" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs, margin: `${spacing.xxs}px 0` }}>
      <span style={{ minWidth: 0 }}>{words.line(name)}</span>
      <Button testId="plan-update-cta" ariaLabel={words.label(name)} disabled={!api || busy} onClick={() => void apply()}>
        {words.cta}
      </Button>
      {/* Always in the DOM so the failed line is announced when its text arrives. */}
      <span role="status" aria-live="polite" style={{ display: 'block', width: '100%', color: colors.text.secondary, fontSize: typography.size.caption }}>
        {status === 'failed' ? words.failed : null}
      </span>
    </div>
  );
}
