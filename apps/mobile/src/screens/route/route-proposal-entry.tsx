import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ReactElement } from 'react';
import type { RootStackParamList } from '../../navigation/types';
import { chunkDoor, useChunk } from '../chunk-door';
import { LessonWaiting } from '../lesson-content';
import { OopsScreen } from '../system/OopsScreen';

/*
 * The start bundle's door to the `RouteProposal` route (AMENDMENTS-FINISH-2026-11 FN-7): the screen draws from its chunk
 * (`./route-proposal-chunk.tsx`, marker `screen-chunk:route-proposal`) once it is in, with the route's own props; the lesson waiting
 * screen until then, the crash screen's Try again when it cannot load. Precached like every chunk, so it opens offline.
 */

type Chunk = typeof import('./route-proposal-chunk');
export const routeProposalDoor = chunkDoor<Chunk>(() => import('./route-proposal-chunk'));

/** The `RouteProposal` route, from its chunk. */
export function RouteProposalScreen(props: NativeStackScreenProps<RootStackParamList, 'RouteProposal'>): ReactElement {
  const { chunk, failed, retry } = useChunk(routeProposalDoor);
  if (failed) return <OopsScreen onRetry={retry} />;
  if (chunk === null) return <LessonWaiting />;
  const { RouteProposalScreen: RouteProposal } = chunk;
  return <RouteProposal {...props} />;
}
