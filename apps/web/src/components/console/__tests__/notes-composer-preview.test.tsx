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
vi.mock('../use-console', () => ({
  useConsole: () => ({ ready: true, session: { accountId: 'acc_1', displayName: 'Kim' }, api: null, signOut: () => undefined, m: getMessages('en'), locale: 'en' }),
}));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode } & Record<string, unknown>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { NoteComposer } from '../NotesParts';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const m = getMessages('en');
const QUEST = CATALOG.quests[0]?.id ?? '';
const api = {
  recipients: async () => ({ ok: true as const, data: [{ id: 'profile:mina', displayName: 'Mina', notes: 'all' as const, today: 0 }] }),
} as unknown as NotesApi;

async function mount(props: { prefillQuest: string | null; preview?: boolean }): Promise<ReactTestRenderer> {
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
        onClose={() => undefined}
        preview={props.preview}
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
