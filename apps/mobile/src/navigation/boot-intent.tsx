import { NavigationContainerRefContext } from '@react-navigation/native';
import { useContext, useEffect } from 'react';
import { flags } from '../config/flags';
import { openBootIntentWhenReady } from '../logic/shell/boot-intent';
import { pinResetOutcome, pinResetTicketOf, type PinResetOutcome } from '../logic/shell/pin-reset-ticket';
import { consumeBootIntent, peekBootIntent, takeBootPinResetTicket } from '../platform/app-root';
import { openBrowseFromGate } from '../platform/browse-handoff';
import { currentDeviceGateMarker } from '../store/device-gate';
import { gateOpensDirectlyNow } from '../store/gate-now';
import { usePinResetNotice } from '../store/pin-reset-notice';
import { useProfileStore } from '../store/profile-store';
import { passGate } from '../store/gate-telemetry';

/**
 * [OA] `gate=pin-reset` (AMENDMENTS-ONE-ACCOUNT-MANY-USERS section 8.5 step 5): the ticket the root read, once, against
 * the clock and the device's current marker (`currentDeviceGateMarker`, the one the console reads; null before the
 * stores load or when the PIN could not be read, which refuses). The ticket is taken even with the switch off, so it
 * never waits for a later look.
 */
function pinResetOutcomeNow(): PinResetOutcome | 'off' {
  const ticket = pinResetTicketOf(takeBootPinResetTicket());
  if (!flags.pinResetSignInEnabled) return 'off';
  return pinResetOutcome({ ticket, now: Date.now(), marker: currentDeviceGateMarker() });
}

/**
 * Acts on the boot intent the app root read (F-APP-001 section 3.9): `gate=grown-up&next=` is the
 * console lock's "Use the grown-up PIN", so the PIN screen for the grown-up area opens over the
 * learner start screen, once, as soon as the navigator is ready (`openBootIntentWhenReady`). A
 * correct PIN returns the tab to `next` with a PIN unlock; Cancel lands on the start screen.
 * `gate=browse` (F-BROWSE-001 BR-12b) opens the PIN screen for All lessons, or, when the gate opens
 * directly, the gate hand-off at once (`openBrowseFromGate`). The class join link `/join#c=<code>` (owner decision
 * 2026-10-17) opens Join a class with the code filled in, or the class-code first run on a device with no profile.
 * [OA] `gate=pin-reset` opens the new-PIN screen for an accepted sign-in reset ticket, else the expired line on Home.
 * Rendered beside the root stack; native builds never have an intent (`platform/app-root.ts`).
 */
export function BootIntentHook(): null {
  const root = useContext(NavigationContainerRefContext);
  useEffect(() => {
    if (!root) return undefined;
    return openBootIntentWhenReady(
      {
        isReady: () => root.isReady(),
        navigate: (screen, params) => root.navigate(screen, params),
        addListener: (event, listener) => root.addListener(event, listener),
      },
      { peek: peekBootIntent, consume: consumeBootIntent },
      {
        opensDirectly: () => passGate('BrowseLessons', gateOpensDirectlyNow()),
        open: () => openBrowseFromGate(),
      },
      // Read when the intent is acted on: the profile store has hydrated before the root stack mounts.
      { hasProfile: () => useProfileStore.getState().profiles.length > 0 },
      // The expired line is for Home, the start screen of a device with a profile; a first run never shows it.
      { outcome: pinResetOutcomeNow, showExpired: () => (useProfileStore.getState().profiles.length > 0 ? usePinResetNotice.getState().showExpired() : undefined) },
    );
  }, [root]);
  return null;
}
