import { colors, touchTarget } from '@hangul-route/design-system/tokens';
import { getMessages, type UiLocale } from '@hangul-route/i18n';
import type { CSSProperties } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { LearnerStatus } from '@/lib/console/learner-status';

/**
 * AMENDMENTS-GROWNUP-UX row GX-10 (section 8 T11, section 9 P7; section 14 "settings render tests"): the settings page's
 * learner rows carry the one status chip next to the name (the same `learnerStatus` as the class roster), **Move** is
 * off with the reason "A move is already open." while a move of that learner is open, Move and Remove are one size,
 * Remove is the quieter text button (still behind the shipped confirm), a family row says which classes the learner is
 * in, and a family's **Invite another grown-up** copies the family code with one line saying what the other grown-up does.
 */
const view = vi.hoisted(() => ({ locale: 'en' as string }));
vi.mock('@/lib/i18n/locale-context', async () => {
  const i18n = await import('@hangul-route/i18n');
  const read = () => ({ locale: view.locale as UiLocale, messages: i18n.getMessages(view.locale as UiLocale), available: ['en', 'es', 'ko'], setLocale: () => undefined });
  return { useConsoleLocale: read, useMessages: () => read().messages, useLocale: () => view.locale, useSetLocale: () => () => undefined };
});

import { SettingsSections, type SettingsSectionsProps } from '@/components/console/SettingsParts';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let renderer: ReactTestRenderer | null = null;
afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
  view.locale = 'en';
  vi.unstubAllGlobals();
});

function render(node: JSX.Element): ReactTestInstance {
  act(() => {
    renderer = create(node);
  });
  return (renderer as ReactTestRenderer).root;
}
const textOf = (node: ReactTestInstance): string => node.findAll((n) => typeof n.type === 'string').map((n) => n.children.filter((c) => typeof c === 'string').join('')).join(' ');

const NOW = new Date('2026-10-31T12:00:00.000Z');
const at = (minutes: number): string => new Date(NOW.getTime() + minutes * 60_000).toISOString();
const noop = (): void => undefined;

const status = (learnerId: string, over: Partial<LearnerStatus>): LearnerStatus => ({ learnerId, kind: 'in_class', action: false, scopeBase: false, ...over });
const STATUSES: Record<string, LearnerStatus> = {
  'profile:mina': status('profile:mina', {}),
  'profile:jaehan': status('profile:jaehan', { kind: 'relink', action: true, relink: { id: 'relink:j', expiresAt: at(7.5) } }),
  'profile:yuhan': status('profile:yuhan', { kind: 'move_others', move: { source: 'transfer', id: 'transfer:1', to: 'Evening Class D', on: null, expiresAt: at(60 * 24) } }),
};

function props(kind: 'class' | 'family' | 'school', over: Partial<SettingsSectionsProps> = {}): SettingsSectionsProps {
  return {
    roster: {
      space: { id: 'space:a', kind, name: kind === 'family' ? 'The Kims' : 'Sunday Class A', parentSpaceId: null, settings: { consentMode: 'parent', anonymizeRoster: false }, archivedAt: null, createdAt: '2026-09-01T00:00:00.000Z' },
      learners: [],
      joinCode: 'K7PM4Q',
      joinCodeExpiresAt: '2026-11-30T00:00:00.000Z',
    } as unknown as SettingsSectionsProps['roster'],
    members: [
      { memberKind: 'account', memberId: 'acc_1', role: 'owner', joinedAt: '2026-09-01T00:00:00.000Z', name: 'Mr Han', isOwner: true },
      { memberKind: 'learner', memberId: 'profile:mina', role: 'student', joinedAt: '2026-09-20T00:00:00.000Z', name: 'Mina', isOwner: false },
      { memberKind: 'learner', memberId: 'profile:jaehan', role: 'student', joinedAt: '2026-09-21T00:00:00.000Z', name: 'Jaehan', isOwner: false },
      { memberKind: 'learner', memberId: 'profile:yuhan', role: 'student', joinedAt: '2026-09-22T00:00:00.000Z', name: 'Yuhan', isOwner: false },
    ] as unknown as SettingsSectionsProps['members'],
    accountId: 'acc_1',
    now: NOW,
    busy: false,
    schoolConsent: false,
    deleteTarget: '',
    typedName: '',
    onRegenerate: noop,
    onConsent: noop,
    onAnonymize: noop,
    onRemoveAdult: noop,
    onRemoveLearner: noop,
    onArchive: noop,
    onDeleteTarget: noop,
    onTypedName: noop,
    onDelete: noop,
    move: { online: true, onMove: noop, familyMovable: new Set(['profile:mina', 'profile:jaehan', 'profile:yuhan']) },
    statuses: STATUSES,
    ...over,
  };
}

const rows = (root: ReactTestInstance) => root.findAll((n) => n.type === 'div' && n.props['data-testid'] === 'settings-learner-row');
const rowOf = (root: ReactTestInstance, name: string) => {
  const row = rows(root).find((r) => r.findAll((n) => n.type === 'strong').some((s) => textOf(s) === name));
  expect(row, name).toBeDefined();
  return row as ReactTestInstance;
};
const moveOf = (row: ReactTestInstance) => row.find((n) => n.type === 'button' && n.props['data-testid'] === 'move-row');
const removeOf = (row: ReactTestInstance) => row.find((n) => n.type === 'button' && n.props['data-testid'] === 'remove-learner');
const byId = (root: ReactTestInstance, id: string) => root.find((n) => typeof n.type === 'string' && n.props.id === id);

for (const locale of ['en', 'es', 'ko'] as const) {
  const c = getMessages(locale).console;
  describe(`${locale}: class learner rows (T11)`, () => {
    it('the status chip sits next to each name: In class, and Needs your OK as a button that opens the decision', () => {
      view.locale = locale;
      const opened: LearnerStatus[] = [];
      const root = render(<SettingsSections {...props('class', { onOpenStatus: (s) => opened.push(s) })} />);
      const mina = rowOf(root, 'Mina');
      expect(textOf(mina.find((n) => n.props['data-testid'] === 'learner-status' && typeof n.type === 'string')).trim()).toBe(c.status.inClass);
      const jaehan = rowOf(root, 'Jaehan');
      const chip = jaehan.find((n) => n.type === 'button' && n.props['data-testid'] === 'learner-status');
      expect(chip.props['aria-label']).toBe(c.status.chipName(c.status.needsOk, c.status.newDevice(8)));
      expect(textOf(jaehan)).toContain(c.status.newDevice(8));
      act(() => chip.props.onClick());
      expect(opened.map((s) => s.kind)).toEqual(['relink']);
      // The chip is drawn in the name's line, before the actions.
      const head = jaehan.find((n) => n.props['data-testid'] === 'settings-learner-head');
      expect(head.findAll((n) => n.type === 'button' && n.props['data-testid'] === 'learner-status')).toHaveLength(1);
    });

    it('Move to another class is off with "A move is already open." while a move of that learner is open', () => {
      view.locale = locale;
      const moved: string[] = [];
      const root = render(<SettingsSections {...props('class', { move: { online: true, onMove: (m) => moved.push(m.memberId) } })} />);
      const yuhan = rowOf(root, 'Yuhan');
      expect(textOf(yuhan)).toContain(c.status.moveWaiting);
      const move = moveOf(yuhan);
      expect(move.props['aria-disabled']).toBe(true);
      expect(move.props.onClick).toBeUndefined();
      const reason = byId(root, move.props['aria-describedby'] as string);
      expect(textOf(reason)).toBe(c.settings.moveOpen);
      // The other learners' Move works as shipped.
      const mina = moveOf(rowOf(root, 'Mina'));
      expect(mina.props['aria-disabled']).toBeUndefined();
      act(() => mina.props.onClick());
      expect(moved).toEqual(['profile:mina']);
      expect(textOf(rowOf(root, 'Mina'))).not.toContain(c.settings.moveOpen);
    });
  });
}

describe('Move and Remove: one size, Remove the quieter text button (T11, P7)', () => {
  for (const kind of ['class', 'family'] as const) {
    it(`${kind}: the two buttons share the console button's size; Remove has no fill and no border, in the danger colour`, () => {
      const removed: string[] = [];
      const root = render(<SettingsSections {...props(kind, { onRemoveLearner: (m) => removed.push(m.memberId) })} />);
      const mina = rowOf(root, 'Mina');
      const move = moveOf(mina).props.style as CSSProperties;
      const remove = removeOf(mina).props.style as CSSProperties;
      for (const key of ['minHeight', 'minWidth', 'padding', 'fontSize', 'fontWeight', 'borderRadius', 'boxSizing', 'display'] as const) expect(remove[key], key).toBe(move[key]);
      expect(remove.minHeight).toBe(touchTarget.min);
      expect(remove.color).toBe(colors.feedback.danger);
      expect(remove.backgroundColor).toBe('transparent');
      expect(remove.borderColor).toBe('transparent');
      expect(remove.textDecoration).toBe('underline');
      // Still the shipped confirm: the page's handler runs, never a removal from the row itself.
      act(() => removeOf(mina).props.onClick());
      expect(removed).toEqual(['profile:mina']);
    });
  }
});

describe('family rows (P7): the class line and the chip, no default chip', () => {
  const p = getMessages('en').console;
  it('"In: {class}", "In {n} classes" with the names, "Family only"; no In class chip in a family', () => {
    const classes = new Map<string, readonly string[]>([
      ['profile:mina', ['Sunday Class A']],
      ['profile:jaehan', ['Sunday Class A', 'Evening Class D']],
      ['profile:yuhan', []],
    ]);
    const statuses = { ...STATUSES, 'profile:mina': status('profile:mina', { kind: 'none' }) };
    const root = render(<SettingsSections {...props('family', { familyClasses: classes, statuses })} />);
    const mina = rowOf(root, 'Mina');
    expect(textOf(mina)).toContain(p.parentHome.classLine.one('Sunday Class A'));
    expect(mina.findAll((n) => n.props['data-testid'] === 'learner-status')).toHaveLength(0);
    const jaehan = rowOf(root, 'Jaehan');
    expect(textOf(jaehan)).toContain(p.parentHome.classLine.many(2));
    expect(textOf(jaehan)).toContain('Sunday Class A, Evening Class D');
    expect(textOf(rowOf(root, 'Yuhan'))).toContain(p.parentHome.classLine.none);
  });

  it('without the classes read, no class line at all (never "Family only" on a guess)', () => {
    const root = render(<SettingsSections {...props('family', { familyClasses: null })} />);
    for (const name of ['Mina', 'Jaehan', 'Yuhan']) {
      const text = textOf(rowOf(root, name));
      expect(text).not.toContain(p.parentHome.classLine.none);
      expect(text).not.toContain('In: ');
    }
  });

  it('a school row shows no chip (the In class chip is for class rosters)', () => {
    const root = render(<SettingsSections {...props('school', { statuses: undefined })} />);
    expect(root.findAll((n) => n.props['data-testid'] === 'learner-status')).toHaveLength(0);
  });
});

describe('Invite another grown-up (P7)', () => {
  for (const locale of ['en', 'es', 'ko'] as const) {
    const s = getMessages(locale).console.settings;
    it(`${locale}: a family's button copies the family code; one line says what the other grown-up does`, async () => {
      view.locale = locale;
      const writeText = vi.fn(async () => undefined);
      vi.stubGlobal('navigator', { clipboard: { writeText } });
      const root = render(<SettingsSections {...props('family')} />);
      const grownUps = root.find((n) => n.type === 'section' && n.props['aria-label'] === s.grownUps.label);
      expect(textOf(grownUps)).toContain(s.inviteGrownUpLine('K7PM4Q'));
      expect(textOf(grownUps)).not.toContain(s.grownUps.invite.family);
      const invite = grownUps.find((n) => n.type === 'button' && n.props['data-testid'] === 'invite-grown-up');
      expect(textOf(invite)).toBe(s.inviteGrownUp.cta);
      await act(async () => invite.props.onClick());
      expect(writeText).toHaveBeenCalledWith('K7PM4Q');
      const live = grownUps.find((n) => n.props['data-testid'] === 'invite-grown-up-status');
      expect(live.props.role).toBe('status');
      expect(textOf(live)).toBe(getMessages(locale).console.joinCode.copied.cta);
    });
  }

  it('a refused clipboard says the code is on the screen', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: async () => Promise.reject(new Error('denied')) } });
    const root = render(<SettingsSections {...props('family')} />);
    await act(async () => root.find((n) => n.type === 'button' && n.props['data-testid'] === 'invite-grown-up').props.onClick());
    expect(textOf(root.find((n) => n.props['data-testid'] === 'invite-grown-up-status'))).toBe(getMessages('en').console.parentHome.copyFailed);
  });

  it('no code, an archived family, a class or a school: the shipped line, no button', () => {
    const s = getMessages('en').console.settings;
    const noCode = props('family');
    const cases: SettingsSectionsProps[] = [
      { ...noCode, roster: { ...noCode.roster, joinCode: null } },
      { ...noCode, roster: { ...noCode.roster, space: { ...noCode.roster.space, archivedAt: '2026-10-01T00:00:00.000Z' } } },
      props('class'),
      props('school', { statuses: undefined }),
    ];
    for (const p of cases) {
      const root = render(<SettingsSections {...p} />);
      expect(root.findAll((n) => n.props['data-testid'] === 'invite-grown-up')).toHaveLength(0);
      expect(textOf(root)).toContain(s.grownUps.invite[p.roster.space.kind]);
      act(() => renderer?.unmount());
      renderer = null;
    }
  });
});
