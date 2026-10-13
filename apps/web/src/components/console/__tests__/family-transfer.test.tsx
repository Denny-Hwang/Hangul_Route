import { readFileSync } from 'node:fs';
import { TRANSFER_CONSENT_TEXT, TRANSFER_CONSENT_TEXT_VERSION } from '@hangul-route/content-schema';
import { getMessages, type UiLocale } from '@hangul-route/i18n';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiResult, TransferLearnerSideView, TransferList, TransferOption } from '@/lib/console/api';
import type { ConsentSheetData } from '@/lib/console/transfer-consent';

/**
 * F-SPACE-002 T-6d (spec 4.8 "Family page", 4.11; design/screens/transfer/family-page.md and consent-sheet.md, the
 * T-0b mockups): the consent sheet's reading rule and language switch, the family cards, Start a move and the switch.
 */
vi.mock('@/lib/i18n/locale-context', async () => {
  const i18n = await import('@hangul-route/i18n');
  const view = () => ({ locale: 'en' as UiLocale, messages: i18n.getMessages('en'), available: ['en'], setLocale: () => undefined });
  return { useConsoleLocale: view, useMessages: () => view().messages, useLocale: () => 'en', useSetLocale: () => () => undefined };
});

import { ConsentSheet, FamilyMoves, FamilyStartFlow, familyFailure, sheetFromView, type FamilyMovesApi } from '@/components/console/FamilyTransferParts';

const t = getMessages('en').console.transfer;
const en = TRANSFER_CONSENT_TEXT.en.lines;

/** A stand-in IntersectionObserver: `intersect()` puts every observed element in view. */
const observers: Array<{ cb: (entries: Array<{ isIntersecting: boolean }>) => void; observed: number }> = [];
function intersect(): void {
  for (const o of observers) if (o.observed > 0) o.cb([{ isIntersecting: true }]);
}

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
beforeEach(() => {
  observers.length = 0;
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      private entry: { cb: (entries: Array<{ isIntersecting: boolean }>) => void; observed: number };
      constructor(cb: (entries: Array<{ isIntersecting: boolean }>) => void) {
        this.entry = { cb, observed: 0 };
        observers.push(this.entry);
      }
      observe(): void {
        this.entry.observed += 1;
      }
      disconnect(): void {
        this.entry.observed = 0;
      }
    },
  );
});

let renderer: ReactTestRenderer | null = null;
afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
  vi.unstubAllGlobals();
});

const nodeMock = { createNodeMock: () => ({}) };
const root = (): ReactTestInstance => (renderer as ReactTestRenderer).root;
const byTestId = (id: string): ReactTestInstance => root().find((n) => n.props['data-testid'] === id && typeof n.type === 'string');
const allTestId = (id: string): ReactTestInstance[] => root().findAll((n) => n.props['data-testid'] === id && typeof n.type === 'string');
const text = (node: ReactTestInstance): string => node.findAll((n) => typeof n.type === 'string').map((n) => n.children.filter((c) => typeof c === 'string').join('')).join(' ');
const lineIds = (): string[] => root().findAll((n) => typeof n.type === 'string' && typeof n.props['data-line'] === 'string').map((n) => n.props['data-line'] as string);

const sheetData = (over: Partial<ConsentSheetData> = {}): ConsentSheetData => ({
  learnerName: 'Mina',
  sourceName: 'Sunday Class A',
  destination: { name: 'Saturday Class B', ownerName: 'Ms Park', schoolName: null, ageBucket: 'months', learnerCount: 8 },
  initiator: 'learner_side',
  terms: { premiumChange: 'none', destinationConsentMode: 'parent', relinkAffected: false, sourcePlansAffected: false, visibleToday: [{ kind: 'class', name: 'Sunday Class A', ownerName: 'Mr Han' }] },
  familyName: 'Kim family',
  ...over,
});

function renderSheet(over: Partial<ConsentSheetData> = {}, props: Partial<{ notNowEnds: boolean; failed: boolean; updated: boolean }> = {}) {
  const calls = { yes: [] as Array<[UiLocale, boolean]>, notNow: 0, close: 0 };
  act(() => {
    renderer = create(
      <ConsentSheet
        data={sheetData(over)}
        initialLocale="en"
        notNowEnds={props.notNowEnds ?? false}
        busy={false}
        failed={props.failed ?? false}
        updated={props.updated ?? false}
        onYes={(l, i) => calls.yes.push([l, i])}
        onNotNow={() => {
          calls.notNow += 1;
        }}
        onClose={() => {
          calls.close += 1;
        }}
      />,
      nodeMock,
    );
  });
  return calls;
}

describe('ConsentSheet (consent-sheet.md; spec 4.11)', () => {
  it('draws every always line in canonical order, the introduce option last; the list of what the teacher sees is open', () => {
    renderSheet();
    expect(lineIds()).toEqual(['moving', 'new_teacher', 'old_teacher', 'keeps', 'cooling_off', 'visible_list', 'nothing_else', 'visible_today', 'typed_names', 'cannot_undo', 'introduce']);
    const sheet = byTestId('consent-sheet');
    expect(text(sheet)).toContain('Mina would move from Sunday Class A to Saturday Class B.');
    expect(text(sheet)).toContain(TRANSFER_CONSENT_TEXT.en.items.level_check);
    expect(text(sheet)).toContain('Sunday Class A (teacher Mr Han)');
    expect(text(sheet)).toContain('Teacher: Ms Park');
    expect(text(sheet)).toContain('A few months old · 8 learners');
    expect(root().findAll((n) => n.type === 'button' && n.props['aria-expanded'] !== undefined)).toHaveLength(0);
  });

  it('draws every applicable conditional line for a teacher-started move, and the Not now line', () => {
    renderSheet({ initiator: 'source', terms: { ...sheetData().terms, premiumChange: 'may_change', destinationConsentMode: 'school', relinkAffected: true, sourcePlansAffected: true } }, { notNowEnds: true });
    expect(lineIds()).toEqual(['moving', 'new_teacher', 'old_teacher', 'keeps', 'cooling_off', 'visible_list', 'nothing_else', 'visible_today', 'typed_names', 'from_teacher', 'premium_may_change', 'school_delete', 'device_relink', 'homework_drops', 'cannot_undo', 'introduce']);
    expect(text(byTestId('consent-sheet'))).toContain(t.lines.notNowEnds);
  });

  it('Yes stays aria-disabled, described by the reading hint, until the end marker has been in view; then it sends the locale and the option', () => {
    const calls = renderSheet();
    const yes = () => byTestId('consent-yes');
    expect(yes().props['aria-disabled']).toBe(true);
    const hint = root().find((n) => n.type === 'p' && n.props.id === yes().props['aria-describedby']);
    expect(text(hint)).toBe(t.consent.readToEnd);
    act(() => yes().props.onClick?.());
    expect(calls.yes).toEqual([]);
    act(() => intersect());
    expect(yes().props['aria-disabled']).toBeUndefined();
    expect(root().findAll((n) => n.type === 'p' && text(n) === t.consent.readToEnd)).toHaveLength(0);
    act(() => root().find((n) => n.type === 'input' && n.props.name === 'introduce').props.onChange({ target: { checked: true } }));
    act(() => yes().props.onClick());
    expect(calls.yes).toEqual([['en', true]]);
  });

  it('the end marker comes right after cannot_undo, and the buttons follow the last line (never sticky)', () => {
    renderSheet();
    const order = root()
      .findAll((n) => typeof n.type === 'string' && (typeof n.props['data-line'] === 'string' || n.props['data-testid'] === 'consent-end' || n.props['data-testid'] === 'consent-yes'))
      .map((n) => (n.props['data-line'] as string | undefined) ?? (n.props['data-testid'] as string));
    expect(order.slice(-4)).toEqual(['cannot_undo', 'consent-end', 'introduce', 'consent-yes']);
    expect(JSON.stringify(byTestId('consent-yes').props.style)).not.toContain('sticky');
  });

  it('switches language: the same ids in Korean and Spanish, and the frame follows', () => {
    const calls = renderSheet();
    const select = () => root().find((n) => n.type === 'select' && n.props.name === 'consentLocale');
    expect(select().findAllByType('option').map((o) => o.props.value)).toEqual(['en', 'es', 'ko']);
    const enIds = lineIds();
    act(() => select().props.onChange({ target: { value: 'ko' } }));
    expect(lineIds()).toEqual(enIds);
    expect(text(byTestId('consent-sheet'))).toContain(TRANSFER_CONSENT_TEXT.ko.lines.cooling_off);
    expect(text(byTestId('consent-sheet'))).toContain(getMessages('ko').console.transfer.consent.language);
    act(() => select().props.onChange({ target: { value: 'es' } }));
    expect(text(byTestId('consent-sheet'))).toContain(TRANSFER_CONSENT_TEXT.es.lines.cooling_off);
    act(() => intersect());
    act(() => byTestId('consent-yes').props.onClick());
    expect(calls.yes).toEqual([['es', false]]);
  });

  it('updated text says so on top; a failed Yes says "Didn\'t go through" and offers Try again; Not now and Escape answer', () => {
    const calls = renderSheet({}, { updated: true, failed: true });
    expect(text(byTestId('consent-updated'))).toBe(t.consent.updated);
    expect(text(root().find((n) => n.props.role === 'alert'))).toBe(t.consent.failed);
    expect(text(byTestId('consent-yes'))).toBe(t.consent.tryAgain.cta);
    act(() => byTestId('consent-not-now').props.onClick());
    expect(calls.notNow).toBe(1);
    act(() => root().find((n) => n.props.role === 'dialog').props.onKeyDown({ key: 'Escape', stopPropagation: () => undefined }));
    expect(calls.close).toBe(1);
  });

  it('without IntersectionObserver the rule cannot be measured and Yes is not held back', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    renderSheet();
    expect(byTestId('consent-yes').props['aria-disabled']).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------

function view(over: Partial<TransferLearnerSideView> = {}): TransferLearnerSideView {
  return {
    id: 'transfer:f1',
    role: 'learner_side',
    status: 'requested',
    initiator: 'source',
    learner: { id: 'profile:mina', name: 'Mina' },
    from: { spaceId: 'space:a', name: 'Sunday Class A' },
    to: { spaceId: 'space:b', name: 'Saturday Class B', ownerName: 'Ms Park', schoolName: null, ageBucket: 'months', learnerCount: 8 },
    learnerState: 'pending',
    sourceState: 'yes',
    destinationState: 'waiting',
    introduce: false,
    premiumChange: 'none',
    destinationConsentMode: 'parent',
    relinkAffected: false,
    sourcePlansAffected: false,
    visibleToday: [],
    blockReason: null,
    executeAfter: null,
    createdAt: new Date(Date.now() - 86_400_000).toISOString(),
    expiresAt: '2099-01-01T00:00:00.000Z',
    executedAt: null,
    endedAt: null,
    learnerRoute: 'caregiver',
    endedFrom: null,
    termsDigest: 'b'.repeat(64),
    ...over,
  };
}

const mina: TransferOption = { learnerId: 'profile:mina', name: 'Mina', classes: [{ spaceId: 'space:a', name: 'Sunday Class A' }], selfManaged: false, blockTeacherRequests: false };
const grace: TransferOption = { learnerId: 'profile:grace', name: 'Grace', classes: [{ spaceId: 'space:c', name: 'Evening Class C' }], selfManaged: true, blockTeacherRequests: false };

const fail = (code: string, status = 409): ApiResult<never> => ({ ok: false, error: 'unknown', status, code });
const okList = (requests: TransferLearnerSideView[], options: TransferOption[] = [mina]): ApiResult<TransferList> => ({ ok: true, data: { requests, options } });
const learnerPreview = {
  ok: true as const,
  data: {
    destination: { id: 'space:b', kind: 'class' as const, name: 'Saturday Class B', ownerName: 'Ms Park', schoolName: null, ageBucket: 'weeks', learnerCount: 3 },
    termsDigest: 'c'.repeat(64),
    premiumChange: 'none' as const,
    destinationConsentMode: 'parent' as const,
    relinkAffected: false,
    sourcePlansAffected: false,
    visibleToday: [],
  },
};

function makeApi(lists: ApiResult<TransferList>[]) {
  const api = {
    transferRequests: vi.fn(async () => (lists.length > 1 ? (lists.shift() as ApiResult<TransferList>) : (lists[0] as ApiResult<TransferList>))),
    previewTransfer: vi.fn(async () => learnerPreview as ApiResult<never>),
    createTransfer: vi.fn(async () => ({ ok: true, data: view({ initiator: 'learner_side', learnerState: 'consented' }) }) as ApiResult<never>),
    approveTransfer: vi.fn(async () => ({ ok: true, data: view({ learnerState: 'consented' }) }) as ApiResult<never>),
    declineTransfer: vi.fn(async () => ({ ok: true, data: view({ status: 'ended' }) }) as ApiResult<never>),
    cancelTransfer: vi.fn(async () => ({ ok: true, data: view({ status: 'ended' }) }) as ApiResult<never>),
    setTransferPrefs: vi.fn(async () => ({ ok: true, data: { blockTeacherRequests: true, selfManaged: false } }) as ApiResult<never>),
  };
  return api;
}

async function renderPage(api: ReturnType<typeof makeApi>) {
  const states: string[] = [];
  await act(async () => {
    renderer = create(<FamilyMoves familyId="space:f" familyName="Kim family" api={api as unknown as FamilyMovesApi} online refreshMs={60_000} onPageState={(s) => states.push(s)} />, nodeMock);
  });
  await act(async () => undefined);
  return states;
}

const click = async (id: string, i = 0): Promise<void> => {
  await act(async () => {
    allTestId(id)[i]?.props.onClick();
  });
};

describe('FamilyMoves (family-page.md)', () => {
  it('a teacher-asked card: route, named steps, Review and agree, Not now with its line; empty Start panel picks the learner', async () => {
    await renderPage(makeApi([okList([view()])]));
    const card = byTestId('family-move-card');
    expect(text(card)).toContain('Asked by the teacher of Sunday Class A · 1 day ago');
    expect(text(card)).toContain('Sunday Class A');
    expect(text(card)).toContain('Family waiting');
    expect(text(card)).toContain(t.lines.notNowEnds);
    expect(allTestId('family-review')).toHaveLength(1);
    const notNow = byTestId('family-not-now');
    expect(root().find((n) => n.props.id === notNow.props['aria-describedby'] && n.type === 'p').children.join('')).toBe(t.lines.notNowEnds);
  });

  it('Review and agree opens the sheet; Yes approves the learner slot with the record and the view digest', async () => {
    const api = makeApi([okList([view()])]);
    await renderPage(api);
    await click('family-review');
    expect(allTestId('consent-sheet')).toHaveLength(1);
    expect(lineIds()).toContain('from_teacher');
    act(() => intersect());
    await click('consent-yes');
    expect(api.approveTransfer).toHaveBeenCalledWith('space:f', 'transfer:f1', { slots: ['learner'], consent: { textVersion: TRANSFER_CONSENT_TEXT_VERSION, locale: 'en', termsDigest: 'b'.repeat(64) }, introduce: false });
    expect(allTestId('consent-sheet')).toHaveLength(0);
  });

  it('terms_changed reloads and reopens the sheet with the updated line; family_too_new closes it to the notice and hides the answer', async () => {
    const api = makeApi([okList([view()])]);
    api.approveTransfer.mockResolvedValueOnce(fail('terms_changed') as never);
    await renderPage(api);
    await click('family-review');
    act(() => intersect());
    await click('consent-yes');
    expect(allTestId('consent-updated')).toHaveLength(1);
    api.approveTransfer.mockResolvedValueOnce(fail('family_too_new', 422) as never);
    act(() => intersect());
    await click('consent-yes');
    expect(allTestId('consent-sheet')).toHaveLength(0);
    expect(text(root())).toContain(t.states.familyTooNew);
    expect(allTestId('family-review')).toHaveLength(0);
    expect(allTestId('family-not-now')).toHaveLength(1);
  });

  it('a failed Yes keeps the sheet with Try again', async () => {
    const api = makeApi([okList([view()])]);
    api.approveTransfer.mockResolvedValueOnce({ ok: false, error: 'network', status: -1 } as never);
    await renderPage(api);
    await click('family-review');
    act(() => intersect());
    await click('consent-yes');
    expect(text(byTestId('consent-yes'))).toBe(t.consent.tryAgain.cta);
  });

  it('Not now on a card declines the learner slot; Not now in a teacher-started sheet does too', async () => {
    const api = makeApi([okList([view()])]);
    await renderPage(api);
    await click('family-not-now');
    expect(api.declineTransfer).toHaveBeenCalledWith('space:f', 'transfer:f1', { slot: 'learner' });
    await click('family-review');
    await click('consent-not-now');
    expect(api.declineTransfer).toHaveBeenCalledTimes(2);
  });

  it('after yes: waiting line and Cancel; planned; moved with the tablet line; ended history with the tablet line; empty', async () => {
    const consented = view({ learnerState: 'consented', executeAfter: '2026-10-14T12:00:00.000Z' });
    const api = makeApi([
      okList([
        consented,
        view({ id: 'transfer:2', status: 'approved', learnerState: 'consented', executeAfter: '2026-10-14T12:00:00.000Z' }),
        view({ id: 'transfer:3', status: 'executed', relinkAffected: true }),
        view({ id: 'transfer:4', status: 'ended', endedAt: '2026-10-10T00:00:00.000Z', endedFrom: 'device' }),
      ]),
    ]);
    await renderPage(api);
    const body = text(root());
    expect(body).toContain('Waiting for the other class. The move happens after Oct 14 if it says yes. You can cancel any time.');
    expect(body).toContain('A move is planned for Oct 14.');
    expect(body).toContain('Moved. Mina is now in Saturday Class B. Cards and stars stayed with Mina.');
    expect(body).toContain(t.lines.movedTablet('Sunday Class A'));
    expect(text(byTestId('family-history-row'))).toContain(`${t.history.ended} ${t.history.endedFromTablet('Mina')}`);
    expect(allTestId('family-cancel')).toHaveLength(2);
    await click('family-cancel');
    expect(api.cancelTransfer).toHaveBeenCalledWith('space:f', 'transfer:f1');
    act(() => renderer?.unmount());
    renderer = null;
    await renderPage(makeApi([okList([], [])]));
    expect(text(root())).toContain(t.empty);
    expect(text(root())).toContain(t.start.noLearner);
  });

  it('Start a move: Find class previews with the class picked, the sheet opens, Yes creates with the consent record', async () => {
    const api = makeApi([okList([], [mina, grace])]);
    await renderPage(api);
    act(() => root().find((n) => n.type === 'input' && n.props.name === 'classCode').props.onChange({ target: { value: 'k7pm4q' } }));
    await click('family-find');
    expect(api.previewTransfer).toHaveBeenCalledWith('space:f', { learnerId: 'profile:mina', code: 'K7PM4Q', fromSpaceId: 'space:a' });
    expect(allTestId('consent-sheet')).toHaveLength(1);
    expect(text(byTestId('consent-sheet'))).toContain('A few weeks old · 3 learners');
    act(() => intersect());
    await click('consent-yes');
    expect(api.createTransfer).toHaveBeenCalledWith('space:f', {
      learnerId: 'profile:mina',
      destinationSpaceId: 'space:b',
      code: 'K7PM4Q',
      fromSpaceId: 'space:a',
      introduce: false,
      consent: { textVersion: TRANSFER_CONSENT_TEXT_VERSION, locale: 'en', termsDigest: 'c'.repeat(64) },
    });
    expect(text(root())).toContain(t.start.sent);
  });

  it('Start a move: a self-managed learner reads the line, no code field; an answer line sits under the field', async () => {
    const api = makeApi([okList([], [mina, grace])]);
    api.previewTransfer.mockResolvedValueOnce(fail('cooldown', 429) as never);
    await renderPage(api);
    act(() => root().find((n) => n.type === 'input' && n.props.name === 'classCode').props.onChange({ target: { value: 'K7PM4Q' } }));
    await click('family-find');
    expect(text(root().find((n) => n.props.role === 'alert'))).toBe(t.errors.cooldown);
    act(() => root().find((n) => n.type === 'select' && n.props.name === 'moveLearner').props.onChange({ target: { value: 'profile:grace' } }));
    expect(text(root())).toContain(t.lines.manageOwn('Grace'));
    expect(root().findAll((n) => n.type === 'input' && n.props.name === 'classCode')).toHaveLength(0);
  });

  it('Start a move: terms_changed at create finds the class again and reopens the sheet marked updated', async () => {
    const api = makeApi([okList([], [mina])]);
    api.createTransfer.mockResolvedValueOnce(fail('terms_changed') as never);
    await renderPage(api);
    act(() => root().find((n) => n.type === 'input' && n.props.name === 'classCode').props.onChange({ target: { value: 'K7PM4Q' } }));
    await click('family-find');
    act(() => intersect());
    await click('consent-yes');
    expect(api.previewTransfer).toHaveBeenCalledTimes(2);
    expect(allTestId('consent-updated')).toHaveLength(1);
  });

  it('the teacher-requests switch: one row per learner, named; a self-managed learner has the line, no switch', async () => {
    const api = makeApi([okList([], [mina, grace])]);
    await renderPage(api);
    const rows = allTestId('teacher-requests-row');
    expect(rows).toHaveLength(2);
    const box = rows[0]?.find((n) => n.type === 'input');
    expect(text(root().find((n) => n.props.id === box?.props['aria-describedby'] && n.type === 'p'))).toBe('Mina');
    expect(rows[1]?.findAll((n) => n.type === 'input')).toHaveLength(0);
    await act(async () => box?.props.onChange({ target: { checked: true } }));
    expect(api.setTransferPrefs).toHaveBeenCalledWith('space:f', 'profile:mina', { blockTeacherRequests: true });
  });

  it('page states: a 401, a lost role and the lock go to the page; any other failure says so; loading has no words', async () => {
    const states = await renderPage(makeApi([{ ok: false, error: 'unauthorized', status: 401 }]));
    expect(states).toEqual(['signIn']);
    act(() => renderer?.unmount());
    const locked = await renderPage(makeApi([fail('transfers_locked', 422)]));
    expect(locked).toEqual(['locked']);
    act(() => renderer?.unmount());
    await renderPage(makeApi([fail('boom', 500)]));
    expect(text(byTestId('family-moves-loading')).trim()).toBe(t.states.failed);
  });

  it('a changed list is announced once through the polite region', async () => {
    vi.useFakeTimers();
    try {
      const api = makeApi([okList([view()]), okList([view({ learnerState: 'consented' })])]);
      await act(async () => {
        renderer = create(<FamilyMoves familyId="space:f" familyName="Kim family" api={api as unknown as FamilyMovesApi} online refreshMs={1000} onPageState={() => undefined} />, nodeMock);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
      expect(text(root().find((n) => n.props['aria-live'] === 'polite'))).toBe(t.a11y.updated);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('helpers', () => {
  it('familyFailure: pages, notices, refind (incl. a stale text) and lines', () => {
    expect(familyFailure({ ok: true, data: 1 })).toBeNull();
    expect(familyFailure(fail('transfers_locked', 422))).toEqual({ kind: 'page', state: 'locked' });
    expect(familyFailure(fail('consent_text_stale', 422))).toEqual({ kind: 'refind' });
    expect(familyFailure(fail('conflicted_guardian'))).toEqual({ kind: 'notice', notice: 'conflicted' });
    expect(familyFailure(fail('cooldown', 429))).toEqual({ kind: 'line', err: { kind: 'line', key: 'cooldown' } });
  });

  it('sheetFromView carries the view terms and the family name', () => {
    expect(sheetFromView(view({ relinkAffected: true }), 'Kim family')).toMatchObject({ learnerName: 'Mina', sourceName: 'Sunday Class A', initiator: 'source', familyName: 'Kim family', terms: { relinkAffected: true } });
  });

  it('FamilyStartFlow with a preselected learner draws no learner select', async () => {
    await act(async () => {
      renderer = create(
        <FamilyStartFlow
          familyId="space:f"
          familyName="Kim family"
          options={[mina]}
          api={makeApi([okList([])]) as never}
          online={false}
          preselect={{ learnerId: 'profile:mina' }}
          answersHidden={false}
          onCreated={() => undefined}
          onPageState={() => undefined}
          onNotice={() => undefined}
        />,
        nodeMock,
      );
    });
    expect(root().findAll((n) => n.type === 'select' && n.props.name === 'moveLearner')).toHaveLength(0);
    act(() => root().find((n) => n.type === 'input' && n.props.name === 'classCode').props.onChange({ target: { value: 'K7PM4Q' } }));
    await click('family-find');
    expect(text(root().find((n) => n.props.role === 'alert'))).toBe(t.states.offline);
  });

  it('the new files hold tokens only and never the danger colour', () => {
    for (const file of ['../FamilyTransferParts.tsx', '../../../app/(console)/teach/space/transfers/page.tsx']) {
      const source = readFileSync(new URL(file, import.meta.url), 'utf8');
      expect(source, file).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/);
      expect(source, file).not.toContain('feedback.danger');
    }
    expect(en.moving).toContain('{learner}');
  });
});
