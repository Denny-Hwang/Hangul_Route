import { AccountTrustSchema, GrownUpUseSchema, SpaceKindSchema, SpaceRoleSchema, usesFor, type AccountTrust, type DeviceUses, type GrownUpUse, type SpaceKind, type SpaceRole } from '@hangul-route/content-schema';
import type { NativeGateState } from './gate-state';
import type { SignInProof } from './sign-in-step';

/**
 * F-AUTH-004 sections 6.5, 6.6, 7.3 and 13.1 (row NS-3; ND-9, CS-N3, R-1): what a completed native sign-in writes on
 * the device and what Sign out deletes. Pure; `platform/account-records.ts` reads and writes the keys.
 *
 * - The records are kept **only on a device whose gate state is `pin` with a real epoch** (ND-9): the uses record
 *   `hr:grownup:deviceUses` (`{ v: 1, uses, at }`, no names, no ids) and the trust `hr:grownup:trust` (`{ v: 1, epoch }`).
 *   Anywhere else nothing is written.
 * - **Re-trust** (section 7.3, R-1): when the device holds a trust record for another epoch (or one that cannot be read
 *   or parsed), or the OA-D21 record `account:pinResetByWait` is set, a sign-in writes the new trust only if it used
 *   the password or a second factor of the account. An email code alone signs in but leaves the lock
 *   (`retrustPending`, the `retrust_password` line). An account with no password re-trusts with the code (R-1). As
 *   built, a second factor that is itself an emailed code, and Clerk's new-device check (also an emailed code), do not
 *   count: they prove the same inbox the email code does.
 * - After a re-trust the home shows its notice once (`hr:grownup:retrustNotice`, row NS-5 reads it).
 * - The uses record is written with the trust (never for a sign-in the lock still holds) and only from a spaces answer
 *   that parses; a failed read leaves it to the home's next successful load (section 6.5).
 */

/** The storage wrapper's keys (the wrapper adds `hr:`). Device-level: none ends in a profile id (section 13.1). */
export const DEVICE_USES_RECORD_KEY = 'grownup:deviceUses';
export const TRUST_RECORD_KEY = 'grownup:trust';
export const RETRUST_NOTICE_KEY = 'grownup:retrustNotice';

/** The trust record as read: none, a valid record, or one that could not be read or does not parse. */
export type TrustRead = { kind: 'none' } | { kind: 'trust'; trust: AccountTrust } | { kind: 'damaged' };

/** `hr:grownup:trust` from an exact read (`failed`: the read threw). */
export function trustReadOf(raw: unknown, failed: boolean): TrustRead {
  if (failed) return { kind: 'damaged' };
  if (raw === null || raw === undefined) return { kind: 'none' };
  const parsed = AccountTrustSchema.safeParse(raw);
  return parsed.success ? { kind: 'trust', trust: parsed.data } : { kind: 'damaged' };
}

/** The trust `accountLock` reads: only a valid record is trust; anything else is none (CS-N3). */
export function trustOfRead(read: TrustRead): AccountTrust | null {
  return read.kind === 'trust' ? read.trust : null;
}

/** Whether the device keeps the account's records at all: a `pin` gate state with a real epoch (ND-9, epoch `0` never). */
export function keepsRecords(gate: NativeGateState): gate is { state: 'pin'; epoch: number } {
  return gate.state === 'pin' && gate.epoch > 0;
}

/**
 * Section 7.3, D21: a re-trust is pending on this device: a trust record for another epoch (or one that cannot be
 * read), or `account:pinResetByWait` set. Only on a device that keeps records.
 */
export function retrustPendingFor(gate: NativeGateState, trust: TrustRead, pinResetByWait: boolean): boolean {
  if (!keepsRecords(gate)) return false;
  if (pinResetByWait || trust.kind === 'damaged') return true;
  return trust.kind === 'trust' && trust.trust.epoch !== gate.epoch;
}

/** A proof that re-trusts (section 7.3): the password, a second factor that is not an emailed code, or a code-only account. */
export function proofRetrusts(proof: SignInProof): boolean {
  if (!proof.hasPassword) return true;
  if (proof.method === 'password') return true;
  return proof.second !== null && proof.second !== 'email_code';
}

export interface AfterSignInPlan {
  /** Write `hr:grownup:trust` with the gate's epoch. */
  writeTrust: boolean;
  /** The sign-in completed but the lock stays (`retrust_password`) until the password is used. */
  retrustPending: boolean;
  /** Write `hr:grownup:retrustNotice` (the home's once-only notice after a re-trust). */
  retrustNotice: boolean;
}

/** What a completed sign-in writes (sections 6.5 and 7.3). */
export function afterSignInPlan(gate: NativeGateState, trust: TrustRead, pinResetByWait: boolean, proof: SignInProof): AfterSignInPlan {
  if (!keepsRecords(gate)) return { writeTrust: false, retrustPending: false, retrustNotice: false };
  const retrust = retrustPendingFor(gate, trust, pinResetByWait);
  if (retrust && !proofRetrusts(proof)) return { writeTrust: false, retrustPending: true, retrustNotice: false };
  return { writeTrust: true, retrustPending: false, retrustNotice: retrust };
}

/** The trust record of `epoch`. */
export function trustRecord(epoch: number): AccountTrust {
  return { v: 1, epoch };
}

const KNOWN_KINDS: ReadonlySet<string> = new Set(SpaceKindSchema.options);
const KNOWN_ROLES: ReadonlySet<string> = new Set(SpaceRoleSchema.options);

/**
 * The account's uses from `GET /api/spaces`'s data (`{ spaces: [{ space: { kind }, role }] }`), in the fixed order
 * family, teacher, school (`usesFor`); null when the answer does not have that shape. A kind or role this bundle does
 * not know is skipped, as the console does.
 */
export function usesOfSpaces(data: unknown): GrownUpUse[] | null {
  if (typeof data !== 'object' || data === null) return null;
  const spaces = (data as { spaces?: unknown }).spaces;
  if (!Array.isArray(spaces)) return null;
  const memberships: { kind: SpaceKind; role: SpaceRole }[] = [];
  for (const item of spaces) {
    if (typeof item !== 'object' || item === null) return null;
    const kind = (item as { space?: { kind?: unknown } }).space?.kind;
    const role = (item as { role?: unknown }).role;
    if (typeof kind !== 'string' || typeof role !== 'string') return null;
    if (KNOWN_KINDS.has(kind) && KNOWN_ROLES.has(role)) memberships.push({ kind: kind as SpaceKind, role: role as SpaceRole });
  }
  return usesFor(memberships);
}

/** The uses record: no names, no ids (section 13.1). */
export function deviceUsesRecord(uses: readonly GrownUpUse[], at: number): DeviceUses {
  return { v: 1, uses: GrownUpUseSchema.options.filter((use) => uses.includes(use)), at };
}

/** Section 6.5 step 5: the home a sign-in opens with no row's use: Family, then Teacher, then School; no space: Family. */
export function nativeHomeFor(uses: readonly GrownUpUse[]): GrownUpUse {
  return GrownUpUseSchema.options.find((use) => uses.includes(use)) ?? 'family';
}

/**
 * Section 6.6: the records Sign out deletes. **Sign in again** on the lock (`via: 'lock'`) keeps a trust record of
 * another epoch (or a damaged one, or any while the gate state cannot be read), so the next sign-in still meets the
 * re-trust rule of 7.3 (CS-N3); every other sign-out deletes it.
 */
export function recordsToDelete(via: 'user' | 'lock', gate: NativeGateState, trust: TrustRead): string[] {
  // On the lock path a gate state that cannot be read keeps the trust too: deleting it could only weaken the rule.
  const keepTrust = via === 'lock' && (gate.state === 'unknown' || retrustPendingFor(gate, trust, false));
  return keepTrust ? [DEVICE_USES_RECORD_KEY, RETRUST_NOTICE_KEY] : [DEVICE_USES_RECORD_KEY, TRUST_RECORD_KEY, RETRUST_NOTICE_KEY];
}
