import { Hono } from 'hono';
import { fail, ok } from '../envelope';
import { id, store, type TelemetryEvent } from '../store';

export const telemetryRoutes = new Hono();

const ALLOWED_NAMES = new Set([
  'session.start',
  'session.end',
  'episode.start',
  'episode.complete',
  'quest.start',
  'quest.complete',
  'round.correct',
  'round.wrong',
  'card.unlocked',
  'profile.switch',
  'parent.gate.opened',
]);

telemetryRoutes.post('/', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const name = typeof body.name === 'string' ? body.name : '';
  if (!ALLOWED_NAMES.has(name)) {
    return fail(c, 'bad_request', 'unknown event name', 422);
  }
  const event: TelemetryEvent = {
    id: id('event'),
    name,
    profileId: typeof body.profileId === 'string' ? body.profileId : undefined,
    payload: body.payload && typeof body.payload === 'object' ? (body.payload as Record<string, unknown>) : undefined,
    at: new Date().toISOString(),
  };
  store.events.push(event);
  // Cap event log to last 10k to avoid memory growth in prototype.
  if (store.events.length > 10_000) store.events.splice(0, store.events.length - 10_000);
  return ok(c, { event }, 201);
});

telemetryRoutes.get('/recent', (c) => {
  const limit = Math.min(parseInt(c.req.query('limit') ?? '50', 10), 500);
  const events = store.events.slice(-limit).reverse();
  return ok(c, { events });
});
