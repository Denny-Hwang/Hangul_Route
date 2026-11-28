import type { Page } from '@playwright/test';
import type { ProgressSnapshot } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { expect, test } from './fixtures';
import { acceptConfirmSheets, completeChildForm, headerClose, journeyCellName, keepSidewaysIfAsked, readStored, seedStored } from './helpers';

/**
 * AMENDMENTS-ROMANIZATION-FADE row RF-2 (section 3.16, WO-11's acceptance): a new profile that has finished quests 1 to 10
 * opens quest 11 (Mountain, River, Sea). Hoya's reading line shows on the Hello step, once; on Look and learn the words it
 * can read (산, 강) show no romanization until **Show how to say it**, which shows it; the gloss stays. The second quest run
 * shows no line.
 */
const AT = '2026-10-01T09:05:00.000Z';
const COPY = getMessages('en').learner.quest;

/** Quests 1 to 10: Letters, Home & Food and Festivals (three each) and Nature's first. */
const FIRST_TEN: ReadonlyArray<readonly [string, string]> = [
  ...['q1', 'q2', 'q3'].map((q) => ['episode:stage1-letters', `quest:stage1-letters-${q}`] as const),
  ...['q1', 'q2', 'q3'].map((q) => ['episode:stage1-life', `quest:stage1-life-${q}`] as const),
  ...['q1', 'q2', 'q3'].map((q) => ['episode:stage1-rites', `quest:stage1-rites-${q}`] as const),
  ['episode:stage1-nature', 'quest:stage1-nature-q1'],
];

const tenDone = (profileId: string): ProgressSnapshot => ({
  profileId,
  updatedAt: AT,
  episodes: [],
  quests: FIRST_TEN.map(([episodeId, questId]) => ({ questId, episodeId, startedAt: AT, completedAt: AT, stars: 1 as const, attempts: 1, accuracy: 0.5 })),
  cards: [],
  sessions: [],
  homework: [],
  reviews: [],
  streakDays: 0,
});

async function learnerAtQuestEleven(page: Page): Promise<string> {
  await page.goto('/');
  await keepSidewaysIfAsked(page);
  await page.getByRole('button', { name: "Let's start" }).click();
  await completeChildForm(page, { name: 'Dami' });
  await page.goto('/');
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
  const profileId = (await readStored<string>(page, 'profiles:active')) as string;
  expect(profileId).toBeTruthy();
  await seedStored(page, `progress:${profileId}`, tenDone(profileId));
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
  const guide = page.getByTestId('install-guide');
  await guide.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
  if (await guide.isVisible()) await guide.getByRole('button', { name: 'Not now' }).click();
  return profileId;
}

async function startNatureQuest(page: Page, button: number, title: string): Promise<void> {
  await page.getByText('Journey', { exact: true }).last().click();
  await page.getByRole('button', { name: journeyCellName(1, 'Nature') }).click();
  await expect(page.getByText(title, { exact: true }).last()).toBeVisible();
  await page.getByRole('button', { name: /^(Start|Play again|Resume)$/ }).nth(button).click();
}

const startQuestEleven = (page: Page): Promise<void> => startNatureQuest(page, 1, 'Mountain, River, Sea');

test('quest 11: Hoya says the reading line once, the readable words fold with Show how to say it, and the gloss stays', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await acceptConfirmSheets(page);
  const profileId = await learnerAtQuestEleven(page);
  await startQuestEleven(page);

  // The Hello step: the quest's own line and, under it, Hoya's reading line; Continue stays.
  await expect(page.getByText('Into the Hills', { exact: true })).toBeVisible();
  const line = page.getByTestId('quest-reading-notice');
  await expect(line).toBeVisible();
  await expect(line).toContainText(COPY.readingNotice);
  await expect(page.getByRole('button', { name: 'Continue' })).toBeInViewport();
  await expect.poll(async () => (await readStored<{ romanizationNoticeAt?: string }>(page, `settings:${profileId}`))?.romanizationNoticeAt).toBeTruthy();

  // Look and learn: 산 and 강 show no romanization, the gloss and the Hangul stay, a tap shows it.
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Look and learn', { exact: true })).toBeVisible();
  // A folded line keeps its room (opacity 0, aria-hidden), so nothing moves when it is revealed.
  const kept = page.getByTestId('korean-text-romanization-reserved');
  await expect(kept).toHaveCount(2);
  await expect(kept.first()).toHaveCSS('opacity', '0');
  await expect(kept.first()).toHaveAttribute('aria-hidden', 'true');
  await expect(page.getByText('mountain', { exact: true })).toBeVisible();
  await expect(page.getByText('산', { exact: true }).first()).toBeVisible();
  const reveal = page.getByRole('button', { name: COPY.discover.showHowToSay.cta });
  await expect(reveal).toHaveCount(2);
  await reveal.first().click();
  await expect(page.getByText('san', { exact: true })).toBeVisible();
  await expect(page.getByText('san', { exact: true })).not.toHaveAttribute('aria-hidden', 'true');
  await expect(kept).toHaveCount(1);

  // Leave, finish quest 11 (seeded), and open quest 12 on the same profile: its Hello step has no line (once per profile),
  // and the stored time stays.
  await headerClose(page).click();
  const stored = (await readStored<{ romanizationNoticeAt?: string }>(page, `settings:${profileId}`))?.romanizationNoticeAt;
  expect(stored).toBeTruthy();
  const elevenDone = tenDone(profileId);
  elevenDone.quests.push({ questId: 'quest:stage1-nature-q2', episodeId: 'episode:stage1-nature', startedAt: AT, completedAt: AT, stars: 1, attempts: 1, accuracy: 0.5 });
  await seedStored(page, `progress:${profileId}`, elevenDone);
  await page.goto('/');
  await startNatureQuest(page, 2, 'Moon, Stars and Night');
  await expect(page.getByText('Night Sky', { exact: true })).toBeVisible();
  await expect(page.getByTestId('quest-reading-notice')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
  expect((await readStored<{ romanizationNoticeAt?: string }>(page, `settings:${profileId}`))?.romanizationNoticeAt).toBe(stored);
  expect(errors).toEqual([]);
});

test('a profile that chose Always keeps every romanization and gets no line', async ({ page }) => {
  await acceptConfirmSheets(page);
  const profileId = await learnerAtQuestEleven(page);
  await seedStored(page, `settings:${profileId}`, { romanizationMode: 'always', romanizationChoice: 'always' });
  await page.goto('/');
  await startQuestEleven(page);
  await expect(page.getByText('Into the Hills', { exact: true })).toBeVisible();
  await expect(page.getByTestId('quest-reading-notice')).toHaveCount(0);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('san', { exact: true })).toBeVisible();
  await expect(page.getByText('gang', { exact: true })).toBeVisible();
});
