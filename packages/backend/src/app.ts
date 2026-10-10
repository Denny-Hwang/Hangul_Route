import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { allowedOrigin } from './lib/cors';
import { healthReport, type RuntimeEnv } from './lib/runtime';
import { cardRoutes } from './routes/cards';
import { contentRoutes } from './routes/content';
import { recoveryRoutes } from './routes/recovery';
import { entitlementRoutes } from './routes/entitlements';
import { relinkRoutes } from './routes/relink';
import { schoolRoutes } from './routes/school';
import { plansRoutes } from './routes/plans';
import { spacesRoutes } from './routes/spaces';
import { syncRoutes } from './routes/sync';
import { telemetryRoutes } from './routes/telemetry';

const app = new Hono<{ Bindings: RuntimeEnv & { ALLOWED_ORIGINS?: string } }>();

// Browser callers (PWA, console) live on other origins — F-CONSOLE-001 §3.1.
app.use(
  '/api/*',
  cors({
    origin: (origin, c) => allowedOrigin(origin, c.env?.ALLOWED_ORIGINS) ?? '',
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], // PATCH: console space settings (BUG-1)
    allowHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
  }),
);

// Legacy hello-hoya envelope (kept for F-INFRA-001 self-tests).
app.get('/', (c) =>
  c.json({
    service: 'hangul-route-api',
    status: 'ok',
    message: 'Hello, Hoya!',
  }),
);

// Which bindings this deployment has — booleans only (SEC-2). 503 when production lacks Clerk or D1.
app.get('/health', (c) => {
  const report = healthReport(c.env);
  return c.json(report, report.status === 'ok' ? 200 : 503);
});

// V1 API surface — only what shipped clients use. The in-memory family / profile /
// progress / subscription / notification routes are unmounted (audit SEC-1, SEC-3).
app.route('/api/cards', cardRoutes); // static catalog
app.route('/api/content', contentRoutes); // static catalogs
app.route('/api/telemetry', telemetryRoutes); // POST only — the learner app's event intake
// Schema v2 (F-SYNC-001): learner snapshots — the restore + caregiver summary source.
app.route('/api/sync', syncRoutes);
// Rescue Code (F-RESTORE-001): account-less restore.
app.route('/api/recovery', recoveryRoutes);
// Spaces & memberships (F-SPACE-001): family / class / school, join codes, roster summaries.
app.route('/api/spaces', spacesRoutes);
// Plans (F-PLAN-001): one row per space, derived into homework on each learner device.
app.route('/api/spaces', plansRoutes);
// Re-link approval (F-TCH-001 §10.1): a class student's new device, approved by the teacher.
app.route('/api/spaces', relinkRoutes);
// Entitlements (F-ENT-001): one table for receipts, Stripe and contracts; learners inherit through memberships.
app.route('/api/entitlements', entitlementRoutes);
// School admin (F-SCHOOL-001): class tree, teacher invites, seats — aggregates only.
app.route('/api/spaces', schoolRoutes);

app.notFound((c) =>
  c.json({ ok: false, error: { code: 'not_found', message: 'Route not found' } }, 404),
);

export default app;
