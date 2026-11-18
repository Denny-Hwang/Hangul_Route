import type { ComponentProps, ReactElement } from 'react';
import { chunkDoor, useChunk } from '../chunk-door';
import { LessonWaiting } from '../lesson-content';
import { OopsScreen } from '../system/OopsScreen';

/*
 * The start bundle's door to the typing games (AMENDMENTS-FINISH-2026-11 FN-7): Type Hangul and Write Frame draw from
 * the writing chunk (`./writing-chunk.tsx`, marker `screen-chunk:writing`) once it is in, with the props they were given;
 * the lesson waiting screen until then, the crash screen's Try again when it cannot load. My Story's switch-off and
 * failed-chunk fallback (Write Frame on the first frame) comes through here too.
 */

type Chunk = typeof import('./writing-chunk');
export const writingDoor = chunkDoor<Chunk>(() => import('./writing-chunk'));

export type TypeHangulGameProps = ComponentProps<Chunk['TypeHangulGame']>;
export type WriteFrameGameProps = ComponentProps<Chunk['WriteFrameGame']>;

/** Type Hangul, from the writing chunk. */
export function TypeHangulGame(props: TypeHangulGameProps): ReactElement {
  const { chunk, failed, retry } = useChunk(writingDoor);
  if (failed) return <OopsScreen onRetry={retry} />;
  if (chunk === null) return <LessonWaiting />;
  const { TypeHangulGame: TypeHangul } = chunk;
  return <TypeHangul {...props} />;
}

/** Write Frame, from the writing chunk. */
export function WriteFrameGame(props: WriteFrameGameProps): ReactElement {
  const { chunk, failed, retry } = useChunk(writingDoor);
  if (failed) return <OopsScreen onRetry={retry} />;
  if (chunk === null) return <LessonWaiting />;
  const { WriteFrameGame: WriteFrame } = chunk;
  return <WriteFrame {...props} />;
}
