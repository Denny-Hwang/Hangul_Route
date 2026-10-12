// Worker entry (F-INFRA-001). All handlers live in @hangul-route/backend
// (T-018) — this package owns only the deploy surface (wrangler, D1 schema).
// `scheduled` runs the daily Cron Trigger of wrangler.toml: the bounded notes
// and counter purge (F-FEEDBACK-001 section 8.7, PR FB-3b).
import app, { scheduled } from '@hangul-route/backend';

export default { fetch: app.fetch, scheduled };
