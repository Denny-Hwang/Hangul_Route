import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState, type ReactElement } from 'react';
import { WEEK_DROP_WEEKS_BUILT } from '../../content/week-drops';
import { dropWeekFor } from '../../logic/week-drop/calendar';
import type { RootStackParamList } from '../../navigation/types';
import { useCurrFlag } from '../../store/remote-config-store';
import { LessonWaiting } from '../lesson-content';
import { OopsScreen } from '../system/OopsScreen';

/*
 * The start bundle's door to "This week in Korea" (F-CURR-002 §5.7, §10 and §12.2, row CM-48;
 * design/wireframes/home/this-week-in-korea.md). The Home card and the drop's pages are a chunk of their own
 * (`./week-drop-chunk.tsx`, marker `screen-chunk:week-drop`), reached only through the literal `import()` below, so the
 * start bundle grows only by this door, the calendar key and the list of weeks that have a drop. Gate: `weeklyDrop`
 * (built-in pct 0, so the row merges dark). Off, nothing loads, there is no card, and a deep visit to the route goes
 * back; the memory states the drops' words earned stay. A week with no drop loads nothing either.
 */

type Chunk = typeof import('./week-drop-chunk');
let loading: Promise<Chunk> | null = null;
let loaded: Chunk | null = null;

function loadChunk(): Promise<Chunk> {
  loading ??= import('./week-drop-chunk').then(
    (chunk) => (loaded = chunk),
    (error: unknown) => {
      loading = null;
      throw error;
    },
  );
  return loading;
}

function useChunk(on: boolean): { chunk: Chunk | null; failed: boolean; retry: () => void } {
  const [chunk, setChunk] = useState<Chunk | null>(loaded);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!on || chunk !== null || failed) return undefined;
    let live = true;
    loadChunk().then(
      (c) => live && setChunk(c),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [on, chunk, failed]);
  return { chunk: on ? chunk : null, failed, retry: () => setFailed(false) };
}

/** Home's "This week in Korea" card: only while `weeklyDrop` is on and this local week has a drop, once its chunk is in. */
export function WeekDropHomeSlot({ profileId, today }: { profileId: string | null; today: string }): ReactElement | null {
  const on = useCurrFlag('weeklyDrop');
  const week = on && profileId !== null ? dropWeekFor(WEEK_DROP_WEEKS_BUILT, today) : null;
  const ui = useChunk(week !== null).chunk;
  return ui === null || week === null || profileId === null ? null : <ui.WeekDropCard profileId={profileId} week={week} />;
}

type Props = NativeStackScreenProps<RootStackParamList, 'WeekDrop'>;

/** The `WeekDrop` route: the drop's pages once the chunk is in; the crash screen's Try again when it cannot load. */
export function WeekDropRoute(props: Props): ReactElement {
  const on = useCurrFlag('weeklyDrop');
  const { chunk, failed, retry } = useChunk(on);
  useEffect(() => {
    if (!on && props.navigation.canGoBack()) props.navigation.goBack();
  }, [on, props.navigation]);
  if (failed) return <OopsScreen onRetry={retry} />;
  if (chunk === null) return <LessonWaiting />;
  const { WeekDropScreen } = chunk;
  return <WeekDropScreen {...props} />;
}
