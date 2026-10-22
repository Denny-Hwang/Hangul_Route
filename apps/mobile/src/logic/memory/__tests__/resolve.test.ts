import type { ReviewItem } from '@hangul-route/content-schema/review-items';
import { describe, expect, it } from 'vitest';
import type { MinigameScope } from '../../minigame-config';
import { askedOfScope, buildLookup, cellOfEpisode, normalizeAskedKo, resolveItems, resolveRound, shardOf } from '../resolve';
import { ITEMS, RETIRED } from './fixtures';

/** F-CURR-002 section 4.3, row CM-12: from what a round asked to the review items it asked. */

const item = (over: Partial<ReviewItem> & Pick<ReviewItem, 'id' | 'kind' | 'ko'>): ReviewItem => ({
  romanization: 'x',
  home: 'life',
  stage: 2,
  volume: 1,
  cells: ['episode:stage2-life'],
  asked: [],
  formats: ['read-pick'],
  soundChange: false,
  homophoneOf: [],
  ...over,
});

const PEAR = item({ id: 'lex:bae~pear', kind: 'lex', ko: '배', cells: ['episode:stage2-life'] });
const BOAT = item({ id: 'vocab:bae-boat', kind: 'lex', ko: '배', cells: ['episode:stage2-nature'] });
const SENT = item({ id: 'pat:sagwa-juseyo', kind: 'pat', ko: '사과 주세요.', cells: ['episode:stage3-life'] });
const B = item({ id: 'sym:bieup', kind: 'sym', ko: 'ㅂ', stage: 1, cells: ['episode:stage1-life'] });
const BF = item({ id: 'sym:bieup-batchim', kind: 'sym', ko: 'ㅂ', stage: 1, cells: ['episode:stage1-life'] });
const OLD = item({ id: 'lex:old', kind: 'lex', ko: '옛말' });
const PACK = item({ id: 'rea:menu', kind: 'rea', ko: '메뉴', home: 'pack:numbers-time' });
const lookup = buildLookup([PEAR, BOAT, SENT, B, BF, OLD, PACK], new Set(['lex:old']));

describe('resolveItems', () => {
  it('prefers the item the round’s own cell teaches, so a homograph is the right sense', () => {
    expect(resolveItems(lookup, 'episode:stage2-nature', { texts: [{ ko: '배' }], jamoIds: [] })).toEqual([BOAT]);
    expect(resolveItems(lookup, 'episode:stage2-life', { texts: [{ ko: '배' }], jamoIds: [] })).toEqual([PEAR]);
  });

  it('finds an earlier cell’s item from a recycle round, by its Korean, normalized', () => {
    expect(resolveItems(lookup, 'episode:stage4-life', { texts: [{ ko: ' 사과  주세요 ' }], jamoIds: [] })).toEqual([SENT]);
  });

  it('a symbol by its jamo id, initial or final; a bare letter is the initial one', () => {
    expect(resolveItems(lookup, 'x', { texts: [], jamoIds: ['jamo:bieup', 'jamo:bieup-batchim'] })).toEqual([B, BF]);
    expect(resolveItems(lookup, 'x', { texts: [{ ko: 'ㅂ' }], jamoIds: [] })).toEqual([B]);
  });

  it('leaves out retired and unknown items, and names each item once', () => {
    expect(resolveItems(lookup, 'x', { texts: [{ ko: '옛말' }, { ko: '없는말' }], jamoIds: ['jamo:nope'] })).toEqual([]);
    expect(resolveItems(lookup, 'episode:stage2-life', { texts: [{ ko: '배' }, { ko: '배' }], jamoIds: [] })).toEqual([PEAR]);
  });

  it('prefers the kind the context names', () => {
    const l = buildLookup([item({ id: 'lex:menu', kind: 'lex', ko: '메뉴' }), PACK], new Set());
    expect(resolveItems(l, 'x', { texts: [{ ko: '메뉴', kind: 'rea' }], jamoIds: [] })).toEqual([PACK]);
  });

  it('resolves real rounds against the items of this build', () => {
    const real = buildLookup(ITEMS, RETIRED);
    const word = ITEMS.find((i) => i.kind === 'lex' && !i.id.startsWith('vocab:')) as ReviewItem;
    expect(resolveItems(real, word.cells[0] as string, { texts: [{ ko: word.ko }], jamoIds: [] }).map((i) => i.id)).toEqual([word.id]);
  });
});

describe('helpers', () => {
  it('normalizes as the build keys items', () => {
    expect(normalizeAskedKo('“배요!” ')).toBe('배요');
    expect(normalizeAskedKo('사과\n주세요.')).toBe('사과 주세요');
  });

  it('a story listen quest plays on its shelf episode; its items name the story', () => {
    expect(cellOfEpisode('episode:shelf-sun-and-moon')).toBe('story:sun-and-moon');
    expect(cellOfEpisode('episode:stage2-life')).toBe('episode:stage2-life');
  });

  it('a pack item lives in its pack shard, every other in its first stage', () => {
    expect(shardOf(PACK)).toBe('pack:numbers-time');
    expect(shardOf(SENT)).toBe('stage2');
  });
});

describe('what a round asked', () => {
  const ko = (k: string) => ({ ko: k, romanization: 'r', en: 'e' });
  it('Listen & Pick: a symbol round by its jamo, a block or word by its prompt, at recognize', () => {
    const scope = {
      kind: 'listen-pick',
      listenPick: {
        rounds: [
          { id: 'lp:sym:jamo:bieup', prompt: ko('ㅂ'), options: [], answerId: 'a' },
          { id: 'lp:syl:ba', prompt: ko('바'), options: [], answerId: 'a' },
          { id: 'r3', prompt: ko('사과'), options: [], answerId: 'a' },
        ],
      },
    } as unknown as MinigameScope;
    expect(askedOfScope(scope, 'lp:sym:jamo:bieup')).toEqual({ texts: [], jamoIds: ['jamo:bieup'], rung: 'recognize' });
    expect(askedOfScope(scope, 'lp:syl:ba')).toEqual({ texts: [{ ko: '바', kind: 'syl' }], jamoIds: [], rung: 'recognize' });
    expect(askedOfScope(scope, 'r3')).toEqual({ texts: [{ ko: '사과' }], jamoIds: [], rung: 'recognize' });
    expect(askedOfScope(scope, 'nope')).toBeUndefined();
  });

  it('Pic-Word Match reads, Sentence Builder, Type Hangul and Write a Frame produce', () => {
    const pic = { kind: 'pic-word-match', picWord: { boards: [{ pairs: [{ id: 'p1', word: ko('배') }] }] } } as unknown as MinigameScope;
    expect(askedOfScope(pic, 'p1')).toEqual({ texts: [{ ko: '배' }], jamoIds: [], rung: 'read' });
    expect(askedOfScope(pic, 'p2')).toBeUndefined();
    const order = { kind: 'order-it', orderIt: { rounds: [{ id: 'o1', sentence: ko('사과 주세요.') }] } } as unknown as MinigameScope;
    expect(askedOfScope(order, 'o1')).toEqual({ texts: [{ ko: '사과 주세요.', kind: 'pat' }], jamoIds: [], rung: 'produce' });
    expect(askedOfScope(order, 'o2')).toBeUndefined();
    const type = { kind: 'type-hangul', typeHangul: { rounds: [{ id: 't1', target: ko('배') }] } } as unknown as MinigameScope;
    expect(askedOfScope(type, 't1')).toEqual({ texts: [{ ko: '배' }], jamoIds: [], rung: 'produce' });
    expect(askedOfScope(type, 't2')).toBeUndefined();
    const frame = { kind: 'write-frame', writeFrame: { rounds: [{ id: 'w1', frame: ko('저는 ___이에요.') }] } } as unknown as MinigameScope;
    expect(askedOfScope(frame, 'w1')).toEqual({ texts: [{ ko: '저는 ___이에요.', kind: 'pat' }], jamoIds: [], rung: 'produce' });
    expect(askedOfScope(frame, 'w2')).toBeUndefined();
  });

  it('Realia Read asks the card only (one rea item), never its key word or options', () => {
    const scope = {
      kind: 'realia-read',
      realiaRead: {
        realia: { ref: 'realia:menu', title: ko('메뉴'), entries: [{ id: 'e1', text: ko('라면') }], altEn: 'a menu' },
        rounds: [{ id: 'q1', questionEn: 'How much?', key: ko('라면'), options: [{ id: 'a', text: ko('삼천 원') }, { id: 'b', figure: '5,000' }], answerId: 'a' }],
      },
    } as unknown as MinigameScope;
    expect(askedOfScope(scope, 'q1')).toEqual({ texts: [{ ko: '메뉴', kind: 'rea' }], jamoIds: [], rung: 'read' });
    expect(askedOfScope(scope, 'q2')).toBeUndefined();
    const untitled = { ...scope, realiaRead: { ...(scope.realiaRead as object), realia: { ref: 'realia:x', entries: [{ id: 'e1', text: ko('표') }], altEn: 'x' } } } as unknown as MinigameScope;
    expect(askedOfScope(untitled, 'q1')?.texts[0]).toEqual({ ko: '표', kind: 'rea' });
  });

  it('Trace a Word and the other kinds ask no item', () => {
    expect(askedOfScope({ kind: 'trace-word', traceWord: { rounds: [{ id: 't', word: ko('배') }] } } as unknown as MinigameScope, 't')).toBeUndefined();
  });

  it('a game’s own report, or nothing when it names no Korean', () => {
    expect(resolveRound({ texts: ['배'], rung: 'read' })).toEqual({ texts: [{ ko: '배' }], jamoIds: [], rung: 'read' });
    expect(resolveRound({ jamoIds: ['jamo:a'] })).toEqual({ texts: [], jamoIds: ['jamo:a'], rung: 'read' });
    expect(resolveRound({})).toBeUndefined();
    const pic = { kind: 'pic-word-match', picWord: { boards: [{ pairs: [{ id: 'p1', word: ko('배') }] }] } } as unknown as MinigameScope;
    expect(resolveRound({ scope: pic, itemId: 'p1' })?.rung).toBe('read');
  });
});
