import { ListenPickRoundSchema, PicWordRoundSchema } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { AUDIO_ASSETS } from '../../content/__generated__/audio-assets';
import { findJamo, jamoAll } from '../../content/jamo';
import { listenPickSpeech } from '../audio/listen-pick-speech';
import { lp, pw } from '../scope-builders';
import * as config from '../minigame-config';

const word = (ko: string, romanization: string, en: string) => ({ ko, romanization, en });
const TAUGHT_L1 = ['jamo:a', 'jamo:eo', 'jamo:giyeok', 'jamo:nieun'];

describe('lp.sym (sound -> written symbol)', () => {
  it('prompts with the spoken sound of the symbol, never its letter name', () => {
    const r = lp.sym('jamo:eo', TAUGHT_L1);
    expect(r.prompt).toMatchObject({ ko: '어', romanization: 'eo' });
    expect(r.prompt.spokenKo).toBeUndefined();
    const g = lp.sym('jamo:giyeok', TAUGHT_L1);
    expect(g.prompt).toMatchObject({ ko: '가', romanization: 'ga' });
  });

  it('speaks the initial ㅇ by its name 이응', () => {
    const r = lp.sym('jamo:ieung', ['jamo:ieung', 'jamo:mieum', 'jamo:siot', 'jamo:hieut']);
    expect(r.prompt).toMatchObject({ ko: '이응', romanization: 'ieung' });
  });

  it('puts the target first, then its taught confusables, as written-symbol options', () => {
    const r = lp.sym('jamo:eo', TAUGHT_L1);
    expect(r.options.map((o) => o.id)).toEqual(['jamo:eo', 'jamo:a']);
    expect(r.answerId).toBe('jamo:eo');
    expect(r.options[0]!.text).toMatchObject({ ko: 'ㅓ', romanization: 'eo' });
    expect(r.options.every((o) => !o.pictureRef)).toBe(true);
  });

  it('fills to four options with taught symbols of the same kind', () => {
    const taught = [...TAUGHT_L1, 'jamo:o', 'jamo:u'];
    const r = lp.sym('jamo:u', taught);
    expect(r.options.map((o) => o.id)).toEqual(['jamo:u', 'jamo:o', 'jamo:a', 'jamo:eo']);
  });

  it('is a valid round and never shows the answer in the prompt text', () => {
    for (const j of jamoAll.filter((x) => x.kind !== 'batchim')) {
      const kindMates = jamoAll.filter((x) => x.kind === j.kind).map((x) => x.id);
      const r = lp.sym(j.id, kindMates);
      expect(ListenPickRoundSchema.safeParse(r).success, j.id).toBe(true);
      expect(r.prompt.ko, j.id).not.toBe(j.char);
    }
  });

  it("carries the letter's audioRef on the prompt when the record names one, and none when it does not", () => {
    const giyeok = findJamo('jamo:giyeok')!;
    expect(giyeok.audioRef).toBe('audio/jamo/giyeok.mp3');
    const r = lp.sym('jamo:giyeok', TAUGHT_L1);
    expect(r.prompt).toEqual({ ko: '가', romanization: 'ga', en: 'the letter giyeok', audioRef: 'audio/jamo/giyeok.mp3' });
    // The options are the written symbols: no recording rides on them.
    expect(r.options.every((o) => o.text?.audioRef === undefined)).toBe(true);

    const eo = findJamo('jamo:eo')!;
    const ref = eo.audioRef;
    delete eo.audioRef;
    try {
      const bare = lp.sym('jamo:eo', TAUGHT_L1);
      expect(bare.prompt).toEqual({ ko: '어', romanization: 'eo', en: 'the letter eo' });
      expect('audioRef' in bare.prompt).toBe(false);
    } finally {
      if (ref !== undefined) eo.audioRef = ref;
    }
  });

  it('every Stage 1 letter round is the same round with only the letter audioRef added, and no clip is bundled yet', () => {
    let seen = 0;
    for (const scope of Object.values(config.minigameScopes)) {
      for (const round of scope.listenPick?.rounds ?? []) {
        if (!round.id.startsWith('lp:sym:')) continue;
        seen += 1;
        const jamo = findJamo(round.answerId)!;
        const { audioRef, ...rest } = round.prompt;
        expect(audioRef, round.id).toBe(jamo.audioRef);
        expect(rest, round.id).toEqual({ ko: jamo.spokenKo, romanization: jamo.spokenRomanization, en: `the letter ${jamo.nameEn}` });
        // No file for the ref: the prompt still plays through the voice, as before (F-AUDIO-004 AD4).
        expect(Object.prototype.hasOwnProperty.call(AUDIO_ASSETS, audioRef!), round.id).toBe(false);
        // Still a sound prompt: the carrier syllable at the sound rate, with the recording to try first.
        expect(listenPickSpeech(round), round.id).toEqual({ text: jamo.spokenKo, kind: 'sound', source: 'listen-pick', audioRef });
      }
    }
    expect(seen).toBeGreaterThan(0);
  });

  it('rejects a batchim (those quests ask syllables) and an unknown id', () => {
    expect(() => lp.sym('jamo:nieun-batchim', TAUGHT_L1)).toThrow();
    expect(() => lp.sym('jamo:nope', TAUGHT_L1)).toThrow(/Unknown symbol/);
  });

  it('needs at least two taught symbols of the kind', () => {
    expect(() => lp.sym('jamo:giyeok', ['jamo:giyeok'])).toThrow(/two options/);
  });

  it('takes explicit options when too few of a kind are taught (quest 1: the four new symbols)', () => {
    const r = lp.sym('jamo:eo', TAUGHT_L1, { optionIds: ['jamo:a', 'jamo:eo', 'jamo:giyeok', 'jamo:nieun'] });
    expect(r.options.map((o) => o.id)).toEqual(['jamo:eo', 'jamo:a', 'jamo:giyeok', 'jamo:nieun']);
    expect(r.answerId).toBe('jamo:eo');
    expect(r.options[2]!.text).toMatchObject({ ko: 'ㄱ', romanization: 'g/k' });
    expect(ListenPickRoundSchema.safeParse(r).success).toBe(true);
  });

  it('rejects explicit options that leave out the target, repeat one, or name an untaught or unknown symbol', () => {
    expect(() => lp.sym('jamo:eo', TAUGHT_L1, { optionIds: ['jamo:a', 'jamo:giyeok'] })).toThrow(/target/);
    expect(() => lp.sym('jamo:eo', TAUGHT_L1, { optionIds: ['jamo:eo', 'jamo:a', 'jamo:a'] })).toThrow(/twice/);
    expect(() => lp.sym('jamo:eo', TAUGHT_L1, { optionIds: ['jamo:eo', 'jamo:o'] })).toThrow(/not taught/);
    expect(() => lp.sym('jamo:eo', [...TAUGHT_L1, 'jamo:nope'], { optionIds: ['jamo:eo', 'jamo:nope'] })).toThrow(/Unknown symbol/);
    expect(() => lp.sym('jamo:eo', TAUGHT_L1, { optionIds: ['jamo:eo'] })).toThrow(/two options/);
  });
});

describe('lp.syl (syllable -> written syllable)', () => {
  it('builds options that differ only in the final, target first', () => {
    const r = lp.syl('달', ['다', '단']);
    expect(r.options.map((o) => o.text!.ko)).toEqual(['달', '다', '단']);
    expect(r.answerId).toBe('달');
    expect(r.prompt).toMatchObject({ ko: '달', romanization: 'dal' });
    expect(r.options.map((o) => o.text!.romanization)).toEqual(['dal', 'da', 'dan']);
    expect(ListenPickRoundSchema.safeParse(r).success).toBe(true);
  });

  it('works with distractorsFor-style open and closed syllables', () => {
    const r = lp.syl('곰', ['고', '공', '골']);
    expect(r.options).toHaveLength(4);
  });

  it('uses the gloss for the target and a pronunciation line for the others', () => {
    const r = lp.syl('달', ['다'], 'moon');
    expect(r.options[0]!.text!.en).toBe('moon');
    expect(r.options[1]!.text!.en).toBe('the syllable da');
    expect(lp.syl('달', ['다']).options[0]!.text!.en).toBe('the syllable dal');
  });

  it('rejects options that differ in more than the final', () => {
    expect(() => lp.syl('달', ['돌'])).toThrow(/only in the final/);
    expect(() => lp.syl('달', ['나'])).toThrow(/only in the final/);
  });

  it('rejects anything that is not one syllable', () => {
    expect(() => lp.syl('ㄷ', ['다'])).toThrow(/one Hangul syllable/);
    expect(() => lp.syl('달', ['다달'])).toThrow(/one Hangul syllable/);
  });

  it('rejects a repeated option', () => {
    expect(() => lp.syl('달', ['다', '다'])).toThrow();
    expect(() => lp.syl('달', ['달'])).toThrow();
  });
});

describe('lp.word (word -> written word)', () => {
  const target = word('나무', 'namu', 'tree');
  const others = [word('너무', 'neomu', 'too much'), word('가구', 'gagu', 'furniture'), word('오', 'o', 'five')];

  it('puts the target first and keeps every gloss', () => {
    const r = lp.word(target, others);
    expect(r.answerId).toBe('나무');
    expect(r.options.map((o) => o.text!.ko)).toEqual(['나무', '너무', '가구', '오']);
    expect(r.prompt).toEqual(target);
    expect(r.options[1]!.text).toEqual(others[0]);
    expect(ListenPickRoundSchema.safeParse(r).success).toBe(true);
  });

  it('keeps the spoken form of the target on the prompt only', () => {
    const r = lp.word({ ...target, spokenKo: '나무' }, others);
    expect(r.prompt.spokenKo).toBe('나무');
  });

  it('rejects a repeated word and a lone option', () => {
    expect(() => lp.word(target, [target])).toThrow();
    expect(() => lp.word(target, [])).toThrow();
  });
});

describe('lp.pic (word -> picture)', () => {
  const sanSan = word('산', 'san', 'mountain');

  it('labels card pictures with the card title, target first', () => {
    const r = lp.pic(sanSan, ['card:mountain', 'card:sea', 'card:moon', 'card:tiger']);
    expect(r.answerId).toBe('card:mountain');
    expect(r.options.map((o) => o.pictureRef)).toEqual(['card:mountain', 'card:sea', 'card:moon', 'card:tiger']);
    expect(r.options.every((o) => (o.labelEn ?? '').length > 0 && !o.text)).toBe(true);
    expect(r.prompt).toEqual(sanSan);
    expect(ListenPickRoundSchema.safeParse(r).success).toBe(true);
  });

  it('takes an explicit label for pictures that are not cards', () => {
    const r = lp.pic(word('빨강', 'ppalgang', 'red'), [
      { pictureRef: 'swatch:brand-primary', labelEn: 'Red' },
      { pictureRef: 'card:moon' },
    ]);
    expect(r.options[0]).toMatchObject({ id: 'swatch:brand-primary', pictureRef: 'swatch:brand-primary', labelEn: 'Red' });
    expect(r.options[1]!.labelEn).toBeTruthy();
  });

  it('needs a label when the picture is not a known card', () => {
    expect(() => lp.pic(sanSan, ['card:mountain', 'word:rock'])).toThrow(/label/);
    expect(() => lp.pic(sanSan, ['card:mountain', 'card:no-such-card'])).toThrow(/label/);
  });

  it('rejects a repeated picture', () => {
    expect(() => lp.pic(sanSan, ['card:mountain', 'card:mountain'])).toThrow();
  });
});

describe('pw (one Pic-Word Match board)', () => {
  const pairs = [
    { word: word('김치', 'gimchi', 'kimchi'), picture: 'card:kimchi' },
    { word: word('밥', 'bap', 'rice'), picture: 'card:rice' },
    { word: word('김밥', 'gimbap', 'kimbap'), picture: 'card:kimbap' },
    { word: word('젓가락', 'jeotgarak', 'chopsticks'), picture: 'card:chopsticks' },
  ] as const;

  it('builds a valid board with ids from the romanization', () => {
    const board = pw(pairs);
    expect(PicWordRoundSchema.safeParse(board).success).toBe(true);
    expect(board.pairs.map((p) => p.id)).toEqual(['gimchi', 'bap', 'gimbap', 'jeotgarak']);
    expect(board.pairs[0]).toMatchObject({ pictureRef: 'card:kimchi', word: pairs[0].word });
  });

  it('keeps an explicit id and allows a pair without a picture', () => {
    const board = pw([{ id: 'p1', word: pairs[0].word }, pairs[1], pairs[2]]);
    expect(board.pairs[0]).toMatchObject({ id: 'p1' });
    expect(board.pairs[0]!.pictureRef).toBeUndefined();
  });

  it('rejects fewer than three or more than five pairs', () => {
    expect(() => pw(pairs.slice(0, 2))).toThrow();
    expect(() => pw([...pairs, { word: word('엄마', 'eomma', 'mom') }, { word: word('아빠', 'appa', 'dad') }])).toThrow();
  });

  it('rejects a repeated word', () => {
    expect(() => pw([pairs[0], pairs[1], { word: pairs[0].word }])).toThrow();
  });
});

describe('minigame-config re-exports the builders (F-QUEST-002 §3.7)', () => {
  it('exposes lp and pw next to the scopes', () => {
    expect(config.lp).toBe(lp);
    expect(config.pw).toBe(pw);
  });
});
