import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { allowedOrigin } from './lib/cors';
import { adminInviteRoutes, adminSpaceRoutes } from './routes/admins';
import { healthReport, type RuntimeEnv } from './lib/runtime';
import { cardRoutes } from './routes/cards';
import { contentRoutes } from './routes/content';
import { recoveryRoutes } from './routes/recovery';
import { billingRoutes } from './routes/billing';
import { entitlementRoutes } from './routes/entitlements';
import { notesRoutes } from './routes/notes';
import { relinkRoutes } from './routes/relink';
import { schoolRoutes } from './routes/school';
import { plansRoutes } from './routes/plans';
import { spacesRoutes } from './routes/spaces';
import { spaceReportRoutes } from './routes/space-reports';
import { syncRoutes } from './routes/sync';
import { telemetryRoutes } from './routes/telemetry';
import { transferSyncRoutes } from './routes/transfer-device';
import { classMoveRoutes, classScopeSyncRoutes } from './routes/class-moves';
import { transferSpaceRoutes } from './routes/transfers';
import { waitlistRoutes } from './routes/waitlist';

const app = new Hono<{ Bindings: RuntimeEnv }>();

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

// Console reads carry learner names that a device can change at any time: never cached by a browser or proxy.
app.use('/api/spaces/*', async (c, next) => {
  await next();
  if (c.req.method === 'GET') c.header('Cache-Control', 'no-store');
});

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
// Class moves (F-SPACE-002 T-5a): console preview / create / list / decline / cancel / prefs; locked until CLASS_TRANSFER=enabled.
app.route('/api/spaces', transferSpaceRoutes);
// Class moves from the learner's own device (F-SPACE-002 T-5c): preview / create / approve / decline / cancel / prefs; create and approve
// stay locked until CLASS_TRANSFER_DEVICE_CONSENT=enabled (counsel, flip gate G6).
app.route('/api/sync', transferSyncRoutes);
// [TV] Teacher moves and the class-scope update (AMENDMENTS-TEACHER-VISIBILITY-TRANSFER section 4.3): moves behind CLASS_TRANSFER,
// the family's acknowledgement (console and device) always on.
app.route('/api/spaces', classMoveRoutes);
app.route('/api/sync', classScopeSyncRoutes);
// Entitlements (F-ENT-001): one table for receipts, Stripe and contracts; learners inherit through memberships.
app.route('/api/entitlements', entitlementRoutes);
// Billing home (F-BILL-002 B-4): plan status per persona, payer-only receipts, fresh receipt links.
app.route('/api/billing', billingRoutes);
// School admin (F-SCHOOL-001): class tree, teacher invites, seats — aggregates only.
app.route('/api/spaces', schoolRoutes);
// Progress reports (F-REPORT-001 section 3.8): one learner's report from the roster's projection; read-only, archived spaces included.
app.route('/api/spaces', spaceReportRoutes);
// Notes from grown-ups (F-FEEDBACK-001 section 7.2): recipients and send; both 404 until the owner sets NOTES_SEND=enabled.
app.route('/api/spaces', notesRoutes);
// Launch-invite waitlist: public, first-party, no auth. POST only (no read route).
app.route('/api/waitlist', waitlistRoutes);
// [SA] School administrators (AMENDMENTS-SEATS-ADMINS section 6.4): the admin list, invite links (create, revoke),
// ending an admin role; preview and accept read the token from the JSON body only.
app.route('/api/spaces', adminSpaceRoutes);
app.route('/api/admin-invites', adminInviteRoutes);

app.notFound((c) =>
  c.json({ ok: false, error: { code: 'not_found', message: 'Route not found' } }, 404),
);

export default app;
