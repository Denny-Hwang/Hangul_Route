import { Screen } from '@hangul-route/design-system';
import { useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { RecoverStack } from '../../navigation/recover-stack';
import { useAccountStore } from '../../store/account-store';
import { useProfileStore } from '../../store/profile-store';
import { useProgressStore } from '../../store/progress-store';
import { chooseAnotherOffered, grownUpHelpOffered, readHold, startListFresh, tryReadAgain, type ReadHold } from '../../store/read-failed';
import { ProgressReadFailedScreen } from './ProgressReadFailedScreen';

/**
 * [DP] The boot (AMENDMENTS-DURABLE-PROGRESS section 3.4, row DP-1c). `App.tsx` starts the first read
 * (`hydrateLearnerData`) and passes it here; when it has settled, the gate decides from store state, never from the
 * error it threw (`readHold`):
 *
 * - nothing held: the first screen waits for `settle` (the locale titles and messages), then the app opens;
 * - the profile list could not be read, or the active learner's progress: **ProgressReadFailedScreen** shows instead
 *   of the navigator, so first run (Welcome) never shows over a list that is there. Try again reruns the full read
 *   (list) or that learner's hydrate (learner); Choose another learner (learner variant, 2 or more learners) opens
 *   the app on the chooser.
 *
 * - [DP] row DP-1d (section 3.6): a list whose bytes do not parse and were kept (and a gate whose own record was read)
 *   draws the screen in its own stack (`RecoverStack`) with **A grown-up can help**: the grown-up gate, then the
 *   RecoverRecord sheet, whose Start fresh writes the empty list (`startListFresh`) and opens the app like a Try
 *   again that read (Welcome with Restore, as on a new device).
 *
 * `onOpen` (the post-hydrate chain: prefetch, plan derive, memory, sync) runs once, after the first boot that is not
 * held. A learner who is not active never holds the boot: Home shows them the screen when they are chosen.
 */
export interface BootGateProps {
  /** The first read, started by `App.tsx`; `null` until it starts. A rejection is ignored (other stores, as before). */
  firstRead: Promise<void> | null;
  /** The full read again, for the list variant's Try again (`hydrateLearnerData`). */
  rereadAll: () => Promise<void>;
  /** What the first screen waits for once nothing is held. Never rejects. */
  settle: () => Promise<void>;
  /**
   * Whether the app has opened, kept by the caller: a BootGate mounted again (Try again on the crash screen) renders
   * the app at once, with no second read and no second `onOpen`.
   */
  opened: { chooseLearner: boolean } | null;
  /** Called once, when the app first opens; the caller keeps `opened` and runs the post-hydrate chain. */
  onOpen: (open: { chooseLearner: boolean }) => void;
  /** The app. `chooseLearner`: the boot was left through Choose another learner, so the chooser opens first. */
  children: (open: { chooseLearner: boolean }) => ReactNode;
}

type Phase = { kind: 'reading' } | { kind: 'held'; hold: ReadHold } | { kind: 'settling' };

export function BootGate({ firstRead, rereadAll, settle, opened, onOpen, children }: BootGateProps): ReactElement {
  const [phase, setPhase] = useState<Phase>({ kind: 'reading' });
  // [DP] Section 3.6: the gate's own record (the PIN hash) could not be read: no grown-up way out (fail closed).
  const gateRecordUnread = useAccountStore((s) => s.pinHashReadFailed);
  const live = useRef(true);
  const opening = useRef(opened !== null);
  // A try's read sets the stores step by step (the list, then each learner); the screen waits for its end.
  const trying = useRef(false);
  // The latest props, so a try started on the screen opens with what the app passes now.
  const latest = useRef({ settle, onOpen });
  latest.current = { settle, onOpen };

  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);

  const open = (chooseLearner: boolean): void => {
    if (opening.current) return;
    opening.current = true;
    setPhase({ kind: 'settling' });
    void latest.current
      .settle()
      .catch(() => undefined)
      .then(() => {
        if (live.current) latest.current.onOpen({ chooseLearner });
      });
  };

  useEffect(() => {
    if (firstRead === null) return;
    void firstRead
      .catch(() => undefined)
      // The held screen is a first screen too: it waits for the locale's words as the app does.
      .then(() => latest.current.settle().catch(() => undefined))
      .then(() => {
        if (!live.current || opening.current) return;
        const hold = readHold();
        if (hold === null) open(false);
        else setPhase({ kind: 'held', hold });
      });
    // `open` reads refs only; the first read is the one input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstRead]);

  // While held, the screen follows store state (section 3.4): a list or a record another tab, or a re-read started
  // elsewhere, has read meanwhile opens the app; a change of variant redraws the screen.
  const held = phase.kind === 'held';
  useEffect(() => {
    if (!held) return undefined;
    const follow = (): void => {
      if (!live.current || opening.current || trying.current) return;
      const hold = readHold();
      if (hold === null) open(false);
      else setPhase((p) => (p.kind === 'held' && JSON.stringify(p.hold) === JSON.stringify(hold) ? p : { kind: 'held', hold }));
    };
    const offProfiles = useProfileStore.subscribe(follow);
    const offProgress = useProgressStore.subscribe(follow);
    return () => {
      offProfiles();
      offProgress();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [held]);

  if (opened !== null) return <>{children(opened)}</>;
  if (phase.kind !== 'held') return <Screen tone="canvas">{null}</Screen>;

  const { hold } = phase;
  /** After a try or a Start fresh: the app opens when nothing is held, else the screen shows the hold it left. */
  const settleHold = (next: ReadHold | null): boolean => {
    if (!live.current || opening.current) return next === null;
    if (next === null) {
      open(false);
      return true;
    }
    // Still held, perhaps in the other variant now (the list read, the active learner's progress did not).
    setPhase({ kind: 'held', hold: next });
    return false;
  };
  const onTryAgain = async (): Promise<boolean> => {
    trying.current = true;
    const next = await tryReadAgain(hold, rereadAll).finally(() => {
      trying.current = false;
    });
    return settleHold(next);
  };
  const onChooseAnother = hold.variant === 'learner' && chooseAnotherOffered() ? () => open(true) : undefined;
  // Choose another learner opens the app with the held learner still active; nothing is written for them meanwhile
  // (AU-3: writes, sync and memory skip a learner outside `hydratedFor`), and the chooser picks who goes on.
  if (grownUpHelpOffered(hold, gateRecordUnread)) {
    // [DP] Section 3.6: Start fresh, confirmed behind the gate. The store writes the empty list, then every store is read
    // again (the held boot's per-profile reads were built from no list); the screen does not follow the stores meanwhile.
    const onStartFresh = async (): Promise<boolean> => {
      trying.current = true;
      const next = await startListFresh(rereadAll).finally(() => {
        trying.current = false;
      });
      return settleHold(next);
    };
    return <RecoverStack onTryAgain={onTryAgain} onStartFresh={onStartFresh} />;
  }
  return <ProgressReadFailedScreen onTryAgain={onTryAgain} onChooseAnother={onChooseAnother} />;
}
