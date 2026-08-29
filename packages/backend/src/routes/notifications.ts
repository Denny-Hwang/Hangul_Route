import { Hono } from 'hono';
import { fail, ok } from '../envelope';
import { id, store } from '../store';

/**
 * Parent notifications — stub layer.
 *
 * We queue notifications in memory. A real transport (Resend / Postmark /
 * SES) lands in F-NOTIFY-001. Until then, this route lets the client
 * exercise the contract end-to-end without coupling to a vendor.
 */

export const notificationsRoutes = new Hono();

const STREAK_MILESTONES = new Set([3, 7, 14, 30, 60, 90, 180, 365]);

interface QueuedNotification {
  id: string;
  kind: 'streak.milestone';
  profileId: string;
  streakDays: number;
  email?: string;
  queuedAt: string;
  delivered: boolean;
}

const queue: QueuedNotification[] = [];

notificationsRoutes.post('/parent/streak-milestone', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const profileId = typeof body.profileId === 'string' ? body.profileId : '';
  const streakDays = typeof body.streakDays === 'number' ? Math.floor(body.streakDays) : NaN;
  const email = typeof body.email === 'string' ? body.email : undefined;

  if (!profileId) return fail(c, 'bad_request', 'profileId required', 422);
  if (!Number.isFinite(streakDays) || streakDays < 1) {
    return fail(c, 'bad_request', 'streakDays must be a positive integer', 422);
  }
  if (!STREAK_MILESTONES.has(streakDays)) {
    return ok(c, { queued: false, reason: 'not a milestone day' });
  }

  const notification: QueuedNotification = {
    id: id('notify'),
    kind: 'streak.milestone',
    profileId,
    streakDays,
    email,
    queuedAt: new Date().toISOString(),
    delivered: false,
  };
  queue.push(notification);
  if (queue.length > 5_000) queue.splice(0, queue.length - 5_000);

  // Mirror to the event log so the dashboard sees the milestone.
  store.events.push({
    id: id('event'),
    profileId,
    name: 'parent.notify.queued',
    payload: { kind: 'streak.milestone', streakDays, hasEmail: Boolean(email) },
    at: notification.queuedAt,
  });

  return ok(c, { queued: true, notification }, 201);
});

notificationsRoutes.get('/queue', (c) => {
  const limit = Math.min(parseInt(c.req.query('limit') ?? '50', 10), 500);
  const notifications = queue.slice(-limit).reverse();
  return ok(c, { notifications });
});

export function _resetForTests(): void {
  queue.length = 0;
}

export function _streakMilestones(): ReadonlySet<number> {
  return STREAK_MILESTONES;
}
