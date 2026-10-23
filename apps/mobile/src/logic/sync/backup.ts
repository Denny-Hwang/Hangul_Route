import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  BackupFileSchema,
  type BackupFile,
  type MemoryBackup,
  type Profile,
  type ProgressSnapshot,
  reviewsForReader,
} from '@hangul-route/content-schema';

/**
 * [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS section 13.1 (row OA-10): the grown-up PIN lives in `account:parentPinHash`,
 * never in a profile. A legacy profile record may still carry the old per-profile `parentPinHash`; it never goes into a
 * backup file (a file can be kept anywhere) and never comes back from one. A copy: the caller's profile is unchanged.
 */
function withoutPinHash(profile: Profile): Profile {
  if (!('parentPinHash' in profile)) return profile;
  const { parentPinHash: _dropped, ...rest } = profile as Profile & { parentPinHash?: unknown };
  return rest;
}

/** A file declares no review kind: whoever restores it reads it. */
const NO_CAPS: ReadonlySet<string> = new Set();

/**
 * Server-less backup file — F-SYNC-001 §3.6. A parent can keep this file
 * anywhere; `decodeBackup` never throws. [OA] The exported profile carries no `parentPinHash`.
 * F-CURR-002 section 4.8 (row CM-11): the memory store's states go in an optional `memory` key, only
 * when there are any (`memoryForBackup`); `BACKUP_VERSION` stays 1 and an older app ignores the key.
 */
export function encodeBackup(profile: Profile, snapshot: ProgressSnapshot, exportedAt: Date, memory?: MemoryBackup): string {
  // Any build may restore a file, and one from before CM-3b reads reviews strictly: a gated kind (the quest
  // warm-up, the Cell Check) never goes in (F-CURR-002 section 13, rows CM-15 and CM-21). A warm-up carries no
  // result, and a Cell Check's best result is the snapshot's `cellCheckAt` / `testedOut` latch, so nothing is lost.
  const reviews = reviewsForReader(snapshot.reviews, NO_CAPS);
  const file: BackupFile = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: exportedAt.toISOString(),
    profile: withoutPinHash(profile),
    snapshot: reviews === snapshot.reviews ? snapshot : { ...snapshot, reviews: [...reviews] },
    ...(memory && Object.keys(memory).length > 0 ? { memory } : {}),
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
