import { getMessages } from '@hangul-route/i18n';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { onboardChild, readStored, seedStored, unlockWithPin } from './helpers';
import { shot } from './shots';

/**
 * [OA] "Who is using this?" (AMENDMENTS-ONE-ACCOUNT-MANY-USERS row OA-4a, section 20): the device's one chooser in
 * the learner app. The chooser is on by default since row OA-10, so it runs on the release build (`build:web`) in
 * every pull request; only a bundle built with the kill switch off (`EXPO_PUBLIC_WHO_CHOOSER=false`) skips it, with
 * `E2E_WHO=0`:
 *
 *   pnpm --filter @hangul-route/mobile build:web
 *   pnpm --filter @hangul-route/mobile exec playwright test who-is-using
 *
 * Covered: launch on a shared device, one tap to Home, the return after 30 minutes in the background, a
 * single-learner device not asked, the class join link (the caption, then Join prefilled for the learner picked),
 * `who=1` with a held join (the join is kept), CS-2 (the session and the console tab state end on arrival, the other
 * tabs are told), CS-5 (no Back; a `gate=` intent ends on a PIN screen whose Cancel returns here, and whose correct PIN
 * still hands off to the console or to All lessons), CS-16 (a learner added in another tab survives a pick here) and
 * CS-21 (the pending 24-hour wait with Cancel the wait). G7 (a tile tap to Home, p95 within 300 ms) runs with
 * `E2E_WHO_TIMING=1` too, for the nightly switch-on lane, which row OA-10 wires (spec section 22).
 */
test.skip(process.env.E2E_WHO === '0', 'a build with the kill switch EXPO_PUBLIC_WHO_CHOOSER=false (E2E_WHO=0)');
test.use({ viewport: { width: 360, height: 740 } });

const en = getMessages('en');
const w = en.learner.who;
const title = (page: Page) => page.getByRole('heading', { name: w.title, exact: true });
const tile = (page: Page, name: string) => page.getByRole('button', { name: en.a11y.who.tile(name), exact: true });

/** Mina through onboarding (PIN set), then Joon added to the stored list: a shared family device. */
async function sharedDevice(page: Page, extra: { id: string; name: string; avatar?: string }[] = [{ id: 'profile:joon0001', name: 'Joon' }]): Promise<void> {
  await onboardChild(page, { name: 'Mina', startJourney: false });
  const profiles = (await readStored<Array<Record<string, unknown>>>(page, 'profiles')) ?? [];
  const mina = profiles[0]!;
  await seedStored(page, 'profiles', [
    ...profiles,
    ...extra.map((p) => ({ ...mina, id: p.id, displayName: p.name, avatar: p.avatar ?? mina.avatar, createdAt: new Date().toISOString() })),
  ]);
}

async function hideAndShow(page: Page, awayMs: number): Promise<void> {
  const set = (state: 'hidden' | 'visible') =>
    page.evaluate((s) => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => s });
      document.dispatchEvent(new Event('visibilitychange'));
    }, state);
  await set('hidden');
  await page.clock.fastForward(awayMs);
  await set('visible');
}

test.describe('Who is using this?', () => {
  test('launch on a shared device shows the chooser; one tap on a tile opens that learner\'s Home', async ({ page }) => {
    await sharedDevice(page);
    await expect(title(page)).toBeVisible();
    await expect(tile(page, 'Mina')).toBeVisible();
    await expect(tile(page, 'Joon')).toBeVisible();
    await expect(page.getByRole('button', { name: en.a11y.who.grownUpRow(en.caregiver.audience.family.zoneLabel) })).toBeVisible();
    // No progress words on the chooser (CS-6).
    await expect(page.getByTestId('who-tiles')).not.toContainText(/star|card|level|streak|day/i);
    await shot(page, 'who-is-using-360');
    await page.setViewportSize({ width: 320, height: 640 });
    await shot(page, 'who-is-using-320');
    await page.setViewportSize({ width: 1280, height: 800 });
    await shot(page, 'who-is-using-1280');
    await page.setViewportSize({ width: 360, height: 740 });

    await tile(page, 'Joon').click();
    await expect(page.getByText('Hi, Joon!')).toBeVisible();
    await expect.poll(() => readStored(page, 'profiles:active')).toBe('profile:joon0001');
    // The Home Switch button (between Display and Profile) opens it again.
    await page.setViewportSize({ width: 320, height: 640 });
    await shot(page, 'who-home-switch-button-320');
    await page.setViewportSize({ width: 360, height: 740 });
    await page.getByTestId('home-who-switch').click();
    await expect(title(page)).toBeVisible();
    await shot(page, 'who-is-using-home-switch-360');
  });

  test('a single-learner device is not asked at launch', async ({ page }) => {
    await onboardChild(page, { name: 'Mina', startJourney: false });
    await page.goto('/');
    await expect(page.getByText('Hi, Mina!')).toBeVisible();
    await expect(title(page)).toHaveCount(0);
    await expect(page.getByTestId('home-who-switch')).toHaveCount(0);
  });

  test('back after 30 minutes in the background shows the chooser over Home; a shorter break does not', async ({ page }) => {
    await page.clock.install();
    await sharedDevice(page);
    await expect(title(page)).toBeVisible();
    await tile(page, 'Mina').click();
    await expect(page.getByText('Hi, Mina!')).toBeVisible();
    await hideAndShow(page, 29 * 60_000);
    await expect(title(page)).toHaveCount(0);
    await hideAndShow(page, 30 * 60_000);
    await expect(title(page)).toBeVisible();
    // The learner who was playing goes straight back to the screen under it.
    await tile(page, 'Mina').click();
    await expect(page.getByText('Hi, Mina!')).toBeVisible();
  });

  test('the class join link on a shared device: the caption, then Join prefilled for the learner picked (OA-D20)', async ({ page }) => {
    await sharedDevice(page);
    await page.goto('/join#c=abc234');
    await expect(title(page)).toBeVisible();
    await expect(page.getByText(w.joinCaption, { exact: true })).toBeVisible();
    // The code is not in the address.
    expect(await page.evaluate(() => location.href)).not.toContain('ABC234');
    await shot(page, 'who-is-using-join-360');
    await tile(page, 'Joon').click();
    await expect(page.getByRole('heading', { name: en.caregiver.join.title, exact: true })).toBeVisible();
    await expect(page.getByTestId('join-code')).toHaveValue('ABC234');
    await expect.poll(() => readStored(page, 'profiles:active')).toBe('profile:joon0001');
  });

  /** Written as the who=1 page starts (as the family home leaves it), so the page running before it cannot take it. */
  async function handOffCode(page: Page): Promise<void> {
    await page.addInitScript(() => {
      if (location.search.includes('who=1')) sessionStorage.setItem('hr:shell:joinCode', JSON.stringify({ v: 1, code: 'FAM234', at: Date.now() }));
    });
  }

  test('who=1 with a held hand-off code, Who is joining? off (E2E_MULTI_JOIN=0): the chooser once, with the caption', async ({ page }) => {
    test.skip(process.env.E2E_MULTI_JOIN !== '0', 'Who is joining? is on by default since row OA-10; this is its kill switch (EXPO_PUBLIC_MULTI_JOIN=false, E2E_MULTI_JOIN=0)');
    await sharedDevice(page);
    await handOffCode(page);
    await page.goto('/?who=1');
    await expect(title(page)).toBeVisible();
    await expect(page.getByText(w.joinCaption, { exact: true })).toBeVisible();
    expect(await page.evaluate(() => location.search)).toBe('');
    await tile(page, 'Mina').click();
    await expect(page.getByTestId('join-code')).toHaveValue('FAM234');
  });

  test('who=1 with a held hand-off code, Who is joining? on (the default since OA-10): Join takes the code for the checklist, and leaving it shows the chooser once (OA-D20, CS-5)', async ({ page }) => {
    test.skip(process.env.E2E_MULTI_JOIN === '0', 'a build with EXPO_PUBLIC_MULTI_JOIN=false');
    await sharedDevice(page);
    await handOffCode(page);
    await page.goto('/?who=1');
    // The family code's lookup leads to the checklist (join-batch.spec.ts, on a build with the API); the code is
    // never in the address.
    await expect(page.getByRole('heading', { name: en.caregiver.join.title, exact: true })).toBeVisible();
    await expect(page.getByTestId('join-code')).toHaveValue('FAM234');
    expect(await page.evaluate(() => location.href)).not.toContain('FAM234');
    // Leaving Join still asks who is using the device before anyone plays.
    await page.getByRole('button', { name: 'Back' }).click();
    await expect(title(page)).toBeVisible();
    await tile(page, 'Mina').click();
    await expect(page.getByText('Hi, Mina!')).toBeVisible();
  });

  test('CS-2: arriving clears the tab\'s unlock and console session, tells the other tabs, and a grown-up row asks the PIN', async ({ page, context }) => {
    await sharedDevice(page);
    await tile(page, 'Mina').click();
    await expect(page.getByText('Hi, Mina!')).toBeVisible();
    const other = await context.newPage();
    await other.goto('/');
    await other.evaluate(() => {
      const heard: unknown[] = [];
      (window as Window & { __heard?: unknown[] }).__heard = heard;
      new BroadcastChannel('hr-grownup').onmessage = (event) => heard.push(event.data);
    });
    // As a grown-up hand-off would have left them in this tab.
    await page.evaluate(() => {
      sessionStorage.setItem('hr:grownup:unlock', '{"v":1}');
      sessionStorage.setItem('hr:console:session', '{"v":1}');
    });
    await page.getByTestId('home-who-switch').click();
    await expect(title(page)).toBeVisible();
    expect(await page.evaluate(() => [sessionStorage.getItem('hr:grownup:unlock'), sessionStorage.getItem('hr:console:session')])).toEqual([null, null]);
    await expect.poll(() => other.evaluate(() => (window as Window & { __heard?: unknown[] }).__heard)).toContainEqual({ v: 1, kind: 'lock' });
    await page.getByTestId('who-row-area').click();
    await expect(page.getByText('Enter your 4-digit PIN to continue.')).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(title(page)).toBeVisible();
  });

  test('CS-5: no Back, the browser back stays, and a gate intent ends on a PIN screen whose Cancel returns here', async ({ page }) => {
    await sharedDevice(page);
    await expect(title(page)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Back' })).toHaveCount(0);
    // Opened over Home: the browser (and phone) back is held, so Home never shows without a pick.
    await tile(page, 'Mina').click();
    await page.getByTestId('home-who-switch').click();
    await expect(title(page)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Back' })).toHaveCount(0);
    await page.goBack();
    await expect(title(page)).toBeVisible();
    await page.waitForTimeout(300);
    await expect(title(page)).toBeVisible();
    await page.goto('/?gate=grown-up&next=%2Fparent');
    await expect(page.getByText('Enter your 4-digit PIN to continue.')).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(title(page)).toBeVisible();
  });

  test.describe('the console hand-off', () => {
    // A service worker that controls the page serves /parent itself, past the stand-in route.
    test.use({ serviceWorkers: 'block' });

    test('CS-5: a correct PIN on a gate intent over the launch chooser still hands off: the console gets its unlock', async ({ page }) => {
      await sharedDevice(page);
      await page.route(
        (url) => url.pathname === '/parent' || url.pathname.startsWith('/parent/'),
        (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Grown-up page</title><p>Grown-up page stand-in</p>' }),
      );
      await page.goto('/?gate=grown-up&next=%2Fparent');
      await unlockWithPin(page);
      await expect(page.getByText('Grown-up page stand-in')).toBeVisible();
      // The chooser the PIN screen went back to as the tab left did not clear what the hand-off wrote.
      const unlock = JSON.parse((await page.evaluate(() => sessionStorage.getItem('hr:grownup:unlock'))) ?? 'null') as Record<string, unknown> | null;
      expect(unlock).toMatchObject({ v: 1, src: 'pin' });
    });
  });

  test('CS-5: a correct PIN on gate=browse over the launch chooser opens All lessons with its pass', async ({ page }) => {
    await sharedDevice(page);
    await page.goto('/?gate=browse');
    await unlockWithPin(page);
    await expect(page).toHaveURL(/\/browse$/);
    const pass = JSON.parse((await page.evaluate(() => sessionStorage.getItem('hr:browse:pass'))) ?? 'null') as Record<string, unknown> | null;
    expect(pass).toMatchObject({ v: 1, source: 'gate' });
  });

  test('G7: a tile tap renders that learner\'s Home within 300 ms at the 95th percentile (nightly)', async ({ page }) => {
    test.skip(process.env.E2E_WHO_TIMING !== '1', 'G7 is measured on the nightly switch-on lane (E2E_WHO_TIMING=1)');
    test.setTimeout(120_000);
    await sharedDevice(page);
    const samples: number[] = [];
    for (let i = 0; i < 20; i += 1) {
      await expect(title(page)).toBeVisible();
      const name = i % 2 === 0 ? 'Joon' : 'Mina';
      // Timed in the page: from the tap to the first frame whose text greets that learner.
      const ms = await page.evaluate(
        ({ label, greeting }) =>
          new Promise<number>((resolve, reject) => {
            const button = Array.from(document.querySelectorAll<HTMLElement>('[role="button"]')).find((b) => b.getAttribute('aria-label') === label);
            if (button === undefined) return reject(new Error(`no tile ${label}`));
            const t0 = performance.now();
            const check = (): void => {
              if (!document.body.innerText.includes(greeting)) return void requestAnimationFrame(check);
              resolve(performance.now() - t0);
            };
            button.click();
            requestAnimationFrame(check);
          }),
        { label: en.a11y.who.tile(name), greeting: `Hi, ${name}!` },
      );
      samples.push(ms);
      await page.getByTestId('home-who-switch').click();
    }
    const sorted = [...samples].sort((a, b) => a - b);
    const p95 = sorted[Math.ceil(0.95 * sorted.length) - 1]!;
    test.info().annotations.push({ type: 'G7 p95 (ms)', description: p95.toFixed(0) });
    expect(p95).toBeLessThanOrEqual(300);
  });

  test('CS-16: a learner added in another tab shows here and survives a pick here', async ({ page, context }) => {
    await sharedDevice(page);
    await expect(title(page)).toBeVisible();
    const other = await context.newPage();
    await other.goto('/');
    await expect(title(other)).toBeVisible();
    // The other tab's store adds Sora and tells the tabs, as the app does after a write.
    await other.evaluate(
      () =>
        new Promise<void>((resolve, reject) => {
          const open = indexedDB.open('keyval-store');
          open.onerror = () => reject(open.error);
          open.onsuccess = () => {
            const db = open.result;
            const store = db.transaction('keyval', 'readwrite').objectStore('keyval');
            const get = store.get('hr:profiles');
            get.onsuccess = () => {
              const list = JSON.parse(get.result as string) as Array<Record<string, unknown>>;
              store.put(JSON.stringify([...list, { ...list[0], id: 'profile:sora0001', displayName: 'Sora' }]), 'hr:profiles');
              store.transaction.oncomplete = () => {
                db.close();
                new BroadcastChannel('hr-profiles').postMessage({ v: 1, kind: 'changed' });
                resolve();
              };
            };
          };
        }),
    );
    await expect(tile(page, 'Sora')).toBeVisible();
    await tile(page, 'Joon').click();
    await expect(page.getByText('Hi, Joon!')).toBeVisible();
    await expect
      .poll(async () => ((await readStored<Array<{ id: string }>>(page, 'profiles')) ?? []).map((p) => p.id))
      .toContain('profile:sora0001');
  });

  test('CS-21: a running 24-hour wait shows on the chooser; Cancel the wait asks the PIN and stops it', async ({ page }) => {
    await sharedDevice(page);
    await seedStored(page, 'account:pinResetRequestedAt', new Date(Date.now() - 60 * 60_000).toISOString());
    await expect(title(page)).toBeVisible();
    await expect(page.getByTestId('who-reset-pending')).toContainText(/A new grown-up PIN can be set after .+\. Enter the PIN to cancel\./);
    await shot(page, 'who-is-using-reset-pending-360');
    await page.getByRole('button', { name: w.resetCancel }).click();
    await expect(page.getByRole('button', { name: 'Forgot PIN?' })).toHaveCount(0);
    await unlockWithPin(page);
    await expect(title(page)).toBeVisible();
    await expect(page.getByTestId('who-reset-pending')).toHaveCount(0);
    await expect.poll(() => readStored(page, 'account:pinResetRequestedAt')).toBeNull();
  });
});
