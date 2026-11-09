import { CATALOG, type ActivitySummary, type InsightSummary } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { createElement, type ReactElement } from 'react';
import { act } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { inAppReportView, type InAppReportView } from '../../../logic/reports/report-view';
import { byTestId, hostNodes, press, render, resetPlatform, screenTexts, setPlatform } from '../../../test-support/render';
import { ReportView } from '../report-blocks';

/**
 * F-AUTH-004 section 8.7 (row NS-5): the report viewer split. `ReportView` draws the in-app report's view model exactly
 * as `LearnerReportScreen` drew it before the split (the same blocks, test ids and names), and draws what only a
 * screen adds (Open Learning Route, Preview lessons, the skills rows) only when that screen passes it in, so the
 * account report, which passes none, never shows them.
 */

const m = getMessages('en');
const NOW = new Date('2026-10-12T15:00:00.000Z');

const activity: ActivitySummary = {
  v: 1,
  tz: 0,
  asOf: '2026-10-12',
  days: [
    { d: '2026-10-01', min: 6, q: 1, c: 1, w: 0, j: ['ㄱ'] },
    { d: '2026-10-07', min: 10, q: 1, c: 1, w: 0, j: ['ㅏ'] },
    { d: '2026-10-08', min: 12, q: 1, c: 0, w: 0, j: ['ㅓ'] },
    { d: '2026-10-12', min: 14, q: 0, c: 0, w: 0, j: [] },
  ],
  months: [
    { m: '2026-09', min: 20, q: 2, c: 2, w: 0, days: 4 },
    { m: '2026-10', min: 42, q: 3, c: 2, w: 0, days: 4 },
  ],
  total: { since: '2026-09-14', min: 62, q: 6, c: 5, w: 0, days: 8 },
  milestones: [],
  next: { q: 'quest:stage1-life-q2', plan: true },
};

const summary: InsightSummary = {
  lastActiveAt: '2026-10-12T14:00:00.000Z',
  stage1: { questsDone: 6, questsTotal: 20, anchorAccuracy: null },
  cardsUnlocked: 5,
  minutesLast7d: 36,
  jamoRecognized: ['ㄱ', 'ㅏ', 'ㅓ'],
  needsPractice: ['ㅂ'],
  planProgress: { 'plan:a': { done: 3, total: 5, notReady: 0 } },
  journey: { v: 1, here: 'stage1', stages: [] },
  activity,
};

function view(): InAppReportView {
  return inAppReportView({
    summary,
    name: 'Sam',
    voice: 'third',
    period: 'week',
    at: null,
    now: NOW,
    catalog: CATALOG,
    locale: 'en',
    messages: m,
    stageTitle: () => 'Hangul',
    questTitle: () => 'Market day',
    letterInfo: () => ({ romanization: 'b', gloss: null }),
    learningRoute: true,
    platform: 'web',
  });
}

function draw(extra: Partial<Parameters<typeof ReportView>[0]> = {}): ReactElement {
  return createElement(ReportView, { view: view(), period: 'week', announce: null, onChoosePeriod: () => undefined, onStep: () => undefined, ...extra });
}

afterEach(() => {
  resetPlatform();
});

describe('ReportView: the in-app blocks, unchanged', () => {
  it('the title, the glance, the periods, the stepper, the sections, This period and More detail, with their test ids', async () => {
    setPlatform('web');
    const r = await render(draw());
    for (const id of ['learner-report-title', 'learner-report-glance', 'learner-report-tabs', 'learner-report-range', 'learner-report-step-prev', 'learner-report-headline', 'learner-report-went-well', 'learner-report-this-period', 'learner-report-scope', 'learner-report-calendar', 'learner-report-more-detail', 'learner-report-more-detail-toggle']) {
      expect(byTestId(r.root, id).length, id).toBeGreaterThan(0);
    }
    expect(screenTexts(byTestId(r.root, 'learner-report-title')[0]!)).toContain(m.report.title.learner('Sam'));
    expect(screenTexts(byTestId(r.root, 'learner-report-scope')[0]!)).toContain(m.report.scope.device);
  });

  it('Open Learning Route only when the screen offers it', async () => {
    setPlatform('web');
    const onOpenRoute = vi.fn();
    const withRoute = await render(draw({ onOpenRoute }));
    await press(byTestId(withRoute.root, 'learner-report-open-route')[0]!);
    expect(onOpenRoute).toHaveBeenCalledTimes(1);
    const without = await render(draw());
    expect(byTestId(without.root, 'learner-report-open-route')).toEqual([]);
  });

  it('the footers: at the end of What to practice next, and at the end of More detail once it opens', async () => {
    setPlatform('web');
    const r = await render(draw({ practiceNextFooter: createElement('preview-row', { 'data-testid': 'footer-preview' }), detailFooter: createElement('skills-rows', { 'data-testid': 'footer-skills' }) }));
    const section = byTestId(r.root, 'learner-report-practice-next')[0]!;
    expect(byTestId(section, 'footer-preview')).toHaveLength(1);
    expect(byTestId(r.root, 'footer-skills')).toEqual([]);
    await press(byTestId(r.root, 'learner-report-more-detail-toggle')[0]!);
    expect(byTestId(r.root, 'footer-skills')).toHaveLength(1);
  });

  it('a period tab and a step call the screen with what was chosen', async () => {
    setPlatform('ios');
    const onChoosePeriod = vi.fn();
    const onStep = vi.fn();
    const r = await render(draw({ onChoosePeriod, onStep }));
    const month = hostNodes(r.root, (n) => n.props.role === 'tab' && screenTexts(n).includes(m.report.period.month))[0]!;
    await press(month);
    expect(onChoosePeriod).toHaveBeenCalledWith('month');
    await press(byTestId(r.root, 'learner-report-step-prev')[0]!);
    expect(onStep).toHaveBeenCalledWith(view().stepper?.prev?.at);
  });

  it('the announcement after a change sits in the polite live region', async () => {
    setPlatform('android');
    const r = await render(draw({ announce: 'Showing last week' }));
    expect(screenTexts(r.root)).toContain('Showing last week');
    await act(async () => undefined);
  });
});
