import { Hono } from 'hono';
import { authRoutes } from './routes/auth';
import { cardRoutes } from './routes/cards';
import { contentRoutes } from './routes/content';
import { profileRoutes } from './routes/profiles';
import { progressRoutes } from './routes/progress';
import { telemetryRoutes } from './routes/telemetry';

const app = new Hono();

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
app.route('/api/cards', cardRoutes);
app.route('/api/content', contentRoutes);
app.route('/api/telemetry', telemetryRoutes);

app.notFound((c) =>
  c.json({ ok: false, error: { code: 'not_found', message: 'Route not found' } }, 404),
);

export default app;
