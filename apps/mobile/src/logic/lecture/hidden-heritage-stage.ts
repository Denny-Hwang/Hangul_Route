import { currBuildFloor, currBuiltInPct } from '../../config/flags';
import { resolveRemoteFlag, type RemoteConfigCache } from '../remote-config/remote-config';

/**
 * The projector follows the kill switch (§12.2): it draws the scene only while `game.hidden-heritage` reads on for a
 * device with no profile to bucket (the build floor `EXPO_PUBLIC_CURR_GAMES_OFF`, then the last known remote copy at
 * 100 %, or its built-in pct). Off, which is the launch state of row CM-36, the target's own picture stands in, the same
 * picture the learner's Pic-Word Match fallback shows.
 */
export const STAGE_SCENE_FLAG = 'game.hidden-heritage';
/** `currFlagOn(STAGE_SCENE_FLAG, null, cache)` without the store (a `game.<kind>` switch has no parent switch). */
export const stageSceneOn = (cache: RemoteConfigCache | null): boolean =>
  resolveRemoteFlag({ flag: STAGE_SCENE_FLAG, buildOn: currBuildFloor(STAGE_SCENE_FLAG), builtInPct: currBuiltInPct(STAGE_SCENE_FLAG), remote: cache?.flags ?? null, profileId: null });
