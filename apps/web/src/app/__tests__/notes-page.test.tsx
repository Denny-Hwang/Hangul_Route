import { CATALOG, freeRouteQuestIds, gridLessonIds } from '@hangul-route/content-schema';
import { getMessages, type UiLocale } from '@hangul-route/i18n';
import type { ReactNode } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NoteRecipient, NoteSendResult, NotesFailure, SentNoteRow } from '@/lib/console/notes';
import Page from '@/app/(console)/teach/space/notes/page';
import { NotesTabs } from '@/components/console/NotesParts';

/**
 * F-FEEDBACK-001 FB-11a (section 6.13; wireframes console/notes-sent.md and console/note-composer.md; screen specs
 * design/screens/notes/sent-list.md, composer.md, family-notes.md Sent tab): the notes page `/teach/space/notes` and its
 * `/parent/space/notes` twin. Rendered with react-test-renderer (the repo's web tests have no DOM); the frame is a
 * plain wrapper here (its nav is FB-11b's and has its own tests).
 */

vi.mock('@/lib/i18n/locale-context', async () => {
  const i18n = await import('@hangul-route/i18n');
  const view = () => ({ locale: 'en' as UiLocale, messages: i18n.getMessages('en'), available: ['en'], setLocale: () => undefined });
  return { useConsoleLocale: view, useMessages: () => view().messages, useLocale: () => 'en', useSetLocale: () => () => undefined };
});

vi.mock('@/components/console/AdultFrame', () => ({ AdultFrame: ({ children }: { children: ReactNode }) => <main>{children}</main> }));

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode; className?: string; 'data-testid'?: string }) => (
    <a href={href} className={rest.className} data-testid={rest['data-testid']}>
      {children}
    </a>
  ),
}));

const nav = { query: '', path: '/teach/space/notes', pushed: [] as string[], replaced: [] as string[], backs: 0 };
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: (href: string) => nav.replaced.push(href), push: (href: string) => nav.pushed.push(href), back: () => void (nav.backs += 1) }),
  useSearchParams: () => new URLSearchParams(nav.query),
  usePathname: () => nav.path,
}));

const SPACE = {
  id: 'space:c1',
  kind: 'class' as string,
  name: 'Room 4',
  parentSpaceId: null,
  settings: { consentMode: 'parent' as const, anonymizeRoster: false },
  archivedAt: null as string | null,
  createdAt: '2026-09-01T00:00:00.000Z',
};
const learner = (id: string, displayName: string) => ({ id, displayName, ageGroup: 'starter', avatar: 'tiger', joinedAt: '2026-09-02T00:00:00.000Z', lastActiveAt: null, lastSyncedAt: null, summary: null });
let rosterLearners = [learner('profile:mina', 'Mina'), learner('profile:jun', 'Jun')];
let role = 'teacher';
let rosterFailure: 'forbidden' | 'not_found' | 'network' | null = null;
// While set, the roster and spaces reads wait for it (the page's loading moment).
let rosterGate: Promise<void> | null = null;

const ok = <T,>(data: T) => ({ ok: true as const, data });
const api = {
  roster: async () => {
    if (rosterGate) await rosterGate;
    return rosterFailure ? { ok: false as const, error: rosterFailure } : ok({ space: SPACE, learners: rosterLearners, joinCode: null, joinCodeExpiresAt: null });
  },
  listSpaces: async () => {
    if (rosterGate) await rosterGate;
    return ok([{ space: SPACE, role, counts: { learners: rosterLearners.length, accounts: 1, classes: 0 }, joinCode: null, joinCodeExpiresAt: null }]);
  },
  entitlements: async () => ok([]),
};

vi.mock('@/components/console/use-console', async () => {
  const i18n = await import('@hangul-route/i18n');
  return {
    useConsole: () => ({ ready: true, session: { accountId: 'teacher-kim', displayName: 'Ms Kim' }, api, signOut: () => undefined, m: i18n.getMessages('en'), locale: 'en' }),
  };
});

const now = new Date().toISOString();
let sentRows: SentNoteRow[] = [];
type SentAnswer = { ok: true; data: { rows: SentNoteRow[]; next: string | null } } | { ok: false; failure: NotesFailure };
// Answers handed out in order before the default one (the rows above, no next page); a pending one waits for `release`.
let sentQueue: Array<SentAnswer | Promise<SentAnswer>> = [];
let withdrawAnswer: { ok: true; data: { withdrawn: number } } | { ok: false; failure: NotesFailure } = { ok: true, data: { withdrawn: 1 } };
let recipients: NoteRecipient[] = [];
let recipientsFailure: NotesFailure | null = null;
let sendAnswer: { ok: true; data: NoteSendResult } | { ok: false; failure: NotesFailure } = { ok: true, data: { batchId: 'b', sent: 1, skipped: [], presetsOnly: [] } };
const calls: Array<{ name: string; args: unknown[] }> = [];
const notesApi = {
  sent: async (...args: unknown[]) => {
    calls.push({ name: 'sent', args });
    return sentQueue.shift() ?? ok({ rows: sentRows, next: null });
  },
  recipients: async (...args: unknown[]) => {
    calls.push({ name: 'recipients', args });
    return recipientsFailure ? { ok: false as const, failure: recipientsFailure } : ok(recipients);
  },
  send: async (...args: unknown[]) => {
    calls.push({ name: 'send', args });
    return sendAnswer;
  },
  withdraw: async (...args: unknown[]) => {
    calls.push({ name: 'withdraw', args });
    return withdrawAnswer;
  },
  // The family Received tab and the send grant (FB-12; its own tests are in family-notes-page.test.tsx).
  noteSenders: async () => ok([]),
  oversight: async () => ok({ rows: [], next: null }),
  prefs: async () => ok({ classes: 'all', acknowledged: true, updatedBy: null }),
  blocks: async () => ok([]),
};
vi.mock('@/components/console/use-notes-api', () => ({ useNotesApi: () => notesApi }));

const en = getMessages('en');
const n = en.console.notes;

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
  nav.path = '/teach/space/notes';
  nav.pushed = [];
  nav.replaced = [];
  nav.backs = 0;
  rosterFailure = null;
  rosterGate = null;
  sentQueue = [];
  withdrawAnswer = { ok: true, data: { withdrawn: 1 } };
  SPACE.kind = 'class';
  SPACE.archivedAt = null;
  SPACE.settings.anonymizeRoster = false;
  rosterLearners = [learner('profile:mina', 'Mina'), learner('profile:jun', 'Jun')];
  role = 'teacher';
  sentRows = [];
  recipients = [];
  recipientsFailure = null;
  sendAnswer = { ok: true, data: { batchId: 'b', sent: 1, skipped: [], presetsOnly: [] } };
  calls.length = 0;
  vi.unstubAllEnvs();
});

function textOf(node: ReactTestInstance | string): string {
  if (typeof node === 'string') return node;
  return node.children.map((child) => textOf(child)).join('');
}

async function page(query: string, path = '/teach/space/notes'): Promise<ReactTestInstance> {
  nav.query = query;
  nav.path = path;
  await act(async () => {
    mounted = create(<Page />);
  });
  await act(async () => undefined);
  if (!mounted) throw new Error('not mounted');
  return mounted.root;
}

const byText = (root: ReactTestInstance, type: string, text: string): ReactTestInstance[] => root.findAll((node) => node.type === type && textOf(node) === text);
const dialog = (root: ReactTestInstance): ReactTestInstance | undefined => root.findAll((node) => node.props.role === 'dialog')[0];
const rowOf = (over: Partial<Extract<SentNoteRow, { to: 'learner' }>> = {}): SentNoteRow => ({
  id: 'note:aaaaaaaa',
  batchId: 'batch:1',
  to: 'learner',
  learnerId: 'profile:mina',
  displayName: 'Mina',
  presetId: 'progress_reading',
  text: null,
  suggest: null,
  label: null,
  createdAt: now,
  status: 'sent',
  reaction: null,
  mine: true,
  ...over,
});

describe('flag off (the default until FB-14)', () => {
  it('renders nothing, asks the Worker nothing and goes back to the space page', async () => {
    vi.stubEnv('NEXT_PUBLIC_NOTES_ENABLED', '');
    const root = await page('id=space%3Ac1');
    expect(byText(root, 'button', n.newNote.cta)).toHaveLength(0);
    expect(calls).toHaveLength(0);
    expect(nav.replaced).toEqual(['/teach/space?id=space%3Ac1']);
  });

  it('the family twin goes back to the family page', async () => {
    vi.stubEnv('NEXT_PUBLIC_NOTES_ENABLED', '');
    await page('id=space%3Af1', '/parent/space/notes');
    expect(nav.replaced).toEqual(['/parent/space?id=space%3Af1']);
  });
});

describe('class view (console/notes-sent.md A)', () => {
  it('heading, back to class, the disclosure and New note as the page action', async () => {
    const root = await page('id=space%3Ac1');
    expect(byText(root, 'h1', n.sent.title('Room 4'))).toHaveLength(1);
    expect(root.findAll((x) => x.type === 'a' && textOf(x).includes(n.sent.back.class))[0]?.props.href).toBe('/teach/space?id=space%3Ac1');
    expect(byText(root, 'p', n.sent.disclosure)).toHaveLength(1);
    expect(root.findAll((x) => x.type === 'button' && x.props['data-testid'] === 'notes-new').map((b) => textOf(b))).toEqual([n.newNote.cta]);
    expect(calls.find((c) => c.name === 'sent')?.args).toEqual(['space:c1', { learner: undefined }]);
  });

  it('rows in API order with neutral status words; a class sender never reads Opened; Take back only on its own live notes', async () => {
    sentRows = [
      { id: 'note:batch0001', batchId: 'batch:9', to: 'everyone', size: 18, presetId: 'effort_keep_trying', text: 'Great work', suggest: null, label: null, createdAt: now, status: 'sent', mine: true },
      rowOf({ id: 'note:bbbbbbbb', status: 'opened', reaction: 'thanks' }),
      rowOf({ id: 'note:cccccccc', displayName: 'Jun', status: 'not_shown' }),
      rowOf({ id: 'note:dddddddd', status: 'withdrawn' }),
      rowOf({ id: 'note:eeeeeeee', mine: false }),
    ];
    const root = await page('id=space%3Ac1');
    const cards = root.findAll((x) => x.props['data-testid'] === 'sent-row');
    expect(cards.map((c) => textOf(c.findAll((x) => x.props.className === 'hr-notes-to')[0] as ReactTestInstance))).toEqual([
      n.sent.to.everyone.class(18),
      n.sent.to.learner('Mina'),
      n.sent.to.learner('Jun'),
      n.sent.to.learner('Mina'),
      n.sent.to.learner('Mina'),
    ]);
    const all = textOf(root);
    expect(all).not.toContain(n.status.opened);
    expect(all).toContain(n.status.not_shown);
    expect(all).toContain(n.status.withdrawn);
    expect(all).toContain(en.common.notes.reactions.thanks);
    expect(all).toContain(n.sent.otherAdult);
    const takeBacks = cards.map((c) => byText(c, 'button', n.sent.takeBack.cta).length);
    expect(takeBacks).toEqual([1, 1, 0, 0, 0]);
  });

  it('no sort or filter by status: the Show filter lists Everyone and the roster, and reloads with the opaque id', async () => {
    const root = await page('id=space%3Ac1');
    const select = root.findAll((x) => x.type === 'select' && x.props['data-testid'] === 'notes-filter')[0];
    expect(select?.findAllByType('option').map((o) => textOf(o))).toEqual([n.sent.filter.everyone, 'Mina', 'Jun']);
    act(() => select?.props.onChange({ target: { value: 'profile:jun' } }));
    expect(nav.replaced.at(-1)).toBe('/teach/space/notes?id=space%3Ac1&learner=profile%3Ajun');
  });

  it('take back: the sheet names the learner, a batch row sends batch: true, then the list reloads', async () => {
    sentRows = [{ id: 'note:batch0001', batchId: 'batch:9', to: 'everyone', size: 18, presetId: 'effort_keep_trying', text: null, suggest: null, label: null, createdAt: now, status: 'sent', mine: true }];
    const root = await page('id=space%3Ac1');
    await act(async () => byText(root, 'button', n.sent.takeBack.cta)[0]?.props.onClick());
    const sheet = dialog(root);
    expect(sheet).toBeDefined();
    expect(textOf(sheet as ReactTestInstance)).toContain(n.sent.takeBack.bodyEveryone);
    const confirm = byText(sheet as ReactTestInstance, 'button', n.sent.takeBack.confirm.cta)[0];
    await act(async () => confirm?.props.onClick());
    expect(calls.find((c) => c.name === 'withdraw')?.args).toEqual(['space:c1', 'note:batch0001', true]);
    expect(calls.filter((c) => c.name === 'sent')).toHaveLength(2);
    expect(dialog(root)).toBeUndefined();
  });

  it('empty: No notes sent yet, with New note', async () => {
    const root = await page('id=space%3Ac1');
    expect(textOf(root)).toContain(n.sent.empty);
    expect(byText(root, 'button', n.newNote.cta)).toHaveLength(2);
  });

  it('New note opens the composer sub-view in the URL', async () => {
    const root = await page('id=space%3Ac1');
    act(() => root.findAll((x) => x.type === 'button' && x.props['data-testid'] === 'notes-new')[0]?.props.onClick());
    expect(nav.pushed).toEqual(['/teach/space/notes?id=space%3Ac1&compose=1']);
  });
});

describe('family view (console/family-notes.md, Sent tab)', () => {
  it('a tab list with the Sent tab, no class disclosure, Send a note, rows signed with the label and Opened shown', async () => {
    SPACE.kind = 'family';
    role = 'owner';
    SPACE.name = 'Kim family';
    sentRows = [rowOf({ status: 'opened', label: 'grandma' })];
    const root = await page('id=space%3Af1&tab=sent', '/parent/space/notes');
    const tabs = root.findAll((x) => x.props.role === 'tab');
    expect(tabs.map((t) => textOf(t))).toEqual([n.family.tabs.received, n.family.tabs.sent]);
    expect(tabs[1]?.props['aria-selected']).toBe(true);
    expect(root.findAll((x) => x.props.role === 'tablist')[0]?.props['aria-label']).toBe(n.family.tabs.label);
    expect(byText(root, 'p', n.sent.disclosure)).toHaveLength(0);
    expect(root.findAll((x) => x.type === 'button' && x.props['data-testid'] === 'notes-new').map((b) => textOf(b))).toEqual([n.sendNote.cta]);
    const all = textOf(root);
    expect(all).toContain(n.status.opened);
    expect(all).toContain(n.sent.signed(en.common.notes.familyLabels.grandma));
    SPACE.name = 'Room 4';
  });
});

describe('composer sub-view (console/note-composer.md)', () => {
  const rec = (id: string, displayName: string, over: Partial<NoteRecipient> = {}): NoteRecipient => ({ id, displayName, notes: 'all', today: 0, ...over });

  it('a labelled dialog; &learner preselects; names come from the API (anonymized there); off and at-limit rows are disabled', async () => {
    recipients = [rec('profile:mina', 'M. K.'), rec('profile:jun', 'J. P.'), rec('profile:sora', 'S. L.', { notes: 'off' }), rec('profile:leo', 'L. H.', { today: 3 })];
    const root = await page('id=space%3Ac1&compose=1&learner=profile%3Amina');
    const sheet = dialog(root);
    expect(sheet?.props['aria-modal']).toBe('true');
    const boxes = (sheet as ReactTestInstance).findAll((x) => x.type === 'input' && x.props.type === 'checkbox');
    expect(boxes.map((b) => b.props.checked)).toEqual([true, false, false, false]);
    expect(boxes.map((b) => !!b.props.disabled)).toEqual([false, false, true, true]);
    const all = textOf(sheet as ReactTestInstance);
    expect(all).toContain('M. K.');
    expect(all).toContain(n.composer.notesOff.class);
    expect(all).not.toContain('Mina');
  });

  it('&quest prefills the quest; the preset is never preselected', async () => {
    recipients = [rec('profile:mina', 'Mina')];
    const quest = CATALOG.quests[0];
    const root = await page(`id=space%3Ac1&compose=1&quest=${encodeURIComponent(quest?.id ?? '')}`);
    const sheet = dialog(root) as ReactTestInstance;
    expect(textOf(sheet)).toContain(quest?.title ?? 'missing');
    expect(sheet.findAll((x) => x.type === 'input' && x.props.type === 'radio' && x.props.name === 'note-preset' && x.props.checked)).toHaveLength(0);
  });

  it('a family with one learner auto-selects that learner and shows Sign as', async () => {
    SPACE.kind = 'family';
    role = 'caregiver';
    rosterLearners = [learner('profile:mina', 'Mina')];
    recipients = [rec('profile:mina', 'Mina')];
    const root = await page('id=space%3Af1&compose=1', '/parent/space/notes');
    const sheet = dialog(root) as ReactTestInstance;
    expect(sheet.findAll((x) => x.type === 'input' && x.props.type === 'checkbox').map((b) => b.props.checked)).toEqual([true]);
    expect(textOf(sheet)).toContain(n.composer.signAs);
    expect(textOf(sheet)).not.toContain(n.composer.preview.disclosure);
  });

  it('Send stays waiting until a preset is picked; Try this quest next needs a quest; then Send posts the body and shows the counts', async () => {
    recipients = [rec('profile:mina', 'Mina')];
    const root = await page('id=space%3Ac1&compose=1&learner=profile%3Amina');
    let sheet = dialog(root) as ReactTestInstance;
    const send = () => byText(dialog(root) as ReactTestInstance, 'button', n.composer.send.cta)[0];
    expect(send()?.props['aria-disabled']).toBe(true);
    const radio = (id: string) => (dialog(root) as ReactTestInstance).findAll((x) => x.type === 'input' && x.props.name === 'note-preset' && x.props.value === id)[0];
    act(() => radio('next_try_this')?.props.onChange());
    sheet = dialog(root) as ReactTestInstance;
    expect(textOf(sheet)).toContain(n.composer.quest.needed);
    expect(send()?.props['aria-disabled']).toBe(true);
    act(() => radio('progress_reading')?.props.onChange());
    expect(send()?.props['aria-disabled']).toBeUndefined();
    await act(async () => send()?.props.onClick());
    expect(calls.find((c) => c.name === 'send')?.args).toEqual(['space:c1', { to: { kind: 'learners', ids: ['profile:mina'] }, presetId: 'progress_reading' }]);
    expect(textOf(dialog(root) as ReactTestInstance)).toContain(n.composer.result.sent.class(1));
  });

  it('a text problem is a sentence linked to the field; the field is marked invalid', async () => {
    recipients = [rec('profile:mina', 'Mina')];
    const root = await page('id=space%3Ac1&compose=1&learner=profile%3Amina');
    const input = () => (dialog(root) as ReactTestInstance).findAll((x) => x.type === 'input' && x.props.type === 'text')[0];
    act(() => input()?.props.onChange({ target: { value: 'see example.com' } }));
    expect(input()?.props['aria-invalid']).toBe(true);
    const problemId = String(input()?.props['aria-describedby']).split(' ').find((id) => id.endsWith('problem'));
    const problem = (dialog(root) as ReactTestInstance).findAll((x) => x.props.id === problemId)[0];
    expect(textOf(problem as ReactTestInstance)).toBe(n.composer.problems.link('example.com'));
  });

  it('the Worker switch off: the composer says sending is not open yet', async () => {
    recipientsFailure = { status: 404, code: 'not_found', details: null };
    const root = await page('id=space%3Ac1&compose=1');
    expect(textOf(dialog(root) as ReactTestInstance)).toContain(n.composer.errors.sendingOff);
  });

  it('a server refusal keeps the form and shows its line', async () => {
    recipients = [rec('profile:mina', 'Mina')];
    sendAnswer = { ok: false, failure: { status: 429, code: 'too_many', details: { scope: 'account' } } };
    const root = await page('id=space%3Ac1&compose=1&learner=profile%3Amina');
    const radio = (dialog(root) as ReactTestInstance).findAll((x) => x.type === 'input' && x.props.name === 'note-preset' && x.props.value === 'effort_proud')[0];
    act(() => radio?.props.onChange());
    await act(async () => byText(dialog(root) as ReactTestInstance, 'button', n.composer.send.cta)[0]?.props.onClick());
    expect(textOf(dialog(root) as ReactTestInstance)).toContain(n.composer.errors.tooMany);
    expect(byText(dialog(root) as ReactTestInstance, 'button', n.composer.send.cta)).toHaveLength(1);
  });

  it('an archived class shows the archived line and no form', async () => {
    SPACE.archivedAt = '2026-10-01T00:00:00.000Z';
    const root = await page('id=space%3Ac1&compose=1');
    expect(textOf(dialog(root) as ReactTestInstance)).toContain(n.composer.errors.archived.class);
    expect(calls.find((c) => c.name === 'recipients')).toBeUndefined();
  });

  it('no students: the empty line and the way back to the roster', async () => {
    const root = await page('id=space%3Ac1&compose=1');
    expect(textOf(dialog(root) as ReactTestInstance)).toContain(n.composer.empty.class);
  });

  it('Cancel closes the sub-view: the URL drops compose and keeps the learner filter', async () => {
    recipients = [rec('profile:mina', 'Mina')];
    const root = await page('id=space%3Ac1&compose=1&learner=profile%3Amina');
    act(() => byText(dialog(root) as ReactTestInstance, 'button', n.composer.cancel.cta)[0]?.props.onClick());
    expect(nav.replaced.at(-1)).toBe('/teach/space/notes?id=space%3Ac1&learner=profile%3Amina');
  });

  it('closed-quest mark only with content gating on and an unlicensed space', async () => {
    const free = freeRouteQuestIds(CATALOG);
    const closed = [...gridLessonIds(CATALOG)].find((id) => !free.has(id));
    expect(closed).toBeDefined();
    recipients = [rec('profile:mina', 'Mina')];
    role = 'owner';
    const root = await page(`id=space%3Ac1&compose=1&quest=${encodeURIComponent(closed ?? '')}`);
    expect(textOf(dialog(root) as ReactTestInstance)).not.toContain(n.composer.closedMark);
    act(() => mounted?.unmount());
    mounted = null;
    vi.stubEnv('NEXT_PUBLIC_CONTENT_GATING_ENABLED', 'true');
    const gated = await page(`id=space%3Ac1&compose=1&quest=${encodeURIComponent(closed ?? '')}`);
    expect(textOf(dialog(gated) as ReactTestInstance)).toContain(n.composer.closedMark);
  });
});

describe('review follow-ups: who sees what, and the list states', () => {
  const newNote = (root: ReactTestInstance) => root.findAll((x) => x.type === 'button' && x.props['data-testid'] === 'notes-new');

  it('a school id goes to the school page and never asks for a sent list (schools have no notes page)', async () => {
    SPACE.kind = 'school';
    const root = await page('id=space%3As1');
    expect(nav.replaced).toEqual(['/teach/space?id=space%3As1']);
    expect(newNote(root)).toHaveLength(0);
    expect(calls.filter((c) => c.name === 'sent')).toHaveLength(0);
  });

  it('a school admin on a class: no New note, no send action in the empty list, no composer on &compose=1', async () => {
    role = 'admin';
    const root = await page('id=space%3Ac1&compose=1');
    expect(newNote(root)).toHaveLength(0);
    expect(byText(root, 'button', n.newNote.cta)).toHaveLength(0);
    expect(textOf(root)).toContain(n.sent.empty);
    expect(dialog(root)).toBeUndefined();
  });

  it('a school admin never sees New note while the roster and spaces are still loading', async () => {
    role = 'admin';
    let release: () => void = () => undefined;
    rosterGate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const root = await page('id=space%3Ac1');
    expect(newNote(root)).toHaveLength(0);
    expect(byText(root, 'button', n.newNote.cta)).toHaveLength(0);
    await act(async () => release());
    await act(async () => undefined);
    expect(newNote(root)).toHaveLength(0);
    expect(byText(root, 'button', n.newNote.cta)).toHaveLength(0);
  });

  it('a teacher sees New note only once the roster has loaded', async () => {
    let release: () => void = () => undefined;
    rosterGate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const root = await page('id=space%3Ac1');
    expect(newNote(root)).toHaveLength(0);
    await act(async () => release());
    await act(async () => undefined);
    expect(newNote(root)).toHaveLength(1);
  });

  it('a roster the viewer cannot open: the access line only, no send action, no tabs and no sent list', async () => {
    rosterFailure = 'forbidden';
    const root = await page('id=space%3Ac1');
    expect(root.findAll((x) => x.props.role === 'alert')).toHaveLength(1);
    expect(newNote(root)).toHaveLength(0);
    expect(byText(root, 'button', en.console.tryAgain)).toHaveLength(0);
    expect(calls.filter((c) => c.name === 'sent')).toHaveLength(0);
  });

  it('a roster that cannot be reached offers Try again, which loads the roster and then the list', async () => {
    rosterFailure = 'network';
    const root = await page('id=space%3Ac1');
    expect(calls.filter((c) => c.name === 'sent')).toHaveLength(0);
    rosterFailure = null;
    await act(async () => byText(root, 'button', en.console.tryAgain)[0]?.props.onClick());
    await act(async () => undefined);
    expect(newNote(root)).toHaveLength(1);
    expect(calls.filter((c) => c.name === 'sent')).toHaveLength(1);
  });

  it('a family empty Sent tab offers the page primary, Send a note', async () => {
    SPACE.kind = 'family';
    role = 'owner';
    const root = await page('id=space%3Af1&tab=sent', '/parent/space/notes');
    expect(textOf(root)).toContain(n.sent.empty);
    expect(byText(root, 'button', n.sendNote.cta)).toHaveLength(2);
    expect(byText(root, 'button', n.newNote.cta)).toHaveLength(0);
  });

  it('the sent list failing shows its line and Try again, which reads it again', async () => {
    sentQueue = [{ ok: false, failure: { status: 500, code: 'internal', details: null } }];
    sentRows = [rowOf()];
    const root = await page('id=space%3Ac1');
    expect(textOf(root)).toContain(n.sent.error);
    await act(async () => byText(root, 'button', n.sent.retry.cta)[0]?.props.onClick());
    expect(root.findAll((x) => x.props['data-testid'] === 'sent-row')).toHaveLength(1);
  });

  it('Show older appends the next page with the cursor and the filter', async () => {
    sentQueue = [ok({ rows: [rowOf()], next: 'cursor:1' }), ok({ rows: [rowOf({ id: 'note:older001' })], next: null })];
    const root = await page('id=space%3Ac1&learner=profile%3Amina');
    await act(async () => byText(root, 'button', n.sent.older.cta)[0]?.props.onClick());
    expect(calls.filter((c) => c.name === 'sent').at(-1)?.args).toEqual(['space:c1', { before: 'cursor:1', learner: 'profile:mina' }]);
    expect(root.findAll((x) => x.props['data-testid'] === 'sent-row')).toHaveLength(2);
    expect(byText(root, 'button', n.sent.older.cta)).toHaveLength(0);
  });

  it('an older page that answers after a newer list read is dropped', async () => {
    let release: (answer: SentAnswer) => void = () => undefined;
    sentQueue = [ok({ rows: [rowOf()], next: 'cursor:1' }), new Promise<SentAnswer>((resolve) => (release = resolve)), ok({ rows: [rowOf({ id: 'note:fresh001' })], next: null })];
    const root = await page('id=space%3Ac1');
    act(() => void byText(root, 'button', n.sent.older.cta)[0]?.props.onClick());
    // A take back reloads the list while the older page is still on its way.
    sentRows = [];
    await act(async () => byText(root, 'button', n.sent.takeBack.cta)[0]?.props.onClick());
    await act(async () => byText(dialog(root) as ReactTestInstance, 'button', n.sent.takeBack.confirm.cta)[0]?.props.onClick());
    await act(async () => release(ok({ rows: [rowOf({ id: 'note:stale001' })], next: null })));
    // Only the fresh read's one row: the stale older page was not appended.
    expect(root.findAll((x) => x.props['data-testid'] === 'sent-row')).toHaveLength(1);
  });

  it('take back of an answered note that was reported: the locked line, and the list reloads', async () => {
    sentRows = [rowOf()];
    withdrawAnswer = { ok: false, failure: { status: 409, code: 'note_reported', details: null } };
    const root = await page('id=space%3Ac1');
    await act(async () => byText(root, 'button', n.sent.takeBack.cta)[0]?.props.onClick());
    await act(async () => byText(dialog(root) as ReactTestInstance, 'button', n.sent.takeBack.confirm.cta)[0]?.props.onClick());
    expect(textOf(root)).toContain(n.sent.takeBack.locked);
    expect(calls.filter((c) => c.name === 'sent')).toHaveLength(2);
  });

  it('New note then Cancel goes back (one copy of the list in history)', async () => {
    recipients = [{ id: 'profile:mina', displayName: 'Mina', notes: 'all', today: 0 }];
    const root = await page('id=space%3Ac1');
    act(() => newNote(root)[0]?.props.onClick());
    expect(nav.pushed).toEqual(['/teach/space/notes?id=space%3Ac1&compose=1']);
    // The pushed address renders the composer over the same page instance.
    nav.query = 'id=space%3Ac1&compose=1';
    await act(async () => mounted?.update(<Page />));
    await act(async () => undefined);
    act(() => byText(dialog(root) as ReactTestInstance, 'button', n.composer.cancel.cta)[0]?.props.onClick());
    expect(nav.backs).toBe(1);
    expect(nav.replaced).toEqual([]);
  });

  it('Send another clears the form for a new note to the same space', async () => {
    recipients = [{ id: 'profile:mina', displayName: 'Mina', notes: 'all', today: 0 }];
    const root = await page('id=space%3Ac1&compose=1&learner=profile%3Amina');
    const radio = (id: string) => (dialog(root) as ReactTestInstance).findAll((x) => x.type === 'input' && x.props.name === 'note-preset' && x.props.value === id)[0];
    act(() => radio('effort_proud')?.props.onChange());
    await act(async () => byText(dialog(root) as ReactTestInstance, 'button', n.composer.send.cta)[0]?.props.onClick());
    await act(async () => byText(dialog(root) as ReactTestInstance, 'button', n.composer.result.another.cta)[0]?.props.onClick());
    expect((dialog(root) as ReactTestInstance).findAll((x) => x.type === 'input' && x.props.name === 'note-preset' && x.props.checked)).toHaveLength(0);
    expect(byText(dialog(root) as ReactTestInstance, 'button', n.composer.send.cta)[0]?.props['aria-disabled']).toBe(true);
  });

  it('a caregiver whose grant the family list does not show gets the not-granted line from the Worker', async () => {
    SPACE.kind = 'family';
    role = 'caregiver';
    rosterLearners = [learner('profile:mina', 'Mina')];
    recipients = [{ id: 'profile:mina', displayName: 'Mina', notes: 'all', today: 0 }];
    sendAnswer = { ok: false, failure: { status: 403, code: 'not_allowed', details: null } };
    const root = await page('id=space%3Af1&compose=1', '/parent/space/notes');
    const radio = (dialog(root) as ReactTestInstance).findAll((x) => x.type === 'input' && x.props.name === 'note-preset' && x.props.value === 'effort_proud')[0];
    act(() => radio?.props.onChange());
    await act(async () => byText(dialog(root) as ReactTestInstance, 'button', n.composer.send.cta)[0]?.props.onClick());
    expect(textOf(dialog(root) as ReactTestInstance)).toContain(n.composer.errors.notAllowed);
  });

  it('the quest picker starts on a labelled placeholder, never a blank entry', async () => {
    recipients = [{ id: 'profile:mina', displayName: 'Mina', notes: 'all', today: 0 }];
    const root = await page('id=space%3Ac1&compose=1');
    act(() => byText(dialog(root) as ReactTestInstance, 'button', n.composer.quest.choose.cta)[0]?.props.onClick());
    const first = (dialog(root) as ReactTestInstance).findAllByType('option')[0];
    expect(first?.props.value).toBe('');
    expect(first?.props.disabled).toBe(true);
    expect(textOf(first as ReactTestInstance)).toBe(n.composer.quest.choose.cta);
  });
});

describe('NotesTabs (section 6.12, arrow-key tabs)', () => {
  it('arrows, Home and End select the next tab and move the focus onto it', async () => {
    const focused: string[] = [];
    const selected: string[] = [];
    const tabs = ['received', 'sent'] as const;
    act(() => {
      mounted = create(<NotesTabs tabs={tabs} current="received" label="Notes" labelOf={(t) => t} panelId="p" onSelect={(t) => selected.push(t)} />, {
        createNodeMock: (element) => ({ focus: () => focused.push(String(element.props.id)) }),
      });
    });
    const tab = (id: string) => (mounted as ReactTestRenderer).root.findAll((x) => x.type === 'button' && x.props.id === `p-tab-${id}`)[0];
    const key = (id: string, k: string) => act(() => tab(id)?.props.onKeyDown({ key: k, preventDefault: () => undefined }));
    key('received', 'ArrowRight');
    key('sent', 'ArrowRight');
    key('received', 'ArrowLeft');
    key('sent', 'Home');
    key('received', 'End');
    expect(selected).toEqual(['sent', 'received', 'sent', 'received', 'sent']);
    expect(focused).toEqual(['p-tab-sent', 'p-tab-received', 'p-tab-sent', 'p-tab-received', 'p-tab-sent']);
    expect(tab('received')?.props.tabIndex).toBe(0);
    expect(tab('sent')?.props.tabIndex).toBe(-1);
  });
});
