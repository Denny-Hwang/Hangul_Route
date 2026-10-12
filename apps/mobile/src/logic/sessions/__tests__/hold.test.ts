import { describe, expect, it, vi } from 'vitest';
import { holdSession, type SessionHoldPorts } from '../hold';

/**
 * F-REPORT-001 section 3.3.2 (RP-3b): a screen holds a session while it is
 * mounted. A caller that joined another owner's session (begin answered null)
 * does nothing, also on background; the owner ends its session when the app
 * is hidden and begins a new one when it is visible again while still held.
 */

function harness(answers: Array<string | null>): {
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
});
