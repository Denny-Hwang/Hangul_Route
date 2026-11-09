import { useAuth, useSignIn } from '@clerk/clerk-expo';
import { Body, Button, Screen, Spacer, borderWidth, colors, layout, radii, spacing, touchTarget, typography, useLayoutClass, useTypeScale } from '@hangul-route/design-system';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';
import { forwardRef, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactElement } from 'react';
import { AccessibilityInfo, TextInput, View, type TextInputProps } from 'react-native';
import { LinkButton } from '../../components/LinkButton';
import { useMessages } from '../../i18n/use-messages';
import { createAccountApi } from '../../logic/account/api';
import { accountQueryKey } from '../../logic/account/queries';
import { afterSignInPlan, deviceUsesRecord, keepsRecords, retrustPendingFor, trustRecord, usesOfSpaces } from '../../logic/account/sign-in-records';
import {
  emailReady,
  initialSignInState,
  resendCode,
  secondCodeSent,
  signInFlowPayload,
  signInProof,
  signInReducer,
  submitCode,
  submitEmail,
  submitPassword,
  submitSecond,
  switchToCode,
  type ClerkSignInView,
  type SignInEvent,
  type SignInLine,
  type SignInPort,
  type SignInState,
} from '../../logic/account/sign-in-step';
import type { GrownUpStackParamList } from '../../navigation/types';
import { readTrust, writeDeviceUses, writeRetrustNotice, writeTrust } from '../../platform/account-records';
import { useAccountStore } from '../../store/account-store';
import { useAccountVisit } from '../../store/account-visit';
import { nativeGateState } from '../../store/native-gate-state';
import { ClerkMountContext } from './account-host';
import { nativeOs, trackSignIn, useAccountOnline } from './account-session.native';

/**
 * F-AUTH-004 sections 6.3 and 6.5, design `design/screens/account/sign-in.md` (boards 1 to 18, D1 to D5, D21; row NS-3;
 * ND-3, ND-4, CS-N8, CS-N10): the grown-up sign-in on iOS and Android, a route of the nested Grown-up area stack.
 *
 * - The step machine is `logic/account/sign-in-step.ts`; this screen draws its state and binds its port to Clerk's
 *   `signIn`. Email code first, the password when the account has one, the second step or new-device check Clerk asks
 *   for. No sign-up, no Google, Apple, passkey or email link, no link anywhere: the two quiet lines under the email
 *   step are the only words about accounts.
 * - Every refusal is one of section 6.3's lines, in an amber strip under its field (never the danger colour, D5),
 *   announced and tied to the field; a wrong code or password clears and refocuses the field.
 * - Offline (D2): a strip under the header; the buttons that call Clerk wait (Continue, Sign in, Send a new code,
 *   Email me a code), the ones that only change the step stay; typed values stay. While Clerk answers every button but
 *   Back waits, with the same words.
 * - A completed sign-in (section 6.5) reads `GET /api/spaces`, writes the uses record and the trust on a `pin` device
 *   with a real epoch (with the re-trust rule of 7.3), notes the sign-in time in memory, sends
 *   `auth.native.signin { result: 'ok' }`, and goes back to where it was opened (the use's home opens here once row
 *   NS-5 lands the homes). Leaving earlier sends the flow's last result, or `cancelled` (one event per flow).
 * - Without Clerk's provider for this visit the screen shows `lock.cantCheck` and Back, and calls nothing.
 */

type Props = NativeStackScreenProps<GrownUpStackParamList, 'SignIn'>;

export function SignInScreen(props: Props): ReactElement {
  const messages = useMessages();
  const mount = useContext(ClerkMountContext);
  const title = messages.caregiver.account.signIn.title;
  if (mount !== 'ready') {
    return (
      <Screen tone="canvas" scrollable header={{ title }}>
        <View testID="sign-in-unavailable">
          <Body>{messages.caregiver.account.lock.cantCheck}</Body>
          <Spacer size="md" />
          <Button label={messages.common.buttons.back} tone="ghost" size="md" fullWidth onPress={() => props.navigation.goBack()} testID="sign-in-back" />
        </View>
      </Screen>
    );
  }
  return <SignInFlow {...props} />;
}

/** Clerk's sign-in resource as the step machine reads it. */
function viewOf(resource: {
  status: string | null;
  supportedFirstFactors: readonly { strategy: string }[] | null;
  supportedSecondFactors: readonly { strategy: string }[] | null;
  clientTrustState?: string;
  createdSessionId: string | null;
}): ClerkSignInView {
  return {
    status: resource.status,
    supportedFirstFactors: resource.supportedFirstFactors,
    supportedSecondFactors: resource.supportedSecondFactors,
    clientTrustState: resource.clientTrustState ?? null,
    createdSessionId: resource.createdSessionId,
  };
}

/** `__DEV__`, read safely (undefined outside React Native). */
function devBuild(): boolean {
  return (globalThis as { __DEV__?: unknown }).__DEV__ === true;
}

function SignInFlow({ navigation }: Props): ReactElement {
  const messages = useMessages();
  const m = messages.caregiver.account;
  const online = useAccountOnline();
  const { isLoaded, signIn, setActive } = useSignIn();
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const [state, dispatchState] = useReducer(signInReducer, false, initialSignInState);
  const stateRef = useRef<SignInState>(state);
  stateRef.current = state;
  const [emailText, setEmailText] = useState('');
  const [codeText, setCodeText] = useState('');
  const [passwordText, setPasswordText] = useState('');
  const field = useRef<TextInput | null>(null);
  const live = useRef(true);
  const layoutClass = useLayoutClass();

  const dispatch = useCallback((event: SignInEvent) => {
    stateRef.current = signInReducer(stateRef.current, event);
    dispatchState(event);
  }, []);

  // D21: a re-trust pending on this device sends Continue to the password step first (a code cannot re-trust).
  const [retrustPending, setRetrustPending] = useState(false);
  useEffect(() => {
    void Promise.all([nativeGateState(), readTrust()]).then(([gate, trust]) => {
      if (live.current) setRetrustPending(retrustPendingFor(gate, trust, useAccountStore.getState().pinResetByWait !== null));
    });
  }, []);

  // Section 15: one event per flow. Leaving the screen before completion sends the flow's last result (or `cancelled`).
  useEffect(
    () => () => {
      live.current = false;
      const os = nativeOs();
      const payload = os === null ? null : signInFlowPayload(stateRef.current, os);
      if (payload !== null) trackSignIn(payload);
    },
    [],
  );

  // The port to Clerk: each call goes to the latest sign-in resource Clerk answered with.
  const port = useMemo<SignInPort | null>(() => {
    if (!isLoaded || signIn === undefined) return null;
    let current = signIn;
    const step = async (call: Promise<typeof signIn>): Promise<ClerkSignInView> => {
      current = await call;
      return viewOf(current);
    };
    return {
      create: (identifier) => step(current.create({ identifier })),
      prepareFirstFactor: (params) => step(current.prepareFirstFactor(params)),
      attemptFirstFactor: (params) => step(current.attemptFirstFactor(params)),
      prepareSecondFactor: (params) => step(current.prepareSecondFactor(params)),
      attemptSecondFactor: (params) => step(current.attemptSecondFactor(params)),
      setActive: (session) => setActive({ session }),
    };
  }, [isLoaded, signIn, setActive]);

  // A wrong code or password, a new code or a new step: the field is cleared and focused.
  useEffect(() => {
    if (state.clearField === 0) return;
    setCodeText('');
    setPasswordText('');
    field.current?.focus();
  }, [state.clearField]);

  const lineText = (line: SignInLine): string => (line === 'offline' ? messages.learner.welcome.grownUps.needsInternet : m.errors[line]);

  // Every error line is announced (section 14).
  useEffect(() => {
    if (state.line !== null) AccessibilityInfo.announceForAccessibility(lineText(state.line));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- announced when the line changes, in the locale drawn
  }, [state.line, state.clearField]);

  /** Section 6.5: the records, the sign-in time and the event of a completed sign-in; then back to where it opened. */
  const finish = async (): Promise<void> => {
    const done = stateRef.current;
    const proof = signInProof(done);
    const os = nativeOs();
    const at = Date.now();
    let retrust = false;
    try {
      const [gate, trust] = await Promise.all([nativeGateState(), readTrust()]);
      const plan = proof === null ? null : afterSignInPlan(gate, trust, useAccountStore.getState().pinResetByWait !== null, proof);
      const api = createAccountApi({ baseUrl: process.env.EXPO_PUBLIC_API_BASE_URL, dev: devBuild(), getToken: () => getToken(), fetch: (url, init) => fetch(url, init) });
      const spaces = await api.spaces();
      // In memory only, cleared with the session (ND-10): the account's spaces for this visit.
      if (spaces.ok) queryClient.setQueryData(accountQueryKey('spaces'), spaces.data);
      if (plan !== null && plan.writeTrust && keepsRecords(gate)) {
        await writeTrust(trustRecord(gate.epoch));
        const uses = spaces.ok ? usesOfSpaces(spaces.data) : null;
        if (uses !== null) await writeDeviceUses(deviceUsesRecord(uses, at));
        if (plan.retrustNotice) await writeRetrustNotice(at);
      }
      retrust = plan?.retrustPending ?? false;
    } catch {
      // A failed read or write leaves the records to the next sign-in; the lock decides what opens (CS-N3).
    }
    useAccountVisit.getState().markSignedIn(at, retrust);
    if (os !== null) {
      const payload = signInFlowPayload(stateRef.current, os);
      if (payload !== null) trackSignIn(payload);
    }
    dispatch({ type: 'ended' });
    if (live.current) navigation.goBack();
  };

  /** Runs one Clerk step: busy first, then its events, then the completion when the flow is done. */
  const run = async (task: (p: SignInPort) => Promise<SignInEvent | SignInEvent[]>, method?: 'email_code' | 'password'): Promise<void> => {
    if (port === null || stateRef.current.busy) return;
    dispatch({ type: 'start' });
    if (method !== undefined) dispatch({ type: 'attempt', method });
    const result = await task(port);
    if (!live.current) return;
    for (const event of Array.isArray(result) ? result : [result]) dispatch(event);
    if (stateRef.current.step === 'done') await finish();
  };

  const busy = state.busy;
  const waits = busy || !online || port === null;
  const step = state.step;

  const submit = (): void => {
    if (waits) return;
    if (step === 'email') {
      if (!emailReady(emailText)) return;
      void run((p) => submitEmail(p, emailText, retrustPending));
    } else if (step === 'code') void run((p) => submitCode(p, codeText), 'email_code');
    else if (step === 'password') void run((p) => submitPassword(p, passwordText), 'password');
    else if (step === 'second' && state.second !== null) {
      const second = state.second;
      void run((p) => submitSecond(p, second, codeText));
    }
  };

  const fieldInvalid = state.line !== null;
  const hint = state.line === null ? undefined : lineText(state.line);
  const column = layoutClass.width === 'compact' ? { width: '100%' as const } : { width: '100%' as const, maxWidth: layout.pane.master, alignSelf: 'center' as const };

  const submitButton = (label: string, ready: boolean): ReactElement => (
    <Button label={label} tone="primary" size="md" fullWidth softDisabled={waits || !ready} onPress={submit} testID="sign-in-submit" />
  );
  const changeEmail = (
    <LinkButton
      label={m.signIn.changeEmail.cta}
      onPress={() => {
        if (busy) return;
        setEmailText(state.email);
        dispatch({ type: 'change_email' });
      }}
      testID="sign-in-change-email"
    />
  );
  const resend = (
    <Button
      label={m.signIn.resend.cta}
      tone="ghost"
      size="md"
      fullWidth
      softDisabled={waits}
      onPress={() => {
        if (!waits) void run((p) => resendCode(p, stateRef.current));
      }}
      testID="sign-in-resend"
    />
  );

  return (
    <Screen tone="canvas" scrollable header={{ title: m.signIn.title }}>
      {!online ? <Strip tone="offline" text={messages.learner.welcome.grownUps.needsInternet} testID="sign-in-offline" /> : null}
      <View style={[column, { gap: spacing.md }]} accessibilityState={{ busy }} testID={`sign-in-step-${step}`}>
        {step === 'email' ? (
          <>
            <Body tone="secondary">{m.signIn.intro}</Body>
            <AccountField ref={field} kind="email" label={m.signIn.email} value={emailText} onChange={setEmailText} invalid={fieldInvalid} hint={hint} onSubmit={submit} />
            {state.line !== null ? <Strip tone="nudge" text={lineText(state.line)} testID="sign-in-error" /> : null}
            {submitButton(messages.common.buttons.continue, emailReady(emailText))}
            <View style={{ borderTopWidth: borderWidth.thin, borderTopColor: colors.border.subtle, paddingTop: spacing.md, gap: spacing.xs }}>
              <Body size="sm" tone="secondary">
                {m.signIn.learners}
              </Body>
              <Body size="sm" tone="secondary">
                {m.signIn.noNewAccounts}
              </Body>
            </View>
          </>
        ) : null}
        {step === 'code' ? (
          <>
            <Body>{m.signIn.codeSent(state.email)}</Body>
            <AccountField
              ref={field}
              kind="code"
              label={m.signIn.code}
              accessibleName={messages.a11y.account.codeField}
              value={codeText}
              onChange={setCodeText}
              invalid={fieldInvalid}
              hint={hint}
              onSubmit={submit}
            />
            {state.line !== null ? <Strip tone="nudge" text={lineText(state.line)} testID="sign-in-error" /> : null}
            {submitButton(m.signIn.submit.cta, codeText.trim() !== '')}
            {resend}
            {state.factors.password ? (
              <Button
                label={m.signIn.usePassword.cta}
                tone="ghost"
                size="md"
                fullWidth
                softDisabled={busy}
                onPress={() => {
                  if (!busy) dispatch({ type: 'use_password' });
                }}
                testID="sign-in-use-password"
              />
            ) : null}
            {changeEmail}
          </>
        ) : null}
        {step === 'password' ? (
          <>
            <AccountField ref={field} kind="password" label={m.signIn.password} value={passwordText} onChange={setPasswordText} invalid={fieldInvalid} hint={hint} onSubmit={submit} />
            {state.line !== null ? <Strip tone="nudge" text={lineText(state.line)} testID="sign-in-error" /> : null}
            {submitButton(m.signIn.submit.cta, passwordText !== '')}
            {state.factors.emailAddressId !== null ? (
              <Button
                label={m.signIn.useCode.cta}
                tone="ghost"
                size="md"
                fullWidth
                softDisabled={waits}
                onPress={() => {
                  if (!waits) void run((p) => switchToCode(p, stateRef.current));
                }}
                testID="sign-in-use-code"
              />
            ) : null}
            {changeEmail}
          </>
        ) : null}
        {step === 'second' && state.second !== null ? (
          <>
            <Body>{state.second.kind === 'device' ? m.signIn.deviceCheck : m.signIn.secondStep}</Body>
            <AccountField
              ref={field}
              kind={state.second.usingBackup ? 'backup' : 'code'}
              label={m.signIn.code}
              accessibleName={state.second.usingBackup ? m.signIn.code : messages.a11y.account.codeField}
              value={codeText}
              onChange={setCodeText}
              invalid={fieldInvalid}
              hint={hint}
              onSubmit={submit}
            />
            {state.line !== null ? <Strip tone="nudge" text={lineText(state.line)} testID="sign-in-error" /> : null}
            {submitButton(m.signIn.submit.cta, codeText.trim() !== '')}
            {secondCodeSent(state.second) ? resend : null}
            {state.second.backupOffered && !state.second.usingBackup ? (
              <Button
                label={m.signIn.useBackup.cta}
                tone="ghost"
                size="md"
                fullWidth
                softDisabled={busy}
                onPress={() => {
                  if (!busy) dispatch({ type: 'use_backup' });
                }}
                testID="sign-in-use-backup"
              />
            ) : null}
            {changeEmail}
          </>
        ) : null}
        {step === 'unsupported' ? (
          <>
            <Strip tone="info" text={m.errors.unsupported} testID="sign-in-unsupported" />
            <Button
              label={m.signIn.changeEmail.cta}
              tone="ghost"
              size="md"
              fullWidth
              onPress={() => {
                setEmailText(state.email);
                dispatch({ type: 'change_email' });
              }}
              testID="sign-in-change-email"
            />
          </>
        ) : null}
      </View>
    </Screen>
  );
}

/** A strip (D5): an error line in amber (`feedback.nudgeLight`, a `feedback.nudge` edge), a notice, or offline. */
function Strip({ tone, text, testID }: { tone: 'nudge' | 'info' | 'offline'; text: string; testID: string }): ReactElement {
  const background = tone === 'nudge' ? colors.feedback.nudgeLight : tone === 'info' ? colors.feedback.infoLight : colors.surface.sunken;
  const edge = tone === 'nudge' ? colors.feedback.nudge : tone === 'info' ? colors.feedback.info : colors.border.shape;
  return (
    <View
      testID={testID}
      accessibilityRole={tone === 'offline' ? undefined : 'alert'}
      style={{ backgroundColor: background, borderLeftWidth: spacing.xs, borderLeftColor: edge, borderRadius: radii.md, padding: spacing.md, marginBottom: tone === 'offline' ? spacing.md : 0 }}
    >
      <Body weight="semibold">{text}</Body>
    </View>
  );
}

interface AccountFieldProps {
  kind: 'email' | 'code' | 'backup' | 'password';
  /** The visible label (never a placeholder). */
  label: string;
  /** The accessible name when it is not the visible label (the code field's, which contains it, WCAG 2.5.3). */
  accessibleName?: string;
  value: string;
  onChange: (value: string) => void;
  invalid: boolean;
  /** The error line, tied to the field as its hint. */
  hint?: string;
  onSubmit: () => void;
}

/** The fields' input props per kind (section 6.3): autofill, keyboard, no autocorrect; a code field reads its digits one by one. */
function inputPropsFor(kind: AccountFieldProps['kind']): TextInputProps {
  if (kind === 'email') return { textContentType: 'emailAddress', autoComplete: 'email', keyboardType: 'email-address', autoCapitalize: 'none', autoCorrect: false };
  if (kind === 'code') return { textContentType: 'oneTimeCode', autoComplete: 'one-time-code', keyboardType: 'number-pad', autoCapitalize: 'none', autoCorrect: false, maxLength: 6 };
  if (kind === 'password') return { textContentType: 'password', autoComplete: 'current-password', secureTextEntry: true, autoCapitalize: 'none', autoCorrect: false };
  // D4: a backup code holds letters: a plain field, no number pad and no one-time-code autofill.
  return { autoCapitalize: 'none', autoCorrect: false, autoComplete: 'off', maxLength: 64 };
}

/** The code field's width (the mock's `acc-code-field`, 12rem): six mono digits with tracking and the field's padding. */
const CODE_FIELD_MIN = touchTarget.min * 3;

const AccountField = forwardRef<TextInput, AccountFieldProps>(function AccountField({ kind, label, accessibleName, value, onChange, invalid, hint, onSubmit }, ref) {
  const scale = useTypeScale();
  const code = kind === 'code';
  return (
    <View style={{ gap: spacing.xs }}>
      <Body weight="semibold">{label}</Body>
      <TextInput
        ref={ref}
        value={value}
        onChangeText={(text) => onChange(code ? text.replace(/\D/g, '') : text)}
        onSubmitEditing={onSubmit}
        accessibilityLabel={accessibleName ?? label}
        accessibilityHint={hint}
        // The code's digits, spaced, so a screen reader reads them one by one (section 14); never a password.
        accessibilityValue={code && value !== '' ? { text: value.split('').join(' ') } : undefined}
        aria-invalid={invalid}
        // Board 1: focus starts on the email field.
        autoFocus={kind === 'email'}
        testID={`sign-in-field-${kind}`}
        {...inputPropsFor(kind)}
        style={{
          minHeight: touchTarget.min,
          alignSelf: code ? 'flex-start' : 'stretch',
          minWidth: code ? CODE_FIELD_MIN : undefined,
          paddingHorizontal: spacing.md,
          fontSize: code ? scale.size.prompt : scale.size.body,
          fontWeight: code ? typography.weight.bold : typography.weight.regular,
          fontFamily: code ? typography.family.mono : undefined,
          letterSpacing: code ? typography.tracking.wide : undefined,
          color: colors.text.primary,
          backgroundColor: colors.surface.paper,
          // D5: the field keeps its `border.shape` border and thickens when its line shows (never an amber or danger border).
          borderWidth: invalid ? borderWidth.thick : borderWidth.base,
          borderColor: colors.border.shape,
          borderRadius: radii.lg,
        }}
      />
    </View>
  );
});
