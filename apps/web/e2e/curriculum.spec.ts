import { expect, test, type Page, type Route } from '@playwright/test';
import { getMessages } from '@hangul-route/i18n';
import { API, NOW, SESSION_KEY } from './report-fixtures';

/**
 * F-PLAN-002 section 5, `web/e2e/curriculum.spec.ts` (PR P2-8): the console wizard for a family and for a class,
 * end to end on a mocked API: the four steps, the preview, **Use this route** (a draft), the plan builder's week
 * groups, **Publish plan**, and the published readout. Wireframes `console/curriculum-wizard.md` and
 * `console/plan-builder.md` (E and F). The learner side (a device lists one week at a time) is
 * `apps/mobile/e2e/web/route.spec.ts` and `homework-window.spec.ts`; here the saved plan carries the seven-day
 * horizon those devices read.
 *
 * The console needs an API origin and a signed-in session, so this runs on an export made with
 *
 *   NEXT_PUBLIC_API_BASE_URL=https://api.report-e2e.test NEXT_PUBLIC_CONSOLE_DEV_AUTH=true pnpm --filter @hangul-route/web build
 *
 * with `CURRICULUM_E2E=1` (the same export as `reports.spec.ts` and `learning-route.spec.ts`).
 */
const FULL = process.env.CURRICULUM_E2E === '1';
const en = getMessages('en');
const c = en.console.curriculum;

type Kind = 'family' | 'class';
const SPACE: Record<Kind, { id: string; name: string; prefix: string }> = {
  family: { id: 'space:kim-family', name: 'Kim family', prefix: '/parent/space' },
  class: { id: 'space:sunflower', name: 'Sunflower', prefix: '/teach/space' },
};

const SUMMARY = {
  lastActiveAt: '2026-10-15T09:30:00.000Z',
  streakDays: 2,
  stage1: { questsDone: 2, questsTotal: 15, anchorAccuracy: null },
  cardsUnlocked: 2,
  minutesLast7d: 30,
  jamoRecognized: [],
  needsPractice: [],
  planProgress: {},
};

interface SavedBody {
  id?: string;
  title: string;
  items: { kind: string; id: string; targetDate?: string; week?: number }[];
  targetLearnerIds?: string[] | null;
  publish: boolean;
  meta?: { kind: string; horizonDays?: number; params: { weeks: number } } | null;
}

const json = (route: Route, status: number, data: unknown) =>
  route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(status < 300 ? { data } : { error: 'mocked' }) });

/** A signed-in dev session and one space with two learners; plans are kept in memory as the Worker would keep them. */
async function mockSpace(page: Page, kind: Kind): Promise<{ saved: SavedBody[]; unexpected: string[] }> {
  await page.clock.setFixedTime(new Date(NOW));
  await page.addInitScript(
    ([key]) => window.sessionStorage.setItem(key as string, JSON.stringify({ token: 'acct-e2e', accountId: 'acct-e2e', displayName: 'Ms Kim' })),
    [SESSION_KEY],
  );
  const space = {
    id: SPACE[kind].id,
    kind,
    name: SPACE[kind].name,
    parentSpaceId: null,
    settings: { consentMode: 'parent', anonymizeRoster: false },
    archivedAt: null,
    createdAt: '2026-09-01T00:00:00.000Z',
  };
  const learner = (id: string, displayName: string) => ({ id, displayName, avatar: 'hoya-orange', joinedAt: '2026-09-02T00:00:00.000Z', lastActiveAt: SUMMARY.lastActiveAt, ageGroup: 'starter', lastSyncedAt: SUMMARY.lastActiveAt, summary: SUMMARY });
  const learners = [learner('profile:mina', 'Mina'), learner('profile:joon', 'Joon')];
  const saved: SavedBody[] = [];
  const unexpected: string[] = [];
  const plans = new Map<string, Record<string, unknown>>();
  await page.route(`${API}/**`, async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    const url = new URL(request.url());
    if (/\/roster$/.test(url.pathname)) return json(route, 200, { space, learners, joinCode: null, joinCodeExpiresAt: null });
    if (/\/plans$/.test(url.pathname) && request.method() === 'PUT') {
      const body = request.postDataJSON() as SavedBody;
      saved.push(body);
      const id = body.id ?? `plan:e2e-${plans.size + 1}`;
      const before = plans.get(id);
      const at = new Date(NOW).toISOString();
      const plan = {
        id,
        spaceId: space.id,
        authorAccountId: 'acct-e2e',
        title: body.title,
        items: body.items,
        targetLearnerIds: body.targetLearnerIds ?? null,
        publishedAt: body.publish ? at : ((before?.publishedAt as string | null | undefined) ?? null),
        archivedAt: null,
        createdAt: (before?.createdAt as string | undefined) ?? at,
        updatedAt: at,
        // The Worker keeps a plan's meta when a save leaves it out (F-PLAN-002 section 3.5).
        meta: body.meta !== undefined ? body.meta : ((before?.meta as unknown) ?? null),
      };
      plans.set(id, plan);
      return json(route, before ? 200 : 201, { plan });
    }
    if (/\/plans$/.test(url.pathname)) return json(route, 200, { plans: [...plans.values()] });
    if (url.pathname === '/api/spaces') return json(route, 200, { spaces: [{ space, role: kind === 'class' ? 'teacher' : 'owner', counts: { learners: 2, accounts: 1, classes: 0 } }] });
    // The console's plan check (no paid plan on this account).
    if (url.pathname === '/api/entitlements' && request.method() === 'GET') return json(route, 200, { entitlements: [] });
    unexpected.push(`${request.method()} ${url.pathname}`);
    return json(route, 404, null);
  });
  return { saved, unexpected };
}

async function noSidewaysScroll(page: Page): Promise<void> {
  const { scroll, inner } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }));
  expect(scroll).toBeLessThanOrEqual(inner);
}

test.describe('the console wizard: steps, preview, draft, publish (F-PLAN-002 P2-8)', () => {
  test.skip(!FULL, 'needs the console e2e export (CURRICULUM_E2E=1)');

  for (const kind of ['family', 'class'] as const) {
    for (const width of [320, 1280]) {
      test(`${kind} at ${width}: four steps, the preview, Use this route, week groups, Publish plan`, async ({ page }) => {
        await page.setViewportSize({ width, height: width === 320 ? 568 : 800 });
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(String(e)));
        const { saved, unexpected } = await mockSpace(page, kind);
        await page.goto(`${SPACE[kind].prefix}/curriculum?id=${encodeURIComponent(SPACE[kind].id)}`);

        // Step 1: where they start (a family picks the learner first).
        await expect(page.getByRole('heading', { level: 1 })).toHaveText(c.title);
        await expect(page.getByText(c.step(1, 4), { exact: true })).toBeVisible();
        if (kind === 'family') await page.getByTestId('route-learner').selectOption('profile:mina');
        await noSidewaysScroll(page);
        await page.getByTestId('route-next').click();

        // Step 2: pace and length, pre-selected from the proposal (P2-6b); step 3: goals.
        await expect(page.getByText(c.step(2, 4), { exact: true })).toBeVisible();
        await page.getByTestId('length-12-week').click();
        await noSidewaysScroll(page);
        await page.getByTestId('route-next').click();
        await expect(page.getByText(c.step(3, 4), { exact: true })).toBeVisible();
        await page.getByTestId('route-see').click();

        // Step 4: the preview, then a draft that nothing reaches until Publish.
        await expect(page.getByRole('heading', { level: 1 })).toHaveText(c.preview.title);
        await expect(page.getByTestId('route-stats')).toBeVisible();
        await noSidewaysScroll(page);
        await page.screenshot({ path: test.info().outputPath(`curriculum-${kind}-${width}-preview.png`), fullPage: true });
        await page.getByTestId('route-use').click();

        await expect.poll(() => saved.length).toBe(1);
        const draft = saved[0] as SavedBody;
        expect(draft.publish).toBe(false);
        expect(draft.meta?.kind).toBe('curriculum');
        expect(draft.meta?.params.weeks).toBe(12);
        // Devices list one week of the plan at a time (section 3.6).
        expect(draft.meta?.horizonDays).toBeDefined();
        expect(draft.meta?.horizonDays).toBeLessThanOrEqual(7);
        // A plan starts today or later: a class on its next class day, a family today (section 3.8 rule 1).
        const firstDate = draft.items.map((item) => item.targetDate ?? '').filter((d) => d !== '').sort()[0] ?? '';
        expect(firstDate >= new Date(NOW).toISOString().slice(0, 10)).toBe(true);
        expect(draft.items.length).toBeGreaterThan(0);
        expect(draft.items.every((item) => typeof item.week === 'number' && item.week >= 1 && item.week <= 12)).toBe(true);
        expect(draft.targetLearnerIds).toEqual(kind === 'family' ? ['profile:mina'] : null);

        // The plan builder groups the draft by week, then publishes it as the same plan.
        await expect(page).toHaveURL(/\/space\/plan\/?\?/);
        await expect(page.getByText(/^Week 1 · /).first()).toBeVisible();
        await noSidewaysScroll(page);
        await page.getByTestId('publish-plan').click();
        await expect.poll(() => saved.length).toBe(2);
        const published = saved[1] as SavedBody;
        expect(published.publish).toBe(true);
        expect(published.items).toHaveLength(draft.items.length);
        await expect(page.getByText(c.readout.allWeeks).first()).toBeVisible();
        await noSidewaysScroll(page);
        await page.screenshot({ path: test.info().outputPath(`curriculum-${kind}-${width}-published.png`), fullPage: true });

        // Never a ranking, a percentage or a shame word on the adult's plan pages either.
        const text = await page.getByRole('main').innerText();
        expect(text).not.toMatch(/%|\bbehind\b|\blate\b|\bmissed\b|\boverdue\b/i);
        expect(errors).toEqual([]);
        // Every call the console made is one this mock answers on purpose.
        expect(unexpected).toEqual([]);
      });
    }
  }
});
