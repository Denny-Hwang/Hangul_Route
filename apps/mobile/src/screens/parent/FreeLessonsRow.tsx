import { Body, Caption, Spacer, borderWidth, colors, spacing, touchTarget } from '@hangul-route/design-system';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { useOnline } from '../../components/use-online';
import { bundleOs, flags, gatingActive } from '../../config/flags';
import { useMessages } from '../../i18n/use-messages';
import { dashboardFreeLine, ownedLearnerSpace, type DashboardFreeLineView } from '../../logic/dashboard-free-line';
import { billingHandOffStep } from '../../logic/paywall';
import { routeNext } from '../../logic/route-next';
import { planOpenBlocked } from '../../logic/shell/entry-points';
import { grownUpPinParams } from '../../logic/shell/handoff-rules';
import type { RootStackParamList } from '../../navigation/types';
import { BILLING_HANDOFF, billingOpensSameTab, openBilling } from '../../platform/billing-handoff';
import { signedInAccount } from '../../platform/device-account';
import { isOnline } from '../../platform/online';
import { useMembershipStore } from '../../store/membership-store';
import { usePlanStore } from '../../store/plan-store';
import { useProgressStore } from '../../store/progress-store';
import { routeNextInputFor } from '../../store/route-next-input';
import { useAccessTier } from '../../store/tier-store';

/** The same frame as the card's other rows (Starting spot, Learning Route). */
const frame = { marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: borderWidth.thin, borderTopColor: colors.border.subtle } as const;

/**
 * The free-lessons line on a profile card of the in-app parent dashboard (F-ENT-003 section 3.9.2,
 * row E3-12b; wireframe `design/wireframes/console/free-lessons-line.md` B). One calm line under the
 * card's rows when the learner finished everything open on the free plan, for the owner of the
 * learner's space only (`dashboardFreeLine`), and **Open billing** under it on the web build, which
 * hands off through F-BILL-002's billing hand-off (`openBilling`): the grown-up area in the same tab
 * when F-APP-001's grown-up home is on (a PIN older than 2 minutes opens the PIN screen first, which
 * hands off itself), else the billing page in a new tab, with the address to type when the browser
 * blocks it. Offline with the same-tab hand-off, the link is disabled with "Needs the internet", as
 * on the Plan screen. Nothing on native. It sends no telemetry and writes nothing.
 */
export function FreeLessonsRowView({
  view,
  onOpenBilling,
  offline,
  needsInternet,
  note,
  testID,
}: {
  view: DashboardFreeLineView;
  onOpenBilling: () => void;
  offline: boolean;
  needsInternet: string;
  note: string | null;
  testID: string;
}): React.ReactElement {
  const lineId = `${testID}-line`;
  // Several cards can each carry Open billing: on the web the link is described by its own line.
  const describedBy: Record<string, string> = Platform.OS === 'web' ? { 'aria-describedby': lineId } : {};
  return (
    <View testID={testID} style={frame}>
      <View nativeID={lineId}>
        <Body testID={lineId}>{view.line}</Body>
      </View>
      {view.openBilling !== null ? (
        <>
          <View style={{ alignItems: 'flex-start' }}>
            <Pressable
              testID={`${testID}-billing`}
              onPress={onOpenBilling}
              disabled={offline}
              accessibilityRole="link"
              accessibilityLabel={view.openBilling}
              accessibilityState={{ disabled: offline }}
              {...describedBy}
              style={{ minHeight: touchTarget.min, minWidth: touchTarget.min, justifyContent: 'center' }}
            >
              <Body weight="semibold" tone={offline ? 'secondary' : 'brand'}>
                {view.openBilling}
              </Body>
            </Pressable>
          </View>
          {offline ? (
            <Body size="sm" tone="secondary" testID={`${testID}-offline`}>
              {needsInternet}
            </Body>
          ) : null}
          {/* A blocked tab's address to type is read out as it appears. */}
          <View accessibilityLiveRegion="polite">
            {note !== null ? (
              <>
                <Spacer size="xs" />
                <Caption tone="muted" testID={`${testID}-note`}>
                  {note}
                </Caption>
              </>
            ) : null}
          </View>
        </>
      ) : null}
    </View>
  );
}

/**
 * One profile's line. The account comes first: with no signed-in account (`signedInAccount`), or
 * with the switch off, nothing is read and nothing draws. Otherwise the learner's memberships and
 * plans are read, and `routeNext` (the same input Home and the Plan screen build) decides free-end.
 */
export function FreeLessonsRow({ profileId, name, testID }: { profileId: string; name: string; testID: string }): React.ReactElement | null {
  const messages = useMessages();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const account = signedInAccount();
  const gating = gatingActive(flags, bundleOs());
  const reads = account !== null && gating;
  const tier = useAccessTier(profileId);
  const memberships = useMembershipStore((s) => s.byLearner[profileId]);
  const plans = usePlanStore((s) => s.byLearner[profileId]);
  const snapshot = useProgressStore((s) => s.byProfile[profileId]);
  useEffect(() => {
    if (!reads) return;
    void useMembershipStore.getState().hydrate(profileId);
    void usePlanStore.getState().hydrate(profileId);
  }, [reads, profileId]);

  const view = useMemo(
    () =>
      dashboardFreeLine(
        {
          name,
          gatingActive: gating,
          tier,
          space: ownedLearnerSpace(account, memberships),
          // `snapshot` and `plans` are in the deps so the line follows them; the input reads the stores.
          freeEnd: () => routeNext(routeNextInputFor(profileId, new Date())).kind === 'free-end',
          platform: Platform.OS,
        },
        messages,
      ),
    [name, gating, tier, account, memberships, snapshot, plans, profileId, messages],
  );

  const sameTab = billingOpensSameTab();
  const online = useOnline();
  const [note, setNote] = useState<string | null>(null);
  const busy = useRef(false);
  const onOpenBilling = (): void => {
    // The live network state, not the last render's (as the Plan screen).
    if (planOpenBlocked(sameTab, isOnline()) || busy.current) return;
    busy.current = true;
    setNote(null);
    // `openBilling` opens the tab before it awaits anything, so the tap's activation reaches it.
    void openBilling(sameTab)
      .then((result) => {
        // The dashboard is not the Plan screen: no `paywall.console_opened` from here.
        const step = billingHandOffStep(result, 'free', messages);
        setNote(step.note);
        if (step.askPin) navigation.navigate('PinEntry', grownUpPinParams(BILLING_HANDOFF));
      })
      .catch(() => {
        // Nothing opened; the link stays usable.
      })
      .finally(() => {
        busy.current = false;
      });
  };

  if (view === null) return null;
  return (
    <FreeLessonsRowView
      view={view}
      onOpenBilling={onOpenBilling}
      offline={planOpenBlocked(sameTab, online)}
      needsInternet={messages.learner.welcome.grownUps.needsInternet}
      note={note}
      testID={testID}
    />
  );
}
