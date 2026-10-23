import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { HeritageCardListSchema, STORY_CARD_FACT_MAX_CHARS, checkRomanization, type StageKey, type ThemeKey } from '@hangul-route/content-schema';
import { lintCardSources } from '@hangul-route/content-schema/lint';
import { albumLegendArtIds, upperCellCardArtIds } from '@hangul-route/design-system/upper-card-ids';
import { describe, expect, it } from 'vitest';
import { albumCardSets, awardWorld } from '../award-world';
import { episodesAll } from '../episodes';
import { UPPER_CARD_GATED_IDS, albumLegendCards, heritageCardsAll, stage2Cards, stage4Cards, upperCellCards } from '../heritage-cards';
import { questsAll } from '../quests';
import { UPPER_CARD_BACKS, withUpperBack } from '../upper-card-backs';
import { UPPER_CARD_REVIEW, UPPER_CARD_SHIPPED, UPPER_CARD_SOURCES } from '../upper-cell-card-sources';
import { ALBUM_STAGES, ALBUM_THEMES } from '../album-order';
import { UPPER_CELL_CARDS } from '../upper-cell-cards';

/**
 * The upper-cell cards of Stages 2 to 7 and the album legendary cards (F-CURR-002 §5.1, §6.6, §7.2 and §9.2, row CM-23 parts 1
 * to 3): one card per upper
 * cell in its first volume, the taste cells' shipped awards kept exactly, every back-face fact sourced from the §6.6
 * allowlist, the Korean taught in the cell, and the review recorded before the content is ready.
 */
const REPO = join(__dirname, '../../../../..');
const THEMES: readonly ThemeKey[] = ['letters', 'life', 'rites', 'nature', 'crafts'];
const STAGES: readonly StageKey[] = ['stage2', 'stage3', 'stage4', 'stage6', 'stage7'];
/** Every card row CM-23 adds: the upper-cell cards, then the five legendary cards. */
const ROW_CARDS = [...upperCellCards, ...albumLegendCards];
const cardOf = (id: string) => heritageCardsAll.find((c) => c.id === id);
const cellFile = (stage: StageKey, theme: ThemeKey): string => join(REPO, `content/episodes/stage-${stage.slice(5)}/${theme}.json`);
const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힣]/;

describe('upper-cell cards, Stages 2-7 (row CM-23)', () => {
  it('one card per upper cell of Stages 2 to 7, by stage then theme, each naming its own first-volume cell: all 25 (section 7.2)', () => {
    expect(UPPER_CELL_CARDS).toHaveLength(25);
    const cells = UPPER_CELL_CARDS.map((id) => {
      const card = cardOf(id);
      expect(card, id).toBeDefined();
      return `${card?.stage}/${card?.theme}/${card?.unlockedBy}`;
    });
    expect(cells).toEqual(STAGES.flatMap((s) => THEMES.map((t) => `${s}/${t}/episode:${s}-${t}`)));
    // Stage 5 holds the books; the albums run over the five other upper stages.
    expect(ALBUM_STAGES).toEqual(['stage2', 'stage3', 'stage4', 'stage6', 'stage7']);
    expect(ALBUM_THEMES).toEqual(THEMES);
  });

  it('each card is in its cell file and episode reward list, on no quest (a cell card, never a quest card)', () => {
    for (const { id } of upperCellCards) {
      const card = cardOf(id)!;
      const cell = JSON.parse(readFileSync(cellFile(card.stage, card.theme), 'utf8')) as { rewardCardIds: string[]; quests: { rewardCardId?: string }[] };
      expect(cell.rewardCardIds, id).toEqual([id]);
      expect(cell.quests.every((q) => q.rewardCardId === undefined), id).toBe(true);
      expect(episodesAll.find((e) => e.id === card.unlockedBy)?.rewardCardIds, id).toEqual([id]);
    }
  });

  it('the taste cells keep their shipped four cards; their album card is their q1 card, never gated (F-CURR-001 Cards)', () => {
    expect([...UPPER_CARD_SHIPPED]).toEqual(['card:dosirak', 'card:byeol', 'card:insa']);
    // Greeting Dialogues (row CM-23 part 2): the shipped `episode:stage4-rites` award, exactly.
    expect(questsAll.find((q) => q.id === 'quest:stage4-rites-q1')?.rewardCardId).toBe('card:insa');
    expect(episodesAll.find((e) => e.id === 'episode:stage4-rites')?.rewardCardIds).toEqual(['card:annyeong', 'card:gamsa', 'card:chingu', 'card:insa']);
    expect(stage4Cards.find((c) => c.id === 'card:insa')).toMatchObject({ rarity: 'rare', stage: 'stage4', theme: 'rites', unlockedBy: 'episode:stage4-rites' });
    expect(questsAll.find((q) => q.id === 'quest:stage2-life-q1')?.rewardCardId).toBe('card:dosirak');
    expect(questsAll.find((q) => q.id === 'quest:stage2-nature-q1')?.rewardCardId).toBe('card:byeol');
    expect(episodesAll.find((e) => e.id === 'episode:stage2-life')?.rewardCardIds).toEqual(['card:sagwa', 'card:uyu', 'card:ppang', 'card:dosirak']);
    expect(episodesAll.find((e) => e.id === 'episode:stage2-nature')?.rewardCardIds).toEqual(['card:haneul', 'card:kkot', 'card:namu', 'card:byeol']);
    for (const id of UPPER_CARD_SHIPPED) expect([...stage2Cards, ...stage4Cards].some((c) => c.id === id)).toBe(true);
    for (const id of UPPER_CARD_SHIPPED) expect(UPPER_CARD_GATED_IDS.has(id), id).toBe(false);
    expect([...UPPER_CARD_GATED_IDS]).toEqual(ROW_CARDS.map((c) => c.id));
    expect(awardWorld.firstFinishCardIds).toBe(UPPER_CARD_GATED_IDS);
  });

  it('every album card and legendary card is drawn: the art ids are the same twenty-five and five', () => {
    expect([...upperCellCardArtIds]).toEqual([...UPPER_CELL_CARDS]);
    expect([...albumLegendArtIds]).toEqual(albumLegendCards.map((c) => c.id));
  });

  it('the new cards parse, are rare, and their Korean is taught in their cell with converter romanization', () => {
    expect(() => HeritageCardListSchema.parse(upperCellCards)).not.toThrow();
    for (const card of upperCellCards) {
      expect(card.rarity, card.id).toBe('rare');
      const ko = card.subtitleKo ?? '';
      expect(readFileSync(cellFile(card.stage, card.theme), 'utf8'), `${card.id}: ${ko} taught in its cell`).toContain(`"${ko}`);
      expect(checkRomanization(ko, card.romanization ?? ''), card.id).toEqual([]);
    }
  });

  it('Stage 4 (part 2): each card is a polite line of its cell\u2019s talk, the 해요체 ending, taught in the cell', () => {
    const s4 = upperCellCards.filter((c) => c.stage === 'stage4');
    expect(s4.map((c) => [c.id, c.subtitleKo, c.titleEn])).toEqual([
      ['card:mwoyeyo', '이게 뭐예요?', 'What Is This?'],
      ['card:masisseoyo', '맛있어요', 'It Is Tasty'],
      ['card:biga-wayo', '비가 와요', 'It Is Raining'],
      ['card:gachi', '같이 할까요?', 'Play Together?'],
    ]);
    for (const c of s4) expect(c.subtitleKo, c.id).toMatch(/요\??$/);
  });

  it('Stages 6-7 (part 3): every cell gives a new card, so no album slot waits; Stage 6 reads the world, Stage 7 writes', () => {
    const s6 = upperCellCards.filter((c) => c.stage === 'stage6');
    const s7 = upperCellCards.filter((c) => c.stage === 'stage7');
    expect(s6.map((c) => [c.id, c.subtitleKo, c.titleEn])).toEqual([
      ['card:won', '원', 'Won'],
      ['card:yeogiyo', '여기요', 'Over Here!'],
      ['card:gichapyo', '기차표', 'Train Ticket'],
      ['card:jeongsang', '정상', 'Summit'],
      ['card:deom', '덤', 'A Little Extra'],
    ]);
    expect(s7.map((c) => [c.id, c.subtitleKo, c.titleEn])).toEqual([
      ['card:ireum', '이름', 'Name'],
      ['card:achim', '아침', 'Morning'],
      ['card:saengil', '생일', 'Birthday'],
      ['card:tokki', '토끼', 'Rabbit'],
      ['card:bihaenggi', '비행기', 'Plane'],
    ]);
    // Stage 7 is writing: each card's word is a word of its cell's word bank (a tile the learner builds sentences with).
    for (const card of s7) {
      const cell = readFileSync(cellFile(card.stage, card.theme), 'utf8');
      expect(cell, card.id).toMatch(new RegExp(`"${card.subtitleKo}[^"]*\\.?"`));
    }
  });

  it('the five legendary cards: one per album, in album order, legendary, earned only by its album set, Korean of their own', () => {
    expect(albumLegendCards.map((c) => [c.id, c.theme, c.subtitleKo, c.rarity, c.unlockedBy])).toEqual([
      ['card:hunminjeongeum', 'letters', '훈민정음', 'legendary', 'set:album-letters'],
      ['card:jang', 'life', '장 담그기', 'legendary', 'set:album-life'],
      ['card:hangawi', 'rites', '한가위', 'legendary', 'set:album-rites'],
      ['card:jirisan', 'nature', '지리산', 'legendary', 'set:album-nature'],
      ['card:ssireum', 'crafts', '씨름', 'legendary', 'set:album-crafts'],
    ]);
    expect(() => HeritageCardListSchema.parse(albumLegendCards)).not.toThrow();
    for (const card of albumLegendCards) expect(checkRomanization(card.subtitleKo ?? '', card.romanization ?? ''), card.id).toEqual([]);
    // Each set is its album: the theme's five upper-cell cards, one per album stage, and the award world reads them.
    for (const set of albumCardSets) {
      const legend = albumLegendCards.find((c) => c.id === set.cardId)!;
      expect(set.id).toBe(legend.unlockedBy);
      expect(set.memberCardIds.map((id) => cardOf(id)?.stage)).toEqual(ALBUM_STAGES);
      expect(set.memberCardIds.every((id) => cardOf(id)?.theme === legend.theme), set.id).toBe(true);
      expect(awardWorld.sets).toContain(set);
    }
    expect(albumCardSets).toHaveLength(5);
  });

  it('UNESCO status is claimed only for the exact element, under its UNESCO name, with its inscription year', () => {
    for (const card of ROW_CARDS.map(withUpperBack)) {
      const fact = card.factEn ?? '';
      if (!/UNESCO/.test(fact)) continue;
      const unesco = (UPPER_CARD_SOURCES[card.id] ?? []).filter((s) => s.publisher.startsWith('UNESCO'));
      expect(unesco.length, card.id).toBeGreaterThan(0);
      expect(unesco.some((s) => fact.includes(s.title)), `${card.id}: the UNESCO name in the fact`).toBe(true);
      // "inscribed Y" (or "proclaimed X, inscribed Y"), and Y is the year the UNESCO page gives.
      const year = /inscribed[^.]*?\b((?:19|20)\d{2})\b/.exec(fact)?.[1];
      expect(year, `${card.id}: an inscription year`).toBeDefined();
      expect(unesco.map((s) => s.quoteOrLocator).join(' '), `${card.id}: the year is the source's`).toContain(year ?? 'none');
    }
  });

  it('the fronts carry no back; each back is in the upper-cards chunk, one per card', () => {
    expect(Object.keys(UPPER_CARD_BACKS).sort()).toEqual(ROW_CARDS.map((c) => c.id).sort());
    for (const card of ROW_CARDS) expect([card.blurbEn, card.factEn, card.citation], card.id).toEqual(['', '', undefined]);
    expect(withUpperBack(stage2Cards[0]!)).toBe(stage2Cards[0]);
  });

  it('back faces: short, no Hangul in an English field, a source line from the first allowlisted source', () => {
    for (const card of ROW_CARDS.map(withUpperBack)) {
      expect(card.blurbEn.length, card.id).toBeGreaterThan(0);
      for (const text of [card.titleEn, card.blurbEn, card.factEn ?? '']) expect(text, card.id).not.toMatch(HANGUL);
      expect((card.factEn ?? '').length, card.id).toBeGreaterThan(0);
      expect((card.factEn ?? '').length, card.id).toBeLessThanOrEqual(STORY_CARD_FACT_MAX_CHARS);
      const sources = UPPER_CARD_SOURCES[card.id] ?? [];
      expect(card.citation, card.id).toEqual({ title: sources[0]?.title, publisher: sources[0]?.publisher, more: sources.length - 1 });
    }
  });

  it('culture-source: every card back cites a §6.6 institution, on its own host, under its name on the access date', () => {
    expect(Object.keys(UPPER_CARD_SOURCES).sort()).toEqual(ROW_CARDS.map((c) => c.id).sort());
    const cards = Object.entries(UPPER_CARD_SOURCES).map(([cardId, sources]) => ({ cardId, sources }));
    expect(lintCardSources(cards, 'apps/mobile/src/content/upper-cell-card-sources.ts')).toEqual([]);
    for (const { sources } of cards) for (const s of sources) expect(s.quoteOrLocator.length).toBeGreaterThan(0);
  });

  it('the review is recorded before the content is ready: MAR, three passes or more, no expert or native-speaker claim', () => {
    expect(UPPER_CARD_REVIEW).toMatchObject({ status: 'ready', reviewedBy: 'MAR' });
    expect(UPPER_CARD_REVIEW.passes).toBeGreaterThanOrEqual(3);
    expect(UPPER_CARD_REVIEW.notes.length).toBeGreaterThanOrEqual(3);
    expect(UPPER_CARD_REVIEW.notes.join(' ')).not.toMatch(/native[- ]speaker review|expert review|reviewed by (a|an) (native|expert)/i);
  });

  it('the backs are imported by the upper-cards chunk only, so the start bundle never carries them', () => {
    const SRC = join(__dirname, '../..');
    const files = (dir: string): string[] =>
      readdirSync(dir).flatMap((n) => {
        const p = join(dir, n);
        if (statSync(p).isDirectory()) return n === '__tests__' ? [] : files(p);
        return /\.tsx?$/.test(n) ? [p] : [];
      });
    const importers = files(SRC).filter((f) => /from '[^']*upper-card-backs'/.test(readFileSync(f, 'utf8')));
    expect(importers.map((f) => relative(SRC, f))).toEqual(['screens/library/upper-cards-chunk.tsx']);
  });

  it('the album order is read by the upper-cards chunk only, so the start bundle never carries it (row CM-23 part 2)', () => {
    const SRC = join(__dirname, '../..');
    const files = (dir: string): string[] =>
      readdirSync(dir).flatMap((n) => {
        const p = join(dir, n);
        if (statSync(p).isDirectory()) return n === '__tests__' ? [] : files(p);
        return /\.tsx?$/.test(n) ? [p] : [];
      });
    const importers = files(SRC).filter((f) => /from '[^']*album-order'/.test(readFileSync(f, 'utf8')));
    expect(importers.map((f) => relative(SRC, f))).toEqual(['screens/library/upper-cards-chunk.tsx']);
  });

  it('the sources file is build and test data only: no app module imports it', () => {
    const SRC = join(__dirname, '../..');
    const files = (dir: string): string[] =>
      readdirSync(dir).flatMap((n) => {
        const p = join(dir, n);
        if (statSync(p).isDirectory()) return n === '__tests__' ? [] : files(p);
        return /\.tsx?$/.test(n) ? [p] : [];
      });
    const importers = files(SRC).filter((f) => /from '[^']*upper-cell-card-sources'/.test(readFileSync(f, 'utf8')) && !f.endsWith('upper-cell-card-sources.ts'));
    expect(importers.map((f) => relative(SRC, f))).toEqual([]);
  });
});
