import { NavigationContainerRefContext } from '@react-navigation/native';
import { useContext, useEffect } from 'react';
import { grownUpPinParams } from '../logic/shell/handoff-rules';
import { consumeBootIntent, peekBootIntent } from '../platform/app-root';

/**
 * Acts on the boot intent the app root read (F-APP-001 section 3.9): `gate=grown-up&next=` is the
 * console lock's "Use the grown-up PIN", so the PIN screen for the grown-up area opens over the
 * learner start screen, once, as soon as the navigator is ready. A correct PIN returns the tab to
 * `next` with a PIN unlock; Cancel lands on the start screen. Rendered beside the root stack;
 * native builds never have an intent (`platform/app-root.ts`).
 */
export function BootIntentHook(): null {
  const root = useContext(NavigationContainerRefContext);
  useEffect(() => {
    if (!root || peekBootIntent() === null) return undefined;
    const open = (): boolean => {
      const intent = peekBootIntent();
      if (intent === null) return true;
      if (!root.isReady()) return false;
      consumeBootIntent();
      root.navigate('PinEntry', grownUpPinParams({ via: 'lock', target: intent.next }));
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
