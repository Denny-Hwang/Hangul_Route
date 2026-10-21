import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  BackupFileSchema,
  type BackupFile,
  type Profile,
  type ProgressSnapshot,
} from '@hangul-route/content-schema';

/**
 * [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS section 13.1 (row OA-10): the grown-up PIN lives in `account:parentPinHash`,
 * never in a profile. A legacy profile record may still carry the old per-profile `parentPinHash`; it never goes into a
 * backup file (a file can be kept anywhere) and never comes back from one. A copy: the caller's profile is unchanged.
 */
function withoutPinHash(profile: Profile): Profile {
  if (!('parentPinHash' in profile)) return profile;
  const { parentPinHash: _dropped, ...rest } = profile;
  return rest;
}

/**
 * Server-less backup file — F-SYNC-001 §3.6. A parent can keep this file
 * anywhere; `decodeBackup` never throws. [OA] The exported profile carries no `parentPinHash`.
 */
export function encodeBackup(profile: Profile, snapshot: ProgressSnapshot, exportedAt: Date): string {
  const file: BackupFile = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: exportedAt.toISOString(),
    profile: withoutPinHash(profile),
    snapshot,
  };
  return JSON.stringify(file, null, 2);
}

export type BackupDecodeError = 'not-json' | 'not-a-backup' | 'unsupported-version' | 'invalid';

export type BackupDecodeResult = { ok: true; file: BackupFile } | { ok: false; error: BackupDecodeError };

export function decodeBackup(text: string): BackupDecodeResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'not-json' };
  }
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'not-a-backup' };
  const obj = raw as Record<string, unknown>;
  if (obj.format !== BACKUP_FORMAT) return { ok: false, error: 'not-a-backup' };
  if (obj.version !== BACKUP_VERSION) return { ok: false, error: 'unsupported-version' };
  const parsed = BackupFileSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  // [OA] A file written before row OA-10 may hold a legacy hash: it is not restored onto the device.
  return { ok: true, file: { ...parsed.data, profile: withoutPinHash(parsed.data.profile) } };
}

/** `hangul-route-suni-2026-09-21.hangulroute.json` */
export function backupFileName(displayName: string, exportedAt: Date): string {
  const slug = displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'learner';
  return `hangul-route-${slug}-${exportedAt.toISOString().slice(0, 10)}.hangulroute.json`;
}
