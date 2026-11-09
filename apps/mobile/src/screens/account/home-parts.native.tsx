import { useAuth } from '@clerk/clerk-expo';
import { Body, Card, ConfirmSheet, Spacer, borderWidth, colors, radii, spacing, typography, useTypeScale, KOREAN_LINE_BREAK } from '@hangul-route/design-system';
import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { AccessibilityInfo, Platform, Text, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { useMessages } from '../../i18n/use-messages';
import { createAccountApi, type AccountApi } from '../../logic/account/api';
import { codeFontSize, codeGroups, spelledCode, type LoadFailure } from '../../logic/account/homes';
import type { NativePlanLines } from '../../logic/account/plan-lines';
import { copyText } from '../../platform/pwa';
import { AccountButton } from './AccountButton';

/**
 * F-AUTH-004 sections 8.2, 8.5, 8.6, 8.8 and 14 (row NS-5; design `homes.md`, D9, D11, D18): the parts every native home
 * draws, on iOS and Android, inside `AccountGate` (so under Clerk's provider): the account client, the states, the
 * re-trust notice, the code panel, the plan block and the home's end (the quiet line and Sign out). No part links out,
 * names a place, or draws a price, a date or a control that buys, renews or manages (section 9.1).
 */

/** A development build (`__DEV__`): the account client then accepts `http://localhost` (section 8.1). */
function devBuild(): boolean {
  return (globalThis as { __DEV__?: unknown }).__DEV__ === true;
}

/** The account client with a fresh Clerk token per call (section 8.1). Only under Clerk's provider. */
export function useAccountApi(): AccountApi {
  const { getToken } = useAuth();
  const latest = useRef(getToken);
  latest.current = getToken;
  return useMemo(() => createAccountApi({ baseUrl: process.env.EXPO_PUBLIC_API_BASE_URL, dev: devBuild(), getToken: () => latest.current(), fetch: (url, init) => fetch(url, init) }), []);
}

/** A strip (D5's shape): the re-trust notice (info) or a refused copy (info), with its words; never the danger colour. */
export function InfoStrip({ text, testID }: { text: string; testID: string }): ReactElement {
  return (
    <View
      testID={testID}
      // A status (polite), not an alert: nothing went wrong that needs an answer now (VoiceOver: the caller announces).
      accessibilityLiveRegion="polite"
      style={{ backgroundColor: colors.feedback.infoLight, borderLeftWidth: spacing.xs, borderLeftColor: colors.feedback.info, borderRadius: radii.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.md }}
    >
      <Body>{text}</Body>
    </View>
  );
}

/** Section 8.8, board 15: the loading skeleton, two paper cards of sunken bars, hidden from assistive tech, no data. */
export function HomeSkeleton({ testID = 'account-home-loading' }: { testID?: string }): ReactElement {
  return (
    <View testID={testID} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ gap: spacing.md }}>
      {[0, 1].map((k) => (
        <View key={k} style={{ backgroundColor: colors.surface.paper, borderRadius: radii.lg, borderWidth: borderWidth.thin, borderColor: colors.border.subtle, padding: spacing.lg, gap: spacing.sm }}>
          <View style={{ height: spacing.lg, width: '50%', borderRadius: radii.sm, backgroundColor: colors.surface.sunken }} />
          <View style={{ height: spacing.md, width: '70%', borderRadius: radii.sm, backgroundColor: colors.surface.sunken }} />
          <View style={{ height: spacing.md, width: '40%', borderRadius: radii.sm, backgroundColor: colors.surface.sunken }} />
        </View>
      ))}
    </View>
  );
}

/**
 * Section 8.8, boards 16 to 18: the state box. Offline (`home.offline`) and an error while online (`home.cantLoad`)
 * offer Try again; the Worker's switch (`home.unavailable`) offers Back only. `401` has no box: the screen signs out on
 * this device and opens the sign-in.
 */
export function StateBox({ failure, onRetry, onBack, testID = 'account-home-state' }: { failure: Exclude<LoadFailure, 'unauthorized'>; onRetry: () => void; onBack: () => void; testID?: string }): ReactElement {
  const messages = useMessages();
  const h = messages.caregiver.account.home;
  const line = failure === 'offline' ? h.offline : failure === 'unavailable' ? h.unavailable : h.cantLoad;
  return (
    <Card padding="md" testID={`${testID}-${failure}`}>
      <View accessibilityLiveRegion="polite">
        <Body>{line}</Body>
      </View>
      <Spacer size="md" />
      {failure === 'unavailable' ? (
        <AccountButton label={messages.common.buttons.back} tone="paper" onPress={onBack} testID={`${testID}-back`} />
      ) : (
        <AccountButton label={messages.common.buttons.tryAgain} tone="paper" onPress={onRetry} testID={`${testID}-try-again`} />
      )}
    </Card>
  );
}

/**
 * Section 8.5, D9: the plan block, plain text in a sunken box with no border and no chevron, never pressable. On iOS it
 * is one accessible element named `a11y.account.planBlock` with the visible lines as its value (a label alone would
 * hide the plan name). D9's fallback is taken on Android: TalkBack does not reliably read the value of an element that
 * is not adjustable, so there the block stays ungrouped and its lines are read in order (the plan name speaks for
 * itself); device check D10 confirms it.
 */
export function PlanBlock({ lines, testID = 'account-plan-block' }: { lines: NativePlanLines; testID?: string }): ReactElement {
  const messages = useMessages();
  const visible = lines.usage === null ? [lines.plan] : [lines.plan, lines.usage];
  const grouped = Platform.OS === 'ios';
  return (
    <View
      testID={testID}
      accessible={grouped}
      accessibilityRole={grouped ? 'text' : undefined}
      accessibilityLabel={grouped ? messages.a11y.account.planBlock : undefined}
      accessibilityValue={grouped ? { text: visible.join(', ') } : undefined}
      style={{ backgroundColor: colors.surface.sunken, borderRadius: radii.md, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, gap: spacing.xxs }}
    >
      <Body weight="semibold">{lines.plan}</Body>
      {lines.usage !== null ? (
        <Body size="sm" tone="secondary">
          {lines.usage}
        </Body>
      ) : null}
    </View>
  );
}

/** The code panel's buttons side by side, each at least 10rem, wrapping to two rows (`account.css`). */
const BUTTON_MIN = 160;
/** Read by assistive tech, drawn nowhere (the report's sr-only box). */
const SR_ONLY = { position: 'absolute', width: 1, height: 1, margin: -1, overflow: 'hidden' } as const;

/** How long Copied stays (D11: about 2 seconds). */
export const COPIED_MS = 2000;

/**
 * Section 8.2, D11: the code panel. The label, the code in two groups of three that never break inside a group and wrap
 * at the space between (each group one `Text`), stepping down from `size.display` to fit the measured width and never
 * below `size.body` (`codeFontSize`); read as `a11y.account.joinCode` with the characters spaced, the drawn groups
 * hidden. **Copy** (Copied as a polite status for about 2 seconds; a refusal shows `copyFailed` and the code stays) and
 * **Join on this device**, paper buttons that wrap. A copied code is on the system clipboard (Universal Clipboard may
 * carry it to the account holder's other devices); it holds no name.
 */
export function CodePanel({ label, code, onJoinHere, testID = 'account-code-panel' }: { label: string; code: string; onJoinHere: () => void; testID?: string }): ReactElement {
  const messages = useMessages();
  const scale = useTypeScale();
  const [width, setWidth] = useState(0);
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);
  const live = useRef(true);
  useEffect(
    () => () => {
      live.current = false;
    },
    [],
  );
  const copy = async (): Promise<void> => {
    const ok = await copyText(code);
    if (!live.current) return;
    setFailed(!ok);
    setCopied(ok);
    // VoiceOver reads no live region: iOS announces Copied, or the refusal (Android: the polite status below, the strip).
    if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(ok ? messages.console.joinCode.copied.cta : messages.console.parentHome.copyFailed);
  };
  // The group Texts do not scale with the system text size by themselves: the system scale is folded into both ends
  // here, so the size that fits the measured width is the size drawn, and a group never breaks inside (D11, spec 14).
  const { fontScale } = useWindowDimensions();
  const system = Number.isFinite(fontScale) && fontScale > 0 ? fontScale : 1;
  const size = codeFontSize(width, scale.size.display * system, scale.size.body * system, typography.tracking.wide);
  const [first, second] = codeGroups(code);
  const group = (text: string): ReactElement => (
    <Text
      {...KOREAN_LINE_BREAK}
      allowFontScaling={false}
      style={{ fontFamily: typography.family.mono, fontSize: size, lineHeight: size * typography.leading.tight, fontWeight: typography.weight.bold, letterSpacing: typography.tracking.wide, color: colors.text.primary }}
    >
      {text}
    </Text>
  );
  return (
    <View testID={testID} style={{ backgroundColor: colors.surface.paper, borderRadius: radii.lg, borderWidth: borderWidth.thin, borderColor: colors.border.subtle, padding: spacing.lg, gap: spacing.md }}>
      <Body size="sm" weight="bold" tone="secondary">
        {label}
      </Body>
      <View
        accessible
        accessibilityRole="text"
        accessibilityLabel={messages.a11y.account.joinCode(spelledCode(code))}
        onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
        testID={`${testID}-code`}
        style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: spacing.md }}
      >
        {group(first)}
        {group(second)}
      </View>
      {failed ? <InfoStrip text={messages.console.parentHome.copyFailed} testID={`${testID}-copy-failed`} /> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        <View style={{ flexGrow: 1, flexBasis: BUTTON_MIN }}>
          <AccountButton label={copied ? messages.console.joinCode.copied.cta : messages.console.joinCode.copy.cta} tone="paper" fullWidth onPress={() => void copy()} testID={`${testID}-copy`} />
        </View>
        <View style={{ flexGrow: 1, flexBasis: BUTTON_MIN }}>
          <AccountButton label={messages.caregiver.account.home.joinHere.cta} tone="paper" fullWidth onPress={onJoinHere} testID={`${testID}-join-here`} />
        </View>
      </View>
      {/* Copied as a polite status on Android (only while it shows, so the button's return to Copy is not announced). */}
      {/* iOS announces it instead, so VoiceOver never meets a second "Copied" beside the button. */}
      <View style={SR_ONLY} accessibilityLiveRegion="polite" accessibilityElementsHidden={Platform.OS === 'ios'} testID={`${testID}-status`}>
        <Text {...KOREAN_LINE_BREAK}>{copied ? messages.console.joinCode.copied.cta : ''}</Text>
      </View>
    </View>
  );
}

/**
 * Section 8.6, D18: the end of every home: a `border.subtle` rule, the quiet line (no link, no place), then **Sign out**
 * (paper) with its ConfirmSheet (Cancel first, Sign out the primary fill: signing out loses nothing, D8).
 */
export function HomeEnd({ onSignOut, working }: { onSignOut: () => void; working: boolean }): ReactElement {
  const messages = useMessages();
  const [asking, setAsking] = useState(false);
  return (
    <View testID="account-home-end" style={{ borderTopWidth: borderWidth.thin, borderTopColor: colors.border.subtle, paddingTop: spacing.lg, gap: spacing.md }}>
      <Body size="sm" tone="secondary" testID="account-home-more-tools">
        {messages.caregiver.account.home.moreTools}
      </Body>
      <AccountButton label={messages.console.shell.signOut.cta} tone="paper" waiting={working} onPress={() => setAsking(true)} testID="account-home-sign-out" />
      <ConfirmSheet
        visible={asking}
        title={messages.caregiver.account.signOut.ask}
        cancelLabel={messages.common.buttons.cancel}
        confirmLabel={messages.console.shell.signOut.cta}
        onCancel={() => setAsking(false)}
        onConfirm={() => {
          setAsking(false);
          onSignOut();
        }}
        testID="account-home-sign-out-sheet"
      />
    </View>
  );
}
