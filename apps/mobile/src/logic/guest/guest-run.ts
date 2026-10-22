import { GUEST_SECONDS_IN, type GuestRecord } from '@hangul-route/content-schema';
import type { TelemetryEvent } from '../../platform/telemetry';
import type { BootIntent } from '../shell/boot-intent';
import type { QuestFinish, QuestPlayerPorts } from '../quest-flow/quest-player-ports';
import { guestEntry, guestReopens, isLiveGuest, type GuestRuleProfile } from './guest-model';

/**
 * [GU] AMENDMENTS-GUEST-FIRST-LESSON sections 6.1, 6.2, 6.4, 7.1 and 12 (row GU-3): the guest run's launch, its screens
 * and its exits as pure rules. `store/guest-launch.ts` reads the stores, the boot intent and the clock and acts on the
 * answers; the screens of the `Guest` stack (`navigation/guest.tsx`) take their ports from here.
 */

/** What the launch does with the boot intent and the device's guest record (sections 6.1 and 6.4). */
export type GuestLaunchPlan =
  /** Today's launch. `take`: the boot intent is consumed here (a `try` that is ignored). */
  | { kind: 'none'; take: boolean }
  /** "Who is using this?" with the trigger `try` (row GU-5 opens it; until then today's launch). */
  | { kind: 'chooser'; take: boolean }
  /** A guest run from the site's Start learning: a new one, or the live one resumed (`guest.started { via: 'site' }`). */
  | { kind: 'start'; take: boolean }
  /** GU-D12: the live run reopened where it was, within `GUEST_REOPEN_MS` (no `guest.started`, the same run). */
  | { kind: 'reopen'; take: false };

export interface GuestLaunchInput {
  intent: BootIntent | null;
  profiles: readonly GuestRuleProfile[];
  guest: GuestRecord | null | undefined;
  guestLessonEnabled: boolean;
  chooserOn: boolean;
  /** A join code held in memory or handed over by the family home (OA-D20): a join wins over `try`. */
  joinHeld: boolean;
  now: number;
}

const learnerCount = (profiles: readonly GuestRuleProfile[]): number => profiles.filter((p) => p.role === undefined || p.role === 'learner').length;

/**
 * Sections 6.1 and 6.4, CS-G4. The `try` intent is always taken by the launch: with the switch off it is dropped (a
 * live record is kept, unseen), on a device with learner profiles it never starts a guest (the chooser with the
 * trigger `try` when the chooser is on, else today's launch), and a held join code wins. On a device with no learner
 * profile it starts a guest or resumes the live one. `who=1` with `try` counts as `try` there, since the chooser has
 * nobody to show. With no intent at all, a live guest whose last play is within 30 minutes reopens. Every other
 * intent (a `gate=`, a join, `who=1` alone) is left to the boot intent hook.
 */
export function guestLaunchPlan(input: GuestLaunchInput): GuestLaunchPlan {
  const { intent, profiles, guest, guestLessonEnabled, chooserOn, joinHeld, now } = input;
  const tried = intent?.kind === 'try' || (intent?.kind === 'who' && intent.try === true);
  const take = intent?.kind === 'try';
  if (!guestLessonEnabled) return { kind: 'none', take };
  const shared = learnerCount(profiles) > 0;
  if (tried && !joinHeld && !(intent?.kind === 'who' && shared)) {
    const entry = guestEntry({ intent: 'try', profiles, guest, flags: { guestLessonEnabled }, chooserOn });
    if (entry.kind === 'guest') return { kind: 'start', take: true };
    if (entry.kind === 'chooser') return { kind: 'chooser', take };
    return { kind: 'none', take };
  }
  if (intent === null && !shared && isLiveGuest(guest, profiles) && guestReopens(guest, now)) return { kind: 'reopen', take: false };
  return { kind: 'none', take };
}

/** The screen of the `Guest` stack a run opens on: quest 1 from step 1, or the Not now card once quest 1 is done. */
export type GuestScreen = 'QuestPlayer' | 'GuestLater';

export function guestScreenFor(guest: Pick<GuestRecord, 'questDone'>): GuestScreen {
  return guest.questDone ? 'GuestLater' : 'QuestPlayer';
}

/** Section 12: seconds from the run's start to the first letter, as its bucket (never a time). */
export function guestSecondsIn(ms: number): (typeof GUEST_SECONDS_IN)[number] {
  const seconds = Math.max(0, ms) / 1000;
  if (seconds < 15) return '0-15';
  if (seconds < 30) return '15-30';
  if (seconds < 60) return '30-60';
  return '60+';
}

/**
 * Section 6.2: Discover page 1 of quest 1 is the first `discover` step of the quest (the step after Hoya's hello), so
 * `guest.first_letter` rides the step that shows ㅏ. False for any other step, or a quest without one.
 */
export function isFirstLetterStep(steps: readonly { kind: string }[] | undefined, stepIndex: number): boolean {
  if (steps === undefined) return false;
  const first = steps.findIndex((s) => s.kind === 'discover');
  return first !== -1 && first === stepIndex;
}

/** Section 6.4: where Close or leave goes once the run has ended. */
export type GuestLeaveTarget = 'welcome' | 'chooser' | 'home';

/**
 * Welcome (with its waiting card) on a device with no learner profile; "Who is using this?" on a device with
 * profiles while the chooser is on (where the guest's tile shows, row GU-5); else Home of the active profile.
 */
export function guestLeaveTarget(input: { profiles: readonly GuestRuleProfile[]; chooserOn: boolean }): GuestLeaveTarget {
  if (learnerCount(input.profiles) === 0) return 'welcome';
  return input.chooserOn ? 'chooser' : 'home';
}

/** The root stack after the run ended (section 6.4), so nothing of the `Guest` stack is left under it. */
export type GuestLeaveState =
  | { index: 0; routes: [{ name: 'Onboarding' }] }
  | { index: 0; routes: [{ name: 'WhoIsUsing'; params: { trigger: 'manual' } }] }
  | { index: 0; routes: [{ name: 'Main' }] };

export function guestLeaveState(target: GuestLeaveTarget): GuestLeaveState {
  if (target === 'welcome') return { index: 0, routes: [{ name: 'Onboarding' }] };
  if (target === 'chooser') return { index: 0, routes: [{ name: 'WhoIsUsing', params: { trigger: 'manual' } }] };
  return { index: 0, routes: [{ name: 'Main' }] };
}

/** The `Guest` stack after a finished run: Results alone, so its Back (and every back) is the guest variant's own. */
export interface GuestResultsState {
  index: 0;
  routes: [{ name: 'Results'; params: { questId: string; episodeId: string; stars: QuestFinish['stars']; correct: number; total: number; retries: number } }];
}

export function guestResultsState(questId: string, episodeId: string, result: QuestFinish): GuestResultsState {
  const { stars, correct, total, retries } = result;
  return { index: 0, routes: [{ name: 'Results', params: { questId, episodeId, stars, correct, total, retries } }] };
}

export interface GuestExitDeps {
  questId: string;
  episodeId: string;
  /** Resets the `Guest` stack to Results (section 7.1). */
  toResults: (state: GuestResultsState) => void;
  /** The leave sheet's Leave: the run ends and the root goes to section 6.4's target. */
  leave: () => void;
  track: (event: TelemetryEvent) => unknown;
}

/**
 * Section 7.1, the guest ports of the quest player: a finished run opens the guest's Results inside the `Guest` stack,
 * Leave ends the run (section 6.4), and every quest event goes out with no `profileId` (GU-D15: the telemetry filter
 * drops one anyway). Nothing here names a learner route: no episode page, no Journey, no Home.
 */
export function guestQuestExits(deps: GuestExitDeps): Pick<QuestPlayerPorts, 'finish' | 'leave' | 'track'> {
  return {
    finish: (result) => deps.toResults(guestResultsState(deps.questId, deps.episodeId, result)),
    leave: () => deps.leave(),
    track: (event) => {
      void deps.track(event);
    },
  };
}
