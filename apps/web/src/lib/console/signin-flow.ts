import {
  APP_ROUTES,
  homeFor,
  personaHint,
  personasFor,
  safeNextPath,
  type AdultPersona,
  type SpaceKind,
  type SpaceRole,
} from '@hangul-route/content-schema';
import type { GrownUpUnlock } from '@hangul-route/content-schema';
import { decideGrownUpLock, trustableEpoch, type DeviceGateRead } from './grown-up-lock';
import { RESET_LEG_FACTORS, isResetLeg, pinOwnerAtSignIn, pinOwnerFingerprint, pinOwnerRecord } from './one-account';
import { isKnownSpaceKind } from './routing';
import { writePinOwner, writeTrustedEpoch } from './shell-store';
import type { SignInProof, SignInRecord } from './signin-record';
import { readUnlock, writeSignInUnlock } from './unlock';

/**
 * Grown-up sign-in and routing on the app host (F-APP-001 A-4b; sections 3.5, 3.7, 3.9, 3.11,
 * 3.19; wireframe design/wireframes/shell/signin.md, mock design/screens/app-shell/signin.md).
 * Pure decisions for `/signin`, the `/teach` router and the shared grown-up layout; the pages
 * wire them to Clerk, the API and the browser.
 */

/** How long a sign-in record stays good: the router reads it right after Clerk's redirect. */
export const SIGNIN_PROOF_MS = 10 * 60_000;

/** Clerk's script still loading after this long counts as unreachable (section 3.19). */
export const CLERK_LOAD_TIMEOUT_MS = 15_000;

/**
 * First factors that ask for a secret (section 3.9): a password, an email or SMS code (also the
 * codes of a password reset), a passkey. OAuth and SSO (`oauth_*`, `enterprise_sso`, `saml`),
 * Google One Tap, sign-in tickets and email links do not count on their own.
 */
const SECRET_FIRST_FACTORS: ReadonlySet<string> = new Set(['password', 'email_code', 'phone_code', 'passkey', 'reset_password_email_code', 'reset_password_phone_code']);

export function isSecretFactor(strategy: string | null | undefined): boolean {
  return typeof strategy === 'string' && SECRET_FIRST_FACTORS.has(strategy);
}

/** OAuth or SSO: the first factor finishes on another site and comes back by redirect. */
function isRedirectFactor(strategy: string | null | undefined): boolean {
  return typeof strategy === 'string' && (strategy.startsWith('oauth_') || strategy === 'enterprise_sso' || strategy === 'saml');
}

/** The parts of Clerk's resources these decisions read (structural, so the SDK stays out of tests). */
export interface VerificationLike {
  strategy?: string | null;
  status?: string | null;
  externalVerificationRedirectURL?: unknown;
}

export interface ClerkSignInLike {
  status?: string | null;
  createdSessionId?: string | null;
  firstFactorVerification?: VerificationLike | null;
}

export interface ClerkSignUpLike {
  status?: string | null;
  createdSessionId?: string | null;
  verifications?: { externalAccount?: VerificationLike | null; emailAddress?: VerificationLike | null; phoneNumber?: VerificationLike | null } | null;
}

/** A completed sign-in: the session it created and whether its first factor asked for a secret. */
export function proofFromSignIn(signIn: ClerkSignInLike | null | undefined): SignInProof | null {
  if (!signIn || signIn.status !== 'complete' || !signIn.createdSessionId) return null;
  const strategy = signIn.firstFactorVerification?.strategy;
  // [OA] The secret factor itself rides along: a passkey stays a passkey (sections 7.2 and 7.4).
  return isSecretFactor(strategy) ? { sessionId: signIn.createdSessionId, secret: true, factor: strategy as string } : { sessionId: signIn.createdSessionId, secret: false };
}

/** Sign-up verifications that ask for a secret: a code sent to the address or the number (never an email link). */
const SECRET_SIGN_UP_CODES: ReadonlySet<string> = new Set(['email_code', 'phone_code']);

const verifiedWith = (verification: VerificationLike | null | undefined, strategies: ReadonlySet<string>): boolean =>
  verification?.status === 'verified' && typeof verification.strategy === 'string' && strategies.has(verification.strategy);

/**
 * A sign-up proved a secret: no external account, and its address or number was verified with a code. [OA] Returns
 * that code's strategy (`email_code`, `phone_code`), or null when it proved none.
 */
function signUpSecretFactor(signUp: ClerkSignUpLike): string | null {
  const verifications = signUp.verifications;
  if (verifications?.externalAccount?.status === 'verified') return null;
  for (const verification of [verifications?.emailAddress, verifications?.phoneNumber]) {
    if (verifiedWith(verification, SECRET_SIGN_UP_CODES)) return verification?.strategy as string;
  }
  return null;
}

/**
 * A completed sign-up behind the adult step: an email sign-up that proved its address with a code
 * (a secret); a Google sign-up, an email-link one or one that names no code did not.
 */
export function proofFromSignUp(signUp: ClerkSignUpLike | null | undefined): SignInProof | null {
  if (!signUp || signUp.status !== 'complete' || !signUp.createdSessionId) return null;
  const factor = signUpSecretFactor(signUp);
  return factor ? { sessionId: signUp.createdSessionId, secret: true, factor } : { sessionId: signUp.createdSessionId, secret: false };
}

/**
 * While the tab is still signed out, the widget verified a secret factor: a sign-in whose first
 * factor is verified with a secret strategy (a password, a code, a passkey; also when a second
 * factor still follows), or a sign-up whose address was verified with a code. Positive evidence
 * only: an attempt that has not verified yet does not count.
 */
export function secretVerifiedHere(signIn: ClerkSignInLike | null | undefined, signUp: ClerkSignUpLike | null | undefined): boolean {
  return secretFactorVerifiedHere(signIn, signUp) !== null;
}

/** [OA] The secret factor `secretVerifiedHere` saw verified (a passkey stays a passkey), or null. */
export function secretFactorVerifiedHere(signIn: ClerkSignInLike | null | undefined, signUp: ClerkSignUpLike | null | undefined): string | null {
  const first = signIn?.firstFactorVerification;
  if (verifiedWith(first, SECRET_FIRST_FACTORS)) return first?.strategy as string;
  return signUp ? signUpSecretFactor(signUp) : null;
}

/** An OAuth or SSO first factor is waiting for its redirect: the sign-in is leaving this window. */
export function oauthRedirectStarted(signIn: ClerkSignInLike | null | undefined): boolean {
  const verification = signIn?.firstFactorVerification;
  if (!signIn || signIn.status === 'complete' || !verification) return false;
  return isRedirectFactor(verification.strategy) && verification.status !== 'verified' && !!verification.externalVerificationRedirectURL;
}

/** A Google or SSO sign-up is leaving this window for its provider (the adult step's `<SignUp>`). */
export function oauthSignUpStarted(signUp: ClerkSignUpLike | null | undefined): boolean {
  const verification = signUp?.verifications?.externalAccount;
  if (!signUp || signUp.status === 'complete' || !verification) return false;
  return verification.status !== 'verified' && !!verification.externalVerificationRedirectURL;
}

const isFresh = (at: number, now: number): boolean => now - at >= 0 && now - at < SIGNIN_PROOF_MS;

/**
 * The page saw this tab go from signed out to signed in: a sign-in (or sign-up) completed here.
 * `previous` is `undefined` until Clerk has loaded (unknown), `null` while signed out.
 */
export function signedInHere(previous: string | null | undefined, current: string | null | undefined): current is string {
  return previous === null && typeof current === 'string' && current !== '';
}

/**
 * The proof of a sign-in this page saw complete for `sessionId`. Clerk's completed sign-in (or
 * sign-up) names its first factor when the client still holds it; otherwise only a secret factor
 * the widget verified in this tab before the session appeared (a `secret` record) counts. Anything
 * else (an OAuth hand-off, a session from another tab, an email link, a ticket, no evidence at
 * all) is not secret-proving: unknown errs to OAuth, which on a lockable device only asks for a
 * reverification (sections 3.7 and 3.17).
 */
export function proofAtSignIn(input: { sessionId: string; signIn?: ClerkSignInLike | null; signUp?: ClerkSignUpLike | null; record: SignInRecord | null; now: number }): SignInProof {
  const exact = [proofFromSignIn(input.signIn), proofFromSignUp(input.signUp)].find((proof) => proof?.sessionId === input.sessionId);
  if (exact) return exact;
  const record = input.record;
  if (record?.kind !== 'secret' || !isFresh(record.at, input.now)) return { sessionId: input.sessionId, secret: false };
  return record.factor ? { sessionId: input.sessionId, secret: true, factor: record.factor } : { sessionId: input.sessionId, secret: true };
}

/**
 * "Finish signing in here with an email code" (section 3.19, OD-15): an installed PWA, still signed
 * out, after an OAuth hand-off left this window (it may have finished in Safari instead).
 */
export function showStandaloneFinish(input: { standalone: boolean; signedIn: boolean; record: SignInRecord | null; now: number }): boolean {
  const { standalone, signedIn, record, now } = input;
  return standalone && !signedIn && record?.kind === 'oauth' && isFresh(record.at, now);
}

/** Whether the grown-up lock can close on this device: the decision table with no unlock and no trusted epoch. */
export function deviceCanLock(device: DeviceGateRead): boolean {
  return decideGrownUpLock({ device, unlock: null, trustedEpoch: null, now: 0 }).state === 'locked';
}

export type AfterSignIn = 'unlock' | 'reverify' | 'none';

/**
 * [OA] The browser may be a `pin` browser (section 7.4, CS-17): its marker is `pin`, its read failed, or it holds learner
 * profiles with no marker (a learner app older than A-6, which may hold a PIN). The same states hide the lock's Use a
 * passkey (`passkeyButtonShown`), so the button and the sign-in rule fail closed together.
 */
export function mayBePinBrowser(device: DeviceGateRead): boolean {
  if (!device.readable) return device.reason === 'failed';
  return device.marker?.gate === 'pin' || (device.marker === null && device.hasProfiles);
}

/**
 * [OA] Whether a secret sign-in counts as the grown-up unlock here (AMENDMENTS-ONE-ACCOUNT-MANY-USERS section 7.4,
 * OA-D10, OQ-21, CS-17). On a browser that may be a `pin` browser (`mayBePinBrowser`: the marker is `pin`, the read
 * failed, or profiles with no marker), a passkey does not count: a platform authenticator may fall back to the device passcode, in a child's reach; the sign-in completes and
 * the lock asks for the PIN or another factor. There only a factor Clerk named as a password or a code counts: an
 * absent or unknown factor (a record from an earlier build, a factor this bundle does not know) fails closed. On the
 * reset leg (`next` = `/account/pin-reset`) only a password, a code or a Clerk password-reset code counts, on every
 * browser.
 */
export function isSecretProvingSignIn(input: { factor: string | null | undefined; device: DeviceGateRead; resetLeg: boolean }): boolean {
  const { factor, device, resetLeg } = input;
  if (resetLeg || mayBePinBrowser(device)) return typeof factor === 'string' && RESET_LEG_FACTORS.has(factor);
  // Every other browser: any secret factor, a passkey included (F-APP-001 section 3.9).
  return true;
}

/**
 * What a sign-in completed in this tab earns (section 3.9). A secret-proving sign-in writes the
 * unlock (and the trusted epoch). An OAuth or SSO sign-in does not count on its own: on a device
 * the lock can close, Clerk reverification runs first; on any other device nothing more is asked.
 * A visitor who arrived already signed in (no record for this session) earns nothing: the lock
 * decides on the page. A fresh OAuth hand-off record, or a secret-attempt record the page never
 * turned into a proof for this session, counts as an OAuth sign-in (fail closed).
 */
export function planAfterSignIn(input: { record: SignInRecord | null; sessionId: string | null; device: DeviceGateRead; now: number; next?: string | null }): AfterSignIn {
  const { record, sessionId, device, now } = input;
  if (!sessionId || !record || !isFresh(record.at, now)) return 'none';
  // An OAuth hand-off from this tab whose completion the page did not see (Clerk finished it
  // before the page watched): it proved no secret.
  if (record.kind === 'proof' && record.sessionId !== sessionId) return 'none';
  // [OA] A passkey on a `pin` browser, or a factor the reset leg does not take, signs in but unlocks nothing: the
  // lock (or the reset page) decides, with no reverification that could be a passkey again. A secret whose factor is
  // not named on a `pin` browser asks for the reverification (which refuses a passkey) instead of opening.
  if (record.kind === 'proof' && record.secret) {
    const resetLeg = isResetLeg(input.next);
    if (isSecretProvingSignIn({ factor: record.factor, device, resetLeg })) return 'unlock';
    if (resetLeg || record.factor === 'passkey') return 'none';
    // Only a browser that may be a `pin` one gets here, and the lock can close on each of them.
    return 'reverify';
  }
  return deviceCanLock(device) ? 'reverify' : 'none';
}

export interface UnlockWriters {
  writeUnlock: (now: number) => boolean;
  writeEpoch: (epoch: number | null) => Promise<boolean>;
  /** [OA] This tab's unlock before the sign-in writes its own (moment 1 of section 7.2). */
  readUnlock?: () => GrownUpUnlock | null;
  /** [OA] Records `accountId` (fingerprinted) as the PIN owner of `epoch`. */
  writePinOwner?: (accountId: string, epoch: number) => Promise<boolean>;
}

/** [OA] Fingerprints the account id and writes `pinOwner`; false when either step fails. */
export async function recordPinOwner(accountId: string, epoch: number): Promise<boolean> {
  const record = pinOwnerRecord(await pinOwnerFingerprint(accountId), epoch);
  return record ? writePinOwner(record) : false;
}

const BROWSER_WRITERS: UnlockWriters = {
  writeUnlock: (now) => writeSignInUnlock(now),
  writeEpoch: (epoch) => writeTrustedEpoch(epoch),
  readUnlock: () => readUnlock(),
  writePinOwner: recordPinOwner,
};

/**
 * [OA] What the grant knows of the sign-in: its secret factor (null after a reverification, whose factor Clerk does not
 * name), whether it is the reset leg, and the account that signed in.
 */
export interface GrantContext {
  factor?: string | null;
  resetLeg?: boolean;
  accountId?: string | null;
}

/**
 * After a secret-proving sign-in (or a reverification): the `signin` unlock of this tab, and the
 * marker's epoch as the trusted one (`trustableEpoch`: a real `pin` epoch, otherwise none, which
 * forgets an earlier one). A device that could not be read leaves the trusted epoch as it was.
 *
 * [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS section 7.2: the earlier unlock of this tab is read first; a password or a
 * code right after a fresh PIN for the marker's epoch names this account the PIN owner (moment 1). The reset leg
 * (`next` = `/account/pin-reset`) writes the unlock only: no trusted epoch and no owner.
 */
export async function grantSignInUnlock(device: DeviceGateRead, now: number, writers: UnlockWriters = BROWSER_WRITERS, context: GrantContext = {}): Promise<void> {
  const earlier = writers.readUnlock ? writers.readUnlock() : null;
  writers.writeUnlock(now);
  const resetLeg = context.resetLeg === true;
  if (resetLeg) return;
  if (device.readable) await writers.writeEpoch(trustableEpoch(device.marker));
  const epoch = pinOwnerAtSignIn({ earlier, device, factor: context.factor, resetLeg, now });
  if (epoch !== null && context.accountId && writers.writePinOwner) await writers.writePinOwner(context.accountId, epoch);
}

/** Personas from the account's spaces (`GET /api/spaces`), Family first; unknown kinds ignored. */
export function personasOfSpaces(items: readonly { space: { kind: SpaceKind }; role: SpaceRole }[]): AdultPersona[] {
  return personasFor(items.filter((item) => isKnownSpaceKind(item.space.kind)).map((item) => ({ kind: item.space.kind, role: item.role })));
}

const SIGN_IN_PATH = /^\/signin(?:[/?.#]|$)/;

/** A `next` the router may follow: `safeNextPath` accepts it and it is not the sign-in page itself (no loop). */
export function acceptedNext(raw: string | null | undefined): string | null {
  const next = safeNextPath(raw);
  return next && !SIGN_IN_PATH.test(next) ? next : null;
}

/**
 * Where the router sends a signed-in grown-up (sections 3.5, 3.7): an accepted `next`, else the
 * persona home (`homeFor`: no persona → `/start` with the hint; a hint; the last persona; the only
 * persona; else Family, OD-11). Family is `/parent`, the real family home since F-APP-001 A-5b.
 */
export function routerDestination(input: { next: string | null | undefined; personas: readonly AdultPersona[]; last: AdultPersona | null; hint: AdultPersona | null }): string {
  return acceptedNext(input.next) ?? homeFor({ personas: input.personas, last: input.last, hint: input.hint });
}

const TEACH_ROUTER = /^\/teach(?:\/|\.html)?$/;

function pathWithQuery(pathname: string, search: string): string {
  const query = search.startsWith('?') ? search.slice(1) : search;
  return query ? `${pathname}?${query}` : pathname;
}

function signInUrl(query: URLSearchParams): string {
  const text = query.toString();
  return text ? `${APP_ROUTES.signIn}?${text}` : APP_ROUTES.signIn;
}

/**
 * A signed-out visitor on a grown-up page goes to `/signin?next=<path and query>` (section 3.7).
 * The `/teach` router carries its persona hint and a `next` only when the URL has a query (old
 * `/teach` bookmarks were the sign-in of every grown-up). `?lang=` rides along, so `/signin` opens
 * in the language the link asked for.
 */
export function signedOutTarget(pathname: string, search: string): string {
  const params = new URLSearchParams(search);
  const query = new URLSearchParams();
  const hasQuery = params.toString() !== '';
  if (TEACH_ROUTER.test(pathname)) {
    const hint = personaHint(params);
    if (hint) query.set('persona', hint);
  }
  const lang = params.get('lang');
  if (lang) query.set('lang', lang);
  const next = TEACH_ROUTER.test(pathname) && !hasQuery ? null : safeNextPath(pathWithQuery(pathname, search));
  if (next) query.set('next', next);
  return signInUrl(query);
}

/** The `/signin` query keys that travel between its views and through Clerk's redirect. */
const KEPT_KEYS = ['persona', 'as', 'next', 'lang'] as const;

function keptQuery(params: { get(name: string): string | null }): URLSearchParams {
  const query = new URLSearchParams();
  for (const key of KEPT_KEYS) {
    const value = params.get(key);
    if (value) query.set(key, value);
  }
  return query;
}

/** Where Clerk returns after a sign-in or a sign-up: the router on `/signin`, hint, next and lang kept (never `mode`). */
export function signInReturnUrl(params: { get(name: string): string | null }): string {
  return signInUrl(keptQuery(params));
}

/** `/signin?mode=create` (the adult step) and back, with the same keys. */
export function createModeUrl(params: { get(name: string): string | null }, create: boolean): string {
  const kept = keptQuery(params);
  if (!create) return signInUrl(kept);
  const query = new URLSearchParams({ mode: 'create' });
  kept.forEach((value, key) => query.set(key, value));
  return signInUrl(query);
}

interface DisplayWindow {
  matchMedia?: (query: string) => { matches: boolean };
  /** iOS Safari's own flag; absent from the DOM typings. */
  navigator?: object;
}

/** An installed PWA (`display-mode: standalone`, or iOS `navigator.standalone`), where an OAuth redirect may finish in Safari. */
export function isStandaloneDisplay(win: DisplayWindow | null | undefined): boolean {
  try {
    if (!win) return false;
    if (win.matchMedia?.('(display-mode: standalone)').matches) return true;
    return (win.navigator as { standalone?: unknown } | undefined)?.standalone === true;
  } catch {
    return false;
  }
}

/** Clerk's script failed, or is still loading after `CLERK_LOAD_TIMEOUT_MS` (section 3.19). */
export function clerkUnreachable(input: { status: string | undefined; loaded: boolean; waitedMs: number }): boolean {
  if (input.status === 'error') return true;
  return !input.loaded && input.waitedMs >= CLERK_LOAD_TIMEOUT_MS;
}

/** First-factor reverification (section 3.9): an email code to the account's address, the password or a passkey. */
export const REVERIFY_CONFIG = { level: 'first_factor', afterMinutes: 10 } as const;

/** Clerk's reverification hint (the shape `useReverification` reacts to). */
export interface ReverifyHint {
  clerk_error: { type: 'forbidden'; reason: 'reverification-error'; metadata: { reverification: typeof REVERIFY_CONFIG } };
}

/**
 * The fetcher handed to Clerk's `useReverification`: the first call asks for reverification
 * whatever the session's age (an OAuth sign-in is fresh, but proved no secret), Clerk opens its
 * dialog, and the retry after it succeeds reports `verified`.
 */
export function reverifyOnce(): () => Promise<ReverifyHint | { verified: true }> {
  let asked = false;
  return async () => {
    if (asked) return { verified: true };
    asked = true;
    return { clerk_error: { type: 'forbidden', reason: 'reverification-error', metadata: { reverification: REVERIFY_CONFIG } } };
  };
}

/** The read's value, or `fallback` when it throws, rejects or takes longer than `ms` (WebKit can hang an IndexedDB open). */
export function withTimeout<T>(read: () => Promise<T>, fallback: T, ms: number): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    const done = (value: T): void => {
      clearTimeout(timer);
      resolve(value);
    };
    try {
      read().then(done, () => done(fallback));
    } catch {
      done(fallback);
    }
  });
}

/** How long the router waits for the device read before it counts as failed (as the lock does, section 3.9). */
export const DEVICE_READ_TIMEOUT_MS = 3_000;

const FAILED_DEVICE_READ: DeviceGateRead = { readable: false, reason: 'failed' };

/** What the router reads and writes in the browser, injectable for tests. */
export interface SignInIo {
  now: () => number;
  readRecord: () => SignInRecord | null;
  clearRecord: () => void;
  readDevice: () => Promise<DeviceGateRead>;
  grant: (device: DeviceGateRead, now: number, context?: GrantContext) => Promise<void>;
}

/** [OA] Where the sign-in leads (`next`) and who signed in, for the reset-leg and PIN-owner rules. */
export interface SettleContext {
  next?: string | null;
  accountId?: string | null;
}

/**
 * The router's first step for a signed-in visitor: spend the sign-in record of this tab. A secret
 * proof writes the unlock (and the trusted epoch); an OAuth sign-in on a device the lock can close
 * returns `reverify` with the device it read, and the record stays until the reverification ends
 * (Clerk may reload the page meanwhile: the next load asks again instead of opening). Anything
 * else clears the record and asks nothing.
 */
export async function settleSignIn(io: SignInIo, sessionId: string | null, context: SettleContext = {}): Promise<{ reverify: DeviceGateRead } | null> {
  const record = io.readRecord();
  if (!record) return null;
  const device = await withTimeout(io.readDevice, FAILED_DEVICE_READ, DEVICE_READ_TIMEOUT_MS);
  const now = io.now();
  const plan = planAfterSignIn({ record, sessionId, device, now, next: context.next });
  if (plan === 'reverify') return { reverify: device };
  if (plan === 'unlock') {
    // Only a `proof` record plans an unlock; its factor, if Clerk named one.
    const factor = (record as { factor?: string }).factor ?? null;
    await io.grant(device, now, { factor, resetLeg: isResetLeg(context.next), accountId: context.accountId ?? null });
  }
  io.clearRecord();
  return null;
}

/**
 * The reverification ended: a success writes the unlock as a secret-proving sign-in would; either way the record is
 * spent. [OA] Clerk does not name the reverification's factor, so it names no PIN owner, and on the reset leg it
 * writes no trusted epoch.
 */
export async function finishReverify(io: SignInIo, device: DeviceGateRead, verified: boolean, context: SettleContext = {}): Promise<void> {
  if (verified) await io.grant(device, io.now(), { factor: null, resetLeg: isResetLeg(context.next), accountId: context.accountId ?? null });
  io.clearRecord();
}

/** The account's spaces as `GET /api/spaces` returns them, or a failure. */
export type SpacesResult = { ok: true; data: readonly { space: { kind: SpaceKind }; role: SpaceRole }[] } | { ok: false };

export interface RouteIo {
  listSpaces: () => Promise<SpacesResult>;
  readLastPersona: () => Promise<AdultPersona | null>;
}

/** The router's destination, or null when the spaces fetch failed (one line and Try again, never a wrong home). */
export async function resolveDestination(io: RouteIo, input: { next: string | null; hint: AdultPersona | null }): Promise<string | null> {
  let spaces: SpacesResult;
  try {
    spaces = await io.listSpaces();
  } catch {
    return null;
  }
  if (!spaces.ok) return null;
  const last = await withTimeout(io.readLastPersona, null, DEVICE_READ_TIMEOUT_MS);
  return routerDestination({ next: input.next, personas: personasOfSpaces(spaces.data), last, hint: input.hint });
}
