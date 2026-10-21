import { CATALOG, freeLessonsFacts } from '@hangul-route/content-schema';
import { Body, Button, Caption, Heading, Hoya, Screen, Spacer, colors, touchTarget, typography, KOREAN_LINE_BREAK, useTypeScale } from '@hangul-route/design-system';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { useOnline } from '../../components/use-online';
import { bundleOs, flags, gatingActive } from '../../config/flags';
import { episodesAll, questsAll } from '../../content';
import { vocabTopics } from '../../content/vocab';
import { useMessages } from '../../i18n/use-messages';
import { freeExtrasCount } from '../../logic/content-access';
import { dayKey } from '../../logic/homework/mission-builder';
import { billingHandOffStep, billingPressStep, pendingBillingStep, planView } from '../../logic/paywall';
import { classOnlyMember, freeEndNow, hasPlanNow, readFreeFacts, type FreePlanContext } from '../../logic/plan-free-lines';
import { planOpenBlocked } from '../../logic/shell/entry-points';
import { grownUpPinParams } from '../../logic/shell/handoff-rules';
import type { RootStackParamList } from '../../navigation/types';
import { BILLING_HANDOFF, billingOpensSameTab, openBilling } from '../../platform/billing-handoff';
import { HAND_OFF_NEEDS_TAP } from '../../platform/external-link';
import { isOnline } from '../../platform/online';
import { focusForScreenReader } from '../../platform/screen-reader';
import { track } from '../../platform/telemetry';
import { useAudience } from '../../store/audience';
import { gateOpensDirectlyNow } from '../../store/gate-now';
import { useMembershipStore } from '../../store/membership-store';
import { usePlanStore } from '../../store/plan-store';
import { activeProfileSelector, useProfileStore } from '../../store/profile-store';
import { useProgressStore } from '../../store/progress-store';
import { effectiveTier, useAccessTier, useQuestAccess, useTierStore } from '../../store/tier-store';
import { passGate } from '../../store/gate-telemetry';
import { FreePlanLines, PlanGuidanceLine } from './PlanSlots';

type Props = NativeStackScreenProps<RootStackParamList, 'Paywall'>;

/** What is free in this build: read once (F-ENT-003 section 3.9.1; numbers from data, never typed). */
let bundleFacts: { facts: FreePlanContext['facts']; stories: number; topics: number } | null = null;
function freeBundleFacts(): { facts: FreePlanContext['facts']; stories: number; topics: number } {
  bundleFacts ??= { facts: readFreeFacts(() => freeLessonsFacts(CATALOG)), ...freeExtrasCount(vocabTopics.map((t) => t.key)) };
  return bundleFacts;
}

/**
 * The learner Plan screen — F-BILL-002 B-9 (§4.7, §4.8; wireframe billing/plan-status; mock
 * design/screens/billing/plan-status.md). Route key `Paywall`, title "Plan". Status only and not
 * gated: no price, no offer, and on native builds no link and no word about the web. On the web a
 * grown-up can open Billing: the press goes through the gate (destination `Billing`) unless it
 * opens directly. A correct PIN returns here, and the web asks for one more tap of Open billing
 * (a browser may block a tab opened outside a tap); the session is open then, so that tap opens it.
 * F-APP-001 A-7 (sections 3.6, 3.12, 3.19; mock app-shell/learner-entry.md): with the grown-up home
 * flag on (web) and the browser offline, Open billing is disabled with "Needs the internet" under it
 * as its description, and re-enables on `online`.
 * B-9b: with the grown-up home flag on (web), billing opens in this tab through F-APP-001's
 * grown-up hand-off (no new tab, so no extra tap after the PIN); a PIN older than 2 minutes opens the
 * grown-up area's own PIN screen first, which hands off after a correct PIN.
 */
export function PaywallScreen({ navigation, route }: Props): React.ReactElement {
  const textScale = useTypeScale();
  const { audience } = useAudience();
  const messages = useMessages();
  const profile = useProfileStore(activeProfileSelector);
  const cached = useTierStore((s) => (profile ? s.byLearner[profile.id] : undefined));
  const entitled = effectiveTier(profile?.id ?? '', new Date());
  void cached; // re-render when the inbox updates the tier

  // F-ENT-003 section 3.9.1 (E3-8): the slots' data. The free slot's data is read only while the
  // effective switch is on; whether a plan exists feeds the premium no-plan line (item 10, any switch).
  const gating = gatingActive(flags, bundleOs());
  const learnerId = profile?.id ?? '';
  const accessTier = useAccessTier(learnerId);
  const questOpen = useQuestAccess();
  const snap = useProgressStore((s) => (profile ? s.byProfile[profile.id] : undefined));
  const memberships = useMembershipStore((s) => (profile ? s.byLearner[profile.id] : undefined));
  const plans = usePlanStore((s) => (profile ? s.byLearner[profile.id] : undefined));
  useEffect(() => {
    if (learnerId) void usePlanStore.getState().hydrate(learnerId);
  }, [learnerId]);
  const freePlan = useMemo((): FreePlanContext => {
    const hasPlan = hasPlanNow(plans, snap);
    if (!gating) return { gatingActive: false, facts: null, stories: 0, topics: 0, classOnly: false, freeEnd: false, hasPlan };
    const freeEnd =
      snap !== undefined &&
      freeEndNow({
        snapshot: snap,
        profileId: learnerId,
        today: dayKey(new Date().toISOString()),
        plans,
        quests: questsAll,
        episodes: episodesAll,
        tier: accessTier,
        gatingActive: gating,
        isQuestOpen: questOpen,
      });
    return { gatingActive: gating, ...freeBundleFacts(), classOnly: classOnlyMember(memberships), freeEnd, hasPlan };
  }, [gating, learnerId, accessTier, questOpen, snap, memberships, plans]);

  const from = route.params?.from ?? 'settings';
  const view = planView(
    { tier: entitled.tier, source: entitled.source, audience, name: profile?.displayName ?? null, platform: Platform.OS, freePlan, from },
    messages,
  );
  const { state } = view;
  const [note, setNote] = useState<string | null>(null);
  const profileId = profile?.id;
  const sameTab = billingOpensSameTab();
  const online = useOnline();
  const offline = planOpenBlocked(sameTab, online);
  const needsInternet = messages.learner.welcome.grownUps.needsInternet;

  useEffect(() => {
    void track({ name: 'paywall.viewed', profileId, payload: { state, from } });
  }, [state, from, profileId]);

  // One hand-off at a time: the same-tab hand-off waits up to a second for its event before it
  // leaves, and a second press in that window would run it twice (B-9b review). Cleared after each
  // run, so a page restored from the back/forward cache can open billing again.
  const busy = useRef(false);
  const handOff = useCallback(async (): Promise<void> => {
    // Back from the gate while offline with the flag on, no hand-off starts either (the live
    // network state, not the last render's): the button is disabled with "Needs the internet".
    if (planOpenBlocked(sameTab, isOnline())) return;
    if (busy.current) return;
    busy.current = true;
    try {
      const step = billingHandOffStep(await openBilling(sameTab), state, messages);
      setNote(step.note);
      if (step.event) void track({ ...step.event, profileId });
      if (step.askPin) navigation.navigate('PinEntry', grownUpPinParams(BILLING_HANDOFF));
    } finally {
      busy.current = false;
    }
  }, [messages, navigation, profileId, sameTab, state]);

  // A press waiting on the gate, back here: dropped when the gate was cancelled. Once the PIN is
  // through, native opens billing; the web asks for one more tap (a tab opened outside a tap may be
  // blocked) and moves focus to Open billing, and with the session open that tap opens it directly.
  // The same-tab hand-off (B-9b) opens no tab, so it goes on by itself.
  const pending = useRef(false);
  const openRef = useRef<View>(null);
  const gateDone = view.billing?.gateDone ?? null;
  useFocusEffect(
    useCallback(() => {
      const step = pendingBillingStep(pending.current, gateOpensDirectlyNow(), HAND_OFF_NEEDS_TAP && !sameTab);
      pending.current = false;
      if (step === 'open') void handOff();
      else if (step === 'tap-again' && gateDone !== null) {
        setNote(gateDone);
        focusForScreenReader(openRef.current);
      }
    }, [handOff, gateDone, sameTab]),
  );

  const onOpenBilling = (): void => {
    if (offline) return;
    setNote(null);
    if (billingPressStep(passGate('Billing', gateOpensDirectlyNow())) === 'open') {
      // Called straight from the press so the web hand-off keeps the tap (pop-up rules).
      void handOff();
      return;
    }
    pending.current = true;
    navigation.navigate('PinEntry', { next: 'Billing' });
  };

  return (
    <Screen tone="canvas" scrollable>
      {/* The heading comes first in reading order and carries the summary (§8); the way back is the route's ScreenHeader above it. */}
      <View style={{ minHeight: touchTarget.min, justifyContent: 'center' }}>
        <Text {...KOREAN_LINE_BREAK}
          accessibilityRole="header"
          accessibilityLabel={view.summary}
          style={{
            fontSize: textScale.size.prompt,
            fontWeight: typography.weight.bold,
            lineHeight: textScale.size.prompt * typography.leading.tight,
            color: colors.text.primary,
            textAlign: 'center',
          }}
        >
          {view.heading}
        </Text>
      </View>
      <Spacer size="sm" />
      <View style={{ alignItems: 'center' }}>
        <Hoya pose={view.pose} size={96} />
      </View>
      <Spacer size="md" />
      <Heading level="title" align="center">
        {view.title}
      </Heading>
      <Spacer size="xs" />
      {view.lines.map((line) => (
        <Body key={line} tone="secondary" align="center">
          {line}
        </Body>
      ))}
      {view.freeSlot !== null ? <FreePlanLines slot={view.freeSlot} /> : null}
      <PlanGuidanceLine lines={view.guidance} />
      {view.billing ? (
        <>
          <Spacer size="xl" />
          <Body size="sm" tone="secondary" align="center">
            {view.billing.caption}
          </Body>
          <Spacer size="sm" />
          <Button
            label={view.billing.cta}
            tone="secondary"
            size="lg"
            fullWidth
            accessibilityHint={offline ? needsInternet : view.billing.hint}
            disabled={offline}
            onPress={onOpenBilling}
            pressableRef={openRef}
            testID="plan-open-billing"
          />
          {offline ? (
            <>
              <Spacer size="xs" />
              <Body size="sm" tone="secondary" align="center" testID="plan-open-billing-offline">
                {needsInternet}
              </Body>
            </>
          ) : null}
          {/* The prompt after the PIN and any failure line are read out as they appear. */}
          <View accessibilityLiveRegion="polite">
            {note ? (
              <>
                <Spacer size="xs" />
                <Caption tone="muted" align="center">
                  {note}
                </Caption>
              </>
            ) : null}
          </View>
          <Spacer size="md" />
        </>
      ) : (
        <Spacer size="xl" />
      )}
      <Button
        label={view.back}
        tone="primary"
        size="lg"
        fullWidth
        // Plain Back (Profile's plan card opened it) goes where the route's ScreenHeader Back goes.
        onPress={() => (view.backTo === 'Back' ? navigation.goBack() : navigation.navigate('Main', { screen: view.backTo }))}
        testID="plan-back"
      />
      <Spacer size="xl" />
    </Screen>
  );
}
