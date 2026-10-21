import { z } from 'zod';
import { LegacyDisplayNameSchema } from './display-name';

/**
 * Spaces & memberships — F-SPACE-001. One concept for family / class /
 * school (roadmap multi-persona-sync-platform §2); adults and learners
 * attach through memberships. Shared by the Worker and the apps.
 */

/** Base32 without I, O, 0, 1 — read aloud in a classroom without confusion. */
export const JOIN_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const JOIN_CODE_LENGTH = 6;
export const JOIN_CODE_RE = new RegExp(`^[${JOIN_CODE_ALPHABET}]{${JOIN_CODE_LENGTH}}$`);

/**
 * Upper-cases and strips spaces / hyphens. Null when any character is
 * outside the alphabet or the length is wrong — nothing is silently mapped
 * (an "O" typed for "0" is an error the child can see, not a guess).
 */
export function normalizeJoinCode(raw: string): string | null {
  const code = raw.toUpperCase().replace(/[\s-]/g, '');
  return JOIN_CODE_RE.test(code) ? code : null;
}

export const JoinCodeFieldSchema = z.string().transform((v, ctx) => {
  const n = normalizeJoinCode(v);
  if (!n) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Join code must be ${JOIN_CODE_LENGTH} letters or digits` });
    return z.NEVER;
  }
  return n;
});

export const SpaceKindSchema = z.enum(['family', 'class', 'school']);
export type SpaceKind = z.infer<typeof SpaceKindSchema>;

export const SpaceRoleSchema = z.enum(['owner', 'caregiver', 'teacher', 'admin', 'student']);
export type SpaceRole = z.infer<typeof SpaceRoleSchema>;

export const MemberKindSchema = z.enum(['account', 'learner']);
export type MemberKind = z.infer<typeof MemberKindSchema>;

/** `spaces.settings_json`. Consent mode is per space (owner decision 2026-09-20, c). */
export const SpaceSettingsSchema = z.object({
  consentMode: z.enum(['parent', 'school']).default('parent'),
  anonymizeRoster: z.boolean().default(false),
});
export type SpaceSettings = z.infer<typeof SpaceSettingsSchema>;

export const SpaceSchema = z.object({
  id: z.string().regex(/^space:[a-z0-9-]+$/),
  kind: SpaceKindSchema,
  name: z.string().min(1).max(40),
  parentSpaceId: z.string().nullable(),
  ownerAccountId: z.string().min(1),
  joinCode: z.string().regex(JOIN_CODE_RE).nullable(),
  joinCodeExpiresAt: z.string().nullable(),
  settings: SpaceSettingsSchema,
  archivedAt: z.string().nullable(),
  createdAt: z.string(),
});
export type Space = z.infer<typeof SpaceSchema>;

export const MembershipSchema = z.object({
  spaceId: z.string(),
  memberKind: MemberKindSchema,
  memberId: z.string(),
  role: SpaceRoleSchema,
  joinedAt: z.string(),
});
export type Membership = z.infer<typeof MembershipSchema>;

/** The most UTF-16 units a space name may hold (the create rule since F-SPACE-001). */
export const SPACE_NAME_MAX = 40;

/** Why a space name was refused ([SA] AMENDMENTS-SEATS-ADMINS section 5.2): `422 bad_name` `details.reason`. */
export type SpaceNameRefusal = 'empty' | 'too_long' | 'invalid';

/** Control (`Cc`) and format (`Cf`) characters, except ZWNJ U+200C and ZWJ U+200D, which some scripts need. */
const SPACE_NAME_REFUSED = /(?![\u200C\u200D])[\p{Cc}\p{Cf}]/u;
const SPACE_NAME_LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;

/**
 * A space name as stored ([SA] section 5.2), the same on the Worker and in the console, in this order:
 * 1. Unicode NFC (a decomposed Hangul name and its composed form are one string, for the length and for "same name");
 * 2. every run of JavaScript `\s` whitespace (tabs, new lines, no-break and ideographic spaces, U+FEFF and the other
 *    Unicode spaces) becomes one U+0020, then trim: tabs and new lines are collapsed, not refused;
 * 3. 1 to `SPACE_NAME_MAX` UTF-16 units (`empty`, `too_long`);
 * 4. no remaining control or format character (the bidi embeddings, overrides and isolates, zero-width space, soft
 *    hyphen and the rest), ZWNJ and ZWJ kept (`invalid`);
 * 5. at least one letter or digit (`invalid`).
 */
export function checkSpaceName(raw: string): { ok: true; name: string } | { ok: false; reason: SpaceNameRefusal } {
  const name = raw.normalize('NFC').replace(/\s+/g, ' ').trim();
  if (name.length === 0) return { ok: false, reason: 'empty' };
  if (name.length > SPACE_NAME_MAX) return { ok: false, reason: 'too_long' };
  if (SPACE_NAME_REFUSED.test(name)) return { ok: false, reason: 'invalid' };
  if (!SPACE_NAME_LETTER_OR_DIGIT.test(name)) return { ok: false, reason: 'invalid' };
  return { ok: true, name };
}

/** A space name field: `checkSpaceName`, the normalized name as its output; the issue's `params.reason` says why not. */
export const SpaceNameSchema = z.string().transform((value, ctx) => {
  const checked = checkSpaceName(value);
  if (!checked.ok) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Space name ${checked.reason}`, params: { reason: checked.reason } });
    return z.NEVER;
  }
  return checked.name;
});

/** PATCH /api/spaces/:id/name body ([SA] section 5.2). */
export const SpaceRenameSchema = z.object({ name: SpaceNameSchema });
export type SpaceRename = z.infer<typeof SpaceRenameSchema>;

/**
 * `space_events.kind` ([SA] section 6.2): the registry the column has no CHECK for, so later kinds stay additive.
 * Every insert goes through it. Rows are written for schools only.
 */
export const SpaceEventKindSchema = z.enum(['renamed', 'class_renamed', 'admin_invite_created', 'admin_invite_revoked', 'admin_joined', 'admin_removed', 'admin_left']);
export type SpaceEventKind = z.infer<typeof SpaceEventKindSchema>;

/** One `space_events` row: account and space ids and a time, never a name, an email or a token. */
export interface SpaceEvent {
  id: string;
  spaceId: string;
  kind: SpaceEventKind;
  actorAccountId: string;
  subjectAccountId: string | null;
  subjectSpaceId: string | null;
  inviteId: string | null;
  createdAt: string;
}

/** [SA] The learner caps a join can meet, as `409` codes (section 3.4); `cap_learner` is the learner's own class count. */
export const SeatCapCodeSchema = z.enum(['cap_family', 'cap_class', 'cap_school']);
export type SeatCapCode = z.infer<typeof SeatCapCodeSchema>;

/** [SA] POST /api/spaces/lookup `seat`: whether a learner (the one sent, else a new one) finds room, and which cap is full. */
export const LookupSeatSchema = z.object({
  full: z.boolean(),
  reason: SeatCapCodeSchema.nullable(),
  cap: z.number().int().nonnegative().nullable(),
});
export type LookupSeat = z.infer<typeof LookupSeatSchema>;

/** POST /api/spaces body. `email` / `displayName` seed the account row on first use. */
export const SpaceCreateSchema = z.object({
  kind: SpaceKindSchema,
  /** [SA] The rename rule (`SpaceNameSchema`); a refusal still answers create's `422 bad_request`. */
  name: SpaceNameSchema,
  parentSpaceId: z.string().regex(/^space:[a-z0-9-]+$/).optional(),
  email: z.string().email().optional(),
  displayName: z.string().trim().min(1).max(40).optional(),
});
export type SpaceCreate = z.infer<typeof SpaceCreateSchema>;

/**
 * POST /api/spaces/lookup body. [SA] `learnerId` (optional): with the device `Authorization` header for that learner,
 * `seat` says whether this learner finds room (a member already holds its seat); otherwise it is ignored.
 */
export const SpaceLookupSchema = z.object({ code: JoinCodeFieldSchema, learnerId: z.string().regex(/^profile:[a-z0-9-]+$/).optional() });
export type SpaceLookup = z.infer<typeof SpaceLookupSchema>;

/**
 * POST /api/spaces/:id/join body. Devices send `learnerId` (siblings share a device); `displayName` is the roster
 * name. Lenient on purpose: `LegacyDisplayNameSchema` (trim, 1-20, no control, zero-width or direction characters),
 * the rule registration and PATCH use, so a legacy name the device keeps never fails the join and applies as sent.
 */
export const SpaceJoinSchema = z.object({
  code: JoinCodeFieldSchema,
  learnerId: z.string().regex(/^profile:[a-z0-9-]+$/).optional(),
  displayName: LegacyDisplayNameSchema.optional(),
});
export type SpaceJoin = z.infer<typeof SpaceJoinSchema>;

/** What a learner device learns about its own spaces (inbox row). */
export const LearnerMembershipSchema = z.object({
  spaceId: z.string(),
  kind: SpaceKindSchema,
  name: z.string(),
  role: SpaceRoleSchema,
  joinedAt: z.string(),
});
export type LearnerMembership = z.infer<typeof LearnerMembershipSchema>;

/** Caps until entitlements arrive (F-ENT-001): a learner's classes, a free class's students. */
export const LEARNER_CLASS_CAP = 3;
export const FREE_CLASS_STUDENT_CAP = 20;
