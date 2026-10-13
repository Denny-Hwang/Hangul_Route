import { getMessages, type UiLocale } from '@hangul-route/i18n';
import type { ReactNode } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { SpaceRole } from '@hangul-route/content-schema';
import Page from '@/app/(console)/teach/space/page';

/**
 * F-FEEDBACK-001 FB-11a (section 6.13 item 3): the roster header gains **Notes** and each student card **Send a note**
 * (the composer with that learner preselected), ids only, for a class and a family, and only while `notesEnabled()`.
 * An archived space keeps Notes and has no Send a note. Rendered with react-test-renderer (no DOM).
 */
vi.mock('@/lib/i18n/locale-context', async () => {
  const i18n = await import('@hangul-route/i18n');
  const view = () => ({ locale: 'en' as UiLocale, messages: i18n.getMessages('en'), available: ['en'], setLocale: () => undefined });
  return { useConsoleLocale: view, useMessages: () => view().messages, useLocale: () => 'en', useSetLocale: () => () => undefined };
});

vi.mock('@/components/console/LanguageSelect', () => ({ LanguageSelect: () => null }));

// next/link needs the app router's context; a plain anchor keeps its href, its text and its description.
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode; 'aria-describedby'?: string }) => (
    <a href={href} aria-describedby={rest['aria-describedby']} data-testid={(rest as { 'data-testid'?: string })['data-testid']}>
      {children}
    </a>
  ),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: () => undefined, push: () => undefined }),
  useSearchParams: () => new URLSearchParams('id=space%3Ac1'),
}));

const NOW = new Date();
const today = NOW.toISOString().slice(0, 10);
const SPACE = {
  id: 'space:c1',
  kind: 'class' as string,
  name: 'Room 4',
  parentSpaceId: null,
  settings: { consentMode: 'parent' as const, anonymizeRoster: false },
  archivedAt: null as string | null,
  createdAt: '2026-09-01T00:00:00.000Z',
};
const PLAN = {
  id: 'plan:1',
  spaceId: SPACE.id,
  authorAccountId: 'teacher-kim',
  title: 'Week three',
  items: [
    { kind: 'quest', id: 'quest:stage1-letters-q1' },
    { kind: 'quest', id: 'quest:stage2-life-q1' },
    { kind: 'quest', id: 'quest:stage2-nature-q1' },
    { kind: 'quest', id: 'quest:stage4-rites-q1' },
  ],
  targetLearnerIds: null,
  publishedAt: '2026-10-10T09:00:00.000Z',
  archivedAt: null,
  createdAt: '2026-10-09T09:00:00.000Z',
  updatedAt: '2026-10-10T09:00:00.000Z',
};
const LEARNER = {
  id: 'l:1',
  displayName: 'Mina',
  ageGroup: 'starter',
  avatar: 'tiger',
  joinedAt: '2026-09-02T00:00:00.000Z',
  lastActiveAt: `${today}T08:00:00.000Z`,
  lastSyncedAt: `${today}T08:05:00.000Z`,
  summary: {
    schemaVersion: 1,
    lastActiveAt: `${today}T08:00:00.000Z`,
    streakDays: 2,
    stage1: { questsDone: 1, questsTotal: 15, anchorAccuracy: null },
    cardsUnlocked: 1,
    minutesLast7d: 12,
    jamoRecognized: [],
    needsPractice: [],
    planProgress: { 'plan:1': { done: 1, total: 1, notReady: 3 } },
  },
};

const calls: string[] = [];
let role: SpaceRole = 'owner';
const ok = <T,>(data: T) => ({ ok: true as const, data });
const api = {
  roster: async () => {
    calls.push('roster');
    return ok({ space: SPACE, learners: [LEARNER], joinCode: null, joinCodeExpiresAt: null });
  },
  listPlans: async () => {
    calls.push('listPlans');
    return ok(plans);
  },
  relinkRequests: async () => {
    calls.push('relinkRequests');
    return ok([]);
  },
  listSpaces: async () => {
    calls.push('listSpaces');
    return ok([{ space: SPACE, role, counts: { learners: 1, accounts: 1, classes: 0 }, joinCode: null, joinCodeExpiresAt: null }]);
  },
  entitlements: async () => {
    calls.push('entitlements');
    return ok([]);
  },
};

vi.mock('@/components/console/use-console', async () => {
  const i18n = await import('@hangul-route/i18n');
  return {
    useConsole: () => ({ ready: true, session: { accountId: 'teacher-kim', displayName: 'Ms Kim' }, api, signOut: () => undefined, m: i18n.getMessages('en'), locale: 'en' }),
  };
});


const plans: unknown[] = [];
const notes = getMessages('en').console.notes;

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let mounted: ReactTestRenderer | null = null;
afterEach(() => {
  act(() => mounted?.unmount());
  mounted = null;
  calls.length = 0;
  role = 'owner';
  SPACE.kind = 'class';
  SPACE.archivedAt = null;
  vi.unstubAllEnvs();
});

function textOf(node: ReactTestInstance | string): string {
  if (typeof node === 'string') return node;
  return node.children.map((child) => textOf(child)).join('');
}

async function roster(): Promise<ReactTestInstance> {
  await act(async () => {
    mounted = create(<Page />);
  });
  if (!mounted) throw new Error('not mounted');
  return mounted.root;
}


const sendNote = (root: ReactTestInstance): ReactTestInstance[] => root.findAll((n) => n.type === 'a' && textOf(n) === notes.sendNote.cta);
// The roster header's Notes, not the adult nav's Notes item (FB-11b) that the frame draws with the same flag.
const notesAction = (root: ReactTestInstance): ReactTestInstance[] => root.findAll((n) => n.type === 'a' && n.props['data-testid'] === 'roster-notes');

describe('the roster notes entries (FB-11a)', () => {
  it('notes off (the default): no Notes action and no Send a note', async () => {
    const root = await roster();
    expect(notesAction(root)).toHaveLength(0);
    expect(sendNote(root)).toHaveLength(0);
    expect(root.findAll((n) => n.type === 'a' && textOf(n) === notes.roster.notes.cta)).toHaveLength(0);
  });

  it('notes on: Notes opens the class notes page; each card opens the composer with its learner, ids only', async () => {
    vi.stubEnv('NEXT_PUBLIC_NOTES_ENABLED', 'true');
    const root = await roster();
    expect(notesAction(root).map((a) => a.props.href)).toEqual(['/teach/space/notes?id=space%3Ac1']);
    const links = sendNote(root);
    expect(links.map((a) => a.props.href)).toEqual(['/teach/space/notes?id=space%3Ac1&compose=1&learner=l%3A1']);
    expect(links[0]?.props.href).not.toContain('Mina');
    // Described by the learner's name, so a links list says whom it is for.
    const nameId = links[0]?.props['aria-describedby'];
    expect(textOf(root.findAll((n) => n.props.id === nameId && n.type === 'strong')[0] as ReactTestInstance)).toBe('Mina');
  });

  it('a family roster uses the /parent prefix', async () => {
    vi.stubEnv('NEXT_PUBLIC_NOTES_ENABLED', 'true');
    SPACE.kind = 'family';
    const root = await roster();
    expect(notesAction(root)[0]?.props.href).toBe('/parent/space/notes?id=space%3Ac1');
    expect(sendNote(root)[0]?.props.href).toBe('/parent/space/notes?id=space%3Ac1&compose=1&learner=l%3A1');
  });

  it('an archived class keeps Notes and has no Send a note', async () => {
    vi.stubEnv('NEXT_PUBLIC_NOTES_ENABLED', 'true');
    SPACE.archivedAt = '2026-10-01T00:00:00.000Z';
    const root = await roster();
    expect(notesAction(root)).toHaveLength(1);
    expect(sendNote(root)).toHaveLength(0);
  });

  it('a school admin opening a class roster sees neither entry (no cascade, section 8.2 and OD-6)', async () => {
    vi.stubEnv('NEXT_PUBLIC_NOTES_ENABLED', 'true');
    role = 'admin';
    const root = await roster();
    expect(calls).toContain('listSpaces');
    // The frame's own nav keeps its Notes item (F-APP-001); the roster adds no space notes link of its own.
    expect(notesAction(root).filter((a) => String(a.props.href).includes('/space/notes'))).toEqual([]);
    expect(sendNote(root)).toHaveLength(0);
  });

  it('a family caregiver sees both entries; a teacher of the class too', async () => {
    vi.stubEnv('NEXT_PUBLIC_NOTES_ENABLED', 'true');
    role = 'teacher';
    expect(sendNote(await roster())).toHaveLength(1);
    act(() => mounted?.unmount());
    SPACE.kind = 'family';
    role = 'caregiver';
    expect(sendNote(await roster())).toHaveLength(1);
  });

  it('adds no request to the roster page', async () => {
    vi.stubEnv('NEXT_PUBLIC_NOTES_ENABLED', 'true');
    await roster();
    expect(calls.filter((c) => /note/i.test(c))).toEqual([]);
  });
});
