import {
  CATALOG,
  ListenPickRoundSchema,
  QuestSchema,
  ROMANIZATION_EXCEPTIONS,
  SHAPE_LOOK_ALIKES,
  checkRomanization,
  routeCatalogOf,
  discoverItemTexts,
  type MatchShapeRound,
  type Quest,
} from '@hangul-route/content-schema';
import { SHAPE_ORIGIN_REGISTRY } from '@hangul-route/design-system/src/scene-art/shape-origin-registry';
import { allowlistedInstitution } from '@hangul-route/content-schema/lint';
import { MatchShapeRoundSchema } from '@hangul-route/content-schema/match-shape';
import { describe, expect, it } from 'vitest';
import HAND_STAMPS from '../../../../../packages/content-schema/src/catalog/hand-stamps.json';
import { koTokenParts } from '../../logic/ko-tokens';
import { isFreeContent } from '../../logic/content-access';
import { SHAPE_FACTS, sourcesOf } from '../../logic/match-shape/facts';
import { shapeLetter } from '../../logic/match-shape/letters';
import { scopeFor, type MinigameScope } from '../../logic/minigame-config';
import { STAGE1_QUESTS, questTeaches } from '../../logic/stage1/curriculum';
import { symbolsOf } from '../../logic/stage1/hangul';
import { episodesAll } from '../episodes';

/**
 * F-CURR-002 section 4.2 item 2 and section 5.2, row CM-33: the Stage 1 additions are TypeScript rows that bypass the
 * lesson lint and the U-rules, so they carry their own tests. Sources are present and from the 6.6 allowlist, every
 * symbol a round asks was shown before it is asked (they follow quest 15 and teach none), every origin picture exists,
 * every pair is a look-alike pair, the rows parse, the quests are stamped, and the copy follows the fact conventions.
 */

const ADDITIONS = ['quest:stage1-crafts-q4'] as const;
const quests = (): Quest[] => ADDITIONS.map((id) => STAGE1_QUESTS.find((q) => q.id === id) as Quest);
const scopesOf = (quest: Quest): Array<{ kind: string; ref: string; scope: MinigameScope }> =>
  quest.steps.flatMap((s) => (s.minigameRef ? [{ kind: s.kind, ref: s.minigameRef, scope: scopeFor(s.minigameRef) as MinigameScope }] : []));
const shapeRounds = (): MatchShapeRound[] => quests().flatMap((q) => scopesOf(q).flatMap(({ scope }) => scope.matchShape?.rounds ?? []));

const HANGUL = /[가-힣ㄱ-ㆎ]/;

/** Every symbol id a scope asks or shows on a tile or an option. */
function shownSymbols(scope: MinigameScope): string[] {
  const out: string[] = [];
  for (const r of scope.matchShape?.rounds ?? []) out.push(...(r.shape === 'origin' ? r.options : [r.target, r.lookAlike]));
  for (const r of scope.listenPick?.rounds ?? []) {
    if (r.id.startsWith('lp:sym:')) out.push(...r.options.map((o) => o.id));
    else for (const o of r.options) out.push(...(symbolsOf(o.text?.ko ?? '') ?? [`?${o.text?.ko ?? ''}`]));
  }
  return out;
}

describe('the Stage 1 additions (row CM-33)', () => {
  it('is Crafts quest 4, after quest 15 in cursor order and last of Stage 1 on the route, and teaches no new symbol', () => {
    expect(STAGE1_QUESTS.map((q) => q.id).slice(15)).toEqual([...ADDITIONS]);
    expect(episodesAll.find((e) => e.id === 'episode:stage1-crafts')?.questIds.slice(3)).toEqual([...ADDITIONS]);
    // The canonical route (cell by cell, F-PLC-001 3.2) puts it after every Stage 1 quest, so a plan, a placement or a
    // lecture preset never reaches it before the letters it asks are taught.
    const stage1 = routeCatalogOf(CATALOG).quests.filter((q) => q.stage === 'stage1' && q.grid).map((q) => q.id);
    expect(stage1.slice(15)).toEqual([...ADDITIONS]);
    for (const quest of quests()) expect(questTeaches(quest), quest.id).toEqual([]);
  });

  it('pass QuestSchema, every step ref resolves to a scope of its kind, and the Check is Listen & Pick with 2 rounds', () => {
    for (const quest of quests()) {
      const r = QuestSchema.safeParse(quest);
      expect(r.success, r.success ? '' : JSON.stringify(r.error.issues)).toBe(true);
      for (const { kind, ref, scope } of scopesOf(quest)) {
        expect(scope?.kind, ref).toBe(quest.steps.find((s) => s.minigameRef === ref)?.minigameKind);
        if (kind === 'check') expect(scope.listenPick?.rounds, ref).toHaveLength(2);
      }
    }
  });

  it('every round parses with its schema; 4 to 6 rounds a game step', () => {
    for (const quest of quests()) {
      for (const { kind, ref, scope } of scopesOf(quest)) {
        for (const r of scope.matchShape?.rounds ?? []) expect(MatchShapeRoundSchema.safeParse(r).success, `${ref} ${r.id}`).toBe(true);
        for (const r of scope.listenPick?.rounds ?? []) expect(ListenPickRoundSchema.safeParse(r).success, `${ref} ${r.id}`).toBe(true);
        const n = scope.matchShape?.rounds.length ?? 0;
        if (kind !== 'check') expect(n, ref).toBeGreaterThanOrEqual(4);
        if (kind !== 'check') expect(n, ref).toBeLessThanOrEqual(6);
      }
    }
  });

  it('every new symbol is shown before it is asked: each symbol a round shows was taught by an earlier Stage 1 quest', () => {
    const taughtBefore = new Set(STAGE1_QUESTS.slice(0, 15).flatMap(questTeaches));
    const problems: string[] = [];
    for (const quest of quests()) {
      for (const { ref, scope } of scopesOf(quest)) for (const id of shownSymbols(scope)) if (!taughtBefore.has(id)) problems.push(`${ref}: ${id}`);
      for (const step of quest.steps) {
        for (const page of step.discover?.pages ?? []) {
          for (const item of page.items) for (const text of discoverItemTexts(item)) for (const id of symbolsOf(text.ko) ?? [`?${text.ko}`]) if (!taughtBefore.has(id)) problems.push(`${quest.id} ${text.ko}: ${id}`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('Match Shape covers the five basic consonants and the vowel bases ㅡ ㅣ (and ㅏ, made from ㅣ and the dot), and ㅂ/ㅍ and ㅓ/ㅗ', () => {
    const origins = shapeRounds().filter((r) => r.shape === 'origin').map((r) => shapeLetter(r.target).char);
    expect(origins.sort()).toEqual(['ㄱ', 'ㄴ', 'ㅁ', 'ㅅ', 'ㅇ', 'ㅡ', 'ㅣ', 'ㅏ'].sort());
    const pairs = shapeRounds().flatMap((r) => (r.shape === 'pair' ? [`${shapeLetter(r.target).char}/${shapeLetter(r.lookAlike).char}`] : []));
    expect(pairs).toEqual(expect.arrayContaining(['ㅂ/ㅍ', 'ㅓ/ㅗ']));
    // The old dot letter is shown in the ㅏ picture only: never an option, never asked.
    for (const r of shapeRounds()) expect(JSON.stringify(r)).not.toContain('ㆍ');
  });

  it('sources present: every origin round names a fact with sources from the 6.6 allowlist, on its own host, with an access date and the quoted words', () => {
    for (const r of shapeRounds()) {
      if (r.shape !== 'origin') continue;
      const sources = sourcesOf(r.fact);
      expect(sources.length, r.id).toBeGreaterThan(0);
      // The letter's own fact (NIKL) and the principle (National Hangeul Museum), as section 5.2 names.
      expect(sources.map((s) => s.publisher).sort(), r.id).toEqual(['National Hangeul Museum', 'National Institute of Korean Language']);
      for (const s of sources) {
        // The culture-source logic of lesson-lint.ts: the institution's name as of the access date, on a host it runs.
        expect(allowlistedInstitution(s.publisher, s.accessed, s.url), `${r.id} ${s.publisher} ${s.url}`).toBeDefined();
        expect(s.url, r.id).toMatch(/^https:\/\/www\.(korean|hangeul)\.go\.kr\//);
        expect(s.accessed, r.id).toMatch(/^2026-\d{2}-\d{2}$/);
        expect(s.quote.trim().length, r.id).toBeGreaterThan(10);
        expect(s.title.trim().length, r.id).toBeGreaterThan(0);
      }
    }
    // Every fact is used by a round, so no source is orphaned.
    const used = new Set(shapeRounds().flatMap((r) => (r.shape === 'origin' ? [r.fact] : [])));
    expect(Object.keys(SHAPE_FACTS).sort()).toEqual([...used].sort());
    expect(sourcesOf('nope')).toEqual([]);
  });

  it('the quoted words hold the letter each fact is about (consonants), or its vowel base', () => {
    for (const r of shapeRounds()) {
      if (r.shape !== 'origin') continue;
      const letter = shapeLetter(r.target).char;
      expect(sourcesOf(r.fact)[0]!.quote, r.id).toContain(letter);
    }
  });

  it('every origin picture is drawn (a registry prop with a sourceRef), so no round is left with a broken image', () => {
    for (const r of shapeRounds()) {
      if (r.shape !== 'origin') continue;
      expect(Object.prototype.hasOwnProperty.call(SHAPE_ORIGIN_REGISTRY, r.picture), r.picture).toBe(true);
      expect(SHAPE_ORIGIN_REGISTRY[r.picture]?.sourceRef?.publisher, r.picture).toBe('National Institute of Korean Language');
    }
  });

  it('every pair is a look-alike pair; its difference line names its two letters, and Korean only inside {ko:} tokens', () => {
    for (const r of shapeRounds()) {
      if (r.shape !== 'pair') continue;
      const [a, b] = [shapeLetter(r.target).char, shapeLetter(r.lookAlike).char];
      expect([SHAPE_LOOK_ALIKES[a], SHAPE_LOOK_ALIKES[b]], r.id).toContain(b === SHAPE_LOOK_ALIKES[a] ? b : a);
      const parts = koTokenParts(r.diffNoteEn);
      const tokens = parts.flatMap((p) => ('ko' in p ? [p.ko] : []));
      expect(tokens.sort(), r.id).toEqual([a, b].sort());
      for (const p of parts) if ('text' in p) expect(HANGUL.test(p.text), `${r.id}: ${p.text}`).toBe(false);
    }
  });

  it('copy: no Hangul in an English field, no native-speaker or expert claim, nothing framed as Korean in origin', () => {
    const english: string[] = [];
    for (const quest of quests()) {
      english.push(quest.titleEn, quest.blurbEn ?? '');
      for (const s of quest.steps) {
        english.push(s.titleEn, s.hoyaLineEn ?? '');
        for (const page of s.discover?.pages ?? []) for (const item of page.items) if (item.type === 'word') english.push(item.word.en, item.noteEn ?? '');
      }
    }
    for (const r of shapeRounds()) english.push(r.shape === 'origin' ? r.noteEn : koTokenParts(r.diffNoteEn).map((p) => ('text' in p ? p.text : '')).join(''));
    for (const text of english) {
      expect(HANGUL.test(text), text).toBe(false);
      expect(text, text).not.toMatch(/native|expert|linguist|invented by|first in the world|oldest/i);
    }
  });

  it('romanization of every shown Korean is the F-CNT-002 reading', () => {
    const ctx = { exceptions: ROMANIZATION_EXCEPTIONS };
    for (const quest of quests()) {
      for (const s of quest.steps) for (const page of s.discover?.pages ?? []) for (const item of page.items) for (const t of discoverItemTexts(item)) expect(checkRomanization(t.ko, t.romanization, ctx), t.ko).toEqual([]);
      for (const { scope } of scopesOf(quest)) for (const r of scope.listenPick?.rounds ?? []) if (!r.id.startsWith('lp:sym:')) for (const o of r.options) if (o.text) expect(checkRomanization(o.text.ko, o.text.romanization, ctx), o.text.ko).toEqual([]);
    }
  });

  it('is stamped in hand-stamps.json above catalogue version 32, and are catalogue rows that teach nothing new', () => {
    const stamps = HAND_STAMPS as Record<string, number>;
    expect(Object.keys(stamps).sort()).toEqual([...ADDITIONS].sort());
    for (const id of ADDITIONS) {
      expect(stamps[id], id).toBeGreaterThan(32);
      expect(String(stamps[id])).toMatch(/^2026\d{4}$/);
      const row = CATALOG.quests.find((q) => q.id === id);
      expect(row, id).toMatchObject({ stage: 'stage1', theme: 'crafts', teaches: [], kind: 'lesson' });
      expect(row?.title).toBe(STAGE1_QUESTS.find((q) => q.id === id)?.titleEn);
    }
    expect(CATALOG.version).toBeGreaterThanOrEqual(Math.max(...Object.values(stamps)));
  });

  it('is free, as all of Stage 1 is (F-ENT-003)', () => {
    for (const id of ADDITIONS) expect(isFreeContent('quest', id), id).toBe(true);
  });
});
