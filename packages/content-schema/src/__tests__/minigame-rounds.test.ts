import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  ListenPickOptionSchema,
  ListenPickRoundSchema,
  MinigameKindSchema,
  MinigameSchema,
  PicWordPairSchema,
  PicWordRoundSchema,
  RoundSchema,
} from '../index';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'content', 'fixtures');
function fixture<T>(name: string): T {
  return JSON.parse(readFileSync(join(FIXTURES, name), 'utf8')) as T;
}

const kText = (ko: string, romanization: string, en: string) => ({ ko, romanization, en });

describe('minigame kinds', () => {
  it('adds listen-pick and pic-word-match without removing any kind', () => {
    expect(MinigameKindSchema.options).toEqual(
      expect.arrayContaining(['match-sound', 'card-match', 'culture-quiz', 'listen-pick', 'pic-word-match']),
    );
    expect(MinigameKindSchema.options).toHaveLength(15);
  });
});

describe('ListenPickOptionSchema', () => {
  it('accepts a text option, a picture option and an option with both', () => {
    expect(ListenPickOptionSchema.safeParse({ id: 'a', text: kText('ㅓ', 'eo', 'eo') }).success).toBe(true);
    expect(ListenPickOptionSchema.safeParse({ id: 'a', pictureRef: 'card:kimchi', labelEn: 'kimchi' }).success).toBe(true);
    expect(
      ListenPickOptionSchema.safeParse({ id: 'a', text: kText('ㅓ', 'eo', 'eo'), pictureRef: 'card:kimchi' }).success,
    ).toBe(true);
  });

  it('needs text or a picture', () => {
    const r = ListenPickOptionSchema.safeParse({ id: 'a', labelEn: 'nothing' });
    expect(r.success).toBe(false);
  });

  it('caps labelEn at 40 characters and checks the picture reference', () => {
    expect(ListenPickOptionSchema.safeParse({ id: 'a', pictureRef: 'card:x', labelEn: 'x'.repeat(41) }).success).toBe(false);
    expect(ListenPickOptionSchema.safeParse({ id: 'a', pictureRef: 'emoji:x' }).success).toBe(false);
  });
});

describe('ListenPickRoundSchema (fixtures)', () => {
  it('parses every round of listen-pick.valid.json', () => {
    const { rounds } = fixture<{ rounds: unknown[] }>('listen-pick.valid.json');
    expect(rounds.length).toBeGreaterThanOrEqual(3);
    for (const round of rounds) {
      expect(ListenPickRoundSchema.safeParse(round).success).toBe(true);
    }
  });

  it('rejects every case of listen-pick.invalid.json', () => {
    const { cases } = fixture<{ cases: { name: string; round: unknown }[] }>('listen-pick.invalid.json');
    expect(cases.length).toBeGreaterThanOrEqual(6);
    for (const c of cases) {
      expect(ListenPickRoundSchema.safeParse(c.round).success, c.name).toBe(false);
    }
  });
});

describe('ListenPickRoundSchema (rules and issue paths)', () => {
  const round = {
    id: 'r1',
    prompt: kText('어', 'eo', 'eo'),
    options: [
      { id: 'a', text: kText('ㅏ', 'a', 'a') },
      { id: 'b', text: kText('ㅓ', 'eo', 'eo') },
    ],
    answerId: 'b',
  };
  const paths = (input: unknown) => {
    const r = ListenPickRoundSchema.safeParse(input);
    return r.success ? [] : r.error.issues.map((i) => i.path.join('.'));
  };

  it('accepts a two-option round and a four-option round, rejects five', () => {
    expect(ListenPickRoundSchema.safeParse(round).success).toBe(true);
    const four = [...round.options, { id: 'c', text: kText('ㄱ', 'g', 'g') }, { id: 'd', text: kText('ㄴ', 'n', 'n') }];
    expect(ListenPickRoundSchema.safeParse({ ...round, options: four }).success).toBe(true);
    const five = [...four, { id: 'e', text: kText('ㄷ', 'd', 'd') }];
    expect(ListenPickRoundSchema.safeParse({ ...round, options: five }).success).toBe(false);
  });

  it('requires a prompt in KoText shape', () => {
    expect(ListenPickRoundSchema.safeParse({ ...round, prompt: { ko: '어' } }).success).toBe(false);
  });

  it('points at answerId when it is not an option', () => {
    expect(paths({ ...round, answerId: 'zzz' })).toContain('answerId');
  });

  it('points at options when ids repeat', () => {
    const dup = { ...round, options: [round.options[0], { ...round.options[1], id: 'a' }], answerId: 'a' };
    expect(paths(dup)).toContain('options.1.id');
  });

  it('points at options when two share Korean text or a picture', () => {
    const sameText = { ...round, options: [round.options[0], { id: 'b', text: kText('ㅏ', 'a', 'again') }] };
    expect(paths(sameText)).toContain('options.1.text.ko');
    const samePic = {
      ...round,
      options: [
        { id: 'a', pictureRef: 'card:kimchi' },
        { id: 'b', pictureRef: 'card:kimchi' },
      ],
    };
    expect(paths(samePic)).toContain('options.1.pictureRef');
  });

  it('lets two options share text only when the other has none (picture vs text options)', () => {
    const mixed = {
      ...round,
      options: [
        { id: 'a', pictureRef: 'card:kimchi' },
        { id: 'b', text: kText('ㅓ', 'eo', 'eo') },
      ],
    };
    expect(ListenPickRoundSchema.safeParse(mixed).success).toBe(true);
  });
});

describe('PicWordRoundSchema', () => {
  const pair = (id: string, ko: string, pictureRef?: string) => ({
    id,
    word: kText(ko, id, id),
    ...(pictureRef ? { pictureRef } : {}),
  });
  const three = [pair('a', '가', 'card:a'), pair('b', '나', 'card:b'), pair('c', '다')];
  const paths = (input: unknown) => {
    const r = PicWordRoundSchema.safeParse(input);
    return r.success ? [] : r.error.issues.map((i) => i.path.join('.'));
  };

  it('parses every board of pic-word-match.valid.json', () => {
    const { boards } = fixture<{ boards: unknown[] }>('pic-word-match.valid.json');
    expect(boards.length).toBeGreaterThanOrEqual(2);
    for (const board of boards) {
      expect(PicWordRoundSchema.safeParse(board).success).toBe(true);
    }
  });

  it('rejects every case of pic-word-match.invalid.json', () => {
    const { cases } = fixture<{ cases: { name: string; board: unknown }[] }>('pic-word-match.invalid.json');
    expect(cases.length).toBeGreaterThanOrEqual(6);
    for (const c of cases) {
      expect(PicWordRoundSchema.safeParse(c.board).success, c.name).toBe(false);
    }
  });

  it('allows a pair without a picture', () => {
    expect(PicWordPairSchema.safeParse(pair('a', '가')).success).toBe(true);
  });

  it('needs 3 to 5 pairs', () => {
    expect(PicWordRoundSchema.safeParse({ pairs: three }).success).toBe(true);
    expect(PicWordRoundSchema.safeParse({ pairs: three.slice(0, 2) }).success).toBe(false);
  });

  it('points at the repeated id, Korean word and picture', () => {
    expect(paths({ pairs: [three[0], { ...three[1], id: 'a' }, three[2]] })).toContain('pairs.1.id');
    expect(paths({ pairs: [three[0], { ...three[1], word: three[0]?.word }, three[2]] })).toContain('pairs.1.word.ko');
    expect(paths({ pairs: [three[0], { ...three[1], pictureRef: 'card:a' }, three[2]] })).toContain('pairs.1.pictureRef');
  });
});

describe('RoundSchema and MinigameSchema', () => {
  const lp = fixture<{ rounds: unknown[] }>('listen-pick.valid.json').rounds[0];
  const pw = fixture<{ boards: unknown[] }>('pic-word-match.valid.json').boards[0];

  it('accepts the new listen-pick and pic-word-match rounds', () => {
    expect(RoundSchema.safeParse({ kind: 'listen-pick', data: lp }).success).toBe(true);
    expect(RoundSchema.safeParse({ kind: 'pic-word-match', data: pw }).success).toBe(true);
  });

  it('rejects the wrong payload for a kind', () => {
    expect(RoundSchema.safeParse({ kind: 'listen-pick', data: pw }).success).toBe(false);
    expect(RoundSchema.safeParse({ kind: 'pic-word-match', data: lp }).success).toBe(false);
  });

  it('still accepts the existing round kinds', () => {
    expect(
      RoundSchema.safeParse({ kind: 'match-sound', data: { promptJamoId: 'jamo:a', tileJamoIds: ['jamo:a', 'jamo:eo'] } }).success,
    ).toBe(true);
  });

  it('lets a Minigame carry listen-pick rounds', () => {
    expect(
      MinigameSchema.safeParse({
        id: 'minigame:s1-letters-q1-check',
        kind: 'listen-pick',
        family: 'recognition',
        titleEn: 'Quick check',
        blurbEn: 'Two quick ones.',
        rounds: [{ kind: 'listen-pick', data: lp }],
      }).success,
    ).toBe(true);
  });
});
