import { readFileSync } from 'node:fs';
import { colors } from '@hangul-route/design-system/tokens';
import type { UiLocale } from '@hangul-route/i18n';
import type { ReactNode } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TransferSourceView } from '@/lib/console/api';
import type { IncomingItem, OutgoingItem } from '@/lib/console/learner-status';

/**
 * AMENDMENTS-GROWNUP-UX GX-2 sections 5.1 and 5.2 (owner request 2026-10-31): the attention banner (a polite status region
 * whose text changes only with a count, only the non-zero parts) and the review sheet (sections only when non-empty,
 * moves out listed by view whether or not a card matches, Accept first, results in the sheet's own live region, a row's
 * result kept 5 s, and an empty state that stays open with focus on Close). Rendered with react-test-renderer (no DOM).
 */
const lang = { locale: 'en' as UiLocale };
vi.mock('@/lib/i18n/locale-context', async () => {
  const i18n = await import('@hangul-route/i18n');
  const view = () => ({ locale: lang.locale, messages: i18n.getMessages(lang.locale), available: ['en', 'es', 'ko'], setLocale: () => undefined });
  return { useConsoleLocale: view, useMessages: () => view().messages, useLocale: () => lang.locale, useSetLocale: () => () => undefined };
});
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { AttentionBanner, ReviewSheet, sameCounts, sheetKey, withHeld, type ReviewSheetProps } from '@/components/console/AttentionParts';
import { DECIDED_HOLD_MS } from '@/components/console/LearnerStatusParts';

const NOW = new Date('2026-10-31T12:00:00.000Z');
const at = (minutes: number): string => new Date(NOW.getTime() + minutes * 60_000).toISOString();

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
const keyListeners = new Set<(e: { key: string; shiftKey: boolean; preventDefault: () => void }) => void>();
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
  vi.setSystemTime(NOW);
  vi.stubGlobal('document', {
    activeElement: null,
    body: {},
    addEventListener: (type: string, l: never) => {
      if (type === 'keydown') keyListeners.add(l);
    },
    removeEventListener: (type: string, l: never) => {
      if (type === 'keydown') keyListeners.delete(l);
    },
  });
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

function textOf(node: ReactTestInstance | string): string {
  if (typeof node === 'string') return node;
  return node.children.map((child) => textOf(child)).join('');
}
const root = (): ReactTestInstance => (renderer as ReactTestRenderer).root;
const byTestId = (id: string): ReactTestInstance[] => root().findAll((n) => typeof n.type === 'string' && n.props['data-testid'] === id);
const press = async (node: ReactTestInstance): Promise<void> => {
  await act(async () => (node.props.onClick as () => void)());
};

describe('AttentionBanner (section 5.1)', () => {
  async function banner(relinks: number, moves: number, onReview = vi.fn()): Promise<typeof onReview> {
    await act(async () => {
      renderer = create(<AttentionBanner relinks={relinks} moves={moves} onReview={onReview} />);
    });
    return onReview;
  }

  it('a polite status region: the total, then only the non-zero parts; Review now opens the sheet', async () => {
    const onReview = await banner(1, 2);
    const region = root().find((n) => n.props.role === 'status');
    expect(region.props['aria-live']).toBe('polite');
    expect(textOf(region)).toBe('3 requests need your OK1 new device · 2 class moves');
    const button = byTestId('attention-review-now')[0] as ReactTestInstance;
    expect(textOf(button)).toBe('Review now');
    await press(button);
    expect(onReview).toHaveBeenCalledTimes(1);
    act(() => renderer?.unmount());
    await banner(0, 1);
    expect(textOf(byTestId('attention-banner-parts')[0] as ReactTestInstance)).toBe('1 class move');
    expect(textOf(root().find((n) => n.props.role === 'status'))).toContain('1 request needs your OK');
  });

  it('is gone at 0, amber bar and fill only, text in text.primary, never the danger colour', async () => {
    await banner(0, 0);
    expect(byTestId('attention-banner')).toEqual([]);
    expect(byTestId('attention-review-now')).toEqual([]);
    act(() => renderer?.unmount());
    await banner(2, 0);
    const style = (byTestId('attention-banner')[0] as ReactTestInstance).props.style;
    expect(style.backgroundColor).toBe(colors.feedback.nudgeLight);
    expect(style.borderInlineStart).toContain(colors.feedback.nudge);
    expect(style.color).toBe(colors.text.primary);
    expect(JSON.stringify(style)).not.toContain(colors.feedback.danger);
  });

  it('keeps its status region mounted (empty) at 0, so the first request after none is announced into it', async () => {
    await act(async () => {
      renderer = create(<AttentionBanner relinks={0} moves={0} onReview={() => undefined} />);
    });
    const idle = root().find((n) => n.props.role === 'status');
    expect(idle.props['aria-live']).toBe('polite');
    expect(textOf(idle)).toBe('');
    await act(async () => renderer?.update(<AttentionBanner relinks={1} moves={0} onReview={() => undefined} />));
    // The same region instance now holds the words (not a new region inserted with them).
    expect(root().find((n) => n.props.role === 'status')).toBe(idle);
    expect(textOf(idle)).toBe('1 request needs your OK1 new device');
    expect(byTestId('attention-banner')).toHaveLength(1);
  });

  it('re-renders only when a count changes (a 20 s read does not repeat the announcement)', () => {
    const onReview = (): void => undefined;
    expect(sameCounts({ relinks: 1, moves: 2 }, { relinks: 1, moves: 2 })).toBe(true);
    expect(sameCounts({ relinks: 1, moves: 2 }, { relinks: 2, moves: 2 })).toBe(false);
    const compare = (AttentionBanner as unknown as { compare: (a: unknown, b: unknown) => boolean }).compare;
    expect(compare({ relinks: 1, moves: 2, onReview }, { relinks: 1, moves: 2, onReview })).toBe(true);
    expect(compare({ relinks: 1, moves: 2, onReview }, { relinks: 1, moves: 3, onReview })).toBe(false);
  });

  it('ko and es', async () => {
    lang.locale = 'ko';
    await banner(1, 2);
    expect(textOf(root().find((n) => n.props.role === 'status'))).toBe('승인을 기다리는 요청 3건새 기기 1건 · 반 이동 2건');
    expect(textOf(byTestId('attention-review-now')[0] as ReactTestInstance)).toBe('지금 확인');
    act(() => renderer?.unmount());
    lang.locale = 'es';
    await banner(1, 2);
    expect(textOf(root().find((n) => n.props.role === 'status'))).toBe('3 solicitudes esperan tu aprobación1 dispositivo nuevo · 2 cambios de clase');
    expect(textOf(byTestId('attention-review-now')[0] as ReactTestInstance)).toBe('Revisar ahora');
  });
});

describe('withHeld', () => {
  it('keeps an answered row at the place it had, and adds nothing twice', () => {
    const current = [{ key: 'a', item: 1 }, { key: 'c', item: 3 }];
    expect(withHeld(current, [{ key: 'b' }], ['a', 'b', 'c']).map((r) => r.key)).toEqual(['a', 'b', 'c']);
    expect(withHeld(current, [{ key: 'a' }], ['a', 'c']).map((r) => r.key)).toEqual(['a', 'c']);
    expect(withHeld([], [{ key: 'z' }], []).map((r) => [r.key, r.item])).toEqual([['z', null]]);
  });
});

describe('ReviewSheet (section 5.2)', () => {
  const device = { id: 'relink:jaehan', learnerId: 'profile:jaehan', name: 'Jaehan', avatar: 'tiger', expiresAt: at(7.5) };
  const incoming: IncomingItem = { source: 'teacher', id: 'move:in1', alias: 'J. K.', avatar: 'rabbit', level: '5-7', from: 'Class C', expiresAt: null, createdAt: at(-60) };
  const sourceView: TransferSourceView = {
    id: 'transfer:out1',
    role: 'source',
    status: 'requested',
    initiator: 'learner_side',
    steps: { learner: 'yes', source: 'waiting', destination: 'waiting' },
    agreedBySchoolAdmin: false,
    scheduledFor: null,
    blockReason: null,
    createdAt: at(-60 * 24),
    expiresAt: at(60 * 24 * 12),
    executedAt: null,
    endedAt: null,
    endedByYou: false,
    endReason: null,
    learnerId: null,
    learner: { name: 'Suji', avatar: 'bear' },
    destination: { spaceId: 'space:d', name: 'Evening Class D' },
  } as unknown as TransferSourceView;
  const outgoing: OutgoingItem = { source: 'transfer', id: 'transfer:out1', learnerId: null, name: 'Suji', avatar: 'bear', to: 'Evening Class D', expiresAt: at(60 * 24 * 12) };

  const api = () => ({
    decideRelink: vi.fn(async () => ({ ok: true as const, data: {} })),
    acceptClassMove: vi.fn(async () => ({ ok: true as const, data: {} })),
    declineClassMove: vi.fn(async () => ({ ok: true as const, data: {} })),
    approveTransfer: vi.fn(async () => ({ ok: true as const, data: {} })),
    declineTransfer: vi.fn(async () => ({ ok: true as const, data: {} })),
    transferRequests: vi.fn(),
    cancelTransfer: vi.fn(),
    retryTransfer: vi.fn(),
    regenerateCode: vi.fn(),
  });
  const focused: string[] = [];
  const nodeMock = (el: { type: unknown; props: Record<string, unknown> }) => ({
    focus: () => focused.push(String(el.props['data-testid'] ?? el.props['data-sheet-key'] ?? el.type)),
    scrollIntoView: () => undefined,
    querySelector: (selector: string) => ({ focus: () => focused.push(selector), scrollIntoView: () => undefined }),
    querySelectorAll: () => [],
    contains: () => false,
  });

  function props(over: Partial<ReviewSheetProps> = {}): ReviewSheetProps {
    return {
      spaceId: 'space:a',
      api: api() as never,
      online: true,
      readOnly: false,
      devices: [device],
      incoming: [incoming],
      outgoing: [{ item: outgoing, view: sourceView }],
      familyMoves: [],
      direct: new Set(),
      focusKey: null,
      now: NOW,
      onClose: vi.fn(),
      onDecided: vi.fn(),
      ...over,
    };
  }
  async function open(p: ReviewSheetProps): Promise<ReviewSheetProps> {
    focused.length = 0;
    await act(async () => {
      renderer = create(<ReviewSheet {...p} />, { createNodeMock: nodeMock as never });
    });
    return p;
  }

  it('a modal dialog titled Needs your OK; three sections in order, each with its own heading; focus on the title', async () => {
    await open(props());
    const dialog = byTestId('attention-sheet')[0] as ReactTestInstance;
    expect(dialog.props.role).toBe('dialog');
    expect(dialog.props['aria-modal']).toBe('true');
    expect(textOf(root().find((n) => n.props.id === dialog.props['aria-labelledby']))).toBe('Needs your OK');
    expect(focused[0]).toBe('h2');
    const sections = dialog.findAll((n) => n.type === 'section').map((s) => textOf(s.find((h) => h.type === 'h3')));
    expect(sections).toEqual(['New devices', 'Asking to join this class', 'Moves out of this class']);
    expect(textOf(byTestId('sheet-device-row')[0] as ReactTestInstance)).toContain('New device · 8 min left');
    // Accept first in the sheet too, and no chip: the title already says what every row needs.
    const card = byTestId('incoming-card')[0] as ReactTestInstance;
    expect(card.findAll((n) => n.type === 'button').map((b) => b.props['data-testid'])).toEqual(['incoming-accept', 'incoming-not-now']);
    expect(textOf(card)).toContain('From Class C');
  });

  it('sections only when non-empty', async () => {
    await open(props({ incoming: [], outgoing: [] }));
    expect(byTestId('sheet-devices')).toHaveLength(1);
    expect(byTestId('sheet-incoming')).toEqual([]);
    expect(byTestId('sheet-outgoing')).toEqual([]);
  });

  it('a move out is listed by its view though no card matches it (learnerId null); Review shows the shipped consent card', async () => {
    const p = await open(props());
    const row = byTestId('sheet-outgoing-row')[0] as ReactTestInstance;
    expect(textOf(row)).toContain('Suji');
    expect(textOf(row)).toContain('Class move: Evening Class D');
    await press(row.find((n) => n.type === 'button' && n.props['data-testid'] === 'sheet-outgoing-review'));
    const consent = byTestId('sheet-consent')[0] as ReactTestInstance;
    const agree = consent.find((n) => n.type === 'button' && n.props['data-testid'] === 'move-agree');
    expect(textOf(agree)).toBe('Agree');
    await press(agree);
    expect((p.api as unknown as ReturnType<typeof api>).approveTransfer).toHaveBeenCalledWith('space:a', 'transfer:out1', { slots: ['source'] });
    expect(p.onDecided).toHaveBeenCalledWith({ learnerId: null, text: 'Class moves updated.' });
  });

  it('Approve on a device opens the re-link dialog over the sheet (GX-D12); only its Approve decides; Later goes back to the sheet', async () => {
    const p = await open(props());
    await press(byTestId('sheet-device-approve')[0] as ReactTestInstance);
    expect((p.api as unknown as ReturnType<typeof api>).decideRelink).not.toHaveBeenCalled();
    const dialog = byTestId('relink-popup')[0] as ReactTestInstance;
    expect(dialog.props.role).toBe('alertdialog');
    expect(textOf(dialog)).toContain('New device request: Jaehan');
    expect(textOf(byTestId('relink-popup-hint')[0] as ReactTestInstance)).toContain('Approve only if');
    await press(byTestId('relink-popup-later')[0] as ReactTestInstance);
    expect(byTestId('relink-popup')).toEqual([]);
    expect(byTestId('attention-sheet')).toHaveLength(1);
    expect(p.onClose).not.toHaveBeenCalled();
  });

  it('a decided row keeps its result line 5 s and the sheet says it in its own polite region; the page reads again', async () => {
    const p = await open(props());
    await press(byTestId('sheet-device-approve')[0] as ReactTestInstance);
    await press(byTestId('relink-popup-approve')[0] as ReactTestInstance);
    expect(byTestId('relink-popup')).toEqual([]);
    expect((p.api as unknown as ReturnType<typeof api>).decideRelink).toHaveBeenCalledWith('space:a', 'relink:jaehan', true);
    expect(p.onDecided).toHaveBeenCalledWith({ learnerId: 'profile:jaehan', text: 'Jaehan can open their new device now.' });
    const said = byTestId('attention-sheet-said')[0] as ReactTestInstance;
    expect(said.props.role).toBe('status');
    expect(textOf(said)).toBe('Jaehan can open their new device now.');
    // The page's reread drops the device: the row stays with its line for 5 s, then leaves.
    await act(async () => renderer?.update(<ReviewSheet {...p} devices={[]} />));
    expect(textOf(byTestId('sheet-row-decided')[0] as ReactTestInstance)).toContain('Jaehan can open their new device now.');
    await act(async () => {
      vi.advanceTimersByTime(DECIDED_HOLD_MS);
    });
    expect(byTestId('sheet-row-decided')).toEqual([]);
  });

  it('a failed dialog Approve that leaves the request open keeps the dialog with its line, and the sheet says it', async () => {
    const failing = { ...api(), decideRelink: vi.fn(async () => ({ ok: false as const, status: 503, error: 'unavailable' })) };
    const p = await open(props({ api: failing as never, incoming: [], outgoing: [] }));
    await press(byTestId('sheet-device-approve')[0] as ReactTestInstance);
    await press(byTestId('relink-popup-approve')[0] as ReactTestInstance);
    expect(byTestId('relink-popup-failed')).toHaveLength(1);
    expect(byTestId('relink-popup-approve')).toHaveLength(1);
    expect(textOf(byTestId('attention-sheet-said')[0] as ReactTestInstance)).toBe(textOf(byTestId('relink-popup-failed')[0] as ReactTestInstance));
    expect(byTestId('sheet-row-decided')).toEqual([]);
    expect(p.onDecided).not.toHaveBeenCalled();
  });

  it('a failed Deny that leaves the request open shows its line on the row and keeps Approve / Deny', async () => {
    const failing = { ...api(), decideRelink: vi.fn(async () => ({ ok: false as const, status: 503, error: 'unavailable' })) };
    const p = await open(props({ api: failing as never, incoming: [], outgoing: [] }));
    await press(byTestId('sheet-device-deny')[0] as ReactTestInstance);
    const row = byTestId('sheet-device-row')[0] as ReactTestInstance;
    expect(byTestId('sheet-device-failed')).toHaveLength(1);
    expect(textOf(row)).toContain(textOf(byTestId('sheet-device-failed')[0] as ReactTestInstance));
    expect(byTestId('sheet-device-approve')).toHaveLength(1);
    expect(byTestId('sheet-row-decided')).toEqual([]);
    expect(textOf(byTestId('attention-sheet-said')[0] as ReactTestInstance)).toBe(textOf(byTestId('sheet-device-failed')[0] as ReactTestInstance));
    expect(p.onDecided).not.toHaveBeenCalled();
  });

  it('a consent answer the page must handle (session ended) shows its words on the row and says them', async () => {
    const signedOut = { ...api(), approveTransfer: vi.fn(async () => ({ ok: false as const, status: 401, error: 'unauthorized' })) };
    await open(props({ api: signedOut as never, devices: [], incoming: [] }));
    await press(byTestId('sheet-outgoing-review')[0] as ReactTestInstance);
    await press(byTestId('move-agree')[0] as ReactTestInstance);
    const line = byTestId('sheet-outgoing-state')[0] as ReactTestInstance;
    expect(textOf(line)).toBe('Please sign in again.');
    expect(textOf(byTestId('attention-sheet-said')[0] as ReactTestInstance)).toBe('Please sign in again.');
  });

  it('Close is a pill: the move buttons\' side padding, so a two-letter label never draws as a circle', async () => {
    await open(props());
    const style = (byTestId('attention-sheet-close')[0] as ReactTestInstance).props.style;
    expect(style.padding).toBe('8px 24px');
  });

  it('when the last item clears the sheet stays open on "Nothing is waiting." with focus on Close; it never closes itself', async () => {
    const p = await open(props({ incoming: [], outgoing: [] }));
    await press(byTestId('sheet-device-deny')[0] as ReactTestInstance);
    await act(async () => renderer?.update(<ReviewSheet {...p} incoming={[]} outgoing={[]} devices={[]} />));
    focused.length = 0;
    await act(async () => {
      vi.advanceTimersByTime(DECIDED_HOLD_MS);
    });
    expect(textOf(byTestId('attention-sheet-empty')[0] as ReactTestInstance)).toBe('Nothing is waiting.');
    expect(focused).toEqual(['attention-sheet-close']);
    expect(p.onClose).not.toHaveBeenCalled();
    expect(byTestId('attention-sheet')).toHaveLength(1);
  });

  it('Close, Escape and the backdrop close it', async () => {
    const p = await open(props());
    await press(byTestId('attention-sheet-close')[0] as ReactTestInstance);
    await press(byTestId('attention-sheet-backdrop')[0] as ReactTestInstance);
    await act(async () => {
      for (const l of keyListeners) l({ key: 'Escape', shiftKey: false, preventDefault: () => undefined });
    });
    expect(p.onClose).toHaveBeenCalledTimes(3);
  });

  it('an action chip opens it at its item: that row takes focus', async () => {
    await open(props({ focusKey: sheetKey.incoming(incoming) }));
    expect(focused[0]).toBe(`[data-sheet-key="${sheetKey.incoming(incoming)}"]`);
  });

  it("a family's move that waits for its OK: Review goes to the family's moves page (ids only)", async () => {
    await open(props({ devices: [], incoming: [], outgoing: [], familyMoves: [{ id: 'transfer:f1', learnerId: 'profile:yuhan', name: 'Yuhan', avatar: 'tiger', to: 'Saturday Class B', href: '/parent/space/transfers?id=space%3Akim' }] }));
    const section = byTestId('sheet-family')[0] as ReactTestInstance;
    expect(textOf(section.find((n) => n.type === 'h3'))).toBe('Asked about your learners');
    const link = section.find((n) => n.type === 'a');
    expect(link.props.href).toBe('/parent/space/transfers?id=space%3Akim');
    expect(textOf(link)).toBe('Review');
  });

  it('ko and es words', async () => {
    lang.locale = 'ko';
    await open(props());
    const ko = textOf(byTestId('attention-sheet')[0] as ReactTestInstance);
    for (const words of ['승인 대기', '새 기기', '이 반에 들어오려는 학생', '다른 반으로 옮기려는 학생', '새 기기 · 8분 남음', '반 이동: Evening Class D', '닫기']) expect(ko).toContain(words);
    act(() => renderer?.unmount());
    lang.locale = 'es';
    await open(props());
    const es = textOf(byTestId('attention-sheet')[0] as ReactTestInstance);
    for (const words of ['Por aprobar', 'Dispositivos nuevos', 'Quieren unirse a esta clase', 'Salidas de esta clase', 'Cambio de clase: Evening Class D']) expect(es).toContain(words);
  });

  it('tokens only: no colour literal and never the danger colour', () => {
    const source = readFileSync(new URL('../AttentionParts.tsx', import.meta.url), 'utf8');
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
    expect(source).not.toContain('feedback.danger');
  });
});
