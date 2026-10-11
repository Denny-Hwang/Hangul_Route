import { LECTURE_CONSOLE_ORIGINS, LECTURE_MESSAGE_NS, type LectureDeck } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { acceptRoster, consoleOrigins, readyMessage, readyTargets, wantsRoster, type RosterContext } from '../roster-message';

const opener = { name: 'console tab' };
const stranger = { name: 'another window' };
const CONSOLE = 'https://hangulroute.com';

type DeckPick = Pick<LectureDeck, 'id' | 'picker'>;
const deck = (picker: LectureDeck['picker'], id = 'lecture:abc123'): DeckPick => ({ id, picker });
const NAMES_DECK = deck({ mode: 'names', count: 2 });

const roster = (overrides: Record<string, unknown> = {}) => ({
  ns: LECTURE_MESSAGE_NS,
  v: 1,
  type: 'roster',
  deckId: 'lecture:abc123',
  mode: 'names',
  labels: ['Mina', '하늘'],
  ...overrides,
});

const ctx = (overrides: Partial<RosterContext> = {}): RosterContext => ({
  opener,
  allowedOrigins: consoleOrigins(),
  deck: NAMES_DECK,
  ...overrides,
});

describe('consoleOrigins (F-TCH-004 §3.2 step 2)', () => {
  it('is the shared list from the schema package by default', () => {
    expect(consoleOrigins()).toEqual([...LECTURE_CONSOLE_ORIGINS]);
    expect(consoleOrigins(undefined)).toEqual([...LECTURE_CONSOLE_ORIGINS]);
    expect(consoleOrigins('')).toEqual([...LECTURE_CONSOLE_ORIGINS]);
  });

  it('adds the build-time preview origins (comma list), trimmed and without duplicates', () => {
    expect(consoleOrigins(' https://pr-12.hangul-route-web.pages.dev , https://hangulroute.com,http://localhost:3001')).toEqual([
      ...LECTURE_CONSOLE_ORIGINS,
      'https://pr-12.hangul-route-web.pages.dev',
      'http://localhost:3001',
    ]);
  });

  it('drops anything that is not a bare https origin (or http on localhost)', () => {
    expect(
      consoleOrigins('*,null,http://evil.example,https://ok.example/path,https://ok.example?q=1,ftp://x.example,not a url,https://user:pw@ok.example,https://good.example'),
    ).toEqual([...LECTURE_CONSOLE_ORIGINS, 'https://good.example']);
    expect(consoleOrigins('http://127.0.0.1:3000')).toContain('http://127.0.0.1:3000');
  });
});

describe('ready announcement', () => {
  it('wants a roster only for names or initials', () => {
    expect(wantsRoster(deck({ mode: 'names', count: 3 }))).toBe(true);
    expect(wantsRoster(deck({ mode: 'initials', count: 3 }))).toBe(true);
    expect(wantsRoster(deck({ mode: 'numbers', count: 3 }))).toBe(false);
    expect(wantsRoster(deck(null))).toBe(false);
  });

  it('builds a ready message that carries only the deck id', () => {
    expect(readyMessage('lecture:abc123')).toEqual({ ns: LECTURE_MESSAGE_NS, v: 1, type: 'ready', deckId: 'lecture:abc123' });
  });

  it('announces once per allowed origin, only with an opener and a names / initials deck', () => {
    const origins = consoleOrigins();
    expect(readyTargets(NAMES_DECK, opener, origins)).toEqual([...origins]);
    expect(readyTargets(NAMES_DECK, null, origins)).toEqual([]);
    expect(readyTargets(NAMES_DECK, undefined, origins)).toEqual([]);
    expect(readyTargets(deck({ mode: 'numbers', count: 5 }), opener, origins)).toEqual([]);
    expect(readyTargets(deck(null), opener, origins)).toEqual([]);
  });

  it('never targets "*"', () => {
    expect(readyTargets(NAMES_DECK, opener, consoleOrigins('*'))).not.toContain('*');
  });
});

describe('acceptRoster (F-TCH-004 §3.2 step 4)', () => {
  it('accepts a roster from the opener, from an allowed origin, for this deck, mode and count', () => {
    expect(acceptRoster({ origin: CONSOLE, source: opener, data: roster() }, ctx())).toEqual({
      mode: 'names',
      labels: ['Mina', '하늘'],
    });
    expect(
      acceptRoster(
        { origin: 'http://localhost:3000', source: opener, data: roster({ mode: 'initials', labels: ['M. K.', 'J.'] }) },
        ctx({ deck: deck({ mode: 'initials', count: 2 }) }),
      ),
    ).toEqual({ mode: 'initials', labels: ['M. K.', 'J.'] });
  });

  it('trims labels the schema accepts', () => {
    expect(acceptRoster({ origin: CONSOLE, source: opener, data: roster({ labels: [' Mina ', 'Léa'] }) }, ctx())?.labels).toEqual([
      'Mina',
      'Léa',
    ]);
  });

  const REJECTED: Array<[string, Parameters<typeof acceptRoster>[0], RosterContext]> = [
    ['a window that is not the opener', { origin: CONSOLE, source: stranger, data: roster() }, ctx()],
    ['no opener at all (a copied link)', { origin: CONSOLE, source: opener, data: roster() }, ctx({ opener: null })],
    ['a null source', { origin: CONSOLE, source: null, data: roster() }, ctx()],
    ['another origin', { origin: 'https://evil.example', source: opener, data: roster() }, ctx()],
    ['the app origin itself', { origin: 'https://app.hangulroute.com', source: opener, data: roster() }, ctx()],
    ['a different deck', { origin: CONSOLE, source: opener, data: roster({ deckId: 'lecture:zzz999' }) }, ctx()],
    ['a different mode', { origin: CONSOLE, source: opener, data: roster({ mode: 'initials' }) }, ctx()],
    ['a different count', { origin: CONSOLE, source: opener, data: roster({ labels: ['Mina'] }) }, ctx()],
    ['a numbers deck', { origin: CONSOLE, source: opener, data: roster() }, ctx({ deck: deck({ mode: 'numbers', count: 2 }) })],
    ['a deck with no picker', { origin: CONSOLE, source: opener, data: roster() }, ctx({ deck: deck(null) })],
    ['the wrong namespace', { origin: CONSOLE, source: opener, data: roster({ ns: 'other' }) }, ctx()],
    ['the wrong version', { origin: CONSOLE, source: opener, data: roster({ v: 2 }) }, ctx()],
    ['a ready message', { origin: CONSOLE, source: opener, data: { ns: LECTURE_MESSAGE_NS, v: 1, type: 'ready', deckId: 'lecture:abc123' } }, ctx()],
    ['an extra key', { origin: CONSOLE, source: opener, data: roster({ ages: [7, 8] }) }, ctx()],
    ['a label in another script', { origin: CONSOLE, source: opener, data: roster({ labels: ['Mina', 'Мина'] }) }, ctx()],
    ['a 21-character label', { origin: CONSOLE, source: opener, data: roster({ labels: ['Mina', 'A'.repeat(21)] }) }, ctx()],
    ['a string payload', { origin: CONSOLE, source: opener, data: JSON.stringify(roster()) }, ctx()],
    ['no payload', { origin: CONSOLE, source: opener, data: undefined }, ctx()],
  ];

  it.each(REJECTED)('ignores %s silently', (_why, event, context) => {
    expect(acceptRoster(event, context)).toBeNull();
  });

  it('61 labels can never match (the schema caps a roster at 60)', () => {
    const labels = Array.from({ length: 61 }, (_, i) => `L${i}`);
    expect(
      acceptRoster({ origin: CONSOLE, source: opener, data: roster({ labels }) }, ctx({ deck: deck({ mode: 'names', count: 60 }) })),
    ).toBeNull();
  });
});
