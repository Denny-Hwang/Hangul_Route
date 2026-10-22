import { describe, expect, it, vi } from 'vitest';
import { holdSession, holdWhileFocused, sessionKindOf, takesOver, type FocusPorts, type SessionHoldPorts } from '../hold';

/**
 * F-REPORT-001 section 3.3.2 (RP-3b): a screen holds a session while it is
 * mounted. A caller that joined another owner's session (begin answered null)
 * does nothing, also on background; the owner ends its session when the app
 * is hidden and begins a new one when it is visible again while still held.
 */

function harness(answers: Array<string | null>, visibleAtStart = true): {
  ports: SessionHoldPorts;
  begin: ReturnType<typeof vi.fn>;
  end: ReturnType<typeof vi.fn>;
  emit: (visible: boolean) => void;
  unsubscribed: () => number;
  listeners: () => number;
} {
  const listeners = new Set<(visible: boolean) => void>();
  let removed = 0;
  const begin = vi.fn(() => (answers.length > 0 ? (answers.shift() as string | null) : null));
  const end = vi.fn();
  const ports: SessionHoldPorts = {
    begin,
    end,
    visible: () => visibleAtStart,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        removed += 1;
        listeners.delete(listener);
      };
    },
  };
  return {
    ports,
    begin,
    end,
    emit: (visible) => [...listeners].forEach((l) => l(visible)),
    unsubscribed: () => removed,
    listeners: () => listeners.size,
  };
}

const STORY = { owner: 'story:s1', streak: false } as const;

describe('logic/sessions/hold (F-REPORT-001 section 3.3.2)', () => {
  it('begins on hold and ends that session on release', () => {
    const h = harness(['session:time:1']);
    const release = holdSession(h.ports, 'p1', STORY);
    expect(h.begin).toHaveBeenCalledWith('p1', STORY);
    expect(h.end).not.toHaveBeenCalled();
    release();
    expect(h.end).toHaveBeenCalledWith('p1', 'session:time:1');
    expect(h.unsubscribed()).toBe(1);
    release();
    expect(h.end).toHaveBeenCalledTimes(1);
  });

  it('a joined caller ends nothing and does not follow the app state', () => {
    const h = harness([null]);
    const release = holdSession(h.ports, 'p1', STORY);
    expect(h.listeners()).toBe(0);
    h.emit(false);
    h.emit(true);
    release();
    expect(h.begin).toHaveBeenCalledTimes(1);
    expect(h.end).not.toHaveBeenCalled();
  });

  it('ends on hidden and begins a new session on visible while still held', () => {
    const h = harness(['s1', 's2']);
    const release = holdSession(h.ports, 'p1', STORY);
    h.emit(false);
    expect(h.end).toHaveBeenLastCalledWith('p1', 's1');
    // a second hidden signal (visibilitychange then pagehide) ends nothing more
    h.emit(false);
    expect(h.end).toHaveBeenCalledTimes(1);
    h.emit(true);
    expect(h.begin).toHaveBeenCalledTimes(2);
    // visible again while already open begins nothing
    h.emit(true);
    expect(h.begin).toHaveBeenCalledTimes(2);
    release();
    expect(h.end).toHaveBeenLastCalledWith('p1', 's2');
    expect(h.end).toHaveBeenCalledTimes(2);
  });

  it('released while hidden ends nothing more', () => {
    const h = harness(['s1']);
    const release = holdSession(h.ports, 'p1', STORY);
    h.emit(false);
    release();
    expect(h.end).toHaveBeenCalledTimes(1);
    h.emit(true);
    expect(h.begin).toHaveBeenCalledTimes(1);
  });

  it('a visible signal that finds another owner joins it and ends nothing later', () => {
    const h = harness(['s1', null]);
    const release = holdSession(h.ports, 'p1', STORY);
    h.emit(false);
    h.emit(true);
    release();
    expect(h.end).toHaveBeenCalledTimes(1);
    expect(h.end).toHaveBeenCalledWith('p1', 's1');
  });

  it('held while the app is already hidden begins nothing until it is visible (a tab opened in the background)', () => {
    const h = harness(['s1'], false);
    const release = holdSession(h.ports, 'p1', STORY);
    expect(h.begin).not.toHaveBeenCalled();
    expect(h.listeners()).toBe(1);
    h.emit(true);
    expect(h.begin).toHaveBeenCalledWith('p1', STORY);
    release();
    expect(h.end).toHaveBeenCalledWith('p1', 's1');
  });

  it('held while hidden and released before it is visible ends nothing', () => {
    const h = harness(['s1'], false);
    const release = holdSession(h.ports, 'p1', STORY);
    release();
    h.emit(true);
    expect(h.begin).not.toHaveBeenCalled();
    expect(h.end).not.toHaveBeenCalled();
    expect(h.unsubscribed()).toBe(1);
  });
});

/**
 * F-REPORT-001 section 3.3.2 (RP-3b review): a time-only session runs while
 * its screen is in front. A grown-up screen pushed over the level check (the
 * PIN, the placement report) ends it, and coming back begins a new one.
 */
function focusHarness(focusedAtStart: boolean): {
  focus: FocusPorts;
  emit: (event: 'focus' | 'blur') => void;
  listeners: () => number;
} {
  const listeners = { focus: new Set<() => void>(), blur: new Set<() => void>() };
  return {
    focus: {
      isFocused: () => focusedAtStart,
      addListener: (event, listener) => {
        listeners[event].add(listener);
        return () => listeners[event].delete(listener);
      },
    },
    emit: (event) => [...listeners[event]].forEach((l) => l()),
    listeners: () => listeners.focus.size + listeners.blur.size,
  };
}

describe('logic/sessions/hold holdWhileFocused (F-REPORT-001 section 3.3.2)', () => {
  it('holds while focused, releases on blur, holds again on focus, and releases on unmount', () => {
    const f = focusHarness(true);
    const releases: Array<ReturnType<typeof vi.fn>> = [];
    const hold = vi.fn(() => {
      const release = vi.fn();
      releases.push(release);
      return release;
    });
    const off = holdWhileFocused(f.focus, hold);
    expect(hold).toHaveBeenCalledTimes(1);
    f.emit('blur');
    expect(releases[0]).toHaveBeenCalledTimes(1);
    f.emit('blur');
    expect(releases[0]).toHaveBeenCalledTimes(1);
    f.emit('focus');
    expect(hold).toHaveBeenCalledTimes(2);
    f.emit('focus');
    expect(hold).toHaveBeenCalledTimes(2);
    off();
    expect(releases[1]).toHaveBeenCalledTimes(1);
    expect(f.listeners()).toBe(0);
    f.emit('focus');
    expect(hold).toHaveBeenCalledTimes(2);
  });

  it('mounted out of focus holds nothing until it is focused', () => {
    const f = focusHarness(false);
    const hold = vi.fn(() => vi.fn());
    const off = holdWhileFocused(f.focus, hold);
    expect(hold).not.toHaveBeenCalled();
    f.emit('focus');
    expect(hold).toHaveBeenCalledTimes(1);
    off();
  });

  it('without a navigator (no focus ports) holds for the whole mount', () => {
    const release = vi.fn();
    const hold = vi.fn(() => release);
    const off = holdWhileFocused(null, hold);
    expect(hold).toHaveBeenCalledTimes(1);
    off();
    expect(release).toHaveBeenCalledTimes(1);
  });
});

describe('logic/sessions/hold session kinds (F-CURR-002 OD-14)', () => {
  const QUEST = { streak: true } as const;
  const LEARN = { streak: false, keepsRun: true } as const;
  const TIME = { streak: false } as const;

  it('names the kind: a quest, a learning session (story, word set) or a time-only one (game, level check)', () => {
    expect(sessionKindOf(QUEST)).toBe('quest');
    expect(sessionKindOf({ streak: true, keepsRun: false })).toBe('quest');
    expect(sessionKindOf(LEARN)).toBe('learn');
    expect(sessionKindOf(TIME)).toBe('time');
    expect(sessionKindOf({ streak: false, keepsRun: false })).toBe('time');
  });

  it('takes over only a kind that counts for less', () => {
    expect(takesOver(TIME, QUEST)).toBe(true);
    expect(takesOver(LEARN, QUEST)).toBe(true);
    expect(takesOver(TIME, LEARN)).toBe(true);
    expect(takesOver(QUEST, LEARN)).toBe(false);
    expect(takesOver(QUEST, QUEST)).toBe(false);
    expect(takesOver(LEARN, LEARN)).toBe(false);
    expect(takesOver(LEARN, TIME)).toBe(false);
    expect(takesOver(TIME, TIME)).toBe(false);
  });
});
