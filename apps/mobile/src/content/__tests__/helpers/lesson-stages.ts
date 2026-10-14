import * as stage2 from '../../__generated__/lessons-stage2';
import * as stage3 from '../../__generated__/lessons-stage3';
import * as stage4 from '../../__generated__/lessons-stage4';
import * as stage6 from '../../__generated__/lessons-stage6';
import * as stage7 from '../../__generated__/lessons-stage7';
import type { LessonStageModule } from '../../lesson-modules';

/**
 * Test support: the five stage modules imported directly (vitest cannot run the
 * app's literal `require`s of `lesson-modules.ts`, which only Metro resolves).
 */
export const LESSON_STAGE_MODULES: Readonly<Record<2 | 3 | 4 | 6 | 7, LessonStageModule>> = {
  2: stage2,
  3: stage3,
  4: stage4,
  6: stage6,
  7: stage7,
};

/** Every lesson scope of every stage, by ref. */
export const ALL_LESSON_SCOPES = Object.assign({}, ...Object.values(LESSON_STAGE_MODULES).map((m) => m.LESSON_SCOPES)) as LessonStageModule['LESSON_SCOPES'];
