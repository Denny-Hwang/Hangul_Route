import { ListenPickRoundSchema, decomposeSyllable } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { jamoAll } from '../../../content/jamo';
import {
  HANGUL_CHECK_CHUNK,
  HANGUL_CHECK_WORDS,
  buildHangulCheck,
  isSymbolItem,
  symbolRound,
} from '../hangul-check';
import { useReviewRunStore, reviewHost } from '../../../store/review-run-store';
import { jamoVoice } from '../../audio/jamo-voice';
import { listenPickSpeech } from '../../audio/listen-pick-speech';
import { speechParams } from '../../audio/rate';
import { roundItemId } from '../../listen-pick';
import { confusablesOf } from '../confusables';
import { tallyReview } from '../review-flow';

describe('buildHangulCheck: the 35 items of the Hangul Check (F-QUEST-002 §3.9)', () => {
  const check = buildHangulCheck({ seed: 7 });

  it('has 30 symbol items, one per symbol, and 5 word items', () => {
    expect(check.items).toHaveLength(35);
    const symbols = check.items.filter((i) => i.kind === 'symbol');
    expect(symbols).toHaveLength(30);
    expect(new Set(symbols.map((i) => i.id))).toEqual(new Set(jamoAll.map((j) => j.id)));
    expect(check.items.filter((i) => i.kind === 'word')).toHaveLength(5);
  });

  it('gives every item 4 options, no two alike, and the answer among them; every round parses', () => {
    for (const item of check.items) {
      expect(item.round.options, item.id).toHaveLength(4);
      expect(new Set(item.round.options.map((o) => o.id)).size, item.id).toBe(4);
      expect(item.round.options.some((o) => o.id === item.round.answerId), item.id).toBe(true);
      expect(ListenPickRoundSchema.safeParse(item.round).success, item.id).toBe(true);
      // The round names the item it credits, so the review host credits the right item (M7: `itemId ?? id`).
      expect(roundItemId(item.round)).toBe(item.id);
    }
  });

  it('asks a consonant or vowel by its name (a letter question, AMENDMENTS-AUDIO-CLIPS JV-A1) among the target and its first three confusables', () => {
    const g = check.items.find((i) => i.id === 'jamo:giyeok');
    expect(g?.round.answerId).toBe('jamo:giyeok');
    expect(new Set(g?.round.options.map((o) => o.id))).toEqual(new Set(['jamo:giyeok', ...confusablesOf('jamo:giyeok')]));
    expect(g?.round.prompt.ko).toBe('기역');
    expect(check.items.find((i) => i.id === 'jamo:nieun')?.round.prompt.ko).toBe('니은');
    expect(check.items.find((i) => i.id === 'jamo:a')?.round.prompt.ko).toBe('아');
  });

  it('asks a final by its syllable with options that differ only in the final (or have none)', () => {
    for (const item of check.items.filter((i) => i.id.endsWith('-batchim'))) {
      const answer = item.round.options.find((o) => o.id === item.round.answerId);
      const target = decomposeSyllable(answer?.text?.ko ?? '');
      expect(target?.initial, item.id).toBe('ㅇ');
      expect(target?.medial, item.id).toBe(0); // ㅏ
      expect(item.round.prompt.ko).toBe(answer?.text?.ko);
      const finals = item.round.options.map((o) => {
        const parts = decomposeSyllable(o.text?.ko ?? '');
        expect(parts?.initial).toBe('ㅇ');
        expect(parts?.medial).toBe(0);
        return parts?.final ?? '';
      });
      expect(new Set(finals).size).toBe(4);
    }
    const prompts = check.items.filter((i) => i.id.endsWith('-batchim')).map((i) => i.round.prompt.ko).sort();
    expect(prompts).toEqual(['악', '안', '알', '암', '압', '앙'].sort());
  });

  it('asks each word by its picture among four of the five theme pictures, one word per theme', () => {
    expect(HANGUL_CHECK_WORDS.map((w) => w.theme)).toEqual(['letters', 'life', 'rites', 'nature', 'crafts']);
    const pictures = new Set(HANGUL_CHECK_WORDS.map((w) => w.picture));
    for (const item of check.items.filter((i) => i.kind === 'word')) {
      const word = HANGUL_CHECK_WORDS.find((w) => w.id === item.id);
      expect(word, item.id).toBeDefined();
      expect(item.round.answerId).toBe(word?.picture);
      expect(item.round.prompt).toEqual(word?.text);
      for (const o of item.round.options) {
        expect(pictures.has(o.pictureRef as never)).toBe(true);
        expect(o.labelEn).toBeTruthy();
      }
    }
  });

  it('comes in 5 chunks of 7: 6 symbols, then 1 word, the words in theme order', () => {
    expect(HANGUL_CHECK_CHUNK).toBe(7);
    expect(check.chunks).toHaveLength(5);
    check.chunks.forEach((chunk, c) => {
      expect(chunk).toHaveLength(7);
      expect(chunk.slice(0, 6).every((i) => i.kind === 'symbol')).toBe(true);
      expect(chunk[6]?.id).toBe(HANGUL_CHECK_WORDS[c]?.id);
    });
    expect(check.chunks.flat()).toEqual(check.items);
  });

  it('is deterministic by seed, and another seed changes the order', () => {
    expect(buildHangulCheck({ seed: 7 })).toEqual(check);
    const other = buildHangulCheck({ seed: 8 });
    expect(other.items.map((i) => i.id)).not.toEqual(check.items.map((i) => i.id));
  });

  it('does not keep the answer first: at index 0 at most 40 % of the time over 200 seeds', () => {
    let first = 0;
    let all = 0;
    for (let seed = 0; seed < 200; seed += 1) {
      for (const item of buildHangulCheck({ seed }).items) {
        all += 1;
        if (item.round.options[0]?.id === item.round.answerId) first += 1;
      }
    }
    expect(first / all).toBeLessThanOrEqual(0.4);
  });

  it('tells symbol items from word items by id', () => {
    expect(isSymbolItem('jamo:giyeok')).toBe(true);
    expect(isSymbolItem('jamo:ieung-batchim')).toBe(true);
    expect(isSymbolItem('word:hangeul')).toBe(false);
  });
});

describe('symbolRound: never a dead item', () => {
  it('throws for a symbol it does not know, and for a final with no distractor row', () => {
    expect(() => symbolRound('jamo:nope')).toThrow(/Unknown symbol/);
    const final = jamoAll.find((j) => j.id === 'jamo:giyeok-batchim')!;
    expect(() => symbolRound('jamo:odd-batchim', [{ ...final, id: 'jamo:odd-batchim' }])).toThrow(/No final syllables/);
    expect(() => symbolRound('jamo:giyeok-batchim', [{ ...final, spokenKo: undefined }])).toThrow(/No final syllables/);
  });
});

describe('M7: every symbol round keeps its Listen & Pick id and plays at the sound rate (AMENDMENTS-AUDIO-CLIPS)', () => {
  const check = buildHangulCheck({ seed: 11 });
  const symbols = check.items.filter((i) => i.kind === 'symbol');

  it('a letter keeps `lp:sym:` and a final keeps `lp:syl:`; the item id rides in `itemId`', () => {
    expect(symbols).toHaveLength(30);
    for (const item of symbols) {
      const final = item.id.endsWith('-batchim');
      expect(item.round.id, item.id).toMatch(final ? /^lp:syl:/ : /^lp:sym:/);
      if (!final) expect(item.round.id).toBe(`lp:sym:${item.id}`);
      expect(item.round.itemId, item.id).toBe(item.id);
    }
    // A word round's id is its item id, with no `itemId`.
    for (const item of check.items.filter((i) => i.kind === 'word')) {
      expect(item.round.id).toBe(item.id);
      expect(item.round.itemId).toBeUndefined();
    }
  });

  it('a final round keeps the syllable options and the "which one did you hear" frame, never the final-letter frame', () => {
    for (const item of symbols.filter((i) => i.id.endsWith('-batchim'))) {
      expect(item.round.options.every((o) => o.text !== undefined && o.text.ko.length === 1 && decomposeSyllable(o.text.ko) !== null), item.id).toBe(true);
    }
  });

  it('both kinds play at the sound rate, a letter by its name and a final by its closed syllable', () => {
    for (const item of symbols) {
      const jamo = jamoAll.find((j) => j.id === item.id)!;
      const speech = listenPickSpeech(item.round);
      expect(speech.kind, item.id).toBe('sound');
      expect(speech.text, item.id).toBe(jamoVoice(jamo, jamo.kind === 'batchim' ? 'sound' : 'letter').text);
      // Never the word rate, which the overwritten round id used to give (M7).
      expect(speechParams(speech.kind ?? 'word', 1).rate, item.id).not.toBe(speechParams('word', 1).rate);
    }
  });

  it('scoring and resume read `itemId ?? id`: each answer is credited to its item, never to the round id', () => {
    useReviewRunStore.getState().begin(check.items.map((i) => i.id));
    const host = reviewHost(() => undefined);
    check.items.forEach((item, i) => host.answer(i, item.kind === 'symbol', { itemId: roundItemId(item.round) }));
    const { answers, itemIds } = useReviewRunStore.getState();
    expect(Object.keys(answers).sort()).toEqual([...itemIds].sort());
    const tally = tallyReview(itemIds, answers);
    expect(tally.unansweredItemIds).toEqual([]);
    expect(tally.missedItemIds.sort()).toEqual(check.items.filter((i) => i.kind === 'word').map((i) => i.id).sort());
    useReviewRunStore.getState().reset();
  });
});
