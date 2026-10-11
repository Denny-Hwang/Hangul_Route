import { afterEach, describe, expect, it, vi } from 'vitest';
import { subscribeReaderKeys } from '../keys.web';

type Listener = (event: FakeKeyEvent) => void;

interface FakeKeyEvent {
  key: string;
  repeat?: boolean;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  target?: unknown;
  defaultPrevented?: boolean;
  preventDefault: () => void;
}

function fakeDocument() {
  const listeners = new Set<Listener>();
  return {
    listeners,
    addEventListener: vi.fn((type: string, fn: Listener) => {
      if (type === 'keydown') listeners.add(fn);
    }),
    removeEventListener: vi.fn((type: string, fn: Listener) => {
      if (type === 'keydown') listeners.delete(fn);
    }),
    press(init: Omit<FakeKeyEvent, 'preventDefault'>): FakeKeyEvent {
      const event: FakeKeyEvent = { ...init, preventDefault: vi.fn() };
      for (const fn of listeners) fn(event);
      return event;
    },
  };
}

const g = globalThis as { document?: unknown };

afterEach(() => {
  delete g.document;
});

describe('platform/keys.web', () => {
  it('passes Right, Left and Escape to the handler and stops listening on unsubscribe', () => {
    const doc = fakeDocument();
    g.document = doc;
    const handler = vi.fn(() => true);
    const off = subscribeReaderKeys(handler);
    const right = doc.press({ key: 'ArrowRight' });
    doc.press({ key: 'ArrowLeft' });
    doc.press({ key: 'Escape' });
    expect(handler.mock.calls.map((c) => c[0])).toEqual(['ArrowRight', 'ArrowLeft', 'Escape']);
    expect(right.preventDefault).toHaveBeenCalled();
    off();
    expect(doc.listeners.size).toBe(0);
    doc.press({ key: 'ArrowRight' });
    expect(handler).toHaveBeenCalledTimes(3);
  });

  it('does not prevent the default when the handler did nothing with the key', () => {
    const doc = fakeDocument();
    g.document = doc;
    subscribeReaderKeys(() => false);
    expect(doc.press({ key: 'ArrowRight' }).preventDefault).not.toHaveBeenCalled();
  });

  it('ignores repeats, modifiers, other keys, handled events and typing in a field', () => {
    const doc = fakeDocument();
    g.document = doc;
    const handler = vi.fn(() => true);
    subscribeReaderKeys(handler);
    doc.press({ key: 'ArrowRight', repeat: true });
    doc.press({ key: 'ArrowRight', altKey: true });
    doc.press({ key: 'ArrowLeft', ctrlKey: true });
    doc.press({ key: 'ArrowLeft', metaKey: true });
    doc.press({ key: 'Enter' });
    doc.press({ key: 'Escape', defaultPrevented: true });
    doc.press({ key: 'ArrowRight', target: { tagName: 'INPUT' } });
    doc.press({ key: 'ArrowRight', target: { tagName: 'TEXTAREA' } });
    doc.press({ key: 'ArrowRight', target: { tagName: 'DIV', isContentEditable: true } });
    expect(handler).not.toHaveBeenCalled();
    doc.press({ key: 'ArrowRight', target: { tagName: 'DIV' } });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('is a no-op without a document', () => {
    const off = subscribeReaderKeys(vi.fn());
    expect(() => off()).not.toThrow();
  });
});
