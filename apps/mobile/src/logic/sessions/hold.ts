/**
 * Holding a session while a screen is mounted (F-REPORT-001 section 3.3.2,
 * RP-3b). The quest player, the story reader, the stand-alone game screen and
 * the level check each hold one; the store keeps one owner at a time.
 */

/** What a session is for: `owner` names the screen, `streak` says whether it moves the learner's streak (OD-19). */
export interface SessionOptions {
  owner: string;
  streak: boolean;
}

export interface SessionHoldPorts {
  /** The store's `beginSession`: the new id, or `null` when the profile's open session belongs to another owner. */
  begin: (profileId: string, options: SessionOptions) => string | null;
  /** The store's `endSession`: ends only that session. */
  end: (profileId: string, sessionId: string) => void;
  /** The app's visibility (`platform/app-visibility`); returns the unsubscribe. */
  subscribe: (listener: (visible: boolean) => void) => () => void;
}

/**
 * Begins a session and returns its release (the unmount). A caller that
 * joined another owner's open session (a story opened inside a quest) does
 * nothing more: the owner ends it, also when the app is hidden. The owner
 * ends its session when the app goes to the background or the page is
 * hidden, and begins a new one when it is visible again while still held, so
 * time away is never counted. Release is safe to call twice.
 */
export function holdSession(ports: SessionHoldPorts, profileId: string, options: SessionOptions): () => void {
  let sessionId = ports.begin(profileId, options);
  if (sessionId === null) return () => undefined;
  let held = true;
  const endOpen = (): void => {
    if (sessionId === null) return;
    ports.end(profileId, sessionId);
    sessionId = null;
  };
  const unsubscribe = ports.subscribe((visible) => {
    if (!held) return;
    if (!visible) endOpen();
    else if (sessionId === null) sessionId = ports.begin(profileId, options);
  });
  return () => {
    if (!held) return;
    held = false;
    unsubscribe();
    endOpen();
  };
}
