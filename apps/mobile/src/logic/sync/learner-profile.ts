import { AvatarKindSchema, isLearnerLevelId, type AvatarKind, type LearnerLevelId, type Profile } from '@hangul-route/content-schema';
import { validateDisplayName } from '../profiles/profile-model';

/**
 * The learner fields the server keeps a copy of (F-PROF-001, F-SYNC-001): the name class and family rosters show,
 * the level and the picture. Who is learning, the grown-up PIN and consent stay on the device (F-LEARN-001 L2)
 * and are never part of this.
 */
export interface ProfileServerFields {
  displayName?: string;
  ageGroup?: LearnerLevelId;
  avatar?: AvatarKind;
}

/** An edit the server has not confirmed yet; `at` is when the device last changed it (the server keeps the newest). */
export interface PendingProfile {
  fields: ProfileServerFields;
  at: string;
}

/** The server row as an inbox, a Rescue Code claim or a re-link pickup carries it. */
export interface ServerLearnerFields {
  displayName: string;
  ageGroup: string;
  avatar: string;
}

export function hasFields(fields: ProfileServerFields): boolean {
  return fields.displayName !== undefined || fields.ageGroup !== undefined || fields.avatar !== undefined;
}

/** The server-visible fields of a profile as they are now. */
export function serverFieldsOf(profile: Profile): ProfileServerFields {
  return { displayName: profile.displayName, ageGroup: profile.ageGroup, avatar: profile.avatar };
}

/** The server-visible fields `after` changed relative to `before`, with their new values. */
export function changedServerFields(before: Profile, after: Profile): ProfileServerFields {
  const out: ProfileServerFields = {};
  if (before.displayName !== after.displayName) out.displayName = after.displayName;
  if (before.ageGroup !== after.ageGroup) out.ageGroup = after.ageGroup;
  if (before.avatar !== after.avatar) out.avatar = after.avatar;
  return out;
}

/** A newer edit folds into the one still waiting: the latest value of each field wins, `at` moves to now. */
export function mergePending(previous: PendingProfile | null | undefined, fields: ProfileServerFields, at: string): PendingProfile {
  return { fields: { ...(previous?.fields ?? {}), ...pick(fields) }, at };
}

/**
 * Only values the shared rules accept go up (the same name rule as the Worker's, `DisplayNameSchema`): a name a
 * build before that rule stored stays on the device rather than earning a refusal for the whole edit.
 */
export function sendableFields(fields: ProfileServerFields): ProfileServerFields {
  const out: ProfileServerFields = {};
  if (fields.displayName !== undefined && validateDisplayName(fields.displayName) === null) out.displayName = fields.displayName.trim();
  if (fields.ageGroup !== undefined && isLearnerLevelId(fields.ageGroup)) out.ageGroup = fields.ageGroup;
  if (fields.avatar !== undefined && AvatarKindSchema.safeParse(fields.avatar).success) out.avatar = fields.avatar;
  return out;
}

/** The server values that differ from the local profile and pass the local rules; anything else is skipped. */
export function serverProfileChanges(profile: Profile, server: ServerLearnerFields): ProfileServerFields {
  const out: ProfileServerFields = {};
  const name = server.displayName.trim();
  if (name !== profile.displayName && validateDisplayName(name) === null) out.displayName = name;
  if (server.ageGroup !== profile.ageGroup && isLearnerLevelId(server.ageGroup)) out.ageGroup = server.ageGroup;
  if (server.avatar !== profile.avatar) {
    const avatar = AvatarKindSchema.safeParse(server.avatar);
    if (avatar.success) out.avatar = avatar.data;
  }
  return out;
}

/**
 * Whether an inbox's learner row should replace the local fields. Never while a local edit waits to go up (it
 * wins and is sent). Only an edit the server recorded after registration counts (`profileUpdatedAt`), and only
 * one newer than the last this device sent or took, so an inbox read that started before this device's own
 * edit landed never brings the old name back.
 */
export function shouldPullServerProfile(input: { profileUpdatedAt: string | null; pending: PendingProfile | null | undefined; profileAt: string | null | undefined }): boolean {
  if (input.pending) return false;
  if (input.profileUpdatedAt === null) return false;
  const server = Date.parse(input.profileUpdatedAt);
  if (Number.isNaN(server)) return false;
  if (!input.profileAt) return true;
  const local = Date.parse(input.profileAt);
  return Number.isNaN(local) || server > local;
}

function pick(fields: ProfileServerFields): ProfileServerFields {
  const out: ProfileServerFields = {};
  if (fields.displayName !== undefined) out.displayName = fields.displayName;
  if (fields.ageGroup !== undefined) out.ageGroup = fields.ageGroup;
  if (fields.avatar !== undefined) out.avatar = fields.avatar;
  return out;
}
