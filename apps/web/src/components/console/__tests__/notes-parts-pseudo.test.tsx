import { CATALOG } from '@hangul-route/content-schema';
import { getMessages, type UiLocale } from '@hangul-route/i18n';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { act, create, type ReactTestRendererJSON } from 'react-test-renderer';
import { afterAll, beforeAll, describe, it, vi } from 'vitest';
import { NoteComposer, SentList } from '@/components/console/NotesParts';
import type { NotesApi, SentNoteRow } from '@/lib/console/notes';
import { expectAllPseudo } from './pseudo-text';

/**
 * F-FEEDBACK-001 FB-11a with F-I18N-001 section 3.11: the notes page parts take every word from the dictionary.
 * Rendered in the pseudo-locale (en-XA), every text node and labelled attribute is bracketed pseudo text once the
 * data (names, the space name, quest titles, the free words) is removed; an English literal would show unbracketed.
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

const now = new Date().toISOString();
const ROWS: SentNoteRow[] = [
  { id: 'note:batch0001', batchId: 'batch:9', to: 'everyone', size: 18, presetId: 'effort_keep_trying', text: 'Great work', suggest: null, label: null, createdAt: now, status: 'sent', mine: true },
  {
    id: 'note:aaaaaaaa',
    batchId: 'batch:1',
    to: 'learner',
    learnerId: 'profile:mina',
    displayName: 'Mina',
    presetId: 'next_try_this',
    text: null,
    suggest: { kind: 'quest', id: CATALOG.quests[0]?.id ?? '' },
    label: 'grandma',
    // Today: a short date is `formatDate`'s, which takes a UI locale, never the pseudo one.
    createdAt: now,
    status: 'opened',
    reaction: 'thanks',
    mine: false,
  },
];
const QUEST_TITLES = CATALOG.quests.map((q) => q.title).sort((a, b) => b.length - a.length);

/** The rendered tree as markup-like text: each text node and each labelled attribute between tags. */
function markup(node: ReactTestRendererJSON | ReactTestRendererJSON[] | string | null): string {
  if (node === null) return '';
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(markup).join('<x>');
  const label = typeof node.props['aria-label'] === 'string' ? ` aria-label="${node.props['aria-label'] as string}"` : '';
  if (node.type === 'style' || node.type === 'option' || node.type === 'optgroup') return '<x>';
  return `<${node.type}${label}>${(node.children ?? []).map(markup).join('<x>')}</${node.type}>`;
}

describe('notes parts in the pseudo-locale', () => {
  it('the sent list (class and family rows) is all dictionary words', () => {
    const m = getMessages(PSEUDO);
    for (const kind of ['class', 'family'] as const) {
      const html = renderToStaticMarkup(
        <SentList state="ready" rows={ROWS} hasMore olderBusy={false} kind={kind} m={m} locale={PSEUDO} onRetry={() => undefined} onOlder={() => undefined} onTakeBack={() => undefined} onNewNote={() => undefined} />,
      );
      expectAllPseudo(html, ['Mina', 'Great work', ...QUEST_TITLES]);
    }
  });

  it('the composer (family, loaded, with a quest) is all dictionary words', async () => {
    const m = getMessages(PSEUDO);
    const api = {
      recipients: async () => ({ ok: true as const, data: [{ id: 'profile:mina', displayName: 'Mina', notes: 'all' as const, today: 0 }, { id: 'profile:jun', displayName: 'Jun', notes: 'off' as const, today: 0 }] }),
    } as unknown as NotesApi;
    let tree: ReturnType<typeof create> | null = null;
    await act(async () => {
      tree = create(
        <NoteComposer
          notesApi={api}
          space={{ id: 'space:f1', kind: 'family', name: 'Kim family', archived: false }}
          prefillLearner={null}
          prefillQuest={CATALOG.quests[0]?.id ?? null}
          closedLine={() => m.console.notes.composer.closedMark}
          m={m}
          locale={PSEUDO}
          onClose={() => undefined}
        />,
      );
    });
    await act(async () => undefined);
    const html = markup((tree as unknown as { toJSON: () => ReactTestRendererJSON | ReactTestRendererJSON[] | null }).toJSON());
    expectAllPseudo(html, ['Kim family', 'Mina', 'Jun', ...QUEST_TITLES], 10);
    act(() => (tree as unknown as { unmount: () => void }).unmount());
  });
});
