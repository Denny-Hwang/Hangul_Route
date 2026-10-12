import {
  CATALOG,
  learnerReport,
  type ActivitySummary,
  type InsightLine,
  type InsightSummary,
  type ReportPeriod,
  type StageKey,
} from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  headlineText,
  inAppReportView,
  insightView,
  letterLabel,
  reportWordsOf,
  sentenceOf,
  type InAppReportInput,
  type ReportDetailBlock,
} from '../report-view';

/**
 * F-REPORT-001 section 3.9 (RP-9): the in-app report in words, from the report module's codes. Fixture: Sam, a
 * steady week on this device (Oct 6 to Oct 12, 2026, the learner's local days, UTC offset 0).
 */

const m = getMessages('en');
const NOW = new Date('2026-10-12T15:00:00.000Z');
const STAGE_TITLES: Record<StageKey, string> = {
  stage1: 'Hangul',
  stage2: 'Words',
  stage3: 'Sentences',
  stage4: 'Dialogue',
  stage5: 'Story',
  stage6: 'Real-use',
  stage7: 'Self-expression',
};
const GLOSS: Record<string, { romanization: string; gloss: string | null }> = {
  ㅂ: { romanization: 'b/p (bieup)', gloss: "B — sounds like the start of 'boy'" },
};

const activity = (over: Partial<ActivitySummary> = {}): ActivitySummary => ({
  v: 1,
  tz: 0,
  asOf: '2026-10-12',
  days: [
    { d: '2026-09-30', min: 5, q: 0, c: 0, w: 0, j: [] },
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
  revisit: 'quest:stage1-life-q2',
  ...over,
});

const summary = (over: Partial<InsightSummary> = {}): InsightSummary => ({
  lastActiveAt: '2026-10-12T14:00:00.000Z',
  streakDays: 1,
  stage1: { questsDone: 6, questsTotal: 20, anchorAccuracy: null },
  cardsUnlocked: 5,
  minutesLast7d: 36,
  jamoRecognized: ['ㄴ', 'ㄱ', 'ㅏ', 'ㅓ'],
  needsPractice: ['ㅂ', 'ㅅ'],
  planProgress: { 'plan:a': { done: 3, total: 5, notReady: 0 } },
  journey: { v: 1, here: 'stage1', stages: [] },
  placement: {
    takenAt: '2026-09-14T10:00:00.000Z',
    level: { stage: 'stage1', band: 1 },
    oralStage: null,
    strands: { 'hangul-recognition': 'secure', 'sound-letter': 'getting-there', 'syllable-reading': 'not-tested', vocabulary: 'not-tested', sentences: 'not-tested' },
    beyondContent: false,
    overridden: false,
  },
  activity: activity(),
  ...over,
});

const input = (over: Partial<InAppReportInput> = {}): InAppReportInput => ({
  summary: summary(),
  name: 'Sam',
  voice: 'third',
  period: 'week',
  at: null,
  now: NOW,
  catalog: CATALOG,
  locale: 'en',
  messages: m,
  stageTitle: (stage) => STAGE_TITLES[stage],
  questTitle: (id) => CATALOG.quests.find((q) => q.id === id)?.title ?? null,
  letterInfo: (letter) => GLOSS[letter] ?? null,
  learningRoute: true,
  ...over,
});

const texts = (lines: { sentence: { text: string } }[] | undefined): string[] => (lines ?? []).map((line) => line.sentence.text);
const block = (blocks: ReportDetailBlock[] | undefined, key: string): ReportDetailBlock | undefined =>
  blocks?.find((b) => ('key' in b ? b.key === key : b.kind === key));

afterEach(() => {
  vi.restoreAllMocks();
});

describe('inAppReportView: a steady week, third person', () => {
  const view = inAppReportView(input());

  it('the title, the glance with Open Learning Route and the last practice day', () => {
    expect(view.title).toBe('Sam: report');
    expect(view.state).toBe('ready');
    expect(view.glance).toEqual({ nowOn: 'Now on Stage 1: Hangul', openRoute: 'Open Learning Route', lastPractice: 'Last practice: Oct 12' });
    expect(view.notices).toEqual([]);
  });

  it('four period tabs named by a11y.report.periods, the week selected, and the announcement', () => {
    expect(view.tabs).toEqual({
      label: 'Report period',
      items: [
        { id: 'day', label: 'Today' },
        { id: 'week', label: 'This week' },
        { id: 'month', label: 'This month' },
        { id: 'all', label: 'All time' },
      ],
      value: 'week',
    });
    expect(view.announce).toBe('Showing this week');
  });

  it('the stepper: Last week back, no Next on the current window, the dates between', () => {
    expect(view.stepper).toEqual({ range: 'Oct 6 to Oct 12', prev: { at: '2026-10-05', label: 'Last week', name: 'Show last week' }, next: null });
  });

  it('the headline and the went-well lines (W3 is skipped under a practiced headline)', () => {
    expect(view.headline).toEqual({ text: 'Sam practiced on 3 days this week.', horizon: null });
    expect(view.wentWell?.heading).toBe('What went well');
    expect(texts(view.wentWell?.lines)).toEqual(['Sam got strong on ㅏ (a) and ㅓ (eo).', 'More practice time than last week: 36 minutes.', '2 new quests finished.']);
    const letters = view.wentWell?.lines[0]?.sentence.parts.filter((part) => part.kind === 'letter');
    expect(letters).toEqual([
      { kind: 'letter', letter: 'ㅏ', romanization: 'a', before: '', after: ' (a)' },
      { kind: 'letter', letter: 'ㅓ', romanization: 'eo', before: '', after: ' (eo)' },
    ]);
  });

  it('practice next carries no action, and the strand tip names a letter or listening game', () => {
    expect(view.practiceNext?.heading).toBe('What to practice next');
    expect(texts(view.practiceNext?.lines)).toEqual(['ㅂ (b) and ㅅ (s): worth another visit.', 'Sounds of letters is next to grow.', '2 plan items are ready to play.']);
    expect(view.practiceNext?.lines[1]?.tip).toBe('Listening games help: try Listen and pick.');
    for (const line of view.practiceNext?.lines ?? []) expect(Object.keys(line).sort()).toEqual(['code', 'sentence', 'tip']);
  });

  it('this period: figures with "More than last week" only where they grew, never words', () => {
    expect(view.thisPeriod?.heading).toBe('This period');
    expect(view.thisPeriod?.figures).toEqual([
      { key: 'days', label: 'Practice days', count: 3, up: 'More than last week' },
      { key: 'minutes', label: 'Minutes', count: 36, up: 'More than last week' },
      { key: 'quests', label: 'New quests', count: 2, up: 'More than last week' },
      { key: 'cards', label: 'New cards', count: 1, up: null },
      { key: 'letters', label: 'New letters', count: 2, up: 'More than last week' },
    ]);
    expect(view.thisPeriod?.growth).toBeNull();
  });

  it('the week calendar: seven cells, practiced or none, and a sentence that names practiced days only', () => {
    const calendar = view.thisPeriod?.calendar;
    expect(calendar?.lead).toBe(0);
    expect(calendar?.cells.map((cell) => `${cell.weekday}${cell.date}:${cell.kind}`)).toEqual([
      'T6:none',
      'W7:practiced',
      'T8:practiced',
      'F9:none',
      'S10:none',
      'S11:none',
      'M12:practiced',
    ]);
    expect(calendar?.sentence).toBe('Practiced on Wednesday, Thursday and Monday.');
  });

  it('More detail: totals first, letter tiles with the content gloss, the level check and the device plan rows', () => {
    const blocks = view.moreDetail?.blocks;
    expect(view.moreDetail?.button).toBe('More detail');
    expect(blocks?.[0]).toEqual({ kind: 'totals', line: 'Since the start: 6 quests, 5 cards' });
    expect(block(blocks, 'strong')).toMatchObject({ heading: 'Letters Sam knows well', more: 0 });
    const strong = block(blocks, 'strong');
    expect(strong?.kind === 'letters' ? strong.tiles.map((t) => t.letter) : []).toEqual(['ㅏ', 'ㅓ', 'ㄱ', 'ㄴ']);
    const practising = block(blocks, 'practising');
    expect(practising?.kind === 'letters' ? practising.tiles : []).toEqual([
      { letter: 'ㅂ', romanization: 'b', detail: GLOSS['ㅂ'] },
      { letter: 'ㅅ', romanization: 's', detail: null },
    ]);
    expect(block(blocks, 'new')).toMatchObject({ heading: 'New letters this period' });
    expect(block(blocks, 'milestones')).toBeUndefined();
    expect(block(blocks, 'levelCheck')).toEqual({
      kind: 'lines',
      key: 'levelCheck',
      heading: 'Level check',
      lines: [
        'Starting spot: Stage 1 · Letters and sounds · Sep 14',
        'Checked Sep 14',
        'Letters (shapes): Secure',
        'Sounds of letters: Getting there',
        'Reading syllables: Not checked yet',
        'Words: Not checked yet',
        'Sentences: Not checked yet',
      ],
    });
    expect(block(blocks, 'plan')).toEqual({ kind: 'lines', key: 'plan', heading: 'Plan', lines: ['Plans and homework: 3 done, 2 ready to play'] });
  });

  it('never a percentage or an oral stage anywhere in the view', () => {
    const json = JSON.stringify(view);
    expect(json).not.toMatch(/%|oral/i);
  });
});

describe('inAppReportView: the second voice (OD-17)', () => {
  const view = inAppReportView(input({ voice: 'second', summary: summary({ selfRoute: { done: 1, total: 4, notReady: 0, weeks: 2, endsOn: '2026-10-20' } }) }));

  it('"Your report", second-person headline and lines, and the own-route plan row', () => {
    expect(view.title).toBe('Your report');
    expect(view.headline?.text).toBe('You practiced on 3 days this week.');
    expect(texts(view.wentWell?.lines)[0]).toBe('You got strong on ㅏ (a) and ㅓ (eo).');
    expect(block(view.moreDetail?.blocks, 'strong')).toMatchObject({ heading: 'Letters you know well' });
    expect(block(view.moreDetail?.blocks, 'plan')).toMatchObject({ lines: ['Plans and homework: 3 done, 2 ready to play', 'Own route: 1 done, 3 ready to play'] });
  });

  it('the empty state talks to the learner', () => {
    const empty = inAppReportView(input({ voice: 'second', summary: summary({ activity: activity({ days: [], months: [], total: { since: null, min: 0, q: 0, c: 0, w: 0, days: 0 } }) }) }));
    expect(empty.state).toBe('empty');
    expect(empty.notices).toEqual(['You have not started yet. The report fills in after your first practice.']);
  });
});

describe('inAppReportView: periods and steps', () => {
  it('Today: the day headline, W lines and P1 only, no calendar and no stepper Next', () => {
    const view = inAppReportView(input({ period: 'day' }));
    expect(view.headline?.text).toBe('Sam practiced today.');
    expect(texts(view.wentWell?.lines)).toEqual(['Sam made time to practice.']);
    expect(view.practiceNext?.lines.map((line) => line.code)).toEqual(['letters_revisit']);
    expect(view.thisPeriod?.calendar).toBeNull();
    expect(view.stepper?.range).toBe('Oct 12');
    expect(view.stepper?.prev).toEqual({ at: '2026-10-11', label: 'Yesterday', name: 'Show yesterday' });
    expect(view.announce).toBe('Showing today');
  });

  it('a day two steps back reads its date; the same in the second voice', () => {
    const view = inAppReportView(input({ period: 'day', at: '2026-10-08' }));
    expect(view.headline?.text).toBe('Sam practiced on Oct 8.');
    expect(view.stepper?.next).toEqual({ at: '2026-10-09', label: 'Next', name: 'Show Oct 9' });
    expect(view.announce).toBe('Showing Oct 8');
    expect(texts(inAppReportView(input({ period: 'day', at: '2026-10-08', voice: 'second' })).wentWell?.lines)).toEqual(['You got strong on ㅓ (eo).', '1 new quest finished.']);
    expect(texts(inAppReportView(input({ period: 'day', voice: 'second' })).wentWell?.lines)).toEqual(['You made time to practice.']);
    expect(inAppReportView(input({ period: 'day', voice: 'second' })).headline?.text).toBe('You practiced today.');
  });

  it('last week: the first step back, compared with the week before, Next back to this week', () => {
    const view = inAppReportView(input({ at: '2026-10-05' }));
    expect(view.headline?.text).toBe('Sam practiced on 2 days last week.');
    expect(view.stepper?.next).toEqual({ at: null, label: 'Next', name: 'Show this week' });
    expect(view.stepper?.prev?.label).toBe('Sep 22 to Sep 28');
    expect(view.announce).toBe('Showing last week');
  });

  it('an older week names its last day, and the oldest week has no Previous', () => {
    const older = inAppReportView(input({ at: '2026-09-28' }));
    expect(older.headline?.text).toBe('No practice in the week to Sep 28.');
    // Step back until the stepper stops: the oldest week inside the 35 day rows has no Previous.
    let at: string | null = null;
    let steps = 0;
    for (;;) {
      const prev: { at: string | null } | null = inAppReportView(input({ at })).stepper?.prev ?? null;
      if (prev === null) break;
      at = prev.at;
      steps += 1;
    }
    expect(steps).toBeGreaterThanOrEqual(3);
    expect(inAppReportView(input({ at })).stepper?.next).not.toBeNull();
  });

  it('This month: the month grid from Monday, compared with all of last month', () => {
    const view = inAppReportView(input({ period: 'month' }));
    expect(view.headline?.text).toBe('Sam practiced on 4 days this month.');
    expect(view.stepper?.range).toBe('October 2026');
    expect(view.stepper?.prev?.label).toBe('Last month');
    expect(view.thisPeriod?.calendar?.lead).toBe(3);
    expect(view.thisPeriod?.calendar?.cells).toHaveLength(12);
    expect(view.thisPeriod?.calendar?.sentence).toBe('Practiced on Oct 1, Oct 7, Oct 8 and Oct 12.');
    expect(view.thisPeriod?.figures?.find((f) => f.key === 'minutes')?.up).toBe('More than all of last month');
  });

  it('last month and an older month read their own words', () => {
    expect(inAppReportView(input({ period: 'month', at: '2026-09-30' })).headline?.text).toBe('Sam practiced on 4 days last month.');
    const withAugust = summary({ activity: activity({ months: [{ m: '2026-08', min: 0, q: 0, c: 0, w: 0, days: 0 }, ...activity().months] }) });
    const older = inAppReportView(input({ period: 'month', at: '2026-08-31', summary: withAugust }));
    expect(older.headline?.text).toBe('No practice in August 2026.');
    expect(older.announce).toBe('Showing August 2026');
  });

  it('All time: the growth block, which only rises, and no stepper', () => {
    const view = inAppReportView(input({ period: 'all' }));
    expect(view.headline?.text).toBe('Sam practiced on 8 days so far.');
    expect(view.stepper).toBeNull();
    expect(view.announce).toBe('Showing all time');
    expect(view.thisPeriod?.calendar).toBeNull();
    expect(view.thisPeriod?.growth).toEqual({
      since: 'Since Sep 14: 8 practice days',
      quests: 'Quests',
      cards: 'Cards',
      month: 'Month',
      caption: 'Quests and cards by month',
      showTable: 'Show as table',
      hideTable: 'Hide table',
      rows: [
        { m: '2026-09', label: 'September 2026', quests: 3, cards: 3 },
        { m: '2026-10', label: 'October 2026', quests: 6, cards: 5 },
      ],
      max: 6,
    });
    expect(block(view.moreDetail?.blocks, 'new')).toBeUndefined();
  });

  it('All time without a first day has no "since"; an empty month list scales to the baseline', () => {
    const view = inAppReportView(input({ period: 'all', summary: summary({ activity: activity({ months: [], total: { since: null, min: 0, q: 2, c: 0, w: 0, days: 3 } }) }) }));
    expect(view.thisPeriod?.growth).toMatchObject({ since: null, rows: [], max: 2 });
    const zero = inAppReportView(input({ period: 'all', summary: summary({ activity: activity({ months: [], total: { since: null, min: 0, q: 0, c: 0, w: 0, days: 3 } }) }) }));
    expect(zero.thisPeriod?.growth?.max).toBe(1);
  });
});

describe('inAppReportView: headlines, horizons and milestones', () => {
  it('a stage finished in the window leads the headline and lists the milestone', () => {
    const s = summary({ activity: activity({ milestones: [{ stage: 'stage1', on: '2026-10-08' }] }) });
    const view = inAppReportView(input({ summary: s }));
    expect(view.headline?.text).toBe('Sam finished Stage 1: Hangul this week!');
    expect(block(view.moreDetail?.blocks, 'milestones')).toEqual({ kind: 'lines', key: 'milestones', heading: 'Milestones', lines: ['Stage 1: Hangul, finished Oct 8'] });
    expect(inAppReportView(input({ summary: s, voice: 'second' })).headline?.text).toBe('You finished Stage 1: Hangul this week!');
    expect(inAppReportView(input({ summary: s, period: 'all' })).headline?.text).toBe('Sam finished Stage 1: Hangul!');
    expect(inAppReportView(input({ summary: s, period: 'all', voice: 'second' })).headline?.text).toBe('You finished Stage 1: Hangul!');
  });

  it('the stage_done went-well line, in both voices', () => {
    const s = summary({ activity: activity({ milestones: [{ stage: 'stage1', on: '2026-10-08' }, { stage: 'stage2', on: '2026-10-07' }] }) });
    const report = learnerReport({ summary: s, viewer: 'device', voice: 'third', period: 'week', now: NOW, catalog: CATALOG, lastSyncedAt: null });
    const line: InsightLine = { code: 'stage_done', params: { stage: { stage: 'stage2', n: 2 } } };
    expect(insightView(line, reportWordsOf(report, input(), '2026-10-12'))?.sentence.text).toBe('Sam finished Stage 2: Words.');
    const second = { ...report, voice: 'second' as const };
    expect(insightView(line, reportWordsOf(second, input(), '2026-10-12'))?.sentence.text).toBe('You finished Stage 2: Words.');
  });

  it('no practice this week: the neutral headline, no went-well section, the rhythm line first', () => {
    const s = summary({ activity: activity({ days: activity().days.slice(0, 2) }) });
    const view = inAppReportView(input({ summary: s }));
    expect(view.headline?.text).toBe('No practice yet this week.');
    expect(view.wentWell).toBeNull();
    expect(view.practiceNext?.lines[0]?.code).toBe('rhythm');
    expect(view.thisPeriod?.calendar?.sentence).toBe('No practice days in this period.');
    expect(inAppReportView(input({ summary: s, period: 'all', at: null })).headline?.text).not.toBe('No practice yet.');
  });

  it('a window after the last saved day: none_saved, no figures; a past one names the last day', () => {
    const later = new Date('2026-10-20T15:00:00.000Z');
    const view = inAppReportView(input({ now: later, period: 'day' }));
    expect(view.headline).toEqual({ text: "Nothing saved from Sam's device today yet.", horizon: null });
    expect(view.thisPeriod?.figures).toBeNull();
    expect(inAppReportView(input({ now: later, period: 'day', voice: 'second' })).headline?.text).toBe('Nothing saved on your device today yet.');
    expect(inAppReportView(input({ now: later, period: 'day', at: '2026-10-19' })).headline?.text).toBe("Nothing saved from Sam's device after Oct 12 yet.");
    expect(inAppReportView(input({ now: later, period: 'day', at: '2026-10-19', voice: 'second' })).headline?.text).toBe('Nothing saved on your device after Oct 12 yet.');
  });

  it('a window that reaches past the last saved day says "Figures up to"; a not-saved cell draws as none', () => {
    const view = inAppReportView(input({ now: new Date('2026-10-14T15:00:00.000Z') }));
    expect(view.headline?.horizon).toBe('Figures up to Oct 12.');
    expect(view.thisPeriod?.calendar?.cells.slice(-2).map((cell) => cell.kind)).toEqual(['none', 'none']);
  });

  it('fewer than 2 practice days ever: getting started, in both voices', () => {
    const s = summary({ activity: activity({ days: [{ d: '2026-10-12', min: 4, q: 0, c: 0, w: 0, j: [] }], total: { since: '2026-10-12', min: 4, q: 0, c: 0, w: 0, days: 1 } }) });
    expect(inAppReportView(input({ summary: s })).headline?.text).toBe('Sam is just getting started.');
    expect(inAppReportView(input({ summary: s, voice: 'second' })).headline?.text).toBe('You are just getting started.');
  });

  it('an invalid clock reads the last saved day as today', () => {
    const view = inAppReportView(input({ now: new Date(Number.NaN) }));
    expect(view.headline?.text).toBe('Sam practiced on 3 days this week.');
  });

  it('a date in another year shows its year', () => {
    const view = inAppReportView(input({ now: new Date('2027-01-02T12:00:00.000Z'), summary: summary({ activity: activity({ asOf: '2027-01-02' }) }) }));
    expect(view.glance?.lastPractice).toBe('Last practice: Oct 12, 2026');
  });
});

describe('inAppReportView: states', () => {
  it('empty: the neutral notice, Now on from the journey, no tabs and no period figures', () => {
    const s = summary({ activity: activity({ days: [], months: [], total: { since: null, min: 0, q: 0, c: 0, w: 0, days: 0 } }), lastActiveAt: '' });
    const view = inAppReportView(input({ summary: s }));
    expect(view.state).toBe('empty');
    expect(view.notices).toEqual(['Sam has not started yet. The report fills in after the first practice.']);
    expect(view.glance).toEqual({ nowOn: 'Now on Stage 1: Hangul', openRoute: 'Open Learning Route', lastPractice: null });
    expect(view.tabs).toBeNull();
    expect(view.stepper).toBeNull();
    expect(view.announce).toBeNull();
    expect(view.headline).toBeNull();
    expect(view.thisPeriod).toBeNull();
    expect(view.wentWell).toBeNull();
    expect(texts(view.practiceNext?.lines)).toEqual(['Next in the plan: Family at the Table.']);
  });

  it('empty with a stage this build cannot read draws no Now on; without the route page, no link', () => {
    const s = summary({ activity: activity({ days: [], months: [], total: { since: null, min: 0, q: 0, c: 0, w: 0, days: 0 } }), journey: { v: 1, here: 'stage9', stages: [] } });
    expect(inAppReportView(input({ summary: s, learningRoute: false })).glance).toEqual({ nowOn: null, openRoute: null, lastPractice: null });
  });

  it('legacy (no day-by-day data): the neutral line, the glance and More detail only', () => {
    const view = inAppReportView(input({ summary: summary({ activity: undefined }) }));
    expect(view.state).toBe('legacy');
    expect(view.notices).toEqual(['Day-by-day figures are not available yet.']);
    expect(view.tabs).toBeNull();
    expect(view.headline).toBeNull();
    expect(view.moreDetail?.blocks[0]).toEqual({ kind: 'totals', line: 'Since the start: 6 quests, 5 cards' });
    expect(view.glance?.lastPractice).toBe('Last practice: Oct 12');
  });

  it('no summary: the error line and nothing else', () => {
    const view = inAppReportView(input({ summary: null }));
    expect(view.state).toBe('no_data');
    expect(view.notices).toEqual(["Can't load the report right now."]);
    expect(view.glance).toBeNull();
    expect(view.moreDetail).toBeNull();
  });

  it('no level check, no plan, unreadable dates: those lines are left out', () => {
    const s = summary({ placement: undefined, planProgress: {}, lastActiveAt: 'not a date' });
    const view = inAppReportView(input({ summary: s }));
    expect(block(view.moreDetail?.blocks, 'levelCheck')).toBeUndefined();
    expect(block(view.moreDetail?.blocks, 'plan')).toBeUndefined();
    expect(view.glance?.lastPractice).toBeNull();
    expect(texts(view.practiceNext?.lines)).toContain('Next in the plan: Family at the Table.');
  });

  it('a level check with an unreadable time or band keeps only the strand words', () => {
    const base = summary().placement as NonNullable<InsightSummary['placement']>;
    const odd = inAppReportView(input({ summary: summary({ placement: { ...base, takenAt: 'x' } }) }));
    expect(block(odd.moreDetail?.blocks, 'levelCheck')).toMatchObject({ lines: expect.arrayContaining(['Letters (shapes): Secure']) });
    expect((block(odd.moreDetail?.blocks, 'levelCheck') as { lines: string[] }).lines[0]).toBe('Letters (shapes): Secure');
    const stage2 = inAppReportView(input({ summary: summary({ placement: { ...base, level: { stage: 'stage2', band: 0 } } }) }));
    expect((block(stage2.moreDetail?.blocks, 'levelCheck') as { lines: string[] }).lines[0]).toBe('Starting spot: Stage 2 · First words · Sep 14');
    const stage3 = inAppReportView(input({ summary: summary({ placement: { ...base, level: { stage: 'stage3', band: 0 } } }) }));
    expect((block(stage3.moreDetail?.blocks, 'levelCheck') as { lines: string[] }).lines[0]).toBe('Starting spot: Stage 3 · First sentences · Sep 14');
  });
});

describe('insightView: every code the app words', () => {
  const report = learnerReport({ summary: summary(), viewer: 'device', voice: 'third', period: 'week', now: NOW, catalog: CATALOG, lastSyncedAt: null });
  const third = reportWordsOf(report, input(), '2026-10-12');
  const second = reportWordsOf({ ...report, voice: 'second' }, input(), '2026-10-12');
  const day = reportWordsOf({ ...report, period: 'day' as ReportPeriod }, input(), '2026-10-12');
  const say = (line: InsightLine, w = third): string | undefined => insightView(line, w)?.sentence.text;

  it('counts, plans, streak and level lines', () => {
    expect(say({ code: 'practice_days', params: { days: 4 } })).toBe('Sam practiced on 4 days.');
    expect(say({ code: 'practice_days', params: { days: 4 } }, second)).toBe('You practiced on 4 days.');
    expect(say({ code: 'practice_days', params: { days: 1 } }, day)).toBe('Sam made time to practice.');
    expect(say({ code: 'showed_up', params: { days: 1, period: 'week' } })).toBe('Sam practiced on 1 day this week.');
    expect(say({ code: 'showed_up', params: { days: 1, period: 'week' } }, second)).toBe('You practiced on 1 day this week.');
    expect(say({ code: 'cards_new', params: { count: 1 } })).toBe('1 new heritage card collected.');
    expect(say({ code: 'level_secure', params: { strands: ['hangul-recognition', 'sound-letter'] } })).toBe('Level check: Letters (shapes) and Sounds of letters look secure.');
    expect(say({ code: 'plan_done', params: { done: 3, kind: 'family' } })).toBe("Everything in this week's plan is done.");
    expect(say({ code: 'plan_open', params: { count: 1, kind: 'class' } })).toBe('1 homework item is ready to play.');
    expect(say({ code: 'streak', params: { days: 3 } })).toBe('3 days in a row. Hoya is proud!');
    expect(say({ code: 'rhythm', params: {} })).toBe('A short session on two days a week is a great start.');
  });

  it('the app next: on the route, in the plan, the free lessons; an unknown quest is not worded', () => {
    expect(say({ code: 'next_on_route', params: { questId: 'quest:stage1-letters-q1' } })).toBe('Next on the Learning Route: Meet a, eo, g, n.');
    const quest = insightView({ code: 'next_on_route', params: { questId: 'quest:stage1-letters-q1' } }, third)?.sentence.parts;
    expect(quest).toEqual([
      { kind: 'text', text: 'Next on the Learning Route: ' },
      { kind: 'quest', id: 'quest:stage1-letters-q1', title: 'Meet a, eo, g, n' },
      { kind: 'text', text: '.' },
    ]);
    expect(insightView({ code: 'next_in_plan', params: { questId: 'quest:stage1-gone-q9' } }, third)).toBeNull();
    expect(say({ code: 'free_days_done', params: {} })).toBe('Sam finished the free lessons.');
    expect(say({ code: 'free_days_done', params: {} }, second)).toBe('You finished the free lessons.');
  });

  it('word lines are never worded on the device (words stay hidden until F-VOC-005 P-4b)', () => {
    expect(insightView({ code: 'words_new', params: { count: 6 } }, third)).toBeNull();
    expect(insightView({ code: 'words_revisit', params: { words: ['vocab:family-mom'] } }, third)).toBeNull();
  });

  it('every strand tip, and the second-voice tips that drop "together"', () => {
    const tip = (strand: 'hangul-recognition' | 'sound-letter' | 'syllable-reading' | 'vocabulary' | 'sentences', w = third) =>
      insightView({ code: 'strand_next', params: { strand } }, w)?.tip;
    expect(tip('hangul-recognition')).toBe('Letter games help: try Match the shapes.');
    expect(tip('sound-letter')).toBe('Listening games help: try Listen and pick.');
    expect(tip('syllable-reading')).toBe('Read short words together.');
    expect(tip('syllable-reading', second)).toBe('Read short words.');
    expect(tip('sentences', second)).toBe('Read a short story.');
    expect(tip('vocabulary', second)).toBe('Word cards help: try a word topic.');
  });

  it('headlineText is null without day-by-day data', () => {
    const legacy = learnerReport({ summary: summary({ activity: undefined }), viewer: 'device', voice: 'third', period: 'week', now: NOW, catalog: CATALOG, lastSyncedAt: null });
    expect(headlineText(legacy, third)).toBeNull();
  });
});

describe('letters and sentence parts', () => {
  it('letterLabel: consonants, vowels, the silent circle and an unknown symbol', () => {
    expect(letterLabel('ㄱ')).toEqual({ letter: 'ㄱ', romanization: 'g' });
    expect(letterLabel('ㅓ')).toEqual({ letter: 'ㅓ', romanization: 'eo' });
    expect(letterLabel('ㅇ')).toEqual({ letter: 'ㅇ', romanization: 'ng' });
    expect(letterLabel('ㄳ')).toEqual({ letter: 'ㄳ', romanization: null });
    expect(letterLabel('ㅏㅏ')).toEqual({ letter: 'ㅏㅏ', romanization: null });
  });

  it('an unknown letter in a sentence shows alone; a part used twice is drawn once', () => {
    const report = learnerReport({ summary: summary(), viewer: 'device', voice: 'third', period: 'week', now: NOW, catalog: CATALOG, lastSyncedAt: null });
    const line = insightView({ code: 'letters_revisit', params: { letters: ['ㄳ'], questId: null } }, reportWordsOf(report, input(), '2026-10-12'));
    expect(line?.sentence.parts[0]).toEqual({ kind: 'letter', letter: 'ㄳ', romanization: null, before: '', after: '' });
    const twice = sentenceOf((put) => {
      const a = put({ kind: 'quest', id: 'quest:x', title: 'X' });
      return `${a} and ${a}\u0001`;
    });
    expect(twice).toEqual({ text: 'X and ', parts: [{ kind: 'quest', id: 'quest:x', title: 'X' }, { kind: 'text', text: ' and ' }] });
  });
});

describe('dates without Intl', () => {
  it('falls back to the short built-in formats', () => {
    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => {
      throw new RangeError('no Intl');
    });
    const view = inAppReportView(input({ period: 'month' }));
    expect(view.stepper?.range).toBe('Oct 1, 2026');
    const week = inAppReportView(input());
    expect(week.thisPeriod?.calendar?.sentence).toBe('Practiced on Wed, Thu and Mon.');
    expect(week.thisPeriod?.calendar?.cells[0]?.weekday).toBe('Tue');
  });
});
