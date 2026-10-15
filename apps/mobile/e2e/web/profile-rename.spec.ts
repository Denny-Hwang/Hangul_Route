import type { BrowserContext, Page, Route } from '@playwright/test';
import { expect, test } from './fixtures';
import { onboardSelf, readStored, seedStored } from './helpers';
import { shot } from './shots';

/**
 * F-LEARN-001 section 3.11: the learner's one name. A learner "test" in a class renames to "Sungjoo" in Edit profile:
 * Home greets the new name, and the next sync sends only the name (with its time) to
 * `PATCH /api/sync/learners/:id`, the route the teacher and family consoles read through (the Worker's
 * learner-rename integration test and the console's learner-rename e2e cover the rest of the way). A join under a
 * changed name makes it the profile name. On a class device the name, level and cub rows are closed. Against a
 * mocked sync API; the same build as class-update.spec.ts:
 *
 *   EXPO_PUBLIC_API_BASE_URL=https://api.e2e.invalid npx expo export --platform web --output-dir dist --clear
 *   E2E_TRANSFER=1 pnpm --filter @hangul-route/mobile exec playwright test profile-rename
 */
test.use({ serviceWorkers: 'block', viewport: { width: 375, height: 740 } });
test.skip(process.env.E2E_TRANSFER !== '1', 'needs a build with EXPO_PUBLIC_API_BASE_URL=https://api.e2e.invalid');

const API = 'https://api.e2e.invalid';
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, content-type', 'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE' };
const CLASS = { spaceId: 'space:kpccw', kind: 'class', name: 'Kpccw class1', role: 'student', joinedAt: '2026-10-10T00:00:00.000Z' };

interface Call {
  method: string;
  url: string;
  path: string;
  body: Record<string, unknown> | null;
}

const json = (route: Route, status: number, body: unknown): Promise<void> => route.fulfill({ status, contentType: 'application/json', headers: CORS, body: JSON.stringify(body) });

/** `inClass`: the inbox lists the class from the start (the learner joined before); otherwise only after a join. */
async function mockApi(context: BrowserContext, scope: 'full' | 'class', inClass: boolean): Promise<Call[]> {
  const calls: Call[] = [];
  let joined = inClass;
  await context.route(`${API}/**`, async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const path = decodeURIComponent(new URL(req.url()).pathname);
    const body = req.postData() ? (JSON.parse(req.postData() ?? '{}') as Record<string, unknown>) : null;
    calls.push({ method: req.method(), url: req.url(), path, body });
    if (path.endsWith('/inbox')) {
      return json(route, 200, { data: { rev: 1, plans: [], memberships: joined ? [CLASS] : [], tier: 'free', serverTime: new Date().toISOString(), deviceScope: scope } });
    }
    if (req.method() === 'PATCH' && /\/api\/sync\/learners\/[^/]+$/.test(path)) {
      if (scope === 'class') return json(route, 403, { error: { code: 'scope_limited' } });
      return json(route, 200, { data: { learner: { id: path.split('/').pop(), displayName: body?.displayName, ageGroup: '5-7', avatar: 'hoya-orange' }, applied: true } });
    }
    if (path.endsWith('/spaces/lookup')) return json(route, 200, { data: { space: { id: CLASS.spaceId, kind: 'class', name: CLASS.name }, full: false, roster: [] } });
    if (path.endsWith('/join')) {
      joined = true;
      return json(route, 201, { data: { alreadyMember: false, membership: { role: 'student', joinedAt: CLASS.joinedAt }, space: { id: CLASS.spaceId, kind: 'class', name: CLASS.name } } });
    }
    if (path.endsWith('/snapshot')) return json(route, 200, { data: { rev: 1 } });
    return json(route, 404, { error: { code: 'not_found' } });
  });
  return calls;
}

/** A synced learner (a device secret) whose one-time profile repair already ran, in a class when `inClass`. */
async function seedSynced(page: Page, inClass: boolean): Promise<string> {
  const profiles = await readStored<Array<{ id: string }>>(page, 'profiles');
  const id = profiles?.[0]?.id;
  if (!id) throw new Error('no profile');
  await seedStored(page, 'profilePushedV1', true);
  if (inClass) await seedStored(page, `memberships:${id}`, [CLASS]);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await seedStored(page, `sync:${id}`, { secret: 'secret-e2e', rev: 1, lastSyncedAt: new Date().toISOString(), rescueCode: null, pendingProfile: null, profileAt: null });
    const stored = await readStored<{ secret: string | null }>(page, `sync:${id}`);
    if (stored?.secret === 'secret-e2e') return id;
  }
  throw new Error('the seeded sync state did not stick');
}

async function openEdit(page: Page, name: string): Promise<void> {
  await page.goto('/');
  await expect(page.getByText(`Hi, ${name}!`)).toBeVisible();
  await page.addLocatorHandler(page.getByTestId('install-guide'), async (guide) => {
    await guide.getByRole('button', { name: 'Not now' }).click();
  });
  await page.getByRole('button', { name: 'Profile and settings' }).click();
  await page.getByRole('button', { name: `Edit ${name}`, exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Edit profile' })).toBeVisible();
}

const patches = (calls: Call[]): Call[] => calls.filter((c) => c.method === 'PATCH' && /\/api\/sync\/learners\/[^/]+$/.test(c.path));

test('a learner in a class renames "test" to "Sungjoo": Home greets the new name, the PATCH carries the name only', async ({ page, context }) => {
  const calls = await mockApi(context, 'full', true);
  await onboardSelf(page, { name: 'test' });
  const id = await seedSynced(page, true);
  await openEdit(page, 'test');

  // The class hint is true now: the list follows with the next connection, nobody has to join again.
  await expect(page.getByText("Your teacher's list updates the next time you're online.")).toBeVisible();
  await expect(page.getByText(/join again/i)).toHaveCount(0);
  await shot(page, 'profile-rename-edit-375');

  await page.getByRole('textbox', { name: 'Name' }).fill('Sungjoo');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name: 'Profiles & settings' })).toBeVisible();

  // The edit waits on the device (sync debounce); the next sync, here the app start, sends it.
  await expect
    .poll(async () => (await readStored<{ pendingProfile: { fields: Record<string, unknown> } | null }>(page, `sync:${id}`))?.pendingProfile?.fields)
    .toEqual({ displayName: 'Sungjoo' });
  await page.goto('/');
  await expect(page.getByText('Hi, Sungjoo!')).toBeVisible();

  await expect.poll(() => patches(calls).length, { timeout: 15_000 }).toBeGreaterThan(0);
  const patch = patches(calls).at(-1)!;
  expect(patch.path).toBe(`/api/sync/learners/${id}`);
  // Nothing else private: only the name and its time, never who is learning, a PIN or consent; no name in the URL.
  expect(Object.keys(patch.body ?? {}).sort()).toEqual(['at', 'displayName']);
  expect(patch.body?.displayName).toBe('Sungjoo');
  expect(patch.url).not.toContain('Sungjoo');
  for (const call of calls.filter((c) => c !== patch)) expect(JSON.stringify(call.body ?? {})).not.toContain('Sungjoo');
  // Sent once: the answer cleared the waiting edit.
  await expect.poll(async () => (await readStored<{ pendingProfile: unknown }>(page, `sync:${id}`))?.pendingProfile ?? null).toBeNull();
  await shot(page, 'profile-rename-home-375');
});

test('a join under a changed name makes it the profile name, and the field says it is the same everywhere', async ({ page, context }) => {
  const calls = await mockApi(context, 'full', false);
  await onboardSelf(page, { name: 'test' });
  await seedSynced(page, false);
  await page.goto('/');
  await expect(page.getByText('Hi, test!')).toBeVisible();
  await page.addLocatorHandler(page.getByTestId('install-guide'), async (guide) => {
    await guide.getByRole('button', { name: 'Not now' }).click();
  });
  await page.getByRole('button', { name: 'Profile and settings' }).click();
  await page.getByRole('button', { name: 'Join a class' }).click();
  await page.getByLabel('Class code').fill('K7M2X9');
  await page.getByRole('button', { name: 'Join', exact: true }).click();

  const field = page.getByLabel('Name your teacher will see');
  await expect(field).toHaveValue('test');
  await expect(field).toHaveAttribute('autocapitalize', 'words');
  await expect(page.getByText('This name is the same everywhere, not just here.')).toBeVisible();

  // The profile rule, with the create form's calm hint: a character it refuses keeps the button closed.
  await field.fill('Sungjoo!');
  await expect(page.getByText("Please use letters, numbers, spaces, ' or -.")).toBeVisible();
  await expect(page.getByRole('button', { name: "That's me" })).toBeDisabled();
  await field.fill('Sungjoo');
  await shot(page, 'profile-rename-join-375');
  await page.getByRole('button', { name: "That's me" }).click();
  await expect(page.getByTestId('join-done')).toBeVisible();

  const join = calls.find((c) => c.path.endsWith('/join'));
  expect(join?.body?.displayName).toBe('Sungjoo');
  await expect.poll(async () => (await readStored<Array<{ displayName: string }>>(page, 'profiles'))?.[0]?.displayName).toBe('Sungjoo');
  await page.goto('/');
  await expect(page.getByText('Hi, Sungjoo!')).toBeVisible();
});

test('on a class device the name, level and cub rows are closed, with who can change them', async ({ page, context }) => {
  await mockApi(context, 'class', true);
  await onboardSelf(page, { name: 'test' });
  await seedSynced(page, true);
  // The inbox says this device holds a class credential; the app marks it on its first read.
  await page.goto('/');
  await expect(page.getByText('Hi, test!')).toBeVisible();
  await page.waitForTimeout(1500);
  await openEdit(page, 'test');

  await expect(page.getByTestId('edit-class-device')).toHaveText("A grown-up can change the name, level and Hoya on the learner's own device.");
  await expect(page.getByRole('textbox', { name: 'Name' })).not.toBeEditable();
  await expect(page.getByRole('radio', { name: 'Home Tiger' })).toBeDisabled();
  // The class roster line would promise an update this device cannot send.
  await expect(page.getByText("Your teacher's list updates the next time you're online.")).toHaveCount(0);
  await shot(page, 'profile-rename-class-device-375');
});
