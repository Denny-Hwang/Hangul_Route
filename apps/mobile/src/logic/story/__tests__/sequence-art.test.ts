import type { SceneArt } from '@hangul-route/content-schema';
import { SCENE_ART_REGISTRY, resolveScene } from '@hangul-route/design-system/scene-art';
import { borderWidth, layout, spacing, touchTarget } from '@hangul-route/design-system/tokens';
import { describe, expect, it } from 'vitest';
import type { SequenceCard } from '../sequence-cards';
import {
  STACKED_ART_SHARE,
  estimateGridWidth,
  replayArtWidth,
  sequenceArtColumns,
  sequenceCardMetrics,
  sequenceCardArt,
  sequenceCardArtWidth,
  sequenceHasArt,
  type SceneResolver,
} from '../sequence-art';

/** The real registry, as the screen passes it. */
const resolve: SceneResolver = (art) => resolveScene(art, SCENE_ART_REGISTRY);

/** A picture every registry resolves: the palace hall with Hoya waving (the reader fixture's scene 1). */
const PALACE: SceneArt = {
  setting: 'scene:palace-hall',
  layers: [{ ref: 'hoya:wave', x: 200, y: 280, s: 1 }],
  altEn: 'King Sejong sits in a palace hall while Hoya waves.',
};
/** No such setting: the reader would show its tinted panel; a sequence card shows its words alone. */
const UNKNOWN_SETTING: SceneArt = { setting: 'scene:no-such-place', layers: [], altEn: 'Nowhere.' };

const withArt: SequenceCard = { id: 's1', caption: "A king's wish", art: PALACE };
const pending: SequenceCard = { id: 's3', caption: 'The first consonant' };
const unresolved: SequenceCard = { id: 's9', caption: 'Lost', art: UNKNOWN_SETTING };
const legacy: SequenceCard = {
  id: 'step-1',
  caption: 'Wear hanbok',
  ko: { ko: '한복 입기', romanization: 'hanbok ipgi', en: 'Wear hanbok' },
};

describe('sequenceCardArt', () => {
  it('returns the art of a card whose picture resolves', () => {
    expect(sequenceCardArt(withArt, resolve)).toBe(PALACE);
  });

  it('is null for a legacy step and a scene whose art is pending: the words alone', () => {
    expect(sequenceCardArt(legacy, resolve)).toBeNull();
    expect(sequenceCardArt(pending, resolve)).toBeNull();
  });

  it('is null when the setting does not resolve, never a broken picture or a tinted placeholder', () => {
    expect(sequenceCardArt(unresolved, resolve)).toBeNull();
  });

  it('keeps the picture when only a layer is unknown (the setting still draws, like the reader)', () => {
    const art: SceneArt = { ...PALACE, layers: [{ ref: 'prop:no-such-thing', x: 10, y: 10, s: 1 }] };
    expect(sequenceCardArt({ id: 's2', caption: 'x', art }, resolve)).toBe(art);
  });

  it('is null for malformed art instead of throwing', () => {
    const broken = { id: 'x', caption: 'x', art: { setting: 'scene:palace-hall', layers: 'nope' } } as unknown as SequenceCard;
    expect(() => sequenceCardArt(broken, resolve)).not.toThrow();
    expect(sequenceCardArt(broken, resolve)).toBeNull();
  });
});

describe('sequenceHasArt', () => {
  it('is true when at least one card draws a picture', () => {
    expect(sequenceHasArt([pending, withArt], resolve)).toBe(true);
  });

  it('is false for the legacy sequences and for cards whose art is pending or unresolved', () => {
    expect(sequenceHasArt([legacy], resolve)).toBe(false);
    expect(sequenceHasArt([pending, unresolved], resolve)).toBe(false);
    expect(sequenceHasArt([], resolve)).toBe(false);
  });
});

/** The metrics the screen draws with: built from the real tokens, so a token change shows up here. */
const M = sequenceCardMetrics({ spacing, borderWidth, touchTarget });
const MAX_ART = M.maxArt;

/** The grid the screen estimates for a phone window (compact gutter, reading width cap). */
const phoneGrid = (w: number): number => estimateGridWidth(w, layout.gutter.compact, layout.maxWidth.reading);

describe('sequenceCardMetrics', () => {
  it('reserves padding, border and the outcome mark around the picture, from the tokens', () => {
    expect(M.gap).toBe(spacing.md);
    expect(M.chrome).toBe(2 * spacing.lg + 2 * borderWidth.base + spacing.xl + spacing.md);
    expect(M.minArt).toBe(touchTarget.child);
    expect(M.maxArt).toBe(2 * touchTarget.hero);
    expect(M.slack).toBeGreaterThan(0);
  });
});

describe('estimateGridWidth', () => {
  it('is the window less both gutters, capped at the content width', () => {
    expect(estimateGridWidth(360, 16, 720)).toBe(328);
    expect(estimateGridWidth(1024, 32, 720)).toBe(720);
  });

  it('is 0 for an unknown or tiny window', () => {
    expect(estimateGridWidth(0, 16, 720)).toBe(0);
    expect(estimateGridWidth(20, 16, 720)).toBe(0);
    expect(estimateGridWidth(Number.NaN, 16, 720)).toBe(0);
  });
});

describe('sequenceArtColumns', () => {
  it('keeps two picture columns on every phone from 360 dp (F-STORY-003 §3.5)', () => {
    for (const w of [360, 375, 390, 393, 412]) expect(sequenceArtColumns(2, phoneGrid(w), M), `${w} dp`).toBe(2);
  });

  it('is one column on a 320 dp phone', () => {
    expect(sequenceArtColumns(2, phoneGrid(320), M)).toBe(1);
  });

  it('keeps the columns when every cell still holds a picture of the minimum width', () => {
    expect(sequenceArtColumns(3, 720, M)).toBe(3);
    expect(sequenceArtColumns(4, 720, M)).toBe(4);
  });

  it('drops columns until a picture fits, down to one', () => {
    // 4 columns of a 560 grid: cell 131 less the chrome is under the minimum; 3 columns fit.
    expect(sequenceArtColumns(4, 560, M)).toBe(3);
    expect(sequenceArtColumns(2, 150, M)).toBe(1);
  });

  it('keeps the given columns (at least one) while the grid width is unknown', () => {
    expect(sequenceArtColumns(2, 0, M)).toBe(2);
    expect(sequenceArtColumns(3, Number.NaN, M)).toBe(3);
    expect(sequenceArtColumns(0, 0, M)).toBe(1);
    expect(sequenceArtColumns(Number.NaN, 0, M)).toBe(1);
  });

  it('never returns fewer than one column', () => {
    expect(sequenceArtColumns(0, 720, M)).toBe(1);
  });

  describe('hysteresis (a scrollbar of a few dp cannot flip the layout)', () => {
    // The smallest grid where two pictures of the minimum width fit.
    const edge = 2 * (M.minArt + M.chrome) + M.gap;

    it('drops a column at the edge with no history, and keeps it within the slack', () => {
      expect(sequenceArtColumns(2, edge, M)).toBe(2);
      expect(sequenceArtColumns(2, edge - 2, M)).toBe(1);
      expect(sequenceArtColumns(2, edge - 2, M, 2)).toBe(2);
      expect(sequenceArtColumns(2, edge - 15, M, 2)).toBe(2);
    });

    it('drops the column once the picture falls more than the slack below the minimum', () => {
      expect(sequenceArtColumns(2, edge - 2 * M.slack - 4, M, 2)).toBe(1);
    });

    it('adds a column back only when its picture clears the minimum by the slack', () => {
      expect(sequenceArtColumns(2, edge + 15, M, 1)).toBe(1);
      expect(sequenceArtColumns(2, edge + 2 * M.slack + 2, M, 1)).toBe(2);
    });

    it('a 15 dp scrollbar at either side of the edge settles on one layout', () => {
      for (const w of [edge - 10, edge - 5, edge, edge + 5, edge + 10]) {
        const first = sequenceArtColumns(2, w, M);
        const narrower = sequenceArtColumns(2, w - 15, M, first);
        expect(sequenceArtColumns(2, w, M, narrower), `${w}`).toBe(narrower);
      }
    });

    it('ignores a previous count the text layout no longer allows', () => {
      expect(sequenceArtColumns(2, 720, M, 4)).toBe(2);
      expect(sequenceArtColumns(2, 720, M, 0)).toBe(2);
    });
  });
});

describe('sequenceCardArtWidth', () => {
  it('fills the cell less the card chrome, capped at the maximum', () => {
    // One column of a 288 grid (a 320 dp phone): 288 - chrome, capped at the maximum.
    expect(sequenceCardArtWidth(288, 1, M, MAX_ART)).toBe(Math.min(288 - M.chrome, MAX_ART));
    // Three columns of a 720 grid.
    expect(sequenceCardArtWidth(720, 3, M, MAX_ART)).toBe(Math.floor((720 - 2 * M.gap) / 3) - M.chrome);
  });

  it('is at least the minimum picture with two columns on a 360 dp phone', () => {
    expect(sequenceCardArtWidth(phoneGrid(360), 2, M, MAX_ART)).toBeGreaterThanOrEqual(M.minArt);
  });

  it('is 0 (no picture yet) while the grid is unmeasured or too narrow', () => {
    expect(sequenceCardArtWidth(0, 1, M, MAX_ART)).toBe(0);
    expect(sequenceCardArtWidth(60, 1, M, MAX_ART)).toBe(0);
    expect(sequenceCardArtWidth(Number.NaN, 1, M, MAX_ART)).toBe(0);
    expect(sequenceCardArtWidth(288, 0, M, MAX_ART)).toBe(0);
  });
});

describe('replayArtWidth', () => {
  it('uses the card width less its padding on a tall phone, capped at the maximum', () => {
    // 320 x 568: body 288 - 32 = 256; height cap 568 * 0.42 * 4/3 = 318; max 400.
    expect(replayArtWidth({ width: 288, windowHeight: 568, chrome: 32, maxArt: 400 })).toBe(256);
    expect(replayArtWidth({ width: 700, windowHeight: 1024, chrome: 32, maxArt: 400 })).toBe(400);
  });

  it('keeps the picture short enough on a landscape phone that the controls stay near', () => {
    // 844 x 390: the height cap wins: floor(390 * 0.42 * 4 / 3) = 218.
    expect(replayArtWidth({ width: 780, windowHeight: 390, chrome: 32, maxArt: 400 })).toBe(
      Math.floor((390 * STACKED_ART_SHARE * 4) / 3),
    );
  });

  it('is 0 while the card is unmeasured, never negative', () => {
    expect(replayArtWidth({ width: 0, windowHeight: 568, chrome: 32, maxArt: 400 })).toBe(0);
    expect(replayArtWidth({ width: 20, windowHeight: 568, chrome: 32, maxArt: 400 })).toBe(0);
    expect(replayArtWidth({ width: 288, windowHeight: Number.NaN, chrome: 32, maxArt: 400 })).toBe(0);
    expect(replayArtWidth({ width: Number.NaN, windowHeight: 568, chrome: 32, maxArt: 400 })).toBe(0);
    expect(replayArtWidth({ width: 288, windowHeight: 0, chrome: 32, maxArt: 400 })).toBe(0);
  });
});
