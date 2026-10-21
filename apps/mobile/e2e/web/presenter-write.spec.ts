import type { Page } from '@playwright/test';
import { encodeDeck, type LectureDeckInput } from '@hangul-route/content-schema';
import { expect, test } from './fixtures';
import { shot } from './shots';

/**
 * Row LV-S4 (AMENDMENTS-LECTURE-V2 sections 5.1 to 5.3, 10 and 14, LV-D8; design/screens/presenter/slide-write-together.md,
 * V10-V12): the write-together slides of shipped Stage 6 and Stage 7 lessons (type-hangul, trace-word, write-frame and the
 * Stage 7 name round) on the big screen at 1280 x 720 and 1920 x 1080, on a phone sideways (LV-M1) at 568 x 320 and
 * 844 x 390, and with Spanish and Korean slides. Every build of every write slide: the live region names the kind, the
 * slide carries the line that nothing is typed here, nothing leaves the content area (the stage on a phone), no text
 * spills out of its box and none is below the stage caption size or 18 px; the answer shows only at its build; the name
 * round shows its frame, then its sound table in two builds, and no name. Nothing on the slide takes input. Sound plays
 * the Korean on screen. Screenshots with `HR_SHOTS=1`.
 */

const DECK: LectureDeckInput = {
  v: 1,
  id: 'lecture:e2ew01',
  title: 'Write together',
  createdAt: '2026-10-20T09:00:00Z',
  seed: 7,
  blocks: [
    { kind: 'quest', id: 'quest:stage6-life-q1' }, // type prompts with pictures (Ask for water.)
    { kind: 'quest', id: 'quest:stage6-nature-q3' }, // the longest type prompt (Type the word for right, the way to the summit.)
    { kind: 'quest', id: 'quest:stage7-letters-q1' }, // trace 호야 and a four-syllable type target
    { kind: 'quest', id: 'quest:stage7-letters-q3' }, // two frames and the name round with its sound table
    { kind: 'quest', id: 'quest:stage7-life-q2' }, // a frame of five bank words (아침에 ___을/를 먹어요.)
    { kind: 'quest', id: 'quest:stage7-rites-q2' }, // trace 설날 and two-slot frames with two banks
  ],
  picker: null,
};

/** Stage numbers (presenter tokens and README constants). */
const STAGE_WIDTH = 1280;
const STAGE_PADDING = 48;
const CAPTION = 28;
const TEXT_FLOOR = 18;
const KIND = 'Write together';

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

/** The slide numbers of every write-together slide, read from the grid's thumbnails (named "n, Write together"; the grid speaks the device language). */
async function writeSlides(page: Page): Promise<number[]> {
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

/**
 * Every write-together slide, every build revealed: the live region, the line that nothing is typed here, the fit at
 * each build and the answer only at its build. Returns how many slides of each variant it walked.
 */
async function walkWrites(page: Page, label: string, phone: boolean, kind: string, where: string): Promise<Record<string, number>> {
  const seen: Record<string, number> = { type: 0, trace: 0, frame: 0, 'own-name': 0 };
  const stage = page.getByTestId('presenter-stage');
  for (const n of await writeSlides(page)) {
    await goto(page, n);
    const variant = (await stage.getByTestId('presenter-write').getAttribute('data-variant')) ?? '';
    seen[variant] = (seen[variant] ?? 0) + 1;
    expect(await liveText(page), `${label} slide ${n}`).toContain(kind);
    await expect(stage.getByTestId('presenter-kind-label')).toHaveText(kind);
    await expect(stage.getByTestId('presenter-write-where')).toHaveText(where);
    expect(await stage.locator('[role="button"], input, textarea').count(), `${label} slide ${n}: nothing to press or type in`).toBe(0);
    if (variant !== 'own-name') await expect(stage.getByTestId('presenter-write-answer').or(stage.getByTestId('presenter-write-bank'))).toHaveAttribute('aria-hidden', 'true');
    await expect.poll(() => fitProblems(page, phone), { message: `${label}: slide ${n} (${variant}), build 0`, timeout: 3000 }).toEqual([]);
    const korean = await stage.getByTestId('presenter-write-content').locator('[lang="ko"]').allInnerTexts();
    expect(korean.join('').trim().length, `${label} slide ${n}: Korean`).toBeGreaterThan(0);
    await shot(page, `presenter-write-${label}-${String(n).padStart(2, '0')}-0`);
    let step = 0;
    while ((await page.getByTestId('presenter-next').getAttribute('aria-label')) === 'Reveal') {
      await page.keyboard.press('PageDown');
      step += 1;
      await expect.poll(() => fitProblems(page, phone), { message: `${label}: slide ${n} (${variant}), build ${step}`, timeout: 3000 }).toEqual([]);
      if (variant === 'own-name') {
        await expect(stage.getByTestId('presenter-write-frame')).toHaveCount(0);
        await expect(stage.getByTestId('presenter-write-table-row')).toHaveCount(5);
      }
      await shot(page, `presenter-write-${label}-${String(n).padStart(2, '0')}-${step}`);
    }
    if (variant === 'type' || variant === 'trace') {
      expect(step, `${label} slide ${n}: one click to the answer`).toBe(1);
      await expect(stage.getByTestId('presenter-write-answer')).not.toHaveAttribute('aria-hidden', 'true');
      await expect(stage.getByTestId('presenter-write-gloss')).not.toHaveText('');
    }
    if (variant === 'frame') {
      expect(step).toBe(2);
      await expect(stage.getByTestId('presenter-write-example')).not.toHaveAttribute('aria-hidden', 'true');
      await expect(stage.getByTestId('presenter-write-example-ko')).not.toHaveText(/___|\//);
    }
    if (variant === 'own-name') expect(step).toBe(2);
  }
  return seen;
}

for (const size of [
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
] as const) {
  test.describe(`the write-together slides at ${size.width} x ${size.height}`, () => {
    test.use({ viewport: size, isMobile: false, hasTouch: false });

    test('every build of every write slide fits, names its kind and shows its answer only on the click', async ({ page }) => {
      test.setTimeout(240_000);
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      await koreanVoice(page);
      await page.goto(link());
      await startLesson(page);
      const seen = await walkWrites(page, `${size.width}x${size.height}`, false, KIND, 'Write on paper or on your own device. Nothing is typed here.');
      expect(seen.type).toBeGreaterThanOrEqual(10);
      expect(seen.trace).toBeGreaterThanOrEqual(10);
      expect(seen.frame).toBeGreaterThanOrEqual(5);
      expect(seen['own-name']).toBe(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      expect(errors).toEqual([]);
    });
  });
}

test.describe('the write-together slides on a phone sideways (LV-M1)', () => {
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
        const seen = await walkWrites(page, `phone-${size.width}x${size.height}`, true, KIND, 'Write on paper or on your own device. Nothing is typed here.');
        expect(seen['own-name']).toBe(1);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      });
    });
  }
});

test.describe('the write-together slides in Spanish and Korean (longer lines and prompts)', () => {
  for (const [locale, kind, where] of [
    ['es', 'Escribir en grupo', 'Escribe en papel o en tu propio dispositivo. Aquí no se escribe nada.'],
    ['ko', '함께 써요', '종이나 각자 기기에 써요. 이 화면에는 아무것도 입력하지 않아요.'],
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
          await page.goto(link({ ...DECK, id: `lecture:e2ew${locale}1`, options: { romanization: 'always', strokeGuide: true, quizRounds: 5, sound: true, uiLocale: locale } }));
          await startLesson(page, size.phone);
          const seen = await walkWrites(page, `${locale}-${size.width}x${size.height}`, size.phone, kind, where);
          expect(seen['own-name']).toBe(1);
        });
      });
    }
  }
});

test.describe('Sound on a write slide (section 3.4 amendment 2026-10-17)', () => {
  test.use({ viewport: { width: 1280, height: 720 }, isMobile: false, hasTouch: false });

  test('a type prompt plays nothing until its answer; a trace plays its word; a frame its example once shown', async ({ page }) => {
    await koreanVoice(page);
    await page.goto(link({ ...DECK, id: 'lecture:e2ew02', blocks: [{ kind: 'quest', id: 'quest:stage7-life-q1' }, { kind: 'quest', id: 'quest:stage7-life-q2' }] }));
    await startLesson(page);
    const stage = page.getByTestId('presenter-stage');
    const writes = await writeSlides(page);
    const variantAt = async (n: number) => {
      await goto(page, n);
      return stage.getByTestId('presenter-write').getAttribute('data-variant');
    };
    const spokenNow = () => page.evaluate(() => (window as Window & { __spoken?: string[] }).__spoken?.length ?? 0);
    let traced = false;
    let typed = false;
    let framed = false;
    for (const n of writes) {
      const variant = await variantAt(n);
      if (variant === 'trace' && !traced) {
        await page.keyboard.press('s');
        await expect.poll(() => lastSpoken(page)).toBe('아침');
        traced = true;
      }
      if (variant === 'type' && !typed) {
        const before = await spokenNow();
        await page.keyboard.press('s');
        await page.waitForTimeout(300);
        expect(await spokenNow(), 'nothing before the answer').toBe(before);
        await page.keyboard.press('PageDown');
        await page.keyboard.press('s');
        await expect.poll(() => lastSpoken(page)).toBe('아침');
        typed = true;
      }
      if (variant === 'frame' && !framed) {
        await page.keyboard.press('PageDown');
        await page.keyboard.press('PageDown');
        await page.keyboard.press('s');
        await expect.poll(() => lastSpoken(page)).toBe('아침에 밥을 먹어요.');
        framed = true;
      }
    }
    expect({ traced, typed, framed }).toEqual({ traced: true, typed: true, framed: true });
  });
});
