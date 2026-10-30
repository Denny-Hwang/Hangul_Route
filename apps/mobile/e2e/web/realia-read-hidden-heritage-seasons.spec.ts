import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { seedStored } from './helpers';
import { shot } from './shots';
import { expectNoHorizontalOverflow } from './viewport';

/**
 * F-CURR-002 row CM-37 part 3: the Nature & Animals Hidden Heritage scene, the four seasons (design/wireframes/minigame/
 * hidden-heritage.md), and its card back (row CM-41 S2). This suite opens the step on the scene's reference round, which
 * Nature & Animals Volume 2 quest 2 plays as its Apply, through `window.__hrHiddenHeritageE2E` (fixture bundle only,
 * served from dist-e2e/):
 *
 *   pnpm --filter @hangul-route/mobile build:web:fixtures
 *   STORY_FIXTURES=1 pnpm --filter @hangul-route/mobile exec playwright test realia-read-hidden-heritage-seasons
 *
 * The file is named under `realia-read` (its sibling scene game), like CM-36's realia-read-hidden-heritage.spec.ts, so the
 * fixture e2e run's `realia-read` entry in .github/workflows/web-app.yml selects it.
 *
 * `game.hidden-heritage` ships at built-in pct 0, so each case seeds the stored remote copy.
 */

const FIXTURE_BUILD = process.env.STORY_FIXTURES === '1';
const SCENE = 'scene:four-seasons';
const SHAME = /\b(wrong|fail\w*|missed|lost|lose|score)\b|%/i;
const THINGS = ['wind', 'rain', 'magpie', 'mountain', 'flower', 'tree', 'moon bear', 'snow'];
const TARGETS: Record<string, { id: string; meaning: string }> = {
  바람: { id: 'baram', meaning: 'wind' },
  비: { id: 'bi', meaning: 'rain' },
  까치: { id: 'kkachi', meaning: 'magpie' },
  산: { id: 'san', meaning: 'mountain' },
};

type E2eWindow = Window & {
  __hrHiddenHeritageE2E?: { open(p: { missing?: boolean; sceneId?: string }): void; log(): { answers: Array<{ key: string; correct: boolean }>; completed: number } };
};

async function open(page: Page, gameOn: boolean): Promise<void> {
  await page.goto('/');
  await seedStored(page, 'remote-config', { v: 1, fetchedAt: Date.now(), maxAgeS: 86_400, flags: { 'game.hidden-heritage': { on: gameOn, pct: gameOn ? 100 : 0 } } });
  await page.reload();
  await page.waitForFunction(() => Boolean((window as E2eWindow).__hrHiddenHeritageE2E), undefined, { timeout: 10_000 });
  await page.addStyleTag({ content: '[data-testid="pwa-banners"] { display: none !important; }' });
  await page.evaluate((sceneId) => (window as E2eWindow).__hrHiddenHeritageE2E?.open({ sceneId }), SCENE);
}

const log = (page: Page) => page.evaluate(() => (window as E2eWindow).__hrHiddenHeritageE2E!.log());

async function asked(page: Page): Promise<string> {
  const ko = (await page.getByTestId('hh-prompt').innerText()).split('\n')[0]!.trim();
  expect(Object.keys(TARGETS)).toContain(ko);
  return ko;
}

test.describe('Hidden Heritage, the four seasons (F-CURR-002 CM-37 part 3)', () => {
  test.skip(!FIXTURE_BUILD, 'needs the fixture bundle: build:web:fixtures, then STORY_FIXTURES=1');

  for (const size of [
    { name: '320', width: 320, height: 568, spotMin: 54 },
    { name: '1280', width: 1280, height: 800, spotMin: 75 },
  ]) {
    test(`at ${size.name}: a Korean Nature word with romanization; eight named spots; every find fills a slot`, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      await open(page, true);
      await expect(page.getByTestId('hh-scene')).toBeVisible();
      let ko = await asked(page);
      await expect(page.getByTestId('hh-prompt')).toContainText(TARGETS[ko]!.id);
      const body = await page.locator('body').innerText();
      for (const t of Object.values(TARGETS)) expect(body).not.toContain(t.meaning);
      for (const name of THINGS) {
        const box = (await page.getByRole('button', { name, exact: true }).boundingBox())!;
        expect(Math.min(box.width, box.height), name).toBeGreaterThanOrEqual(48);
        expect(Math.min(box.width, box.height), name).toBeGreaterThanOrEqual(size.spotMin - 1);
      }
      await expect(page.getByLabel('Not found yet')).toHaveCount(4);
      await expectNoHorizontalOverflow(page);
      await shot(page, `hidden-heritage-seasons-ask-${size.name}`);
      await page.getByTestId('hh-spot-bandalgaseumgom').click();
      await expect(page.getByText('Look again').first()).toBeVisible();
      // State, not sleeps: the miss is logged and its ring clears on its own (MISS_RING_MS) before the next tap.
      await expect.poll(async () => (await log(page)).answers.length).toBe(1);
      await expect(page.getByTestId('hh-ring-miss')).toHaveCount(0);
      for (let i = 0; i < 4; i += 1) {
        ko = await asked(page);
        await page.getByTestId(`hh-spot-${TARGETS[ko]!.id}`).click();
        await expect(page.getByRole('button', { name: `${TARGETS[ko]!.meaning}, found` })).toBeVisible();
        await expect.poll(async () => (await log(page)).answers.length).toBe(i + 2);
        // The next word comes once the meaning has shown (FOUND_ADVANCE_MS); after the last, the end panel.
        if (i < 3) await expect(page.getByTestId('hh-prompt')).not.toContainText(ko);
      }
      await expect(page.getByText('You found them all')).toBeVisible();
      for (const t of Object.values(TARGETS)) await expect(page.getByTestId('hh-end').getByText(t.meaning, { exact: true })).toBeVisible();
      expect(await page.locator('body').innerText()).not.toMatch(SHAME);
      await expectNoHorizontalOverflow(page);
      await shot(page, `hidden-heritage-seasons-end-${size.name}`);
      // Row CM-41 S2: the scene's card back under the found words, every fact of its note with its source line, no URL.
      const back = page.getByTestId('hh-card-back');
      await back.scrollIntoViewIfNeeded();
      await expect(back.getByText('Did you know?')).toBeVisible();
      for (const id of ['f1', 'f2', 'f3', 'f4', 'f5', 'f6']) await expect(back.getByTestId(`hh-card-back-${id}`)).toContainText('Source:');
      await expect(back.getByTestId('hh-card-back-f1')).toContainText('four seasons');
      await expect(back.getByTestId('hh-card-back-f6')).toContainText('Chinese tiger paintings');
      expect(await back.innerText()).not.toMatch(/https?:|www\./);
      await expectNoHorizontalOverflow(page);
      await shot(page, `hidden-heritage-seasons-card-back-${size.name}`);
      const answers = (await log(page)).answers;
      expect(answers.map((a) => a.correct)).toEqual([false, true, true, true, true]);
    });
  }

  test('at 320, game.hidden-heritage off (the launch state): Pic-Word Match on 바람, 비, 까치 and 산 from their own pictures', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await open(page, false);
    for (const t of Object.values(TARGETS)) await expect(page.getByTestId(`pic-word-picture-${t.id}`)).toBeVisible();
    await expect(page.getByTestId('hh-scene')).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
    await shot(page, 'hidden-heritage-seasons-off-320');
  });
});
