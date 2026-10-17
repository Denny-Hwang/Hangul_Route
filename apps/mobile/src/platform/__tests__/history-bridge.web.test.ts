import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as native from '../history-bridge';
import { adoptLinkEntry, currentEntry, installHistoryBridge, markLeaving, registerHistorySheet, syncHistory, type BridgeNavigation } from '../history-bridge.web';

/**
 * The web history bridge (AMENDMENTS-DISPLAY-NAV section 7.2, row DN-4), against a fake tab
 * history (entries, an index, popstate after each traversal, as a browser does) and a fake stack
 * navigator with `beforeRemove` guards. The browser's own back and forward are `browserBack()` /
 * `browserForward()`; the bridge's `history.go` traversals run on `flush()`.
 */
type Entry = { state: unknown };

class FakeTab {
  /** Entry 0 is the page that opened the app (another document); the app starts on entry 1. */
  entries: Entry[] = [{ state: 'opener' }, { state: null }];
  index = 1;
  queued: number[] = [];
  left = false;
  listeners = new Map<string, (event?: unknown) => void>();
  readonly history = {
    get state(): unknown {
      return tab.entries[tab.index]!.state;
    },
    get length(): number {
      return tab.entries.length;
    },
    pushState: (state: unknown): void => {
      tab.entries = tab.entries.slice(0, tab.index + 1);
      tab.entries.push({ state });
      tab.index += 1;
    },
    replaceState: (state: unknown): void => {
      tab.entries[tab.index] = { state };
    },
    go: (delta: number): void => {
      tab.queued.push(delta);
    },
  };

  private traverse(delta: number): void {
    const to = this.index + delta;
    if (to < 1) {
      this.left = true;
      this.index = Math.max(0, to);
      return;
    }
    this.index = Math.min(to, this.entries.length - 1);
    this.listeners.get('popstate')?.({ state: this.entries[this.index]!.state });
  }

  /** Runs the traversals the page asked for (each fires its popstate), as the browser does after the current task. */
  flush(): void {
    while (this.queued.length > 0) this.traverse(this.queued.shift()!);
  }

  browserBack(by = 1): void {
    this.traverse(-by);
    this.flush();
  }

  browserForward(by = 1): void {
    this.traverse(by);
    this.flush();
  }

  /** The `hrNav` of every app entry, the current one marked. */
  navs(): string {
    return this.entries
      .slice(1)
      .map((e, i) => `${(e.state as { hrNav?: number } | null)?.hrNav ?? '-'}${i + 1 === this.index ? '*' : ''}`)
      .join(' ');
  }
}

let tab: FakeTab;

/** A stack navigator: route names, guards per route (true = hold the screen), a 'state' event after each change. */
class FakeStack implements BridgeNavigation {
  routes: string[];
  guards = new Map<string, () => boolean>();
  private listeners = new Set<() => void>();
  constructor(routes: string[]) {
    this.routes = routes;
  }
  getRootState() {
    return { type: 'stack', index: this.routes.length - 1, routes: this.routes.map(() => ({})) };
  }
  addListener(_type: 'state', listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  private changed(): void {
    for (const listener of this.listeners) listener();
  }
  push(name: string): void {
    this.routes = [...this.routes, name];
    this.changed();
  }
  replace(name: string): void {
    this.routes = [...this.routes.slice(0, -1), name];
    this.changed();
  }
  reset(routes: string[]): void {
    this.routes = routes;
    this.changed();
  }
  goBack(): void {
    if (this.routes.length < 2) return;
    const top = this.routes[this.routes.length - 1]!;
    if (this.guards.get(top)?.()) return;
    this.routes = this.routes.slice(0, -1);
    this.changed();
  }
}

let stop: () => void = () => undefined;

function start(routes: string[], state: unknown = null): FakeStack {
  tab.entries[1] = { state };
  const nav = new FakeStack(routes);
  stop = installHistoryBridge(nav);
  tab.flush();
  return nav;
}

beforeEach(() => {
  tab = new FakeTab();
  vi.stubGlobal('history', tab.history);
  vi.stubGlobal('addEventListener', (type: string, fn: (event?: unknown) => void) => tab.listeners.set(type, fn));
  vi.stubGlobal('removeEventListener', (type: string) => tab.listeners.delete(type));
});

afterEach(() => {
  stop();
  vi.unstubAllGlobals();
});

describe('history bridge: the app changes the stack', () => {
  it('the first entry becomes hrNav 0; each push adds one entry', () => {
    const nav = start(['Main']);
    expect(tab.navs()).toBe('0*');
    nav.push('Profile');
    nav.push('EditProfile');
    expect(tab.navs()).toBe('0 1 2*');
  });

  it('the visible Back takes its entry back, so the next browser back is not a dead press', () => {
    const nav = start(['Main']);
    nav.push('Profile');
    nav.goBack();
    tab.flush();
    expect(tab.navs()).toBe('0* 1');
    expect(nav.routes).toEqual(['Main']);
    // The browser back from here leaves the app in one press.
    tab.browserBack();
    expect(tab.left).toBe(true);
  });

  it('replace and a reset at the same depth change nothing (CreateProfile, a quest\'s [Main, Results])', () => {
    const nav = start(['Main']);
    nav.push('QuestPlayer');
    nav.replace('EpisodeDetail');
    expect(tab.navs()).toBe('0 1*');
    nav.reset(['Main', 'Results']);
    expect(tab.navs()).toBe('0 1*');
  });

  it('a reset to a lower depth goes back past the levels it left (Placement\'s reset)', () => {
    const nav = start(['Main']);
    nav.push('Profile');
    nav.push('Placement');
    nav.reset(['FirstQuestPreview']);
    tab.flush();
    expect(tab.navs()).toBe('0* 1 2');
    // A later push replaces the dead entries ahead.
    nav.push('QuestPlayer');
    expect(tab.navs()).toBe('0 1*');
  });

  it('changes while its own traversal is on the way wait for it, then reconcile', () => {
    const nav = start(['Main']);
    nav.push('Profile');
    nav.push('JoinSpace');
    nav.goBack();
    nav.goBack();
    nav.push('Notes');
    tab.flush();
    // On entry 1 for [Main, Notes]; entry 2 is ahead (Forward to it goes straight back).
    expect(tab.navs()).toBe('0 1* 2');
    expect(nav.routes).toEqual(['Main', 'Notes']);
    tab.browserForward();
    expect(nav.routes).toEqual(['Main', 'Notes']);
    expect(tab.navs()).toBe('0 1* 2');
  });
});

describe('history bridge: the browser changes the history', () => {
  it('the browser back lands where the visible Back does', () => {
    const nav = start(['Main']);
    nav.push('Profile');
    nav.push('ParentDashboard');
    tab.browserBack();
    expect(nav.routes).toEqual(['Main', 'Profile']);
    expect(tab.navs()).toBe('0 1* 2');
    tab.browserBack();
    expect(nav.routes).toEqual(['Main']);
  });

  it('a two-entry jump runs both guards, one level at a time', () => {
    const nav = start(['Main']);
    const asked: string[] = [];
    nav.guards.set('EditProfile', () => (asked.push('EditProfile'), false));
    nav.guards.set('Profile', () => (asked.push('Profile'), false));
    nav.push('Profile');
    nav.push('EditProfile');
    tab.browserBack(2);
    expect(asked).toEqual(['EditProfile', 'Profile']);
    expect(nav.routes).toEqual(['Main']);
    expect(tab.navs()).toBe('0* 1 2');
  });

  it('a guard that holds the screen (a quest asks first) gets its entries back', () => {
    const nav = start(['Main']);
    nav.guards.set('QuestPlayer', () => true);
    nav.push('EpisodeDetail');
    nav.push('QuestPlayer');
    tab.browserBack();
    expect(nav.routes).toEqual(['Main', 'EpisodeDetail', 'QuestPlayer']);
    expect(tab.navs()).toBe('0 1 2*');
    // A two-entry jump stops at the guard and restores both entries.
    tab.browserBack(2);
    expect(nav.routes).toEqual(['Main', 'EpisodeDetail', 'QuestPlayer']);
    expect(tab.navs()).toBe('0 1 2*');
    // The person confirms in the sheet: the guard dispatches the back, the bridge follows.
    nav.guards.delete('QuestPlayer');
    nav.goBack();
    tab.flush();
    expect(tab.navs()).toBe('0 1* 2');
  });

  it('Forward is never replayed: after leaving the Grown-up area, Forward keeps it closed', () => {
    const nav = start(['Main']);
    nav.push('Profile');
    nav.push('ParentDashboard');
    tab.browserBack();
    expect(nav.routes).toEqual(['Main', 'Profile']);
    tab.browserForward();
    expect(nav.routes).toEqual(['Main', 'Profile']);
    expect(tab.navs()).toBe('0 1* 2');
  });

  it('an entry the app does not own (All lessons\' later link) is left to its hashchange', () => {
    const nav = start(['BrowseHome']);
    nav.push('BrowseItem');
    tab.history.pushState({ other: true });
    tab.browserBack();
    tab.browserForward();
    expect(nav.routes).toEqual(['BrowseHome', 'BrowseItem']);
  });
});

describe('history bridge: All lessons links', () => {
  it('a back across a later link adopts the older link\'s entry and leaves the screen as it is', () => {
    const nav = start(['BrowseHome'], { hrBrowseDepth: 0 });
    nav.push('BrowseItem');
    // A later link: a new entry, claimed by browse-env's hashchange (hrBrowseDepth 2, hrNav 0).
    tab.history.pushState({ hrBrowseDepth: 2, hrNav: 0 });
    adoptLinkEntry(2);
    nav.reset(['BrowseHome']);
    tab.browserBack();
    expect(currentEntry()).toEqual({ nav: 1, browseDepth: 0 });
    expect(nav.routes).toEqual(['BrowseHome']);
  });
});

describe('history bridge: sheets', () => {
  it('a sheet is one level while open; closed by Done it gives the entry back', () => {
    start(['Main']);
    const dismiss = vi.fn();
    const release = registerHistorySheet(dismiss);
    expect(tab.navs()).toBe('0 1*');
    release();
    tab.flush();
    expect(tab.navs()).toBe('0* 1');
    expect(dismiss).not.toHaveBeenCalled();
  });

  it('the browser back closes the sheet as Cancel does, and its release is then a no-op', () => {
    const nav = start(['Main']);
    nav.push('QuestPlayer');
    const dismiss = vi.fn();
    const release = registerHistorySheet(dismiss);
    expect(tab.navs()).toBe('0 1 2*');
    tab.browserBack();
    expect(dismiss).toHaveBeenCalledTimes(1);
    expect(nav.routes).toEqual(['Main', 'QuestPlayer']);
    release();
    tab.flush();
    expect(tab.navs()).toBe('0 1* 2');
  });

  it('confirming a leave closes the sheet and the screen together: back past both', () => {
    const nav = start(['Main']);
    nav.push('QuestPlayer');
    const release = registerHistorySheet(vi.fn());
    release();
    nav.goBack();
    tab.flush();
    expect(tab.navs()).toBe('0* 1 2');
  });

  it('before the bridge runs, a sheet holds nothing', () => {
    const release = registerHistorySheet(vi.fn());
    release();
    expect(tab.entries).toHaveLength(2);
  });
});

describe('history bridge: a page that leaves for another document', () => {
  it('a hand-off that steps the app back under it leaves the history alone, so the navigation is not cancelled', () => {
    const nav = start(['Main']);
    nav.push('PinEntry');
    expect(tab.navs()).toBe('0 1*');
    tab.listeners.get('beforeunload')?.();
    nav.goBack();
    tab.flush();
    expect(tab.queued).toEqual([]);
    expect(tab.navs()).toBe('0 1*');
    // Restored from the back/forward cache: the entry is read again and the history follows the app.
    tab.listeners.get('pageshow')?.();
    tab.flush();
    expect(tab.navs()).toBe('0* 1');
  });

  it('a hand-off marks the leave itself (iOS fires no beforeunload): the history is left alone, with no timer to resume it', () => {
    vi.useFakeTimers();
    try {
      const nav = start(['Main']);
      nav.push('PinEntry');
      // The PIN's hand-off: location.assign, then the app steps back under it in the same task.
      markLeaving();
      nav.goBack();
      tab.flush();
      expect(tab.queued).toEqual([]);
      expect(tab.navs()).toBe('0 1*');
      // A slow page on a phone network is still leaving after any wait: nothing resumes by itself.
      vi.advanceTimersByTime(60_000);
      tab.flush();
      expect(tab.navs()).toBe('0 1*');
      // A browser move while leaving is not followed either.
      tab.listeners.get('popstate')?.({ state: { hrNav: 0 } });
      tab.flush();
      expect(tab.queued).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('a navigation that never happened resumes when the person uses the page again after the grace', () => {
    vi.useFakeTimers();
    try {
      const nav = start(['Main']);
      nav.push('Profile');
      tab.listeners.get('pagehide')?.();
      nav.goBack();
      tab.flush();
      expect(tab.navs()).toBe('0 1*');
      // A tap soon after the leave is the person waiting for the page: still leaving.
      vi.advanceTimersByTime(2_000);
      tab.listeners.get('pointerdown')?.();
      tab.flush();
      expect(tab.navs()).toBe('0 1*');
      // Long after, the page is still here and in use: the navigation did not happen, so the history follows the app.
      vi.advanceTimersByTime(10_000);
      tab.listeners.get('keydown')?.();
      tab.flush();
      expect(tab.navs()).toBe('0* 1');
      nav.push('Notes');
      expect(tab.navs()).toBe('0 1*');
    } finally {
      vi.useRealTimers();
    }
  });

  it('input while the tab is hidden does not count as staying; a show resumes at once', () => {
    vi.useFakeTimers();
    vi.stubGlobal('document', { visibilityState: 'hidden' });
    try {
      const nav = start(['Main']);
      nav.push('Profile');
      tab.listeners.get('beforeunload')?.();
      nav.goBack();
      vi.advanceTimersByTime(20_000);
      tab.listeners.get('keydown')?.();
      tab.flush();
      expect(tab.navs()).toBe('0 1*');
      tab.listeners.get('pageshow')?.();
      tab.flush();
      expect(tab.navs()).toBe('0* 1');
    } finally {
      vi.useRealTimers();
    }
  });

  it('every hand-off that loads another page in this tab marks the leave first (source scan)', () => {
    const dir = join(__dirname, '..');
    const sites: string[] = [];
    for (const name of readdirSync(dir).filter((n) => n.endsWith('.web.ts'))) {
      const lines = readFileSync(join(dir, name), 'utf8').split('\n');
      lines.forEach((line, i) => {
        if (!/location\??\.assign\??\.?\(|history\??\.go\??\.\(-closeDistance/.test(line) || /^\s*(\*|\/\/)/.test(line)) return;
        sites.push(name);
        const before = lines.slice(Math.max(0, i - 20), i).join('\n');
        expect(before, `${name}:${i + 1} leaves without markLeaving()`).toMatch(/markLeaving\(\)/);
      });
    }
    expect(new Set(sites)).toEqual(new Set(['browse-env.web.ts', 'browse-handoff.web.ts', 'grown-up-handoff.web.ts', 'persona-signin.web.ts']));
  });

  it('input that follows no leave changes nothing', () => {
    const nav = start(['Main']);
    nav.push('Profile');
    tab.listeners.get('pointerdown')?.();
    expect(tab.navs()).toBe('0 1*');
  });

  it('a show that follows no leave changes nothing', () => {
    const nav = start(['Main']);
    nav.push('Profile');
    tab.listeners.get('pageshow')?.();
    expect(tab.navs()).toBe('0 1*');
  });
});

describe('history bridge: boot', () => {
  it('a reload deep in the app rewinds to the first entry, so one back leaves', () => {
    tab.entries = [{ state: 'opener' }, { state: { hrNav: 0 } }, { state: { hrNav: 1 } }, { state: { hrNav: 2 } }];
    tab.index = 3;
    const nav = new FakeStack(['Main']);
    stop = installHistoryBridge(nav);
    tab.flush();
    expect(tab.index).toBe(1);
    nav.push('Profile');
    expect(tab.navs()).toBe('0 1*');
    tab.browserBack();
    tab.browserBack();
    expect(tab.left).toBe(true);
  });

  it('a boot stack deeper than the root (All lessons\' entry stacks) pushes one entry per route above it', () => {
    start(['BrowseHome', 'BrowseEpisode', 'BrowseItem'], { hrBrowseDepth: 0 });
    expect(tab.navs()).toBe('0 1 2*');
    // Every entry keeps the link depth beside its own depth.
    expect(tab.entries[3]!.state).toEqual({ hrBrowseDepth: 0, hrNav: 2 });
  });

  it('All lessons\' link entry: currentEntry before and after a link is adopted', () => {
    expect(currentEntry()).toBeNull();
    const nav = start(['BrowseHome'], { hrBrowseDepth: 1 });
    nav.push('BrowseItem');
    expect(currentEntry()).toEqual({ nav: 1, browseDepth: 1 });
    adoptLinkEntry(3);
    expect(currentEntry()).toEqual({ nav: 0, browseDepth: 3 });
  });

  it('with no history the bridge does nothing; sync before it runs does nothing', () => {
    vi.stubGlobal('history', undefined);
    const nav = new FakeStack(['Main']);
    expect(() => installHistoryBridge(nav)()).not.toThrow();
    expect(() => syncHistory()).not.toThrow();
  });

  it('a history that refuses never throws', () => {
    tab.history.pushState = () => {
      throw new Error('SecurityError');
    };
    tab.history.replaceState = () => {
      throw new Error('SecurityError');
    };
    tab.history.go = () => {
      throw new Error('SecurityError');
    };
    const nav = start(['Main'], { hrNav: 0 });
    expect(() => nav.push('Profile')).not.toThrow();
    expect(() => nav.goBack()).not.toThrow();
  });

  it('a navigation whose state cannot be read counts as the root', () => {
    const nav = new FakeStack(['Main']);
    nav.getRootState = () => {
      throw new Error('not ready');
    };
    stop = installHistoryBridge(nav);
    expect(tab.navs()).toBe('0*');
  });

  it('the native stub does nothing', () => {
    const nav = new FakeStack(['Main']);
    expect(native.installHistoryBridge(nav)()).toBeUndefined();
    expect(native.registerHistorySheet(vi.fn())()).toBeUndefined();
    expect(native.currentEntry()).toBeNull();
    expect(() => {
      native.syncHistory();
      native.useHistorySheet(true, vi.fn());
      native.adoptLinkEntry(1);
    }).not.toThrow();
  });
});
