import { afterEach, describe, expect, it, vi } from 'vitest';
import { ROSTER_CHANNEL, TAB_ID, announceRosterChange, isFromAnotherTab, isRosterChanged, watchRosterChanges } from '../roster-broadcast';

/** Owner report 2026-10-23: one console tab tells the others a roster changed, with no id and no name. */
type Listener = (event: { data: unknown }) => void;
const open = new Set<FakeChannel>();
class FakeChannel {
  listeners = new Set<Listener>();
  closed = false;
  constructor(readonly name: string) {
    open.add(this);
  }
  postMessage(data: unknown): void {
    for (const other of open) if (other !== this && other.name === this.name) for (const l of other.listeners) l({ data });
  }
  addEventListener(type: string, l: Listener): void {
    if (type === 'message') this.listeners.add(l);
  }
  removeEventListener(type: string, l: Listener): void {
    if (type === 'message') this.listeners.delete(l);
  }
  close(): void {
    this.closed = true;
    open.delete(this);
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  open.clear();
});

describe('roster-broadcast', () => {
  it('a change another tab posts reaches a watcher on the hr-roster channel; the sender closes its channel', () => {
    vi.stubGlobal('BroadcastChannel', FakeChannel);
    const heard = vi.fn();
    const stop = watchRosterChanges(heard);
    expect([...open].map((c) => c.name)).toEqual([ROSTER_CHANNEL]);
    const otherTab = new FakeChannel(ROSTER_CHANNEL);
    otherTab.postMessage({ type: 'roster-changed', from: 'another-tab' });
    otherTab.close();
    expect(heard).toHaveBeenCalledTimes(1);
    expect(open.size).toBe(1);
    stop();
    expect(open.size).toBe(0);
    otherTab.postMessage({ type: 'roster-changed', from: 'another-tab' });
    expect(heard).toHaveBeenCalledTimes(1);
  });

  it("this tab's own announce posts one message with its tab id, closes the channel, and its own watcher skips it (no second read)", () => {
    vi.stubGlobal('BroadcastChannel', FakeChannel);
    const heard = vi.fn();
    const seen: unknown[] = [];
    const stop = watchRosterChanges(heard);
    const spy = new FakeChannel(ROSTER_CHANNEL);
    spy.addEventListener('message', (e) => seen.push(e.data));
    announceRosterChange();
    expect(seen).toEqual([{ type: 'roster-changed', from: TAB_ID }]);
    expect(heard).not.toHaveBeenCalled();
    expect(open.size).toBe(2);
    spy.close();
    stop();
  });

  it('tells this tab apart from another; an old message with no sender counts as another tab', () => {
    expect(isFromAnotherTab({ type: 'roster-changed', from: TAB_ID })).toBe(false);
    expect(isFromAnotherTab({ type: 'roster-changed', from: 'x' })).toBe(true);
    expect(isFromAnotherTab({ type: 'roster-changed' })).toBe(true);
    expect(isFromAnotherTab({ type: 'other', from: 'x' })).toBe(false);
  });

  it('reads only the roster-changed message', () => {
    expect(isRosterChanged({ type: 'roster-changed' })).toBe(true);
    expect(isRosterChanged({ type: 'other' })).toBe(false);
    expect(isRosterChanged('roster-changed')).toBe(false);
    expect(isRosterChanged(null)).toBe(false);
  });

  it('without BroadcastChannel, or when it throws, nothing breaks', () => {
    vi.stubGlobal('BroadcastChannel', undefined);
    expect(() => announceRosterChange()).not.toThrow();
    const stop = watchRosterChanges(() => undefined);
    expect(() => stop()).not.toThrow();
    vi.stubGlobal(
      'BroadcastChannel',
      class {
        constructor() {
          throw new Error('blocked');
        }
      },
    );
    expect(() => announceRosterChange()).not.toThrow();
    expect(() => watchRosterChanges(() => undefined)()).not.toThrow();
  });

  it('a channel that throws on close is still let go', () => {
    vi.stubGlobal(
      'BroadcastChannel',
      class {
        postMessage(): void {}
        close(): void {
          throw new Error('closed');
        }
      },
    );
    expect(() => watchRosterChanges(() => undefined)()).not.toThrow();
  });
});
