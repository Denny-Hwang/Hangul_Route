import type { ComponentProps, ReactElement } from 'react';
import { View } from 'react-native';
import { chunkDoor, useChunk } from '../chunk-door';

/*
 * The start bundle's door to the trace page of Discover (AMENDMENTS-STAGE1-TRACE-COVERAGE row TC-1b): the pad draws from its
 * chunk (`./discover-trace-chunk.tsx`, marker `screen-chunk:discover-trace`) once it is in. The step asks for the chunk
 * as it opens (`preloadTracePad`), well before the learner reaches the page, so it is almost always in. Until it is (or when
 * it cannot load) the page draws only its pinned buttons: Previous and Continue are always there, and the page is never a
 * dead end (unscored: nothing is lost by not tracing).
 */

type Chunk = typeof import('./discover-trace-chunk');
export const discoverTraceDoor = chunkDoor<Chunk>(() => import('./discover-trace-chunk'));

export type DiscoverTracePadProps = ComponentProps<Chunk['DiscoverTracePad']>;

/** Asks for the chunk (once per app session); a failed load is asked again by the next call. */
export function preloadTracePad(): void {
  discoverTraceDoor.load().catch(() => undefined);
}

/** The trace page, from its chunk; its pinned buttons alone while the chunk is not in. */
export function DiscoverTracePad(props: DiscoverTracePadProps): ReactElement {
  const { chunk } = useChunk(discoverTraceDoor);
  if (chunk === null) {
    return (
      <View testID="discover-write-loading" style={{ flex: 1, minHeight: 0, justifyContent: 'flex-end' }}>
        {props.pinned}
      </View>
    );
  }
  const { DiscoverTracePad: Pad } = chunk;
  return <Pad {...props} />;
}
