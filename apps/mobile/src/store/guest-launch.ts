import type { GuestRecord } from '@hangul-route/content-schema';
import { flags } from '../config/flags';
import { episodesAll, questsAll } from '../content';
import { guestLaunchPlan, guestLeaveTarget, guestScreenFor, guestSecondsIn, isFirstLetterStep, type GuestLeaveTarget } from '../logic/guest/guest-run';
import { firstQuestFor } from '../logic/onboarding/first-quest';
import { consumeBootIntent, peekBootIntent } from '../platform/app-root';
import { hasJoinHandoff } from '../platform/join-handoff';
import { track } from '../platform/telemetry';
import { useGuestStore, type GuestStart } from './guest-store';
import { useProfileStore } from './profile-store';
import { useProgressStore } from './progress-store';
import { heldJoin } from './who-chooser';

/**
 * [GU] AMENDMENTS-GUEST-FIRST-LESSON sections 6.1 to 6.4 and 12 (row GU-3): the guest run's way in and out at run time.
 * The rules are pure in `logic/guest/guest-run.ts`; this module reads the boot intent, the stores and the clock, starts
 * or ends the run (`store/guest-store.ts`, which closes the grown-up session first, CS-G3) and sends the `guest.*`
 * events (no profile id, GU-D15). Inert while `flags.guestLessonEnabled` is off, except that a `try` intent is taken
 * and dropped.
 */

/** Stage 1 quest 1 (`firstQuestFor`, GU-D4): the one quest a guest plays. */
export interface GuestQuestTarget {
  questId: string;
  episodeId: string;
}

/** Where the `Guest` stack opens: quest 1 from step 1, or the Not now card once quest 1 is done. */
export type GuestRoute = { screen: 'QuestPlayer'; params: GuestQuestTarget } | { screen: 'GuestLater' };

export function guestFirstQuest(): GuestQuestTarget | null {
  const first = firstQuestFor(episodesAll, questsAll);
  return first === null ? null : { questId: first.quest.id, episodeId: first.episode.id };
}

/** The `Guest` stack's screen for a record (section 6.1): quest 1, or `GuestLater` once quest 1 is done. */
export function guestRouteFor(record: Pick<GuestRecord, 'questDone'>, quest: GuestQuestTarget): GuestRoute {
  return guestScreenFor(record) === 'GuestLater' ? { screen: 'GuestLater' } : { screen: 'QuestPlayer', params: quest };
}

/** The new run whose first letter is still to come (`guest.first_letter` once per record, section 6.2). */
let firstLetterDue: { id: string; startedAt: number } | null = null;

async function beginRun(via: GuestStart, now: number): Promise<{ route: GuestRoute; resumed: boolean } | null> {
  const quest = guestFirstQuest();
  if (quest === null) return null;
  const started = await useGuestStore.getState().startGuestRun(via, now);
  if (started === null) return null;
  // The quest's results are written under the guest's id (GU-D2); its saved snapshot loads before the first write.
  useProgressStore.getState().hydrate(started.record.id).catch(() => undefined);
  if (!started.resumed) firstLetterDue = { id: started.record.id, startedAt: now };
  return { route: guestRouteFor(started.record, quest), resumed: started.resumed };
}

/**
 * The launch's guest step, once, after the stores hydrated and before the root stack mounts (so Welcome never shows
 * first): the `try` intent starts or resumes a run on a device with no learner profile (`guest.started { via: 'site' }`),
 * and with no intent a live run whose last play is within 30 minutes reopens (no event, GU-D12). The `try` intent is
 * always taken here. On a device with learner profiles nothing starts: row GU-5 opens the chooser with the trigger
 * `try` (until then, today's launch). Null: the launch goes on as before.
 */
export async function takeGuestLaunch(now: number = Date.now()): Promise<GuestRoute | null> {
  const intent = peekBootIntent();
  const guest = useGuestStore.getState();
  const plan = guestLaunchPlan({
    intent,
    profiles: useProfileStore.getState().profiles,
    guest: guest.record,
    guestLessonEnabled: flags.guestLessonEnabled,
    chooserOn: flags.whoChooserEnabled,
    joinHeld: heldJoin(now) !== null || hasJoinHandoff(),
    now,
  });
  if (plan.take) consumeBootIntent();
  if (plan.kind !== 'start' && plan.kind !== 'reopen') return null;
  const begun = await beginRun(plan.kind === 'start' ? 'site' : 'reopen', now);
  if (begun === null) return null;
  if (plan.kind === 'start') void track({ name: 'guest.started', payload: { via: 'site', resumed: begun.resumed } });
  return begun.route;
}

/** Welcome's **Back to my quest** (section 6.3): the run again, `guest.started { via: 'welcome', resumed: true }`. */
export async function resumeGuestFromWelcome(now: number = Date.now()): Promise<GuestRoute | null> {
  if (!flags.guestLessonEnabled) return null;
  const begun = await beginRun('welcome', now);
  if (begun === null) return null;
  void track({ name: 'guest.started', payload: { via: 'welcome', resumed: begun.resumed } });
  return begun.route;
}

/**
 * A quest step of the guest run entered (GU-D12: `lastAt` moves, so a reload within 30 minutes reopens). The first
 * Discover step of a new run sends `guest.first_letter { secondsIn }` once (section 6.2).
 */
export function noteGuestStep(steps: readonly { kind: string }[] | undefined, stepIndex: number, now: number = Date.now()): void {
  const { record, running } = useGuestStore.getState();
  if (!running || record === null) return;
  useGuestStore.getState().recordGuestPlay({}, now).catch(() => undefined);
  if (firstLetterDue === null || firstLetterDue.id !== record.id || !isFirstLetterStep(steps, stepIndex)) return;
  const secondsIn = guestSecondsIn(now - firstLetterDue.startedAt);
  firstLetterDue = null;
  void track({ name: 'guest.first_letter', payload: { secondsIn } });
}

/** Quest 1 finished in the guest run (section 7.1): `questDone` is written and `guest.quest_done { stars }` sent. */
export function noteGuestQuestDone(stars: 0 | 1 | 2 | 3, now: number = Date.now()): void {
  const { record, running } = useGuestStore.getState();
  if (!running || record === null) return;
  useGuestStore.getState().recordGuestPlay({ questDone: true }, now).catch(() => undefined);
  void track({ name: 'guest.quest_done', payload: { stars } });
}

/**
 * Section 6.4: the run ends (Close or leave in the quest, Close on the Not now card); the record stays. `at` names the
 * leave sent as `guest.left` (the quest's leave sheet sends `quest`). Returns where the root goes next.
 */
export function endGuestRunTo(at: 'quest' | null): GuestLeaveTarget {
  useGuestStore.getState().endGuestRun();
  firstLetterDue = null;
  if (at !== null) void track({ name: 'guest.left', payload: { at } });
  return guestLeaveTarget({ profiles: useProfileStore.getState().profiles, chooserOn: flags.whoChooserEnabled });
}
