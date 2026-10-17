import { describe, expect, it } from 'vitest';
import { cardById } from '../../../content';
import { visibleItems } from '../../../content/vocab';
import { CARD_DETAIL_AUDIO_SOURCE, cardSpeech } from '../card-speech';

describe('cardSpeech: the card page says its Korean name (F-AUDIO-004 §3.5)', () => {
  it('a card whose Korean name is the word that reuses its art plays that word, with its clip path', () => {
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

  it("keeps the word's spoken form, and is null for a card with no Korean name", () => {
    const card = { id: 'card:x', subtitleKo: '십' };
    expect(cardSpeech(card, [{ ko: '십', visual: 'card:x', spokenKo: '씹' }])?.text).toBe('씹');
    expect(cardSpeech({ id: 'card:x' }, [])).toBeNull();
  });
});
