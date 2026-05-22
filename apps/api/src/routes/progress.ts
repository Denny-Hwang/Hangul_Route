import { Hono } from 'hono';
import { fail, ok } from '../envelope';
import { authorizeProfile } from '../lib/auth';
import { store } from '../store';

export const progressRoutes = new Hono();

progressRoutes.get('/:profileId', async (c) => {
  const profileId = c.req.param('profileId');
  const auth = await authorizeProfile(c, profileId);
  if (typeof auth !== 'string') return auth;
  const record = store.progress.get(profileId);
  if (!record) return ok(c, { progress: null });
  return ok(c, { progress: record });
});

progressRoutes.put('/:profileId', async (c) => {
  const profileId = c.req.param('profileId');
  const auth = await authorizeProfile(c, profileId);
  if (typeof auth !== 'string') return auth;
  const payload = await c.req.json().catch(() => null);
  if (payload === null || typeof payload !== 'object') {
    return fail(c, 'bad_request', 'JSON body required', 422);
  }
  const record = {
    profileId,
    updatedAt: new Date().toISOString(),
    payload,
  };
  store.progress.set(profileId, record);
  return ok(c, { progress: record });
});
