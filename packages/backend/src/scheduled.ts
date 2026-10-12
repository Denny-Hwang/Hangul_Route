import { dbFor } from './db';
import { runScheduledPurge } from './lib/note-retention';

/**
 * The Worker's `scheduled` handler — F-FEEDBACK-001 section 8.7 (PR FB-3b).
 * `apps/api/wrangler.toml` declares one daily Cron Trigger; `apps/api/src/index.ts`
 * exports this next to `fetch`. It runs the bounded note purge and the counter
 * purge (`runScheduledPurge`). The Db comes from the same binding the routes
 * use: without D1 on a production Worker it throws `db_not_configured`, which
 * Cloudflare records as a failed run (nothing is purged from an isolate's memory).
 */
export interface ScheduledEventLike {
  scheduledTime?: number;
}
export interface ExecutionContextLike {
  waitUntil(promise: Promise<unknown>): void;
}

export async function scheduled(event: ScheduledEventLike, env: unknown, ctx?: ExecutionContextLike): Promise<void> {
  const db = dbFor({ env });
  const run = runScheduledPurge(db, new Date(event.scheduledTime ?? Date.now())).then(() => undefined);
  ctx?.waitUntil(run);
  await run;
}
