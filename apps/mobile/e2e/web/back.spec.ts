import type { Page } from '@playwright/test';
import { getMessages } from '@hangul-route/i18n';
import { expect, test } from './fixtures';
import { headerBack, headerClose, onboardSelf, openLettersEpisode, seedStored } from './helpers';
import { shot } from './shots';
import { closeInstallGuide } from './text-fit';

/**
 * Row DN-4 (AMENDMENTS-DISPLAY-NAV section 7): a way back on every screen. The visible Back (the
 * route's ScreenHeader, top left) and the browser's back do the same thing, because the web history
 * bridge keeps the tab's history in step with the navigator: the browser back from Profile, an
 * episode, a word topic and the grown-up area lands where the visible Back does; after the visible
 * Back the next browser back is not a dead press; Forward never reopens a screen that was left (the
 * grown-up area); a quest asks before leaving, in the UI language; PlacementInvite and the
 * FirstQuestPreview it opens have no Back; All lessons opened from a page of this origin, two links deep,
 * still closes back to that page.
 */
const en = getMessages('en');
const es = getMessages('es');

/** The depth the history bridge wrote on the tab's current entry. */
function entryDepth(page: Page): Promise<number | null> {
  return page.evaluate(() => {
    const state = window.history.state as { hrNav?: unknown } | null;
    return typeof state?.hrNav === 'number' ? state.hrNav : null;
  });
}

async function home(page: Page, name: string): Promise<void> {
  await page.goto('/');
  await expect(page.getByText(`Hi, ${name}!`)).toBeVisible();
  await closeInstallGuide(page);
}

test.describe('the way back (AMENDMENTS-DISPLAY-NAV section 7)', () => {
  test('Profile and the grown-up area: Back top left, the browser back lands where it does, Forward stays closed', async ({ page }) => {
    await onboardSelf(page, { name: 'Dani', startJourney: false });
    await home(page, 'Dani');
    expect(await entryDepth(page)).toBe(0);

    await page.getByRole('button', { name: 'Profile and settings' }).click();
    await expect(page.getByRole('heading', { name: 'Profiles & settings' })).toBeVisible();
    expect(await entryDepth(page)).toBe(1);
    // Back is top left: the first control of the screen, named by its word.
    const back = headerBack(page);
    await expect(back).toHaveAccessibleName(en.common.buttons.back);
    const box = (await back.boundingBox())!;
    expect(box.x).toBeLessThan(40);
    expect(box.height).toBeGreaterThanOrEqual(64);
    await shot(page, 'dn4-profile-back-pixel5');

    await page.getByRole('button', { name: /^Account & backup/ }).click();
    await expect(page.getByText(en.caregiver.dashboard.title, { exact: true }).filter({ visible: true })).toBeVisible();
    expect(await entryDepth(page)).toBe(2);

    // The browser back from the grown-up area: Profile, exactly as the visible Back.
    await page.goBack();
    await expect(page.getByRole('heading', { name: 'Profiles & settings' })).toBeVisible();
    expect(await entryDepth(page)).toBe(1);
    // Forward is never replayed: the grown-up area stays closed.
    await page.goForward();
    await page.waitForTimeout(400);
    await expect(page.getByRole('heading', { name: 'Profiles & settings' })).toBeVisible();
    await expect(page.getByText(en.caregiver.dashboard.title, { exact: true }).filter({ visible: true })).toHaveCount(0);
    expect(await entryDepth(page)).toBe(1);

    // The visible Back, then the browser back has nothing dead in between: Home is the app's first entry.
    await headerBack(page).click();
    await expect(page.getByText('Hi, Dani!')).toBeVisible();
    await expect.poll(() => entryDepth(page)).toBe(0);
  });

  test('an episode and a word topic: the browser back lands where the visible Back does', async ({ page }) => {
    await onboardSelf(page, { name: 'Rio', startJourney: false });
    await home(page, 'Rio');
    await openLettersEpisode(page);
    await expect(headerBack(page)).toBeVisible();
    await page.goBack();
    await expect(page.getByText('Journey', { exact: true }).last()).toBeVisible();
    await expect(headerBack(page)).toHaveCount(0);

    await page.getByText('Library', { exact: true }).last().click();
    await page.getByRole('tab', { name: 'Words' }).click();
    await page.getByTestId('vocab-topic-tile-food').click();
    await expect(page.getByTestId('vocab-topic-title')).toHaveText('Food');
    await shot(page, 'dn4-vocab-topic-back-pixel5');
    await page.goBack();
    await expect(page.getByTestId('vocab-topic-tile-food')).toBeVisible();
    await expect(headerBack(page)).toHaveCount(0);
  });

  test('a quest asks before leaving: Close and the browser back open the same sheet, in the UI language', async ({ page }) => {
    await onboardSelf(page, { name: 'Ana', startJourney: false });
    await seedStored(page, 'device:settings', { uiLocale: 'es', uiLocaleAt: '2026-10-16T09:00:00.000Z' });
    await expect(page.getByText('¡Hola, Ana!')).toBeVisible();
    await closeInstallGuide(page);
    await page.getByText(es.a11y.tabs.journey, { exact: true }).last().click();
    await page.getByRole('button', { name: /^Etapa 1 / }).first().click();
    await page.getByRole('button', { name: es.learner.episode.quests.start.cta, exact: true }).first().click();
    const close = headerClose(page);
    await expect(close).toHaveAccessibleName(es.common.buttons.close);

    // The browser back asks first (the quest's guard), in Spanish, with the safe choice first.
    await page.goBack();
    const sheet = page.getByRole('alertdialog');
    await expect(sheet).toBeVisible();
    await expect(sheet).toContainText(es.learner.quest.leave.title);
    const buttons = sheet.getByRole('button');
    await expect(buttons.first()).toHaveText(es.learner.quest.leave.keep.cta);
    await expect(buttons.last()).toHaveText(es.learner.quest.leave.confirm.cta);
    await expect(buttons.first()).toBeFocused();
    await shot(page, 'dn4-quest-leave-sheet-es-pixel5');
    await buttons.first().click();
    await expect(sheet).toHaveCount(0);
    await expect(close).toBeVisible();

    // The browser back while the sheet is open closes it as Keep playing does.
    await close.click();
    await expect(sheet).toBeVisible();
    await page.goBack();
    await expect(sheet).toHaveCount(0);
    await expect(close).toBeVisible();

    // Leave leaves.
    await close.click();
    await sheet.getByRole('button', { name: es.learner.quest.leave.confirm.cta }).click();
    await expect(close).toHaveCount(0);
  });

  test('the way on from PlacementInvite opens FirstQuestPreview, both with no Back (the exception list)', async ({ page }) => {
    await onboardSelf(page, { name: 'Leo', levelCheck: 'stop' });
    await expect(page.getByTestId('placement-invite')).toBeVisible();
    await expect(headerBack(page)).toHaveCount(0);
    // The Display (Aa) control is still there.
    await expect(page.getByTestId('screen-header-display').filter({ visible: true })).toBeVisible();
    await page.getByTestId('placement-invite-new').click();
    await expect(page.getByRole('button', { name: 'Start my journey' })).toBeVisible();
    await expect(headerBack(page)).toHaveCount(0);
    await expect(headerClose(page)).toHaveCount(0);
  });

  test('All lessons opened from a page of this origin, two links deep, closes back to that page', async ({ page }) => {
    await onboardSelf(page, { name: 'Mo', startJourney: false });
    await page.goto('/signin');
    await page.evaluate(() => {
      const at = Date.now();
      sessionStorage.setItem('hr:browse:pass', JSON.stringify({ v: 1, scope: 'full', source: 'gate', issuedAt: at, seen: at }));
      window.location.assign('/browse#t=quest:stage1-letters-q1&s=gate');
    });
    await expect(page.getByTestId('browse-facts-steps')).toBeVisible();
    // The item page sits on the home (an entry stack): Back goes there, and the browser back too.
    await expect(headerBack(page)).toBeVisible();
    // A second link while the tab is open.
    await page.evaluate(() => window.location.assign('/browse#t=quest:stage1-letters-q2&s=gate'));
    await expect(page.getByTestId('browse-facts-steps')).toBeVisible();
    await headerBack(page).click();
    await expect(page.getByRole('heading', { name: en.caregiver.browse.home.title })).toBeVisible();
    // Close from the home goes back past every entry this page added, to the page that opened All lessons.
    await headerClose(page).click();
    await page.waitForURL(/\/signin/);
  });
});
