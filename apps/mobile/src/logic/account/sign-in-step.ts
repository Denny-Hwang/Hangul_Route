import type { NATIVE_SIGNIN_RESULTS } from '@hangul-route/content-schema/native-auth-telemetry';

/**
 * F-AUTH-004 sections 6.3 and 15 (row NS-3; ND-3, ND-4, CS-N10): the native grown-up sign-in's step machine. Pure: the
 * screen (`screens/account/SignInScreen.native.tsx`) draws `SignInState` only, and every call to Clerk goes through a
 * `SignInPort` it binds to Clerk's `signIn` resource, so every transition, status and error has a test.
 *
 * | Step          | Shows                                              | On submit                                           |
 * | `email`       | the email field, Continue                          | `create`; `email_code` among the first factors:     |
 * |               |                                                    | `prepareFirstFactor` and `code` (a pending re-trust |
 * |               |                                                    | with a password: `password` first, D21); only       |
 * |               |                                                    | `password`: `password`; neither: `unsupported`      |
 * | `code`        | the code field, Sign in, Send a new code, Use my   | `attemptFirstFactor({ strategy: 'email_code' })`    |
 * |               | password (password accounts), Use another email    |                                                     |
 * | `password`    | the password field, Sign in, Email me a code       | `attemptFirstFactor({ strategy: 'password' })`      |
 * |               | (email-code accounts), Use another email           |                                                     |
 * | `second`      | the second step or the new-device check, Sign in,  | `attemptSecondFactor` with the step's strategy, or  |
 * |               | Send a new code (a sent code), Use a backup code   | `backup_code` once chosen                           |
 * | `unsupported` | `errors.unsupported`, Use another email            | -                                                   |
 * | `done`        | nothing: the screen leaves (section 6.5)           | -                                                   |
 *
 * - **Statuses** are read raw, as strings, since Clerk may answer a status the pinned SDK's types do not name:
 *   `complete` activates the session; `needs_second_factor` is the second step, or the new-device check when the
 *   sign-in's `clientTrustState` is `new` and the code goes by email (the pinned `@clerk/clerk-expo` 2.20.2 has no
 *   `needs_client_trust` status and reports Clerk's device check that way, as Clerk's own components read it);
 *   `needs_client_trust` (later SDKs) is the device check too; anything else (`needs_new_password`, an unknown status)
 *   ends in `unsupported`. The second step takes the first offered factor among `totp`, `phone_code` and
 *   `email_code`; none of those is `unsupported`. The device check takes `email_code` or `phone_code`. Email links,
 *   OAuth, passkeys and sign-up are never prepared or offered.
 * - **Errors** map by Clerk's error code to one line (`classifySignInError`); Clerk's own messages are never shown. A
 *   wrong code or password keeps the step and clears the field (`clearField`).
 * - **Telemetry** (section 15): one `auth.native.signin` per flow (one sign-in screen visit), `ok` on completion,
 *   otherwise the flow's last result (or `cancelled`) when the screen is left (`signInFlowPayload`, `ended`).
 */

export type SignInStep = 'email' | 'code' | 'password' | 'second' | 'unsupported' | 'done';

/** The error lines of section 6.3 (`caregiver.account.errors.*`), and `offline`: `learner.welcome.grownUps.needsInternet`. */
export type SignInLine = 'wrongCode' | 'codeExpired' | 'wrongPassword' | 'cantSignIn' | 'tooMany' | 'generic' | 'offline';

export type SignInFlowResult = (typeof NATIVE_SIGNIN_RESULTS)[number];

/** The first factor of the flow's last attempt (`none` before one). */
export type SignInMethod = 'none' | 'email_code' | 'password';

/** A second step's factor, as Clerk names it. */
export type SecondStrategy = 'totp' | 'phone_code' | 'email_code';

/** A factor as Clerk lists it (`supportedFirstFactors`, `supportedSecondFactors`): only the parts read here. */
export interface ClerkFactorView {
  strategy: string;
  emailAddressId?: string;
  phoneNumberId?: string;
}

/** Clerk's `SignInResource`, as far as the step machine reads it. */
export interface ClerkSignInView {
  status: string | null;
  supportedFirstFactors: readonly ClerkFactorView[] | null;
  supportedSecondFactors: readonly ClerkFactorView[] | null;
  clientTrustState?: string | null;
  createdSessionId: string | null;
}

/** The calls the step machine makes to Clerk (the screen binds them to `useSignIn()`'s `signIn` and `setActive`). */
export interface SignInPort {
  create: (identifier: string) => Promise<ClerkSignInView>;
  prepareFirstFactor: (params: { strategy: 'email_code'; emailAddressId: string }) => Promise<ClerkSignInView>;
  attemptFirstFactor: (params: { strategy: 'email_code'; code: string } | { strategy: 'password'; password: string }) => Promise<ClerkSignInView>;
  prepareSecondFactor: (params: { strategy: 'email_code'; emailAddressId?: string } | { strategy: 'phone_code'; phoneNumberId?: string }) => Promise<ClerkSignInView>;
  attemptSecondFactor: (params: { strategy: SecondStrategy | 'backup_code'; code: string }) => Promise<ClerkSignInView>;
  setActive: (sessionId: string) => Promise<void>;
}

/** What the account offers as a first factor (read from `create`'s answer). */
export interface FirstFactors {
  /** The email address id of the `email_code` factor, or null when the account has no email code. */
  emailAddressId: string | null;
  password: boolean;
}

export interface SecondStep {
  /** `second`: the account's second factor; `device`: Clerk's new-device check. */
  kind: 'second' | 'device';
  strategy: SecondStrategy;
  /** The email address or phone number id the code was sent to (`email_code`, `phone_code`), else null. */
  factorId: string | null;
  /** The account offers `backup_code`: **Use a backup code** shows (until it is chosen). */
  backupOffered: boolean;
  /** **Use a backup code** was chosen: a plain field, named by its visible label (D4). */
  usingBackup: boolean;
}

/** The proof the completed sign-in used, for the trust record's re-trust rule (section 7.3). */
export interface SignInProof {
  method: 'email_code' | 'password';
  /** The second factor the flow completed, or null (the device check is not a second factor). */
  second: SecondStrategy | 'backup_code' | null;
  /** The account has a password (an account with the email code only re-trusts with it, R-1). */
  hasPassword: boolean;
}

export interface SignInFlow {
  method: SignInMethod;
  /** The flow's last result, null before one. */
  result: SignInFlowResult | null;
  /** A second step or a new-device check was asked. */
  second: boolean;
  /** The flow's one event was sent. */
  ended: boolean;
}

export interface SignInState {
  step: SignInStep;
  /** The email the flow identified with (kept by Use another email). */
  email: string;
  factors: FirstFactors;
  second: SecondStep | null;
  /** A Clerk call is out: the step's submit is busy, every button but Back waits (D2). */
  busy: boolean;
  /** The error line under the field, or null. */
  line: SignInLine | null;
  /** Bumped when the step's field is to be cleared and focused (a wrong code or password, a new code, a new step). */
  clearField: number;
  /** A re-trust is pending on this device (D21, section 7.3): Continue opens the password step first when it can. */
  retrustPending: boolean;
  /** The second factor the flow completed (for the re-trust rule), null until one. */
  secondDone: SecondStrategy | 'backup_code' | null;
  flow: SignInFlow;
}

export type SignInEvent =
  | { type: 'start' }
  | { type: 'attempt'; method: 'email_code' | 'password' }
  | { type: 'to_code'; email: string; factors: FirstFactors }
  | { type: 'to_password'; email: string; factors: FirstFactors }
  | { type: 'to_second'; second: SecondStep }
  | { type: 'code_sent' }
  | { type: 'unsupported' }
  | { type: 'failed'; line: SignInLine; result: SignInFlowResult; clear: boolean }
  | { type: 'use_password' }
  | { type: 'use_backup' }
  | { type: 'change_email' }
  | { type: 'second_done'; strategy: SecondStrategy | 'backup_code' }
  | { type: 'done' }
  | { type: 'ended' };

const NO_FACTORS: FirstFactors = { emailAddressId: null, password: false };

export function initialSignInState(retrustPending: boolean): SignInState {
  return {
    step: 'email',
    email: '',
    factors: NO_FACTORS,
    second: null,
    busy: false,
    line: null,
    clearField: 0,
    retrustPending,
    secondDone: null,
    flow: { method: 'none', result: null, second: false, ended: false },
  };
}

/** D1: Continue waits for an @ in the field; a malformed address goes to Clerk and comes back as `cantSignIn`. */
export function emailReady(email: string): boolean {
  return email.includes('@');
}

/** The first factors of `create`'s answer: the email code (with its address id) and the password. */
export function firstFactorsOf(view: ClerkSignInView): FirstFactors {
  const factors = view.supportedFirstFactors ?? [];
  const code = factors.find((f) => f.strategy === 'email_code' && typeof f.emailAddressId === 'string' && f.emailAddressId !== '');
  return { emailAddressId: code?.emailAddressId ?? null, password: factors.some((f) => f.strategy === 'password') };
}

const SECOND_STRATEGIES: readonly SecondStrategy[] = ['totp', 'phone_code', 'email_code'];
const DEVICE_STRATEGIES: readonly SecondStrategy[] = ['email_code', 'phone_code'];

/**
 * The second step an answer asks for, or null when it asks for none this app has. `needs_client_trust` (or
 * `needs_second_factor` with `clientTrustState: 'new'` and an emailed code) is the new-device check.
 */
export function secondStepOf(view: ClerkSignInView): SecondStep | null {
  const factors = view.supportedSecondFactors ?? [];
  const backupOffered = factors.some((f) => f.strategy === 'backup_code');
  const deviceStatus = view.status === 'needs_client_trust';
  const allowed = deviceStatus ? DEVICE_STRATEGIES : SECOND_STRATEGIES;
  const factor = factors.find((f) => (allowed as readonly string[]).includes(f.strategy));
  if (factor === undefined) return null;
  const strategy = factor.strategy as SecondStrategy;
  const factorId = strategy === 'email_code' ? (factor.emailAddressId ?? null) : strategy === 'phone_code' ? (factor.phoneNumberId ?? null) : null;
  const device = deviceStatus || (view.clientTrustState === 'new' && strategy === 'email_code');
  return { kind: device ? 'device' : 'second', strategy, factorId, backupOffered, usingBackup: false };
}

/** Whether the second step's code was sent to the grown-up (so **Send a new code** shows and prepares it again). */
export function secondCodeSent(second: SecondStep): boolean {
  return !second.usingBackup && second.strategy !== 'totp';
}

/**
 * Section 6.3's error table. `identify`: the email step, where any refusal of the identifier is `cantSignIn`.
 *
 * | Clerk answer                                          | Line            | `result`         |
 * | `form_code_incorrect`                                 | `wrongCode`     | `wrong_code`     |
 * | `verification_expired`                                | `codeExpired`   | `expired`        |
 * | `form_password_incorrect`                             | `wrongPassword` | `wrong_password` |
 * | `form_identifier_not_found`, any refusal of the email | `cantSignIn`    | `refused`        |
 * | HTTP 429, `too_many_requests`, `user_locked`          | `tooMany`       | `too_many`       |
 * | a network failure (`network_error`, a fetch failure)  | `offline`       | `offline`        |
 * | anything else                                         | `generic`       | `error`          |
 */
export function classifySignInError(error: unknown, phase: 'identify' | 'other'): { line: SignInLine; result: SignInFlowResult } {
  const e = (typeof error === 'object' && error !== null ? error : {}) as { code?: unknown; status?: unknown; errors?: unknown; message?: unknown; clerkError?: unknown };
  if (e.code === 'network_error' || (error instanceof TypeError && /network/i.test(String(e.message)))) return { line: 'offline', result: 'offline' };
  const codes = Array.isArray(e.errors) ? e.errors.map((x) => (typeof x === 'object' && x !== null ? (x as { code?: unknown }).code : undefined)).filter((c): c is string => typeof c === 'string') : [];
  const status = typeof e.status === 'number' ? e.status : null;
  if (status === 429 || codes.includes('too_many_requests') || codes.includes('user_locked')) return { line: 'tooMany', result: 'too_many' };
  if (codes.includes('form_code_incorrect')) return { line: 'wrongCode', result: 'wrong_code' };
  if (codes.includes('verification_expired')) return { line: 'codeExpired', result: 'expired' };
  if (codes.includes('form_password_incorrect')) return { line: 'wrongPassword', result: 'wrong_password' };
  if (codes.includes('form_identifier_not_found')) return { line: 'cantSignIn', result: 'refused' };
  const refusal = codes.length > 0 || (status !== null && status >= 400 && status < 500);
  if (phase === 'identify' && refusal) return { line: 'cantSignIn', result: 'refused' };
  return { line: 'generic', result: 'error' };
}

function failure(error: unknown, phase: 'identify' | 'other'): SignInEvent {
  const { line, result } = classifySignInError(error, phase);
  return { type: 'failed', line, result, clear: result === 'wrong_code' || result === 'wrong_password' };
}

/** A completed attempt: activate the session, or move to the step Clerk asks for (preparing a sent code first). */
async function afterAttempt(port: SignInPort, view: ClerkSignInView): Promise<SignInEvent> {
  if (view.status === 'complete') {
    if (view.createdSessionId === null || view.createdSessionId === '') return { type: 'failed', line: 'generic', result: 'error', clear: false };
    try {
      await port.setActive(view.createdSessionId);
    } catch (error) {
      return failure(error, 'other');
    }
    return { type: 'done' };
  }
  if (view.status !== 'needs_second_factor' && view.status !== 'needs_client_trust') return { type: 'unsupported' };
  const second = secondStepOf(view);
  if (second === null) return { type: 'unsupported' };
  if (second.strategy !== 'totp') {
    try {
      await prepareSecond(port, second);
    } catch (error) {
      return failure(error, 'other');
    }
  }
  return { type: 'to_second', second };
}

function prepareSecond(port: SignInPort, second: SecondStep): Promise<ClerkSignInView> {
  if (second.strategy === 'email_code') return port.prepareSecondFactor(second.factorId === null ? { strategy: 'email_code' } : { strategy: 'email_code', emailAddressId: second.factorId });
  return port.prepareSecondFactor(second.factorId === null ? { strategy: 'phone_code' } : { strategy: 'phone_code', phoneNumberId: second.factorId });
}

/** The email step's Continue: `create`, then the first step the account offers (section 6.3, D21). */
export async function submitEmail(port: SignInPort, email: string, retrustPending: boolean): Promise<SignInEvent> {
  const identifier = email.trim();
  let view: ClerkSignInView;
  try {
    view = await port.create(identifier);
  } catch (error) {
    return failure(error, 'identify');
  }
  if (view.status !== 'needs_first_factor') return { type: 'unsupported' };
  const factors = firstFactorsOf(view);
  // D21: while a re-trust is pending, a code cannot re-trust an account that has a password: the password step first.
  if (factors.emailAddressId !== null && !(retrustPending && factors.password)) {
    try {
      await port.prepareFirstFactor({ strategy: 'email_code', emailAddressId: factors.emailAddressId });
    } catch (error) {
      return failure(error, 'other');
    }
    return { type: 'to_code', email: identifier, factors };
  }
  if (factors.password) return { type: 'to_password', email: identifier, factors };
  return { type: 'unsupported' };
}

/** Sign in on the code step. */
export async function submitCode(port: SignInPort, code: string): Promise<SignInEvent> {
  try {
    return await afterAttempt(port, await port.attemptFirstFactor({ strategy: 'email_code', code: code.trim() }));
  } catch (error) {
    return failure(error, 'other');
  }
}

/** Sign in on the password step (the password is passed as typed). */
export async function submitPassword(port: SignInPort, password: string): Promise<SignInEvent> {
  try {
    return await afterAttempt(port, await port.attemptFirstFactor({ strategy: 'password', password }));
  } catch (error) {
    return failure(error, 'other');
  }
}

/** Sign in on the second step: its strategy, or `backup_code` once chosen. Resolves to every event, in order. */
export async function submitSecond(port: SignInPort, second: SecondStep, code: string): Promise<SignInEvent[]> {
  const strategy = second.usingBackup ? 'backup_code' : second.strategy;
  let view: ClerkSignInView;
  try {
    view = await port.attemptSecondFactor({ strategy, code: code.trim() });
  } catch (error) {
    return [failure(error, 'other')];
  }
  const next = await afterAttempt(port, view);
  // The device check is Clerk's, not a second factor of the account: it never counts for the re-trust rule.
  return second.kind === 'second' && next.type === 'done' ? [{ type: 'second_done', strategy }, next] : [next];
}

/** **Send a new code**: the code step's email code, or the second step's sent code, prepared again. */
export async function resendCode(port: SignInPort, state: SignInState): Promise<SignInEvent> {
  const generic: SignInEvent = { type: 'failed', line: 'generic', result: 'error', clear: false };
  try {
    if (state.step === 'second') {
      // Only a code that was sent can be sent again (an authenticator's code or a backup code never is).
      if (state.second === null || !secondCodeSent(state.second)) return generic;
      await prepareSecond(port, state.second);
    } else if (state.step === 'code' && state.factors.emailAddressId !== null) {
      await port.prepareFirstFactor({ strategy: 'email_code', emailAddressId: state.factors.emailAddressId });
    } else return generic;
  } catch (error) {
    return failure(error, 'other');
  }
  return { type: 'code_sent' };
}

/** **Email me a code** on the password step: the email code prepared, then the code step. */
export async function switchToCode(port: SignInPort, state: SignInState): Promise<SignInEvent> {
  if (state.factors.emailAddressId === null) return { type: 'failed', line: 'generic', result: 'error', clear: false };
  try {
    await port.prepareFirstFactor({ strategy: 'email_code', emailAddressId: state.factors.emailAddressId });
  } catch (error) {
    return failure(error, 'other');
  }
  return { type: 'to_code', email: state.email, factors: state.factors };
}

export function signInReducer(state: SignInState, event: SignInEvent): SignInState {
  switch (event.type) {
    case 'start':
      return { ...state, busy: true, line: null };
    case 'attempt':
      return { ...state, flow: { ...state.flow, method: event.method } };
    case 'to_code':
      return { ...state, step: 'code', email: event.email, factors: event.factors, second: null, busy: false, line: null, clearField: state.clearField + 1 };
    case 'to_password':
      return { ...state, step: 'password', email: event.email, factors: event.factors, second: null, busy: false, line: null, clearField: state.clearField + 1 };
    case 'to_second':
      return { ...state, step: 'second', second: event.second, busy: false, line: null, clearField: state.clearField + 1, flow: { ...state.flow, second: true } };
    case 'code_sent':
      return { ...state, busy: false, line: null, clearField: state.clearField + 1 };
    case 'unsupported':
      return { ...state, step: 'unsupported', second: null, busy: false, line: null, flow: { ...state.flow, result: 'unsupported' } };
    case 'failed':
      return { ...state, busy: false, line: event.line, clearField: event.clear ? state.clearField + 1 : state.clearField, flow: { ...state.flow, result: event.result } };
    case 'use_password':
      return state.factors.password && (state.step === 'code' || state.step === 'email') ? { ...state, step: 'password', line: null, clearField: state.clearField + 1 } : state;
    case 'use_backup':
      return state.step === 'second' && state.second !== null && state.second.backupOffered && !state.second.usingBackup
        ? { ...state, second: { ...state.second, usingBackup: true }, line: null, clearField: state.clearField + 1 }
        : state;
    case 'change_email':
      return { ...state, step: 'email', factors: NO_FACTORS, second: null, secondDone: null, busy: false, line: null, clearField: state.clearField + 1 };
    case 'second_done':
      return { ...state, secondDone: event.strategy };
    case 'done':
      return { ...state, step: 'done', busy: false, line: null, flow: { ...state.flow, result: 'ok' } };
    case 'ended':
      return { ...state, flow: { ...state.flow, ended: true } };
  }
}

/** The proof of a completed flow (section 7.3), or null before completion. */
export function signInProof(state: SignInState): SignInProof | null {
  if (state.step !== 'done' || state.flow.method === 'none') return null;
  return { method: state.flow.method, second: state.secondDone, hasPassword: state.factors.password };
}

export interface SignInFlowPayload {
  os: 'ios' | 'android';
  method: SignInMethod;
  result: SignInFlowResult;
  second: boolean;
}

/**
 * Section 15: the flow's one `auth.native.signin` payload, or null once it was sent. `ok` when the flow completed;
 * otherwise (the screen is left) its last result, or `cancelled` when it had none.
 */
export function signInFlowPayload(state: SignInState, os: 'ios' | 'android'): SignInFlowPayload | null {
  if (state.flow.ended) return null;
  return { os, method: state.flow.method, result: state.flow.result ?? 'cancelled', second: state.flow.second };
}
