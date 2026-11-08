import { expect, test, type Page, type Route } from '@playwright/test';
import { getMessages, type UiLocale } from '@hangul-route/i18n';
import { API, SESSION_KEY } from './report-fixtures';

/**
 * AMENDMENTS-ROUTE-CLASS-BLEND row BL-10 (sections 10.1 to 10.3 and 14; BL-OD-12): the teacher's whole flow in the
 * launch state, on an export made with no blend setting at all (the switch is on by default since BL-10): the class
 * wizard opens on 3 practice days, a class day on Tuesday suggests Wednesday, Friday and Sunday, the preview, Use this
 * route, Publish, the readout with its class lines, then **Present this plan** on the class day, which opens the Next
 * lesson card on that class day's lessons at the class length. Both modes: **Practise what class taught** (overlap:
 * every lesson has its class day) and **Class and practice cover different lessons** (split: practice days also bring
 * lessons class has not met). At 320 and 1280, at 200 % text at 320, and in en, es and ko, with no sideways scroll and no text clipped in the readout lines or the class day (shots in the test output).
 *
 * Runs on the console e2e export with the mocked API:
 *
 *   NEXT_PUBLIC_API_BASE_URL=https://api.report-e2e.test NEXT_PUBLIC_CONSOLE_DEV_AUTH=true pnpm --filter @hangul-route/web build
 *
 * with `ROUTE_BLEND_E2E=1`. The browser clock is Tuesday 2026-11-03, midday UTC: a class day.
 */
const FULL = process.env.ROUTE_BLEND_E2E === '1';
const LOCALE_KEY = 'hr:console:uiLocale';
const NOW = '2026-11-03T12:00:00.000Z';
const TODAY = NOW.slice(0, 10);
const SPACE = { id: 'space:sunflower', kind: 'class', name: 'Sunflower', parentSpaceId: null, settings: { consentMode: 'parent', anonymizeRoster: false }, archivedAt: null, createdAt: '2026-09-01T00:00:00.000Z' };

type SavedItem = { kind: string; id: string; targetDate?: string; lectureDate?: string };
type SavedPlan = { id?: string; title: string; items: SavedItem[]; publish: boolean; meta?: { params: { blend?: { mode: string; lecture: { days: string[]; minutes: number }; personal: { perWeek: number; minutes: number } } } } };

const json = (route: Route, status: number, data: unknown) =>
  route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ data }) });

/** The console's API for one class this account teaches: plans are kept as saved, so the readout and the lecture page read them. */
async function mockClass(page: Page, locale: UiLocale = 'en', text = 100): Promise<{ saved: SavedPlan[]; unexpected: string[] }> {
  await page.clock.setFixedTime(new Date(NOW));
  await page.addInitScript(
    ([sessionKey, localeKey, chosen]) => {
      window.sessionStorage.setItem(sessionKey as string, JSON.stringify({ token: 'acct-e2e', accountId: 'acct-e2e', displayName: 'Ms Kim' }));
      window.localStorage.setItem(localeKey as string, chosen as string);
    },
    [SESSION_KEY, LOCALE_KEY, locale],
  );
  if (text !== 100) {
    // The console's text size provider owns the inline `html` font-size, so the browser text size is a stylesheet rule
    // with !important (as route-blend-meeting.spec.ts does): every rem on the page grows with it.
    await page.addInitScript((size) => {
      document.addEventListener('DOMContentLoaded', () => {
        const style = document.createElement('style');
        style.textContent = `html{font-size:calc(${size}% * var(--hr-text-scale, 1)) !important}`;
        document.head.appendChild(style);
      });
    }, text);
  }
  const saved: SavedPlan[] = [];
  const unexpected: string[] = [];
  const plans = new Map<string, Record<string, unknown>>();
  await page.route(`${API}/**`, async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    const url = new URL(request.url());
    if (/\/roster$/.test(url.pathname)) return json(route, 200, { space: SPACE, learners: [], joinCode: null, joinCodeExpiresAt: null });
    if (/\/plans$/.test(url.pathname) && request.method() === 'PUT') {
      const body = request.postDataJSON() as SavedPlan;
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
    if (url.pathname === '/api/spaces') return json(route, 200, { spaces: [{ space: SPACE, role: 'teacher', counts: { learners: 0, accounts: 1, classes: 0 }, joinCode: null, joinCodeExpiresAt: null }] });
    if (url.pathname === '/api/entitlements') return json(route, 200, { entitlements: [] });
    unexpected.push(`${request.method()} ${url.pathname}`);
    return json(route, 200, {});
  });
  return { saved, unexpected };
}

const sideways = (page: Page): Promise<number> => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

/**
 * Text cut off inside a box: the box and every box inside it that hides or scrolls its overflow must fit its own
 * content (scrollWidth and scrollHeight within clientWidth and clientHeight, 1 px for rounding). Returns what does not.
 */
async function clipped(page: Page, testId: string): Promise<string[]> {
  return page.getByTestId(testId).first().evaluate((root) => {
    const out: string[] = [];
    for (const el of [root, ...Array.from(root.querySelectorAll('*'))]) {
      if (!(el instanceof HTMLElement) || el.clientWidth === 0) continue;
      const style = getComputedStyle(el);
      const hides = (v: string) => v !== 'visible';
      if (hides(style.overflowX) && el.scrollWidth > el.clientWidth + 1) out.push(`${el.dataset.testid ?? el.tagName} x ${el.scrollWidth}>${el.clientWidth}`);
      if (hides(style.overflowY) && el.scrollHeight > el.clientHeight + 1) out.push(`${el.dataset.testid ?? el.tagName} y ${el.scrollHeight}>${el.clientHeight}`);
    }
    return out;
  });
}

/** The class day the lecture card presents: the first `lectureDate` on or after today, its lessons in plan order. */
function classDayOf(items: readonly SavedItem[]): { date: string; count: number } {
  const dates = [...new Set(items.flatMap((item) => (item.lectureDate ? [item.lectureDate] : [])))].sort();
  const date = dates.find((d) => d >= TODAY) ?? dates[dates.length - 1] ?? '';
  return { date, count: items.filter((item) => item.lectureDate === date).length };
}

const weekdayLong = (locale: UiLocale, date: string): string => new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00.000Z`));

/** The wizard to the published readout, then Present this plan; returns what the class day holds. */
async function wizardToPresent(page: Page, mode: 'overlap' | 'split', locale: UiLocale, saved: SavedPlan[], width: number, name: string): Promise<void> {
  const c = getMessages(locale).console.curriculum;
  await page.goto(`/teach/space/curriculum?id=${encodeURIComponent(SPACE.id)}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(c.title);
  await page.getByTestId('route-next').click();
  const block = page.getByTestId('meeting-block');
  await expect(block).toBeVisible();
  // BL-OD-12: 3 practice days by default, with no class day yet; a class day on Tuesday suggests the practice days.
  await expect(page.getByTestId('practice-count')).toHaveValue('3');
  await page.getByTestId('class-day-tue').click();
  await expect(page.getByTestId('practice-line')).toBeVisible();
  if (locale === 'en') await expect(page.getByTestId('practice-line')).toHaveText('Practice on Wed, Fri, Sun');
  await expect(page.getByTestId('blend-mode-overlap')).toHaveAttribute('aria-checked', 'true');
  if (mode === 'split') {
    await page.getByTestId('blend-mode-split').click();
    await expect(page.getByTestId('blend-mode-split')).toHaveAttribute('aria-checked', 'true');
  }
  expect(await sideways(page)).toBeLessThanOrEqual(0);
  await page.screenshot({ path: test.info().outputPath(`${name}-meeting.png`), fullPage: true });
  await page.getByTestId('length-12-week').click();
  await page.getByTestId('route-next').click();
  await page.getByTestId('route-see').click();
  await expect(page.getByTestId('blend-preview-header')).toBeVisible();
  if (locale === 'en') await expect(page.getByTestId('blend-preview-header')).toContainText('About 4 sessions a week: 1 class day (30 min) and 3 practice days');
  await expect(page.getByTestId(width >= 1024 ? 'cycle-table' : 'cycle-card').first()).toBeVisible();
  expect(await sideways(page)).toBeLessThanOrEqual(0);
  await page.screenshot({ path: test.info().outputPath(`${name}-preview.png`), fullPage: true });

  await page.getByTestId('route-use').click();
  await expect.poll(() => saved.length).toBe(1);
  expect(saved[0]?.meta?.params.blend).toMatchObject({ mode, lecture: { days: ['tue'], minutes: 30 }, personal: { perWeek: 3, minutes: 10 } });
  const items = saved[0]?.items ?? [];
  const taught = items.filter((item) => item.lectureDate !== undefined);
  expect(taught.length).toBeGreaterThan(0);
  // Every class lesson comes back on a practice day after its class (G4), never on the class day itself.
  for (const item of taught) expect(item.targetDate !== undefined && item.targetDate > (item.lectureDate as string), item.id).toBe(true);
  const practiceOnly = items.filter((item) => item.kind === 'quest' && item.lectureDate === undefined && item.targetDate !== undefined);
  if (mode === 'overlap') expect(practiceOnly).toEqual([]);
  else expect(practiceOnly.length).toBeGreaterThan(0);

  await page.getByTestId('publish-plan').click();
  await expect.poll(() => saved.length).toBe(2);
  await expect(page.getByTestId('blend-this-week')).toBeVisible();
  await expect(page.getByTestId('class-days-so-far')).toBeVisible();
  await expect(page.getByTestId('blend-move')).toBeVisible();
  expect(await sideways(page)).toBeLessThanOrEqual(0);
  for (const id of ['blend-this-week', 'class-days-so-far']) expect(await clipped(page, id), id).toEqual([]);
  const readout = await page.getByRole('main').innerText();
  if (locale === 'en') expect(readout).not.toMatch(/%|lecture|\bbehind\b|\blate\b|\bmissed\b|\boverdue\b/i);
  await page.screenshot({ path: test.info().outputPath(`${name}-readout.png`), fullPage: true });

  // Present this plan on the class day: the Next lesson card holds today's class lessons at the class length.
  await page.getByTestId('present-plan').click();
  const panel = page.getByTestId('lecture-preset-panel-next-lesson');
  await expect(panel).toBeVisible();
  const day = classDayOf(saved[1]?.items ?? []);
  expect(day.date).toBe(TODAY);
  const blend = getMessages(locale).console.curriculum.blend.lecture;
  await expect(panel.getByTestId('lecture-preset-class-day')).toContainText(blend.classDay(weekdayLong(locale, day.date), day.count));
  await expect(panel.getByTestId('lecture-preset-class-day')).toContainText(blend.classLength(30));
  await expect(panel.getByRole('radio')).toHaveCount(0);
  expect(await sideways(page)).toBeLessThanOrEqual(0);
  expect(await clipped(page, 'lecture-preset-class-day'), 'lecture-preset-class-day').toEqual([]);
  await page.screenshot({ path: test.info().outputPath(`${name}-present.png`), fullPage: true });
}

test.describe('the class wizard to Present this plan in the launch state (BL-10)', () => {
  test.skip(!FULL, 'needs the console e2e export with the mocked API (ROUTE_BLEND_E2E=1)');

  for (const width of [320, 1280]) {
    for (const mode of ['overlap', 'split'] as const) {
      test(`at ${width}, ${mode}: the meeting block, preview, publish, readout, and the class day presented`, async ({ page }) => {
        await page.setViewportSize({ width, height: width === 320 ? 568 : 800 });
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(String(e)));
        const { saved, unexpected } = await mockClass(page);
        await wizardToPresent(page, mode, 'en', saved, width, `route-blend-${mode}-en-${width}`);
        expect(errors).toEqual([]);
        expect(unexpected).toEqual([]);
      });
    }
  }

  test('at 320 with 200 % text: the readout and the presented class day stay inside the window', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    const { saved, unexpected } = await mockClass(page, 'en', 200);
    await wizardToPresent(page, 'overlap', 'en', saved, 320, 'route-blend-overlap-en-320-text200');
    expect(errors).toEqual([]);
    expect(unexpected).toEqual([]);
  });

  for (const locale of ['es', 'ko'] as const) {
    test(`in ${locale} at 320 and 1280: the same flow in the console's ${locale} words`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      for (const width of [320, 1280]) {
        await page.setViewportSize({ width, height: width === 320 ? 568 : 800 });
        const { saved, unexpected } = await mockClass(page, locale);
        await wizardToPresent(page, 'overlap', locale, saved, width, `route-blend-overlap-${locale}-${width}`);
        expect(unexpected, `${locale} at ${width}`).toEqual([]);
        await page.unrouteAll({ behavior: 'ignoreErrors' });
      }
      expect(errors).toEqual([]);
    });
  }
});
