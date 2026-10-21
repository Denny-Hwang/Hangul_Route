import { dbFor, type Db } from './db';
import { runGuardrailEvaluator } from './lib/guardrail-evaluator';
import { runScheduledPurge } from './lib/note-retention';

/**
 * The Worker's `scheduled` handler — F-FEEDBACK-001 section 8.7 (PR FB-3b).
 * `apps/api/wrangler.toml` declares one daily Cron Trigger; `apps/api/src/index.ts`
 * exports this next to `fetch`. It runs the bounded note purge and the counter
 * purge (`runScheduledPurge`). The Db comes from the same binding the routes
 * use: without D1 on a production Worker it throws `db_not_configured`, which
 * Cloudflare records as a failed run (nothing is purged from an isolate's memory).
 *
 * F-CURR-002 section 12.3 (row CM-70b): the same run first evaluates the
 * guardrails and lowers a breached ramp (`runGuardrailEvaluator`). The two jobs
 * are independent: an evaluator error still lets the purge run, and is then
 * rethrown so Cloudflare records the run as failed.
 */
export interface ScheduledEventLike {
  scheduledTime?: number;
}
export interface ExecutionContextLike {
  waitUntil(promise: Promise<unknown>): void;
}

export async function scheduled(event: ScheduledEventLike, env: unknown, ctx?: ExecutionContextLike): Promise<void> {
  const db = dbFor({ env });
  const run = runScheduledJobs(db, new Date(event.scheduledTime ?? Date.now()));
  ctx?.waitUntil(run);
  await run;
}

async function runScheduledJobs(db: Db, now: Date): Promise<void> {
  const guardrails = await runGuardrailEvaluator(db, now).then(
    () => null,
    (error: unknown) => ({ error }),
  );
  await runScheduledPurge(db, now);
  if (guardrails) throw guardrails.error;
}
