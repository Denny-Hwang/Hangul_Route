import { readFileSync } from 'node:fs';
import { colors } from '@hangul-route/design-system/tokens';
import type { UiLocale } from '@hangul-route/i18n';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RelinkView } from '@/lib/console/api';
import { RELINK_REMINDED_KEY, RELINK_SHOWN_KEY, type PopupPick } from '@/lib/console/relink-popup';

/**
 * AMENDMENTS-GROWNUP-UX GX-2 section 5.3 (owner request 2026-10-31: "a pop-up or a clearer alert"): the re-link pop-up is an
 * `alertdialog` with focus on its title, Approve (primary) / Deny / Later, Escape = Later; it opens once per request per
 * tab session, once more at 2 minutes left after Later and never a third time; never while another dialog is open or the
 * tab is hidden. Rendered with react-test-renderer (no DOM).
 */
const lang = { locale: 'en' as UiLocale };
vi.mock('@/lib/i18n/locale-context', async () => {
  const i18n = await import('@hangul-route/i18n');
  const view = () => ({ locale: lang.locale, messages: i18n.getMessages(lang.locale), available: ['en', 'es', 'ko'], setLocale: () => undefined });
  return { useConsoleLocale: view, useMessages: () => view().messages, useLocale: () => lang.locale, useSetLocale: () => () => undefined };
});

import { RelinkPopup, shownKeys, typingInField, useRelinkPopup } from '@/components/console/RelinkPopup';

const NOW = new Date('2026-10-31T12:00:00.000Z');
const at = (minutes: number): string => new Date(NOW.getTime() + minutes * 60_000).toISOString();
const relink = (id: string, minutesLeft: number): RelinkView => ({ id, learnerId: `profile:${id}`, learnerName: 'Jaehan', deviceId: 'device:new', platform: 'ios', requestedAt: at(-1), expiresAt: at(minutesLeft), status: 'pending' });

const session: Record<string, string> = {};
const keyListeners = new Set<(e: { key: string; shiftKey: boolean; defaultPrevented?: boolean; preventDefault: () => void }) => void>();
const fakeDocument = {
  visibilityState: 'visible',
  /** Another modal dialog on the page (`[aria-modal="true"]`): null when there is none. */
  modal: null as unknown,
  querySelector(selector: string): unknown {
    return selector.includes('aria-modal') ? this.modal : null;
  },
  activeElement: null as unknown,
  body: {},
  addEventListener: (type: string, l: (e: never) => void) => {
    if (type === 'keydown') keyListeners.add(l as never);
  },
  removeEventListener: (type: string, l: (e: never) => void) => {
    if (type === 'keydown') keyListeners.delete(l as never);
  },
};

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  for (const k of Object.keys(session)) delete session[k];
  vi.stubGlobal('document', fakeDocument);
  vi.stubGlobal('window', {
    sessionStorage: {
      getItem: (k: string) => session[k] ?? null,
      setItem: (k: string, v: string) => {
        session[k] = v;
      },
      removeItem: (k: string) => {
        delete session[k];
      },
    },
  });
  fakeDocument.visibilityState = 'visible';
  fakeDocument.modal = null;
  fakeDocument.activeElement = null;
  lang.locale = 'en';
});

let renderer: ReactTestRenderer | null = null;
afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
  keyListeners.clear();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const focused: string[] = [];
const nodeMock = (el: { type: unknown; props: Record<string, unknown> }) => ({ focus: () => focused.push(String(el.type)), querySelectorAll: () => [], contains: () => false });
function textOf(node: ReactTestInstance | string): string {
  if (typeof node === 'string') return node;
  return node.children.map((child) => textOf(child)).join('');
}
const root = (): ReactTestInstance => (renderer as ReactTestRenderer).root;
const byTestId = (id: string): ReactTestInstance[] => root().findAll((n) => typeof n.type === 'string' && n.props['data-testid'] === id);

describe('RelinkPopup', () => {
  async function popup(pick: PopupPick, decide = vi.fn(async () => ({ ok: true as const, data: {} }))) {
    const calls = { later: 0, results: [] as Array<[string, string]>, settled: [] as boolean[] };
    await act(async () => {
      renderer = create(
        <RelinkPopup
          pick={pick}
          now={NOW}
          api={{ decideRelink: decide } as never}
          spaceId="space:a"
          online
          onLater={() => {
            calls.later += 1;
          }}
          onResult={(learnerId, text, settled) => {
            calls.results.push([learnerId, text]);
            calls.settled.push(settled);
          }}
        />,
        { createNodeMock: nodeMock as never },
      );
    });
    return { calls, decide };
  }

  it('an alertdialog named by its title, which takes focus; the hint and the minutes; Approve, Deny, Later in that order', async () => {
    focused.length = 0;
    await popup({ request: relink('r1', 7.5), reminder: false });
    const dialog = byTestId('relink-popup')[0] as ReactTestInstance;
    expect(dialog.props.role).toBe('alertdialog');
    expect(dialog.props['aria-modal']).toBe('true');
    const title = root().find((n) => n.props.id === dialog.props['aria-labelledby']);
    expect(textOf(title)).toBe('New device request: Jaehan');
    expect(textOf(root().find((n) => n.props.id === dialog.props['aria-describedby']))).toBe('Approve only if this learner is with you or you expect this device.This request closes in 8 min.');
    expect(focused[0]).toBe('h2');
    const buttons = dialog.findAll((n) => n.type === 'button').map((b) => b.props['data-testid']);
    expect(buttons).toEqual(['relink-popup-approve', 'relink-popup-deny', 'relink-popup-later']);
  });

  it('Approve answers the request and hands the result line to the page; Deny the same', async () => {
    const { calls, decide } = await popup({ request: relink('r1', 7.5), reminder: false });
    await act(async () => (byTestId('relink-popup-approve')[0] as ReactTestInstance).props.onClick());
    expect(decide).toHaveBeenCalledWith('space:a', 'r1', true);
    expect(calls.results).toEqual([['profile:r1', 'Jaehan can open their new device now.']]);
    await act(async () => (byTestId('relink-popup-deny')[0] as ReactTestInstance).props.onClick());
    expect(decide).toHaveBeenLastCalledWith('space:a', 'r1', false);
  });

  it('a request that closed meanwhile says so calmly', async () => {
    const { calls } = await popup({ request: relink('r1', 7.5), reminder: false }, vi.fn(async () => ({ ok: false as const, error: 'unknown' as const, status: 409, code: 'expired' })) as never);
    await act(async () => (byTestId('relink-popup-approve')[0] as ReactTestInstance).props.onClick());
    expect(calls.results[0]?.[1]).toContain('This request already closed');
    expect(calls.settled).toEqual([true]);
  });

  it('a failure that leaves the request open (a 5xx) keeps the pop-up with its line under the buttons', async () => {
    const { calls } = await popup({ request: relink('r1', 7.5), reminder: false }, vi.fn(async () => ({ ok: false as const, error: 'unknown' as const, status: 503 })) as never);
    await act(async () => (byTestId('relink-popup-approve')[0] as ReactTestInstance).props.onClick());
    expect(calls.settled).toEqual([false]);
    const line = byTestId('relink-popup-failed')[0] as ReactTestInstance;
    expect(textOf(line)).toBe(calls.results[0]?.[1]);
    expect(byTestId('relink-popup-approve')).toHaveLength(1);
  });

  it('the focused title draws no focus ring (it opens without a click); the buttons keep theirs', () => {
    const source = readFileSync(new URL('../RelinkPopup.tsx', import.meta.url), 'utf8');
    expect(source).toContain('.hr-relink-pop h2:focus,.hr-relink-pop h2:focus-visible{outline:none}');
    expect(source).toContain('.hr-relink-pop :focus-visible{outline:');
  });

  it('Escape and Later put it off; the page behind gets the key from anywhere', async () => {
    const { calls } = await popup({ request: relink('r1', 7.5), reminder: false });
    await act(async () => (byTestId('relink-popup-later')[0] as ReactTestInstance).props.onClick());
    expect(calls.later).toBe(1);
    const prevent = vi.fn();
    await act(async () => {
      for (const l of keyListeners) l({ key: 'Escape', shiftKey: false, preventDefault: prevent });
    });
    expect(calls.later).toBe(2);
    expect(prevent).toHaveBeenCalled();
  });

  it('ko and es words', async () => {
    lang.locale = 'ko';
    await popup({ request: relink('r1', 7.5), reminder: false });
    expect(textOf(byTestId('relink-popup')[0] as ReactTestInstance)).toContain('새 기기 연결 요청: Jaehan');
    expect(textOf(byTestId('relink-popup')[0] as ReactTestInstance)).toContain('8분 뒤에 이 요청이 마감돼요.');
    expect(textOf(byTestId('relink-popup-later')[0] as ReactTestInstance)).toBe('나중에');
    act(() => renderer?.unmount());
    lang.locale = 'es';
    await popup({ request: relink('r1', 7.5), reminder: false });
    expect(textOf(byTestId('relink-popup')[0] as ReactTestInstance)).toContain('Solicitud de dispositivo nuevo: Jaehan');
    expect(textOf(byTestId('relink-popup-later')[0] as ReactTestInstance)).toBe('Más tarde');
  });
});

describe('useRelinkPopup', () => {
  const seen: Array<PopupPick | null> = [];
  let control: ReturnType<typeof useRelinkPopup> | null = null;
  function Harness({ relinks, blocked = false, enabled = true, listed = [] }: { relinks: RelinkView[] | null; blocked?: boolean; enabled?: boolean; listed?: string[] }): null {
    control = useRelinkPopup({ relinks, blocked, enabled, listed });
    seen.push(control.pick);
    return null;
  }
  async function mount(relinks: RelinkView[] | null, blocked = false): Promise<void> {
    seen.length = 0;
    await act(async () => {
      renderer = create(<Harness relinks={relinks} blocked={blocked} />);
    });
  }
  async function update(relinks: RelinkView[] | null, blocked = false): Promise<void> {
    await act(async () => renderer?.update(<Harness relinks={relinks} blocked={blocked} />));
  }
  const current = (): PopupPick | null => control?.pick ?? null;

  it('opens once per request per tab session: Later closes it and the next read does not bring it back', async () => {
    await mount([relink('r1', 8)]);
    expect(current()?.request.id).toBe('r1');
    expect(JSON.parse(session[RELINK_SHOWN_KEY] ?? '[]')).toEqual(['r1']);
    await act(async () => control?.close());
    await update([relink('r1', 8)]);
    expect(current()).toBeNull();
    // A reload in this tab (the same session storage) does not show it again either.
    act(() => renderer?.unmount());
    await mount([relink('r1', 8)]);
    expect(current()).toBeNull();
  });

  it('once more at 2 minutes left after Later, and never a third time', async () => {
    await mount([relink('r1', 8)]);
    await act(async () => control?.close());
    vi.setSystemTime(new Date(NOW.getTime() + 6 * 60_000));
    await update([relink('r1', 8)]);
    expect(current()).toEqual({ request: expect.objectContaining({ id: 'r1' }), reminder: true });
    expect(JSON.parse(session[RELINK_REMINDED_KEY] ?? '[]')).toEqual(['r1']);
    await act(async () => control?.close());
    vi.setSystemTime(new Date(NOW.getTime() + 7 * 60_000));
    await update([relink('r1', 8)]);
    expect(current()).toBeNull();
  });

  it('a request first shown with 2 minutes or less left is not brought straight back after Later', async () => {
    await mount([relink('r1', 1.5)]);
    expect(current()?.reminder).toBe(false);
    await act(async () => control?.close());
    await update([relink('r1', 1.5)]);
    expect(current()).toBeNull();
    expect(shownKeys({ request: relink('x', 1.5), reminder: false }, NOW)).toEqual([RELINK_SHOWN_KEY, RELINK_REMINDED_KEY]);
    expect(shownKeys({ request: relink('x', 5), reminder: false }, NOW)).toEqual([RELINK_SHOWN_KEY]);
    expect(shownKeys({ request: relink('x', 1), reminder: true }, NOW)).toEqual([RELINK_REMINDED_KEY]);
  });

  it('waits while another dialog is open or the tab is hidden, then opens', async () => {
    await mount([relink('r1', 8)], true);
    expect(current()).toBeNull();
    fakeDocument.visibilityState = 'hidden';
    await update([relink('r1', 8)], false);
    expect(current()).toBeNull();
    fakeDocument.visibilityState = 'visible';
    await update([relink('r1', 8)], false);
    expect(current()?.request.id).toBe('r1');
  });

  it('never opens over another modal dialog (the frame display sheet); the next read with none open does', async () => {
    fakeDocument.modal = { role: 'dialog' };
    await mount([relink('r1', 8)]);
    expect(current()).toBeNull();
    fakeDocument.modal = null;
    await update([relink('r1', 8)]);
    expect(current()?.request.id).toBe('r1');
  });

  it('a request listed in the open review sheet counts as shown and reminded: no pop-up and no reminder after the sheet', async () => {
    seen.length = 0;
    await act(async () => {
      renderer = create(<Harness relinks={[relink('r1', 8)]} blocked listed={['r1']} />);
    });
    expect(JSON.parse(session[RELINK_SHOWN_KEY] ?? '[]')).toEqual(['r1']);
    expect(JSON.parse(session[RELINK_REMINDED_KEY] ?? '[]')).toEqual(['r1']);
    await update([relink('r1', 8)], false);
    expect(current()).toBeNull();
    vi.setSystemTime(new Date(NOW.getTime() + 6 * 60_000));
    await update([relink('r1', 8)], false);
    expect(current()).toBeNull();
  });

  it('closes when its request leaves the list (answered elsewhere, expired); a failed read keeps it', async () => {
    await mount([relink('r1', 8)]);
    await update(null);
    expect(current()?.request.id).toBe('r1');
    await update([]);
    expect(current()).toBeNull();
  });

  it('the action chip opens it for its request at any time, even after it was shown', async () => {
    await mount([relink('r1', 8)]);
    await act(async () => control?.close());
    await act(async () => control?.openFor('r1'));
    expect(current()).toEqual({ request: expect.objectContaining({ id: 'r1' }), reminder: false });
    await act(async () => control?.openFor('gone'));
    expect(current()?.request.id).toBe('r1');
  });

  it('shown with more than 2 minutes left and closed after the 2-minute mark: the reminder does not open at once', async () => {
    await mount([relink('r1', 8)]);
    expect(current()?.reminder).toBe(false);
    // The pop-up stays open while the grown-up is away; they tap Later with 1:50 left.
    vi.setSystemTime(new Date(NOW.getTime() + (6 * 60 + 10) * 1000));
    await act(async () => control?.close());
    await update([relink('r1', 8)]);
    expect(current()).toBeNull();
    expect(JSON.parse(session[RELINK_REMINDED_KEY] ?? '[]')).toEqual(['r1']);
  });

  it('closed with more than 2 minutes left: the reminder still comes at 2 minutes', async () => {
    await mount([relink('r1', 8)]);
    await act(async () => control?.close());
    expect(session[RELINK_REMINDED_KEY]).toBeUndefined();
    vi.setSystemTime(new Date(NOW.getTime() + (6 * 60 + 10) * 1000));
    await update([relink('r1', 8)]);
    expect(current()?.reminder).toBe(true);
  });

  it('never opens on its own while a text field has focus (a rename being typed); the next read without one does', async () => {
    fakeDocument.activeElement = { tagName: 'INPUT', getAttribute: () => 'text' };
    await mount([relink('r1', 8)]);
    expect(current()).toBeNull();
    fakeDocument.activeElement = { tagName: 'BUTTON', getAttribute: () => null };
    await update([relink('r1', 8)]);
    expect(current()?.request.id).toBe('r1');
    fakeDocument.activeElement = null;
  });

  it('typingInField: text inputs, text areas and editable regions; never buttons or check boxes', () => {
    const el = (tagName: string, type: string | null = null, editable = false) => ({ tagName, getAttribute: () => type, isContentEditable: editable });
    const cases: Array<[unknown, boolean]> = [
      [el('INPUT'), true],
      [el('INPUT', 'search'), true],
      [el('TEXTAREA'), true],
      [el('DIV', null, true), true],
      [el('INPUT', 'checkbox'), false],
      [el('BUTTON'), false],
      [null, false],
    ];
    for (const [active, typing] of cases) {
      fakeDocument.activeElement = active;
      expect(typingInField()).toBe(typing);
    }
    fakeDocument.activeElement = null;
  });

  it('without session storage it still opens once, not after each Later', async () => {
    vi.stubGlobal('window', {});
    await mount([relink('r1', 8)]);
    expect(current()?.request.id).toBe('r1');
    await act(async () => control?.close());
    await update([relink('r1', 8)]);
    expect(current()).toBeNull();
  });
});

describe('tokens', () => {
  it('the pop-up uses tokens only: no colour literal and never the danger colour', () => {
    const source = readFileSync(new URL('../RelinkPopup.tsx', import.meta.url), 'utf8');
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
    expect(source).not.toContain('feedback.danger');
    expect(source).toContain(`colors.feedback.nudge`);
    expect(colors.feedback.nudge).toBeTruthy();
  });
});
