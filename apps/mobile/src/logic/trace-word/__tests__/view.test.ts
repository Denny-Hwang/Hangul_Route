import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { TRACE_CANVAS_MAX, TRACE_CANVAS_MIN } from '../../trace-layout';
import { TRACE_WORD_PAIR_MIN, TRACE_WORD_SHORT_HEIGHT, traceWordCanvases, traceWordHelperColumn, traceWordMessage, traceWordTone, traceWordWaitsForNext } from '../view';

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

describe('traceWordHelperColumn: Show me and Clear stand beside the canvas on a short phone [AU]', () => {
  it('keeps the helpers in their own row where the stacked column has the height', () => {
    expect(traceWordHelperColumn({ mode: 'compact', width: 328, height: TRACE_WORD_SHORT_HEIGHT, gap: 8 })).toBeNull();
    expect(traceWordHelperColumn({ mode: 'roomy', width: 400, height: 760, gap: 8 })).toBeNull();
  });

  it('never moves them in the side layout, which has its own column', () => {
    expect(traceWordHelperColumn({ mode: 'side', width: 600, height: 300, gap: 8 })).toBeNull();
  });

  it('gives them the width the canvas floor leaves on a short stacked phone', () => {
    expect(traceWordHelperColumn({ mode: 'compact', width: 288, height: TRACE_WORD_SHORT_HEIGHT - 1, gap: 8 })).toBe(288 - TRACE_CANVAS_MIN - 8);
    expect(traceWordHelperColumn({ mode: 'compact', width: 120, height: 300, gap: 8 })).toBe(0);
  });
});

describe('traceWordWaitsForNext: a tip waits for Next (AMENDMENTS-TRACE-IDLE §3.4)', () => {
  const order = { orderCorrect: false, directionNudge: 'none' as const };
  const open = { orderCorrect: true, directionNudge: 'open' as const };

  it('a letter or block pass with an order or direction tip waits', () => {
    expect(traceWordWaitsForNext('letterDone', order)).toBe(true);
    expect(traceWordWaitsForNext('letterDone', open)).toBe(true);
    expect(traceWordWaitsForNext('blockDone', { orderCorrect: null, directionNudge: 'loop' })).toBe(true);
  });

  it('a clean pass, the word-done view, a retry and drawing never wait', () => {
    expect(traceWordWaitsForNext('letterDone', clean)).toBe(false);
    expect(traceWordWaitsForNext('blockDone', null)).toBe(false);
    expect(traceWordWaitsForNext('wordDone', order)).toBe(false);
    expect(traceWordWaitsForNext('retry', order)).toBe(false);
    expect(traceWordWaitsForNext('drawing', open)).toBe(false);
  });
});
