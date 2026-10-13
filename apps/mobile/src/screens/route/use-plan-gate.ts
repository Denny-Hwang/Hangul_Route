import type { Profile } from '@hangul-route/content-schema';
import { effectiveLearnerType } from '../../logic/profiles/learner-type';
import { isParentSessionValid } from '../../logic/profiles/session';
import { planChangesOpen } from '../../logic/route/proposal-flow';
import { useAudience } from '../../store/audience';
import { useUiStore } from '../../store/ui-store';

/**
 * Whether this profile's weekly plan can be changed here without the grown-up gate
 * (`planChangesOpen`, F-PLAN-002 section 3.9): always for a self profile; for a child only while
 * the device opens grown-up screens directly. False while the profile is unknown.
 */
export function usePlanChangesOpen(profile: Profile | null): boolean {
  const parentGateOpenedAt = useUiStore((s) => s.parentGateOpenedAt);
  const { opensDirectly } = useAudience();
  if (profile === null) return false;
  const sessionOpen = isParentSessionValid(parentGateOpenedAt === null ? null : { openedAt: parentGateOpenedAt, profileId: 'family' }, Date.now());
  return planChangesOpen({ learnerType: effectiveLearnerType(profile), opensDirectly: opensDirectly(sessionOpen) });
}
