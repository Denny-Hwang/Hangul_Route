import type { Page } from '@playwright/test';
import { encodeDeck, type LectureDeckInput } from '@hangul-route/content-schema';
import { expect, test } from './fixtures';
import { shot } from './shots';

/**
 * Row LV-S3 (AMENDMENTS-LECTURE-V2 sections 5.1, 5.2, 10 and 14; design/screens/presenter/slide-sentence-build.md, V9):
 * the sentence-build slides of shipped Stage 3 and Stage 7 lessons (order-it practice, apply and the Stage 7 Check) on
 * the big screen at 1280 x 720 and 1920 x 1080, on a phone sideways (LV-M1) at 568 x 320 and 844 x 390, and with
 * Spanish and Korean slides. Every build of every sentence build: the live region names the slide by its question and
 * then says each tile placed, nothing leaves the content area (the stage on a phone), no text spills out of its tile and
 * none is below the stage caption size or 18 px; nothing in the bank moves while the tiles go to the line (each leaves
 * its ghost); the whole build shows the romanization and the meaning and sets the distractors back, never marked;
 * Sound plays the sentence. Nothing on the slide takes input. Screenshots with `HR_SHOTS=1`.
 */

const DECK: LectureDeckInput = {
  v: 1,
  id: 'lecture:e2eb01',
  title: 'Sentence builds',
  createdAt: '2026-10-20T09:00:00Z',
  seed: 7,
  blocks: [
    { kind: 'quest', id: 'quest:stage3-life-q3' }, // three tiles and a distractor (친구가 학교에 가요.)
    { kind: 'quest', id: 'quest:stage3-rites-q1' }, // long words (할머니하고 할아버지가 있어요.) and a distractor with its mark
    { kind: 'quest', id: 'quest:stage3-rites-q3' }, // four tiles, a particle tile and a distractor
    { kind: 'quest', id: 'quest:stage3-letters-q1' }, // 네, ... and the 이에요 / 예요 endings
    { kind: 'quest', id: 'quest:stage7-life-q2' }, // a particle tile with a distractor, and the Check
    { kind: 'quest', id: 'quest:stage7-nature-q3' }, // the longest sentences (제가 좋아하는 동물은 ...), a particle on the last tile
  ],
  picker: null,
};

/** Stage numbers (presenter tokens and README constants). */
const STAGE_WIDTH = 1280;
const STAGE_PADDING = 48;
const CAPTION = 28;
const TEXT_FLOOR = 18;
const KIND = 'Build a sentence';

function link(deck: LectureDeckInput = DECK): string {
  return `/present#d=${encodeDeck(deck)}`;
}

/** A device with a Korean voice that takes `ms` to say anything; what it was asked is kept in `window.__spoken`. */
async function koreanVoice(page: Page, ms = 50): Promise<void> {
  await page.addInitScript((delay) => {
    const voices = [
      { name: 'Yuna', lang: 'ko-KR', voiceURI: 'Yuna', localService: true, default: false },
      { name: 'Samantha', lang: 'en-US', voiceURI: 'Samantha', localService: true, default: true },
    ];
    class Utterance {
      lang = '';
      rate = 1;
      pitch = 1;
      volume = 1;
      voice: unknown = null;
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(public text: string) {}
    }
    const spoken: string[] = [];
    let speaking: Utterance | null = null;
    Object.defineProperty(window, '__spoken', { configurable: true, value: spoken });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: Utterance });
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        get speaking() {
          return speaking !== null;
        },
        pending: false,
        speak: (u: Utterance) => {
          spoken.push(u.text);
          speaking = u;
          setTimeout(() => u.onstart?.(), 0);
          setTimeout(() => {
            if (speaking === u) speaking = null;
            u.onend?.();
          }, delay);
        },
        cancel: () => {
          const u = speaking;
          speaking = null;
          u?.onend?.();
        },
        getVoices: () => voices,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      },
    });
  }, ms);
}

async function lastSpoken(page: Page): Promise<string> {
  return page.evaluate(() => (window as Window & { __spoken?: string[] }).__spoken?.at(-1) ?? '');
}

async function startLesson(page: Page, touch = false): Promise<void> {
  const start = page.getByTestId('presenter-start-button');
  await expect(start).toBeEnabled({ timeout: 10_000 });
  if (touch) await start.tap();
  else await start.click();
  await expect(page.getByTestId('presenter-stage')).toBeVisible();
}

async function liveText(page: Page): Promise<string> {
  return (await page.getByTestId('presenter-live').textContent()) ?? '';
}

/** The slide numbers of every sentence build, read from the grid's thumbnails (named "n, Build a sentence"; the grid speaks the device language). */
async function buildSlides(page: Page): Promise<number[]> {
  await page.keyboard.press('g');
  const grid = page.getByTestId('presenter-grid');
  await expect(grid).toBeVisible();
  const names = await grid.locator('[data-testid^="presenter-grid-goto-"]').evaluateAll((els) => els.map((el) => el.getAttribute('aria-label') ?? ''));
  await page.keyboard.press('Escape');
  await expect(grid).toHaveCount(0);
  return names.flatMap((name) => {
    const [n, k] = name.split(', ');
    return k === KIND ? [Number(n)] : [];
  });
}

async function goto(page: Page, n: number): Promise<void> {
  await page.keyboard.press('g');
  await page.getByTestId(`presenter-grid-goto-${n}`).click();
  await expect(page.getByTestId('presenter-grid')).toHaveCount(0);
  await expect(page.getByTestId('presenter-counter')).toHaveText(new RegExp(`^${n} / \\d+$`));
}

/**
 * What leaves the box (the content area: the stage less its padding; a phone's whole stage), and every text drawn
 * smaller than `min` pixels, on the open slide (the reading and question slides' check).
 */
async function fitProblems(page: Page, phone: boolean): Promise<string[]> {
  const stage = (await page.getByTestId('presenter-stage').boundingBox())!;
  const unit = stage.width / STAGE_WIDTH;
  const pad = phone ? 0 : STAGE_PADDING * unit;
  const box = { left: stage.x + pad, top: stage.y + pad, right: stage.x + stage.width - pad, bottom: stage.y + stage.height - pad };
  const min = Math.max(TEXT_FLOOR, CAPTION * unit) - 0.5;
  return page.getByTestId('presenter-stage').evaluate(
    (root, { box, min }) => {
      const out: string[] = [];
      const skip = (el: Element): boolean => el.closest('[data-testid="presenter-live"], [data-testid="presenter-counter"], [data-testid="presenter-grabber"]') !== null;
      for (const el of Array.from(root.querySelectorAll('*'))) {
        if (skip(el)) continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        const name = `${el.tagName} ${el.getAttribute('data-testid') ?? ''} ${(el.textContent ?? '').slice(0, 24)}`;
        if (r.left < box.left - 1 || r.top < box.top - 1 || r.right > box.right + 1 || r.bottom > box.bottom + 1) out.push(`outside: ${name}`);
        const own = Array.from(el.childNodes).some((c) => c.nodeType === Node.TEXT_NODE && (c.textContent ?? '').trim() !== '');
        if (own && parseFloat(getComputedStyle(el).fontSize) < min) out.push(`small ${getComputedStyle(el).fontSize}: ${name}`);
        // A text never spills out of the box that holds it (a tile, an ending's box).
        const parent = el.parentElement?.getBoundingClientRect();
        if (own && parent && (r.left < parent.left - 1 || r.right > parent.right + 1)) out.push(`spills: ${name}`);
      }
      return out;
    },
    { box, min },
  );
}

/** Where each bank tile is drawn, so a step that moved one shows. */
async function bankBoxes(page: Page): Promise<string[]> {
  return page
    .getByTestId('presenter-stage')
    .getByTestId('presenter-build-bank-tile')
    .evaluateAll((els) => els.map((el) => { const r = el.getBoundingClientRect(); return `${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.width)}x${Math.round(r.height)}`; }));
}

/**
 * Every sentence build, every build revealed: the live region, the fit at each build, a bank that never moves, and at
 * the whole build the romanization, the meaning and the distractors set back. Returns the slides walked and how many
 * held a particle tile and a distractor.
 */
async function walkBuilds(page: Page, label: string, phone: boolean, ask: string, placed: RegExp): Promise<{ slides: number; particles: number; distractors: number }> {
  const seen = { slides: 0, particles: 0, distractors: 0 };
  const stage = page.getByTestId('presenter-stage');
  for (const n of await buildSlides(page)) {
    await goto(page, n);
    seen.slides += 1;
    expect(await liveText(page), `${label} slide ${n}`).toContain(ask);
    await expect(stage.getByTestId('presenter-build-ask')).toHaveText(ask);
    await expect(stage.getByTestId('presenter-build-placed')).toHaveCount(0);
    expect(await stage.locator('[role="button"]').count(), `${label} slide ${n}: nothing to press`).toBe(0);
    await expect.poll(() => fitProblems(page, phone), { message: `${label}: slide ${n}, bank`, timeout: 3000 }).toEqual([]);
    await shot(page, `presenter-build-${label}-${String(n).padStart(2, '0')}-0`);
    // The fit level is settled once nothing is outside; from here no build may move a bank tile.
    const bank = await bankBoxes(page);
    let step = 0;
    let particle = false;
    while ((await page.getByTestId('presenter-next').getAttribute('aria-label')) === 'Reveal') {
      await page.keyboard.press('PageDown');
      step += 1;
      if ((await stage.getByTestId('presenter-build-particle').count()) > 0) {
        particle = true;
        await expect(stage.getByTestId('presenter-build-choice')).toHaveCount(2);
        await shot(page, `presenter-build-${label}-${String(n).padStart(2, '0')}-particle`);
      }
      await expect.poll(() => fitProblems(page, phone), { message: `${label}: slide ${n}, build ${step}`, timeout: 3000 }).toEqual([]);
      expect(await bankBoxes(page), `${label} slide ${n} build ${step}: the bank stays put`).toEqual(bank);
      if ((await stage.getByTestId('presenter-build-whole').getAttribute('aria-hidden')) !== 'true') break;
      expect(await liveText(page), `${label} slide ${n} build ${step}`).toMatch(placed);
    }
    if (particle) seen.particles += 1;
    // The whole build: the line full, the romanization and the meaning shown, the distractors set back and unmarked.
    await expect(stage.getByTestId('presenter-build-slot')).toHaveCount(0);
    await expect(stage.getByTestId('presenter-build-rom')).not.toHaveText('');
    await expect(stage.getByTestId('presenter-build-gloss')).not.toHaveText('');
    const setBack = stage.locator('[data-testid="presenter-build-bank-tile"][data-look="set-back"]');
    if ((await setBack.count()) > 0) {
      seen.distractors += 1;
      await expect(setBack.first()).toHaveCSS('opacity', '0.8');
    }
    await expect(stage.locator('[data-testid="presenter-build-bank-tile"][data-look="tile"]')).toHaveCount(0);
    const korean = await stage.getByTestId('presenter-build-line').locator('[lang="ko"]').allInnerTexts();
    expect(korean.join('').trim().length, `${label} slide ${n}: Korean`).toBeGreaterThan(0);
    await shot(page, `presenter-build-${label}-${String(n).padStart(2, '0')}-whole`);
  }
  return seen;
}

for (const size of [
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
] as const) {
  test.describe(`the sentence builds at ${size.width} x ${size.height}`, () => {
    test.use({ viewport: size, isMobile: false, hasTouch: false });

    test('every build of every sentence build fits, says what it placed, and never moves the bank', async ({ page }) => {
      test.setTimeout(240_000);
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      await koreanVoice(page);
      await page.goto(link());
      await startLesson(page);
      const seen = await walkBuilds(page, `${size.width}x${size.height}`, false, 'Which word comes next?', / placed$/);
      expect(seen.slides).toBeGreaterThanOrEqual(25);
      expect(seen.particles).toBeGreaterThanOrEqual(5);
      expect(seen.distractors).toBeGreaterThanOrEqual(10);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      expect(errors).toEqual([]);
    });
  });
}

test.describe('the sentence builds on a phone sideways (LV-M1)', () => {
  for (const size of [
    { width: 568, height: 320 },
    { width: 844, height: 390 },
  ] as const) {
    test.describe(`${size.width} x ${size.height}`, () => {
      test.use({ viewport: size, isMobile: true, hasTouch: true });

      test('every build stays inside the stage, no text below 18 px, no sideways scroll', async ({ page }) => {
        test.setTimeout(240_000);
        await page.addInitScript(() => {
          // Start asks for fullscreen; headless Chromium would resize the window to the upright screen (presenter-phone.spec.ts).
          Element.prototype.requestFullscreen = () => Promise.resolve();
        });
        await koreanVoice(page);
        await page.goto(link());
        await expect(page.getByTestId('presenter-start-footer')).toBeVisible();
        await startLesson(page, true);
        await expect(page.getByTestId('presenter-too-small')).toHaveCount(0);
        const seen = await walkBuilds(page, `phone-${size.width}x${size.height}`, true, 'Which word comes next?', / placed$/);
        expect(seen.slides).toBeGreaterThanOrEqual(25);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      });
    });
  }
});

test.describe('the sentence builds in Spanish and Korean (longer questions and meanings)', () => {
  for (const [locale, ask, placed] of [
    ['es', '¿Qué palabra va después?', /^Se colocó: /],
    ['ko', '다음 낱말은 뭘까요?', /^놓은 낱말: /],
  ] as const) {
    for (const size of [
      { width: 1280, height: 720, phone: false },
      { width: 568, height: 320, phone: true },
    ] as const) {
      test.describe(`slides in ${locale} at ${size.width} x ${size.height}`, () => {
        test.use({ viewport: { width: size.width, height: size.height }, isMobile: size.phone, hasTouch: size.phone });

        test('every build fits, in the slide language', async ({ page }) => {
          test.setTimeout(240_000);
          if (size.phone) {
            await page.addInitScript(() => {
              Element.prototype.requestFullscreen = () => Promise.resolve();
            });
          }
          await koreanVoice(page);
          await page.goto(link({ ...DECK, id: `lecture:e2eb${locale}1`, options: { romanization: 'always', strokeGuide: true, quizRounds: 5, sound: true, uiLocale: locale } }));
          await startLesson(page, size.phone);
          const seen = await walkBuilds(page, `${locale}-${size.width}x${size.height}`, size.phone, ask, placed);
          expect(seen.slides).toBeGreaterThanOrEqual(25);
        });
      });
    }
  }
});

test.describe('Sound on a sentence build (section 3.4 amendment 2026-10-17)', () => {
  test.use({ viewport: { width: 1280, height: 720 }, isMobile: false, hasTouch: false });

  test('Sound plays the whole sentence, before it is built and once it is', async ({ page }) => {
    await koreanVoice(page);
    await page.goto(link({ ...DECK, id: 'lecture:e2eb02', blocks: [{ kind: 'quest', id: 'quest:stage3-life-q3' }] }));
    await startLesson(page);
    const [n] = await buildSlides(page);
    await goto(page, n!);
    await page.keyboard.press('s');
    await expect.poll(() => lastSpoken(page)).toBe('친구가 학교에 가요.');
    await page.evaluate(() => (window as Window & { __spoken?: string[] }).__spoken?.splice(0));
    for (let i = 0; i < 4; i += 1) await page.keyboard.press('PageDown');
    expect(await page.getByTestId('presenter-build-whole').getAttribute('aria-hidden')).not.toBe('true');
    await page.keyboard.press('s');
    await expect.poll(() => lastSpoken(page)).toBe('친구가 학교에 가요.');
  });
});
