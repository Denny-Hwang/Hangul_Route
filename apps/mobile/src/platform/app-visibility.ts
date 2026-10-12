import { AppState } from 'react-native';

/**
 * Whether the app is in front of the learner (F-REPORT-001 section 3.3.2,
 * RP-3b): the open session ends when the app leaves and a mounted screen
 * begins a new one when it comes back. Native: `AppState` `background` is
 * hidden and `active` is visible; `inactive` (a system sheet over the app on
 * iOS, or the moment between the two) is neither. The web build uses
 * `app-visibility.web.ts`. Returns the unsubscribe.
 */
export function subscribeAppVisibility(listener: (visible: boolean) => void): () => void {
  const subscription = AppState.addEventListener('change', (state) => {
    if (state === 'background') listener(false);
    else if (state === 'active') listener(true);
  });
  return () => subscription.remove();
}
