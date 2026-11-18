import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ReactElement } from 'react';
import type { RootStackParamList } from '../../navigation/types';
import { chunkDoor, useChunk } from '../chunk-door';
import { LessonWaiting } from '../lesson-content';
import { OopsScreen } from '../system/OopsScreen';

/*
 * The start bundle's door to the `VocabSpeedRound` route (AMENDMENTS-FINISH-2026-11 FN-7): the screen draws from its chunk
 * (`./speed-round-chunk.tsx`, marker `screen-chunk:speed-round`) once it is in, with the route's own props; the lesson waiting
 * screen until then, the crash screen's Try again when it cannot load. Precached like every chunk, so it opens offline.
 */

type Chunk = typeof import('./speed-round-chunk');
export const speedRoundDoor = chunkDoor<Chunk>(() => import('./speed-round-chunk'));

/** The `VocabSpeedRound` route, from its chunk. */
export function VocabSpeedRoundScreen(props: NativeStackScreenProps<RootStackParamList, 'VocabSpeedRound'>): ReactElement {
  const { chunk, failed, retry } = useChunk(speedRoundDoor);
  if (failed) return <OopsScreen onRetry={retry} />;
  if (chunk === null) return <LessonWaiting />;
  const { VocabSpeedRoundScreen: SpeedRound } = chunk;
  return <SpeedRound {...props} />;
}
