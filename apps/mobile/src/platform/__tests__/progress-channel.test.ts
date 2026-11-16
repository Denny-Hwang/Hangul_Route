import { describe, expect, it, vi } from 'vitest';
import * as native from '../progress-channel';
import { PROGRESS_CHANGED_MESSAGE, PROGRESS_CHANNEL, postProgressChanged, subscribeProgressChanged } from '../progress-channel.web';
import { createPrefsHub } from '../prefs-channel.web';

// [AU] AMENDMENTS-AUDIT-2026-11 row AU-11: BroadcastChannel('hr-progress') tells the other tabs to read the
// snapshots they hold again. It carries `{ v: 1, kind: 'changed' }` and nothing else.

class FakeChannel {
  posted: unknown[] = [];
  onmessage: ((event: { data: unknown }) => void) | null = null;
  constructor(readonly name: string) {}
  postMessage(message: unknown): void {
    this.posted.push(message);
  }
  close(): void {}
}

function target() {
  const listeners = new Map<string, () => void>();
  return {
    add: vi.fn((type: string, fn: () => void) => void listeners.set(type, fn)),
    remove: vi.fn((type: string) => void listeners.delete(type)),
    fire: (type: string) => listeners.get(type)?.(),
  };
}

function env(open: () => FakeChannel | null = () => new FakeChannel(PROGRESS_CHANNEL)) {
  const win = target();
  const doc = { ...target(), visibilityState: 'visible' };
  let channel: FakeChannel | null = null;
  const hub = createPrefsHub(() => (channel = open()));
  return {
    win,
    doc,
    channel: () => channel,
    env: {
      hub,
      win: { addEventListener: win.add, removeEventListener: win.remove },
      doc: {
        get visibilityState() {
          return doc.visibilityState;
        },
        addEventListener: doc.add,
        removeEventListener: doc.remove,
      },
    },
  };
}

describe('progress channel (web)', () => {
  it('posts the one v1 message, with no id, no name and no progress', () => {
    const e = env();
    postProgressChanged(e.env);
    expect(e.channel()?.posted).toEqual([{ v: 1, kind: 'changed' }]);
    expect(PROGRESS_CHANGED_MESSAGE).toEqual({ v: 1, kind: 'changed' });
    expect(PROGRESS_CHANNEL).toBe('hr-progress');
  });

  it('calls back for a message from another tab, never for junk', () => {
    const e = env();
    const onChange = vi.fn();
    const off = subscribeProgressChanged(onChange, e.env);
    e.channel()?.onmessage?.({ data: { v: 1, kind: 'changed' } });
    e.channel()?.onmessage?.({ data: { v: 1, kind: 'changed', id: 'profile:a' } });
    e.channel()?.onmessage?.({ data: { v: 2, kind: 'changed' } });
    e.channel()?.onmessage?.({ data: { v: 1, kind: 'removed' } });
    e.channel()?.onmessage?.({ data: 'changed' });
    e.channel()?.onmessage?.({ data: null });
    expect(onChange).toHaveBeenCalledTimes(1);
    off();
    e.channel()?.onmessage?.({ data: { v: 1, kind: 'changed' } });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('reads again when the page is back in front, and stops listening on unsubscribe', () => {
    const e = env();
    const onChange = vi.fn();
    const off = subscribeProgressChanged(onChange, e.env);
    e.doc.visibilityState = 'hidden';
    e.doc.fire('visibilitychange');
    expect(onChange).not.toHaveBeenCalled();
    e.doc.visibilityState = 'visible';
    e.doc.fire('visibilitychange');
    e.win.fire('pageshow');
    expect(onChange).toHaveBeenCalledTimes(2);
    off();
    expect(e.doc.remove).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    expect(e.win.remove).toHaveBeenCalledWith('pageshow', onChange);
  });

  it('without BroadcastChannel or events nothing throws', () => {
    const e = env(() => null);
    expect(() => postProgressChanged(e.env)).not.toThrow();
    const off = subscribeProgressChanged(() => undefined, { hub: e.env.hub, win: null, doc: null });
    expect(() => off()).not.toThrow();
    const throwing = {
      hub: e.env.hub,
      win: { addEventListener: () => { throw new Error('x'); }, removeEventListener: () => { throw new Error('x'); } },
      doc: null,
    };
    expect(() => subscribeProgressChanged(() => undefined, throwing)()).not.toThrow();
    const brokenHub = { post: () => { throw new Error('closed'); }, listen: () => () => undefined };
    expect(() => postProgressChanged({ hub: brokenHub, win: null, doc: null })).not.toThrow();
  });

  it('the default browser env opens the real channel lazily, and the native variant is a no-op', () => {
    const posted: unknown[] = [];
    class Global {
      onmessage = null;
      constructor(readonly name: string) {}
      postMessage(m: unknown): void {
        posted.push([this.name, m]);
      }
      close(): void {}
    }
    vi.stubGlobal('BroadcastChannel', Global);
    postProgressChanged();
    const off = subscribeProgressChanged(() => undefined);
    off();
    vi.unstubAllGlobals();
    expect(posted).toEqual([['hr-progress', { v: 1, kind: 'changed' }]]);
    expect(native.postProgressChanged()).toBeUndefined();
    expect(native.subscribeProgressChanged(() => undefined)()).toBeUndefined();
  });
});
