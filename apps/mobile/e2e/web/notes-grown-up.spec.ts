import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { onboardChild, openGrownUpZone, readStored, seedStored, unlockWithPin } from './helpers';
import { shot } from './shots';

/**
 * F-FEEDBACK-001 FB-9 (section 6.10; mocks design/screens/notes/grown-up-notes.md, note-report.md):
 * the dashboard rows, Notes for <learner>, the report sheet, the class-notes setting and its one-time
 * card. Behind `flags.notesEnabled` (off): run on a build with the flag on,
 *
 *   EXPO_PUBLIC_NOTES_ENABLED=true pnpm --filter @hangul-route/mobile build:web
 *   E2E_NOTES=1 pnpm --filter @hangul-route/mobile exec playwright test notes-grown-up
 *
 * The e2e build has no API, so a report is queued (with a local hide) and the online-only calls
 * (hide, the setting) answer as not saved; FB-14 adds the stubbed-API nightly.
 */

const NOTES = process.env.E2E_NOTES === '1';
const NOW = Date.parse('2026-10-12T12:00:00.000Z');
const iso = (hoursAgo: number): string => new Date(NOW - hoursAgo * 3_600_000).toISOString();
/** Never on a grown-up notes screen: red-flag or shame words, counts of unread, a time since sending. */
const NEVER = /unread|ignored|no reply|in trouble|punish|days ago/i;

const NOTES_SEED = [
  {
    id: 'note:aaaaaaaa',
    spaceId: 'space:cls',
    from: { role: 'teacher', label: null },
    presetId: 'progress_reading',
    text: 'Loved your reading in class today',
    textLocale: 'en',
    suggest: null,
    createdAt: iso(1),
    readAt: iso(0.5),
    reaction: 'thanks',
  },
  {
    id: 'note:bbbbbbbb',
    spaceId: 'space:fam',
    from: { role: 'family', label: 'grandma' },
    presetId: 'warm_thinking_of_you',
    text: null,
    textLocale: null,
    suggest: null,
    createdAt: iso(26),
    readAt: null,
    reaction: null,
  },
];

const MEMBERSHIPS = [
  { spaceId: 'space:cls', kind: 'class', name: 'Saturday Class B', role: 'student', joinedAt: iso(500) },
  { spaceId: 'space:fam', kind: 'family', name: 'Kim family', role: 'student', joinedAt: iso(500) },
];

async function childWithNotes(page: Page, putAway: string[] = []): Promise<string> {
  await page.clock.setFixedTime(NOW);
  await onboardChild(page, { name: 'Mina', startJourney: false });
  await page.goto('/');
  await expect(page.getByText('Hi, Mina!')).toBeVisible();
  const profileId = (await readStored<string>(page, 'profiles:active')) as string;
  await seedStored(page, `memberships:${profileId}`, MEMBERSHIPS);
  await seedStored(page, `notes:${profileId}`, { notes: NOTES_SEED, prefs: { classes: 'all', acknowledged: false }, putAway, classNotesCardSeen: false, queue: [] });
  return profileId;
}

async function openNotesForMina(page: Page): Promise<void> {
  await openGrownUpZone(page, 'Mina');
  await unlockWithPin(page);
  const row = page.getByTestId(/^dashboard-notes-profile/);
  await expect(row).toContainText('Notes for Mina');
  await expect(row).toContainText('New');
  await row.scrollIntoViewIfNeeded();
  await shot(page, 'notes-dashboard-row');
  await row.getByRole('button').click();
  await expect(page.getByRole('heading', { name: 'Notes for Mina' })).toBeVisible();
}

test.describe('grown-up notes (flag on)', () => {
  test.skip(!NOTES, 'needs a build with EXPO_PUBLIC_NOTES_ENABLED=true and E2E_NOTES=1');

  test('Notes for <learner>: every note, put away marked, status, setting, card and disclosure', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    const profileId = await childWithNotes(page, ['note:bbbbbbbb']);
    await openNotesForMina(page);

    const first = page.getByTestId('notes-grown-up-row-note:aaaaaaaa');
    await expect(first).toContainText('Your teacher · Saturday Class B · Today');
    await expect(first).toContainText('Loved your reading in class today');
    await expect(first.getByTestId('notes-grown-up-status')).toHaveText(/Opened.*Thank you/);
    await expect(first.getByRole('button', { name: 'Hide from Mina' })).toBeVisible();
    await expect(first.getByRole('button', { name: 'Report' })).toBeVisible();
    const second = page.getByTestId('notes-grown-up-row-note:bbbbbbbb');
    await expect(second.getByTestId('notes-grown-up-put-away')).toHaveText('Put away on this device');

    await expect(page.getByTestId('notes-one-time-card')).toContainText('Notes from classes: All notes.');
    await expect(page.getByRole('radiogroup', { name: 'Notes from classes' }).getByRole('radio', { name: 'All notes' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByText('Notes from your family always arrive.')).toBeVisible();
    await expect(page.getByTestId('notes-disclosure')).toHaveText('Teachers see the answer Mina picks on their notes.');
    // The native-only shell builds have no Send a note; this build's grown-up home flag is off too.
    await expect(page.getByTestId('notes-send-note')).toHaveCount(0);
    expect(await page.locator('body').innerText()).not.toMatch(NEVER);
    await shot(page, 'notes-grown-up');

    // Opening the learner's notes cleared the dashboard row's New.
    await expect.poll(async () => (await readStored<{ grownUpSeenAt?: string }>(page, `notes:${profileId}`))?.grownUpSeenAt ?? null).not.toBeNull();

    // A call that cannot reach the Worker leaves the choice as it was and says so, amber, never red.
    await page.getByRole('radio', { name: 'Off' }).click();
    await expect(page.getByTestId('notes-grown-up-failed')).toHaveText('That did not save. Try again.');
    await expect(page.getByRole('radio', { name: 'All notes' })).toHaveAttribute('aria-checked', 'true');

    // Hide asks first.
    await first.getByRole('button', { name: 'Hide from Mina' }).click();
    await expect(page.getByTestId('notes-hide-confirm')).toContainText('Hide this note from Mina?');
    await shot(page, 'notes-hide-confirm');
    await page.getByTestId('notes-hide-confirm-cancel').click();
    await expect(page.getByTestId('notes-hide-confirm')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('Report from the grown-up zone: a reason first, then the report is queued and the note hidden here', async ({ page }) => {
    const profileId = await childWithNotes(page);
    await openNotesForMina(page);
    await page.getByTestId('notes-grown-up-row-note:aaaaaaaa').getByRole('button', { name: 'Report' }).click();

    await expect(page.getByRole('heading', { name: 'Report this note' })).toBeVisible();
    await expect(page.getByTestId('note-report-quote')).toContainText('Your reading is getting stronger.');
    await expect(page.getByRole('radio', { name: 'Not meant for Mina' })).toBeVisible();
    await expect(page.getByTestId('note-report-submit')).toBeDisabled();
    await expect(page.getByTestId('note-report-line')).toHaveText('The note goes away for Mina on every device. Our team looks at every report.');
    await expect(page.getByRole('textbox')).toHaveCount(0);
    await page.getByRole('radio', { name: 'Unsafe' }).click();
    await shot(page, 'notes-report-sheet');
    await page.getByTestId('note-report-submit').click();

    await expect(page.getByTestId('note-report-queued')).toContainText('We could not send the report. We will try again when you are online.');
    await expect(page.getByTestId('note-report-queued')).toContainText('If someone is in danger, contact local emergency services.');
    const stored = await readStored<{ queue: Array<{ kind: string; noteId: string; reason?: string; attest?: string }> }>(page, `notes:${profileId}`);
    expect(stored?.queue).toEqual([expect.objectContaining({ kind: 'report', noteId: 'note:aaaaaaaa', reason: 'unsafe', attest: 'grown_up_pin' })]);
    await shot(page, 'notes-report-queued');

    await page.getByTestId('note-report-done').click();
    await expect(page.getByRole('heading', { name: 'Notes for Mina' })).toBeVisible();
    await expect(page.getByTestId('notes-grown-up-row-note:aaaaaaaa')).toHaveCount(0);
  });

  test('Tell a grown-up: the PIN, then the sheet; Done goes back to My notes without the note', async ({ page }) => {
    await childWithNotes(page);
    await page.goto('/');
    await expect(page.getByText('Hi, Mina!')).toBeVisible();
    const guide = page.getByTestId('install-guide');
    await guide.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
    if (await guide.isVisible()) await guide.getByRole('button', { name: 'Not now' }).click();
    await page.getByRole('button', { name: /profile/i }).first().click();
    await page.getByTestId('profile-notes-row').click();
    await page.getByTestId('notes-group-new').getByRole('link').first().click();
    await page.getByRole('link', { name: 'Tell a grown-up (PIN required)' }).click();
    await unlockWithPin(page);
    await expect(page.getByRole('heading', { name: 'Report this note' })).toBeVisible();
    await expect(page.getByTestId('note-report-quote')).toContainText('Thinking of you. Have fun learning today.');
    await page.getByRole('radio', { name: 'Unkind' }).click();
    await page.getByTestId('note-report-submit').click();
    await expect(page.getByTestId('note-report-queued')).toBeVisible();
    await expect(page.getByText('If someone is in danger')).toHaveCount(0);
    await page.getByTestId('note-report-done').click();
    await expect(page.getByRole('heading', { name: 'My notes' })).toBeVisible();
    await expect(page.getByTestId('notes-list').getByRole('link')).toHaveCount(1);
  });

  test('offline: Hide, the card and the setting wait for the internet; Report stays', async ({ page, context }) => {
    await childWithNotes(page);
    await openNotesForMina(page);
    await context.setOffline(true);
    await expect(page.getByTestId('notes-grown-up-offline')).toHaveText('Connect to the internet to do this.');
    const first = page.getByTestId('notes-grown-up-row-note:aaaaaaaa');
    await expect(first.getByRole('button', { name: 'Hide from Mina' })).toBeDisabled();
    await expect(first.getByRole('button', { name: 'Report' })).toBeEnabled();
    await expect(page.getByTestId('notes-card-keep')).toBeDisabled();
    await expect(page.getByRole('radio', { name: 'Off' })).toBeDisabled();
    await shot(page, 'notes-grown-up-offline');
    await context.setOffline(false);
  });
});
