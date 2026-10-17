import { devices, type Page, type Playwright } from '@playwright/test';
import { en } from '@hangul-route/i18n';
import { expect, test } from './fixtures';
import { onboardChild, onboardSelf, openGrownUpZone, readStored, typeDigits, unlockWithPin, headerBack } from './helpers';
import { shot } from './shots';
import { expectNoHorizontalOverflow } from './viewport';

/**
 * F-REPORT-001 section 5, `mobile/e2e/web/learner-report.spec.ts` (RP-11): the in-app report (section 3.9) on the
 * release build, where RP-11 turned `EXPO_PUBLIC_REPORTS_ENABLED` on by default. Dashboard -> grown-up gate -> report;
 * the period tabs and the stepper; a lapsed grown-up session hands the open report to the PIN screen and comes back
 * (RP-9 review); offline; the second voice on a self-only device; no sideways scroll at 320; the learner's local day
 * in two time zones (assumption c); and `pagehide` on a closed tab (assumption d).
 *
 * The `report.viewed` case needs a build with an API address, so `track` posts (the route below answers it; nothing
 * leaves the machine):
 *
 *   EXPO_PUBLIC_API_BASE_URL=https://api.e2e.invalid pnpm --filter @hangul-route/mobile build:web
 *   E2E_TELEMETRY=1 pnpm --filter @hangul-route/mobile exec playwright test learner-report
 *
 * The WebKit cases need the WebKit browser (`playwright install webkit`) and `E2E_WEBKIT=1`. Without either variable
 * those cases are reported as skipped, not passed.
 */

const r = en.report;
const TELEMETRY_BUILD = process.env.E2E_TELEMETRY === '1';
const WEBKIT = process.env.E2E_WEBKIT === '1';

/** The id of the stored profile called `name`. */
async function profileIdOf(page: Page, name: string): Promise<string> {
  const profiles = await readStored<Array<{ id: string; displayName: string }>>(page, 'profiles');
  const id = profiles?.find((p) => p.displayName === name)?.id;
  if (!id) throw new Error(`no stored profile called ${name}`);
  return id;
}

/**
 * A family device whose learner practiced on two days, yesterday and today, so the report reads as a practicing
 * learner (with one day ever it says "just getting started", section 3.5 item 5). The browser clock starts at noon
 * of the previous calendar day in the browser's own time zone (never "now minus 24 hours", which a 23-hour DST day
 * turns into two days back): the onboarding quest's session falls yesterday; then the clock moves to now and the
 * learner opens Home's new-letters quest, a second session today. Ends on the grown-up dashboard, the PIN entered.
 */
async function familyDashboard(page: Page, name = 'Mina'): Promise<string> {
  const now = Date.now();
  const yesterdayNoon = await page.evaluate(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1, 12).getTime();
  });
  await page.clock.install({ time: new Date(yesterdayNoon) });
  await onboardChild(page, { name });
  const id = await profileIdOf(page, name);
  await page.clock.setSystemTime(new Date(now));
  await page.goto('/');
  await page.getByRole('button', { name: /^Meet a, eo, g, n/ }).click();
  await expect.poll(async () => (await readStored<{ sessions: unknown[] }>(page, `progress:${id}`))?.sessions.length ?? 0).toBe(2);
  await openGrownUpZone(page, name);
  await unlockWithPin(page);
  await expect(page.getByTestId(`dashboard-see-report-${id}`)).toBeVisible();
  return id;
}

/** Whether yesterday falls in this calendar month on the device (the month figures then hold both days). */
function yesterdayThisMonth(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const today = new Date();
    const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1, 12);
    return yesterday.getMonth() === today.getMonth();
  });
}

/** The device's own local day key (YYYY-MM-DD), from the same `Date` getters the app uses; `back` calendar days before today. */
function localToday(page: Page, back = 0): Promise<string> {
  return page.evaluate((days) => {
    const today = new Date();
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - days, 12);
    const pad = (n: number): string => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }, back);
}

/** The calendar marks `day` as practiced: the practiced cell holds the check mark. */
async function expectPracticed(page: Page, day: string): Promise<void> {
  const cell = page.getByTestId(`learner-report-day-${day}`);
  await expect(cell).toBeVisible();
  await expect(cell.locator('svg')).toHaveCount(1);
}

test.describe('the in-app report on a family device', () => {
  test('dashboard -> See report: the title, the week headline, today marked; no sideways scroll at 320, More detail closed or open', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    const id = await familyDashboard(page);
    await page.getByTestId(`dashboard-see-report-${id}`).click();

    await expect(page.getByTestId('learner-report-title')).toHaveText(r.title.learner('Mina'));
    await expect(page.getByTestId('learner-report-headline')).toHaveText(r.headline.practiced('Mina', 2, r.when.week));
    await expect(page.getByRole('tab', { name: r.period.week })).toHaveAttribute('aria-selected', 'true');
    await expectPracticed(page, await localToday(page));
    await expectNoHorizontalOverflow(page, 'report at 320');
    await shot(page, 'learner-report-week-320');

    const toggle = page.getByTestId('learner-report-more-detail-toggle');
    await toggle.scrollIntoViewIfNeeded();
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expectNoHorizontalOverflow(page, 'report at 320 with More detail open');
    await shot(page, 'learner-report-more-detail-320');

    await headerBack(page).click();
    await expect(page.getByTestId(`dashboard-see-report-${id}`)).toBeVisible();
  });

  test('period tabs and the stepper: each tab its own headline; a step back and forward, focus kept on a step button', async ({ page }) => {
    const id = await familyDashboard(page);
    await page.getByTestId(`dashboard-see-report-${id}`).click();
    const headline = page.getByTestId('learner-report-headline');
    await expect(headline).toHaveText(r.headline.practiced('Mina', 2, r.when.week));

    await page.getByRole('tab', { name: r.period.day }).click();
    await expect(page.getByRole('tab', { name: r.period.day })).toHaveAttribute('aria-selected', 'true');
    await expect(headline).toHaveText(r.headline.practicedOn('Mina', r.when.day));
    // The first step back from today is yesterday, the onboarding day.
    await page.getByTestId('learner-report-step-prev').click();
    await expect(headline).toHaveText(r.headline.practicedOn('Mina', r.when.prevDay));

    await page.getByRole('tab', { name: r.period.month }).click();
    await expect(headline).toHaveText(r.headline.practiced('Mina', (await yesterdayThisMonth(page)) ? 2 : 1, r.when.month));
    await page.getByRole('tab', { name: r.period.all }).click();
    await expect(headline).toHaveText(r.headline.practiced('Mina', 2, r.when.all));
    // All time has no stepper.
    await expect(page.getByTestId('learner-report-step-prev')).toHaveCount(0);

    await page.getByRole('tab', { name: r.period.week }).click();
    await expect(headline).toHaveText(r.headline.practiced('Mina', 2, r.when.week));
    // Next is hidden on the current window; the first step back is named.
    await expect(page.getByTestId('learner-report-step-next')).toHaveCount(0);
    const prev = page.getByTestId('learner-report-step-prev');
    await expect(prev).toContainText(r.step.prevWeek);
    await prev.click();
    await expect(headline).toHaveText(r.headline.noneThen(r.when.prevWeek));
    const next = page.getByTestId('learner-report-step-next');
    await expect(next).toBeVisible();
    await next.click();
    await expect(headline).toHaveText(r.headline.practiced('Mina', 2, r.when.week));
    // Next left with the step back to this week: focus moved to Previous, never to the page body.
    await expect(page.getByTestId('learner-report-step-next')).toHaveCount(0);
    await expect(prev).toBeFocused();
    await shot(page, 'learner-report-week-stepped-back-and-forward');
  });

  test('a lapsed grown-up session: the open report hands over to the PIN screen, which comes back to the report', async ({ page }) => {
    const id = await familyDashboard(page);
    await page.getByTestId(`dashboard-see-report-${id}`).click();
    await expect(page.getByTestId('learner-report-title')).toHaveText(r.title.learner('Mina'));

    // The grown-up session lasts 15 minutes (logic/profiles/session.ts).
    await page.clock.fastForward('15:01');
    await expect(page.getByText('Enter your 4-digit PIN to continue.')).toBeVisible();
    await expect(page.getByTestId('learner-report-title')).toHaveCount(0);
    await typeDigits(page);
    await page.getByRole('button', { name: 'Unlock' }).click();
    await expect(page.getByTestId('learner-report-title')).toHaveText(r.title.learner('Mina'));
    await expect(page.getByTestId('learner-report-headline')).toHaveText(r.headline.practiced('Mina', 2, r.when.week));
  });

  test('offline: the report opens from the device alone, through the gate', async ({ page, context }) => {
    await onboardChild(page, { name: 'Mina' });
    const id = await profileIdOf(page, 'Mina');
    await page.goto('/');
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    await context.setOffline(true);
    try {
      await openGrownUpZone(page, 'Mina');
      await unlockWithPin(page);
      await page.getByTestId(`dashboard-see-report-${id}`).click();
      // One practice day ever (the onboarding quest): the getting-started headline.
      await expect(page.getByTestId('learner-report-headline')).toHaveText(r.headline.gettingStarted('Mina'));
      await expectPracticed(page, await localToday(page));
      await expect(page.getByTestId('learner-report-error')).toHaveCount(0);
    } finally {
      await context.setOffline(false);
    }
  });

  test("Open Learning Route (L1, on since R-10b): the grown-up's read-only page of this learner, then back to the report", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    const id = await familyDashboard(page);
    await page.getByTestId(`dashboard-see-report-${id}`).click();
    await expect(page.getByTestId('learner-report-title')).toHaveText(r.title.learner('Mina'));

    const open = page.getByTestId('learner-report-open-route');
    await expect(open).toHaveAccessibleName(r.glance.openRoute);
    await open.click();

    // The root-stack page in the grown-up viewer: this learner's name, Go back, no learner purpose line and no
    // Continue or Start on the card (amendment section 5.1).
    const screen = page.getByTestId('my-route-screen');
    await expect(screen).toBeVisible();
    await expect(screen.getByText(en.caregiver.journey.viewing('Mina'), { exact: true })).toBeVisible();
    await expect(headerBack(page)).toBeVisible();
    await expect(page.getByText(en.learner.myRoute.purpose, { exact: true })).toHaveCount(0);
    await expect(page.getByTestId('my-route-card-cta')).toHaveCount(0);
    await expect(page.getByTestId('my-route-card').getByRole('button')).toHaveCount(0);
    await expectNoHorizontalOverflow(page, 'grown-up Learning Route from the report');
    await shot(page, 'learner-report-open-route-375');

    await headerBack(page).click();
    await expect(page.getByTestId('learner-report-title')).toHaveText(r.title.learner('Mina'));
  });
});

test.describe('the in-app report on a self-only device', () => {
  test('opens without a PIN and speaks in the second voice', async ({ page }) => {
    await onboardSelf(page, { name: 'Sam' });
    const id = await profileIdOf(page, 'Sam');
    await page.goto('/');
    await expect(page.getByText('Hi, Sam!')).toBeVisible();
    const guide = page.getByTestId('install-guide');
    await guide.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
    if (await guide.isVisible()) await guide.getByRole('button', { name: 'Not now' }).click();
    await page.getByRole('button', { name: 'Profile and settings' }).click();
    await page.getByRole('button', { name: /^Account & backup/ }).click();
    await page.getByTestId(`dashboard-see-report-${id}`).click();

    await expect(page.getByTestId('learner-report-title')).toHaveText(r.you.title);
    // One practice day ever (the onboarding quest): the getting-started headline, in the second voice.
    await expect(page.getByTestId('learner-report-headline')).toHaveText(r.you.headline.gettingStarted);
    // The screens under it in the stack stay mounted but hidden; nothing on the report itself names Sam.
    await expect(page.getByText(/\bSam\b/).filter({ visible: true })).toHaveCount(0);
    await shot(page, 'learner-report-self');
  });
});

test.describe('report.viewed from the app (section 3.13)', () => {
  test('one event per open and per period change: codes only, no profileId', async ({ page }) => {
    test.skip(!TELEMETRY_BUILD, 'report.viewed not asserted: needs E2E_TELEMETRY=1 on a build with EXPO_PUBLIC_API_BASE_URL');
    const viewed: Array<Record<string, unknown>> = [];
    await page.route('**/api/telemetry', async (route) => {
      const body = route.request().postDataJSON() as Record<string, unknown> | null;
      if (body?.name === 'report.viewed') viewed.push(body);
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    });
    const id = await familyDashboard(page);
    await page.getByTestId(`dashboard-see-report-${id}`).click();
    await expect(page.getByTestId('learner-report-headline')).toBeVisible();
    await expect.poll(() => viewed.length).toBe(1);

    await page.getByRole('tab', { name: r.period.month }).click();
    await expect.poll(() => viewed.length).toBe(2);
    // Nothing more arrives for the same choice (a re-render is not a view).
    await page.waitForTimeout(1500);
    expect(viewed).toHaveLength(2);
    expect(viewed.map((e) => e.payload)).toEqual([
      { scope: 'learner', space: 'device', period: 'week' },
      { scope: 'learner', space: 'device', period: 'month' },
    ]);
    for (const event of viewed) expect(Object.keys(event).sort()).toEqual(['at', 'name', 'payload']);
    expect(JSON.stringify(viewed)).not.toContain(id);
  });
});

/** Assumption c (section 9): the device's local day is the learner's calendar day, far east and far west of UTC. */
for (const timezoneId of ['Pacific/Kiritimati', 'Pacific/Pago_Pago'] as const) {
  test.describe(`the learner's local day in ${timezoneId}`, () => {
    test.use({ timezoneId });

    test('today on the report is the device\'s local day', async ({ page }) => {
      const id = await familyDashboard(page);
      await page.getByTestId(`dashboard-see-report-${id}`).click();
      await expectPracticed(page, await localToday(page));
      await expectPracticed(page, await localToday(page, 1));
      await page.getByRole('tab', { name: r.period.day }).click();
      await expect(page.getByTestId('learner-report-headline')).toHaveText(r.headline.practicedOn('Mina', r.when.day));
    });
  });
}

/**
 * Assumption d (section 9): `pagehide` and `visibilitychange` fire on the PWA's close paths, so an open practice
 * session can end (`platform/app-visibility.web.ts`). Recorded synchronously in `localStorage` by an init script, so
 * the record survives the page that left and a later page of the same browser context reads it. Chromium fires both
 * when the tab closes and when the page is left. WebKit fires both when the page is left; a tab closed by the
 * automation fires neither unless the page has a `beforeunload` handler (the app has none, which keeps the page
 * eligible for the back-forward cache), so in Safari a closed tab's session end stays best effort, as
 * `app-visibility.web.ts` documents: the session is never joined again and its day still counts.
 */
/**
 * Reads the lifecycle record from a fresh page of the context, which has no recorder: the recorder is a page-scoped
 * init script, so reloading the reader can never write the events it looks for. Polls with a reload of the reader
 * only, since WebKit hands another page's write over a moment later.
 */
async function readLifecycle(page: Page): Promise<string[]> {
  const reader = await page.context().newPage();
  await reader.goto('/');
  const read = async (): Promise<string[]> => {
    const raw = await reader.evaluate(() => localStorage.getItem('e2e:lifecycle'));
    return raw === null ? [] : (JSON.parse(raw) as string[]);
  };
  await expect
    .poll(async () => {
      const seen = await read();
      if (!seen.includes('pagehide')) await reader.reload();
      return seen;
    })
    .toEqual(expect.arrayContaining(['pagehide', 'visibility:hidden']));
  const seen = await read();
  await reader.close();
  return seen;
}

/** Closes the app's tab, then reads the record from a fresh page. */
async function closeTabAndReadLifecycle(page: Page): Promise<string[]> {
  const context = page.context();
  const keep = await context.newPage();
  await page.close({ runBeforeUnload: true });
  const seen = await readLifecycle(keep);
  await keep.close();
  return seen;
}

/** Leaves the app for another page (a link out, the address bar), then reads the record from a fresh page. */
async function leaveAndReadLifecycle(page: Page): Promise<string[]> {
  await page.goto('about:blank');
  return readLifecycle(page);
}

async function recordLifecycle(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const note = (what: string): void => {
      const seen = JSON.parse(localStorage.getItem('e2e:lifecycle') ?? '[]') as string[];
      seen.push(what);
      localStorage.setItem('e2e:lifecycle', JSON.stringify(seen));
    };
    window.addEventListener('pagehide', () => note('pagehide'));
    document.addEventListener('visibilitychange', () => note(`visibility:${document.visibilityState}`));
  });
}

test.describe('the close paths on Chromium (assumption d)', () => {
  test('closing the tab on the first-quest preview fires pagehide and visibilitychange to hidden', async ({ page }) => {
    await recordLifecycle(page);
    await onboardChild(page, { name: 'Mina' });
    expect(await closeTabAndReadLifecycle(page)).toEqual(expect.arrayContaining(['pagehide', 'visibility:hidden']));
  });

  test('leaving the app on the first-quest preview fires pagehide and visibilitychange to hidden', async ({ page }) => {
    await recordLifecycle(page);
    await onboardChild(page, { name: 'Mina' });
    expect(await leaveAndReadLifecycle(page)).toEqual(expect.arrayContaining(['pagehide', 'visibility:hidden']));
  });
});

/**
 * WebKit runs in its own browser, launched here: the project's device is a Chromium phone. A silent speech engine
 * stands in, as `fixtures.ts` does for Chromium, so a quest never speaks on the machine running the suite.
 */
async function withWebkit(playwright: Playwright, baseURL: string | undefined, run: (page: Page) => Promise<void>): Promise<void> {
  const browser = await playwright.webkit.launch();
  try {
    const context = await browser.newContext({ ...devices['iPhone 13'], baseURL, locale: 'en-US' });
    await context.addInitScript(() => {
      Object.defineProperty(window, 'speechSynthesis', {
        configurable: true,
        value: { speaking: false, pending: false, speak: () => undefined, cancel: () => undefined, getVoices: () => [], addEventListener: () => undefined, removeEventListener: () => undefined },
      });
    });
    await run(await context.newPage());
  } finally {
    await browser.close();
  }
}

test.describe('WebKit (assumption d and the report)', () => {
  test.skip(!WEBKIT, 'needs E2E_WEBKIT=1 and the WebKit browser');

  test('leaving the app on the first-quest preview fires pagehide and visibilitychange to hidden', async ({ playwright, baseURL }) => {
    await withWebkit(playwright, baseURL, async (page) => {
      await recordLifecycle(page);
      await onboardChild(page, { name: 'Mina' });
      expect(await leaveAndReadLifecycle(page)).toEqual(expect.arrayContaining(['pagehide', 'visibility:hidden']));
    });
  });

  test('the report opens through the gate, today marked, no sideways scroll at 320', async ({ playwright, baseURL }) => {
    await withWebkit(playwright, baseURL, async (page) => {
      await page.setViewportSize({ width: 320, height: 568 });
      const id = await familyDashboard(page);
      await page.getByTestId(`dashboard-see-report-${id}`).click();
      await expect(page.getByTestId('learner-report-headline')).toHaveText(r.headline.practiced('Mina', 2, r.when.week));
      await expectPracticed(page, await localToday(page));
      await expectNoHorizontalOverflow(page, 'report at 320 on WebKit');
      await shot(page, 'learner-report-webkit-320');
    });
  });
});
