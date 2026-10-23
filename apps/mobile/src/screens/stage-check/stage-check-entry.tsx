import type { StageKey } from '@hangul-route/content-schema';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState, type ReactElement } from 'react';
import type { RootStackParamList } from '../../navigation/types';
import { useProfileStore } from '../../store/profile-store';
import { useCurrFlag } from '../../store/remote-config-store';
import { LessonWaiting } from '../lesson-content';
import { OopsScreen } from '../system/OopsScreen';

/*
 * The start bundle's door to the Stages 2-7 ceremony, the Stage Check and the one retroactive summary (F-CURR-002
 * sections 4.5, 4.8 step 7, 7.3, 10 and 12.2, row CM-22; design/wireframes/reviews/stage-check.md). Only the gate, the
 * three routes and two slots live here, so the start bundle stays at its line (section 10): the session logic is the
 * memory chunk's (`stageCheckApi()`); every stage's prize ceremony (Stage 1's too, unchanged), the check, the summary
 * and Home's trigger for it, the Journey header's buttons and the `stageCeremonyAt` writer are a chunk of their own (`./stage-check-chunk.tsx`, marker
 * `screen-chunk:stage-check`), reached only through the literal `import()` below.
 *
 * Gates (section 12.2): the ceremony, its prize button and the summary run while `stageChecks` is on for a learner;
 * the Stage Check needs `memoryRecord` too. Off, nothing loads and nothing is written; latched results stay.
 */

type Chunk = typeof import('./stage-check-chunk');
let loading: Promise<Chunk> | null = null;
let loaded: Chunk | null = null;

/** The Stage Check's chunk, loaded once (a failed load is tried again on the next ask). */
export function loadStageCheckChunk(): Promise<Chunk> {
  loading ??= import('./stage-check-chunk').then(
    (chunk) => (loaded = chunk),
    (error: unknown) => {
      loading = null;
      throw error;
    },
  );
  return loading;
}

/** `stageChecks` on for this learner (never a grown-up persona): the Stages 2-7 ceremony, its prize button and the summary. */
export function useStageCeremonyOn(profileId: string | null): boolean {
  const on = useCurrFlag('stageChecks');
  const profiles = useProfileStore((s) => s.profiles);
  return on && profiles.some((p) => p.id === profileId && (p.role ?? 'learner') === 'learner');
}

/**
 * Latches `stageCeremonyAt` for the stages (earliest wins) through the chunk's writer: Results calls it for the stage
 * whose ceremony it offers, so that stage is never in the summary.
 */
export function latchStageCeremonyLater(profileId: string, stages: readonly StageKey[]): void {
  loadStageCheckChunk().then(
    (chunk) => chunk.latchStageCeremony(profileId, stages),
    () => undefined,
  );
}

function useChunk(on: boolean): { chunk: Chunk | null; failed: boolean; retry: () => void } {
  const [chunk, setChunk] = useState<Chunk | null>(loaded);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!on || chunk !== null || failed) return undefined;
    let live = true;
    loadStageCheckChunk().then(
      (c) => live && setChunk(c),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [on, chunk, failed]);
  return { chunk: on ? chunk : null, failed, retry: () => setFailed(false) };
}

/** A route's frame while the chunk loads; one that cannot load shows Try again. */
function Waiting({ failed, retry }: { failed: boolean; retry: () => void }): ReactElement {
  return failed ? <OopsScreen onRetry={retry} /> : <LessonWaiting />;
}

/** A Stage 2-7 header's extras: beside the pill, under the header (large text), or the tested-out caption. */
export interface StageHeaderSlotProps {
  place: 'actions' | 'caption' | 'below';
  stage: StageKey;
  complete: boolean;
  profileId: string | null;
}

/** A Stage 2-7 header's buttons (See your prize, Stage Check) or its tested-out caption; nothing while off or loading. */
export function StageHeaderSlot(props: StageHeaderSlotProps): ReactElement | null {
  const ceremonyOn = useStageCeremonyOn(props.profileId);
  const cellCheck = useCurrFlag('cellCheck');
  const ui = useChunk(props.stage !== 'stage1' && (props.complete ? ceremonyOn : cellCheck)).chunk;
  return ui === null ? null : <ui.StageHeaderExtras {...props} />;
}

/** Home's slot for the one retroactive summary (section 4.8 step 7): the chunk's trigger while `stageChecks` is on. */
export function StageRecapSlot({ profileId }: { profileId: string | null }): ReactElement | null {
  const ui = useChunk(useStageCeremonyOn(profileId)).chunk;
  return ui === null || profileId === null ? null : <ui.StageRecapTrigger profileId={profileId} />;
}

/** The `StageCheck` route (panels D to F, H). */
export function StageCheckRoute(props: NativeStackScreenProps<RootStackParamList, 'StageCheck'>): ReactElement {
  const ui = useChunk(true);
  if (ui.chunk === null) return <Waiting {...ui} />;
  const { StageCheckScreen } = ui.chunk;
  return <StageCheckScreen {...props} />;
}

/** The `StageRecap` route: the one retroactive summary (panel G). */
export function StageRecapRoute(props: NativeStackScreenProps<RootStackParamList, 'StageRecap'>): ReactElement {
  const ui = useChunk(true);
  if (ui.chunk === null) return <Waiting {...ui} />;
  const { StageRecapScreen } = ui.chunk;
  return <StageRecapScreen {...props} />;
}

/**
 * The `StageComplete` route: every stage's prize ceremony (Stage 1's wall and legendary cards unchanged, panel B for a
 * Stage 2-7), by the one prize table, from the chunk.
 */
export function StageCompleteRoute(props: NativeStackScreenProps<RootStackParamList, 'StageComplete'>): ReactElement {
  const ui = useChunk(true);
  if (ui.chunk === null) return <Waiting {...ui} />;
  const { StageCompleteScreen } = ui.chunk;
  return <StageCompleteScreen {...props} />;
}
