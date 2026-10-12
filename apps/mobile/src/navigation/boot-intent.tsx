import { NavigationContainerRefContext } from '@react-navigation/native';
import { useContext, useEffect } from 'react';
import { openBootIntentWhenReady } from '../logic/shell/boot-intent';
import { consumeBootIntent, peekBootIntent } from '../platform/app-root';

/**
 * Acts on the boot intent the app root read (F-APP-001 section 3.9): `gate=grown-up&next=` is the
 * console lock's "Use the grown-up PIN", so the PIN screen for the grown-up area opens over the
 * learner start screen, once, as soon as the navigator is ready (`openBootIntentWhenReady`). A
 * correct PIN returns the tab to `next` with a PIN unlock; Cancel lands on the start screen.
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
    );
  }, [root]);
  return null;
}
