import type { Overlays } from '@hangul-route/content-schema';
import type { MinigameScope } from '../logic/minigame-config';

/**
 * The per-stage lesson modules (F-CURR-001 §3.12), reached lazily: a stage's
 * scopes are evaluated only when one of its quests opens, never at start.
 * Metro and Hermes resolve only literal `require` strings (a template path fails
 * the native build or pulls in the whole folder), so each stage has its own
 * literal `require` in this `switch`. `lessons-index.ts` never imports a stage
 * module; `__tests__/lesson-modules.test.ts` checks both rules.
 */
export interface LessonStageModule {
  LESSON_SCOPES: Readonly<Record<string, MinigameScope>>;
  LESSON_SCOPE_OVERLAYS: Overlays;
}

export type LessonStageNumber = 2 | 3 | 4 | 6 | 7;

export function loadLessonStage(stage: LessonStageNumber): LessonStageModule {
  switch (stage) {
    case 2:
      return require('./__generated__/lessons-stage2') as LessonStageModule;
    case 3:
      return require('./__generated__/lessons-stage3') as LessonStageModule;
    case 4:
      return require('./__generated__/lessons-stage4') as LessonStageModule;
    case 6:
      return require('./__generated__/lessons-stage6') as LessonStageModule;
    case 7:
      return require('./__generated__/lessons-stage7') as LessonStageModule;
  }
}
