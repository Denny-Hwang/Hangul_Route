import { describe, expect, it, vi } from 'vitest';
import * as native from '../prefs-channel';
import { postDeviceSettings, subscribeDeviceSettings } from '../prefs-channel.web';

/**
 * Cross-tab display record changes (owner items 6 and 7): BroadcastChannel('hr-prefs') carries a
 * record one tab wrote to every other tab of the origin, and a page re-reads the record on
 * visibilitychange (to visible) and pageshow.
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
      channel: over.channel ?? (() => new FakeChannel('hr-prefs')),
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
  it('posts the record as a v1 message on hr-prefs and closes the channel', () => {
    FakeChannel.all = [];
    const { env: e } = env();
    postDeviceSettings({ uiLocale: 'ko', textSize: 'large' }, e);
    const [channel] = FakeChannel.all;
    expect(channel?.name).toBe('hr-prefs');
    expect(channel?.posted).toEqual([{ v: 1, kind: 'device-settings', value: { uiLocale: 'ko', textSize: 'large' } }]);
    expect(channel?.closed).toBe(true);
  });

  it('no channel (an old browser) or a channel that throws loses only the live update', () => {
    expect(() => postDeviceSettings({ uiLocale: 'ko' }, env({ channel: () => null }).env)).not.toThrow();
    const broken = new FakeChannel('hr-prefs');
    broken.postMessage = () => {
      throw new Error('closed');
    };
    broken.close = () => {
      throw new Error('gone');
    };
    expect(() => postDeviceSettings({ uiLocale: 'ko' }, env({ channel: () => broken }).env)).not.toThrow();
  });

  it('reads the browser by default, and a constructor that throws counts as no channel', () => {
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
      postDeviceSettings({ textSize: 'larger' });
      expect(made[0]?.posted).toEqual([{ v: 1, kind: 'device-settings', value: { textSize: 'larger' } }]);
      vi.stubGlobal('BroadcastChannel', function Throwing() {
        throw new Error('blocked');
      });
      expect(() => postDeviceSettings({ textSize: 'larger' })).not.toThrow();
      vi.stubGlobal('BroadcastChannel', undefined);
      expect(() => postDeviceSettings({ textSize: 'larger' })).not.toThrow();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('subscribeDeviceSettings (web)', () => {
  it('hands on a valid record another tab posted and drops anything else', () => {
    FakeChannel.all = [];
    const onRecord = vi.fn();
    const { env: e } = env();
    subscribeDeviceSettings(onRecord, vi.fn(), e);
    const channel = FakeChannel.all[0]!;
    channel.onmessage?.({ data: { v: 1, kind: 'device-settings', value: { uiLocale: 'es' } } });
    channel.onmessage?.({ data: { v: 1, kind: 'device-settings', value: { uiLocale: 'fr' } } });
    channel.onmessage?.({ data: 'hello' });
    expect(onRecord.mock.calls).toEqual([[{ uiLocale: 'es' }]]);
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

  it('the unsubscribe closes the channel and removes both listeners', () => {
    FakeChannel.all = [];
    const t = env();
    const stop = subscribeDeviceSettings(vi.fn(), vi.fn(), t.env);
    stop();
    expect(FakeChannel.all[0]?.closed).toBe(true);
    expect(FakeChannel.all[0]?.onmessage).toBeNull();
    expect(t.doc.remove).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    expect(t.win.remove).toHaveBeenCalledWith('pageshow', expect.any(Function));
  });

  it('without a channel or a document it still listens to what there is and never throws', () => {
    const onReturn = vi.fn();
    const stop = subscribeDeviceSettings(vi.fn(), onReturn, { channel: () => null, win: null, doc: null });
    expect(() => stop()).not.toThrow();
    const throwing = { addEventListener: () => {
      throw new Error('no');
    }, removeEventListener: () => {
      throw new Error('no');
    } };
    const stop2 = subscribeDeviceSettings(vi.fn(), onReturn, { channel: () => null, win: throwing, doc: throwing });
    expect(() => stop2()).not.toThrow();
  });

  it('reads the browser by default', () => {
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
      expect(made).toHaveLength(1);
      stop();
      expect(made[0]?.closed).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('prefs-channel (native)', () => {
  it('has no other tab: posting and listening are no-ops', () => {
    expect(() => native.postDeviceSettings({ uiLocale: 'ko' })).not.toThrow();
    const stop = native.subscribeDeviceSettings(vi.fn(), vi.fn());
    expect(() => stop()).not.toThrow();
  });
});
