import { expect, test } from './fixtures';
import { HiddenHeritageRoundSchema } from '@hangul-route/content-schema';
import { FOOD_MARKET_SCENE } from '@hangul-route/design-system/src/scene-art/hidden-heritage/food-market';
import { FOUR_SEASONS_SCENE } from '@hangul-route/design-system/src/scene-art/hidden-heritage/four-seasons';
import { LETTERS_SCHOOL_SCENE } from '@hangul-route/design-system/src/scene-art/hidden-heritage/letters-school';
import { PLAY_COURTYARD_SCENE } from '@hangul-route/design-system/src/scene-art/hidden-heritage/play-courtyard';
import { SEOLLAL_ROOM_SCENE } from '@hangul-route/design-system/src/scene-art/hidden-heritage/seollal-room';
import { touchTarget } from '@hangul-route/design-system/tokens';
import { spotHitRects } from '../../src/logic/hidden-heritage-flow';
import { seedStored } from './helpers';
import { hitRectOffences, type HitRectCheck } from './target-audit';

// AMENDMENTS-TOUCH row KT-6, F8: Hidden Heritage's spot hit areas (fixture build). Each spot's hit area is measured
// against `spotHitRects`: 64 on every axis where the spot is not boxed, and exactly its computed room where it is.
// KT-11 carries the ratchet to every game and to es and ko. The file's name starts with `realia-read-` so the
// fixture e2e run of the PWA workflow, which selects spec files by name, runs it; the release-build ratchet of the
// other KT-6 games is `target-size.spec.ts`.
const LARGEST = { uiLocale: 'en', uiLocaleAt: '2026-10-16T09:00:00.000Z', textSize: 'largest' };
const FIXTURE_BUILD = process.env.STORY_FIXTURES === '1';

type HhWindow = Window & { __hrHiddenHeritageE2E?: { open(p: { sceneId?: string }): void } };

test.describe('Hidden Heritage spot hit areas at 320 x 640, largest text (F8; fixture build)', () => {
  test.skip(!FIXTURE_BUILD, 'needs the fixture bundle: build:web:fixtures, then STORY_FIXTURES=1');
  test.use({ viewport: { width: 320, height: 640 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });

  for (const scene of [FOOD_MARKET_SCENE, LETTERS_SCHOOL_SCENE, SEOLLAL_ROOM_SCENE, FOUR_SEASONS_SCENE, PLAY_COURTYARD_SCENE]) {
    test(`${scene.id}: 64 on every axis where a spot is not boxed, its computed room where it is`, async ({ page }) => {
      await page.goto('/');
      await seedStored(page, 'device:settings', LARGEST);
      await seedStored(page, 'remote-config', { v: 1, fetchedAt: Date.now(), maxAgeS: 86_400, flags: { 'game.hidden-heritage': { on: true, pct: 100 } } });
      await page.reload();
      await page.waitForFunction(() => Boolean((window as HhWindow).__hrHiddenHeritageE2E), undefined, { timeout: 10_000 });
      await page.evaluate((id) => (window as HhWindow).__hrHiddenHeritageE2E?.open({ sceneId: id }), scene.id);
      await expect(page.getByTestId('hh-scene')).toBeVisible({ timeout: 15_000 });
      const width = (await page.getByTestId('hh-scene').boundingBox())!.width;
      const round = HiddenHeritageRoundSchema.parse(scene.round);
      const list = [...round.targets, ...round.others];
      const expected = spotHitRects(
        list.map((t) => t.spot),
        width,
        touchTarget.min,
      );
      const checks: HitRectCheck[] = [];
      for (const [i, t] of list.entries()) {
        const b = (await page.getByTestId(`hh-spot-${t.id}`).boundingBox())!;
        checks.push({ name: t.id, measured: { width: b.width, height: b.height }, expected: expected[i]! });
      }
      expect(hitRectOffences(checks)).toEqual([]);
    });
  }
});
