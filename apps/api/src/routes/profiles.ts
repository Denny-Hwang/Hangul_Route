import { Hono } from 'hono';
import { fail, ok } from '../envelope';
import { id, store, type Profile } from '../store';

export const profileRoutes = new Hono();

const AGE_GROUPS = new Set(['5-7', '8-9', '10-11']);

profileRoutes.get('/', (c) => {
  const familyId = c.req.query('familyId');
  if (!familyId) return fail(c, 'bad_request', 'familyId query param required', 400);
  const profiles = [...store.profiles.values()].filter((p) => p.familyId === familyId);
  return ok(c, { profiles });
});

profileRoutes.get('/:id', (c) => {
  const p = store.profiles.get(c.req.param('id'));
  if (!p) return fail(c, 'not_found', 'Profile not found', 404);
  return ok(c, { profile: p });
});

profileRoutes.post('/', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { familyId, displayName, ageGroup, avatar } = body as Partial<Profile>;
  if (!familyId || !displayName || !ageGroup || !avatar) {
    return fail(c, 'bad_request', 'familyId, displayName, ageGroup, avatar required', 422);
  }
  if (!store.families.has(familyId)) {
    return fail(c, 'not_found', 'Family not found', 404);
  }
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

profileRoutes.delete('/:id', (c) => {
  const deleted = store.profiles.delete(c.req.param('id'));
  if (!deleted) return fail(c, 'not_found', 'Profile not found', 404);
  return ok(c, { deleted: true });
});
