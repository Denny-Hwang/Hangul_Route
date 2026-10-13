import {
  CATALOG,
  INSIGHT_CODES,
  learnerReport,
  type InsightLine,
  type LearnerReport,
  type ReportSummary,
} from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it, vi } from 'vitest';
import type { ApiResult } from '../api';
import {
  headlineText,
  insightView,
  learnerReportView,
  letterLabel,
  reportBackLink,
  reportLoadProblem,
  reportQueryOf,
  reportViewerRights,
  reportWordsOf,
  type LearnerReportView,
  type LearnerReportViewInput,
  type ReportSentence,
} from '../report-view';
import { ROUTES } from '../routing';
import { EMPTY, LEGACY, NOW, PLACEMENT, STALE, STEADY, response, stageTitle } from './fixtures/report';

/** F-REPORT-001 RP-7a1: the console's report words, links and states from the report module's codes. */

const en = getMessages('en');

function view(summary: ReportSummary | null, over: Partial<LearnerReportViewInput> & { kind?: 'family' | 'class' | 'school'; archivedAt?: string | null; name?: string } = {}): LearnerReportView {
  const { kind, archivedAt, name, ...rest } = over;
  const out = learnerReportView({
    data: response(summary, { kind, archivedAt, name }),
    query: { period: 'week', at: null, from: null },
    now: NOW,
    role: 'owner',
    stageTitle,
    tipGames: { 'sound-letter': 'Listen and pick', 'hangul-recognition': 'Match the sound' },
    ...rest,
  });
  if (out === null) throw new Error('no view');
  return out;
}

const texts = (lines: { sentence: ReportSentence }[] | undefined): string[] => (lines ?? []).map((line) => line.sentence.text);

describe('letterLabel: a taught letter with its short sound value, as two parts', () => {
  it('reads consonants and vowels by Revised Romanization', () => {
    expect(letterLabel('ㅂ')).toEqual({ letter: 'ㅂ', romanization: 'b' });
    expect(letterLabel('ㅅ')).toEqual({ letter: 'ㅅ', romanization: 's' });
    expect(letterLabel('ㄲ')).toEqual({ letter: 'ㄲ', romanization: 'kk' });
    expect(letterLabel('ㅓ')).toEqual({ letter: 'ㅓ', romanization: 'eo' });
    expect(letterLabel('ㅢ')).toEqual({ letter: 'ㅢ', romanization: 'ui' });
    expect(letterLabel('ㅣ')).toEqual({ letter: 'ㅣ', romanization: 'i' });
  });

  it('gives ㅇ its heard sound, ng (it is silent at the start of a block)', () => {
    expect(letterLabel('ㅇ')).toEqual({ letter: 'ㅇ', romanization: 'ng' });
  });

  it('has no romanization for a symbol it does not know, and never invents one', () => {
    expect(letterLabel('ㄳ')).toEqual({ letter: 'ㄳ', romanization: null });
    expect(letterLabel('가')).toEqual({ letter: '가', romanization: null });
  });
});

describe('the week report of a steady learner (behaviour 1, family viewer)', () => {
  const v = view(STEADY);

  it('titles the page with the roster name and keeps the name out of document.title', () => {
    expect(v.title).toBe('Mina: report');
    expect(v.documentTitle).toBe('Report - Hangul Route');
    expect(v.documentTitle).not.toContain('Mina');
  });

  it('reads the headline, the two at-a-glance lines and no notice', () => {
    expect(v.state).toBe('ready');
    expect(v.headline).toEqual({ text: 'Mina practiced on 3 days this week.', horizon: null });
    expect(v.glance).toEqual({ nowOn: 'Now on Stage 1: Hangul', lastPractice: 'Last practice: Oct 15', route: null, region: 'Learning Route' });
    expect(v.notices).toEqual([]);
    expect(v.archived).toBeNull();
  });

  it('draws the four tabs with the week selected and announces the window', () => {
    expect(v.tabs?.map((tab) => [tab.label, tab.selected])).toEqual([
      ['Today', false],
      ['This week', true],
      ['This month', false],
      ['All time', false],
    ]);
    expect(v.tabs?.[2]?.href).toBe('/teach/space/learner?id=space%3Akim-family&learner=profile%3Amina&period=month');
    expect(v.tabsLabel).toBe('Report period');
    expect(v.announce).toBe('Showing this week');
  });

  it('names the window in the stepper and names the first step back', () => {
    expect(v.stepper).toEqual({
      range: 'Oct 9 to Oct 15',
      prev: { href: '/teach/space/learner?id=space%3Akim-family&learner=profile%3Amina&period=week&at=2026-10-08', label: 'Last week', name: 'Show last week' },
      next: null,
    });
  });

  it('lists what went well: new letters with their sounds, then new quests and cards (W3 is skipped under a practiced headline)', () => {
    expect(v.wentWell?.heading).toBe('What went well');
    expect(texts(v.wentWell?.lines)).toEqual(['Mina got strong on ㄱ (g) and ㄴ (n).', '2 new quests finished.', '1 new heritage card collected.']);
    const letters = v.wentWell?.lines[0]?.sentence.parts.filter((part) => part.kind === 'letter');
    expect(letters).toEqual([
      { kind: 'letter', letter: 'ㄱ', romanization: 'g', before: '', after: ' (g)' },
      { kind: 'letter', letter: 'ㄴ', romanization: 'n', before: '', after: ' (n)' },
    ]);
  });

  it('lists what to practice next with the plan actions a grown-up with plan.write gets', () => {
    expect(v.practiceNext?.heading).toBe('What to practice next');
    expect(texts(v.practiceNext?.lines)).toEqual(['ㅂ (b) and ㅅ (s): worth another visit.', 'Sounds of letters is next to grow.', '4 plan items are ready to play.']);
    expect(v.practiceNext?.lines[0]?.action).toEqual({ href: '/parent/space/plan?id=space%3Akim-family&add=quest%3Astage1-life-q2', text: 'Add to a plan' });
    expect(v.practiceNext?.lines[1]?.tip?.text).toBe('Listening games help: try Listen and pick.');
    expect(v.practiceNext?.lines[1]?.action).toBeNull();
    // Two plans hold the open items (the family plan and the own route): no single plan to open.
    expect(v.practiceNext?.lines[2]?.action).toBeNull();
  });

  it('shows the figures with "More than last week" only where they grew, and the calendar sentence', () => {
    expect(v.thisPeriod?.heading).toBe('This period');
    expect(v.thisPeriod?.figures).toEqual([
      { key: 'days', label: 'Practice days', count: 3, up: 'More than last week' },
      { key: 'minutes', label: 'Minutes', count: 36, up: null },
      { key: 'quests', label: 'New quests', count: 2, up: null },
      { key: 'cards', label: 'New cards', count: 1, up: null },
      { key: 'letters', label: 'New letters', count: 2, up: 'More than last week' },
    ]);
    const calendar = v.thisPeriod?.calendar;
    expect(calendar?.cells.map((cell) => [cell.day, cell.kind, cell.weekday, cell.date])).toEqual([
      ['2026-10-09', 'none', 'Fri', 9],
      ['2026-10-10', 'none', 'Sat', 10],
      ['2026-10-11', 'none', 'Sun', 11],
      ['2026-10-12', 'practiced', 'Mon', 12],
      ['2026-10-13', 'none', 'Tue', 13],
      ['2026-10-14', 'practiced', 'Wed', 14],
      ['2026-10-15', 'practiced', 'Thu', 15],
    ]);
    expect(calendar?.lead).toBe(0);
    expect(calendar?.practiced).toBe('Practiced on Monday, Wednesday and Thursday.');
    expect(calendar?.notSaved).toBeNull();
    expect(v.thisPeriod?.growth).toBeNull();
  });

  it('holds More detail behind one button: the totals first, letters as two-part tiles, the level check in words, the plan', () => {
    const detail = v.moreDetail;
    expect(detail?.button).toBe('More detail');
    // The totals lead without a heading; no Milestones heading without a milestone in the window (design pass #444).
    expect(detail?.blocks[0]).toEqual({ kind: 'totals', line: 'Since the start: 7 quests, 5 cards' });
    expect(detail?.blocks.slice(1).map((block) => ('heading' in block ? block.heading : null))).toEqual([
      'Letters Mina knows well',
      'Letters being practiced',
      'New letters this period',
      'Level check',
      'Plan',
    ]);
    const strong = detail?.blocks[1];
    expect(strong?.kind === 'letters' ? strong.letters.slice(0, 2) : null).toEqual([
      { letter: 'ㅏ', romanization: 'a' },
      { letter: 'ㅓ', romanization: 'eo' },
    ]);
    expect(strong?.kind === 'letters' ? strong.more : null).toBe(0);
    expect(detail?.blocks[4]).toEqual({
      kind: 'lines',
      heading: 'Level check',
      lines: [
        'Starting spot: Stage 1 · Letters and sounds · Oct 10',
        'Checked Oct 10',
        'Letters (shapes): Secure',
        'Sounds of letters: Getting there',
        'Reading syllables: Next to learn',
        'Words: Not checked yet',
        'Sentences: Not checked yet',
      ],
    });
    expect(detail?.blocks[5]).toEqual({ kind: 'lines', heading: 'Plan', lines: ["This week's plan: 3 done, 2 ready to play", 'Own route: 2 done, 2 ready to play'] });
  });

  it('dates the level check and its starting spot on the learner-local day, with the year when it is not this year', () => {
    // 05:00 UTC on Oct 11 is 22:00 on Oct 10 in Los Angeles, the learner's zone (OD-12); the viewer's zone never moves it.
    const late = view({ ...STEADY, placement: { ...PLACEMENT, takenAt: '2026-10-11T05:00:00.000Z' } });
    const lines = (v2: LearnerReportView): string[] => {
      const block = v2.moreDetail?.blocks.find((b) => 'heading' in b && b.heading === 'Level check');
      return block?.kind === 'lines' ? block.lines : [];
    };
    expect(lines(late).slice(0, 2)).toEqual(['Starting spot: Stage 1 · Letters and sounds · Oct 10', 'Checked Oct 10']);
    const lastYear = view({ ...STEADY, placement: { ...PLACEMENT, takenAt: '2025-10-11T05:00:00.000Z' } });
    expect(lines(lastYear).slice(0, 2)).toEqual(['Starting spot: Stage 1 · Letters and sounds · Oct 10, 2025', 'Checked Oct 10, 2025']);
    const unreadable = view({ ...STEADY, placement: { ...PLACEMENT, takenAt: 'not a date' } });
    expect(lines(unreadable).some((line) => line.startsWith('Checked') || line.startsWith('Starting spot'))).toBe(false);
  });

  it('never prints a percentage, a speaking word or a comparison with anyone else', () => {
    // Every word on the page, without the URLs (whose ids are percent-encoded).
    const all = JSON.stringify(v, (key, value: unknown) => (key === 'href' ? undefined : value));
    expect(all).not.toMatch(/%|percent|speak|pronounc|average|rank/i);
    expect(all).not.toContain('0.86');
  });
});

describe('the teacher variant (class viewer)', () => {
  const v = view(STEADY, { kind: 'class' });

  it('reads homework words, the class plan row and the route next, never the family plan', () => {
    expect(v.moreDetail?.blocks.at(-1)).toEqual({ kind: 'lines', heading: 'Plan', lines: ['Homework: 3 done, 2 ready to play'] });
    expect(texts(v.practiceNext?.lines)).toContain('2 homework items are ready to play.');
  });

  it('offers Open the plan when one class plan holds every open item', () => {
    const line = v.practiceNext?.lines.find((l) => l.code === 'plan_open');
    expect(line?.action).toEqual({ href: '/teach/space/plan?id=space%3Asunflower&plan=plan%3Afamily-week', text: 'Open the plan' });
  });

  it('draws no action without plan.write (a school admin) and none on an archived class', () => {
    const admin = view(STEADY, { kind: 'class', role: null });
    expect(admin.practiceNext?.lines.every((line) => line.action === null)).toBe(true);
    expect(view(STEADY, { kind: 'class', role: 'teacher' }).practiceNext?.lines.some((line) => line.action !== null)).toBe(true);
    const archived = view(STEADY, { kind: 'class', archivedAt: '2026-10-01T00:00:00.000Z' });
    expect(archived.practiceNext?.lines.every((line) => line.action === null)).toBe(true);
  });

  it('says an archived space is read-only: the settings sentence to its owner, the neutral report line to everyone else', () => {
    const at = '2026-10-01T00:00:00.000Z';
    expect(view(STEADY, { kind: 'class', archivedAt: at, role: 'owner' }).archived).toBe('This class is archived — read-only until you unarchive it.');
    expect(view(STEADY, { kind: 'class', archivedAt: at, role: 'teacher' }).archived).toBe('This class is archived. Its report is read-only.');
    expect(view(STEADY, { kind: 'class', archivedAt: at, role: null }).archived).toBe('This class is archived. Its report is read-only.');
    expect(view(STEADY, { kind: 'family', archivedAt: at, role: 'owner' }).archived).toBe('This family is archived — read-only until you unarchive it.');
    expect(view(STEADY, { kind: 'family', archivedAt: at, role: 'caregiver' }).archived).toBe('This family space is archived. Its report is read-only.');
    expect(view(STEADY, { kind: 'class', role: 'teacher' }).archived).toBeNull();
  });

  it('shows the anonymized roster name it is given, in the title only', () => {
    const anon = view(STEADY, { kind: 'class', name: 'M.K.' });
    expect(anon.title).toBe('M.K.: report');
    expect(anon.documentTitle).toBe('Report - Hangul Route');
  });
});

describe('periods and steps', () => {
  it('Today: the day sentence, only P1 in practice next, no calendar, no "more than"', () => {
    const v = view(STEADY, { query: { period: 'day', at: null, from: null } });
    expect(v.headline?.text).toBe('Mina practiced today.');
    expect(texts(v.wentWell?.lines)).toEqual(['Mina got strong on ㄴ (n).', '1 new quest finished.']);
    expect(v.practiceNext?.lines.map((l) => l.code)).toEqual(['letters_revisit']);
    expect(v.thisPeriod?.calendar).toBeNull();
    expect(v.thisPeriod?.figures?.every((f) => f.up === null)).toBe(true);
    expect(v.stepper).toEqual({
      range: 'Oct 15',
      prev: { href: '/teach/space/learner?id=space%3Akim-family&learner=profile%3Amina&period=day&at=2026-10-14', label: 'Yesterday', name: 'Show yesterday' },
      next: null,
    });
    expect(v.announce).toBe('Showing today');
  });

  it('a week back: the dates of the older week on Previous, Next back to this week, "the week before" for growth', () => {
    const v = view(STEADY, { query: { period: 'week', at: '2026-10-08', from: 'roster' } });
    expect(v.headline?.text).toBe('Mina practiced on 2 days last week.');
    expect(v.stepper).toEqual({
      range: 'Oct 2 to Oct 8',
      prev: {
        href: '/teach/space/learner?id=space%3Akim-family&learner=profile%3Amina&period=week&at=2026-10-01&from=roster',
        label: 'Sep 25 to Oct 1',
        name: 'Show Sep 25 to Oct 1',
      },
      next: { href: '/teach/space/learner?id=space%3Akim-family&learner=profile%3Amina&period=week&from=roster', label: 'Next', name: 'Next: show this week' },
    });
    expect(v.thisPeriod?.figures?.find((f) => f.key === 'minutes')?.up).toBe('More than the week before');
    expect(v.wentWell?.lines.map((l) => l.code)).not.toContain('plan_done');
  });

  it('two weeks back: the window is named by its end date', () => {
    const v = view(STEADY, { query: { period: 'week', at: '2026-10-01', from: null } });
    expect(v.headline?.text).toBe('Mina practiced on 1 day in the week to Oct 1.');
    expect(v.stepper?.next).toEqual({ href: '/teach/space/learner?id=space%3Akim-family&learner=profile%3Amina&period=week&at=2026-10-08', label: 'Next', name: 'Next: show last week' });
  });

  it('a day back and two days back', () => {
    expect(view(STEADY, { query: { period: 'day', at: '2026-10-14', from: null } }).headline?.text).toBe('Mina practiced yesterday.');
    const older = view(STEADY, { query: { period: 'day', at: '2026-10-12', from: null } });
    expect(older.headline?.text).toBe('Mina practiced on Oct 12.');
    expect(older.stepper?.prev?.label).toBe('Oct 11');
    expect(older.stepper?.next?.name).toBe('Next: show Oct 13');
    expect(view(STEADY, { query: { period: 'day', at: '2026-10-13', from: null } }).headline?.text).toBe('No practice on Oct 13.');
  });

  it('This month: a month grid from Monday, "all of last month" for growth, the month named in the stepper', () => {
    const v = view(STEADY, { query: { period: 'month', at: null, from: null } });
    expect(v.headline?.text).toBe('Mina practiced on 5 days this month.');
    expect(v.stepper?.range).toBe('October 2026');
    expect(v.stepper?.prev?.label).toBe('Last month');
    expect(v.thisPeriod?.figures?.find((f) => f.key === 'quests')?.up).toBe('More than all of last month');
    // 1 October 2026 is a Thursday: three blank cells (Mon, Tue, Wed) lead the grid.
    expect(v.thisPeriod?.calendar?.lead).toBe(3);
    expect(v.thisPeriod?.calendar?.cells).toHaveLength(15);
    expect(v.thisPeriod?.calendar?.practiced).toBe('Practiced on Oct 3, Oct 6, Oct 12, Oct 14 and Oct 15.');
    expect(texts(v.wentWell?.lines)[0]).toBe('Mina got strong on ㅇ (ng), ㄱ (g) and ㄴ (n).');
  });

  it('last month, older than the day rows: totals only, no calendar, no letters figure', () => {
    const v = view(STEADY, { query: { period: 'month', at: '2026-09-01', from: null } });
    expect(v.headline?.text).toBe('Mina practiced on 6 days last month.');
    expect(v.stepper?.range).toBe('September 2026');
    expect(v.stepper?.prev).toBeNull();
    expect(v.stepper?.next).toEqual({ href: '/teach/space/learner?id=space%3Akim-family&learner=profile%3Amina&period=month', label: 'Next', name: 'Next: show this month' });
    expect(v.thisPeriod?.calendar).toBeNull();
    expect(v.thisPeriod?.figures?.map((f) => f.key)).toEqual(['days', 'minutes', 'quests', 'cards']);
  });

  it('two months back: the month is named in sentences', () => {
    const older = { ...STEADY, activity: { ...STEADY.activity, months: [{ m: '2026-08', min: 30, q: 1, c: 0, w: 0, days: 2 }, ...STEADY.activity.months] } };
    const v = view(older, { query: { period: 'month', at: '2026-08-01', from: null } });
    expect(v.headline?.text).toBe('Mina practiced on 2 days in August 2026.');
    expect(v.stepper?.next).toEqual({ href: '/teach/space/learner?id=space%3Akim-family&learner=profile%3Amina&period=month&at=2026-09-01', label: 'Next', name: 'Next: show last month' });
    expect(view(older, { query: { period: 'month', at: '2026-09-01', from: null } }).stepper?.prev?.label).toBe('August 2026');
  });

  it('All time: no stepper, the growth line with its since line and month labels, "so far" in sentences', () => {
    const v = view(STEADY, { query: { period: 'all', at: null, from: null } });
    expect(v.stepper).toBeNull();
    expect(v.headline?.text).toBe('Mina practiced on 11 days so far.');
    expect(v.announce).toBe('Showing all time');
    expect(v.thisPeriod?.calendar).toBeNull();
    expect(v.thisPeriod?.growth).toEqual({
      since: 'Since Sep 5: 11 practice days',
      quests: 'Quests',
      cards: 'Cards',
      month: 'Month',
      caption: 'Quests and cards by month',
      showTable: 'Show as table',
      hideTable: 'Hide table',
      baseline: { quests: 0, cards: 0 },
      rows: [
        { m: '2026-09', label: 'September 2026', quests: 3, cards: 3 },
        { m: '2026-10', label: 'October 2026', quests: 7, cards: 5 },
      ],
    });
    expect(v.moreDetail?.blocks.map((b) => ('heading' in b ? b.heading : null))).not.toContain('New letters this period');
  });

  it('the growth line has no "since" for a class (the first practice day may lie before the learner joined)', () => {
    expect(view(STEADY, { kind: 'class', query: { period: 'all', at: null, from: null } }).thisPeriod?.growth?.since).toBeNull();
  });
});

describe('states (section 3.14)', () => {
  it('stale, a week wholly after the last save: the neutral lines, the none_saved headline, no figures, no went-well, dashed days', () => {
    const v = view(STALE);
    expect(v.notices).toEqual(['Last saved Oct 2.', "Open Hangul Route on Mina's device while online to update."]);
    // No figure tiles under this headline, so no "Figures up to" line either (the stale notice already dates it).
    expect(v.headline).toEqual({ text: "Nothing saved from Mina's device this week yet.", horizon: null });
    expect(v.wentWell).toBeNull();
    expect(v.thisPeriod?.figures).toBeNull();
    expect(v.thisPeriod?.calendar?.cells.every((cell) => cell.kind === 'not_saved')).toBe(true);
    expect(v.thisPeriod?.calendar?.practiced).toBe('No practice days in this period.');
    expect(v.thisPeriod?.calendar?.notSaved).toBe('Not saved yet: Friday, Saturday, Sunday, Monday, Tuesday, Wednesday and Thursday.');
    expect(v.practiceNext?.lines.map((l) => l.code)).not.toContain('rhythm');
  });

  it('stale, a month partly after the last save: figures up to the last saved day and the stage finished', () => {
    const v = view(STALE, { query: { period: 'month', at: null, from: null } });
    expect(v.headline).toEqual({ text: 'Mina finished Stage 1: Hangul this month!', horizon: 'Figures up to Oct 2.' });
    // October to its 2nd already holds more minutes than all of September: the marker follows the module's figures.
    expect(v.thisPeriod?.figures?.map((f) => [f.key, f.count, f.up])).toEqual([
      ['days', 1, null],
      ['minutes', 14, 'More than all of last month'],
      ['quests', 0, null],
      // September had no card: growth from nothing is not "more than" (OD-11, the module's rule).
      ['cards', 1, null],
      ['letters', 1, null],
    ]);
    expect(v.thisPeriod?.calendar?.notSaved).toBe('Not saved yet: Oct 3, Oct 4, Oct 5, Oct 6, Oct 7, Oct 8, Oct 9, Oct 10, Oct 11, Oct 12, Oct 13, Oct 14 and Oct 15.');
    expect(v.moreDetail?.blocks[0]).toEqual({ kind: 'totals', line: 'Since the start: 1 quest, 1 card' });
    expect(v.moreDetail?.blocks.find((b) => 'heading' in b && b.heading === 'Milestones')).toEqual({ kind: 'lines', heading: 'Milestones', lines: ['Stage 1: Hangul, finished Oct 2'] });
  });

  it('a past window after the last save names the last saved day', () => {
    const v = view(STALE, { query: { period: 'day', at: '2026-10-14', from: null } });
    expect(v.headline?.text).toBe("Nothing saved from Mina's device after Oct 2 yet.");
    expect(v.thisPeriod?.figures).toBeNull();
    // The week back holds the last saved day (and the stage finished on it).
    expect(view(STALE, { query: { period: 'week', at: '2026-10-08', from: null } }).headline?.text).toBe('Mina finished Stage 1: Hangul last week!');
  });

  it('legacy: at a glance, the neutral lines, More detail from today\'s summary, no tabs', () => {
    const v = view(LEGACY, { kind: 'class' });
    expect(v.state).toBe('legacy');
    expect(v.glance?.nowOn).toBe('Now on Stage 1: Hangul');
    expect(v.glance?.lastPractice).toBe('Last practice: Oct 14');
    expect(v.notices).toEqual(['Day-by-day figures are not available yet.', "Open Hangul Route on Mina's device while online to update."]);
    expect(v.tabs).toBeNull();
    expect(v.stepper).toBeNull();
    expect(v.headline).toBeNull();
    expect(v.wentWell).toBeNull();
    expect(v.thisPeriod).toBeNull();
    expect(v.moreDetail?.blocks.map((b) => ('heading' in b ? b.heading : b.line))).toEqual(['Since the start: 3 quests, 2 cards', 'Letters Mina knows well', 'Letters being practiced', 'Plan']);
  });

  it('legacy P1: the letters line still shows, with their sound values, and no Add to a plan (it names no quest)', () => {
    const v = view(LEGACY, { kind: 'class', role: 'teacher' });
    const line = v.practiceNext?.lines[0];
    expect(line?.code).toBe('letters_revisit');
    expect(line?.sentence.text).toBe('ㄴ (n): worth another visit.');
    expect(line?.sentence.parts).toContainEqual(expect.objectContaining({ kind: 'letter', letter: 'ㄴ', romanization: 'n' }));
    expect(line?.action).toBeNull();
  });

  it('legacy and stale says the update line once', () => {
    const v = view(LEGACY, { data: response(LEGACY, { lastSyncedAt: '2026-09-20T10:00:00.000Z' }) });
    expect(v.notices).toEqual(['Last saved Sep 20.', 'Day-by-day figures are not available yet.', "Open Hangul Route on Mina's device while online to update."]);
  });

  it('empty: Now on without Last practice, the not-started line and the app\'s next quest, no tabs', () => {
    const v = view(EMPTY);
    expect(v.state).toBe('empty');
    expect(v.glance).toEqual({ nowOn: 'Now on Stage 1: Hangul', lastPractice: null, route: null, region: 'Learning Route' });
    expect(v.notices).toEqual(['Mina has not started yet. The report fills in after the first practice.']);
    expect(v.tabs).toBeNull();
    expect(texts(v.practiceNext?.lines)).toEqual(['Next on the Learning Route: Meet a, eo, g, n.']);
    expect(v.practiceNext?.lines[0]?.sentence.parts).toContainEqual({ kind: 'quest', id: 'quest:stage1-letters-q1', title: 'Meet a, eo, g, n' });
    expect(v.moreDetail).toBeNull();
  });

  it('no_data: one neutral block, never "has not practiced", no glance, no tabs', () => {
    const v = view(null);
    expect(v.state).toBe('no_data');
    expect(v.glance).toBeNull();
    expect(v.notices).toEqual(["No saved progress from Mina's device yet.", 'Open Hangul Route on that device while online.']);
    expect(v.tabs).toBeNull();
    expect(v.practiceNext).toBeNull();
    expect(JSON.stringify(v)).not.toMatch(/not practiced|has not started/);
  });

  it('no practice in the window: the neutral headline, no went-well, the rhythm line first', () => {
    const empty = view({ ...STEADY, activity: { ...STEADY.activity, days: STEADY.activity.days.filter((d) => d.d < '2026-10-09' || d.d > '2026-10-15') } });
    expect(empty.headline?.text).toBe('No practice yet this week.');
    expect(empty.wentWell).toBeNull();
    expect(empty.practiceNext?.lines[0]?.sentence.text).toBe('A short session on two days a week is a great start.');
    expect(empty.thisPeriod?.calendar?.practiced).toBe('No practice days in this period.');
  });

  it('a date in another year shows its year; an unreadable last practice shows no line', () => {
    const old = { ...LEGACY, lastActiveAt: '2025-12-30T16:00:00.000Z' };
    expect(view(old).glance?.lastPractice).toBe('Last practice: Dec 30, 2025');
    expect(view({ ...LEGACY, lastActiveAt: 'not a time' }).glance?.lastPractice).toBeNull();
  });

  it('empty without a readable journey has no "Now on" line', () => {
    const { journey: _journey, ...noJourney } = EMPTY;
    expect(view(noJourney).glance?.nowOn).toBeNull();
  });

  it('a school space has no learner report', () => {
    expect(learnerReportView({ data: response(STEADY, { kind: 'school' }), query: { period: 'week', at: null, from: null }, now: NOW, role: null, stageTitle })).toBeNull();
  });

  it('links the glance to the Learning Route only when that page exists on the build', () => {
    expect(view(STEADY, { learningRoute: true }).glance?.route).toEqual({ href: '/parent/space/route?id=space%3Akim-family&learner=profile%3Amina', text: 'Open Learning Route' });
    expect(view(STEADY).glance?.route).toBeNull();
  });

  it('passes the space kind to the Learning Route builder, so F-APP-001 A-5b changes only the builder', () => {
    const spy = vi.spyOn(ROUTES, 'learnerRoute');
    try {
      view(STEADY, { learningRoute: true });
      expect(spy).toHaveBeenLastCalledWith('space:kim-family', 'profile:mina', 'family');
      view(STEADY, { kind: 'class', learningRoute: true });
      expect(spy).toHaveBeenLastCalledWith('space:sunflower', 'profile:mina', 'class');
    } finally {
      spy.mockRestore();
    }
  });

  it('the strand tip needs the game title from the content catalogue, else it is left out', () => {
    const v = view(STEADY, { tipGames: {} });
    expect(v.practiceNext?.lines.find((l) => l.code === 'strand_next')?.tip).toBeNull();
  });

  it('reads an invalid clock as the last saved day, without breaking', () => {
    const v = view(STEADY, { now: new Date(Number.NaN) });
    expect(v.headline?.text).toBe('Mina practiced on 3 days this week.');
  });
});

describe('sentences from codes, every insight in both voices', () => {
  const third = learnerReport({ summary: STEADY, viewer: 'family', voice: 'third', period: 'week', now: NOW, catalog: CATALOG, lastSyncedAt: null });
  const second = learnerReport({ summary: STEADY, viewer: 'device', voice: 'second', period: 'week', now: NOW, catalog: CATALOG, lastSyncedAt: null });
  const words3 = reportWordsOf(third, { name: 'Mina', stageTitle, tipGames: { 'sound-letter': 'Listen and pick' } });
  const words2 = reportWordsOf(second, { name: 'Mina', stageTitle, tipGames: { 'sound-letter': 'Listen and pick' } });
  const say = (line: InsightLine, words = words3): string | undefined => insightView(line, words)?.sentence.text;

  const LINES: Record<(typeof INSIGHT_CODES)[number], [InsightLine, string, string]> = {
    stage_done: [{ code: 'stage_done', params: { stage: { stage: 'stage1', n: 1 } } }, 'Mina finished Stage 1: Hangul.', 'You finished Stage 1: Hangul.'],
    letters_new: [{ code: 'letters_new', params: { letters: ['ㅂ'] } }, 'Mina got strong on ㅂ (b).', 'You got strong on ㅂ (b).'],
    practice_days: [{ code: 'practice_days', params: { days: 4 } }, 'Mina practiced on 4 days.', 'You practiced on 4 days.'],
    minutes_up: [{ code: 'minutes_up', params: { minutes: 50, period: 'week' } }, 'More practice time than last week: 50 minutes.', 'More practice time than last week: 50 minutes.'],
    quests_new: [{ code: 'quests_new', params: { count: 1 } }, '1 new quest finished.', '1 new quest finished.'],
    cards_new: [{ code: 'cards_new', params: { count: 2 } }, '2 new heritage cards collected.', '2 new heritage cards collected.'],
    level_secure: [
      { code: 'level_secure', params: { strands: ['hangul-recognition', 'sound-letter'] } },
      'Level check: Letters (shapes) and Sounds of letters look secure.',
      'Level check: Letters (shapes) and Sounds of letters look secure.',
    ],
    plan_done: [{ code: 'plan_done', params: { done: 3, kind: 'family' } }, "Everything in this week's plan is done.", "Everything in this week's plan is done."],
    streak: [{ code: 'streak', params: { days: 3 } }, '3 days in a row. Hoya is proud!', '3 days in a row. Hoya is proud!'],
    words_new: [{ code: 'words_new', params: { count: 6 } }, '6 new words met.', '6 new words met.'],
    showed_up: [{ code: 'showed_up', params: { days: 1, period: 'week' } }, 'Mina practiced on 1 day this week.', 'You practiced on 1 day this week.'],
    rhythm: [{ code: 'rhythm', params: {} }, 'A short session on two days a week is a great start.', 'A short session on two days a week is a great start.'],
    letters_revisit: [{ code: 'letters_revisit', params: { letters: ['ㅂ', 'ㅅ'], questId: null } }, 'ㅂ (b) and ㅅ (s): worth another visit.', 'ㅂ (b) and ㅅ (s): worth another visit.'],
    strand_next: [{ code: 'strand_next', params: { strand: 'sound-letter' } }, 'Sounds of letters is next to grow.', 'Sounds of letters is next to grow.'],
    plan_open: [{ code: 'plan_open', params: { count: 1, kind: 'class' } }, '1 homework item is ready to play.', '1 homework item is ready to play.'],
    next_in_plan: [{ code: 'next_in_plan', params: { questId: 'quest:stage1-life-q2' } }, 'Next in the plan: Family at the Table.', 'Next in the plan: Family at the Table.'],
    next_on_route: [{ code: 'next_on_route', params: { questId: 'quest:stage1-life-q2' } }, 'Next on the Learning Route: Family at the Table.', 'Next on the Learning Route: Family at the Table.'],
    free_days_done: [{ code: 'free_days_done', params: {} }, 'Mina finished the free lessons.', 'You finished the free lessons.'],
    words_revisit: [{ code: 'words_revisit', params: { words: ['vocab:bap'] } }, '밥 bap (cooked rice): worth another look together.', '밥 bap (cooked rice): worth another look.'],
  };

  it.each(INSIGHT_CODES.map((code) => [code] as const))('%s', (code) => {
    const [line, thirdText, secondText] = LINES[code];
    expect(say(line)).toBe(thirdText);
    expect(say(line, words2)).toBe(secondText);
  });

  it('plural counts read 1 and 2 (section 3.11)', () => {
    expect(say({ code: 'practice_days', params: { days: 1 } })).toBe('Mina practiced on 1 day.');
    expect(say({ code: 'quests_new', params: { count: 2 } })).toBe('2 new quests finished.');
    expect(say({ code: 'cards_new', params: { count: 1 } })).toBe('1 new heritage card collected.');
    expect(say({ code: 'streak', params: { days: 1 } })).toBe('1 day in a row. Hoya is proud!');
    expect(say({ code: 'plan_open', params: { count: 2, kind: 'family' } })).toBe('2 plan items are ready to play.');
    expect(say({ code: 'level_secure', params: { strands: ['vocabulary'] } })).toBe('Level check: Words looks secure.');
  });

  it('class and family plan words', () => {
    expect(say({ code: 'plan_done', params: { done: 2, kind: 'class' } })).toBe('Every homework item in this plan is done.');
    expect(say({ code: 'plan_open', params: { count: 3, kind: 'family' } })).toBe('3 plan items are ready to play.');
  });

  it('the strand tips, with the second-voice tips for an adult learning alone', () => {
    const tip = (strand: 'hangul-recognition' | 'sound-letter' | 'syllable-reading' | 'vocabulary' | 'sentences', words = words3) =>
      insightView({ code: 'strand_next', params: { strand } }, words)?.tip?.text ?? null;
    expect(tip('sound-letter')).toBe('Listening games help: try Listen and pick.');
    expect(tip('hangul-recognition')).toBeNull();
    expect(tip('syllable-reading')).toBe('Read short words together.');
    expect(tip('vocabulary')).toBe('Word cards help: try a word topic.');
    expect(tip('sentences')).toBe('Read a short story together.');
    expect(tip('syllable-reading', words2)).toBe('Read short words.');
    expect(tip('sentences', words2)).toBe('Read a short story.');
  });

  it('a letter without a known sound value shows alone, never with an invented one', () => {
    const out = insightView({ code: 'letters_revisit', params: { letters: ['ㄳ'], questId: null } }, words3);
    expect(out?.sentence.text).toBe('ㄳ: worth another visit.');
    expect(out?.sentence.parts[0]).toEqual({ kind: 'letter', letter: 'ㄳ', romanization: null, before: '', after: '' });
  });

  it('a quest this build does not know is never named', () => {
    expect(insightView({ code: 'next_on_route', params: { questId: 'quest:stage9-new-q1' } }, words3)).toBeNull();
  });

  it('an unknown word id shows its romanized slug and no Hangul', () => {
    const parts = insightView({ code: 'words_revisit', params: { words: ['vocab:newword'] } }, words3)?.sentence.parts;
    expect(parts?.[0]).toEqual({ kind: 'word', id: 'vocab:newword', ko: null, romanization: 'newword', gloss: null });
    expect(insightView({ code: 'words_revisit', params: { words: ['vocab:newword'] } }, words3)?.sentence.text).toBe('newword: worth another look together.');
  });

  it('the day twin of practice_days and showed_up', () => {
    const day = learnerReport({ summary: STEADY, viewer: 'family', voice: 'third', period: 'day', now: NOW, catalog: CATALOG, lastSyncedAt: null });
    const w = reportWordsOf(day, { name: 'Mina', stageTitle });
    expect(insightView({ code: 'practice_days', params: { days: 1 } }, w)?.sentence.text).toBe('Mina made time to practice.');
    expect(insightView({ code: 'showed_up', params: { days: 1, period: 'day' } }, w)?.sentence.text).toBe('Mina made time to practice.');
    const dayYou = learnerReport({ summary: STEADY, viewer: 'device', voice: 'second', period: 'day', now: NOW, catalog: CATALOG, lastSyncedAt: null });
    expect(insightView({ code: 'showed_up', params: { days: 1, period: 'day' } }, reportWordsOf(dayYou, { name: 'Mina', stageTitle }))?.sentence.text).toBe('You made time to practice.');
  });

  it('a month went-well line compares with "last month"', () => {
    const month = learnerReport({ summary: STEADY, viewer: 'family', voice: 'third', period: 'month', now: NOW, catalog: CATALOG, lastSyncedAt: null });
    expect(insightView({ code: 'minutes_up', params: { minutes: 90, period: 'month' } }, reportWordsOf(month, { name: 'Mina', stageTitle }))?.sentence.text).toBe(
      'More practice time than all of last month: 90 minutes.',
    );
  });
});

describe('headlines in both voices', () => {
  const report = (over: Partial<Parameters<typeof learnerReport>[0]>): LearnerReport =>
    learnerReport({ summary: STEADY, viewer: 'device', voice: 'second', period: 'week', now: NOW, catalog: CATALOG, lastSyncedAt: null, ...over });
  const head = (r: LearnerReport): string | null => headlineText(r, reportWordsOf(r, { name: 'Mina', stageTitle }));

  it('practiced, on a day, stage finished, nothing saved, getting started', () => {
    expect(head(report({}))).toBe('You practiced on 3 days this week.');
    expect(head(report({ period: 'day' }))).toBe('You practiced today.');
    expect(head(report({ summary: STALE, period: 'month' }))).toBe('You finished Stage 1: Hangul this month!');
    expect(head(report({ summary: STALE, period: 'all' }))).toBe('You finished Stage 1: Hangul!');
    expect(head(report({ summary: STALE, viewer: 'family', voice: 'third', period: 'all' }))).toBe('Mina finished Stage 1: Hangul!');
    expect(head(report({ summary: STALE }))).toBe('Nothing saved on your device this week yet.');
    expect(head(report({ summary: STALE, period: 'day', at: '2026-10-14' }))).toBe('Nothing saved on your device after Oct 2 yet.');
    const once = { ...STEADY, activity: { ...STEADY.activity, total: { ...STEADY.activity.total, days: 1 } } };
    expect(head(report({ summary: once }))).toBe('You are just getting started.');
    expect(head(report({ summary: once, viewer: 'family', voice: 'third' }))).toBe('Mina is just getting started.');
  });

  it('no practice now, then, and ever', () => {
    const quiet = { ...STEADY, activity: { ...STEADY.activity, days: [], months: [], total: { ...STEADY.activity.total, days: 5 } } };
    expect(head(report({ summary: quiet }))).toBe('No practice yet this week.');
    expect(head(report({ summary: quiet, period: 'day', at: '2026-10-14' }))).toBe('No practice yesterday.');
    // All time with no practice is the class report's line; a learner report reads `none_yet` there only in theory.
    const all = report({ summary: quiet, period: 'all' });
    expect(head({ ...all, headline: { code: 'none_yet', days: 0, quests: 0, stage: null } })).toBe('No practice yet.');
  });

  it('has no headline without day-by-day data', () => {
    expect(head(report({ summary: LEGACY }))).toBeNull();
  });

  it('a console report is always in the third person; the device report keeps its second voice', () => {
    expect(reportWordsOf(report({}), { name: 'Mina', stageTitle }).voice).toBe('second');
    expect(reportWordsOf(report({ viewer: 'class' }), { name: 'Mina', stageTitle }).voice).toBe('third');
  });
});

describe('reportViewerRights: the role in listSpaces() decides the archived sentence and the plan actions', () => {
  it('owner: manage and plan.write; a class teacher or a family caregiver: plan.write; anyone else or unlisted: neither', () => {
    expect(reportViewerRights('owner', 'family')).toEqual({ manage: true, planWrite: true });
    expect(reportViewerRights('owner', 'class')).toEqual({ manage: true, planWrite: true });
    expect(reportViewerRights('teacher', 'class')).toEqual({ manage: false, planWrite: true });
    expect(reportViewerRights('caregiver', 'family')).toEqual({ manage: false, planWrite: true });
    expect(reportViewerRights('admin', 'class')).toEqual({ manage: false, planWrite: false });
    expect(reportViewerRights('student', 'class')).toEqual({ manage: false, planWrite: false });
    expect(reportViewerRights(null, 'class')).toEqual({ manage: false, planWrite: false });
  });

  it('keys plan.write by kind as can.ts does: a teacher of a family or a caregiver of a class has none', () => {
    expect(reportViewerRights('teacher', 'family')).toEqual({ manage: false, planWrite: false });
    expect(reportViewerRights('caregiver', 'class')).toEqual({ manage: false, planWrite: false });
    expect(view(STEADY, { kind: 'family', role: 'teacher' }).practiceNext?.lines.some((line) => line.action !== null)).toBe(false);
    expect(view(STEADY, { kind: 'class', role: 'caregiver' }).practiceNext?.lines.some((line) => line.action !== null)).toBe(false);
  });
});

describe('the back link (section 3.1)', () => {
  const space = { id: 'space:kim-family', kind: 'family' as const, name: 'Kim family' };
  const cls = { id: 'space:sunflower', kind: 'class' as const, name: 'Sunflower' };

  it('goes home from the parent home and to the roster from the roster', () => {
    expect(reportBackLink('home', space)).toEqual({ href: '/parent', text: 'Back to home' });
    expect(reportBackLink('roster', cls)).toEqual({ href: '/teach/space?id=space%3Asunflower', text: 'Back to Sunflower' });
    expect(reportBackLink('roster', space)).toEqual({ href: '/parent/space?id=space%3Akim-family', text: 'Back to Kim family' });
  });

  it('goes to the space from the navigation or without `from` (the persona home until RP-7c)', () => {
    expect(reportBackLink('nav', cls)).toEqual({ href: '/teach/space?id=space%3Asunflower', text: 'Back to Sunflower' });
    expect(reportBackLink(null, space)).toEqual({ href: '/parent/space?id=space%3Akim-family', text: 'Back to Kim family' });
  });

  it('goes to the console home when the space is not known (a failed load)', () => {
    expect(reportBackLink('roster', null)).toEqual({ href: '/teach/home', text: 'Back to home' });
    expect(reportBackLink(null, null)).toEqual({ href: '/teach/home', text: 'Back to home' });
  });

  it('is carried by the view', () => {
    expect(view(STEADY, { query: { period: 'week', at: null, from: 'home' } }).back).toEqual({ href: '/parent', text: 'Back to home' });
    expect(view(STEADY, { kind: 'class', query: { period: 'week', at: null, from: 'roster' } }).back).toEqual({ href: '/teach/space?id=space%3Asunflower', text: 'Back to Sunflower' });
  });
});

describe('reportQueryOf: the page address, read leniently', () => {
  it('reads ids, the period (week by default), a day key and the from code', () => {
    expect(reportQueryOf(new URLSearchParams('id=space%3Ac&learner=profile%3A1&period=month&at=2026-09-01&from=roster'))).toEqual({
      spaceId: 'space:c',
      learnerId: 'profile:1',
      period: 'month',
      at: '2026-09-01',
      from: 'roster',
    });
  });

  it('reads anything else as the default', () => {
    expect(reportQueryOf(new URLSearchParams('id=+&period=year&at=yesterday&from=email'))).toEqual({ spaceId: '', learnerId: '', period: 'week', at: null, from: null });
    expect(reportQueryOf(null)).toEqual({ spaceId: '', learnerId: '', period: 'week', at: null, from: null });
  });
});

describe('reportLoadProblem: which state a failed load shows', () => {
  const fail = (error: 'unauthorized' | 'forbidden' | 'not_found' | 'invalid' | 'network' | 'unknown', status: number, code?: string): Extract<ApiResult<never>, { ok: false }> => ({
    ok: false,
    error,
    status,
    ...(code ? { code } : {}),
  });

  it('not a member, an outsider or a wrong kind: "This report is not available."', () => {
    expect(reportLoadProblem(fail('forbidden', 403))).toEqual({ kind: 'unavailable', message: 'This report is not available.', retry: null });
    expect(reportLoadProblem(fail('not_found', 404, 'not_member'))).toEqual({ kind: 'unavailable', message: 'This report is not available.', retry: null });
    expect(reportLoadProblem(fail('unknown', 409, 'wrong_kind'))).toEqual({ kind: 'unavailable', message: 'This report is not available.', retry: null });
  });

  it('a network or server failure: "Can\'t load the report right now." and Try again', () => {
    expect(reportLoadProblem(fail('network', -1))).toEqual({ kind: 'error', message: "Can't load the report right now.", retry: 'Try again' });
    expect(reportLoadProblem(fail('unknown', 500))).toEqual({ kind: 'error', message: "Can't load the report right now.", retry: 'Try again' });
    expect(reportLoadProblem(fail('unknown', 200, 'bad_response'))).toEqual({ kind: 'error', message: "Can't load the report right now.", retry: 'Try again' });
  });

  it('signed out: the page sends the grown-up to sign in', () => {
    expect(reportLoadProblem(fail('unauthorized', 401))).toEqual({ kind: 'signedOut', message: null, retry: null });
  });

  it('the flag-off words', () => {
    expect(en.report.state.flagOff).toBe('Reports are not available yet.');
  });
});

describe('the stepper buttons and the console locale', () => {
  it('every step button has its visible label inside its accessible name (WCAG 2.5.3)', () => {
    const queries = [
      { period: 'day', at: null },
      { period: 'day', at: '2026-10-13' },
      { period: 'week', at: null },
      { period: 'week', at: '2026-10-08' },
      { period: 'week', at: '2026-10-01' },
      { period: 'month', at: null },
      { period: 'month', at: '2026-09-01' },
    ] as const;
    let checked = 0;
    for (const q of queries) {
      const stepper = view(STEADY, { query: { ...q, from: null } }).stepper;
      for (const button of [stepper?.prev, stepper?.next]) {
        if (!button) continue;
        expect(button.name.toLowerCase()).toContain(button.label.toLowerCase());
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThanOrEqual(10);
  });

  it('formats every date in Korean, inside the Korean report words (F-I18N-001 PR 16)', () => {
    const week = view(STEADY, { locale: 'ko' });
    expect(week.stepper?.range).toBe('10월 9일~10월 15일');
    expect(week.thisPeriod?.calendar?.cells.map((cell) => cell.weekday)).toEqual(['금', '토', '일', '월', '화', '수', '목']);
    expect(week.thisPeriod?.calendar?.practiced).toBe('연습한 날: 월요일, 수요일, 목요일.');
    expect(week.glance?.lastPractice).toBe('마지막 연습: 10월 15일');
    const month = view(STEADY, { locale: 'ko', query: { period: 'month', at: null, from: null } });
    expect(month.stepper?.range).toBe('2026년 10월');
  });

  it('formats every date in Spanish', () => {
    const week = view(STEADY, { locale: 'es' });
    expect(week.stepper?.range).toBe('9 oct a 15 oct');
    expect(week.thisPeriod?.calendar?.cells.map((cell) => cell.weekday)).toEqual(['vie', 'sáb', 'dom', 'lun', 'mar', 'mié', 'jue']);
    expect(week.thisPeriod?.calendar?.practiced).toBe('Practicó: lunes, miércoles y jueves.');
    expect(week.glance?.lastPractice).toBe('Última práctica: 15 oct');
    const month = view(STEADY, { locale: 'es', query: { period: 'month', at: null, from: null } });
    expect(month.stepper?.range).toBe('octubre de 2026');
  });
});
