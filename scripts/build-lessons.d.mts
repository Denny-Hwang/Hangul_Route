// Types for the unit tests in apps/mobile (F-CURR-001 row C-2); the script itself is dependency-free JS.
import type { LessonScope } from '../packages/content-schema/src/index';

/** One lesson scope as the app's MinigameScope (apps/mobile/src/logic/minigame-config.ts). */
export function runtimeScope(scope: LessonScope, where: string): { kind: string; rounds: number } & Record<string, unknown>;
