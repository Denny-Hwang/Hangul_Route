import { describe, expect, it, vi } from 'vitest';
import * as native from '../prefs-channel';
import { createPrefsHub, postDeviceSettings, subscribeDeviceSettings } from '../prefs-channel.web';

/**
 * Cross-tab display record changes (owner items 6 and 7): BroadcastChannel('hr-prefs') carries a
 * record one tab wrote to every other tab of the origin, and a page re-reads the record on
 * visibilitychange (to visible) and pageshow. A tab posts and listens on one channel instance, so
 * it never receives its own writes.
 */
class FakeChannel {
  static all: FakeChannel[] = [];
  posted: unknown[] = [];
  closed = false;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  constructor(readonly name: string) {
    FakeChannel.all.push(this);
  }
  postMessage(message: unknown): void {
    this.posted.push(message);
  }
  close(): void {
    this.closed = true;
  }
}

const message = (settings: Record<string, unknown>) => ({ ns: 'hr-prefs', v: 1, type: 'device-settings', settings });

function target(): { add: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn>; fire: (type: string) => void; visibilityState?: string } {
  const listeners = new Map<string, () => void>();
  const t = {
    add: vi.fn((type: string, fn: () => void) => listeners.set(type, fn)),
    remove: vi.fn((type: string) => listeners.delete(type)),
    fire: (type: string) => listeners.get(type)?.(),
  };
  return t;
}

function env(over: { channel?: () => FakeChannel | null; visibility?: string } = {}) {
  const win = target();
  const doc = { ...target(), visibilityState: over.visibility ?? 'visible' };
  return {
    win,
    doc,
    env: {
      hub: createPrefsHub(over.channel ?? (() => new FakeChannel('hr-prefs'))),
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

describe('postDeviceSettings (web)', () => {
  it('posts the record as a v1 message on hr-prefs, on the tab\'s one channel', () => {
    FakeChannel.all = [];
    const { env: e } = env();
    postDeviceSettings({ uiLocale: 'ko', textSize: 'large' }, e);
    postDeviceSettings({ textSize: 'larger' }, e);
    expect(FakeChannel.all).toHaveLength(1);
    const [channel] = FakeChannel.all;
    expect(channel?.name).toBe('hr-prefs');
    expect(channel?.posted).toEqual([message({ uiLocale: 'ko', textSize: 'large' }), message({ textSize: 'larger' })]);
  });

  it('no channel (an old browser) or a channel that throws loses only the live update', () => {
    expect(() => postDeviceSettings({ uiLocale: 'ko' }, env({ channel: () => null }).env)).not.toThrow();
    const broken = new FakeChannel('hr-prefs');
    broken.postMessage = () => {
      throw new Error('closed');
    };
    expect(() => postDeviceSettings({ uiLocale: 'ko' }, env({ channel: () => broken }).env)).not.toThrow();
    expect(() =>
      postDeviceSettings(
        { uiLocale: 'ko' },
        env({
          channel: () => {
            throw new Error('blocked');
          },
        }).env,
      ),
    ).not.toThrow();
  });

  it('reads the browser by default: one channel for the tab, posted and listened on', () => {
    const made: FakeChannel[] = [];
    vi.stubGlobal(
      'BroadcastChannel',
      class extends FakeChannel {
        constructor(name: string) {
          super(name);
          made.push(this);
        }
      },
    );
    try {
      const stop = subscribeDeviceSettings(vi.fn(), vi.fn());
      postDeviceSettings({ textSize: 'larger' });
      expect(made).toHaveLength(1);
      expect(made[0]?.posted).toEqual([message({ textSize: 'larger' })]);
      stop();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('subscribeDeviceSettings (web)', () => {
  it('hands on a valid record another tab posted and drops anything else (the message is strict)', () => {
    FakeChannel.all = [];
    const onRecord = vi.fn();
    const { env: e } = env();
    subscribeDeviceSettings(onRecord, vi.fn(), e);
    const channel = FakeChannel.all[0]!;
    channel.onmessage?.({ data: message({ uiLocale: 'es' }) });
    channel.onmessage?.({ data: message({ uiLocale: 'fr', textSize: 'large' }) });
    channel.onmessage?.({ data: { ...message({ uiLocale: 'ko' }), from: 'x' } });
    channel.onmessage?.({ data: { v: 1, kind: 'device-settings', value: { uiLocale: 'ko' } } });
    channel.onmessage?.({ data: 'hello' });
    expect(onRecord.mock.calls).toEqual([[{ uiLocale: 'es' }], [{ textSize: 'large' }]]);
  });

  it('with real BroadcastChannels: another tab receives the write, the writing tab does not', async () => {
    const Native = (globalThis as unknown as { BroadcastChannel?: new (n: string) => FakeChannel }).BroadcastChannel;
    expect(typeof Native).toBe('function');
    const opened: FakeChannel[] = [];
    const open = (): FakeChannel => {
      const c = new Native!('hr-prefs');
      opened.push(c);
      return c;
    };
    const tabA = { hub: createPrefsHub(open), win: null, doc: null };
    const tabB = { hub: createPrefsHub(open), win: null, doc: null };
    const onA = vi.fn();
    let delivered!: () => void;
    // Waits for the delivery itself (not a fixed time), with a second as the limit.
    const arrived = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('no message within 1 s')), 1000);
      delivered = () => {
        clearTimeout(timer);
        resolve();
      };
    });
    const onB = vi.fn(() => delivered());
    const stopA = subscribeDeviceSettings(onA, vi.fn(), tabA);
    const stopB = subscribeDeviceSettings(onB, vi.fn(), tabB);
    postDeviceSettings({ uiLocale: 'ko' }, tabA);
    await arrived;
    expect(onB.mock.calls).toEqual([[{ uiLocale: 'ko' }]]);
    // One more task after the delivery, and the writing tab still has nothing.
    await new Promise((r) => setTimeout(r, 0));
    expect(onA).not.toHaveBeenCalled();
    stopA();
    stopB();
    for (const c of opened) c.close();
  });

  it('re-reads when the page comes back to the front or is restored, not when it goes to the back', () => {
    const onReturn = vi.fn();
    const t = env();
    subscribeDeviceSettings(vi.fn(), onReturn, t.env);
    t.doc.fire('visibilitychange');
    t.win.fire('pageshow');
    expect(onReturn).toHaveBeenCalledTimes(2);
    t.doc.visibilityState = 'hidden';
    t.doc.fire('visibilitychange');
    expect(onReturn).toHaveBeenCalledTimes(2);
  });

  it('the unsubscribe stops the listener and removes both page listeners', () => {
    FakeChannel.all = [];
    const t = env();
    const onRecord = vi.fn();
    const stop = subscribeDeviceSettings(onRecord, vi.fn(), t.env);
    stop();
    FakeChannel.all[0]?.onmessage?.({ data: message({ uiLocale: 'es' }) });
    expect(onRecord).not.toHaveBeenCalled();
    expect(t.doc.remove).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    expect(t.win.remove).toHaveBeenCalledWith('pageshow', expect.any(Function));
  });

  it('without a channel or a document it still listens to what there is and never throws', () => {
    const onReturn = vi.fn();
    const stop = subscribeDeviceSettings(vi.fn(), onReturn, { hub: createPrefsHub(() => null), win: null, doc: null });
    expect(() => stop()).not.toThrow();
    const throwing = {
      addEventListener: () => {
        throw new Error('no');
      },
      removeEventListener: () => {
        throw new Error('no');
      },
    };
    const stop2 = subscribeDeviceSettings(vi.fn(), onReturn, { hub: createPrefsHub(() => null), win: throwing, doc: throwing });
    expect(() => stop2()).not.toThrow();
  });
});

describe('prefs-channel (native)', () => {
  it('has no other tab: posting and listening are no-ops', () => {
    expect(() => native.postDeviceSettings({ uiLocale: 'ko' })).not.toThrow();
    const stop = native.subscribeDeviceSettings(vi.fn(), vi.fn());
    expect(() => stop()).not.toThrow();
  });
});
