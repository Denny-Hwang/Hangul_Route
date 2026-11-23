import { useEffect, useRef, useState, type ReactElement } from 'react';
import type { View } from 'react-native';
import { useMessages } from '../../i18n/use-messages';
import { isParentSessionValid, needsFreshPin } from '../../logic/profiles/session';
import type { RootStackParamList } from '../../navigation/types';
import { confirm } from '../../platform/dialog';
import { focusForScreenReader } from '../../platform/screen-reader';
import { useAccountStore } from '../../store/account-store';
import { endGrownUpSessionAfterUse } from '../../store/grown-up-session';
import { useUiStore } from '../../store/ui-store';
import { ProgressReadFailedScreen } from './ProgressReadFailedScreen';

/**
 * [DP] AMENDMENTS-DURABLE-PROGRESS sections 3.5 and 3.6 (row DP-1d; design `design/screens/system/progress-read-failed/`
 * frame B, `mock/sheet.html` frames H and I, D5). The read-failed screen at boot for a profile list whose bytes do not
 * parse and were kept at `profiles-corrupt`: Try again, and **A grown-up can help**, which opens the grown-up gate (the
 * PIN screen, destination `RecoverRecord`; unchanged, so with no PIN on the device the family PIN is made first, as for
 * every grown-up action). After a correct PIN the PIN screen comes back here with the gate open and one return marked,
 * and the **RecoverRecord** sheet shows over the screen: a ConfirmSheet (the platform `Alert` on native), Not now first
 * and focused, Start fresh on this device as the confirm, primary and never danger (nothing is erased at that moment).
 * Escape, the backdrop and the system back are Not now. The session the PIN opened is for this one action (CS-1): it
 * ends whatever the answer. Start fresh empties the profile list, so, as Remove from this device (CS-12), it needs a
 * PIN (or face or fingerprint) entered in the last 2 minutes (`needsFreshPin`): the sheet opens only then, and a sheet
 * answered later (left open, or the session ended in the background) starts nothing (fail closed). While Start fresh
 * runs the screen is held as a try is (D2); one that did not open the app says the bubble again. Focus is put on A
 * grown-up can help before the sheet opens and after it closes, so it comes back there (D5). The gate's own record
 * that cannot be read opens nothing (BootGate does not offer the button then).
 *
 * Drawn as the `RecoverHold` route of the screen's own stack (`navigation/recover-stack.tsx`).
 */
export interface RecoverHoldProps {
  /** One try (BootGate's Try again). Resolves `true` when the read worked. */
  onTryAgain: () => Promise<boolean>;
  /**
   * Start fresh on this device was confirmed: BootGate writes the list (`startListFresh`) and opens the app. Resolves
   * whether the app opened.
   */
  onStartFresh: () => Promise<boolean>;
}

/** What the screen needs from its route's navigation. */
export interface RecoverHoldNavigation {
  navigate: (name: 'PinEntry', params: RootStackParamList['PinEntry']) => void;
  addListener: (type: 'focus', listener: () => void) => () => void;
}

/** The grown-up session the PIN opened (15 minutes, OA-D5) and a PIN entered in the last 2 minutes (CS-12), read now. */
function freshGate(now: number = Date.now()): boolean {
  const { parentGateOpenedAt: openedAt, lastPinVerifiedAt } = useUiStore.getState();
  return isParentSessionValid(openedAt === null ? null : { openedAt, profileId: 'family' }, now) && !needsFreshPin('start_fresh', lastPinVerifiedAt, now);
}

export function RecoverHoldScreen({ navigation, onTryAgain, onStartFresh }: RecoverHoldProps & { navigation: RecoverHoldNavigation }): ReactElement {
  const sheet = useMessages().caregiver.recoverRecord;
  const grownUp = useRef<View>(null);
  // The PIN screen was opened from here and has not come back yet.
  const gateAsked = useRef(false);
  // The sheet is open, or Start fresh runs: the button opens nothing more until it is over.
  const answering = useRef(false);
  // Start fresh runs: the screen is held as during a try.
  const [starting, setStarting] = useState(false);
  // Raised when Start fresh did not open the app: the screen says the bubble again.
  const [retell, setRetell] = useState(0);
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );
  // The latest words and action, for the focus listener bound once.
  const latest = useRef({ sheet, onStartFresh });
  latest.current = { sheet, onStartFresh };

  const focusGrownUp = (): void => focusForScreenReader(grownUp.current);

  useEffect(() => {
    const askStartFresh = async (): Promise<void> => {
      answering.current = true;
      const words = latest.current.sheet;
      focusGrownUp();
      const yes = await confirm({ title: words.title, message: words.body, detail: words.comeBack, cancelLabel: words.notNow, confirmLabel: words.fresh }).catch(() => false);
      const stillFresh = freshGate();
      // CS-1: the session the PIN opened was for this one action.
      endGrownUpSessionAfterUse();
      if (!yes) {
        answering.current = false;
        focusGrownUp();
        return;
      }
      let opened = false;
      if (stillFresh) {
        setStarting(true);
        opened = await latest.current.onStartFresh().catch(() => false);
      }
      // The app opened: this screen is gone. Otherwise the screen answers, as after a try that did not work.
      if (opened || !mounted.current) return;
      answering.current = false;
      setStarting(false);
      setRetell((n) => n + 1);
      focusGrownUp();
    };
    return navigation.addListener('focus', () => {
      if (!gateAsked.current) return;
      gateAsked.current = false;
      // PinEntry's `back()` marks one return and opens the gate only after a correct PIN (or a new one); Cancel and
      // Close mark nothing.
      const returned = useUiStore.getState().takeGateReturn();
      if (returned && freshGate()) {
        void askStartFresh();
        return;
      }
      // A return with no fresh PIN (a reset's new PIN): the session it opened is not kept for a later press (CS-1).
      if (returned) endGrownUpSessionAfterUse();
      focusGrownUp();
    });
  }, [navigation]);

  const onGrownUpHelp = (): void => {
    if (answering.current) return;
    // Section 3.6: the gate's own record could not be read: fail closed, nothing opens (Try again stays).
    if (useAccountStore.getState().pinHashReadFailed) return;
    gateAsked.current = true;
    navigation.navigate('PinEntry', { next: 'RecoverRecord' });
  };

  return <ProgressReadFailedScreen onTryAgain={onTryAgain} onGrownUpHelp={onGrownUpHelp} grownUpRef={grownUp} busy={starting} retell={retell} />;
}
