import type { ClassReport, StageKey } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import type { ClassReportBody, SpaceListItem } from '../api';
import { classChooserRows, classReportScreenOf, classReportView, rosterClassReportLink, type ClassReportView, type ClassReportViewInput } from '../class-report-view';
import { countedLetter, reportDayText, reportMonthText } from '../report-view';

/** F-REPORT-001 RP-8 (sections 3.7, 3.14; design `class-report.md`): the class report in words, aggregates only. */

const NOW = new Date('2026-10-15T12:00:00.000Z');
const en = getMessages('en');
const TITLES: Record<string, string> = { stage1: 'Hangul', stage2: 'Words' };
const stageTitle = (stage: StageKey): string => TITLES[stage] ?? stage;

const REPORT: ClassReport = {
  v: 1,
  period: 'week',
  headline: { code: 'class_practiced', practiced: 8, learners: 12, up: true },
  class: { learners: 12, withActivity: 11, olderApp: 1, notSaved7d: 2 },
  wentWell: {
    lettersNew: [
      { letter: 'ㅂ', learners: 5 },
      { letter: 'ㅅ', learners: 4 },
    ],
    questsNew: { count: 14, up: true },
    cardsNew: 9,
    milestones: [{ stage: 'stage1', count: 2 }],
  },
  revisit: [{ letter: 'ㅊ', learners: 4 }],
  practice: {
    dayBands: [
      { band: '0', learners: 3 },
      { band: '1-2', learners: 3 },
      { band: '3-4', learners: 3 },
      { band: '5-7', learners: 1 },
    ],
    notSaved: 1,
  },
  time: { minutesTotal: { count: 212, up: true }, minutesMedian: 24 },
  levelCheck: [{ strand: 'sound-letter', secure: 3, gettingThere: 2, notYet: 1, notTested: 0 }],
  plans: [{ planId: 'plan:week-3', title: 'Week three', assigned: 12, started: 9, finished: 6, itemsDone: 30 }],
};

const body = (report: ClassReport = REPORT, over: Partial<ClassReportBody> = {}): ClassReportBody => ({
  space: { id: 'space:sunflower', kind: 'class', name: 'Sunflower', archivedAt: null },
  period: report.period,
  at: null,
  serverTime: NOW.toISOString(),
  report,
  ...over,
});

function view(over: Partial<ClassReportViewInput> = {}): ClassReportView {
  return classReportView({ data: body(), query: { period: 'week', at: null }, now: NOW, role: 'teacher', lecture: false, stageTitle, ...over });
}

describe('report-view helpers the class page reuses', () => {
  it('dates and counted letters', () => {
    expect(reportDayText('2026-10-12', '2026-10-15', 'en')).toBe('Oct 12');
    expect(reportDayText('2025-12-30', '2026-10-15', 'en')).toBe('Dec 30, 2025');
    expect(reportMonthText('2026-10-01', 'en')).toBe('October 2026');
    const chip = countedLetter('ㅂ', 5, 'en');
    expect(chip.text).toBe('ㅂ (b): 5');
    expect(chip.parts).toContainEqual(expect.objectContaining({ kind: 'letter', letter: 'ㅂ', romanization: 'b' }));
  });
});

describe('the week class report (behaviour 5 words)', () => {
  const v = view();

  it('titles the page with the class name and keeps it out of document.title; the back link goes to the roster', () => {
    expect(v.title).toBe('Sunflower: class report');
    expect(v.documentTitle).toBe('Report - Hangul Route');
    expect(v.back).toEqual({ href: '/teach/space?id=space%3Asunflower', text: 'Back to Sunflower' });
    expect(v.printFooter).toBe('Private: shared from Hangul Route on Oct 15.');
  });

  it('reads the class lines: members, an older app, last saved long ago', () => {
    expect(v.classLines).toEqual([
      '12 learners',
      '1 learner has an older app: their day-by-day figures appear after an update.',
      '2 learners last saved more than 7 days ago.',
    ]);
  });

  it('reads the headline with the up-only marker, and the tabs and stepper', () => {
    expect(v.headline).toEqual({ text: '8 of 12 learners practiced this week.', up: 'More than last week', note: null });
    expect(v.tabs?.map((t) => [t.period, t.selected])).toEqual([
      ['day', false],
      ['week', true],
      ['month', false],
      ['all', false],
    ]);
    expect(v.tabs?.[2]?.href).toBe('/teach/space/report?id=space%3Asunflower&period=month');
    expect(v.stepper).toEqual({
      range: 'Oct 9 to Oct 15',
      prev: { href: '/teach/space/report?id=space%3Asunflower&period=week&at=2026-10-08', label: 'Last week', name: 'Show last week' },
      next: null,
    });
    expect(v.announce).toBe('Showing this week');
  });

  it('what went well: counted letter chips, new quests with the marker, new cards, milestones as events', () => {
    expect(v.wentWell?.heading).toBe('What went well');
    expect(v.wentWell?.letters?.heading).toBe('Letters the class got strong on');
    expect(v.wentWell?.letters?.chips.map((c) => c.text)).toEqual(['ㅂ (b): 5', 'ㅅ (s): 4']);
    expect(v.wentWell?.quests).toEqual({ text: 'New quests: 14', up: 'More than last week' });
    expect(v.wentWell?.cards).toBe('New cards: 9');
    expect(v.wentWell?.milestones).toEqual({ heading: 'Stage milestones this week', lines: ['Stage 1: Hangul, finished by 2 learners'] });
  });

  it('practice together: revisit chips; Plan a lesson only with lecture mode and plan.write on a live class', () => {
    expect(v.practiceTogether).toEqual({ heading: 'Practice together', revisit: { heading: 'Letters to revisit together', chips: [countedLetter('ㅊ', 4, 'en')] }, planLesson: null });
    expect(view({ lecture: true }).practiceTogether?.planLesson).toEqual({ href: '/teach/space/lecture?id=space%3Asunflower&from=revisit', text: 'Plan a lesson' });
    expect(view({ lecture: true, role: null }).practiceTogether?.planLesson).toBeNull();
    expect(view({ lecture: true, data: body(REPORT, { space: { id: 'space:sunflower', kind: 'class', name: 'Sunflower', archivedAt: '2026-10-01T00:00:00.000Z' } }) }).practiceTogether?.planLesson).toBeNull();
  });

  it('this period: the day bands as text rows, the not-saved line, total and typical time', () => {
    expect(v.thisPeriod).toEqual({
      heading: 'This period',
      noneYet: null,
      afterUpdate: null,
      bands: { heading: 'Days practiced', rows: ['Not yet: 3', '1 to 2 days: 3', '3 to 4 days: 3', '5 to 7 days: 1'] },
      notSaved: '1 learner has nothing saved for this period yet.',
      time: { heading: 'Time', total: 'Total time: 212 minutes', up: 'More than last week', median: 'Typical time for those who practiced: 24 minutes' },
    });
  });

  it('more detail: level-check counts per strand and the homework link blocks', () => {
    expect(v.moreDetail).toEqual({
      button: 'More detail',
      levelCheck: { heading: 'Level check (learners who took one)', strands: [{ name: 'Sounds of letters', rows: ['Secure: 3', 'Getting there: 2', 'Next to learn: 1', 'Not checked yet: 0'] }] },
      homework: { heading: 'Homework', plans: [{ href: '/teach/space/plan?id=space%3Asunflower&plan=plan%3Aweek-3', title: 'Week three', counts: 'Assigned to 12, started by 9, finished by 6' }] },
    });
  });

  it('never carries a learner id, a name or a per-learner list, and no ranking word', () => {
    const text = JSON.stringify(v);
    expect(text).not.toMatch(/profile:|displayName|avatar|\b(top|most|least|best|lowest|average)\b/i);
  });
});

describe('periods, steps and states', () => {
  it('a week back: the dates on Previous, Next back to this week, "the week before" for the marker', () => {
    const v = view({ data: body(REPORT, { at: '2026-10-08' }), query: { period: 'week', at: '2026-10-08' } });
    expect(v.stepper?.range).toBe('Oct 2 to Oct 8');
    expect(v.stepper?.prev).toEqual({ href: '/teach/space/report?id=space%3Asunflower&period=week&at=2026-10-01', label: 'Sep 25 to Oct 1', name: 'Show Sep 25 to Oct 1' });
    expect(v.stepper?.next).toEqual({ href: '/teach/space/report?id=space%3Asunflower&period=week', label: 'Next', name: 'Next: show this week' });
    expect(v.headline?.text).toBe('8 of 12 learners practiced last week.');
    expect(v.headline?.up).toBe('More than the week before');
    const older = view({ data: body(REPORT, { at: '2026-10-01' }), query: { period: 'week', at: '2026-10-01' } });
    expect(older.headline?.text).toBe('8 of 12 learners practiced in the week to Oct 1.');
    expect(older.stepper?.next?.href).toBe('/teach/space/report?id=space%3Asunflower&period=week&at=2026-10-08');
  });

  it('the oldest week has no Previous (the 35 day rows)', () => {
    const v = view({ data: body(REPORT, { at: '2026-09-14' }), query: { period: 'week', at: '2026-09-14' } });
    expect(v.stepper?.prev).toBeNull();
  });

  it('Today: the day bands, day words and a day back', () => {
    const day: ClassReport = { ...REPORT, period: 'day', headline: { code: 'class_practiced', practiced: 3, learners: 12 }, practice: { dayBands: [{ band: 'practiced', learners: 3 }, { band: 'not_yet', learners: 8 }], notSaved: 0 } };
    const v = view({ data: body(day), query: { period: 'day', at: null } });
    expect(v.headline).toEqual({ text: '3 of 12 learners practiced today.', up: null, note: null });
    expect(v.thisPeriod?.bands?.rows).toEqual(['Practiced: 3', 'Not yet: 8']);
    expect(v.thisPeriod?.notSaved).toBeNull();
    expect(v.stepper).toEqual({ range: 'Oct 15', prev: { href: '/teach/space/report?id=space%3Asunflower&period=day&at=2026-10-14', label: 'Yesterday', name: 'Show yesterday' }, next: null });
    const back = view({ data: body(day, { at: '2026-10-13' }), query: { period: 'day', at: '2026-10-13' } });
    expect(back.headline?.text).toBe('3 of 12 learners practiced on Oct 13.');
    expect(back.stepper?.next?.href).toBe('/teach/space/report?id=space%3Asunflower&period=day&at=2026-10-14');
  });

  it('This month: the month bands, the month in the stepper, a month back', () => {
    const month: ClassReport = { ...REPORT, period: 'month', practice: { dayBands: [{ band: '0', learners: 2 }, { band: '1-4', learners: 4 }, { band: '5-9', learners: 3 }, { band: '10+', learners: 2 }], notSaved: 0 } };
    const v = view({ data: body(month), query: { period: 'month', at: null } });
    expect(v.thisPeriod?.bands?.rows).toEqual(['Not yet: 2', '1 to 4 days: 4', '5 to 9 days: 3', '10 days or more: 2']);
    expect(v.stepper).toEqual({ range: 'October 2026', prev: { href: '/teach/space/report?id=space%3Asunflower&period=month&at=2026-09-01', label: 'Last month', name: 'Show last month' }, next: null });
    expect(v.headline?.up).toBe('More than all of last month');
    const back = view({ data: body(month, { at: '2026-08-01' }), query: { period: 'month', at: '2026-08-01' } });
    expect(back.headline?.text).toBe('8 of 12 learners practiced in August 2026.');
    expect(back.stepper?.next?.href).toBe('/teach/space/report?id=space%3Asunflower&period=month&at=2026-09-01');
    expect(back.stepper?.prev?.label).toBe('July 2026');
    const sept = view({ data: body(month, { at: '2026-09-01' }), query: { period: 'month', at: '2026-09-01' } });
    expect(sept.stepper?.next?.href).toBe('/teach/space/report?id=space%3Asunflower&period=month');
    const oldest = view({ data: body(month, { at: '2024-10-01' }), query: { period: 'month', at: '2024-10-01' } });
    expect(oldest.stepper?.prev).toBeNull();
  });

  it('All time: no stepper, no bands, "so far"', () => {
    const all: ClassReport = { ...REPORT, period: 'all', practice: {} };
    const v = view({ data: body(all), query: { period: 'all', at: null } });
    expect(v.stepper).toBeNull();
    expect(v.headline?.text).toBe('8 of 12 learners practiced so far.');
    expect(v.thisPeriod?.bands).toBeNull();
    expect(v.wentWell?.milestones?.heading).toBe('Stage milestones so far');
    expect(v.announce).toBe('Showing all time');
    // The All-time figures read lifetime totals (RP-2c): a neutral line says so; no other period carries it.
    expect(v.headline?.note).toBe('All time includes practice from before each learner joined the class.');
    expect(view({ data: body() }).headline?.note).toBeNull();
  });

  it('no practice in the window: what went well hidden, practice together stays, the neutral line in This period', () => {
    const none: ClassReport = { ...REPORT, headline: { code: 'class_practiced', practiced: 0, learners: 12 }, wentWell: { lettersNew: [], questsNew: { count: 0 }, cardsNew: 0, milestones: [] }, time: { minutesTotal: { count: 0 }, minutesMedian: null } };
    const v = view({ data: body(none) });
    expect(v.headline).toEqual({ text: '0 of 12 learners practiced this week.', up: null, note: null });
    expect(v.wentWell).toBeNull();
    expect(v.practiceTogether?.revisit?.chips).toHaveLength(1);
    expect(v.thisPeriod?.noneYet).toBe('No practice yet this week.');
    expect(v.thisPeriod?.time?.median).toBeNull();
    const past = view({ data: body(none, { at: '2026-10-08' }), query: { period: 'week', at: '2026-10-08' } });
    expect(past.thisPeriod?.noneYet).toBe('No practice last week.');
    const ever = view({ data: body({ ...none, period: 'all', practice: {} }), query: { period: 'all', at: null } });
    expect(ever.thisPeriod?.noneYet).toBe('No practice yet.');
  });

  it('every learner on an older app: the class lines explain, This period says it appears after an update', () => {
    const old: ClassReport = { ...REPORT, headline: { code: 'class_practiced', practiced: 0, learners: 3 }, class: { learners: 3, withActivity: 0, olderApp: 3, notSaved7d: 0 }, practice: { dayBands: [], notSaved: 0 } };
    const v = view({ data: body(old) });
    expect(v.classLines[1]).toBe('3 learners have an older app: their day-by-day figures appear after an update.');
    expect(v.thisPeriod).toEqual({ heading: 'This period', noneYet: null, afterUpdate: "Appears after learners' apps update.", bands: null, notSaved: null, time: null });
    expect(v.wentWell).toBeNull();
    expect(v.practiceTogether?.revisit?.chips).toHaveLength(1);
  });

  it('no learners: the empty line, no tabs, nothing else', () => {
    const empty: ClassReport = { ...REPORT, headline: { code: 'class_practiced', practiced: 0, learners: 0 }, class: { learners: 0, withActivity: 0, olderApp: 0, notSaved7d: 0 }, revisit: [], levelCheck: [], plans: [] };
    const v = view({ data: body(empty) });
    expect(v.empty).toBe('No learners yet.');
    expect(v.tabs).toBeNull();
    expect(v.headline).toBeNull();
    expect(v.wentWell).toBeNull();
    expect(v.practiceTogether).toBeNull();
    expect(v.thisPeriod).toBeNull();
    expect(v.moreDetail).toBeNull();
  });

  it('a class without revisit letters, lecture, level checks or plans draws no Practice together and no More detail', () => {
    const bare: ClassReport = { ...REPORT, revisit: [], levelCheck: [], plans: [], wentWell: { ...REPORT.wentWell, lettersNew: [], milestones: [] } };
    const v = view({ data: body(bare) });
    expect(v.practiceTogether).toBeNull();
    expect(v.moreDetail).toBeNull();
    expect(v.wentWell?.letters).toBeNull();
    expect(v.wentWell?.milestones).toBeNull();
  });

  it('a milestone for a stage this build cannot name is left out', () => {
    const odd = { ...REPORT, wentWell: { ...REPORT.wentWell, milestones: [{ stage: 'stage9', count: 1 }, { stage: 'stage1', count: 2 }] } } as unknown as ClassReport;
    expect(view({ data: body(odd) }).wentWell?.milestones?.lines).toEqual(['Stage 1: Hangul, finished by 2 learners']);
  });

  it('an archived class: the settings sentence to its owner, the neutral line to everyone else', () => {
    const archived = body(REPORT, { space: { id: 'space:sunflower', kind: 'class', name: 'Sunflower', archivedAt: '2026-10-01T00:00:00.000Z' } });
    expect(view({ data: archived, role: 'owner' }).archived).toBe(en.console.settings.archived.class);
    expect(view({ data: archived, role: 'teacher' }).archived).toBe(en.report.state.archived.class);
    expect(view().archived).toBeNull();
  });
});

describe('classReportScreenOf', () => {
  const ok = { ok: true as const, data: body() };
  it('flag off; no id is the chooser; first load; a later load keeps the cached report; errors', () => {
    expect(classReportScreenOf({ enabled: false, spaceId: 'space:sunflower', load: null, cached: null })).toEqual({ kind: 'state', title: 'Reports are not available yet.', retry: null, back: { href: '/teach/home', text: 'Back to home' } });
    expect(classReportScreenOf({ enabled: true, spaceId: '', load: null, cached: null })).toEqual({ kind: 'chooser' });
    expect(classReportScreenOf({ enabled: true, spaceId: 'space:sunflower', load: null, cached: null })).toEqual({ kind: 'loading', back: { href: '/teach/home', text: 'Back to home' } });
    expect(classReportScreenOf({ enabled: true, spaceId: 'space:sunflower', load: null, cached: body() })).toEqual({ kind: 'report', data: body(), busy: true, error: null });
    expect(classReportScreenOf({ enabled: true, spaceId: 'space:sunflower', load: ok, cached: null })).toEqual({ kind: 'report', data: body(), busy: false, error: null });
    expect(classReportScreenOf({ enabled: true, spaceId: 'space:sunflower', load: { ok: false, error: 'network', status: -1 }, cached: null })).toMatchObject({ kind: 'state', title: "Can't load the report right now.", retry: 'Try again' });
    expect(classReportScreenOf({ enabled: true, spaceId: 'space:sunflower', load: { ok: false, error: 'network', status: -1 }, cached: body(), cachedWindow: true })).toEqual({ kind: 'report', data: body(), busy: false, error: { message: "Can't load the report right now.", retry: 'Try again' } });
    expect(classReportScreenOf({ enabled: true, spaceId: 'space:kim', load: { ok: false, error: 'unknown', status: 409, code: 'wrong_kind' }, cached: null })).toMatchObject({ kind: 'state', title: 'This report is not available.', retry: null });
    expect(classReportScreenOf({ enabled: true, spaceId: 'space:sunflower', load: { ok: false, error: 'unauthorized', status: 401 }, cached: null })).toEqual({ kind: 'signedOut' });
  });

  it('a failed load never draws the figures of another window: the cached body stays only for the same period and window', () => {
    // The Worker computes the figures for one window, so a week's counts must never sit under a Today tab.
    expect(classReportScreenOf({ enabled: true, spaceId: 'space:sunflower', load: { ok: false, error: 'network', status: -1 }, cached: body(), cachedWindow: false })).toEqual({
      kind: 'state',
      title: "Can't load the report right now.",
      retry: 'Try again',
      back: { href: '/teach/home', text: 'Back to home' },
    });
    expect(classReportScreenOf({ enabled: true, spaceId: 'space:sunflower', load: { ok: false, error: 'network', status: -1 }, cached: body() })).toMatchObject({ kind: 'state' });
  });

  it('a body for another kind of space is not available (a family has no class report)', () => {
    const family = { ok: true as const, data: body(REPORT, { space: { id: 'space:kim', kind: 'family', name: 'Kim family', archivedAt: null } }) };
    expect(classReportScreenOf({ enabled: true, spaceId: 'space:kim', load: family, cached: null })).toMatchObject({ kind: 'state', title: 'This report is not available.' });
  });
});

describe('classChooserRows: the class chooser (no id)', () => {
  const item = (id: string, kind: 'class' | 'family' | 'school', createdAt: string, archivedAt: string | null = null): SpaceListItem =>
    ({ space: { id, kind, name: `Name ${id}`, parentSpaceId: null, settings: { consentMode: 'parent', anonymizeRoster: false }, archivedAt, createdAt }, role: 'teacher', counts: { learners: 1, accounts: 1, classes: 0 } }) as SpaceListItem;

  it('lists class spaces only, in teacher-home order (newest first, archived last), each to its report', () => {
    const rows = classChooserRows([item('space:a', 'class', '2026-09-01'), item('space:f', 'family', '2026-09-02'), item('space:b', 'class', '2026-09-03'), item('space:c', 'class', '2026-09-04', '2026-10-01')]);
    expect(rows).toEqual([
      { href: '/teach/space/report?id=space%3Ab&period=week', name: 'Name space:b' },
      { href: '/teach/space/report?id=space%3Aa&period=week', name: 'Name space:a' },
      { href: '/teach/space/report?id=space%3Ac&period=week', name: 'Name space:c' },
    ]);
    expect(classChooserRows([])).toEqual([]);
  });
});

describe('rosterClassReportLink: the roll-up Class report link', () => {
  it('a class with reports on: the week class report, the class id only', () => {
    expect(rosterClassReportLink({ spaceId: 'space:sunflower', kind: 'class', enabled: true })).toEqual({ href: '/teach/space/report?id=space%3Asunflower&period=week', text: 'Class report' });
  });

  it('never for a family or a school, never with reports off', () => {
    expect(rosterClassReportLink({ spaceId: 'space:kim', kind: 'family', enabled: true })).toBeNull();
    expect(rosterClassReportLink({ spaceId: 'space:s', kind: 'school', enabled: true })).toBeNull();
    expect(rosterClassReportLink({ spaceId: 'space:sunflower', kind: 'class', enabled: false })).toBeNull();
  });
});
