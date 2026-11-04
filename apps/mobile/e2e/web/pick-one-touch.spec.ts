import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { passDiscover } from './helpers';
import { LETTER_OF, captureSpeech, en, nextSaid, roundPill, said, saidCount, shown } from './jamo-voice-rig';
import { Touchscreen, pointIn } from './touch';

/**
 * AMENDMENTS-TOUCH row KT-3 (sections 6 and 11.2): the pick-one games on their answer boards, under real touches
 * (`touch.ts`, CDP `Input.dispatchTouchEvent`). The guest's first quest (`/?try=1`) reaches both games without an
 * account: Play is Match Sound, and the Check is Listen & Pick.
 *
 * - F1: a 20 px graze on an option, which the browser's own click used to drop, answers it.
 * - Bounce: a second tap 60 ms after an answer, on another option, answers nothing.
 * - R3: a locked wrong Match Sound tile is disabled; a tap and a bounce on it are no second miss (no replay of the prompt).
 *
 * Release build (the device voice stand-in names the letter, as `jamo-voice.spec.ts`). Phone at 320 x 640 and the
 * Pixel 5 profile, both with touch.
 */

const FIXTURE_BUILD = process.env.STORY_FIXTURES === '1';
/** Past the 400 ms lock, with room for a busy machine's slow event dispatch. */
const AFTER_LOCK = 700;
const ANSWERED = /^(Right answer|Not this one)/;

async function startGuestQuest(page: Page): Promise<void> {
  await page.goto('/?try=1');
  await expect(page.getByText('Hi from Hoya', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: en.learner.quest.continue.cta, exact: true }).click();
  await passDiscover(page);
}

for (const size of [
  { name: 'phone 320', viewport: { width: 320, height: 640 } },
  { name: 'Pixel 5', viewport: null },
]) {
  test.describe(`pick-one boards under touch, ${size.name} (AMENDMENTS-TOUCH KT-3)`, () => {
    test.skip(FIXTURE_BUILD, 'the release build: the guest quest and the device voice');
    if (size.viewport !== null) test.use({ viewport: size.viewport, hasTouch: true, isMobile: true });

    test('Listen & Pick: a bounce on the next option answers nothing; a 20 px graze answers (F1)', async ({ page }) => {
      await startGuestQuest(page);
      await page.getByRole('button', { name: en.learner.quest.launcher.game.skip.cta, exact: true }).click();
      await page.getByRole('button', { name: en.learner.quest.launcher.game.skip.cta, exact: true }).click();
      await page.getByRole('button', { name: 'Go', exact: true }).click();
      const wrong = page.getByTestId('listen-pick-option-jamo:a');
      const right = page.getByTestId('listen-pick-option-jamo:eo');
      await expect(wrong).toBeVisible();
      await expect(right).toBeVisible();
      // At 320 x 640 the options sit under the fold: bring them on screen (a touch lands where the finger is).
      await page.getByTestId('listen-pick-options').scrollIntoViewIfNeeded();
      await page.waitForTimeout(AFTER_LOCK);
      const touch = await Touchscreen.of(page);

      // A miss, then 60 ms later a tap on the right card: the second is a bounce and answers nothing.
      await touch.tap(await pointIn(page, 'listen-pick-option-jamo:a'));
      await page.waitForTimeout(60);
      await touch.tap(await pointIn(page, 'listen-pick-option-jamo:eo'));
      await expect(wrong).toHaveAttribute('aria-label', /^Not this one/);
      await page.waitForTimeout(AFTER_LOCK);
      await expect(right).not.toHaveAttribute('aria-label', ANSWERED);

      // F1: a 20 px vertical graze on the right card, which the browser's click dropped, now answers it.
      await touch.graze(await pointIn(page, 'listen-pick-option-jamo:eo'), 0, 20);
      await expect(right).toHaveAttribute('aria-label', /^Right answer/);
    });

    test('Match Sound: a locked wrong tile takes no tap (R3); a 20 px graze on the right tile answers (F1)', async ({ page }) => {
      await captureSpeech(page);
      await startGuestQuest(page);
      await page.getByRole('button', { name: en.learner.quest.launcher.game.play.cta }).click();
      await expect(roundPill(page, 1)).toBeVisible();
      await expect(shown(page, 'match-sound-tiles')).toBeVisible();
      // The round's letter, by name: the speaker says it again.
      const before = await saidCount(page);
      await shown(page, 'match-sound-speaker').click();
      const letter = LETTER_OF.get(await nextSaid(page, before));
      expect(letter).toBeDefined();
      const tiles = shown(page, 'match-sound-tiles').locator('[data-testid^="match-sound-tile-"]');
      await expect(tiles).toHaveCount(4);
      const ids = await tiles.evaluateAll((els) => els.map((e) => e.getAttribute('data-testid') ?? ''));
      const texts = await tiles.allInnerTexts();
      const rightId = ids[texts.findIndex((t) => t.includes(letter!))]!;
      const wrongId = ids.find((id) => id !== rightId)!;
      await shown(page, 'match-sound-tiles').scrollIntoViewIfNeeded();
      await page.waitForTimeout(AFTER_LOCK);
      const touch = await Touchscreen.of(page);

      // A miss, and a bounce on the same tile 60 ms later: one miss, one replay of the prompt.
      const missFrom = await saidCount(page);
      await touch.tap(await pointIn(page, wrongId));
      await page.waitForTimeout(60);
      await touch.tap(await pointIn(page, wrongId));
      await expect(shown(page, 'match-sound-bubble')).toBeVisible();
      await expect.poll(() => saidCount(page), { timeout: 3_000 }).toBe(missFrom + 1);
      // Locked: disabled, still amber, and a tap on it later is no second miss (no second replay).
      await expect(page.getByTestId(wrongId)).toHaveAttribute('aria-disabled', 'true');
      await page.waitForTimeout(AFTER_LOCK);
      await touch.tap(await pointIn(page, wrongId));
      await page.waitForTimeout(1_500);
      expect(await saidCount(page)).toBe(missFrom + 1);
      expect((await said(page)).at(-1)?.text).toBe((await said(page)).at(missFrom - 1)?.text);

      // F1 on a tile: a 20 px vertical graze on the right one answers the round.
      await touch.graze(await pointIn(page, rightId), 0, 20);
      await expect(roundPill(page, 2)).toBeVisible();
    });
  });
}
