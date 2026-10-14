import { vi } from 'vitest';
import { LESSON_STAGE_MODULES } from '../helpers/lesson-stages';
import type { LessonStageNumber } from '../../lesson-modules';

/**
 * Vitest setup (every test file): the app reaches each stage's lesson module through a
 * literal `require` that only Metro resolves (`lesson-modules.ts`, F-CURR-001 §3.12).
 * Under vitest the same modules come from the static imports of `helpers/lesson-stages`,
 * so a shipped lesson cell's scopes resolve in tests as they do in the app.
 */
vi.mock('../../lesson-modules', () => ({
  loadLessonStage: (stage: LessonStageNumber) => LESSON_STAGE_MODULES[stage],
}));
