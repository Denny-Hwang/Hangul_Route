import { CLASS_MOVES_SEEN_KEY } from './class-update-store';
import { FREE_END_SEEN_KEY } from './free-end-seen';
import { SETTINGS_KEY } from './locale-store';
import { MEMBERSHIPS_KEY, TRANSFERS_ON_KEY, TRANSFER_SCOPE_KEY, TRANSFER_SELF_SET_KEY } from './membership-store';
import { NOTES_KEY } from './notes-store';
import { PLACEMENT_RUN_KEY, PLACEMENT_UI_KEY } from './placement-run-store';
import { PLANS_KEY } from './plan-store';
import { PROGRESS_KEY } from './progress-store';
import { ROUTE_UI_KEY } from './route-store';
import { STORY_BOOKMARKS_KEY } from './story-store';
import { SYNC_KEY } from './sync-store';
import { TIER_KEY } from './tier-store';
import { seenKey as ROUTE_MAP_UI_KEY } from '../logic/my-route/seen';

/**
 * [OA] Every per-profile storage key (AMENDMENTS-ONE-ACCOUNT-MANY-USERS section 10.4, row OA-7a, CS-20), from the
 * template each store exports. Importing this module also loads every store that keeps one, so each has subscribed
 * to `onProfileRemoved` before a removal runs (`store/remove-from-device.ts`). A store that adds a per-profile key adds
 * it here; `__tests__/profile-keys.test.ts` fails on a template in the source that this list does not name, and the
 * removal sweep fails on a key the store leaves behind.
 */
export const PER_PROFILE_KEYS: Readonly<Record<string, (profileId: string) => string>> = {
  progress: PROGRESS_KEY,
  sync: SYNC_KEY,
  memberships: MEMBERSHIPS_KEY,
  plans: PLANS_KEY,
  tier: TIER_KEY,
  settings: SETTINGS_KEY,
  'route-ui': ROUTE_UI_KEY,
  'route-map-ui': ROUTE_MAP_UI_KEY,
  'placement-run': PLACEMENT_RUN_KEY,
  'placement-ui': PLACEMENT_UI_KEY,
  notes: NOTES_KEY,
  'class-moves-seen': CLASS_MOVES_SEEN_KEY,
  'free-end-seen': FREE_END_SEEN_KEY,
  'transfer-scope': TRANSFER_SCOPE_KEY,
  'transfers-on': TRANSFERS_ON_KEY,
  'transfer-self-set': TRANSFER_SELF_SET_KEY,
  'story-bookmarks': STORY_BOOKMARKS_KEY,
};
