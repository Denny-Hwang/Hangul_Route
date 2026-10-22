import type { GuestRecord } from '@hangul-route/content-schema';
import { flags } from '../config/flags';
import { episodesAll, questsAll } from '../content';
import { guestLaunchPlan, guestLeaveTarget, guestScreenFor, guestSecondsIn, isFirstLetterStep, type GuestLeaveTarget } from '../logic/guest/guest-run';
import { firstQuestFor } from '../logic/onboarding/first-quest';
import { consumeBootIntent, peekBootIntent } from '../platform/app-root';
import { hasJoinHandoff } from '../platform/join-handoff';
import { clearFirstLetterDue, clearGuestLeft, firstLetterDueFor, guestLeftHere, markFirstLetterDue, markGuestLeft } from '../platform/guest-tab';
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

/**
 * How long the launch waits for the guest step (the `hr:profiles` lock and the record's read and write), as the boot
 * sweep does (`GUEST_LOCK_WAIT_MS`): past it the launch goes on as before (Welcome, with its card once the record is
 * read), and a run the step starts late is ended at once, so it never runs behind Welcome.
 */
export const GUEST_LAUNCH_WAIT_MS = 2_000;

/**
 * GU-D12: `lastAt` moves with play, at most once a minute between quest ends, so a run does not take the profiles
 * lock, write the record and tell every other tab on each step. The 30-minute reopen window is then at most a minute
 * short.
 */
export const GUEST_PLAY_NOTE_MS = 60_000;

async function beginRun(via: GuestStart, now: number): Promise<{ route: GuestRoute; resumed: boolean } | null> {
  const quest = guestFirstQuest();
  if (quest === null) return null;
  const started = await useGuestStore.getState().startGuestRun(via, now);
  if (started === null) return null;
  clearGuestLeft();
  // The quest's results are written under the guest's id (GU-D2); its saved snapshot loads before the first write.
  useProgressStore.getState().hydrate(started.record.id).catch(() => undefined);
  if (!started.resumed) markFirstLetterDue(started.record.id, now);
  return { route: guestRouteFor(started.record, quest), resumed: started.resumed };
}

/** `step`'s answer, or null once `ms` have passed; a run the step starts after that is ended (`late`). */
function withinLaunchWait<T extends { route: GuestRoute } | null>(step: Promise<T>, ms: number): Promise<T | null> {
  return new Promise<T | null>((resolve) => {
    let late = false;
    const timer = setTimeout(() => {
      late = true;
      resolve(null);
    }, ms);
    step.then(
      (result) => {
        if (late) {
          if (result !== null) useGuestStore.getState().endGuestRun();
          return;
        }
        clearTimeout(timer);
        resolve(result);
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
    );
  });
}

/**
 * The launch's guest step, once, after the stores hydrated and before the root stack mounts (so Welcome never shows
 * first; waited for at most `GUEST_LAUNCH_WAIT_MS`): the `try` intent starts or resumes a run on a device with no learner profile (`guest.started { via: 'site' }`),
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
    leftHere: guest.record !== null && guestLeftHere(guest.record.id),
    now,
  });
  if (plan.take) consumeBootIntent();
  if (plan.kind !== 'start' && plan.kind !== 'reopen') return null;
  const begun = await withinLaunchWait(beginRun(plan.kind === 'start' ? 'site' : 'reopen', now), GUEST_LAUNCH_WAIT_MS);
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
 * A quest step of the guest run shown. `played`: the step was reached by play (not the step the run opened or
 * reopened on, GU-D12), so `lastAt` moves, at most once per `GUEST_PLAY_NOTE_MS`, and a reload within 30 minutes
 * reopens. The first Discover step of a new run sends `guest.first_letter { secondsIn }` once per record (section
 * 6.2), also when the tab was reloaded before it (the mark is kept per tab, `platform/guest-tab.ts`).
 */
export function noteGuestStep(steps: readonly { kind: string }[] | undefined, stepIndex: number, now: number = Date.now(), played: boolean = true): void {
  const { record, running } = useGuestStore.getState();
  if (!running || record === null) return;
  const lastAt = Date.parse(record.lastAt);
  if (played && !(now - lastAt < GUEST_PLAY_NOTE_MS)) useGuestStore.getState().recordGuestPlay({}, now).catch(() => undefined);
  const startedAt = firstLetterDueFor(record.id);
  if (startedAt === null || !isFirstLetterStep(steps, stepIndex)) return;
  clearFirstLetterDue();
  void track({ name: 'guest.first_letter', payload: { secondsIn: guestSecondsIn(now - startedAt) } });
}

/**
 * Quest 1 finished in the guest run (section 7.1): `questDone` is written, and `guest.quest_done { stars }` is sent once
 * per record, when it is first written (a replay sends none, so G4's denominator counts each run once).
 */
export function noteGuestQuestDone(stars: 0 | 1 | 2 | 3, now: number = Date.now()): void {
  const { record, running } = useGuestStore.getState();
  if (!running || record === null) return;
  const first = !record.questDone;
  useGuestStore.getState().recordGuestPlay({ questDone: true }, now).catch(() => undefined);
  if (first) void track({ name: 'guest.quest_done', payload: { stars } });
}

/**
 * Section 6.4: the run ends (Close or leave in the quest, Close on the Not now card); the record stays. `at` names the
 * leave sent as `guest.left` (the quest's leave sheet sends `quest`). Returns where the root goes next.
 */
export function endGuestRunTo(at: 'quest' | null): GuestLeaveTarget {
  const { record } = useGuestStore.getState();
  useGuestStore.getState().endGuestRun();
  // A reload of the Welcome this leads to stays on Welcome (section 6.4), until the run is started again.
  if (record !== null) markGuestLeft(record.id);
  if (at !== null) void track({ name: 'guest.left', payload: { at } });
  return guestLeaveTarget({ profiles: useProfileStore.getState().profiles, chooserOn: flags.whoChooserEnabled });
}

/**
 * Section 5.3, CS-G1: a guest run is only ever in front inside the `Guest` stack. The root stack calls this whenever
 * one of its routes takes focus; on any route but `Guest` a run still on ends here (no event, the record stays), so a
 * root reset that did not pass through the guest's exits (the resume chooser and its pick, a crash screen's remount)
 * never leaves `running` on and a profile's quest is never written under the guest's id.
 */
export function endGuestRunOutside(routeName: string): void {
  if (routeName === 'Guest') return;
  if (useGuestStore.getState().running) useGuestStore.getState().endGuestRun();
}
