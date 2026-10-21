import { NavigationContainerRefContext } from '@react-navigation/native';
import { useContext, useEffect } from 'react';
import { openBootIntentWhenReady } from '../logic/shell/boot-intent';
import { consumeBootIntent, peekBootIntent } from '../platform/app-root';
import { openBrowseFromGate } from '../platform/browse-handoff';
import { flags } from '../config/flags';
import { gateOpensDirectlyNow } from '../store/gate-now';
import { useProfileStore } from '../store/profile-store';
import { passGate } from '../store/gate-telemetry';
import { batchHandoffPending, deviceShared, holdJoin, whoReturnTrigger } from '../store/who-chooser';

/**
 * Acts on the boot intent the app root read (F-APP-001 section 3.9): `gate=grown-up&next=` is the
 * console lock's "Use the grown-up PIN", so the PIN screen for the grown-up area opens over the
 * learner start screen, once, as soon as the navigator is ready (`openBootIntentWhenReady`). A
 * correct PIN returns the tab to `next` with a PIN unlock; Cancel lands on the start screen.
 * `gate=browse` (F-BROWSE-001 BR-12b) opens the PIN screen for All lessons, or, when the gate opens
 * directly, the gate hand-off at once (`openBrowseFromGate`). The class join link `/join#c=<code>` (owner decision
 * 2026-10-17) opens Join a class with the code filled in, or the class-code first run on a device with no profile.
 * Rendered beside the root stack; native builds never have an intent (`platform/app-root.ts`).
 * [OA] `who=1` and a join on a shared device open "Who is using this?" (AMENDMENTS-ONE-ACCOUNT-MANY-USERS row OA-4a).
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
      {
        hasProfile: () => useProfileStore.getState().profiles.length > 0,
        // [OA] OA-D20: a shared device holds the code and asks who is joining (the launch usually took it already).
        shared: () => flags.whoChooserEnabled && deviceShared(),
        hold: (code) => holdJoin(code),
      },
      // [OA] `who=1` (row OA-4a): the launch takes it while the flag is on; here it is opened only if still waiting.
      {
        open: () => {
          const trigger = whoReturnTrigger();
          if (trigger !== null) root.navigate('WhoIsUsing', { trigger });
          return trigger !== null;
        },
      },
    );
  }, [root]);
  return null;
}

/**
 * [OA] Who is joining? at launch (AMENDMENTS-ONE-ACCOUNT-MANY-USERS OA-D14, OA-D20; row OA-7b): when the launch took
 * the family home's hand-off code for the checklist (`batchHandoffPending`), Join opens over Home as soon as the
 * navigator is ready, once. Join takes the code from memory (`takeBatchHandoff`), never from a route or the address,
 * and looks it up at once. Rendered by the root stack only when the launch took one.
 */
export function LaunchBatchJoinHook(): null {
  const root = useContext(NavigationContainerRefContext);
  useEffect(() => {
    if (!root) return undefined;
    const open = (): boolean => {
      if (!root.isReady()) return false;
      if (batchHandoffPending()) root.navigate('JoinSpace');
      return true;
    };
    if (open()) return undefined;
    const off = root.addListener('state', () => {
      if (open()) off();
    });
    return off;
  }, [root]);
  return null;
}
