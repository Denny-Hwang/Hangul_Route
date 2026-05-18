import { beforeEach, describe, expect, it } from 'vitest';
import app from '../index';
import { store } from '../store';

describe('apps/api v1 router', () => {
  beforeEach(() => {
    store.reset();
  });

  it('creates a family then a profile', async () => {
    const familyRes = await app.request('/api/auth/family', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'parent@example.com' }),
    });
    expect(familyRes.status).toBe(201);
    const familyJson = (await familyRes.json()) as { ok: boolean; data: { family: { id: string } } };
    expect(familyJson.ok).toBe(true);
    const familyId = familyJson.data.family.id;

    const profileRes = await app.request('/api/profiles', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        familyId,
        displayName: 'Mina',
        ageGroup: '5-7',
        avatar: 'hoya-orange',
      }),
    });
    expect(profileRes.status).toBe(201);
    const profileJson = (await profileRes.json()) as { ok: boolean; data: { profile: { id: string; familyId: string } } };
    expect(profileJson.data.profile.familyId).toBe(familyId);
  });

  it('rejects unknown telemetry event names', async () => {
    const res = await app.request('/api/telemetry', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'unknown.event' }),
    });
    expect(res.status).toBe(422);
  });

  it('accepts a known telemetry event', async () => {
    const res = await app.request('/api/telemetry', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'quest.complete', profileId: 'profile:test', payload: { questId: 'quest:x' } }),
    });
    expect(res.status).toBe(201);
  });

  it('returns the content catalogs', async () => {
    const stages = await app.request('/api/content/stages');
    const themes = await app.request('/api/content/themes');
    const jamo = await app.request('/api/content/jamo');
    expect(stages.status).toBe(200);
    expect(themes.status).toBe(200);
    expect(jamo.status).toBe(200);
  });

  it('progress put + get round-trips for an existing profile', async () => {
    // Set up family + profile
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
        displayName: 'Jun',
        ageGroup: '8-9',
        avatar: 'hoya-blue',
      }),
    });
    const pJson = (await pRes.json()) as { data: { profile: { id: string } } };
    const profileId = pJson.data.profile.id;

    const put = await app.request(`/api/progress/${profileId}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ quests: [{ questId: 'quest:x', stars: 3 }] }),
    });
    expect(put.status).toBe(200);

    const get = await app.request(`/api/progress/${profileId}`);
    expect(get.status).toBe(200);
    const getJson = (await get.json()) as {
      data: { progress: { payload: { quests: Array<{ stars: number }> } } };
    };
    expect(getJson.data.progress.payload.quests[0]?.stars).toBe(3);
  });

  it('unknown routes return 404 envelope', async () => {
    const res = await app.request('/api/nope');
    expect(res.status).toBe(404);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(false);
  });
});
