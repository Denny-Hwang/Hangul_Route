import { createHash } from 'node:crypto';
import { expect, test, type BrowserContext, type Page, type Route } from '@playwright/test';
import { getMessages } from '@hangul-route/i18n';
import { API, NOW, SESSION_KEY } from './report-fixtures';

/**
 * [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS section 20, row OA-6 (sections 7.5 and 8.5; CS-9, CS-10, CS-17): reset the
 * grown-up PIN by signing in, on the console export with the dev sign-in (the dev bridge stands in for a password).
 *
 *   NEXT_PUBLIC_API_BASE_URL=https://api.report-e2e.test NEXT_PUBLIC_CONSOLE_DEV_AUTH=true NEXT_PUBLIC_PIN_RESET_SIGNIN=true \
 *     pnpm --filter @hangul-route/web build
 *   PIN_RESET_E2E=1 PORT=4391 pnpm --filter @hangul-route/web exec playwright test pin-reset-signin.spec
 *
 * On F-APP-001's merged app-host build the same spec also follows the tab into the learner app (`PIN_RESET_E2E_APP=1`):
 * the new-PIN screen after an accepted ticket, and the expired line for a ticket that is too old:
 *
 *   EXPO_PUBLIC_API_BASE_URL=https://api.report-e2e.test EXPO_PUBLIC_PIN_RESET_SIGNIN=true NEXT_PUBLIC_PIN_RESET_SIGNIN=true \
 *     pnpm --filter @hangul-route/mobile build:web
 *   PIN_RESET_E2E=1 PIN_RESET_E2E_APP=1 E2E_OUT=../mobile/dist PORT=4392 pnpm --filter @hangul-route/web exec playwright test pin-reset-signin.spec
 *
 * The API is mocked with `page.route` and the page itself calls none (nothing leaves the machine). Clerk's own
 * dialogs and the passkey rule are covered by the unit and component tests.
 */
const FULL = process.env.PIN_RESET_E2E === '1';
const APP = process.env.PIN_RESET_E2E_APP === '1';
const c = getMessages('en').console;
const pin = getMessages('en').caregiver.pin;
const GROWN_UP = 'acct-grown-up';
const CHILD = 'acct-child-own';
const AT = Date.parse(NOW);
const EPOCH = AT - 24 * 60 * 60_000;
const TICKET_KEY = 'hr:shell:pinReset';
const UNLOCK_KEY = 'hr:grownup:unlock';
const fingerprint = (id: string) => createHash('sha256').update(id).digest('hex').slice(0, 16);

const FAMILY = {
  id: 'space:kim-family',
  kind: 'family',
  name: 'The Kim Family',
  parentSpaceId: null,
  settings: { consentMode: 'parent', anonymizeRoster: false },
  archivedAt: null,
  createdAt: '2026-09-01T00:00:00.000Z',
};

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
const json = (route: Route, status: number, data: unknown) =>
  route.fulfill({ status, contentType: 'application/json', headers: CORS, body: JSON.stringify(status < 300 ? { data } : { error: 'mocked' }) });

/**
 * A signed-in dev session for `account` and this tab's unlock, seeded once per tab (a hand-off that clears them is
 * then seen as cleared), and a mocked API that records every call.
 */
async function signedIn(context: BrowserContext, account: string, unlock: Record<string, unknown> | null): Promise<string[]> {
  const calls: string[] = [];
  await context.clock.setFixedTime(new Date(NOW));
  await context.addInitScript(
    ([key, id, record, unlockKey]) => {
      if (window.sessionStorage.getItem('e2e:seeded')) return;
      window.sessionStorage.setItem('e2e:seeded', '1');
      window.sessionStorage.setItem(key as string, JSON.stringify({ token: id, accountId: id, displayName: 'Ms Kim', email: 'kim@example.com' }));
      if (record) window.sessionStorage.setItem(unlockKey as string, record as string);
    },
    [SESSION_KEY, account, unlock ? JSON.stringify(unlock) : null, UNLOCK_KEY],
  );
  await context.route(`${API}/**`, async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const path = new URL(request.url()).pathname;
    calls.push(path);
    if (path === '/api/spaces') return json(route, 200, { spaces: [{ space: FAMILY, role: 'owner', counts: { learners: 1, accounts: 1, classes: 0 } }] });
    if (path.endsWith('/roster')) return json(route, 200, { space: FAMILY, learners: [], joinCode: 'KIM123', joinCodeExpiresAt: '2026-11-15T12:00:00.000Z' });
    if (path.endsWith('/plans')) return json(route, 200, { plans: [] });
    if (path === '/api/entitlements') return json(route, 200, { entitlements: [] });
    return json(route, 404, null);
  });
  return calls;
}

const LEARNER = { id: 'profile:mina', displayName: 'Mina', ageGroup: '8-9', avatar: 'hoya-orange', role: 'learner', createdAt: '2026-10-01T00:00:00.000Z', learnerType: 'child' };

/**
 * The learner app's device state on this origin: the marker the console reads, and (for the merged build) the
 * profile and PIN the learner app hydrates, with the PIN set at `EPOCH`. Shell-store keys go to `hr-shell` / `kv`.
 */
async function seedDevice(page: Page, input: { marker: Record<string, unknown>; shell?: Record<string, unknown> }): Promise<void> {
  // A static page of this origin that runs neither the learner boot nor a grown-up router while the stores are written:
  // the site's landing page on the console export, the grown-up offline page on the merged build.
  await page.goto(APP ? '/grown-ups-offline.html' : '/');
  await page.evaluate(
    async ({ marker, shell, learner, epoch }) => {
      const put = (db: string, store: string, entries: Array<[string, unknown]>) =>
        new Promise<void>((resolve, reject) => {
          const open = indexedDB.open(db);
          open.onupgradeneeded = () => open.result.createObjectStore(store);
          open.onerror = () => reject(open.error);
          open.onsuccess = () => {
            const tx = open.result.transaction(store, 'readwrite');
            for (const [key, value] of entries) tx.objectStore(store).put(value, key);
            tx.oncomplete = () => {
              open.result.close();
              resolve();
            };
            tx.onerror = () => reject(tx.error);
          };
        });
      await put('keyval-store', 'keyval', [
        ['hr:device:gate', JSON.stringify(marker)],
        ['hr:profiles', JSON.stringify([learner])],
        ['hr:profiles:active', JSON.stringify(learner.id)],
        ['hr:account:parentPinHash', JSON.stringify('e2e-hash-of-the-forgotten-pin')],
        ['hr:account:pinSetAt', JSON.stringify(epoch)],
        ['hr:account:guardianConsentAcceptedAt', JSON.stringify('2026-10-01T00:00:00.000Z')],
      ]);
      if (shell) await put('hr-shell', 'kv', Object.entries(shell));
    },
    { marker: input.marker, shell: input.shell, learner: LEARNER, epoch: EPOCH },
  );
}

async function readShell(page: Page, key: string): Promise<unknown> {
  return page.evaluate(
    (k) =>
      new Promise((resolve) => {
        const open = indexedDB.open('hr-shell');
        open.onupgradeneeded = () => open.result.createObjectStore('kv');
        open.onsuccess = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains('kv')) return resolve(undefined);
          const get = db.transaction('kv').objectStore('kv').get(k);
          get.onsuccess = () => resolve(get.result);
          get.onerror = () => resolve(undefined);
        };
        open.onerror = () => resolve(undefined);
      }),
    key,
  );
}

const PIN_MARKER = { v: 1, gate: 'pin', pinEpoch: EPOCH };
const freshSignIn = { v: 1, at: AT - 20_000, seen: AT - 20_000, src: 'signin' };
const ownerRecord = (id: string) => ({ v: 1, owner: fingerprint(id), epoch: EPOCH });

/** The address the page leaves for, caught as the navigation starts (the learner app strips `gate` once it boots). */
function handOff(page: Page): Promise<URL> {
  return page.waitForRequest((request) => request.isNavigationRequest() && new URL(request.url()).pathname === '/').then((request) => new URL(request.url()));
}

test.describe('reset the grown-up PIN by signing in (row OA-6)', () => {
  test.skip(!FULL, 'needs the console e2e export with NEXT_PUBLIC_PIN_RESET_SIGNIN=true (PIN_RESET_E2E=1)');

  test('success: the PIN owner’s fresh sign-in writes the ticket and opens gate=pin-reset; no API call, no id', async ({ page, context }) => {
    const calls = await signedIn(context, GROWN_UP, freshSignIn);
    await seedDevice(page, { marker: PIN_MARKER, shell: { pinEpoch: EPOCH, pinOwner: ownerRecord(GROWN_UP) } });
    calls.length = 0;
    const leaving = handOff(page);
    await page.goto('/account/pin-reset');
    const target = await leaving;
    expect(target.search).toBe('?gate=pin-reset&lang=en');
    // The page calls no API (section 7.5); the URL carries no id and no PII.
    expect(calls).toEqual([]);
    expect(target.href).not.toMatch(/acct|kim|profile|@/i);
    if (APP) {
      // The learner app read the ticket once and opened the new-PIN screen.
      await expect(page.getByText(pin.reset.signIn.newPinTitle)).toBeVisible();
      expect(await page.evaluate((key) => window.sessionStorage.getItem(key), TICKET_KEY)).toBeNull();
    } else {
      await page.waitForURL((url) => url.pathname === '/');
      const ticket = JSON.parse((await page.evaluate((key) => window.sessionStorage.getItem(key), TICKET_KEY)) ?? 'null');
      expect(ticket).toEqual({ v: 1, at: AT, epoch: EPOCH });
      // The console session and the unlock of this tab are gone.
      expect(await page.evaluate((key) => window.sessionStorage.getItem(key), SESSION_KEY)).toBeNull();
      expect(await page.evaluate((key) => window.sessionStorage.getItem(key), UNLOCK_KEY)).toBeNull();
    }
  });

  test('expired ticket: one older than 2 minutes is refused and read only once', async ({ page, context }) => {
    test.skip(!APP, 'the ticket is checked by the learner app: needs the merged app-host build (PIN_RESET_E2E_APP=1)');
    await signedIn(context, GROWN_UP, null);
    await seedDevice(page, { marker: PIN_MARKER });
    await page.evaluate(([key, value]) => window.sessionStorage.setItem(key, value), [TICKET_KEY, JSON.stringify({ v: 1, at: AT - 3 * 60_000, epoch: EPOCH })] as const);
    await page.goto('/?gate=pin-reset&lang=en');
    await expect(page.getByTestId('pin-reset-expired')).toHaveText(pin.reset.signIn.expired);
    await expect(page.getByText(pin.reset.signIn.newPinTitle)).toHaveCount(0);
    expect(await page.evaluate((key) => window.sessionStorage.getItem(key), TICKET_KEY)).toBeNull();
    // Read once (CS-9): the same address again finds no ticket and refuses again.
    await page.goto('/?gate=pin-reset&lang=en');
    await expect(page.getByTestId('pin-reset-expired')).toBeVisible();
  });

  test('another account: notOwner, Back to learning, nothing written', async ({ page, context }) => {
    await signedIn(context, CHILD, freshSignIn);
    await seedDevice(page, { marker: PIN_MARKER, shell: { pinEpoch: EPOCH, pinOwner: ownerRecord(GROWN_UP) } });
    await page.goto('/account/pin-reset');
    const line = page.getByTestId('pin-reset-line');
    await expect(line).toHaveText(c.pinReset.notOwner);
    await expect(page.getByRole('heading', { name: c.pinReset.title })).toBeVisible();
    expect(await page.evaluate((key) => window.sessionStorage.getItem(key), TICKET_KEY)).toBeNull();
    expect(await readShell(page, 'pinOwner')).toEqual(ownerRecord(GROWN_UP));
    const back = page.getByTestId('pin-reset-back');
    await expect(back).toHaveText(c.lock.backToLearning.cta);
    const leaving = handOff(page);
    await back.click();
    expect((await leaving).search).toBe('?lang=en');
  });

  test('CS-10: a child’s own account signed in before a grown-up’s PIN unlock never resets the PIN', async ({ page, context }) => {
    // 1. The child signs in with their own email code (the dev sign-in stands in): no PIN owner is written.
    await signedIn(context, CHILD, freshSignIn);
    await seedDevice(page, { marker: PIN_MARKER, shell: { pinEpoch: EPOCH } });
    // 2. Later in that session a grown-up opens a grown-up page with the PIN (the learner app's hand-off unlock).
    await page.evaluate(([key, value]) => window.sessionStorage.setItem(key, value), [UNLOCK_KEY, JSON.stringify({ v: 1, at: AT - 5_000, seen: AT - 5_000, src: 'pin', pinEpoch: EPOCH })] as const);
    await page.goto('/parent');
    await expect(page.getByTestId('adult-frame')).toBeVisible();
    // The lock's PIN path only refreshes an existing owner for the same account: the child is never made owner.
    await page.waitForTimeout(300);
    expect(await readShell(page, 'pinOwner')).toBeUndefined();
    // 3. The child then tries the sign-in reset with a fresh sign-in of their own: refused, nothing written.
    await page.evaluate(([key, value]) => window.sessionStorage.setItem(key, value), [UNLOCK_KEY, JSON.stringify(freshSignIn)] as const);
    await page.goto('/account/pin-reset');
    await expect(page.getByTestId('pin-reset-line')).toHaveText(c.pinReset.firstSignIn);
    expect(await page.evaluate((key) => window.sessionStorage.getItem(key), TICKET_KEY)).toBeNull();
    expect(await readShell(page, 'pinOwner')).toBeUndefined();
  });

  test('a sign-in older than 2 minutes asks the reverification first (the dev bridge passes it), then hands off', async ({ page, context }) => {
    await signedIn(context, GROWN_UP, { v: 1, at: AT - 3 * 60_000, seen: AT - 1_000, src: 'signin' });
    await seedDevice(page, { marker: PIN_MARKER, shell: { pinEpoch: EPOCH, pinOwner: ownerRecord(GROWN_UP) } });
    const leaving = handOff(page);
    await page.goto('/account/pin-reset');
    expect((await leaving).search).toBe('?gate=pin-reset&lang=en');
  });

  test('no PIN on this device: noPin', async ({ page, context }) => {
    await signedIn(context, GROWN_UP, freshSignIn);
    await seedDevice(page, { marker: { v: 1, gate: 'nopin' }, shell: { pinPromptSeen: true } });
    await page.goto('/account/pin-reset');
    await expect(page.getByTestId('pin-reset-line')).toHaveText(c.pinReset.noPin);
  });

  for (const width of [320, 1280]) {
    test(`the refusal card fits at ${width} with no sideways scroll`, async ({ page, context }) => {
      await page.setViewportSize({ width, height: 900 });
      await signedIn(context, CHILD, freshSignIn);
      await seedDevice(page, { marker: PIN_MARKER, shell: { pinEpoch: EPOCH, pinOwner: ownerRecord(GROWN_UP) } });
      await page.goto('/account/pin-reset');
      await expect(page.getByTestId('pin-reset-line')).toBeVisible();
      const { scroll, inner } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }));
      expect(scroll).toBeLessThanOrEqual(inner);
      const box = await page.getByTestId('pin-reset-back').boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(48);
      if (process.env.PIN_RESET_SHOTS) await page.screenshot({ path: `${process.env.PIN_RESET_SHOTS}/pin-reset-${width}.png`, fullPage: true });
    });
  }
});
