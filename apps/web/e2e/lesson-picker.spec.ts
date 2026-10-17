import { expect, test, type Page, type Route } from '@playwright/test';
import { LOCALE_META, getMessages } from '@hangul-route/i18n';
import { API, NOW, SESSION_KEY } from './report-fixtures';

/**
 * The console's grouped lesson picker (owner report 2026-10-16 item 5; `docs/specs/AMENDMENTS-LESSON-CHOOSER.md`
 * row LV-3a; design `design/screens/app-shell/lesson-picker.md`) at 360 x 640, on a mocked API: in a class a Group
 * License covers, Stage 2 lessons go into a plan through the stage chips and an episode's folded lessons, the sticky
 * bar keeps **Publish plan** in sight, a focused row is never under it, and the saved plan holds what was chosen; an
 * uncovered class is offered Stage 1 with the wizard's line (learner devices would not derive Stage 2 items there);
 * the lecture page's catalogue is grouped (stages, stories, word topics) and searchable; the lecture page's Slides
 * language hint follows the choice (AMENDMENTS-LECTURE-V2 section 18.4). No sideways scroll.
 *
 * Runs on the console e2e export (the same one as `curriculum.spec.ts` and `reports.spec.ts`), made with lecture
 * mode on so the lecture page draws its sections:
 *
 *   NEXT_PUBLIC_API_BASE_URL=https://api.report-e2e.test NEXT_PUBLIC_CONSOLE_DEV_AUTH=true NEXT_PUBLIC_LECTURE_MODE=enabled pnpm --filter @hangul-route/web build
 *
 * with `CURRICULUM_E2E=1` (and `LECTURE_E2E=1` for the lecture page group).
 */
const FULL = process.env.CURRICULUM_E2E === '1';
const LECTURE = process.env.LECTURE_E2E === '1';
const en = getMessages('en');
const w = en.console.chooser;

const SPACE = { id: 'space:sunflower', kind: 'class', name: 'Sunflower', parentSpaceId: null, settings: { consentMode: 'parent', anonymizeRoster: false }, archivedAt: null, createdAt: '2026-09-01T00:00:00.000Z' };

interface SavedBody {
  title: string;
  items: { kind: string; id: string }[];
  publish: boolean;
}

const json = (route: Route, status: number, data: unknown) =>
  route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(status < 300 ? { data } : { error: 'mocked' }) });

/** A Group License on the class: Stage 2 and later reach its learners, so the builder lists them. */
const LICENSE = { id: 'ent:e2e', subjectKind: 'space', subjectId: SPACE.id, planKey: 'group_license', status: 'active', provider: 'stripe', providerRef: null, customerRef: null, seats: null, expiresAt: '2099-01-01T00:00:00.000Z', promoCode: null, updatedAt: NOW, subjectName: SPACE.name };

async function mockClass(page: Page, { covered = true }: { covered?: boolean } = {}): Promise<{ saved: SavedBody[]; unexpected: string[] }> {
  await page.clock.setFixedTime(new Date(NOW));
  await page.addInitScript(([key]) => window.sessionStorage.setItem(key as string, JSON.stringify({ token: 'acct-e2e', accountId: 'acct-e2e', displayName: 'Ms Kim' })), [SESSION_KEY]);
  const saved: SavedBody[] = [];
  const unexpected: string[] = [];
  const plans: Record<string, unknown>[] = [];
  await page.route(`${API}/**`, async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    const url = new URL(request.url());
    if (/\/roster$/.test(url.pathname)) return json(route, 200, { space: SPACE, learners: [], joinCode: null, joinCodeExpiresAt: null });
    if (/\/plans$/.test(url.pathname) && request.method() === 'PUT') {
      const body = request.postDataJSON() as SavedBody;
      saved.push(body);
      const plan = { id: 'plan:e2e-1', spaceId: SPACE.id, authorAccountId: 'acct-e2e', title: body.title, items: body.items, targetLearnerIds: null, publishedAt: body.publish ? NOW : null, archivedAt: null, createdAt: NOW, updatedAt: NOW, meta: null };
      plans.splice(0, plans.length, plan);
      return json(route, 201, { plan });
    }
    if (/\/plans$/.test(url.pathname)) return json(route, 200, { plans });
    if (url.pathname === '/api/spaces') return json(route, 200, { spaces: [{ space: SPACE, role: 'teacher', counts: { learners: 0, accounts: 1, classes: 0 } }] });
    if (url.pathname === '/api/entitlements' && request.method() === 'GET') return json(route, 200, { entitlements: covered ? [LICENSE] : [] });
    unexpected.push(`${request.method()} ${url.pathname}`);
    return json(route, 404, null);
  });
  return { saved, unexpected };
}

async function noSidewaysScroll(page: Page): Promise<void> {
  const { scroll, inner } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }));
  expect(scroll).toBeLessThanOrEqual(inner);
}

test.describe('the plan builder\'s grouped lesson picker at 360 (LV-3a)', () => {
  test.skip(!FULL, 'needs the console e2e export (CURRICULUM_E2E=1)');
  test.use({ viewport: { width: 360, height: 640 } });

  test('Stage 2 lessons go into a plan; Publish plan stays in sight; the saved plan holds them', async ({ page }) => {
    const { saved, unexpected } = await mockClass(page);
    await page.goto(`/teach/space/plan?id=${encodeURIComponent(SPACE.id)}`);
    const picker = page.getByTestId('plan-picker');
    await expect(picker.getByRole('heading', { level: 2, name: w.planTitle })).toBeVisible();
    // Stage 1 first, folded: five episode rows, no lesson boxes showing.
    await expect(picker.getByRole('heading', { level: 3, name: 'Stage 1 · 15 lessons' })).toBeVisible();
    await expect(picker.getByTestId('plan-picker-lesson-quest:stage1-letters-q1')).toBeHidden();
    await noSidewaysScroll(page);

    await picker.getByTestId('plan-picker-chip-stage2').check();
    await expect(picker.getByRole('heading', { level: 3, name: 'Stage 2 · 18 lessons' })).toBeVisible();
    const open = picker.getByRole('button', { name: w.lessonsOf('Word Builder') });
    await expect(open).toHaveAttribute('aria-expanded', 'false');
    await open.click();
    await expect(open).toHaveAttribute('aria-expanded', 'true');
    await picker.getByTestId('plan-picker-lesson-quest:stage2-letters-q1').check();
    await picker.getByTestId('plan-picker-row-episode:stage2-life').check();
    // The whole Word Builder box reads as partly chosen.
    expect(await picker.getByTestId('plan-picker-row-episode:stage2-letters').evaluate((el) => (el as HTMLInputElement).indeterminate)).toBe(true);

    // The sticky bar: the count and Publish plan without scrolling back down.
    const bar = page.getByRole('region', { name: w.bar });
    await expect(bar.getByTestId('plan-bar-count')).toHaveText(/^2 chosen · about \d+ min$/);
    await expect(page.getByTestId('publish-plan')).toBeInViewport();
    await page.screenshot({ path: test.info().outputPath('plan-picker-360.png') });

    // Keyboard focus never lands under the bar (WCAG 2.4.11): with a row hidden just under the bar's top edge, Tab
    // onto it scrolls it above the bar (the page's scroll-padding-bottom is the measured bar height).
    const crafts = picker.getByTestId('plan-picker-row-episode:stage2-crafts');
    const rowTop = await crafts.evaluate((el) => el.closest('label')!.getBoundingClientRect().top + window.scrollY);
    const barTopBefore = await bar.evaluate((el) => el.getBoundingClientRect().top);
    await page.evaluate((y) => window.scrollTo(0, y), Math.round(rowTop - barTopBefore - 10));
    expect(await crafts.evaluate((el) => el.closest('label')!.getBoundingClientRect().bottom)).toBeGreaterThan(barTopBefore);
    await picker.getByTestId('plan-picker-open-episode:stage2-nature').evaluate((el) => (el as HTMLElement).focus({ preventScroll: true }));
    await page.keyboard.press('Tab');
    await expect(crafts).toBeFocused();
    const rowBottom = await crafts.evaluate((el) => el.closest('label')!.getBoundingClientRect().bottom);
    expect(rowBottom).toBeLessThanOrEqual(await bar.evaluate((el) => el.getBoundingClientRect().top));

    await page.getByLabel(en.console.plan.titleField.label).fill('Week 2 words');
    await expect(page.getByTestId('publish-plan')).toBeInViewport();
    await page.getByTestId('publish-plan').click();
    await expect.poll(() => saved.length).toBe(1);
    expect(saved[0]).toMatchObject({ title: 'Week 2 words', publish: true, items: [{ kind: 'quest', id: 'quest:stage2-letters-q1' }, { kind: 'episode', id: 'episode:stage2-life' }] });
    await noSidewaysScroll(page);
    expect(unexpected).toEqual([]);
  });

  test('an uncovered class: Stage 1 only, with the wizard\'s line; a Stage 1 plan still publishes', async ({ page }) => {
    const { saved, unexpected } = await mockClass(page, { covered: false });
    await page.goto(`/teach/space/plan?id=${encodeURIComponent(SPACE.id)}`);
    const picker = page.getByTestId('plan-picker');
    await expect(picker.getByRole('heading', { level: 3, name: 'Stage 1 · 15 lessons' })).toBeVisible();
    await expect(picker.getByRole('radio')).toHaveCount(1);
    await expect(picker.getByTestId('plan-picker-chip-stage2')).toHaveCount(0);
    // The export is built with the free-plan switch off: the wizard's words for it, See plans for a class.
    await expect(picker.getByTestId('plan-picker-notice')).toContainText(en.console.curriculum.preview.warnings.premium(92));
    await expect(picker.getByTestId('plan-picker-notice').getByRole('link', { name: en.console.curriculum.preview.warnings.seePlans.cta })).toBeVisible();
    await picker.getByTestId('plan-picker-notice').scrollIntoViewIfNeeded();
    await page.screenshot({ path: test.info().outputPath('plan-picker-uncovered-360.png') });
    await picker.getByTestId('plan-picker-row-episode:stage1-life').check();
    await page.getByLabel(en.console.plan.titleField.label).fill('Week 1');
    await page.getByTestId('publish-plan').click();
    await expect.poll(() => saved.length).toBe(1);
    expect(saved[0]).toMatchObject({ publish: true, items: [{ kind: 'episode', id: 'episode:stage1-life' }] });
    await noSidewaysScroll(page);
    expect(unexpected).toEqual([]);
  });

  test('search finds a lesson in any stage, in Hangul too', async ({ page }) => {
    await mockClass(page);
    await page.goto(`/teach/space/plan?id=${encodeURIComponent(SPACE.id)}`);
    const picker = page.getByTestId('plan-picker');
    await picker.getByLabel(w.search.label).fill('kitchen');
    await expect(picker.getByTestId('plan-picker-group-stage4')).toBeVisible();
    await expect(picker.getByTestId('plan-picker-group-stage1')).toHaveCount(0);
    await expect(picker.getByTestId('plan-picker-status')).toHaveText(/\d+ match(es)?/);
    await picker.getByLabel(w.search.label).fill('글자 만나기');
    await expect(picker.getByTestId('plan-picker-row-episode:stage1-letters')).toBeVisible();
    await picker.getByRole('button', { name: w.clearSearch.cta }).click();
    await expect(picker.getByTestId('plan-picker-chip-stage1')).toBeVisible();
    await noSidewaysScroll(page);
  });
});

test.describe('the plan builder\'s picker at 1280 and at 320 with 200 % text (LV-3a)', () => {
  test.skip(!FULL, 'needs the console e2e export (CURRICULUM_E2E=1)');

  test('1280: the picker beside Your plan, a stage open', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await mockClass(page);
    await page.goto(`/teach/space/plan?id=${encodeURIComponent(SPACE.id)}`);
    const picker = page.getByTestId('plan-picker');
    await picker.getByTestId('plan-picker-chip-stage4').check();
    await picker.getByRole('button', { name: w.lessonsOf('Kitchen Talk') }).click();
    await picker.getByTestId('plan-picker-lesson-quest:stage4-life-q1').check();
    await expect(page.getByTestId('publish-plan')).toBeInViewport();
    await noSidewaysScroll(page);
    await page.screenshot({ path: test.info().outputPath('plan-picker-1280.png') });
  });

  test('320 with the text at 200 %: chips and rows wrap, nothing scrolls sideways', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await mockClass(page);
    await page.goto(`/teach/space/plan?id=${encodeURIComponent(SPACE.id)}`);
    // 200 % text is the browser's default font size (CDP `Page.setFontSizes`, as in `site-budgets.spec.ts`), never an
    // inline `html` font-size: the console's text size provider owns that one (`calc(100% * var(--hr-text-scale))`,
    // AMENDMENTS-DISPLAY-NAV section 4), so the browser setting and the device's step multiply. Chromium drops the CDP
    // sizes on a resize, so the viewport is set first.
    const client = await page.context().newCDPSession(page);
    await client.send('Page.setFontSizes', { fontSizes: { standard: 32, fixed: 32 } });
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).fontSize)).toBe('32px');
    const picker = page.getByTestId('plan-picker');
    await picker.getByTestId('plan-picker-chip-stage2').check();
    await picker.getByRole('button', { name: w.lessonsOf('Word Builder') }).click();
    await picker.getByTestId('plan-picker-lesson-quest:stage2-letters-q2').check();
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize)).toBe('32px');
    await noSidewaysScroll(page);
    await expect(page.getByTestId('publish-plan')).toBeInViewport();
    await page.screenshot({ path: test.info().outputPath('plan-picker-320-text200.png') });
  });
});

test.describe('the lecture page\'s catalogue is grouped at 360 (LV-3a)', () => {
  test.skip(!FULL || !LECTURE, 'needs the console e2e export with lecture mode on (CURRICULUM_E2E=1 LECTURE_E2E=1)');
  test.use({ viewport: { width: 360, height: 640 } });

  test('stages, stories and word topics behind chips; a story and a Stage 3 lesson go into the outline', async ({ page }) => {
    const { unexpected } = await mockClass(page);
    await page.goto(`/teach/space/lecture?id=${encodeURIComponent(SPACE.id)}`);
    const picker = page.getByTestId('lecture-picker');
    await expect(picker.getByRole('heading', { level: 2, name: en.console.lecture.catalogue.title })).toBeVisible();
    const chips = picker.getByRole('radio');
    await expect(chips).toHaveCount(9);
    await expect(picker.getByTestId('lecture-picker-chip-stories')).toBeVisible();
    await expect(picker.getByTestId('lecture-picker-chip-topics')).toBeVisible();
    // The old flat Stage 1 list is gone: one group at a time.
    await expect(picker.getByRole('heading', { level: 3 })).toHaveCount(1);

    await picker.getByTestId('lecture-picker-chip-stories').check();
    await expect(picker.getByRole('heading', { level: 3, name: /^Stories · \d+ stories$/ })).toBeVisible();
    await picker.getByTestId('lecture-picker-row-story:hangeul-day').check();
    await picker.getByTestId('lecture-picker-chip-stage3').check();
    await picker.getByRole('button', { name: w.lessonsOf('First Sentences') }).click();
    await picker.getByTestId('lecture-picker-lesson-quest:stage3-letters-q1').check();
    const outline = page.getByTestId('lecture-outline');
    await expect(outline.getByRole('listitem')).toHaveCount(2);
    await expect(outline).toContainText('Happy Hangul Day!');
    await page.screenshot({ path: test.info().outputPath('lecture-picker-360.png'), fullPage: true });
    await noSidewaysScroll(page);
    expect(unexpected).toEqual([]);
  });

  test('the Slides language hint follows the choice: the device\'s language by default, the chosen one on every device (AMENDMENTS-LECTURE-V2 section 18.4)', async ({ page }) => {
    const { unexpected } = await mockClass(page);
    await page.goto(`/teach/space/lecture?id=${encodeURIComponent(SPACE.id)}`);
    const o = en.console.lecture.options;
    const select = page.getByTestId('lecture-slides-language');
    const hint = page.getByTestId('lecture-slides-language-hint');
    // Same as this device is first and chosen: no language in the deck, so a copied link follows the device that opens it.
    await expect(select).toHaveValue('');
    await expect(hint).toHaveText(o.languageHint);
    for (const locale of ['ko', 'es', 'en'] as const) {
      const { endonym, htmlLang } = LOCALE_META[locale];
      await select.selectOption(locale);
      await expect(hint).toHaveText(o.languageHintChosen(endonym));
      await expect(hint.locator(`span[lang="${htmlLang}"]`)).toHaveText(endonym);
      await expect(page.getByText(o.languageHint, { exact: true })).toHaveCount(0);
      if (locale === 'ko') {
        await hint.scrollIntoViewIfNeeded();
        await page.screenshot({ path: test.info().outputPath('lecture-slides-language-ko-360.png') });
        await noSidewaysScroll(page);
      }
    }
    // Back to Same as this device: the copied-link hint returns.
    await select.selectOption('');
    await expect(hint).toHaveText(o.languageHint);
    await expect(hint.locator('span[lang]')).toHaveCount(0);
    await hint.scrollIntoViewIfNeeded();
    await page.screenshot({ path: test.info().outputPath('lecture-slides-language-same-360.png') });
    expect(unexpected).toEqual([]);
  });
});
