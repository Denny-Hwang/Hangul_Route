import { AppState } from 'react-native';

/**
 * Whether the app is in front of the learner, for the Speed Round's one
 * session clock (F-VOC-004 §3.8): the app going to the background issues
 * `pause('background')`, so a Challenge round never runs out while the
 * learner is away (a paused round never expires). Native reads `AppState`:
 * `background` is not active and `active` is active again; `inactive` (a
 * system sheet over the app on iOS, or the moment between the two) changes
 * nothing. The web build uses `app-state.web.ts` (`visibilitychange`).
 * `source` is injectable for tests. Returns the unsubscribe.
 */

export interface AppStateSource {
  addEventListener(type: 'change', listener: (state: string) => void): { remove(): void };
}

export function subscribeAppActive(listener: (active: boolean) => void, source: AppStateSource = AppState): () => void {
  const subscription = source.addEventListener('change', (state) => {
    if (state === 'background') listener(false);
    else if (state === 'active') listener(true);
  });
  return () => subscription.remove();
}
