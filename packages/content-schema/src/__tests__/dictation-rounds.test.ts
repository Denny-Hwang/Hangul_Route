import { describe, expect, it } from 'vitest';
import {
  ListenPickRoundSchema,
  RoundSchema,
  TypeHangulRoundSchema,
  isSpellingRound,
  spellingPickToListenPick,
  typeHangulMode,
  type ListenPickRound,
  type TypeHangulRound,
} from '../index';
import { kt } from './helpers/lesson-fixtures';

/**
 * F-CURR-002 row CM-31: Type Hangul `hear` mode (Dictation, section 7.1 F2) and the read-plus-meaning spelling round
 * of Letters S2 (section 4.5), added to the round schemas additively.
 */

const see = { id: 'r', promptEn: 'Type this word', target: kt('사과', 'sagwa', 'apple') };

describe('Type Hangul mode and audioRef (additive)', () => {
  it('parses a round written before CM-31 unchanged, and reads it as see', () => {
    const parsed = TypeHangulRoundSchema.parse(see);
    expect(parsed).toEqual(see);
    expect(typeHangulMode(parsed)).toBe('see');
    // Round trip: what parses serialises to the same JSON and parses again to the same value.
    expect(TypeHangulRoundSchema.parse(JSON.parse(JSON.stringify(parsed)))).toEqual(parsed);
  });

  it('takes mode see or hear and a clip path, and round-trips them', () => {
    const hear = { ...see, mode: 'hear', audioRef: 'audio/vocab/sagwa.mp3', pictureRef: 'word:apple' };
    const parsed = TypeHangulRoundSchema.parse(hear);
    expect(parsed).toEqual(hear);
    expect(typeHangulMode(parsed)).toBe('hear');
    expect(TypeHangulRoundSchema.parse(JSON.parse(JSON.stringify(parsed)))).toEqual(parsed);
    expect(typeHangulMode(TypeHangulRoundSchema.parse({ ...see, mode: 'see' }))).toBe('see');
    expect(RoundSchema.safeParse({ kind: 'type-hangul', data: hear }).success).toBe(true);
  });

  it('refuses another mode and a clip path outside the audio grammar', () => {
    expect(TypeHangulRoundSchema.safeParse({ ...see, mode: 'picture' }).success).toBe(false);
    expect(TypeHangulRoundSchema.safeParse({ ...see, mode: 'HEAR' }).success).toBe(false);
    expect(TypeHangulRoundSchema.safeParse({ ...see, mode: 'hear', audioRef: 'sagwa.mp3' }).success).toBe(false);
    expect(TypeHangulRoundSchema.safeParse({ ...see, mode: 'hear', audioRef: 'audio/lesson/sagwa.wav' }).success).toBe(false);
  });
});

const book = kt('책이', 'chaegi', 'book');
const spelling = {
  id: 'sp1',
  promptKind: 'spelling',
  prompt: book,
  pictureRef: 'word:book',
  options: [
    { id: 'a', text: book },
    { id: 'b', text: kt('채기', 'chaegi', 'book') },
  ],
  answerId: 'a',
  fallbackOptions: [
    { id: 'c', text: kt('학교', 'hakgyo', 'school') },
    { id: 'd', text: kt('우유', 'uyu', 'milk') },
  ],
};

describe('the spelling round (Listen & Pick, promptKind spelling)', () => {
  it('parses a Listen & Pick round written before CM-31 unchanged', () => {
    const plain = { id: 'lp', prompt: kt('나', 'na', 'me'), options: [{ id: 'a', text: kt('나', 'na', 'me') }, { id: 'b', text: kt('너', 'neo', 'you') }], answerId: 'a' };
    const parsed = ListenPickRoundSchema.parse(plain);
    expect(parsed).toEqual(plain);
    expect(isSpellingRound(parsed)).toBe(false);
  });

  it('parses and round-trips a spelling round with its fallback options', () => {
    const parsed = ListenPickRoundSchema.parse(spelling);
    expect(parsed).toEqual(spelling);
    expect(isSpellingRound(parsed)).toBe(true);
    expect(ListenPickRoundSchema.parse(JSON.parse(JSON.stringify(parsed)))).toEqual(parsed);
    // The gloss alone settles it too: the picture is optional.
    const { pictureRef: _picture, ...glossOnly } = spelling;
    expect(ListenPickRoundSchema.safeParse(glossOnly).success).toBe(true);
  });

  it('needs spelling options only, the prompt word as the answer, and fallback options that are new and spelled', () => {
    const issues = (round: unknown): string[] => {
      const r = ListenPickRoundSchema.safeParse(round);
      return r.success ? [] : r.error.issues.map((i) => i.path.join('.'));
    };
    expect(issues({ ...spelling, options: [{ id: 'a', text: book }, { id: 'b', pictureRef: 'word:book' }] })).toContain('options.1.text');
    expect(issues({ ...spelling, answerId: 'b' })).toContain('answerId');
    const { fallbackOptions: _f, ...noFallback } = spelling;
    expect(issues(noFallback)).toContain('fallbackOptions');
    expect(issues({ ...spelling, fallbackOptions: [{ id: 'a', text: kt('학교', 'hakgyo', 'school') }] })).toContain('fallbackOptions.0.id');
    expect(issues({ ...spelling, fallbackOptions: [{ id: 'c', text: kt('채기', 'chaegi', 'book') }] })).toContain('fallbackOptions.0.text.ko');
    expect(issues({ ...spelling, fallbackOptions: [{ id: 'c', pictureRef: 'word:school' }] })).toContain('fallbackOptions.0.text');
    // A plain round carries no spelling-round fields.
    const plain = { id: 'lp', prompt: book, options: spelling.options, answerId: 'a' };
    expect(issues({ ...plain, fallbackOptions: spelling.fallbackOptions })).toContain('fallbackOptions');
    expect(issues({ ...plain, pictureRef: 'word:book' })).toContain('pictureRef');
  });
});

describe('spellingPickToListenPick (the game.spelling-pick fallback)', () => {
  it('is Listen & Pick on the same word: the right spelling, the fallback options, no look-alike, picture or kind', () => {
    const round = ListenPickRoundSchema.parse(spelling) as ListenPickRound;
    const out = spellingPickToListenPick(round);
    expect(out).toEqual({
      id: 'sp1',
      prompt: book,
      options: [{ id: 'a', text: book }, ...spelling.fallbackOptions],
      answerId: 'a',
    });
    expect(ListenPickRoundSchema.safeParse(out).success).toBe(true);
    expect(isSpellingRound(out)).toBe(false);
  });

  it('leaves a round that is not a spelling round as it is', () => {
    const plain = ListenPickRoundSchema.parse({ id: 'lp', prompt: book, options: spelling.options, answerId: 'a' }) as ListenPickRound;
    expect(spellingPickToListenPick(plain)).toBe(plain);
  });
});

describe('typeHangulMode', () => {
  it('reads an absent mode as see', () => {
    const round: TypeHangulRound = { id: 'x', promptEn: 'Type', target: kt('물', 'mul', 'water') };
    expect(typeHangulMode(round)).toBe('see');
    expect(typeHangulMode({ ...round, mode: 'hear' })).toBe('hear');
  });
});
