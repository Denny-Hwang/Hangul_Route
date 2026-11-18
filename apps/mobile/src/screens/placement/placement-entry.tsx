import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ReactElement } from 'react';
import type { RootStackParamList } from '../../navigation/types';
import { chunkDoor, useChunk } from '../chunk-door';
import { LessonWaiting } from '../lesson-content';
import { OopsScreen } from '../system/OopsScreen';

/*
 * The start bundle's door to the `Placement` route (AMENDMENTS-FINISH-2026-11 FN-7): the screen draws from its chunk
 * (`./placement-chunk.tsx`, marker `screen-chunk:placement`) once it is in, with the route's own props; the lesson waiting
 * screen until then, the crash screen's Try again when it cannot load. Precached like every chunk, so it opens offline.
 */

type Chunk = typeof import('./placement-chunk');
export const placementDoor = chunkDoor<Chunk>(() => import('./placement-chunk'));

/** The `Placement` route, from its chunk. */
export function PlacementScreen(props: NativeStackScreenProps<RootStackParamList, 'Placement'>): ReactElement {
  const { chunk, failed, retry } = useChunk(placementDoor);
  if (failed) return <OopsScreen onRetry={retry} />;
  if (chunk === null) return <LessonWaiting />;
  const { PlacementScreen: Placement } = chunk;
  return <Placement {...props} />;
}
