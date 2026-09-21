import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { allowedOrigin } from './lib/cors';
import { authRoutes } from './routes/auth';
import { cardRoutes } from './routes/cards';
import { contentRoutes } from './routes/content';
import { notificationsRoutes } from './routes/notifications';
import { profileRoutes } from './routes/profiles';
import { progressRoutes } from './routes/progress';
import { subscriptionRoutes } from './routes/subscriptions';
import { recoveryRoutes } from './routes/recovery';
import { relinkRoutes } from './routes/relink';
import { plansRoutes } from './routes/plans';
import { spacesRoutes } from './routes/spaces';
import { syncRoutes } from './routes/sync';
import { telemetryRoutes } from './routes/telemetry';

const app = new Hono<{ Bindings: { ALLOWED_ORIGINS?: string } }>();

// Browser callers (PWA, console) live on other origins — F-CONSOLE-001 §3.1.
app.use(
  '/api/*',
  cors({
    origin: (origin, c) => allowedOrigin(origin, c.env?.ALLOWED_ORIGINS) ?? '',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
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

app.get('/health', (c) => c.json({ status: 'ok' }));

// V1 API surface
app.route('/api/auth', authRoutes);
app.route('/api/profiles', profileRoutes);
app.route('/api/progress', progressRoutes);
app.route('/api/subscriptions', subscriptionRoutes);
app.route('/api/cards', cardRoutes);
app.route('/api/content', contentRoutes);
app.route('/api/telemetry', telemetryRoutes);
app.route('/api/notifications', notificationsRoutes);
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

app.notFound((c) =>
  c.json({ ok: false, error: { code: 'not_found', message: 'Route not found' } }, 404),
);

export default app;
