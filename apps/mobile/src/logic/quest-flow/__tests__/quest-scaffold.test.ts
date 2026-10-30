import type { KoText } from '@hangul-route/content-schema';
import { LIBRARY_SCENE } from '@hangul-route/content-schema/testing/role-play';
import { describe, expect, it } from 'vitest';
import { soundKey } from '../../../content/__tests__/helpers/distractors';
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

  it('reads Trace a Word targets, and Realia Read key words or word answers (never a picture or a figure)', () => {
    const trace: MinigameScope = { kind: 'trace-word', traceWord: { rounds: [{ id: 'w1', word: k('물', 'water') }, { id: 'w2', word: SEA }] } };
    expect(scopeItems(trace).map((t) => t.ko)).toEqual(['물', '바다']);
    expect(scaffoldScope(trace, [{ scope: trace, itemId: 'w1' }, { scope: trace, itemId: 'w2' }])?.listenPick?.rounds[0]?.prompt.ko).toBe('바다');
    const realia: MinigameScope = {
      kind: 'realia-read',
      realiaRead: {
        realia: { ref: 'realia:menu', kind: 'menu', entries: [{ id: 'e1', text: SKY }], altEn: 'A menu' },
        rounds: [
          { id: 'r1', questionEn: 'How much?', key: TREE, options: [{ id: 'a', figure: '5,000' }, { id: 'b', figure: '3,000' }], answerId: 'a' },
          { id: 'r2', questionEn: 'Which one?', options: [{ id: 'a', text: STAR }, { id: 'b', text: SKY }], answerId: 'b' },
          { id: 'r3', questionEn: 'Which picture?', options: [{ id: 'a', pictureRef: 'word:nature-sky', labelEn: 'sky' }, { id: 'b', pictureRef: 'word:nature-star', labelEn: 'star' }], answerId: 'a' },
        ],
      },
    };
    expect(scopeItems(realia).map((t) => t.ko)).toEqual(['나무', '하늘']);
    expect(scaffoldScope(realia, [{ scope: realia, itemId: 'r2' }, { scope: realia, itemId: 'r3' }])?.listenPick?.rounds[0]?.prompt.ko).toBe('하늘');
    expect(scopeItems({ kind: 'realia-read' })).toEqual([]);
  });
});

describe('a Role Play Practice (F-CURR-002 row CM-3A S4)', () => {
  const rolePlay: MinigameScope = {
    kind: 'role-play',
    rounds: 2,
    rolePlay: {
      scene: {
        title: k('집', 'At home'),
        partner: k('할머니', 'grandma'),
        start: 't1',
        nodes: [
          { id: 't1', line: k('밥 먹었어요?', 'Have you eaten?'), replies: [{ id: 'ate', text: k('네, 먹었어요.', 'Yes, I ate.'), kind: 'natural', next: 't2' }, { id: 'bye', text: k('잘 가요.', 'Goodbye.'), kind: 'lessNatural', whyEn: 'x' }] },
          { id: 't2', line: k('우유 마셨어요?', 'Did you drink your milk?'), replies: [{ id: 'drank', text: k('네, 마셨어요.', 'Yes, I drank it.'), kind: 'natural', next: 'end' }, { id: 'ate', text: k('네, 먹었어요.', 'Yes, I ate.'), kind: 'lessNatural', whyEn: 'x' }] },
          { id: 'side', line: k('김치 먹었어요?', 'Did you eat the kimchi?'), replies: [{ id: 'ate', text: k('네, 먹었어요.', 'Yes, I ate.'), kind: 'natural', next: 'end' }] },
          { id: 'end', end: true, closingEn: 'Done!' },
        ],
      },
    },
  };

  it('lists the partner lines of its main path (the turns its fallback plays) first, then the other branches\' (row CM-35)', () => {
    expect(scopeItems(rolePlay).map((t) => t.ko)).toEqual(['밥 먹었어요?', '우유 마셨어요?', '김치 먹었어요?']);
  });

  it('reads a miss of the game (<node>/<reply>) and of its Tap to Respond fallback (the line)', () => {
    expect(scaffoldScope(rolePlay, [{ scope: rolePlay, itemId: 't2/ate' }, { scope: rolePlay, itemId: 't1/bye' }])?.listenPick?.rounds[0]?.prompt.ko).toBe('밥 먹었어요?');
    expect(scaffoldScope(rolePlay, [{ texts: ['우유 마셨어요?'] }])?.listenPick?.rounds[0]?.options.map((o) => o.text?.ko)).toEqual(['우유 마셨어요?', '밥 먹었어요?', '김치 먹었어요?']);
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

  it('scaffolds a hard Role Play Practice by its partner lines (row CM-35): the turns missed, nothing new', () => {
    const rp: MinigameScope = { kind: 'role-play', rolePlay: { scene: LIBRARY_SCENE } };
    // The main path's lines first (as its Tap to Respond fallback), then the other branch's turn.
    expect(scopeItems(rp).map((t) => t.ko)).toEqual(['안녕하세요!', '무슨 책을 찾아요?', '동화책은 여기 있어요.', '또 오세요!', '한글 책은 여기 있어요.']);
    const round = scaffoldScope(rp, [{ scope: rp, itemId: 't1/meal' }, { scope: rp, itemId: 't2/fine' }])?.listenPick?.rounds[0];
    expect(round?.prompt.ko).toBe('무슨 책을 찾아요?');
    const options = round?.options.map((o) => o.text?.ko ?? '') ?? [];
    expect(options).toEqual(['무슨 책을 찾아요?', '안녕하세요!', '동화책은 여기 있어요.']);
    const own = new Set(LIBRARY_SCENE.nodes.flatMap((n) => ('line' in n ? [n.line.ko] : [])));
    for (const ko of options) expect(own.has(ko), ko).toBe(true);
    expect(new Set(options.map(soundKey)).size).toBe(options.length);
    // A miss on the other branch's turn still names its line.
    expect(scaffoldScope(rp, [{ scope: rp, itemId: 't3b/sorry' }])?.listenPick?.rounds[0]?.prompt.ko).toBe('한글 책은 여기 있어요.');
    expect(scaffoldScope(rp, [{ scope: rp, itemId: 'nope/x' }])).toBeNull();
  });
});
