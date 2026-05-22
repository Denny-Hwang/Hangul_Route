import { beforeEach, describe, expect, it } from 'vitest';
import app from '../index';
import { store } from '../store';

async function createFamily(): Promise<string> {
  const res = await app.request('/api/auth/family', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'parent@example.com' }),
  });
  const json = (await res.json()) as { data: { family: { id: string } } };
  return json.data.family.id;
}

describe('apps/api subscriptions (F-INFRA-002)', () => {
  beforeEach(() => store.reset());

  it('returns a default "none" subscription for a new family', async () => {
    const familyId = await createFamily();
    const res = await app.request(`/api/subscriptions/${familyId}`);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { data: { subscription: { status: string; plan: null } } };
    expect(json.data.subscription.status).toBe('none');
    expect(json.data.subscription.plan).toBeNull();
  });

  it('round-trips an active subscription', async () => {
    const familyId = await createFamily();
    const put = await app.request(`/api/subscriptions/${familyId}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        status: 'active',
        plan: 'yearly',
        store: 'apple',
        expiresAt: '2027-05-22T00:00:00.000Z',
      }),
    });
    expect(put.status).toBe(200);

    const get = await app.request(`/api/subscriptions/${familyId}`);
    const json = (await get.json()) as {
      data: { subscription: { status: string; plan: string; store: string; expiresAt: string } };
    };
    expect(json.data.subscription.status).toBe('active');
    expect(json.data.subscription.plan).toBe('yearly');
    expect(json.data.subscription.store).toBe('apple');
    expect(json.data.subscription.expiresAt).toBe('2027-05-22T00:00:00.000Z');
  });

  it('rejects an invalid status', async () => {
    const familyId = await createFamily();
    const res = await app.request(`/api/subscriptions/${familyId}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'platinum' }),
    });
    expect(res.status).toBe(422);
  });

  it('rejects an invalid plan', async () => {
    const familyId = await createFamily();
    const res = await app.request(`/api/subscriptions/${familyId}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'active', plan: 'weekly' }),
    });
    expect(res.status).toBe(422);
  });

  it('404s for an unknown family on GET and PUT', async () => {
    const get = await app.request('/api/subscriptions/family:nope');
    expect(get.status).toBe(404);

    const put = await app.request('/api/subscriptions/family:nope', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'active' }),
    });
    expect(put.status).toBe(404);
  });
});
