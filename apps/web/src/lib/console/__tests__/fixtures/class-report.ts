import type { ClassReport } from '@hangul-route/content-schema';

/** A frozen week class report (F-REPORT-001 RP-8): 12 members, 2 practiced, one older app. Aggregates only. */
export const CLASS_REPORT: ClassReport = {
  v: 1,
  period: 'week',
  headline: { code: 'class_practiced', practiced: 2, learners: 12 },
  class: { learners: 12, withActivity: 11, olderApp: 1, notSaved7d: 0 },
  wentWell: { lettersNew: [{ letter: 'ㅂ', learners: 5 }], questsNew: { count: 14 }, cardsNew: 9, milestones: [] },
  revisit: [{ letter: 'ㅊ', learners: 4 }],
  practice: { dayBands: [{ band: '0', learners: 9 }, { band: '1-2', learners: 2 }, { band: '3-4', learners: 0 }, { band: '5-7', learners: 0 }], notSaved: 0 },
  time: { minutesTotal: { count: 30 }, minutesMedian: null },
  levelCheck: [],
  plans: [],
};
