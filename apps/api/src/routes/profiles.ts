import { Hono } from 'hono';
import { fail, ok } from '../envelope';
import { authorizeFamily, authorizeProfile } from '../lib/auth';
import { id, store, type Profile } from '../store';

export const profileRoutes = new Hono();

const AGE_GROUPS = new Set(['5-7', '8-9', '10-11']);

profileRoutes.get('/', async (c) => {
  const familyId = c.req.query('familyId');
  if (!familyId) return fail(c, 'bad_request', 'familyId query param required', 400);
  const auth = await authorizeFamily(c, familyId);
  if (typeof auth !== 'string') return auth;
  const profiles = [...store.profiles.values()].filter((p) => p.familyId === familyId);
  return ok(c, { profiles });
});

profileRoutes.get('/:id', async (c) => {
  const profileId = c.req.param('id');
  const auth = await authorizeProfile(c, profileId);
  if (typeof auth !== 'string') return auth;
  const p = store.profiles.get(profileId);
  if (!p) return fail(c, 'not_found', 'Profile not found', 404);
  return ok(c, { profile: p });
});

profileRoutes.post('/', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { familyId, displayName, ageGroup, avatar } = body as Partial<Profile>;
  if (!familyId || !displayName || !ageGroup || !avatar) {
    return fail(c, 'bad_request', 'familyId, displayName, ageGroup, avatar required', 422);
  }
  const auth = await authorizeFamily(c, familyId);
  if (typeof auth !== 'string') return auth;
  if (!AGE_GROUPS.has(ageGroup)) {
    return fail(c, 'bad_request', 'ageGroup must be 5-7, 8-9, or 10-11', 422);
  }
  if (displayName.length < 1 || displayName.length > 20) {
    return fail(c, 'bad_request', 'displayName must be 1-20 chars', 422);
  }
  const now = new Date().toISOString();
  const profile: Profile = {
    id: id('profile'),
    familyId,
    displayName,
    ageGroup,
    avatar,
    createdAt: now,
    lastActiveAt: now,
  };
  store.profiles.set(profile.id, profile);
  return ok(c, { profile }, 201);
});

profileRoutes.delete('/:id', async (c) => {
  const profileId = c.req.param('id');
  const auth = await authorizeProfile(c, profileId);
  if (typeof auth !== 'string') return auth;
  store.profiles.delete(profileId);
  return ok(c, { deleted: true });
});
