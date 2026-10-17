import type { Page } from '@playwright/test';
import { getMessages } from '@hangul-route/i18n';
import { expect, test } from './fixtures';
import { completeChildForm, completeSelfForm, readStored, unlockWithPin, waitForSaved, passPlacementLanguage, headerClose } from './helpers';
import { shot } from './shots';
import { controlsPastEdge, expectNoHorizontalOverflow } from './viewport';

/**
 * F-PLC-001 P-10 (section 5, the `placement.spec.ts` row; sections 3.1, 3.10, 3.11, 3.12): the level check
 * end to end through its real entries, with `flags.placementEnabled` on by default (the beta flip). The release
 * build runs it (no e2e hook: every screen is reached the way a learner reaches it):
 *
 *   pnpm --filter @hangul-route/mobile build:web
 *   pnpm --filter @hangul-route/mobile exec playwright test e2e/web/placement.spec
 *
 * - the onboarding fork -> the options -> a Standard, Short or Deep check -> the result with the weekly-plan strip
 *   -> **Use this plan** with one tap and no PIN for a self profile (OD-14, confirmed by the owner 2026-10-14), on a
 *   self-only device and on a device with a PIN -> the Learning Route shows the plan;
 * - a child profile gets no strip: **For grown-ups: set up a weekly plan** asks for the PIN first;
 * - the Home card and the Profile row; a check taken offline; every screen at 320 x 568.
 *
 * The test-language screen shows only when more than one UI locale ships, so its case runs on the weekly plan
 * bundle, which shows every locale (`build:web:route`, `E2E_ROUTE=1`).
 *
 * Speech is the silent engine of ./fixtures (no voices: Standard and Deep run without sound) unless a test
 * installs `voicedSpeech`, a fake with a Korean and an English voice whose utterances end at once (Short needs sound).
 */

const RELEASE = process.env.STORY_FIXTURES !== '1' && process.env.STORY_FIXTURES_GATED !== '1' && process.env.E2E_ROUTE !== '1';
const ROUTE = process.env.E2E_ROUTE === '1';
const en = getMessages('en');
const t = en.learner.placement;
/** The PIN screen's line: on screen only while the grown-up gate asks for the PIN. */
const PIN_LINE = en.caregiver.pin.entry.verifySubtitle;
const START = en.learner.welcome.cta;
const hi = (name: string): string => en.learner.home.greeting(name);
const EMOJI = /\p{Extended_Pictographic}/u;
/** Never on a learner screen of the check: a score shape, a product or price word, shame words. */
const NEVER = /%|\d\s*\/\s*\d|\bscore\b|\bpassed\b|\bfailed\b|\blevel \d|premium|\$|\bprice\b|\bbehind\b|\bmissed\b/i;

const screenText = (page: Page): Promise<string> => page.evaluate(() => document.body.innerText);

async function voicedSpeech(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const v = (name: string, lang: string, isDefault = false) => ({ name, lang, voiceURI: name, localService: true, default: isDefault });
    const voices = [v('Yuna', 'ko-KR'), v('Samantha', 'en-US', true)];
    class Utterance {
      lang = '';
      rate = 1;
      pitch = 1;
      volume = 1;
      voice: { name: string } | null = null;
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      onerror: ((ev: { error: string }) => void) | null = null;
      constructor(public text: string) {}
    }
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: Utterance });
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        speaking: false,
        pending: false,
        speak: (u: Utterance) => {
          setTimeout(() => {
            u.onstart?.();
            u.onend?.();
          }, 0);
        },
        cancel: () => undefined,
        getVoices: () => voices,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      },
    });
  });
}

/** The install guide shows from the third cached open and covers Home. */
async function closeInstallGuide(page: Page): Promise<void> {
  const guide = page.getByTestId('install-guide');
  await guide.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
  if (await guide.isVisible()) await guide.getByRole('button', { name: en.caregiver.install.notNow.cta, exact: true }).click();
}

/** Cold start through "Me" to the fork (no PIN on the device). */
async function selfToFork(page: Page, name: string, readingLevel?: string): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: START }).click();
  await completeSelfForm(page, { name, levelCheck: 'stop', ...(readingLevel ? { readingLevel } : {}) });
}

async function activeProfileId(page: Page): Promise<string> {
  await waitForSaved(page, ['profiles:active']);
  return (await readStored<string>(page, 'profiles:active')) ?? '';
}

/** Every visible control inside the window, nothing wider than it, no emoji and no score or shame word. */
async function fits(page: Page, name: string): Promise<void> {
  await expectNoHorizontalOverflow(page, `${name}: horizontal overflow`);
  expect(await page.evaluate(controlsPastEdge), `${name}: controls past the edge`).toEqual([]);
  const text = await screenText(page);
  expect(text, `${name}: an emoji`).not.toMatch(EMOJI);
  expect(text, `${name}: a score, product or shame word`).not.toMatch(NEVER);
}

/**
 * From the options screen to the result without sound (Standard or Deep): the sound-guide choice, the warm-up note,
 * one answer, then the exit's "That is enough". `check` runs on each screen on the way.
 */
async function runWithoutSound(
  page: Page,
  mode: 'standard' | 'deep',
  check?: (name: string) => Promise<void>,
  testLocale: 'en' | 'es' | 'ko' = 'en',
): Promise<void> {
  // The check speaks and writes in its test language (section 3.1 step 2).
  const labels = getMessages(testLocale).learner.placement.options.mode;
  await passPlacementLanguage(page);
  await expect(page.getByTestId('placement-options')).toBeVisible();
  if (mode === 'deep') await page.getByRole('radio', { name: labels.deep.label, exact: true }).click();
  await expect(page.getByRole('radio', { name: labels[mode].label, exact: true })).toHaveAttribute('aria-checked', 'true');
  await page.getByTestId('placement-guide-tap').click();
  await check?.('options');
  await page.getByTestId('placement-next').click();
  await expect(page.getByTestId('placement-warmup')).toBeVisible();
  await page.getByTestId('placement-warmup-speaker').click();
  await expect(page.getByTestId('placement-no-sound-note')).toBeVisible();
  await check?.('warmup');
  await page.getByTestId('placement-warmup-option-rice').click();
  await expect(page.getByTestId('placement-item')).toBeVisible();
  await check?.('item');
  await page.locator('[data-testid^="placement-option-"]').first().click();
  await headerClose(page).click();
  await expect(page.getByTestId('placement-pause')).toBeVisible();
  await check?.('pause');
  await page.getByTestId('placement-enough').click();
  await expect(page.getByTestId('placement-result')).toBeVisible();
}

/** The newest stored result of a profile, once it is saved. */
async function storedResult(page: Page, profileId: string): Promise<{ mode?: string; source: string; testLocale: string; stopReason: string }> {
  type Snap = { placements?: Array<{ mode?: string; source: string; testLocale: string; stopReason: string }> };
  await expect.poll(async () => ((await readStored<Snap>(page, `progress:${profileId}`))?.placements ?? []).length).toBeGreaterThan(0);
  const list = (await readStored<Snap>(page, `progress:${profileId}`))?.placements ?? [];
  return list[list.length - 1] as { mode?: string; source: string; testLocale: string; stopReason: string };
}

/** The Learning Route (the Route tab) shows the learner's own weekly plan: the week line and Open plan. */
async function learningRouteShowsThePlan(page: Page, name: string): Promise<void> {
  // The history bridge may still be stepping back after the screen the plan opened (AMENDMENTS-DISPLAY-NAV section
  // 7.2): a load started meanwhile is cancelled by that traversal (net::ERR_ABORTED), so it starts once more.
  await page.goto('/').catch(async (error: unknown) => {
    if (!/ERR_ABORTED/.test(String(error))) throw error;
    await page.goto('/');
  });
  await expect(page.getByText(hi(name))).toBeVisible();
  await closeInstallGuide(page);
  await page.getByRole('tablist').getByRole('link', { name: en.a11y.myRoute.tab }).click();
  await expect(page.getByTestId('my-route-screen')).toBeVisible();
  await expect(page.getByTestId('my-route-plan-line')).toHaveText(en.learner.myRoute.home.strip.week(1));
  await expect(page.getByTestId('my-route-plan-open')).toBeVisible();
}

test.describe('the level check end to end (release build, flag on by default)', () => {
  test.skip(!RELEASE, 'runs on the release build (dist/)');

  test('self, no PIN: the fork, a Standard check, the strip, Use this plan with one tap, the plan on the Learning Route', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await selfToFork(page, 'Sam');
    await expect(page.getByText(t.invite.title)).toBeVisible();
    await expect(page.getByTestId('placement-invite-new')).toBeVisible();
    await shot(page, 'placement-e2e-invite');
    await page.getByTestId('placement-invite-know').click();
    // es and ko ship (F-I18N-001 rows 15b / 16b), so the check asks for its test language first (section 3.1 step 2);
    // Continue keeps English, the UI language (the test-language describe below picks another one).
    await expect(page.getByTestId('placement-language')).toBeVisible();
    for (const locale of ['en', 'es', 'ko']) await expect(page.getByTestId(`placement-locale-${locale}`)).toBeVisible();
    await passPlacementLanguage(page);
    await runWithoutSound(page, 'standard');

    const id = await activeProfileId(page);
    expect(await storedResult(page, id)).toMatchObject({ mode: 'standard', source: 'onboarding', testLocale: 'en', stopReason: 'quit' });
    const strip = page.getByTestId('placement-plan-strip');
    await expect(strip).toBeVisible();
    await expect(strip.getByText(t.result.strip.title)).toBeVisible();
    await expect(page.getByTestId('placement-plan-pace-steady')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('placement-result-primary')).toHaveCount(0);
    await expect(page.getByTestId('placement-plan-change')).toBeVisible();
    await expect(page.getByTestId('placement-plan-just-start')).toBeVisible();
    expect(await screenText(page)).not.toMatch(NEVER);
    await shot(page, 'placement-e2e-result-strip');

    // One tap, no PIN: the plan is made with exactly what is shown and the start quest opens.
    await page.getByTestId('placement-plan-use').click();
    await expect(page.getByTestId('placement-result')).toHaveCount(0);
    await expect(page.getByText(PIN_LINE)).toHaveCount(0);
    await expect(headerClose(page)).toBeVisible();
    await expect
      .poll(async () => (await readStored<{ selfRoute?: { meta: { params: { sessionsPerWeek: number } } } }>(page, `progress:${id}`))?.selfRoute?.meta.params.sessionsPerWeek)
      .toBe(3);
    expect(await readStored(page, 'account:parentPinHash')).toBeNull();

    await learningRouteShowsThePlan(page, 'Sam');
    await shot(page, 'placement-e2e-learning-route');
    expect(errors).toEqual([]);
  });

  test('self on a device with a PIN: Use this plan is still one tap with no PIN (OD-14)', async ({ page }) => {
    // A child first makes this a family device with a grown-up PIN.
    await page.goto('/');
    await page.getByRole('button', { name: START }).click();
    await completeChildForm(page, { name: 'Dani', startJourney: false });
    await page.goto('/');
    await expect(page.getByText(hi('Dani'))).toBeVisible();
    await closeInstallGuide(page);
    await page.getByRole('button', { name: /profile/i }).first().click();
    await page.getByRole('button', { name: en.caregiver.audience.gated(en.learner.profile.addProfileName, true) }).click();
    await unlockWithPin(page);
    // An added profile (no agreement box: the device already has one) goes through the same fork (section 3.10).
    // Two setup steps here (F-LEARN-001 §3.15): the question, then the profile; no Privacy step.
    await page.getByRole('radio', { name: /^Me\./ }).click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByPlaceholder('Type a name').fill('Rae');
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByTestId('placement-invite')).toBeVisible();
    await page.getByTestId('placement-invite-know').click();
    await runWithoutSound(page, 'standard');
    const id = await activeProfileId(page);
    expect(await storedResult(page, id)).toMatchObject({ source: 'onboarding' });
    await expect(page.getByTestId('placement-plan-strip')).toBeVisible();
    await page.getByTestId('placement-plan-use').click();
    await expect(headerClose(page)).toBeVisible();
    await expect(page.getByText(PIN_LINE)).toHaveCount(0);
    await expect.poll(async () => (await readStored<{ selfRoute?: unknown }>(page, `progress:${id}`))?.selfRoute ?? null).not.toBeNull();
    await learningRouteShowsThePlan(page, 'Rae');
  });

  test('child: no strip; For grown-ups: set up a weekly plan asks for the PIN, then the report offers the plan', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: START }).click();
    await completeChildForm(page, { name: 'Dani', levelCheck: 'stop' });
    await page.getByTestId('placement-invite-know').click();
    await runWithoutSound(page, 'standard');
    const id = await activeProfileId(page);
    await expect(page.getByTestId('placement-plan-strip')).toHaveCount(0);
    await expect(page.getByTestId('placement-result-primary')).toBeVisible();
    const link = page.getByTestId('placement-link-forGrownUpsPlan');
    await expect(link).toHaveText(t.result.forGrownUpsPlan);
    expect(await screenText(page)).not.toMatch(NEVER);
    await shot(page, 'placement-e2e-result-child');
    await link.click();
    // The grown-up gate asks first; the report is not open behind it.
    await expect(page.getByText(PIN_LINE)).toBeVisible();
    await expect(page.getByTestId('placement-report')).toHaveCount(0);
    await unlockWithPin(page);
    await expect(page.getByTestId('placement-report')).toBeVisible();
    await expect(page.getByTestId('placement-report-plan')).toBeVisible();
    // Nothing was made for the child until a grown-up chooses it.
    expect((await readStored<{ selfRoute?: unknown }>(page, `progress:${id}`))?.selfRoute ?? null).toBeNull();
  });

  test('Deep: chosen on the options screen, stored as deep', async ({ page }) => {
    await selfToFork(page, 'Ola');
    await page.getByTestId('placement-invite-know').click();
    await runWithoutSound(page, 'deep');
    const id = await activeProfileId(page);
    expect(await storedResult(page, id)).toMatchObject({ mode: 'deep', source: 'onboarding' });
    await expect(page.getByTestId('placement-plan-strip')).toBeVisible();
  });

  test('Short with sound for a Pictures first learner: the one card, the hand-off, a run to its end', async ({ page }) => {
    await voicedSpeech(page);
    await selfToFork(page, 'Bo', 'Pictures first');
    await page.getByTestId('placement-invite-know').click();
    await passPlacementLanguage(page);
    await expect(page.getByTestId('placement-short-card')).toBeVisible();
    await page.getByTestId('placement-start').click();
    await page.getByTestId('placement-hoya-start').click();
    await page.getByTestId('placement-warmup-speaker').click();
    await expect(page.getByTestId('placement-warmup-speaker')).toHaveAttribute('aria-label', 'Hear it again');
    await page.getByTestId('placement-warmup-option-tiger').click();
    const result = page.getByTestId('placement-result');
    // Short has no three-not-sure sheet and ends on its own within nine questions (6 to 9, section 3.1).
    const notSure = page.getByTestId('placement-not-sure');
    let answered = 0;
    for (;;) {
      await expect(result.or(notSure).first()).toBeVisible();
      if (await result.isVisible()) break;
      expect(answered, 'Short asks at most nine questions').toBeLessThan(9);
      await notSure.click();
      answered += 1;
    }
    expect(answered).toBeGreaterThanOrEqual(6);
    expect(answered).toBeLessThanOrEqual(9);
    const id = await activeProfileId(page);
    expect(await storedResult(page, id)).toMatchObject({ mode: 'short', stopReason: 'complete' });
    expect(await screenText(page)).not.toMatch(NEVER);
  });

  test('the Home card and the Profile row open the check; a result retires the card', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: START }).click();
    // "I am new to Korean" goes on to the first-quest preview as before.
    await completeSelfForm(page, { name: 'Lee', startJourney: false });
    const id = await activeProfileId(page);
    expect(await readStored<{ declinedAt?: string }>(page, `placement-ui:${id}`)).toMatchObject({ declinedAt: expect.any(String) });
    await page.goto('/');
    await expect(page.getByText(hi('Lee'))).toBeVisible();
    await closeInstallGuide(page);

    const card = page.getByTestId('home-level-check');
    await expect(card).toBeVisible();
    await expect(card.getByText(t.homeCard.line)).toBeVisible();
    await card.scrollIntoViewIfNeeded();
    await shot(page, 'placement-e2e-home-card');
    await page.getByTestId('home-level-check-open').click();
    await passPlacementLanguage(page);
    await expect(page.getByTestId('placement-options')).toBeVisible();
    await page.goto('/');
    await expect(page.getByText(hi('Lee'))).toBeVisible();

    await page.getByRole('button', { name: /profile/i }).first().click();
    const row = page.getByTestId('profile-placement-row');
    await expect(row).toHaveText(t.profileRow);
    await row.click();
    // Not behind the PIN: a learner may do this alone.
    await passPlacementLanguage(page);
    await expect(page.getByTestId('placement-options')).toBeVisible();
    await runWithoutSound(page, 'standard');
    expect(await storedResult(page, id)).toMatchObject({ source: 'profile' });

    // With a result the Home card is gone.
    await page.goto('/');
    await expect(page.getByText(hi('Lee'))).toBeVisible();
    await expect(page.getByTestId('home-level-check')).toHaveCount(0);
  });

  test('Not now on the Home card hides it and remembers it', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: START }).click();
    await completeSelfForm(page, { name: 'Kim', startJourney: false });
    const id = await activeProfileId(page);
    await page.goto('/');
    await expect(page.getByText(hi('Kim'))).toBeVisible();
    await closeInstallGuide(page);
    await page.getByTestId('home-level-check-not-now').click();
    await expect(page.getByTestId('home-level-check')).toHaveCount(0);
    await expect.poll(async () => (await readStored<{ dismissedAt?: string }>(page, `placement-ui:${id}`))?.dismissedAt).toBeTruthy();
    await page.goto('/');
    await expect(page.getByText(hi('Kim'))).toBeVisible();
    await expect(page.getByTestId('home-level-check')).toHaveCount(0);
  });

  test('offline: the Home card opens the check and the result is stored with no network', async ({ page, context }) => {
    await page.goto('/');
    await page.getByRole('button', { name: START }).click();
    await completeSelfForm(page, { name: 'Ana', startJourney: false });
    const id = await activeProfileId(page);
    await expect
      .poll(
        () =>
          page.evaluate(async () => {
            const reg = await navigator.serviceWorker.getRegistration();
            return !!reg?.active && !!navigator.serviceWorker.controller;
          }),
        { timeout: 30_000 },
      )
      .toBe(true);
    await page.reload();
    await expect(page.getByText(hi('Ana'))).toBeVisible();
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByText(hi('Ana'))).toBeVisible();
    await closeInstallGuide(page);
    await page.getByTestId('home-level-check-open').click();
    await runWithoutSound(page, 'standard');
    expect(await storedResult(page, id)).toMatchObject({ source: 'home', mode: 'standard' });
    await expect(page.getByTestId('placement-plan-strip')).toBeVisible();
  });

  test.describe('320 x 568', () => {
    // React Native Web draws text in px, so 200 % browser zoom of a 640 px window lays out as this 320 px window.
    test.use({ viewport: { width: 320, height: 568 } });

    test('the fork, the options, the warm-up, an item, the pause and the result keep every control inside the window', async ({ page }) => {
      await selfToFork(page, 'Jo');
      await fits(page, 'invite');
      await shot(page, 'placement-e2e-320-invite');
      await page.getByTestId('placement-invite-know').click();
      await runWithoutSound(page, 'standard', async (name) => {
        await fits(page, name);
        await shot(page, `placement-e2e-320-${name}`);
      });
      await fits(page, 'result');
      await page.getByTestId('placement-plan-use').scrollIntoViewIfNeeded();
      await shot(page, 'placement-e2e-320-result');
      await page.getByTestId('placement-plan-use').click();
      await expect(headerClose(page)).toBeVisible();
    });

    test('a child profile: the fork and the result with For grown-ups keep every control inside the window', async ({ page }) => {
      await page.goto('/');
      await page.getByRole('button', { name: START }).click();
      await completeChildForm(page, { name: 'Mo', levelCheck: 'stop' });
      await expect(page.getByTestId('placement-invite')).toBeVisible();
      await fits(page, 'child invite');
      await page.getByTestId('placement-invite-know').click();
      await runWithoutSound(page, 'standard');
      await expect(page.getByTestId('placement-link-forGrownUpsPlan')).toBeVisible();
      await fits(page, 'child result');
      await page.getByTestId('placement-link-forGrownUpsPlan').scrollIntoViewIfNeeded();
      await shot(page, 'placement-e2e-320-result-child');
    });

    test('Home with the level-check card keeps every control inside the window', async ({ page }) => {
      await page.goto('/');
      await page.getByRole('button', { name: START }).click();
      await completeSelfForm(page, { name: 'Yu', startJourney: false });
      await page.goto('/');
      await expect(page.getByText(hi('Yu'))).toBeVisible();
      await closeInstallGuide(page);
      const card = page.getByTestId('home-level-check');
      await expect(card).toBeVisible();
      await card.scrollIntoViewIfNeeded();
      // Home carries its own counts (not the check's screens), so only the layout is checked here.
      await expectNoHorizontalOverflow(page, 'home: horizontal overflow');
      expect(await page.evaluate(controlsPastEdge), 'home: controls past the edge').toEqual([]);
      expect(await screenText(page), 'home: an emoji').not.toMatch(EMOJI);
      await shot(page, 'placement-e2e-320-home-card');
    });
  });
});

test.describe('the test language (weekly plan bundle: every UI locale shown)', () => {
  test.skip(!ROUTE, 'needs a build that shows more than one locale (build:web:route, E2E_ROUTE=1)');

  test('the fork opens the language screen; Spanish is the test language for this run only', async ({ page }) => {
    await selfToFork(page, 'Sam');
    await page.getByTestId('placement-invite-know').click();
    await expect(page.getByTestId('placement-language')).toBeVisible();
    for (const locale of ['en', 'es', 'ko']) await expect(page.getByTestId(`placement-locale-${locale}`)).toBeVisible();
    await fits(page, 'language');
    await page.setViewportSize({ width: 320, height: 568 });
    await fits(page, 'language at 320');
    await shot(page, 'placement-e2e-320-language');
    await page.setViewportSize({ width: 1280, height: 720 });
    await shot(page, 'placement-e2e-language');
    await page.getByTestId('placement-locale-es').click();
    await page.getByTestId('placement-language-continue').click();
    await runWithoutSound(page, 'standard', undefined, 'es');
    const id = await activeProfileId(page);
    expect(await storedResult(page, id)).toMatchObject({ testLocale: 'es' });
    // The result is written in the test language.
    await expect(page.getByText(getMessages('es').learner.placement.result.strip.title)).toBeVisible();
    // The choice is for this run only: the app stays in English, and no locale setting was written.
    const uiLocale = async (key: string): Promise<string> => (await readStored<{ uiLocale?: string }>(page, key))?.uiLocale ?? 'en';
    expect(await uiLocale('device:settings')).toBe('en');
    expect(await uiLocale(`settings:${id}`)).toBe('en');
    await page.goto('/');
    await expect(page.getByText(hi('Sam'))).toBeVisible();
    await expect(page.getByText(getMessages('en').learner.home.subtitle)).toBeVisible();
    expect(await uiLocale('device:settings')).toBe('en');
  });
});
