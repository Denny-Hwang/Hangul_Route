import type { ComponentProps, ReactElement } from 'react';
import { chunkDoor, useChunk } from '../chunk-door';
import { LessonWaiting } from '../lesson-content';
import { OopsScreen } from '../system/OopsScreen';

/*
 * The start bundle's door to Realia Read (F-A11Y-001 row AF-4b, after AMENDMENTS-FINISH-2026-11 FN-7): the game draws from
 * its chunk (`./realia-read-chunk.tsx`, marker `screen-chunk:realia-read`) once it is in; the lesson waiting screen until
 * then, the crash screen's Try again when it cannot load. The answer feedback of the choice games (the announcer, the Next
 * button, the look-here line) took the start bundle over its line, and this game is only played from Stage 4 on.
 */

type Chunk = typeof import('./realia-read-chunk');
export const realiaReadDoor = chunkDoor<Chunk>(() => import('./realia-read-chunk'));

export type RealiaReadGameProps = ComponentProps<Chunk['RealiaReadGame']>;

/** Realia Read, from its chunk. */
export function RealiaReadGame(props: RealiaReadGameProps): ReactElement {
  const { chunk, failed, retry } = useChunk(realiaReadDoor);
  if (failed) return <OopsScreen onRetry={retry} />;
  if (chunk === null) return <LessonWaiting />;
  const { RealiaReadGame: RealiaRead } = chunk;
  return <RealiaRead {...props} />;
}
