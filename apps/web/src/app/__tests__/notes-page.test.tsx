import { CATALOG, freeRouteQuestIds, gridLessonIds } from '@hangul-route/content-schema';
import { getMessages, type UiLocale } from '@hangul-route/i18n';
import type { ReactNode } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NoteRecipient, NoteSendResult, NotesFailure, SentNoteRow } from '@/lib/console/notes';

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

const nav = { query: '', path: '/teach/space/notes', pushed: [] as string[], replaced: [] as string[] };
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: (href: string) => nav.replaced.push(href), push: (href: string) => nav.pushed.push(href) }),
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

const ok = <T,>(data: T) => ({ ok: true as const, data });
const api = {
  roster: async () => ok({ space: SPACE, learners: rosterLearners, joinCode: null, joinCodeExpiresAt: null }),
  listSpaces: async () => ok([{ space: SPACE, role, counts: { learners: rosterLearners.length, accounts: 1, classes: 0 }, joinCode: null, joinCodeExpiresAt: null }]),
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
let recipients: NoteRecipient[] = [];
let recipientsFailure: NotesFailure | null = null;
let sendAnswer: { ok: true; data: NoteSendResult } | { ok: false; failure: NotesFailure } = { ok: true, data: { batchId: 'b', sent: 1, skipped: [], presetsOnly: [] } };
const calls: Array<{ name: string; args: unknown[] }> = [];
const notesApi = {
  sent: async (...args: unknown[]) => {
    calls.push({ name: 'sent', args });
    return ok({ rows: sentRows, next: null });
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
    return ok({ withdrawn: 1 });
  },
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
    SPACE.name = 'Kim family';
    sentRows = [rowOf({ status: 'opened', label: 'grandma' })];
    const root = await page('id=space%3Af1', '/parent/space/notes');
    const tabs = root.findAll((x) => x.props.role === 'tab');
    expect(tabs.map((t) => textOf(t))).toEqual([n.family.tabs.sent]);
    expect(tabs[0]?.props['aria-selected']).toBe(true);
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
