import type { HeritageCard } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { awardWorld } from '../../../content/award-world';
import { obtainableCards } from '../../awards/obtainable';
import { parseUnlockedBy } from '../../awards/rules';
import { libraryShelves } from '../shelves';

/**
 * The Library's two shelves (owner request 2026-10-16, item 8): Your cards first, then Cards to find grouped by
 * what earns them, with one Next card hint. On the shipped award world, in every UI language.
 */

const EN = getMessages('en').learner;

describe('libraryShelves on the shipped cards', () => {
  const listed = obtainableCards(awardWorld, new Set());
  const welcome = listed.find((c) => parseUnlockedBy(c.unlockedBy).kind === 'welcome') as HeritageCard;
  const firstEpisodeCard = listed.find((c) => parseUnlockedBy(c.unlockedBy).kind === 'episode') as HeritageCard;

  it('a learner with one card: it is the first shelf; every other card is in a group of the second', () => {
    const owned = new Set([welcome.id]);
    const shelves = libraryShelves(listed, owned, awardWorld, EN);
    expect(shelves.yours.map((c) => c.id)).toEqual([welcome.id]);
    const grouped = shelves.toFind.flatMap((g) => g.cardIds);
    expect(grouped.sort()).toEqual(listed.filter((c) => c.id !== welcome.id).map((c) => c.id).sort());
    expect(new Set(grouped).size).toBe(grouped.length);
  });

  it('groups by what earns the card: one row per episode, titled with the episode', () => {
    const shelves = libraryShelves(listed, new Set([welcome.id]), awardWorld, EN);
    const rule = parseUnlockedBy(firstEpisodeCard.unlockedBy) as { kind: 'episode'; episodeId: string };
    const group = shelves.toFind.find((g) => g.key === `episode:${rule.episodeId}`);
    expect(group?.title).toBe(awardWorld.episodes.find((e) => e.id === rule.episodeId)?.titleEn);
    expect(group?.cardIds).toContain(firstEpisodeCard.id);
    // Every card in a group is earned the same way.
    for (const g of shelves.toFind) {
      const keys = new Set(g.cardIds.map((id) => JSON.stringify(parseUnlockedBy(listed.find((c) => c.id === id)?.unlockedBy ?? ''))));
      expect(keys.size, g.key).toBe(1);
    }
  });

  it('one Next card hint for the shelf: the first card to find, with how to earn it, never how far along', () => {
    const shelves = libraryShelves(listed, new Set([welcome.id]), awardWorld, EN);
    const first = listed.find((c) => c.id !== welcome.id) as HeritageCard;
    expect(shelves.next?.cardId).toBe(first.id);
    expect(shelves.next?.hint).toMatch(/^Finish|^Collect|^A welcome/);
    expect(shelves.next?.hint).not.toMatch(/\d+\s*(of|\/)\s*\d+|%|left|remaining/i);
  });

  it('nothing to find: no groups and no Next card; nothing held: an empty first shelf', () => {
    const all = new Set(listed.map((c) => c.id));
    expect(libraryShelves(listed, all, awardWorld, EN)).toMatchObject({ toFind: [], next: null });
    expect(libraryShelves(listed, new Set(), awardWorld, EN).yours).toEqual([]);
  });

  it.each(['es', 'ko'] as const)('%s: stage and set rows are titled in that language', (locale) => {
    const m = getMessages(locale).learner;
    const shelves = libraryShelves(listed, new Set(), awardWorld, m);
    const stage = shelves.toFind.find((g) => g.key.startsWith('stage:'));
    if (stage) expect(stage.title).toBe(m.library.toFind.stage(Number(stage.key.slice('stage:'.length))));
    expect(shelves.toFind.every((g) => g.title.trim() !== '')).toBe(true);
  });

  it('a card with a rule no one can explain sits under More cards, never a lock', () => {
    const odd = { ...firstEpisodeCard, id: 'card:odd', unlockedBy: 'mystery:x' } as HeritageCard;
    const shelves = libraryShelves([odd], new Set(), awardWorld, EN);
    expect(shelves.toFind).toEqual([{ key: 'other', title: 'More cards', cardIds: ['card:odd'] }]);
    expect(shelves.next?.hint).toBe(EN.cardDetail.earn.later);
  });
});
