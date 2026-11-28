import { describe, expect, it } from 'vitest';
import { ROMANIZATION_EXCEPTIONS } from '../index';
import { ROMANIZATION_EXCEPTION_NOTES, entryWithNote } from '../romanization/lint';

/**
 * AMENDMENTS-START-BUNDLE-2026-11 SB-4a, decision D2: the reviewed entries' reasons and gaps live in `exception-notes.ts`, off
 * the barrel; the entries (`ko`, `allowed`) stay in `exceptions.ts`. These tests keep the two in step.
 */

/** The thirteen entries as they were on main before the split (`exceptions.ts` at 97adaa0a3), reasons word for word. */
const BEFORE_THE_SPLIT: ReadonlyArray<{ ko: string; allowed: string[]; gap: string; reason: string }> = [
  { ko: "솔잎", allowed: ['sollip'], gap: "n-insertion", reason: "표준 발음법 제29항 붙임 1: ㄴ-insertion after ㄹ, 솔잎 is said [솔립], RR sollip; the converter has no compound rule and gives sorip" },
  { ko: "왜 기록할까요?", allowed: ['wae girokalkkayo'], gap: "predicate-h", reason: "로마자 표기법 제3장 제1항 4: ㄱ+ㅎ across the noun-verb join of 기록하다 aspirates in the verb ending (기록할까요 [기로칼까요]); the converter keeps the noun convention (묵호 mukho) and gives girokhalkkayo" },
  { ko: "송편은 솔잎을 깔고 쪄요.", allowed: ['songpyeoneun sollipeul kkalgo jjyeoyo.'], gap: "n-insertion", reason: "표준 발음법 제29항 붙임 1: ㄴ-insertion in 솔잎 (said [솔립], RR sollip) carries into 솔잎을 [솔리플]; the converter has no compound rule and gives soripeul" },
  { ko: "호랑이가 엄마인 척해요.", allowed: ['horangiga eommain cheokaeyo.'], gap: "predicate-h", reason: "로마자 표기법 제3장 제1항 4: ㄱ+ㅎ across the noun-verb join of 척하다 aspirates in the verb ending (척해요 [처캐요]); the converter keeps the noun convention (묵호 mukho) and gives cheokhaeyo" },
  { ko: "기록했어요", allowed: ['girokaesseoyo'], gap: "predicate-h", reason: "로마자 표기법 제3장 제1항 4: ㄱ+ㅎ across the noun-verb join of 기록하다 (as 왜 기록할까요? above); the converter gives girokhaesseoyo; the verb ending aspirates" },
  { ko: "사관이 기록했어요.", allowed: ['sagwani girokaesseoyo.'], gap: "predicate-h", reason: "로마자 표기법 제3장 제1항 4: ㄱ+ㅎ across the noun-verb join of 기록하다 (as 왜 기록할까요? above); the converter gives girokhaesseoyo; the verb ending aspirates" },
  { ko: "사관이 왕의 말을 기록했어요.", allowed: ['sagwani wangui mareul girokaesseoyo.'], gap: "predicate-h", reason: "로마자 표기법 제3장 제1항 4: ㄱ+ㅎ across the noun-verb join of 기록하다 (as 왜 기록할까요? above); the converter gives girokhaesseoyo; the verb ending aspirates" },
  { ko: "화성을 기록했어요.", allowed: ['hwaseongeul girokaesseoyo.'], gap: "predicate-h", reason: "로마자 표기법 제3장 제1항 4: ㄱ+ㅎ across the noun-verb join of 기록하다 (as 왜 기록할까요? above); the converter gives girokhaesseoyo; the verb ending aspirates" },
  { ko: "북한산", allowed: ['bukhansan'], gap: "predicate-h", reason: "a noun (체언), so 로마자 표기법 제3장 제1항 4 다만 keeps the ㅎ (Bukhansan); the converter is right, the entry only confirms it" },
  { ko: "북한산에", allowed: ['bukhansane'], gap: "predicate-h", reason: "a noun (체언) with a particle, so 로마자 표기법 제3장 제1항 4 다만 keeps the ㅎ (Bukhansane); the converter is right, the entry only confirms it" },
  { ko: "따뜻해요", allowed: ['ttatteutaeyo'], gap: "predicate-h", reason: "로마자 표기법 제3장 제1항 4, 표준 발음법 제12항 붙임 2: ㅅ+ㅎ in a 하다 predicate is said [따뜨태요]; the verb form aspirates (OD-RG1 (a)), the converter keeps the ㅎ and gives ttatteuthaeyo" },
  { ko: "딱딱해요", allowed: ['ttakttakaeyo'], gap: "predicate-h", reason: "로마자 표기법 제3장 제1항 4, 표준 발음법 제12항 붙임 1: ㄱ+ㅎ in a 하다 predicate is said [딱따캐요]; the verb form aspirates (OD-RG1 (a)), the converter keeps the ㅎ and gives ttakttakhaeyo" },
  { ko: "축하해요", allowed: ['chukahaeyo'], gap: "predicate-h", reason: "로마자 표기법 제3장 제1항 4, 표준 발음법 제12항 붙임 1: ㄱ+ㅎ in the 하다 predicate 축하하다 is said [추카해요]; the verb form aspirates (OD-RG1 (a)), the converter keeps the ㅎ and gives chukhahaeyo" },
];

describe('the notes of the reviewed entries (SB-4a, D2)', () => {
  it('every entry has a note and every note has an entry, and no ko repeats', () => {
    const kos = ROMANIZATION_EXCEPTIONS.map((e) => e.ko);
    expect(new Set(kos).size, 'a repeated ko').toBe(kos.length);
    expect(Object.keys(ROMANIZATION_EXCEPTION_NOTES).sort()).toEqual([...kos].sort());
    for (const ko of kos) expect(ROMANIZATION_EXCEPTION_NOTES[ko], `${ko} has no note`).toBeDefined();
  });

  it('every note holds a gap and a reason', () => {
    for (const [ko, note] of Object.entries(ROMANIZATION_EXCEPTION_NOTES)) {
      expect(note.reason.trim(), ko).not.toBe('');
      expect(note.gap, ko).not.toBe('');
    }
  });

  it('every note reads word for word as the reason and gap it replaces (the fixture is main before the move)', () => {
    expect(BEFORE_THE_SPLIT).toHaveLength(13);
    expect(ROMANIZATION_EXCEPTIONS.map((e) => ({ ko: e.ko, allowed: e.allowed }))).toEqual(
      BEFORE_THE_SPLIT.map(({ ko, allowed }) => ({ ko, allowed })),
    );
    for (const before of BEFORE_THE_SPLIT) {
      expect(ROMANIZATION_EXCEPTION_NOTES[before.ko], before.ko).toEqual({ gap: before.gap, reason: before.reason });
      expect(entryWithNote({ ko: before.ko, allowed: before.allowed }), before.ko).toEqual(before);
    }
  });
});

describe('entryWithNote', () => {
  it('joins the note to a slim entry', () => {
    expect(entryWithNote({ ko: '솔잎', allowed: ['sollip'] })).toEqual({
      ko: '솔잎',
      allowed: ['sollip'],
      gap: 'n-insertion',
      reason: ROMANIZATION_EXCEPTION_NOTES['솔잎']?.reason,
    });
  });

  it('keeps the reason and the gap an entry brings itself, even when empty', () => {
    expect(entryWithNote({ ko: '솔잎', allowed: ['sollip'], gap: 'other', reason: '' })).toEqual({ ko: '솔잎', allowed: ['sollip'], gap: 'other', reason: '' });
    expect(entryWithNote({ ko: '솔잎', allowed: ['sollip'], reason: 'mine' })).toMatchObject({ gap: 'n-insertion', reason: 'mine' });
    expect(entryWithNote({ ko: '솔잎', allowed: ['sollip'], gap: 'proper-noun' })).toMatchObject({
      gap: 'proper-noun',
      reason: ROMANIZATION_EXCEPTION_NOTES['솔잎']?.reason,
    });
  });

  it('reads an entry with no note as no reason and gap other (rule R8 reports it)', () => {
    expect(entryWithNote({ ko: '꽃잎', allowed: ['kkonnip'] })).toEqual({ ko: '꽃잎', allowed: ['kkonnip'], gap: 'other', reason: '' });
    expect(entryWithNote({ ko: 'constructor', allowed: ['x'] })).toMatchObject({ gap: 'other', reason: '' });
  });
});
