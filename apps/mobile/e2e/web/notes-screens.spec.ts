import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { onboardChild, onboardSelf, readStored, seedStored } from './helpers';
import { shot } from './shots';

/**
 * F-FEEDBACK-001 FB-8 (sections 6.5, 6.6, 6.10 items 3 and 4; mocks design/screens/notes/home-card.md,
 * notes-list.md, note-page.md): the Home card (row 2a), My notes, the note page and the Profile row.
 * They live behind `flags.notesEnabled` (off), so a default build checks that none of them shows,
 * and a build made with the flag on checks the screens on notes seeded into the store (no API in
 * the e2e build, so nothing is fetched or flushed):
 *
 *   EXPO_PUBLIC_NOTES_ENABLED=true pnpm --filter @hangul-route/mobile build:web
 *   E2E_NOTES=1 pnpm --filter @hangul-route/mobile exec playwright test notes-screens
 *
 * Metro caches the inlined `EXPO_PUBLIC_*` values: when switching the flag between local builds,
 * export once with `expo export --clear`. FB-14 adds the nightly notes.spec.ts over a stubbed API.
 */

const NOTES = process.env.E2E_NOTES === '1';
/** The free-plan switch (F-ENT-003): only a build with it on has closed quests. */
const GATED = process.env.E2E_CONTENT_GATING === '1';
const NOW = Date.parse('2026-10-12T12:00:00.000Z');
const EMOJI = /\p{Extended_Pictographic}/u;
/** Never on a learner notes screen: shame and pressure words, a ranking, an unread warning. */
const NEVER = /unread|ignored|no reply|\blate\b|behind|missed|ranking|\bprice\b|premium|upgrade/i;
const QUEST = 'quest:stage1-letters-q1';
/** A Stage 2 quest: closed for a learner on the free plan (all of Stage 1). */
const CLOSED_QUEST = 'quest:stage2-life-q1';

const iso = (hoursAgo: number): string => new Date(NOW - hoursAgo * 3_600_000).toISOString();

interface SeedNote {
  id: string;
  spaceId: string;
  from: { role: 'teacher' | 'family'; label: string | null };
  presetId: string;
  text: string | null;
  textLocale: string | null;
  suggest: { kind: 'quest'; id: string } | null;
  createdAt: string;
  readAt: string | null;
  reaction: string | null;
}

const classNote = (over: Partial<SeedNote> = {}): SeedNote => ({
  id: 'note:aaaaaaaa',
  spaceId: 'space:cls',
  from: { role: 'teacher', label: null },
  presetId: 'progress_reading',
  text: 'Loved your reading in class today',
  textLocale: 'en',
  suggest: null,
  createdAt: iso(1),
  readAt: null,
  reaction: null,
  ...over,
});

const familyNote = (over: Partial<SeedNote> = {}): SeedNote => ({
  id: 'note:bbbbbbbb',
  spaceId: 'space:fam',
  from: { role: 'family', label: 'grandma' },
  presetId: 'warm_thinking_of_you',
  text: '할머니가 응원해요',
  textLocale: 'ko',
  suggest: null,
  createdAt: iso(26),
  readAt: null,
  reaction: null,
  ...over,
});

const MEMBERSHIPS = [
  { spaceId: 'space:cls', kind: 'class', name: 'Saturday Class B', role: 'student', joinedAt: iso(500) },
  { spaceId: 'space:fam', kind: 'family', name: 'Kim family', role: 'student', joinedAt: iso(500) },
];

/** The install guide shows from the third cached open and covers Home. */
async function closeInstallGuide(page: Page): Promise<void> {
  const guide = page.getByTestId('install-guide');
  await guide.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
  if (await guide.isVisible()) await guide.getByRole('button', { name: 'Not now' }).click();
}

async function learnerWithNotes(page: Page, notes: SeedNote[], o: { self?: boolean; name?: string; memberships?: unknown[] } = {}): Promise<string> {
  const name = o.name ?? 'Mina';
  await page.clock.setFixedTime(NOW);
  if (o.self) await onboardSelf(page, { name, startJourney: false });
  else await onboardChild(page, { name, startJourney: false });
  await page.goto('/');
  await expect(page.getByText(`Hi, ${name}!`)).toBeVisible();
  const profileId = (await readStored<string>(page, 'profiles:active')) as string;
  await seedStored(page, `memberships:${profileId}`, o.memberships ?? MEMBERSHIPS);
  await seedStored(page, `notes:${profileId}`, { notes, prefs: { classes: 'all', acknowledged: true }, putAway: [], classNotesCardSeen: true, queue: [] });
  await expect(page.getByText(`Hi, ${name}!`)).toBeVisible();
  await closeInstallGuide(page);
  return profileId;
}

async function openProfile(page: Page): Promise<void> {
  await page.getByRole('button', { name: /profile/i }).first().click();
}

test.describe('notes screens with the flag off (default build)', () => {
  test.skip(NOTES, 'runs on the default build only');

  test('no Home card and no My notes row, even with a note in the store', async ({ page }) => {
    await learnerWithNotes(page, [classNote()]);
    await expect(page.getByTestId('home-notes-card')).toHaveCount(0);
    await openProfile(page);
    await expect(page.getByTestId('profile-notes-row')).toHaveCount(0);
  });
});

test.describe('notes screens (flag on)', () => {
  test.skip(!NOTES, 'needs a build with EXPO_PUBLIC_NOTES_ENABLED=true and E2E_NOTES=1');

  test('one new note: the Home card after the missions opens the note, which reads, answers and leaves Home', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    const profileId = await learnerWithNotes(page, [classNote()]);

    // Row 2a: one target, named as one group; after the mission cards; no free text on Home.
    const card = page.getByTestId('home-notes-card');
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute('aria-label', 'New note from Your teacher · Saturday Class B: Your reading is getting stronger. Read.');
    await expect(card).toContainText('A note from Your teacher · Saturday Class B');
    await expect(card).not.toContainText('Loved your reading');
    await expect(card.getByRole('button')).toHaveCount(0);
    const missionsBox = await page.getByTestId('home-missions').boundingBox();
    const cardBox = await card.boundingBox();
    expect(missionsBox && cardBox && cardBox.y > missionsBox.y).toBe(true);
    await card.scrollIntoViewIfNeeded();
    await shot(page, 'notes-home-card-one');

    await card.click();
    await expect(page.getByTestId('note-preset')).toHaveText('Your reading is getting stronger.');
    const words = page.getByTestId('note-words');
    await expect(words).toContainText('Loved your reading in class today');
    await expect(words.locator('[lang="en"]')).toHaveCount(1);
    await expect(page.getByTestId('note-from')).toHaveText('From Your teacher · Saturday Class B · Today');
    const group = page.getByRole('radiogroup', { name: 'Answer with one tap' });
    await expect(group.getByRole('radio')).toHaveCount(4);
    await expect(group.getByRole('radio', { checked: true })).toHaveCount(0);
    await expect(page.getByTestId('note-seen-by')).toHaveText('Your teacher will see your answer.');
    await expect(group).toHaveAttribute('aria-describedby', 'note-seen-by');
    // No quest, so no primary on the page; the two quiet links at the bottom.
    await expect(page.getByTestId('note-quest-start')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Put this note away' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Tell a grown-up (PIN required)' })).toBeVisible();
    const text = await page.locator('body').innerText();
    expect(text).not.toMatch(NEVER);
    expect(text).not.toMatch(EMOJI);
    await shot(page, 'notes-page-open');

    // Opening marked it read, local first and queued.
    await expect.poll(async () => (await readStored<{ notes: SeedNote[] }>(page, `notes:${profileId}`))?.notes[0]?.readAt ?? null).not.toBeNull();

    await group.getByRole('radio', { name: 'Thank you' }).click();
    await expect(group.getByRole('radio', { name: 'Thank you' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByText('You picked: Thank you')).toBeAttached();
    await group.getByRole('radio', { name: 'I did it' }).click();
    await expect(group.getByRole('radio', { name: 'I did it' })).toHaveAttribute('aria-checked', 'true');
    await expect(group.getByRole('radio', { checked: true })).toHaveCount(1);
    await expect
      .poll(async () => {
        const stored = await readStored<{ notes: SeedNote[]; queue: Array<{ kind: string; reaction?: string; read?: boolean }> }>(page, `notes:${profileId}`);
        return { reaction: stored?.notes[0]?.reaction, queue: stored?.queue };
      })
      .toMatchObject({ reaction: 'did_it', queue: [{ kind: 'state', read: true, reaction: 'did_it' }] });
    await shot(page, 'notes-page-picked');

    // Back on Home the card is gone (read); the Profile row has no New pill.
    await page.getByTestId('notes-back').click();
    await expect(page.getByText('Hi, Mina!')).toBeVisible();
    await expect(page.getByTestId('home-notes-card')).toHaveCount(0);
    await openProfile(page);
    const row = page.getByTestId('profile-notes-row');
    await expect(row).toBeVisible();
    await expect(row).not.toContainText('New');
    expect(errors).toEqual([]);
  });

  test('several new notes: the card counts them and opens My notes, grouped New then Earlier', async ({ page }) => {
    const earlier = classNote({ id: 'note:cccccccc', presetId: 'effort_proud', text: null, createdAt: iso(24 * 5), readAt: iso(24 * 5 - 1), reaction: 'thanks' });
    await learnerWithNotes(page, [classNote(), familyNote(), earlier]);
    const card = page.getByTestId('home-notes-card');
    await expect(card).toContainText('2 new notes');
    await expect(card).toContainText('From Your teacher · Saturday Class B');
    await expect(card).toHaveAttribute('aria-label', '2 new notes. Newest from Your teacher · Saturday Class B. Read.');
    await shot(page, 'notes-home-card-many');
    await card.click();

    await expect(page.getByRole('heading', { name: 'My notes' })).toBeVisible();
    const fresh = page.getByTestId('notes-group-new');
    await expect(fresh.getByRole('link')).toHaveCount(2);
    await expect(fresh.getByRole('link').first()).toHaveAttribute('aria-label', 'New. From Your teacher · Saturday Class B, Today. Your reading is getting stronger.');
    await expect(fresh.getByRole('link').nth(1)).toHaveAttribute('aria-label', 'New. From Grandma, Yesterday. Thinking of you. Have fun learning today.');
    // The Korean words are marked Korean for a screen reader.
    await expect(fresh.locator('[lang="ko"]')).toHaveCount(1);
    const old = page.getByTestId('notes-group-earlier');
    await expect(old.getByRole('link')).toHaveCount(1);
    await expect(old.getByRole('link')).toHaveAttribute('aria-label', /Your answer: Thank you$/);
    await expect(old.getByTestId('notes-row-answer')).toHaveText('Thank you');
    const text = await page.locator('body').innerText();
    expect(text).not.toMatch(NEVER);
    await shot(page, 'notes-list');

    // A family note says the family sees the answer.
    await fresh.getByRole('link').nth(1).click();
    await expect(page.getByTestId('note-seen-by')).toHaveText('Your family will see your answer.');
    await expect(page.getByTestId('note-words').locator('[lang="ko"]')).toHaveCount(1);
  });

  test('an open suggested quest has Start, which opens the quest player', async ({ page }) => {
    await learnerWithNotes(page, [classNote({ presetId: 'next_try_this', text: null, suggest: { kind: 'quest', id: QUEST } })]);
    await page.getByTestId('home-notes-card').click();
    await expect(page.getByTestId('note-preset')).toHaveText('Try this quest next. I think you will like it.');
    const quest = page.getByTestId('note-quest-open');
    await expect(quest).toBeVisible();
    await expect(quest).toContainText('Try this quest');
    await expect(page.getByTestId('note-quest-closed-caption')).toHaveCount(0);
    await shot(page, 'notes-page-quest');
    await page.getByRole('button', { name: 'Start' }).click();
    await expect(page.getByRole('button', { name: 'Leave quest' })).toBeVisible();
  });

  test('Put this note away hides it on this device, says so once, and sends nothing', async ({ page }) => {
    const profileId = await learnerWithNotes(page, [classNote(), familyNote({ readAt: iso(20) })]);
    await openProfile(page);
    await expect(page.getByTestId('profile-notes-row')).toContainText('New');
    await page.getByTestId('profile-notes-row').click();
    await page.getByTestId('notes-group-new').getByRole('link').first().click();
    await page.getByRole('button', { name: 'Put this note away' }).click();

    await expect(page.getByTestId('notes-put-away-done')).toHaveText('Put away. A grown-up can still see it.');
    await expect(page.getByTestId('notes-group-new')).toHaveCount(0);
    await expect(page.getByTestId('notes-group-earlier').getByRole('link')).toHaveCount(1);
    const stored = await readStored<{ putAway: string[]; queue: Array<{ kind: string }> }>(page, `notes:${profileId}`);
    expect(stored?.putAway).toEqual(['note:aaaaaaaa']);
    expect(stored?.queue.filter((w) => w.kind === 'report')).toEqual([]);
    await shot(page, 'notes-put-away');
    // One My notes on the stack: one Back reaches Profile.
    await page.getByTestId('notes-back').click();
    await expect(page.getByTestId('profile-notes-row')).toBeVisible();
  });

  test('a closed suggested quest shows its caption, with no Start, no gate and no paywall', async ({ page }) => {
    test.skip(!GATED, 'needs a build with EXPO_PUBLIC_CONTENT_GATING_ENABLED=true and E2E_CONTENT_GATING=1');
    // A class space opens every quest for its learners, so this learner is on the free plan alone: the
    // note stays on the device from an earlier sync.
    await learnerWithNotes(page, [classNote({ presetId: 'next_try_this', text: null, suggest: { kind: 'quest', id: CLOSED_QUEST } })], { memberships: [] });
    await page.getByTestId('home-notes-card').click();
    const quest = page.getByTestId('note-quest-closed');
    await expect(quest).toBeVisible();
    await expect(page.getByTestId('note-quest-closed-caption')).toHaveText('Opens with the full route');
    await expect(page.getByTestId('note-quest-open')).toHaveCount(0);
    await expect(page.getByTestId('note-quest-start')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Start' })).toHaveCount(0);
    await expect(quest.getByRole('button')).toHaveCount(0);
    // Tapping the card opens nothing: no PIN screen, no plan or price page.
    await quest.click();
    await expect(page.getByTestId('note-page')).toBeVisible();
    await expect(page.getByText('Enter your 4-digit PIN to continue.')).toHaveCount(0);
    expect(await page.locator('body').innerText()).not.toMatch(NEVER);
    await shot(page, 'notes-page-quest-closed');
  });

  test('Tell a grown-up opens the PIN screen on a family device', async ({ page }) => {
    await learnerWithNotes(page, [classNote()]);
    await page.getByTestId('home-notes-card').click();
    await page.getByRole('link', { name: 'Tell a grown-up (PIN required)' }).click();
    await expect(page.getByText('Enter your 4-digit PIN to continue.')).toBeVisible();
  });

  test('a self-managed profile reads "Report this note" with no PIN wording', async ({ page }) => {
    await learnerWithNotes(page, [classNote()], { self: true, name: 'Rae' });
    await page.getByTestId('home-notes-card').click();
    await expect(page.getByRole('link', { name: 'Report this note', exact: true })).toBeVisible();
    await expect(page.getByText('Tell a grown-up')).toHaveCount(0);
  });

  test('wide window: My notes and the open note side by side, the open row marked', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const profileId = await learnerWithNotes(page, [classNote(), familyNote()]);
    await expect(page.getByTestId('home-side-column').getByTestId('home-notes-card')).toBeVisible();
    await shot(page, 'notes-home-wide');
    await page.getByTestId('home-notes-card').click();
    const rows = page.getByTestId('notes-list').getByRole('link');
    await expect(rows).toHaveCount(2);
    const classRow = page.getByTestId('notes-row-note:aaaaaaaa');
    const familyRow = page.getByTestId('notes-row-note:bbbbbbbb');
    await expect(classRow).toHaveAttribute('aria-current', 'true');
    await expect(page.getByTestId('note-preset')).toHaveText('Your reading is getting stronger.');
    // Only the open note is marked read: the next unread one waits under New until it is tapped.
    const readAt = async (id: string): Promise<string | null | undefined> =>
      ((await readStored<{ notes: SeedNote[] }>(page, `notes:${profileId}`))?.notes ?? []).find((n) => n.id === id)?.readAt;
    await expect.poll(() => readAt('note:aaaaaaaa')).not.toBeNull();
    await page.waitForTimeout(500);
    expect(await readAt('note:bbbbbbbb')).toBeNull();
    await expect(page.getByTestId('notes-group-new').getByTestId('notes-row-note:bbbbbbbb')).toBeVisible();
    await expect(classRow).toHaveAttribute('aria-current', 'true');
    await expect(page.getByTestId('note-preset')).toHaveText('Your reading is getting stronger.');
    await familyRow.click();
    await expect(familyRow).toHaveAttribute('aria-current', 'true');
    await expect(page.getByTestId('note-preset')).toHaveText('Thinking of you. Have fun learning today.');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await shot(page, 'notes-list-wide');
  });

  test('wide window: putting the open note away opens no other note', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const profileId = await learnerWithNotes(page, [classNote(), familyNote()]);
    await page.getByTestId('home-notes-card').click();
    await expect(page.getByTestId('note-preset')).toHaveText('Your reading is getting stronger.');
    await page.getByRole('button', { name: 'Put this note away' }).click();
    await expect(page.getByTestId('notes-put-away-done')).toBeVisible();
    await expect(page.getByTestId('note-preset')).toHaveCount(0);
    await page.waitForTimeout(500);
    const notes = (await readStored<{ notes: SeedNote[] }>(page, `notes:${profileId}`))?.notes ?? [];
    expect(notes.find((n) => n.id === 'note:bbbbbbbb')?.readAt).toBeNull();
    await expect(page.getByTestId('notes-group-new').getByRole('link')).toHaveCount(1);
  });

  test('no sideways scroll on the note page at 320', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await learnerWithNotes(page, [classNote({ presetId: 'next_try_this', suggest: { kind: 'quest', id: QUEST } })]);
    await page.getByTestId('home-notes-card').click();
    await expect(page.getByTestId('note-page')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await shot(page, 'notes-page-320');
  });
});
