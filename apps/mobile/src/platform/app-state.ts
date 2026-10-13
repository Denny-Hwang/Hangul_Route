import { AppState } from 'react-native';

/**
 * Whether the app is in front of the learner, for the Speed Round's one
 * session clock (F-VOC-004 §3.8): the app going to the background issues
 * `pause('background')`, so a Challenge round never runs out while the
 * learner is away (a paused round never expires). Native reads `AppState`:
 * `background` and `inactive` are not active (iOS goes `inactive` under
 * Control Center, Notification Center or a call banner while JS still runs,
 * so the clock would count behind the sheet), and `active` is active again.
 * A pause is always safe: Resume is the learner's own tap. The web build uses `app-state.web.ts` (`visibilitychange`).
 * `source` is injectable for tests. Returns the unsubscribe.
 */

export interface AppStateSource {
  addEventListener(type: 'change', listener: (state: string) => void): { remove(): void };
}

export function subscribeAppActive(listener: (active: boolean) => void, source: AppStateSource = AppState): () => void {
  const subscription = source.addEventListener('change', (state) => {
    if (state === 'background' || state === 'inactive') listener(false);
    else if (state === 'active') listener(true);
  });
  return () => subscription.remove();
}
