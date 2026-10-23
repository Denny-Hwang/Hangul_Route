/**
 * Owner report 2026-10-23: a teacher moved a learner from class A to class B in one console tab while class A's roster
 * stayed open in another, and A kept listing the learner until the tab was next brought back into view (at most every
 * 30 seconds, `visible-refresh.ts`). After a change to who is in a class (a move, an accepted or cancelled ask, a
 * removed learner) the console posts one message on a `BroadcastChannel`, and an open roster tab reads again at once.
 *
 * The message carries no learner id and no name: it only says "read again", with a random id for the sending tab (never
 * stored, never sent to the Worker). `BroadcastChannel` also delivers to other channel objects in the same tab; a tab
 * ignores its own messages, because the page that made the change already reads again itself. A browser without
 * `BroadcastChannel` (or one that throws on it) keeps the visible-refresh reads; nothing here can break a page.
 */
export const ROSTER_CHANNEL = 'hr-roster';

export interface RosterChanged {
  type: 'roster-changed';
  /** The sending tab (a random id made once per page load): a tab skips the messages it sent itself. */
  from?: string;
}

const TYPE: RosterChanged['type'] = 'roster-changed';

function randomTabId(): string {
  try {
    const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
    if (c?.randomUUID) return c.randomUUID();
  } catch {
    // Fall through to Math.random: this id only tells this tab's own messages apart.
  }
  return `tab-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

/** This tab's sender id. */
export const TAB_ID = randomTabId();

/** The parts of `BroadcastChannel` used here: easy to fake in a unit test. */
interface Channel {
  postMessage(message: unknown): void;
  close(): void;
  addEventListener?(type: 'message', listener: (event: { data: unknown }) => void): void;
  removeEventListener?(type: 'message', listener: (event: { data: unknown }) => void): void;
}
type ChannelCtor = new (name: string) => Channel;

function channelCtor(): ChannelCtor | null {
  const ctor = (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel;
  return typeof ctor === 'function' ? (ctor as ChannelCtor) : null;
}

export const isRosterChanged = (data: unknown): data is RosterChanged =>
  typeof data === 'object' && data !== null && (data as { type?: unknown }).type === TYPE;

/** A roster-changed message another tab sent (this tab's own are skipped). */
export const isFromAnotherTab = (data: unknown, tabId: string = TAB_ID): boolean => isRosterChanged(data) && data.from !== tabId;

/** Tells every other console tab of this origin that a roster changed. */
export function announceRosterChange(): void {
  const Ctor = channelCtor();
  if (!Ctor) return;
  try {
    const channel = new Ctor(ROSTER_CHANNEL);
    const message: RosterChanged = { type: TYPE, from: TAB_ID };
    channel.postMessage(message);
    channel.close();
  } catch {
    // A blocked or closed channel: the other tabs still read again when they come back into view.
  }
}

/**
 * Calls `onChange` for each roster-changed message another tab posts (never for this tab's own). Returns the function
 * that stops listening.
 */
export function watchRosterChanges(onChange: () => void): () => void {
  const Ctor = channelCtor();
  if (!Ctor) return () => undefined;
  let channel: Channel;
  try {
    channel = new Ctor(ROSTER_CHANNEL);
  } catch {
    return () => undefined;
  }
  const listener = (event: { data: unknown }): void => {
    if (isFromAnotherTab(event.data)) onChange();
  };
  channel.addEventListener?.('message', listener);
  return () => {
    channel.removeEventListener?.('message', listener);
    try {
      channel.close();
    } catch {
      // Already closed.
    }
  };
}
