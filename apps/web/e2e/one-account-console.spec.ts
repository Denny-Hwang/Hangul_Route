import { createHash } from 'node:crypto';
import { expect, test, type BrowserContext, type Page, type Route } from '@playwright/test';
import { getMessages } from '@hangul-route/i18n';
import { API, NOW, SESSION_KEY } from './report-fixtures';

/**
 * [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS section 20, row OA-3, on the console export: the Learner app exit opens the
 * learner app's chooser (`who=1`); the `deviceUses` record holds no name; a second tab locks when the learner app's
 * chooser opens (the `hr-grownup` message, CS-2); the set-a-PIN card shows once on a `nopin` browser; the persona home's
 * Let this account reset the PIN here writes `pinOwner` (a fingerprint, never the id) after a fresh PIN.
 *
 * The console needs an API origin and a signed-in session, so this runs on the same export as `reports.spec.ts`:
 *
 *   NEXT_PUBLIC_API_BASE_URL=https://api.report-e2e.test NEXT_PUBLIC_CONSOLE_DEV_AUTH=true pnpm --filter @hangul-route/web build
 *   ONE_ACCOUNT_E2E=1 pnpm --filter @hangul-route/web exec playwright test one-account-console.spec
 *
 * The API is mocked with `page.route` (nothing leaves the machine). The dev sign-in stands in for a password, so the
 * moment-3 reverification is the dev bridge's (no Clerk dialog); Clerk's own dialog and passkeys are covered by the
 * unit and component tests.
 */
const FULL = process.env.ONE_ACCOUNT_E2E === '1';
const c = getMessages('en').console;
const ACCOUNT = 'acct-e2e';
const AT = Date.parse(NOW);
const EPOCH = AT - 24 * 60 * 60_000;

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

/** A signed-in dev session (its unlock, if any, seeded per test) and one family the account owns. */
async function mockConsole(context: BrowserContext, unlock: Record<string, unknown> | null): Promise<void> {
  await context.clock.setFixedTime(new Date(NOW));
  await context.addInitScript(
    ([key, account, record]) => {
      window.sessionStorage.setItem(key as string, JSON.stringify({ token: account, accountId: account, displayName: 'Ms Kim', email: 'kim@example.com' }));
      if (record) window.sessionStorage.setItem('hr:grownup:unlock', record as string);
    },
    [SESSION_KEY, ACCOUNT, unlock ? JSON.stringify(unlock) : null],
  );
  await context.route(`${API}/**`, async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const path = new URL(request.url()).pathname;
    if (path === '/api/spaces') return json(route, 200, { spaces: [{ space: FAMILY, role: 'owner', counts: { learners: 0, accounts: 1, classes: 0 } }] });
    if (path.endsWith('/roster')) return json(route, 200, { space: FAMILY, learners: [], joinCode: 'KIM123', joinCodeExpiresAt: '2026-11-15T12:00:00.000Z' });
    if (path.endsWith('/plans')) return json(route, 200, { plans: [] });
    if (path === '/api/entitlements') return json(route, 200, { entitlements: [] });
    return json(route, 404, null);
  });
}

/** Writes the learner app's device marker (idb-keyval's default store, a JSON string) and shell-store keys. */
async function seedDevice(page: Page, input: { marker?: Record<string, unknown>; shell?: Record<string, unknown> }): Promise<void> {
  // The site's landing page: same origin, no grown-up router that would navigate away mid-write.
  await page.goto('/');
  await page.evaluate(async ({ marker, shell }) => {
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
    if (marker) await put('keyval-store', 'keyval', [['hr:device:gate', JSON.stringify(marker)], ['hr:profiles', JSON.stringify([{ id: 'p1' }])]]);
    if (shell) await put('hr-shell', 'kv', Object.entries(shell));
  }, input);
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

const signInUnlock = { v: 1, at: AT - 1_000, seen: AT - 1_000, src: 'signin' };

test.describe('one account, many users: the console side (row OA-3)', () => {
  test.skip(!FULL, 'needs the console e2e export (ONE_ACCOUNT_E2E=1)');

  test('the Learner app exit opens the learner app at its chooser, label kept', async ({ page, context }) => {
    await mockConsole(context, null);
    await page.goto('/parent');
    const exit = page.getByTestId('frame-learner-app');
    await expect(exit).toHaveText(c.shell.backToLearning);
    await Promise.all([page.waitForURL((url) => url.pathname === '/' && url.search === '?lang=en&who=1'), exit.click()]);
    expect(await page.evaluate(() => window.sessionStorage.getItem('hr:grownup:unlock'))).toBeNull();
  });

  test('the persona home writes deviceUses with no name, email or id; Sign out deletes it', async ({ page, context }) => {
    await mockConsole(context, null);
    await page.goto('/parent');
    await expect(page.getByTestId('adult-frame')).toBeVisible();
    await expect.poll(() => readShell(page, 'deviceUses')).toEqual({ v: 1, uses: ['family'], at: AT });
    const stored = JSON.stringify(await readShell(page, 'deviceUses'));
    expect(stored).not.toMatch(/Kim|kim@|space:|acct-e2e/);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByTestId('frame-sign-out').click();
    await expect.poll(() => readShell(page, 'deviceUses')).toBeUndefined();
  });

  test('a second tab locks when the learner app’s chooser opens (hr-grownup, CS-2)', async ({ page, context }) => {
    await mockConsole(context, signInUnlock);
    await seedDevice(page, { marker: { v: 1, gate: 'nopin' }, shell: { pinPromptSeen: true } });
    await page.goto('/parent');
    await expect(page.getByTestId('adult-frame')).toBeVisible();
    const other = await context.newPage();
    await other.goto('/');
    await other.evaluate(() => {
      const channel = new BroadcastChannel('hr-grownup');
      channel.postMessage({ v: 1, kind: 'lock' });
      channel.close();
    });
    await expect(page.getByTestId('grown-up-lock')).toBeVisible();
    expect(await page.evaluate(() => window.sessionStorage.getItem('hr:grownup:unlock'))).toBeNull();
    // A dev build has no Clerk, so no passkey is offered.
    await expect(page.getByTestId('grown-up-lock-passkey')).toHaveCount(0);
  });

  test('junk on hr-grownup changes nothing', async ({ page, context }) => {
    await mockConsole(context, signInUnlock);
    await seedDevice(page, { marker: { v: 1, gate: 'nopin' }, shell: { pinPromptSeen: true } });
    await page.goto('/parent');
    await expect(page.getByTestId('adult-frame')).toBeVisible();
    await page.evaluate(() => {
      const channel = new BroadcastChannel('hr-grownup');
      channel.postMessage({ v: 1, kind: 'lock', profileId: 'p1' });
      channel.postMessage('lock');
      channel.close();
    });
    await page.waitForTimeout(300);
    await expect(page.getByTestId('grown-up-lock')).toHaveCount(0);
  });

  test('the set-a-PIN card shows once on a nopin browser', async ({ page, context }) => {
    await mockConsole(context, signInUnlock);
    await seedDevice(page, { marker: { v: 1, gate: 'nopin' } });
    await page.goto('/parent');
    const card = page.getByTestId('pin-prompt-card');
    await expect(card).toContainText(c.pinPrompt.body);
    await expect(page.getByTestId('pin-prompt-open')).toHaveText(c.pinPrompt.cta);
    await expect.poll(() => readShell(page, 'pinPromptSeen')).toBe(true);
    await page.reload();
    await expect(page.getByTestId('adult-frame')).toBeVisible();
    await expect(page.getByTestId('pin-prompt-card')).toHaveCount(0);
  });

  test('a fresh PIN, then Let this account reset the PIN here, writes the fingerprint as owner', async ({ page, context }) => {
    await mockConsole(context, { v: 1, at: AT - 10_000, seen: AT - 10_000, src: 'pin', pinEpoch: EPOCH });
    await seedDevice(page, { marker: { v: 1, gate: 'pin', pinEpoch: EPOCH }, shell: { pinEpoch: EPOCH } });
    await page.goto('/parent');
    const card = page.getByTestId('pin-owner-card');
    await expect(card).toContainText(c.pinOwner.hint);
    await page.getByTestId('pin-owner-cta').click();
    await expect(page.getByTestId('pin-owner-done')).toContainText(c.pinOwner.done);
    const owner = createHash('sha256').update(ACCOUNT).digest('hex').slice(0, 16);
    await expect.poll(() => readShell(page, 'pinOwner')).toEqual({ v: 1, owner, epoch: EPOCH });
    expect(JSON.stringify(await readShell(page, 'pinOwner'))).not.toContain(ACCOUNT);
  });

  for (const width of [320, 1280]) {
    test(`the cards fit at ${width} with no sideways scroll`, async ({ page, context }) => {
      await page.setViewportSize({ width, height: 900 });
      await mockConsole(context, { v: 1, at: AT - 10_000, seen: AT - 10_000, src: 'pin', pinEpoch: EPOCH });
      await seedDevice(page, { marker: { v: 1, gate: 'pin', pinEpoch: EPOCH }, shell: { pinEpoch: EPOCH } });
      await page.goto('/parent');
      await expect(page.getByTestId('pin-owner-card')).toBeVisible();
      const { scroll, inner } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }));
      expect(scroll).toBeLessThanOrEqual(inner);
      const box = await page.getByTestId('pin-owner-cta').boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(48);
      if (process.env.ONE_ACCOUNT_SHOTS) await page.screenshot({ path: `${process.env.ONE_ACCOUNT_SHOTS}/pin-owner-${width}.png`, fullPage: true });
      await page.getByTestId('pin-owner-cta').click();
      await expect(page.getByTestId('pin-owner-done')).toBeVisible();
      if (process.env.ONE_ACCOUNT_SHOTS) await page.getByTestId('adult-frame').screenshot({ path: `${process.env.ONE_ACCOUNT_SHOTS}/pin-owner-done-${width}.png` });
    });

    test(`the set-a-PIN card fits at ${width} with no sideways scroll`, async ({ page, context }) => {
      await page.setViewportSize({ width, height: 900 });
      await mockConsole(context, signInUnlock);
      await seedDevice(page, { marker: { v: 1, gate: 'nopin' } });
      await page.goto('/parent');
      await expect(page.getByTestId('pin-prompt-card')).toBeVisible();
      const { scroll, inner } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }));
      expect(scroll).toBeLessThanOrEqual(inner);
      if (process.env.ONE_ACCOUNT_SHOTS) await page.screenshot({ path: `${process.env.ONE_ACCOUNT_SHOTS}/pin-prompt-${width}.png` });
    });
  }
});
