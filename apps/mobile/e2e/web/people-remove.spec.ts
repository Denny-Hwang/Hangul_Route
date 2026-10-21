import { getMessages } from '@hangul-route/i18n';
import type { BrowserContext, Page } from '@playwright/test';
import { classScopeMarker } from '../../src/logic/transfers/device-scope';
import { expect, test } from './fixtures';
import { headerBack, onboardChild, readStored, unlockWithPin } from './helpers';
import { shot } from './shots';

/**
 * [OA] Remove from this device (AMENDMENTS-ONE-ACCOUNT-MANY-USERS OA-D13, sections 10.4, 10.6, 20; row OA-7a; CS-12,
 * CS-20): Grown-up area → People on this device → a learner → Remove from this device asks a fresh PIN and a
 * ConfirmSheet with the name; a saved learner is removed with Remove; an unsaved one first tries to sync, then offers
 * Save progress first and a second step to remove anyway; no stored key with the removed id remains, and the removal
 * calls no route (a class-scoped learner included). Needs a bundle with the chooser on and an API address (mocked here,
 * every request recorded and refused), so it runs only with `E2E_WHO_API=1`:
 *
 *   EXPO_PUBLIC_WHO_CHOOSER=true EXPO_PUBLIC_API_BASE_URL=https://api.e2e.invalid npx expo export --platform web --output-dir dist --clear
 *   E2E_WHO_API=1 pnpm --filter @hangul-route/mobile exec playwright test people-remove
 */
test.skip(process.env.E2E_WHO_API !== '1', 'needs a build with EXPO_PUBLIC_WHO_CHOOSER=true and EXPO_PUBLIC_API_BASE_URL=https://api.e2e.invalid');
test.use({ serviceWorkers: 'block', viewport: { width: 360, height: 740 } });

const API = 'https://api.e2e.invalid';
const en = getMessages('en');
const people = en.caregiver.people;
const JUN = 'profile:jun00001';
const SORA = 'profile:sora0001';
const JUN_SECRET = 'jun-device-secret-0001';
const RESCUE = 'TIGER-MOON-RIVER';
/** A push acknowledged after every write of the test. */
const LATER = '2099-01-01T00:00:00.000Z';

interface Call {
  at: number;
  method: string;
  url: string;
  auth: string;
  body: string;
}

/** Every request to the API is recorded and refused (the device is "offline" for the server). */
async function recordApi(context: BrowserContext): Promise<Call[]> {
  const calls: Call[] = [];
  await context.route(`${API}/**`, async (route) => {
    const req = route.request();
    calls.push({ at: Date.now(), method: req.method(), url: req.url(), auth: (await req.headerValue('authorization')) ?? '', body: req.postData() ?? '' });
    await route.abort('internetdisconnected');
  });
  return calls;
}

/** Every key the app stored (IndexedDB, the `platform/storage` database). */
function storedKeys(page: Page): Promise<string[]> {
  return page.evaluate(
    () =>
      new Promise<string[]>((resolve, reject) => {
        const open = indexedDB.open('keyval-store');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const all = db.transaction('keyval').objectStore('keyval').getAllKeys();
          all.onerror = () => reject(all.error);
          all.onsuccess = () => {
            db.close();
            resolve(all.result.map(String));
          };
        };
      }),
  );
}

/** Writes several stored values at once, then loads the app again so its stores hydrate from them. */
async function seedMany(page: Page, values: Record<string, unknown>): Promise<void> {
  await page.evaluate(
    (entries) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('keyval-store');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction('keyval', 'readwrite');
          for (const [k, json] of entries) tx.objectStore('keyval').put(json, `hr:${k}`);
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    Object.entries(values).map(([k, v]) => [k, JSON.stringify(v)] as const),
  );
  await page.goto('/');
}

const snapshot = (id: string, updatedAt: string) => ({ profileId: id, quests: [], cards: [], sessions: [], homework: [], reviews: [], placements: [], updatedAt });
const syncRecord = (patch: Record<string, unknown>) => ({ secret: JUN_SECRET, rev: 1, lastSyncedAt: LATER, lastError: null, rescueCode: RESCUE, pendingProfile: null, profileAt: null, ...patch });

/**
 * Mina through onboarding (PIN set), then Jun and Sora added. `jun` is Jun's stored state beyond the profile: every
 * per-profile key a session leaves, so the sweep has something to find.
 */
async function device(page: Page, jun: Record<string, unknown> = {}): Promise<string> {
  await onboardChild(page, { name: 'Mina', startJourney: false });
  const profiles = (await readStored<Array<Record<string, unknown>>>(page, 'profiles')) ?? [];
  const mina = profiles[0]!;
  const now = new Date().toISOString();
  await seedMany(page, {
    profiles: [...profiles, { ...mina, id: JUN, displayName: 'Jun', createdAt: now }, { ...mina, id: SORA, displayName: 'Sora', createdAt: now }],
    [`progress:${JUN}`]: snapshot(JUN, '2026-10-21T09:00:00.000Z'),
    [`settings:${JUN}`]: { romanization: 'show' },
    [`route-ui:${JUN}`]: { planPromptDismissedAt: now },
    [`free-end-seen:${JUN}`]: true,
    [`placement-ui:${JUN}`]: { dismissedAt: now },
    [`story:bookmarks:${JUN}`]: { v: 1, bookmarks: {} },
    ...jun,
  });
  return mina.id as string;
}

/** The chooser (shared device), Mina, then the Grown-up area through the PIN. */
async function grownUpArea(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { name: en.learner.who.title, exact: true })).toBeVisible();
  await page.getByRole('button', { name: en.a11y.who.tile('Mina'), exact: true }).click();
  await expect(page.getByText('Hi, Mina!')).toBeVisible();
  await page.getByRole('button', { name: 'Profile and settings' }).click();
  await page.getByTestId('profile-group-grown-ups-toggle').click();
  await page.getByTestId('profile-grown-up-area').click();
  await unlockWithPin(page);
  await expect(page.getByText(people.title, { exact: true })).toBeVisible();
}

const sheet = (page: Page) => page.getByTestId('remove-sheet');

test.describe('Remove from this device', () => {
  test('a saved, class-scoped learner: fresh PIN, the sheet with the name, Remove; no key with the id and no route (CS-12, CS-20, 10.6)', async ({ page, context }) => {
    const calls = await recordApi(context);
    await page.clock.install();
    await device(page, {
      [`sync:${JUN}`]: syncRecord({}),
      [`memberships:${JUN}`]: [{ spaceId: 'space:c', kind: 'class', name: 'Sunflower', role: 'learner', joinedAt: '2026-10-02T00:00:00.000Z' }],
      [`transfer-scope:${JUN}`]: classScopeMarker(JUN_SECRET),
      [`transfers-on:${JUN}`]: true,
      [`notes:${JUN}`]: { v: 1, notes: [] },
    });
    await grownUpArea(page);
    await shot(page, 'people-on-device-360');
    await page.setViewportSize({ width: 320, height: 640 });
    await shot(page, 'people-on-device-320');
    await page.setViewportSize({ width: 1280, height: 800 });
    await shot(page, 'people-on-device-1280');
    await page.setViewportSize({ width: 360, height: 740 });

    await page.getByRole('button', { name: 'Jun', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Jun', exact: true })).toBeVisible();
    await expect(page.getByRole('switch', { name: people.lock })).toBeVisible();
    await page.setViewportSize({ width: 320, height: 640 });
    await shot(page, 'person-on-device-320');
    await page.setViewportSize({ width: 360, height: 740 });

    // The PIN is older than 2 minutes: Remove asks it again (OA-D5b (3)); the open session alone is not enough.
    await page.clock.fastForward(3 * 60_000);
    await page.getByTestId('person-remove').click();
    await expect(page.getByText('Enter your 4-digit PIN to continue.')).toBeVisible();
    await unlockWithPin(page);

    await expect(sheet(page)).toBeVisible();
    await expect(sheet(page).getByText(people.removeAsk('Jun'), { exact: true })).toBeVisible();
    await expect(sheet(page).getByText(people.removeSaved, { exact: true })).toBeVisible();
    await expect(sheet(page).getByText(people.spacesStay, { exact: true })).toBeVisible();
    // The Rescue Code is on the sheet before Remove deletes the only copy on this device.
    await expect(sheet(page).getByTestId('remove-sheet-code')).toHaveText(RESCUE);
    await expect(sheet(page).getByTestId('remove-sheet-quiet')).toHaveCount(0);
    await page.setViewportSize({ width: 320, height: 640 });
    await shot(page, 'remove-saved-320');
    await page.setViewportSize({ width: 1280, height: 800 });
    await shot(page, 'remove-saved-1280');
    await page.setViewportSize({ width: 360, height: 740 });

    const before = await storedKeys(page);
    expect(before.filter((k) => k.includes(JUN)).length).toBeGreaterThanOrEqual(10);
    const removedAt = Date.now();
    await sheet(page).getByRole('button', { name: en.console.confirm.remove, exact: true }).click();

    // Back in the Grown-up area; Jun is gone from the list, Mina is still the active learner.
    await expect(page.getByText(people.title, { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Jun', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Sora', exact: true })).toBeVisible();
    await expect.poll(async () => (await storedKeys(page)).filter((k) => k.includes(JUN))).toEqual([]);
    expect((await readStored<{ ids: string[] }>(page, 'profiles:tombstones'))?.ids).toEqual([JUN]);
    // The device secret and the Rescue Code of that learner are nowhere in storage.
    for (const key of await storedKeys(page)) {
      const value = JSON.stringify(await readStored(page, key.replace(/^hr:/, '')));
      expect(value, key).not.toContain(JUN_SECRET);
      expect(value, key).not.toContain(RESCUE);
    }
    // No route for the removed learner after the removal (CS-12), and no delete of anything at all.
    await page.waitForLoadState('networkidle');
    const after = calls.filter((c) => c.at >= removedAt);
    expect(after.filter((c) => c.url.includes(encodeURIComponent(JUN)) || c.url.includes(JUN) || c.auth.includes(JUN_SECRET) || c.body.includes(JUN))).toEqual([]);
    expect(calls.filter((c) => c.method === 'DELETE')).toEqual([]);
  });

  test('a pending queue tries to sync first; still unsaved: Save progress first is the main action, Remove anyway needs a second step (CS-12)', async ({ page, context }) => {
    const calls = await recordApi(context);
    // Registered, but a local write after the last push: not saved yet.
    await device(page, { [`sync:${JUN}`]: syncRecord({ lastSyncedAt: '2026-10-21T08:00:00.000Z' }) });
    await grownUpArea(page);
    await page.getByRole('button', { name: 'Jun', exact: true }).click();
    const pushed = calls.length;
    await page.getByTestId('person-remove').click();
    await expect(sheet(page).getByText(people.removeUnsaved, { exact: true })).toBeVisible();
    // The sheet tried the push for Jun before it said "only on this device".
    expect(calls.slice(pushed).some((c) => c.auth.includes(JUN_SECRET))).toBe(true);
    const buttons = sheet(page).getByRole('button');
    await expect(buttons).toHaveText([people.saveFirst, en.common.buttons.cancel, people.removeAnyway]);
    await expect(sheet(page).getByRole('button', { name: en.common.buttons.cancel, exact: true })).toBeFocused();
    await page.setViewportSize({ width: 320, height: 640 });
    await shot(page, 'remove-unsaved-320');
    await page.setViewportSize({ width: 360, height: 740 });

    // Save progress first opens Save my progress for Jun, not for the active learner.
    await sheet(page).getByRole('button', { name: people.saveFirst, exact: true }).click();
    await expect(page.getByTestId('rescue-code')).toContainText('TIGER');
    await headerBack(page).click();

    await page.getByTestId('person-remove').click();
    await sheet(page).getByRole('button', { name: people.removeAnyway, exact: true }).click();
    await expect(sheet(page).getByText(people.removeAnywayAsk, { exact: true })).toBeVisible();
    await expect(sheet(page).getByRole('button')).toHaveText([people.keep, en.console.confirm.remove]);
    await expect(sheet(page).getByRole('button', { name: people.keep, exact: true })).toBeFocused();
    await page.setViewportSize({ width: 320, height: 640 });
    await shot(page, 'remove-anyway-320');
    await page.setViewportSize({ width: 360, height: 740 });
    await sheet(page).getByRole('button', { name: people.keep, exact: true }).click();
    await expect(sheet(page)).toHaveCount(0);
    expect((await storedKeys(page)).some((k) => k.includes(JUN))).toBe(true);

    await page.getByTestId('person-remove').click();
    await sheet(page).getByRole('button', { name: people.removeAnyway, exact: true }).click();
    await sheet(page).getByRole('button', { name: en.console.confirm.remove, exact: true }).click();
    await expect(page.getByRole('button', { name: 'Jun', exact: true })).toHaveCount(0);
    await expect.poll(async () => (await storedKeys(page)).filter((k) => k.includes(JUN))).toEqual([]);
  });

  test('removing the active learner opens the chooser; removing the last one opens Welcome; the PIN stays; a class-scoped learner calls no route (10.6)', async ({ page, context }) => {
    const calls = await recordApi(context);
    const SORA_SECRET = 'sora-device-secret-0001';
    // Sora is class-scoped too (section 10.6: a device with two class-scoped learners).
    const mina = await device(page, {
      // Registered, with a local write after the last push: not saved (the Remove anyway path below).
      [`sync:${SORA}`]: { ...syncRecord({ lastSyncedAt: '2026-10-21T08:00:00.000Z' }), secret: SORA_SECRET },
      [`progress:${SORA}`]: snapshot(SORA, '2026-10-21T09:00:00.000Z'),
      [`memberships:${SORA}`]: [{ spaceId: 'space:c', kind: 'class', name: 'Sunflower', role: 'learner', joinedAt: '2026-10-02T00:00:00.000Z' }],
      [`transfer-scope:${SORA}`]: classScopeMarker(SORA_SECRET),
    });
    /** Removes `name` through Remove anyway; answers the time of the final Remove (the sync check before it may push). */
    const removeAnyway = async (name: string): Promise<number> => {
      await page.getByRole('button', { name, exact: true }).click();
      await page.getByTestId('person-remove').click();
      await sheet(page).getByRole('button', { name: people.removeAnyway, exact: true }).click();
      const at = Date.now();
      await sheet(page).getByRole('button', { name: en.console.confirm.remove, exact: true }).click();
      return at;
    };
    await grownUpArea(page);

    // Mina is the active learner: the chooser opens, without her tile.
    await removeAnyway('Mina');
    await expect(page.getByRole('heading', { name: en.learner.who.title, exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: en.a11y.who.tile('Mina'), exact: true })).toHaveCount(0);
    await expect.poll(async () => (await storedKeys(page)).filter((k) => k.includes(mina))).toEqual([]);

    // Sora picks up the device; the grown-up removes Jun (not active: the Grown-up area stays), then Sora, the last.
    await page.getByRole('button', { name: en.a11y.who.tile('Sora'), exact: true }).click();
    await expect(page.getByText('Hi, Sora!')).toBeVisible();
    await page.getByRole('button', { name: 'Profile and settings' }).click();
    await page.getByTestId('profile-group-grown-ups-toggle').click();
    await page.getByTestId('profile-grown-up-area').click();
    await unlockWithPin(page);
    await removeAnyway('Jun');
    await expect(page.getByText(people.title, { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Jun', exact: true })).toHaveCount(0);
    const soraRemovedAt = await removeAnyway('Sora');
    await expect(page.getByRole('button', { name: "Let's start" })).toBeVisible();
    await expect.poll(async () => (await storedKeys(page)).filter((k) => k.includes(SORA))).toEqual([]);
    await page.waitForLoadState('networkidle');
    expect(calls.filter((c) => c.at >= soraRemovedAt && (c.url.includes(SORA) || c.url.includes(encodeURIComponent(SORA)) || c.auth.includes(SORA_SECRET) || c.body.includes(SORA)))).toEqual([]);

    await expect.poll(() => readStored(page, 'profiles')).toEqual([]);
    expect(await readStored(page, 'account:parentPinHash')).not.toBeNull();
  });
});
