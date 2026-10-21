import { BROWSE_PASS_SESSION_KEY, CONSOLE_SESSION_KEY, GrownUpLockMessageSchema, UNLOCK_SESSION_KEY } from '@hangul-route/content-schema';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GROWN_UP_LOCK_MESSAGE, clearGrownUpTab, endGrownUpTab, postGrownUpLock, sessionArea, type SessionArea } from '../grown-up-tab.web';
import { endGrownUpTab as nativeEnd } from '../grown-up-tab';

function area(seed: Record<string, string>): SessionArea & { data: Map<string, string> } {
  const data = new Map(Object.entries(seed));
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

// [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS section 7.6, OA-D5: closing the grown-up session on the web clears this
// tab's grown-up keys and posts the one lock message on `hr-grownup`.
describe('grown-up-tab.web', () => {
  it('clears the unlock, the console session and the browse pass, nothing else', () => {
    const a = area({ [UNLOCK_SESSION_KEY]: '1', [CONSOLE_SESSION_KEY]: '2', [BROWSE_PASS_SESSION_KEY]: '3', other: 'x' });
    clearGrownUpTab(a);
    expect([...a.data.keys()]).toEqual(['other']);
    expect(() => clearGrownUpTab(null)).not.toThrow();
    expect(() => clearGrownUpTab({ ...a, removeItem: () => { throw new Error('no'); } })).not.toThrow();
  });

  it('posts exactly { v: 1, kind: lock }, which the schema accepts', () => {
    const posted: unknown[] = [];
    postGrownUpLock(() => ({ postMessage: (m) => void posted.push(m) }));
    expect(posted).toEqual([{ v: 1, kind: 'lock' }]);
    expect(GrownUpLockMessageSchema.safeParse(GROWN_UP_LOCK_MESSAGE).success).toBe(true);
    expect(() => postGrownUpLock(() => null)).not.toThrow();
    expect(() => postGrownUpLock(() => ({ postMessage: () => { throw new Error('closed'); } }))).not.toThrow();
  });

  it('endGrownUpTab does both', () => {
    const a = area({ [UNLOCK_SESSION_KEY]: '1' });
    const posted: unknown[] = [];
    endGrownUpTab(a, () => ({ postMessage: (m) => void posted.push(m) }));
    expect(a.data.size).toBe(0);
    expect(posted).toHaveLength(1);
  });

  it('opens one hr-grownup channel per tab and keeps it', async () => {
    const opened: string[] = [];
    const posted: unknown[] = [];
    class FakeChannel {
      constructor(name: string) {
        opened.push(name);
      }
      postMessage(m: unknown): void {
        posted.push(m);
      }
    }
    vi.stubGlobal('BroadcastChannel', FakeChannel);
    vi.resetModules();
    const fresh = await import('../grown-up-tab.web');
    fresh.postGrownUpLock();
    fresh.postGrownUpLock();
    expect(opened).toEqual(['hr-grownup']);
    expect(posted).toHaveLength(2);
  });

  it('a browser without BroadcastChannel, or one whose constructor throws, posts nothing', async () => {
    vi.stubGlobal('BroadcastChannel', undefined);
    vi.resetModules();
    const none = await import('../grown-up-tab.web');
    expect(() => none.endGrownUpTab(null)).not.toThrow();
    vi.stubGlobal('BroadcastChannel', function Throwing() {
      throw new Error('no');
    });
    vi.resetModules();
    const throwing = await import('../grown-up-tab.web');
    expect(() => throwing.postGrownUpLock()).not.toThrow();
  });

  it('sessionArea is null where the getter throws or storage is missing', () => {
    vi.stubGlobal('sessionStorage', undefined);
    expect(sessionArea()).toBeNull();
  });

  it('the native stub does nothing', () => {
    expect(nativeEnd()).toBeUndefined();
  });
});
