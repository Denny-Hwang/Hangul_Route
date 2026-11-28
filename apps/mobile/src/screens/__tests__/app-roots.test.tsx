import { describe, expect, it, vi } from 'vitest';

/**
 * [SB] AMENDMENTS-START-BUNDLE-2026-11 row SB-4e: each grown-up root's one load is its code and the lecture sources
 * together (`screens/app-roots.tsx`), so `withLessonContent` waits for both inside its root timeout. The door is a
 * stand-in whose requests wait for the test; the roots' own modules are stubs.
 */
interface Pending {
  resolve: (value: string) => void;
  reject: (error: unknown) => void;
}
const door = vi.hoisted(() => ({ asked: [] as Pending[], drops: 0 }));

vi.mock('../lecture-sources-entry', () => ({
  LECTURE_SOURCES_BUNDLE: 'lecture-sources-chunk',
  lectureSourcesDoor: {
    load: () =>
      new Promise<string>((resolve, reject) => {
        door.asked.push({ resolve, reject });
      }),
    drop: () => {
      door.drops += 1;
    },
    now: () => null,
  },
}));
vi.mock('../../../App', () => ({ default: () => null }));
vi.mock('../../../PresenterApp', () => ({ default: () => null, ROOT_CHUNK: 'root-chunk:presenter' }));
vi.mock('../../../BrowseApp', () => ({ default: () => null, ROOT_CHUNK: 'root-chunk:browse' }));

const { BrowseRoot, PresenterRoot } = await import('../app-roots');

/** Resolves true once `promise` has settled (a few microtask turns later), false while it is pending. */
async function settled(promise: Promise<unknown>): Promise<boolean> {
  let done = false;
  promise.then(
    () => (done = true),
    () => (done = true),
  );
  await new Promise((resolve) => setTimeout(resolve, 0));
  return done;
}

describe.each([
  ['PresenterApp', PresenterRoot],
  ['BrowseApp', BrowseRoot],
])('the %s root\'s one load (row SB-4e)', (name, root) => {
  it('names the root bundle and the lecture sources chunk it waits for beside it', () => {
    expect(root.name).toBe(name);
    expect(root.alongside?.bundles).toEqual(['lecture-sources-chunk']);
  });

  it('does not resolve before the sources are in; it resolves with the root\'s module', async () => {
    door.asked.length = 0;
    const load = root.load();
    expect(await settled(load)).toBe(false);
    expect(door.asked).toHaveLength(1);
    door.asked[0]!.resolve('in');
    const mod = await load;
    expect(typeof mod.default).toBe('function');
  });

  it('fails with the sources\' failure, and a second load asks the door again', async () => {
    door.asked.length = 0;
    const first = root.load();
    door.asked[0]!.reject(new Error('offline'));
    await expect(first).rejects.toThrow('offline');
    const second = root.load();
    expect(door.asked).toHaveLength(2);
    door.asked[1]!.resolve('in');
    await expect(second).resolves.toBeDefined();
  });

  it('drops the door\'s pending request through `alongside.drop`', () => {
    door.drops = 0;
    root.alongside?.drop();
    expect(door.drops).toBe(1);
  });
});
