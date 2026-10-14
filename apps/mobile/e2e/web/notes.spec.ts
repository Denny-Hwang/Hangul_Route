import type { BrowserContext, Page, Route } from '@playwright/test';
import { expect, test } from './fixtures';
import { onboardChild, openGrownUpZone, readStored, seedStored, unlockWithPin } from './helpers';
import { shot } from './shots';

/**
 * F-FEEDBACK-001 FB-14 (section 15, `apps/mobile/e2e/notes.spec.ts`): the learner's notes and the grown-up zone's
 * answers that need the Worker, over a stubbed sync API (`page.route`; nothing leaves the machine). Notes are on by
 * default since FB-14; the release build has no API address, so this spec needs a build that has one:
 *
 *   EXPO_PUBLIC_API_BASE_URL=https://api.e2e.invalid npx expo export --platform web --output-dir dist --clear
 *   E2E_NOTES_API=1 pnpm --filter @hangul-route/mobile exec playwright test notes.spec
 *
 * Covered: an inbox note shows on Home; opening marks it read; a reaction, then offline, then another reaction; back
 * online the next sync flushes one state write with the last reaction; put away (local, sends nothing); a taken-back
 * note leaves the list at the next inbox; and in the grown-up zone: a class-scoped device (`403 scope_limited`)
 * removes Hide, disables the setting and shows the class-scoped line on the one-time card; Keep or Change answers the
 * card once, Change moves focus to the setting; a mode picked while the card shows answers it too; Just hide it and
 * Hide succeed. FB-9's `notes-grown-up.spec.ts` covers the rest of the grown-up zone with no API.
 */
test.use({ serviceWorkers: 'block', viewport: { width: 375, height: 740 } });
test.skip(process.env.E2E_NOTES_API !== '1', 'needs a build with EXPO_PUBLIC_API_BASE_URL=https://api.e2e.invalid (E2E_NOTES_API=1)');

const API = 'https://api.e2e.invalid';
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, content-type', 'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE' };
const NOW = Date.now();
const iso = (hoursAgo: number): string => new Date(NOW - hoursAgo * 3_600_000).toISOString();
/** Never on a notes screen: shame and pressure words, counts of unread, a time since sending. */
const NEVER = /unread|ignored|no reply|\blate\b|behind|missed|ranking|in trouble|punish|days ago/i;

const CLASS = { spaceId: 'space:cls', kind: 'class', name: 'Saturday Class B', role: 'student', joinedAt: iso(500) };
const FAMILY = { spaceId: 'space:fam', kind: 'family', name: 'Kim family', role: 'student', joinedAt: iso(500) };

interface WireNote {
  id: string;
  spaceId: string;
  from: { role: 'teacher' | 'family'; label: string | null };
  presetId: string;
  text: string | null;
  textLocale: string | null;
  suggest: null;
  createdAt: string;
  readAt: string | null;
  reaction: string | null;
}

const classNote = (over: Partial<WireNote> = {}): WireNote => ({
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

const familyNote = (over: Partial<WireNote> = {}): WireNote => ({
  id: 'note:bbbbbbbb',
  spaceId: 'space:fam',
  from: { role: 'family', label: 'grandma' },
  presetId: 'warm_thinking_of_you',
  text: null,
  textLocale: null,
  suggest: null,
  createdAt: iso(3),
  readAt: null,
  reaction: null,
  ...over,
});

interface Call {
  method: string;
  path: string;
  body: unknown;
}

interface Mocks {
  notes: WireNote[];
  notePrefs: { classes: 'all' | 'presets' | 'off'; acknowledged: boolean };
  /** What the device hide and note-prefs routes answer: `200`, or `403 scope_limited` (a class-scoped device). */
  writes: 'ok' | 'scope_limited';
  calls: Call[];
}

function json(route: Route, status: number, body: unknown): Promise<void> {
  return route.fulfill({ status, contentType: 'application/json', headers: CORS, body: JSON.stringify(body) });
}

async function mockApi(context: BrowserContext, over: Partial<Mocks> = {}): Promise<Mocks> {
  const mocks: Mocks = { notes: [], notePrefs: { classes: 'all', acknowledged: true }, writes: 'ok', calls: [], ...over };
  const scopeLimited = (route: Route): Promise<void> => json(route, 403, { error: { code: 'scope_limited', message: 'class-scoped device' } });
  await context.route(`${API}/**`, async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const path = decodeURIComponent(new URL(req.url()).pathname);
    const body = req.postData() ? (JSON.parse(req.postData() ?? '{}') as unknown) : null;
    mocks.calls.push({ method: req.method(), path, body });
    if (path.endsWith('/inbox')) {
      return json(route, 200, {
        data: {
          rev: 1,
          plans: [],
          memberships: [CLASS, FAMILY],
          tier: 'free',
          serverTime: new Date().toISOString(),
          selfManaged: false,
          deviceScope: 'full',
          notes: mocks.notes,
          notePrefs: mocks.notePrefs,
        },
      });
    }
    const state = /\/notes\/([^/]+)\/state$/.exec(path);
    if (state && req.method() === 'PUT') {
      const write = body as { read?: true; reaction?: string };
      mocks.notes = mocks.notes.map((n) =>
        n.id === state[1] ? { ...n, readAt: write.read ? (n.readAt ?? new Date().toISOString()) : n.readAt, reaction: write.reaction ?? n.reaction } : n,
      );
      const note = mocks.notes.find((n) => n.id === state[1]);
      return json(route, 200, { data: { readAt: note?.readAt ?? null, reaction: note?.reaction ?? null } });
    }
    const hide = /\/notes\/([^/]+)\/hide$/.exec(path);
    if (hide && req.method() === 'POST') {
      if (mocks.writes === 'scope_limited') return scopeLimited(route);
      mocks.notes = mocks.notes.filter((n) => n.id !== hide[1]);
      return json(route, 200, { data: {} });
    }
    if (/\/notes\/[^/]+\/report$/.test(path)) return json(route, 201, { data: {} });
    if (path.endsWith('/note-prefs') && req.method() === 'PUT') {
      if (mocks.writes === 'scope_limited') return scopeLimited(route);
      const put = body as { classes: Mocks['notePrefs']['classes']; acknowledge?: true };
      mocks.notePrefs = { classes: put.classes, acknowledged: mocks.notePrefs.acknowledged || put.acknowledge === true };
      return json(route, 200, { data: { prefs: mocks.notePrefs } });
    }
    if (path.endsWith('/snapshot')) return json(route, 200, { data: { rev: 1 } });
    return json(route, 404, { error: { code: 'not_found' } });
  });
  return mocks;
}

/** A synced child profile (a device secret), then Home, where the first sync reads the mocked inbox. */
async function syncedChild(page: Page): Promise<string> {
  await onboardChild(page, { name: 'Mina', startJourney: false });
  const id = (await readStored<string>(page, 'profiles:active')) as string;
  // The app's own first sign-up try (no secret yet, 404 here) can still write its blank sync state after the
  // seed lands; reload and check, so every test starts from a synced device.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await seedStored(page, `sync:${id}`, { secret: 'secret-e2e', rev: 1, lastSyncedAt: new Date().toISOString(), rescueCode: null });
    await page.goto('/');
    const stored = await readStored<{ secret: string | null }>(page, `sync:${id}`);
    if (stored?.secret === 'secret-e2e') return id;
  }
  throw new Error('the seeded sync state did not stick');
}

async function home(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByText('Hi, Mina!')).toBeVisible();
  const guide = page.getByTestId('install-guide');
  await guide.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
  if (await guide.isVisible()) await guide.getByRole('button', { name: 'Not now' }).click();
}

const stateWrites = (mocks: Mocks): Call[] => mocks.calls.filter((c) => c.method === 'PUT' && /\/notes\/[^/]+\/state$/.test(c.path));
const storedNotes = (page: Page, id: string) =>
  readStored<{ notes: WireNote[]; putAway: string[]; queue: Array<{ kind: string; noteId: string; read?: boolean; reaction?: string }> }>(page, `notes:${id}`);

test.describe('the learner, over the inbox', () => {
  test('an inbox note shows on Home; open reads it; react, go offline, react again; back online one write carries the last reaction', async ({ page, context }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    const mocks = await mockApi(context, { notes: [classNote()] });
    const id = await syncedChild(page);
    await home(page);

    // The note came from the Worker's inbox, not a seed; on a busy machine the first sync can take a few seconds.
    const card = page.getByTestId('home-notes-card');
    await expect(card).toBeVisible({ timeout: 15_000 });
    await expect(card).toContainText('A note from Your teacher · Saturday Class B');
    expect(await page.locator('body').innerText()).not.toMatch(NEVER);
    await card.scrollIntoViewIfNeeded();
    await shot(page, 'notes-api-home-card');

    await card.click();
    await expect(page.getByTestId('note-preset')).toHaveText('Your reading is getting stronger.');
    await expect.poll(async () => (await storedNotes(page, id))?.notes[0]?.readAt ?? null).not.toBeNull();
    const group = page.getByRole('radiogroup', { name: 'Answer with one tap' });
    await group.getByRole('radio', { name: 'Thank you' }).click();
    await expect(group.getByRole('radio', { name: 'Thank you' })).toHaveAttribute('aria-checked', 'true');

    await context.setOffline(true);
    await group.getByRole('radio', { name: 'I did it' }).click();
    await expect(group.getByRole('radio', { name: 'I did it' })).toHaveAttribute('aria-checked', 'true');
    await expect.poll(async () => (await storedNotes(page, id))?.queue).toEqual([expect.objectContaining({ kind: 'state', noteId: 'note:aaaaaaaa', read: true, reaction: 'did_it' })]);
    await shot(page, 'notes-api-offline-pick');

    // Back online, the next sync flushes the queue before it reads the inbox: one write, the last reaction wins.
    const before = stateWrites(mocks).length;
    await context.setOffline(false);
    await home(page);
    await expect.poll(() => stateWrites(mocks).length, { timeout: 15_000 }).toBeGreaterThan(before);
    // The offline queue collapses into exactly one write that carries the last reaction.
    const flushed = stateWrites(mocks).slice(before);
    expect(flushed).toHaveLength(1);
    expect(flushed[0]?.body).toEqual({ read: true, reaction: 'did_it' });
    expect(flushed[0]?.path).toContain('/notes/note:aaaaaaaa/state');
    await expect.poll(async () => (await storedNotes(page, id))?.queue ?? null).toEqual([]);
    // Read and answered: no Home card.
    await expect(page.getByTestId('home-notes-card')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('put away stays on this device and sends nothing; a note taken back leaves the list at the next inbox', async ({ page, context }) => {
    const mocks = await mockApi(context, { notes: [classNote(), familyNote(), classNote({ id: 'note:cccccccc', presetId: 'effort_proud', text: null, createdAt: iso(30) })] });
    const id = await syncedChild(page);
    await home(page);
    await expect(page.getByTestId('home-notes-card')).toContainText('3 new notes', { timeout: 15_000 });
    await page.getByTestId('home-notes-card').click();
    await expect(page.getByRole('heading', { name: 'My notes' })).toBeVisible();
    await expect(page.getByTestId('notes-list').getByRole('link')).toHaveCount(3);

    // Put the newest note away: local only, no hide and no report reaches the Worker.
    await page.getByTestId('notes-list').getByRole('link').first().click();
    await page.getByRole('button', { name: 'Put this note away' }).click();
    await expect(page.getByTestId('notes-put-away-done')).toHaveText('Put away. A grown-up can still see it.');
    await expect(page.getByTestId('notes-list').getByRole('link')).toHaveCount(2);
    expect((await storedNotes(page, id))?.putAway).toEqual(['note:aaaaaaaa']);
    expect(mocks.calls.filter((c) => /\/(hide|report)$/.test(c.path))).toEqual([]);

    // Grandma takes her note back: the next inbox no longer carries it, and the list follows the inbox.
    mocks.notes = mocks.notes.filter((n) => n.id !== 'note:bbbbbbbb');
    await home(page);
    await expect.poll(async () => (await storedNotes(page, id))?.notes.map((n) => n.id), { timeout: 15_000 }).not.toContain('note:bbbbbbbb');
    await page.getByRole('button', { name: /profile/i }).first().click();
    await page.getByTestId('profile-notes-row').click();
    await expect(page.getByTestId('notes-list').getByRole('link')).toHaveCount(1);
    await expect(page.getByTestId('notes-list')).not.toContainText('Grandma');
    await shot(page, 'notes-api-after-withdraw');
  });
});

test.describe('the grown-up zone, over the device routes', () => {
  async function notesForMina(page: Page, context: BrowserContext, over: Partial<Mocks>): Promise<Mocks> {
    const mocks = await mockApi(context, { notes: [classNote({ readAt: iso(0.5), reaction: 'thanks' }), familyNote()], ...over });
    const id = await syncedChild(page);
    await home(page);
    await expect.poll(async () => (await storedNotes(page, id))?.notes.length ?? 0, { timeout: 15_000 }).toBe(2);
    await openGrownUpZone(page, 'Mina');
    await unlockWithPin(page);
    const row = page.getByTestId(/^dashboard-notes-profile/);
    await expect(row).toContainText('Notes for Mina');
    await row.getByRole('button').click();
    await expect(page.getByRole('heading', { name: 'Notes for Mina' })).toBeVisible();
    return mocks;
  }

  const prefsWrites = (mocks: Mocks): unknown[] => mocks.calls.filter((c) => c.method === 'PUT' && c.path.endsWith('/note-prefs')).map((c) => c.body);
  const settingRadio = (page: Page, name: string) => page.getByRole('radiogroup', { name: 'Notes from classes' }).getByRole('radio', { name });

  test('a class-scoped device (403 scope_limited): Hide goes, the setting is disabled, the card says where to change it', async ({ page, context }) => {
    const mocks = await notesForMina(page, context, { writes: 'scope_limited', notePrefs: { classes: 'all', acknowledged: false } });
    await expect(page.getByTestId('notes-one-time-card')).toBeVisible();
    const first = page.getByTestId('notes-grown-up-row-note:aaaaaaaa');
    await first.getByRole('button', { name: 'Hide from Mina' }).click();
    await page.getByTestId('notes-hide-confirm-hide').click();

    await expect(page.getByRole('button', { name: 'Hide from Mina' })).toHaveCount(0);
    await expect(first.getByRole('button', { name: 'Report' })).toBeEnabled();
    await expect(settingRadio(page, 'Off')).toBeDisabled();
    await expect(page.getByTestId('notes-card-class-scoped')).toHaveText('Change this on a home device.');
    await expect(page.getByTestId('notes-card-keep')).toHaveCount(0);
    expect(mocks.calls.filter((c) => c.path.endsWith('/hide'))).toHaveLength(1);
    expect(await page.locator('body').innerText()).not.toMatch(NEVER);
    await shot(page, 'notes-api-class-scoped');
  });

  test('Keep answers the one-time card once, with the grown-up attestation', async ({ page, context }) => {
    const mocks = await notesForMina(page, context, { notePrefs: { classes: 'all', acknowledged: false } });
    await page.getByTestId('notes-card-keep').click();
    await expect(page.getByTestId('notes-one-time-card')).toHaveCount(0);
    expect(prefsWrites(mocks)).toEqual([{ classes: 'all', acknowledge: true, attest: 'grown_up_pin' }]);
    await expect(settingRadio(page, 'All notes')).toHaveAttribute('aria-checked', 'true');
  });

  test('Change answers the card and moves focus to the setting', async ({ page, context }) => {
    const mocks = await notesForMina(page, context, { notePrefs: { classes: 'all', acknowledged: false } });
    await page.getByTestId('notes-card-change').click();
    await expect(page.getByTestId('notes-one-time-card')).toHaveCount(0);
    expect(prefsWrites(mocks)).toEqual([{ classes: 'all', acknowledge: true, attest: 'grown_up_pin' }]);
    const group = page.getByRole('radiogroup', { name: 'Notes from classes' });
    await expect.poll(() => group.evaluate((el) => el === document.activeElement || el.contains(document.activeElement))).toBe(true);
  });

  test('a mode picked while the card shows answers the card too', async ({ page, context }) => {
    const mocks = await notesForMina(page, context, { notePrefs: { classes: 'all', acknowledged: false } });
    await settingRadio(page, 'Encouragements only').click();
    await expect(settingRadio(page, 'Encouragements only')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('notes-one-time-card')).toHaveCount(0);
    expect(prefsWrites(mocks)).toEqual([{ classes: 'presets', acknowledge: true, attest: 'grown_up_pin' }]);
    // Teachers get no answer outside All notes, so the disclosure line goes.
    await expect(page.getByTestId('notes-disclosure')).toHaveCount(0);
  });

  test('Hide succeeds: the note leaves Notes for <learner> and this device', async ({ page, context }) => {
    const mocks = await notesForMina(page, context, {});
    await page.getByTestId('notes-grown-up-row-note:aaaaaaaa').getByRole('button', { name: 'Hide from Mina' }).click();
    await page.getByTestId('notes-hide-confirm-hide').click();
    await expect(page.getByTestId('notes-grown-up-row-note:aaaaaaaa')).toHaveCount(0);
    await expect(page.getByTestId('notes-grown-up-failed')).toHaveCount(0);
    expect(mocks.calls.filter((c) => c.method === 'POST' && c.path.endsWith('/notes/note:aaaaaaaa/hide'))).toHaveLength(1);
    await expect(page.getByTestId('notes-grown-up-row-note:bbbbbbbb')).toBeVisible();
  });

  test('Just hide it on the report sheet succeeds and says the note is hidden', async ({ page, context }) => {
    const mocks = await notesForMina(page, context, {});
    await page.getByTestId('notes-grown-up-row-note:bbbbbbbb').getByRole('button', { name: 'Report' }).click();
    await expect(page.getByRole('heading', { name: 'Report this note' })).toBeVisible();
    await page.getByTestId('note-report-just-hide').click();
    await page.getByTestId('notes-hide-confirm-hide').click();
    await expect(page.getByTestId('note-report-hidden')).toContainText('The note is hidden.');
    expect(mocks.calls.filter((c) => c.method === 'POST' && c.path.endsWith('/notes/note:bbbbbbbb/hide'))).toHaveLength(1);
    expect(mocks.calls.filter((c) => c.path.endsWith('/report'))).toEqual([]);
    await shot(page, 'notes-api-just-hidden');
    await page.getByTestId('note-report-done').click();
    await expect(page.getByRole('heading', { name: 'Notes for Mina' })).toBeVisible();
    await expect(page.getByTestId('notes-grown-up-row-note:bbbbbbbb')).toHaveCount(0);
  });
});
