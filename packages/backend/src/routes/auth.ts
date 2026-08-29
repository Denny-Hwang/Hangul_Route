import { Hono } from 'hono';
import { fail, ok } from '../envelope';
import { getAuthUserId } from '../lib/auth';
import { id, store, type Family } from '../store';

export const authRoutes = new Hono();

/**
 * POST /api/auth/family — create a family or fetch by email.
 * Records ownerId from the authenticated parent (Clerk) when present.
 * Single-tenant + local-first; auth is optional and used only for cloud sync.
 */
authRoutes.post('/family', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const email = typeof body.email === 'string' ? body.email : undefined;
  const parentPinHash = typeof body.parentPinHash === 'string' ? body.parentPinHash : undefined;
  const ownerId = (await getAuthUserId(c)) ?? undefined;

  if (email) {
    const existing = [...store.families.values()].find((f) => f.email === email);
    if (existing) return ok(c, { family: existing, isNew: false });
  }

  const family: Family = {
    id: id('family'),
    email,
    parentPinHash,
    ownerId,
    createdAt: new Date().toISOString(),
  };
  store.families.set(family.id, family);
  return ok(c, { family, isNew: true }, 201);
});

authRoutes.get('/family/:id', (c) => {
  const family = store.families.get(c.req.param('id'));
  if (!family) return fail(c, 'not_found', 'Family not found', 404);
  return ok(c, { family });
});
