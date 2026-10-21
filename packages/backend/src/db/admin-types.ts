/**
 * [SA] Rows of migration 0012 (AMENDMENTS-SEATS-ADMINS sections 6.1 to 6.4): school administrator invites and the
 * writes that start and end an administrator role. Ids, a token hash and times only: names and emails are read
 * live when a view is built, and the token itself is never stored.
 */

/** One `admin_invites` row. Open while `acceptedAt` and `revokedAt` are null and `expiresAt` is in the future. */
export interface StoredAdminInvite {
  id: string;
  spaceId: string;
  /** Hex SHA-256 of the token. */
  tokenHash: string;
  /** The school owner's account id. */
  createdBy: string;
  createdAt: string;
  expiresAt: string;
  acceptedBy: string | null;
  acceptedAt: string | null;
  revokedAt: string | null;
}

/**
 * `Db.createAdminInvite` input (section 6.3): the new row (not accepted, not revoked) and the cap, bound into one
 * guarded statement that counts the school's admins and its open invites, so two tabs cannot both pass. `eventId` is
 * the id of the `admin_invite_created` row written with it.
 */
export interface CreateAdminInviteInput {
  invite: Pick<StoredAdminInvite, 'id' | 'spaceId' | 'tokenHash' | 'createdBy' | 'createdAt' | 'expiresAt'>;
  cap: number;
  eventId: string;
}

/** `Db.revokeAdminInvite` input: the invite, pinned to its school, and the owner who revokes it. */
export interface RevokeAdminInviteInput {
  inviteId: string;
  spaceId: string;
  actorAccountId: string;
  now: Date;
  eventId: string;
}

/** `Db.acceptAdminInvite` input (section 6.4): one batch whose first statement is the gate, pinned to `spaceId`. */
export interface AcceptAdminInviteInput {
  inviteId: string;
  spaceId: string;
  accountId: string;
  now: Date;
  cap: number;
  eventId: string;
}

/** `Db.endAdminRole` input (section 6.1): removed by the owner (`admin_removed`) or leaving (`admin_left`). */
export interface EndAdminRoleInput {
  spaceId: string;
  accountId: string;
  actorAccountId: string;
  kind: 'admin_removed' | 'admin_left';
  now: Date;
  eventId: string;
}

/** What ending an admin role left: a teacher of the school, out of the school, or nothing (no admin row). */
export type EndAdminRoleResult = 'teacher' | 'none' | null;
