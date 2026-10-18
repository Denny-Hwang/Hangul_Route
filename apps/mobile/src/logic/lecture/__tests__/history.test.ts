import { describe, expect, it } from 'vitest';
import { HISTORY_KEYS, bootPlan, entryState, popPlan, pushPlan, readEntry, stepsToHome, type HistoryEntry, type PopContext } from '../history';
import { HOME_DEFAULT, type HomeSnapshot } from '../home-state';

/** F-TCH-004 section 3.5 "History and the way back" (rows LV-M1, LV-3): the pure plan. */

const yes = (): boolean => true;
const no = (): boolean => false;

describe('readEntry / entryState: one entry per phase with hrIndex', () => {
  it('reads the three steps with their index, fragment, fresh mark and home Back', () => {
    expect(readEntry({ hrPresenter: 'home', hrIndex: 0, hrHomeBack: true })).toEqual({ step: 'home', index: 0, homeBack: true });
    expect(readEntry({ hrPresenter: 'ready', hrIndex: 1, hrLectureFragment: '1.abc', hrLectureFresh: true })).toEqual({ step: 'ready', index: 1, fragment: '1.abc', fresh: true });
    expect(readEntry({ hrPresenter: 'running', hrIndex: 2, hrLectureFragment: '1.abc', hrLectureFresh: true })).toEqual({ step: 'running', index: 2, fragment: '1.abc' });
  });

  it('round-trips through entryState', () => {
    const entries: HistoryEntry[] = [
      { step: 'home', index: 0, homeBack: false },
      { step: 'home', index: 1 },
      { step: 'ready', index: 1, fragment: '1.x', fresh: true, homeBack: true },
      { step: 'running', index: 2, fragment: '1.x' },
    ];
    for (const entry of entries) expect(readEntry(entryState(entry))).toEqual(entry);
    expect(entryState({ step: 'home', index: 0, fragment: '1.x', fresh: true })).toEqual({ [HISTORY_KEYS.step]: 'home', [HISTORY_KEYS.index]: 0 });
  });

  it('holds nothing of the presenter: null', () => {
    for (const state of [null, undefined, 'x', 3, {}, { other: 1 }]) expect(readEntry(state)).toBeNull();
  });

  it('an entry from a build before this plan (a fragment only) is a ready entry at index 0, a link', () => {
    expect(readEntry({ hrLectureFragment: '1.old', hrLectureFresh: true })).toEqual({ step: 'ready', index: 0, fragment: '1.old', fresh: true });
  });

  it('a home Back kept alone reads as the home', () => {
    expect(readEntry({ hrHomeBack: false })).toEqual({ step: 'home', index: 0, homeBack: false });
  });

  it('a deck step may hold no deck; an unusable index takes the step default', () => {
    expect(readEntry({ hrPresenter: 'ready', hrIndex: 1 })).toEqual({ step: 'ready', index: 1 });
    expect(readEntry({ hrPresenter: 'running', hrIndex: 'x', hrLectureFragment: '1.a' })).toEqual({ step: 'running', index: 2, fragment: '1.a' });
    expect(readEntry({ hrPresenter: 'ready', hrIndex: 7, hrLectureFragment: '1.a' })).toEqual({ step: 'ready', index: 1, fragment: '1.a' });
    expect(readEntry({ hrPresenter: 'ready', hrIndex: 1.5, hrLectureFragment: '1.a' })).toEqual({ step: 'ready', index: 1, fragment: '1.a' });
    expect(readEntry({ hrPresenter: 'nope', hrLectureFragment: '1.a', hrIndex: -1 })).toEqual({ step: 'ready', index: 0, fragment: '1.a' });
    expect(readEntry({ hrPresenter: 'home', hrHomeBack: 'yes' })).toEqual({ step: 'home', index: 0 });
  });
});

describe('bootPlan (rules 1, 5 and 6)', () => {
  it('/present with no deck: the entry is the home, with the home Back the tab history gives', () => {
    expect(bootPlan({ link: null, entry: null, accepts: yes, homeBack: true })).toEqual({ replace: { step: 'home', index: 0, homeBack: true }, push: null, back: false, deck: null });
  });

  it('a deck link opened in a new tab gets a home entry under its start entry', () => {
    expect(bootPlan({ link: '1.deck', entry: null, accepts: yes, homeBack: false })).toEqual({
      replace: { step: 'home', index: 0, homeBack: false },
      push: { step: 'ready', index: 1, fragment: '1.deck', homeBack: false },
      back: false,
      deck: { raw: '1.deck', reloaded: false },
    });
  });

  it('an invalid link replaces its entry with the home and pushes nothing (rule 6)', () => {
    expect(bootPlan({ link: '1.bad', entry: null, accepts: no, homeBack: false })).toEqual({
      replace: { step: 'home', index: 0, homeBack: false },
      push: null,
      back: false,
      deck: { raw: '1.bad', reloaded: false },
    });
  });

  it('a reload on the start screen reopens it, keeping the home Back the entry holds', () => {
    const entry: HistoryEntry = { step: 'ready', index: 1, fragment: '1.deck', fresh: true, homeBack: true };
    expect(bootPlan({ link: null, entry, accepts: yes, homeBack: false })).toEqual({ replace: entry, push: null, back: false, deck: { raw: '1.deck', reloaded: true, fresh: true } });
    expect(bootPlan({ link: null, entry: { step: 'ready', index: 1, fragment: '1.deck' }, accepts: yes, homeBack: false }).deck).toEqual({ raw: '1.deck', reloaded: true });
  });

  it('a reload in the lesson steps back to its ready entry instead of rewriting it, so the entries never become [home, ready, ready]', () => {
    expect(bootPlan({ link: null, entry: { step: 'running', index: 2, fragment: '1.deck' }, accepts: yes, homeBack: false })).toEqual({
      replace: null,
      push: null,
      back: true,
      deck: { raw: '1.deck', reloaded: true },
    });
  });

  it('the stale-presenter Reload (holdOpenDeck: a ready entry at index 0) opens as a link on the next boot', () => {
    const plan = bootPlan({ link: null, entry: { step: 'ready', index: 0, fragment: '2.new' }, accepts: yes, homeBack: true });
    expect(plan.replace).toEqual({ step: 'home', index: 0, homeBack: true });
    expect(plan.push).toEqual({ step: 'ready', index: 1, fragment: '2.new', homeBack: true });
    expect(plan.deck).toEqual({ raw: '2.new', reloaded: true });
    // Still unreadable: the invalid page, nothing pushed.
    expect(bootPlan({ link: null, entry: { step: 'ready', index: 0, fragment: '2.new', fresh: true }, accepts: no, homeBack: true })).toMatchObject({ push: null, deck: { fresh: true } });
    expect(bootPlan({ link: null, entry: { step: 'ready', index: 0, fragment: '1.f', fresh: true }, accepts: yes, homeBack: true }).push).toMatchObject({ fresh: true });
  });

  it('a reload on a deck step that holds no deck (too long for a link) opens the home, stepping back to it', () => {
    expect(bootPlan({ link: null, entry: { step: 'running', index: 2 }, accepts: yes, homeBack: false })).toEqual({ replace: { step: 'home', index: 2, homeBack: false }, push: null, back: true, deck: null });
  });

  it('a reload on the home placeholder steps back to the home', () => {
    expect(bootPlan({ link: null, entry: { step: 'home', index: 1 }, accepts: yes, homeBack: true })).toEqual({ replace: { step: 'home', index: 1, homeBack: true }, push: null, back: true, deck: null });
    expect(bootPlan({ link: null, entry: { step: 'home', index: 0, homeBack: false }, accepts: yes, homeBack: true }).replace).toEqual({ step: 'home', index: 0, homeBack: false });
  });

  it('a link wins over a deck the entry already holds', () => {
    expect(bootPlan({ link: '1.new', entry: { step: 'ready', index: 1, fragment: '1.old', homeBack: true }, accepts: yes, homeBack: false }).push).toEqual({ step: 'ready', index: 1, fragment: '1.new', homeBack: true });
  });
});

describe('pushPlan (rule 2)', () => {
  it('the home pushes ready; Start pushes running above it', () => {
    expect(pushPlan({ step: 'home', index: 0, homeBack: true }, 'ready', { fragment: '1.d', fresh: true })).toEqual({ mode: 'push', entry: { step: 'ready', index: 1, fragment: '1.d', fresh: true, homeBack: true } });
    expect(pushPlan({ step: 'ready', index: 1, fragment: '1.d', fresh: true }, 'running', { fragment: '1.d', fresh: true })).toEqual({ mode: 'push', entry: { step: 'running', index: 2, fragment: '1.d' } });
    expect(pushPlan(null, 'ready', { fragment: '1.d' })).toEqual({ mode: 'push', entry: { step: 'ready', index: 1, fragment: '1.d' } });
  });

  it('a tab already on that step writes over its entry (a reload, Keep going after a Forward)', () => {
    expect(pushPlan({ step: 'ready', index: 1, fragment: '1.a' }, 'ready', { fragment: '1.b' }).mode).toBe('replace');
    expect(pushPlan({ step: 'running', index: 2, fragment: '1.a' }, 'running', { fragment: '1.a' })).toEqual({ mode: 'replace', entry: { step: 'running', index: 2, fragment: '1.a' } });
    expect(pushPlan({ step: 'home', index: 1 }, 'ready', { fragment: '1.a', homeBack: false }).mode).toBe('replace');
    expect(pushPlan({ step: 'home', index: 0 }, 'running', { fragment: '1.a' })).toEqual({ mode: 'push', entry: { step: 'running', index: 2, fragment: '1.a' } });
  });
});

describe('popPlan (rules 3, 4 and 7)', () => {
  const ctx = (over: Partial<PopContext>): PopContext => ({ phase: 'running', begun: true, overlay: 'none', ...over });
  const ready: HistoryEntry = { step: 'ready', index: 1, fragment: '1.d' };
  const running: HistoryEntry = { step: 'running', index: 2, fragment: '1.d' };
  const home: HistoryEntry = { step: 'home', index: 0 };

  it('from a running lesson: the Exit confirm, or with a covering overlay open, that overlay closes', () => {
    expect(popPlan(ready, ctx({}))).toEqual({ kind: 'confirm' });
    expect(popPlan(ready, ctx({ overlay: 'covering' }))).toEqual({ kind: 'close-overlay' });
    expect(popPlan(ready, ctx({ overlay: 'exit' }))).toEqual({ kind: 'confirm' });
  });

  it('a pop that lands on the home while the lesson runs or the confirm is open runs Exit', () => {
    expect(popPlan(home, ctx({ overlay: 'exit' }))).toEqual({ kind: 'exit' });
    expect(popPlan(null, ctx({}))).toEqual({ kind: 'exit' });
    expect(popPlan(home, ctx({ begun: false }))).toEqual({ kind: 'exit' });
  });

  it('a lesson not yet begun (the rotate page before the first slide) steps back to its start screen', () => {
    expect(popPlan(ready, ctx({ begun: false }))).toEqual({ kind: 'ready' });
  });

  it('a Forward back onto the lesson entry resumes it', () => {
    expect(popPlan(running, ctx({ overlay: 'exit' }))).toEqual({ kind: 'resume' });
  });

  it('from the start screen: the home; a Forward onto a lesson left behind steps back', () => {
    expect(popPlan(home, ctx({ phase: 'ready' }))).toEqual({ kind: 'home' });
    expect(popPlan(running, ctx({ phase: 'ready' }))).toEqual({ kind: 'step-back' });
    expect(popPlan(ready, ctx({ phase: 'ready' }))).toEqual({ kind: 'none' });
  });

  it('on the home: a Forward onto the placeholder or a deck entry steps back again, so a Forward finds no deck', () => {
    expect(popPlan({ step: 'home', index: 1 }, ctx({ phase: 'home' }))).toEqual({ kind: 'step-back' });
    expect(popPlan(ready, ctx({ phase: 'home' }))).toEqual({ kind: 'step-back' });
    expect(popPlan(home, ctx({ phase: 'home' }))).toEqual({ kind: 'none' });
  });

  it('the boot, invalid and loading pages take no pop', () => {
    expect(popPlan(ready, ctx({ phase: 'invalid' }))).toEqual({ kind: 'none' });
    expect(popPlan(home, ctx({ phase: 'boot' }))).toEqual({ kind: 'none' });
  });
});

describe('rule 9: the home keeps its state, a ready-made lesson keeps its preset (AMENDMENTS-LECTURE-V2 sections 11 and 18.2, LV-3)', () => {
  const snapshot: HomeSnapshot = { ...HOME_DEFAULT, open: 'story-time', lengths: { 'story-time': 30 }, customize: true, tab: 'stories', chosen: ['story:hangeul-day'], scrollY: 840 };

  it('reads and writes the home state on the home entry only, and the preset on the ready entry only', () => {
    const home: HistoryEntry = { step: 'home', index: 0, homeBack: true, home: snapshot };
    expect(readEntry(entryState(home))).toEqual(home);
    const ready: HistoryEntry = { step: 'ready', index: 1, fragment: '1.x', preset: 'hangul-week-1' };
    expect(readEntry(entryState(ready))).toEqual(ready);
    expect(entryState({ step: 'running', index: 2, fragment: '1.x', preset: 'hangul-week-1', home: snapshot })).toEqual({
      [HISTORY_KEYS.step]: 'running',
      [HISTORY_KEYS.index]: 2,
      [HISTORY_KEYS.fragment]: '1.x',
    });
    expect(readEntry({ hrPresenter: 'ready', hrIndex: 1, hrLecturePreset: 'not-a-preset' })).toEqual({ step: 'ready', index: 1 });
    expect(readEntry({ hrPresenter: 'ready', hrIndex: 1, hrHome: snapshot })).toEqual({ step: 'ready', index: 1 });
  });

  it('a damaged home state reads field by field: a name or a bad value never comes back', () => {
    const read = readEntry({ hrPresenter: 'home', hrIndex: 0, hrHome: { open: 'Minho', chosen: ['Minho', 'quest:stage1-letters-q1'], scrollY: -4, tab: 'names' } });
    expect(read?.home).toEqual({ ...HOME_DEFAULT, chosen: ['quest:stage1-letters-q1'] });
    expect(readEntry({ hrPresenter: 'home', hrIndex: 0, hrHome: 'garbage' })).toEqual({ step: 'home', index: 0 });
  });

  it('a reload on the home keeps its state; a link replaces the home entry with none', () => {
    const entry: HistoryEntry = { step: 'home', index: 0, homeBack: false, home: snapshot };
    expect(bootPlan({ link: null, entry, accepts: yes, homeBack: true }).replace).toEqual(entry);
    expect(bootPlan({ link: '1.abc', entry, accepts: yes, homeBack: true }).replace).toEqual({ step: 'home', index: 0, homeBack: false });
  });

  it('a reload on the start screen of a ready-made lesson keeps its preset for boot', () => {
    const plan = bootPlan({ link: null, entry: { step: 'ready', index: 1, fragment: '1.abc', preset: 'warm-up' }, accepts: yes, homeBack: false });
    expect(plan.deck).toEqual({ raw: '1.abc', reloaded: true, preset: 'warm-up' });
    // A link never carries a preset from the address.
    expect(bootPlan({ link: '1.abc', entry: { step: 'ready', index: 1, fragment: '1.x', preset: 'warm-up' }, accepts: yes, homeBack: false }).deck).toEqual({ raw: '1.abc', reloaded: false });
  });

  it('pushes the preset with the start screen, never with the lesson, and never the home state', () => {
    expect(pushPlan({ step: 'home', index: 0, home: snapshot }, 'ready', { fragment: '1.x', preset: 'by-stage' }).entry).toEqual({ step: 'ready', index: 1, fragment: '1.x', preset: 'by-stage' });
    expect(pushPlan({ step: 'ready', index: 1, fragment: '1.x', preset: 'by-stage' }, 'running', { fragment: '1.x', preset: 'by-stage' }).entry).toEqual({ step: 'running', index: 2, fragment: '1.x' });
  });
});

describe('stepsToHome (Exit: history.go(-hrIndex))', () => {
  it('is the entry index, 0 on the home or with no entry', () => {
    expect(stepsToHome({ step: 'running', index: 2, fragment: '1.d' })).toBe(2);
    expect(stepsToHome({ step: 'ready', index: 1, fragment: '1.d' })).toBe(1);
    expect(stepsToHome({ step: 'home', index: 0 })).toBe(0);
    expect(stepsToHome(null)).toBe(0);
  });
});
