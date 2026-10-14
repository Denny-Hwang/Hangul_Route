import { expect, test, type Page, type Route } from '@playwright/test';
import { CLASS_SCOPE_TEXT } from '@hangul-route/content-schema';
import { en } from '@hangul-route/i18n';

/**
 * [TV] AMENDMENTS-TEACHER-VISIBILITY-TRANSFER section 7 (`apps/web/e2e/class-moves.spec.ts`): the console's teacher
 * move sheet (direct and into another teacher's class), the Teacher moves section, the family's class-scope and move
 * notice cards on the parent home, and the teacher's Words block on a learner report, over the static export with the
 * account API mocked through `page.route` (nothing leaves the machine). The full cases need an export that points at
 * the mocked API, lets the dev sign-in through and shows class moves:
 *
 *   NEXT_PUBLIC_API_BASE_URL=https://api.moves-e2e.test NEXT_PUBLIC_CONSOLE_DEV_AUTH=true NEXT_PUBLIC_CLASS_TRANSFER=enabled pnpm --filter @hangul-route/web build
 *   CLASS_MOVES_E2E=1 pnpm --filter @hangul-route/web exec playwright test class-moves.spec
 *
 * Like notes.spec.ts and reports.spec.ts, no CI lane runs it yet (a lane is a workflow change); each PR runs that build
 * and suite locally.
 */
test.skip(process.env.CLASS_MOVES_E2E !== '1', 'needs the export built against the mocked API (CLASS_MOVES_E2E=1)');

const API = 'https://api.moves-e2e.test';
const SESSION_KEY = 'hr:console:session';
const tm = en.console.teacherMove;
const cs = en.console.classScope;
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
const A = space('space:a', 'class', 'Sunday Class A');
const D = space('space:d', 'class', 'Evening Class D');
const FAMILY = space('space:kim', 'family', 'Kim family');
const MINA = { id: 'profile:mina', displayName: 'Mina', ageGroup: 'starter', avatar: 'hoya-orange', joinedAt: '2026-09-02T00:00:00.000Z', lastActiveAt: NOW, lastSyncedAt: NOW, summary: null };

interface Call {
  method: string;
  path: string;
  body: unknown;
}

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
const json = (route: Route, status: number, data: unknown) => route.fulfill({ status, contentType: 'application/json', headers: CORS, body: JSON.stringify(status < 300 ? { data } : { error: { code: 'mocked' } }) });

async function mockConsole(page: Page, kind: 'class' | 'family', over: { incoming?: unknown[]; scopeNeeded?: boolean; report?: unknown } = {}): Promise<Call[]> {
  const calls: Call[] = [];
  const mine = kind === 'class' ? A : FAMILY;
  const role = kind === 'class' ? 'owner' : 'owner';
  let incoming = over.incoming ?? [];
  let scopeNeeded = over.scopeNeeded ?? true;
  let noticeSeen = false;
  await page.addInitScript(([key]) => window.sessionStorage.setItem(key as string, JSON.stringify({ token: 'acct-e2e', accountId: 'acct-e2e', displayName: 'Ms Kim' })), [SESSION_KEY]);
  await page.route(`${API}/**`, async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const url = new URL(request.url());
    const path = decodeURIComponent(url.pathname);
    const method = request.method();
    const body = request.postData() ? (JSON.parse(request.postData() ?? '{}') as unknown) : null;
    calls.push({ method, path, body });
    if (path === '/api/spaces') return json(route, 200, { spaces: [{ space: mine, role, counts: { learners: 1, accounts: 1, classes: 0 } }, ...(kind === 'class' ? [{ space: D, role: 'owner', counts: { learners: 0, accounts: 1, classes: 0 } }] : [])] });
    if (path.endsWith('/roster')) return json(route, 200, { space: mine, learners: [MINA], joinCode: null, joinCodeExpiresAt: null });
    if (path.endsWith('/members')) {
      return json(route, 200, {
        members: [
          { memberKind: 'account', memberId: 'acct-e2e', role: 'owner', joinedAt: '2026-09-01T00:00:00.000Z', name: 'Ms Kim', isOwner: true },
          { memberKind: 'learner', memberId: 'profile:mina', role: 'student', joinedAt: '2026-09-02T00:00:00.000Z', name: 'Mina', isOwner: false },
        ],
      });
    }
    if (path.endsWith('/class-moves/destinations')) return json(route, 200, { destinations: [{ id: D.id, name: D.name }] });
    if (path.endsWith('/class-moves') && method === 'POST') {
      return json(route, 200, { move: { id: 'move:1', kind: 'direct', status: 'moved', to: { spaceId: D.id, name: D.name }, learner: null, createdAt: NOW, expiresAt: NOW, at: NOW } });
    }
    if (/\/class-moves\/[^/]+\/accept$/.test(path)) {
      incoming = [];
      return json(route, 200, { move: { id: 'move:2', kind: 'accept', status: 'moved', from: { name: 'Weekday Class W' }, learner: { name: 'Jun', avatar: 'hoya-orange' }, createdAt: NOW, expiresAt: NOW, at: NOW } });
    }
    if (/\/class-moves\/[^/]+\/seen$/.test(path)) {
      noticeSeen = true;
      return json(route, 200, { seen: true });
    }
    if (path.endsWith('/class-moves') && kind === 'family') {
      return json(route, 200, { notices: noticeSeen ? [] : [{ id: 'move:9', learnerId: 'profile:mina', learnerName: 'Mina', to: { spaceId: D.id, name: D.name }, executedAt: NOW }] });
    }
    if (path.endsWith('/class-moves')) return json(route, 200, { outgoing: [], incoming });
    if (path.endsWith('/class-scope') && method === 'POST') {
      scopeNeeded = false;
      return json(route, 200, { version: 'class-scope-2026-10', ackedAt: NOW });
    }
    if (path.endsWith('/class-scope')) return json(route, 200, { current: 'class-scope-2026-10', learners: [{ learnerId: 'profile:mina', name: 'Mina', needed: scopeNeeded }] });
    if (path.endsWith('/report') && over.report) return json(route, 200, over.report);
    if (path.endsWith('/transfer-requests')) return json(route, 200, { requests: [], options: [] });
    return json(route, 200, { plans: [], requests: [], entitlements: [] });
  });
  return calls;
}

async function noSidewaysScroll(page: Page): Promise<void> {
  const { scroll, inner } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }));
  expect(scroll).toBeLessThanOrEqual(inner);
}

test.describe('a teacher moves a student between two classes they teach (TV-D7)', () => {
  test('Move to another class, pick the class, Move now: moved at once, the page says so', async ({ page }) => {
    const calls = await mockConsole(page, 'class');
    await page.goto('/teach/space/settings?id=space%3Aa');
    await page.getByRole('button', { name: en.console.transfer.a11y.moveRow('Mina') }).click();
    const sheet = page.getByRole('dialog', { name: tm.sheetTitle('Mina') });
    await expect(sheet).toBeVisible();
    await sheet.getByRole('radio', { name: D.name }).check();
    await sheet.getByRole('button', { name: tm.continue.cta }).click();
    await expect(sheet.getByText(tm.confirmDirect('Mina', D.name))).toBeVisible();
    await expect(sheet.getByText(tm.directLine)).toBeVisible();
    await page.screenshot({ path: 'test-results/class-moves-confirm.png' });
    await sheet.getByRole('button', { name: tm.moveNow.cta }).click();
    await expect(sheet.getByText(tm.moved('Mina', D.name))).toBeVisible();
    await sheet.getByRole('button', { name: tm.done.cta }).click();
    await expect(page.getByText(tm.moved('Mina', D.name))).toBeVisible();
    const create = calls.find((c) => c.method === 'POST' && c.path === '/api/spaces/space:a/class-moves');
    expect(create?.body).toEqual({ learnerId: 'profile:mina', destinationSpaceId: 'space:d' });
    // no name in any URL the console asked for
    for (const c of calls) expect(c.path).not.toMatch(/Mina/);
  });
});

test.describe('the receiving class accepts (TV-D8)', () => {
  test('an ask shows initials only; Accept moves the student in', async ({ page }) => {
    await mockConsole(page, 'class', { incoming: [{ id: 'move:2', kind: 'accept', status: 'waiting', from: { name: 'Weekday Class W' }, learner: { alias: 'J. L.', avatar: 'hoya-orange', level: 'starter' }, createdAt: NOW, expiresAt: NOW, at: null }] });
    await page.goto('/teach/space/transfers?id=space%3Aa');
    const section = page.getByTestId('teacher-moves');
    await expect(section.getByRole('heading', { name: tm.section.title })).toBeVisible();
    const card = section.getByTestId('teacher-move-incoming');
    await expect(card).toContainText('J. L.');
    await expect(card).toContainText(tm.section.from('Weekday Class W'));
    await page.screenshot({ path: 'test-results/class-moves-incoming.png' });
    await card.getByRole('button', { name: tm.section.accept.cta }).click();
    await expect(section.getByTestId('teacher-move-incoming')).toHaveCount(0);
    for (const width of [320, 768]) {
      await page.setViewportSize({ width, height: 900 });
      await noSidewaysScroll(page);
    }
  });
});

test.describe('the family reads the class-scope update and the move notice (TV-D5, TV-D10)', () => {
  test('the parent home shows both cards; OK on each records it and the card goes', async ({ page }) => {
    const calls = await mockConsole(page, 'family');
    await page.goto('/parent');
    const update = page.getByTestId('class-scope-card');
    await expect(update.getByRole('heading', { name: cs.title('Mina') })).toBeVisible();
    await expect(update).toContainText(CLASS_SCOPE_TEXT.en.lines.sees_all.split('{learner}').join('Mina'));
    await expect(update).toContainText(CLASS_SCOPE_TEXT.en.lines.moves.split('{learner}').join('Mina'));
    const notice = page.getByTestId('move-notice');
    await expect(notice).toContainText(cs.notice('Mina', D.name));
    await page.screenshot({ path: 'test-results/class-moves-family.png', fullPage: true });
    await update.getByRole('button', { name: en.common.buttons.ok }).click();
    await expect(page.getByTestId('class-scope-card')).toHaveCount(0);
    expect(calls.find((c) => c.method === 'POST' && c.path === '/api/spaces/space:kim/learners/profile:mina/class-scope')?.body).toEqual({ version: 'class-scope-2026-10' });
    await notice.getByRole('button', { name: en.common.buttons.ok }).click();
    await expect(page.getByTestId('move-notice')).toHaveCount(0);
    await page.setViewportSize({ width: 320, height: 900 });
    await noSidewaysScroll(page);
  });
});

test.describe("a teacher reads a student's words (TV-D2)", () => {
  const report = (scope: 'base' | 'full') => ({
    space: A,
    learner: { id: 'profile:mina', displayName: 'Mina', avatar: 'hoya-orange', joinedAt: '2026-09-02T00:00:00.000Z', lastActiveAt: NOW },
    summary: {
      lastActiveAt: NOW,
      streakDays: 2,
      stage1: { questsDone: 3, questsTotal: 11, anchorAccuracy: 0.8 },
      cardsUnlocked: 4,
      minutesLast7d: 20,
      jamoRecognized: ['ㄱ'],
      needsPractice: [],
      planProgress: {},
      ...(scope === 'full' ? { vocab: { collected: 42, strong: 18, topicsStarted: 2, topicsPracticed7d: 1, firstTryRate: 0.76, needsPractice: [] } } : {}),
    },
    lastSyncedAt: NOW,
    serverTime: NOW,
    scope,
    settings: scope === 'full' ? { classNotes: 'all' } : null,
  });

  test('full scope: Words with the first-try rate and the class-notes setting', async ({ page }) => {
    await mockConsole(page, 'class', { report: report('full') });
    await page.goto('/teach/space/learner?id=space%3Aa&learner=profile%3Amina&period=week');
    const words = page.getByTestId('report-words');
    await expect(words).toContainText(en.console.space.learner.words(42, 18));
    await expect(words).toContainText(en.console.reportScope.firstTry(76));
    await expect(page.getByTestId('report-settings')).toContainText(en.console.reportScope.classNotes.all);
    await page.screenshot({ path: 'test-results/class-moves-words.png', fullPage: true });
  });

  test('base scope: one line says why the words are missing', async ({ page }) => {
    await mockConsole(page, 'class', { report: report('base') });
    await page.goto('/teach/space/learner?id=space%3Aa&learner=profile%3Amina&period=week');
    await expect(page.getByTestId('report-base-scope')).toHaveText(en.console.reportScope.baseScope);
    await expect(page.getByTestId('report-words')).toHaveCount(0);
  });
});
