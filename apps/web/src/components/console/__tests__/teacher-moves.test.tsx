import { readFileSync } from 'node:fs';
import { CLASS_SCOPE_TEXT, classScopeItems } from '@hangul-route/content-schema';
import { getMessages, type UiLocale } from '@hangul-route/i18n';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ApiResult, LearnerReportBody } from '@/lib/console/api';
import type { IncomingMove, OutgoingMove } from '@/lib/console/class-moves';

/**
 * [TV] AMENDMENTS-TEACHER-VISIBILITY-TRANSFER section 5 (wireframe console/teacher-move-and-scope.md screens 1 to 4):
 * the teacher move sheet, the Teacher moves section, the family's cards and the report's Words and Settings blocks.
 * Rendered with react-test-renderer (the repo's web tests have no DOM).
 */
vi.mock('@/lib/i18n/locale-context', async () => {
  const i18n = await import('@hangul-route/i18n');
  const view = () => ({ locale: 'en' as UiLocale, messages: i18n.getMessages('en'), available: ['en'], setLocale: () => undefined });
  return { useConsoleLocale: view, useMessages: () => view().messages, useLocale: () => 'en', useSetLocale: () => () => undefined };
});

import { FamilyClassCards, type FamilyClassCardsApi } from '@/components/console/FamilyClassCards';
import { ReportScopeBlock } from '@/components/console/ReportScopeBlock';
import { TeacherMoveSheet, type TeacherMoveApi } from '@/components/console/TeacherMoveSheet';
import { TeacherMovesSection, type TeacherMovesApi } from '@/components/console/TeacherMovesSection';

const en = getMessages('en').console;
const tm = en.teacherMove;

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let renderer: ReactTestRenderer | null = null;
afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
});

async function render(node: JSX.Element): Promise<ReactTestInstance> {
  await act(async () => {
    renderer = create(node, { createNodeMock: () => ({}) });
  });
  await act(async () => undefined);
  return (renderer as ReactTestRenderer).root;
}
const root = (): ReactTestInstance => (renderer as ReactTestRenderer).root;
const byTestId = (id: string): ReactTestInstance[] => root().findAll((n) => n.props['data-testid'] === id && typeof n.type === 'string');
const one = (id: string): ReactTestInstance => byTestId(id)[0] as ReactTestInstance;
const text = (node: ReactTestInstance): string => node.findAll((n) => typeof n.type === 'string').map((n) => n.children.filter((c) => typeof c === 'string').join('')).join(' ');
const click = async (id: string, index = 0): Promise<void> => {
  await act(async () => (byTestId(id)[index] as ReactTestInstance).props.onClick());
};
const ok = <T,>(data: T): ApiResult<T> => ({ ok: true, data });
const fail = (code: string, status = 409, details?: Record<string, unknown>): ApiResult<never> => ({ ok: false, error: 'unknown', status, code, ...(details ? { details } : {}) });

const outgoing = (over: Partial<OutgoingMove> = {}): OutgoingMove => ({ id: 'move:1', kind: 'direct', status: 'moved', to: { spaceId: 'space:d', name: 'Evening Class D' }, learner: null, createdAt: '2026-10-14T00:00:00.000Z', at: '2026-10-14T00:00:00.000Z', ...over });

describe('TeacherMoveSheet (screen 1)', () => {
  function api(over: Partial<Record<keyof TeacherMoveApi, unknown>> = {}) {
    return {
      classMoveDestinations: vi.fn(async () => ok([{ id: 'space:d', name: 'Evening Class D' }])),
      previewClassMove: vi.fn(async () => ok({ destination: { id: 'space:b', name: 'Saturday Class B' }, direct: false })),
      createClassMove: vi.fn(async () => ok(outgoing())),
      ...over,
    } as unknown as TeacherMoveApi & Record<string, ReturnType<typeof vi.fn>>;
  }
  async function sheet(a: TeacherMoveApi, online = true) {
    const calls = { done: [] as OutgoingMove[], states: [] as string[], closed: 0 };
    await render(
      <TeacherMoveSheet
        spaceId="space:a"
        learner={{ id: 'profile:mina', name: 'Mina' }}
        api={a}
        online={online}
        onClose={() => {
          calls.closed += 1;
        }}
        onDone={(m) => calls.done.push(m)}
        onPageState={(s) => calls.states.push(s)}
      />,
    );
    return calls;
  }

  it('a direct move: a class the teacher manages, Continue, "This happens now.", Move now, Moved', async () => {
    const a = api();
    const calls = await sheet(a);
    expect(a.classMoveDestinations).toHaveBeenCalledWith('space:a', 'profile:mina');
    expect(one('teacher-move-continue').props['aria-disabled']).toBe(true);
    const radio = one('teacher-move-own').findByType('input');
    await act(async () => radio.props.onChange());
    expect(one('teacher-move-continue').props['aria-disabled']).toBeUndefined();
    await click('teacher-move-continue');
    expect(text(one('teacher-move-confirm'))).toContain(tm.confirmDirect('Mina', 'Evening Class D'));
    expect(text(one('teacher-move-confirm'))).toContain(tm.directLine);
    expect(text(one('teacher-move-go'))).toBe(tm.moveNow.cta);
    await click('teacher-move-go');
    expect(a.createClassMove).toHaveBeenCalledWith('space:a', { learnerId: 'profile:mina', destinationSpaceId: 'space:d' });
    expect(text(one('teacher-move-done'))).toBe(tm.moved('Mina', 'Evening Class D'));
    await click('teacher-move-finish');
    expect(calls.done).toHaveLength(1);
  });

  it("another teacher's class: the code, Find class, the accept wording, Send", async () => {
    const a = api({ createClassMove: vi.fn(async () => ok(outgoing({ kind: 'accept', status: 'waiting', to: { spaceId: 'space:b', name: 'Saturday Class B' } }))) });
    await sheet(a);
    await act(async () => one('teacher-move-other').findByType('input').props.onChange());
    await act(async () => root().find((n) => n.type === 'input' && n.props.name === 'classCode').props.onChange({ target: { value: 'k7pm4q' } }));
    await click('teacher-move-find');
    expect(a.previewClassMove).toHaveBeenCalledWith('space:a', { learnerId: 'profile:mina', code: 'K7PM4Q' });
    expect(text(one('teacher-move-found'))).toBe('Saturday Class B');
    await click('teacher-move-continue');
    expect(text(one('teacher-move-confirm'))).toContain(tm.acceptLine('Saturday Class B'));
    expect(text(one('teacher-move-go'))).toBe(tm.send.cta);
    await click('teacher-move-go');
    expect(a.createClassMove).toHaveBeenCalledWith('space:a', { learnerId: 'profile:mina', destinationSpaceId: 'space:b', code: 'K7PM4Q' });
    expect(text(one('teacher-move-done'))).toBe(tm.sent('Saturday Class B'));
  });

  it('with no other class it starts on the code and says why', async () => {
    await sheet(api({ classMoveDestinations: vi.fn(async () => ok([])) }));
    expect(text(one('teacher-move-no-class'))).toBe(tm.noOtherClass);
    expect(byTestId('teacher-move-code')).toHaveLength(1);
  });

  it('a full class is one line with the class name, never red; the lock and a sign-out go to the page', async () => {
    const a = api({ createClassMove: vi.fn(async () => fail('cap_class')) });
    await sheet(a);
    await act(async () => one('teacher-move-own').findByType('input').props.onChange());
    await click('teacher-move-continue');
    await click('teacher-move-go');
    expect(text(one('teacher-move-error'))).toBe(tm.errors.full('Evening Class D'));
    act(() => renderer?.unmount());
    const locked = await sheet(api({ classMoveDestinations: vi.fn(async () => fail('transfers_locked', 422)) }));
    expect(locked.states).toEqual(['locked']);
    act(() => renderer?.unmount());
    const offline = api();
    await sheet(offline, false);
    await act(async () => one('teacher-move-own').findByType('input').props.onChange());
    await click('teacher-move-continue');
    await click('teacher-move-go');
    expect(offline.createClassMove).not.toHaveBeenCalled();
    expect(text(one('teacher-move-error'))).toBe(tm.errors.offline);
  });

  it('a code that now opens another class goes back to step 1 and looks it up again', async () => {
    const a = api({ createClassMove: vi.fn(async () => fail('destination_changed')) });
    await sheet(a);
    await act(async () => one('teacher-move-other').findByType('input').props.onChange());
    await act(async () => root().find((n) => n.type === 'input' && n.props.name === 'classCode').props.onChange({ target: { value: 'K7PM4Q' } }));
    await click('teacher-move-find');
    await click('teacher-move-continue');
    await click('teacher-move-go');
    expect(a.previewClassMove).toHaveBeenCalledTimes(2);
    expect(byTestId('teacher-move-confirm')).toHaveLength(0);
  });
});

describe('TeacherMovesSection (screen 2)', () => {
  const incoming = (over: Partial<IncomingMove> = {}): IncomingMove => ({ id: 'move:2', kind: 'accept', status: 'waiting', from: { name: 'Weekday Class D' }, learner: { alias: 'M. K.', avatar: 'tiger', level: 'starter' }, createdAt: '2026-10-13T00:00:00.000Z', at: null, ...over });
  function api(lists: { outgoing: OutgoingMove[]; incoming: IncomingMove[] }, over: Partial<Record<keyof TeacherMovesApi, unknown>> = {}) {
    return {
      classMoves: vi.fn(async () => ok(lists)),
      acceptClassMove: vi.fn(async () => ok(incoming({ status: 'moved' }))),
      declineClassMove: vi.fn(async () => ok(incoming({ status: 'ended' }))),
      cancelClassMove: vi.fn(async () => ok(outgoing({ status: 'ended' }))),
      ...over,
    } as unknown as TeacherMovesApi & Record<string, ReturnType<typeof vi.fn>>;
  }
  const section = (a: TeacherMovesApi, readOnly = false) => render(<TeacherMovesSection spaceId="space:b" api={a} online readOnly={readOnly} refreshMs={60_000} onPageState={() => undefined} />);

  it('an ask shows initials, a picture, a level and where it comes from, never a name; Accept moves it', async () => {
    const a = api({ outgoing: [], incoming: [incoming()] });
    await section(a);
    const card = one('teacher-move-incoming');
    expect(text(card)).toContain('M. K.');
    expect(text(card)).toContain(tm.section.from('Weekday Class D'));
    await click('teacher-move-accept');
    expect(a.acceptClassMove).toHaveBeenCalledWith('space:b', 'move:2');
    expect(a.classMoves).toHaveBeenCalledTimes(2);
  });

  it('no room: an amber line and Try again, the ask stays', async () => {
    const a = api({ outgoing: [], incoming: [incoming()] }, { acceptClassMove: vi.fn(async () => fail('move_blocked', 409, { reason: 'cap_class' })) });
    await section(a);
    await click('teacher-move-accept');
    expect(text(one('teacher-move-incoming'))).toContain(tm.section.noRoom);
    expect(text(one('teacher-move-accept'))).toBe(tm.section.tryAgain.cta);
  });

  it('Not now and Cancel answer by id; ended and done lines name no actor; read-only draws no buttons', async () => {
    const a = api({ outgoing: [outgoing({ kind: 'accept', status: 'waiting', learner: { name: 'Jun', avatar: 'tiger' } }), outgoing({ id: 'move:3', status: 'ended' })], incoming: [incoming(), incoming({ id: 'move:4', status: 'moved', learner: { name: 'Suni', avatar: 'tiger' }, at: '2026-10-14T00:00:00.000Z' })] });
    await section(a);
    await click('teacher-move-not-now');
    expect(a.declineClassMove).toHaveBeenCalledWith('space:b', 'move:2');
    await click('teacher-move-cancel-ask');
    expect(a.cancelClassMove).toHaveBeenCalledWith('space:b', 'move:1');
    const done = byTestId('teacher-move-done-row').map(text).join(' | ');
    expect(done).toContain(tm.section.joined('Suni'));
    expect(done).toContain(tm.section.ended);
    act(() => renderer?.unmount());
    await section(api({ outgoing: [], incoming: [incoming()] }), true);
    expect(byTestId('teacher-move-accept')).toHaveLength(0);
  });
});

describe('FamilyClassCards (screen 4)', () => {
  function api(over: Partial<Record<keyof FamilyClassCardsApi, unknown>> = {}) {
    return {
      classScope: vi.fn(async () => ok({ current: 'class-scope-2026-10', learners: [{ learnerId: 'profile:mina', name: 'Mina', needed: true }, { learnerId: 'profile:jun', name: 'Jun', needed: false }] })),
      acknowledgeClassScope: vi.fn(async () => ok({ version: 'class-scope-2026-10', ackedAt: 't' })),
      moveNotices: vi.fn(async () => ok([{ id: 'move:1', learnerId: 'profile:mina', learnerName: 'Mina', to: { spaceId: 'space:d', name: 'Evening Class D' }, executedAt: 't' }])),
      markMoveSeen: vi.fn(async () => ok({ seen: true })),
      ...over,
    } as unknown as FamilyClassCardsApi & Record<string, ReturnType<typeof vi.fn>>;
  }

  it('one update card per learner who needs it: every line and every item, names filled in; OK acknowledges', async () => {
    const a = api();
    await render(<FamilyClassCards familyId="space:f" api={a} movesShown />);
    const cards = byTestId('class-scope-card');
    expect(cards).toHaveLength(1);
    const words = text(cards[0] as ReactTestInstance);
    expect(words).toContain(en.classScope.title('Mina'));
    for (const line of Object.values(CLASS_SCOPE_TEXT.en.lines)) expect(words).toContain(line.split('{learner}').join('Mina'));
    for (const item of classScopeItems('en')) expect(words).toContain(item.text.split('{learner}').join('Mina'));
    await click('class-scope-ok');
    expect(a.acknowledgeClassScope).toHaveBeenCalledWith('space:f', 'profile:mina', 'class-scope-2026-10');
    expect(byTestId('class-scope-card')).toHaveLength(0);
  });

  it('the move notice says where the learner went, until OK', async () => {
    const a = api();
    await render(<FamilyClassCards familyId="space:f" api={a} movesShown />);
    expect(text(one('move-notice'))).toContain(en.classScope.notice('Mina', 'Evening Class D'));
    await click('move-notice-ok');
    expect(a.markMoveSeen).toHaveBeenCalledWith('space:f', 'move:1');
    expect(byTestId('move-notice')).toHaveLength(0);
  });

  it('reads no notices while moves are off, draws nothing with nothing to say, and says when OK did not save', async () => {
    const quiet = api({ classScope: vi.fn(async () => ok({ current: 'class-scope-2026-10', learners: [] })) });
    await render(<FamilyClassCards familyId="space:f" api={quiet} movesShown={false} />);
    expect(quiet.moveNotices).not.toHaveBeenCalled();
    expect(byTestId('family-class-cards')).toHaveLength(0);
    act(() => renderer?.unmount());
    const failing = api({ acknowledgeClassScope: vi.fn(async () => fail('network', -1)) });
    await render(<FamilyClassCards familyId="space:f" api={failing} movesShown={false} />);
    await click('class-scope-ok');
    expect(text(one('class-scope-card'))).toContain(en.classScope.failed);
  });
});

describe('ReportScopeBlock (screen 3)', () => {
  const body = (over: Partial<LearnerReportBody>): LearnerReportBody => ({
    space: { id: 'space:a', kind: 'class', name: 'A', archivedAt: null },
    learner: { id: 'profile:mina', displayName: 'Mina', avatar: 'tiger' },
    summary: null,
    lastSyncedAt: null,
    serverTime: 't',
    ...over,
  });

  it('base scope: one muted line, no words', async () => {
    await render(<ReportScopeBlock data={body({ scope: 'base' })} />);
    expect(text(one('report-base-scope'))).toBe(en.reportScope.baseScope);
    expect(byTestId('report-words')).toHaveLength(0);
  });

  it('full scope: words, the first-try rate and the class-notes setting', async () => {
    const vocab = { collected: 42, strong: 18, topicsStarted: 2, topicsPracticed7d: 1, firstTryRate: 0.756, needsPractice: [] };
    await render(<ReportScopeBlock data={body({ scope: 'full', summary: { vocab } as LearnerReportBody['summary'], settings: { classNotes: 'presets' } })} />);
    expect(text(one('report-words'))).toContain(en.space.learner.words(42, 18));
    expect(text(one('report-first-try'))).toBe(en.reportScope.firstTry(76));
    expect(text(one('report-settings'))).toContain(en.reportScope.classNotes.presets);
  });

  it('nothing to show: draws nothing', async () => {
    await render(<ReportScopeBlock data={body({ scope: 'full' })} />);
    expect(byTestId('report-words')).toHaveLength(0);
    expect(byTestId('report-settings')).toHaveLength(0);
  });
});

describe('style rules', () => {
  it('the new files use tokens only: no colour literal and never the danger colour', () => {
    for (const file of ['TeacherMoveSheet.tsx', 'TeacherMovesSection.tsx', 'FamilyClassCards.tsx', 'ReportScopeBlock.tsx']) {
      const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
      expect(source, file).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
      expect(source, file).not.toContain('feedback.danger');
    }
  });
});
