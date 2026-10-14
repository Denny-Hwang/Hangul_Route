import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { TRACE_CANVAS_MAX, TRACE_CANVAS_MIN } from '../../trace-layout';
import { TRACE_WORD_PAIR_MIN, traceWordCanvases, traceWordMessage, traceWordTone } from '../view';

const copy = getMessages('en').learner.minigame;
const clean = { orderCorrect: true, directionNudge: 'none' as const };

describe('traceWordMessage: Hoya\'s line per phase', () => {
  it('asks for each block, or for the lit letter in letter mode', () => {
    expect(traceWordMessage('drawing', 'block', null, copy)).toBe(copy.traceWord.idle);
    expect(traceWordMessage('drawing', 'letter', null, copy)).toBe(copy.traceWord.letterIdle);
  });

  it('a block that does not pass gets the retry line, never a "wrong"', () => {
    expect(traceWordMessage('retry', 'block', null, copy)).toBe(copy.trace.retry.start);
  });

  it('a clean block pass says the block is done; a slip gets Trace Stroke\'s coaching line', () => {
    expect(traceWordMessage('blockDone', 'block', clean, copy)).toBe(copy.traceWord.blockDone);
    expect(traceWordMessage('blockDone', 'block', null, copy)).toBe(copy.traceWord.blockDone);
    expect(traceWordMessage('blockDone', 'block', { orderCorrect: false, directionNudge: 'none' }, copy)).toBe(copy.trace.pass.order);
    expect(traceWordMessage('blockDone', 'block', { orderCorrect: true, directionNudge: 'open' }, copy)).toBe(copy.trace.pass.open);
  });

  it('a letter pass praises the letter; the last block says the word is whole', () => {
    expect(traceWordMessage('letterDone', 'letter', clean, copy)).toBe(copy.trace.pass.clean);
    expect(traceWordMessage('letterDone', 'letter', null, copy)).toBe(copy.trace.pass.clean);
    expect(traceWordMessage('letterDone', 'letter', { orderCorrect: true, directionNudge: 'loop' }, copy)).toBe(copy.trace.pass.loop);
    expect(traceWordMessage('wordDone', 'block', { orderCorrect: false, directionNudge: 'open' }, copy)).toBe(copy.traceWord.wordDone);
    expect(traceWordMessage('finished', 'block', null, copy)).toBe(copy.traceWord.wordDone);
  });

  it('reads in every UI language', () => {
    for (const locale of ['es', 'ko'] as const) {
      const c = getMessages(locale).learner.minigame;
      expect(traceWordMessage('drawing', 'block', null, c)).toBe(c.traceWord.idle);
      expect(c.traceWord.idle).not.toBe(copy.traceWord.idle);
    }
  });

  it('Hoya thinks on a retry, cheers on a pass, waits while drawing', () => {
    expect(traceWordTone('retry')).toBe('thinking');
    expect(traceWordTone('drawing')).toBe('idle');
    for (const phase of ['letterDone', 'blockDone', 'wordDone', 'finished'] as const) expect(traceWordTone(phase)).toBe('cheering');
  });
});

describe('traceWordCanvases: two blocks side by side only where both get 240', () => {
  const base = { slotHeight: 600, max: 384, gap: 16, side: false };

  it('a tablet shows both blocks of a two-block word', () => {
    expect(traceWordCanvases({ ...base, blocks: 2, slotWidth: 720 })).toEqual({ count: 2, size: 352 });
    expect(traceWordCanvases({ ...base, blocks: 2, slotWidth: 2 * TRACE_WORD_PAIR_MIN + 16 })).toEqual({ count: 2, size: 240 });
  });

  it('a phone, a one-block word, a short slot and the side layout keep one canvas', () => {
    expect(traceWordCanvases({ ...base, blocks: 2, slotWidth: 358, max: TRACE_CANVAS_MAX })).toEqual({ count: 1, size: 320 });
    expect(traceWordCanvases({ ...base, blocks: 1, slotWidth: 720 })).toEqual({ count: 1, size: 384 });
    expect(traceWordCanvases({ ...base, blocks: 2, slotWidth: 720, slotHeight: 200 })).toEqual({ count: 1, size: 200 });
    expect(traceWordCanvases({ ...base, blocks: 2, slotWidth: 900, side: true })).toEqual({ count: 1, size: 384 });
    expect(traceWordCanvases({ ...base, blocks: 1, slotWidth: 100, slotHeight: 100 }).size).toBe(TRACE_CANVAS_MIN);
  });
});
