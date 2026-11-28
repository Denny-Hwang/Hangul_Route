import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ReactElement } from 'react';
import type { RootStackParamList } from '../../navigation/types';
import { chunkDoor, useChunk } from '../chunk-door';
import { LessonWaiting } from '../lesson-content';
import { OopsScreen } from '../system/OopsScreen';
import { withPlanParts } from './plan-parts-entry';

/*
 * The start bundle's door to the `Placement` route (AMENDMENTS-FINISH-2026-11 FN-7): the screen draws from its chunk
 * (`./placement-chunk.tsx`, marker `screen-chunk:placement`) once it is in, with the route's own props; the lesson waiting
 * screen until then, the crash screen's Try again when it cannot load. Precached like every chunk, so it opens offline.
 * The chunk loads together with the plan parts it shares with the reports (`./plan-parts-entry.ts`, SB-4d) under the
 * door's one retry level, so the result page draws no frame of its own for them.
 */

type Chunk = typeof import('./placement-chunk');
export const placementDoor = chunkDoor<Chunk>(withPlanParts(() => import('./placement-chunk')));

/** The `Placement` route, from its chunk. */
export function PlacementScreen(props: NativeStackScreenProps<RootStackParamList, 'Placement'>): ReactElement {
  const { chunk, failed, retry } = useChunk(placementDoor);
  if (failed) return <OopsScreen onRetry={retry} />;
  if (chunk === null) return <LessonWaiting />;
  const { PlacementScreen: Placement } = chunk;
  return <Placement {...props} />;
}
