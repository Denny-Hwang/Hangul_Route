import type { StageKey } from '@hangul-route/content-schema';
import { useIsFocused } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { episodesAll } from '../../content';
import { recapStages, withStageCeremony } from '../../logic/reviews/stage-ceremony';
import { notifyProgressPersisted } from '../../logic/sync/persist-hook';
import type { RootStackParamList } from '../../navigation/types';
import { useProfileStore } from '../../store/profile-store';
import { useProgressStore } from '../../store/progress-store';
import { useCurrFlag } from '../../store/remote-config-store';
import { LessonWaiting } from '../lesson-content';
import { OopsScreen } from '../system/OopsScreen';

/*
 * The start bundle's door to the Stages 2-7 ceremony, the Stage Check and the one retroactive summary (F-CURR-002
 * sections 4.5, 4.8 step 7, 7.3, 10 and 12.2, row CM-22; design/wireframes/reviews/stage-check.md). The session logic
 * is the memory chunk's (`stageCheckApi()`); the ceremony, the check, the summary and the Journey header's buttons
 * are a chunk of their own (`./stage-check-chunk.tsx`, marker `screen-chunk:stage-check`), reached only through the
 * literal `import()` below. Here: the gates, the routes, the header slot, Home's summary trigger and the
 * `stageCeremonyAt` writer that Results and the summary use.
 *
 * Gates (section 12.2): the ceremony, its prize button and the summary run while `stageChecks` is on for a learner;
 * the Stage Check needs `memoryRecord` too. Off, nothing loads and nothing is written; latched results stay.
 */

type Chunk = typeof import('./stage-check-chunk');
let loading: Promise<Chunk> | null = null;
let loaded: Chunk | null = null;

function loadChunk(): Promise<Chunk> {
  loading ??= import('./stage-check-chunk').then(
    (chunk) => (loaded = chunk),
    (error: unknown) => {
      loading = null;
      throw error;
    },
  );
  return loading;
}

const learnerOf = (profileId: string | null): boolean =>
  profileId !== null && useProfileStore.getState().profiles.some((p) => p.id === profileId && (p.role ?? 'learner') === 'learner');

/** `stageChecks` on for this learner: the Stages 2-7 ceremony, its prize button and the summary. */
export function useStageCeremonyOn(profileId: string | null): boolean {
  const on = useCurrFlag('stageChecks');
  useProfileStore((s) => s.profiles);
  return on && learnerOf(profileId);
}

/**
 * Writes a `stageCeremonyAt` key for each stage on the hydrated snapshot (earliest wins), saved and synced like any
 * write; nothing when every stage already holds one. Results calls it for the stage whose ceremony it offers, the
 * summary for every stage it lists.
 */
export function latchStageCeremony(profileId: string, stages: readonly StageKey[], now: Date = new Date()): void {
  const progress = useProgressStore.getState();
  const snap = progress.hydratedFor.has(profileId) ? progress.byProfile[profileId] : undefined;
  if (!snap) return;
  const next = withStageCeremony(snap, stages, now.toISOString());
  if (next === null) return;
  progress.replaceSnapshot(profileId, next);
  notifyProgressPersisted(profileId);
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

/** How long Home waits before it opens the summary, and between tries (a dropped navigation is asked again). */
const RECAP_RETRY_MS = 400;
const RECAP_TRIES = 5;

/** Profiles whose summary this app session already showed: Home never opens it twice, even if a write fails. */
const recapOpened = new Set<string>();

/** The summary marks itself shown when it mounts (a navigation that a reset dropped is tried again on the next focus). */
export function markStageRecapShown(profileId: string): void {
  recapOpened.add(profileId);
}

/**
 * Home's trigger for the one retroactive summary (section 4.8 step 7, panel G): when Home is in front for a learner
 * with `stageChecks` on, the snapshot is read, and some finished Stage 2-7 has no `stageCeremonyAt` key, it opens
 * the summary once. The summary writes the keys, so it is never shown again on this or any other device.
 */
export function useStageRecapOnHome(profileId: string | null, navigation: NativeStackNavigationProp<RootStackParamList>): void {
  const on = useStageCeremonyOn(profileId);
  const focused = useIsFocused();
  const hydrated = useProgressStore((s) => (profileId ? s.hydratedFor.has(profileId) : false));
  const snap = useProgressStore((s) => (profileId ? s.byProfile[profileId] : undefined));
  const pending = on && hydrated && snap !== undefined && profileId !== null && !recapOpened.has(profileId) ? recapStages(snap, episodesAll).length > 0 : false;
  useEffect(() => {
    if (!pending || !focused || profileId === null) return undefined;
    // A navigation asked while the app is still settling its first screen can be dropped, so it is asked again,
    // a few times, until the summary marks itself shown.
    let tries = 0;
    const ask = (): void => {
      if (recapOpened.has(profileId) || tries >= RECAP_TRIES) return;
      tries += 1;
      navigation.navigate('StageRecap');
      timer = setTimeout(ask, RECAP_RETRY_MS);
    };
    let timer = setTimeout(ask, RECAP_RETRY_MS);
    return () => clearTimeout(timer);
  }, [pending, focused, profileId, navigation]);
}

export interface StageHeaderSlotProps {
  place: 'actions' | 'caption';
  profileId: string | null;
  stage: StageKey;
  complete: boolean;
  onOpenPrize: () => void;
  onOpenCheck: () => void;
}

/** A Stage 2-7 header's buttons (See your prize, Stage Check) or its tested-out caption; nothing while off or loading. */
export function StageHeaderSlot(props: StageHeaderSlotProps): React.ReactElement | null {
  const ceremonyOn = useStageCeremonyOn(props.profileId);
  const cellCheck = useCurrFlag('cellCheck');
  const want = props.place === 'actions' ? ceremonyOn && props.complete : cellCheck && !props.complete;
  const ui = useChunk(want).chunk;
  return ui === null ? null : <ui.StageHeaderExtras {...props} />;
}

/** The `StageCheck` route (panels D to F, H): the chunk's screen once it is in; one that cannot load shows Try again. */
export function StageCheckRoute(props: NativeStackScreenProps<RootStackParamList, 'StageCheck'>): React.ReactElement {
  const { chunk, failed, retry } = useChunk(true);
  if (failed) return <OopsScreen onRetry={retry} />;
  if (chunk === null) return <LessonWaiting />;
  const { StageCheckScreen } = chunk;
  return <StageCheckScreen {...props} />;
}

/** The `StageRecap` route: the one retroactive summary (panel G). */
export function StageRecapRoute(props: NativeStackScreenProps<RootStackParamList, 'StageRecap'>): React.ReactElement {
  const { chunk, failed, retry } = useChunk(true);
  if (failed) return <OopsScreen onRetry={retry} />;
  if (chunk === null) return <LessonWaiting />;
  const { StageRecapScreen } = chunk;
  return <StageRecapScreen {...props} />;
}

/** The `StageComplete` route of a Stage 2-7: the stage ceremony (panel B). */
export function UpperStageCompleteRoute(props: NativeStackScreenProps<RootStackParamList, 'StageComplete'>): React.ReactElement {
  const { chunk, failed, retry } = useChunk(true);
  if (failed) return <OopsScreen onRetry={retry} />;
  if (chunk === null) return <LessonWaiting />;
  const { UpperStageCompleteScreen } = chunk;
  return <UpperStageCompleteScreen {...props} />;
}
