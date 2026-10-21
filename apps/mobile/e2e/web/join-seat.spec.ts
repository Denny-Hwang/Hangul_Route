import { getMessages } from '@hangul-route/i18n';
import type { BrowserContext, Page, Route } from '@playwright/test';
import { expect, test } from './fixtures';
import { onboardChild, readStored, seedStored } from './helpers';
import { shot } from './shots';

/**
 * [SA] AMENDMENTS-SEATS-ADMINS section 3.4 (row SA-5): Join a class at a learner cap, against a mocked sync API. The
 * lookup carries the learner with the device header; its `seat` picks the line (a full family, class or school), and
 * at a full class with a roster the roster pick and relink stay on screen with the line above "I'm new". A `/join`
 * refusal reads its own code: `cap_class` with `details.reason: 'cap_school'` is the school line. The release build
 * has no API, so nothing here shows there. Recipe (the same build as `transfer-moves.spec.ts`):
 *
 *   EXPO_PUBLIC_API_BASE_URL=https://api.e2e.invalid npx expo export --platform web --output-dir dist --clear
 *   E2E_TRANSFER=1 pnpm --filter @hangul-route/mobile exec playwright test join-seat
 */
test.use({ serviceWorkers: 'block', viewport: { width: 320, height: 640 } });
test.skip(process.env.E2E_TRANSFER !== '1', 'needs a build with EXPO_PUBLIC_API_BASE_URL=https://api.e2e.invalid');

const API = 'https://api.e2e.invalid';
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, content-type', 'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE' };
const join = getMessages('en').caregiver.join;
const WIDE = { width: 1280, height: 800 };

interface Lookup {
  space: { id: string; kind: 'family' | 'class'; name: string };
  seat: { full: boolean; reason: 'cap_family' | 'cap_class' | 'cap_school' | null; cap: number | null } | null;
  roster?: { learnerId: string; name: string }[];
}

interface Calls {
  lookups: { body: unknown; authorization: string | undefined }[];
}

function json(route: Route, status: number, body: unknown): Promise<void> {
  return route.fulfill({ status, contentType: 'application/json', headers: CORS, body: JSON.stringify(body) });
}

async function mockApi(context: BrowserContext, lookup: Lookup, joinRefusal?: { code: string; details: unknown }): Promise<Calls> {
  const calls: Calls = { lookups: [] };
  await context.route(`${API}/**`, async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const path = decodeURIComponent(new URL(req.url()).pathname);
    if (path.endsWith('/spaces/lookup')) {
      calls.lookups.push({ body: JSON.parse(req.postData() ?? '{}') as unknown, authorization: req.headers().authorization });
      const data: Record<string, unknown> = { space: lookup.space, full: false, roster: lookup.roster ?? [] };
      if (lookup.seat) data.seat = lookup.seat;
      return json(route, 200, { data });
    }
    if (path.endsWith('/join') && joinRefusal) return json(route, 409, { ok: false, error: { code: joinRefusal.code, message: 'm', details: joinRefusal.details } });
    if (path.endsWith('/relink-requests')) return json(route, 201, { data: { request: { id: 'relink:1', expiresAt: new Date(Date.now() + 600_000).toISOString() } } });
    if (path.includes('/relink-requests/')) return json(route, 200, { data: { status: 'pending', expiresAt: new Date(Date.now() + 600_000).toISOString() } });
    if (path.endsWith('/inbox')) return json(route, 200, { data: { rev: 1, plans: [], memberships: [], tier: 'free', serverTime: new Date().toISOString() } });
    if (path.endsWith('/snapshot')) return json(route, 200, { data: { rev: 1 } });
    return json(route, 404, { error: { code: 'not_found' } });
  });
  return calls;
}

/** A synced learner (a device secret), so the lookup goes with the device header; then Join a class with the code. */
async function joinWithCode(page: Page): Promise<string> {
  await onboardChild(page, { name: 'Mina', startJourney: false });
  const profiles = await readStored<Array<{ id: string }>>(page, 'profiles');
  const id = profiles?.[0]?.id;
  if (!id) throw new Error('no profile');
  let secret: string | null | undefined;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await seedStored(page, `sync:${id}`, { secret: 'secret-e2e', rev: 1, lastSyncedAt: new Date().toISOString(), rescueCode: null });
    await page.goto('/');
    secret = (await readStored<{ secret: string | null }>(page, `sync:${id}`))?.secret;
    if (secret === 'secret-e2e') break;
  }
  // Every test below relies on the device header: a seeding that did not hold would test the unauthenticated lookup.
  expect(secret).toBe('secret-e2e');
  await page.goto('/join#c=ABC234');
  await expect(page.getByTestId('join-code')).toHaveValue('ABC234');
  await page.getByRole('button', { name: join.code.join.cta, exact: true }).click();
  return id;
}

test.describe('Join a class at a learner cap', () => {
  test('a full family: the family line with its cap, on the code step; the lookup carried the learner', async ({ page, context }) => {
    const calls = await mockApi(context, { space: { id: 'space:f', kind: 'family', name: 'Kim family' }, seat: { full: true, reason: 'cap_family', cap: 4 } });
    const id = await joinWithCode(page);
    await expect(page.getByText(join.errors.familyFull(4), { exact: true })).toBeVisible();
    await expect(page.getByText(join.errors.classFull, { exact: true })).toHaveCount(0);
    await expect(page.getByTestId('join-code')).toBeVisible();
    expect(calls.lookups.at(-1)?.body).toEqual({ code: 'ABC234', learnerId: id });
    expect(calls.lookups.at(-1)?.authorization).toMatch(/^Device .+:secret-e2e$/);
    await shot(page, 'join-seat-family-full-320');
    await page.setViewportSize(WIDE);
    await shot(page, 'join-seat-family-full-wide');
  });

  test('a full class with a roster: the names and relink stay, the line sits above "I\'m new"', async ({ page, context }) => {
    await mockApi(context, {
      space: { id: 'space:c', kind: 'class', name: 'Sunflower' },
      seat: { full: true, reason: 'cap_class', cap: 20 },
      roster: [
        { learnerId: 'profile:m', name: 'Minho' },
        { learnerId: 'profile:s', name: 'Suni' },
      ],
    });
    await joinWithCode(page);
    const pick = page.getByTestId('join-pick');
    await expect(pick).toBeVisible();
    await expect(pick.getByRole('button', { name: 'Minho', exact: true })).toBeVisible();
    const line = page.getByTestId('join-seat-line');
    await expect(line).toHaveText(join.errors.classFull);
    const newHere = pick.getByRole('button', { name: join.pick.newHere.cta, exact: true });
    const [lineBox, newBox, nameBox] = await Promise.all([line.boundingBox(), newHere.boundingBox(), pick.getByRole('button', { name: 'Suni', exact: true }).boundingBox()]);
    expect(lineBox && newBox && nameBox).toBeTruthy();
    expect(lineBox!.y).toBeGreaterThan(nameBox!.y);
    expect(lineBox!.y + lineBox!.height).toBeLessThanOrEqual(newBox!.y);
    await shot(page, 'join-seat-class-full-roster-320');
    await page.setViewportSize(WIDE);
    await shot(page, 'join-seat-class-full-roster-wide');
    // A returning student picks their name: the relink, which takes no seat.
    await pick.getByRole('button', { name: 'Minho', exact: true }).click();
    await expect(page.getByTestId('join-waiting')).toBeVisible();
  });

  test('a school cap from the join reads the school line (cap_class with details.reason cap_school)', async ({ page, context }) => {
    await mockApi(context, { space: { id: 'space:c', kind: 'class', name: 'Sunflower' }, seat: null }, { code: 'cap_class', details: { reason: 'cap_school', cap: 50 } });
    await joinWithCode(page);
    await expect(page.getByTestId('join-confirm')).toBeVisible();
    await page.getByRole('button', { name: join.confirm.me.cta, exact: true }).click();
    await expect(page.getByText(join.errors.schoolFull, { exact: true })).toBeVisible();
    await expect(page.getByText(join.errors.classFull, { exact: true })).toHaveCount(0);
    await shot(page, 'join-seat-school-full-320');
    await page.setViewportSize(WIDE);
    await shot(page, 'join-seat-school-full-wide');
  });
});
