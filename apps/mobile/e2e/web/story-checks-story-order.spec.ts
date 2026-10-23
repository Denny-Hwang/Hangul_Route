import type { Page } from '@playwright/test';
import { touchTarget } from '@hangul-route/design-system/tokens';
import { STORY_ORDER_FIXTURES } from '../../src/navigation/story-order-e2e-fixture';
import { expect, test } from './fixtures';
import { seedStored } from './helpers';
import { shot } from './shots';
import { expectNoHorizontalOverflow } from './viewport';

/**
 * F-CURR-002 §7.1 F5, row CM-34: Story Order (design/wireframes/minigame/story-order.md,
 * design/screens/minigame-variety/ board O). No lesson cell plays it until the Check rotation rows author it, so this
 * suite opens the step on the fixture scopes through `window.__hrStoryOrderE2E`, which exists only in the fixture
 * bundle (served from dist-e2e/), and through the real `game.story-order` door: its built-in pct is 0, so each case
 * that wants the game turns it on through the stored remote copy, and off it plays Story Sequence with text cards.
 *
 *   pnpm --filter @hangul-route/mobile build:web:fixtures
 *   STORY_FIXTURES=1 pnpm --filter @hangul-route/mobile exec playwright test story-checks-story-order
 *
 * The file name starts with `story-checks` so the fixture run's whole-file filter of that name (web-app.yml, "A file
 * filter matches by name") selects it, as `story-reader` covers every story-reader-*.spec.ts. In the production
 * build the suite is skipped. Speech is the silent engine of ./fixtures (no Korean voice).
 */

const FIXTURE_BUILD = process.env.STORY_FIXTURES === '1';
const AMBER = 'rgb(242, 179, 61)'; // colors.feedback.nudge
const RED = 'rgb(200, 75, 61)'; // colors.feedback.danger: never on a learner's miss
/** §14: the 48 dp floor for every target; a slot is at least touchTarget.min tall (README constants). */
const FLOOR = 48;
/** Words and marks a learner never reads here (anti-shame, §7.7): no failure words, no score, no timer. */
const SHAME = /\b(wrong|fail\w*|missed|lost|lose|score|timer)\b|%/i;

type Fixture = keyof typeof STORY_ORDER_FIXTURES;
interface Log {
  answers: Array<{ key: string; correct: boolean; hinted: boolean }>;
  completed: number;
  fallbackFinished: number;
}
type E2eWindow = Window & { __hrStoryOrderE2E?: { open(p: unknown): void; log(): Log } };

async function open(page: Page, fixture: Fixture, opts: { on?: boolean; textSize?: 'largest' } = {}): Promise<void> {
  const on = opts.on ?? true;
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as E2eWindow).__hrStoryOrderE2E), undefined, { timeout: 10_000 });
  await seedStored(page, 'remote-config', { v: 1, fetchedAt: Date.now(), maxAgeS: 300, flags: { 'game.story-order': { on, pct: 100 } } });
  if (opts.textSize) await seedStored(page, 'device:settings', { uiLocale: 'en', textSize: opts.textSize, uiLocaleAt: '2026-10-16T09:00:00.000Z' });
  await page.reload();
  await page.waitForFunction(() => Boolean((window as E2eWindow).__hrStoryOrderE2E), undefined, { timeout: 10_000 });
  await page.evaluate((scope) => (window as E2eWindow).__hrStoryOrderE2E?.open({ scope }), STORY_ORDER_FIXTURES[fixture]);
  await expect(page.getByTestId(on ? 'story-order-cards' : 'story-sequence-cards')).toBeVisible();
  await page.addStyleTag({ content: '[data-testid="pwa-banners"] { display: none !important; }' });
}

const log = (page: Page): Promise<Log> => page.evaluate(() => (window as E2eWindow).__hrStoryOrderE2E!.log());
const card = (page: Page, id: string) => page.getByTestId(`story-order-card-${id}`);
const frameColor = (page: Page, id: string): Promise<string> => card(page, id).evaluate((el) => getComputedStyle(el.firstElementChild ?? el).borderTopColor);
const MORNING = STORY_ORDER_FIXTURES.captions.storyOrder!.rounds[0]!;
const [DAY] = STORY_ORDER_FIXTURES.twoRounds.storyOrder!.rounds;

/** Every visible button at least the floor on both sides and inside the window; every slot at least touchTarget.min tall. */
async function expectTargets(page: Page): Promise<void> {
  const offenders = await page.evaluate(
    ([floor, slotMin]) => {
      const width = document.documentElement.clientWidth;
      const buttons = Array.from(document.querySelectorAll('[role="button"], button'))
        .filter((el) => (el as HTMLElement).offsetParent !== null)
        .map((el) => ({ name: el.getAttribute('aria-label') ?? (el as HTMLElement).innerText.slice(0, 30), r: el.getBoundingClientRect(), min: floor }));
      const slots = Array.from(document.querySelectorAll('[data-testid^="story-order-slot-"]')).map((el) => ({ name: el.getAttribute('aria-label') ?? '', r: el.getBoundingClientRect(), min: slotMin }));
      return [...buttons, ...slots]
        .filter(({ r }) => r.width > 0 && r.height > 0)
        .filter(({ r, min }) => r.right > width + 1 || r.height < min - 0.5 || r.width < floor - 0.5)
        .map(({ name, r }) => `${name}: ${Math.round(r.width)} x ${Math.round(r.height)} at ${Math.round(r.left)}`);
    },
    [FLOOR, touchTarget.min] as const,
  );
  expect(offenders).toEqual([]);
}

test.describe('Story Order (F-CURR-002 CM-34)', () => {
  test.skip(!FIXTURE_BUILD, 'needs the fixture bundle: build:web:fixtures, then STORY_FIXTURES=1');

  for (const size of [
    { name: '320', width: 320, height: 568 },
    { name: 'wide', width: 1024, height: 768 },
  ]) {
    test.describe(`at ${size.name}`, () => {
      test.use({ viewport: { width: size.width, height: size.height } });

      test('a captions round: Korean and romanization only, a miss nudges in amber, the slots fill with first words and a screen reader hears each place', async ({ page }) => {
        await open(page, 'captions');
        await expect(page.getByRole('heading', { name: 'Put the lines in order' })).toBeVisible();
        await expect(page.getByText('Read each line. Tap the one that comes first.')).toBeVisible();
        for (const p of MORNING.panels) {
          await expect(page.getByRole('button', { name: `${p.caption.ko}, ${p.caption.romanization}`, exact: true })).toBeVisible();
          await expect(page.getByText(p.caption.en)).toHaveCount(0);
        }
        await expect(page.getByRole('button', { name: 'Show meanings' })).toBeVisible();
        await expectNoHorizontalOverflow(page);
        await expectTargets(page);
        await shot(page, `story-order-captions-${size.name}`);

        // A card that does not come next: amber, never red, nothing moves.
        await card(page, 'park').click();
        await expect(page.getByText('Try another').first()).toBeVisible();
        expect(await frameColor(page, 'park')).toBe(AMBER);
        expect(await frameColor(page, 'park')).not.toBe(RED);
        await expect(page.getByTestId('story-order-slot-1')).toHaveAccessibleName('Place 1 of 4, empty');
        expect(await page.locator('body').innerText()).not.toMatch(SHAME);

        // Each right card moves into the next slot; the live line names the place and the line.
        for (const [i, p] of MORNING.panels.slice(0, 2).entries()) {
          await card(page, p.id).click();
          await expect(page.getByTestId(`story-order-slot-${i + 1}`)).toHaveAccessibleName(`Place ${i + 1} of 4: ${p.caption.ko}`);
          await expect(page.getByTestId('story-order-announce')).toHaveText(`Place ${i + 1} of 4: ${p.caption.ko}`);
        }
        await expect(page.getByTestId('story-order-slot-2')).toContainText('그다음에');
        await expect(page.getByTestId('story-order-slot-2')).toContainText('geudaeume');
        await expect(page.getByTestId('story-order-announce')).toHaveAttribute('aria-live', 'polite');
        await expectNoHorizontalOverflow(page);
        await expectTargets(page);
        await shot(page, `story-order-two-placed-${size.name}`);

        for (const p of MORNING.panels.slice(2)) await card(page, p.id).click();
        // The replay: every line in order with its romanization and meaning.
        await expect(page.getByRole('heading', { name: 'The story, in order' })).toBeVisible();
        for (const p of MORNING.panels) await expect(page.getByTestId(`story-order-replay-line-${p.id}`)).toContainText(p.caption.en);
        await shot(page, `story-order-replay-${size.name}`);
        await page.getByTestId('story-order-done').click();
        const { answers, completed } = await log(page);
        expect(completed).toBe(1);
        expect(answers.map((a) => [a.key, a.correct])).toEqual([
          ['so:morning:0', false],
          ['so:morning:0', true],
          ['so:morning:1', true],
          ['so:morning:2', true],
          ['so:morning:3', true],
        ]);
      });

      test('an illustrated round shows its pictures; Show meanings shows every gloss for the round and marks the answers hinted', async ({ page }) => {
        await open(page, 'twoRounds');
        await expect(page.getByRole('heading', { name: 'Put the story in order' })).toBeVisible();
        await page.getByRole('button', { name: 'Show meanings' }).click();
        await expect(page.getByText('Meanings shown')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Show meanings' })).toHaveCount(0);
        for (const p of DAY!.panels) await expect(page.getByText(p.caption.en)).toBeVisible();
        await expectNoHorizontalOverflow(page);
        await expectTargets(page);
        await shot(page, `story-order-illustrated-meanings-${size.name}`);
        for (const p of DAY!.panels) await card(page, p.id).click();
        await page.getByTestId('story-order-done').click();
        // Round 2 holds the meanings back again.
        await expect(page.getByRole('heading', { name: 'Put the lines in order' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Show meanings' })).toBeVisible();
        await page.getByTestId('story-order-skip').click();
        const { answers, completed } = await log(page);
        expect(answers.every((a) => a.hinted && a.correct)).toBe(true);
        expect(answers).toHaveLength(4);
        expect(completed).toBe(1);
      });

      test('game.story-order off: each round plays as Story Sequence with text cards, then the step ends', async ({ page }) => {
        await open(page, 'twoRounds', { on: false });
        await expect(page.getByRole('heading', { name: 'Put the story in order' })).toBeVisible();
        await expect(page.getByTestId('story-order-cards')).toHaveCount(0);
        await expect(page.locator('[data-testid^="story-sequence-card-art-"]')).toHaveCount(0);
        await shot(page, `story-order-fallback-${size.name}`);
        for (const round of STORY_ORDER_FIXTURES.twoRounds.storyOrder!.rounds) {
          for (const p of round.panels) await page.getByTestId(`story-sequence-card-${p.id}`).click();
          await page.getByTestId('story-sequence-done').click();
        }
        expect(await log(page)).toMatchObject({ completed: 0, fallbackFinished: 1 });
      });
    });
  }

  test.describe('reduced motion', () => {
    test.use({ viewport: { width: 320, height: 568 }, reducedMotion: 'reduce' });

    test('the replay never moves by itself and has no Pause; Back and Next step through', async ({ page }) => {
      await open(page, 'captions');
      for (const p of MORNING.panels) await card(page, p.id).click();
      await expect(page.getByTestId('story-order-replay')).toBeVisible();
      await expect(page.getByTestId('story-order-replay-pause')).toHaveCount(0);
      await page.waitForTimeout(3_500);
      const live = page.getByTestId('story-order-replay-announce');
      await expect(live).toHaveAttribute('aria-live', 'polite');
      await expect(live).toHaveText(`${MORNING.panels[0]!.caption.ko} ${MORNING.panels[0]!.caption.en}`);
      await page.getByTestId('story-order-replay-next').click();
      await expect(live).toHaveText(`${MORNING.panels[1]!.caption.ko} ${MORNING.panels[1]!.caption.en}`);
    });
  });

  test.describe('motion allowed', () => {
    test.use({ viewport: { width: 320, height: 568 }, reducedMotion: 'no-preference' });

    test('the replay has a Pause and moves on by itself', async ({ page }) => {
      await open(page, 'captions');
      for (const p of MORNING.panels) await card(page, p.id).click();
      await expect(page.getByTestId('story-order-replay-pause')).toBeVisible();
      await expect(page.getByTestId('story-order-replay-announce')).toHaveText(`${MORNING.panels[1]!.caption.ko} ${MORNING.panels[1]!.caption.en}`, { timeout: 6_000 });
    });
  });

  test.describe('largest text at 320', () => {
    test.use({ viewport: { width: 320, height: 568 } });

    test('five lines with every slot filled: slots grow, nothing is cut, no sideways scroll, Skip stays reachable', async ({ page }) => {
      await open(page, 'five', { textSize: 'largest' });
      const five = STORY_ORDER_FIXTURES.five.storyOrder!.rounds[0]!;
      await expectTargets(page);
      await expectNoHorizontalOverflow(page);
      for (const p of five.panels.slice(0, 4)) await card(page, p.id).click();
      await expectNoHorizontalOverflow(page);
      await expectTargets(page);
      await page.getByTestId('story-order-skip').scrollIntoViewIfNeeded();
      await expect(page.getByTestId('story-order-skip')).toBeInViewport();
      await shot(page, 'story-order-five-largest-320');
    });
  });
});
