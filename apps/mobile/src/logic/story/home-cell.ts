import { StageKeySchema, type StageKey, type Story, type ThemeKey } from '@hangul-route/content-schema';

/**
 * Home cell of a shelf story (F-STORY-005 §3.2): the grid cell
 * (`stage<recommendedStage>`, theme) where the map shows the story. Metadata,
 * never capacity: it gates nothing and never changes the cell's own episode.
 * Pure; nothing is stored.
 */
export interface HomeCell {
  stage: StageKey;
  theme: ThemeKey;
}

/** `recommendedStage` 3, theme `life` -> `{ stage: 'stage3', theme: 'life' }`. The story schema keeps the stage within 1-7. */
export function homeCellOf(story: Pick<Story, 'recommendedStage' | 'theme'>): HomeCell {
  return { stage: StageKeySchema.parse(`stage${story.recommendedStage}`), theme: story.theme };
}
