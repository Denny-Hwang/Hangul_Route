import { readFileSync } from 'node:fs';
import { TRANSFER_CONSENT_TEXT_VERSION } from '@hangul-route/content-schema';
import { colors, touchTarget } from '@hangul-route/design-system/tokens';
import { getMessages, type UiLocale } from '@hangul-route/i18n';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiResult, RelinkView, TransferLearnerSideView } from '@/lib/console/api';
import { needsYou, type FamilyAsks } from '@/lib/console/parent-home';

/**
 * AMENDMENTS-GROWNUP-UX GX-4 (section 7.1; wireframe design/wireframes/parent/needs-you.md, mock
 * design/screens/approvals/mock/parent-*.html): the family's Needs you strip. Compact rows with their buttons inline,
 * the fold rule with See all, inline re-link answers, the consent sheet opened directly from Review, and Read and OK.
 */
const lang = { locale: 'en' as UiLocale };
vi.mock('@/lib/i18n/locale-context', async () => {
  const i18n = await import('@hangul-route/i18n');
  const view = () => ({ locale: lang.locale, messages: i18n.getMessages(lang.locale), available: ['en', 'es', 'ko'], setLocale: () => undefined });
  return { useConsoleLocale: view, useMessages: () => view().messages, useLocale: () => lang.locale, useSetLocale: () => () => undefined };
});

import { FamilyNeedsYou, type NeedsYouApi } from '@/components/console/FamilyNeedsYou';

const NOW = new Date('2026-10-31T12:00:00.000Z');

/** A stand-in IntersectionObserver (the consent sheet's Yes waits until its end marker was in view). */
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
  lang.locale = 'en';
  vi.unstubAllGlobals();
});

const root = (): ReactTestInstance => (renderer as ReactTestRenderer).root;
const all = (id: string): ReactTestInstance[] => root().findAll((n) => n.props['data-testid'] === id && typeof n.type === 'string');
const one = (id: string): ReactTestInstance => all(id)[0] as ReactTestInstance;
const text = (node: ReactTestInstance): string => node.findAll((n) => typeof n.type === 'string').map((n) => n.children.filter((c) => typeof c === 'string').join('')).join(' ');
const click = async (id: string, index = 0): Promise<void> => {
  await act(async () => (all(id)[index] as ReactTestInstance).props.onClick());
};
const ok = <T,>(data: T): ApiResult<T> => ({ ok: true, data });

function relink(over: Partial<RelinkView> = {}): RelinkView {
  return { id: 'relink:1', learnerId: 'profile:mina', learnerName: 'Mina', deviceId: 'd', platform: 'ios', requestedAt: '2026-10-31T11:57:00.000Z', expiresAt: '2026-10-31T12:07:00.000Z', status: 'pending', ...over };
}

function sideView(over: Partial<TransferLearnerSideView> = {}): TransferLearnerSideView {
  return {
    id: 'transfer:f1',
    role: 'learner_side',
    status: 'requested',
    initiator: 'source',
    learner: { id: 'profile:jun', name: 'Jun' },
    from: { spaceId: 'space:a', name: 'Sunday Class A' },
    to: { spaceId: 'space:d', name: 'Evening Class D', ownerName: 'Ms Park', schoolName: null, ageBucket: 'months', learnerCount: 8 },
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
    createdAt: '2026-10-30T12:00:00.000Z',
    expiresAt: '2026-11-09T12:00:00.000Z',
    executedAt: null,
    endedAt: null,
    learnerRoute: 'caregiver',
    endedFrom: null,
    termsDigest: 'b'.repeat(64),
    ...over,
  };
}

const SCOPE = { current: 'v', learners: [{ learnerId: 'profile:sora', name: 'Sora', needed: true }] };

function asks(over: Partial<FamilyAsks> = {}): FamilyAsks {
  return { relinks: [], transfers: { requests: [], options: [] }, scope: { current: 'v', learners: [] }, notices: [], ...over };
}

type MockApi = { [K in keyof NeedsYouApi]: ReturnType<typeof vi.fn> };

function makeApi(): MockApi {
  return {
    decideRelink: vi.fn(async () => ok(relink({ status: 'approved' }))),
    approveTransfer: vi.fn(async () => ok(sideView({ learnerState: 'consented' }))),
    declineTransfer: vi.fn(async () => ok(sideView({ status: 'ended' }))),
  } as MockApi;
}

async function renderStrip(state: FamilyAsks, opts: { api?: ReturnType<typeof makeApi>; onChanged?: () => Promise<void>; onReadScope?: (id: string) => void; online?: boolean } = {}) {
  const api = opts.api ?? makeApi();
  const onChanged = opts.onChanged ?? vi.fn(async () => undefined);
  const onReadScope = opts.onReadScope ?? vi.fn();
  await act(async () => {
    renderer = create(
      <FamilyNeedsYou
        familyId="space:f"
        familyName="Kim family"
        items={needsYou(state, NOW)}
        views={(state.transfers?.requests ?? []) as TransferLearnerSideView[]}
        avatars={{ 'profile:mina': 'cub', 'profile:jun': 'tiger' }}
        api={api as unknown as NeedsYouApi}
        online={opts.online ?? true}
        now={NOW}
        onChanged={onChanged}
        onReadScope={onReadScope}
      />,
      { createNodeMock: () => ({}) },
    );
  });
  return { api, onChanged, onReadScope };
}

const p = getMessages('en').console.parentHome;
const t = getMessages('en').console.transfer;

describe('FamilyNeedsYou: the strip', () => {
  it('nothing waits: no strip at all (only the empty polite region)', async () => {
    await renderStrip(asks());
    expect(all('needs-you')).toHaveLength(0);
    expect(one('needs-you-result').props.role).toBe('status');
  });

  it('a region named by its heading; with 2 items every item keeps its compact row and its buttons inline', async () => {
    await renderStrip(asks({ relinks: [relink()], transfers: { requests: [sideView()], options: [] } }));
    const strip = one('needs-you');
    expect(strip.props.role).toBe('region');
    const heading = root().find((n) => n.props.id === strip.props['aria-labelledby'] && typeof n.type === 'string');
    expect(text(heading)).toBe(p.needsYou.title);
    const rows = all('needs-you-row');
    expect(rows.map((r) => r.props['data-kind'])).toEqual(['relink', 'move']);
    expect(text(rows[0] as ReactTestInstance)).toContain('Mina wants to continue on a new device.');
    expect(text(rows[0] as ReactTestInstance)).toContain('7 min left');
    expect(text(rows[1] as ReactTestInstance)).toContain('A class move for Jun needs your OK.');
    expect(text(rows[1] as ReactTestInstance)).toContain('New class: Evening Class D · Ends in 9 days');
    expect(all('needs-you-more')).toHaveLength(0);
    // Amber is the family's action: a nudge bar and light fill on each row; never the danger colour.
    expect((rows[0] as ReactTestInstance).props.style.backgroundColor).toBe(colors.feedback.nudgeLight);
    expect(JSON.stringify((rows[0] as ReactTestInstance).props.style)).toContain(colors.feedback.nudge);
  });

  it('every answer button is a 64 px target described by its row, so "Approve" is read with whose request it is', async () => {
    await renderStrip(asks({ relinks: [relink()] }));
    const approve = one('needs-you-approve');
    const ids = String(approve.props['aria-describedby']).split(' ');
    expect(ids).toHaveLength(2);
    const described = ids.map((id) => text(root().find((n) => n.props.id === id && typeof n.type === 'string'))).join(' ');
    expect(described).toBe('Mina wants to continue on a new device. 7 min left');
    expect(approve.props.style.minHeight).toBeGreaterThanOrEqual(touchTarget.min);
  });

  it('fold rule: 3 items show the soonest-closing row and "2 more things need you" with See all, which lists them all in a sheet', async () => {
    await renderStrip(asks({ relinks: [relink()], transfers: { requests: [sideView()], options: [] }, scope: SCOPE }));
    expect(all('needs-you-row').map((r) => r.props['data-kind'])).toEqual(['relink']);
    expect(text(one('needs-you-more'))).toContain(p.needsYou.more(2));
    expect(all('needs-you-sheet')).toHaveLength(0);
    await click('needs-you-see-all');
    const sheet = one('needs-you-sheet');
    expect(sheet.props.role).toBe('dialog');
    expect(text(sheet)).toContain(p.needsYou.title);
    expect(sheet.findAll((n) => n.props['data-testid'] === 'needs-you-row' && typeof n.type === 'string').map((r) => r.props['data-kind'])).toEqual(['relink', 'move', 'scope']);
  });

  it('a re-link is answered inline: Approve and Deny by request id, the result in the polite region, the page reads again', async () => {
    const { api, onChanged } = await renderStrip(asks({ relinks: [relink()] }));
    await click('needs-you-approve');
    expect(api.decideRelink).toHaveBeenCalledWith('space:f', 'relink:1', true);
    expect(text(one('needs-you-result')).trim()).toBe(getMessages('en').console.relink.approved('Mina'));
    expect(onChanged).toHaveBeenCalledTimes(1);
    await click('needs-you-deny');
    expect(api.decideRelink).toHaveBeenLastCalledWith('space:f', 'relink:1', false);
  });

  it('a failed answer keeps the row and says it did not go through', async () => {
    const api = makeApi();
    api.decideRelink.mockResolvedValueOnce({ ok: false, error: 'network', status: -1 });
    await renderStrip(asks({ relinks: [relink()] }), { api });
    await click('needs-you-approve');
    expect(all('needs-you-row')).toHaveLength(1);
    expect(text(one('needs-you-result')).length).toBeGreaterThan(0);
  });

  it('offline: the answers wait (disabled)', async () => {
    await renderStrip(asks({ relinks: [relink()] }), { online: false });
    expect(one('needs-you-approve').props.disabled).toBe(true);
  });

  it('Review opens the shipped consent sheet directly (2 taps); Yes approves the family step with the view digest', async () => {
    const { api, onChanged } = await renderStrip(asks({ transfers: { requests: [sideView()], options: [] } }));
    await click('needs-you-review');
    expect(all('consent-sheet')).toHaveLength(1);
    act(() => intersect());
    await click('consent-yes');
    expect(api.approveTransfer).toHaveBeenCalledWith('space:f', 'transfer:f1', {
      slots: ['learner'],
      consent: { textVersion: TRANSFER_CONSENT_TEXT_VERSION, locale: 'en', termsDigest: 'b'.repeat(64) },
      introduce: false,
    });
    expect(all('consent-sheet')).toHaveLength(0);
    expect(onChanged).toHaveBeenCalled();
  });

  it('Not now in the sheet declines the family step; Review from See all closes that sheet first (one dialog at a time)', async () => {
    const { api } = await renderStrip(asks({ relinks: [relink()], transfers: { requests: [sideView()], options: [] }, scope: SCOPE }));
    await click('needs-you-see-all');
    const reviewInSheet = one('needs-you-sheet').find((n) => n.props['data-testid'] === 'needs-you-review' && typeof n.type === 'string');
    await act(async () => reviewInSheet.props.onClick());
    expect(all('needs-you-sheet')).toHaveLength(0);
    expect(all('consent-sheet')).toHaveLength(1);
    await click('consent-not-now');
    expect(api.declineTransfer).toHaveBeenCalledWith('space:f', 'transfer:f1', { slot: 'learner' });
    expect(all('consent-sheet')).toHaveLength(0);
  });

  it('a request that ended meanwhile closes the sheet and the page reads again, with no failure line', async () => {
    const api = makeApi();
    api.approveTransfer.mockResolvedValueOnce({ ok: false, error: 'unknown', status: 409, code: 'not_open' });
    const { onChanged } = await renderStrip(asks({ transfers: { requests: [sideView()], options: [] } }), { api });
    await click('needs-you-review');
    act(() => intersect());
    await click('consent-yes');
    expect(all('consent-sheet')).toHaveLength(0);
    expect(onChanged).toHaveBeenCalled();
    expect(text(one('needs-you-result')).trim()).toBe('');
  });

  it('a Yes that fails for the network keeps the sheet with Try again', async () => {
    const api = makeApi();
    api.approveTransfer.mockResolvedValueOnce({ ok: false, error: 'network', status: -1 });
    await renderStrip(asks({ transfers: { requests: [sideView()], options: [] } }), { api });
    await click('needs-you-review');
    act(() => intersect());
    await click('consent-yes');
    expect(all('consent-sheet')).toHaveLength(1);
    expect(text(one('consent-yes'))).toBe(t.consent.tryAgain.cta);
  });

  it('Read and OK hands the learner to the page, which scrolls to and focuses the shipped class-scope card (GX-OD-3 open)', async () => {
    const onReadScope = vi.fn();
    await renderStrip(asks({ scope: SCOPE }), { onReadScope });
    expect(text(one('needs-you-read'))).toBe(p.needsYou.readOk.cta);
    await click('needs-you-read');
    expect(onReadScope).toHaveBeenCalledWith('profile:sora');
  });

  it.each(['es', 'ko'] as const)('%s: the strip is worded in the console language', async (locale) => {
    lang.locale = locale;
    await renderStrip(asks({ relinks: [relink()], transfers: { requests: [sideView()], options: [] }, scope: SCOPE }));
    const w = getMessages(locale).console.parentHome.needsYou;
    expect(text(one('needs-you'))).toContain(w.title);
    expect(text(one('needs-you'))).toContain(w.relink('Mina'));
    expect(text(one('needs-you-more'))).toContain(w.more(2));
    expect(text(one('needs-you-see-all'))).toBe(w.seeAll.cta);
  });
});

describe('style rules', () => {
  it('FamilyNeedsYou.tsx uses tokens only: no colour literal and never the danger colour', () => {
    const source = readFileSync(new URL('../FamilyNeedsYou.tsx', import.meta.url), 'utf8');
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
    expect(source).not.toContain('feedback.danger');
  });
});
