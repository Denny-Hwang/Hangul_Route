import {
  GUEST_REOPEN_MS,
  GUEST_TTL_DAYS,
  GUEST_TTL_MS,
  GUEST_TTL_SHARED_DAYS,
  GUEST_TTL_SHARED_MS,
  GuestRecordSchema,
  type AvatarKind,
  type GuestRecord,
  type GuestVia,
  type LearnerType,
  type Profile,
  type ProfileRole,
} from '@hangul-route/content-schema';
import { gateRequired } from '../profiles/learner-type';

/**
 * [GU] AMENDMENTS-GUEST-FIRST-LESSON sections 5.2 to 5.5, GU-D1 to GU-D3, GU-D9, GU-D10, GU-D12 to GU-D15 (row GU-2):
 * the guest first quest's rules. Pure: every input is passed in (the guest record, the profile list, the PIN, the
 * clock), so each rule is unit-tested; `store/guest-store.ts` and `store/guest-sweep.ts` only read and act on the
 * answers. A guest is a run, not a profile: its record lives in `hr:guest`, never in `hr:profiles`, and its id is an
 * ordinary profile id that the saved profile keeps.
 */

/** A profile entry as these rules read it. `id` may be absent (the marker's raw read keeps no id). */
export interface GuestRuleProfile {
  id?: string;
  /** Absent reads as `learner`, like `ProfileRoleSchema`'s default. */
  role?: ProfileRole;
  learnerType?: LearnerType;
}

/** The entry a live guest adds to every input of the grown-up gate: a learner whose `learnerType` is unset (child). */
export interface GuestGateEntry {
  id: string;
  role: 'learner';
}

const isLearner = (p: GuestRuleProfile): boolean => p.role === undefined || p.role === 'learner';

/** The learner profiles of the list (grown-up roles never count). */
const learnerCount = (profiles: readonly GuestRuleProfile[]): number => profiles.filter(isLearner).length;

/**
 * Whether the record is a live guest: a record whose id is not a profile here. A record whose id is already in the
 * profile list is a saved guest waiting for its hydrate repair (section 5.4 step 4), not a guest.
 */
export function isLiveGuest(guest: GuestRecord | null | undefined, profiles: readonly GuestRuleProfile[]): guest is GuestRecord {
  if (guest === null || guest === undefined) return false;
  return !profiles.some((p) => p.id === guest.id);
}

/**
 * GU-D14: the profiles every `gateRequired` caller reads. A live guest counts as one more learner whose `learnerType`
 * is unset (read as `child`), so the grown-up gate, the device gate marker, the transfer consent gate, the placement
 * report gate and `isSharedDevice` treat the device as one where a child may be playing. Without a live guest the list
 * is returned as it is.
 */
export function gateProfiles<P extends GuestRuleProfile>(profiles: readonly P[], guest: GuestRecord | null | undefined): readonly (P | GuestGateEntry)[] {
  if (!isLiveGuest(guest, profiles)) return profiles;
  return [...profiles, { id: guest.id, role: 'learner' }];
}

const asGateInput = (profiles: readonly GuestRuleProfile[]): { role: ProfileRole; learnerType?: LearnerType }[] =>
  profiles.map((p) => ({ role: p.role ?? 'learner', ...(p.learnerType === undefined ? {} : { learnerType: p.learnerType }) }));

/**
 * Section 9.2, the guest-only gate: no PIN is stored, no profile reads as a child, and the grown-up gate is required
 * only because of the live guest. The L8 PIN setup then says why and offers **Remove the first quest** (row GU-5).
 */
export function guestOnlyGate(input: { profiles: readonly GuestRuleProfile[]; guest: GuestRecord | null | undefined; parentPinHash: string | null }): boolean {
  const { profiles, guest, parentPinHash } = input;
  if (parentPinHash !== null || !isLiveGuest(guest, profiles)) return false;
  return !gateRequired({ profiles: asGateInput(profiles), parentPinHash }) && gateRequired({ profiles: asGateInput(gateProfiles(profiles, guest)), parentPinHash });
}

/** Section 8.2: the three cases of Keep my progress. */
export type GuestSaveGate = 'open' | 'verify' | 'owner';

/**
 * Section 8.2, GU-D10, CS-G9, CS-G10: `verify` when a PIN is stored (with or without profiles), `owner` when the
 * device holds learner profiles and no PIN (the guest never sets the PIN; the person who uses the device keeps the
 * quest), else `open` (a first run). It takes no grown-up session and never goes through `gateOpensDirectly`: an open
 * session cannot skip it.
 */
export function guestSaveGate(input: { profiles: readonly GuestRuleProfile[]; parentPinHash: string | null }): GuestSaveGate {
  if (input.parentPinHash !== null) return 'verify';
  return learnerCount(input.profiles) > 0 ? 'owner' : 'open';
}

/** GU-D13: how long a never-saved record lives without play: 30 days, or 7 on a device that holds learner profiles. */
export function guestTtlMs(profiles: readonly GuestRuleProfile[]): number {
  return learnerCount(profiles) > 0 ? GUEST_TTL_SHARED_MS : GUEST_TTL_MS;
}

/** The same in whole days, as the Not now card and the Privacy Policy bullet say it. */
export function guestTtlDays(profiles: readonly GuestRuleProfile[]): number {
  return learnerCount(profiles) > 0 ? GUEST_TTL_SHARED_DAYS : GUEST_TTL_DAYS;
}

/** A stored ISO time as epoch ms, or null when it does not read as a time. */
function timeOf(iso: unknown): number | null {
  if (typeof iso !== 'string') return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

/** The record's last play: `lastAt`, else `startedAt`, else none. */
const lastPlayOf = (guest: { lastAt?: unknown; startedAt?: unknown }): number | null => timeOf(guest.lastAt) ?? timeOf(guest.startedAt);

/**
 * GU-D12: whether a boot reopens the guest where it was: its last play within `GUEST_REOPEN_MS` (30 minutes). A clock
 * that ran backwards counts no time (the last play reads as just now). A record with no readable time never reopens.
 */
export function guestReopens(guest: GuestRecord | null | undefined, now: number): boolean {
  if (guest === null || guest === undefined) return false;
  const last = lastPlayOf(guest);
  if (last === null) return false;
  return Math.max(0, now - last) <= GUEST_REOPEN_MS;
}

/**
 * GU-D13: whether the boot's sweep removes the record: longer than `guestTtlMs(profiles)` since its last play. A clock
 * that ran backwards counts no time; a record with no readable time goes at once.
 */
export function guestExpired(guest: GuestRecord, now: number, profiles: readonly GuestRuleProfile[]): boolean {
  const last = lastPlayOf(guest);
  if (last === null) return true;
  return now - last > guestTtlMs(profiles);
}

/** What the boot does with the stored `hr:guest` (section 5.4 step 4, section 7.2, GU-D13). */
export type StoredGuestAction =
  /** Nothing stored. */
  | { kind: 'none' }
  /** A live guest: kept. */
  | { kind: 'keep'; record: GuestRecord }
  /** A saved guest (its id is already a profile): `hr:guest` is deleted and the profile kept. */
  | { kind: 'repair'; record: GuestRecord }
  /** A never-saved record past its days, or one that has not parsed for 30 days: removed with every key of its id. */
  | { kind: 'sweep'; id: string | null; questDone: boolean }
  /** A record that does not parse, not yet 30 days old: treated as no guest, kept until a start overwrites it. */
  | { kind: 'unreadable' };

const PROFILE_ID = /^profile:[a-z0-9-]+$/;

/**
 * The boot's decision for the stored `hr:guest` (`raw`, `undefined` when present but not JSON): a record whose id is a
 * profile here is repaired, a record past `guestTtlMs` is swept, a live one kept. A record that does not parse is no
 * guest; it is swept once 30 days have passed since its stored time, or at once when it holds no time. The id of a
 * swept record is given only when it is a profile id that is not a profile here, so a sweep never touches a saved
 * learner's keys.
 */
export function storedGuestAction(raw: unknown, now: number, profiles: readonly GuestRuleProfile[]): StoredGuestAction {
  if (raw === null) return { kind: 'none' };
  const parsed = GuestRecordSchema.safeParse(raw);
  if (parsed.success) {
    const record = parsed.data;
    if (!isLiveGuest(record, profiles)) return { kind: 'repair', record };
    if (guestExpired(record, now, profiles)) return { kind: 'sweep', id: record.id, questDone: record.questDone };
    return { kind: 'keep', record };
  }
  const fields = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const last = lastPlayOf(fields);
  if (last !== null && now - last <= GUEST_TTL_MS) return { kind: 'unreadable' };
  return { kind: 'sweep', id: unreadableGuestId(raw, profiles), questDone: fields.questDone === true };
}

/**
 * The id a stored `hr:guest` that does not parse still names: a profile id (`profile:` and the suffix) that is not a
 * profile here, else null. Its keys are the ones a sweep, or a start that writes over the record, removes; a saved
 * learner's id is never given.
 */
export function unreadableGuestId(raw: unknown, profiles: readonly GuestRuleProfile[]): string | null {
  const id = typeof raw === 'object' && raw !== null ? (raw as { id?: unknown }).id : undefined;
  return typeof id === 'string' && PROFILE_ID.test(id) && !profiles.some((p) => p.id === id) ? id : null;
}

/**
 * Whether a stored `hr:guest` (read exactly, `null` when absent) may stand for a live guest, for the device gate
 * marker's `none` check (CS-G6): a record whose id is not on the stored profile list (`hr:profiles`, read raw), or
 * anything stored that does not parse (fail closed: damaged data never confirms `none`).
 */
export function storedGuestMayLive(rawGuest: unknown, rawProfiles: unknown): boolean {
  if (rawGuest === null) return false;
  const parsed = GuestRecordSchema.safeParse(rawGuest);
  if (!parsed.success) return true;
  const ids = Array.isArray(rawProfiles)
    ? rawProfiles.flatMap((entry: unknown) => (typeof entry === 'object' && entry !== null && typeof (entry as { id?: unknown }).id === 'string' ? [{ id: (entry as { id: string }).id }] : []))
    : [];
  return isLiveGuest(parsed.data, ids);
}

/** What the stored lists, read exactly, say about an id (section 5.4 step 4, GU-D13). */
export type StoredIdStatus =
  /** On `hr:profiles`: a saved learner (the guest record is only to be deleted). */
  | 'saved'
  /** On `hr:profiles:tombstones`: a removed learner (its keys go with the OA-7a launch sweep; the record only goes). */
  | 'removed'
  /** In neither: a never-saved guest, whose keys a sweep may remove. */
  | 'unknown';

/**
 * The status of `id` on the stored profile list and tombstones, both read exactly (`null` when missing). `null` when
 * either does not have its shape (a list; a `{ v: 1, ids: [] }` record), so damaged data never lets a sweep delete a
 * learner's keys. Every entry with a string id counts, whether or not it parses as a profile.
 */
export function storedIdStatus(id: string, rawProfiles: unknown, rawTombstones: unknown): StoredIdStatus | null {
  if (rawProfiles !== null && !Array.isArray(rawProfiles)) return null;
  let removed: unknown[] = [];
  if (rawTombstones !== null) {
    const record = typeof rawTombstones === 'object' ? (rawTombstones as { v?: unknown; ids?: unknown }) : {};
    if (record.v !== 1 || !Array.isArray(record.ids)) return null;
    removed = record.ids;
  }
  const list: unknown[] = Array.isArray(rawProfiles) ? rawProfiles : [];
  const listed = list.some((entry) => typeof entry === 'object' && entry !== null && (entry as { id?: unknown }).id === id);
  if (listed) return 'saved';
  return removed.includes(id) ? 'removed' : 'unknown';
}

const ROLES: readonly ProfileRole[] = ['learner', 'parent', 'teacher', 'admin'];

/**
 * The entries of a raw `hr:profiles` read as these rules read them: every entry with a string id (whether or not it
 * parses as a profile) and its role when it names one. Anything that is not a list gives none.
 */
export function storedRuleProfiles(raw: unknown): GuestRuleProfile[] {
  if (!Array.isArray(raw)) return [];
  return (raw as unknown[]).flatMap((entry) => {
    const fields = typeof entry === 'object' && entry !== null ? (entry as { id?: unknown; role?: unknown }) : {};
    if (typeof fields.id !== 'string') return [];
    const role = ROLES.find((r) => r === fields.role);
    return [role === undefined ? { id: fields.id } : { id: fields.id, role }];
  });
}

/** A new record for a run that starts now (section 5.1); `id` is a fresh ordinary profile id (GU-D2). */
export function newGuestRecord(id: string, via: GuestVia, now: number): GuestRecord {
  const at = new Date(now).toISOString();
  return { v: 1, id, startedAt: at, lastAt: at, via, questDone: false };
}

/** The record after a quest step entered or finished (`lastAt` now; `questDone` once quest 1 is finished). */
export function guestPlayed(guest: GuestRecord, now: number, questDone = false): GuestRecord {
  return { ...guest, lastAt: new Date(now).toISOString(), questDone: guest.questDone || questDone };
}

/** An event as `track()` holds it. */
interface EventLike {
  name: string;
  profileId?: string;
}

/**
 * GU-D15, CS-G7: the event `track()` sends. Its `profileId` is dropped while this tab is in a guest run (`running`),
 * and whenever it is the live guest's id (an id not in the profile list): Welcome's Add my name, a `GuestLater`
 * reopen, the hydrate repair and the sweep use the id without a run. A guest is in no F-CURR-002 experiment, so an
 * `exp.exposure` in either case is not sent at all (`null`). Every other event is returned unchanged.
 */
export function guestTelemetryAnonymous<E extends EventLike>(input: {
  event: E;
  guest: GuestRecord | null | undefined;
  profiles: readonly GuestRuleProfile[];
  running: boolean;
}): E | null {
  const { event, guest, profiles, running } = input;
  const guestId = isLiveGuest(guest, profiles) && event.profileId === guest.id;
  if (!running && !guestId) return event;
  if (event.name === 'exp.exposure') return null;
  if (!('profileId' in event)) return event;
  const { profileId: _dropped, ...rest } = event;
  return rest as E;
}

/** What the save form gives (section 8.3); level and cub take the defaults there. */
export interface PromotionForm {
  displayName: string;
  ageGroup: Profile['ageGroup'];
  avatar: AvatarKind;
  learnerType: LearnerType;
  /** The consent card the form showed and the person accepted (F-LEARN-001 `requiredConsent`), or none needed. */
  consent?: 'guardian' | 'self' | null;
  /** The card made the device's PIN (a child on a device with none). */
  makesPin?: boolean;
  /** An email was typed (behind **Add an email**). */
  email?: boolean;
}

/** One step of the save, in the F-LEARN-001 section 3.3 order, then the promotion (section 5.4). */
export type PromotionStep = 'consent' | 'pin' | 'email' | 'profile' | 'forget-guest';

export interface PromotionPlan {
  /** The guest's id: the profile keeps it (GU-D2, GU-D9), so every per-profile record is already the learner's. */
  id: string;
  /** The profile's `createdAt`: the run's start, so the welcome card is dated before quest 1's finish. */
  createdAt: string;
  profile: { displayName: string; ageGroup: Profile['ageGroup']; avatar: AvatarKind; learnerType: LearnerType };
  steps: PromotionStep[];
}

/**
 * Section 5.4: the save as a plan. The consent, the PIN and the email come first (F-LEARN-001 section 3.3, unchanged),
 * then the profile is written with the guest's id and the run's start as `createdAt`, then `hr:guest` is deleted. A
 * `startedAt` that does not read as a time leaves `createdAt` to `now`.
 */
export function promotionPlan(guest: GuestRecord, form: PromotionForm, now: number): PromotionPlan {
  const started = timeOf(guest.startedAt);
  const steps: PromotionStep[] = [];
  if (form.consent !== undefined && form.consent !== null) steps.push('consent');
  if (form.makesPin === true) steps.push('pin');
  if (form.email === true) steps.push('email');
  steps.push('profile', 'forget-guest');
  return {
    id: guest.id,
    createdAt: new Date(started ?? now).toISOString(),
    profile: { displayName: form.displayName, ageGroup: form.ageGroup, avatar: form.avatar, learnerType: form.learnerType },
    steps,
  };
}

/** Section 8.1 and GU-D8: what the guest's Results draws after the stars and the card. */
export interface GuestResultsActions {
  /** The one primary, **Keep my progress** (cases `open` and `verify`). */
  keep: boolean;
  /** **The person who uses this device can add you.** in its place (case `owner`). */
  askOwner: boolean;
  /** The quiet **Not now**. */
  notNow: boolean;
}

/** GU-D8, GU-D10: nothing before quest 1 is done; then Keep my progress (or the ask-the-owner line) and Not now. */
export function guestResultsActions(input: { questDone: boolean; saveGate: GuestSaveGate }): GuestResultsActions {
  if (!input.questDone) return { keep: false, askOwner: false, notNow: false };
  const owner = input.saveGate === 'owner';
  return { keep: !owner, askOwner: owner, notNow: true };
}

/** Where a launch with the `try` intent lands (section 6.1). */
export type GuestEntry =
  /** Today's launch (`try` ignored, or no `try`). */
  | { kind: 'launch' }
  /** "Who is using this?" with the trigger `try` (a device with learner profiles, the chooser on). */
  | { kind: 'chooser'; trigger: 'try' }
  /** A guest run: a new one, or the live one resumed at quest 1 (`quest`) or at the Not now card (`later`). */
  | { kind: 'guest'; via: 'site'; resumed: boolean; at: 'quest' | 'later' };

/**
 * Section 6.1, GU-D5 to GU-D7, CS-G4: the `try` intent never starts a guest on a device with learner profiles (the
 * chooser opens with the trigger `try` when it is on, else today's launch), never selects or opens a profile, and is
 * ignored with the guest switch off. On a device with no learner profile it starts a guest, or resumes the live one.
 */
export function guestEntry(input: {
  intent: 'try' | null;
  profiles: readonly GuestRuleProfile[];
  guest: GuestRecord | null | undefined;
  flags: { guestLessonEnabled: boolean };
  chooserOn: boolean;
}): GuestEntry {
  const { intent, profiles, guest, flags, chooserOn } = input;
  if (intent !== 'try' || !flags.guestLessonEnabled) return { kind: 'launch' };
  if (learnerCount(profiles) > 0) return chooserOn ? { kind: 'chooser', trigger: 'try' } : { kind: 'launch' };
  if (!isLiveGuest(guest, profiles)) return { kind: 'guest', via: 'site', resumed: false, at: 'quest' };
  return { kind: 'guest', via: 'site', resumed: true, at: guest.questDone ? 'later' : 'quest' };
}
