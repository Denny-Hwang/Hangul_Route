import { beforeEach, describe, expect, it } from 'vitest';
import app from '../index';
import { store } from '../store';

/**
 * Extended coverage of routes not exercised by api-v1.test.ts.
 * Pushes route coverage past the W4 90% target (F-COV-001).
 */

async function setupFamilyAndProfile(): Promise<{ familyId: string; profileId: string }> {
  const fRes = await app.request('/api/auth/family', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });
  const fJson = (await fRes.json()) as { data: { family: { id: string } } };
  const familyId = fJson.data.family.id;

  const pRes = await app.request('/api/profiles', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      familyId,
      displayName: 'Mina',
      ageGroup: '5-7',
      avatar: 'hoya-orange',
    }),
  });
  const pJson = (await pRes.json()) as { data: { profile: { id: string } } };
  return { familyId, profileId: pJson.data.profile.id };
}

describe('extended api-v1 coverage', () => {
  beforeEach(() => store.reset());

  it('auth: family lookup by id returns the family', async () => {
    const created = await app.request('/api/auth/family', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'p@x.com' }),
    });
    const j = (await created.json()) as { data: { family: { id: string } } };
    const got = await app.request(`/api/auth/family/${j.data.family.id}`);
    expect(got.status).toBe(200);
    const body = (await got.json()) as { data: { family: { email: string } } };
    expect(body.data.family.email).toBe('p@x.com');
  });

  it('auth: same email twice returns isNew=false the second time', async () => {
    const first = await app.request('/api/auth/family', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'twice@x.com' }),
    });
    const firstJson = (await first.json()) as { data: { isNew: boolean } };
    expect(firstJson.data.isNew).toBe(true);

    const second = await app.request('/api/auth/family', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'twice@x.com' }),
    });
    const secondJson = (await second.json()) as { data: { isNew: boolean } };
    expect(secondJson.data.isNew).toBe(false);
  });

  it('auth: lookup of unknown family id 404s', async () => {
    const res = await app.request('/api/auth/family/family:does-not-exist');
    expect(res.status).toBe(404);
  });

  it('profiles: GET list filters by familyId', async () => {
    const { familyId } = await setupFamilyAndProfile();
    const res = await app.request(`/api/profiles?familyId=${familyId}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { profiles: Array<{ id: string }> } };
    expect(body.data.profiles).toHaveLength(1);
  });

  it('profiles: GET list rejects missing familyId', async () => {
    const res = await app.request('/api/profiles');
    expect(res.status).toBe(400);
  });

  it('profiles: GET by id returns profile', async () => {
    const { profileId } = await setupFamilyAndProfile();
    const res = await app.request(`/api/profiles/${profileId}`);
    expect(res.status).toBe(200);
  });

  it('profiles: GET by unknown id 404s', async () => {
    const res = await app.request('/api/profiles/profile:nope');
    expect(res.status).toBe(404);
  });

  it('profiles: POST rejects bad ageGroup', async () => {
    const { familyId } = await setupFamilyAndProfile();
    const res = await app.request('/api/profiles', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        familyId,
        displayName: 'X',
        ageGroup: '12-14',
        avatar: 'hoya-orange',
      }),
    });
    expect(res.status).toBe(422);
  });

  it('profiles: POST rejects missing family', async () => {
    const res = await app.request('/api/profiles', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        familyId: 'family:nope',
        displayName: 'X',
        ageGroup: '5-7',
        avatar: 'hoya-orange',
      }),
    });
    expect(res.status).toBe(404);
  });

  it('profiles: POST rejects too-long displayName', async () => {
    const { familyId } = await setupFamilyAndProfile();
    const res = await app.request('/api/profiles', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        familyId,
        displayName: 'a'.repeat(25),
        ageGroup: '5-7',
        avatar: 'hoya-orange',
      }),
    });
    expect(res.status).toBe(422);
  });

  it('profiles: POST rejects missing required fields', async () => {
    const res = await app.request('/api/profiles', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ displayName: 'X' }),
    });
    expect(res.status).toBe(422);
  });

  it('profiles: DELETE removes the profile', async () => {
    const { profileId } = await setupFamilyAndProfile();
    const del = await app.request(`/api/profiles/${profileId}`, { method: 'DELETE' });
    expect(del.status).toBe(200);
    const after = await app.request(`/api/profiles/${profileId}`);
    expect(after.status).toBe(404);
  });

  it('profiles: DELETE of unknown id 404s', async () => {
    const res = await app.request('/api/profiles/profile:nope', { method: 'DELETE' });
    expect(res.status).toBe(404);
  });

  it('progress: GET on unknown profile 404s', async () => {
    const res = await app.request('/api/progress/profile:nope');
    expect(res.status).toBe(404);
  });

  it('progress: PUT on unknown profile 404s', async () => {
    const res = await app.request('/api/progress/profile:nope', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ cards: [] }),
    });
    expect(res.status).toBe(404);
  });

  it('progress: PUT rejects non-object body', async () => {
    const { profileId } = await setupFamilyAndProfile();
    const res = await app.request(`/api/progress/${profileId}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: 'null',
    });
    expect(res.status).toBe(422);
  });

  it('progress: GET on profile with no record returns null', async () => {
    const { profileId } = await setupFamilyAndProfile();
    const res = await app.request(`/api/progress/${profileId}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { progress: null } };
    expect(body.data.progress).toBeNull();
  });

  it('cards: catalog returns at least 5 entries', async () => {
    const res = await app.request('/api/cards/catalog');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { cards: Array<{ id: string }> } };
    expect(body.data.cards.length).toBeGreaterThanOrEqual(5);
  });

  it('cards: unlocked returns cards from progress payload', async () => {
    const { profileId } = await setupFamilyAndProfile();
    await app.request(`/api/progress/${profileId}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        cards: [{ cardId: 'card:tiger', unlockedAt: new Date().toISOString() }],
      }),
    });
    const res = await app.request(`/api/cards/${profileId}/unlocked`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { cards: Array<{ cardId: string }> } };
    expect(body.data.cards[0]?.cardId).toBe('card:tiger');
  });

  it('cards: unlocked 404s on unknown profile', async () => {
    const res = await app.request('/api/cards/profile:nope/unlocked');
    expect(res.status).toBe(404);
  });

  it('telemetry: GET /recent returns posted events newest-first', async () => {
    for (const name of ['session.start', 'quest.complete', 'card.unlocked']) {
      await app.request('/api/telemetry', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name }),
      });
    }
    const res = await app.request('/api/telemetry/recent?limit=2');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { events: Array<{ name: string }> } };
    expect(body.data.events).toHaveLength(2);
    expect(body.data.events[0]?.name).toBe('card.unlocked');
  });
});
