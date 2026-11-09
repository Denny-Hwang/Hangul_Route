import { joinIntentTarget, type JoinIntentTarget } from '../shell/boot-intent';

/**
 * F-AUTH-004 section 8.2 (row NS-5; OA-D14, OA-D20, CS-N8): where **Join on this device** goes. It leaves the account
 * exactly like a `join` boot intent (`joinIntentTarget`), with the code held in memory, never in an address:
 *
 * - a shared device (the chooser on): "Who is using this?" with the `join` trigger (**Pick who is joining.**), the code
 *   held for the learner picked there; a family code then meets Who is joining? on a device with 2 or more learners
 *   (OA-D14, Join's own checklist);
 * - a device with a learner, not shared: Join, prefilled;
 * - a device with no learner: the first run, with Welcome under it and the code kept for the Join that follows it (as
 *   the web hand-off keeps it for Welcome's first run, F-APP-001 section 3.6). Not Welcome's class-link card: that card
 *   says "Class code" and points to the app the learner may already use elsewhere, both untrue here.
 *
 * Joining itself stays Join's, with its consent step (F-SPACE-001): nothing here joins, links or registers a learner.
 */

export type JoinHereTarget =
  | Exclude<JoinIntentTarget, { screen: 'Onboarding' }>
  | { screen: 'Onboarding'; params: { screen: 'CreateProfile'; params: { firstRun: true; then: 'join'; code: string }; initial: false } };

export function joinHereTarget(code: string, hasProfile: boolean, shared: boolean): JoinHereTarget {
  const target = joinIntentTarget({ kind: 'join', code }, hasProfile, shared);
  if (target.screen !== 'Onboarding') return target;
  return { screen: 'Onboarding', params: { screen: 'CreateProfile', params: { firstRun: true, then: 'join', code }, initial: false } };
}
