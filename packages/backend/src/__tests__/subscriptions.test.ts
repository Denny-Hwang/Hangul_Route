import { beforeEach, describe, expect, it } from 'vitest';
import app from '../index';
import { store } from '../store';

const OWNER = 'user_owner';
const OTHER = 'user_intruder';
const headers = (token: string): Record<string, string> => ({
  'content-type': 'application/json',
  authorization: `Bearer ${token}`,
});

let familySeq = 0;
async function createFamily(token = OWNER): Promise<string> {
  familySeq += 1;
  const res = await app.request('/api/auth/family', {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ email: `parent-${familySeq}@example.com` }),
  });
  const body = (await res.json()) as { data: { family: { id: string } } };
  return body.data.family.id;
}

async function activate(familyId: string, token = OWNER): Promise<void> {
  await app.request(`/api/subscriptions/${familyId}/verify`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({
      store: 'apple',
      receipt: JSON.stringify({ plan: 'monthly', expiresAt: '2027-01-01T00:00:00.000Z' }),
    }),
  });
}

describe('apps/api subscriptions (F-INFRA-002 / F-IAP-001 / F-IAP-003 / F-AUTH-001)', () => {
  beforeEach(() => store.reset());

  it('returns a default "none" subscription for the owner', async () => {
    const familyId = await createFamily();
    const res = await app.request(`/api/subscriptions/${familyId}`, { headers: headers(OWNER) });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { subscription: { status: string; plan: null } } };
    expect(body.data.subscription.status).toBe('none');
    expect(body.data.subscription.plan).toBeNull();
  });

  it('round-trips an active subscription', async () => {
    const familyId = await createFamily();
    const put = await app.request(`/api/subscriptions/${familyId}`, {
      method: 'PUT',
      headers: headers(OWNER),
      body: JSON.stringify({ status: 'active', plan: 'yearly', store: 'apple', expiresAt: '2027-05-22T00:00:00.000Z' }),
    });
    expect(put.status).toBe(200);

    const get = await app.request(`/api/subscriptions/${familyId}`, { headers: headers(OWNER) });
    const body = (await get.json()) as {
      data: { subscription: { status: string; plan: string; store: string; expiresAt: string } };
    };
    expect(body.data.subscription.status).toBe('active');
    expect(body.data.subscription.plan).toBe('yearly');
    expect(body.data.subscription.store).toBe('apple');
    expect(body.data.subscription.expiresAt).toBe('2027-05-22T00:00:00.000Z');
  });

  it('rejects an invalid status', async () => {
    const familyId = await createFamily();
    const res = await app.request(`/api/subscriptions/${familyId}`, {
      method: 'PUT',
      headers: headers(OWNER),
      body: JSON.stringify({ status: 'platinum' }),
    });
    expect(res.status).toBe(422);
  });

  it('rejects an invalid plan', async () => {
    const familyId = await createFamily();
    const res = await app.request(`/api/subscriptions/${familyId}`, {
      method: 'PUT',
      headers: headers(OWNER),
      body: JSON.stringify({ status: 'active', plan: 'weekly' }),
    });
    expect(res.status).toBe(422);
  });

  it('verifies a receipt and activates the subscription', async () => {
    const familyId = await createFamily();
    const res = await app.request(`/api/subscriptions/${familyId}/verify`, {
      method: 'POST',
      headers: headers(OWNER),
      body: JSON.stringify({
        store: 'apple',
        receipt: JSON.stringify({ plan: 'yearly', expiresAt: '2027-05-22T00:00:00.000Z' }),
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { subscription: { status: string; plan: string } } };
    expect(body.data.subscription.status).toBe('active');
    expect(body.data.subscription.plan).toBe('yearly');
  });

  it('rejects verify with invalid store or empty receipt', async () => {
    const familyId = await createFamily();
    const badStore = await app.request(`/api/subscriptions/${familyId}/verify`, {
      method: 'POST',
      headers: headers(OWNER),
      body: JSON.stringify({ store: 'amazon', receipt: 'x' }),
    });
    expect(badStore.status).toBe(422);

    const emptyReceipt = await app.request(`/api/subscriptions/${familyId}/verify`, {
      method: 'POST',
      headers: headers(OWNER),
      body: JSON.stringify({ store: 'apple', receipt: '' }),
    });
    expect(emptyReceipt.status).toBe(422);
  });

  it('rejects an unverifiable receipt', async () => {
    const familyId = await createFamily();
    const res = await app.request(`/api/subscriptions/${familyId}/verify`, {
      method: 'POST',
      headers: headers(OWNER),
      body: JSON.stringify({ store: 'apple', receipt: 'garbage-not-json' }),
    });
    expect(res.status).toBe(422);
  });

  it('marks cancelled on a cancel event but keeps the expiry', async () => {
    const familyId = await createFamily();
    await activate(familyId);
    const res = await app.request(`/api/subscriptions/${familyId}/event`, {
      method: 'POST',
      headers: headers(OWNER),
      body: JSON.stringify({ event: 'cancelled' }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { subscription: { status: string; expiresAt: string } } };
    expect(body.data.subscription.status).toBe('cancelled');
    expect(body.data.subscription.expiresAt).toBe('2027-01-01T00:00:00.000Z');
  });

  it('updates expiry on a renewal event', async () => {
    const familyId = await createFamily();
    await activate(familyId);
    const res = await app.request(`/api/subscriptions/${familyId}/event`, {
      method: 'POST',
      headers: headers(OWNER),
      body: JSON.stringify({ event: 'renewed', expiresAt: '2028-01-01T00:00:00.000Z' }),
    });
    const body = (await res.json()) as { data: { subscription: { status: string; expiresAt: string } } };
    expect(body.data.subscription.status).toBe('active');
    expect(body.data.subscription.expiresAt).toBe('2028-01-01T00:00:00.000Z');
  });

  it('expires on an expired event', async () => {
    const familyId = await createFamily();
    await activate(familyId);
    const res = await app.request(`/api/subscriptions/${familyId}/event`, {
      method: 'POST',
      headers: headers(OWNER),
      body: JSON.stringify({ event: 'expired' }),
    });
    const body = (await res.json()) as { data: { subscription: { status: string } } };
    expect(body.data.subscription.status).toBe('expired');
  });

  it('rejects an invalid event and a family with no subscription', async () => {
    const familyId = await createFamily();
    await activate(familyId);
    const badEvent = await app.request(`/api/subscriptions/${familyId}/event`, {
      method: 'POST',
      headers: headers(OWNER),
      body: JSON.stringify({ event: 'exploded' }),
    });
    expect(badEvent.status).toBe(422);

    const noSub = await createFamily();
    const noSubRes = await app.request(`/api/subscriptions/${noSub}/event`, {
      method: 'POST',
      headers: headers(OWNER),
      body: JSON.stringify({ event: 'renewed' }),
    });
    expect(noSubRes.status).toBe(422);
  });

  it('requires a bearer token (401)', async () => {
    const familyId = await createFamily();
    const res = await app.request(`/api/subscriptions/${familyId}`);
    expect(res.status).toBe(401);
  });

  it('forbids a non-owner from reading (403)', async () => {
    const familyId = await createFamily(OWNER);
    const res = await app.request(`/api/subscriptions/${familyId}`, { headers: headers(OTHER) });
    expect(res.status).toBe(403);
  });

  it('forbids a non-owner from mutating (403)', async () => {
    const familyId = await createFamily(OWNER);
    const res = await app.request(`/api/subscriptions/${familyId}`, {
      method: 'PUT',
      headers: headers(OTHER),
      body: JSON.stringify({ status: 'active' }),
    });
    expect(res.status).toBe(403);
  });

  it('404s an unknown family for the authenticated caller', async () => {
    const res = await app.request('/api/subscriptions/family:nope', { headers: headers(OWNER) });
    expect(res.status).toBe(404);
  });
});
