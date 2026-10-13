import { getMessages, type UiLocale } from '@hangul-route/i18n';
import type { ReactNode } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer, type ReactTestRendererJSON } from 'react-test-renderer';
import { afterAll, beforeAll, describe, it, vi } from 'vitest';
import { NoteSendersPanel, ReceivedPanel } from '@/components/console/FamilyNotesParts';
import type { NotesApi, OversightNote } from '@/lib/console/notes';
import { expectAllPseudo } from './pseudo-text';

/**
 * F-FEEDBACK-001 FB-12 with F-I18N-001 section 3.11: the family Received tab, its settings, its sheets and panel D
 * take every word from the dictionary. Rendered in the pseudo-locale (en-XA), every text node and labelled attribute
 * is bracketed pseudo text once the data (names, the space names, the free words) is removed.
 */
const PSEUDO = 'en-XA' as UiLocale;

vi.mock('@/lib/i18n/locale-context', () => {
  const view = () => ({ locale: PSEUDO, messages: getMessages(PSEUDO), available: ['en'], setLocale: () => undefined });
  return { useConsoleLocale: view, useMessages: () => view().messages, useLocale: () => PSEUDO, useSetLocale: () => () => undefined };
});
vi.mock('next/link', () => ({ default: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a> }));

beforeAll(() => {
  vi.stubEnv('NEXT_PUBLIC_PSEUDO_LOCALE', '1');
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
afterAll(() => {
  vi.unstubAllEnvs();
});

// Today: a short date is `formatDate`'s, which takes a UI locale, never the pseudo one.
const now = new Date().toISOString();
const base: OversightNote = {
  id: 'note:aaaaaaaa',
  spaceId: 'space:c1',
  spaceKind: 'class',
  spaceName: 'Saturday Class B',
  from: { role: 'teacher', label: null },
  senderName: null,
  mine: false,
  presetId: 'progress_reading',
  text: 'Loved your reading',
  suggest: null,
  createdAt: now,
  status: 'opened',
  reaction: 'thanks',
  hiddenBy: null,
  reportedBy: null,
};
const ROWS: OversightNote[] = [
  base,
  { ...base, id: 'note:bbbbbbbb', spaceId: 'space:f1', spaceKind: 'family', spaceName: 'Kim family', from: { role: 'family', label: 'grandma' }, senderName: 'grandma.park@example.com', status: 'live', reaction: null },
  { ...base, id: 'note:cccccccc', status: 'withdrawn', reaction: null },
  { ...base, id: 'note:dddddddd', status: 'hidden', hiddenBy: 'Ji-woo Kim', reaction: null },
  { ...base, id: 'note:eeeeeeee', status: 'reported', reportedBy: 'device', reaction: null },
];
const DATA = ['Saturday Class B', 'Sunday Class A', 'Kim family', 'grandma.park@example.com', 'Ji-woo Kim', 'Min-ho Kim', 'Loved your reading', 'Mina'];

const api = {
  oversight: async () => ({ ok: true as const, data: { rows: ROWS, next: 'cursor:1' } }),
  prefs: async () => ({ ok: true as const, data: { classes: 'all' as const, acknowledged: false, updatedBy: 'Ji-woo Kim' } }),
  blocks: async () => ({
    ok: true as const,
    data: [
      { senderRef: 'ref:1', label: 'x', role: 'teacher' as const, name: 'Sunday Class A', createdAt: now },
      { senderRef: 'ref:2', label: 'x', role: 'former' as const, name: null, createdAt: now },
    ],
  }),
  noteSenders: async () => ({
    ok: true as const,
    data: [
      { accountId: 'acct:owner', name: 'Ji-woo Kim', isOwner: true, canSend: true },
      { accountId: 'acct:minho', name: 'Min-ho Kim', isOwner: false, canSend: false },
    ],
  }),
} as unknown as NotesApi;

/** The rendered tree as markup-like text: each text node and each labelled attribute between tags. */
function markup(node: ReactTestRendererJSON | ReactTestRendererJSON[] | string | null): string {
  if (node === null) return '';
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(markup).join('<x>');
  const label = typeof node.props['aria-label'] === 'string' ? ` aria-label="${node.props['aria-label'] as string}"` : '';
  if (node.type === 'style' || node.type === 'option') return '<x>';
  return `<${node.type}${label}>${(node.children ?? []).map(markup).join('<x>')}</${node.type}>`;
}

async function mount(element: JSX.Element): Promise<ReactTestRenderer> {
  let tree: ReactTestRenderer | null = null;
  await act(async () => {
    tree = create(element);
  });
  await act(async () => undefined);
  return tree as unknown as ReactTestRenderer;
}
const html = (tree: ReactTestRenderer): string => markup(tree.toJSON());
const textOf = (node: ReactTestInstance | string): string => (typeof node === 'string' ? node : node.children.map(textOf).join(''));

describe('family notes parts in the pseudo-locale', () => {
  it('the Received tab with the one-time card, every status, the open settings and each sheet is all dictionary words', async () => {
    const m = getMessages(PSEUDO);
    const f = m.console.notes.family;
    const tree = await mount(<ReceivedPanel notesApi={api} familyId="space:f1" learner={{ id: 'profile:mina', displayName: 'Mina' }} m={m} locale={PSEUDO} />);
    const root = tree.root;
    act(() => root.findAll((x) => x.type === 'button' && x.props['aria-expanded'] === false)[0]?.props.onClick());
    expectAllPseudo(html(tree), DATA, 20);
    for (const cta of [f.actions.hide.cta, f.actions.report.cta, f.actions.block.cta]) {
      act(() => root.findAll((x) => x.type === 'button' && textOf(x) === cta)[0]?.props.onClick());
      expectAllPseudo(html(tree), DATA, 20);
      act(() => root.findAll((x) => x.type === 'button' && x.props['aria-label'] === m.console.notes.composer.close)[0]?.props.onClick());
    }
    act(() => tree.unmount());
  });

  it('panel D is all dictionary words', async () => {
    const m = getMessages(PSEUDO);
    const tree = await mount(<NoteSendersPanel notesApi={api} familyId="space:f1" viewerAccountId="acct:owner" m={m} locale={PSEUDO} />);
    expectAllPseudo(html(tree), DATA, 5);
    act(() => tree.unmount());
  });
});
