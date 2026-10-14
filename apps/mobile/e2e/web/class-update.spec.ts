import type { BrowserContext, Page, Route } from '@playwright/test';
import { expect, test } from './fixtures';
import { onboardChild, onboardSelf, readStored, seedStored, unlockWithPin } from './helpers';
import { shot } from './shots';

/**
 * [TV] AMENDMENTS-TEACHER-VISIBILITY-TRANSFER TV-D4, TV-D5, TV-D10 (wireframe
 * `design/wireframes/console/teacher-move-and-scope.md` screen 5): the Home lines about classes and the class update
 * screen, against a mocked sync API. A teacher move shows once ("Mina moved to a new class: …" with OK); the class
 * update line opens the grown-up gate for a child profile and the screen directly for a self profile on a device
 * without a PIN; OK sends the acknowledgement. Recipe (the same build as transfer-moves.spec.ts):
 *
 *   EXPO_PUBLIC_API_BASE_URL=https://api.e2e.invalid npx expo export --platform web --output-dir dist --clear
 *   E2E_TRANSFER=1 pnpm --filter @hangul-route/mobile exec playwright test class-update
 */
test.use({ serviceWorkers: 'block', viewport: { width: 375, height: 740 } });
test.skip(process.env.E2E_TRANSFER !== '1', 'needs a build with EXPO_PUBLIC_API_BASE_URL=https://api.e2e.invalid');

const API = 'https://api.e2e.invalid';
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, content-type', 'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE' };
const CLASS_D = { spaceId: 'space:d', kind: 'class', name: 'Evening Class D', role: 'student', joinedAt: '2026-10-14T00:00:00.000Z' };

interface Mocks {
  needed: boolean;
  calls: { method: string; path: string; body: unknown }[];
}

const json = (route: Route, status: number, body: unknown): Promise<void> => route.fulfill({ status, contentType: 'application/json', headers: CORS, body: JSON.stringify(body) });

async function mockApi(context: BrowserContext): Promise<Mocks> {
  const mocks: Mocks = { needed: true, calls: [] };
  await context.route(`${API}/**`, async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const path = decodeURIComponent(new URL(req.url()).pathname);
    const body = req.postData() ? (JSON.parse(req.postData() ?? '{}') as unknown) : null;
    mocks.calls.push({ method: req.method(), path, body });
    if (path.endsWith('/inbox')) {
      return json(route, 200, {
        data: {
          rev: 1,
          plans: [],
          memberships: [CLASS_D],
          tier: 'free',
          serverTime: new Date().toISOString(),
          transfersEnabled: true,
          deviceScope: 'full',
          classScope: { needed: mocks.needed, current: 'class-scope-2026-10' },
          classMoves: [{ id: 'move:1', to: { spaceId: 'space:d', name: 'Evening Class D' }, executedAt: new Date().toISOString() }],
        },
      });
    }
    if (path.endsWith('/class-scope') && req.method() === 'PUT') {
      mocks.needed = false;
      return json(route, 200, { data: { version: 'class-scope-2026-10', ackedAt: new Date().toISOString() } });
    }
    if (path.endsWith('/snapshot')) return json(route, 200, { data: { rev: 1 } });
    return json(route, 404, { error: { code: 'not_found' } });
  });
  return mocks;
}

/** A synced learner (a device secret), then Home. */
async function seedSynced(page: Page): Promise<void> {
  const profiles = await readStored<Array<{ id: string }>>(page, 'profiles');
  const id = profiles?.[0]?.id;
  if (!id) throw new Error('no profile');
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await seedStored(page, `sync:${id}`, { secret: 'secret-e2e', rev: 1, lastSyncedAt: new Date().toISOString(), rescueCode: null });
    await page.goto('/');
    const stored = await readStored<{ secret: string | null }>(page, `sync:${id}`);
    if (stored?.secret === 'secret-e2e') return;
  }
  throw new Error('the seeded sync state did not stick');
}

async function home(page: Page, name: string): Promise<void> {
  await page.goto('/');
  await expect(page.getByText(`Hi, ${name}!`)).toBeVisible();
  await page.addLocatorHandler(page.getByTestId('install-guide'), async (guide) => {
    await guide.getByRole('button', { name: 'Not now' }).click();
  });
}

test('a child profile: the move shows once; the update line goes through the grown-up gate, OK sends it', async ({ page, context }) => {
  const mocks = await mockApi(context);
  await onboardChild(page, { name: 'Mina' });
  await seedSynced(page);
  await home(page, 'Mina');

  const notice = page.getByTestId('class-move-notice');
  await expect(notice).toContainText('Mina moved to a new class: Evening Class D.', { timeout: 15_000 });
  const line = page.getByTestId('class-scope-line');
  await expect(line).toContainText('A grown-up has an update about your class.');
  await shot(page, 'class-update-home-child-375');
  await notice.getByRole('button', { name: 'OK' }).click();
  await expect(page.getByTestId('class-move-notice')).toHaveCount(0);

  await line.getByTestId('class-scope-open').click();
  await unlockWithPin(page);
  await expect(page.getByRole('heading', { name: 'Class update' })).toBeVisible();
  await expect(page.getByText('The teacher of each class Mina is in can see all of Mina\'s progress, including words.')).toBeVisible();
  await expect(page.getByText('A teacher may move Mina to another class. We tell you when it happens.')).toBeVisible();
  await shot(page, 'class-update-screen-375');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByTestId('class-scope-ok').click();
  await expect(page.getByText(`Hi, Mina!`)).toBeVisible();
  await expect(page.getByTestId('class-scope-line')).toHaveCount(0);
  const put = mocks.calls.find((c) => c.method === 'PUT' && c.path.endsWith('/class-scope'));
  expect(put?.body).toEqual({ version: 'class-scope-2026-10' });

  // The notice stays seen after a reload: it shows once on this device.
  await page.reload();
  await expect(page.getByText(`Hi, Mina!`)).toBeVisible();
  await page.waitForTimeout(1000);
  await expect(page.getByTestId('class-move-notice')).toHaveCount(0);
});

test('a self profile on a device with no PIN opens the update directly', async ({ page, context }) => {
  await mockApi(context);
  await onboardSelf(page, { name: 'Rio' });
  await seedSynced(page);
  await home(page, 'Rio');
  const line = page.getByTestId('class-scope-line');
  await expect(line).toContainText('There is an update about your class.', { timeout: 15_000 });
  await line.getByTestId('class-scope-open').click();
  await expect(page.getByRole('heading', { name: 'Class update' })).toBeVisible();
  await expect(page.getByText('Enter your 4-digit PIN to continue.')).toHaveCount(0);
});
