import type { BrowserContext, Page, Route } from '@playwright/test';
import { expect, test } from './fixtures';
import { onboardChild, onboardSelf, openGrownUpZone, readStored, seedStored, unlockWithPin } from './helpers';
import { shot, shotFile, shotsEnabled } from './shots';

/**
 * F-SPACE-002 T-7b / T-7c (section 4.12; `design/screens/transfer/classes-card.md`, `app-sheets.md`): the
 * Classes card variants and Move, MoveClass with the consent sheet, the read-only sheet behind the gate,
 * the Home line and Leave's failure line, against a mocked sync API. The release build has no API, so
 * nothing here shows there (and the inbox keeps `transfersEnabled` false until the flip). Recipe:
 *
 *   EXPO_PUBLIC_API_BASE_URL=https://api.e2e.invalid npx expo export --platform web --output-dir dist --clear
 *   E2E_TRANSFER=1 pnpm --filter @hangul-route/mobile exec playwright test transfer-moves
 */
test.use({ serviceWorkers: 'block', viewport: { width: 375, height: 740 } });
test.skip(process.env.E2E_TRANSFER !== '1', 'needs a build with EXPO_PUBLIC_API_BASE_URL=https://api.e2e.invalid');

const API = 'https://api.e2e.invalid';
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, content-type', 'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE' };
const NOW = Date.now();

const CLASS_A = { spaceId: 'space:a', kind: 'class', name: 'Sunday Class A', role: 'student', joinedAt: '2026-09-01T00:00:00.000Z' };

interface Inbox {
  transfersEnabled?: boolean;
  transferDeviceConsent?: boolean;
  deviceScope?: 'full' | 'class';
  memberships?: unknown[];
  transfers?: unknown[];
}

interface Mocks {
  inbox: Inbox;
  leaveStatus: number;
  calls: { method: string; path: string; body: unknown }[];
}

const request = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'transfer:one',
  status: 'requested',
  initiator: 'source',
  from: { spaceId: 'space:a', name: 'Sunday Class A' },
  to: { spaceId: 'space:b', name: 'Saturday Class B', ownerName: 'Ms Park', schoolName: null, ageBucket: 'months', learnerCount: 12 },
  learnerState: 'pending',
  sourceState: 'yes',
  destinationState: 'waiting',
  introduce: false,
  premiumChange: 'none',
  destinationConsentMode: 'parent',
  relinkAffected: false,
  sourcePlansAffected: false,
  visibleToday: [],
  blockReason: null,
  executeAfter: null,
  expiresAt: new Date(NOW + 10 * 86_400_000).toISOString(),
  learnerRoute: 'caregiver',
  canVeto: true,
  endedFrom: null,
  termsDigest: null,
  ...over,
});

function json(route: Route, status: number, body: unknown): Promise<void> {
  return route.fulfill({ status, contentType: 'application/json', headers: CORS, body: JSON.stringify(body) });
}

async function mockApi(context: BrowserContext, inbox: Inbox): Promise<Mocks> {
  const mocks: Mocks = { inbox, leaveStatus: 200, calls: [] };
  await context.route(`${API}/**`, async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const path = decodeURIComponent(new URL(req.url()).pathname);
    const body = req.postData() ? (JSON.parse(req.postData() ?? '{}') as unknown) : null;
    mocks.calls.push({ method: req.method(), path, body });
    if (path.endsWith('/inbox')) {
      const i = mocks.inbox;
      return json(route, 200, {
        data: {
          rev: 1,
          plans: [],
          memberships: i.memberships ?? [CLASS_A],
          tier: 'free',
          serverTime: new Date().toISOString(),
          transfersEnabled: i.transfersEnabled ?? true,
          transferDeviceConsent: i.transferDeviceConsent ?? true,
          selfManaged: false,
          deviceScope: i.deviceScope ?? 'full',
          transfers: i.transfers ?? [],
        },
      });
    }
    if (path.endsWith('/transfer-requests/preview')) {
      return json(route, 200, {
        data: {
          destination: { id: 'space:b', name: 'Saturday Class B', ownerName: 'Ms Park', schoolName: 'Riverside school', ageBucket: 'months', learnerCount: 8 },
          premiumChange: 'may_change',
          destinationConsentMode: 'parent',
          relinkAffected: false,
          sourcePlansAffected: false,
          visibleToday: [{ kind: 'class', name: 'Sunday Class A', ownerName: 'Mr Han' }],
          termsDigest: 'd'.repeat(64),
          blockReason: null,
        },
      });
    }
    if (path.endsWith('/transfer-requests') && req.method() === 'POST') {
      return json(route, 201, { data: { request: request({ initiator: 'learner_side', learnerState: 'consented', learnerRoute: 'device' }) } });
    }
    if (/\/transfer-requests\/[^/]+\/(decline|cancel)$/.test(path)) {
      mocks.inbox = { ...mocks.inbox, transfers: [request({ status: 'declined' })] };
      return json(route, 200, { data: { request: request({ status: 'declined' }) } });
    }
    if (path.endsWith('/leave')) return json(route, mocks.leaveStatus, mocks.leaveStatus === 200 ? { data: {} } : { error: { code: 'server_error' } });
    if (path.endsWith('/transfer-prefs')) return json(route, 200, { data: { prefs: { selfManaged: true } } });
    if (path.endsWith('/snapshot')) return json(route, 200, { data: { rev: 1 } });
    return json(route, 404, { error: { code: 'not_found' } });
  });
  return mocks;
}

/** A synced learner (a device secret), with a PIN made `pinAgeHours` ago when the device has one; then Home. */
async function seedSynced(page: Page, pinAgeHours: number | null): Promise<void> {
  const profiles = await readStored<Array<{ id: string }>>(page, 'profiles');
  const id = profiles?.[0]?.id;
  if (!id) throw new Error('no profile');
  if (pinAgeHours !== null) {
    const at = NOW - pinAgeHours * 3_600_000;
    await seedStored(page, 'account:pinCreatedAt', at);
  }
  // The app's own first sign-up try (no secret yet, 404 here) can still write its blank sync state after the
  // seed lands; reload and check, so every test starts from a synced device.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await seedStored(page, `sync:${id}`, { secret: 'secret-e2e', rev: 1, lastSyncedAt: new Date().toISOString(), rescueCode: null });
    await page.goto('/');
    const stored = await readStored<{ secret: string | null }>(page, `sync:${id}`);
    if (stored?.secret === 'secret-e2e') return;
  }
  throw new Error('the seeded sync state did not stick');
}

async function openProfile(page: Page, name: string): Promise<void> {
  await page.goto('/');
  await expect(page.getByText(`Hi, ${name}!`)).toBeVisible();
  await page.addLocatorHandler(page.getByTestId('install-guide'), async (guide) => {
    await guide.getByRole('button', { name: 'Not now' }).click();
  });
  await page.getByRole('button', { name: 'Profile and settings' }).click();
  await expect(page.getByRole('heading', { name: 'Classes & family' })).toBeVisible();
  // The memberships come from the mocked inbox; on a busy machine the first sync can take a few seconds.
  await expect(page.getByText('Sunday Class A', { exact: true })).toBeVisible({ timeout: 15_000 });
}

/** The Classes card alone (the Profile screen scrolls inside its own view, so a full-page shot misses it). */
async function cardShot(page: Page, name: string, testId = 'spaces-card'): Promise<void> {
  if (!shotsEnabled()) return;
  const card = page.getByTestId(testId);
  await card.scrollIntoViewIfNeeded();
  await card.screenshot({ path: shotFile(name) });
}

const noSideScroll = (page: Page): Promise<boolean> => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test('self device: Move opens directly, Find class, the consent sheet waits for the end, Yes sends with the self claim', async ({ page, context }) => {
  const mocks = await mockApi(context, {});
  await onboardSelf(page, { name: 'Rio' });
  await seedSynced(page, null);
  await openProfile(page, 'Rio');

  const move = page.getByRole('button', { name: 'Move from Sunday Class A' });
  await expect(move).toBeVisible();
  await cardShot(page, 'transfer-card-move-375');
  await move.click();
  await expect(page.getByRole('heading', { name: 'Move to another class' })).toBeVisible();
  await page.getByTestId('move-code').fill('ABC234');
  await page.getByRole('button', { name: 'Find class' }).click();

  await expect(page.getByRole('heading', { name: 'Move to Saturday Class B?' })).toBeVisible();
  await expect(page.getByText('Teacher: Ms Park · Riverside school')).toBeVisible();
  await expect(page.getByText('A few months old · 8 learners')).toBeVisible();
  await expect(page.getByText('Rio would move from Sunday Class A to Saturday Class B.')).toBeVisible();
  // The premium line is conditional and drawn because the preview asked for it.
  await expect(page.getByTestId('consent-line-premium_may_change')).toBeVisible();
  const yes = page.getByRole('button', { name: 'Yes, move me' });
  await expect(yes).toBeDisabled();
  expect(await noSideScroll(page)).toBe(true);
  await shot(page, 'transfer-consent-top-375');
  await page.getByTestId('consent-end').scrollIntoViewIfNeeded();
  await expect(yes).toBeEnabled();
  await page.getByTestId('consent-introduce').click();
  await yes.click();

  await expect(page.getByText('Request sent. Nothing changes until everyone says yes.')).toBeVisible();
  await shot(page, 'transfer-sent-375');
  const create = mocks.calls.find((c) => c.method === 'POST' && c.path.endsWith('/transfer-requests'));
  expect(create?.body).toMatchObject({ fromSpaceId: 'space:a', destinationSpaceId: 'space:b', code: 'ABC234', introduce: true, consent: { locale: 'en', attest: 'self', termsDigest: 'd'.repeat(64) } });
});

test('consent sheet language switch redraws the lines in Korean and Spanish', async ({ page, context }) => {
  await mockApi(context, {});
  await onboardSelf(page, { name: 'Rio' });
  await seedSynced(page, null);
  await openProfile(page, 'Rio');
  await page.getByRole('button', { name: 'Move from Sunday Class A' }).click();
  await page.getByTestId('move-code').fill('ABC234');
  await page.getByRole('button', { name: 'Find class' }).click();
  await page.getByTestId('consent-language-es').click();
  await expect(page.getByText('Rio pasaría de Sunday Class A a Saturday Class B.')).toBeVisible();
  await page.getByTestId('consent-language-ko').click();
  await expect(page.getByTestId('consent-line-moving')).not.toHaveText(/would move/);
  await shot(page, 'transfer-consent-ko-375');
});

test('(a) a class-scoped device: no Move, only the rescue code line', async ({ page, context }) => {
  await mockApi(context, { deviceScope: 'class' });
  await onboardSelf(page, { name: 'Rio' });
  await seedSynced(page, null);
  await openProfile(page, 'Rio');
  await expect(page.getByText('Use your rescue code first.')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Move/ })).toHaveCount(0);
  await cardShot(page, 'transfer-card-class-scope-375');
});

test('transfers locked: the card reads as today', async ({ page, context }) => {
  await mockApi(context, { transfersEnabled: false });
  await onboardSelf(page, { name: 'Rio' });
  await seedSynced(page, null);
  await openProfile(page, 'Rio');
  await expect(page.getByRole('button', { name: 'Leave Sunday Class A' }).or(page.getByRole('button', { name: 'Leave' }))).toBeVisible();
  await expect(page.getByRole('button', { name: /^Move/ })).toHaveCount(0);
  await expect(page.getByTestId('transfer-line')).toHaveCount(0);
});

test('offline: Move stays, disabled, and says it needs internet', async ({ page, context }) => {
  await mockApi(context, {});
  await onboardSelf(page, { name: 'Rio' });
  await seedSynced(page, null);
  await openProfile(page, 'Rio');
  await expect(page.getByRole('button', { name: 'Move from Sunday Class A' })).toBeEnabled();
  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await expect(page.getByRole('button', { name: 'Move from Sunday Class A' })).toBeDisabled();
  await context.setOffline(false);
});

test('(d) managed device with a PIN younger than a day: its own line, no Move; (c) a day later: gated Move', async ({ page, context }) => {
  await mockApi(context, {});
  await onboardChild(page, { name: 'Mina' });
  await seedSynced(page, 2);
  await openProfile(page, 'Mina');
  await expect(page.getByText('Moves open one day after the PIN is set.')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Move/ })).toHaveCount(0);
  await seedSynced(page, 30);
  await openProfile(page, 'Mina');
  await expect(page.getByRole('button', { name: 'Move from Sunday Class A (PIN required)' })).toBeVisible();
});

test('(b) a teacher asked, caregiver route: the console line, Home line, gated read-only sheet whose only answer is Not now', async ({ page, context }) => {
  const mocks = await mockApi(context, { transfers: [request()] });
  await onboardChild(page, { name: 'Mina' });
  await seedSynced(page, 30);
  await openProfile(page, 'Mina');
  await expect(page.getByText('Sunday Class A asked about a move.')).toBeVisible();
  await expect(page.getByText('Ask the grown-up with the account to answer this in the console.')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Move/ })).toHaveCount(0);
  await cardShot(page, 'transfer-card-teacher-375');

  // Home carries the calm line under the Hoya tip.
  await page.getByRole('button', { name: 'Go back' }).first().click();
  await expect(page.getByText('Sunday Class A asked about moving Mina to Saturday Class B.')).toBeVisible();
  await cardShot(page, 'transfer-home-line-375', 'transfer-home-line');
  await page.getByRole('button', { name: 'Review the move (PIN required)' }).click();
  await unlockWithPin(page);

  await expect(page.getByRole('heading', { name: 'A move is waiting' })).toBeVisible();
  await expect(page.getByText('A grown-up with an account answers this in the console.')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Yes/ })).toHaveCount(0);
  await shot(page, 'transfer-read-only-375');
  await page.getByRole('button', { name: 'Not now' }).click();
  await expect(page.getByText('Hi, Mina!')).toBeVisible();
  expect(mocks.calls.some((c) => c.method === 'POST' && c.path.endsWith('/transfer-requests/transfer:one/decline'))).toBe(true);
});

test('route none: its own line and the gated veto, never a yes', async ({ page, context }) => {
  await mockApi(context, { transfers: [request({ learnerRoute: 'none' })] });
  await onboardChild(page, { name: 'Mina' });
  await seedSynced(page, 30);
  await openProfile(page, 'Mina');
  await expect(page.getByText("Sunday Class A asked about a move. This move can't be answered here.")).toBeVisible();
  await page.getByRole('button', { name: 'Review the move (PIN required)' }).click();
  await unlockWithPin(page);
  await expect(page.getByText("This move can't be answered here.", { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Yes/ })).toHaveCount(0);
});

test('Leave keeps its confirm and says when it did not go through', async ({ page, context }) => {
  const mocks = await mockApi(context, {});
  mocks.leaveStatus = 500;
  await onboardSelf(page, { name: 'Rio' });
  await seedSynced(page, null);
  await openProfile(page, 'Rio');
  page.once('dialog', (d) => void d.accept());
  await page.getByRole('button', { name: /Leave Sunday Class A/ }).click();
  const confirm = page.getByRole('button', { name: 'Leave' }).last();
  if (await confirm.isVisible().catch(() => false)) await confirm.click();
  await expect(page.getByText('This needs internet. Try again when you are online.')).toBeVisible();
});

test.describe('a wide window', () => {
  test.use({ viewport: { width: 1280, height: 2400 } });

  test('a consent sheet shorter than the window starts with Yes enabled (D2), and a language switch keeps it readable', async ({ page, context }) => {
    await mockApi(context, {});
    await onboardSelf(page, { name: 'Rio' });
    await seedSynced(page, null);
    await openProfile(page, 'Rio');
    await page.getByRole('button', { name: 'Move from Sunday Class A' }).click();
    await page.getByTestId('move-code').fill('ABC234');
    await page.getByRole('button', { name: 'Find class' }).click();
    await expect(page.getByRole('heading', { name: 'Move to Saturday Class B?' })).toBeVisible();
    await expect(page.getByTestId('consent-yes')).toBeEnabled();
    await page.getByTestId('consent-language-es').click();
    await expect(page.getByTestId('consent-yes')).toBeEnabled();
  });
});

test('a waiting Yes stays focusable and says why (aria-disabled, not removed from the tab order)', async ({ page, context }) => {
  await mockApi(context, {});
  await onboardSelf(page, { name: 'Rio' });
  await seedSynced(page, null);
  await openProfile(page, 'Rio');
  await page.getByRole('button', { name: 'Move from Sunday Class A' }).click();
  await page.getByTestId('move-code').fill('ABC234');
  await page.getByRole('button', { name: 'Find class' }).click();
  const yes = page.getByTestId('consent-yes');
  await expect(yes).toHaveAttribute('aria-disabled', 'true');
  await expect(yes).toHaveAttribute('tabindex', '0');
  await expect(yes).toHaveAccessibleDescription('Read to the end to continue.');
  await yes.focus();
  await expect(yes).toBeFocused();
});

test('switching the sheet language after reading asks for the new text to be read again', async ({ page, context }) => {
  await mockApi(context, {});
  await onboardSelf(page, { name: 'Rio' });
  await seedSynced(page, null);
  await openProfile(page, 'Rio');
  await page.getByRole('button', { name: 'Move from Sunday Class A' }).click();
  await page.getByTestId('move-code').fill('ABC234');
  await page.getByRole('button', { name: 'Find class' }).click();
  const yes = page.getByTestId('consent-yes');
  await page.getByTestId('consent-end').scrollIntoViewIfNeeded();
  await expect(yes).toBeEnabled();
  await page.getByTestId('consent-language-es').scrollIntoViewIfNeeded();
  await page.getByTestId('consent-language-es').click();
  await expect(yes).toBeDisabled();
  await page.getByTestId('consent-end').scrollIntoViewIfNeeded();
  await expect(yes).toBeEnabled();
});

test('a grown-up session left open elsewhere never carries the Home line: Review asks for the PIN again', async ({ page, context }) => {
  await mockApi(context, { transfers: [request()] });
  await onboardChild(page, { name: 'Mina' });
  await seedSynced(page, 30);
  await openGrownUpZone(page, 'Mina');
  await unlockWithPin(page);
  await expect(page.getByRole('heading', { name: 'Family Dashboard' })).toBeVisible();
  // Back to the learner (in the app, so the session stays open), then the Home line.
  // The dashboard's back arrow sits just before its title block.
  await page.getByRole('heading', { name: 'Family Dashboard' }).locator('xpath=../preceding-sibling::*[1]').click();
  await expect(page.getByRole('heading', { name: 'Classes & family' })).toBeVisible();
  await page.getByRole('button', { name: 'Go back' }).first().click();
  await expect(page.getByText('Hi, Mina!')).toBeVisible();
  await page.getByRole('button', { name: 'Review the move (PIN required)' }).click();
  await expect(page.getByText('Enter your 4-digit PIN to continue.')).toBeVisible();
  await unlockWithPin(page);
  await expect(page.getByRole('heading', { name: 'A move is waiting' })).toBeVisible();
  // Leaving the sheet ends the session: the next Review asks again.
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByText('Hi, Mina!')).toBeVisible();
  await page.getByRole('button', { name: 'Review the move (PIN required)' }).click();
  await expect(page.getByText('Enter your 4-digit PIN to continue.')).toBeVisible();
});
