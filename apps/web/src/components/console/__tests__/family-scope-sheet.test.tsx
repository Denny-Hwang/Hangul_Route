import { CLASS_SCOPE_LINE_IDS, CLASS_SCOPE_TEXT, classScopeItems } from '@hangul-route/content-schema';
import { getMessages, type UiLocale } from '@hangul-route/i18n';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ApiResult } from '@/lib/console/api';
import type { ClassScopeState } from '@/lib/console/class-moves';

/**
 * AMENDMENTS-GROWNUP-UX section 7.3, row GX-5b (on by default since GX-OD-3 yes, 2026-11-07; `NEXT_PUBLIC_FAMILY_SCOPE_SHEET=false` is the kill switch):
 * the class-scope text in a sheet. Every `CLASS_SCOPE_TEXT` line verbatim, its list always open, OK writes the
 * acknowledgement as the shipped card does, and while unread the sheet never closes on a backdrop tap (Close is a button).
 */
const lang = { locale: 'en' as UiLocale };
vi.mock('@/lib/i18n/locale-context', async () => {
  const i18n = await import('@hangul-route/i18n');
  const view = () => ({ locale: lang.locale, messages: i18n.getMessages(lang.locale), available: ['en', 'es', 'ko'], setLocale: () => undefined });
  return { useConsoleLocale: view, useMessages: () => view().messages, useLocale: () => lang.locale, useSetLocale: () => () => undefined };
});

import { FamilyScopeSheet, type FamilyClassCardsApi } from '@/components/console/FamilyClassCards';
import { TransferSheet } from '@/components/console/TransferParts';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let renderer: ReactTestRenderer | null = null;
afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
  lang.locale = 'en';
});

const root = (): ReactTestInstance => (renderer as ReactTestRenderer).root;
const all = (id: string): ReactTestInstance[] => root().findAll((n) => n.props['data-testid'] === id && typeof n.type === 'string');
const textOf = (n: ReactTestInstance): string => n.children.map((child) => (typeof child === 'string' ? child : textOf(child))).join('');
const scrim = (): ReactTestInstance => root().find((n) => typeof n.type === 'string' && n.props.className === 'hr-move-scrim');
const closeButton = (): ReactTestInstance => root().find((n) => n.type === 'button' && typeof n.props['aria-label'] === 'string');

const SCOPE: ClassScopeState = { current: 'class-scope-2026-10', learners: [{ learnerId: 'profile:jun', name: 'Jun', needed: true }] };

function mount(over: { api?: Partial<FamilyClassCardsApi>; scope?: ClassScopeState } = {}) {
  const calls: string[] = [];
  const spies = { onScope: vi.fn(), onStale: vi.fn(), onClose: vi.fn(), onDone: vi.fn() };
  const api: FamilyClassCardsApi = {
    acknowledgeClassScope: async (familyId, learnerId, version): Promise<ApiResult<{ version: string; ackedAt: string }>> => {
      calls.push(`ack:${familyId}:${learnerId}:${version}`);
      return { ok: true, data: { version, ackedAt: '2026-10-31T12:00:00.000Z' } };
    },
    ...over.api,
  };
  act(() => {
    renderer = create(<FamilyScopeSheet familyId="space:kim" learnerId="profile:jun" api={api} scope={over.scope ?? SCOPE} {...spies} />);
  });
  return { calls, ...spies };
}

describe('the class-scope sheet (GX-5b)', () => {
  for (const locale of ['en', 'es', 'ko'] as const) {
    it(`${locale}: shows every CLASS_SCOPE_TEXT line verbatim, the list open, under the shipped title, in the text's language`, () => {
      lang.locale = locale;
      mount();
      const sheet = all('class-scope-sheet')[0] as ReactTestInstance;
      expect(sheet.props.role).toBe('dialog');
      expect(sheet.props.lang).toBe(locale);
      expect(textOf(root().find((n) => n.type === 'h2'))).toBe(getMessages(locale).console.classScope.title('Jun'));
      const text = CLASS_SCOPE_TEXT[locale];
      const lines = sheet.findAll((n) => typeof n.type === 'string' && typeof n.props['data-line'] === 'string').map((n) => n.props['data-line'] as string);
      expect(lines).toEqual([...CLASS_SCOPE_LINE_IDS]);
      for (const id of CLASS_SCOPE_LINE_IDS) {
        const node = sheet.find((n) => typeof n.type === 'string' && n.props['data-line'] === id);
        const expected = id === 'list' ? text.lines.list : text.lines[id].split('{learner}').join('Jun');
        expect(textOf(node)).toContain(expected);
      }
      // The list is a plain list, always open: no disclosure, every item drawn.
      expect(sheet.findAll((n) => n.type === 'details')).toHaveLength(0);
      const items = sheet.findAll((n) => n.type === 'li').map(textOf);
      expect(items).toEqual(classScopeItems(locale).map((item) => item.text.split('{learner}').join('Jun')));
      expect(textOf(all('class-scope-ok')[0] as ReactTestInstance)).toBe(getMessages(locale).common.buttons.ok);
    });
  }

  it('cannot be closed by a backdrop tap while unread; Close is a button', () => {
    const spies = mount();
    act(() => scrim().props.onClick?.());
    expect(spies.onClose).not.toHaveBeenCalled();
    expect(all('class-scope-sheet')).toHaveLength(1);
    expect(closeButton().props['aria-label']).toBe(getMessages('en').console.transfer.a11y.close);
    act(() => closeButton().props.onClick());
    expect(spies.onClose).toHaveBeenCalledTimes(1);
    expect(spies.onScope).not.toHaveBeenCalled();
  });

  it('OK writes the acknowledgement at the current version, marks the learner read and hands back the name', async () => {
    const spies = mount();
    await act(async () => (all('class-scope-ok')[0] as ReactTestInstance).props.onClick());
    expect(spies.calls).toEqual(['ack:space:kim:profile:jun:class-scope-2026-10']);
    expect(spies.onScope).toHaveBeenCalledWith({ current: 'class-scope-2026-10', learners: [{ learnerId: 'profile:jun', name: 'Jun', needed: false }] });
    expect(spies.onDone).toHaveBeenCalledWith('Jun');
  });

  it('a stale version reads again and keeps the sheet; a failed write says so and keeps the sheet', async () => {
    let answer: ApiResult<{ version: string; ackedAt: string }> = { ok: false, error: 'unknown', status: 409, code: 'class_scope_stale' };
    const spies = mount({ api: { acknowledgeClassScope: async () => answer } });
    await act(async () => (all('class-scope-ok')[0] as ReactTestInstance).props.onClick());
    expect(spies.onStale).toHaveBeenCalledTimes(1);
    expect(spies.onDone).not.toHaveBeenCalled();
    answer = { ok: false, error: 'network', status: -1 };
    await act(async () => (all('class-scope-ok')[0] as ReactTestInstance).props.onClick());
    const alert = root().find((n) => n.props.role === 'alert');
    expect(textOf(alert)).toBe(getMessages('en').console.classScope.failed);
    expect(spies.onDone).not.toHaveBeenCalled();
    expect(all('class-scope-sheet')).toHaveLength(1);
  });

  it('draws nothing for a learner the read does not list', () => {
    mount({ scope: { current: 'class-scope-2026-10', learners: [] } });
    expect(all('class-scope-sheet')).toHaveLength(0);
  });
});

describe('TransferSheet backdrop', () => {
  it('closes on a backdrop tap by default (every shipped sheet keeps that)', () => {
    const onClose = vi.fn();
    act(() => {
      renderer = create(
        <TransferSheet title="Needs you" onClose={onClose}>
          <p>x</p>
        </TransferSheet>,
      );
    });
    act(() => scrim().props.onClick?.());
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
