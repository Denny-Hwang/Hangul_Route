import type { Page } from '@playwright/test';
import { encodeDeck, type LectureDeckInput } from '@hangul-route/content-schema';
import { expect, test } from './fixtures';
import { shot } from './shots';

/**
 * Row LV-S2 (AMENDMENTS-LECTURE-V2 sections 5.1, 5.2, 10 and 14; design/screens/presenter/slide-listen-reply.md,
 * slide-realia.md "Realia question"): the question slides of shipped Stage 1, 3, 4 and 6 lessons on the big screen
 * at 1280 x 720 and 1920 x 1080, and on a phone sideways (LV-M1) at 568 x 320 and 844 x 390. Every question of the
 * deck (the listen questions of practice, apply and the Check, the reply questions of Tap to Respond, the realia
 * questions of Realia Read, and the earlier quizzes beside them), at its question build and its answer build: the
 * live region names it a question, its Korean is not empty, nothing leaves the content area (the stage on a phone),
 * no text spills out of its box and none is below the stage caption size or 18 px. The listen question's teacher-says
 * box keeps the Hangul for the answer build; Sound plays the prompt, the other speaker's line and the key word; the
 * answer line on a realia sheet is marked only at the answer build. The room answers by pointing: nothing on a
 * question slide takes input but the speaker. Screenshots with `HR_SHOTS=1`.
 */

const DECK: LectureDeckInput = {
  v: 1,
  id: 'lecture:e2eq01',
  title: 'Question slides',
  createdAt: '2026-10-17T09:00:00Z',
  seed: 7,
  blocks: [
    { kind: 'quest', id: 'quest:stage1-letters-q1' }, // a letter round and a word round (the Check)
    { kind: 'quest', id: 'quest:stage3-life-q1' }, // a picture round and a sentence round (the Check)
    { kind: 'quest', id: 'quest:stage4-life-q1' }, // reply questions (Tap to Respond)
    { kind: 'quest', id: 'quest:stage6-life-q3' }, // realia questions: Korean, figure and picture options on a menu
    { kind: 'quest', id: 'quest:stage6-nature-q1' }, // a five-board trail sign
    { kind: 'quest', id: 'quest:stage6-rites-q1' }, // a train ticket
    { kind: 'quest', id: 'quest:stage6-crafts-q1' }, // price cards
  ],
  picker: null,
};

/** Stage numbers (presenter tokens and README constants). */
const STAGE_WIDTH = 1280;
const STAGE_PADDING = 48;
const CAPTION = 28;
const TEXT_FLOOR = 18;

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

/** The slide numbers of every question, read from the grid's thumbnails (named "n, Question"). */
async function questionSlides(page: Page, kind = 'Question'): Promise<number[]> {
  await page.keyboard.press('g');
  const grid = page.getByTestId('presenter-grid');
  await expect(grid).toBeVisible();
  const names = await grid.locator('[data-testid^="presenter-grid-goto-"]').evaluateAll((els) => els.map((el) => el.getAttribute('aria-label') ?? ''));
  await page.keyboard.press('Escape');
  await expect(grid).toHaveCount(0);
  return names.flatMap((name) => {
    const [n, k] = name.split(', ');
    return k === kind ? [Number(n)] : [];
  });
}

async function goto(page: Page, n: number): Promise<void> {
  await page.keyboard.press('g');
  await page.getByTestId(`presenter-grid-goto-${n}`).click();
  await expect(page.getByTestId('presenter-grid')).toHaveCount(0);
  // The stage counter ("n / N") reads the same in every slide language.
  await expect(page.getByTestId('presenter-counter')).toHaveText(new RegExp(`^${n} / \\d+$`));
}

/** The answer build: the bar's Reveal (the chrome is English, the device language) steps to it. */
async function reveal(page: Page): Promise<void> {
  await expect(page.getByTestId('presenter-next')).toHaveAttribute('aria-label', 'Reveal');
  await page.keyboard.press('PageDown');
  await expect(page.getByTestId('presenter-next')).not.toHaveAttribute('aria-label', 'Reveal');
}

/**
 * What leaves the box (the content area: the stage less its padding; a phone's whole stage), and every text drawn
 * smaller than `min` pixels, on the open slide (the reading slides' check, presenter-reading.spec.ts).
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
        // A marker's numeral is SVG text in its 100-unit viewBox (its font size is in those units, the marker scales it): not stage text.
        if (own && el.closest('svg') === null && parseFloat(getComputedStyle(el).fontSize) < min) out.push(`small ${getComputedStyle(el).fontSize}: ${name}`);
        // A text never spills out of the box that holds it (an option row, a board, a price card, a chip).
        const parent = el.parentElement?.getBoundingClientRect();
        if (own && parent && (r.left < parent.left - 1 || r.right > parent.right + 1)) out.push(`spills: ${name}`);
      }
      return out;
    },
    { box, min },
  );
}

/** Nothing on the stage takes input but the listen question's speaker (the room answers by pointing, LV-D9). */
async function pressables(page: Page): Promise<number> {
  return page
    .getByTestId('presenter-stage')
    .locator('[role="button"]:not([data-testid="presenter-quiz-speaker"])')
    .count();
}

/**
 * Every question, at its question build and its answer build: its kind in the live region (`spoken`: the slide
 * language's word, the grid's is the chrome's), its Korean, its fit; returns how many of each kind it met.
 */
async function walkQuestions(page: Page, label: string, phone: boolean, spoken = 'Question'): Promise<Record<string, number> & { headings: Set<string> }> {
  const seen: Record<string, number> = { listen: 0, reply: 0, realia: 0, other: 0 };
  const headings = new Set<string>();
  for (const n of await questionSlides(page)) {
    await goto(page, n);
    expect(await liveText(page), `${label} slide ${n}`).toContain(`, ${spoken}`);
    const stage = page.getByTestId('presenter-stage');
    const which = (await stage.getByTestId('presenter-realia-question').count()) > 0 ? 'realia' : (await stage.getByTestId('presenter-quiz-said').count()) > 0 ? 'reply' : (await stage.getByTestId('presenter-question').count()) > 0 ? 'listen' : 'other';
    seen[which] = (seen[which] ?? 0) + 1;
    if (which !== 'other') headings.add((await stage.getByTestId('presenter-quiz-question').innerText()).trim());
    expect(await pressables(page), `${label} slide ${n}: nothing to press`).toBe(0);
    await shot(page, `presenter-questions-${label}-${String(n).padStart(2, '0')}-q`);
    await expect.poll(() => fitProblems(page, phone), { message: `${label}: slide ${n} (${which}), question`, timeout: 3000 }).toEqual([]);
    await reveal(page);
    const korean = await stage.locator('[lang="ko"]').allInnerTexts();
    expect(korean.join('').trim().length, `${label} slide ${n}: Korean`).toBeGreaterThan(0);
    await expect(stage.getByTestId('presenter-quiz-mark')).toHaveCount(1);
    await shot(page, `presenter-questions-${label}-${String(n).padStart(2, '0')}-a`);
    await expect.poll(() => fitProblems(page, phone), { message: `${label}: slide ${n} (${which}), answer`, timeout: 3000 }).toEqual([]);
  }
  return { ...seen, headings };
}

for (const size of [
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
] as const) {
  test.describe(`the question slides at ${size.width} x ${size.height}`, () => {
    test.use({ viewport: size, isMobile: false, hasTouch: false });

    test('every listen, reply and realia question fits at its question and its answer build, with a Korean voice', async ({ page }) => {
      test.setTimeout(180_000);
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      await koreanVoice(page);
      await page.goto(link());
      await startLesson(page);
      const seen = await walkQuestions(page, `${size.width}x${size.height}`, false);
      expect(seen.listen, 'listen').toBeGreaterThanOrEqual(6);
      expect(seen.reply, 'reply').toBeGreaterThanOrEqual(3);
      expect(seen.realia, 'realia').toBeGreaterThanOrEqual(15);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      expect(errors).toEqual([]);
    });
  });
}

test.describe('the question slides on a phone sideways (LV-M1)', () => {
  for (const size of [
    { width: 568, height: 320 },
    { width: 844, height: 390 },
  ] as const) {
    test.describe(`${size.width} x ${size.height}`, () => {
      test.use({ viewport: size, isMobile: true, hasTouch: true });

      test('every question stays inside the stage, no text below 18 px, no sideways scroll', async ({ page }) => {
        test.setTimeout(180_000);
        await page.addInitScript(() => {
          // Start asks for fullscreen; headless Chromium would resize the window to the upright screen (presenter-phone.spec.ts).
          Element.prototype.requestFullscreen = () => Promise.resolve();
        });
        await koreanVoice(page);
        await page.goto(link());
        await expect(page.getByTestId('presenter-start-footer')).toBeVisible();
        await startLesson(page, true);
        await expect(page.getByTestId('presenter-too-small')).toHaveCount(0);
        const seen = await walkQuestions(page, `phone-${size.width}x${size.height}`, true);
        expect(seen.listen + seen.reply + seen.realia).toBeGreaterThanOrEqual(24);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      });
    });
  }
});

test.describe('the question slides in Spanish and Korean (longer questions and meanings)', () => {
  for (const [locale, kind, listen] of [
    ['es', 'Pregunta', '¿Cuál escuchaste?'],
    ['ko', '문제', '어떤 것을 들었나요?'],
  ] as const) {
    for (const size of [
      { width: 1280, height: 720, phone: false },
      { width: 568, height: 320, phone: true },
    ] as const) {
      test.describe(`slides in ${locale} at ${size.width} x ${size.height}`, () => {
        test.use({ viewport: { width: size.width, height: size.height }, isMobile: size.phone, hasTouch: size.phone });

        test('every question fits, with its question in the slide language', async ({ page }) => {
          test.setTimeout(180_000);
          if (size.phone) {
            await page.addInitScript(() => {
              Element.prototype.requestFullscreen = () => Promise.resolve();
            });
          }
          await koreanVoice(page);
          await page.goto(link({ ...DECK, id: `lecture:e2eq${locale}1`, options: { romanization: 'always', strokeGuide: true, quizRounds: 5, sound: true, uiLocale: locale } }));
          await startLesson(page, size.phone);
          // The chrome (the grid's kind names, the bar) follows the device, English here; the stage speaks the slide language.
          const seen = await walkQuestions(page, `${locale}-${size.width}x${size.height}`, size.phone, kind);
          expect(seen.listen + seen.reply + seen.realia).toBeGreaterThanOrEqual(24);
          expect([...seen.headings]).toContain(listen);
        });
      });
    }
  }
});

test.describe('the listen question without a Korean voice (section 3.7)', () => {
  test.use({ viewport: { width: 1280, height: 720 }, isMobile: false, hasTouch: false });

  test('the teacher reads the romanization; the Hangul joins the Say it box at the answer build; no stage speaker', async ({ page }) => {
    // The suite's silent engine has no Korean voice (fixtures.ts), so the listen prompts are teacher-says text.
    await page.goto(link({ ...DECK, id: 'lecture:e2eq02', blocks: [{ kind: 'quest', id: 'quest:stage3-life-q1' }] }));
    await startLesson(page);
    const stage = page.getByTestId('presenter-stage');
    for (const n of await questionSlides(page)) {
      await goto(page, n);
      if ((await stage.getByTestId('presenter-question').count()) === 0) continue;
      await expect(stage.getByTestId('presenter-quiz-speaker')).toHaveCount(0);
      await expect(stage.getByTestId('presenter-say-it-rom')).toBeVisible();
      await expect(stage.getByTestId('presenter-say-it-ko')).toHaveCSS('opacity', '0');
      await shot(page, `presenter-questions-say-it-${n}-q`);
      await reveal(page);
      await expect(stage.getByTestId('presenter-say-it-ko')).toHaveCSS('opacity', '1');
      await shot(page, `presenter-questions-say-it-${n}-a`);
      await expect.poll(() => fitProblems(page, false), { timeout: 3000 }).toEqual([]);
    }
  });
});

test.describe('Sound and the reveal on the question slides (section 3.4 amendment 2026-10-17, V7)', () => {
  test.use({ viewport: { width: 1280, height: 720 }, isMobile: false, hasTouch: false });

  test("Sound plays a listen prompt, the other speaker's line and a realia key word; the found line shows only at the answer", async ({ page }) => {
    await koreanVoice(page);
    await page.goto(link({ ...DECK, id: 'lecture:e2eq03', blocks: [{ kind: 'quest', id: 'quest:stage4-life-q1' }, { kind: 'quest', id: 'quest:stage6-life-q3' }] }));
    await startLesson(page);
    const stage = page.getByTestId('presenter-stage');
    let listen = false;
    let reply = false;
    let found = false;
    for (const n of await questionSlides(page)) {
      await goto(page, n);
      if (!reply && (await stage.getByTestId('presenter-quiz-said').count()) > 0) {
        await page.keyboard.press('s');
        const said = (await stage.getByTestId('presenter-quiz-said').locator('[lang="ko"]').innerText()).trim();
        await expect.poll(() => lastSpoken(page)).not.toBe('');
        // The line's spoken form may differ from its spelling (spokenKo); it is never empty and never an option.
        expect((await lastSpoken(page)).length).toBeGreaterThan(0);
        expect(said.length).toBeGreaterThan(0);
        reply = true;
      } else if (!listen && (await stage.getByTestId('presenter-quiz-speaker').count()) > 0) {
        await stage.getByTestId('presenter-quiz-speaker').click();
        await expect.poll(() => lastSpoken(page)).not.toBe('');
        await reveal(page);
        const heard = (await stage.getByTestId('presenter-quiz-prompt-line').locator('[lang="ko"]').innerText()).trim();
        expect(heard.length).toBeGreaterThan(0);
        listen = true;
      } else if (!found && (await stage.getByTestId('presenter-realia-key').count()) > 0) {
        await expect(stage.getByTestId('presenter-realia-found')).toHaveCount(0);
        const key = (await stage.getByTestId('presenter-realia-key').locator('[lang="ko"]').innerText()).trim();
        await page.keyboard.press('s');
        await expect.poll(() => lastSpoken(page)).toBe(key);
        await reveal(page);
        await expect(stage.getByTestId('presenter-realia-ask')).toHaveAttribute('aria-hidden', 'true');
        await shot(page, 'presenter-questions-realia-found-1280x720');
        found = (await stage.getByTestId('presenter-realia-found').count()) === 1;
      }
    }
    expect({ listen, reply, found }).toEqual({ listen: true, reply: true, found: true });
  });
});
