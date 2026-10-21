import { dbFor, type Db } from './db';
import { guardrailDisabledLog, guardrailEvaluatorEnabled, guardrailRunLog, runGuardrailEvaluator, type GuardrailEnv } from './lib/guardrail-evaluator';
import { runScheduledPurge } from './lib/note-retention';

/**
 * The Worker's `scheduled` handler — F-FEEDBACK-001 section 8.7 (PR FB-3b).
 * `apps/api/wrangler.toml` declares one daily Cron Trigger; `apps/api/src/index.ts`
 * exports this next to `fetch`. It runs the bounded note purge and the counter
 * purge (`runScheduledPurge`). The Db comes from the same binding the routes
 * use: without D1 on a production Worker it throws `db_not_configured`, which
 * Cloudflare records as a failed run (nothing is purged from an isolate's memory).
 *
 * F-CURR-002 section 12.3 (row CM-70b): after the purge, the same run
 * evaluates the guardrails and lowers a breached ramp (`runGuardrailEvaluator`).
 * The purge goes first, so the retention purge never waits on the advisory
 * evaluator (or on a run cut short by a platform limit). The two jobs are
 * independent: an error in either still lets the other run, then the first
 * error is rethrown so Cloudflare records the run as failed. The evaluator
 * logs one line per run (`guardrail.run`: flag names, steps and skip codes,
 * no ids) for Workers Logs. `GUARDRAIL_EVALUATOR` set to anything but
 * `enabled` (unset is on) skips the evaluator and logs `disabled: true`; the
 * purge still runs.
 */
export interface ScheduledEventLike {
  scheduledTime?: number;
}
export interface ExecutionContextLike {
  waitUntil(promise: Promise<unknown>): void;
}

export async function scheduled(event: ScheduledEventLike, env: unknown, ctx?: ExecutionContextLike): Promise<void> {
  const db = dbFor({ env });
  const guardrails = guardrailEvaluatorEnabled(env as GuardrailEnv | undefined);
  const run = runScheduledJobs(db, new Date(event.scheduledTime ?? Date.now()), guardrails);
  ctx?.waitUntil(run);
  await run;
}

async function runScheduledJobs(db: Db, now: Date, evaluate: boolean): Promise<void> {
  const purge = await runScheduledPurge(db, now).then(
    () => null,
    (error: unknown) => ({ error }),
  );
  if (!evaluate) console.info(guardrailDisabledLog(now));
  const guardrails = !evaluate
    ? null
    : await runGuardrailEvaluator(db, now).then(
        (result) => {
          console.info(guardrailRunLog(result));
          return null;
        },
        (error: unknown) => ({ error }),
      );
  const failed = purge ?? guardrails;
  if (failed) throw failed.error;
}
