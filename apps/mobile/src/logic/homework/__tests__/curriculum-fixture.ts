import { CATALOG, generateCurriculum, toMeta, type CurriculumMeta, type SelfRoute } from '@hangul-route/content-schema';

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
