import { z } from 'zod';

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

/** POST /api/spaces body. `email` / `displayName` seed the account row on first use. */
export const SpaceCreateSchema = z.object({
  kind: SpaceKindSchema,
  name: z.string().trim().min(1).max(40),
  parentSpaceId: z.string().regex(/^space:[a-z0-9-]+$/).optional(),
  email: z.string().email().optional(),
  displayName: z.string().trim().min(1).max(40).optional(),
});
export type SpaceCreate = z.infer<typeof SpaceCreateSchema>;

/** POST /api/spaces/lookup body. */
export const SpaceLookupSchema = z.object({ code: JoinCodeFieldSchema });
export type SpaceLookup = z.infer<typeof SpaceLookupSchema>;

/** POST /api/spaces/:id/join body. Devices send `learnerId` (siblings share a device); `displayName` is the roster name. */
export const SpaceJoinSchema = z.object({
  code: JoinCodeFieldSchema,
  learnerId: z.string().regex(/^profile:[a-z0-9-]+$/).optional(),
  displayName: z.string().trim().min(1).max(20).optional(),
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
