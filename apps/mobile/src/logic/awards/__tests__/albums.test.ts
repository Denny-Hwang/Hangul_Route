import type { HeritageCard } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { heritageCardsAll } from '../../../content/heritage-cards';
import { ALBUM_STAGES, ALBUM_THEMES, UPPER_CELL_CARDS } from '../../../content/upper-cell-cards';
import { albumSetId, albumSets, albumViews } from '../albums';
import { derivedAwards } from '../derive';
import type { AwardWorld } from '../types';

/** The five category albums (F-CURR-002 §7.2, row CM-23): progress that only fills, and the legendary hook for CM-23c. */
const views = (owned: Iterable<string>) => albumViews(UPPER_CELL_CARDS, heritageCardsAll, new Set(owned), ALBUM_THEMES, ALBUM_STAGES);

describe('albumViews', () => {
  it('five albums in theme order, one slot per album stage; Stages 2-3 hold this row’s cards, the rest wait for parts 2 and 3', () => {
    const albums = views([]);
    expect(albums.map((a) => a.theme)).toEqual(['letters', 'life', 'rites', 'nature', 'crafts']);
    expect(albums.map((a) => a.slots.map((s) => s.card?.id ?? null))).toEqual([
      ['card:norae', 'card:hangeul', null, null, null],
      ['card:dosirak', 'card:tteok', null, null, null],
      ['card:bokjumeoni', 'card:full-moon', null, null, null],
      ['card:byeol', 'card:gom', null, null, null],
      ['card:swing', 'card:yut', null, null, null],
    ]);
    // Lunch Box Words' other three shipped cards are not album cards.
    expect(albums[1]!.slots.some((s) => s.card?.id === 'card:sagwa')).toBe(false);
    for (const a of albums) expect([a.canComplete, a.complete, a.held]).toEqual([false, false, []]);
  });

  it('fills with the cards held, in stage order; never lists what is left', () => {
    const [letters, life] = views(['card:hangeul', 'card:norae', 'card:dosirak', 'card:sagwa']);
    expect(letters!.held.map((c) => c.id)).toEqual(['card:norae', 'card:hangeul']);
    expect(life!.held.map((c) => c.id)).toEqual(['card:dosirak']);
    expect(letters!.slots.filter((s) => s.held).map((s) => s.stage)).toEqual(['stage2', 'stage3']);
  });

  it('an album whose every slot has a card can complete, and is complete once all are held', () => {
    const fake = (stage: HeritageCard['stage']): HeritageCard => ({ ...heritageCardsAll[0]!, id: `card:t-${stage}`, theme: 'letters', stage });
    const cards = ALBUM_STAGES.map(fake);
    const ids = cards.map((c) => c.id);
    const [some] = albumViews(ids, cards, new Set(ids.slice(1)), ['letters'], ALBUM_STAGES);
    const [all] = albumViews(ids, cards, new Set(ids), ['letters'], ALBUM_STAGES);
    expect([some!.canComplete, some!.complete, all!.complete]).toEqual([true, false, true]);
  });
});

describe('albumSets (the legendary hook, row CM-23c)', () => {
  it('names no set today: no album can complete and no legendary card ships yet', () => {
    expect(albumSets(views([]), () => 'card:legend', (t) => t)).toEqual([]);
  });

  it('an album that can complete, with a legendary card named, is a set of its five cards', () => {
    const fake = (stage: HeritageCard['stage']): HeritageCard => ({ ...heritageCardsAll[0]!, id: `card:t-${stage}`, theme: 'nature', stage });
    const cards = ALBUM_STAGES.map(fake);
    const albums = albumViews(cards.map((c) => c.id), cards, new Set(), ['nature', 'crafts'], ALBUM_STAGES);
    expect(albumSets(albums, (t) => (t === 'nature' ? 'card:legend-nature' : undefined), (t) => `${t} album`)).toEqual([
      { id: 'set:album-nature', cardId: 'card:legend-nature', titleEn: 'nature album', memberCardIds: cards.map((c) => c.id) },
    ]);
    expect(albumSetId('rites')).toBe('set:album-rites');
  });
});

describe('a finished album brings its legendary card through the set rule (row CM-23c hook)', () => {
  it('derivedAwards: a complete synthetic Letters album awards the card naming set:album-letters, dated by its last member; one short, none', () => {
    const member = (stage: HeritageCard['stage'], i: number): HeritageCard => ({ ...heritageCardsAll[0]!, id: `card:t-${stage}`, theme: 'letters', stage, unlockedBy: `episode:none-${i}` });
    const cards = ALBUM_STAGES.map(member);
    const legend: HeritageCard = { ...heritageCardsAll[0]!, id: 'card:legend-letters', theme: 'letters', rarity: 'legendary', unlockedBy: albumSetId('letters') };
    const albums = albumViews(cards.map((c) => c.id), cards, new Set(), ['letters'], ALBUM_STAGES);
    const world: AwardWorld = { cards: [...cards, legend], episodes: [], quests: [], sets: albumSets(albums, () => legend.id, () => 'Letters album') };
    const at = (d: number): string => `2026-10-${String(10 + d).padStart(2, '0')}T10:00:00.000Z`;
    const snap = (n: number) => ({
      profileId: 'p',
      updatedAt: at(9),
      episodes: [],
      quests: [],
      cards: cards.slice(0, n).map((c, i) => ({ cardId: c.id, unlockedAt: at(i), newSinceLastView: false })),
      sessions: [],
      homework: [],
      reviews: [],
      streakDays: 0,
    });
    const profile = { createdAt: '2026-09-01T08:00:00.000Z' };
    expect(derivedAwards(world, snap(5), profile).find((a) => a.cardId === legend.id)).toEqual({ cardId: legend.id, source: 'set', via: 'set:album-letters', unlockedAt: at(4) });
    expect(derivedAwards(world, snap(4), profile).find((a) => a.cardId === legend.id)).toBeUndefined();
  });
});
