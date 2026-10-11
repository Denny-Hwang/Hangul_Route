import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LECTURE_MESSAGE_NS, type LectureDeck } from '@hangul-route/content-schema';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const storage = vi.hoisted(() => ({
  readJson: vi.fn(),
  writeJson: vi.fn(),
  removeKey: vi.fn(),
  listKeys: vi.fn(),
}));
const telemetry = vi.hoisted(() => ({ track: vi.fn(), flushQueue: vi.fn() }));
vi.mock('../../../platform/storage', () => storage);
vi.mock('../../../platform/telemetry', () => telemetry);

import { clearPickerLabels, heldLabels, receiveRoster } from '../picker-labels';
import { consoleOrigins, type RosterContext } from '../roster-message';

const opener = { name: 'console tab' };
const DECK: Pick<LectureDeck, 'id' | 'picker'> = { id: 'lecture:abc123', picker: { mode: 'names', count: 2 } };
const ctx = (overrides: Partial<RosterContext> = {}): RosterContext => ({
  opener,
  allowedOrigins: consoleOrigins(),
  deck: DECK,
  ...overrides,
});
const event = (labels: string[] = ['Mina', 'Jun'], origin = 'https://hangulroute.com', source: unknown = opener) => ({
  origin,
  source,
  data: { ns: LECTURE_MESSAGE_NS, v: 1, type: 'roster', deckId: DECK.id, mode: 'names', labels },
});

const consoleSpies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) => vi.spyOn(console, m));

beforeEach(() => clearPickerLabels());
afterEach(() => vi.clearAllMocks());

describe('picker labels live in memory only (F-TCH-004 §3.2 step 4, §3.9)', () => {
  it('holds the labels of an accepted roster for that deck', () => {
    expect(receiveRoster(event(), ctx())).toBe(true);
    expect(heldLabels(DECK)).toEqual(['Mina', 'Jun']);
  });

  it('holds nothing until a roster arrives', () => {
    expect(heldLabels(DECK)).toBeNull();
  });

  it('ignores a rejected roster and keeps what it had', () => {
    receiveRoster(event(), ctx());
    expect(receiveRoster(event(['Eve', 'Mallory'], 'https://evil.example'), ctx())).toBe(false);
    expect(receiveRoster(event(['Eve', 'Mallory'], 'https://hangulroute.com', { other: true }), ctx())).toBe(false);
    expect(heldLabels(DECK)).toEqual(['Mina', 'Jun']);
  });

  it('a later roster for the same deck replaces the labels (the console re-sends after a reload)', () => {
    receiveRoster(event(), ctx());
    receiveRoster(event(['Ana', 'Léa']), ctx());
    expect(heldLabels(DECK)).toEqual(['Ana', 'Léa']);
  });

  it('gives the labels only to the deck and mode they came for', () => {
    receiveRoster(event(), ctx());
    expect(heldLabels({ id: 'lecture:zzz999', picker: { mode: 'names', count: 2 } })).toBeNull();
    expect(heldLabels({ id: DECK.id, picker: { mode: 'initials', count: 2 } })).toBeNull();
    expect(heldLabels({ id: DECK.id, picker: { mode: 'names', count: 3 } })).toBeNull();
    expect(heldLabels({ id: DECK.id, picker: null })).toBeNull();
  });

  it('clears on exit or navigation', () => {
    receiveRoster(event(), ctx());
    clearPickerLabels();
    expect(heldLabels(DECK)).toBeNull();
  });

  it('hands out a frozen copy, so a caller cannot change what is held', () => {
    receiveRoster(event(), ctx());
    const labels = heldLabels(DECK)!;
    expect(Object.isFrozen(labels)).toBe(true);
    expect(() => (labels as string[]).push('Eve')).toThrow();
    expect(heldLabels(DECK)).toEqual(['Mina', 'Jun']);
  });

  it('never touches storage, telemetry or the console while receiving, reading or clearing', () => {
    receiveRoster(event(), ctx());
    receiveRoster(event(['x'], 'https://evil.example'), ctx());
    heldLabels(DECK);
    clearPickerLabels();
    for (const spy of [...Object.values(storage), ...Object.values(telemetry), ...consoleSpies]) expect(spy).not.toHaveBeenCalled();
  });

  it('the two hand-off modules import no storage, store, telemetry or platform code at all', () => {
    for (const file of ['picker-labels.ts', 'roster-message.ts']) {
      const src = readFileSync(join(__dirname, '..', file), 'utf8');
      const specifiers = [...src.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]!);
      expect(specifiers.filter((s) => /platform|store|telemetry|storage|idb-keyval|async-storage/i.test(s))).toEqual([]);
      expect(src).not.toMatch(/console\.|localStorage|sessionStorage|indexedDB|document\.title|location\./);
    }
  });
});
