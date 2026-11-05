import type { Page } from '@playwright/test';
import { CATALOG, keysFor } from '@hangul-route/content-schema';
import { expect, test } from './fixtures';
import { completeChildForm, keepSidewaysIfAsked, passDiscover, readStored, seedStoredAll, tapHangulKey } from './helpers';
import { shot } from './shots';
import { expectNoHorizontalOverflow } from './viewport';

/**
 * F-CURR-002 row CM-45 S7 on the release bundle: Stage 7 Holidays & Traditions Volume 2, "My New Year Card" (a New
 * Year card or a holiday message to Hoya's grandmother, a teacher or a friend). `volumes` is at built-in pct 0 (the row
 * merges dark), so each case turns it on through the stored remote copy, as a ramp would. On: the cell opens Volume 2
 * once Volume 1 is done, and its page, its first quest's Discover (the frame ___께 카드를 써요) and its Trace a Word
 * Practice fit 320 px. Off: the cell is its Volume 1 alone. At 320 px and the Largest text size with `game.my-story` off
 * (its launch state), q3 Apply plays Write Frame on the chain's first frame.
 */
const RITES_V1 = CATALOG.cells.find((c) => c.episodeId === 'episode:stage7-rites');
const VOLUMES_ON = { volumes: { on: true, pct: 100 } };
const ritesCell = (page: Page) => page.getByRole('button', { name: /^Stage 7 [^,]+, Holidays & Traditions/ });

/** A learner with Stage 7 Holidays & Traditions' Volume 1 done (and the Volume 2 quests in `v2Done`), and the switches as given. */
async function holidayLearner(
  page: Page,
  flags: Record<string, { on: boolean; pct: number }>,
  { v2Done = [], settings }: { v2Done?: readonly string[]; settings?: Record<string, unknown> } = {},
): Promise<void> {
  const AT = '2026-10-01T10:00:00.000Z';
  await page.goto('/');
  await keepSidewaysIfAsked(page);
  await page.getByRole('button', { name: "Let's start" }).click();
  await completeChildForm(page, { name: 'Dami' });
  await page.goto('/');
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
  const id = (await readStored<string>(page, 'profiles:active')) as string;
  const questIds = RITES_V1?.questIds ?? [];
  expect(questIds).toHaveLength(3);
  const done = [
    ...questIds.map((questId) => ({ questId, episodeId: 'episode:stage7-rites' })),
    ...v2Done.map((questId) => ({ questId, episodeId: 'episode:stage7-rites-v2' })),
  ];
  const quests = done.map((q) => ({ ...q, startedAt: AT, completedAt: AT, stars: 3, attempts: 1, accuracy: 1 }));
  const questDoneAt = Object.fromEntries(done.map((q) => [q.questId, AT]));
  await seedStoredAll(page, {
    [`progress:${id}`]: { profileId: id, updatedAt: AT, episodes: [], quests, cards: [], sessions: [], homework: [], reviews: [], streakDays: 0, questDoneAt },
    'remote-config': { v: 1, fetchedAt: Date.now(), maxAgeS: 300, flags },
    ...(settings ? { 'device:settings': settings } : {}),
  });
  await page.reload();
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
  const guide = page.getByTestId('install-guide');
  await guide.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
  if (await guide.isVisible()) await guide.getByRole('button', { name: 'Not now' }).click();
  await page.getByText('Journey', { exact: true }).last().click();
  await expect(page.getByRole('heading', { name: 'Heritage Journey' })).toBeVisible();
}

const SHIFTED: Record<string, string> = { 'ㅃ': 'ㅂ', 'ㅉ': 'ㅈ', 'ㄸ': 'ㄷ', 'ㄲ': 'ㄱ', 'ㅆ': 'ㅅ', 'ㅒ': 'ㅐ', 'ㅖ': 'ㅔ' };
const SPLIT: Record<string, string> = { 'ㅘ': 'ㅗㅏ', 'ㅙ': 'ㅗㅐ', 'ㅚ': 'ㅗㅣ', 'ㅝ': 'ㅜㅓ', 'ㅞ': 'ㅜㅔ', 'ㅟ': 'ㅜㅣ', 'ㅢ': 'ㅡㅣ' };

/** Type Hangul round `n` of `total` on the in-app keyboard (the upper-cell journey's helper), then Done. */
async function typeRound(page: Page, n: number, total: number, text: string): Promise<void> {
  await expect(page.getByText(`${n} / ${total}`, { exact: true })).toBeVisible({ timeout: 5_000 });
  for (const jamo of keysFor(text).flatMap((j) => [...(SPLIT[j] ?? j)])) {
    if (jamo === ' ') {
      await tapHangulKey(page, 'space');
    } else if (SHIFTED[jamo]) {
      await tapHangulKey(page, 'shift');
      await tapHangulKey(page, SHIFTED[jamo]);
    } else {
      await tapHangulKey(page, jamo);
    }
  }
  await page.getByTestId('type-hangul-done').click();
  await expect(page.getByText('You typed it!')).toBeVisible();
}

test.describe('Stage 7 Holidays & Traditions Volume 2, My New Year Card (release bundle, F-CURR-002 CM-45 S7)', () => {
  for (const [label, size] of [
    ['320', { width: 320, height: 800 }],
    ['wide', { width: 1280, height: 900 }],
  ] as const) {
    test(`${label}: volumes on, the cell opens Volume 2, its page and its first quest's Discover fit the screen`, async ({ page }) => {
      await page.setViewportSize(size);
      await holidayLearner(page, VOLUMES_ON);
      await ritesCell(page).scrollIntoViewIfNeeded();
      await expect(ritesCell(page)).toHaveAccessibleName(/Opens Volume 2\.$/);
      await expect(page.getByTestId('journey-volumes-stage7-rites-2-open')).toHaveCount(1);
      if (label === '320') await expectNoHorizontalOverflow(page);
      await shot(page, `new-year-card-v2-grid-${label}`);
      await ritesCell(page).click();
      await expect(page.getByText('My New Year Card').first()).toBeVisible();
      const tabs = page.getByRole('tablist', { name: 'Volumes' });
      await expect(tabs.getByRole('tab', { name: 'Volume 2' })).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByText('Have a Good Holiday').first()).toBeVisible();
      if (label === '320') await expectNoHorizontalOverflow(page);
      await shot(page, `new-year-card-v2-page-${label}`);
      await page.getByRole('button', { name: 'Start', exact: true }).first().click();
      const anyway = page.getByRole('button', { name: 'Play anyway' });
      await anyway.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
      if (await anyway.isVisible()) await anyway.click();
      // The intro, then the Discover pages: the word 카드 and the frame ___께 카드를 써요 first.
      await page.getByRole('button', { name: 'Continue' }).first().click();
      await expect(page.getByText('Look and learn', { exact: true })).toBeVisible();
      await expect(page.getByText(/카드를 써요/).first()).toBeVisible();
      if (label === '320') await expectNoHorizontalOverflow(page);
      await shot(page, `new-year-card-v2-discover-${label}`);
      await passDiscover(page);
      // Practice: Trace a Word on 카드, 써요, 새해 and 설날.
      await expect(page.getByText('Trace the Words').first()).toBeVisible();
      if (label === '320') await expectNoHorizontalOverflow(page);
      await shot(page, `new-year-card-v2-practice-${label}`);
    });
  }

  test('volumes off (the launch state): the cell is Volume 1 alone and nothing of Volume 2 shows', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await holidayLearner(page, {});
    await ritesCell(page).scrollIntoViewIfNeeded();
    await expect(page.getByTestId('journey-volumes-stage7-rites')).toHaveCount(0);
    await expect(ritesCell(page)).not.toHaveAccessibleName(/Volume/);
    await ritesCell(page).click();
    await expect(page.getByText('My Holiday Memory').first()).toBeVisible();
    await expect(page.getByRole('tablist', { name: 'Volumes' })).toHaveCount(0);
    await expect(page.getByText('My New Year Card')).toHaveCount(0);
  });

  test('320 at the Largest text size, game.my-story off (its launch state): q3 Apply plays Write Frame on the first frame, its three words fit', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await holidayLearner(page, VOLUMES_ON, {
      v2Done: ['quest:stage7-rites-v2-q1', 'quest:stage7-rites-v2-q2'],
      settings: { uiLocale: 'en', uiLocaleAt: '2026-10-01T10:00:00.000Z', textSize: 'largest' },
    });
    await ritesCell(page).scrollIntoViewIfNeeded();
    await ritesCell(page).click();
    await expect(page.getByText('My New Year Card').first()).toBeVisible();
    await page.getByTestId('episode-quest-quest:stage7-rites-v2-q3').getByRole('button', { name: 'Start', exact: true }).click();
    const anyway = page.getByRole('button', { name: 'Play anyway' });
    await anyway.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
    if (await anyway.isVisible()) await anyway.click();
    await page.getByRole('button', { name: 'Continue' }).first().click();
    await expect(page.getByText(/새해 복 많이 받으세요/).first()).toBeVisible();
    await passDiscover(page);
    await page.getByRole('button', { name: 'Play minigame' }).click();
    // Practice: Type Hangul, the receivers and two wishes.
    await typeRound(page, 1, 4, '할머니');
    await typeRound(page, 2, 4, '새해 복 많이 받으세요');
    await typeRound(page, 3, 4, '선생님');
    await typeRound(page, 4, 4, '추석 잘 보내세요');
    await page.getByRole('button', { name: 'Play minigame' }).click();
    // Apply with the switch off: Write Frame on frame 1 alone (no My page, no chain), word bank only.
    await expect(page.getByTestId('write-frame')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('my-story-page')).toHaveCount(0);
    for (let i = 0; i < 3; i += 1) await expect(page.getByTestId(`write-frame-word-${i}`)).toBeVisible();
    await expect(page.getByTestId('write-frame-word-3')).toHaveCount(0);
    await expect(page.getByTestId('write-frame-word-1')).toHaveAttribute('aria-label', /호야/);
    await expectNoHorizontalOverflow(page);
    await shot(page, 'new-year-card-v2-q3-apply-fallback-320-largest');
  });
});
