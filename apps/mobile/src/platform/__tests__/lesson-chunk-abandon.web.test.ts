import { describe, expect, it, vi } from 'vitest';
import { abandonPendingChunk as nativeAbandon } from '../lesson-chunk-abandon';
import { abandonPendingChunk } from '../lesson-chunk-abandon.web';

/** A page's script tags, as `document.querySelectorAll('script[src]')` returns them. */
function page(srcs: string[]) {
  const fired: string[] = [];
  const scripts = srcs.map((src) => ({
    getAttribute: (name: string) => (name === 'src' ? src : null),
    dispatchEvent: vi.fn((event: Event) => {
      fired.push(`${event.type} ${src}`);
      return true;
    }),
  }));
  return { doc: { baseURI: 'https://app.example.test/', querySelectorAll: () => scripts }, fired };
}

const HASH = '0123456789abcdef0123456789abcdef';

describe('abandonPendingChunk (F-CURR-002 §10: a timed-out lesson chunk is given up, so the next try asks again)', () => {
  it('fires error on the pending script of that chunk only', () => {
    const p = page([
      `/_expo/static/js/web/index-${HASH}.js`,
      `/_expo/static/js/web/lessons-cell-stage2-letters-${HASH}.js`,
      `https://app.example.test/_expo/static/js/web/lessons-cell-stage2-life-${HASH}.js`,
      `/_expo/static/js/web/lessons-cell-stage2-letters-extra-${HASH}.js`,
    ]);
    expect(abandonPendingChunk('lessons-cell-stage2-letters', p.doc)).toBe(1);
    expect(p.fired).toEqual([`error /_expo/static/js/web/lessons-cell-stage2-letters-${HASH}.js`]);
    expect(abandonPendingChunk('lessons-cell-stage2-life', p.doc)).toBe(1);
  });

  it('does nothing when no such script is pending, without a document, or on native', () => {
    const p = page([`/_expo/static/js/web/index-${HASH}.js`]);
    expect(abandonPendingChunk('lessons-titles-ko', p.doc)).toBe(0);
    expect(p.fired).toEqual([]);
    expect(abandonPendingChunk('lessons-titles-ko', undefined)).toBe(0);
    expect(nativeAbandon()).toBe(0);
  });
});
