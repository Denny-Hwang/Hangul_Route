import { getMessages } from '@hangul-route/i18n';
import type { BrowserContext, Page, Route } from '@playwright/test';
import { expect, test } from './fixtures';
import { onboardChild, readStored, seedStored, unlockWithPin } from './helpers';
import { shot } from './shots';

/**
 * [OA] Who is joining? (AMENDMENTS-ONE-ACCOUNT-MANY-USERS OA-D14, OA-D20, section 10.3; row OA-7b, section 20, CS-11):
 * a family hand-off code on a shared device opens the checklist, and joining a learner other than the active one asks
 * a fresh PIN first. Against a mocked sync API (the family's seats and the learner registration). It needs a bundle
 * built with the API, the chooser and the batch join on (both flags ship off; OA-10 turns them on), so it runs only
 * with `E2E_MULTI_JOIN=1`:
 *
 *   EXPO_PUBLIC_API_BASE_URL=https://api.e2e.invalid EXPO_PUBLIC_WHO_CHOOSER=true EXPO_PUBLIC_MULTI_JOIN=true \
 *     pnpm --filter @hangul-route/mobile build:web
 *   E2E_MULTI_JOIN=1 pnpm --filter @hangul-route/mobile exec playwright test join-batch
 */
test.skip(process.env.E2E_MULTI_JOIN !== '1', 'needs a build with the API, EXPO_PUBLIC_WHO_CHOOSER=true and EXPO_PUBLIC_MULTI_JOIN=true (E2E_MULTI_JOIN=1)');
test.use({ serviceWorkers: 'block', viewport: { width: 320, height: 640 } });

const API = 'https://api.e2e.invalid';
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, content-type', 'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE' };
const JOIN_HANDOFF = 'hr:shell:joinCode';
const SPACE = { id: 'space:kim', kind: 'family', name: 'Kim family' };
const en = getMessages('en');
const join = en.caregiver.join;
const who = join.who;
const WIDE = { width: 1280, height: 800 };

function json(route: Route, status: number, body: unknown): Promise<void> {
  return route.fulfill({ status, contentType: 'application/json', headers: CORS, body: JSON.stringify(body) });
}

/** The mocked Worker: registration, the family lookup, one seat per `/join` (cap 4), the rest quiet. */
async function mockWorker(context: BrowserContext): Promise<{ joins: string[]; registered: string[] }> {
  const calls = { joins: [] as string[], registered: [] as string[] };
  const members = new Set<string>();
  await context.route(`${API}/**`, async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const path = decodeURIComponent(new URL(req.url()).pathname);
    const body = JSON.parse(req.postData() ?? '{}') as { learner?: { id: string }; learnerId?: string };
    if (req.method() === 'POST' && path.endsWith('/learners') && body.learner) {
      calls.registered.push(body.learner.id);
      return json(route, 201, { data: { learner: { id: body.learner.id }, device: { secret: `secret-${calls.registered.length}` } } });
    }
    if (path.endsWith('/spaces/lookup')) return json(route, 200, { data: { space: SPACE, full: false, roster: [] } });
    if (path.endsWith('/join') && body.learnerId) {
      calls.joins.push(body.learnerId);
      const alreadyMember = members.has(body.learnerId);
      if (!alreadyMember && members.size >= 4) return json(route, 409, { ok: false, error: { code: 'cap_family', message: 'm', details: { cap: 4 } } });
      members.add(body.learnerId);
      return json(route, alreadyMember ? 200 : 201, { data: { alreadyMember, membership: { role: 'student', joinedAt: new Date().toISOString() }, space: SPACE } });
    }
    if (path.endsWith('/inbox')) return json(route, 200, { data: { rev: 1, plans: [], memberships: [], notes: [], tier: 'free', serverTime: new Date().toISOString() } });
    if (path.endsWith('/snapshot')) return json(route, 200, { data: { rev: 1 } });
    return json(route, 404, { error: { code: 'not_found' } });
  });
  return calls;
}

/** Mina through onboarding (PIN set), then Joon added to the stored list: a shared family device. */
async function sharedDevice(page: Page): Promise<{ mina: string; joon: string }> {
  await onboardChild(page, { name: 'Mina', startJourney: false });
  const profiles = (await readStored<Array<Record<string, unknown>>>(page, 'profiles')) ?? [];
  const mina = profiles[0]!;
  const joon = { ...mina, id: 'profile:joon0001', displayName: 'Joon', createdAt: new Date().toISOString() };
  await seedStored(page, 'profiles', [...profiles, joon]);
  return { mina: String(mina.id), joon: joon.id };
}

/** The family home's Open the app on this device: its code in this tab's session storage, then the app starts. */
async function handOff(page: Page, code: string): Promise<void> {
  await page.evaluate(([k, v]) => sessionStorage.setItem(k, v), [JOIN_HANDOFF, JSON.stringify({ v: 1, code, at: Date.now() })] as const);
  await page.goto('/');
}

const checkbox = (page: Page, name: string) => page.getByRole('checkbox', { name, exact: true });

test.describe('Who is joining? (CS-11)', () => {
  test('a family hand-off code on a shared device opens the checklist; picking another learner asks a fresh PIN', async ({ page, context }) => {
    const calls = await mockWorker(context);
    const ids = await sharedDevice(page);
    await handOff(page, 'FAM234');

    // The launch took the code for the checklist: no chooser, Join looked the code up at once.
    await expect(page.getByRole('heading', { name: who.title, exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: en.learner.who.title, exact: true })).toHaveCount(0);
    await expect(page.getByText(join.bubble.found(SPACE.name))).toBeVisible();
    await expect(checkbox(page, 'Mina')).toHaveAttribute('aria-checked', 'true');
    await expect(checkbox(page, 'Joon')).toHaveAttribute('aria-checked', 'false');
    // Never in the address (OA-D20).
    expect(page.url()).not.toContain('FAM234');
    expect(await page.evaluate((k) => sessionStorage.getItem(k), JOIN_HANDOFF)).toBeNull();
    await shot(page, 'join-batch-checklist-320');
    await page.setViewportSize(WIDE);
    await shot(page, 'join-batch-checklist-wide');
    await page.setViewportSize({ width: 320, height: 640 });

    // CS-11: Joon is not the active learner, so Next asks the PIN first.
    await checkbox(page, 'Joon').click();
    await expect(checkbox(page, 'Joon')).toHaveAttribute('aria-checked', 'true');
    await page.getByRole('button', { name: en.common.buttons.next, exact: true }).click();
    await unlockWithPin(page);

    // The name step once per picked learner, then the one consent step naming both.
    for (const name of ['Mina', 'Joon']) {
      await expect(page.getByTestId('join-name')).toHaveValue(name);
      await page.getByRole('button', { name: join.confirm.me.cta, exact: true }).click();
    }
    await expect(page.getByText(who.consentLine('Mina'), { exact: true })).toBeVisible();
    await expect(page.getByText(who.consentLine('Joon'), { exact: true })).toBeVisible();
    expect(calls.joins).toEqual([]);
    await shot(page, 'join-batch-consent-320');
    await page.setViewportSize(WIDE);
    await shot(page, 'join-batch-consent-wide');
    await page.setViewportSize({ width: 320, height: 640 });
    await page.getByRole('button', { name: who.consentYes, exact: true }).click();

    await expect(page.getByRole('heading', { name: who.result(2, 2), exact: true })).toBeVisible();
    await expect(page.getByText(who.joined('Mina'), { exact: true })).toBeVisible();
    await expect(page.getByText(who.joined('Joon'), { exact: true })).toBeVisible();
    expect(calls.joins).toEqual([ids.mina, ids.joon]);
    // Joon never synced before: the consent covered its registration.
    expect(calls.registered).toContain(ids.joon);
    await shot(page, 'join-batch-results-320');
    await page.setViewportSize(WIDE);
    await shot(page, 'join-batch-results-wide');
  });

  test('joining only the active learner asks no PIN, as today', async ({ page, context }) => {
    const calls = await mockWorker(context);
    const ids = await sharedDevice(page);
    await handOff(page, 'FAM234');
    await expect(page.getByRole('heading', { name: who.title, exact: true })).toBeVisible();
    await page.getByRole('button', { name: en.common.buttons.next, exact: true }).click();
    await expect(page.getByTestId('join-name')).toHaveValue('Mina');
    await expect(page.getByText('Enter your 4-digit PIN to continue.')).toHaveCount(0);
    await page.getByRole('button', { name: join.confirm.me.cta, exact: true }).click();
    await page.getByRole('button', { name: who.consentYes, exact: true }).click();
    await expect(page.getByRole('heading', { name: who.result(1, 1), exact: true })).toBeVisible();
    expect(calls.joins).toEqual([ids.mina]);
  });
});
