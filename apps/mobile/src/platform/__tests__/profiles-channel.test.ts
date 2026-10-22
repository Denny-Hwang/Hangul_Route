import { describe, expect, it, vi } from 'vitest';
import * as native from '../profiles-channel';
import { PROFILES_CHANGED_MESSAGE, postProfilesChanged, subscribeProfilesChanged } from '../profiles-channel.web';
import { createPrefsHub } from '../prefs-channel.web';

// [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS OA-D19 (row OA-4a): BroadcastChannel('hr-profiles') tells the other learner
// tabs to read the profile list again. It carries `{ v: 1, kind: 'changed' }` and nothing else.

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

function env(open: () => FakeChannel | null = () => new FakeChannel('hr-profiles')) {
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

describe('profiles channel (web)', () => {
  it('posts the one v1 message, with no id and no name', () => {
    const e = env();
    postProfilesChanged(e.env);
    expect(e.channel()?.posted).toEqual([{ v: 1, kind: 'changed' }]);
    expect(PROFILES_CHANGED_MESSAGE).toEqual({ v: 1, kind: 'changed' });
  });

  it('calls back for a message from another tab, never for junk', () => {
    const e = env();
    const onChange = vi.fn();
    const off = subscribeProfilesChanged(onChange, e.env);
    e.channel()?.onmessage?.({ data: { v: 1, kind: 'changed' } });
    e.channel()?.onmessage?.({ data: { v: 1, kind: 'changed', id: 'profile:a' } });
    e.channel()?.onmessage?.({ data: 'changed' });
    expect(onChange).toHaveBeenCalledTimes(1);
    off();
    e.channel()?.onmessage?.({ data: { v: 1, kind: 'changed' } });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('reads again when the page is back in front, and stops listening on unsubscribe', () => {
    const e = env();
    const onChange = vi.fn();
    const off = subscribeProfilesChanged(onChange, e.env);
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
    expect(() => postProfilesChanged(e.env)).not.toThrow();
    const off = subscribeProfilesChanged(() => undefined, { hub: e.env.hub, win: null, doc: null });
    expect(() => off()).not.toThrow();
    const throwing = {
      hub: e.env.hub,
      win: { addEventListener: () => { throw new Error('x'); }, removeEventListener: () => { throw new Error('x'); } },
      doc: null,
    };
    expect(() => subscribeProfilesChanged(() => undefined, throwing)()).not.toThrow();
    const brokenHub = { post: () => { throw new Error('closed'); }, listen: () => () => undefined };
    expect(() => postProfilesChanged({ hub: brokenHub, win: null, doc: null })).not.toThrow();
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
    postProfilesChanged();
    const off = subscribeProfilesChanged(() => undefined);
    off();
    vi.unstubAllGlobals();
    expect(posted).toEqual([['hr-profiles', { v: 1, kind: 'changed' }]]);
    expect(native.postProfilesChanged()).toBeUndefined();
    expect(native.subscribeProfilesChanged(() => undefined)()).toBeUndefined();
  });
});
