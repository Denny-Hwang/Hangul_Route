import type { Page } from '@playwright/test';
import { encodeDeck, type LectureDeckInput, type UiLocale } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { expect, test } from './fixtures';
import { shot } from './shots';

/**
 * Row LV-S1 (AMENDMENTS-LECTURE-V2 sections 5.1, 5.2, 10 and 14; design/screens/presenter/slide-sentence.md,
 * slide-pattern.md, slide-read-along.md, slide-realia.md): the reading slides of shipped Stage 3, 4, 6 and 7
 * lessons on the big screen at 1280 x 720 and 1920 x 1080, and on a phone sideways (LV-M1) at 568 x 320 and
 * 844 x 390. Every sentence, sentence pattern, read along and realia slide, every build revealed: the live
 * region names its kind, the kind label is drawn (the realia page has none, V5), its Korean is not empty,
 * nothing leaves the content area (the stage on a phone), no text spills out of the box that holds it, and
 * no text is below the stage caption size or 18 px. Every realia layout is among them (menu, ticket, trail sign, price cards, the plain sheet), and
 * a two-slot frame. The same deck with Spanish and with Korean slides (`options.uiLocale`: longer notes,
 * captions and glosses) is walked at 1280 x 720 and 568 x 320. Sound on a read along plays the current line
 * and lights it while it plays; on a realia page it reads the sheet. Screenshots with `HR_SHOTS=1`.
 */

const DECK: LectureDeckInput = {
  v: 1,
  id: 'lecture:e2es01',
  title: 'Reading slides',
  createdAt: '2026-10-17T09:00:00Z',
  seed: 7,
  blocks: [
    { kind: 'quest', id: 'quest:stage3-life-q1' }, // sentences with pictures, a pattern
    { kind: 'quest', id: 'quest:stage3-life-q3' }, // a sentence with no picture
    { kind: 'quest', id: 'quest:stage4-life-q1' }, // exchanges
    { kind: 'quest', id: 'quest:stage6-life-q1' }, // a menu with its title
    { kind: 'quest', id: 'quest:stage6-life-q2' }, // the plain sheet (an order slip)
    { kind: 'quest', id: 'quest:stage6-nature-q1' }, // a five-board trail sign
    { kind: 'quest', id: 'quest:stage6-rites-q1' }, // a train ticket
    { kind: 'quest', id: 'quest:stage6-crafts-q1' }, // price cards
    { kind: 'quest', id: 'quest:stage7-rites-q2' }, // a two-slot frame
  ],
  picker: null,
};

/** The four kinds as the grid names them (the device language, English here). */
const KINDS = [{ kind: 'Sentence' }, { kind: 'Sentence pattern' }, { kind: 'Read along' }, { kind: 'Look and read' }] as const;
type GridKind = (typeof KINDS)[number]['kind'];

/** A kind as the stage names it in the slide language: in the live region, and the label it draws (V5; the realia page has none). */
function kindIn(locale: UiLocale, kind: GridKind): { name: string; label: string | null } {
  const m = getMessages(locale).learner.presenter;
  switch (kind) {
    case 'Sentence':
      return { name: m.grid.kind.sentence, label: m.slide.sentence.label };
    case 'Sentence pattern':
      return { name: m.grid.kind.pattern, label: m.slide.pattern.label };
    case 'Read along':
      return { name: m.grid.kind.readAlong, label: m.slide.readAlong.label };
    case 'Look and read':
      return { name: m.grid.kind.realia, label: null };
  }
}

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The live region's opening for slide `n` in the slide language ("Slide 3 of 40, " and its es / ko forms), then `what`. */
function liveOpening(locale: UiLocale, n: number, what = ''): RegExp {
  const ANY = 98765;
  const text = getMessages(locale).a11y.presenter.slide(n, ANY, what);
  return new RegExp(`^${escapeRegExp(text).replace(String(ANY), '\\d+')}`);
}

/** Stage numbers (presenter tokens and README constants). */
const STAGE_WIDTH = 1280;
const STAGE_PADDING = 48;
const CAPTION = 28;
const TEXT_FLOOR = 18;

function link(deck: LectureDeckInput = DECK): string {
  return `/present#d=${encodeDeck(deck)}`;
}

/** The walk's deck with its slides in `locale` (the chrome stays in the device language). */
function deckIn(locale: UiLocale): LectureDeckInput {
  return { ...DECK, id: locale === 'es' ? 'lecture:e2es03' : 'lecture:e2es04', options: { romanization: 'always', strokeGuide: true, quizRounds: 5, sound: true, uiLocale: locale } };
}

/** What Sound has asked the voice to say since entry `from` (the silent unlock utterance left out). */
async function spokenSince(page: Page, from: number): Promise<string[]> {
  return page.evaluate((at) => ((window as Window & { __spoken?: string[] }).__spoken ?? []).slice(at).filter((t) => t.trim() !== ''), from);
}

async function spokenCount(page: Page): Promise<number> {
  return page.evaluate(() => (window as Window & { __spoken?: string[] }).__spoken?.length ?? 0);
}

/**
 * A device with a Korean voice that takes `ms` to say anything; what it was asked is kept in
 * `window.__spoken`, so a spec can see the read-along light while a line plays.
 */
async function slowKoreanVoice(page: Page, ms: number): Promise<void> {
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

/** Reveal presses on the open slide until the bar reads Next. */
async function revealAll(page: Page): Promise<void> {
  for (let i = 0; i < 12 && (await page.getByTestId('presenter-next').getAttribute('aria-label')) === 'Reveal'; i++) await page.keyboard.press('PageDown');
}

/** The slide numbers of every reading slide, read from the grid's thumbnails (named "n, kind, title"). */
async function readingSlides(page: Page): Promise<Array<{ n: number; kind: string }>> {
  await page.keyboard.press('g');
  const grid = page.getByTestId('presenter-grid');
  await expect(grid).toBeVisible();
  const names = await grid.locator('[data-testid^="presenter-grid-goto-"]').evaluateAll((els) => els.map((el) => el.getAttribute('aria-label') ?? ''));
  await page.keyboard.press('Escape');
  await expect(grid).toHaveCount(0);
  return names.flatMap((name) => {
    const [n, kind] = name.split(', ');
    return KINDS.some((k) => k.kind === kind) ? [{ n: Number(n), kind: kind! }] : [];
  });
}

async function goto(page: Page, n: number, locale: UiLocale = 'en'): Promise<void> {
  await page.keyboard.press('g');
  await page.getByTestId(`presenter-grid-goto-${n}`).click();
  await expect(page.getByTestId('presenter-grid')).toHaveCount(0);
  await expect.poll(() => liveText(page)).toMatch(liveOpening(locale, n));
}

/**
 * What leaves the box (the content area: the stage less its padding; a phone's whole stage), and every
 * text drawn smaller than `min` pixels, on the open slide.
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
        // A text never spills out of the box that holds it (a price card, a board, a bubble, a chip).
        const parent = el.parentElement?.getBoundingClientRect();
        if (own && parent && (r.left < parent.left - 1 || r.right > parent.right + 1)) out.push(`spills: ${name}`);
      }
      return out;
    },
    { box, min },
  );
}

/** Every reading slide, every build revealed: its kind, its label, its Korean, its fit; returns the kinds seen. */
async function walkReading(page: Page, label: string, phone: boolean, locale: UiLocale = 'en'): Promise<Map<string, number>> {
  const seen = new Map<string, number>();
  for (const { n, kind } of await readingSlides(page)) {
    await goto(page, n, locale);
    await revealAll(page);
    seen.set(kind, (seen.get(kind) ?? 0) + 1);
    const named = kindIn(locale, kind as GridKind);
    expect(await liveText(page), `${label} slide ${n}`).toMatch(new RegExp(`${liveOpening(locale, n, `${named.name}, `).source}.+`));
    const want = named.label;
    const kindLabel = page.getByTestId('presenter-stage').getByTestId('presenter-kind-label');
    if (want === null) await expect(kindLabel).toHaveCount(0);
    else await expect(kindLabel).toHaveText(want);
    const korean = await page.getByTestId('presenter-stage').locator('[lang="ko"]').allInnerTexts();
    expect(korean.join('').trim().length, `${label} slide ${n}: Korean`).toBeGreaterThan(0);
    await expect.poll(() => fitProblems(page, phone), { message: `${label}: slide ${n} (${kind})`, timeout: 3000 }).toEqual([]);
    await shot(page, `presenter-reading-${label}-${String(n).padStart(2, '0')}`);
  }
  return seen;
}

for (const size of [
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
] as const) {
  test.describe(`the reading slides at ${size.width} x ${size.height}`, () => {
    test.use({ viewport: size, isMobile: false, hasTouch: false });

    test('every sentence, pattern, read along and realia slide fits, with its kind, label and Korean', async ({ page }) => {
      test.setTimeout(120_000);
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      await page.goto(link());
      await startLesson(page);
      const seen = await walkReading(page, `${size.width}x${size.height}`, false);
      for (const { kind } of KINDS) expect(seen.get(kind) ?? 0, kind).toBeGreaterThan(0);
      // Every realia layout and both frame shapes are in the walk.
      expect(seen.get('Look and read')).toBeGreaterThanOrEqual(5);
      // A short pattern keeps the mock's sizes; only a long one steps to a compact level.
      const firstPattern = (await readingSlides(page)).find((s) => s.kind === 'Sentence pattern')!;
      await goto(page, firstPattern.n);
      await revealAll(page);
      await expect(page.getByTestId('presenter-pattern-content')).toHaveAttribute('data-fit', '0');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      expect(errors).toEqual([]);
    });
  });
}

test.describe('the reading slides on a phone sideways (LV-M1)', () => {
  for (const size of [
    { width: 568, height: 320 },
    { width: 844, height: 390 },
  ] as const) {
    test.describe(`${size.width} x ${size.height}`, () => {
      test.use({ viewport: size, isMobile: true, hasTouch: true });

      test('every reading slide stays inside the stage, no text below 18 px, no sideways scroll', async ({ page }) => {
        test.setTimeout(120_000);
        await page.addInitScript(() => {
          // Start asks for fullscreen; headless Chromium would resize the window to the upright screen (presenter-phone.spec.ts).
          Element.prototype.requestFullscreen = () => Promise.resolve();
        });
        await page.goto(link());
        await expect(page.getByTestId('presenter-start-footer')).toBeVisible();
        await startLesson(page, true);
        await expect(page.getByTestId('presenter-too-small')).toHaveCount(0);
        const seen = await walkReading(page, `phone-${size.width}x${size.height}`, true);
        for (const { kind } of KINDS) expect(seen.get(kind) ?? 0, kind).toBeGreaterThan(0);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      });
    });
  }
});

test.describe('the reading slides in Spanish and Korean (longer notes, captions and glosses)', () => {
  for (const locale of ['es', 'ko'] as const) {
    test.describe(`slides in ${locale} at 1280 x 720`, () => {
      test.use({ viewport: { width: 1280, height: 720 }, isMobile: false, hasTouch: false });

      test('every reading slide fits, with its kind and label in the slide language and its Korean', async ({ page }) => {
        test.setTimeout(120_000);
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(String(e)));
        await page.goto(link(deckIn(locale)));
        await startLesson(page);
        const seen = await walkReading(page, `${locale}-1280x720`, false, locale);
        for (const { kind } of KINDS) expect(seen.get(kind) ?? 0, kind).toBeGreaterThan(0);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
        expect(errors).toEqual([]);
      });
    });

    test.describe(`slides in ${locale} on a phone sideways at 568 x 320`, () => {
      test.use({ viewport: { width: 568, height: 320 }, isMobile: true, hasTouch: true });

      test('every reading slide stays inside the stage, no text below 18 px', async ({ page }) => {
        test.setTimeout(120_000);
        await page.addInitScript(() => {
          Element.prototype.requestFullscreen = () => Promise.resolve();
        });
        await page.goto(link(deckIn(locale)));
        await expect(page.getByTestId('presenter-start-footer')).toBeVisible();
        await startLesson(page, true);
        await expect(page.getByTestId('presenter-too-small')).toHaveCount(0);
        const seen = await walkReading(page, `${locale}-phone-568x320`, true, locale);
        for (const { kind } of KINDS) expect(seen.get(kind) ?? 0, kind).toBeGreaterThan(0);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      });
    });
  }
});

test.describe('Sound on the reading slides (section 3.4 amendment 2026-10-17, V6)', () => {
  test.use({ viewport: { width: 1280, height: 720 }, isMobile: false, hasTouch: false });

  test('a read along plays its current line and lights it while it plays; a realia page reads its sheet', async ({ page }) => {
    await slowKoreanVoice(page, 900);
    await page.goto(link({ ...DECK, id: 'lecture:e2es02', blocks: [{ kind: 'quest', id: 'quest:stage4-life-q1' }, { kind: 'quest', id: 'quest:stage6-life-q1' }] }));
    await startLesson(page);
    const slides = await readingSlides(page);
    const readAlong = slides.find((s) => s.kind === 'Read along')!;
    await goto(page, readAlong.n);
    // Line A only: Sound plays it and lights it.
    const lines = page.getByTestId('presenter-read-along-line');
    const lineA = (await lines.nth(0).getAttribute('aria-label'))!;
    const beforeA = await spokenCount(page);
    await page.keyboard.press('s');
    await expect(lines.nth(0).getByTestId('presenter-read-along-playing')).toBeVisible();
    await shot(page, 'presenter-reading-read-along-lit-a-1280x720');
    // The voice was asked to say line A (waiting for the speak, which comes after the clip try).
    await expect.poll(async () => (await spokenSince(page, beforeA)).some((t) => lineA.includes(t))).toBe(true);
    // The light goes when the line ends.
    await expect(page.getByTestId('presenter-read-along-playing')).toHaveCount(0, { timeout: 3000 });
    // Line B: now the current line.
    await revealAll(page);
    const lineB = (await lines.nth(1).getAttribute('aria-label')) ?? '';
    const beforeB = await spokenCount(page);
    await page.keyboard.press('s');
    await expect(lines.nth(1).getByTestId('presenter-read-along-playing')).toBeVisible();
    await expect(lines.nth(0).getByTestId('presenter-read-along-playing')).toHaveCount(0);
    await shot(page, 'presenter-reading-read-along-lit-b-1280x720');
    await expect.poll(async () => (await spokenSince(page, beforeB)).some((t) => lineB.includes(t) && !lineA.includes(t))).toBe(true);
    await expect(page.getByTestId('presenter-read-along-playing')).toHaveCount(0, { timeout: 3000 });

    const realia = slides.find((s) => s.kind === 'Look and read')!;
    await goto(page, realia.n);
    const beforeSheet = await spokenCount(page);
    await page.keyboard.press('s');
    // The sheet, line by line: its title first.
    await expect.poll(async () => (await spokenSince(page, beforeSheet)).some((t) => t.startsWith('메뉴, '))).toBe(true);
  });
});
