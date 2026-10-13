'use client';

import { colors, spacing, typography } from '@hangul-route/design-system/tokens';
import { useMemo, useState } from 'react';
import { buttonBase } from '@/components/console/ui';
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
  if (status === 'done') return <div data-testid="plan-update-done">{words.done}</div>;
  if (offer === null) return null;
  const name = learner.displayName.trim();

  const apply = async (): Promise<void> => {
    if (!api || busy || !window.confirm(updateAskText(offer.diff, locale))) return;
    setBusy(true);
    setStatus(null);
    const result = await api.savePlan(spaceId, reseedSaveBody(offer, today, new Date().toISOString()));
    setBusy(false);
    setStatus(result.ok ? 'done' : 'failed');
    if (result.ok) onSaved();
  };

  return (
    <div data-testid="plan-update" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs, margin: `${spacing.xxs}px 0` }}>
      <span style={{ minWidth: 0 }}>{words.line(name)}</span>
      <button
        type="button"
        data-testid="plan-update-cta"
        aria-label={words.label(name)}
        disabled={!api || busy}
        onClick={() => void apply()}
        style={{ ...buttonBase, opacity: !api || busy ? 0.5 : 1, cursor: !api || busy ? 'default' : 'pointer' }}
      >
        {words.cta}
      </button>
      {status === 'failed' ? (
        <span role="status" style={{ display: 'block', width: '100%', color: colors.text.secondary, fontSize: typography.size.caption }}>
          {words.failed}
        </span>
      ) : null}
    </div>
  );
}
