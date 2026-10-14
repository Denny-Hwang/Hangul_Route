import { vi } from 'vitest';
import type { LessonStageNumber } from '../../lesson-modules';

/**
 * Test setup (vitest `setupFiles`): the app reaches each lesson stage module through a
 * literal `require` that only Metro resolves (`content/lesson-modules.ts`, F-CURR-001
 * §3.12), and Node's `require` cannot load the TypeScript module under vitest. Every test
 * file therefore gets a `loadLessonStage` that hands back the same generated modules,
 * imported directly. `__tests__/lesson-modules.test.ts` still checks the real file's
 * literal `require`s, and the e2e runs on the Metro bundle.
 */
vi.mock('../../lesson-modules', async () => {
  const { LESSON_STAGE_MODULES } = await import('./lesson-stages');
  return { loadLessonStage: (stage: LessonStageNumber) => LESSON_STAGE_MODULES[stage] };
});
