import type { KoText } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { scopeFor, type MinigameScope } from '../../minigame-config';
import { SCAFFOLD_ROUND_ID, scaffoldScope, scopeItems } from '../quest-scaffold';

/**
 * F-CURR-002 section 4.6 (row CM-24): the scaffold round of a hard Practice is one Listen & Pick round over the
 * Practice's own items (no new content), the last missed item asked, the misses first among at most three options.
 */

const k = (ko: string, en: string): KoText => ({ ko, romanization: ko, en });
const SKY = k('하늘', 'sky');
const STAR = k('별', 'star');
const TREE = k('나무', 'tree');
const SEA = k('바다', 'sea');

const picWord: MinigameScope = {
  kind: 'pic-word-match',
  rounds: 2,
  picWord: {
    boards: [
      { pairs: [{ id: 'haneul', pictureRef: 'word:nature-sky', word: SKY }, { id: 'byeol', pictureRef: 'word:nature-star', word: STAR }, { id: 'namu', pictureRef: 'word:nature-tree', word: TREE }] },
      { pairs: [{ id: 'bada', pictureRef: 'card:sea', word: SEA }, { id: 'haneul', pictureRef: 'word:nature-sky', word: SKY }, { id: 'byeol', pictureRef: 'word:nature-star', word: STAR }] },
    ],
  },
};

describe('the Practice items a scaffold may ask', () => {
  it('lists each word of a Pic-Word board once, in order', () => {
    expect(scopeItems(picWord).map((t) => t.ko)).toEqual(['하늘', '별', '나무', '바다']);
  });

  it('reads Sentence Builder, Type Hangul, Listen & Pick (not its letter rounds) and Tap & Respond lines', () => {
    expect(scopeItems({ kind: 'order-it', orderIt: { rounds: [{ id: 'o1', sentence: k('물 주세요', 'water, please'), distractors: [] }] } }).map((t) => t.ko)).toEqual(['물 주세요']);
    expect(scopeItems({ kind: 'type-hangul', typeHangul: { rounds: [{ id: 't1', promptEn: 'x', target: SEA }] } }).map((t) => t.ko)).toEqual(['바다']);
    const lp = (id: string, prompt: KoText) => ({ id, prompt, options: [{ id: 'a', text: prompt }, { id: 'b', text: STAR }], answerId: 'a' });
    expect(scopeItems({ kind: 'listen-pick', listenPick: { rounds: [lp('lp:sym:jamo:a', k('ㅏ', 'a')), lp('r2', TREE)] } }).map((t) => t.ko)).toEqual(['나무']);
    const turns = [
      { npcKo: '안녕?', npcRomanization: 'annyeong?', npcEn: 'Hi?', npcAudioRef: 'clip:x', options: [] },
      { npcKo: '뭐 해?', npcEn: 'What are you doing?', options: [] },
    ];
    expect(scopeItems({ kind: 'tap-respond', dialogue: turns })).toEqual([{ ko: '안녕?', romanization: 'annyeong?', en: 'Hi?', audioRef: 'clip:x' }]);
  });

  it('has nothing for a Practice whose rounds ask a card or a copied word', () => {
    expect(scopeItems({ kind: 'realia-read' })).toEqual([]);
    expect(scopeItems({ kind: 'trace-word', traceWord: { rounds: [{ id: 'w1', word: k('물', 'water') }] } })).toEqual([]);
  });
});

describe('the scaffold round', () => {
  it('asks the last missed item with the hint, the misses first, three options at most', () => {
    const out = scaffoldScope(picWord, [
      { scope: picWord, itemId: 'namu' },
      { scope: picWord, itemId: 'bada' },
    ]);
    expect(out?.kind).toBe('listen-pick');
    const round = out?.listenPick?.rounds[0];
    expect(round?.id).toBe(SCAFFOLD_ROUND_ID);
    expect(round?.prompt.ko).toBe('바다');
    expect(round?.options.map((o) => o.text?.ko)).toEqual(['바다', '나무', '하늘']);
    expect(round?.options.find((o) => o.id === round.answerId)?.text?.ko).toBe('바다');
  });

  it('reads a miss reported as its Korean (the older games) and drops a miss the Practice does not hold', () => {
    const out = scaffoldScope(picWord, [{ texts: ['별'] }, { texts: ['없는말'] }, {}]);
    expect(out?.listenPick?.rounds[0]?.prompt.ko).toBe('별');
  });

  it('asks only the Practice scope’s own Korean', () => {
    const own = new Set(scopeItems(picWord).map((t) => t.ko));
    for (const id of ['haneul', 'byeol', 'namu', 'bada']) {
      const round = scaffoldScope(picWord, [{ scope: picWord, itemId: id }])?.listenPick?.rounds[0];
      for (const text of [round?.prompt, ...(round?.options.map((o) => o.text) ?? [])]) expect(own.has(text?.ko ?? '')).toBe(true);
    }
  });

  it('is none when the misses name no item, or the Practice has one item only', () => {
    expect(scaffoldScope(picWord, [])).toBeNull();
    expect(scaffoldScope(picWord, [{ scope: picWord, itemId: 'nope' }])).toBeNull();
    const one: MinigameScope = { kind: 'type-hangul', typeHangul: { rounds: [{ id: 't1', promptEn: 'x', target: SEA }] } };
    expect(scaffoldScope(one, [{ scope: one, itemId: 't1' }])).toBeNull();
  });

  it('builds from a shipped Practice scope (Stage 2 Nature quest 1)', () => {
    const practice = scopeFor('minigame:s2-nature-q1-practice')!;
    const round = scaffoldScope(practice, [{ scope: practice, itemId: 'byeol' }, { scope: practice, itemId: 'haneul' }])?.listenPick?.rounds[0];
    expect(round?.prompt.ko).toBe('하늘');
    expect(round?.options.map((o) => o.text?.ko)).toEqual(['하늘', '별', '나무']);
  });
});
