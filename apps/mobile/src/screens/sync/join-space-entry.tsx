import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ReactElement } from 'react';
import type { RootStackParamList } from '../../navigation/types';
import { chunkDoor, useChunk } from '../chunk-door';
import { LessonWaiting } from '../lesson-content';
import { OopsScreen } from '../system/OopsScreen';

/*
 * The start bundle's door to the `JoinSpace` route (AMENDMENTS-FINISH-2026-11 FN-7): the screen draws from its chunk
 * (`./join-space-chunk.tsx`, marker `screen-chunk:join-space`) once it is in, with the route's own props; the lesson waiting
 * screen until then, the crash screen's Try again when it cannot load. Precached like every chunk, so it opens offline.
 */

type Chunk = typeof import('./join-space-chunk');
export const joinSpaceDoor = chunkDoor<Chunk>(() => import('./join-space-chunk'));

/** The `JoinSpace` route, from its chunk. */
export function JoinSpaceScreen(props: NativeStackScreenProps<RootStackParamList, 'JoinSpace'>): ReactElement {
  const { chunk, failed, retry } = useChunk(joinSpaceDoor);
  if (failed) return <OopsScreen onRetry={retry} />;
  if (chunk === null) return <LessonWaiting />;
  const { JoinSpaceScreen: JoinSpace } = chunk;
  return <JoinSpace {...props} />;
}
