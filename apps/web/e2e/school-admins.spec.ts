import { expect, test, type Page, type Route } from '@playwright/test';
import { API, NOW, SESSION_KEY } from './report-fixtures';

/**
 * [SA] AMENDMENTS-SEATS-ADMINS section 6.6 (row SA-4; mocks design/screens/console/admins-panel.md and
 * admin-invite-accept.md): the Administrators panel on the school page for its owner and an administrator, the
 * one-time invite box, Revoke with Keep it, Stop being an administrator with the done note on the next home, school
 * Settings as an administrator, and the invite page from the link (the fragment captured and stripped, the sign-in
 * redirect without the token, the preview, Accept and the done note). At 320 px and wide. The API is mocked with
 * `page.route`; the Worker side is the backend's admins tests. Same export as reports.spec.ts:
 *
 *   NEXT_PUBLIC_API_BASE_URL=https://api.report-e2e.test NEXT_PUBLIC_CONSOLE_DEV_AUTH=true pnpm --filter @hangul-route/web build
 *   REPORTS_E2E=1 pnpm --filter @hangul-route/web exec playwright test school-admins
 *
 * `SHOTS_DIR` saves a screenshot of each state for a look by eye.
 */
test.skip(process.env.REPORTS_E2E !== '1', 'needs the export built against the mocked report API (REPORTS_E2E=1)');

const SCHOOL_ID = 'space:maple';
const CLASS_ID = 'space:sunday-b';
const TOKEN = 'q7RmA9xLwPz2Kc4Vt8Yb6Nh3Jd5Fg1SeUoQiWr0ZaBk';

const space = (id: string, kind: 'class' | 'school', name: string, parentSpaceId: string | null = null) => ({
  id,
  kind,
  name,
  parentSpaceId,
  settings: { consentMode: 'school', anonymizeRoster: true },
  archivedAt: null,
  createdAt: '2026-09-01T00:00:00.000Z',
});

const json = (route: Route, status: number, body: unknown) =>
  route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });

interface Mock {
  calls: string[];
  bodies: string[];
}

type Viewer = 'ms-park' | 'mr-lee' | 'jin';

async function mockConsole(page: Page, viewer: Viewer, opts: { signedIn?: boolean } = {}): Promise<Mock> {
  const mock: Mock = { calls: [], bodies: [] };
  let invites = [{ id: 'invite:open', createdAt: '2026-10-14T09:00:00.000Z', expiresAt: '2026-10-21T09:00:00.000Z' }];
  let joined = false;
  await page.clock.setFixedTime(new Date(NOW));
  const names: Record<Viewer, string> = { 'ms-park': 'Ms Park', 'mr-lee': 'Mr Lee', jin: 'Jin Cho' };
  if (opts.signedIn !== false) {
    await page.addInitScript(
      ([key, id, name]) => window.sessionStorage.setItem(key as string, JSON.stringify({ token: id, accountId: id, displayName: name, email: 'jin.cho@example.org' })),
      [SESSION_KEY, viewer, names[viewer]],
    );
  }
  await page.route(`${API}/**`, async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    const url = new URL(request.url());
    const path = decodeURIComponent(url.pathname);
    mock.calls.push(`${request.method()} ${path}`);
    mock.bodies.push(request.postData() ?? '');
    const owner = viewer === 'ms-park';
    if (path === '/api/admin-invites/preview') return json(route, 200, { data: { state: 'open', school: { name: 'Maple School' }, invitedBy: 'Ms Park', expiresAt: '2026-10-22T12:00:00.000Z' } });
    if (path === '/api/admin-invites/accept') {
      joined = true;
      return json(route, 200, { data: { space: { id: SCHOOL_ID, kind: 'school', name: 'Maple School' }, role: 'admin' } });
    }
    if (path.endsWith('/admin-invites') && request.method() === 'POST') {
      const invite = { id: 'invite:new', createdAt: NOW, expiresAt: '2026-10-22T12:00:00.000Z' };
      invites = [...invites, invite];
      return json(route, 201, { data: { invite, url: `https://app.hangulroute.com/account/invite#t=${TOKEN}` } });
    }
    if (path.includes('/admin-invites/') && request.method() === 'DELETE') {
      const id = path.split('/admin-invites/')[1];
      invites = invites.filter((i) => i.id !== id);
      return json(route, 200, { data: { revoked: true } });
    }
    if (path.endsWith('/admins/leave')) return json(route, 200, { data: { left: true, stays: 'teacher' } });
    if (path.endsWith('/admins')) {
      const lee = { accountId: 'mr-lee', name: 'Mr Lee', joinedAt: '2026-10-03T10:00:00.000Z', staysTeacher: true, ...(owner ? { email: 'lee@example.org' } : {}) };
      const jin = { accountId: 'jin', name: 'Jin Cho', joinedAt: NOW, staysTeacher: false };
      const admins = joined ? [lee, jin] : [lee];
      const events = [
        { kind: 'class_renamed', at: '2026-10-13T10:00:00.000Z', actorName: 'Ms Park', subjectName: null },
        { kind: 'admin_invite_created', at: '2026-10-14T09:00:00.000Z', actorName: 'Ms Park', subjectName: null },
        { kind: 'admin_joined', at: '2026-10-03T10:00:00.000Z', actorName: 'Mr Lee', subjectName: 'Mr Lee' },
        { kind: 'admin_left', at: '2026-09-28T10:00:00.000Z', actorName: null, subjectName: null },
      ];
      return json(route, 200, { data: { owner: { accountId: 'ms-park', name: 'Ms Park' }, admins: admins.slice(0, 2), limit: 2, ...(owner ? { invites, events } : {}) } });
    }
    if (path.endsWith('/school')) {
      return json(route, 200, {
        data: {
          school: space(SCHOOL_ID, 'school', 'Maple School'),
          invite: { joinCode: 'SCH234', joinCodeExpiresAt: '2026-11-30T00:00:00.000Z' },
          license: null,
          limits: { licensed: false, students: 50, teachers: null },
          usage: { students: 31, teachers: 3 },
          thisWeek: { students: 31, practiced: 18, classes: 1, classesWithPlan: 1 },
          classes: [{ space: space(CLASS_ID, 'class', 'Sunday Class B', SCHOOL_ID), teacher: { accountId: 'mr-lee', name: 'Mr Lee' }, students: 18, practiced: 9, lastActiveAt: NOW, hasPublishedPlan: true, canRename: true, openMoves: false }],
          canRename: true,
        },
      });
    }
    if (path.endsWith('/members')) {
      const row = (memberId: string, role: string, name: string, canRemove: boolean) => ({ memberKind: 'account', memberId, role, joinedAt: '2026-09-01T00:00:00.000Z', name, isOwner: role === 'owner', canRemove });
      return json(route, 200, {
        data: {
          members: [row('ms-park', 'owner', 'Ms Park', false), row('mr-lee', 'admin', 'Mr Lee', owner), row('dr-cho', 'admin', 'Dr Cho', owner), row('ms-han', 'teacher', 'Ms Han', true)],
        },
      });
    }
    if (path.endsWith('/roster')) {
      return json(route, 200, { data: { space: space(SCHOOL_ID, 'school', 'Maple School'), learners: [], joinCode: 'SCH234', joinCodeExpiresAt: '2026-11-30T00:00:00.000Z', canRename: true, openMoves: false } });
    }
    if (url.pathname === '/api/spaces') {
      const role = viewer === 'ms-park' ? 'owner' : viewer === 'mr-lee' ? 'admin' : joined ? 'admin' : null;
      const list = role ? [{ space: space(SCHOOL_ID, 'school', 'Maple School'), role, counts: { learners: 0, accounts: 4, classes: 1 }, joinCode: null, joinCodeExpiresAt: null }] : [];
      return json(route, 200, { data: { spaces: list } });
    }
    return json(route, 200, { data: { plans: [], requests: [], entitlements: [], learners: [], notices: [] } });
  });
  return mock;
}

async function shot(page: Page, name: string): Promise<void> {
  if (process.env.SHOTS_DIR) await page.screenshot({ path: `${process.env.SHOTS_DIR}/${name}.png`, fullPage: true });
}

/** Nothing on the page scrolls sideways. */
async function noSideScroll(page: Page): Promise<void> {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

for (const width of [320, 1280]) {
  test.describe(`at ${width} px`, () => {
    test.use({ viewport: { width, height: 900 } });

    test('owner: the panel, the one-time invite box, Close, Revoke with Keep it, the history', async ({ page }) => {
      const mock = await mockConsole(page, 'ms-park');
      await page.goto(`/teach/space?id=${encodeURIComponent(SCHOOL_ID)}`);
      const panel = page.getByTestId('admins-panel');
      await expect(panel.getByRole('heading', { level: 2, name: 'Administrators' })).toBeVisible();
      await expect(panel.getByText('1 of 2 added')).toBeVisible();
      await expect(panel.getByText('lee@example.org')).toBeVisible();
      await expect(panel.getByText('Invite made Oct 14 · ends Oct 21, 2026')).toBeVisible();
      await expect(panel.getByText('All 2 places are taken.', { exact: false })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Manage billing' })).toBeVisible();
      await noSideScroll(page);
      await shot(page, `admins-owner-${width}`);

      // Revoke: the sheet's dismiss is Keep it; then the invite goes and Invite comes back.
      await panel.getByRole('button', { name: 'Revoke' }).click();
      const sheet = page.getByTestId('confirm-sheet');
      await expect(sheet.getByRole('button', { name: 'Keep it' })).toBeFocused();
      await shot(page, `admins-revoke-sheet-${width}`);
      await sheet.getByRole('button', { name: 'Revoke' }).click();
      await expect(panel.getByText('Invite revoked. The link no longer works.')).toBeVisible();
      await expect(panel.getByTestId('admins-open-invite')).toHaveCount(0);

      // Invite: in a dev build there is no step-up; the box shows the link once.
      const invite = panel.getByRole('button', { name: 'Invite an administrator' });
      await expect(invite).toBeVisible();
      expect((await invite.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
      await invite.click();
      const box = panel.getByTestId('admins-invite-box');
      await expect(box).toBeFocused();
      await expect(box.getByTestId('admins-invite-url')).toHaveText(`https://app.hangulroute.com/account/invite#t=${TOKEN}`);
      await expect(box.getByText('It works once and ends on Oct 22, 2026.', { exact: false })).toBeVisible();
      await noSideScroll(page);
      await shot(page, `admins-invite-box-${width}`);
      await box.getByRole('button', { name: 'Close' }).click();
      await expect(panel.getByTestId('admins-invite-box')).toHaveCount(0);
      await expect(page.getByText(TOKEN, { exact: false })).toHaveCount(0);
      // Nothing in this tab's storage or address holds the token.
      expect(await page.evaluate(() => JSON.stringify({ ...window.sessionStorage }) + JSON.stringify({ ...window.localStorage }) + window.location.href)).not.toContain(TOKEN);
      await expect(page).not.toHaveTitle(/Maple/);

      await panel.getByText('History').click();
      await expect(panel.getByText('A former member stopped being an administrator · Sep 28')).toBeVisible();
      await shot(page, `admins-history-${width}`);
      expect(mock.calls).toContain(`DELETE /api/spaces/${SCHOOL_ID}/admin-invites/invite:open`);
    });

    test('administrator: no Manage billing, no emails; Stop lands on the teacher home with the done note', async ({ page }) => {
      await mockConsole(page, 'mr-lee');
      await page.goto(`/teach/space?id=${encodeURIComponent(SCHOOL_ID)}`);
      const panel = page.getByTestId('admins-panel');
      await expect(panel.getByText('Mr Lee · admin · joined Oct 3')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Manage billing' })).toHaveCount(0);
      await expect(panel.getByText('@example.org', { exact: false })).toHaveCount(0);
      await expect(panel.getByRole('button', { name: 'Remove' })).toHaveCount(0);
      await noSideScroll(page);
      await shot(page, `admins-admin-${width}`);
      await panel.getByRole('button', { name: 'Stop being an administrator' }).click();
      const sheet = page.getByTestId('confirm-sheet');
      await expect(sheet.getByText('You stay a teacher of the school, with your classes.')).toBeVisible();
      await shot(page, `admins-leave-sheet-${width}`);
      await sheet.getByRole('button', { name: 'Stop being an administrator' }).click();
      await expect(page).toHaveURL(/\/teach\/home/);
      await expect(page.getByTestId('console-flash')).toHaveText("You're no longer an administrator of Maple School.");
      expect(page.url()).not.toContain('Maple');
      await shot(page, `admins-left-${width}`);
    });

    test('administrator: school Settings read-only, Remove on the teacher only, no Danger zone', async ({ page }) => {
      await mockConsole(page, 'mr-lee');
      await page.goto(`/teach/space/settings?id=${encodeURIComponent(SCHOOL_ID)}`);
      await expect(page.getByText("Only the school's owner can change these settings.")).toBeVisible();
      await expect(page.getByText('Rosters show initials.')).toBeVisible();
      await expect(page.getByRole('checkbox')).toHaveCount(0);
      await expect(page.getByRole('radio')).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Remove' })).toHaveCount(1);
      await expect(page.getByText('Danger zone')).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Rename Maple School' })).toBeVisible();
      await noSideScroll(page);
      await shot(page, `admins-settings-${width}`);
    });

    test('the invite link: the fragment captured and stripped, the preview, Accept, the school page with the done note', async ({ page }) => {
      const mock = await mockConsole(page, 'jin');
      await page.goto(`/account/invite#t=${TOKEN}`);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Join Maple School as an administrator?');
      await expect(page.getByText('Invited by Ms Park')).toBeVisible();
      await expect(page.getByText('Signed in as jin.cho@example.org')).toBeVisible();
      await expect(page).toHaveTitle('Administrator invite');
      await expect.poll(() => page.evaluate(() => window.location.hash)).toBe('');
      expect(page.url()).not.toContain(TOKEN);
      await noSideScroll(page);
      await shot(page, `invite-preview-${width}`);
      // The token went in the JSON body only.
      expect(mock.bodies.some((b) => b.includes(TOKEN))).toBe(true);
      expect(mock.calls.some((c) => c.includes(TOKEN))).toBe(false);
      await page.getByRole('button', { name: 'Accept' }).click();
      await expect(page).toHaveURL(new RegExp(`/teach/space\\?id=${encodeURIComponent(SCHOOL_ID)}`));
      await expect(page.getByTestId('console-flash')).toHaveText("You're an administrator of Maple School.");
      expect(await page.evaluate(() => window.sessionStorage.getItem('hr:admin-invite'))).toBeNull();
      await shot(page, `invite-done-${width}`);
    });

    test('signed out: the link goes to /signin?next=/account/invite with the invite line, no token in the address', async ({ page }) => {
      await mockConsole(page, 'jin', { signedIn: false });
      await page.goto(`/account/invite#t=${TOKEN}`);
      await expect(page).toHaveURL(/\/signin\?next=%2Faccount%2Finvite$/);
      await expect(page.getByText('Sign in to see this invite.')).toBeVisible();
      expect(page.url()).not.toContain(TOKEN);
      expect(await page.evaluate(() => window.sessionStorage.getItem('hr:admin-invite'))).toContain(TOKEN);
      await noSideScroll(page);
      await shot(page, `invite-signin-${width}`);
    });
  });
}
