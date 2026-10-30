import { ClozePickRoundSchema, ListenPickRoundSchema, RealiaSchema, checkRomanization, fillClozeGap } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { validRounds } from '../../listen-pick';
import { CLOZE_FIXTURE_REALIA, CLOZE_FIXTURE_ROUNDS, clozeFixtureScope } from '../e2e-rounds';
import { clozeFallbackScope, clozeToListenPick, filledSentence, labelSentence, spokenGap, tileId, validClozeRounds } from '../round';

const { word, particle, value } = CLOZE_FIXTURE_ROUNDS;

describe('Cloze Pick fixture rounds (never shipped content)', () => {
  it('match the round schema; the Korean carries the converter romanization', () => {
    for (const round of Object.values(CLOZE_FIXTURE_ROUNDS)) {
      expect(ClozePickRoundSchema.safeParse(round).success, round.id).toBe(true);
      const done = filledSentence(round);
      expect(checkRomanization(done.ko, done.romanization), round.id).toEqual([]);
      for (const tile of round.tiles) expect(checkRomanization(tile.ko, tile.romanization), `${round.id} ${tile.ko}`).toEqual([]);
    }
    expect(RealiaSchema.safeParse(CLOZE_FIXTURE_REALIA).success).toBe(true);
    for (const entry of CLOZE_FIXTURE_REALIA.entries) expect(checkRomanization(entry.text.ko, entry.text.romanization)).toEqual([]);
  });
});

describe('the completed sentence', () => {
  it('fills the gap of the Korean and of the romanization with the answer tile', () => {
    expect(filledSentence(word)).toEqual({ ko: '책을 읽어요.', romanization: 'chaegeul ilgeoyo.', en: 'I read a book.' });
  });

  it('takes a particle gap romanization as given (the particle links to the word before it)', () => {
    expect(filledSentence(particle).romanization).toBe('mureul masyeoyo.');
    expect(fillClozeGap(particle.sentence.romanization, 'eul')).toBe('muleul masyeoyo.');
  });

  it('fills a value gap meaning with the value meaning, never with Korean', () => {
    expect(filledSentence(value)).toMatchObject({ ko: '삼천 원이에요.', romanization: 'samcheon wonieyo.', en: 'It is three thousand won.' });
  });

  it('carries the sentence spoken form and recording, filled', () => {
    const spoken = { ...word, sentence: { ...word.sentence, spokenKo: '책을 ___', audioRef: 'audio/e2e/chaek.mp3' } };
    expect(filledSentence(spoken)).toMatchObject({ spokenKo: '책을 읽어요', audioRef: 'audio/e2e/chaek.mp3' });
  });
});

describe('the gap read aloud', () => {
  it('says the gap as a word, never underscores', () => {
    expect(spokenGap('chaegeul ___.', 'blank')).toBe('chaegeul blank.');
    expect(spokenGap('mul___ masyeoyo.', 'blank')).toBe('mulblank masyeoyo.');
    expect(spokenGap('I read a book.', 'blank')).toBe('I read a book.');
    expect(labelSentence('chaegeul ___.', 'blank')).toBe('chaegeul blank');
    expect(labelSentence('mureul masyeoyo?', 'blank')).toBe('mureul masyeoyo');
  });
});

describe('the fallback: Listen & Pick with a text prompt', () => {
  it('keeps the tiles, the answer and the round id; the voice says the completed sentence', () => {
    const lp = clozeToListenPick(word);
    expect(ListenPickRoundSchema.safeParse(lp).success).toBe(true);
    expect(lp.id).toBe(word.id);
    expect(lp.prompt).toEqual({ ko: '책을 ___.', romanization: 'chaegeul ___.', en: 'I read a book.', spokenKo: '책을 읽어요.' });
    expect(lp.options.map((o) => o.text?.ko)).toEqual(['읽어요', '먹어요', '마셔요']);
    expect(lp.answerId).toBe(tileId(word.id, 0));
    expect(lp.options.find((o) => o.id === lp.answerId)?.text?.ko).toBe('읽어요');
  });

  it('a recorded sentence keeps its recording for the one play after the answer', () => {
    const recorded = { ...word, sentence: { ...word.sentence, audioRef: 'audio/e2e/chaek.mp3' } };
    expect(clozeToListenPick(recorded).prompt.audioRef).toBe('audio/e2e/chaek.mp3');
  });

  it('turns a scope into a Listen & Pick scope of the same playable rounds', () => {
    const scope = clozeFixtureScope(['word', 'particle', 'value']);
    const fallback = clozeFallbackScope(scope);
    expect(fallback.kind).toBe('listen-pick');
    expect(fallback.rounds).toBe(3);
    expect(validRounds(fallback)).toHaveLength(3);
  });

  it('leaves out a broken round, as the game does', () => {
    const scope = clozeFixtureScope(['word', 'particle']);
    const rounds = scope.clozePick!.rounds;
    rounds.push({ ...word, id: 'broken', answerIndex: 9 }, { ...word, id: 'no-gap', sentence: { ...word.sentence, ko: '책을 읽어요.' } }, { ...word, id: 'one-tile', tiles: [word.tiles[0]] });
    expect(validClozeRounds(scope).map((r) => r.id)).toEqual([word.id, particle.id]);
    expect(validClozeRounds({})).toEqual([]);
    expect(clozeFallbackScope({ kind: 'cloze-pick' }).rounds).toBe(0);
  });
});
