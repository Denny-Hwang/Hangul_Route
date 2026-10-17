import type { Locator, Page } from '@playwright/test';
import { encodeDeck, type LectureDeckInput } from '@hangul-route/content-schema';
import { expect, test } from './fixtures';
import { readStored } from './helpers';
import { shot } from './shots';

/**
 * Row LV-M1 (owner report 2026-10-16; F-TCH-004 sections 3.5 "History" and 3.6 phone exception;
 * AMENDMENTS-LECTURE-V2 section 14 `presenter-phone.spec.ts`): the presenter on a phone, with
 * `isMobile` and touch. Sideways at 568 x 320, 640 x 360 and 844 x 390 the slide is drawn (no
 * too-small page) and every slide family stays inside the stage; the compact bar shows at the start
 * of the lesson and hides after `presenter.autoHideMs`, a stage tap steps without showing it, a tap
 * in its strip shows it, and after Next on the bar or a stage tap it is hidden at once, so no
 * control covers the new slide; its step back reads Previous; More holds the rest. Upright, the
 * rotate page with Back. The phone start screen. The browser's back steps back one phase. No
 * sideways scroll. Screenshots with `HR_SHOTS=1`.
 */

const DECK: LectureDeckInput = {
  v: 1,
  id: 'lecture:e2e016',
  title: 'Phone lesson',
  createdAt: '2026-10-16T09:00:00Z',
  seed: 7,
  // Every slide family: letters, syllables, a card, words, an order slide, a topic, a story with its checks, a quiz, an activity, End with the code.
  blocks: [
    { kind: 'quest', id: 'quest:stage1-letters-q1' },
    { kind: 'quest', id: 'quest:stage1-life-q1' },
    { kind: 'quest', id: 'quest:stage1-rites-q3' },
    { kind: 'vocab', topicId: 'vocab-topic:food', wordIds: ['vocab:sagwa-apple', 'vocab:uyu', 'vocab:ppang', 'vocab:gimchi'] },
    { kind: 'story', storyId: 'story:sejong-new-letters', checks: true },
    { kind: 'quiz', from: 'all', rounds: 2 },
    { kind: 'activity', preset: 'air-write', minutes: 3 },
    { kind: 'class-code', code: 'HYRA42' },
  ],
  // A link from an older console that still names the helper picker: it opens and shows none (section 3.10).
  picker: { mode: 'names', count: 12 },
};

/** A short lesson for the bar and the way back. */
const SHORT: LectureDeckInput = { ...DECK, id: 'lecture:e2e017', title: 'Short lesson', blocks: [{ kind: 'quest', id: 'quest:stage1-letters-q1' }], picker: null };

/**
 * Start asks for fullscreen in its tap (section 3.5). Headless Chromium grants it and then sizes the
 * window to the emulated phone's upright screen, which is not what a phone sideways does, so every
 * test here records the request (with whether the tap was still active) and leaves the window as it is.
 */
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const calls: boolean[] = [];
    Object.defineProperty(window, '__fullscreenCalls', { configurable: true, value: calls });
    Element.prototype.requestFullscreen = function requestFullscreen(): Promise<void> {
      calls.push(navigator.userActivation?.isActive === true);
      return Promise.resolve();
    };
  });
});

function link(deck: LectureDeckInput = SHORT): string {
  return `/present#d=${encodeDeck(deck)}`;
}

async function startLesson(page: Page): Promise<void> {
  const start = page.getByTestId('presenter-start-button');
  await expect(start).toBeEnabled({ timeout: 10_000 });
  await start.tap();
}

async function counter(page: Page): Promise<string> {
  return (await page.getByTestId('presenter-counter').textContent()) ?? '';
}

async function liveText(page: Page): Promise<string> {
  return (await page.getByTestId('presenter-live').textContent()) ?? '';
}

/** Reveal presses on the open slide until the bar reads Next. */
async function revealAll(page: Page): Promise<void> {
  for (let i = 0; i < 10 && (await page.getByTestId('presenter-next').getAttribute('aria-label')) === 'Reveal'; i++) await page.keyboard.press('PageDown');
}

/** The history entry this tab is on (section 3.5 "History"). */
function entry(page: Page): Promise<{ hrPresenter?: string; hrIndex?: number; hrLectureFragment?: string } | null> {
  return page.evaluate(() => history.state as { hrPresenter?: string; hrIndex?: number; hrLectureFragment?: string } | null);
}

const bar = (page: Page): Locator => page.getByTestId('presenter-bar-compact');

/** The bar is hidden: transparent and taking no touch. */
async function expectBarHidden(page: Page): Promise<void> {
  await expect(page.getByTestId('presenter-next')).toHaveCSS('pointer-events', 'none');
  await expect(bar(page)).toHaveCSS('opacity', '0');
}

/** The bar is shown and, past the moment it ignores, takes touches. */
async function expectBarShown(page: Page): Promise<void> {
  await expect(bar(page)).toHaveCSS('opacity', '1');
  await expect(page.getByTestId('presenter-next')).not.toHaveCSS('pointer-events', 'none');
}

/** A tap in the middle of the stage, above the bar's strip (the right two thirds: next). */
async function tapStage(page: Page): Promise<void> {
  const stage = (await page.getByTestId('presenter-stage').boundingBox())!;
  await page.touchscreen.tap(stage.x + stage.width * 0.7, stage.y + stage.height * 0.4);
}

/** A tap in the bar's strip: the bottom of the stage, beside where the bar sits. */
async function tapStrip(page: Page): Promise<void> {
  const stage = (await page.getByTestId('presenter-stage').boundingBox())!;
  await page.touchscreen.tap(stage.x + stage.width * 0.95, stage.y + stage.height - 20);
}

/** No element of the slide's text (the taught row: glyph, Korean, romanization, gloss, answer tiles) meets a visible control. */
async function expectNothingCovered(page: Page): Promise<void> {
  const hits = await page.evaluate(() => {
    const visible = (el: Element): boolean => {
      for (let at: Element | null = el; at; at = at.parentElement) {
        const style = getComputedStyle(at);
        if (Number(style.opacity) < 0.01 || style.visibility === 'hidden' || style.display === 'none') return false;
      }
      return true;
    };
    const controls = Array.from(document.querySelectorAll('[data-testid="presenter-bar-compact"] [role="button"]')).filter(visible).map((el) => el.getBoundingClientRect());
    const stage = document.querySelector('[data-testid="presenter-stage"]');
    const texts = Array.from(stage?.querySelectorAll('*') ?? []).filter((el) => el.childElementCount === 0 && (el.textContent ?? '').trim() !== '' && el.getAttribute('data-testid') !== 'presenter-live' && visible(el));
    const out: string[] = [];
    for (const el of texts) {
      const r = el.getBoundingClientRect();
      for (const c of controls) if (r.left < c.right && r.right > c.left && r.top < c.bottom && r.bottom > c.top) out.push((el.textContent ?? '').slice(0, 30));
    }
    return out;
  });
  expect(hits).toEqual([]);
}

/** Every slide, every build revealed, stays inside the stage (the counter included). */
async function walkInsideStage(page: Page, label: string): Promise<Set<string>> {
  const kinds = new Set<string>();
  const total = Number((await counter(page)).split('/')[1]);
  for (let n = 1; n <= total; n++) {
    await expect.poll(() => counter(page)).toBe(`${n} / ${total}`);
    await revealAll(page);
    const kind = /^Slide \d+ of \d+, ([A-Za-z]+)/.exec(await liveText(page))?.[1] ?? '?';
    kinds.add(kind);
    // Polled: a slide that fits itself (End's rows, a quiz's long meanings) settles over a few frames.
    const outside = async (): Promise<string[]> => {
      const stage = (await page.getByTestId('presenter-stage').boundingBox())!;
      return page.getByTestId('presenter-stage').evaluate((root, box) => {
        const out: string[] = [];
        for (const el of Array.from(root.querySelectorAll('*'))) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          if (r.left < box.x - 1 || r.top < box.y - 1 || r.right > box.x + box.width + 1 || r.bottom > box.y + box.height + 1) out.push(`${el.tagName} ${el.getAttribute('data-testid') ?? ''} ${(el.textContent ?? '').slice(0, 30)}`);
        }
        return out;
      }, stage);
    };
    await expect.poll(outside, { message: `${label}: slide ${n} (${kind})`, timeout: 3000 }).toEqual([]);
    if (n < total) await page.keyboard.press('ArrowRight');
  }
  return kinds;
}

function noSidewaysScroll(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
}

const PHONES = [
  { width: 568, height: 320 },
  { width: 640, height: 360 },
  { width: 844, height: 390 },
] as const;

for (const size of PHONES) {
  test.describe(`a phone sideways, ${size.width} x ${size.height}`, () => {
    test.use({ viewport: size, isMobile: true, hasTouch: true });

    test('slide 1 is drawn, every slide family stays inside the stage, no picker and no sideways scroll', async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      await page.goto(link(DECK));
      await expect(page.getByTestId('presenter-start-footer')).toBeVisible();
      await startLesson(page);
      await expect(page.getByTestId('presenter-stage')).toBeVisible();
      await expect(page.getByTestId('presenter-too-small')).toHaveCount(0);
      await expect(page.getByTestId('presenter-rotate')).toHaveCount(0);
      await expect.poll(() => counter(page)).toMatch(/^1 \//);
      await expect(page.getByTestId('presenter-bar-band')).toHaveCount(0);
      await expect(page.getByTestId('presenter-grabber')).toBeAttached();
      await expect(page.getByTestId('presenter-picker')).toHaveCount(0);
      // No band: the stage takes the whole window in one direction.
      const stage = (await page.getByTestId('presenter-stage').boundingBox())!;
      expect(Math.max(stage.width / size.width, stage.height / size.height)).toBeGreaterThan(0.99);
      expect(await noSidewaysScroll(page)).toBe(true);
      await shot(page, `presenter-phone-title-${size.width}x${size.height}`);
      const kinds = await walkInsideStage(page, `${size.width}x${size.height}`);
      for (const kind of ['Title', 'Letter', 'Syllable', 'Word', 'Order', 'Card', 'Story', 'Question', 'Activity', 'End']) expect([...kinds]).toContain(kind);
      await shot(page, `presenter-phone-end-${size.width}x${size.height}`);
      expect(errors).toEqual([]);
    });

    test('the bar shows at the start and hides; a stage tap steps without it; its strip shows it; Next and a stage tap hide it at once', async ({ page }) => {
      await page.goto(link());
      await startLesson(page);
      // The start of the lesson: shown, its controls one row of touch targets inside the window, then hidden after 3 s.
      await expectBarShown(page);
      for (const id of ['presenter-back', 'presenter-next', 'presenter-sound', 'presenter-more']) {
        const box = (await page.getByTestId(id).boundingBox())!;
        expect(box.height, id).toBeGreaterThanOrEqual(64);
        expect(box.width, id).toBeGreaterThanOrEqual(64);
        expect(box.x + box.width, id).toBeLessThanOrEqual(size.width);
      }
      expect((await page.getByTestId('presenter-next').boundingBox())!.width).toBeGreaterThanOrEqual(96);
      await expect(page.getByTestId('presenter-back')).toHaveAccessibleName('Previous');
      await shot(page, `presenter-phone-bar-${size.width}x${size.height}`);
      await expectBarHidden(page);
      // A stage tap steps; the bar stays out of the way.
      const first = await counter(page);
      await tapStage(page);
      await expect.poll(() => liveText(page)).not.toContain('Slide 1 of');
      await page.waitForTimeout(400);
      await expectBarHidden(page);
      expect(await counter(page)).not.toBe(first);
      // A tap in the strip shows it, and steps nothing (the slide's builds revealed by key first, so Next steps a slide).
      await revealAll(page);
      await expectBarHidden(page);
      const at = await liveText(page);
      await tapStrip(page);
      await expectBarShown(page);
      expect(await liveText(page)).toBe(at);
      // Next on the bar: the step happens and the bar is gone at once; nothing of the new slide is covered.
      await page.getByTestId('presenter-next').tap();
      await expect(page.getByTestId('presenter-next')).toHaveCSS('pointer-events', 'none');
      await expect.poll(() => liveText(page)).not.toBe(at);
      await expectBarHidden(page);
      await expectNothingCovered(page);
      // Shown again, a stage tap while it shows also hides it at once.
      await revealAll(page);
      await tapStrip(page);
      await expectBarShown(page);
      const before = await liveText(page);
      await tapStage(page);
      await expect(page.getByTestId('presenter-next')).toHaveCSS('pointer-events', 'none');
      await expect.poll(() => liveText(page)).not.toBe(before);
      await expectBarHidden(page);
      await expectNothingCovered(page);
      // A tap in the strip while it shows hides it.
      await tapStrip(page);
      await expectBarShown(page);
      await tapStrip(page);
      await expectBarHidden(page);
    });

    test('a tap where the hidden bar is presses nothing', async ({ page }) => {
      await page.goto(link());
      await startLesson(page);
      const more = (await page.getByTestId('presenter-more').boundingBox())!;
      await expectBarHidden(page);
      const at = await liveText(page);
      await page.touchscreen.tap(more.x + more.width / 2, more.y + more.height / 2);
      await expectBarShown(page);
      await expect(page.getByTestId('presenter-more-sheet')).toHaveCount(0);
      expect(await liveText(page)).toBe(at);
    });
  });
}

test.describe('the compact bar in Spanish and Korean at 568 x 320', () => {
  for (const locale of ['es-ES', 'ko-KR'] as const) {
    test.describe(locale, () => {
      test.use({ viewport: { width: 568, height: 320 }, isMobile: true, hasTouch: true, locale });

      test('one row inside the window, no label broken mid-word', async ({ page }) => {
        await page.goto(link());
        await startLesson(page);
        await expectBarShown(page);
        const ids = ['presenter-back', 'presenter-next', 'presenter-sound', 'presenter-more'];
        const tops = new Set<number>();
        for (const id of ids) {
          const button = page.getByTestId(id);
          const box = (await button.boundingBox())!;
          tops.add(Math.round(box.y));
          expect(box.x, id).toBeGreaterThanOrEqual(0);
          expect(box.x + box.width, id).toBeLessThanOrEqual(568);
          // One line of 18 px text: the label is not wrapped.
          const label = button.locator('div[dir="auto"]').last();
          expect((await label.boundingBox())!.height, id).toBeLessThan(18 * 2);
        }
        expect(tops.size).toBe(1);
        await expect(page.getByTestId('presenter-back')).toHaveAccessibleName(locale === 'es-ES' ? 'Anterior' : '이전');
        await shot(page, `presenter-phone-bar-${locale}-568x320`);
      });
    });
  }
});

test.describe('More, Help and the Exit confirm on the smallest phone, 568 x 320', () => {
  test.use({ viewport: { width: 568, height: 320 }, isMobile: true, hasTouch: true });

  test('More: the sheet takes the bar\'s place with Close, the chips and the other controls; each fits inside the window', async ({ page }) => {
    await page.goto(link());
    await startLesson(page);
    await page.getByTestId('presenter-more').tap();
    const sheet = page.getByTestId('presenter-more-sheet');
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole('heading', { name: 'Lesson controls' })).toBeVisible();
    await expect(page.getByTestId('presenter-more-close')).toBeFocused();
    await expect(bar(page)).toHaveCSS('opacity', '0');
    // The no-voice chip of this device sits in the sheet's header (the e2e engine has no Korean voice).
    await expect(sheet.getByTestId('presenter-chip-no-voice')).toBeVisible();
    for (const id of ['presenter-grid-button', 'presenter-timer', 'presenter-blank-button', 'presenter-help-button', 'presenter-exit']) await expect(sheet.getByTestId(id)).toBeVisible();
    const fullscreen = await page.evaluate(() => document.fullscreenEnabled === true);
    await expect(sheet.getByTestId('presenter-fullscreen')).toHaveCount(fullscreen ? 1 : 0);
    await expect(page.locator('[aria-disabled="true"]')).toHaveCount(0);
    const box = (await sheet.boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(320);
    expect(await noSidewaysScroll(page)).toBe(true);
    await shot(page, 'presenter-phone-more-568x320');
    // Keys and help: Help with the phone line under its title.
    await sheet.getByTestId('presenter-help-button').tap();
    await expect(sheet).toHaveCount(0);
    const help = page.getByTestId('presenter-help');
    await expect(help).toBeVisible();
    await expect(help.getByTestId('presenter-help-phone-bar')).toHaveText('On a phone, tap the bottom of the slide to show the controls.');
    await expect(help.getByText('Previous', { exact: true })).toBeVisible();
    await shot(page, 'presenter-phone-help-568x320');
    await page.getByTestId('presenter-help-close').tap();
    // Exit from More: the confirm fits the window.
    await expectBarHidden(page);
    await tapStrip(page);
    await expectBarShown(page);
    await page.getByTestId('presenter-more').tap();
    await page.getByTestId('presenter-more-sheet').getByTestId('presenter-exit').tap();
    const dialog = page.getByTestId('presenter-exit-dialog');
    await expect(dialog).toBeVisible();
    const d = (await dialog.boundingBox())!;
    expect(d.y).toBeGreaterThanOrEqual(0);
    expect(d.y + d.height).toBeLessThanOrEqual(320);
    expect(d.x + d.width).toBeLessThanOrEqual(568);
    await shot(page, 'presenter-phone-exit-568x320');
    await page.getByTestId('presenter-keep-going').tap();
    await expect(dialog).toHaveCount(0);
  });

  test('a keyboard focus inside the bar holds it; a focus given back after a tap (More closing) does not', async ({ page }) => {
    await page.goto(link());
    await startLesson(page);
    await expectBarHidden(page);
    // A tap: More, then Close; focus goes back to More, and the next step still hides the bar.
    await tapStrip(page);
    await expectBarShown(page);
    await page.getByTestId('presenter-more').tap();
    await page.getByTestId('presenter-more-close').tap();
    await expect(page.getByTestId('presenter-more')).toBeFocused();
    await revealAll(page);
    await expectBarShown(page);
    await tapStage(page);
    await expectBarHidden(page);
    // A keyboard user: a key, then focus moves into the bar; it shows and stays past presenter.autoHideMs.
    await page.keyboard.press('Shift');
    await page.getByTestId('presenter-sound').focus();
    await expectBarShown(page);
    await page.waitForTimeout(3600);
    await expectBarShown(page);
  });

  test('a covering tool (Blank) is cleared from the bar: a touch brings it back over the tool', async ({ page }) => {
    await page.goto(link());
    await startLesson(page);
    await page.getByTestId('presenter-more').tap();
    await page.getByTestId('presenter-more-sheet').getByTestId('presenter-blank-button').tap();
    await expect(page.getByTestId('presenter-blank')).toBeVisible();
    await expectBarHidden(page);
    await page.touchscreen.tap(284, 120);
    await expectBarShown(page);
    await page.getByTestId('presenter-next').tap();
    await expect(page.getByTestId('presenter-blank')).toHaveCount(0);
  });
});

test.describe('Start asks for fullscreen and landscape in the tap itself (section 3.5), 640 x 360', () => {
  test.use({ viewport: { width: 640, height: 360 }, isMobile: true, hasTouch: true });

  test('requestFullscreen is called once, with the tap still active', async ({ page }) => {
    await page.goto(link());
    await startLesson(page);
    await expect(page.getByTestId('presenter-stage')).toBeVisible();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __fullscreenCalls: boolean[] }).__fullscreenCalls)).toEqual([true]);
  });
});

test.describe('a phone held upright, 360 x 640', () => {
  test.use({ viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true });

  test('the phone start screen: one Ready line, Details, the turn hint, a sticky Back and Start; no sideways scroll', async ({ page }) => {
    await page.goto(link(DECK));
    const ready = page.getByTestId('presenter-start-ready');
    await expect(ready).toContainText('Ready to start');
    // No Korean voice on this device (the e2e engine has none): a check needs a look.
    await expect(page.getByTestId('presenter-start-some-checks')).toHaveText('Some checks need a look: see Details.');
    await expect(page.getByText('Before you start')).toHaveCount(0);
    const details = page.getByTestId('presenter-start-details');
    await expect(details).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByTestId('presenter-start-turn')).toHaveText('Turn your phone sideways for the lesson.');
    const footer = (await page.getByTestId('presenter-start-footer').boundingBox())!;
    expect(footer.y + footer.height).toBeLessThanOrEqual(640 + 1);
    const back = (await page.getByTestId('presenter-start-back').boundingBox())!;
    const start = (await page.getByTestId('presenter-start-button').boundingBox())!;
    expect(Math.abs(back.y + back.height / 2 - (start.y + start.height / 2))).toBeLessThan(4);
    expect(start.height).toBeGreaterThanOrEqual(96);
    await expect(page.getByTestId('presenter-start-back')).toHaveAccessibleName('Back');
    expect(await noSidewaysScroll(page)).toBe(true);
    await shot(page, 'presenter-phone-start-360x640');
    // Details: the check list and the skipped parts, exactly as on the wide page.
    await details.tap();
    await expect(details).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByText('Before you start')).toBeVisible();
    await expect(page.getByTestId('presenter-check-voice')).toBeVisible();
    await expect(page.getByTestId('presenter-check-offline')).toBeVisible();
    // The footer stays on screen while the page scrolls.
    await page.mouse.wheel(0, 2000);
    expect((await page.getByTestId('presenter-start-footer').boundingBox())!.y + footer.height).toBeLessThanOrEqual(640 + 1);
    await shot(page, 'presenter-phone-start-details-360x640');
  });

  test('Start upright opens the rotate page with Back; Back before the first slide is the same start screen, nothing started', async ({ page }) => {
    await page.goto(link(DECK));
    await startLesson(page);
    const rotate = page.getByTestId('presenter-rotate');
    await expect(rotate).toBeVisible();
    await expect(rotate.getByRole('heading', { name: 'Turn your phone sideways' })).toBeVisible();
    await expect(rotate.getByText('The lesson shows when the phone is sideways. Nothing is lost.')).toBeVisible();
    const back = page.getByTestId('presenter-rotate-back');
    await expect(back).toHaveAccessibleName('Back');
    const box = (await back.boundingBox())!;
    expect(box.y).toBeLessThan(100);
    expect(box.x).toBeLessThan(100);
    await expect(page.getByTestId('presenter-stage')).toHaveCount(0);
    expect(await noSidewaysScroll(page)).toBe(true);
    await shot(page, 'presenter-phone-rotate-360x640');
    await back.tap();
    await expect(page.getByRole('heading', { name: 'Phone lesson' })).toBeVisible();
    await expect(page.getByTestId('presenter-start-button')).toBeVisible();
    expect(await readStored(page, 'lecture:recent')).toBeNull();
    await expect.poll(async () => (await entry(page))?.hrPresenter).toBe('ready');
    // Start again and turn the phone: slide 1, and only now the lesson begins (Recent written).
    await startLesson(page);
    await expect(rotate).toBeVisible();
    await page.setViewportSize({ width: 640, height: 360 });
    await expect(page.getByTestId('presenter-stage')).toBeVisible();
    await expect.poll(() => counter(page)).toMatch(/^1 \//);
    await expect.poll(async () => ((await readStored<{ items: unknown[] }>(page, 'lecture:recent'))?.items ?? []).length).toBe(1);
    expect(await entry(page)).toMatchObject({ hrPresenter: 'running', hrIndex: 2 });
  });

  test('turned upright mid-lesson: Back opens the Exit confirm; turned back, the same slide', async ({ page }) => {
    await page.setViewportSize({ width: 640, height: 360 });
    await page.goto(link());
    await startLesson(page);
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    const at = await liveText(page);
    await page.setViewportSize({ width: 360, height: 640 });
    await expect(page.getByTestId('presenter-rotate')).toBeVisible();
    // Keys still step the hidden slide; back again.
    await page.getByTestId('presenter-rotate-back').tap();
    await expect(page.getByTestId('presenter-exit-dialog')).toBeVisible();
    await page.getByTestId('presenter-keep-going').tap();
    await page.setViewportSize({ width: 640, height: 360 });
    await expect(page.getByTestId('presenter-stage')).toBeVisible();
    expect(await liveText(page)).toBe(at);
  });
});

test.describe('the way back on a phone, 640 x 360 (section 3.5 "History")', () => {
  test.use({ viewport: { width: 640, height: 360 }, isMobile: true, hasTouch: true });

  test('a link gets a home entry under its start entry; back from the start screen shows the home, a Forward finds no deck', async ({ page }) => {
    await page.goto(link());
    await expect(page.getByTestId('presenter-start')).toBeVisible();
    expect(await entry(page)).toMatchObject({ hrPresenter: 'ready', hrIndex: 1 });
    await page.goBack();
    await expect(page.getByTestId('presenter-home')).toBeVisible();
    expect(await readStored(page, 'lecture:recent')).toBeNull();
    await expect.poll(async () => (await entry(page))?.hrLectureFragment).toBeUndefined();
    await page.goForward();
    await expect(page.getByTestId('presenter-home')).toBeVisible();
    await expect.poll(async () => (await entry(page))?.hrIndex).toBe(0);
    expect((await entry(page))?.hrLectureFragment).toBeUndefined();
  });

  test('the phone footer Back goes home with nothing saved', async ({ page }) => {
    await page.goto(link());
    await page.getByTestId('presenter-start-back').tap();
    await expect(page.getByTestId('presenter-home')).toBeVisible();
    expect(await readStored(page, 'lecture:recent')).toBeNull();
    await expect.poll(async () => (await entry(page))?.hrPresenter).toBe('home');
  });

  test('in a lesson: a covering tool closes first, then the Exit confirm; Keep going and back again asks again; a second back exits', async ({ page }) => {
    await page.goto(link());
    await startLesson(page);
    await page.keyboard.press('ArrowRight');
    // A covering tool open: the back closes it, the lesson stays.
    await page.keyboard.press('b');
    await expect(page.getByTestId('presenter-blank')).toBeVisible();
    await page.goBack();
    await expect(page.getByTestId('presenter-blank')).toHaveCount(0);
    await expect(page.getByTestId('presenter-exit-dialog')).toHaveCount(0);
    await expect(page.getByTestId('presenter-stage')).toBeVisible();
    // The lesson's entry comes back at the next activation (a key here), so the next back asks.
    await page.keyboard.press('ArrowRight');
    await expect.poll(async () => (await entry(page))?.hrPresenter).toBe('running');
    await page.goBack();
    await expect(page.getByTestId('presenter-exit-dialog')).toBeVisible();
    await expect(page.getByTestId('presenter-stage')).toBeVisible();
    await page.getByTestId('presenter-keep-going').tap();
    await expect(page.getByTestId('presenter-exit-dialog')).toHaveCount(0);
    await expect.poll(async () => (await entry(page))?.hrPresenter).toBe('running');
    await page.goBack();
    await expect(page.getByTestId('presenter-exit-dialog')).toBeVisible();
    // The second back is the answer: Exit, to the home, nothing ahead.
    await page.goBack();
    await expect(page.getByTestId('presenter-home')).toBeVisible();
    await expect.poll(async () => ((await readStored<{ items: unknown[] }>(page, 'lecture:recent'))?.items ?? []).length).toBe(1);
    await page.goForward();
    await expect(page.getByTestId('presenter-home')).toBeVisible();
    await expect.poll(async () => (await entry(page))?.hrIndex).toBe(0);
  });

  test('Exit from the bar lands on the home entry; a Forward then finds no deck', async ({ page }) => {
    await page.goto(link());
    await startLesson(page);
    await page.keyboard.press('Escape');
    await page.getByTestId('presenter-exit-confirm').tap();
    await expect(page.getByTestId('presenter-home')).toBeVisible();
    await expect.poll(async () => await entry(page)).toMatchObject({ hrPresenter: 'home', hrIndex: 0 });
    await page.goForward();
    await expect(page.getByTestId('presenter-home')).toBeVisible();
    await expect.poll(async () => (await entry(page))?.hrIndex).toBe(0);
    expect((await entry(page))?.hrLectureFragment).toBeUndefined();
  });
});

test.describe("the home's Back (section 3.5 'History' rule 5)", () => {
  test.use({ viewport: { width: 640, height: 360 }, isMobile: true, hasTouch: true });

  test('a tab that came from a page of the app goes back to it; a fresh tab lands on /', async ({ page }) => {
    await page.goto('/browse');
    await page.evaluate(() => window.location.assign('/present'));
    await expect(page.getByTestId('presenter-home')).toBeVisible();
    await expect(page.getByTestId('presenter-home-back')).toHaveAccessibleName('Back');
    await shot(page, 'presenter-home-back-640x360');
    await page.getByTestId('presenter-home-back').tap();
    await expect.poll(() => new URL(page.url()).pathname).toBe('/browse');

    const fresh = await page.context().newPage();
    await fresh.goto('/present');
    await expect(fresh.getByTestId('presenter-home')).toBeVisible();
    await fresh.getByTestId('presenter-home-back').tap();
    await expect.poll(() => new URL(fresh.url()).pathname).toBe('/');
    await fresh.close();
  });
});

test.describe('honest minutes on the phone start screen, 640 x 360 (section 4.4)', () => {
  test.use({ viewport: { width: 640, height: 360 }, isMobile: true, hasTouch: true });

  test('Consonants and Vowels from Quick lesson: 25 slides, about 13 minutes, never about 0', async ({ page }) => {
    await page.goto('/present');
    const quick = page.getByTestId('presenter-home-quick');
    await quick.getByRole('checkbox', { name: /^Consonants/ }).tap();
    await quick.getByRole('checkbox', { name: /^Vowels/ }).tap();
    await page.getByTestId('presenter-home-build').tap();
    // 14 consonants in two sets of 7 (4 + 4) and 10 vowels (5): rule 12 rounds each set up.
    await expect(page.getByTestId('presenter-start-facts')).toHaveText('25 slides · about 13 minutes');
    await shot(page, 'presenter-phone-start-letters-640x360');
  });
});
