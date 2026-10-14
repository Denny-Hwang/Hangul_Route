import { expect, test, type Page, type Route } from '@playwright/test';
import { en } from '@hangul-route/i18n';

/**
 * F-FEEDBACK-001 FB-14 (section 15, `apps/web/e2e/notes.spec.ts`): the console's notes over the static export, the
 * account API mocked with `page.route` (nothing leaves the machine). Notes are on by default since FB-14; the full
 * cases need an export that points at the mocked API and lets the dev sign-in through:
 *
 *   NEXT_PUBLIC_API_BASE_URL=https://api.notes-e2e.test NEXT_PUBLIC_CONSOLE_DEV_AUTH=true pnpm --filter @hangul-route/web build
 *   NOTES_E2E=1 pnpm --filter @hangul-route/web exec playwright test notes.spec
 *
 * Covered: compose from the roster (Send a note on a card opens the composer with that learner), a text problem
 * message, send to everyone, the sent list's statuses; the family Received and Sent tabs, Stop notes from this sender
 * and Allow again; no sideways scroll at 320, 375 and 768. Like reports.spec.ts, no CI lane runs it yet (a lane is a
 * workflow change); each notes PR runs that build and suite locally.
 */
test.skip(process.env.NOTES_E2E !== '1', 'needs the export built against the mocked notes API (NOTES_E2E=1)');

const API = 'https://api.notes-e2e.test';
const SESSION_KEY = 'hr:console:session';
const n = en.console.notes;
const presets = en.common.notes.presets;
const NOW = new Date().toISOString();

const space = (id: string, kind: 'class' | 'family', name: string) => ({
  id,
  kind,
  name,
  parentSpaceId: null,
  settings: { consentMode: 'parent', anonymizeRoster: false },
  archivedAt: null,
  createdAt: '2026-09-01T00:00:00.000Z',
});
const CLASS = space('space:sunflower', 'class', 'Sunflower');
const FAMILY = space('space:kim', 'family', 'Kim family');
const learner = (id: string, displayName: string) => ({ id, displayName, ageGroup: 'starter', avatar: 'tiger', joinedAt: '2026-09-02T00:00:00.000Z', lastActiveAt: null, lastSyncedAt: null, summary: null });
const LEARNERS = [learner('profile:mina', 'Mina'), learner('profile:jun', 'Jun')];

interface Call {
  method: string;
  path: string;
  body: unknown;
}

interface Mocks {
  calls: Call[];
  sent: unknown[];
  blocks: unknown[];
}

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
const json = (route: Route, status: number, data: unknown) =>
  route.fulfill({ status, contentType: 'application/json', headers: CORS, body: JSON.stringify(status < 300 ? { data } : { error: { code: 'mocked' } }) });

const sentRow = (over: Record<string, unknown>) => ({
  batchId: 'batch:1',
  presetId: 'progress_reading',
  text: null,
  suggest: null,
  label: null,
  createdAt: NOW,
  mine: true,
  ...over,
});

const oversightRow = (over: Record<string, unknown>) => ({
  id: 'note:aaaaaaaa',
  spaceId: 'space:sunflower',
  spaceKind: 'class',
  spaceName: 'Sunflower',
  from: { role: 'teacher', label: null },
  senderName: null,
  mine: false,
  presetId: 'progress_reading',
  text: 'Loved your reading in class today',
  suggest: null,
  createdAt: NOW,
  status: 'opened',
  reaction: 'thanks',
  hiddenBy: null,
  reportedBy: null,
  ...over,
});

/** A signed-in dev session and the account API: the space with this viewer's role, its roster, and the note routes. */
async function mockConsole(page: Page, kind: 'class' | 'family'): Promise<Mocks> {
  const mine = kind === 'class' ? CLASS : FAMILY;
  const role = kind === 'class' ? 'teacher' : 'owner';
  const mocks: Mocks = { calls: [], sent: [], blocks: [] };
  await page.addInitScript(
    ([key]) => window.sessionStorage.setItem(key as string, JSON.stringify({ token: 'acct-e2e', accountId: 'acct-e2e', displayName: 'Ms Kim' })),
    [SESSION_KEY],
  );
  await page.route(`${API}/**`, async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const path = decodeURIComponent(new URL(request.url()).pathname);
    const method = request.method();
    const body = request.postData() ? (JSON.parse(request.postData() ?? '{}') as unknown) : null;
    mocks.calls.push({ method, path, body });
    if (path === '/api/spaces') return json(route, 200, { spaces: [{ space: mine, role, counts: { learners: LEARNERS.length, accounts: 1, classes: 0 } }] });
    if (path.endsWith('/roster')) return json(route, 200, { space: mine, learners: LEARNERS, joinCode: null, joinCodeExpiresAt: null });
    if (path.endsWith('/notes/recipients')) return json(route, 200, { learners: LEARNERS.map((l) => ({ id: l.id, displayName: l.displayName, notes: 'all', today: 0 })) });
    if (/\/spaces\/[^/]+\/notes$/.test(path) && method === 'POST') {
      const send = body as { presetId: string; text?: string };
      mocks.sent = [sentRow({ id: 'note:new00001', batchId: 'batch:new', to: 'everyone', size: 2, presetId: send.presetId, text: send.text ?? null, status: 'sent' }), ...mocks.sent];
      return json(route, 201, { batchId: 'batch:new', sent: 2, skipped: [], presetsOnly: [] });
    }
    if (/\/spaces\/[^/]+\/notes$/.test(path)) return json(route, 200, { rows: mocks.sent, next: null });
    if (path.endsWith('/note-senders')) return json(route, 200, { senders: [{ accountId: 'acct-e2e', name: 'Ms Kim', isOwner: true, canSend: true }] });
    if (/\/learners\/[^/]+\/notes$/.test(path)) {
      return json(route, 200, {
        rows: [
          oversightRow({}),
          oversightRow({
            id: 'note:bbbbbbbb',
            spaceId: 'space:kim',
            spaceKind: 'family',
            spaceName: 'Kim family',
            from: { role: 'family', label: 'grandma' },
            senderName: 'Grandma Lee',
            presetId: 'warm_thinking_of_you',
            text: null,
            status: 'live',
            reaction: null,
          }),
        ],
        next: null,
      });
    }
    if (path.endsWith('/note-prefs')) return json(route, 200, { classes: 'all', acknowledged: true, updatedBy: null });
    if (path.endsWith('/blocks') && method === 'POST') {
      mocks.blocks = [{ senderRef: 'sender:one', label: 'Sunflower', createdAt: NOW, role: 'teacher', name: 'Sunflower' }];
      return json(route, 201, {});
    }
    if (path.endsWith('/blocks')) return json(route, 200, { blocks: mocks.blocks });
    if (/\/blocks\/[^/]+$/.test(path) && method === 'DELETE') {
      mocks.blocks = [];
      return json(route, 200, {});
    }
    return json(route, 200, { plans: [], requests: [], entitlements: [] });
  });
  return mocks;
}

async function noSidewaysScroll(page: Page): Promise<void> {
  const { scroll, inner } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }));
  expect(scroll).toBeLessThanOrEqual(inner);
}

const NEVER = /unread|ignored|no reply|ranking|leaderboard/i;

test.describe('a class: compose from the roster, send to everyone, the sent list', () => {
  test('Send a note on a card opens the composer with that learner; a link is refused; everyone gets it; the list shows the statuses', async ({ page }) => {
    const mocks = await mockConsole(page, 'class');
    mocks.sent = [
      sentRow({ id: 'note:old00001', to: 'learner', learnerId: 'profile:jun', displayName: 'Jun', status: 'not_shown', reaction: null, createdAt: '2026-10-01T10:00:00.000Z' }),
      sentRow({ id: 'note:old00002', batchId: 'batch:2', to: 'learner', learnerId: 'profile:mina', displayName: 'Mina', status: 'withdrawn', reaction: null, createdAt: '2026-10-01T09:00:00.000Z' }),
    ];
    await page.goto('/teach/space?id=space%3Asunflower');
    const minaSend = page.getByRole('link', { name: n.sendNote.cta }).first();
    await expect(minaSend).toBeVisible();
    await minaSend.click();

    const composer = page.getByRole('dialog', { name: n.composer.title });
    await expect(composer).toBeVisible();
    await expect(page).toHaveURL(/compose=1/);
    await expect(composer.getByRole('checkbox', { name: 'Mina' })).toBeChecked();
    await expect(composer.getByRole('checkbox', { name: 'Jun' })).not.toBeChecked();

    await composer.getByRole('radio', { name: presets.progress_reading }).check();
    const words = composer.getByLabel(n.composer.text.label);
    await words.fill('Read more at example.com');
    await expect(composer.getByText(n.composer.problems.link('example.com'))).toBeVisible();
    await expect(words).toHaveAttribute('aria-invalid', 'true');
    await words.fill('Great reading today');
    await expect(composer.getByText(n.composer.problems.link('example.com'))).toHaveCount(0);

    await composer.getByRole('radio', { name: n.composer.to.everyone.class('Sunflower', 2) }).check();
    await composer.getByRole('button', { name: n.composer.send.cta }).click();
    await expect(composer.getByTestId('compose-result')).toContainText(n.composer.result.sent.class(2));
    const send = mocks.calls.find((c) => c.method === 'POST' && c.path === '/api/spaces/space:sunflower/notes');
    expect(send?.body).toMatchObject({ to: { kind: 'everyone' }, presetId: 'progress_reading', text: 'Great reading today', textLocale: 'en' });
    await composer.getByRole('button', { name: n.composer.result.done.cta }).click();
    await expect(composer).toHaveCount(0);

    const rows = page.getByTestId('sent-row');
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText(n.sent.to.everyone.class(2));
    await expect(rows.nth(0)).toContainText(n.status.sent);
    await expect(rows.nth(0)).toContainText('Great reading today');
    await expect(rows.nth(1)).toContainText(n.status.not_shown);
    await expect(rows.nth(2)).toContainText(n.status.withdrawn);
    // A class sender never reads "Opened" (OD-8).
    await expect(page.getByText(n.status.opened, { exact: true })).toHaveCount(0);
    expect(await page.locator('main').innerText()).not.toMatch(NEVER);
  });
});

test.describe('a family: Received and Sent tabs, stop a sender and allow again', () => {
  test('Received lists every note with its sender line; Stop notes asks first, the stopped sender can be allowed again; Sent shows Opened', async ({ page }) => {
    const mocks = await mockConsole(page, 'family');
    mocks.sent = [sentRow({ id: 'note:fam00001', to: 'learner', learnerId: 'profile:mina', displayName: 'Mina', status: 'opened', reaction: 'did_it', label: 'mom' })];
    await page.goto('/parent/space/notes?id=space%3Akim&tab=received');

    const tabs = page.getByRole('tablist', { name: n.family.tabs.label });
    await expect(tabs.getByRole('tab', { name: n.family.tabs.received })).toHaveAttribute('aria-selected', 'true');
    const rows = page.getByTestId('received-row');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText(n.family.from.class('Sunflower'));
    await expect(rows.nth(1)).toContainText(n.family.from.homeSigned('Grandma'));
    await expect(rows.nth(1)).toContainText(n.family.sentBy('Grandma Lee'));

    await rows.nth(0).getByRole('button', { name: n.family.actions.block.cta }).click();
    const sheet = page.getByRole('dialog', { name: n.family.blockConfirm.title });
    await expect(sheet).toContainText(n.family.blockConfirm.body('Mina'));
    await sheet.getByRole('button', { name: n.family.blockConfirm.cta }).click();
    await expect(sheet).toHaveCount(0);
    expect(mocks.calls.find((c) => c.method === 'POST' && c.path.endsWith('/learners/profile:mina/blocks'))?.body).toEqual({ noteId: 'note:aaaaaaaa' });

    await page.getByRole('button', { name: n.family.settings.title('Mina') }).click();
    await expect(page.getByRole('heading', { name: n.family.settings.stopped.title })).toBeVisible();
    await page.getByRole('button', { name: n.family.settings.stopped.allowAgain.cta }).click();
    await expect(page.getByRole('heading', { name: n.family.settings.stopped.title })).toHaveCount(0);
    expect(mocks.calls.some((c) => c.method === 'DELETE' && c.path.endsWith('/blocks/sender:one'))).toBe(true);

    await tabs.getByRole('tab', { name: n.family.tabs.sent }).click();
    await expect(page).toHaveURL(/tab=sent/);
    const sent = page.getByTestId('sent-row');
    await expect(sent).toHaveCount(1);
    await expect(sent.first()).toContainText(n.status.opened);
    await expect(sent.first()).toContainText(en.common.notes.reactions.did_it);
    expect(await page.locator('main').innerText()).not.toMatch(NEVER);
  });
});

test.describe('no sideways scroll', () => {
  for (const width of [320, 375, 768]) {
    test(`at ${width}: the class notes page with the composer open`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await mockConsole(page, 'class');
      await page.goto('/teach/space/notes?id=space%3Asunflower&compose=1');
      await expect(page.getByRole('dialog', { name: n.composer.title })).toBeVisible();
      await expect(page.getByRole('radio', { name: presets.progress_reading })).toBeVisible();
      await noSidewaysScroll(page);
      await page.screenshot({ path: test.info().outputPath(`notes-composer-${width}.png`), fullPage: true });
    });

    test(`at ${width}: the family Received tab`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await mockConsole(page, 'family');
      await page.goto('/parent/space/notes?id=space%3Akim&tab=received');
      await expect(page.getByTestId('received-row')).toHaveCount(2);
      await noSidewaysScroll(page);
      await page.screenshot({ path: test.info().outputPath(`notes-received-${width}.png`), fullPage: true });
    });
  }
});
