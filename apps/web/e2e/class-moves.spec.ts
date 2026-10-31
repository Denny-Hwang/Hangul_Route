import { expect, test, type Page, type Route } from '@playwright/test';
import { CLASS_SCOPE_TEXT, CLASS_SCOPE_TEXT_VERSION } from '@hangul-route/content-schema';
import { en, getMessages, type UiLocale } from '@hangul-route/i18n';

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

async function mockConsole(page: Page, kind: 'class' | 'family', over: { incoming?: unknown[]; scopeNeeded?: boolean; report?: unknown; moveGate?: Promise<void> } = {}): Promise<Call[]> {
  const calls: Call[] = [];
  // With `moveGate`: the direct move answers only once the gate opens, and from then on class A no longer lists Mina.
  let movedOut = false;
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
          ...(movedOut ? [] : [{ memberKind: 'learner', memberId: 'profile:mina', role: 'student', joinedAt: '2026-09-02T00:00:00.000Z', name: 'Mina', isOwner: false }]),
        ],
      });
    }
    if (path.endsWith('/class-moves/destinations')) return json(route, 200, { destinations: [{ id: D.id, name: D.name }] });
    if (path.endsWith('/class-moves') && method === 'POST') {
      if (over.moveGate) {
        await over.moveGate;
        movedOut = true;
      }
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

  // Owner report 2026-10-23: a learner moved from A to B still showed in A. While Move now is under way the sheet
  // cannot be closed, and once it answers, class A's settings read the members again and Mina's row is gone.
  test('the sheet stays open while moving; after the move class A no longer lists the student', async ({ page }) => {
    let open!: () => void;
    const gate = new Promise<void>((resolve) => (open = resolve));
    const calls = await mockConsole(page, 'class', { moveGate: gate });
    await page.goto('/teach/space/settings?id=space%3Aa');
    const moveRow = page.getByRole('button', { name: en.console.transfer.a11y.moveRow('Mina') });
    await moveRow.click();
    const sheet = page.getByRole('dialog', { name: tm.sheetTitle('Mina') });
    await sheet.getByRole('radio', { name: D.name }).check();
    await sheet.getByRole('button', { name: tm.continue.cta }).click();
    await sheet.getByRole('button', { name: tm.moveNow.cta }).click();
    await expect(sheet.getByRole('button', { name: tm.moving.cta })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.mouse.click(4, 4);
    await sheet.getByRole('button', { name: en.console.transfer.a11y.close }).click();
    await expect(sheet).toBeVisible();
    const before = calls.filter((c) => c.path.endsWith('/members')).length;
    open();
    await expect(sheet.getByText(tm.moved('Mina', D.name))).toBeVisible();
    await sheet.getByRole('button', { name: tm.done.cta }).click();
    await expect(sheet).toHaveCount(0);
    await expect(moveRow).toHaveCount(0);
    expect(calls.filter((c) => c.path.endsWith('/members')).length).toBeGreaterThan(before);
    await page.screenshot({ path: 'test-results/class-moves-after-move.png' });
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
    // The shipped acknowledgement also records which text was shown (`shown`, CLASS_SCOPE_TEXT_VERSION).
    expect(calls.find((c) => c.method === 'POST' && c.path === '/api/spaces/space:kim/learners/profile:mina/class-scope')?.body).toEqual({ version: 'class-scope-2026-10', shown: CLASS_SCOPE_TEXT_VERSION });
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

// ---------------------------------------------------------------------------
// AMENDMENTS-GROWNUP-UX GX-4 (section 7; section 14 "class-moves.spec.ts (extend)"; wireframe
// design/wireframes/parent/needs-you.md, mock design/screens/approvals/mock/parent-*.html): the family's Needs you strip
// above the first child, the fold rule, a status chip and a class line on each child card, the move notice inside its
// child's card, consent in 2 taps, a re-link approved inline, and Read and OK. ko, en and es at 360 x 740 and 1280 x 800.

const GX_NOW = new Date('2026-10-31T12:00:00.000Z');
const gxAt = (minutes: number): string => new Date(GX_NOW.getTime() + minutes * 60_000).toISOString();
const kid = (id: string, name: string, joinedAt: string) => ({ id, displayName: name, ageGroup: 'starter', avatar: 'hoya-orange', joinedAt, lastActiveAt: gxAt(-60 * 20), lastSyncedAt: gxAt(-60 * 20), summary: null });
const KIDS = [kid('profile:mina', 'Mina', '2026-09-02T00:00:00.000Z'), kid('profile:jun', 'Jun', '2026-09-03T00:00:00.000Z'), kid('profile:sora', 'Sora', '2026-09-04T00:00:00.000Z')];
const relinkOf = (learnerId: string, name: string, minutes: number) => ({ id: `relink:${name.toLowerCase()}`, learnerId, learnerName: name, deviceId: 'device:new', platform: 'ios', requestedAt: gxAt(-2), expiresAt: gxAt(minutes), status: 'pending' });
const JUN_MOVE = {
  id: 'transfer:jun',
  role: 'learner_side',
  status: 'requested',
  initiator: 'source',
  learner: { id: 'profile:jun', name: 'Jun' },
  from: { spaceId: A.id, name: A.name },
  to: { spaceId: D.id, name: D.name, ownerName: 'Ms Park', schoolName: null, ageBucket: 'months', learnerCount: 8 },
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
  createdAt: gxAt(-60 * 24),
  expiresAt: gxAt(60 * 24 * 9),
  executedAt: null,
  endedAt: null,
  learnerRoute: 'caregiver',
  endedFrom: null,
  termsDigest: 'c'.repeat(64),
};
const OPTIONS = [
  { learnerId: 'profile:mina', name: 'Mina', classes: [{ spaceId: D.id, name: D.name }], selfManaged: false, blockTeacherRequests: false },
  { learnerId: 'profile:jun', name: 'Jun', classes: [{ spaceId: A.id, name: A.name }, { spaceId: 'space:s', name: 'Saturday Class' }], selfManaged: false, blockTeacherRequests: false },
  { learnerId: 'profile:sora', name: 'Sora', classes: [], selfManaged: false, blockTeacherRequests: false },
];

interface FamilyMock {
  calls: Call[];
}

async function mockFamily(page: Page, over: { relinks?: unknown[]; moves?: unknown[]; scopeNeeded?: string[]; notice?: boolean } = {}): Promise<FamilyMock> {
  const mock: FamilyMock = { calls: [] };
  let relinks = over.relinks ?? [relinkOf('profile:mina', 'Mina', 7.5), relinkOf('profile:sora', 'Sora', 9.5)];
  let moves = over.moves ?? [JUN_MOVE];
  let needed = over.scopeNeeded ?? [];
  let noticeSeen = over.notice === false;
  await page.clock.install({ time: GX_NOW });
  await page.addInitScript(([key]) => window.sessionStorage.setItem(key as string, JSON.stringify({ token: 'acct-e2e', accountId: 'acct-e2e', displayName: 'Ms Kim' })), [SESSION_KEY]);
  await page.route(`${API}/**`, async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const path = decodeURIComponent(new URL(request.url()).pathname);
    const method = request.method();
    mock.calls.push({ method, path, body: request.postData() ? (JSON.parse(request.postData() ?? '{}') as unknown) : null });
    if (path === '/api/spaces') return json(route, 200, { spaces: [{ space: FAMILY, role: 'owner', counts: { learners: 3, accounts: 1, classes: 0 } }] });
    if (path.endsWith('/roster')) return json(route, 200, { space: FAMILY, learners: KIDS, joinCode: 'KIM123', joinCodeExpiresAt: gxAt(60 * 24 * 30) });
    const decided = /\/relink-requests\/([^/]+)\/(approve|deny)$/.exec(path);
    if (decided) {
      const found = relinks.find((r) => (r as { id: string }).id === decided[1]) as object;
      relinks = relinks.filter((r) => (r as { id: string }).id !== decided[1]);
      return json(route, 200, { request: { ...found, status: decided[2] === 'approve' ? 'approved' : 'denied' } });
    }
    if (path.endsWith('/relink-requests')) return json(route, 200, { requests: relinks });
    if (/\/transfer-requests\/[^/]+\/approve$/.test(path)) {
      moves = [];
      return json(route, 200, { request: { ...JUN_MOVE, learnerState: 'consented' } });
    }
    if (path.endsWith('/transfer-requests')) return json(route, 200, { requests: moves, options: OPTIONS });
    if (/\/class-moves\/[^/]+\/seen$/.test(path)) {
      noticeSeen = true;
      return json(route, 200, { seen: true });
    }
    if (path.endsWith('/class-moves')) return json(route, 200, { notices: noticeSeen ? [] : [{ id: 'move:9', learnerId: 'profile:mina', learnerName: 'Mina', to: { spaceId: D.id, name: D.name }, executedAt: gxAt(-60 * 24) }] });
    const acked = /\/learners\/([^/]+)\/class-scope$/.exec(path);
    if (acked && method === 'POST') {
      needed = needed.filter((id) => id !== acked[1]);
      return json(route, 200, { version: 'class-scope-2026-10', ackedAt: GX_NOW.toISOString() });
    }
    if (path.endsWith('/class-scope')) return json(route, 200, { current: 'class-scope-2026-10', learners: KIDS.map((k) => ({ learnerId: k.id, name: k.displayName, needed: needed.includes(k.id) })) });
    return json(route, 200, { plans: [], requests: [], entitlements: [] });
  });
  return mock;
}

const kidCard = (page: Page, name: string) => page.getByTestId('learner-card').filter({ has: page.getByRole('heading', { name, exact: true }) });

const GX_VIEWPORTS = [
  { label: '360', size: { width: 360, height: 740 } },
  { label: '1280', size: { width: 1280, height: 800 } },
] as const;
const GX_LOCALES: Array<{ locale: UiLocale; browser: string }> = [
  { locale: 'ko', browser: 'ko-KR' },
  { locale: 'en', browser: 'en-US' },
  { locale: 'es', browser: 'es-ES' },
];

for (const { locale, browser } of GX_LOCALES) {
  const c = getMessages(locale).console;
  const p = c.parentHome;
  test.describe(`${locale}: the family's Needs you comes first and the first child stays on the first screen (GX-4)`, () => {
    test.use({ locale: browser });
    for (const { label, size } of GX_VIEWPORTS) {
      test(`${label}: three items fold, chips are text, class lines, the notice in its child's card`, async ({ page }) => {
        await page.setViewportSize(size);
        await mockFamily(page);
        await page.goto('/parent');
        const strip = page.getByRole('region', { name: p.needsYou.title });
        await expect(strip).toBeVisible();
        // Fold rule: the soonest-closing item keeps its row, the other two fold into one row with See all.
        await expect(strip.getByTestId('needs-you-row')).toHaveCount(1);
        await expect(strip.getByTestId('needs-you-row')).toContainText(p.needsYou.relink('Mina'));
        await expect(strip.getByTestId('needs-you-more')).toContainText(p.needsYou.more(2));
        await expect(strip.getByRole('button', { name: c.relink.approve.cta, exact: true })).toBeVisible();
        // The strip is above the first child, and the first child's name is on the first screen.
        const stripBox = await strip.boundingBox();
        const mina = kidCard(page, 'Mina');
        const nameBox = await mina.getByRole('heading', { name: 'Mina', exact: true }).boundingBox();
        expect((stripBox?.y ?? 0) < (nameBox?.y ?? 0)).toBeTruthy();
        expect((nameBox?.y ?? 0) + (nameBox?.height ?? 0)).toBeLessThanOrEqual(size.height);
        // One chip per child, text (never a button); the class line from the family's class-move read.
        await expect(mina.getByTestId('child-status')).toHaveText(p.status.relink);
        await expect(mina.getByRole('button', { name: p.status.relink })).toHaveCount(0);
        await expect(kidCard(page, 'Jun').getByTestId('child-status')).toHaveText(p.status.move);
        await expect(mina.getByTestId('child-class-line')).toHaveText(p.classLine.one(D.name));
        await expect(kidCard(page, 'Jun').getByTestId('child-class-line')).toContainText(p.classLine.many(2));
        await expect(kidCard(page, 'Sora').getByTestId('child-class-line')).toHaveText(p.classLine.none);
        // The move notice sits inside Mina's card, not above the cards.
        await expect(mina.getByTestId('move-notice')).toContainText(c.classScope.notice('Mina', D.name));
        await expect(page.getByTestId('move-notice')).toHaveCount(1);
        // The family actions no longer carry a moves pill.
        await expect(page.getByTestId('family-moves-waiting')).toHaveCount(0);
        await page.screenshot({ path: test.info().outputPath(`needs-you-${locale}-${label}.png`) });
        // See all lists every item in a sheet.
        await strip.getByRole('button', { name: p.needsYou.seeAll.cta }).click();
        const sheet = page.getByTestId('needs-you-sheet');
        await expect(sheet.getByTestId('needs-you-row')).toHaveCount(3);
        await page.screenshot({ path: test.info().outputPath(`needs-you-sheet-${locale}-${label}.png`) });
        if (label === '360') await noSidewaysScroll(page);
      });
    }
  });
}

test.describe('en: answering from Needs you (GX-4)', () => {
  const c = en.console;
  const p = c.parentHome;

  test('a re-link is approved inline: one tap, the result is said, the row and the chip leave', async ({ page }) => {
    const mock = await mockFamily(page, { relinks: [relinkOf('profile:mina', 'Mina', 7.5)], moves: [] });
    await page.goto('/parent');
    const strip = page.getByRole('region', { name: p.needsYou.title });
    await strip.getByRole('button', { name: c.relink.approve.cta, exact: true }).click();
    await expect(page.getByTestId('needs-you-result')).toHaveText(c.relink.approved('Mina'));
    await expect(page.getByRole('region', { name: p.needsYou.title })).toHaveCount(0);
    await expect(kidCard(page, 'Mina').getByTestId('child-status')).toHaveCount(0);
    expect(mock.calls.some((call) => call.method === 'POST' && call.path === '/api/spaces/space:kim/relink-requests/relink:mina/approve')).toBe(true);
    for (const call of mock.calls) expect(call.path).not.toMatch(/Mina|Jun|Sora/);
  });

  test('consent in 2 taps: Review opens the consent sheet directly, Yes agrees for the family', async ({ page }) => {
    const mock = await mockFamily(page, { relinks: [relinkOf('profile:mina', 'Mina', 7.5)] });
    await page.goto('/parent');
    const strip = page.getByRole('region', { name: p.needsYou.title });
    await expect(strip.getByTestId('needs-you-row')).toHaveCount(2);
    await expect(strip).toContainText(p.needsYou.moveMeta(D.name, 9));
    await strip.getByRole('button', { name: c.status.review.cta }).click();
    const sheet = page.getByTestId('consent-sheet');
    await expect(sheet).toBeVisible();
    await sheet.getByTestId('consent-end').scrollIntoViewIfNeeded();
    await sheet.getByTestId('consent-yes').click();
    await expect(page.getByTestId('consent-sheet')).toHaveCount(0);
    const approve = mock.calls.find((call) => call.method === 'POST' && call.path === '/api/spaces/space:kim/transfer-requests/transfer:jun/approve');
    expect((approve?.body as { slots?: string[] } | undefined)?.slots).toEqual(['learner']);
    await expect(page.getByRole('region', { name: p.needsYou.title }).getByTestId('needs-you-row')).toHaveCount(1);
  });

  test('Read and OK brings the shipped class-scope card into view and focuses it (GX-OD-3 open)', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await mockFamily(page, { relinks: [], moves: [], scopeNeeded: ['profile:jun'], notice: false });
    await page.goto('/parent');
    const strip = page.getByRole('region', { name: p.needsYou.title });
    await expect(strip).toContainText(p.needsYou.scope('Jun'));
    await strip.getByRole('button', { name: p.needsYou.readOk.cta }).click();
    const card = page.getByTestId('class-scope-card');
    await expect(card).toBeFocused();
    await expect(card).toBeInViewport();
    await card.getByRole('button', { name: en.common.buttons.ok }).click();
    await expect(page.getByTestId('class-scope-card')).toHaveCount(0);
    await expect(page.getByRole('region', { name: p.needsYou.title })).toHaveCount(0);
  });
});
