import { getMessages, type UiLocale } from '@hangul-route/i18n';
import type { ReactNode } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FamilyNotePrefs, NoteBlock, NoteSender, NotesFailure, OversightNote, SentNoteRow } from '@/lib/console/notes';

/**
 * F-FEEDBACK-001 FB-12 (sections 6.10 item 5, 7.2, 7.7, 8.2 to 8.5; wireframe console/family-notes.md; screen spec
 * design/screens/notes/family-notes.md; mocks family.html and family-states.html): the family page's Received tab on
 * `/parent/space/notes`. Rendered with react-test-renderer (the repo's web tests have no DOM); the frame is a plain
 * wrapper here.
 */

vi.mock('@/lib/i18n/locale-context', async () => {
  const i18n = await import('@hangul-route/i18n');
  const view = () => ({ locale: 'en' as UiLocale, messages: i18n.getMessages('en'), available: ['en'], setLocale: () => undefined });
  return { useConsoleLocale: view, useMessages: () => view().messages, useLocale: () => 'en', useSetLocale: () => () => undefined };
});

vi.mock('@/components/console/AdultFrame', () => ({ AdultFrame: ({ children }: { children: ReactNode }) => <main>{children}</main> }));

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode; className?: string }) => (
    <a href={href} className={rest.className}>
      {children}
    </a>
  ),
}));

const nav = { query: '', replaced: [] as string[], pushed: [] as string[] };
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: (href: string) => nav.replaced.push(href), push: (href: string) => nav.pushed.push(href), back: () => undefined }),
  useSearchParams: () => new URLSearchParams(nav.query),
  usePathname: () => '/parent/space/notes',
}));

const SPACE = {
  id: 'space:f1',
  kind: 'family',
  name: 'Kim family',
  parentSpaceId: null,
  settings: { consentMode: 'parent' as const, anonymizeRoster: false },
  archivedAt: null as string | null,
  createdAt: '2026-09-01T00:00:00.000Z',
};
const learner = (id: string, displayName: string) => ({ id, displayName, ageGroup: 'starter', avatar: 'tiger', joinedAt: '2026-09-02T00:00:00.000Z', lastActiveAt: null, lastSyncedAt: null, summary: null });
let rosterLearners = [learner('profile:mina', 'Mina'), learner('profile:jun', 'Jun')];

const ok = <T,>(data: T) => ({ ok: true as const, data });
const fail = (status: number, code: string | null) => ({ ok: false as const, failure: { status, code, details: null } as NotesFailure });
const api = {
  roster: async () => ok({ space: SPACE, learners: rosterLearners, joinCode: null, joinCodeExpiresAt: null }),
  listSpaces: async () => ok([{ space: SPACE, role: 'caregiver', counts: { learners: rosterLearners.length, accounts: 2, classes: 0 }, joinCode: null, joinCodeExpiresAt: null }]),
  entitlements: async () => ok([]),
};

vi.mock('@/components/console/use-console', async () => {
  const i18n = await import('@hangul-route/i18n');
  return {
    useConsole: () => ({ ready: true, session: { accountId: 'acct:jiwoo', displayName: 'Ji-woo Kim' }, api, signOut: () => undefined, m: i18n.getMessages('en'), locale: 'en' }),
  };
});

type Answer<T> = { ok: true; data: T } | { ok: false; failure: NotesFailure };
const iso = new Date().toISOString();
const note = (over: Partial<OversightNote> = {}): OversightNote => ({
  id: 'note:aaaaaaaa',
  spaceId: 'space:c1',
  spaceKind: 'class',
  spaceName: 'Saturday Class B',
  from: { role: 'teacher', label: null },
  senderName: null,
  mine: false,
  presetId: 'progress_reading',
  text: null,
  suggest: null,
  createdAt: iso,
  status: 'live',
  reaction: null,
  hiddenBy: null,
  reportedBy: null,
  ...over,
});

let rows: OversightNote[] = [];
let oversightQueue: Array<Answer<{ rows: OversightNote[]; next: string | null }>> = [];
let prefs: FamilyNotePrefs = { classes: 'all', acknowledged: true, updatedBy: null };
let prefsRead: Answer<FamilyNotePrefs> | null = null;
let putPrefsAnswer: Answer<FamilyNotePrefs> | null = null;
let blocks: NoteBlock[] = [];
let senders: Answer<NoteSender[]> = ok([]);
let actionAnswer: Answer<Record<string, unknown>> = ok({});
let sentRows: SentNoteRow[] = [];
const calls: Array<{ name: string; args: unknown[] }> = [];
const record =
  <T,>(name: string, answer: () => T) =>
  async (...args: unknown[]): Promise<T> => {
    calls.push({ name, args });
    return answer();
  };
const notesApi = {
  sent: record('sent', () => ok({ rows: sentRows, next: null })),
  recipients: record('recipients', () => ok([{ id: 'profile:mina', displayName: 'Mina', notes: 'all', today: 0 }])),
  send: record('send', () => ok({ batchId: 'b', sent: 1, skipped: [], presetsOnly: [] })),
  withdraw: record('withdraw', () => ok({ withdrawn: 1 })),
  oversight: record('oversight', () => oversightQueue.shift() ?? ok({ rows, next: null })),
  prefs: record('prefs', () => prefsRead ?? ok(prefs)),
  putPrefs: record('putPrefs', () => putPrefsAnswer ?? ok({ ...prefs, acknowledged: true, updatedBy: 'Ji-woo Kim' })),
  blocks: record('blocks', (): Answer<NoteBlock[]> => ok(blocks)),
  hide: record('hide', () => actionAnswer),
  report: record('report', () => actionAnswer),
  block: record('block', () => actionAnswer),
  unblock: record('unblock', () => actionAnswer),
  noteSenders: record('noteSenders', () => senders),
};
vi.mock('@/components/console/use-notes-api', () => ({ useNotesApi: () => notesApi }));

const en = getMessages('en');
const n = en.console.notes;
const f = n.family;

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_NOTES_ENABLED', 'true');
});

let mounted: ReactTestRenderer | null = null;
afterEach(() => {
  act(() => mounted?.unmount());
  mounted = null;
  nav.query = '';
  nav.replaced = [];
  nav.pushed = [];
  rosterLearners = [learner('profile:mina', 'Mina'), learner('profile:jun', 'Jun')];
  rows = [];
  oversightQueue = [];
  prefs = { classes: 'all', acknowledged: true, updatedBy: null };
  prefsRead = null;
  putPrefsAnswer = null;
  blocks = [];
  senders = ok([]);
  actionAnswer = ok({});
  sentRows = [];
  calls.length = 0;
  vi.unstubAllEnvs();
});

function textOf(node: ReactTestInstance | string): string {
  if (typeof node === 'string') return node;
  return node.children.map((child) => textOf(child)).join('');
}

async function page(query: string): Promise<ReactTestInstance> {
  nav.query = query;
  const { default: Page } = await import('@/app/(console)/teach/space/notes/page');
  await act(async () => {
    mounted = create(<Page />);
  });
  await act(async () => undefined);
  if (!mounted) throw new Error('not mounted');
  return mounted.root;
}

const byText = (root: ReactTestInstance, type: string, text: string): ReactTestInstance[] => root.findAll((node) => node.type === type && textOf(node) === text);
const dialog = (root: ReactTestInstance): ReactTestInstance | undefined => root.findAll((node) => node.props.role === 'dialog')[0];
const receivedRows = (root: ReactTestInstance): ReactTestInstance[] => root.findAll((x) => x.props['data-testid'] === 'received-row');
const buttonsOf = (row: ReactTestInstance): string[] => row.findAll((x) => x.type === 'button').map((b) => textOf(b));
const named = (calls_: typeof calls, name: string) => calls_.filter((c) => c.name === name);
const openSettings = (root: ReactTestInstance) => act(() => byText(root, 'button', f.settings.title('Mina'))[0]?.props.onClick());

describe('the Received tab (wireframe A), the family default', () => {
  it('Received first and selected; one learner at a time, the first by default; no sent list read', async () => {
    const root = await page('id=space%3Af1');
    const tabs = root.findAll((x) => x.props.role === 'tab');
    expect(tabs.map((t) => textOf(t))).toEqual([f.tabs.received, f.tabs.sent]);
    expect(tabs[0]?.props['aria-selected']).toBe(true);
    expect(named(calls, 'oversight')[0]?.args).toEqual(['space:f1', 'profile:mina']);
    expect(named(calls, 'prefs')[0]?.args).toEqual(['space:f1', 'profile:mina']);
    expect(named(calls, 'blocks')[0]?.args).toEqual(['space:f1', 'profile:mina']);
    expect(named(calls, 'sent')).toHaveLength(0);
  });

  it('the Learner select names every learner, follows &learner and replaces the address with the chosen id', async () => {
    const root = await page('id=space%3Af1&learner=profile%3Ajun');
    const select = root.findAll((x) => x.props['data-testid'] === 'notes-learner')[0];
    expect(select?.props.value).toBe('profile:jun');
    expect(select?.findAllByType('option').map((o) => textOf(o))).toEqual(['Mina', 'Jun']);
    expect(named(calls, 'oversight')[0]?.args).toEqual(['space:f1', 'profile:jun']);
    act(() => select?.props.onChange({ target: { value: 'profile:mina' } }));
    expect(nav.replaced.at(-1)).toBe('/parent/space/notes?id=space%3Af1&learner=profile%3Amina&tab=received');
  });

  it('no Learner select with one learner; none on the Sent tab, which reads the sent list and not the Received one', async () => {
    rosterLearners = [learner('profile:mina', 'Mina')];
    let root = await page('id=space%3Af1');
    expect(root.findAll((x) => x.props['data-testid'] === 'notes-learner')).toHaveLength(0);
    act(() => mounted?.unmount());
    calls.length = 0;
    rosterLearners = [learner('profile:mina', 'Mina'), learner('profile:jun', 'Jun')];
    root = await page('id=space%3Af1&tab=sent');
    expect(root.findAll((x) => x.props['data-testid'] === 'notes-learner')).toHaveLength(0);
    expect(named(calls, 'oversight')).toHaveLength(0);
    expect(named(calls, 'sent')).toHaveLength(1);
  });

  it('every note, newest first: day and sender line, the family account named, never a teacher; taken-back notes kept with their words', async () => {
    rows = [
      note({ id: 'note:r1', status: 'opened', reaction: 'thanks', text: 'Loved your reading in class today' }),
      note({ id: 'note:r2', spaceId: 'space:f1', spaceKind: 'family', spaceName: 'Kim family', from: { role: 'family', label: 'grandma' }, senderName: 'grandma.park@example.com', text: 'hal-meo-ni' }),
      note({ id: 'note:r3', spaceId: 'space:f1', spaceKind: 'family', spaceName: 'Kim family', from: { role: 'family', label: 'mom' }, mine: true, status: 'opened' }),
      note({ id: 'note:r4', status: 'withdrawn', text: 'We will finish this next week' }),
      note({ id: 'note:r5', status: 'hidden', hiddenBy: 'Ji-woo Kim' }),
      note({ id: 'note:r6', status: 'reported', reportedBy: 'Ji-woo Kim' }),
      note({ id: 'note:r7', status: 'reported', reportedBy: 'device' }),
    ];
    const root = await page('id=space%3Af1');
    const list = receivedRows(root);
    expect(list).toHaveLength(7);
    const first = textOf(list[0] as ReactTestInstance);
    expect(first).toContain(en.common.notes.date.today);
    expect(first).toContain(f.from.class('Saturday Class B'));
    expect(first).toContain(n.status.opened);
    expect(first).toContain(en.common.notes.reactions.thanks);
    expect(textOf(list[1] as ReactTestInstance)).toContain(f.from.homeSigned(en.common.notes.familyLabels.grandma));
    expect(textOf(list[1] as ReactTestInstance)).toContain(f.sentBy('grandma.park@example.com'));
    expect(textOf(list[2] as ReactTestInstance)).toContain(f.youSent);
    expect(textOf(list[3] as ReactTestInstance)).toContain(f.withdrawn);
    expect(textOf(list[3] as ReactTestInstance)).toContain('We will finish this next week');
    expect(textOf(list[4] as ReactTestInstance)).toContain(f.hiddenBy('Ji-woo Kim'));
    expect(textOf(list[5] as ReactTestInstance)).toContain(f.reportedBy('Ji-woo Kim'));
    expect(textOf(list[6] as ReactTestInstance)).toContain(f.reportedOnDevice);
    // Row actions follow FB-10 receivedRowView.
    expect(list.map(buttonsOf)).toEqual([
      [f.actions.hide.cta, f.actions.report.cta, f.actions.block.cta],
      [f.actions.hide.cta, f.actions.report.cta, f.actions.block.cta],
      [f.actions.hide.cta],
      [f.actions.report.cta, f.actions.block.cta],
      [f.actions.report.cta, f.actions.block.cta],
      [f.actions.block.cta],
      [f.actions.block.cta],
    ]);
    // Each action is described by its row's first line.
    const lineId = (list[0] as ReactTestInstance).findAll((x) => x.type === 'p')[0]?.props.id;
    expect((list[0] as ReactTestInstance).findAll((x) => x.type === 'button').every((b) => b.props['aria-describedby'] === lineId)).toBe(true);
  });

  it('Hangul words are marked Korean for screen readers', async () => {
    rows = [note({ text: '할머니' })];
    const root = await page('id=space%3Af1');
    expect(root.findAll((x) => x.type === 'p' && x.props.lang === 'ko')).toHaveLength(1);
  });

  it('empty: the learner line, and the settings still there', async () => {
    const root = await page('id=space%3Af1');
    expect(textOf(root)).toContain(f.empty('Mina'));
    expect(byText(root, 'button', f.settings.title('Mina'))).toHaveLength(1);
  });

  it('a load error shows its line and Try again reads the list again', async () => {
    oversightQueue = [fail(500, 'internal')];
    rows = [note()];
    const root = await page('id=space%3Af1');
    expect(textOf(root)).toContain(f.error);
    await act(async () => byText(root, 'button', f.retry.cta)[0]?.props.onClick());
    expect(receivedRows(root)).toHaveLength(1);
  });

  it('Show older appends the next page with the cursor; a failed page leaves a line', async () => {
    oversightQueue = [ok({ rows: [note()], next: 'cursor:1' }), ok({ rows: [note({ id: 'note:older001' })], next: 'cursor:2' }), fail(500, null)];
    const root = await page('id=space%3Af1');
    await act(async () => byText(root, 'button', f.older.cta)[0]?.props.onClick());
    expect(named(calls, 'oversight').at(-1)?.args).toEqual(['space:f1', 'profile:mina', 'cursor:1']);
    expect(receivedRows(root)).toHaveLength(2);
    await act(async () => byText(root, 'button', f.older.cta)[0]?.props.onClick());
    expect(textOf(root)).toContain(f.error);
    expect(receivedRows(root)).toHaveLength(2);
  });
});

describe('Hide, Report and Stop (sheets)', () => {
  it('after an action the rows read again in place, as deep as Show older had gone', async () => {
    oversightQueue = [ok({ rows: [note()], next: 'cursor:1' }), ok({ rows: [note({ id: 'note:older001' })], next: 'cursor:2' })];
    const root = await page('id=space%3Af1');
    await act(async () => byText(root, 'button', f.older.cta)[0]?.props.onClick());
    expect(receivedRows(root)).toHaveLength(2);
    oversightQueue = [ok({ rows: [note({ status: 'hidden', hiddenBy: 'Ji-woo Kim' })], next: 'cursor:1' }), ok({ rows: [note({ id: 'note:older001' })], next: 'cursor:2' })];
    act(() => byText(receivedRows(root)[0] as ReactTestInstance, 'button', f.actions.hide.cta)[0]?.props.onClick());
    await act(async () => byText(dialog(root) as ReactTestInstance, 'button', f.hideConfirm.cta)[0]?.props.onClick());
    expect(named(calls, 'oversight').slice(-2).map((c) => c.args)).toEqual([
      ['space:f1', 'profile:mina'],
      ['space:f1', 'profile:mina', 'cursor:1'],
    ]);
    expect(receivedRows(root)).toHaveLength(2);
    expect(root.findAll((x) => x.props['data-testid'] === 'received-loading')).toHaveLength(0);
    expect(byText(root, 'button', f.older.cta)).toHaveLength(1);
  });

  it('a failed read after an action keeps the rows drawn; a failed older page stops the read where it is', async () => {
    oversightQueue = [ok({ rows: [note()], next: 'cursor:1' }), ok({ rows: [note({ id: 'note:older001' })], next: null })];
    const root = await page('id=space%3Af1');
    await act(async () => byText(root, 'button', f.older.cta)[0]?.props.onClick());
    oversightQueue = [fail(500, null)];
    act(() => byText(receivedRows(root)[0] as ReactTestInstance, 'button', f.actions.hide.cta)[0]?.props.onClick());
    await act(async () => byText(dialog(root) as ReactTestInstance, 'button', f.hideConfirm.cta)[0]?.props.onClick());
    expect(receivedRows(root)).toHaveLength(2);
    oversightQueue = [ok({ rows: [note()], next: 'cursor:1' }), fail(500, null)];
    act(() => byText(receivedRows(root)[0] as ReactTestInstance, 'button', f.actions.hide.cta)[0]?.props.onClick());
    await act(async () => byText(dialog(root) as ReactTestInstance, 'button', f.hideConfirm.cta)[0]?.props.onClick());
    expect(receivedRows(root)).toHaveLength(1);
    expect(byText(root, 'button', f.older.cta)).toHaveLength(1);
  });

  it('Hide asks first, then hides and reads the list again', async () => {
    rows = [note()];
    const root = await page('id=space%3Af1');
    act(() => byText(receivedRows(root)[0] as ReactTestInstance, 'button', f.actions.hide.cta)[0]?.props.onClick());
    const sheet = dialog(root) as ReactTestInstance;
    expect(textOf(sheet)).toContain(f.hideConfirm.title('Mina'));
    expect(textOf(sheet)).toContain(f.hideConfirm.body('Mina'));
    await act(async () => byText(sheet, 'button', f.hideConfirm.cta)[0]?.props.onClick());
    expect(named(calls, 'hide')[0]?.args).toEqual(['space:f1', 'profile:mina', 'note:aaaaaaaa']);
    expect(dialog(root)).toBeUndefined();
    expect(named(calls, 'oversight')).toHaveLength(2);
  });

  it('Report quotes the note, waits for a reason, then reports with it', async () => {
    rows = [note({ text: 'Call me at the number below' })];
    const root = await page('id=space%3Af1');
    act(() => byText(receivedRows(root)[0] as ReactTestInstance, 'button', f.actions.report.cta)[0]?.props.onClick());
    const sheet = () => dialog(root) as ReactTestInstance;
    expect(textOf(sheet())).toContain('Call me at the number below');
    expect(textOf(sheet())).toContain(f.report.reasons.not_for_me('Mina'));
    expect(textOf(sheet())).toContain(f.report.line);
    const submit = () => sheet().findAll((x) => x.type === 'button' && x.props['data-testid'] === 'report-submit')[0];
    expect(submit()?.props['aria-disabled']).toBe(true);
    const why = root.findAll((x) => x.type === 'legend' && x.props.id === submit()?.props['aria-describedby'])[0];
    expect(textOf(why as ReactTestInstance)).toBe(f.report.why);
    act(() => sheet().findAll((x) => x.type === 'input' && x.props.value === 'unsafe')[0]?.props.onChange());
    expect(submit()?.props['aria-disabled']).toBeUndefined();
    await act(async () => submit()?.props.onClick());
    expect(named(calls, 'report')[0]?.args).toEqual(['space:f1', 'profile:mina', 'note:aaaaaaaa', { reason: 'unsafe' }]);
  });

  it('Report refused: own note, the daily report limit, or a short wait, each as an alert line', async () => {
    rows = [note()];
    const root = await page('id=space%3Af1');
    for (const [answer, line] of [
      [fail(422, 'own_note'), f.report.ownNote],
      [fail(429, 'too_many'), f.report.tooMany],
      [fail(429, 'too_many_attempts'), f.wait],
    ] as const) {
      actionAnswer = answer;
      act(() => byText(receivedRows(root)[0] as ReactTestInstance, 'button', f.actions.report.cta)[0]?.props.onClick());
      act(() => (dialog(root) as ReactTestInstance).findAll((x) => x.type === 'input' && x.props.value === 'other')[0]?.props.onChange());
      await act(async () => (dialog(root) as ReactTestInstance).findAll((x) => x.props['data-testid'] === 'report-submit')[0]?.props.onClick());
      expect(root.findAll((x) => x.props.role === 'alert').map((x) => textOf(x))).toEqual([line]);
    }
  });

  it('Cancel closes a sheet without a call', async () => {
    rows = [note()];
    const root = await page('id=space%3Af1');
    act(() => byText(receivedRows(root)[0] as ReactTestInstance, 'button', f.actions.block.cta)[0]?.props.onClick());
    act(() => byText(dialog(root) as ReactTestInstance, 'button', f.blockConfirm.cancel.cta)[0]?.props.onClick());
    expect(dialog(root)).toBeUndefined();
    act(() => byText(receivedRows(root)[0] as ReactTestInstance, 'button', f.actions.report.cta)[0]?.props.onClick());
    act(() => byText(dialog(root) as ReactTestInstance, 'button', f.report.cancel.cta)[0]?.props.onClick());
    expect(named(calls, 'block')).toHaveLength(0);
    expect(named(calls, 'report')).toHaveLength(0);
  });

  it('Stop notes from this sender says the sender is not told, then stops and reads the list and the stopped senders again', async () => {
    rows = [note()];
    const root = await page('id=space%3Af1');
    act(() => byText(receivedRows(root)[0] as ReactTestInstance, 'button', f.actions.block.cta)[0]?.props.onClick());
    const sheet = dialog(root) as ReactTestInstance;
    expect(textOf(sheet)).toContain(f.blockConfirm.body('Mina'));
    await act(async () => byText(sheet, 'button', f.blockConfirm.cta)[0]?.props.onClick());
    expect(named(calls, 'block')[0]?.args).toEqual(['space:f1', 'profile:mina', 'note:aaaaaaaa']);
    expect(named(calls, 'blocks')).toHaveLength(2);
    expect(named(calls, 'oversight')).toHaveLength(2);
  });

  it('a failed Hide leaves the list as it was and says it did not save', async () => {
    rows = [note()];
    actionAnswer = fail(500, null);
    const root = await page('id=space%3Af1');
    act(() => byText(receivedRows(root)[0] as ReactTestInstance, 'button', f.actions.hide.cta)[0]?.props.onClick());
    await act(async () => byText(dialog(root) as ReactTestInstance, 'button', f.hideConfirm.cta)[0]?.props.onClick());
    expect(textOf(root)).toContain(f.saveFailed);
    expect(named(calls, 'oversight')).toHaveLength(1);
  });
});

describe('the one-time class-notes card (C)', () => {
  it('shown once a class note arrived while unanswered; Keep records the answer and the card goes', async () => {
    rows = [note()];
    prefs = { classes: 'all', acknowledged: false, updatedBy: null };
    const root = await page('id=space%3Af1');
    const card = () => root.findAll((x) => x.props['data-testid'] === 'one-time-card')[0];
    expect(textOf(card() as ReactTestInstance)).toContain('Notes from classes: All notes.');
    await act(async () => byText(card() as ReactTestInstance, 'button', f.oneTimeCard.keep.cta)[0]?.props.onClick());
    expect(named(calls, 'putPrefs')[0]?.args).toEqual(['space:f1', 'profile:mina', { classes: 'all', acknowledge: true }]);
    expect(card()).toBeUndefined();
  });

  it('Change records the answer and opens the settings', async () => {
    rows = [note()];
    prefs = { classes: 'presets', acknowledged: false, updatedBy: null };
    const root = await page('id=space%3Af1');
    const card = root.findAll((x) => x.props['data-testid'] === 'one-time-card')[0] as ReactTestInstance;
    expect(textOf(card)).toContain(f.oneTimeCard.line(f.settings.options.presets));
    await act(async () => byText(card, 'button', f.oneTimeCard.change.cta)[0]?.props.onClick());
    expect(named(calls, 'putPrefs')).toHaveLength(1);
    expect(byText(root, 'button', f.settings.title('Mina'))[0]?.props['aria-expanded']).toBe(true);
    expect(textOf(root)).toContain(f.settings.classes);
  });

  it('not with family notes only, and never once answered', async () => {
    rows = [note({ spaceKind: 'family', from: { role: 'family', label: 'mom' } })];
    prefs = { classes: 'all', acknowledged: false, updatedBy: null };
    let root = await page('id=space%3Af1');
    expect(root.findAll((x) => x.props['data-testid'] === 'one-time-card')).toHaveLength(0);
    act(() => mounted?.unmount());
    rows = [note()];
    prefs = { classes: 'all', acknowledged: true, updatedBy: null };
    root = await page('id=space%3Af1');
    expect(root.findAll((x) => x.props['data-testid'] === 'one-time-card')).toHaveLength(0);
  });
});

describe('Settings for <learner> (one disclosure, closed by default)', () => {
  it('closed first; open: the three modes, family always, last changed by, the disclosure line and the stopped senders', async () => {
    prefs = { classes: 'all', acknowledged: true, updatedBy: 'Ji-woo Kim' };
    blocks = [{ senderRef: 'ref:1', label: 'Your teacher · Sunday Class A', role: 'teacher', name: 'Sunday Class A', createdAt: iso }];
    const root = await page('id=space%3Af1');
    expect(textOf(root)).not.toContain(f.disclosure('Mina'));
    openSettings(root);
    const all = textOf(root);
    expect(root.findAll((x) => x.type === 'input' && x.props.type === 'radio').map((r) => [r.props.value, r.props.checked])).toEqual([
      ['all', true],
      ['presets', false],
      ['off', false],
    ]);
    expect(all).toContain(f.settings.familyAlways);
    expect(all).toContain(f.settings.lastChangedBy('Ji-woo Kim'));
    expect(all).toContain(f.disclosure('Mina'));
    expect(all).toContain(f.settings.stopped.title);
    expect(all).toContain('Your teacher · Sunday Class A');
  });

  it('a mode change is saved with the acknowledgement and says Saved', async () => {
    const root = await page('id=space%3Af1');
    openSettings(root);
    putPrefsAnswer = ok({ classes: 'presets', acknowledged: true, updatedBy: 'Ji-woo Kim' });
    await act(async () => root.findAll((x) => x.type === 'input' && x.props.value === 'presets')[0]?.props.onChange());
    expect(named(calls, 'putPrefs')[0]?.args).toEqual(['space:f1', 'profile:mina', { classes: 'presets', acknowledge: true }]);
    expect(root.findAll((x) => x.type === 'input' && x.props.value === 'presets')[0]?.props.checked).toBe(true);
    expect(root.findAll((x) => x.type === 'p' && x.props.className === 'hr-fnotes-saved').map((x) => textOf(x))).toEqual([f.settings.saved]);
    expect(root.findAll((x) => x.props.role === 'status').map((x) => textOf(x))).toContain(f.settings.saved);
    expect(textOf(root)).toContain(f.settings.lastChangedBy('Ji-woo Kim'));
    const announced = (): string => textOf(root.findAll((x) => x.props.role === 'status' && x.props['aria-live'] === 'polite')[0] as ReactTestInstance);
    const first = announced();
    await act(async () => root.findAll((x) => x.type === 'input' && x.props.value === 'off')[0]?.props.onChange());
    expect(announced()).not.toBe(first);
    expect(announced().trim()).toBe(f.settings.saved);
  });

  it('a refused change snaps back with the line', async () => {
    const root = await page('id=space%3Af1');
    openSettings(root);
    putPrefsAnswer = fail(500, null);
    await act(async () => root.findAll((x) => x.type === 'input' && x.props.value === 'off')[0]?.props.onChange());
    expect(root.findAll((x) => x.type === 'input' && x.props.value === 'all')[0]?.props.checked).toBe(true);
    expect(textOf(root)).toContain(f.saveFailed);
  });

  it('a setting changed on a device says so; an unreadable setting leaves the choice out but keeps the disclosure line', async () => {
    prefs = { classes: 'off', acknowledged: true, updatedBy: 'device' };
    let root = await page('id=space%3Af1');
    openSettings(root);
    expect(textOf(root)).toContain(f.settings.lastChangedOnDevice);
    act(() => mounted?.unmount());
    prefsRead = fail(500, null);
    root = await page('id=space%3Af1');
    openSettings(root);
    expect(root.findAll((x) => x.type === 'input' && x.props.type === 'radio')).toHaveLength(0);
    expect(textOf(root)).toContain(f.disclosure('Mina'));
    expect(textOf(root)).not.toContain(f.settings.stopped.title);
  });

  it('Allow again lifts the stop by its opaque ref and reads the list again; a refusal says so', async () => {
    blocks = [{ senderRef: 'ref:9', label: 'A former sender', role: 'former', name: null, createdAt: iso }];
    const root = await page('id=space%3Af1');
    openSettings(root);
    expect(textOf(root)).toContain(f.settings.stopped.former);
    await act(async () => byText(root, 'button', f.settings.stopped.allowAgain.cta)[0]?.props.onClick());
    expect(named(calls, 'unblock')[0]?.args).toEqual(['space:f1', 'profile:mina', 'ref:9']);
    expect(named(calls, 'blocks')).toHaveLength(2);
    actionAnswer = fail(429, 'too_many_attempts');
    await act(async () => byText(root, 'button', f.settings.stopped.allowAgain.cta)[0]?.props.onClick());
    expect(textOf(root)).toContain(f.wait);
  });

  it('an earlier stopped-senders answer arriving last never undoes a newer one', async () => {
    const original = notesApi.blocks;
    const answers: Array<(value: Answer<NoteBlock[]>) => void> = [];
    notesApi.blocks = async (...args: unknown[]) => {
      calls.push({ name: 'blocks', args });
      return new Promise<Answer<NoteBlock[]>>((resolve) => {
        answers.push(resolve);
      });
    };
    try {
      rows = [note()];
      const root = await page('id=space%3Af1');
      openSettings(root);
      act(() => byText(receivedRows(root)[0] as ReactTestInstance, 'button', f.actions.block.cta)[0]?.props.onClick());
      await act(async () => byText(dialog(root) as ReactTestInstance, 'button', f.blockConfirm.cta)[0]?.props.onClick());
      expect(answers).toHaveLength(2);
      await act(async () => answers[1]?.(ok([{ senderRef: 'ref:1', label: 'x', role: 'teacher', name: 'Saturday Class B', createdAt: iso }])));
      await act(async () => answers[0]?.(ok([])));
      expect(textOf(root)).toContain(f.settings.stopped.title);
    } finally {
      notesApi.blocks = original;
    }
  });
});

describe('page states (screen spec, States)', () => {
  it('no learners in the family: the line only, no tabs and no Send a note', async () => {
    rosterLearners = [];
    const root = await page('id=space%3Af1');
    expect(textOf(root)).toContain(f.noLearners);
    expect(root.findAll((x) => x.props.role === 'tab')).toHaveLength(0);
    expect(root.findAll((x) => x.props['data-testid'] === 'notes-new')).toHaveLength(0);
    expect(named(calls, 'oversight')).toHaveLength(0);
    const add = root.findAll((x) => x.type === 'a' && textOf(x) === en.console.parentHome.actions.addLearner)[0];
    expect(add?.props.href).toBe('/parent/space?id=space%3Af1');
  });

  it('a caregiver without the send grant: Send a note unavailable and described by why; no composer even with &compose=1', async () => {
    senders = ok([
      { accountId: 'acct:owner', name: 'Owner', isOwner: true, canSend: true },
      { accountId: 'acct:jiwoo', name: 'Ji-woo Kim', isOwner: false, canSend: false },
    ]);
    const root = await page('id=space%3Af1&compose=1');
    const send = root.findAll((x) => x.type === 'button' && x.props['data-testid'] === 'notes-new')[0] as ReactTestInstance;
    expect(send.props['aria-disabled']).toBe(true);
    expect(send.props.onClick).toBeUndefined();
    const why = root.findAll((x) => x.type === 'p' && x.props.id === send.props['aria-describedby'])[0];
    expect(textOf(why as ReactTestInstance)).toBe(n.composer.errors.notAllowed);
    expect(dialog(root)).toBeUndefined();
    expect(named(calls, 'recipients')).toHaveLength(0);
  });

  it('a caregiver with the grant opens the composer as before', async () => {
    senders = ok([{ accountId: 'acct:jiwoo', name: 'Ji-woo Kim', isOwner: false, canSend: true }]);
    const root = await page('id=space%3Af1');
    const send = root.findAll((x) => x.type === 'button' && x.props['data-testid'] === 'notes-new')[0] as ReactTestInstance;
    expect(send.props['aria-disabled']).toBeUndefined();
    act(() => send.props.onClick());
    expect(nav.pushed).toEqual(['/parent/space/notes?id=space%3Af1&compose=1&learner=profile%3Amina&tab=received']);
  });

  it('the Received tab opens the composer with the learner it shows; the Sent tab keeps its filter', async () => {
    let root = await page('id=space%3Af1&learner=profile%3Ajun');
    act(() => root.findAll((x) => x.type === 'button' && x.props['data-testid'] === 'notes-new')[0]?.props.onClick());
    expect(nav.pushed.at(-1)).toBe('/parent/space/notes?id=space%3Af1&compose=1&learner=profile%3Ajun&tab=received');
    act(() => mounted?.unmount());
    root = await page('id=space%3Af1&tab=sent');
    act(() => root.findAll((x) => x.type === 'button' && x.props['data-testid'] === 'notes-new')[0]?.props.onClick());
    expect(nav.pushed.at(-1)).toBe('/parent/space/notes?id=space%3Af1&compose=1&tab=sent');
  });

  it('a note sent from the Received tab shows there: the tab reads its list again, and the sent list is not read', async () => {
    const root = await page('id=space%3Af1&compose=1');
    expect(named(calls, 'oversight')).toHaveLength(1);
    const composer = root.findAll((x) => typeof x.type === 'function' && x.type.name === 'NoteComposer')[0] as ReactTestInstance;
    await act(async () => composer.props.onClose(true));
    expect(named(calls, 'oversight')).toHaveLength(2);
    expect(named(calls, 'sent')).toHaveLength(0);
  });

  it('closing the composer without sending reads nothing again', async () => {
    const root = await page('id=space%3Af1&compose=1');
    const composer = root.findAll((x) => typeof x.type === 'function' && x.type.name === 'NoteComposer')[0] as ReactTestInstance;
    await act(async () => composer.props.onClose(false));
    expect(named(calls, 'oversight')).toHaveLength(1);
  });

  it('a note sent from the Sent tab reads the sent list again', async () => {
    const root = await page('id=space%3Af1&tab=sent&compose=1');
    const composer = root.findAll((x) => typeof x.type === 'function' && x.type.name === 'NoteComposer')[0] as ReactTestInstance;
    await act(async () => composer.props.onClose(true));
    expect(named(calls, 'sent')).toHaveLength(2);
    expect(named(calls, 'oversight')).toHaveLength(0);
  });

  it('&compose=1 never opens the composer before the send grant is known; a list that cannot be read leaves sending to the Worker', async () => {
    const original = notesApi.noteSenders;
    let answer: (value: Answer<NoteSender[]>) => void = () => undefined;
    notesApi.noteSenders = async (...args: unknown[]) => {
      calls.push({ name: 'noteSenders', args });
      return new Promise<Answer<NoteSender[]>>((resolve) => {
        answer = resolve;
      });
    };
    try {
      const root = await page('id=space%3Af1&compose=1');
      expect(dialog(root)).toBeUndefined();
      await act(async () => answer(fail(500, null)));
      expect(dialog(root)).toBeDefined();
    } finally {
      notesApi.noteSenders = original;
    }
  });

  it('a caregiver without the grant has no live Send a note on an empty Sent tab either', async () => {
    senders = ok([{ accountId: 'acct:jiwoo', name: 'Ji-woo Kim', isOwner: false, canSend: false }]);
    const root = await page('id=space%3Af1&tab=sent');
    expect(textOf(root)).toContain(n.sent.empty);
    const live = root.findAll((x) => x.type === 'button' && textOf(x) === n.sendNote.cta && x.props['aria-disabled'] !== true);
    expect(live).toHaveLength(0);
  });

  it('flag off: nothing is asked of the Worker', async () => {
    vi.stubEnv('NEXT_PUBLIC_NOTES_ENABLED', '');
    await page('id=space%3Af1');
    expect(calls).toHaveLength(0);
  });
});
