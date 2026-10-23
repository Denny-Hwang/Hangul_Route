import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { HeritageCardListSchema, STORY_CARD_FACT_MAX_CHARS, checkRomanization, type StageKey, type ThemeKey } from '@hangul-route/content-schema';
import { lintCardSources } from '@hangul-route/content-schema/lint';
import { upperCellCardArtIds } from '@hangul-route/design-system/upper-card-ids';
import { describe, expect, it } from 'vitest';
import { awardWorld } from '../award-world';
import { episodesAll } from '../episodes';
import { UPPER_CARD_GATED_IDS, heritageCardsAll, stage2Cards, stage4Cards, upperCellCards } from '../heritage-cards';
import { questsAll } from '../quests';
import { UPPER_CARD_BACKS, withUpperBack } from '../upper-card-backs';
import { UPPER_CARD_REVIEW, UPPER_CARD_REVIEW_S4, UPPER_CARD_SHIPPED, UPPER_CARD_SOURCES } from '../upper-cell-card-sources';
import { ALBUM_STAGES, ALBUM_THEMES } from '../album-order';
import { UPPER_CELL_CARDS } from '../upper-cell-cards';

/**
 * The upper-cell cards of Stages 2 to 4 (F-CURR-002 §5.1, §6.6, §7.2 and §9.2, row CM-23 parts 1 and 2): one card per upper
 * cell in its first volume, the taste cells' shipped awards kept exactly, every back-face fact sourced from the §6.6
 * allowlist, the Korean taught in the cell, and the review recorded before the content is ready.
 */
const REPO = join(__dirname, '../../../../..');
const THEMES: readonly ThemeKey[] = ['letters', 'life', 'rites', 'nature', 'crafts'];
const STAGES: readonly StageKey[] = ['stage2', 'stage3', 'stage4'];
const cardOf = (id: string) => heritageCardsAll.find((c) => c.id === id);
const cellFile = (stage: StageKey, theme: ThemeKey): string => join(REPO, `content/episodes/stage-${stage.slice(5)}/${theme}.json`);
const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힣]/;

/** Every `ko` string a learner is taught in a cell's quests (discover items, rounds, pairs), never a culture note or source. */
function taughtKo(node: unknown, out: string[] = [], key = ''): string[] {
  if (key === 'culture' || key === 'sources' || key === 'citation') return out;
  if (Array.isArray(node)) for (const x of node) taughtKo(x, out, key);
  else if (node !== null && typeof node === 'object')
    for (const [k, v] of Object.entries(node)) {
      if (k === 'ko' && typeof v === 'string') out.push(v);
      else taughtKo(v, out, k);
    }
  return out;
}

const words = (text: string): string[] => text.split(/[\s.,!?'"“”‘’…·]+/).filter((w) => w.length > 0);

/**
 * The word or line is taught in the cell: a taught item is it, or a taught sentence holds its words in order, the last
 * one allowed a particle after it (a Stage 4 card is a whole line, 비가 와요, taught as 비가 와요!).
 */
function taughtIn(stage: StageKey, theme: ThemeKey, ko: string): boolean {
  const cell = JSON.parse(readFileSync(cellFile(stage, theme), 'utf8')) as { quests?: unknown };
  const want = words(ko);
  if (want.length === 0) return false;
  return taughtKo(cell.quests).some((t) => {
    if (t === ko) return true;
    const have = words(t);
    for (let i = 0; i + want.length <= have.length; i += 1) {
      if (want.every((w, j) => (j === want.length - 1 ? have[i + j]!.startsWith(w) : have[i + j] === w))) return true;
    }
    return false;
  });
}

describe('upper-cell cards, Stages 2-4 (row CM-23)', () => {
  it('one card per upper cell of Stages 2 to 4, by stage then theme, each naming its own first-volume cell', () => {
    expect(UPPER_CELL_CARDS).toHaveLength(15);
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
    for (const id of UPPER_CARD_GATED_IDS) {
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
    expect([...UPPER_CARD_GATED_IDS]).toEqual(upperCellCards.map((c) => c.id));
    expect(awardWorld.firstFinishCardIds).toBe(UPPER_CARD_GATED_IDS);
  });

  it('every album card is drawn: the art ids are the same fifteen', () => {
    expect([...upperCellCardArtIds]).toEqual([...UPPER_CELL_CARDS]);
  });

  it('the new cards parse, are rare, and their Korean is taught in their cell with converter romanization', () => {
    expect(() => HeritageCardListSchema.parse(upperCellCards)).not.toThrow();
    for (const card of upperCellCards) {
      expect(card.rarity, card.id).toBe('rare');
      const ko = card.subtitleKo ?? '';
      expect(taughtIn(card.stage, card.theme, ko), `${card.id}: ${ko} taught in its cell`).toBe(true);
      expect(checkRomanization(ko, card.romanization ?? ''), card.id).toEqual([]);
    }
    // The check reads taught text only: a word from another cell, or only in a source title, is not taught here.
    expect(taughtIn('stage2', 'letters', '윷')).toBe(false);
    expect(taughtIn('stage3', 'letters', '맞춤법')).toBe(false);
    // A line is matched word by word in order, never as loose words of a sentence.
    expect(taughtIn('stage4', 'nature', '비가 와요')).toBe(true);
    expect(taughtIn('stage4', 'nature', '와요 비가')).toBe(false);
  });

  it('Stage 4 (part 2): each card is a polite line of its cell\u2019s talk, the 해요체 ending, taught in the cell', () => {
    const s4 = upperCellCards.filter((c) => c.stage === 'stage4');
    expect(s4.map((c) => [c.id, c.subtitleKo, c.titleEn])).toEqual([
      ['card:mwoyeyo', '이게 뭐예요?', 'What Is This?'],
      ['card:masisseoyo', '맛있어요', 'It Is Tasty'],
      ['card:biga-wayo', '비가 와요', 'It Is Raining'],
      ['card:gachi', '같이 할까요?', 'Do It Together?'],
    ]);
    for (const c of s4) expect(c.subtitleKo, c.id).toMatch(/요\??$/);
  });

  it('the fronts carry no back; each back is in the upper-cards chunk, one per card', () => {
    expect(Object.keys(UPPER_CARD_BACKS).sort()).toEqual(upperCellCards.map((c) => c.id).sort());
    for (const card of upperCellCards) expect([card.blurbEn, card.factEn, card.citation], card.id).toEqual(['', '', undefined]);
    expect(withUpperBack(stage2Cards[0]!)).toBe(stage2Cards[0]);
  });

  it('back faces: short, no Hangul in an English field, a source line from the first allowlisted source', () => {
    for (const card of upperCellCards.map(withUpperBack)) {
      expect(card.blurbEn.length, card.id).toBeGreaterThan(0);
      for (const text of [card.titleEn, card.blurbEn, card.factEn ?? '']) expect(text, card.id).not.toMatch(HANGUL);
      expect((card.factEn ?? '').length, card.id).toBeGreaterThan(0);
      expect((card.factEn ?? '').length, card.id).toBeLessThanOrEqual(STORY_CARD_FACT_MAX_CHARS);
      const sources = UPPER_CARD_SOURCES[card.id] ?? [];
      expect(card.citation, card.id).toEqual({ title: sources[0]?.title, publisher: sources[0]?.publisher, more: sources.length - 1 });
    }
  });

  it('culture-source: every card back cites a §6.6 institution, on its own host, under its name on the access date', () => {
    expect(Object.keys(UPPER_CARD_SOURCES).sort()).toEqual(upperCellCards.map((c) => c.id).sort());
    const cards = Object.entries(UPPER_CARD_SOURCES).map(([cardId, sources]) => ({ cardId, sources }));
    expect(lintCardSources(cards, 'apps/mobile/src/content/upper-cell-card-sources.ts')).toEqual([]);
    for (const { sources } of cards) for (const s of sources) expect(s.quoteOrLocator.length).toBeGreaterThan(0);
  });

  it('the review is recorded before the content is ready: MAR, three passes or more, no expert or native-speaker claim', () => {
    for (const review of [UPPER_CARD_REVIEW, UPPER_CARD_REVIEW_S4]) {
      expect(review).toMatchObject({ status: 'ready', reviewedBy: 'MAR' });
      expect(review.passes).toBeGreaterThanOrEqual(3);
      expect(review.notes.length).toBeGreaterThanOrEqual(3);
      expect(review.notes.join(' ')).not.toMatch(/native[- ]speaker review|expert review|reviewed by (a|an) (native|expert)/i);
    }
    // Part 2's record is its own and names its independent es and ko pass (row CM-23 part 2 fix stage).
    expect(UPPER_CARD_REVIEW.notes.join(' ')).not.toMatch(/Part 2/);
    expect(UPPER_CARD_REVIEW_S4.notes.every((n) => n.startsWith('Part 2'))).toBe(true);
    expect(UPPER_CARD_REVIEW_S4.notes.some((n) => /independent MAR/.test(n))).toBe(true);
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
