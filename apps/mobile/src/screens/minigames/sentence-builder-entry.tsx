import type { ComponentProps, ReactElement } from 'react';
import { chunkDoor, useChunk } from '../chunk-door';
import { LessonWaiting } from '../lesson-content';
import { OopsScreen } from '../system/OopsScreen';

/*
 * The start bundle's door to Sentence Builder (AMENDMENTS-FINISH-2026-11 FN-7): the game draws from its chunk
 * (`./sentence-builder-chunk.tsx`, marker `screen-chunk:sentence-builder`) once it is in; the lesson waiting screen until
 * then, the crash screen's Try again when it cannot load.
 */

type Chunk = typeof import('./sentence-builder-chunk');
export const sentenceBuilderDoor = chunkDoor<Chunk>(() => import('./sentence-builder-chunk'));

export type SentenceBuilderGameProps = ComponentProps<Chunk['SentenceBuilderGame']>;

/** Sentence Builder, from its chunk. */
export function SentenceBuilderGame(props: SentenceBuilderGameProps): ReactElement {
  const { chunk, failed, retry } = useChunk(sentenceBuilderDoor);
  if (failed) return <OopsScreen onRetry={retry} />;
  if (chunk === null) return <LessonWaiting />;
  const { SentenceBuilderGame: SentenceBuilder } = chunk;
  return <SentenceBuilder {...props} />;
}
