import { getMessages, type UiLocale } from '@hangul-route/i18n';
import type { ReactNode } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import ParentNotesHub from '@/app/(console)/parent/notes/page';
import TeacherNotesHub from '@/app/(console)/teach/notes/page';

/**
 * F-FEEDBACK-001 FB-11b (section 6.13 entry 1; wireframe console/notes-hub.md; screen spec
 * design/screens/notes/notes-hub.md): the hubs `/parent/notes` and `/teach/notes` the adult nav's Notes items open.
 */

vi.mock('@/lib/i18n/locale-context', async () => {
  const i18n = await import('@hangul-route/i18n');
  const view = () => ({ locale: 'en' as UiLocale, messages: i18n.getMessages('en'), available: ['en'], setLocale: () => undefined });
  return { useConsoleLocale: view, useMessages: () => view().messages, useLocale: () => 'en', useSetLocale: () => () => undefined };
});

vi.mock('@/components/console/AdultFrame', () => ({ AdultFrame: ({ children }: { children: ReactNode }) => <main>{children}</main> }));

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode; 'aria-describedby'?: string }) => (
    <a href={href} aria-describedby={rest['aria-describedby']}>
      {children}
    </a>
  ),
}));

const replaced: string[] = [];
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: (href: string) => replaced.push(href), push: () => undefined }),
  useSearchParams: () => new URLSearchParams(''),
  usePathname: () => '/parent/notes',
}));

const space = (id: string, kind: string, name: string, archivedAt: string | null = null) => ({
  id,
  kind,
  name,
  parentSpaceId: null,
  settings: { consentMode: 'parent', anonymizeRoster: false },
  archivedAt,
  createdAt: '2026-09-01T00:00:00.000Z',
});
type Item = { space: ReturnType<typeof space>; role: string; counts: { learners: number; accounts: number; classes: number }; joinCode: null; joinCodeExpiresAt: null };
const item = (s: ReturnType<typeof space>, role: string): Item => ({ space: s, role, counts: { learners: 1, accounts: 1, classes: 0 }, joinCode: null, joinCodeExpiresAt: null });

let spaces: { ok: true; data: Item[] } | { ok: false; error: string } = { ok: true, data: [] };
let calls = 0;
const api = {
  listSpaces: async () => {
    calls += 1;
    return spaces;
  },
};

vi.mock('@/components/console/use-console', async () => {
  const i18n = await import('@hangul-route/i18n');
  return { useConsole: () => ({ ready: true, session: { accountId: 'a', displayName: 'A' }, api, signOut: () => undefined, m: i18n.getMessages('en'), locale: 'en' }) };
});

const hub = getMessages('en').console.notes.hub;

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
  replaced.length = 0;
  calls = 0;
  spaces = { ok: true, data: [] };
  vi.unstubAllEnvs();
});

function textOf(node: ReactTestInstance | string): string {
  if (typeof node === 'string') return node;
  return node.children.map((child) => textOf(child)).join('');
}

async function render(Page: () => JSX.Element): Promise<ReactTestInstance> {
  await act(async () => {
    mounted = create(<Page />);
  });
  await act(async () => undefined);
  if (!mounted) throw new Error('not mounted');
  return mounted.root;
}

describe('the notes hubs (FB-11b)', () => {
  it('flag off: asks nothing and goes back to the persona home', async () => {
    vi.stubEnv('NEXT_PUBLIC_NOTES_ENABLED', '');
    await render(ParentNotesHub);
    expect(calls).toBe(0);
    expect(replaced).toEqual(['/parent']);
    await render(TeacherNotesHub);
    expect(replaced).toEqual(['/parent', '/teach/home']);
  });

  it('one family: replaces the address with its notes page, so the hub never stays in history', async () => {
    spaces = { ok: true, data: [item(space('f1', 'family', 'Kim family'), 'caregiver'), item(space('c1', 'class', 'Room 4'), 'teacher')] };
    await render(ParentNotesHub);
    expect(replaced).toEqual(['/parent/space/notes?id=f1']);
  });

  it('several classes: one row per class with Notes, archived classes left out, no counts', async () => {
    spaces = { ok: true, data: [item(space('c1', 'class', 'Room 4'), 'teacher'), item(space('c2', 'class', 'Room 5'), 'owner'), item(space('c3', 'class', 'Old room', '2026-10-01T00:00:00.000Z'), 'teacher')] };
    const root = await render(TeacherNotesHub);
    expect(replaced).toEqual([]);
    expect(root.findAll((n) => n.type === 'h1').map((n) => textOf(n))).toEqual([hub.title]);
    const links = root.findAll((n) => n.type === 'a' && textOf(n).includes(hub.open.cta));
    expect(links.map((a) => a.props.href)).toEqual(['/teach/space/notes?id=c1', '/teach/space/notes?id=c2']);
    // Each Notes link is described by its row's space name.
    expect(textOf(root.findAll((n) => n.props.id === links[0]?.props['aria-describedby'])[0] as ReactTestInstance)).toBe('Room 4');
    expect(textOf(root)).not.toContain('Old room');
  });

  it('none: how to start, with Start for the persona', async () => {
    spaces = { ok: true, data: [item(space('c1', 'class', 'Room 4'), 'teacher')] };
    const root = await render(ParentNotesHub);
    expect(textOf(root)).toContain(hub.none.parent);
    expect(root.findAll((n) => n.type === 'a' && textOf(n) === hub.start.cta)[0]?.props.href).toBe('/start?persona=parent');
  });

  it('error: the line and Try again, which reads the spaces again', async () => {
    spaces = { ok: false, error: 'network' };
    const root = await render(TeacherNotesHub);
    expect(textOf(root)).toContain(hub.error);
    spaces = { ok: true, data: [] };
    await act(async () => root.findAll((n) => n.type === 'button' && textOf(n) === hub.retry.cta)[0]?.props.onClick());
    expect(calls).toBe(2);
    expect(textOf(root)).toContain(hub.none.teacher);
  });
});
