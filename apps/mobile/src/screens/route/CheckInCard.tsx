import { Body, Button, Card, Hoya, Spacer, spacing } from '@hangul-route/design-system';
import { PACES } from '@hangul-route/content-schema';
import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { useMessages } from '../../i18n/use-messages';
import { retainedOfferStep, type CheckInOffer, type RetainedOffer } from '../../logic/route/repace';
import { useRouteStore } from '../../store/route-store';
import { LinkButton } from '../placement/parts';

/**
 * The Hoya check-in (F-PLAN-002 section 3.7, FP-B14, OD-13): once, at the start of week 5 of an
 * active plan, a positive offer of a lighter or a bit faster pace. It never names a session that
 * was not done; **Not now** closes it for this plan; yes re-lays the plan's future on the new
 * pace (`regenerateFrom(..., 'shift')`) and says how many days a week it has now.
 */
export function CheckInCard({
  profileId,
  offer,
  onClose,
  testID,
}: {
  profileId: string;
  offer: CheckInOffer;
  /** Not now: the holder stops showing the card. */
  onClose: () => void;
  testID: string;
}): React.ReactElement | null {
  const m = useMessages();
  const t = m.learner.weeklyPlan.checkIn;
  const pace = m.learner.weeklyPlan.proposal.pace;
  const [busy, setBusy] = useState(false);
  const [applied, setApplied] = useState<number | null>(null);
  const days = PACES[offer.pace];
  const copy = offer.kind === 'lighter' ? { line: t.lighter.line, detail: t.lighter.detail(days), yes: t.lighter.yes.cta } : { line: t.faster.line, detail: t.faster.detail(pace[offer.pace], days), yes: t.faster.yes.cta };

  const answer = async (yes: boolean): Promise<void> => {
    if (busy) return;
    setBusy(true);
    let done = false;
    try {
      done = await useRouteStore.getState().answerCheckIn(profileId, yes ? offer : null);
    } catch {
      done = false;
    } finally {
      setBusy(false);
    }
    if (done && yes) setApplied(days);
    else onClose();
  };

  if (applied !== null) {
    return (
      <Card padding="md" tone="sunken" testID={`${testID}-done`}>
        <Body>{t.done(applied)}</Body>
      </Card>
    );
  }

  return (
    <Card padding="md" tone="sunken" testID={testID}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Hoya pose="waving" size={56} accessibilityLabel={m.a11y.hoya('waving')} />
        <View style={{ flex: 1 }}>
          <Body weight="semibold">{copy.line}</Body>
          <Body tone="secondary">{copy.detail}</Body>
        </View>
      </View>
      <Spacer size="sm" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
        <Button label={copy.yes} tone="primary" size="md" disabled={busy} onPress={() => void answer(true)} testID={`${testID}-yes`} />
        <LinkButton label={t.notNow.cta} onPress={() => void answer(false)} testID={`${testID}-not-now`} />
      </View>
    </Card>
  );
}

/**
 * The offer a screen keeps showing once it appeared: answering closes the check-in for the plan
 * (so the computed offer turns null), and the card stays to say what changed until `close`. It is
 * kept per learner and plan (`key`): a profile switch or a replaced plan never shows the old card.
 */
export function useShownOffer(offer: CheckInOffer | null, key: string): [CheckInOffer | null, () => void] {
  const [kept, setKept] = useState<RetainedOffer>({ key, shown: null, closed: false });
  useEffect(() => {
    setKept((prev) => retainedOfferStep(prev, offer, key));
  }, [offer, key]);
  const close = useCallback(() => {
    setKept((prev) => ({ ...prev, shown: null, closed: true }));
  }, []);
  // Before the effect catches up with a new learner or plan, show that plan's own offer, never the kept one.
  if (kept.key !== key) return [offer, close];
  return [kept.closed ? null : kept.shown, close];
}
