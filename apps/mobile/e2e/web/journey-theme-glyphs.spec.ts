import type { Locator, Page } from '@playwright/test';
import { availableLocales, getMessages, type Locale } from '@hangul-route/i18n';
import { expect, test } from './fixtures';
import { completeChildForm, keepSidewaysIfAsked, readStored, seedStored, waitForSaved } from './helpers';
import { shot } from './shots';
import { expectNoHorizontalOverflow } from './viewport';

/**
 * The Journey's theme glyphs and cell words (owner decision 2026-10-14 and owner request 2026-10-14;
 * design/components/Icon/theme-glyphs.md, wireframe journey/grid): every cell draws its theme's glyph
 * instead of the letters L / F / H / N / P with the theme word under it, each column label shows the
 * same glyph over the same word, the glyphs and the cell word are hidden from screen readers, and each
 * cell's accessible name names its theme in words. The corner marks (story count, start pin), the Next
 * triangle and the rings never cover the glyph or the word. The learner has a level-check result in
 * Stage 1, so the grid draws the start pin and the spec checks it too. Checked at 320 px, 768 px and a 1180 px wide window (two panes, the grid in the 400 dp master
 * pane), in English on every run and in Spanish and Korean on a build that shows every language:
 *
 *   HR_SHOTS=1 pnpm --filter @hangul-route/mobile test:e2e:web journey-theme-glyphs
 *   EXPO_PUBLIC_SHOW_ALL_LOCALES=1 build, then E2E_ALL_LOCALES=1 HR_SHOTS=1 ... journey-theme-glyphs
 */

const THEMES = [
  { key: 'letters', title: 'Letters & Books' },
  { key: 'life', title: 'Food & Daily Life' },
  { key: 'rites', title: 'Holidays & Traditions' },
  { key: 'nature', title: 'Nature & Animals' },
  { key: 'crafts', title: 'Play & Crafts' },
] as const;

type Box = { x: number; y: number; width: number; height: number };

const area = (a: Box, b: Box): number =>
  Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));

async function boxOf(locator: Locator): Promise<Box> {
  const box = await locator.boundingBox();
  expect(box).toBeTruthy();
  return box as Box;
}

const AT = '2026-10-09T10:00:00.000Z';
/** A level-check result in Stage 1 (F-PLC-001 section 3.7), so the grid draws its start pin. */
interface SeedOptions {
  placedOutQuestIds?: string[];
  completedQuestIds?: { questId: string; episodeId: string }[];
}

async function seedStart(page: Page, opts: SeedOptions = {}): Promise<void> {
  const profileId = (await readStored<Array<{ id: string }>>(page, 'profiles'))?.[0]?.id ?? '';
  expect(profileId).not.toBe('');
  const progress = (await readStored<Record<string, unknown>>(page, `progress:${profileId}`)) ?? {
    profileId,
    updatedAt: AT,
    episodes: [],
    quests: [],
    cards: [],
    sessions: [],
    homework: [],
    reviews: [],
    streakDays: 0,
  };
  await seedStored(page, `progress:${profileId}`, {
    ...progress,
    quests: (opts.completedQuestIds ?? []).map((q) => ({ ...q, startedAt: AT, completedAt: AT, stars: 3, attempts: 1, accuracy: 1 })),
    placements: [
      {
        id: 'placement:seeded',
        startedAt: AT,
        completedAt: AT,
        source: 'home',
        testLocale: 'en',
        length: 'full',
        mode: 'standard',
        revealMode: 'tap',
        bankVersion: 1,
        contentVer: 'e2e',
        responses: [],
        gates: [],
        strands: { 'hangul-recognition': 'not-tested', 'sound-letter': 'not-tested', 'syllable-reading': 'not-tested', vocabulary: 'not-tested', sentences: 'not-tested' },
        level: { stage: 'stage1', band: 1 },
        oralStage: null,
        beyondContent: false,
        startQuestId: 'quest:stage1-nature-q1',
        placedOutQuestIds: opts.placedOutQuestIds ?? [],
        priorityTokens: [],
        needsStage: null,
        stopReason: 'complete',
      },
    ],
  });
}

async function openJourney(page: Page, width: number, height: number, locale: Locale, seed: SeedOptions = {}): Promise<void> {
  await page.setViewportSize({ width, height });
  await page.goto('/');
  await keepSidewaysIfAsked(page);
  await page.getByRole('button', { name: "Let's start" }).click();
  await completeChildForm(page, { name: 'Dami' });
  await waitForSaved(page, ['profiles']);
  await seedStart(page, seed);
  if (locale !== 'en') {
    // The locale is read at start-up: store it, then reload so the whole app comes up in it.
    await seedStored(page, 'device:settings', { uiLocale: locale });
  }
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', new RegExp(`^${locale}`));
  const m = getMessages(locale);
  const guide = page.getByTestId('install-guide');
  await guide.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
  if (await guide.isVisible()) await guide.getByRole('button', { name: m.caregiver.install.notNow.cta }).click();
  await page.getByText(m.a11y.tabs.journey, { exact: true }).last().click();
  await expect(page.getByRole('heading', { name: m.learner.journey.title })).toBeVisible();
}

for (const locale of availableLocales(process.env.E2E_ALL_LOCALES === '1')) {
  const words = getMessages(locale).learner.journey.themeWord;
  for (const [width, height] of [
    [320, 568],
    [768, 1024],
    [1180, 820],
  ] as const) {
    test(`${width} px, ${locale}: theme glyphs with their word in the cells and over the column labels; no mark covers them`, async ({ page }) => {
      await openJourney(page, width, height, locale);

      for (const theme of THEMES) {
        // The column: the glyph (hidden) over the word (read).
        const column = page.getByTestId(`journey-col-${theme.key}`);
        const headerGlyph = page.getByTestId(`journey-col-glyph-${theme.key}`);
        await expect(headerGlyph).toBeVisible();
        await expect(headerGlyph).toHaveAttribute('aria-hidden', 'true');
        await expect(column).toContainText(words[theme.key]);
        const [glyphBox, columnBox] = await Promise.all([boxOf(headerGlyph), boxOf(column)]);
        expect(glyphBox.x).toBeGreaterThanOrEqual(columnBox.x - 0.5);
        expect(glyphBox.x + glyphBox.width).toBeLessThanOrEqual(columnBox.x + columnBox.width + 0.5);

        // The Stage 1 cell: its glyph and its word sit inside it, both hidden; no letter is drawn.
        const glyph = page.getByTestId(`journey-glyph-stage1-${theme.key}`);
        const word = page.getByTestId(`journey-word-stage1-${theme.key}`);
        const cell = page.getByRole('button').filter({ has: glyph });
        await expect(cell).toHaveCount(1);
        if (locale === 'en') {
          // The name says the theme in words, once: the hidden word under the glyph adds nothing to it.
          await expect(cell).toHaveAccessibleName(new RegExp(`^Stage 1 Hangul, ${theme.title.replace('&', '\\&')}: lesson`));
        }
        await expect(glyph).toBeVisible();
        await expect(glyph).toHaveAttribute('aria-hidden', 'true');
        await expect(word).toBeVisible();
        await expect(word).toHaveAttribute('aria-hidden', 'true');
        await expect(word).toHaveText(words[theme.key]);
        expect((await cell.innerText()).trim()).not.toMatch(/^[LFHNP]$/);
        const [g, w, c] = await Promise.all([boxOf(glyph), boxOf(word), boxOf(cell)]);
        expect(g.x).toBeGreaterThan(c.x);
        expect(g.y).toBeGreaterThan(c.y);
        expect(g.x + g.width).toBeLessThan(c.x + c.width);
        // The glyph is centred across its cell, and the word sits under it, inside the cell.
        expect(Math.abs(g.x + g.width / 2 - (c.x + c.width / 2))).toBeLessThan(1);
        expect(w.y).toBeGreaterThanOrEqual(g.y + g.height - 0.5);
        expect(w.x).toBeGreaterThanOrEqual(c.x);
        expect(w.x + w.width).toBeLessThanOrEqual(c.x + c.width);
        expect(w.y + w.height).toBeLessThanOrEqual(c.y + c.height);
        // One line, never clipped: the text is no wider than its box and no taller than one line.
        const fit = await word.evaluate((el) => {
          const text = (el.firstElementChild ?? el) as HTMLElement;
          const range = document.createRange();
          range.selectNodeContents(text);
          return { lines: range.getClientRects().length, scroll: text.scrollWidth, client: text.clientWidth, ink: range.getBoundingClientRect().width };
        });
        expect(fit.lines, `${locale} ${theme.key} "${words[theme.key]}"`).toBe(1);
        expect(fit.scroll, `${locale} ${theme.key}`).toBeLessThanOrEqual(fit.client);
        expect(fit.ink, `${locale} ${theme.key}`).toBeLessThanOrEqual(c.width);
      }

      // The story count mark keeps its corner and clears both the glyph and the word, at every width.
      let counts = 0;
      for (const theme of THEMES) {
        const mark = page.getByTestId(`journey-count-stage1-${theme.key}`);
        if ((await mark.count()) === 0) continue;
        counts += 1;
        const [m, g, w] = await Promise.all([
          boxOf(mark),
          boxOf(page.getByTestId(`journey-glyph-stage1-${theme.key}`)),
          boxOf(page.getByTestId(`journey-word-stage1-${theme.key}`)),
        ]);
        expect(area(m, g), theme.key).toBe(0);
        expect(area(m, w), theme.key).toBe(0);
      }
      expect(counts).toBeGreaterThan(0);

      // The Next triangle: one, clear of its cell's glyph and word.
      const next = page.locator('[data-testid^="journey-next-"]');
      await expect(next).toHaveCount(1);
      const nextId = String(await next.getAttribute('data-testid')).replace('journey-next-', '');
      const nextGlyph = page.getByTestId(`journey-glyph-${nextId}`);
      if ((await nextGlyph.count()) === 1) {
        const [n, g, w] = await Promise.all([boxOf(next), boxOf(nextGlyph), boxOf(page.getByTestId(`journey-word-${nextId}`))]);
        expect(area(n, g)).toBe(0);
        expect(area(n, w)).toBe(0);
      }

      // The start pin (the seeded level check) never covers its cell's glyph or word. The pin follows the
      // cursor's stage rule (OD-4), so it lands on the cell the learner starts from; the unit geometry
      // (journey-cell-layout.test.ts) checks the pin against every glyph, the leaf's up-left tip included.
      const start = page.getByTestId('journey-cell-start');
      await expect(start).toHaveCount(1);
      const startGlyph = start.locator('[data-testid^="journey-glyph-"]');
      await expect(startGlyph).toHaveCount(1);
      const startId = String(await startGlyph.getAttribute('data-testid')).replace('journey-glyph-', '');
      const pin = start.getByTestId('journey-start-pin');
      const [p, pg, pw] = await Promise.all([boxOf(pin), boxOf(startGlyph), boxOf(page.getByTestId(`journey-word-${startId}`))]);
      expect(area(p, pg), startId).toBe(0);
      expect(area(p, pw), startId).toBe(0);

      // A ring (In your plan, Not open yet) goes round the glyph and ends above the word; on a coming-later
      // cell (no word) it stays inside its cell.
      for (const ring of await page.locator('[data-testid^="journey-ring-"]').all()) {
        const id = String(await ring.getAttribute('data-testid')).replace(/^journey-ring-(inPlan|notOpen)-/, '');
        const r = await boxOf(ring);
        const word = page.getByTestId(`journey-word-${id}`);
        if ((await word.count()) === 1) {
          expect(r.y + r.height, id).toBeLessThanOrEqual((await boxOf(word)).y + 0.5);
        } else {
          const c = await boxOf(page.getByRole('button').filter({ has: ring }));
          expect(r.x, id).toBeGreaterThanOrEqual(c.x);
          expect(r.y, id).toBeGreaterThanOrEqual(c.y);
          expect(r.x + r.width, id).toBeLessThanOrEqual(c.x + c.width);
          expect(r.y + r.height, id).toBeLessThanOrEqual(c.y + c.height);
        }
      }

      // No cell anywhere on the grid shows a bare letter.
      const cellTexts = await page.locator('[data-testid^="journey-stage-"] [role="button"]').allInnerTexts();
      expect(cellTexts.length).toBeGreaterThanOrEqual(35);
      for (const text of cellTexts) expect(text.trim()).not.toMatch(/^[A-Z]$/);

      await expectNoHorizontalOverflow(page);
      await shot(page, `journey-theme-glyphs-${width}-${locale}`);
    });
  }
}

/**
 * A cell with the start pin, the placed-out check and a story count (the pin comes from the stored level check,
 * the check from live progress): Letters' first quest was placed out, so the pin is on its second, and the
 * learner then finished the second and the third. The count mark stays, under the check, and nothing in the
 * cell overlaps anything else or leaves the cell.
 */
for (const [width, height] of [
  [320, 568],
  [768, 1024],
  [1180, 820],
] as const) {
  test(`${width} px: a cell with the start pin, the placed-out check and a story count draws all three, clear of each other`, async ({ page }) => {
    await openJourney(page, width, height, 'en', {
      placedOutQuestIds: ['quest:stage1-letters-q1'],
      completedQuestIds: [
        { questId: 'quest:stage1-letters-q2', episodeId: 'episode:stage1-letters' },
        { questId: 'quest:stage1-letters-q3', episodeId: 'episode:stage1-letters' },
      ],
    });
    const cell = page.getByRole('button').filter({ has: page.getByTestId('journey-glyph-stage1-letters') });
    await expect(cell).toHaveCount(1);
    await expect(cell).toHaveAttribute('data-testid', 'journey-cell-start');
    const pin = cell.getByTestId('journey-start-pin');
    const check = cell.getByTestId('journey-placed-out-check');
    const count = cell.getByTestId('journey-count-stage1-letters');
    await expect(count).toBeVisible();
    await expect(count).toHaveAttribute('aria-hidden', 'true');
    const [c, p, k, n, g, w] = await Promise.all([
      boxOf(cell),
      boxOf(pin),
      boxOf(check),
      boxOf(count),
      boxOf(page.getByTestId('journey-glyph-stage1-letters')),
      boxOf(page.getByTestId('journey-word-stage1-letters')),
    ]);
    for (const [name, b] of [
      ['pin', p],
      ['check', k],
      ['count', n],
      ['glyph', g],
      ['word', w],
    ] as const) {
      expect(b.x, name).toBeGreaterThanOrEqual(c.x);
      expect(b.y, name).toBeGreaterThanOrEqual(c.y);
      expect(b.x + b.width, name).toBeLessThanOrEqual(c.x + c.width);
      expect(b.y + b.height, name).toBeLessThanOrEqual(c.y + c.height);
    }
    expect(area(n, p)).toBe(0);
    expect(area(n, k)).toBe(0);
    expect(area(p, k)).toBe(0);
    expect(area(n, g)).toBe(0);
    expect(area(n, w)).toBe(0);
    expect(area(k, g)).toBe(0);
    // the count sits right of centre, under the check that owns the top right corner
    expect(n.x + n.width / 2).toBeGreaterThan(c.x + c.width / 2);
    expect(n.y).toBeGreaterThanOrEqual(k.y + k.height);
    // the label still names the stories
    expect(String(await cell.getAttribute('aria-label'))).toMatch(/stor/i);
    // every cell in that row is one height, its words on one line
    const row = await Promise.all(
      THEMES.map(async (t) => {
        const rc = page.getByRole('button').filter({ has: page.getByTestId(`journey-word-stage1-${t.key}`) });
        return { c: await boxOf(rc), w: await boxOf(page.getByTestId(`journey-word-stage1-${t.key}`)) };
      }),
    );
    for (const r of row) {
      expect(Math.abs(r.c.height - c.height)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(r.w.y - w.y)).toBeLessThanOrEqual(0.5);
    }
    await expectNoHorizontalOverflow(page);
    await shot(page, `journey-cell-pin-check-count-${width}`);
  });
}
