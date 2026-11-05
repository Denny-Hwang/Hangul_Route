import { CATALOG, addDays, generateCurriculum, toMeta, type CurriculumMeta, type SelfRoute, type Weekday } from '@hangul-route/content-schema';

/**
 * A real curriculum meta from the shared generator (F-PLAN-002 section 3.5),
 * so the device tests run against the shape the console and the self-route
 * actually produce. Test-only.
 */
export function curriculumMeta(over: Partial<CurriculumMeta> = {}): CurriculumMeta {
  const draft = generateCurriculum(
    {
      audience: 'self',
      level: { stage: 'stage1', band: 0 },
      startDate: '2026-09-21',
      weeks: 4,
      sessionsPerWeek: 3,
      minutesPerSession: 15,
      unlockedStages: ['stage1'],
    },
    CATALOG,
  );
  return { ...toMeta(draft), ...over };
}

export function selfRoute(over: Partial<SelfRoute> = {}): SelfRoute {
  return {
    id: 'route:mine',
    createdAt: '2026-09-20T00:00:00.000Z',
    updatedAt: '2026-09-20T00:00:00.000Z',
    archivedAt: null,
    meta: curriculumMeta(),
    items: [],
    ...over,
  };
}

export interface BlendFixture {
  startDate?: string;
  weeks?: number;
  lectureDays?: Weekday[];
  perWeek?: number;
  /** The teacher's practice weekdays (`blend.personal.days`); absent: the default days. */
  practiceDays?: Weekday[];
  /** The generator's union of class and practice days (`sessionDays`). */
  sessionDays?: Weekday[];
  refresh?: NonNullable<CurriculumMeta['refresh']>;
}

/**
 * A class plan's meta with class days and practice days (AMENDMENTS-ROUTE-CLASS-BLEND section 9.1), on the shape the
 * shared generator writes: the weeks of `curriculumMeta` moved to the start date, and `params.blend`. Test-only.
 */
export function blendedMeta(o: BlendFixture = {}): CurriculumMeta {
  const base = curriculumMeta();
  const startDate = o.startDate ?? '2026-09-21';
  const weeks = o.weeks ?? 4;
  const lecture = o.lectureDays ?? ['tue'];
  const perWeek = o.perWeek ?? 3;
  const { sessionDays: _days, ...params } = base.params;
  return {
    ...base,
    params: {
      ...params,
      audience: 'class',
      startDate,
      weeks,
      sessionsPerWeek: Math.min(7, lecture.length + perWeek),
      ...(o.sessionDays === undefined ? {} : { sessionDays: o.sessionDays }),
      blend: {
        mode: 'overlap',
        lecture: { days: lecture, minutes: 30 },
        personal: { perWeek, minutes: 10, ...(o.practiceDays === undefined ? {} : { days: o.practiceDays }) },
        classDaysOff: [],
        keepAverage: false,
      },
    },
    weeks: Array.from({ length: weeks }, (_, i) => ({ ...(base.weeks[0] as CurriculumMeta['weeks'][number]), index: i + 1, startDate: addDays(startDate, 7 * i) })),
    ...(o.refresh === undefined ? {} : { refresh: o.refresh }),
  };
}
