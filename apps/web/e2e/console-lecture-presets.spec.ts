import { expect, test, type Page, type Route } from '@playwright/test';
import { decodeDeck, type LectureDeck } from '@hangul-route/content-schema';
import { LOCALE_META, getMessages } from '@hangul-route/i18n';
import { API, NOW, SESSION_KEY } from './report-fixtures';

/**
 * The console lecture setup page, presets first (AMENDMENTS-LECTURE-V2 sections 4.5, 4.6, 6, 14 and 18, row LV-4;
 * mock `design/screens/app-shell/lecture-setup.md`), on a mocked API: the page opens on Ready-made lessons with one
 * card open (named "{title}, about {n} minutes", `aria-expanded` and `aria-controls` holding what it builds), the
 * sticky footer keeps Open presenter in sight, Customize is prefilled with the open preset's outline, there is no
 * Helper picker anywhere, the grouped chooser shows one tab at a time at 320 / 768 / 1180 without sideways scroll,
 * the Slides language hint follows the choice, `?from=plan` opens Next lesson with the plan's own blocks, a family
 * space reads the family words, Word review is offered only from `LECTURE_V2_LINKS_FROM`, and Open presenter opens a
 * tab whose `window.opener` is null. A closed card that cannot build what it names reads its fallback line; a blocked
 * pop-up answers in the footer, in sight with the page at its top; the footer takes at most a third of the window
 * (landscape phones, 1280 x 720, 1920 x 1080, 150 % and 200 % text) or sits at the end of the page.
 *
 * Runs on the console e2e export made with lecture mode on (the one `lesson-picker.spec.ts` uses):
 *
 *   NEXT_PUBLIC_API_BASE_URL=https://api.report-e2e.test NEXT_PUBLIC_CONSOLE_DEV_AUTH=true NEXT_PUBLIC_LECTURE_MODE=enabled pnpm --filter @hangul-route/web build
 *
 * with `LECTURE_E2E=1`. `HR_SHOTS=1` also writes the design shots to `design/screens/app-shell/shots/`.
 */
const LECTURE = process.env.LECTURE_E2E === '1';
const SHOTS = process.env.HR_SHOTS === '1';
const en = getMessages('en');
const l = en.console.lecture;
const p = l.presets;
const APP_URL = 'https://app.hangulroute.com';

const space = (kind: 'class' | 'family') => ({
  id: kind === 'family' ? 'space:parks' : 'space:sunflower',
  kind,
  name: kind === 'family' ? 'The Parks' : 'Sunflower',
  parentSpaceId: null,
  settings: { consentMode: 'parent', anonymizeRoster: false },
  archivedAt: null,
  createdAt: '2026-09-01T00:00:00.000Z',
});

const PLAN = {
  id: 'plan:week3',
  spaceId: 'space:sunflower',
  authorAccountId: 'acct-e2e',
  title: 'Week 3 letters',
  items: [
    { kind: 'quest', id: 'quest:stage1-letters-q2' },
    { kind: 'quest', id: 'quest:stage1-letters-q3' },
  ],
  targetLearnerIds: null,
  publishedAt: NOW,
  archivedAt: null,
  createdAt: NOW,
  updatedAt: NOW,
  meta: null,
};

const json = (route: Route, status: number, data: unknown) =>
  route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(status < 300 ? { data } : { error: 'mocked' }) });

/** A learner two lessons into Stage 1 (`summary.journey`), so Next lesson has a place to follow (N2). */
const ON_THE_ROUTE = {
  id: 'profile:mina',
  displayName: 'Mina',
  ageGroup: '8-9',
  avatar: 'hoya-orange',
  joinedAt: '2026-09-01T00:00:00.000Z',
  lastActiveAt: '2026-10-14T00:00:00.000Z',
  lastSyncedAt: null,
  summary: {
    lastActiveAt: '2026-10-14T00:00:00.000Z',
    streakDays: 1,
    stage1: { questsDone: 2, questsTotal: 15, anchorAccuracy: null },
    cardsUnlocked: 1,
    minutesLast7d: 10,
    jamoRecognized: [],
    needsPractice: [],
    planProgress: {},
    journey: { v: 1, here: 'stage1', stages: [{ stage: 'stage1', state: 'open', done: 2, known: 0, total: 15 }] },
  },
};

async function mock(page: Page, { kind = 'class', plans = [] as unknown[], now = NOW, learners = [] as unknown[] }: { kind?: 'class' | 'family'; plans?: unknown[]; now?: string; learners?: unknown[] } = {}): Promise<{ unexpected: string[] }> {
  await page.clock.setFixedTime(new Date(now));
  await page.addInitScript(([key]) => window.sessionStorage.setItem(key as string, JSON.stringify({ token: 'acct-e2e', accountId: 'acct-e2e', displayName: 'Ms Kim' })), [SESSION_KEY]);
  const unexpected: string[] = [];
  const s = space(kind);
  await page.route(`${API}/**`, async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    const url = new URL(request.url());
    if (/\/roster$/.test(url.pathname)) return json(route, 200, { space: s, learners, joinCode: 'SUN234', joinCodeExpiresAt: '2099-01-01T00:00:00.000Z' });
    if (/\/plans$/.test(url.pathname)) return json(route, 200, { plans });
    if (url.pathname === '/api/spaces') return json(route, 200, { spaces: [{ space: s, role: kind === 'family' ? 'owner' : 'teacher', counts: { learners: 0, accounts: 1, classes: 0 }, joinCode: null, joinCodeExpiresAt: null }] });
    if (url.pathname === '/api/entitlements') return json(route, 200, { entitlements: [] });
    unexpected.push(`${request.method()} ${url.pathname}`);
    return json(route, 404, null);
  });
  return { unexpected };
}

async function noSidewaysScroll(page: Page): Promise<void> {
  const { scroll, inner } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }));
  expect(scroll).toBeLessThanOrEqual(inner);
}

const lecturePath = (kind: 'class' | 'family' = 'class', query = ''): string =>
  `/${kind === 'family' ? 'parent' : 'teach'}/space/lecture?id=${encodeURIComponent(space(kind).id)}${query}`;

/**
 * A screenshot; `whole` grows the window to the page's height first (a full-page capture draws the sticky footer where
 * the first screen ended, over the cards), then puts the window back.
 */
async function shot(page: Page, name: string, whole = true): Promise<void> {
  const size = page.viewportSize();
  if (whole && size) {
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.setViewportSize({ width: size.width, height: Math.max(size.height, height) });
  }
  await page.screenshot({ path: test.info().outputPath(`${name}.png`) });
  if (SHOTS) await page.screenshot({ path: `../../design/screens/app-shell/shots/${name}.png` });
  if (whole && size) await page.setViewportSize(size);
}

test.describe('the lecture setup page, presets first (LV-4)', () => {
  test.skip(!LECTURE, 'needs the console e2e export with lecture mode on (LECTURE_E2E=1)');

  for (const width of [320, 768, 1180]) {
    test(`at ${width}: one card open, the footer in sight, Customize prefilled, the chooser one tab at a time, no sideways scroll`, async ({ page }) => {
      await page.setViewportSize({ width, height: width === 320 ? 640 : 820 });
      const { unexpected } = await mock(page);
      await page.goto(lecturePath());
      await expect(page.getByRole('heading', { level: 1, name: l.title })).toBeVisible();
      await expect(page.getByText(l.intro)).toBeVisible();
      const presets = page.getByTestId('lecture-presets');
      await expect(presets.getByRole('heading', { level: 2, name: p.title })).toBeVisible();
      // Nothing to follow: Hangul week 1 first and open, Next lesson last; no Word review before 2026-11-01.
      const cards = presets.locator('li[data-testid^="lecture-preset-card-"]');
      await expect(cards).toHaveCount(5);
      const names = await presets.locator('button[aria-controls^="lecture-preset-panel-"]').evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')));
      expect(names).toEqual([
        en.a11y.presenter.presetCard(p.zero.title, 20),
        en.a11y.presenter.presetCard(p.stage.title, 20),
        en.a11y.presenter.presetCard(p.story.title, 20),
        en.a11y.presenter.presetCard(p.warmup.title, 10),
        en.a11y.presenter.presetCard(p.next.title, 20),
      ]);
      // The closed Next lesson card says it has nothing to follow (section 4.1), not "Picks up where your class is."
      await expect(page.getByTestId('lecture-preset-fallback-next-lesson')).toHaveText(p.fallback.zero);
      await expect(page.getByTestId('lecture-preset-card-next-lesson')).not.toContainText(p.next.class);
      const open = presets.getByRole('button', { name: en.a11y.presenter.presetCard(p.zero.title, 20) });
      await expect(open).toHaveAttribute('aria-expanded', 'true');
      await expect(presets.locator('button[aria-expanded="true"]')).toHaveCount(1);
      const panel = page.locator(`#${await open.getAttribute('aria-controls')}`);
      await expect(panel.getByRole('heading', { level: 3, name: p.preview.title })).toBeVisible();
      const preview = panel.getByTestId('lecture-preset-preview').getByRole('listitem');
      await expect(preview).toHaveCount(4);
      await expect(page.getByTestId('lecture-footer-minutes')).toHaveText(l.outline.about(19));
      await expect(page.getByTestId('open-presenter')).toBeInViewport();
      await expect(page.getByTestId('open-presenter')).toBeEnabled();
      // No helper picker anywhere (LV-D7).
      await expect(page.getByText(/helper/i)).toHaveCount(0);
      await noSidewaysScroll(page);
      await shot(page, `lv4-lecture-setup-${width}`);

      // A length chip re-resolves what the card holds; another card takes over.
      await panel.getByRole('radio', { name: p.length.option(10) }).check();
      await expect(preview).toHaveCount(2);
      await presets.getByRole('button', { name: en.a11y.presenter.presetCard(p.stage.title, 20) }).click();
      await expect(presets.locator('button[aria-expanded="true"]')).toHaveCount(1);
      await page.getByTestId('lecture-preset-panel-by-stage').getByRole('radio', { name: p.stage.chip(2) }).check();
      const stagePreview = page.getByTestId('lecture-preset-panel-by-stage').getByTestId('lecture-preset-preview').getByRole('listitem');
      const rows = await stagePreview.count();
      expect(rows).toBeGreaterThan(0);

      // Customize: the outline is the open preset's, and the chooser opens on its stage.
      await page.getByTestId('lecture-customize-toggle').click();
      await expect(page.getByTestId('lecture-customize-toggle')).toHaveAttribute('aria-expanded', 'true');
      await expect(page.getByTestId('lecture-outline').getByRole('listitem')).toHaveCount(rows);
      const picker = page.getByTestId('lecture-picker');
      await expect(picker.getByRole('tab')).toHaveText([p.chooser.tab.lessons, p.chooser.tab.stories, p.chooser.tab.words]);
      await expect(picker.getByRole('tab', { selected: true })).toHaveText(p.chooser.tab.lessons);
      await expect(picker.getByRole('tabpanel')).toHaveCount(1);
      await expect(picker.getByTestId('lecture-picker-stage-stage2')).toBeChecked();
      await expect(page.getByRole('textbox', { name: l.titleField.label })).toHaveValue(p.stage.chip(2));
      await expect(page.getByText(/helper/i)).toHaveCount(0);
      await noSidewaysScroll(page);
      // The arrow keys move between the tabs.
      await picker.getByRole('tab', { selected: true }).focus();
      await page.keyboard.press('ArrowRight');
      await expect(picker.getByRole('tab', { selected: true })).toHaveText(p.chooser.tab.stories);
      await expect(picker.getByRole('tab', { selected: true })).toBeFocused();
      await expect(picker.locator('input[data-testid^="lecture-picker-row-story:"]')).toHaveCount(8);
      await picker.getByTestId('lecture-picker-more-stories').click();
      await expect(picker.locator('input[data-testid^="lecture-picker-row-story:"]')).toHaveCount(16);
      await expect(picker.locator('input[data-testid^="lecture-picker-row-story:"]').nth(8)).toBeFocused();
      await noSidewaysScroll(page);
      await picker.getByRole('tab', { name: p.chooser.tab.lessons }).click();
      await picker.getByTestId('lecture-picker-open-episode:stage2-letters').click();
      await expect(picker.getByTestId('lecture-picker-open-episode:stage2-letters')).toHaveAttribute('aria-expanded', 'true');
      await picker.scrollIntoViewIfNeeded();
      await noSidewaysScroll(page);
      // The footer stays in sight while Customize scrolls.
      await expect(page.getByTestId('open-presenter')).toBeInViewport();
      // The first screen of the open chooser with the footer under it, then the whole page.
      if (width === 320) await shot(page, 'lv4-lecture-customize-footer-320', false);
      await shot(page, `lv4-lecture-customize-${width}`);
      expect(unexpected).toEqual([]);
    });
  }

  test('the Slides language hint follows the choice; the deck carries the language only when one is chosen', async ({ page, context }) => {
    await page.setViewportSize({ width: 768, height: 900 });
    const { unexpected } = await mock(page);
    await context.route(`${APP_URL}/**`, (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>presenter</title>' }));
    await page.goto(lecturePath());
    await page.getByTestId('lecture-customize-toggle').click();
    const o = l.options;
    const select = page.getByTestId('lecture-slides-language');
    const hint = page.getByTestId('lecture-slides-language-hint');
    await expect(select).toHaveValue('');
    await expect(hint).toHaveText(o.languageHint);
    const deckOf = async (): Promise<LectureDeck> => {
      const [popup] = await Promise.all([page.waitForEvent('popup'), page.getByTestId('open-presenter').click()]);
      const url = popup.url();
      await popup.close();
      const decoded = decodeDeck(url.split('#d=')[1] ?? '');
      if (!decoded.ok) throw new Error(`not a deck: ${url}`);
      return decoded.deck;
    };
    const same = await deckOf();
    expect(same.options.uiLocale).toBeUndefined();
    expect(same.picker).toBeNull();
    expect(same.v).toBe(1);
    await select.selectOption('ko');
    await expect(hint).toHaveText(o.languageHintChosen(LOCALE_META.ko.endonym));
    expect((await deckOf()).options.uiLocale).toBe('ko');
    expect(unexpected).toEqual([]);
  });

  test('Open presenter opens a plain tab whose window.opener is null', async ({ page, context }) => {
    await page.setViewportSize({ width: 1180, height: 820 });
    const { unexpected } = await mock(page);
    await context.route(`${APP_URL}/**`, (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>presenter</title><p>presenter</p>' }));
    await page.goto(lecturePath());
    const [popup] = await Promise.all([page.waitForEvent('popup'), page.getByTestId('open-presenter').click()]);
    await popup.waitForLoadState();
    expect(popup.url()).toMatch(/^https:\/\/app\.hangulroute\.com\/present#d=1\./);
    expect(await popup.evaluate(() => window.opener === null)).toBe(true);
    await popup.close();
    expect(unexpected).toEqual([]);
  });

  test('?from=plan opens Next lesson with the plan\'s own lessons and its title', async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 820 });
    const { unexpected } = await mock(page, { plans: [PLAN] });
    await page.goto(lecturePath('class', `&from=plan&plan=${encodeURIComponent(PLAN.id)}`));
    const presets = page.getByTestId('lecture-presets');
    const next = presets.getByRole('button', { name: en.a11y.presenter.presetCard(p.next.title, 20) });
    await expect(next).toHaveAttribute('aria-expanded', 'true');
    await expect(next).toContainText(p.next.plan(PLAN.title));
    await expect(presets.locator('li[data-testid^="lecture-preset-card-"]').first()).toHaveAttribute('data-testid', 'lecture-preset-card-next-lesson');
    await expect(page.getByTestId('lecture-preset-panel-next-lesson').getByTestId('lecture-preset-preview').getByRole('listitem')).toHaveCount(2);
    await page.getByTestId('lecture-customize-toggle').click();
    await expect(page.getByRole('textbox', { name: l.titleField.label })).toHaveValue(PLAN.title);
    await expect(page.getByRole('radio', { name: l.source.plan(PLAN.title, 2) })).toBeChecked();
    await shot(page, 'lv4-lecture-setup-from-plan-1180');
    expect(unexpected).toEqual([]);
  });

  test('a family space reads the family words; 320 with 200 % text has no sideways scroll', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    const { unexpected } = await mock(page, { kind: 'family', learners: [ON_THE_ROUTE] });
    await page.goto(lecturePath('family'));
    // Next lesson follows the family's place on the Learning Route, so it is first and reads the family line.
    await expect(page.getByTestId('lecture-preset-card-next-lesson')).toContainText(p.next.family);
    await expect(page.locator('li[data-testid^="lecture-preset-card-"]').first()).toHaveAttribute('data-testid', 'lecture-preset-card-next-lesson');
    await page.getByTestId('lecture-customize-toggle').click();
    await expect(page.getByRole('heading', { level: 2, name: l.check.titleFamily })).toBeVisible();
    await expect(page.getByRole('button', { name: l.outline.addFamilyCode.cta })).toBeVisible();
    await expect(page.getByText(l.check.title, { exact: true })).toHaveCount(0);
    await expect(page.getByText(l.titleField.hint)).toBeVisible();
    await noSidewaysScroll(page);
    await shot(page, 'lv4-lecture-setup-family-320');
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '200%';
    });
    await noSidewaysScroll(page);
    await shot(page, 'lv4-lecture-setup-family-320-text200');
    expect(unexpected).toEqual([]);
  });

  for (const [width, height] of [
    [1180, 820],
    [320, 640],
  ] as const) {
    test(`at ${width} x ${height} a blocked pop-up answers next to Open presenter, with the page at its top`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.addInitScript(() => {
        window.open = () => null;
      });
      const { unexpected } = await mock(page);
      await page.goto(lecturePath());
      await expect(page.getByTestId('open-presenter')).toBeEnabled();
      await page.evaluate(() => window.scrollTo(0, 0));
      // A press where the button is drawn (a locator click would first scroll the button's place in the page into view).
      const box = await page.getByTestId('open-presenter').boundingBox();
      if (!box) throw new Error('no Open presenter');
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      const status = page.getByTestId('lecture-footer-status');
      await expect(status).toHaveText(l.popupBlocked);
      await expect(status).toHaveAttribute('role', 'status');
      expect(await page.evaluate(() => window.scrollY)).toBe(0);
      await expect(status).toBeInViewport();
      await expect(page.getByTestId('open-presenter')).toBeInViewport();
      await noSidewaysScroll(page);
      if (width === 320) await shot(page, 'lv4-lecture-popup-blocked-320', false);
      expect(unexpected).toEqual([]);
    });
  }

  for (const c of [
    { width: 568, height: 320, text: 100, sticky: true },
    { width: 844, height: 390, text: 100, sticky: true },
    { width: 1280, height: 720, text: 100, sticky: true },
    { width: 1920, height: 1080, text: 100, sticky: true },
    { width: 320, height: 640, text: 150, sticky: null },
    { width: 320, height: 640, text: 200, sticky: false },
  ]) {
    test(`the footer at ${c.width} x ${c.height} with ${c.text} % text covers at most a third of the window or sits at the end; Open presenter in reach`, async ({ page }) => {
      await page.setViewportSize({ width: c.width, height: c.height });
      const { unexpected } = await mock(page);
      await page.goto(lecturePath());
      await expect(page.getByTestId('open-presenter')).toBeEnabled();
      if (c.text !== 100) {
        await page.evaluate((pct) => {
          document.documentElement.style.fontSize = `${pct}%`;
        }, c.text);
      }
      const foot = page.getByTestId('lecture-footer');
      const state = () =>
        foot.evaluate((el) => ({ sticky: getComputedStyle(el).position === 'sticky', share: el.getBoundingClientRect().height / window.innerHeight }));
      await expect.poll(async () => {
        const now = await state();
        return !now.sticky || now.share <= 1 / 3;
      }).toBe(true);
      if (c.sticky !== null) await expect.poll(async () => (await state()).sticky).toBe(c.sticky);
      await noSidewaysScroll(page);
      // Open Customize: the page grows long; the footer keeps the rule, and Open presenter is still in reach.
      await page.getByTestId('lecture-customize-toggle').click();
      await expect(page.getByTestId('lecture-outline')).toBeVisible();
      const after = await state();
      expect(!after.sticky || after.share <= 1 / 3).toBe(true);
      await page.getByTestId('open-presenter').scrollIntoViewIfNeeded();
      await expect(page.getByTestId('open-presenter')).toBeInViewport();
      await noSidewaysScroll(page);
      if (c.width === 568) await shot(page, 'lv4-lecture-footer-568x320', false);
      if (c.text === 200) await shot(page, 'lv4-lecture-footer-320-text200', false);
      expect(unexpected).toEqual([]);
    });
  }

  test('Word review is offered only from 2026-11-01 (the rollout rule, section 4.5)', async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 820 });
    const { unexpected } = await mock(page, { now: '2026-11-01T00:00:01.000Z' });
    await page.goto(lecturePath());
    await expect(page.getByTestId('lecture-preset-card-word-review')).toBeVisible();
    await expect(page.locator('li[data-testid^="lecture-preset-card-"]')).toHaveCount(6);
    expect(unexpected).toEqual([]);
  });

  test('before 2026-11-01 there is no Word review card', async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 820 });
    const { unexpected } = await mock(page, { now: '2026-10-31T23:59:00.000Z' });
    await page.goto(lecturePath());
    await expect(page.getByTestId('lecture-preset-card-hangul-week-1')).toBeVisible();
    await expect(page.getByTestId('lecture-preset-card-word-review')).toHaveCount(0);
    expect(unexpected).toEqual([]);
  });
});
