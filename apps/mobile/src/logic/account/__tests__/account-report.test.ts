import { CATALOG, type ActivitySummary, type ReportSummary } from '@hangul-route/content-schema';
import { LOCALES, getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import type { AccountReportBody } from '../account-data';
import { FREE_END_CODE, accountReportView, type AccountReportInput } from '../account-report';
import { accountDenyHits } from '../deny-list';

/**
 * F-AUTH-004 section 8.7 (row NS-5; D14, CS-N5): the account learner report reads the server's projection through the
 * in-app report's view model as the console's viewer, and leaves out "Now on", Open Learning Route and the free-end
 * line (by its code, here, never in the shared blocks), on every platform.
 */

const en = getMessages('en');
const NOW = new Date('2026-10-12T15:00:00.000Z');

const activity = (over: Partial<ActivitySummary> = {}): ActivitySummary => ({
  v: 1,
  tz: 0,
  asOf: '2026-10-12',
  days: [
    { d: '2026-10-07', min: 10, q: 1, c: 1, w: 0, j: ['ㅏ'] },
    { d: '2026-10-08', min: 12, q: 1, c: 0, w: 0, j: ['ㅓ'] },
    { d: '2026-10-12', min: 14, q: 0, c: 0, w: 0, j: [] },
  ],
  months: [{ m: '2026-10', min: 36, q: 2, c: 1, w: 0, days: 3 }],
  total: { since: '2026-10-07', min: 36, q: 2, c: 1, w: 0, days: 3 },
  milestones: [],
  next: { end: true },
  ...over,
});

const summary = (over: Partial<ReportSummary> = {}): ReportSummary => ({
  lastActiveAt: '2026-10-12T14:00:00.000Z',
  stage1: { questsDone: 2, questsTotal: 20, anchorAccuracy: null },
  cardsUnlocked: 1,
  minutesLast7d: 36,
  jamoRecognized: ['ㅏ', 'ㅓ'],
  needsPractice: [],
  planProgress: { 'plan:a': { done: 1, total: 3, notReady: 0 } },
  journey: { v: 1, here: 'stage1', stages: [] },
  activity: activity(),
  ...over,
});

const body = (over: Partial<AccountReportBody> = {}): AccountReportBody => ({
  space: { id: 'space:a', kind: 'family', name: 'Kim family', archivedAt: null },
  learner: { id: 'profile:mina', displayName: 'Mina' },
  summary: summary(),
  lastSyncedAt: '2026-10-12T14:30:00.000Z',
  ...over,
});

const input = (over: Partial<AccountReportInput> = {}): AccountReportInput => ({
  body: body(),
  period: 'week',
  at: null,
  now: NOW,
  catalog: CATALOG,
  locale: 'en',
  messages: en,
  stageTitle: () => 'Hangul',
  questTitle: () => 'A quest',
  letterInfo: () => ({ romanization: 'a', gloss: null }),
  platform: 'ios',
  ...over,
});

const codes = (view: ReturnType<typeof accountReportView>): string[] => [...(view?.wentWell?.lines ?? []), ...(view?.practiceNext?.lines ?? [])].map((line) => line.code);

describe('the account learner report (section 8.7)', () => {
  it('the console viewer: third voice, All devices, the family plan rows', () => {
    const view = accountReportView(input());
    expect(view?.title).toBe(en.report.title.learner('Mina'));
    expect(view?.thisPeriod?.scope).toBe(en.report.scope.allDevices);
    expect(view?.tabs?.items.map((tab) => tab.id)).toEqual(['day', 'week', 'month', 'all']);
    const plan = view?.moreDetail?.blocks.find((block) => block.kind === 'lines' && block.key === 'plan');
    expect(plan).toMatchObject({ lines: [en.report.detail.planRow.family(1, 2)] });
  });

  it('no "Now on", no Open Learning Route; Last practice stays', () => {
    const view = accountReportView(input());
    expect(view?.glance?.nowOn).toBeNull();
    expect(view?.glance?.openRoute).toBeNull();
    expect(view?.glance?.lastPractice).toContain('Oct');
  });

  it('D14: no free-end line on any platform, even where the shared view words it (the web)', () => {
    for (const platform of ['ios', 'android', 'web']) expect(codes(accountReportView(input({ platform }))), platform).not.toContain(FREE_END_CODE);
  });

  it('a section left with no line is not drawn', () => {
    // A learner with nothing to practise but the free-end line: What to practice next disappears.
    const view = accountReportView(input({ platform: 'web', body: body({ summary: summary({ planProgress: {} }) }) }));
    expect(view?.practiceNext ?? null).toBeNull();
    // The shared view words it on the web: the filter is what removed it.
    expect(view?.wentWell).not.toBeNull();
  });

  it('the console notices: no data, and an older save with its update line', () => {
    const noData = accountReportView(input({ body: body({ summary: null }) }));
    expect(noData?.notices).toEqual([en.report.state.noData('Mina'), en.report.state.noDataAction]);
    const stale = accountReportView(input({ body: body({ lastSyncedAt: '2026-09-01T00:00:00.000Z', summary: summary({ activity: activity({ asOf: '2026-09-01', days: [{ d: '2026-09-01', min: 5, q: 0, c: 0, w: 0, j: [] }], months: [{ m: '2026-09', min: 5, q: 0, c: 0, w: 0, days: 1 }] }) }) }) }));
    expect(stale?.notices.at(-1)).toBe(en.report.state.updateAction('Mina'));
    expect(stale?.notices[0]).toMatch(/^Last saved /);
    const empty = accountReportView(input({ body: body({ summary: summary({ activity: activity({ days: [], months: [], total: { since: null, min: 0, q: 0, c: 0, w: 0, days: 0 }, next: undefined }) }) }) }));
    expect(empty?.notices).toEqual([en.report.state.empty('Mina')]);
    const legacy = accountReportView(input({ body: body({ summary: summary({ activity: undefined }) }) }));
    expect(legacy?.notices).toEqual([en.report.state.legacy, en.report.state.updateAction('Mina')]);
  });

  it('a class space reads as the class viewer (row NS-6 opens it); a school has no learner report', () => {
    const view = accountReportView(input({ body: body({ space: { id: 'space:c', kind: 'class', name: '3B', archivedAt: null } }) }));
    const plan = view?.moreDetail?.blocks.find((block) => block.kind === 'lines' && block.key === 'plan');
    expect(plan).toMatchObject({ lines: [en.report.detail.planRow.class(1, 2)] });
    expect(accountReportView(input({ body: body({ space: { id: 'space:s', kind: 'school', name: 'Maple', archivedAt: null } }) }))).toBeNull();
  });

  it('section 9.2: every line passes the deny list in en, es and ko, on every period', () => {
    for (const locale of LOCALES) {
      const messages = getMessages(locale);
      for (const period of ['day', 'week', 'month', 'all'] as const) {
        const view = accountReportView(input({ locale, messages, period }));
        const texts = JSON.stringify(view).match(/"(?:[^"\\]|\\.)*"/g) ?? [];
        for (const text of texts) expect(accountDenyHits(JSON.parse(text) as string, locale), `${locale} ${period}: ${text}`).toEqual([]);
      }
    }
  });
});
