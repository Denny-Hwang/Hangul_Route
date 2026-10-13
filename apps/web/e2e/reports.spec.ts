import { expect, test, type Page } from '@playwright/test';
import { CATALOG, storyIsReady } from '@hangul-route/content-schema';
import { touchTarget } from '@hangul-route/design-system/tokens';
import { EMPTY, LEGACY, PARTIAL, SESSION_KEY, classUrl, mockClass, mockReport, reportUrl, spaceId } from './report-fixtures';

/**
 * F-REPORT-001 section 5, `web/e2e/reports.spec.ts` (RP-7a2 cases): the learner report page on the static export,
 * the API mocked with `page.route`. Reports are a build-time switch, so the full cases need an export made with
 * `NEXT_PUBLIC_REPORTS_ENABLED=true`, `NEXT_PUBLIC_API_BASE_URL=https://api.report-e2e.test` and
 * `NEXT_PUBLIC_CONSOLE_DEV_AUTH=true`, run with `REPORTS_E2E=1`. On the default export (the preview gate's) only the
 * switched-off case runs. RP-7b adds the All-time growth line and the print cases; RP-11 runs these with the flag flipped.
 */
const FULL = process.env.REPORTS_E2E === '1';

const VIEWPORTS = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
] as const;

async function noSidewaysScroll(page: Page): Promise<void> {
  const { scroll, inner } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }));
  expect(scroll).toBeLessThanOrEqual(inner);
}

/** The `@page` rules that set a zero margin, wherever they sit (top level or inside `@media print`). */
async function zeroMarginPageRules(page: Page): Promise<number> {
  return page.evaluate(() => {
    let found = 0;
    const walk = (rules: CSSRuleList): void => {
      for (const rule of Array.from(rules)) {
        if (rule instanceof CSSPageRule && /^0(px)?$/.test(rule.style.getPropertyValue('margin-top').trim())) found += 1;
        else if ('cssRules' in rule && (rule as CSSGroupingRule).cssRules) walk((rule as CSSGroupingRule).cssRules);
      }
    };
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        walk(sheet.cssRules);
      } catch {
        // A cross-origin sheet (fonts) cannot be read and holds no page rule of ours.
      }
    }
    return found;
  });
}

const headline = (page: Page) => page.getByTestId('report-headline');

test.describe('reports switched off (the default export)', () => {
  test.skip(FULL, 'the export was built with reports on');

  test('the page says reports are not available yet, as its h1, with the back link', async ({ page }) => {
    await page.addInitScript(
      ([key]) => window.sessionStorage.setItem(key as string, JSON.stringify({ token: 'acct-e2e', accountId: 'acct-e2e', displayName: 'Ms Kim' })),
      [SESSION_KEY],
    );
    await page.goto(reportUrl('class', 'period=week&from=roster'));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Reports are not available yet.');
    await expect(page.getByTestId('report-back')).toBeVisible();
    await expect(page).toHaveTitle('Report - Hangul Route');
  });

  test('a page that is not a report keeps the default print margins: no zero-margin @page rule is loaded', async ({ page }) => {
    await page.goto('/');
    await page.emulateMedia({ media: 'print' });
    expect(await zeroMarginPageRules(page)).toBe(0);
  });
});

test.describe('the learner report (RP-7a2)', () => {
  test.skip(!FULL, 'needs an export built with reports on (REPORTS_E2E=1)');

  for (const viewport of VIEWPORTS) {
    test(`no sideways scroll at ${viewport.width} x ${viewport.height}, More detail closed and open`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await mockReport(page, { kind: 'family' });
      await page.goto(reportUrl('family', 'period=week&from=home'));
      await expect(headline(page)).toBeVisible();
      await noSidewaysScroll(page);
      await page.getByTestId('report-more-button').click();
      await noSidewaysScroll(page);
    });
  }

  test('first screen at 390 x 844, the ready parent: the headline and the first went-well line without scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockReport(page, { kind: 'family' });
    await page.goto(reportUrl('family', 'period=week&from=home'));
    await expect(page.getByTestId('report-back')).toHaveText('Back to home');
    const first = page.getByTestId('report-went-well').getByRole('listitem').first();
    await expect(first).toBeVisible();
    expect(await headline(page).evaluate((node) => node.getBoundingClientRect().bottom)).toBeLessThanOrEqual(844);
    expect(await first.evaluate((node) => node.getBoundingClientRect().bottom)).toBeLessThanOrEqual(844);
  });

  test('first screen at 390 x 844, the class viewer: two-row phone header, the first went-well line without scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockReport(page, { kind: 'class', role: 'teacher' });
    await page.goto(reportUrl('class', 'period=week&from=roster'));
    await expect(page.getByTestId('report-back')).toHaveText('Back to Sunflower');
    // The back link has the header's first row to itself; Print sits on the row under it.
    const back = await page.getByTestId('report-back').boundingBox();
    const print = await page.getByTestId('report-print').boundingBox();
    expect(back && print && print.y >= back.y + back.height).toBe(true);
    const first = page.getByTestId('report-went-well').getByRole('listitem').first();
    expect(await first.evaluate((node) => node.getBoundingClientRect().bottom)).toBeLessThanOrEqual(844);
  });

  test('document.title holds no display name; the h1 holds it', async ({ page }) => {
    await mockReport(page, { kind: 'class', name: 'Mina Park' });
    await page.goto(reportUrl('class'));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mina Park: report');
    await expect(page).toHaveTitle('Report - Hangul Route');
    expect(await page.title()).not.toContain('Mina');
  });

  test('More detail is collapsed, then opens', async ({ page }) => {
    await mockReport(page, { kind: 'family' });
    await page.goto(reportUrl('family'));
    const button = page.getByTestId('report-more-button');
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByTestId('report-detail')).toBeHidden();
    await button.click();
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByText('Letters Mina knows well')).toBeVisible();
  });

  test('tabs: arrow keys move focus, Enter selects; the period is in the URL and focus stays on the selected tab', async ({ page }) => {
    const mock = await mockReport(page, { kind: 'family' });
    await page.goto(reportUrl('family'));
    await expect(headline(page)).toHaveText('Mina practiced on 3 days this week.');
    await page.getByRole('tab', { name: 'This week' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'This month' })).toBeFocused();
    expect(mock.periods).toEqual(['week']);
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/period=month/);
    await expect(page.getByRole('tab', { name: 'This month' })).toHaveAttribute('aria-selected', 'true');
    await expect(headline(page)).toBeVisible();
    await expect(page.getByRole('tab', { name: 'This month' })).toBeFocused();
    expect(mock.periods).toEqual(['week', 'month']);
    await expect(page.getByTestId('report-announce')).toHaveText('Showing this month');
  });

  test('the stepper: a step back puts `at` in the URL; stepping forward to this week keeps focus off the body', async ({ page }) => {
    await mockReport(page, { kind: 'family' });
    await page.goto(reportUrl('family'));
    await page.getByTestId('report-step-prev').click();
    await expect(page).toHaveURL(/at=2026-10-08/);
    await expect(page.getByTestId('report-range')).toHaveText('Oct 2 to Oct 8');
    await page.getByTestId('report-step-next').click();
    await expect(page).not.toHaveURL(/at=/);
    await expect(page.getByTestId('report-step-next')).toHaveCount(0);
    expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe('BODY');
    await expect(page.getByTestId('report-step-prev')).toBeFocused();
  });

  test('loading: the status line sits outside the busy panel; a later load keeps the tabs enabled', async ({ page }) => {
    const mock = await mockReport(page, { kind: 'family', hold: true });
    await page.goto(reportUrl('family'));
    const panel = page.getByTestId('report-panel');
    await expect(panel).toHaveAttribute('aria-busy', 'true');
    await expect(page.getByTestId('report-status')).toHaveText('Loading the report');
    expect(await panel.locator('[role="status"]').count()).toBe(0);
    await expect(page.getByRole('tab', { name: 'This week' })).toBeDisabled();
    await expect(page.getByTestId('report-print')).toBeDisabled();
    mock.release();
    await expect(headline(page)).toBeVisible();
    await expect(page.getByTestId('report-print')).toBeEnabled();
  });

  test('legacy: the glance and the neutral lines, no tabs, More detail', async ({ page }) => {
    await mockReport(page, { kind: 'class', summary: LEGACY });
    await page.goto(reportUrl('class'));
    await expect(page.getByText('Day-by-day figures are not available yet.')).toBeVisible();
    await expect(page.getByRole('tablist')).toHaveCount(0);
    await expect(page.getByTestId('report-more-button')).toBeVisible();
  });

  test('no_data: one neutral block, never "has not practiced"', async ({ page }) => {
    await mockReport(page, { kind: 'family', summary: null });
    await page.goto(reportUrl('family'));
    await expect(page.getByText("No saved progress from Mina's device yet.")).toBeVisible();
    await expect(page.getByTestId('report-glance')).toHaveCount(0);
    await expect(page.getByText(/not practiced/)).toHaveCount(0);
  });

  test('empty: the not-started line and the next quest, no tabs', async ({ page }) => {
    await mockReport(page, { kind: 'family', summary: EMPTY });
    await page.goto(reportUrl('family'));
    await expect(page.getByText('Mina has not started yet. The report fills in after the first practice.')).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'What to practice next' })).toBeVisible();
    await expect(page.getByRole('tablist')).toHaveCount(0);
  });

  test('partial window: "Figures up to", dashed days after the last save, no rhythm line (behaviour 13)', async ({ page }) => {
    await mockReport(page, { kind: 'family', summary: PARTIAL });
    await page.goto(reportUrl('family'));
    await expect(page.getByText('Figures up to Oct 11.')).toBeVisible();
    await expect(page.locator('[data-kind="not_saved"]')).toHaveCount(4);
    await expect(page.locator('[data-kind="practiced"]')).toHaveCount(3);
    await expect(page.getByText(/Not saved yet:/)).toBeVisible();
    await expect(page.getByTestId('report-line-rhythm')).toHaveCount(0);
  });

  test('a network error on the first load: the error is the h1 with Try again', async ({ page }) => {
    await mockReport(page, { kind: 'family', status: 500 }, { kind: 'family' });
    await page.goto(reportUrl('family'));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText("Can't load the report right now.");
    await page.getByTestId('report-retry').click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mina: report');
  });

  test('a network error after a report loaded: the report stays with its h1 and the error as a state line', async ({ page }) => {
    await mockReport(page, { kind: 'family' }, { kind: 'family', status: 500 });
    await page.goto(reportUrl('family'));
    await expect(headline(page)).toBeVisible();
    await page.getByRole('tab', { name: 'This month' }).click();
    await expect(page.getByTestId('report-error-line')).toHaveText("Can't load the report right now.");
    await expect(page.getByTestId('report-status')).toHaveText("Can't load the report right now.");
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mina: report');
    await expect(page.getByTestId('report-print')).toBeDisabled();
  });

  test('not a member: "This report is not available."', async ({ page }) => {
    await mockReport(page, { kind: 'class', status: 404 });
    await page.goto(reportUrl('class'));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('This report is not available.');
  });

  test('an archived class: the settings sentence for its owner, the neutral line for a co-teacher', async ({ page, browser }) => {
    await mockReport(page, { kind: 'class', archivedAt: '2026-10-01T00:00:00.000Z', role: 'owner' });
    await page.goto(reportUrl('class'));
    await expect(page.getByTestId('report-state')).toContainText('read-only until you unarchive it');
    await expect(page.getByTestId('report-line-actions')).toHaveCount(0);
    const other = await browser.newPage();
    await mockReport(other, { kind: 'class', archivedAt: '2026-10-01T00:00:00.000Z', role: 'teacher' });
    await other.goto(reportUrl('class'));
    await expect(other.getByTestId('report-state')).toContainText('This class is archived. Its report is read-only.');
    await other.close();
  });

  // Assumption e: the roster card is 280 px at its narrowest (the roster grid's `minmax(280px, 1fr)`), which a 320 px
  // phone gives it; See report must fit inside that card beside its other links, at least a touch target tall.
  for (const kind of ['class', 'family'] as const) {
    for (const width of [320, 390]) {
      test(`the ${kind} roster card has room for See report at ${width} px (assumption e)`, async ({ page }) => {
        await page.setViewportSize({ width, height: 800 });
        await mockReport(page, { kind });
        await page.goto(`/teach/space?id=${encodeURIComponent(spaceId(kind))}`);
        const card = page.getByTestId('student-card');
        const link = card.getByTestId('see-report');
        await expect(link).toBeVisible();
        await expect(link).toHaveText('See report');
        const cardBox = await card.boundingBox();
        const box = await link.boundingBox();
        if (!cardBox || !box) throw new Error('no layout');
        if (width === 320) expect(Math.round(cardBox.width)).toBeLessThanOrEqual(290);
        expect(box.height).toBeGreaterThanOrEqual(touchTarget.min);
        expect(box.x).toBeGreaterThanOrEqual(cardBox.x);
        expect(box.x + box.width).toBeLessThanOrEqual(cardBox.x + cardBox.width);
        // Ids and codes only: the learner's name never reaches the address.
        const href = (await link.getAttribute('href')) ?? '';
        expect(href).toContain(`id=${encodeURIComponent(spaceId(kind))}`);
        expect(href).toContain('learner=profile%3Amina');
        expect(href).toContain('period=week');
        expect(href).toContain('from=roster');
        expect(href).not.toContain('Mina');
        await noSidewaysScroll(page);
      });
    }
  }

  test('P1: Add to a plan, described by its sentence, for a viewer with plan.write', async ({ page }) => {
    await mockReport(page, { kind: 'class', role: 'teacher' });
    await page.goto(reportUrl('class'));
    const action = page.getByTestId('report-line-letters_revisit').getByRole('link', { name: 'Add to a plan' });
    await expect(action).toHaveAttribute('href', /add=quest%3Astage1-life-q2/);
    const described = await action.getAttribute('aria-describedby');
    await expect(page.locator(`[id="${described}"]`)).toHaveText('ㅂ (b) and ㅅ (s): worth another visit.');
  });

  test('All time: the growth chart with its months, the table behind Show as table, no sideways scroll at 320', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await mockReport(page, { kind: 'family' });
    await page.goto(reportUrl('family', 'period=all'));
    await expect(page.getByRole('img', { name: 'Quests and cards by month' })).toBeVisible();
    await expect(page.getByTestId('report-growth-table')).toBeHidden();
    await page.getByRole('button', { name: 'Show as table' }).click();
    await expect(page.getByRole('table', { name: 'Quests and cards by month' })).toBeVisible();
    await expect(page.getByRole('row', { name: /October 2026/ })).toContainText('7');
    await noSidewaysScroll(page);
  });

  test('print: the footer shows, More detail is expanded, the frame and every screen-only control are hidden', async ({ page }) => {
    await mockReport(page, { kind: 'class', role: 'teacher' });
    await page.goto(reportUrl('class', 'period=week&from=roster'));
    await expect(headline(page)).toBeVisible();
    await expect(page.getByTestId('report-print-footer')).toBeHidden();
    await page.emulateMedia({ media: 'print' });
    await expect(page.getByTestId('report-print-footer')).toBeVisible();
    await expect(page.getByTestId('report-print-footer')).toHaveText('Private: shared from Hangul Route on Oct 15.');
    await expect(page.getByTestId('report-detail')).toBeVisible();
    await expect(page.getByText('Letters Mina knows well')).toBeVisible();
    await expect(page.getByTestId('frame-nav')).toBeHidden();
    await expect(page.getByTestId('frame-brand')).toBeHidden();
    await expect(page.getByTestId('report-print')).toBeHidden();
    await expect(page.getByTestId('report-back')).toBeHidden();
    await expect(page.getByTestId('report-more-button')).toBeHidden();
    await expect(page.getByTestId('report-step-prev')).toBeHidden();
    await expect(page.getByTestId('report-line-actions').first()).toBeHidden();
    await expect(page.getByRole('tab', { name: 'This month' })).toBeHidden();
    await expect(page.getByRole('tab', { name: 'This week' })).toBeVisible();
    await expect(page.getByTestId('report-range')).toBeVisible();
    await expect(page.getByTestId('report-calendar')).toBeHidden();
    await expect(page.getByTestId('report-calendar-text')).toBeVisible();
    // The page padding sits inside the report; the frame main adds none.
    expect(await page.locator('.hr-frame-main').evaluate((node) => getComputedStyle(node).paddingTop)).toBe('0px');
    // The zero page margin comes with the report's own style element, never from the global sheet.
    expect(await zeroMarginPageRules(page)).toBe(1);
    await expect(page).toHaveTitle('Report - Hangul Route');
  });

  test('print on All time: the growth table prints in place of the chart, even when it was closed', async ({ page }) => {
    await mockReport(page, { kind: 'family' });
    await page.goto(reportUrl('family', 'period=all'));
    await expect(page.getByTestId('report-growth-chart')).toBeVisible();
    await page.emulateMedia({ media: 'print' });
    await expect(page.getByTestId('report-growth-chart')).toBeHidden();
    await expect(page.getByTestId('report-growth-table')).toBeVisible();
    await expect(page.getByTestId('report-growth-toggle')).toBeHidden();
  });

  test('print to PDF (Chromium): a short report fits in at most two A4 pages', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'page.pdf is Chromium only');
    await mockReport(page, { kind: 'family' });
    await page.goto(reportUrl('family', 'period=week&from=home'));
    await expect(headline(page)).toBeVisible();
    await page.emulateMedia({ media: 'print' });
    const pdf = await page.pdf({ format: 'A4', preferCSSPageSize: true });
    // The page tree's /Count (the root /Pages dictionary), not a scan for /Page objects, which may sit in compressed
    // object streams.
    const text = pdf.toString('latin1');
    const counts = [...text.matchAll(/<<[^<>]*\/Type\s*\/Pages\b[^<>]*>>/g)].map((m) => Number(/\/Count\s+(\d+)/.exec(m[0])?.[1] ?? NaN));
    expect(counts.length).toBeGreaterThan(0);
    const pages = Math.max(...counts);
    expect(pages).toBeGreaterThanOrEqual(1);
    expect(pages).toBeLessThanOrEqual(2);
  });
});

/** RP-10: the plan builder takes `&add=<questId>` from Add to a plan and pre-adds the quest as a draft item. */
test.describe('Add to a plan opens the builder with the quest pre-added (RP-10)', () => {
  test.skip(!FULL, 'needs an export built with reports on (REPORTS_E2E=1)');

  const planUrl = (extra: string) => `/teach/space/plan?id=${encodeURIComponent(spaceId('class'))}&${extra}`;
  const yours = (page: Page) => page.getByLabel('Your plan', { exact: true });
  const draft = (items: { kind: string; id: string }[], over: Record<string, unknown> = {}) => ({
    id: 'plan:draft',
    spaceId: spaceId('class'),
    authorAccountId: 'acct-e2e',
    title: 'Letters to revisit',
    items,
    targetLearnerIds: null,
    publishedAt: null,
    archivedAt: null,
    createdAt: '2026-10-14T00:00:00.000Z',
    updatedAt: '2026-10-14T00:00:00.000Z',
    ...over,
  });
  // A story this build has not signed yet, when there is one (the unit tests cover a closed story on a fixed catalogue).
  const closedStory = CATALOG.stories.find((story) => !storyIsReady(story))?.questId;

  test('from the report: a new draft holds the quest, nothing is saved, and the address drops add', async ({ page }) => {
    const writes: string[] = [];
    page.on('request', (request) => {
      if (request.method() === 'PUT' || request.method() === 'POST') writes.push(request.url());
    });
    await mockReport(page, { kind: 'class', role: 'teacher' });
    await page.goto(reportUrl('class'));
    await page.getByTestId('report-line-letters_revisit').getByRole('link', { name: 'Add to a plan' }).click();
    await expect(page.getByRole('heading', { name: 'Your plan (1)' })).toBeVisible();
    await expect(yours(page)).toContainText('Family at the Table');
    await expect(page).toHaveURL(/\/teach\/space\/plan\?id=space%3Asunflower$/);
    await expect(page.getByTestId('publish-plan')).toBeDisabled();
    expect(writes).toEqual([]);
  });

  test('an unknown or closed quest adds nothing and the builder opens as usual', async ({ page }) => {
    await mockReport(page, { kind: 'class', role: 'teacher' });
    for (const id of ['quest:nope', 'episode:stage1-life', ...(closedStory ? [closedStory] : [])]) {
      await page.goto(planUrl(`add=${encodeURIComponent(id)}`));
      await expect(page.getByRole('heading', { name: 'Your plan (0)' })).toBeVisible();
      await expect(page).toHaveURL(/\/teach\/space\/plan\?id=space%3Asunflower$/);
    }
  });

  test('a duplicate add leaves the open draft as it was; another quest joins it', async ({ page }) => {
    await mockReport(page, { kind: 'class', role: 'teacher', plans: [draft([{ kind: 'quest', id: 'quest:stage1-life-q2' }])] });
    await page.goto(planUrl('add=quest%3Astage1-life-q2'));
    await expect(page.getByRole('heading', { name: 'Edit plan' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Your plan (1)' })).toBeVisible();
    await page.goto(planUrl('add=quest%3Astage1-life-q3'));
    await expect(page.getByRole('heading', { name: 'Your plan (2)' })).toBeVisible();
    await expect(page.getByLabel('Plan title')).toHaveValue('Letters to revisit');
  });

  test('over a published plan: a new draft holds the quest, no stored plan is marked open, and each one opens from the switcher', async ({ page }) => {
    const writes: string[] = [];
    page.on('request', (request) => {
      if (request.method() === 'PUT' || request.method() === 'POST') writes.push(request.url());
    });
    const live = draft([{ kind: 'quest', id: 'quest:stage1-life-q1' }], { id: 'plan:live', title: 'This week', publishedAt: '2026-10-14T00:00:00.000Z', updatedAt: '2026-10-15T00:00:00.000Z' });
    const older = draft([{ kind: 'quest', id: 'quest:stage1-life-q3' }], { id: 'plan:older', title: 'Last week', publishedAt: '2026-10-07T00:00:00.000Z', updatedAt: '2026-10-07T00:00:00.000Z' });
    await mockReport(page, { kind: 'class', role: 'teacher', plans: [live, older] });
    await page.goto(planUrl('add=quest%3Astage1-life-q2'));
    await expect(page.getByRole('heading', { name: 'New plan' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Your plan (1)' })).toBeVisible();
    await expect(page.getByTestId('plan-chip')).toHaveCount(2);
    await expect(page.locator('[data-testid="plan-chip"][aria-current]')).toHaveCount(0);
    // Leaving the unsaved draft asks first; Cancel is not offered, so the quest is never dropped silently.
    await expect(page.getByRole('button', { name: 'Cancel' })).toHaveCount(0);
    page.once('dialog', (dialog) => void dialog.accept());
    await page.getByTestId('plan-chip').filter({ hasText: 'This week' }).click();
    await expect(page.locator('[data-testid="plan-chip"][aria-current]')).toContainText('This week');
    await expect(page.getByRole('heading', { name: 'Your plan (1)' })).toHaveCount(0);
    expect(writes).toEqual([]);
  });

  test('from a family report: the parent builder opens with the quest and a clean address', async ({ page }) => {
    await mockReport(page, { kind: 'family' });
    await page.goto(reportUrl('family'));
    await page.getByTestId('report-line-letters_revisit').getByRole('link', { name: 'Add to a plan' }).click();
    await expect(page).toHaveURL(/\/parent\/space\/plan\?id=space%3Akim-family$/);
    await expect(page.getByRole('heading', { name: 'Your plan (1)' })).toBeVisible();
    await expect(yours(page)).toContainText('Family at the Table');
  });
});

test.describe('the class report (RP-8)', () => {
  test.skip(!FULL, 'needs an export built with reports on (REPORTS_E2E=1)');

  for (const viewport of VIEWPORTS) {
    test(`no sideways scroll at ${viewport.width} x ${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await mockClass(page);
      await page.goto(classUrl());
      await expect(headline(page)).toBeVisible();
      await noSidewaysScroll(page);
      await page.getByTestId('report-more-button').click();
      await noSidewaysScroll(page);
    });
  }

  test('first screen at 390 x 844: the headline without scrolling; no learner name anywhere; generic title', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockClass(page);
    await page.goto(classUrl());
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sunflower: class report');
    await expect(headline(page)).toHaveText('8 of 12 learners practiced this week.');
    expect(await headline(page).evaluate((node) => node.getBoundingClientRect().bottom)).toBeLessThanOrEqual(844);
    await page.getByTestId('report-more-button').click();
    const text = await page.locator('main').innerText();
    expect(text).not.toMatch(/Mina|profile:/);
    expect(text).not.toMatch(/\b(top|most|least|best|lowest|average)\b/i);
    await expect(page).toHaveTitle('Report - Hangul Route');
  });

  test('tabs and stepper put the period and the window in the URL and in the request', async ({ page }) => {
    const mock = await mockClass(page);
    await page.goto(classUrl());
    await expect(headline(page)).toBeVisible();
    await page.getByRole('tab', { name: 'This month' }).click();
    await expect(page).toHaveURL(/period=month/);
    await expect(page.getByRole('tab', { name: 'This month' })).toBeFocused();
    await page.getByTestId('report-step-prev').click();
    await expect(page).toHaveURL(/at=2026-09-01/);
    await page.getByTestId('report-step-next').click();
    await expect(page).not.toHaveURL(/at=/);
    await expect(page.getByTestId('report-step-prev')).toBeFocused();
    expect(mock.calls).toEqual(['?period=week', '?period=month', '?period=month&at=2026-09-01', '?period=month']);
  });

  test('a family space has no class report: not available', async ({ page }) => {
    await mockClass(page, { status: 409 });
    await page.goto(classUrl());
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('This report is not available.');
  });

  test('the class chooser lists the classes; one class opens directly', async ({ page, browser }) => {
    await mockClass(page, { spaces: [{ id: 'space:a', kind: 'class', name: 'Room A' }, { id: 'space:k', kind: 'family', name: 'Kim family' }, { id: 'space:b', kind: 'class', name: 'Room B' }] });
    await page.goto('/teach/space/report');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Which class?');
    await expect(page.getByTestId('class-chooser').getByRole('link')).toHaveCount(2);
    await expect(page.getByText('Kim family')).toHaveCount(0);
    const other = await browser.newPage();
    await mockClass(other);
    await other.goto('/teach/space/report');
    await expect(other).toHaveURL(/id=space%3Asunflower/);
    await expect(other.getByRole('heading', { level: 1 })).toHaveText('Sunflower: class report');
    await other.close();
  });

  test('print: the footer, More detail expanded, homework as text, no frame or buttons', async ({ page }) => {
    await mockClass(page);
    await page.goto(classUrl());
    await expect(headline(page)).toBeVisible();
    await page.emulateMedia({ media: 'print' });
    await expect(page.getByTestId('report-print-footer')).toBeVisible();
    await expect(page.getByTestId('report-detail')).toBeVisible();
    await expect(page.getByText('Week three')).toBeVisible();
    await expect(page.getByTestId('frame-nav')).toBeHidden();
    await expect(page.getByTestId('report-print')).toBeHidden();
    await expect(page.getByTestId('report-step-prev')).toBeHidden();
  });
});


test.describe('the family report at /parent/learner and the report nav items (RP-7c)', () => {
  test.skip(!FULL, 'needs the export built with reports on');

  const familyReport = '/parent/learner?id=space%3Akim-family&learner=profile%3Amina&period=week&from=home';

  test('the parent home card address opens the report under /parent, back to the parent home, Reports current', async ({ page }) => {
    await mockReport(page, { kind: 'family' });
    await page.goto(familyReport);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mina: report');
    await expect(page.getByTestId('report-back')).toHaveAttribute('href', '/parent');
    await expect(page.getByTestId('nav-reports')).toHaveAttribute('aria-current', 'page');
    await expect(page).toHaveTitle('Report - Hangul Route');
  });

  test('the chooser: one family learner opens that report directly', async ({ page }) => {
    await mockReport(page, { kind: 'family' });
    await page.goto('/parent/learner');
    await expect(page).toHaveURL(/\/parent\/learner\?id=space%3Akim-family&learner=profile%3Amina&period=week&from=nav$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mina: report');
    await expect(page.getByTestId('report-back')).toHaveAttribute('href', '/parent');
  });

  for (const width of [320, 390]) {
    test(`the chooser lists two learners in join order, rows at least the touch minimum, no sideways scroll at ${width} px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 700 });
      await mockReport(page, { kind: 'family' });
      const family = {
        id: 'space:kim-family',
        kind: 'family',
        name: 'Kim family',
        parentSpaceId: null,
        settings: { consentMode: 'parent', anonymizeRoster: false },
        archivedAt: null,
        createdAt: '2026-09-01T00:00:00.000Z',
      };
      const learner = (id: string, name: string, joinedAt: string) => ({ id, displayName: name, avatar: 'hoya-orange', ageGroup: 'starter', joinedAt, lastActiveAt: joinedAt, lastSyncedAt: null, summary: null });
      const reply = (data: unknown) => ({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ data }) });
      await page.route('**/api/spaces', (route) =>
        route.request().method() === 'OPTIONS' ? route.fallback() : route.fulfill(reply({ spaces: [{ space: family, role: 'owner', counts: { learners: 2, accounts: 1, classes: 0 } }] })),
      );
      await page.route('**/roster', (route) =>
        route.request().method() === 'OPTIONS'
          ? route.fallback()
          : route.fulfill(reply({ space: family, learners: [learner('profile:jun', 'Jun', '2026-09-05T00:00:00.000Z'), learner('profile:mina', 'Mina', '2026-09-02T00:00:00.000Z')], joinCode: null, joinCodeExpiresAt: null })),
      );
      await page.goto('/parent/learner');
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Whose report?');
      const rows = page.getByTestId('report-chooser').getByRole('link');
      await expect(rows).toHaveText(['Mina', 'Jun']);
      await expect(rows.first()).toHaveAttribute('href', '/parent/learner?id=space%3Akim-family&learner=profile%3Amina&period=week&from=nav');
      for (const box of [await rows.nth(0).boundingBox(), await rows.nth(1).boundingBox()]) expect(box?.height ?? 0).toBeGreaterThanOrEqual(touchTarget.min);
      await expect(page.getByTestId('nav-reports')).toHaveAttribute('href', '/parent/learner');
      await noSidewaysScroll(page);
    });
  }

  test('the teacher frame shows Class reports, current on the class report', async ({ page }) => {
    await mockClass(page);
    await page.goto(classUrl('period=week'));
    await expect(page.getByTestId('report-headline')).toBeVisible();
    await expect(page.getByTestId('nav-classReports')).toHaveText('Class reports');
    await expect(page.getByTestId('nav-classReports')).toHaveAttribute('href', '/teach/space/report');
    await expect(page.getByTestId('nav-classReports')).toHaveAttribute('aria-current', 'page');
  });
});
