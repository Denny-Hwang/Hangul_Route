import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { shot } from './shots';
import { expectNoHorizontalOverflow } from './viewport';

/**
 * F-CURR-001 row G-2: Realia Read (design/wireframes/minigame/realia-read.md,
 * design/screens/minigame-realia-read/). No lesson cell plays it until S6-1 .. S6-5 ship, so
 * this suite opens the game on the four D-2 realia through `window.__hrRealiaE2E`, which exists
 * only in the fixture bundle (served from dist-e2e/):
 *
 *   pnpm --filter @hangul-route/mobile build:web:fixtures
 *   STORY_FIXTURES=1 pnpm --filter @hangul-route/mobile exec playwright test realia-read
 *
 * In the production build the suite is skipped. Speech is the silent engine of ./fixtures.
 */

const FIXTURE_BUILD = process.env.STORY_FIXTURES === '1';
/** More than the game's 50 ms double-tap window between two deliberate taps. */
const TAP_GAP_MS = 120;
/** Words and marks a learner never reads here (anti-shame): no failure words, no score, no timer. */
const SHAME = /\b(wrong|fail\w*|missed|lost|lose|score)\b|%/i;
const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힯]/;

type Fixture = 'menu' | 'ticket' | 'sign' | 'priceCards';
interface Params {
  fixture: Fixture;
  mode?: 'quest' | 'check';
  romanization?: 'always' | 'tap';
}
interface Log {
  answers: Array<{ key: string; correct: boolean }>;
  completed: number;
}
interface TelemetryEvent {
  name: string;
  payload?: Record<string, unknown>;
}
type E2eWindow = Window & { __hrRealiaE2E?: { open(p: Params): void; log(): Log; events(): TelemetryEvent[] } };

async function open(page: Page, params: Params): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as E2eWindow).__hrRealiaE2E), undefined, { timeout: 10_000 });
  await page.evaluate((p) => (window as E2eWindow).__hrRealiaE2E?.open(p), params);
  await expect(page.getByTestId('realia-read-options')).toBeVisible();
  await page.addStyleTag({ content: '[data-testid="pwa-banners"] { display: none !important; }' });
}

const log = (page: Page): Promise<Log> => page.evaluate(() => (window as E2eWindow).__hrRealiaE2E!.log());
const events = (page: Page): Promise<TelemetryEvent[]> => page.evaluate(() => (window as E2eWindow).__hrRealiaE2E!.events());
const option = (page: Page, id: string) => page.getByTestId(`realia-read-option-${id}`);
const line = (page: Page, id: string) => page.getByTestId(`realia-read-sheet-line-${id}`);

async function expectNoShame(page: Page): Promise<void> {
  expect(await page.locator('body').innerText()).not.toMatch(SHAME);
}

test.describe('Realia Read (F-CURR-001 G-2)', () => {
  test.skip(!FIXTURE_BUILD, 'needs the fixture bundle: build:web:fixtures, then STORY_FIXTURES=1');

  for (const size of [
    { name: '320', width: 320, height: 568 },
    { name: '1024x768', width: 1024, height: 768 },
  ]) {
    test.describe(`at ${size.name}`, () => {
      test.use({ viewport: { width: size.width, height: size.height } });

      test('the menu is a named group of line buttons with real text; a miss nudges, the second rings the line, a hit marks it found', async ({ page }) => {
        await open(page, { fixture: 'menu' });
        const sheet = page.getByRole('group', { name: 'Menu, 4 lines' });
        await expect(sheet).toBeVisible();
        // Every drawn word is live text in the accessibility tree, one button per line.
        for (const name of ['김밥, gimbap, 2,000원, icheon won', '떡볶이, tteokbokki, 3,000원, samcheon won', '라면, ramyeon, 3,000원, samcheon won', '비빔밥, bibimbap, 5,000원, ocheon won']) {
          await expect(sheet.getByRole('button', { name, exact: true })).toBeVisible();
        }
        await expect(page.getByText('메뉴', { exact: true })).toBeVisible();
        await expect(page.getByText('Tap a line to hear it.')).toBeVisible();
        await expect(page.getByTestId('realia-read-question')).toHaveText('How much is this?');
        await expect(page.getByRole('button', { name: 'Korean: 삼천 원, samcheon won' })).toBeVisible();
        await expectNoHorizontalOverflow(page);
        await shot(page, `realia-read-menu-asking-${size.name}`);

        // A line tap plays it and never scores.
        await line(page, 'gimbap').click();
        expect((await log(page)).answers).toEqual([]);

        // First miss: amber card and Hoya's "Look again"; no ring yet.
        await option(page, 'icheon').click();
        await expect(page.getByRole('button', { name: 'Not this one: Korean: 이천 원, icheon won' })).toBeVisible();
        await expect(page.getByTestId('realia-read-status')).toContainText('Look again');
        await expect(sheet.getByRole('button', { name: /Look here$/ })).toHaveCount(0);

        // Second miss: the line that holds the answer is ringed and announced; the right option is not ringed.
        await page.waitForTimeout(TAP_GAP_MS);
        await option(page, 'ocheon').click();
        await expect(sheet.getByRole('button', { name: '라면, ramyeon, 3,000원, samcheon won. Look here' })).toBeVisible();
        await expect(page.getByTestId('realia-read-look-here')).toHaveText('Look here: 라면, ramyeon, 3,000원, samcheon won');
        await expect(page.getByRole('button', { name: 'Korean: 삼천 원, samcheon won', exact: true })).toBeVisible();
        await shot(page, `realia-read-menu-look-here-${size.name}`);

        // The hit: the option is right, the line is found with its gloss.
        await page.waitForTimeout(TAP_GAP_MS);
        await option(page, 'samcheon').click();
        await expect(page.getByRole('button', { name: 'Right answer: Korean: 삼천 원, samcheon won' })).toBeVisible();
        await expect(sheet.getByRole('button', { name: '라면, ramyeon, 3,000원, samcheon won. instant noodles, 3,000 won. Found here' })).toBeVisible();
        await expect(page.getByText('instant noodles, 3,000 won', { exact: true })).toBeVisible();
        await shot(page, `realia-read-menu-found-${size.name}`);
        expect((await log(page)).answers).toEqual([
          { key: '0', correct: false },
          { key: '0', correct: false },
          { key: '0', correct: true },
        ]);

        // The next question opens on its own; the found mark clears.
        await expect(page.getByTestId('realia-read-question')).toHaveText('Which one costs this?', { timeout: 3_000 });
        await expect(sheet.getByRole('button', { name: /Found here$/ })).toHaveCount(0);
        await expectNoShame(page);
      });

      test('the trail sign names each board with its direction; the summit question is answered by reading it', async ({ page }) => {
        await open(page, { fixture: 'sign' });
        const sheet = page.getByRole('group', { name: 'Trail sign, 3 lines' });
        await expect(sheet.getByRole('button', { name: '정상, jeongsang, 1시간, han sigan, to the right', exact: true })).toBeVisible();
        await expect(sheet.getByRole('button', { name: '입구, ipgu, to the left', exact: true })).toBeVisible();
        await expect(sheet.getByRole('button', { name: '출구, chulgu, to the left', exact: true })).toBeVisible();
        await expectNoHorizontalOverflow(page);
        await option(page, 'right').click();
        await expect(sheet.getByRole('button', { name: /^정상, .* Found here$/ })).toBeVisible();
        await shot(page, `realia-read-sign-found-${size.name}`);
        // The last question: the step completes once.
        await expect.poll(async () => (await log(page)).completed, { timeout: 3_000 }).toBe(1);
      });
    });
  }

  test('the ticket and the price cards draw as their own sheets, with figure and count options', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await open(page, { fixture: 'ticket' });
    await expect(page.getByRole('group', { name: 'Train ticket, 2 lines' })).toBeVisible();
    await expect(page.getByRole('button', { name: '출발, chulbal, 서울 3:00, seoul se si', exact: true })).toBeVisible();
    await expect(option(page, 't430')).toHaveText(/4:30/);
    await expectNoHorizontalOverflow(page);
    await shot(page, 'realia-read-ticket-375');

    await open(page, { fixture: 'priceCards' });
    const cards = page.getByRole('group', { name: 'Price cards, 3 lines' });
    await expect(cards.getByRole('button', { name: '사과, sagwa, 3개 2,000원, se gae icheon won', exact: true })).toBeVisible();
    await expect(cards.getByRole('button', { name: '한지, hanji, 1,000원, cheon won', exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await shot(page, 'realia-read-price-cards-375');
  });

  test('tap mode hides the romanization until a line is tapped; the line keeps it in its name', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await open(page, { fixture: 'menu', romanization: 'tap' });
    const sheet = page.getByRole('group', { name: 'Menu, 4 lines' });
    await expect(sheet.getByText('gimbap', { exact: true })).toHaveCount(0);
    await line(page, 'gimbap').click();
    await expect(sheet.getByText('gimbap', { exact: true })).toBeVisible();
    await expect(sheet.getByText('ramyeon', { exact: true })).toHaveCount(0);
    await expect(sheet.getByRole('button', { name: '라면, ramyeon, 3,000원, samcheon won', exact: true })).toBeVisible();
  });

  test('no telemetry payload carries realia text or an answer', async ({ page }) => {
    await open(page, { fixture: 'menu' });
    await line(page, 'ramyeon').click();
    await option(page, 'icheon').click();
    await page.waitForTimeout(TAP_GAP_MS);
    await option(page, 'samcheon').click();
    await expect(page.getByTestId('realia-read-question')).toHaveText('Which one costs this?', { timeout: 3_000 });
    for (const e of await events(page)) expect(JSON.stringify(e)).not.toMatch(HANGUL);
  });
});
