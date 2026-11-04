import type { Db, StoredRelink } from '../db';

/*
 * Re-link expiry on read (F-TCH-001 section 10.1): there is no scheduler, so the routes that show or decide a
 * request close the ones whose window passed. Shared by the re-link routes and the roster's `pending.relink`
 * ([GX-W] AMENDMENTS-GROWNUP-UX section 12), so both settle a request the same way.
 */

/** Marks a pending request expired once its window passed; returns whether it changed. */
export function expireIfDue(req: StoredRelink, now: Date): boolean {
  if (req.status === 'pending' && Date.parse(req.expiresAt) <= now.getTime()) {
    req.status = 'expired';
    req.decidedAt = now.toISOString();
    return true;
  }
  return false;
}

/** Loads a space's requests, persisting any that expired meanwhile. */
export async function liveRelinks(db: Db, spaceId: string, now: Date): Promise<StoredRelink[]> {
  const rows = await db.relinksOf(spaceId);
  for (const r of rows) if (expireIfDue(r, now)) await db.putRelink(r);
  return rows;
}
