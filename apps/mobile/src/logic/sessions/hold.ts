import type { SessionKind } from './session-log';

/**
 * Holding a session while a screen is mounted (F-REPORT-001 section 3.3.2,
 * RP-3b). The quest player, the story reader, the stand-alone game screen and
 * the level check each hold one; the store keeps one owner at a time.
 */

/**
 * What a session is for: `owner` names the screen; `streak` says whether it
 * is a quest session, which moves the old streak (`streakDays`) and sends
 * `session.start` (OD-19); `keepsRun` marks a learning session (a story or a
 * word set) that keeps the local-day run without being a quest session
 * (F-CURR-002 OD-14). A quest session always keeps the run.
 */
export interface SessionOptions {
  owner: string;
  streak: boolean;
  keepsRun?: boolean;
}

/** The kind of session these options begin. */
export function sessionKindOf(options: Pick<SessionOptions, 'streak' | 'keepsRun'>): SessionKind {
  if (options.streak) return 'quest';
  return options.keepsRun === true ? 'learn' : 'time';
}

const RANK: Record<SessionKind, number> = { time: 0, learn: 1, quest: 2 };

/**
 * Whether a session begun with `next` takes over the profile's open session
 * (`open`) instead of joining it: only a kind that counts for more does (a
 * quest over a story or a game, a story over a game), so the run and
 * `session.start` follow the activity that counts most.
 */
export function takesOver(open: Pick<SessionOptions, 'streak' | 'keepsRun'>, next: Pick<SessionOptions, 'streak' | 'keepsRun'>): boolean {
  return RANK[sessionKindOf(next)] > RANK[sessionKindOf(open)];
}

export interface SessionHoldPorts {
  /** The store's `beginSession`: the new id, or `null` when the profile's open session belongs to another owner. */
  begin: (profileId: string, options: SessionOptions) => string | null;
  /** The store's `endSession`: ends only that session. */
  end: (profileId: string, sessionId: string) => void;
  /** Whether the app is in front now (`platform/app-visibility` `isAppVisible`). */
  visible: () => boolean;
  /** The app's visibility (`platform/app-visibility`); returns the unsubscribe. */
  subscribe: (listener: (visible: boolean) => void) => () => void;
}

/**
 * Begins a session and returns its release (the unmount). A caller that
 * joined another owner's open session (a story opened inside a quest) does
 * nothing more: the owner ends it, also when the app is hidden. The owner
 * ends its session when the app goes to the background or the page is
 * hidden, and begins a new one when it is visible again while still held, so
 * time away is never counted. Held while the app is already hidden (a tab
 * opened in the background), it begins only once the app is visible. Release
 * is safe to call twice.
 */
export function holdSession(ports: SessionHoldPorts, profileId: string, options: SessionOptions): () => void {
  const visibleNow = ports.visible();
  let sessionId = visibleNow ? ports.begin(profileId, options) : null;
  if (visibleNow && sessionId === null) return () => undefined;
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

/** A screen's focus, as the navigator reports it (react-navigation's `isFocused` and `focus`/`blur` events). */
export interface FocusPorts {
  isFocused: () => boolean;
  /** Returns the unsubscribe. */
  addListener: (event: 'focus' | 'blur', listener: () => void) => () => void;
}

/**
 * Runs `hold` while the screen is in front (F-REPORT-001 section 3.3.2, RP-3b
 * review): a screen pushed over it (the PIN or the placement report over the
 * level check) releases the hold, and coming back holds again, so a
 * grown-up's time is never counted as the learner's. With no navigator
 * (`focus` null) it holds for the whole mount. Returns the unmount.
 */
export function holdWhileFocused(focus: FocusPorts | null, hold: () => () => void): () => void {
  if (focus === null) return hold();
  let release: (() => void) | null = null;
  const start = (): void => {
    if (release === null) release = hold();
  };
  const stop = (): void => {
    if (release === null) return;
    const done = release;
    release = null;
    done();
  };
  if (focus.isFocused()) start();
  const offFocus = focus.addListener('focus', start);
  const offBlur = focus.addListener('blur', stop);
  return () => {
    offFocus();
    offBlur();
    stop();
  };
}
