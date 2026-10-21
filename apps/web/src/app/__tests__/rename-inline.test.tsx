import { getMessages, type UiLocale } from '@hangul-route/i18n';
import type { ReactNode } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ApiResult, SchoolView } from '@/lib/console/api';

/**
 * [SA] AMENDMENTS-SEATS-ADMINS section 5.3 (row SA-3; wireframe console/rename-inline, mock rename-inline.html): the
 * one-tap rename on the class page, the school page and its class rows, the family home and the Settings Name row.
 * Rename shows only with `canRename` on a live space; Enter saves and Escape cancels, focus going back to Rename; the
 * new name shows at once (title, Back label, frame title) and comes back on a failure; a polite live region says
 * "Name saved."; the tab title never carries the name. Rendered with react-test-renderer (no DOM); refs get focus and
 * select spies through `createNodeMock`.
 */
vi.mock('@/lib/i18n/locale-context', async () => {
  const i18n = await import('@hangul-route/i18n');
  const view = () => ({ locale: 'en' as UiLocale, messages: i18n.getMessages('en'), available: ['en'], setLocale: () => undefined });
  return { useConsoleLocale: view, useMessages: () => view().messages, useLocale: () => 'en', useSetLocale: () => () => undefined };
});

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>,
}));

const query = vi.hoisted(() => ({ value: 'id=space%3Ac1' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: () => undefined, push: () => undefined }),
  useSearchParams: () => new URLSearchParams(query.value),
}));

// The frame has its own tests; here it records the title and the Back link the page hands it.
const frame = vi.hoisted(() => ({ titles: [] as Array<string | undefined>, backs: [] as Array<string | undefined> }));
vi.mock('@/components/console/AdultFrame', () => ({
  AdultFrame: ({ children, title, back }: { children: ReactNode; title?: string; back?: { label: string } }) => {
    frame.titles.push(title);
    frame.backs.push(back?.label);
    return <main>{children}</main>;
  },
}));

const SPACE = {
  id: 'space:c1',
  kind: 'class' as 'class' | 'family' | 'school',
  name: 'Room 4',
  parentSpaceId: null as string | null,
  settings: { consentMode: 'parent' as const, anonymizeRoster: false },
  archivedAt: null as string | null,
  createdAt: '2026-09-01T00:00:00.000Z',
};
const state = vi.hoisted(() => ({
  canRename: true as boolean | undefined,
  openMoves: false,
  renames: [] as Array<{ id: string; name: string }>,
  answer: null as null | (() => Promise<unknown>),
  school: null as unknown,
  seats: null as null | { learners: number; cap: number | null; schoolLearners: number | null; schoolCap: number | null },
}));
const ok = <T,>(data: T) => ({ ok: true as const, data });
const api = {
  roster: async () => ok({ space: { ...SPACE }, learners: [], joinCode: 'ABC234', joinCodeExpiresAt: '2026-11-30T00:00:00.000Z', seats: state.seats ?? { learners: 0, cap: SPACE.kind === 'family' ? 4 : 20, schoolLearners: null, schoolCap: null }, canRename: state.canRename, openMoves: state.openMoves }),
  listPlans: async () => ok([]),
  relinkRequests: async () => ok([]),
  listSpaces: async () => ok([]),
  entitlements: async () => ok([]),
  members: async () => ok([]),
  school: async () => ok(state.school),
  billingSummary: async () => ({ ok: false, error: 'network', status: -1 }),
  renameSpace: (id: string, name: string): Promise<ApiResult<unknown>> => {
    state.renames.push({ id, name });
    if (state.answer) return state.answer() as Promise<ApiResult<unknown>>;
    return Promise.resolve(ok({ space: { ...SPACE, id, name }, changed: true }));
  },
};

vi.mock('@/components/console/use-console', async () => {
  const i18n = await import('@hangul-route/i18n');
  return { useConsole: () => ({ ready: true, session: { accountId: 'teacher-kim', displayName: 'Ms Kim' }, api, signOut: () => undefined, m: i18n.getMessages('en'), locale: 'en' }) };
});

import SpacePage from '@/app/(console)/teach/space/page';
import SettingsPage from '@/app/(console)/teach/space/settings/page';
import { SchoolAdmin } from '@/components/console/SchoolAdmin';

const m = getMessages('en');
const r = m.console.rename;
const textOf = (n: ReactTestInstance | string): string => (typeof n === 'string' ? n : n.children.map(textOf).join(''));
const byTestId = (root: ReactTestInstance, id: string): ReactTestInstance[] => root.findAll((n) => typeof n.type === 'string' && n.props['data-testid'] === id);
const one = (root: ReactTestInstance, id: string): ReactTestInstance => {
  const found = byTestId(root, id);
  expect(found, id).toHaveLength(1);
  return found[0] as ReactTestInstance;
};

const focused: string[] = [];
const selected: string[] = [];
const nodeMock = (el: { type: unknown; props: Record<string, unknown> }) => ({
  focus: () => focused.push(String(el.props['data-testid'] ?? el.type)),
  select: () => selected.push(String(el.props['data-testid'] ?? el.type)),
});

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let mounted: ReactTestRenderer | null = null;
afterEach(() => {
  act(() => mounted?.unmount());
  mounted = null;
  Object.assign(SPACE, { kind: 'class', name: 'Room 4', archivedAt: null, parentSpaceId: null });
  Object.assign(state, { canRename: true, openMoves: false, renames: [], answer: null, school: null, seats: null });
  query.value = 'id=space%3Ac1';
  frame.titles.length = 0;
  frame.backs.length = 0;
  focused.length = 0;
  selected.length = 0;
});

async function render(node: JSX.Element): Promise<ReactTestInstance> {
  await act(async () => {
    mounted = create(node, { createNodeMock: nodeMock });
  });
  return (mounted as unknown as ReactTestRenderer).root;
}

const press = async (root: ReactTestInstance, id: string): Promise<void> => {
  await act(async () => one(root, id).props.onClick());
};
const type = async (root: ReactTestInstance, id: string, value: string): Promise<void> => {
  await act(async () => one(root, id).props.onChange({ target: { value } }));
};
const submit = async (root: ReactTestInstance, id: string): Promise<void> => {
  await act(async () => one(root, id).props.onSubmit({ preventDefault: () => undefined }));
};
const key = async (root: ReactTestInstance, id: string, name: string): Promise<void> => {
  await act(async () => one(root, id).props.onKeyDown({ key: name, preventDefault: () => undefined }));
};
const h1 = (root: ReactTestInstance): string[] => root.findAll((n) => n.type === 'h1').map(textOf);

describe('class page: the title row', () => {
  it('shows Rename beside the h1 with canRename, its accessible name naming the class (D1)', async () => {
    const root = await render(<SpacePage />);
    expect(h1(root)).toEqual(['Room 4']);
    const button = one(root, 'rename');
    expect(textOf(button)).toBe(r.cta);
    expect(button.props['aria-label']).toBe('Rename Room 4');
    expect(textOf(one(root, 'space-count'))).toBe(m.console.spaceCounts.students(0));
  });

  it('shows the name alone without canRename, from an older Worker, or on an archived space', async () => {
    state.canRename = false;
    let root = await render(<SpacePage />);
    expect(byTestId(root, 'rename')).toHaveLength(0);
    expect(h1(root)).toEqual(['Room 4']);
    act(() => mounted?.unmount());
    state.canRename = undefined;
    root = await render(<SpacePage />);
    expect(byTestId(root, 'rename')).toHaveLength(0);
    act(() => mounted?.unmount());
    state.canRename = true;
    SPACE.archivedAt = '2026-10-01T00:00:00.000Z';
    root = await render(<SpacePage />);
    expect(byTestId(root, 'rename')).toHaveLength(0);
  });

  it('Rename opens the field in place: the name selected, the class hint, the heading kept hidden (D2)', async () => {
    const root = await render(<SpacePage />);
    await press(root, 'rename');
    const input = one(root, 'rename-form-input');
    expect(input.props.value).toBe('Room 4');
    // 120, not 40: a decomposed Hangul paste is never cut; the 40 is checked after NFC.
    expect(input.props.maxLength).toBe(120);
    expect(focused).toContain('rename-form-input');
    expect(selected).toContain('rename-form-input');
    expect(h1(root)).toEqual(['Room 4']);
    expect(root.findAll((n) => n.type === 'h1')[0]?.props.className).toBe('hr-rn-hidden');
    expect(textOf(one(root, 'rename-form'))).toContain(r.hint.class);
    expect(byTestId(root, 'rename-form-moves')).toHaveLength(0);
    // Unchanged: Save stays in the tab order, aria-disabled (D3), and sends nothing.
    expect(one(root, 'rename-form-save').props['aria-disabled']).toBe(true);
    await submit(root, 'rename-form');
    expect(state.renames).toEqual([]);
  });

  it('Escape cancels with no change and focus goes back to Rename', async () => {
    const root = await render(<SpacePage />);
    await press(root, 'rename');
    await type(root, 'rename-form-input', 'Room 5');
    focused.length = 0;
    await key(root, 'rename-form-input', 'Escape');
    expect(byTestId(root, 'rename-form')).toHaveLength(0);
    expect(h1(root)).toEqual(['Room 4']);
    expect(focused).toEqual(['rename']);
    expect(state.renames).toEqual([]);
  });

  it('Enter (the form submit) saves: the new name at once, the request, focus back, and the live region', async () => {
    let settle: (value: unknown) => void = () => undefined;
    state.answer = () => new Promise((resolve) => (settle = resolve));
    const root = await render(<SpacePage />);
    await press(root, 'rename');
    await type(root, 'rename-form-input', '  Room   5 ');
    expect(one(root, 'rename-form-save').props['aria-disabled']).toBeUndefined();
    focused.length = 0;
    await submit(root, 'rename-form');
    // Optimistic: the title reads the normalized name before the Worker answers.
    expect(state.renames).toEqual([{ id: 'space:c1', name: 'Room 5' }]);
    expect(h1(root)).toEqual(['Room 5']);
    expect(byTestId(root, 'rename-form')).toHaveLength(0);
    expect(focused).toEqual(['rename']);
    expect(textOf(one(root, 'rename-live'))).toBe('');
    await act(async () => settle(ok({ space: { ...SPACE, name: 'Room 5' }, changed: true })));
    expect(textOf(one(root, 'rename-live'))).toBe(r.saved);
    expect(one(root, 'rename-live').props.role).toBe('status');
    expect(one(root, 'rename').props['aria-label']).toBe('Rename Room 5');
  });

  it('Rename stays aria-disabled and aria-busy until the PATCH settles, so a second rename cannot race the first', async () => {
    let settle: (value: unknown) => void = () => undefined;
    state.answer = () => new Promise((resolve) => (settle = resolve));
    const root = await render(<SpacePage />);
    await press(root, 'rename');
    await type(root, 'rename-form-input', 'Room 5');
    await submit(root, 'rename-form');
    expect(one(root, 'rename').props['aria-disabled']).toBe(true);
    expect(one(root, 'rename').props['aria-busy']).toBe(true);
    await press(root, 'rename');
    expect(byTestId(root, 'rename-form')).toHaveLength(0);
    await act(async () => settle(ok({ space: { ...SPACE, name: 'Room 5' }, changed: true })));
    expect(one(root, 'rename').props['aria-disabled']).toBeUndefined();
    expect(one(root, 'rename').props['aria-busy']).toBeUndefined();
  });

  it('IME: Enter and Escape during composition do nothing; the committed name saves on the next Enter', async () => {
    const root = await render(<SpacePage />);
    await press(root, 'rename');
    await act(async () => one(root, 'rename-form-input').props.onCompositionStart());
    await type(root, 'rename-form-input', '해바라');
    let prevented = false;
    await act(async () => one(root, 'rename-form-input').props.onKeyDown({ key: 'Enter', keyCode: 229, nativeEvent: { isComposing: true }, preventDefault: () => (prevented = true) }));
    expect(prevented).toBe(true);
    await key(root, 'rename-form-input', 'Escape');
    expect(byTestId(root, 'rename-form')).toHaveLength(1);
    // A submit that slips through mid-composition sends nothing either.
    await submit(root, 'rename-form');
    expect(state.renames).toEqual([]);
    await act(async () => one(root, 'rename-form-input').props.onCompositionEnd({ currentTarget: { value: '해바라기 반' } }));
    expect(one(root, 'rename-form-input').props.value).toBe('해바라기 반');
    await submit(root, 'rename-form');
    expect(state.renames).toEqual([{ id: 'space:c1', name: '해바라기 반' }]);
  });

  it('a 60-unit decomposed Hangul paste is not cut and saves as its NFC form', async () => {
    const composed = '한글학당 일요일반 선생님들 함께 공부합니다 늘 즐겁게';
    const decomposed = composed.normalize('NFD');
    expect(decomposed.length).toBeGreaterThanOrEqual(60);
    const root = await render(<SpacePage />);
    await press(root, 'rename');
    expect(decomposed.length).toBeLessThanOrEqual(one(root, 'rename-form-input').props.maxLength);
    await type(root, 'rename-form-input', decomposed);
    expect(byTestId(root, 'rename-form-error')).toHaveLength(0);
    await submit(root, 'rename-form');
    expect(state.renames).toEqual([{ id: 'space:c1', name: composed }]);
  });

  it('a failed save brings the old name back and reopens the field with the typed value and the line', async () => {
    state.answer = async () => ({ ok: false, error: 'unknown', status: 500 });
    const root = await render(<SpacePage />);
    await press(root, 'rename');
    await type(root, 'rename-form-input', 'Room 5');
    await submit(root, 'rename-form');
    expect(h1(root)).toEqual(['Room 4']);
    expect(one(root, 'rename-form-input').props.value).toBe('Room 5');
    expect(textOf(one(root, 'rename-form-error'))).toBe(r.failed);
    expect(textOf(one(root, 'rename-live'))).toBe('');
  });

  it('archived meanwhile (422 archived): the archived line, Save unavailable', async () => {
    state.answer = async () => ({ ok: false, error: 'invalid', status: 422, code: 'archived' });
    const root = await render(<SpacePage />);
    await press(root, 'rename');
    await type(root, 'rename-form-input', 'Room 5');
    await submit(root, 'rename-form');
    expect(textOf(one(root, 'rename-form-error'))).toBe(r.archived);
    expect(one(root, 'rename-form-save').props['aria-disabled']).toBe(true);
    await submit(root, 'rename-form');
    expect(state.renames).toHaveLength(1);
  });

  it('an invalid name says why under the field and Save sends nothing', async () => {
    const root = await render(<SpacePage />);
    await press(root, 'rename');
    await type(root, 'rename-form-input', '   ');
    expect(textOf(one(root, 'rename-form-error'))).toBe(r.empty);
    expect(one(root, 'rename-form-input').props['aria-invalid']).toBe(true);
    // The error line comes first in the description, then the hint.
    expect(String(one(root, 'rename-form-input').props['aria-describedby']).split(' ')).toHaveLength(2);
    await type(root, 'rename-form-input', '!!!');
    expect(textOf(one(root, 'rename-form-error'))).toBe(r.invalid);
    await submit(root, 'rename-form');
    expect(state.renames).toEqual([]);
  });

  it('an open move into or out of the class adds the openMoves line', async () => {
    state.openMoves = true;
    const root = await render(<SpacePage />);
    await press(root, 'rename');
    expect(textOf(one(root, 'rename-form-moves'))).toBe(r.openMoves);
    expect(String(one(root, 'rename-form-input').props['aria-describedby']).split(' ')).toHaveLength(2);
  });
});

describe('Settings: the Name row, the frame title and the Back label', () => {
  it('renames from the Name block; the frame title and Back to <name> follow at once; the tab title never names it', async () => {
    const doc = { title: m.console.docTitle.console };
    vi.stubGlobal('document', doc);
    const root = await render(<SettingsPage />);
    expect(textOf(one(root, 'settings-name-text'))).toBe('Room 4');
    expect(frame.titles.at(-1)).toBe(m.console.settings.titleFor('Room 4'));
    expect(frame.backs.at(-1)).toBe(m.console.settings.back('Room 4'));
    await press(root, 'settings-rename');
    await type(root, 'settings-rename-form-input', 'Room 5');
    await submit(root, 'settings-rename-form');
    expect(frame.titles.at(-1)).toBe(m.console.settings.titleFor('Room 5'));
    expect(frame.backs.at(-1)).toBe(m.console.settings.back('Room 5'));
    expect(textOf(one(root, 'settings-name-text'))).toBe('Room 5');
    expect(doc.title).toBe(m.console.docTitle.console);
    vi.unstubAllGlobals();
  });

  it('archived: the name and the archived line, no Rename', async () => {
    SPACE.archivedAt = '2026-10-01T00:00:00.000Z';
    const root = await render(<SettingsPage />);
    expect(byTestId(root, 'settings-rename')).toHaveLength(0);
    expect(textOf(one(root, 'settings-name'))).toContain(r.archived);
  });

  it('a family: n of 4 learners under the join code', async () => {
    SPACE.kind = 'family';
    const root = await render(<SettingsPage />);
    expect(textOf(one(root, 'family-seats'))).toBe('0 of 4 learners');
  });
});

describe('school page: the title and each class row', () => {
  const row = (id: string, name: string, canRename: boolean, archivedAt: string | null = null) => ({
    space: { ...SPACE, id, name, kind: 'class' as const, parentSpaceId: 'space:sch', archivedAt },
    teacher: { accountId: 'ms-han', name: 'Ms Han' },
    students: 18,
    practiced: 3,
    lastActiveAt: null,
    hasPublishedPlan: false,
    canRename,
    openMoves: false,
  });
  const view = (canRename: boolean): SchoolView => ({
    school: { ...SPACE, id: 'space:sch', kind: 'school', name: 'Maple School' },
    invite: { joinCode: null, joinCodeExpiresAt: null },
    license: null,
    limits: { licensed: false, students: 50, teachers: null },
    usage: { students: 18, teachers: 2 },
    thisWeek: { students: 18, practiced: 3, classes: 2, classesWithPlan: 0 },
    classes: [row('space:a', 'Sunday Class A', true), row('space:b', 'Spring 2026', true, '2026-06-14T00:00:00.000Z')],
    canRename,
  });
  const school = () => <SchoolAdmin api={api as never} spaceId="space:sch" onSignOut={() => undefined} />;

  it('the h1 reads "<name> · school"; Rename names the school alone; the field holds the name only', async () => {
    state.school = view(true);
    const root = await render(school());
    expect(h1(root)).toEqual([m.console.school.titleFor('Maple School')]);
    expect(one(root, 'rename').props['aria-label']).toBe('Rename Maple School');
    await press(root, 'rename');
    expect(one(root, 'rename-form-input').props.value).toBe('Maple School');
    expect(textOf(one(root, 'rename-form'))).toContain(r.hint.school);
    await type(root, 'rename-form-input', 'Maple Hangul School');
    await submit(root, 'rename-form');
    expect(h1(root)).toEqual([m.console.school.titleFor('Maple Hangul School')]);
    expect(state.renames).toEqual([{ id: 'space:sch', name: 'Maple Hangul School' }]);
  });

  it('a class row: Rename between the teacher button and Open roster, none on an archived row; open, the row buttons step aside (D6)', async () => {
    state.school = view(false);
    const root = await render(school());
    expect(byTestId(root, 'rename')).toHaveLength(0);
    const rows = byTestId(root, 'class-row');
    const live = rows[0] as ReactTestInstance;
    const buttons = live.findAll((n) => n.type === 'button').map(textOf);
    expect(buttons).toEqual([m.console.school.classes.change.cta, r.cta, m.console.school.classes.open.cta]);
    expect(byTestId(rows[1] as ReactTestInstance, 'class-rename')).toHaveLength(0);
    await act(async () => (byTestId(live, 'class-rename')[0] as ReactTestInstance).props.onClick());
    const open = byTestId(root, 'class-row')[0] as ReactTestInstance;
    expect(open.findAll((n) => n.type === 'button').map(textOf)).toEqual([r.save.cta, r.cancel.cta]);
    expect(textOf(one(root, 'class-rename-form'))).toContain(r.hint.class);
    await type(root, 'class-rename-form-input', 'Sunday Hangul A');
    focused.length = 0;
    await submit(root, 'class-rename-form');
    expect(state.renames).toEqual([{ id: 'space:a', name: 'Sunday Hangul A' }]);
    expect(textOf(byTestId(root, 'class-row')[0] as ReactTestInstance)).toContain('Sunday Hangul A');
    expect(focused).toEqual(['class-rename']);
    expect(textOf(one(root, 'rename-live'))).toBe(r.saved);
  });
});

/** [SA] section 3.4: the class page's line comes from the roster's seats, not the free cap. */
describe('class page: the seat line from the roster seats', () => {
  const notice = (root: ReactTestInstance): ReactTestInstance | undefined => root.findAll((n) => n.type === 'div' && n.props.role === 'status')[0];
  it('a free class at 20: the free-limit line with the billing link', async () => {
    state.seats = { learners: 20, cap: 20, schoolLearners: null, schoolCap: null };
    const root = await render(<SpacePage />);
    const line = notice(root) as ReactTestInstance;
    expect(textOf(line)).toContain(m.console.capReached);
    expect(line.findAll((n) => n.type === 'a').map((a) => a.props.href)).toEqual(['/account/billing']);
  });

  it('a licensed class at 50: the Group License line, no billing link; over 50: the calm over line', async () => {
    state.seats = { learners: 50, cap: 50, schoolLearners: null, schoolCap: null };
    let root = await render(<SpacePage />);
    expect(textOf(notice(root) as ReactTestInstance)).toBe(m.console.seats.class.at(50));
    expect((notice(root) as ReactTestInstance).findAll((n) => n.type === 'a')).toHaveLength(0);
    act(() => mounted?.unmount());
    state.seats = { learners: 70, cap: 50, schoolLearners: null, schoolCap: null };
    root = await render(<SpacePage />);
    expect(textOf(notice(root) as ReactTestInstance)).toBe(m.console.seats.class.over(70, 50));
  });

  it('a class its school covers (no class cap): no line, even with 60 students', async () => {
    state.seats = { learners: 60, cap: null, schoolLearners: 60, schoolCap: 50 };
    const root = await render(<SpacePage />);
    expect(notice(root)).toBeUndefined();
  });
});
