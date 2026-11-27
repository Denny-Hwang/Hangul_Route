import { readFileSync } from 'node:fs';
import { LessonCellSchema, romanize, type LessonCell, type LessonQuest, type LessonScope } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { LESSON_CELL_MODULES } from './helpers/lesson-stages';

/**
 * AMENDMENTS-BATCHIM-COMPLETE row BC-1 (sections 3.2 to 3.6): Word Builder's optional q7 "Many Letters, Seven Sounds",
 * q8 "Two Letters at the Bottom" and q9 "A Quiet h" as data. The shared rules (U-1 to U-11, the section 9.3 lint) run in
 * upper-stage-curriculum.test.ts; U-4's context rule for the q8 and q9 finals is row BC-2a's (helpers/reuse.ts). This
 * file pins what the spec names for these three quests, and the one recorded change: q8's Check reads two pictured
 * end-letter pairs, because no q8 meaning has drawn art (the cell's review notes).
 */

const ROOT = new URL('../../../../../', import.meta.url);
const CELL: LessonCell = LessonCellSchema.parse(JSON.parse(readFileSync(new URL('content/episodes/stage-2/letters.json', ROOT), 'utf8')));
const OPTIONAL = ['quest:stage2-letters-q7', 'quest:stage2-letters-q8', 'quest:stage2-letters-q9'] as const;
const quest = (id: string): LessonQuest => CELL.quests.find((q) => q.id === id)!;
const [Q7, Q8, Q9] = OPTIONAL.map(quest) as [LessonQuest, LessonQuest, LessonQuest];

const scopeOf = (q: LessonQuest, kind: 'practice' | 'apply' | 'check'): LessonScope => {
  const ref = q.steps.find((s) => s.kind === kind)!.minigameRef!;
  return q.scopes.find((s) => s.ref === ref)!;
};
const discoverWords = (q: LessonQuest) =>
  q.steps.flatMap((s) => s.discover?.pages ?? []).flatMap((p) => p.items).flatMap((i) => (i.type === 'word' ? [i.word] : []));

const INITIALS = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const FINALS = ['', ...'ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ'];
const parts = (ch: string): { initial: string; final: string } | null => {
  const code = (ch.codePointAt(0) ?? 0) - 0xac00;
  if (code < 0 || code > 11171) return null;
  return { initial: INITIALS[Math.floor(code / 588)]!, final: FINALS[code % 28]! };
};
/** Finals said as a stop (k, t or p) at the end of a word. */
const STOP_FINALS = new Set([...'ㄱㄲㅋㄳㄺㄷㅅㅆㅈㅊㅌㅂㅍㅄㄿ']);
const endsInStop = (ko: string): boolean => {
  const last = parts([...ko.replace(/[\s.?!,]/g, '')].at(-1) ?? '');
  return last !== null && STOP_FINALS.has(last.final);
};

/** Every Korean string of a quest (steps and scopes), for the context checks of section 3.2 item 4. */
function koStrings(value: unknown, out: string[] = []): string[] {
  if (Array.isArray(value)) for (const v of value) koStrings(v, out);
  else if (value !== null && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (k === 'ko' && typeof v === 'string') out.push(v);
      else koStrings(v, out);
    }
  }
  return out;
}

/** Where a double final or a bottom ㅎ, ㄶ, ㅀ is not in a context q8 / q9 teach (section 3.8), as readable lines. */
function contextProblems(ko: string): string[] {
  const problems: string[] = [];
  for (const word of ko.split(/[\s.?!,]+/).filter(Boolean)) {
    const blocks = [...word].map(parts);
    blocks.forEach((b, i) => {
      if (b === null) return;
      const next = blocks[i + 1];
      const beforeVowel = next !== null && next !== undefined && next.initial === 'ㅇ';
      if ('ㄺㅄㄻ'.includes(b.final) && b.final !== '' && next !== undefined && !beforeVowel) problems.push(`${word}: ${b.final} before a consonant`);
      if ('ㅎㄶㅀ'.includes(b.final) && b.final !== '' && !beforeVowel) problems.push(`${word}: ${b.final} not before a vowel`);
    });
  }
  return problems;
}

describe('Word Builder q7-q9 (AMENDMENTS-BATCHIM-COMPLETE BC-1)', () => {
  it('are appended after q6, optional, with no card, stamped above the catalogue version of main (20261107)', () => {
    expect(CELL.quests.map((q) => q.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9].map((k) => `quest:stage2-letters-q${k}`));
    expect(CELL.optionalQuestIds).toEqual([...OPTIONAL]);
    expect(CELL.rewardCardIds).toEqual(['card:norae']);
    for (const q of [Q7, Q8, Q9]) {
      expect(q.rewardCardId, q.id).toBeUndefined();
      expect(q.addedIn, q.id).toBeGreaterThan(20261107);
      expect(q.estimatedMinutes, q.id).toBe(4);
      expect(q.steps.map((s) => s.kind), q.id).toEqual(['intro', 'discover', 'practice', 'apply', 'check', 'reward']);
    }
    expect([Q7, Q8, Q9].map((q) => q.titleEn)).toEqual(['Many Letters, Seven Sounds', 'Two Letters at the Bottom', 'A Quiet h']);
  });

  it('Discover the words of sections 3.3 to 3.5, with the converter romanization and the said syllables', () => {
    const table = (q: LessonQuest) => discoverWords(q).map((w) => [w.ko, w.romanization, w.en, (w.syllables ?? []).join(' ')]);
    expect(table(Q7)).toEqual([
      ['꽃', 'kkot', 'flower', ''],
      ['밭', 'bat', 'field for growing food', ''],
      ['책', 'chaek', 'book', ''],
      ['밖', 'bak', 'outside', ''],
      ['입', 'ip', 'mouth', ''],
      ['잎', 'ip', 'leaf', ''],
    ]);
    expect(table(Q8)).toEqual([
      ['닭', 'dak', 'chicken', ''],
      ['값', 'gap', 'price', ''],
      ['읽어요', 'ilgeoyo', 'read', 'il geo yo'],
      ['없어요', 'eopseoyo', "there is none; I don't have it", 'eop seo yo'],
      ['삶', 'sam', 'life', ''],
    ]);
    expect(table(Q9)).toEqual([
      ['좋아요', 'joayo', 'good; I like it', 'jo a yo'],
      ['넣어요', 'neoeoyo', 'put it in', 'neo eo yo'],
      ['많이', 'mani', 'a lot', 'ma ni'],
      ['괜찮아요', 'gwaenchanayo', "it's okay", 'gwaen cha na yo'],
      ['싫어요', 'sireoyo', "I don't like it", 'si reo yo'],
    ]);
    for (const w of [Q7, Q8, Q9].flatMap(discoverWords)) expect(romanize(w.ko).text, w.ko).toBe(w.romanization);
    // No new letter record: the three quests teach words, so U-2 and U-3's symbol checks are unchanged.
    for (const q of [Q7, Q8, Q9]) {
      const items = q.steps.flatMap((s) => s.discover?.pages ?? []).flatMap((p) => p.items);
      expect(items.every((i) => i.type === 'word'), q.id).toBe(true);
    }
  });

  it('every q8 and q9 Discover word is marked as said otherwise than spelled (soundChange)', () => {
    for (const w of [Q8, Q9].flatMap(discoverWords)) expect(w.soundChange, w.ko).toBe(true);
    for (const w of discoverWords(Q7)) expect(w.soundChange, w.ko).toBeUndefined();
  });

  it('heard rounds: no homophone asked by ear, at most one k / t / p ending a round, options that sound different', () => {
    for (const q of [Q7, Q8, Q9]) {
      for (const scope of q.scopes) {
        if (scope.kind !== 'listen-pick' || scope.rounds.every((r) => r.promptShown === true)) continue;
        for (const round of scope.rounds) {
          expect(['입', '잎', '낮', '낫', '낯', '삶'], `${scope.ref} ${round.id}`).not.toContain(round.prompt.ko);
          const texts = round.options.map((o) => o.text?.ko ?? '');
          expect(texts.filter(endsInStop).length, `${scope.ref} ${round.id}: ${texts.join(' ')}`).toBeLessThanOrEqual(1);
          const said = round.options.map((o) => o.text?.romanization ?? '');
          expect(new Set(said).size, `${scope.ref} ${round.id}`).toBe(said.length);
        }
      }
    }
  });

  it('no Dictation (Type Hangul hear) round; q9 Checks by copying (Type Hangul see)', () => {
    for (const q of [Q7, Q8, Q9]) {
      for (const scope of q.scopes) if (scope.kind === 'type-hangul') for (const r of scope.rounds) expect(r.mode ?? 'see', `${scope.ref} ${r.id}`).toBe('see');
    }
    const check = scopeOf(Q9, 'check');
    expect(check.kind).toBe('type-hangul');
    if (check.kind === 'type-hangul') expect(check.rounds.map((r) => r.target.ko)).toEqual(['좋아요', '괜찮아요']);
  });

  it('a double final only at the end of a word or before a vowel; a bottom ㅎ, ㄶ, ㅀ only before a vowel; each only from its quest on', () => {
    for (const q of [Q7, Q8, Q9]) expect(koStrings(q).flatMap(contextProblems), q.id).toEqual([]);
    const finalsOf = (q: LessonQuest) => new Set(koStrings(q).flatMap((ko) => [...ko].map((ch) => parts(ch)?.final ?? '')));
    for (const f of 'ㄺㅄㄻㅎㄶㅀ') expect(finalsOf(Q7).has(f), `q7 ${f}`).toBe(false);
    for (const f of 'ㅎㄶㅀ') expect(finalsOf(Q8).has(f), `q8 ${f}`).toBe(false);
  });

  it("the Checks: q7 reads 입 / 잎 by the bottom letter; q8 reads two pictured end-letter pairs (no q8 meaning has drawn art)", () => {
    const q7 = scopeOf(Q7, 'check');
    expect(q7.kind).toBe('pic-word-match');
    if (q7.kind === 'pic-word-match') expect(q7.boards.map((b) => b.pairs.map((p) => p.word.ko))).toEqual([['입', '잎', '꽃'], ['밥', '발', '곰']]);
    const q8 = scopeOf(Q8, 'check');
    expect(q8.kind).toBe('listen-pick');
    if (q8.kind === 'listen-pick') {
      expect(q8.rounds.every((r) => r.promptShown === true)).toBe(true);
      expect(q8.rounds.map((r) => r.prompt.ko)).toEqual(['공', '잎']);
      // Each answer has a look-alike option that differs only in the bottom letter: 곰 for 공, 입 for 잎.
      expect(q8.rounds.map((r) => r.options.map((o) => o.id))).toEqual([
        ['gom', 'gong', 'bal'],
        ['ip-mouth', 'kkot', 'ip-leaf'],
      ]);
    }
  });

  it('each quest shows its own note: q7 n7, q8 n8, q9 n9; q6 no longer says "last new letters"', () => {
    const notes = LESSON_CELL_MODULES[CELL.id]!.LESSON_NOTES as Record<string, { id: string }>;
    expect(OPTIONAL.map((id) => notes[id]?.id)).toEqual(['n7', 'n8', 'n9']);
    expect(CELL.culture.filter((n) => ['n7', 'n8', 'n9'].includes(n.id)).every((n) => n.kind === 'language' && (n.sources?.length ?? 0) >= 2)).toBe(true);
    const q6Reward = quest('quest:stage2-letters-q6').steps.find((s) => s.kind === 'reward')!;
    expect(q6Reward.titleEn).toBe('Word Builder Done!');
    expect(q6Reward.hoyaLineEn).not.toMatch(/last new letters/);
  });

  it('no line calls the bottom h quiet without "before a vowel" (section 3.2 item 9)', () => {
    const lines = Q9.steps.flatMap((s) => [s.hoyaLineEn, ...(s.discover?.pages.map((p) => p.captionEn) ?? [])]).filter((l): l is string => l !== undefined);
    for (const line of lines) if (/\bh\b.*\bquiet\b|\bquiet\b.*\bh\b/.test(line) && !/can be quiet/.test(line)) expect(line).toMatch(/before a vowel|the h is quiet, the other one moves over/i);
  });
});
