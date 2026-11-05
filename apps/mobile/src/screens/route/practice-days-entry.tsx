import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState, type ReactElement } from 'react';
import type { RootStackParamList } from '../../navigation/types';
import { LessonWaiting } from '../lesson-content';
import { OopsScreen } from '../system/OopsScreen';
import { loadPracticeDaysChunk, practiceDaysChunkLoaded } from './practice-days-load';

/*
 * The start bundle's door to My practice days (AMENDMENTS-ROUTE-CLASS-BLEND section 9.4, row BL-8; wireframe B7). The
 * screen and the placer are the practice-days chunk (`./practice-days-chunk.tsx`, marker `screen-chunk:practice-days`),
 * reached only through `loadPracticeDaysChunk`; the route is registered only while `flags.routeBlendEnabled` is on.
 */

type Props = NativeStackScreenProps<RootStackParamList, 'PracticeDays'>;

/** The `PracticeDays` route: the screen once the chunk is in, the waiting frame meanwhile, Try again when it cannot load. */
export function PracticeDaysRoute(props: Props): ReactElement {
  const [chunk, setChunk] = useState(practiceDaysChunkLoaded);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (chunk !== null || failed) return undefined;
    let live = true;
    loadPracticeDaysChunk().then(
      (c) => live && setChunk(c),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [chunk, failed]);
  if (failed) return <OopsScreen onRetry={() => setFailed(false)} />;
  if (chunk === null) return <LessonWaiting />;
  const { PracticeDaysScreen } = chunk;
  return <PracticeDaysScreen {...props} />;
}
