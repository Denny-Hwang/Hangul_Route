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

/**
 * Row LV-5 (AMENDMENTS-LECTURE-V2 section 3, E1 to E4; mock `design/screens/app-shell/lecture-card.md`): the Lecture
 * mode card on the teacher home and the family home, the nav item of both personas, and the space page's button. The
 * same lecture-on export; `HR_SHOTS=1` writes the `lv5-*` shots.
 */
interface HomeSpace {
  space: { id: string; kind: 'class' | 'family' | 'school'; name: string; parentSpaceId: null; settings: { consentMode: string; anonymizeRoster: boolean }; archivedAt: null; createdAt: string };
  role: string;
}

const homeSpace = (id: string, kind: HomeSpace['space']['kind'], name: string, createdAt: string, role: string): HomeSpace => ({
  space: { id, kind, name, parentSpaceId: null, settings: { consentMode: 'parent', anonymizeRoster: false }, archivedAt: null, createdAt },
  role,
});

const learner = (id: string, displayName: string, joinedAt: string) => ({
  id,
  displayName,
  avatar: 'hoya-orange',
  ageGroup: 'starter',
  joinedAt,
  lastActiveAt: NOW,
  lastSyncedAt: NOW,
  summary: null,
});

const SUNFLOWER = homeSpace('space:sunflower', 'class', 'Sunflower', '2026-09-01T00:00:00.000Z', 'teacher');
const SATURDAY = homeSpace('space:saturday', 'class', 'Saturday class', '2026-10-05T00:00:00.000Z', 'owner');
const PARKS = homeSpace('space:parks', 'family', 'The Parks', '2026-09-01T00:00:00.000Z', 'owner');
const GRANDMA = homeSpace('space:grandma', 'family', "Grandma's house", '2026-10-02T00:00:00.000Z', 'caregiver');

/** The homes' reads on a mocked API: the spaces list, each family's roster (two learners) and empty plans; anything else answers 404. */
async function mockHome(page: Page, spaces: HomeSpace[]): Promise<void> {
  await page.clock.setFixedTime(new Date(NOW));
  await page.addInitScript(([key]) => window.sessionStorage.setItem(key as string, JSON.stringify({ token: 'acct-e2e', accountId: 'acct-e2e', displayName: 'Ms Kim' })), [SESSION_KEY]);
  await page.route(`${API}/**`, async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    const url = new URL(request.url());
    if (url.pathname === '/api/spaces') {
      return json(route, 200, { spaces: spaces.map((s) => ({ ...s, counts: { learners: 2, accounts: 1, classes: 0 }, joinCode: null, joinCodeExpiresAt: null })) });
    }
    const rosterOf = spaces.find((s) => url.pathname === `/api/spaces/${encodeURIComponent(s.space.id)}/roster`);
    if (rosterOf) {
      return json(route, 200, {
        space: rosterOf.space,
        learners: [learner('profile:mina', 'Mina', '2026-09-02T00:00:00.000Z'), learner('profile:jun', 'Jun', '2026-09-03T00:00:00.000Z')],
        joinCode: null,
        joinCodeExpiresAt: null,
      });
    }
    if (/\/plans$/.test(url.pathname)) return json(route, 200, { plans: [] });
    if (url.pathname === '/api/entitlements') return json(route, 200, { entitlements: [] });
    return json(route, 404, null);
  });
}

test.describe('the Lecture mode card, nav item and space button (LV-5)', () => {
  test.skip(!LECTURE, 'needs the console e2e export with lecture mode on (LECTURE_E2E=1)');
  const card = l.card;

  for (const width of [320, 1280]) {
    test(`teacher home at ${width}: the card first, above Classes; one class opens its setup page; the nav item after Lessons`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await mockHome(page, [SUNFLOWER]);
      await page.goto('/teach/home');
      const lecture = page.getByTestId('lecture-card');
      await expect(lecture.getByRole('heading', { level: 2, name: card.title })).toBeVisible();
      await expect(lecture).toContainText(card.tagline);
      await expect(lecture).toContainText(card.bodyClass);
      // The page heading (h1, the nav name, visually hidden) comes before the card; the visible Classes heading is an h2 below it.
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(en.console.shell.nav.classes);
      const h1First = await page.evaluate(() => {
        const all = Array.from(document.querySelectorAll('main h1, main h2'));
        return all[0]?.tagName ?? '';
      });
      expect(h1First).toBe('H1');
      const classes = page.getByRole('heading', { level: 2, name: en.console.kind.group.class });
      expect((await lecture.boundingBox())?.y ?? Infinity).toBeLessThan((await classes.boundingBox())?.y ?? 0);
      const start = lecture.getByRole('link', { name: card.cta });
      await expect(start).toHaveAttribute('href', `/teach/space/lecture?id=${encodeURIComponent(SUNFLOWER.space.id)}`);
      const startBox = await start.boundingBox();
      expect(startBox?.height ?? 0).toBeGreaterThanOrEqual(96);
      const nav = page.getByTestId('frame-nav');
      // Lessons needs the app origin (F-BROWSE-001 section 4.3), so this localhost export draws the row without it.
      await expect(nav.getByRole('link')).toHaveText([en.console.shell.nav.classes, en.console.shell.nav.classReports, en.console.shell.nav.notes, en.console.shell.nav.lecture, en.console.shell.nav.billing]);
      await expect(nav.getByTestId('nav-lecture')).toHaveAttribute('href', `/teach/space/lecture?id=${encodeURIComponent(SUNFLOWER.space.id)}`);
      await noSidewaysScroll(page);
      await shot(page, `lv5-teacher-home-${width}`);
      await start.click();
      await expect(page).toHaveURL(/\/teach\/space\/lecture\?id=space%3Asunflower/);
      await expect(page.getByTestId('lecture-presets')).toBeVisible();
      await expect(page.getByTestId('nav-lecture')).toHaveAttribute('aria-current', 'page');
      // The tab row shows its current item whole.
      const item = await page.getByTestId('nav-lecture').boundingBox();
      expect((item?.x ?? -1) >= 0 && (item?.x ?? 0) + (item?.width ?? Infinity) <= width).toBe(true);
    });
  }

  test('teacher home, several classes: "Which class?" most recent first; Start follows the choice; the nav item lands on the card with focus', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await mockHome(page, [SUNFLOWER, SATURDAY, homeSpace('space:riverside', 'school', 'Riverside', '2026-10-09T00:00:00.000Z', 'admin')]);
    await page.goto(`/teach/space/plan?id=${encodeURIComponent(SUNFLOWER.space.id)}`);
    await expect(page.getByTestId('nav-lecture')).toHaveAttribute('href', '/teach/home#lecture-mode');
    await page.getByTestId('nav-lecture').click();
    const lecture = page.getByTestId('lecture-card');
    await expect(lecture.getByRole('heading', { level: 2, name: card.title })).toBeFocused();
    await expect(lecture).toBeInViewport();
    // The arrival is answered once: the fragment leaves the address, so a later redraw never takes focus again.
    await expect(page).toHaveURL(/\/teach\/home$/);
    const group = lecture.getByRole('group', { name: card.chooseClass });
    await expect(group.getByRole('radio')).toHaveCount(2);
    await expect(group.getByRole('radio', { name: 'Saturday class' })).toBeChecked();
    await expect(lecture.locator('label')).toHaveText(['Saturday class', 'Sunflower']);
    await expect(lecture.getByRole('link', { name: card.cta })).toHaveAttribute('href', `/teach/space/lecture?id=${encodeURIComponent(SATURDAY.space.id)}`);
    await group.getByRole('radio', { name: 'Sunflower' }).check();
    await expect(lecture.getByRole('link', { name: card.cta })).toHaveAttribute('href', `/teach/space/lecture?id=${encodeURIComponent(SUNFLOWER.space.id)}`);
    await noSidewaysScroll(page);
    await shot(page, 'lv5-teacher-home-several-375');
    // On the home itself the nav item moves to the card again.
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.getByTestId('nav-lecture').click();
    await expect(lecture.getByRole('heading', { level: 2, name: card.title })).toBeFocused();
    await expect(lecture).toBeInViewport();
  });

  test('a school admin with no class role: the no-space line, and Start opens the presenter in a tab with no opener', async ({ page, context }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await mockHome(page, [homeSpace('space:riverside', 'school', 'Riverside', '2026-10-09T00:00:00.000Z', 'admin'), homeSpace('space:child', 'class', 'Child class', '2026-10-01T00:00:00.000Z', 'admin')]);
    await context.route(`${APP_URL}/**`, (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>presenter</title>' }));
    await page.goto('/teach/home');
    const lecture = page.getByTestId('lecture-card');
    await expect(lecture).toContainText(card.noSpace);
    const start = lecture.getByRole('link', { name: card.cta });
    await expect(start).toHaveAccessibleDescription(card.opensTab);
    await expect(start).toHaveAttribute('target', '_blank');
    await expect(page.getByTestId('nav-lecture')).toHaveAttribute('href', '/teach/home#lecture-mode');
    const [popup] = await Promise.all([page.waitForEvent('popup'), start.click()]);
    await popup.waitForLoadState();
    expect(popup.url()).toBe(`${APP_URL}/present`);
    expect(await popup.evaluate(() => window.opener === null)).toBe(true);
    await popup.close();
  });

  test('family home at 375 x 667: the card after the first learner card, both in the first screen; the family words', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await mockHome(page, [PARKS]);
    await page.goto('/parent');
    const lecture = page.getByTestId('lecture-card');
    await expect(lecture).toContainText(card.bodyFamily);
    await expect(lecture).not.toContainText(card.bodyClass);
    await expect(lecture.getByRole('link', { name: card.cta })).toHaveAttribute('href', `/parent/space/lecture?id=${encodeURIComponent(PARKS.space.id)}`);
    const cards = page.getByTestId('learner-card');
    await expect(cards).toHaveCount(2);
    const first = await cards.nth(0).boundingBox();
    const second = await cards.nth(1).boundingBox();
    const box = await lecture.boundingBox();
    // The whole first learner card and the top of the Lecture mode card are on the first screen.
    expect((first?.y ?? Infinity) + (first?.height ?? 0)).toBeLessThanOrEqual(667);
    expect(box?.y ?? Infinity).toBeLessThan(667);
    expect(box?.y ?? 0).toBeGreaterThan((first?.y ?? 0) + (first?.height ?? 0) - 1);
    expect(second?.y ?? 0).toBeGreaterThan((box?.y ?? 0) + (box?.height ?? 0) - 1);
    const nav = page.getByTestId('frame-nav');
    // Lessons needs the app origin (F-BROWSE-001 section 4.3), so this localhost export draws the row without it.
    await expect(nav.getByRole('link')).toHaveText([en.console.shell.nav.home, en.console.shell.nav.reports, en.console.shell.nav.notes, en.console.shell.nav.lecture, en.console.shell.nav.billing]);
    // Every item of the row is on the screen (the row wraps instead of hiding its last items).
    for (const box of await nav.getByRole('link').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().right))) expect(box).toBeLessThanOrEqual(375);
    await noSidewaysScroll(page);
    await shot(page, 'lv5-parent-home-375-first', false);
    await shot(page, 'lv5-parent-home-375');
  });

  test('family home at 768: the card takes the row after the first row of learner cards, and comes after them in the reading and focus order', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 900 });
    await mockHome(page, [PARKS]);
    await page.goto('/parent');
    const lecture = page.getByTestId('lecture-card');
    await expect(lecture).toBeVisible();
    const cards = page.getByTestId('learner-card');
    const first = await cards.nth(0).boundingBox();
    const second = await cards.nth(1).boundingBox();
    const box = await lecture.boundingBox();
    expect(Math.abs((first?.y ?? 0) - (second?.y ?? 1))).toBeLessThan(1);
    expect(box?.y ?? 0).toBeGreaterThan((first?.y ?? 0) + (first?.height ?? 0) - 1);
    // The page order is the screen order (WCAG 1.3.2, 2.4.3): both learner cards, then the Lecture mode card.
    const order = await page.evaluate(() => Array.from(document.querySelectorAll('[data-testid="learner-card"], [data-testid="lecture-card"]')).map((el) => el.getAttribute('data-testid')));
    expect(order).toEqual(['learner-card', 'learner-card', 'lecture-card']);
    // Tab from the first learner card's last control: the second learner card comes before Start.
    const firstLinks = cards.nth(0).getByRole('link');
    await firstLinks.last().focus();
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('[data-testid="learner-card"]') && !document.activeElement?.closest('[data-testid="lecture-card"]'))).toBe(true);
    const insideSecond = await cards.nth(1).evaluate((el) => el.contains(document.activeElement));
    expect(insideSecond).toBe(true);
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await noSidewaysScroll(page);
    await shot(page, 'lv5-parent-home-768');
  });

  test('family home at 1280, several families: the card first in the side column of the first family, "Which family?" in the home\'s order with that family chosen', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await mockHome(page, [PARKS, GRANDMA]);
    await page.goto('/parent');
    const lecture = page.getByTestId('lecture-card');
    await expect(lecture.getByRole('group', { name: card.chooseFamily }).getByRole('radio')).toHaveCount(2);
    await expect(lecture.locator('label')).toHaveText(['The Parks', "Grandma's house"]);
    await expect(lecture.getByRole('radio', { name: 'The Parks' })).toBeChecked();
    // The card sits in The Parks' section, the first on the home, and Start opens that family at first.
    await expect(page.locator('section.hr-ph-family').first().getByTestId('lecture-card')).toHaveCount(1);
    await expect(lecture.getByRole('link', { name: card.cta })).toHaveAttribute('href', `/parent/space/lecture?id=${encodeURIComponent(PARKS.space.id)}`);
    await expect(page.getByTestId('lecture-card')).toHaveCount(1);
    const box = await lecture.boundingBox();
    const learnerBox = await page.getByTestId('learner-card').first().boundingBox();
    const actions = await page.getByTestId('family-plan-week').first().boundingBox();
    expect(box?.x ?? 0).toBeGreaterThan((learnerBox?.x ?? 0) + (learnerBox?.width ?? 0));
    expect(box?.y ?? Infinity).toBeLessThan(actions?.y ?? 0);
    // The card sits outside the family actions' landmark.
    expect(await lecture.evaluate((el) => el.closest('aside') === null)).toBe(true);
    await expect(page.getByTestId('nav-lecture')).toHaveAttribute('href', '/parent#lecture-mode');
    await noSidewaysScroll(page);
    await shot(page, 'lv5-parent-home-1280');
  });

  test('320 with 200 % text: the homes and the card do not scroll sideways', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await mockHome(page, [PARKS, GRANDMA, SUNFLOWER, SATURDAY]);
    for (const path of ['/parent', '/teach/home']) {
      await page.goto(path);
      await expect(page.getByTestId('lecture-card').getByRole('group')).toBeVisible();
      await page.evaluate(() => {
        document.documentElement.style.fontSize = '200%';
      });
      await noSidewaysScroll(page);
      await shot(page, `lv5-${path === '/parent' ? 'parent' : 'teacher'}-home-320-text200`);
    }
  });

  // The review bar's windows (landscape phones, 1280 x 720, 1920 x 1080) and 150 % text, for both homes.
  const WINDOWS: { width: number; height: number; text?: string }[] = [
    { width: 568, height: 320 },
    { width: 844, height: 390 },
    { width: 1280, height: 720 },
    { width: 1920, height: 1080 },
    { width: 320, height: 640, text: '150%' },
  ];
  for (const win of WINDOWS) {
    test(`homes at ${win.width} x ${win.height}${win.text ? ` with ${win.text} text` : ''}: no sideways scroll, Start reachable, the nav item lands on the card`, async ({ page }) => {
      await page.setViewportSize({ width: win.width, height: win.height });
      await mockHome(page, [PARKS, GRANDMA, SUNFLOWER, SATURDAY]);
      for (const path of ['/parent', '/teach/home']) {
        await page.goto(path);
        const lecture = page.getByTestId('lecture-card');
        await expect(lecture.getByRole('group')).toBeVisible();
        if (win.text) {
          await page.evaluate((size) => {
            document.documentElement.style.fontSize = size;
          }, win.text);
        }
        await noSidewaysScroll(page);
        const start = lecture.getByRole('link', { name: card.cta });
        await start.scrollIntoViewIfNeeded();
        await expect(start).toBeInViewport();
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        await page.getByTestId('nav-lecture').click();
        await expect(lecture.getByRole('heading', { level: 2, name: card.title })).toBeFocused();
        await expect(lecture).toBeInViewport();
      }
    });
  }

  test('the space page: the button keeps its place and secondary weight and reads Lecture mode (E4)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await mock(page);
    await page.goto(`/teach/space?id=${encodeURIComponent(space('class').id)}`);
    const button = page.getByTestId('open-lecture');
    await expect(button).toHaveText(l.entry.cta);
    const look = await button.evaluate((el) => getComputedStyle(el).backgroundColor);
    const primary = await page.getByRole('button', { name: en.console.planThisWeek }).evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(look).not.toBe(primary);
  });
});
