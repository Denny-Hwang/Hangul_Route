import { holdSession, type SessionOptions } from '../logic/sessions/hold';
import { isAppVisible, subscribeAppVisibility } from '../platform/app-visibility';
import { useProgressStore } from './progress-store';

/**
 * Hold a learner session for `profileId` (F-REPORT-001 section 3.3.2):
 * `progress-store` keeps the one owner, and the app's visibility ends the
 * session in the background and begins a new one on return. Returns the
 * release, for the screen's unmount.
 */
export function holdLearnerSession(profileId: string, options: SessionOptions): () => void {
  return holdSession(
    {
      begin: (id, opts) => useProgressStore.getState().beginSession(id, opts),
      end: (id, sessionId) => useProgressStore.getState().endSession(id, sessionId),
      visible: isAppVisible,
      subscribe: subscribeAppVisibility,
    },
    profileId,
    options,
  );
}
