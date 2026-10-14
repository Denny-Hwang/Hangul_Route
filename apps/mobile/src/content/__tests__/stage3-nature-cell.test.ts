import { readFileSync } from 'node:fs';
import {
  LessonCellSchema,
  ROMANIZATION_EXCEPTIONS,
  checkFrameRomanization,
  checkRomanization,
  discoverItemTexts,
  type LessonQuest,
  type LessonScope,
} from '@hangul-route/content-schema';
import { supportedCardIds } from '@hangul-route/design-system/heritage-card-ids';
import { WORD_ART_KEYS } from '@hangul-route/design-system/word-art';
import { describe, expect, it } from 'vitest';
import { resolvePicture } from '../../logic/picture-ref';

/**
 * F-CURR-001 row S3-4, Animal Sentences (`content/episodes/stage-3/nature.json`): the
 * content checks of sections 3.1 and 3.4 for this cell (romanization, U-3 new items,
 * sentence shape, U-6 reuse, pictures, the sign-off invariant of section 3.8), until the
 * shared checks of upper-stage-curriculum.test.ts land.
 */

const ROOT = new URL('../../../../../', import.meta.url);
const read = (rel: string): unknown => JSON.parse(readFileSync(new URL(rel, ROOT), 'utf8'));
const cell = LessonCellSchema.parse(read('content/episodes/stage-3/nature.json'));
const overlays = (['es', 'ko'] as const).map(
  (l) =>
    read(`content/i18n/${l}/lessons-stage3-nature.json`) as {
      entries: Record<string, Record<string, string>>;
    },
);

/** A sentence's words (어절) without sentence marks, and each word without its particle (에, 이, 가). */
const words = (ko: string): string[] =>
  ko
    .replace(/[.?!,]/g, '')
    .split(/\s+/)
    .filter(Boolean);
const PARTICLE = /(에|이|가)$/;
/** Nouns that end in 이 or 가 as part of the word, never a particle. */
const WHOLE = new Set(['고양이', '호랑이']);
function lemma(word: string): string {
  if (WHOLE.has(word)) return word;
  if (WHOLE.has(word.slice(0, -1))) return word.slice(0, -1);
  return word.replace(PARTICLE, '');
}
const lemmas = (ko: string): string[] => words(ko).map(lemma);

const ANIMALS = new Set(['새', '물고기', '고양이', '토끼', '곰', '호랑이', '여우']);

/** Taught before Stage 3 (Stage 1 words, the Stage 2 nature taste, the Stage 2 vocabulary topics). */
const KNOWN = new Set(['나무', '물', '집', '산', '곰', '여우', '하늘', '꽃']);

const discoverKo = (quest: LessonQuest): string[] =>
  quest.steps.flatMap(
    (s) => s.discover?.pages.flatMap((p) => p.items.flatMap((i) => discoverItemTexts(i).map((t) => t.ko))) ?? [],
  );

function scopeKo(scope: LessonScope): string[] {
  switch (scope.kind) {
    case 'order-it':
      return scope.rounds.flatMap((r) => [r.sentence.ko, ...r.distractors.map((d) => d.ko)]);
    case 'listen-pick':
      return scope.rounds.flatMap((r) => [r.prompt.ko, ...r.options.flatMap((o) => (o.text ? [o.text.ko] : []))]);
    default:
      return [];
  }
}

/** Every `{ ko, romanization }` pair in a value. */
function pairs(value: unknown, out: Array<[string, string]> = []): Array<[string, string]> {
  if (Array.isArray(value)) value.forEach((v) => pairs(v, out));
  else if (typeof value === 'object' && value !== null) {
    const o = value as Record<string, unknown>;
    if (typeof o.ko === 'string' && typeof o.romanization === 'string') out.push([o.ko, o.romanization]);
    Object.values(o).forEach((v) => pairs(v, out));
  }
  return out;
}

describe('Animal Sentences (F-CURR-001 S3-4)', () => {
  it('is the nature cell of Stage 3: three quests, no new cards, ready exactly when both MAR sign-offs and three passes are in', () => {
    expect(cell.id).toBe('episode:stage3-nature');
    expect(cell.titleEn).toBe('Animal Sentences');
    expect(cell.quests.map((q) => q.id)).toEqual([
      'quest:stage3-nature-q1',
      'quest:stage3-nature-q2',
      'quest:stage3-nature-q3',
    ]);
    expect(cell.rewardCardIds).toEqual([]);
    expect(cell.quests.every((q) => q.rewardCardId === undefined)).toBe(true);
    const signedOff =
      cell.review.language === 'native-reviewed' &&
      cell.review.culture === 'culture-reviewed' &&
      cell.review.reviewedBy === 'MAR' &&
      cell.review.reviewedAt !== undefined &&
      cell.culture.every((n) => n.verification.passes >= 3);
    expect(cell.status === 'ready').toBe(signedOff);
  });

  it('teaches the section 3.4 sentences: N-e isseoyo, size and look, animal actions', () => {
    const taught = cell.quests.map((q) => discoverKo(q).join(' '));
    expect(taught[0]).toContain('나무에 새가 있어요.');
    expect(taught[0]).toContain('물에 물고기가 있어요.');
    const shown = cell.quests.map((q) => [...discoverKo(q), ...q.scopes.flatMap(scopeKo)].join(' '));
    for (const s of ['호랑이가 커요.', '토끼가 작아요.', '고양이가 귀여워요.']) expect(shown[1]).toContain(s);
    for (const s of ['새가 날아요.', '토끼가 뛰어요.']) expect(shown[2]).toContain(s);
  });

  it('every taught Korean string has its Revised Romanization (frames checked piece by piece)', () => {
    const ctx = { exceptions: ROMANIZATION_EXCEPTIONS };
    const issues = pairs(cell.quests).flatMap(([ko, rom]) =>
      (ko.includes('___') ? checkFrameRomanization(ko, rom, ctx) : checkRomanization(ko, rom, ctx)).map(
        (i) => i.message,
      ),
    );
    expect(issues).toEqual([]);
  });

  it('Stage 3 shape: Sentence Builder x 5 (q1: 5 order rounds; q2, q3: 3 order + 2 particle rounds), Listen & Pick x 4 (2 picture rounds, 2 rounds that hold the animal and vary the new word), a 2-round Check', () => {
    for (const quest of cell.quests) {
      expect(
        quest.scopes.map((s) => s.kind),
        quest.id,
      ).toEqual(['order-it', 'listen-pick', 'listen-pick']);
      const [play, apply, check] = quest.scopes;
      if (play?.kind !== 'order-it' || apply?.kind !== 'listen-pick' || check?.kind !== 'listen-pick')
        throw new Error(quest.id);
      // q1 teaches one pattern (에 + 있어요); the 이 / 가 choice is drilled in q2 and q3.
      expect(play.rounds.filter((r) => r.particle === undefined).length, quest.id).toBe(
        quest.id.endsWith('q1') ? 5 : 3,
      );
      for (const r of play.rounds) {
        if (r.particle)
          expect(r.distractors, `${quest.id} ${r.id}: a particle round carries no distractors`).toEqual([]);
        else expect(r.distractors.length, `${quest.id} ${r.id}`).toBe(1);
      }
      const [a1, a2, a3, a4] = apply.rounds;
      for (const r of [a1, a2])
        expect(
          r?.options.every((o) => o.pictureRef !== undefined && o.labelEn !== undefined),
          `${quest.id} ${r?.id}`,
        ).toBe(true);
      // The noun alone never answers a3 and a4: every option has the prompt's animal.
      for (const r of [a3, a4]) {
        if (!r) throw new Error(quest.id);
        const animal = lemmas(r.prompt.ko).find((w) => ANIMALS.has(w));
        expect(animal, `${quest.id} ${r.id}`).toBeDefined();
        for (const o of r.options) {
          expect(o.text, `${quest.id} ${r.id}`).toBeDefined();
          expect(lemmas(o.text!.ko), `${quest.id} ${r.id}`).toContain(animal);
        }
      }
      expect(check.rounds[0]?.options.every((o) => o.pictureRef !== undefined)).toBe(true);
      expect(check.rounds[1]?.options.every((o) => o.text !== undefined && o.pictureRef === undefined)).toBe(true);
    }
  });

  it('every sentence is polite 해요체 and ends with its sentence mark', () => {
    const sentences = cell.quests.flatMap((q) => [
      ...discoverKo(q),
      ...q.scopes.flatMap((s) => (s.kind === 'order-it' ? s.rounds.map((r) => r.sentence.ko) : scopeKo(s))),
    ]);
    for (const s of sentences) expect(s, s).toMatch(/요\.$/);
  });

  it('every picture resolves to art (no text fallback)', () => {
    const ctx = { supportedCardIds, swatches: {}, wordArtKeys: WORD_ART_KEYS };
    const refs = JSON.stringify(cell.quests).match(/"(?:pictureRef|picture)":"([^"]+)"/g) ?? [];
    expect(refs.length).toBeGreaterThan(0);
    for (const m of refs) {
      const ref = m.split('":"')[1]!.slice(0, -1);
      expect(resolvePicture(ref, ctx).kind, ref).not.toBe('text');
    }
  });

  it('rule 4: every word a quest asks was shown in its Discover, an earlier quest of the cell, or before Stage 3', () => {
    const taught = new Set(KNOWN);
    for (const quest of cell.quests) {
      for (const ko of discoverKo(quest)) for (const w of lemmas(ko)) taught.add(w);
      for (const scope of quest.scopes)
        for (const ko of scopeKo(scope))
          for (const w of lemmas(ko)) expect(taught.has(w), `${scope.ref}: ${w} in ${ko}`).toBe(true);
    }
  });

  it('U-3: at most 4 new words per quest (the pattern itself counts apart)', () => {
    const seen = new Set(KNOWN);
    for (const quest of cell.quests) {
      const pattern = new Set(
        quest.steps.flatMap(
          (s) =>
            s.discover?.pages.flatMap((p) =>
              p.items.flatMap((i) => (i.type === 'pattern' ? lemmas(i.frame.ko.replace(/___\S*/, '')) : [])),
            ) ?? [],
        ),
      );
      expect(pattern.size, `${quest.id}: one pattern`).toBe(1);
      const fresh = [...new Set(discoverKo(quest).flatMap(lemmas))].filter((w) => !seen.has(w) && !pattern.has(w));
      for (const w of pattern) seen.add(w);
      expect(fresh.length, `${quest.id}: ${fresh.join(', ')}`).toBeLessThanOrEqual(4);
      for (const w of fresh) seen.add(w);
    }
  });

  it('U-6: at least half the Korean words outside Discover were taught before the quest', () => {
    const before = new Set(KNOWN);
    for (const quest of cell.quests) {
      const shown = new Set(quest.scopes.flatMap((s) => scopeKo(s).flatMap(lemmas)));
      const reused = [...shown].filter((w) => before.has(w));
      expect(reused.length * 2, `${quest.id}: ${reused.length} of ${shown.size}`).toBeGreaterThanOrEqual(shown.size);
      for (const w of discoverKo(quest).flatMap(lemmas)) before.add(w);
    }
  });

  it('notes: each language note has two or more sources, one a Korean public institution, and its pass 2, 2b and 5 records', () => {
    expect(cell.culture.map((n) => n.id)).toEqual(['n1', 'n2', 'n3']);
    for (const note of cell.culture) {
      expect(note.kind).toBe('language');
      expect(note.sources?.length ?? 0, note.id).toBeGreaterThanOrEqual(2);
      expect(note.verification.scope).toBe('lesson');
      expect(note.verification.notes, note.id).toMatch(/^pass 2 /);
      expect(note.verification.notes, note.id).toMatch(/\npass 2b /);
      expect(note.verification.notes, note.id).toMatch(/\npass 5 /);
      expect(note.verification.passes, note.id).toBeGreaterThanOrEqual(3);
      expect(
        note.sources?.some((s) => /국립국어원|한국학중앙연구원/.test(s.publisher)),
        note.id,
      ).toBe(true);
    }
  });

  it('the es and ko overlays cover every entity of the cell, and no Korean gloss repeats the Korean it explains', () => {
    const ids = [
      cell.id,
      ...cell.quests.map((q) => q.id),
      ...cell.quests.flatMap((q) => q.scopes.map((s) => s.ref)),
    ].sort();
    const taught = new Set(pairs(cell.quests).map(([ko]) => ko.replace(/[.?!]$/, '')));
    for (const overlay of overlays) {
      expect(Object.keys(overlay.entries).sort()).toEqual(ids);
    }
    for (const value of Object.values(overlays[1]!.entries).flatMap((e) => Object.values(e))) {
      expect(taught.has(value.replace(/[.?!]$/, '')), value).toBe(false);
    }
  });

  it('no Korean gloss repeats a noun or the stem of the predicate it explains (spec 3.15-9, pass 6)', () => {
    const STEMS: Record<string, string> = {
      커요: '크',
      큰: '크',
      작아요: '작',
      귀여워요: '귀엽',
      날아요: '날',
      뛰어요: '뛰',
      헤엄쳐요: '헤엄',
    };
    // The adnominal form carries the taught word too (pass 7: 덩치 큰 in the 곰이 커요 gloss).
    const ADNOMINAL: Record<string, string> = {
      크: '큰',
      작: '작은',
      귀엽: '귀여운',
      날: '나는',
      뛰: '뛰는',
    };
    // 있어요 is the existential verb itself; a gloss of "there is" may say 있다.
    const echoes = (ko: string): string[] =>
      lemmas(ko)
        .filter((w) => w !== '있어요')
        .map((w) => STEMS[w] ?? w)
        .flatMap((w) => (ADNOMINAL[w] ? [w, ADNOMINAL[w]] : [w]));
    const texts = new Map<string, string>();
    for (const quest of cell.quests) {
      for (const step of quest.steps)
        step.discover?.pages.forEach((page, p) =>
          page.items.forEach((item, i) => {
            const at = `steps.${step.id}.discover.pages.${p}.items.${i}`;
            if (item.type === 'sentence') texts.set(`${quest.id}|${at}.sentence.gloss`, item.sentence.ko);
            if (item.type === 'pattern') {
              texts.set(`${quest.id}|${at}.frame.gloss`, item.frame.ko.replace(/___\S*/g, ''));
              for (const ex of item.examples)
                texts.set(`${quest.id}|${at}.examples.${ex.romanization.replace(/ /g, '-')}.gloss`, ex.ko);
            }
          }),
        );
      for (const scope of quest.scopes) {
        if (scope.kind === 'order-it')
          for (const r of scope.rounds) {
            texts.set(`${scope.ref}|orderIt.rounds.${r.id}.sentence.gloss`, r.sentence.ko);
            for (const d of r.distractors)
              texts.set(`${scope.ref}|orderIt.rounds.${r.id}.distractors.${d.romanization}.gloss`, d.ko);
          }
        if (scope.kind === 'listen-pick')
          for (const r of scope.rounds) texts.set(`${scope.ref}|listenPick.rounds.${r.id}.prompt`, r.prompt.ko);
      }
    }
    let checked = 0;
    for (const [id, entry] of Object.entries(overlays[1]!.entries))
      for (const [field, gloss] of Object.entries(entry)) {
        const ko = texts.get(`${id}|${field}`);
        if (ko === undefined) continue;
        checked += 1;
        // 동물 (animal) is not 물 (water).
        for (const w of echoes(ko))
          expect(gloss.replace(/동물/g, '').includes(w), `${id} ${field}: "${gloss}" repeats ${w}`).toBe(false);
      }
    expect(checked).toBe(59);
  });
});
