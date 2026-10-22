import type { Overlays, QuestStep } from '@hangul-route/content-schema';
import { LESSON_CELL_CHUNKS, LESSON_EPISODES, loadLessonCell } from '../../__generated__/lessons-index';
import type { LessonCellChunk } from '../../../logic/lessons/lesson-store';
import type { MinigameScope } from '../../../logic/minigame-config';

/**
 * Test support: every lesson cell's body chunk, loaded through the manifest's own loader
 * (F-CURR-002 §10), and the views the content suites read: the game content of each stage (its
 * cells' scopes and their glosses, as the F-CURR-001 stage modules held them) and every step.
 */
export interface LessonStageContent {
  LESSON_SCOPES: Readonly<Record<string, MinigameScope>>;
  LESSON_SCOPE_OVERLAYS: Overlays;
}

const STAGES = [2, 3, 4, 6, 7] as const;

/** Every cell's chunk module, by episode id. */
export const LESSON_CELL_MODULES: Readonly<Record<string, LessonCellChunk>> = Object.fromEntries(
  await Promise.all(Object.keys(LESSON_CELL_CHUNKS).map(async (id) => [id, await (loadLessonCell(id) as Promise<LessonCellChunk>)] as const)),
);

const stageOf = (cellId: string): number => Number(LESSON_EPISODES.find((e) => e.id === cellId)?.stage.slice('stage'.length));
const minigameOnly = (overlays: Overlays): Overlays => ({
  es: Object.fromEntries(Object.entries(overlays.es).filter(([id]) => id.startsWith('minigame:'))),
  ko: Object.fromEntries(Object.entries(overlays.ko).filter(([id]) => id.startsWith('minigame:'))),
});

/** The game content of each stage's cells: their scopes and the glosses of those scopes. */
export const LESSON_STAGE_MODULES: Readonly<Record<(typeof STAGES)[number], LessonStageContent>> = Object.fromEntries(
  STAGES.map((n) => {
    const own = Object.entries(LESSON_CELL_MODULES)
      .filter(([id]) => stageOf(id) === n)
      .map(([, mod]) => mod);
    const glosses = own.map((m) => minigameOnly(m.LESSON_OVERLAYS));
    return [
      n,
      {
        LESSON_SCOPES: Object.assign({}, ...own.map((m) => m.LESSON_SCOPES)) as Record<string, MinigameScope>,
        LESSON_SCOPE_OVERLAYS: { es: Object.assign({}, ...glosses.map((g) => g.es)), ko: Object.assign({}, ...glosses.map((g) => g.ko)) },
      },
    ];
  }),
) as Record<(typeof STAGES)[number], LessonStageContent>;

/** Every lesson scope of every stage, by ref. */
export const ALL_LESSON_SCOPES = Object.assign({}, ...Object.values(LESSON_STAGE_MODULES).map((m) => m.LESSON_SCOPES)) as LessonStageContent['LESSON_SCOPES'];

/** Every lesson quest's steps, by quest id. */
export const ALL_LESSON_STEPS = Object.assign({}, ...Object.values(LESSON_CELL_MODULES).map((m) => m.LESSON_STEPS)) as Readonly<Record<string, readonly QuestStep[]>>;
