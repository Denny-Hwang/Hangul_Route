import { vi } from 'vitest';

/**
 * Setup for every vitest project: `content/lesson-modules.ts` reaches each stage module by a
 * literal `require` that only Metro resolves (F-CURR-001 §3.12). In Node a `require` of a `.ts`
 * path fails, so once a lesson cell is `ready` the loader is replaced here by the same modules
 * imported statically. `__tests__/lesson-modules.test.ts` still checks the real file's requires.
 */
vi.mock('../content/lesson-modules', async () => {
  const { LESSON_STAGE_MODULES } = await import('../content/__tests__/helpers/lesson-stages');
  return { loadLessonStage: (stage: keyof typeof LESSON_STAGE_MODULES) => LESSON_STAGE_MODULES[stage] };
});
