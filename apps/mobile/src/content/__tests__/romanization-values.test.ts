import {
  checkJamoRomanization,
  checkProse,
  checkRomanization,
  HeritageCardSchema,
  JamoSchema,
  QuestSchema,
} from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { minigameScopes } from '../../logic/minigame-config';
import { AVATAR_PRESETS } from '../../logic/profiles/avatar-catalog';
import { episodesAll } from '../episodes';
import { heritageCardsAll } from '../heritage-cards';
import { jamoAll } from '../jamo';
import { questsAll } from '../quests';

// F-CNT-002 PR 2b: the romanization values that ship in the apps are Revised Romanization,
// unhyphenated, and every taught Korean string carries one. The repo-wide suites arrive in PR 3.

const HANGUL = /[가-힣]/;
const problems = (ko: string, given: string | undefined): string[] =>
  given === undefined || given === ''
    ? [`${ko}: no romanization`]
    : checkRomanization(ko, given).map((f) => f.message);

describe('heritage cards (F-CNT-002)', () => {
  it('every subtitleKo has a Revised Romanization without hyphens', () => {
    const found = heritageCardsAll.flatMap((c) =>
      c.subtitleKo === undefined ? [] : problems(c.subtitleKo, c.romanization),
    );
    expect(found).toEqual([]);
  });

  it('parses with HeritageCardSchema (subtitleKo requires romanization)', () => {
    for (const c of heritageCardsAll) {
      expect(HeritageCardSchema.safeParse(c).success, c.id).toBe(true);
    }
  });

  it('spells the audit words the way they are said', () => {
    const ro = (id: string) => heritageCardsAll.find((c) => c.id === id)?.romanization;
    expect(ro('card:hangul-day')).toBe('hangeullal');
    expect(ro('card:yutnori')).toBe('yunnori');
    expect(ro('card:origami')).toBe('jongijeopgi');
    expect(heritageCardsAll.find((c) => c.id === 'card:family-table')?.subtitleKo).toBe('가족 식탁');
    expect(ro('card:family-table')).toBe('gajok siktak');
  });

  it('prose spells registered words without syllable hyphens', () => {
    const registry = heritageCardsAll.flatMap((c) => (c.subtitleKo === undefined ? [] : [c.subtitleKo]));
    const found = heritageCardsAll.flatMap((c) =>
      [c.blurbEn, c.factEn ?? ''].flatMap((t) => checkProse(t, registry).map((f) => `${c.id}: ${f.message}`)),
    );
    expect(found).toEqual([]);
    expect(heritageCardsAll.find((c) => c.id === 'card:origami')?.factEn).toContain('jongihak');
  });
});

describe('jamo (F-CNT-002)', () => {
  it('every jamo parses and every example word carries its Revised Romanization', () => {
    for (const j of jamoAll) {
      expect(JamoSchema.safeParse(j).success, j.id).toBe(true);
      if (j.exampleWordKo !== undefined) {
        expect(problems(j.exampleWordKo, j.exampleWordRomanization), j.id).toEqual([]);
      }
    }
  });

  it('carries the 24 reviewed example-word romanizations', () => {
    const pairs = jamoAll.flatMap((j) =>
      j.exampleWordKo === undefined ? [] : [`${j.exampleWordKo} ${j.exampleWordRomanization}`],
    );
    expect(pairs).toEqual([
      '가족 gajok', '나무 namu', '달 dal', '라면 ramyeon', '물 mul', '밥 bap', '산 san',
      '아이 ai', '집 jip', '책 chaek', '코 ko', '토끼 tokki', '포도 podo', '하늘 haneul',
      '아빠 appa', '야구 yagu', '엄마 eomma', '여우 yeou', '오리 ori', '요리 yori',
      '우유 uyu', '유리 yuri', '으뜸 eutteum', '이름 ireum',
    ]);
  });

  it('every sound value is listed, and initial ieung reads silent/ng', () => {
    const found = jamoAll.flatMap((j) => checkJamoRomanization(j.char, j.romanization).map((f) => `${j.id}: ${f.message}`));
    expect(found).toEqual([]);
    expect(jamoAll.find((j) => j.id === 'jamo:ieung')?.romanization).toBe('silent/ng');
  });
});

describe('minigame scopes (F-CNT-002)', () => {
  it('every taught Korean string has a Revised Romanization', () => {
    const found: string[] = [];
    for (const [ref, s] of Object.entries(minigameScopes)) {
      for (const p of s.cardPairs ?? []) found.push(...problems(p.ko, p.romanization).map((m) => `${ref}: ${m}`));
      for (const p of s.syllables ?? []) found.push(...problems(p.ko, p.romanization).map((m) => `${ref}: ${m}`));
      for (const p of s.storySteps ?? []) {
        if (p.labelKo !== undefined) found.push(...problems(p.labelKo, p.romanization).map((m) => `${ref}: ${m}`));
      }
      for (const d of s.dialogue ?? []) {
        found.push(...problems(d.npcKo, d.npcRomanization).map((m) => `${ref}: ${m}`));
        for (const o of d.options) found.push(...problems(o.ko, o.romanization).map((m) => `${ref}: ${m}`));
      }
    }
    expect(found).toEqual([]);
  });

  it('carries the twelve reviewed story-step values', () => {
    const steps = Object.values(minigameScopes).flatMap((s) => s.storySteps ?? []);
    expect(steps.map((p) => `${p.labelKo} ${p.romanization}`)).toEqual([
      '손 씻기 son ssitgi',
      '상 차리기 sang charigi',
      '같이 먹기 gachi meokgi',
      '잘 먹었습니다 jal meogeotseumnida',
      '한복 입기 hanbok ipgi',
      '세배 드리기 sebae deurigi',
      '떡국 먹기 tteokguk meokgi',
      '세뱃돈 받기 sebaetdon batgi',
      '편 가르기 pyeon gareugi',
      '윷 던지기 yut deonjigi',
      '말 옮기기 mal omgigi',
      '승리! seungni',
    ]);
  });
});

describe('quests, episodes and avatars (F-CNT-002)', () => {
  it('Korean Hoya lines live in hoyaLineKo, never in an English field', () => {
    for (const q of questsAll) {
      expect(QuestSchema.safeParse(q).success, q.id).toBe(true);
      for (const s of q.steps) {
        for (const text of [s.hoyaLineEn, s.bodyEn]) {
          if (text !== undefined) expect(HANGUL.test(text), `${q.id}/${s.id}: ${text}`).toBe(false);
        }
        if (s.hoyaLineKo !== undefined) {
          expect(problems(s.hoyaLineKo.ko, s.hoyaLineKo.romanization), `${q.id}/${s.id}`).toEqual([]);
        }
      }
    }
  });

  it('the Seollal greeting is a hoyaLineKo with romanization and gloss', () => {
    const step = questsAll.find((q) => q.id === 'quest:stage1-rites-q1')?.steps[0];
    expect(step?.hoyaLineKo).toEqual({
      ko: '새해 복 많이 받으세요.',
      romanization: 'saehae bok mani badeuseyo',
      en: 'Happy New Year!',
    });
    expect(step?.hoyaLineEn).toBe("Happy New Year! Let's learn the greeting.");
  });

  it('English prose uses Revised Romanization (yunnori, not yutnori)', () => {
    const intro = episodesAll.find((e) => e.id === 'episode:stage1-crafts')?.hoyaIntroEn;
    expect(intro).toBe('Let us play yunnori. Throw the sticks!');
  });

  it('avatar names romanize correctly', () => {
    const found = AVATAR_PRESETS.flatMap((a) => problems(a.pillarName, a.romanization));
    expect(found).toEqual([]);
  });
});
