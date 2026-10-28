import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { getMessages } from '@hangul-route/i18n';
import { expect, test } from './fixtures';
import { seedStored } from './helpers';
import { shot } from './shots';
import { expectNoHorizontalOverflow } from './viewport';

/**
 * F-CURR-002 row CM-37 part 2: the Holidays & Traditions Hidden Heritage scene, a hanok room on Seollal morning
 * (packages/design-system/src/scene-art/hidden-heritage/seollal-room.ts), played through the CM-36 step. No lesson cell
 * plays it until the Holidays Volume 2 cell ships, so the suite opens its reference round through
 * `window.__hrHiddenHeritageE2E.open({ sceneId })`, which exists only in the fixture bundle (served from dist-e2e/):
 *
 *   pnpm --filter @hangul-route/mobile build:web:fixtures
 *   STORY_FIXTURES=1 pnpm --filter @hangul-route/mobile exec playwright test realia-read-hidden-heritage-seollal
 *
 * The file is named under `realia-read`, as CM-36's realia-read-hidden-heritage.spec.ts is, so the fixture e2e run's
 * `realia-read` entry in .github/workflows/web-app.yml selects it.
 *
 * `game.hidden-heritage` ships at built-in pct 0, so each case seeds the stored remote copy. The es and ko cases seed the
 * UI language and read the scene's `scene:seollal-room` overlay (content/i18n/{es,ko}/hidden-heritage.json).
 */

const FIXTURE_BUILD = process.env.STORY_FIXTURES === '1';
const SCENE_ID = 'scene:seollal-room';
const SHAME = /\b(wrong|fail\w*|missed|lost|lose|score)\b|%/i;
const THINGS = ['traditional Korean clothes', 'lucky pouch', 'kite', 'rice-cake soup', 'floor cushion', 'yut sticks'];
const TARGETS: Record<string, { id: string; meaning: string }> = {
  한복: { id: 'hanbok', meaning: 'traditional Korean clothes' },
  떡국: { id: 'tteokguk', meaning: 'rice-cake soup' },
  연: { id: 'yeon', meaning: 'kite' },
};

type E2eWindow = Window & {
  __hrHiddenHeritageE2E?: { open(p: { missing?: boolean; sceneId?: string }): void; log(): { answers: Array<{ key: string; correct: boolean }>; completed: number } };
};

type Locale = 'es' | 'ko';
/** The scene's overlay in one UI language: the meaning of each target, by its id. */
function meanings(locale: Locale): Record<string, string> {
  const file = JSON.parse(readFileSync(join(__dirname, '../../../../content/i18n', locale, 'hidden-heritage.json'), 'utf8')) as { entries: Record<string, Record<string, string>> };
  const entry = file.entries[SCENE_ID]!;
  return Object.fromEntries(Object.values(TARGETS).map((t) => [t.id, entry[`round.targets.${t.id}.word.gloss`]!]));
}

async function open(page: Page, gameOn: boolean, locale?: Locale): Promise<void> {
  await page.goto('/');
  await seedStored(page, 'remote-config', { v: 1, fetchedAt: Date.now(), maxAgeS: 86_400, flags: { 'game.hidden-heritage': { on: gameOn, pct: gameOn ? 100 : 0 } } });
  if (locale) await seedStored(page, 'device:settings', { uiLocale: locale, uiLocaleAt: '2026-10-27T09:00:00.000Z' });
  await page.reload();
  await page.waitForFunction(() => Boolean((window as E2eWindow).__hrHiddenHeritageE2E), undefined, { timeout: 10_000 });
  await page.addStyleTag({ content: '[data-testid="pwa-banners"] { display: none !important; }' });
  await page.evaluate((sceneId) => (window as E2eWindow).__hrHiddenHeritageE2E?.open({ sceneId }), SCENE_ID);
}

const spot = (page: Page, id: string) => page.getByTestId(`hh-spot-${id}`);
const log = (page: Page) => page.evaluate(() => (window as E2eWindow).__hrHiddenHeritageE2E!.log());

async function asked(page: Page): Promise<string> {
  const ko = (await page.getByTestId('hh-prompt').innerText()).split('\n')[0]!.trim();
  expect(Object.keys(TARGETS)).toContain(ko);
  return ko;
}

test.describe('Hidden Heritage, the Seollal room (F-CURR-002 CM-37)', () => {
  test.skip(!FIXTURE_BUILD, 'needs the fixture bundle: build:web:fixtures, then STORY_FIXTURES=1');

  for (const size of [
    { name: '320', width: 320, height: 568, spotMin: 54 },
    { name: '768', width: 768, height: 1024, spotMin: 135 },
  ]) {
    test.describe(`at ${size.name}`, () => {
      test.use({ viewport: { width: size.width, height: size.height } });

      test('asks a Holidays word in Korean with romanization over the room; every thing a named button of 48 dp or more', async ({ page }) => {
        await open(page, true);
        await expect(page.getByTestId('hh-scene')).toBeVisible();
        const ko = await asked(page);
        await expect(page.getByTestId('hh-prompt')).toContainText(TARGETS[ko]!.id);
        const body = await page.locator('body').innerText();
        for (const meaning of Object.values(TARGETS).map((t) => t.meaning)) expect(body).not.toContain(meaning);
        for (const name of THINGS) {
          const button = page.getByRole('button', { name, exact: true });
          await expect(button).toBeVisible();
          const box = (await button.boundingBox())!;
          expect(Math.min(box.width, box.height), name).toBeGreaterThanOrEqual(48);
          expect(Math.min(box.width, box.height), name).toBeGreaterThanOrEqual(size.spotMin - 1);
        }
        await expectNoHorizontalOverflow(page);
        await shot(page, `hidden-heritage-seollal-ask-${size.name}`);
      });

      test('a miss only nudges; every target found ends on the end panel with its meaning', async ({ page }) => {
        await open(page, true);
        await spot(page, 'bangseok').click();
        await expect(page.getByText('Look again').first()).toBeVisible();
        expect(await page.locator('body').innerText()).not.toMatch(SHAME);
        // State, not sleeps: the miss ring clears on its own before the next tap.
        await expect(page.getByTestId('hh-ring-miss')).toHaveCount(0);
        for (let i = 0; i < 3; i += 1) {
          const ko = await asked(page);
          await spot(page, TARGETS[ko]!.id).click();
          await expect(page.getByRole('button', { name: `${TARGETS[ko]!.meaning}, found` })).toBeVisible();
          if (i === 0) await shot(page, `hidden-heritage-seollal-found-${size.name}`);
          // The next word comes once the meaning has shown; after the last, the end panel.
          if (i < 2) await expect(page.getByTestId('hh-prompt')).not.toContainText(ko);
        }
        await expect(page.getByText('You found them all')).toBeVisible();
        for (const t of Object.values(TARGETS)) await expect(page.getByTestId('hh-end').getByText(t.meaning, { exact: true })).toBeVisible();
        await expectNoHorizontalOverflow(page);
        await shot(page, `hidden-heritage-seollal-end-${size.name}`);
        expect((await log(page)).answers.map((a) => a.correct)).toEqual([false, true, true, true]);
      });
    });
  }

  test.describe('at 320', () => {
    test.use({ viewport: { width: 320, height: 568 } });

    for (const locale of ['es', 'ko'] as const) {
      test(`in ${locale}: the spots, the found row and the end panel carry the scene's ${locale} meanings and fit at 320`, async ({ page }) => {
        const m = getMessages(locale);
        const mean = meanings(locale);
        await open(page, true, locale);
        await expect(page.getByTestId('hh-scene')).toBeVisible();
        await expect(page.getByText(m.learner.hiddenHeritage.prompt, { exact: true })).toBeVisible();
        for (const t of Object.values(TARGETS)) await expect(page.getByRole('button', { name: mean[t.id]!, exact: true })).toBeVisible();
        await expectNoHorizontalOverflow(page);
        for (let i = 0; i < 3; i += 1) {
          const ko = await asked(page);
          await spot(page, TARGETS[ko]!.id).click();
          await expect(page.getByRole('button', { name: m.a11y.hiddenHeritage.spotFound(mean[TARGETS[ko]!.id]!) })).toBeVisible();
          await expectNoHorizontalOverflow(page);
          if (i < 2) await expect(page.getByTestId('hh-prompt')).not.toContainText(ko);
        }
        await expect(page.getByText(m.learner.hiddenHeritage.allFound)).toBeVisible();
        for (const t of Object.values(TARGETS)) await expect(page.getByTestId('hh-end').getByText(mean[t.id]!, { exact: true })).toBeVisible();
        await expectNoHorizontalOverflow(page);
        await shot(page, `hidden-heritage-seollal-end-${locale}-320`);
      });
    }

    test('game.hidden-heritage off (the launch state): Pic-Word Match on the same three targets, from their card pictures', async ({ page }) => {
      await open(page, false);
      for (const t of Object.values(TARGETS)) await expect(page.getByTestId(`pic-word-picture-${t.id}`)).toBeVisible();
      await expect(page.getByTestId('hh-scene')).toHaveCount(0);
      await shot(page, 'hidden-heritage-seollal-off-320');
    });
  });
});
