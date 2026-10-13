import { readFileSync } from 'node:fs';
import { getMessages, type UiLocale } from '@hangul-route/i18n';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ApiResult, TransferPreview, TransferView } from '@/lib/console/api';

/**
 * F-SPACE-002 T-6c (spec 4.8; design/screens/transfer/start-sheet.md, the T-0b mockups): the class start sheet and
 * the settings row's Move action. Rendered with react-test-renderer (the repo's web tests have no DOM).
 */
vi.mock('@/lib/i18n/locale-context', async () => {
  const i18n = await import('@hangul-route/i18n');
  const view = () => ({ locale: 'en' as UiLocale, messages: i18n.getMessages('en'), available: ['en'], setLocale: () => undefined });
  return { useConsoleLocale: view, useMessages: () => view().messages, useLocale: () => 'en', useSetLocale: () => () => undefined };
});

import { MoveRowAction, StartMoveSheet, type StartMoveApi } from '@/components/console/TransferParts';

const en = getMessages('en');
const t = en.console.transfer;

beforeAll(() => {
  // react-test-renderer + React 18: act() needs this flag outside a DOM environment.
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

const view = { id: 'transfer:1', role: 'source', status: 'requested' } as unknown as TransferView;

function makeApi(previews: ApiResult<TransferPreview>[], creates: ApiResult<TransferView>[] = []) {
  const previewTransfer = vi.fn(async () => previews.shift() ?? { ok: false as const, error: 'network' as const, status: -1 });
  const createTransfer = vi.fn(async () => creates.shift() ?? { ok: false as const, error: 'network' as const, status: -1 });
  return { api: { previewTransfer, createTransfer } as unknown as StartMoveApi, previewTransfer, createTransfer };
}

const found = (name = 'Saturday Class B', id = 'space:b'): ApiResult<TransferPreview> => ({ ok: true, data: { destination: { id, kind: 'class', name } } });
const failure = (code: string, status = 409, error: 'unknown' | 'not_found' | 'invalid' = 'unknown'): ApiResult<never> => ({ ok: false, error, status, code });

let renderer: ReactTestRenderer | null = null;
afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
});

function render(api: StartMoveApi, over: Partial<{ online: boolean }> = {}) {
  const calls = { closed: 0, sent: [] as TransferView[], states: [] as string[] };
  act(() => {
    renderer = create(
      <StartMoveSheet
        spaceId="space:a"
        learner={{ id: 'profile:mina', name: 'Mina' }}
        api={api}
        online={over.online ?? true}
        onClose={() => {
          calls.closed += 1;
        }}
        onSent={(v) => calls.sent.push(v)}
        onPageState={(s) => calls.states.push(s)}
      />,
    );
  });
  return calls;
}

const root = (): ReactTestInstance => (renderer as ReactTestRenderer).root;
const byTestId = (id: string): ReactTestInstance => root().find((n) => n.props['data-testid'] === id && typeof n.type === 'string');
const queryTestId = (id: string): ReactTestInstance[] => root().findAll((n) => n.props['data-testid'] === id && typeof n.type === 'string');
const text = (node: ReactTestInstance): string => node.findAll((n) => typeof n.type === 'string').map((n) => n.children.filter((c) => typeof c === 'string').join('')).join(' ');
const typeCode = (value: string): void => {
  act(() => {
    root().findByType('input').props.onChange({ target: { value } });
  });
};
const click = async (id: string): Promise<void> => {
  await act(async () => {
    byTestId(id).props.onClick();
  });
};
const alertText = (): string | null => {
  const alerts = root().findAll((n) => n.props.role === 'alert');
  return alerts.length ? text(alerts[0] as ReactTestInstance) : null;
};

describe('StartMoveSheet (start-sheet.md)', () => {
  it('is a labelled modal dialog whose heading names the learner; the close button is named', () => {
    render(makeApi([]).api);
    const dialog = root().find((n) => n.props.role === 'dialog');
    expect(dialog.props['aria-modal']).toBe('true');
    const heading = root().findByType('h2');
    expect(dialog.props['aria-labelledby']).toBe(heading.props.id);
    expect(heading.props.tabIndex).toBe(-1);
    expect(heading.children.join('')).toBe('Move Mina to another class');
    expect(root().find((n) => n.type === 'button' && n.props['aria-label'] === t.a11y.close)).toBeTruthy();
  });

  it('step 1: the shipped join field, labelled "Class code", with its rules line; Find class is the only primary', () => {
    render(makeApi([]).api);
    const input = root().findByType('input');
    expect(input.props.autoComplete).toBe('off');
    const label = root().findByType('label');
    expect(label.props.htmlFor).toBe(input.props.id);
    expect(text(label)).toBe(en.console.space.codeLabel.class);
    expect(text(root())).toContain(en.caregiver.join.code.rules);
    expect(text(root())).toContain(t.start.step1);
    expect(queryTestId('move-send')).toHaveLength(0);
    expect(text(byTestId('move-find'))).toBe('Find class');
  });

  it('Find class previews with the learner id in the body and the normalised code; step 2 names the class from the server', async () => {
    const { api, previewTransfer } = makeApi([found()]);
    render(api);
    typeCode('k7p-m4q');
    await click('move-find');
    expect(previewTransfer).toHaveBeenCalledWith('space:a', { learnerId: 'profile:mina', code: 'K7PM4Q' });
    const block = byTestId('move-found');
    expect(text(block)).toContain('Move to "Saturday Class B"?');
    expect(text(block)).toContain(t.start.familyFirst);
    expect(text(block)).toContain(t.start.nothingUntil);
    expect(text(block)).toContain('Mina keeps cards and stars. You can cancel any time before the move.');
    // One primary per state: Send request; Find class steps down.
    expect(byTestId('move-send').props.style.backgroundColor).not.toBe(byTestId('move-find').props.style.backgroundColor);
  });

  it('Send request creates the request for that exact class and reports it', async () => {
    const { api, createTransfer } = makeApi([found()], [{ ok: true, data: view }]);
    const calls = render(api);
    typeCode('K7PM4Q');
    await click('move-find');
    await click('move-send');
    expect(createTransfer).toHaveBeenCalledWith('space:a', { learnerId: 'profile:mina', destinationSpaceId: 'space:b', code: 'K7PM4Q' });
    expect(calls.sent).toEqual([view]);
  });

  it('a malformed code never leaves the browser: "That code didn\'t work." under the field, aria-invalid set', async () => {
    const { api, previewTransfer } = makeApi([]);
    render(api);
    typeCode('OI01');
    await click('move-find');
    expect(previewTransfer).not.toHaveBeenCalled();
    expect(alertText()).toBe("That code didn't work.");
    const input = root().findByType('input');
    expect(input.props['aria-invalid']).toBe(true);
    const alert = root().find((n) => n.props.role === 'alert');
    expect(String(input.props['aria-describedby']).split(' ')).toContain(alert.props.id);
  });

  it('words every answer of the preview as one line', async () => {
    const cases: Array<[ApiResult<never>, string]> = [
      [failure('code_not_found', 404, 'not_found'), "That code didn't work."],
      [failure('code_expired', 404, 'not_found'), 'That code is too old. Ask for a new one.'],
      [failure('cap_class'), 'That class is full right now.'],
      [failure('already_member'), 'Mina is already in that class.'],
      [failure('too_many_attempts', 429), 'Too many tries. Try again later.'],
      [failure('cannot_send', 422, 'invalid'), "This request can't be sent right now."],
      [failure('family_needed', 422, 'invalid'), 'A family account is needed to answer this. Ask the family to start the move from their app.'],
      [failure('same_space'), 'That code is for the class Mina is in now.'],
      [failure('already_open'), 'Mina already has a move waiting.'],
      [failure('destination_busy'), 'That class has many moves waiting. Try again in a few days.'],
      [failure('not_transferable', 422, 'invalid'), "That code can't be used for a move."],
      [failure('not_found', 404, 'not_found'), t.states.forbidden],
    ];
    for (const [answer, line] of cases) {
      render(makeApi([answer]).api);
      typeCode('K7PM4Q');
      await click('move-find');
      expect(alertText(), answer.ok ? '' : answer.code).toBe(line);
      expect(queryTestId('move-found')).toHaveLength(0);
      act(() => renderer?.unmount());
      renderer = null;
    }
  });

  it('a create refused for too many moves today keeps step 2 and says so', async () => {
    render(makeApi([found()], [failure('too_many_requests', 429)]).api);
    typeCode('K7PM4Q');
    await click('move-find');
    await click('move-send');
    expect(alertText()).toBe('Too many moves were started today. Try again tomorrow.');
  });

  it('destination_changed sends nothing more: it finds the class again and redraws step 2 from the new preview', async () => {
    const { api, previewTransfer, createTransfer } = makeApi([found(), found('Sunday Class C', 'space:c')], [failure('destination_changed')]);
    const calls = render(api);
    typeCode('K7PM4Q');
    await click('move-find');
    await click('move-send');
    expect(createTransfer).toHaveBeenCalledTimes(1);
    expect(previewTransfer).toHaveBeenCalledTimes(2);
    expect(text(byTestId('move-found'))).toContain('Move to "Sunday Class C"?');
    expect(calls.sent).toEqual([]);
    expect(alertText()).toBeNull();
  });

  it('offline: nothing is sent and the sheet says "This needs internet."', async () => {
    const { api, previewTransfer } = makeApi([found()]);
    render(api, { online: false });
    typeCode('K7PM4Q');
    await click('move-find');
    expect(previewTransfer).not.toHaveBeenCalled();
    expect(alertText()).toBe('This needs internet.');
  });

  it('a network failure reads "This needs internet."; the lock and a sign-out are handed to the page', async () => {
    render(makeApi([{ ok: false, error: 'network', status: -1 }]).api);
    typeCode('K7PM4Q');
    await click('move-find');
    expect(alertText()).toBe('This needs internet.');
    act(() => renderer?.unmount());

    const locked = render(makeApi([failure('transfers_locked', 422, 'invalid')]).api);
    typeCode('K7PM4Q');
    await click('move-find');
    expect(locked.states).toEqual(['locked']);
    act(() => renderer?.unmount());

    const out = render(makeApi([{ ok: false, error: 'unauthorized', status: 401 }]).api);
    typeCode('K7PM4Q');
    await click('move-find');
    expect(out.states).toEqual(['signIn']);
  });

  it('Escape, the close button and Cancel close the sheet', () => {
    const calls = render(makeApi([]).api);
    act(() => {
      root()
        .find((n) => n.props.role === 'dialog')
        .props.onKeyDown({ key: 'Escape', stopPropagation: () => undefined, preventDefault: () => undefined });
    });
    act(() => {
      root()
        .find((n) => n.type === 'button' && n.props['aria-label'] === t.a11y.close)
        .props.onClick();
    });
    act(() => {
      byTestId('move-cancel').props.onClick();
    });
    expect(calls.closed).toBe(3);
  });

  it('busy: Find class reads "Looking…" and is aria-disabled while the preview is out', async () => {
    let resolve: (r: ApiResult<TransferPreview>) => void = () => undefined;
    const api = { previewTransfer: vi.fn(() => new Promise<ApiResult<TransferPreview>>((r) => (resolve = r))), createTransfer: vi.fn() } as unknown as StartMoveApi;
    render(api);
    typeCode('K7PM4Q');
    act(() => {
      byTestId('move-find').props.onClick();
    });
    expect(text(byTestId('move-find'))).toBe('Looking…');
    expect(byTestId('move-find').props['aria-disabled']).toBe(true);
    await act(async () => resolve(found()));
    expect(text(byTestId('move-find'))).toBe('Find class');
  });
});

describe('MoveRowAction (start-sheet.md, the settings learner row)', () => {
  it('carries the learner name in its accessible name and opens the sheet', () => {
    const onMove = vi.fn();
    act(() => {
      renderer = create(<MoveRowAction name="Mina" online onMove={onMove} />);
    });
    const button = byTestId('move-row');
    expect(button.props['aria-label']).toBe('Move Mina to another class');
    expect(text(button)).toBe('Move to another class');
    act(() => button.props.onClick());
    expect(onMove).toHaveBeenCalledTimes(1);
  });

  it('offline: disabled, described by "This needs internet." and keeps its name', () => {
    const onMove = vi.fn();
    act(() => {
      renderer = create(<MoveRowAction name="Mina" online={false} onMove={onMove} />);
    });
    const button = byTestId('move-row');
    expect(button.props.disabled).toBe(true);
    expect(button.props['aria-label']).toBe('Move Mina to another class');
    const help = root().find((n) => n.props.id === button.props['aria-describedby']);
    expect(text(help)).toBe('This needs internet.');
    expect(button.props.onClick).toBeUndefined();
  });
});

describe('the new files hold tokens only (CLAUDE.md section 4; spec 4.8: never feedback.danger)', () => {
  it('TransferParts.tsx has no colour literal and no danger colour', () => {
    const source = readFileSync(new URL('../TransferParts.tsx', import.meta.url), 'utf8');
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/);
    expect(source).not.toContain('colors.feedback.danger');
  });
});
