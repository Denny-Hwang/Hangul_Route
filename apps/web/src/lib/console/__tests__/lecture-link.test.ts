import { LECTURE_MESSAGE_NS, type LectureRosterMessage } from '@hangul-route/content-schema';
import { describe, expect, it, vi } from 'vitest';
import { answerReady, appOriginOf, openPresenter, type OpenedDeck } from '../lecture-link';

const APP = 'https://app.hangulroute.com';
const DECK = 'lecture:abc123def0';
const roster: LectureRosterMessage = { ns: LECTURE_MESSAGE_NS, v: 1, type: 'roster', deckId: DECK, mode: 'names', labels: ['Mina', 'Jun'] };

const presenterWindow = () => ({ postMessage: vi.fn() });
const ready = (deckId = DECK) => ({ ns: LECTURE_MESSAGE_NS, v: 1, type: 'ready', deckId });

const setup = (entry: OpenedDeck = { deckId: DECK, roster }) => {
  const win = presenterWindow();
  const opened = new Map<unknown, OpenedDeck>([[win, entry]]);
  return { win, ctx: { appOrigin: APP, opened } };
};

describe('roster hand-off, console side (F-TCH-004 §3.2 steps 1 and 3)', () => {
  it('answers ready from a window it opened, from the app origin, with the roster for that deck, to the exact app origin', () => {
    const { win, ctx } = setup();
    expect(answerReady({ origin: APP, source: win, data: ready() }, ctx)).toBe(true);
    expect(win.postMessage).toHaveBeenCalledTimes(1);
    expect(win.postMessage).toHaveBeenCalledWith(roster, APP);
    expect(win.postMessage.mock.calls[0]![1]).not.toBe('*');
  });

  it('answers again on a reload (every ready gets the labels while the tab is open)', () => {
    const { win, ctx } = setup();
    answerReady({ origin: APP, source: win, data: ready() }, ctx);
    answerReady({ origin: APP, source: win, data: ready() }, ctx);
    expect(win.postMessage).toHaveBeenCalledTimes(2);
  });

  it('ignores a message from another origin', () => {
    const { win, ctx } = setup();
    expect(answerReady({ origin: 'https://evil.example', source: win, data: ready() }, ctx)).toBe(false);
    expect(answerReady({ origin: 'http://app.hangulroute.com', source: win, data: ready() }, ctx)).toBe(false);
    expect(win.postMessage).not.toHaveBeenCalled();
  });

  it('ignores a window it did not open', () => {
    const { win, ctx } = setup();
    const stranger = presenterWindow();
    expect(answerReady({ origin: APP, source: stranger, data: ready() }, ctx)).toBe(false);
    expect(answerReady({ origin: APP, source: null, data: ready() }, ctx)).toBe(false);
    expect(stranger.postMessage).not.toHaveBeenCalled();
    expect(win.postMessage).not.toHaveBeenCalled();
  });

  it('answers only a valid ready message for the deck that window holds', () => {
    const { win, ctx } = setup();
    for (const data of [
      ready('lecture:other00000'),
      { ...ready(), type: 'roster' },
      { ...ready(), ns: 'someone.else' },
      { ...ready(), v: 2 },
      { ...ready(), extra: 'x' },
      'ready',
      null,
      roster,
    ]) {
      expect(answerReady({ origin: APP, source: win, data }, ctx)).toBe(false);
    }
    expect(win.postMessage).not.toHaveBeenCalled();
  });

  it('a numbers deck has no roster to send', () => {
    const { win, ctx } = setup({ deckId: DECK, roster: null });
    expect(answerReady({ origin: APP, source: win, data: ready() }, ctx)).toBe(false);
    expect(win.postMessage).not.toHaveBeenCalled();
  });

  it('a window that cannot receive a message is ignored', () => {
    const notAWindow = { name: 'tab' };
    const ctx = { appOrigin: APP, opened: new Map<unknown, OpenedDeck>([[notAWindow, { deckId: DECK, roster }]]) };
    expect(answerReady({ origin: APP, source: notAWindow, data: ready() }, ctx)).toBe(false);
  });

  it('the app origin comes from the app URL', () => {
    expect(appOriginOf('https://app.hangulroute.com')).toBe(APP);
    expect(appOriginOf('http://localhost:4173')).toBe('http://localhost:4173');
  });
});

describe('opening the presenter (F-TCH-004 §3.2 step 1)', () => {
  it('opens a new tab with window.open(url, "_blank") and no noopener, so the presenter keeps window.opener', () => {
    const tab = presenterWindow();
    const open = vi.fn(() => tab);
    expect(openPresenter({ open }, `${APP}/present#d=1.abc`)).toEqual({ ok: true, win: tab });
    expect(open).toHaveBeenCalledWith(`${APP}/present#d=1.abc`, '_blank');
    expect(open.mock.calls[0]).toHaveLength(2);
  });

  it('a blocked pop-up is reported, so the page can offer the link instead', () => {
    expect(openPresenter({ open: () => null }, `${APP}/present#d=1.abc`)).toEqual({ ok: false });
  });
});
