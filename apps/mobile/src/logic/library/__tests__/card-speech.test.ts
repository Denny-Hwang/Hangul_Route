import { describe, expect, it } from 'vitest';
import { cardById } from '../../../content';
import { visibleItems } from '../../../content/vocab';
import { CARD_DETAIL_AUDIO_SOURCE, cardSpeech } from '../card-speech';

describe('cardSpeech: the card page says its Korean name (F-AUDIO-004 §3.5)', () => {
  it('a card whose Korean name is a vocabulary word plays that word, with its clip path (the word has its own glyph since PX-1)', () => {
    const hanbok = cardById('card:hanbok');
    expect(hanbok?.subtitleKo).toBe('한복');
    expect(cardSpeech(hanbok!, visibleItems)).toEqual({
      text: '한복',
      audioRef: 'audio/vocab/hanbok.mp3',
      kind: 'word',
      source: CARD_DETAIL_AUDIO_SOURCE,
    });
  });

  it('with no such word the device voice says the name; a word with the same art but another name is not used', () => {
    const card = { id: 'card:hanbok', subtitleKo: '한복' };
    expect(cardSpeech(card, [])).toEqual({ text: '한복', kind: 'word', source: 'card-detail' });
    const other = [{ ko: '설빔', visual: 'card:hanbok', audioRef: 'audio/vocab/seolbim.mp3' }];
    expect(cardSpeech(card, other)).toEqual({ text: '한복', kind: 'word', source: 'card-detail' });
  });

  it('takes the one word of the same name whatever its picture, prefers a word drawn with the card, and skips a homonym pair', () => {
    const card = { id: 'card:dal', subtitleKo: '달' };
    const moon = { ko: '달', visual: 'word:nature-moon', audioRef: 'audio/vocab/dal-moon.mp3' };
    const month = { ko: '달', visual: 'word:count-1', audioRef: 'audio/vocab/dal-month.mp3' };
    expect(cardSpeech(card, [moon])).toEqual({ text: '달', audioRef: 'audio/vocab/dal-moon.mp3', kind: 'word', source: 'card-detail' });
    expect(cardSpeech(card, [moon, month])).toEqual({ text: '달', kind: 'word', source: 'card-detail' });
    const drawn = { ...month, visual: 'card:dal' };
    expect(cardSpeech(card, [moon, drawn])?.audioRef).toBe('audio/vocab/dal-month.mp3');
  });

  it('every card that a word borrowed until PX-1 still plays that word', () => {
    for (const id of ['rice', 'kimchi', 'kimbap', 'tiger', 'book', 'mountain', 'sea', 'moon', 'hanbok', 'seollal', 'chuseok', 'yutnori', 'gayageum']) {
      const card = cardById(`card:${id}`)!;
      const word = visibleItems.find((w) => w.ko === card.subtitleKo);
      expect(word, id).toBeDefined();
      expect(cardSpeech(card, visibleItems)?.audioRef, id).toBe(word!.audioRef);
    }
  });

  it("keeps the word's spoken form, and is null for a card with no Korean name", () => {
    const card = { id: 'card:x', subtitleKo: '십' };
    expect(cardSpeech(card, [{ ko: '십', visual: 'card:x', spokenKo: '씹' }])?.text).toBe('씹');
    expect(cardSpeech({ id: 'card:x' }, [])).toBeNull();
  });
});
