import type { ReactElement } from 'react';
import { chunkDoor, useChunk } from '../chunk-door';
import { LessonWaiting } from '../lesson-content';
import { OopsScreen } from '../system/OopsScreen';
import type { StoryReaderViewProps } from './StoryReaderView';

/*
 * The start bundle's door to the story reader (AMENDMENTS-FINISH-2026-11 FN-7): `StoryReaderView` draws from its chunk
 * (`./reader-chunk.tsx`, marker `screen-chunk:story-reader`) once it is in, with the props it was given; the
 * lesson waiting screen until then, the crash screen's Try again when it cannot load.
 */

type Chunk = typeof import('./reader-chunk');
export const storyReaderDoor = chunkDoor<Chunk>(() => import('./reader-chunk'));

export type { StoryReaderViewProps };

/** The story reader, from its chunk. */
export function StoryReaderView(props: StoryReaderViewProps): ReactElement {
  const { chunk, failed, retry } = useChunk(storyReaderDoor);
  if (failed) return <OopsScreen onRetry={retry} />;
  if (chunk === null) return <LessonWaiting />;
  const { StoryReaderView: Reader } = chunk;
  return <Reader {...props} />;
}
