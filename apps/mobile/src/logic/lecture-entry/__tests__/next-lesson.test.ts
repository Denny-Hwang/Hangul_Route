import { CATALOG, LectureDeckSchema, decodeDeck, resolvePreset, routeCatalogOf, type LectureDeck } from '@hangul-route/content-schema';
import { LOCALES, getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { lectureBundle } from '../../lecture/content';
import { expandDeck } from '../../lecture/deck-builder';
import { presenterPresetContext } from '../../lecture/preset-source';
import { emptyRecent } from '../../lecture/recent';
import { resolveBoot } from '../../lecture/shell';
import type { RouteNext } from '../../route-next';
import { RECENT_FINISHED_DAYS, appPresetContext, nextLessonDeck, nextLessonHref, recentFinishedQuestIds } from '../next-lesson';

/**
 * AMENDMENTS-LECTURE-V2 row LV-6 (sections 3 E5, 4.2 N3 and W3, 4.3, 7 item 4, 8, 11): the learner app's side of
 * the grown-up card's "Next lesson for {name}". The context holds the learner's place (N3, from `routeNext`) and the
 * quests finished in the last 7 days (W3), ids only; the deck is Next lesson at its default length, a v1 `quick`
 * deck titled in the UI language, and its link is the same-origin `/present#d=…`.
 */

const NOW = new Date('2026-10-17T12:00:00.000Z');
const daysAgo = (n: number): string => new Date(NOW.getTime() - n * 86_400_000).toISOString();
const ROUTE = routeCatalogOf(CATALOG).quests.filter((q) => q.grid && q.playable);
const words = getMessages('en').learner.presenter.presets;

const quest = (questId: string, next: Partial<Extract<RouteNext, { kind: 'quest' }>> = {}): RouteNext => ({
  kind: 'quest',
  questId,
  episodeId: 'episode:x',
  stage: 'stage1',
  source: 'cursor',
  sourceId: null,
  ...next,
});

const done = (questId: string, completedAt: string | undefined = daysAgo(1)) => ({ questId, completedAt });

/** A fixed generator: the same deck id and seed every time. */
const rng = (): number => 0.5;

const hrefDeck = (href: string): LectureDeck => {
  expect(href.startsWith('/present#d=')).toBe(true);
  const decoded = decodeDeck(href.slice('/present#d='.length));
  if (!decoded.ok) throw new Error(`the link does not decode: ${decoded.reason}`);
  return decoded.deck;
};

describe('recentFinishedQuestIds (W3)', () => {
  it('keeps the quests finished in the last 7 days, newest first, each once, at most 12', () => {
    const quests = [
      done('quest:stage1-letters-q1', daysAgo(6.9)),
      done('quest:stage1-letters-q2', daysAgo(0.5)),
      done('quest:stage1-letters-q3', daysAgo(2)),
      done('quest:stage1-life-q1', daysAgo(7.1)),
      done('quest:stage1-letters-q2', daysAgo(3)),
    ];
    expect(recentFinishedQuestIds(quests, NOW)).toEqual(['quest:stage1-letters-q2', 'quest:stage1-letters-q3', 'quest:stage1-letters-q1']);
    expect(RECENT_FINISHED_DAYS).toBe(7);
    const many = ROUTE.slice(0, 20).map((q, i) => done(q.id, daysAgo(i * 0.1)));
    expect(recentFinishedQuestIds(many, NOW)).toEqual(ROUTE.slice(0, 12).map((q) => q.id));
  });

  it('leaves out quests not finished, with an unreadable date, ahead of the clock by more than a day, or not in the catalogue', () => {
    const quests = [
      { questId: 'quest:stage1-letters-q1' },
      done('quest:stage1-letters-q2', 'not a date'),
      done('quest:stage1-letters-q3', daysAgo(-2)),
      done('quest:fixture-only', daysAgo(1)),
      done('quest:stage1-life-q1', daysAgo(-0.5)),
    ];
    expect(recentFinishedQuestIds(quests, NOW)).toEqual(['quest:stage1-life-q1']);
    expect(recentFinishedQuestIds([], NOW)).toEqual([]);
  });
});

describe('appPresetContext (sections 4.2 N3 and 4.3)', () => {
  it('holds the routeNext quest as the place when it is a route quest, the recent words, and nothing else', () => {
    const at = ROUTE[4]!.id;
    const ctx = appPresetContext({ next: quest(at), quests: [done(ROUTE[0]!.id)], now: NOW });
    expect(ctx).toEqual({ catalog: CATALOG, position: { questId: at }, recentWords: { questIds: [ROUTE[0]!.id], vocabIds: [] } });
    // No field that could carry a name: the keys are the catalogue, the place and the ids.
    expect(Object.keys(ctx).sort()).toEqual(['catalog', 'position', 'recentWords']);
  });

  it('a homework or plan quest off the route starts after the furthest finished route quest (the first with none)', () => {
    const off = 'quest:not-on-the-route';
    expect(appPresetContext({ next: quest(off, { source: 'class', assignmentId: 'a1' }), quests: [done(ROUTE[2]!.id, daysAgo(30)), done(ROUTE[0]!.id)], now: NOW }).position).toEqual({ questId: ROUTE[3]!.id });
    expect(appPresetContext({ next: quest(off), quests: [], now: NOW }).position).toEqual({ questId: ROUTE[0]!.id });
    // A started but unfinished quest is not done.
    expect(appPresetContext({ next: quest(off), quests: [{ questId: ROUTE[5]!.id }], now: NOW }).position).toEqual({ questId: ROUTE[0]!.id });
  });

  it('free-end, rest and an unknown next give no place, so Next lesson falls back to Hangul week 1', () => {
    for (const next of [{ kind: 'free-end', placedOut: false } as const, { kind: 'rest' } as const, null]) {
      const ctx = appPresetContext({ next, quests: [done(ROUTE[3]!.id)], now: NOW });
      expect(ctx.position, JSON.stringify(next)).toBeNull();
      expect(resolvePreset('next-lesson', 20, ctx).fallback).toBe('zero');
    }
  });

  it('gives the same blocks as the presenter for the same place (parity, section 4.3)', () => {
    const at = ROUTE[7]!.id;
    const app = resolvePreset('next-lesson', 20, appPresetContext({ next: quest(at), quests: [], now: NOW }));
    const presenter = resolvePreset('next-lesson', 20, { ...presenterPresetContext(null, NOW), position: { questId: at } });
    expect(app.blocks).toEqual(presenter.blocks);
    expect(app.blocks[0]).toEqual({ kind: 'quest', id: at });
  });
});

describe('nextLessonDeck and nextLessonHref (sections 4.2, LV-D6, 8, 11)', () => {
  it('is Next lesson at 20 minutes from the place: a v1 quick deck with no picker, no preset id and no slides language', () => {
    const at = ROUTE[1]!.id;
    const ctx = appPresetContext({ next: quest(at), quests: [], now: NOW });
    const deck = nextLessonDeck(ctx, words, { now: NOW, rng }) as LectureDeck;
    expect(LectureDeckSchema.parse(deck)).toEqual(deck);
    expect(deck).toMatchObject({ v: 1, title: words.next.title, source: 'quick', picker: null, createdAt: NOW.toISOString(), seed: NOW.getTime() % 2 ** 31 });
    expect(deck).not.toHaveProperty('preset');
    expect(deck.options.uiLocale).toBeUndefined();
    expect(deck.blocks).toEqual(resolvePreset('next-lesson', 20, ctx).blocks);
    expect(deck.blocks.some((b) => b.kind === 'class-code' || b.kind === 'word-review')).toBe(false);
    expect(deck.id).toMatch(/^lecture:[a-z0-9]{10}$/);
  });

  it('titles the fallback deck with the Hangul week 1 name, in each UI language', () => {
    for (const locale of LOCALES) {
      const w = getMessages(locale).learner.presenter.presets;
      const deck = nextLessonDeck(appPresetContext({ next: { kind: 'rest' }, quests: [], now: NOW }), w, { now: NOW, rng }) as LectureDeck;
      expect(deck.title, locale).toBe(w.zero.short);
      const next = nextLessonDeck(appPresetContext({ next: quest(ROUTE[0]!.id), quests: [], now: NOW }), w, { now: NOW, rng }) as LectureDeck;
      expect(next.title, locale).toBe(w.next.title);
    }
  });

  it('links to the same-origin presenter with the deck in the fragment only, and the presenter starts it as quick', () => {
    const ctx = appPresetContext({ next: quest(ROUTE[2]!.id), quests: [done(ROUTE[1]!.id)], now: NOW });
    const href = nextLessonHref(ctx, words, { now: NOW, rng }) as string;
    expect(href).toMatch(/^\/present#d=[A-Za-z0-9_.-]+$/);
    const deck = hrefDeck(href);
    expect(deck).toEqual(nextLessonDeck(ctx, words, { now: NOW, rng }));
    // Every block expands on the shipped bundle, and the start counts as `quick` (section 11), never as a preset.
    expect(expandDeck(deck, lectureBundle('en'), { canPlayKorean: true }).slides.length).toBeGreaterThan(0);
    expect(resolveBoot({ raw: href.slice('/present'.length), reloaded: false }, emptyRecent())).toEqual({ kind: 'deck', deck, source: 'quick' });
  });

  it('gives a fresh deck id per press from the generator', () => {
    const ctx = appPresetContext({ next: quest(ROUTE[0]!.id), quests: [], now: NOW });
    let i = 0;
    const steps = (): number => ((i += 1) % 36) / 36;
    const a = nextLessonDeck(ctx, words, { now: NOW, rng: steps }) as LectureDeck;
    const b = nextLessonDeck(ctx, words, { now: NOW, rng: steps }) as LectureDeck;
    expect(a.id).not.toBe(b.id);
  });

  it('is null when the title does not pass the deck schema (it always does with the shipped words)', () => {
    const ctx = appPresetContext({ next: quest(ROUTE[0]!.id), quests: [], now: NOW });
    const broken = { ...words, next: { ...words.next, title: '' } };
    expect(nextLessonDeck(ctx, broken, { now: NOW, rng })).toBeNull();
    expect(nextLessonHref(ctx, broken, { now: NOW, rng })).toBeNull();
  });
});
