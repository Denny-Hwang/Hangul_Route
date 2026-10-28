import type { Locator, Page } from '@playwright/test';
import { colors, touchTarget } from '@hangul-route/design-system/tokens';
import { expect, test } from './fixtures';
import { completeChildForm, headerClose, journeyCellName, keepSidewaysIfAsked, playCheckByIds, seedStored } from './helpers';
import { shot } from './shots';
import { expectNoHorizontalOverflow } from './viewport';

/**
 * F-CURR-002 row CM-33 (sections 5.2, 7.1 F4, 7.7, 12.2; design/wireframes/minigame/match-shape.md): the Stage 1
 * addition, Play & Crafts quest 4 "Where Shapes Come From", on the web PWA. With `game.match-shape` on (the stored
 * remote copy, as `daily-review.spec.ts`; the release build has no API) the quest plays Match Shape: an origin round
 * shows a drawn picture and one sourced line, asks for the letter among three and waits for Continue; "Where this comes
 * from" opens the sources in place as plain text (no link); a pair round asks for every copy of a letter among look-
 * alikes. A miss is the amber nudge, never red. Off (the built-in pct 0), the same steps play Read Pick. At 320 px
 * nothing scrolls sideways and every tile is at least `touchTarget.min` square; tiles carry screen-reader names; reduced
 * motion changes nothing a learner must do. Nothing here needs a Korean voice or a network.
 */

const rgbOf = (hex: string): string => {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};
const RED = rgbOf(colors.feedback.danger);

/** The colours a tile is drawn in: its own and every descendant's border and fill. */
const drawnColors = (target: Locator): Promise<string[]> =>
  target.evaluate((el) =>
    [el, ...Array.from(el.querySelectorAll('*'))].flatMap((n) => {
      const cs = getComputedStyle(n);
      return [cs.borderTopColor, cs.backgroundColor, cs.color];
    }),
  );

type Origin = { kind: 'origin'; target: string; wrong?: string };
type Pair = { kind: 'pair'; copies: number[]; wrong?: number };

/** Practice: the five basic consonants and ㅂ / ㅍ. Apply: ㅡ ㅣ, ㅓ / ㅗ, ㅏ, ㅏ / ㅓ and ㄹ / ㄷ. */
const PRACTICE: Array<Origin | Pair> = [
  { kind: 'origin', target: 'nieun', wrong: 'giyeok' },
  { kind: 'origin', target: 'giyeok' },
  { kind: 'pair', copies: [0, 3, 5], wrong: 1 },
  { kind: 'origin', target: 'mieum' },
  { kind: 'origin', target: 'siot' },
  { kind: 'origin', target: 'ieung' },
];
const APPLY: Array<Origin | Pair> = [
  { kind: 'origin', target: 'eu' },
  { kind: 'origin', target: 'i' },
  { kind: 'pair', copies: [1, 4, 5] },
  { kind: 'origin', target: 'a' },
  { kind: 'pair', copies: [0, 2, 5] },
  { kind: 'pair', copies: [1, 2, 5] },
];

async function onboard(page: Page, matchShapeOn: boolean): Promise<void> {
  await page.goto('/');
  await keepSidewaysIfAsked(page);
  await page.getByRole('button', { name: "Let's start" }).click();
  await completeChildForm(page, { name: 'Dami' });
  if (matchShapeOn) await seedStored(page, 'remote-config', { v: 1, fetchedAt: Date.now(), maxAgeS: 300, flags: { 'game.match-shape': { on: true, pct: 100 } } });
  await page.goto('/');
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
  const guide = page.getByTestId('install-guide');
  await guide.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
  if (await guide.isVisible()) await guide.getByRole('button', { name: 'Not now' }).click();
}

/** Open Play & Crafts and start its quest 4 (the quests before it are not done: the soft prerequisite sheet asks). */
async function startShapesQuest(page: Page): Promise<void> {
  await page.getByText('Journey', { exact: true }).last().click();
  await page.getByRole('button', { name: journeyCellName(1, 'Play & Crafts') }).click();
  await expect(page.getByText('Where Shapes Come From', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Start', exact: true }).nth(3).click();
  await page.getByRole('button', { name: 'Play anyway' }).click();
  await expect(headerClose(page)).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click(); // the intro step
  await page.getByRole('button', { name: 'Play minigame' }).click();
}

/**
 * Tap a target until `done` holds (a tap inside the board's double-touch window is dropped). A tap is skipped once the
 * screen has moved on, so a round that advanced is never tapped again.
 */
async function tapUntil(target: Locator, done: () => Promise<boolean>): Promise<void> {
  await expect(async () => {
    if (!(await done())) await target.click({ timeout: 1_000 }).catch(() => undefined);
    await expect.poll(done, { timeout: 3_000 }).toBe(true);
  }).toPass({ timeout: 30_000 });
}

const visible = (target: Locator) => (): Promise<boolean> => target.isVisible();

async function playOrigin(page: Page, round: Origin, checks?: (page: Page) => Promise<void>): Promise<void> {
  await expect(page.getByRole('heading', { name: 'Which letter comes from this shape?' })).toBeVisible();
  if (round.wrong !== undefined) {
    const wrong = page.getByTestId(`match-shape-tile-jamo:${round.wrong}`);
    await tapUntil(wrong, visible(page.getByText('Look at the picture again. Which letter has that shape?')));
    expect(await drawnColors(wrong)).not.toContain(RED);
  }
  await tapUntil(page.getByTestId(`match-shape-tile-jamo:${round.target}`), visible(page.getByTestId('match-shape-continue')));
  await expect(page.getByTestId('match-shape-note')).toBeVisible();
  if (checks) await checks(page);
  await page.getByTestId('match-shape-continue').click();
}

async function playPair(page: Page, round: Pair, checks?: (page: Page) => Promise<void>, last = false): Promise<void> {
  const shown = page.getByTestId('match-shape-heading').filter({ visible: true });
  await expect(shown).toBeVisible();
  if (checks) await checks(page);
  if (round.wrong !== undefined) {
    const wrong = page.getByTestId(`match-shape-tile-${round.wrong}`);
    await tapUntil(wrong, visible(page.getByTestId('match-shape-diff')));
    expect(await drawnColors(wrong)).not.toContain(RED);
  }
  const heading = await shown.getAttribute('aria-label');
  for (const i of round.copies) {
    const tile = page.getByTestId(`match-shape-tile-${i}`);
    await tapUntil(tile, async () => /, found$/.test((await tile.getAttribute('aria-label', { timeout: 1_000 }).catch(() => null)) ?? ''));
  }
  // The round moves on by itself once every copy is found: the next round's heading. After a step's last round the
  // quest moves to its next step, whose screen can sit over the finished one while it stays mounted, so the caller
  // waits for that next step's own controls instead.
  if (last) return;
  // Read every heading in one pass (no auto-wait): a heading that leaves between a count and a read never stalls it.
  await expect
    .poll(async () => (await shown.evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')))).every((label) => label !== heading))
    .toBe(true);
}

async function playStep(page: Page, rounds: ReadonlyArray<Origin | Pair>, checks: Record<number, (page: Page) => Promise<void>> = {}): Promise<void> {
  await expect(page.getByTestId('match-shape-game')).toBeVisible();
  for (const [i, round] of rounds.entries()) {
    if (round.kind === 'origin') await playOrigin(page, round, checks[i]);
    else await playPair(page, round, checks[i], i === rounds.length - 1);
  }
}

/** Every visible tile at least `touchTarget.min` in both dimensions (the 48 dp floor is met with room to spare). */
async function expectTileTargets(page: Page): Promise<void> {
  const tiles = page.locator('[data-testid^="match-shape-tile-"]');
  const n = await tiles.count();
  expect(n).toBeGreaterThan(0);
  for (let i = 0; i < n; i += 1) {
    const box = await tiles.nth(i).boundingBox();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(touchTarget.min);
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(touchTarget.min);
  }
}

test.describe('Match Shape on (game.match-shape at 100)', () => {
  test('at 320 px: the origin picture and its sourced line, sources in place, look-alike pairs, then the Check', async ({ page }) => {
    test.setTimeout(180_000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.setViewportSize({ width: 320, height: 568 });
    await onboard(page, true);
    await startShapesQuest(page);

    await playStep(page, PRACTICE, {
      0: async (p) => {
        // The picture is the prompt: an image named by its fact; the tiles name their letter and sound.
        await expect(p.getByTestId('match-shape-art')).toBeVisible();
        await expect(p.getByTestId('match-shape-note')).toHaveText('The tongue touches the upper gum.');
        await expect(p.getByRole('button', { name: 'ㄴ, n', exact: true })).toBeVisible();
        await expect(p.getByRole('button', { name: 'ㄱ, g or k', exact: true })).toBeVisible();
        await expectTileTargets(p);
        await expectNoHorizontalOverflow(p);
        // Where this comes from: plain text in place, the institutions named, no link anywhere on the round.
        await p.getByRole('button', { name: 'Where this comes from' }).click();
        await expect(p.getByTestId('match-shape-sources')).toHaveAttribute('aria-expanded', 'true');
        await expect(p.getByTestId('match-shape-source').first()).toContainText('National Institute of Korean Language');
        await expect(p.getByTestId('match-shape-source').last()).toContainText('National Hangeul Museum');
        await expect(p.getByTestId('match-shape-game').locator('a')).toHaveCount(0);
        await shot(p, 'match-shape-origin-320');
        await page.screenshot({ path: test.info().outputPath('match-shape-origin-320.png'), fullPage: true });
      },
      2: async (p) => {
        // A pair tile is named by its letter and letter name, never its sound, until it is found.
        await expect(p.getByTestId('match-shape-heading')).toHaveAttribute('aria-label', 'Tap every ㅂ, letter bieup, b or p');
        await expect(p.getByTestId('match-shape-tile-0')).toHaveAttribute('aria-label', 'ㅂ, letter bieup');
        await expect(p.getByTestId('match-shape-tile-1')).toHaveAttribute('aria-label', 'ㅍ, letter pieup');
        await expectTileTargets(p);
        await expectNoHorizontalOverflow(p);
        await shot(p, 'match-shape-pair-320');
        await page.screenshot({ path: test.info().outputPath('match-shape-pair-320.png'), fullPage: true });
      },
    });

    await page.getByRole('button', { name: 'Play minigame' }).click();
    await playStep(page, APPLY);

    // The Check: ㅍ among ㅍ ㅂ ㅁ ㄹ, then ㅗ among ㅗ ㅓ ㅏ ㅜ (read rounds: this browser has no Korean voice).
    await playCheckByIds(page, [{ answer: 'jamo:pieup' }, { answer: 'jamo:o' }]);
    await page.getByRole('button', { name: 'See results' }).click();
    await expect(page.getByText('Next up')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('wide, with reduced motion: the round waits for Continue and nothing needs an animation', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1024, height: 768 });
    await onboard(page, true);
    await startShapesQuest(page);
    await expect(page.getByTestId('match-shape-art')).toBeVisible();
    await tapUntil(page.getByTestId('match-shape-tile-jamo:nieun'), visible(page.getByTestId('match-shape-continue')));
    // No timer moves an origin round on: the line stays until the learner continues.
    await page.waitForTimeout(2_500);
    await expect(page.getByTestId('match-shape-note')).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await shot(page, 'match-shape-origin-wide');
    await page.screenshot({ path: test.info().outputPath('match-shape-origin-wide.png'), fullPage: true });
    await page.getByTestId('match-shape-continue').click();
    await expect(page.getByTestId('match-shape-tile-jamo:giyeok')).toBeVisible();
  });
});

test('Match Shape off (built-in pct 0): the same steps play Read Pick, and the quest still completes', async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.setViewportSize({ width: 320, height: 568 });
  await onboard(page, false);
  await startShapesQuest(page);
  for (let step = 0; step < 2; step += 1) {
    if (step === 1) await page.getByRole('button', { name: 'Play minigame' }).click();
    await expect(page.getByTestId('read-pick-game')).toBeVisible();
    await expect(page.getByTestId('match-shape-game')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Which sound does this letter make?' })).toBeVisible();
    if (step === 0) {
      await expectNoHorizontalOverflow(page);
      await shot(page, 'match-shape-off-read-pick-320');
      await page.screenshot({ path: test.info().outputPath('match-shape-off-read-pick-320.png'), fullPage: true });
    }
    for (let round = 0; round < 6; round += 1) {
      const game = page.getByTestId('read-pick-game');
      await expect(game.getByText(`${round + 1} / 6`, { exact: true })).toBeVisible();
      const shown = await page.getByTestId('read-pick-letter').innerText();
      const ids = await page.locator('[data-testid^="read-pick-option-"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid') ?? ''));
      const answer = page.getByTestId(await rightOption(page, shown, ids));
      // The round moves on after the right sound: the next round's count, or the step ends after the last round.
      await tapUntil(answer, async () => (await game.count()) === 0 || (await game.getByText(`${round + 2} / 6`, { exact: true }).count()) > 0);
    }
    await expect(page.getByTestId('read-pick-game')).toHaveCount(0);
  }
  await playCheckByIds(page, [{ answer: 'jamo:pieup' }, { answer: 'jamo:o' }]);
  await page.getByRole('button', { name: 'See results' }).click();
  await expect(page.getByText('Next up')).toBeVisible();
  expect(errors).toEqual([]);
});

/** The Read Pick option whose letter is the one shown: options are named `read-pick-option-jamo:<id>`. */
async function rightOption(page: Page, shown: string, ids: string[]): Promise<string> {
  const byChar: Record<string, string> = { ㄴ: 'nieun', ㄱ: 'giyeok', ㅂ: 'bieup', ㅁ: 'mieum', ㅅ: 'siot', ㅇ: 'ieung', ㅡ: 'eu', ㅣ: 'i', ㅓ: 'eo', ㅏ: 'a', ㄹ: 'rieul' };
  const id = `read-pick-option-jamo:${byChar[shown.trim()] ?? ''}`;
  expect(ids, `${shown} on ${page.url()}`).toContain(id);
  return id;
}
