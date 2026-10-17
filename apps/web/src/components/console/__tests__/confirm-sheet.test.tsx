import { getMessages } from '@hangul-route/i18n';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

/**
 * The console ConfirmSheet and `useConfirm` (AMENDMENTS-DISPLAY-NAV section 8, row DN-6): the question and its line
 * in the console language, Cancel first and focused, a verb to confirm; Escape and the backdrop cancel; Tab stays
 * inside; the 13 sites of the section's table each ask through it with their `console.confirm.*` verb, and no
 * `window.confirm` is left in the web app.
 */
vi.mock('@/lib/i18n/locale-context', async () => {
  const i18n = await import('@hangul-route/i18n');
  return { useMessages: () => i18n.getMessages('en') };
});

import { ConfirmSheet, tabTarget, useConfirm, type ConfirmAsk } from '../ConfirmSheet';

const en = getMessages('en');

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let mounted: ReactTestRenderer | null = null;
afterEach(() => {
  act(() => mounted?.unmount());
  mounted = null;
  vi.unstubAllGlobals();
});

const byTestId = (root: ReactTestInstance, id: string): ReactTestInstance[] => root.findAll((n) => typeof n.type === 'string' && n.props['data-testid'] === id);
const textOf = (n: ReactTestInstance | string): string => (typeof n === 'string' ? n : n.children.map(textOf).join(''));

interface FocusLog {
  focused: string[];
}

function render(ask: ConfirmAsk, onAnswer: (yes: boolean) => void, log?: FocusLog): ReactTestRenderer {
  act(() => {
    mounted = create(<ConfirmSheet ask={ask} onAnswer={onAnswer} />, {
      createNodeMock: (el) => ({
        focus: () => log?.focused.push(String((el.props as Record<string, unknown>)['data-testid'] ?? el.type)),
        querySelectorAll: () => [],
      }),
    });
  });
  return mounted as unknown as ReactTestRenderer;
}

describe('ConfirmSheet (console)', () => {
  const ask: ConfirmAsk = { title: 'Make a new code for Class A?', message: 'The old code stops working.', confirmLabel: en.console.confirm.newCode };

  it('an alertdialog named by its question and described by its line; Cancel first, the verb second', () => {
    const r = render(ask, vi.fn());
    const sheet = byTestId(r.root, 'confirm-sheet')[0]!;
    expect(sheet.props.role).toBe('alertdialog');
    expect(sheet.props['aria-modal']).toBe('true');
    const title = r.root.findAll((n) => n.type === 'h2')[0]!;
    expect(title.props.id).toBe(sheet.props['aria-labelledby']);
    expect(textOf(title)).toBe(ask.title);
    const line = r.root.findAll((n) => n.type === 'p')[0]!;
    expect(line.props.id).toBe(sheet.props['aria-describedby']);
    const buttons = sheet.findAll((n) => n.type === 'button');
    expect(buttons.map((b) => [b.props['data-testid'], textOf(b)])).toEqual([
      ['confirm-sheet-cancel', en.common.buttons.cancel],
      ['confirm-sheet-confirm', 'Make a new code'],
    ]);
  });

  it('no line: no description', () => {
    const r = render({ title: 'Archive this plan?', confirmLabel: en.console.confirm.archive }, vi.fn());
    expect(byTestId(r.root, 'confirm-sheet')[0]!.props['aria-describedby']).toBeUndefined();
    expect(r.root.findAll((n) => n.type === 'p')).toHaveLength(0);
  });

  it('Cancel, the backdrop and Escape answer no; the verb answers yes; other keys do nothing', () => {
    const onAnswer = vi.fn();
    const r = render(ask, onAnswer);
    act(() => byTestId(r.root, 'confirm-sheet-cancel')[0]!.props.onClick());
    act(() => byTestId(r.root, 'confirm-sheet-backdrop')[0]!.props.onClick());
    const preventDefault = vi.fn();
    act(() => byTestId(r.root, 'confirm-sheet')[0]!.props.onKeyDown({ key: 'Escape', shiftKey: false, preventDefault }));
    act(() => byTestId(r.root, 'confirm-sheet')[0]!.props.onKeyDown({ key: 'a', shiftKey: false, preventDefault }));
    expect(onAnswer.mock.calls).toEqual([[false], [false], [false]]);
    expect(preventDefault).toHaveBeenCalledTimes(1);
    act(() => byTestId(r.root, 'confirm-sheet-confirm')[0]!.props.onClick());
    expect(onAnswer).toHaveBeenLastCalledWith(true);
  });

  it('Cancel takes focus when it opens, and the opener gets it back when it goes', () => {
    const log: FocusLog = { focused: [] };
    const opener = { focus: () => log.focused.push('opener') };
    vi.stubGlobal('document', { activeElement: opener });
    render(ask, vi.fn(), log);
    expect(log.focused).toEqual(['confirm-sheet-cancel']);
    act(() => mounted?.unmount());
    mounted = null;
    expect(log.focused).toEqual(['confirm-sheet-cancel', 'opener']);
  });

  it('Tab stays inside: past the last button to the first, Shift+Tab from the first to the last', () => {
    expect(tabTarget(['cancel', 'confirm'], 'confirm', false)).toBe('cancel');
    expect(tabTarget(['cancel', 'confirm'], 'cancel', true)).toBe('confirm');
    expect(tabTarget(['cancel', 'confirm'], 'cancel', false)).toBeNull();
    expect(tabTarget([], null, false)).toBeNull();
    // The sheet's keydown runs it on its buttons (none in the test renderer's node: nothing moves).
    const r = render(ask, vi.fn());
    const preventDefault = vi.fn();
    act(() => byTestId(r.root, 'confirm-sheet')[0]!.props.onKeyDown({ key: 'Tab', shiftKey: false, preventDefault }));
    expect(preventDefault).not.toHaveBeenCalled();
  });
});

describe('useConfirm', () => {
  function Host({ onReady }: { onReady: (api: ReturnType<typeof useConfirm>) => void }): JSX.Element {
    const api = useConfirm();
    onReady(api);
    return <div>{api.sheet}</div>;
  }

  function mount(): { api: () => ReturnType<typeof useConfirm>; root: () => ReactTestInstance } {
    let latest: ReturnType<typeof useConfirm> | null = null;
    act(() => {
      mounted = create(<Host onReady={(api) => (latest = api)} />, { createNodeMock: () => ({ focus: () => undefined, querySelectorAll: () => [] }) });
    });
    return { api: () => latest as unknown as ReturnType<typeof useConfirm>, root: () => (mounted as ReactTestRenderer).root };
  }

  it('opens the sheet and resolves with the answer; closed, nothing is drawn', async () => {
    const h = mount();
    expect(h.api().sheet).toBeNull();
    let yes: Promise<boolean> | null = null;
    act(() => {
      yes = h.api().confirm({ title: 'Remove Mina from Class A?', confirmLabel: en.console.confirm.remove });
    });
    expect(textOf(h.root().findAll((n) => n.type === 'h2')[0]!)).toBe('Remove Mina from Class A?');
    act(() => byTestId(h.root(), 'confirm-sheet-confirm')[0]!.props.onClick());
    await expect(yes).resolves.toBe(true);
    expect(byTestId(h.root(), 'confirm-sheet')).toHaveLength(0);
  });

  it('a second question answers the first with the safe choice; going away answers the open one the same way', async () => {
    const h = mount();
    let first: Promise<boolean> | null = null;
    let second: Promise<boolean> | null = null;
    act(() => {
      first = h.api().confirm({ title: 'A?', confirmLabel: 'Yes A' });
    });
    act(() => {
      second = h.api().confirm({ title: 'B?', confirmLabel: 'Yes B' });
    });
    await expect(first).resolves.toBe(false);
    expect(textOf(h.root().findAll((n) => n.type === 'h2')[0]!)).toBe('B?');
    act(() => mounted?.unmount());
    mounted = null;
    await expect(second).resolves.toBe(false);
  });
});

describe('the 13 confirm sites (AMENDMENTS-DISPLAY-NAV section 8)', () => {
  const SRC = join(__dirname, '..', '..', '..');
  const read = (path: string): string => readFileSync(join(SRC, path), 'utf8');

  function sources(dir: string): string[] {
    return readdirSync(join(SRC, dir), { withFileTypes: true }).flatMap((e) => {
      const path = `${dir}/${e.name}`;
      if (e.isDirectory()) return e.name === '__tests__' ? [] : sources(path);
      return /\.tsx?$/.test(e.name) ? [path] : [];
    });
  }

  it('no window.confirm is left in the web app', () => {
    const left = [...sources('app'), ...sources('components'), ...sources('lib')].filter((file) => /\bwindow\.confirm\b/.test(read(file)));
    expect(left).toEqual([]);
  });

  it.each([
    ['app/(console)/teach/space/page.tsx', ['newCode']],
    ['app/(console)/teach/space/settings/page.tsx', ['newCode', 'remove', 'remove', 'archive']],
    ['components/console/SchoolAdmin.tsx', ['newCode']],
    ['components/console/ClassTransferParts.tsx', ['newCode']],
    ['app/(console)/teach/space/plan/page.tsx', ['discard', 'archive']],
    ['app/(console)/teach/space/relink/page.tsx', ['issueCode']],
    ['app/(console)/teach/space/lecture/page.tsx', ['copyAnyway', 'replace']],
    ['components/console/PlanUpdateParts.tsx', ['update']],
  ] as const)('%s asks through the ConfirmSheet with its verbs', (file, verbs) => {
    const source = read(file);
    const used = [...source.matchAll(/confirmLabel: [a-zA-Z.]*confirm\.([a-zA-Z]+)/g)].map((m) => m[1]);
    expect(used.sort()).toEqual([...verbs].sort());
    expect(source).toMatch(/useConfirm\(\)|confirm: \(ask: ConfirmAsk\) => Promise<boolean>/);
  });

  it('the transfers page hands its useConfirm to the class moves (the 13th site)', () => {
    const source = read('app/(console)/teach/space/transfers/page.tsx');
    expect(source).toContain('useConfirm()');
    expect(source).toContain('confirm={confirm}');
  });
});
