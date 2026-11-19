import type { ComponentProps, ReactElement } from 'react';
import { chunkDoor, useChunk } from '../chunk-door';
import { LessonWaiting } from '../lesson-content';
import { OopsScreen } from '../system/OopsScreen';

/*
 * The start bundle's door to Trace Word (AMENDMENTS-FINISH-2026-11 FN-7): the game draws from its chunk
 * (`./trace-word-chunk.tsx`, marker `screen-chunk:trace-word`) once it is in; the lesson waiting screen until then, the
 * crash screen's Try again when it cannot load.
 */

type Chunk = typeof import('./trace-word-chunk');
export const traceWordDoor = chunkDoor<Chunk>(() => import('./trace-word-chunk'));

export type TraceWordGameProps = ComponentProps<Chunk['TraceWordGame']>;

/** Trace Word, from its chunk. */
export function TraceWordGame(props: TraceWordGameProps): ReactElement {
  const { chunk, failed, retry } = useChunk(traceWordDoor);
  if (failed) return <OopsScreen onRetry={retry} />;
  if (chunk === null) return <LessonWaiting />;
  const { TraceWordGame: TraceWord } = chunk;
  return <TraceWord {...props} />;
}
