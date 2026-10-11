import { formatDate as realFormatDate, getMessages, type UiLocale } from '@hangul-route/i18n';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { CurrentPlanList, PlanRowList } from '@/components/console/BillingParts';
import { PlanDraftItems, PlanReadout } from '@/components/console/PlanParts';
import { stage1Episodes, stage1Quests } from '@/data/stage1-catalog';
import type { EntitlementView, PlanView, SpaceListItem } from '@/lib/console/api';
import { currentPlanCards, planRowsFor } from '@/lib/console/billing';
import type { ReadoutRow } from '@/lib/console/plans';
import { expectAllPseudo } from './pseudo-text';

/**
 * F-I18N-001 PR 10b, §3.11: the loaded states of the plan and billing pages — the published
 * readout, the draft's item rows, the current-plan cards and the plan rows — take every word
 * from the dictionary. The page tests (console-pages-pseudo.test.tsx) only reach first paint,
 * because effects do not run in a server render; these render the parts with data, in en-XA.
 */
const PSEUDO = 'en-XA' as UiLocale;

vi.mock('@/lib/i18n/locale-context', () => {
  const view = () => ({ locale: PSEUDO, messages: getMessages(PSEUDO), available: ['en'], setLocale: () => undefined });
  return { useConsoleLocale: view, useMessages: () => view().messages, useLocale: () => PSEUDO, useSetLocale: () => () => undefined };
});

// The formatters take UI locales only (en-XA is a dictionary test locale): dates render in
// English here and are listed as data below.
vi.mock('@hangul-route/i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@hangul-route/i18n')>();
  return { ...actual, formatDate: (locale: UiLocale, ...rest: Parameters<typeof actual.formatDate> extends [UiLocale, ...infer R] ? R : never) => actual.formatDate(locale === PSEUDO ? 'en' : locale, ...rest) };
});

beforeAll(() => {
  vi.stubEnv('NEXT_PUBLIC_PSEUDO_LOCALE', '1');
});
afterAll(() => {
  vi.unstubAllEnvs();
});

const now = new Date('2026-10-11T12:00:00.000Z');
const contentTitles = [...stage1Episodes.map((e) => e.titleEn), ...stage1Quests.map((q) => q.titleEn)];
const episode = stage1Episodes[0]!;
const quest = stage1Quests[0]!;

const plan = (over: Partial<PlanView>): PlanView => ({
  id: 'plan:1',
  spaceId: 'space:c1',
  authorAccountId: 'teacher-kim',
  title: 'Week three',
  items: [
    { kind: 'episode', id: episode.id, targetDate: '2026-10-12', note: 'warm up' },
    { kind: 'quest', id: quest.id },
  ],
  targetLearnerIds: null,
  publishedAt: '2026-10-10T09:00:00.000Z',
  archivedAt: null,
  createdAt: '2026-10-09T09:00:00.000Z',
  updatedAt: '2026-10-10T09:00:00.000Z',
  ...over,
});
const row = (over: Partial<ReadoutRow>): ReadoutRow => ({ learnerId: 'l:1', name: 'Mina', done: 1, total: 2, notReady: 0, synced: true, lastActiveAt: '2026-10-11T08:00:00.000Z', ...over });
// Data on the readout: the plan title, item notes, raw target dates, learner names and the published date.
const readoutData = ['Week three', 'warm up', '2026-10-12', 'Mina', 'Jun', realFormatDate('en', '2026-10-10T09:00:00.000Z', 'monthDay', { utc: true }), ...contentTitles];
const noop = (): void => undefined;

describe('plan parts render only dictionary text (en-XA)', () => {
  it('the published readout for everyone, with progress rows (synced, not ready, waiting)', () => {
    const html = renderToStaticMarkup(
      <PlanReadout plan={plan({})} rows={[row({}), row({ learnerId: 'l:2', name: 'Jun', done: 0, notReady: 1 }), row({ learnerId: 'l:3', name: 'Mina', synced: false, lastActiveAt: '2026-10-10T08:00:00.000Z' })]} kind="class" busy={false} now={now} onEdit={noop} onArchive={noop} onNew={noop} />,
    );
    expect(html).toContain('data-testid="readout-row"');
    expectAllPseudo(html, readoutData);
  });

  it('the readout for some learners, with nobody yet, before and after the roster loads', () => {
    for (const kind of ['family', 'class', 'school', null] as const) {
      const html = renderToStaticMarkup(<PlanReadout plan={plan({ targetLearnerIds: ['l:1', 'l:2'] })} rows={[]} kind={kind} busy={false} now={now} onEdit={noop} onArchive={noop} onNew={noop} />);
      expectAllPseudo(html, readoutData);
    }
  });

  it("the draft's item rows: reorder, remove, date and note", () => {
    const html = renderToStaticMarkup(<PlanDraftItems items={plan({}).items} onMove={noop} onRemove={noop} onUpdate={noop} />);
    expect(html).toContain('type="date"');
    expectAllPseudo(html, ['warm up', ...contentTitles]);
  });

  it('the empty draft', () => {
    const html = renderToStaticMarkup(<PlanDraftItems items={[]} onMove={noop} onRemove={noop} onUpdate={noop} />);
    // One line only; expectAllPseudo needs several words, so check it directly.
    expect(html).toMatch(/^<p[^>]*>\[[^\]]*\]<\/p>$/);
  });
});

const ent = (over: Partial<EntitlementView>): EntitlementView => ({
  id: 'ent:1',
  subjectKind: 'space',
  subjectId: 'space:cls',
  planKey: 'group_license',
  status: 'active',
  provider: 'stripe',
  providerRef: 'sub',
  customerRef: 'cus',
  seats: null,
  expiresAt: null,
  promoCode: null,
  updatedAt: '2026-10-01T00:00:00.000Z',
  subjectName: 'Class A',
  ...over,
});
const space = (id: string, kind: SpaceListItem['space']['kind']): SpaceListItem => ({
  space: { id, kind, name: id, parentSpaceId: null, settings: { consentMode: 'parent', anonymizeRoster: false }, archivedAt: null, createdAt: 't' },
  role: 'owner',
  counts: { learners: 0, accounts: 1, classes: 0 },
  joinCode: null,
  joinCodeExpiresAt: null,
});
// Data on the billing page: space names, promo codes and prices (formatUsd digits).
const billingData = ['Class A', 'Kim family', 'KPCCW2026', 'space:fam', 'space:cls', 'space:sch'];

describe('billing parts render only dictionary text (en-XA)', () => {
  it('the free card when nothing is active', () => {
    expectAllPseudo(renderToStaticMarkup(<CurrentPlanList cards={[]} showFree busy={false} onManage={noop} />), billingData, 2);
  });

  it('current-plan cards: manage, seats, a promo code, every provider', () => {
    const entitlements = [
      ent({}),
      ent({ id: 'ent:2', planKey: 'family_lifetime', subjectId: 'space:fam', subjectName: 'Kim family', provider: 'apple', customerRef: null, promoCode: 'KPCCW2026' }),
      ent({ id: 'ent:3', planKey: 'school_seat', subjectKind: 'account', subjectId: 'me', subjectName: null, provider: 'manual', customerRef: null, seats: 300 }),
      ent({ id: 'ent:4', provider: 'google', status: 'cancelled' }),
    ];
    const html = renderToStaticMarkup(<CurrentPlanList cards={currentPlanCards(entitlements, now, PSEUDO)} showFree={false} busy={false} onManage={noop} />);
    expect(html).toContain('data-testid="plan-card"');
    expectAllPseudo(html, billingData);
  });

  it('plan rows: choose, contact, current', () => {
    const spaces = [space('space:fam', 'family'), space('space:cls', 'class'), space('space:sch', 'school')];
    const rows = planRowsFor('me', spaces, [ent({})], now, PSEUDO);
    expect(rows.map((r) => r.action)).toEqual(expect.arrayContaining(['choose', 'contact', 'current']));
    expectAllPseudo(renderToStaticMarkup(<PlanRowList rows={rows} promo={null} disabled={false} onChoose={noop} />), billingData);
  });
});
