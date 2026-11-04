import { expect, test, type Page, type Route } from '@playwright/test';
import { getMessages } from '@hangul-route/i18n';
import { API, SESSION_KEY } from './report-fixtures';

/**
 * AMENDMENTS-ROUTE-CLASS-BLEND row BL-4 (sections 10.1 and 10.2; wireframe `console/curriculum-wizard.md` M1 to M4):
 * the class wizard's meeting block on the real page, assumption c (section 17): the block fits one 1280 x 720 screen,
 * and at 320 px with 200 % text it is one vertical scroll (nothing sideways, nothing clipped, no scroll area of its
 * own), then the blended preview's cycle table, then Use this route and the published readout with Move this class day.
 * Screenshots at 320 and 1280. The whole flow (Present this plan on the class day) is BL-10's `route-blend.spec.ts`.
 *
 * Runs on an export made with the flag on:
 *
 *   NEXT_PUBLIC_API_BASE_URL=https://api.report-e2e.test NEXT_PUBLIC_CONSOLE_DEV_AUTH=true \
 *   NEXT_PUBLIC_ROUTE_BLEND_ENABLED=true pnpm --filter @hangul-route/web build
 *
 * with `ROUTE_BLEND_E2E=1`.
 */
const FULL = process.env.ROUTE_BLEND_E2E === '1';
const c = getMessages('en').console.curriculum;
const NOW = '2026-11-02T12:00:00.000Z';
const SPACE = { id: 'space:sunflower', kind: 'class', name: 'Sunflower', parentSpaceId: null, settings: { consentMode: 'parent', anonymizeRoster: false }, archivedAt: null, createdAt: '2026-09-01T00:00:00.000Z' };

const json = (route: Route, status: number, data: unknown) =>
  route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ data }) });

async function mockClass(page: Page): Promise<{ saved: { publish: boolean; meta?: { params: { blend?: unknown } } }[] }> {
  await page.clock.setFixedTime(new Date(NOW));
  await page.addInitScript(([key]) => window.sessionStorage.setItem(key as string, JSON.stringify({ token: 'acct-e2e', accountId: 'acct-e2e', displayName: 'Ms Kim' })), [SESSION_KEY]);
  const saved: { publish: boolean; meta?: { params: { blend?: unknown } } }[] = [];
  const plans = new Map<string, Record<string, unknown>>();
  await page.route(`${API}/**`, async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    const url = new URL(request.url());
    if (/\/roster$/.test(url.pathname)) return json(route, 200, { space: SPACE, learners: [], joinCode: null, joinCodeExpiresAt: null });
    if (/\/plans$/.test(url.pathname) && request.method() === 'PUT') {
      const body = request.postDataJSON() as { id?: string; title: string; items: unknown[]; publish: boolean; meta?: { params: { blend?: unknown } } };
      saved.push(body);
      const id = body.id ?? `plan:e2e-${plans.size + 1}`;
      const before = plans.get(id);
      const plan = {
        id,
        spaceId: SPACE.id,
        authorAccountId: 'acct-e2e',
        title: body.title,
        items: body.items,
        targetLearnerIds: null,
        publishedAt: body.publish ? NOW : ((before?.publishedAt as string | null | undefined) ?? null),
        archivedAt: null,
        createdAt: NOW,
        updatedAt: NOW,
        meta: body.meta ?? before?.meta ?? null,
      };
      plans.set(id, plan);
      return json(route, before ? 200 : 201, { plan });
    }
    if (/\/plans$/.test(url.pathname)) return json(route, 200, { plans: [...plans.values()] });
    if (url.pathname === '/api/spaces') return json(route, 200, { spaces: [{ space: SPACE, role: 'teacher', counts: { learners: 0, accounts: 1, classes: 0 } }] });
    if (url.pathname === '/api/entitlements') return json(route, 200, { entitlements: [] });
    return json(route, 200, {});
  });
  return { saved };
}

async function stepTwo(page: Page): Promise<void> {
  await page.goto(`/teach/space/curriculum?id=${encodeURIComponent(SPACE.id)}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(c.title);
  await page.getByTestId('route-next').click();
  await expect(page.getByTestId('meeting-block')).toBeVisible();
  await page.getByTestId('class-day-tue').click();
  await page.getByTestId('practice-count').selectOption('3');
  await expect(page.getByTestId('practice-line')).toHaveText('Practice on Wed, Fri, Sun');
}

async function sideways(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}

test.describe('the meeting block (BL-4, assumption c)', () => {
  test.skip(!FULL, 'needs the console export with NEXT_PUBLIC_ROUTE_BLEND_ENABLED=true (ROUTE_BLEND_E2E=1)');

  test('fits one 1280 x 720 screen', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await mockClass(page);
    await stepTwo(page);
    await page.getByTestId('practice-change').click();
    const box = await page.getByTestId('meeting-block').boundingBox();
    expect(box).not.toBeNull();
    expect(box?.height ?? 9999).toBeLessThanOrEqual(720);
    expect(await sideways(page)).toBeLessThanOrEqual(0);
    await page.getByTestId('practice-change').click();
    await page.getByTestId('meeting-block').screenshot({ path: test.info().outputPath('meeting-en-1280.png') });
    await page.screenshot({ path: test.info().outputPath('wizard-step2-en-1280.png'), fullPage: true });
  });

  for (const text of [100, 200]) {
    test(`at 320 px with ${text} % text: one vertical scroll, nothing sideways or clipped`, async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 568 });
      await mockClass(page);
      await page.addInitScript((size) => {
        document.addEventListener('DOMContentLoaded', () => {
          document.documentElement.style.fontSize = `${size}%`;
        });
      }, text);
      await stepTwo(page);
      await page.getByTestId('practice-change').click();
      expect(await sideways(page)).toBeLessThanOrEqual(0);
      const block = page.getByTestId('meeting-block');
      const own = await block.evaluate((el) => ({ scroll: el.scrollHeight - el.clientHeight, overflow: getComputedStyle(el).overflowY }));
      expect(own.scroll).toBeLessThanOrEqual(1);
      expect(own.overflow).not.toMatch(/auto|scroll/);
      const clipped = await block.evaluate((el) => {
        const outer = el.getBoundingClientRect();
        return [...el.querySelectorAll('button, select, span, p')].filter((child) => {
          const r = child.getBoundingClientRect();
          return r.width > 0 && (r.right > outer.right + 1 || r.left < outer.left - 1);
        }).length;
      });
      expect(clipped).toBe(0);
      const height = (await block.boundingBox())?.height ?? 0;
      test.info().annotations.push({ type: 'meeting-block-height', description: `${height} px at 320 with ${text} % text (${(height / 568).toFixed(1)} screens)` });
      await page.screenshot({ path: test.info().outputPath(`wizard-step2-en-320${text === 200 ? '-text200' : ''}.png`), fullPage: true });
    });
  }

  for (const width of [320, 1280]) {
    test(`at ${width}: the blended preview, Use this route, and the readout with Move this class day`, async ({ page }) => {
      await page.setViewportSize({ width, height: width === 320 ? 568 : 800 });
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      const { saved } = await mockClass(page);
      await stepTwo(page);
      await page.getByTestId('length-12-week').click();
      await page.getByTestId('route-next').click();
      await page.getByTestId('route-see').click();
      await expect(page.getByTestId('blend-preview-header')).toContainText('About 4 sessions a week: 1 class day (30 min) and 3 practice days');
      if (width === 1280) {
        await expect(page.getByTestId('cycle-table')).toBeVisible();
        await expect(page.locator('[data-testid="cycle-table"] th[scope="col"]')).toHaveCount(5);
        await expect(page.locator('[data-testid="cycle-table"] th[scope="row"]')).toHaveCount(12);
      } else {
        await expect(page.getByTestId('cycle-card').first()).toBeVisible();
      }
      expect(await sideways(page)).toBeLessThanOrEqual(0);
      await page.screenshot({ path: test.info().outputPath(`wizard-preview-en-${width}.png`), fullPage: true });
      await page.getByTestId('route-use').click();
      await expect.poll(() => saved.length).toBe(1);
      expect(saved[0]?.meta?.params.blend).toMatchObject({ mode: 'overlap', lecture: { days: ['tue'], minutes: 30 }, personal: { perWeek: 3, minutes: 10 } });
      await page.getByTestId('publish-plan').click();
      await expect.poll(() => saved.length).toBe(2);
      await expect(page.getByTestId('blend-this-week')).toBeVisible();
      await expect(page.getByTestId('class-days-so-far')).toHaveText(c.blend.readout.classDays(0, 12));
      await expect(page.getByTestId('blend-move')).toBeVisible();
      await expect(page.getByTestId('blend-stop')).toBeVisible();
      expect(await sideways(page)).toBeLessThanOrEqual(0);
      await page.screenshot({ path: test.info().outputPath(`readout-en-${width}.png`), fullPage: true });
      await page.getByTestId('blend-move').click();
      await expect(page.getByTestId('blend-move-confirm')).toBeVisible();
      await page.getByTestId('blend-move-confirm-yes').click();
      await expect.poll(() => saved.length).toBe(3);
      await expect(page.getByText(c.blend.readout.moved)).toBeVisible();
      await expect(page.getByTestId('class-days-so-far')).toHaveText(c.blend.readout.classDays(0, 11));
      const text = await page.getByRole('main').innerText();
      expect(text).not.toMatch(/%|lecture|\bbehind\b|\blate\b|\bmissed\b|\boverdue\b/i);
      expect(errors).toEqual([]);
    });
  }
});
