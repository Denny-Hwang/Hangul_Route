import { Body, Button, Caption, Heading, Hoya, Icon, Screen, Spacer, colors, spacing, touchTarget, typography } from '@hangul-route/design-system';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { useMessages } from '../../i18n/use-messages';
import { billingNote, billingOpenedEvent, billingPressStep, pendingBillingStep, planView } from '../../logic/paywall';
import { gateOpensDirectly } from '../../logic/profiles/gate-route';
import { isParentSessionValid } from '../../logic/profiles/session';
import type { RootStackParamList } from '../../navigation/types';
import { openBilling } from '../../platform/billing-handoff';
import { HAND_OFF_NEEDS_TAP } from '../../platform/external-link';
import { focusForScreenReader } from '../../platform/screen-reader';
import { track } from '../../platform/telemetry';
import { useAccountStore } from '../../store/account-store';
import { useAudience } from '../../store/audience';
import { activeProfileSelector, useProfileStore } from '../../store/profile-store';
import { effectiveTier, useTierStore } from '../../store/tier-store';
import { useUiStore } from '../../store/ui-store';
import { FreePlanLines, PlanGuidanceLine } from './PlanSlots';

type Props = NativeStackScreenProps<RootStackParamList, 'Paywall'>;

/** Whether Open billing skips the PIN screen right now, read fresh from the stores (F-LEARN-001 L7): the PIN screen opens the session just before it returns here. */
function gateOpenNow(): boolean {
  const openedAt = useUiStore.getState().parentGateOpenedAt;
  return gateOpensDirectly({
    profiles: useProfileStore.getState().profiles,
    parentPinHash: useAccountStore.getState().parentPinHash,
    sessionOpen: isParentSessionValid(openedAt === null ? null : { openedAt, profileId: 'family' }, Date.now()),
  });
}

/**
 * The learner Plan screen — F-BILL-002 B-9 (§4.7, §4.8; wireframe billing/plan-status; mock
 * design/screens/billing/plan-status.md). Route key `Paywall`, title "Plan". Status only and not
 * gated: no price, no offer, and on native builds no link and no word about the web. On the web a
 * grown-up can open Billing: the press goes through the gate (destination `Billing`) unless it
 * opens directly. A correct PIN returns here, and the web asks for one more tap of Open billing
 * (a browser may block a tab opened outside a tap); the session is open then, so that tap opens it.
 */
export function PaywallScreen({ navigation, route }: Props): React.ReactElement {
  const { audience } = useAudience();
  const messages = useMessages();
  const profile = useProfileStore(activeProfileSelector);
  const cached = useTierStore((s) => (profile ? s.byLearner[profile.id] : undefined));
  const entitled = effectiveTier(profile?.id ?? '', new Date());
  void cached; // re-render when the inbox updates the tier
  const view = planView(
    { tier: entitled.tier, source: entitled.source, audience, name: profile?.displayName ?? null, platform: Platform.OS },
    messages,
  );
  const { state } = view;
  const [note, setNote] = useState<string | null>(null);
  const from = route.params?.from ?? 'settings';
  const profileId = profile?.id;

  useEffect(() => {
    void track({ name: 'paywall.viewed', profileId, payload: { state, from } });
  }, [state, from, profileId]);

  const handOff = useCallback(async (): Promise<void> => {
    const { outcome, url } = await openBilling();
    setNote(billingNote(outcome, url, messages));
    const event = billingOpenedEvent(outcome, state);
    if (event) void track({ ...event, profileId });
  }, [messages, profileId, state]);

  // A press waiting on the gate, back here: dropped when the gate was cancelled. Once the PIN is
  // through, native opens billing; the web asks for one more tap (a tab opened outside a tap may be
  // blocked) and moves focus to Open billing, and with the session open that tap opens it directly.
  const pending = useRef(false);
  const openRef = useRef<View>(null);
  const gateDone = view.billing?.gateDone ?? null;
  useFocusEffect(
    useCallback(() => {
      const step = pendingBillingStep(pending.current, gateOpenNow(), HAND_OFF_NEEDS_TAP);
      pending.current = false;
      if (step === 'open') void handOff();
      else if (step === 'tap-again' && gateDone !== null) {
        setNote(gateDone);
        focusForScreenReader(openRef.current);
      }
    }, [handOff, gateDone]),
  );

  const onOpenBilling = (): void => {
    setNote(null);
    if (billingPressStep(gateOpenNow()) === 'open') {
      // Called straight from the press so the web hand-off keeps the tap (pop-up rules).
      void handOff();
      return;
    }
    pending.current = true;
    navigation.navigate('PinEntry', { next: 'Billing' });
  };

  const back = (): void => {
    if (from === 'journey') navigation.navigate('Main', { screen: 'Journey' });
    else navigation.goBack();
  };

  return (
    <Screen tone="canvas" scrollable>
      {/* The heading comes first in reading order and carries the summary (§8); the back button sits over its left edge. */}
      <View style={{ minHeight: touchTarget.min, justifyContent: 'center', paddingHorizontal: touchTarget.min }}>
        <Text
          accessibilityRole="header"
          accessibilityLabel={view.summary}
          style={{
            fontSize: typography.size.prompt,
            fontWeight: typography.weight.bold,
            lineHeight: typography.size.prompt * typography.leading.tight,
            color: colors.text.primary,
            textAlign: 'center',
          }}
        >
          {view.heading}
        </Text>
        <Pressable
          onPress={back}
          hitSlop={spacing.md}
          accessibilityRole="button"
          accessibilityLabel={messages.a11y.goBack}
          style={{ position: 'absolute', left: 0, top: 0, bottom: 0, justifyContent: 'center', padding: spacing.xs }}
        >
          <Icon name="arrow-left" size={28} />
        </Pressable>
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
      {view.freeSlotLine !== null ? <FreePlanLines line={view.freeSlotLine} /> : null}
      {view.guidanceSlot ? <PlanGuidanceLine /> : null}
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
            accessibilityHint={view.billing.hint}
            onPress={onOpenBilling}
            pressableRef={openRef}
          />
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
      <Button label={view.back} tone="primary" size="lg" fullWidth onPress={() => navigation.navigate('Main', { screen: 'Journey' })} />
      <Spacer size="xl" />
    </Screen>
  );
}
