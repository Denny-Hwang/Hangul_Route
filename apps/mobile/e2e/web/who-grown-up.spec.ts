import type { BrowserContext, Page, Route } from '@playwright/test';
import { CONSOLE_SESSION_KEY, SHELL_DB, SHELL_KEYS, SHELL_STORE } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { expect, test } from './fixtures';
import { E2E_PIN, onboardChild, readStored, seedStored } from './helpers';
import { shot } from './shots';

/**
 * [OA] The chooser's grown-up use rows end to end (AMENDMENTS-ONE-ACCOUNT-MANY-USERS row OA-4b, section 20; sections
 * 5.3, 6.1, 7.1, 12; G2, CS-1, CS-7): the rows come from the console's `deviceUses` record, a row asks the grown-up
 * PIN and opens that persona home in the same tab. It needs the merged app-host build with the chooser on and an API
 * address (the console's API is mocked by `page.route`; the grown-up is signed in through the dev auth bridge, as in
 * grown-up-shell.spec.ts), so it runs only with `E2E_WHO=1` and `GROWN_UP_SHELL_E2E=1`:
 *
 *   EXPO_PUBLIC_WHO_CHOOSER=true EXPO_PUBLIC_API_BASE_URL=https://api.shell-e2e.test pnpm --filter @hangul-route/mobile build:web
 *   E2E_WHO=1 GROWN_UP_SHELL_E2E=1 pnpm --filter @hangul-route/mobile exec playwright test who-grown-up
 *
 * Covered: G2 (chooser, Teacher, the PIN, the teacher home: 2 taps and 4 digits), School to the teacher home with
 * focus on its first school card and the query gone, Family to the family home, Cancel back to the chooser, CS-1 (an
 * earlier unlock in the tab never opens a row without the PIN; a wrong PIN opens nothing), CS-7 (generic labels only,
 * never the account's name or email), Sign in as a grown-up with no known use, and the offline rows.
 */
test.skip(process.env.E2E_WHO !== '1' || process.env.GROWN_UP_SHELL_E2E !== '1', 'needs a build with EXPO_PUBLIC_WHO_CHOOSER=true and an API address (E2E_WHO=1 GROWN_UP_SHELL_E2E=1)');
test.use({ viewport: { width: 360, height: 740 } });

const en = getMessages('en');
const w = en.learner.who;
const title = (page: Page) => page.getByRole('heading', { name: w.title, exact: true });
const useRow = (page: Page, label: string) => page.getByRole('button', { name: en.a11y.who.grownUpRow(label), exact: true });

/** The console session of the dev auth bridge; its name and email must never reach the chooser (CS-7). */
const SESSION = { token: 'acct-oa4b', accountId: 'acct-oa4b', displayName: 'Ms Kim', email: 'kim.teacher@example.com' };

/** Puts the console session on grown-up pages only, the way a Clerk session outlives a visit to the learner app. */
async function signedInOnGrownUpPages(context: BrowserContext): Promise<void> {
  await context.addInitScript(
    ([key, value]) => {
      if (/^\/(signin|parent|teach|account|start)(\/|$)/.test(window.location.pathname)) window.sessionStorage.setItem(key, value);
    },
    [CONSOLE_SESSION_KEY, JSON.stringify(SESSION)] as const,
  );
}

/** The console's shell store (`hr-shell` / `kv`), as a grown-up home and a secret-proving sign-in leave it. */
async function seedShell(page: Page, values: Partial<Record<keyof typeof SHELL_KEYS, unknown>>): Promise<void> {
  const entries = Object.entries(values).map(([k, v]) => [SHELL_KEYS[k as keyof typeof SHELL_KEYS], v] as const);
  await page.evaluate(
    ([db, store, pairs]) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open(db);
        open.onupgradeneeded = () => {
          if (!open.result.objectStoreNames.contains(store)) open.result.createObjectStore(store);
        };
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const tx = open.result.transaction(store, 'readwrite');
          for (const [key, value] of pairs) tx.objectStore(store).put(value, key);
          tx.oncomplete = () => {
            open.result.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    [SHELL_DB, SHELL_STORE, entries] as const,
  );
}

type Space = { id: string; kind: 'family' | 'class' | 'school'; name: string; role: 'owner' | 'teacher' | 'admin' };

function spaceItem(s: Space) {
  return {
    space: { id: s.id, kind: s.kind, name: s.name, parentSpaceId: null, settings: { consentMode: 'parent', anonymizeRoster: false }, archivedAt: null, createdAt: '2026-10-01T00:00:00Z' },
    role: s.role,
    counts: { learners: 2, accounts: 1, classes: s.kind === 'school' ? 1 : 0 },
    joinCode: null,
    joinCodeExpiresAt: null,
  };
}

const json = (route: Route, status: number, body: unknown) =>
  route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });

/** Answers the console's API on any host but this one: the spaces list; anything else is a 404, which every page survives. */
async function mockApi(page: Page, spaces: Space[]): Promise<void> {
  await page.route(
    (url) => url.pathname.startsWith('/api/') && url.hostname !== 'localhost',
    async (route) => {
      const request = route.request();
      if (request.method() === 'OPTIONS') {
        return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
      }
      const path = new URL(request.url()).pathname;
      if (path === '/api/spaces') return json(route, 200, { data: { spaces: spaces.map(spaceItem) } });
      if (/^\/api\/spaces\/[^/]+\/roster$/.test(path)) return json(route, 200, { data: { space: spaceItem(spaces[0]!).space, learners: [], joinCode: null, joinCodeExpiresAt: null } });
      return json(route, 404, { error: { code: 'not_found', message: 'mocked' } });
    },
  );
}

const FAMILY: Space = { id: 'sp_f', kind: 'family', name: 'Kim family', role: 'owner' };
const CLASS: Space = { id: 'sp_c', kind: 'class', name: 'Room 3', role: 'teacher' };
const SCHOOL: Space = { id: 'sp_s', kind: 'school', name: 'Maple School', role: 'admin' };

/**
 * A shared family device: Mina through onboarding (PIN set), Joon added, the console's last sign-in trusting this
 * PIN's epoch, and the account's uses known on this browser. Ends on the chooser.
 */
async function sharedDevice(page: Page, uses: readonly string[]): Promise<void> {
  await onboardChild(page, { name: 'Mina', startJourney: false });
  const profiles = (await readStored<Array<Record<string, unknown>>>(page, 'profiles')) ?? [];
  const mina = profiles[0]!;
  await seedStored(page, 'profiles', [...profiles, { ...mina, id: 'profile:joon0001', displayName: 'Joon', createdAt: new Date().toISOString() }]);
  const pinSetAt = await readStored<number>(page, 'account:pinSetAt');
  if (typeof pinSetAt !== 'number') throw new Error('no PIN epoch stored');
  await expect.poll(() => readStored(page, 'device:gate')).toEqual({ v: 1, gate: 'pin', pinEpoch: pinSetAt });
  await seedShell(page, { pinEpoch: pinSetAt, deviceUses: { v: 1, uses, at: Date.now() } });
  await page.goto('/');
  await expect(title(page)).toBeVisible();
}

/** Counts every tap and typed digit from the chooser on (G2). */
async function countInput(page: Page): Promise<{ taps: () => Promise<number>; digits: () => Promise<number> }> {
  await page.evaluate(() => {
    const seen = { taps: 0, digits: 0 };
    (window as Window & { __input?: typeof seen }).__input = seen;
    document.addEventListener(
      'click',
      (event) => {
        const label = (event.target as HTMLElement | null)?.closest('[role="button"],button')?.getAttribute('aria-label') ?? '';
        if (/^Digit \d$/.test(label)) seen.digits += 1;
        else seen.taps += 1;
      },
      true,
    );
  });
  const read = (key: 'taps' | 'digits') => () => page.evaluate((k) => (window as unknown as { __input?: Record<string, number> }).__input?.[k] ?? -1, key);
  return { taps: read('taps'), digits: read('digits') };
}

/** The grown-up page behind the lock rendered: the frame's Learner app exit is on screen and no lock is. */
async function expectOpen(page: Page): Promise<void> {
  await expect(page.getByTestId('frame-learner-app').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: en.console.lock.title })).toHaveCount(0);
}

async function typePin(page: Page, pin: string): Promise<void> {
  for (const digit of pin) await page.getByRole('button', { name: en.a11y.pinDigit(Number(digit)), exact: true }).click();
  await page.getByRole('button', { name: en.caregiver.pin.entry.unlock.cta, exact: true }).click();
}

test.describe('the grown-up use rows on the chooser (row OA-4b)', () => {
  test.beforeEach(async ({ context }) => {
    await signedInOnGrownUpPages(context);
  });

  test('G2: chooser, Teacher, the PIN, the teacher home: 2 taps and 4 digits; CS-7 generic labels only', async ({ page }) => {
    await mockApi(page, [FAMILY, CLASS, SCHOOL]);
    await sharedDevice(page, ['family', 'teacher', 'school']);
    // The rows in the order Family, Teacher, School, then the Grown-up area, each behind the PIN.
    const rows = page.getByTestId('who-rows').getByRole('button');
    await expect(rows).toHaveCount(4);
    expect(await rows.evaluateAll((nodes) => nodes.map((n) => n.getAttribute('aria-label')))).toEqual(
      [w.use.family, w.use.teacher, w.use.school, en.caregiver.audience.family.zoneLabel].map((label) => en.a11y.who.grownUpRow(label)),
    );
    // CS-7: no account name or email anywhere on the chooser.
    await expect(page.getByTestId('who-is-using')).not.toContainText(SESSION.displayName);
    await expect(page.getByTestId('who-is-using')).not.toContainText(SESSION.email);
    await shot(page, 'who-grown-up-rows-360');
    await page.setViewportSize({ width: 320, height: 640 });
    await shot(page, 'who-grown-up-rows-320');
    await page.setViewportSize({ width: 1280, height: 800 });
    await shot(page, 'who-grown-up-rows-1280');
    await page.setViewportSize({ width: 360, height: 740 });

    const input = await countInput(page);
    await useRow(page, w.use.teacher).click();
    await expect(page.getByText(en.caregiver.pin.entry.verifySubtitle)).toBeVisible();
    await expect(page.getByRole('button', { name: en.caregiver.pin.entry.forgot.cta })).toHaveCount(0);
    await shot(page, 'who-grown-up-pin-teacher-360');
    const counted = { taps: await input.taps(), digits: 0 };
    for (const digit of E2E_PIN) await page.getByRole('button', { name: en.a11y.pinDigit(Number(digit)), exact: true }).click();
    counted.digits = await input.digits();
    await page.getByRole('button', { name: en.caregiver.pin.entry.unlock.cta, exact: true }).click();
    counted.taps += 1;
    await expect(page).toHaveURL(/\/teach\/home$/);
    await expectOpen(page);
    await expect(page.getByTestId('space-row-sp_c')).toBeVisible();
    // G2: the Teacher row and Unlock are the 2 taps; the PIN is the 4 digits.
    expect(counted).toEqual({ taps: 2, digits: 4 });
    // No id, name or email in any address on the way (no PII in URLs).
    expect(page.url()).not.toMatch(/sp_|acct|@/);
  });

  test('School opens the teacher home with focus on its first school card, then drops the query', async ({ page }) => {
    await mockApi(page, [CLASS, SCHOOL]);
    await sharedDevice(page, ['teacher', 'school']);
    await useRow(page, w.use.school).click();
    await typePin(page, E2E_PIN);
    await expect(page.getByTestId('space-row-sp_s')).toBeFocused();
    await expect(page).toHaveURL(/\/teach\/home$/);
    await expectOpen(page);
    await shot(page, 'who-grown-up-school-focus-360');
  });

  test('Family opens the family home', async ({ page }) => {
    await mockApi(page, [FAMILY, CLASS]);
    await sharedDevice(page, ['family', 'teacher']);
    await useRow(page, w.use.family).click();
    await typePin(page, E2E_PIN);
    await expect(page).toHaveURL(/\/parent$/);
    await expectOpen(page);
  });

  test('Cancel on the PIN screen returns to the chooser; CS-1: an earlier unlock never opens a row, a wrong PIN opens nothing', async ({ page }) => {
    await mockApi(page, [CLASS]);
    await sharedDevice(page, ['teacher']);
    await useRow(page, w.use.teacher).click();
    await expect(page.getByText(en.caregiver.pin.entry.verifySubtitle)).toBeVisible();
    await page.getByRole('button', { name: en.common.buttons.cancel, exact: true }).click();
    await expect(title(page)).toBeVisible();
    await expect(page).not.toHaveURL(/\/teach/);

    // A grown-up session from before (the PIN entered on Profile) is closed by the chooser: the row asks again.
    await page.evaluate(() => sessionStorage.setItem('hr:grownup:unlock', JSON.stringify({ v: 1, at: Date.now(), seen: Date.now(), src: 'pin', pinEpoch: 1 })));
    await useRow(page, w.use.teacher).click();
    await expect(page.getByText(en.caregiver.pin.entry.verifySubtitle)).toBeVisible();
    await typePin(page, '9999');
    await expect(page.getByText(en.caregiver.pin.entry.triesLeft(4))).toBeVisible();
    await expect(page).not.toHaveURL(/\/teach/);
  });

  test('no known use: Sign in as a grown-up, then the sign-in router; offline the row is disabled with Needs the internet', async ({ page, context }) => {
    await mockApi(page, [CLASS]);
    await sharedDevice(page, []);
    await expect(useRow(page, w.use.signIn)).toBeVisible();
    await expect(page.getByTestId('who-rows').getByRole('button')).toHaveCount(2);

    await context.setOffline(true);
    await expect(useRow(page, w.use.signIn)).toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByTestId('who-row-signin')).toContainText(en.learner.welcome.grownUps.needsInternet);
    await expect(page.getByTestId('who-row-area')).not.toHaveAttribute('aria-disabled', 'true');
    await shot(page, 'who-grown-up-offline-360');
    await context.setOffline(false);
    await expect(useRow(page, w.use.signIn)).not.toHaveAttribute('aria-disabled', 'true');

    await useRow(page, w.use.signIn).click();
    await typePin(page, E2E_PIN);
    // The sign-in router (signed in already): the account's only persona home.
    await expect(page).toHaveURL(/\/teach\/home$/);
    await expectOpen(page);
  });
});
