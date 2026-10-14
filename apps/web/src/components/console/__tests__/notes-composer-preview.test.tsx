import { CATALOG } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import type { ReactNode } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { NotesApi } from '@/lib/console/notes';

/**
 * F-FEEDBACK-001 FB-15 (wireframe design/wireframes/console/note-composer.md, step 4; screen spec
 * design/screens/notes/composer.md): the composer's picked-quest row carries an optional [ Preview ] into All lessons,
 * `openBrowse({ kind: 'quest', id }, 'notes')` (F-BROWSE-001 section 4.3), in the BR-11 Preview pill. It renders
 * only with All lessons on for this page (`browseLinksShown()`) and the notes flag on; the link holds content ids only.
 */
vi.mock('@/lib/i18n/locale-context', () => ({
  useConsoleLocale: () => ({ locale: 'en', messages: getMessages('en'), available: ['en'], setLocale: () => undefined }),
  useMessages: () => getMessages('en'),
  useLocale: () => 'en',
}));
const consoleApi = vi.hoisted(() => ({ current: null as null | { browseScope: () => Promise<unknown> } }));
vi.mock('../use-console', () => ({
  useConsole: () => ({ ready: true, session: { accountId: 'acc_1', displayName: 'Kim' }, api: consoleApi.current, signOut: () => undefined, m: getMessages('en'), locale: 'en' }),
}));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode } & Record<string, unknown>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { NoteComposer } from '../NotesParts';
import type { BrowseOpenerEnv } from '../BrowseLink';
import { resetBrowseScopeCache } from '@/lib/console/browse-link';
import { composerDraftKey } from '@/lib/console/composer-draft';
import type { KeyValueStorage } from '@/lib/i18n/safe-storage';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(() => {
  consoleApi.current = null;
  resetBrowseScopeCache();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const m = getMessages('en');
const QUEST = CATALOG.quests[0]?.id ?? '';
const api = {
  recipients: async () => ({ ok: true as const, data: [{ id: 'profile:mina', displayName: 'Mina', notes: 'all' as const, today: 0 }] }),
} as unknown as NotesApi;

async function mount(props: {
  prefillQuest: string | null;
  preview?: boolean;
  draftStorage?: () => KeyValueStorage | null;
  browseEnv?: BrowseOpenerEnv;
  onClose?: (sent: boolean) => void;
}): Promise<ReactTestRenderer> {
  let r: ReactTestRenderer | null = null;
  await act(async () => {
    r = create(
      <NoteComposer
        notesApi={api}
        space={{ id: 'space:c1', kind: 'class', name: 'Saturday Class B', archived: false }}
        prefillLearner="profile:mina"
        prefillQuest={props.prefillQuest}
        closedLine={() => null}
        m={m}
        locale="en"
        onClose={props.onClose ?? (() => undefined)}
        preview={props.preview}
        draftStorage={props.draftStorage}
        browseEnv={props.browseEnv}
      />,
    );
  });
  await act(async () => undefined);
  return r as unknown as ReactTestRenderer;
}

const browseLinks = (r: ReactTestRenderer): ReactTestInstance[] =>
  r.root.findAll((n) => n.type === 'a' && typeof n.props.href === 'string' && (n.props.href as string).startsWith('/browse'));

const text = (node: ReactTestInstance | string): string => (typeof node === 'string' ? node : node.children.map(text).join(''));

describe('composer quest row: [ Preview ] (FB-15)', () => {
  it('links the picked quest with source notes, described by the quest title, labelled Preview', async () => {
    expect(QUEST).not.toBe('');
    const r = await mount({ prefillQuest: QUEST, preview: true });
    const links = browseLinks(r);
    expect(links.map((n) => n.props.href)).toEqual([`/browse#t=${QUEST}&s=notes`]);
    const link = links[0] as ReactTestInstance;
    expect(text(link)).toBe(m.console.browse.preview.cta);
    expect(link.props['data-testid']).toBe('compose-quest-preview');
    const title = r.root.find((n) => n.props['data-testid'] === 'compose-quest');
    expect(typeof title.props.id).toBe('string');
    expect(link.props['aria-describedby']).toBe(title.props.id);
    // No learner id, name or space in the link (F-BROWSE-001 BD7).
    expect(link.props.href).not.toMatch(/mina|space|class/i);
    act(() => r.unmount());
  });

  it('sits in the quest row between the title and Remove', async () => {
    const r = await mount({ prefillQuest: QUEST, preview: true });
    const row = r.root.find((n) => n.type === 'div' && n.props.className === 'hr-compose-quest');
    const order = row.findAll((n) => n.props['data-testid'] === 'compose-quest' || n.props['data-testid'] === 'compose-quest-preview' || (n.type === 'button' && text(n) === m.console.notes.composer.quest.remove.cta));
    expect(order.map((n) => (n.type === 'button' ? 'remove' : (n.props['data-testid'] as string)))).toEqual(['compose-quest', 'compose-quest-preview', 'remove']);
    act(() => r.unmount());
  });

  it('no link before a quest is picked', async () => {
    const r = await mount({ prefillQuest: null, preview: true });
    expect(browseLinks(r)).toHaveLength(0);
    act(() => r.unmount());
  });

  it('no link when the preview is off', async () => {
    const r = await mount({ prefillQuest: QUEST, preview: false });
    expect(browseLinks(r)).toHaveLength(0);
    act(() => r.unmount());
  });
});

describe('composer quest row: the prop left out, the flags decide after mount', () => {
  const at = (origin: string): void => {
    vi.stubGlobal('window', { location: { origin, assign: () => undefined } });
  };

  it('shown with All lessons and notes on at the app origin', async () => {
    vi.stubEnv('NEXT_PUBLIC_BROWSE', 'enabled');
    vi.stubEnv('NEXT_PUBLIC_NOTES_ENABLED', 'true');
    at('https://app.hangulroute.com');
    const r = await mount({ prefillQuest: QUEST });
    expect(browseLinks(r).map((n) => n.props.href)).toEqual([`/browse#t=${QUEST}&s=notes`]);
    act(() => r.unmount());
  });

  it('absent when All lessons is off (the default build)', async () => {
    vi.stubEnv('NEXT_PUBLIC_BROWSE', '');
    vi.stubEnv('NEXT_PUBLIC_NOTES_ENABLED', 'true');
    at('https://app.hangulroute.com');
    const r = await mount({ prefillQuest: QUEST });
    expect(browseLinks(r)).toHaveLength(0);
    act(() => r.unmount());
  });

  it('absent when the notes flag is off', async () => {
    vi.stubEnv('NEXT_PUBLIC_BROWSE', 'enabled');
    vi.stubEnv('NEXT_PUBLIC_NOTES_ENABLED', '');
    at('https://app.hangulroute.com');
    const r = await mount({ prefillQuest: QUEST });
    expect(browseLinks(r)).toHaveLength(0);
    act(() => r.unmount());
  });

  it('absent on another origin (All lessons lives on the app origin only)', async () => {
    vi.stubEnv('NEXT_PUBLIC_BROWSE', 'enabled');
    vi.stubEnv('NEXT_PUBLIC_NOTES_ENABLED', 'true');
    at('https://hangulroute.com');
    const r = await mount({ prefillQuest: QUEST });
    expect(browseLinks(r)).toHaveLength(0);
    act(() => r.unmount());
  });
});

function fakeStorage(): KeyValueStorage & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
  };
}

const plainClick = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, defaultPrevented: false, preventDefault: () => undefined };
const byTestId = (r: ReactTestRenderer, id: string): ReactTestInstance => r.root.find((n) => n.props['data-testid'] === id && typeof n.type === 'string');
const PRESET = 'effort_proud';

function envWith(storage: KeyValueStorage, assigned: string[]): BrowseOpenerEnv {
  return { origin: () => 'https://app.hangulroute.com', now: () => Date.now(), storage: () => storage, assign: (url) => void assigned.push(url) };
}

async function writeSomething(r: ReactTestRenderer): Promise<void> {
  const preset = r.root.find((n) => n.type === 'input' && n.props.name === 'note-preset' && n.props.value === PRESET);
  const words = r.root.find((n) => n.type === 'input' && n.props.type === 'text');
  await act(async () => {
    preset.props.onChange();
    words.props.onChange({ target: { value: 'Loved your reading' } });
  });
}

async function clickPreview(r: ReactTestRenderer): Promise<void> {
  await act(async () => {
    byTestId(r, 'compose-quest-preview').props.onClick(plainClick);
  });
  await act(async () => undefined);
}

describe('composer [ Preview ]: the note being written is kept (FB-15)', () => {
  it('a plain click keeps the draft, then opens the quest with source notes', async () => {
    consoleApi.current = { browseScope: async () => ({ ok: true, data: { scope: 'full' } }) };
    const kept = fakeStorage();
    const pass = fakeStorage();
    const assigned: string[] = [];
    const r = await mount({ prefillQuest: QUEST, preview: true, draftStorage: () => kept, browseEnv: envWith(pass, assigned) });
    await writeSomething(r);
    await clickPreview(r);
    expect(assigned).toHaveLength(1);
    expect(assigned[0]).toContain(`#t=${QUEST}&s=notes`);
    const draft = JSON.parse(kept.map.get(composerDraftKey('space:c1')) ?? 'null') as Record<string, unknown>;
    expect(draft).toMatchObject({ mode: 'learners', picked: ['profile:mina'], presetId: PRESET, text: 'Loved your reading', questId: QUEST });
    act(() => r.unmount());
  });

  it('returning with &compose=1 puts the note back: learners, encouragement, words and quest', async () => {
    consoleApi.current = { browseScope: async () => ({ ok: true, data: { scope: 'full' } }) };
    const kept = fakeStorage();
    const first = await mount({ prefillQuest: QUEST, preview: true, draftStorage: () => kept, browseEnv: envWith(fakeStorage(), []) });
    await writeSomething(first);
    await clickPreview(first);
    act(() => first.unmount());

    // Back from All lessons: no quest in the URL, the kept draft brings it.
    const r = await mount({ prefillQuest: null, preview: true, draftStorage: () => kept });
    expect(text(byTestId(r, 'compose-quest')).length).toBeGreaterThan(0);
    const preset = r.root.find((n) => n.type === 'input' && n.props.name === 'note-preset' && n.props.value === PRESET);
    expect(preset.props.checked).toBe(true);
    expect(r.root.find((n) => n.type === 'input' && n.props.type === 'text').props.value).toBe('Loved your reading');
    const box = r.root.find((n) => n.type === 'input' && n.props.type === 'checkbox');
    expect(box.props.checked).toBe(true);
    act(() => r.unmount());
  });

  it('closing the composer drops the kept draft', async () => {
    const kept = fakeStorage();
    kept.setItem(composerDraftKey('space:c1'), JSON.stringify({ v: 1, savedAt: Date.now(), mode: 'learners', picked: [], presetId: null, text: 'hi', questId: QUEST, label: 'family' }));
    let closedWith: boolean | null = null;
    const r = await mount({ prefillQuest: null, preview: true, draftStorage: () => kept, onClose: (sent) => void (closedWith = sent) });
    expect(r.root.find((n) => n.type === 'input' && n.props.type === 'text').props.value).toBe('hi');
    const sheet = r.root.find((n) => n.props.testId === 'note-composer');
    await act(async () => {
      (sheet.props.onClose as () => void)();
    });
    expect(closedWith).toBe(false);
    expect(kept.map.size).toBe(0);
    act(() => r.unmount());
  });

  it('a failed plan check shows Try again and Open free lessons inside the quest row, and nothing navigates', async () => {
    consoleApi.current = { browseScope: async () => ({ ok: false, error: 'unknown', status: 500 }) };
    const assigned: string[] = [];
    const r = await mount({ prefillQuest: QUEST, preview: true, draftStorage: () => fakeStorage(), browseEnv: envWith(fakeStorage(), assigned) });
    await clickPreview(r);
    expect(assigned).toHaveLength(0);
    const row = r.root.find((n) => n.type === 'div' && n.props.className === 'hr-compose-quest');
    const notice = row.find((n) => n.props['data-testid'] === 'compose-quest-preview-notice');
    expect(text(notice)).toContain(m.console.browse.checkFailed);
    expect(row.findAll((n) => n.props['data-testid'] === 'compose-quest-preview-retry' && n.type === 'button')).toHaveLength(1);
    expect(row.findAll((n) => n.props['data-testid'] === 'compose-quest-preview-free' && n.type === 'button')).toHaveLength(1);
    act(() => r.unmount());
  });

  it('blocked storage shows the storage line inside the quest row', async () => {
    consoleApi.current = { browseScope: async () => ({ ok: true, data: { scope: 'full' } }) };
    const env: BrowseOpenerEnv = { origin: () => 'https://app.hangulroute.com', now: () => Date.now(), storage: () => null, assign: () => undefined };
    const r = await mount({ prefillQuest: QUEST, preview: true, draftStorage: () => null, browseEnv: env });
    await clickPreview(r);
    const row = r.root.find((n) => n.type === 'div' && n.props.className === 'hr-compose-quest');
    expect(text(row.find((n) => n.props['data-testid'] === 'compose-quest-preview-notice'))).toContain(m.console.browse.storageBlocked);
    act(() => r.unmount());
  });
});

describe('composer [ Preview ]: a hand-off that stays leaves no draft behind (#558 follow-up 1)', () => {
  it('a failed plan check drops the draft it kept, so it never comes back within the hour', async () => {
    consoleApi.current = { browseScope: async () => ({ ok: false, error: 'unknown', status: 500 }) };
    const kept = fakeStorage();
    const assigned: string[] = [];
    const r = await mount({ prefillQuest: QUEST, preview: true, draftStorage: () => kept, browseEnv: envWith(fakeStorage(), assigned) });
    await writeSomething(r);
    await clickPreview(r);
    expect(assigned).toHaveLength(0);
    expect(kept.map.has(composerDraftKey('space:c1'))).toBe(false);
    act(() => r.unmount());
  });

  it('blocked pass storage drops the draft it kept', async () => {
    consoleApi.current = { browseScope: async () => ({ ok: true, data: { scope: 'full' } }) };
    const kept = fakeStorage();
    const env: BrowseOpenerEnv = { origin: () => 'https://app.hangulroute.com', now: () => Date.now(), storage: () => null, assign: () => undefined };
    const r = await mount({ prefillQuest: QUEST, preview: true, draftStorage: () => kept, browseEnv: env });
    await writeSomething(r);
    await clickPreview(r);
    expect(kept.map.has(composerDraftKey('space:c1'))).toBe(false);
    act(() => r.unmount());
  });

  it('a hand-off that throws is a failed check: Try again shows and the kept draft is dropped', async () => {
    consoleApi.current = { browseScope: async () => ({ ok: true, data: { scope: 'full' } }) };
    const kept = fakeStorage();
    const env: BrowseOpenerEnv = {
      origin: () => 'https://app.hangulroute.com',
      now: () => Date.now(),
      storage: () => fakeStorage(),
      assign: () => {
        throw new Error('navigation refused');
      },
    };
    const r = await mount({ prefillQuest: QUEST, preview: true, draftStorage: () => kept, browseEnv: env });
    await writeSomething(r);
    await clickPreview(r);
    expect(text(byTestId(r, 'compose-quest-preview-notice'))).toContain(m.console.browse.checkFailed);
    expect(r.root.findAll((n) => n.props['data-testid'] === 'compose-quest-preview-retry' && n.type === 'button')).toHaveLength(1);
    expect(kept.map.has(composerDraftKey('space:c1'))).toBe(false);
    act(() => r.unmount());
  });

  it('Try again after a failed check keeps the draft again before it opens', async () => {
    let fail = true;
    consoleApi.current = { browseScope: async () => (fail ? { ok: false, error: 'unknown', status: 500 } : { ok: true, data: { scope: 'full' } }) };
    const kept = fakeStorage();
    const assigned: string[] = [];
    const r = await mount({ prefillQuest: QUEST, preview: true, draftStorage: () => kept, browseEnv: envWith(fakeStorage(), assigned) });
    await writeSomething(r);
    await clickPreview(r);
    expect(kept.map.has(composerDraftKey('space:c1'))).toBe(false);
    fail = false;
    await act(async () => {
      byTestId(r, 'compose-quest-preview-retry').props.onClick();
    });
    await act(async () => undefined);
    expect(assigned).toHaveLength(1);
    expect(kept.map.has(composerDraftKey('space:c1'))).toBe(true);
    act(() => r.unmount());
  });
});
