import { beforeEach, describe, expect, it } from 'vitest';
import app from '../index';
import { _resetForTests, _streakMilestones } from '../routes/notifications';

describe('POST /api/notifications/parent/streak-milestone', () => {
  beforeEach(() => {
    _resetForTests();
  });

  it('queues a notification on a recognized milestone day', async () => {
    const res = await app.request('/api/notifications/parent/streak-milestone', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ profileId: 'p1', streakDays: 7, email: 'parent@example.com' }),
    });
    expect(res.status).toBe(201);
    const json = (await res.json()) as {
      data: { queued: boolean; notification: { kind: string; streakDays: number } };
    };
    expect(json.data.queued).toBe(true);
    expect(json.data.notification.kind).toBe('streak.milestone');
    expect(json.data.notification.streakDays).toBe(7);
  });

  it('returns queued=false on a non-milestone day (no spam)', async () => {
    const res = await app.request('/api/notifications/parent/streak-milestone', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ profileId: 'p1', streakDays: 4 }),
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { data: { queued: boolean } };
    expect(json.data.queued).toBe(false);
  });

  it('rejects requests missing profileId', async () => {
    const res = await app.request('/api/notifications/parent/streak-milestone', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ streakDays: 7 }),
    });
    expect(res.status).toBe(422);
  });

  it('rejects negative or non-integer streakDays', async () => {
    for (const bad of [-1, 0, NaN, 'seven']) {
      const res = await app.request('/api/notifications/parent/streak-milestone', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ profileId: 'p1', streakDays: bad }),
      });
      expect(res.status).toBe(422);
    }
  });

  it('milestones cover the canonical retention checkpoints', () => {
    const milestones = _streakMilestones();
    for (const day of [3, 7, 14, 30, 60, 90, 180, 365]) {
      expect(milestones.has(day)).toBe(true);
    }
  });

  it('GET /api/notifications/queue returns queued items newest-first', async () => {
    for (const days of [3, 7, 14]) {
      await app.request('/api/notifications/parent/streak-milestone', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ profileId: 'p1', streakDays: days }),
      });
    }
    const res = await app.request('/api/notifications/queue?limit=10');
    const json = (await res.json()) as {
      data: { notifications: Array<{ streakDays: number }> };
    };
    expect(json.data.notifications).toHaveLength(3);
    expect(json.data.notifications[0]?.streakDays).toBe(14);
    expect(json.data.notifications[2]?.streakDays).toBe(3);
  });
});

describe('telemetry — new launch event names', () => {
  it('accepts onboarding.started', async () => {
    const res = await app.request('/api/telemetry', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'onboarding.started', profileId: 'p1' }),
    });
    expect(res.status).toBe(201);
  });

  it('accepts card.first_earned', async () => {
    const res = await app.request('/api/telemetry', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'card.first_earned', profileId: 'p1' }),
    });
    expect(res.status).toBe(201);
  });

  it('accepts minigame.finished', async () => {
    const res = await app.request('/api/telemetry', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'minigame.finished', profileId: 'p1' }),
    });
    expect(res.status).toBe(201);
  });
});
