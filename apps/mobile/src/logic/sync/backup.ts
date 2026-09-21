import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  BackupFileSchema,
  type BackupFile,
  type Profile,
  type ProgressSnapshot,
} from '@hangul-route/content-schema';

/**
 * Server-less backup file — F-SYNC-001 §3.6. A parent can keep this file
 * anywhere; `decodeBackup` never throws.
 */
export function encodeBackup(profile: Profile, snapshot: ProgressSnapshot, exportedAt: Date): string {
  const file: BackupFile = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: exportedAt.toISOString(),
    profile,
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
  return parsed.success ? { ok: true, file: parsed.data } : { ok: false, error: 'invalid' };
}

/** `hangul-route-suni-2026-09-21.hangulroute.json` */
export function backupFileName(displayName: string, exportedAt: Date): string {
  const slug = displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'learner';
  return `hangul-route-${slug}-${exportedAt.toISOString().slice(0, 10)}.hangulroute.json`;
}
