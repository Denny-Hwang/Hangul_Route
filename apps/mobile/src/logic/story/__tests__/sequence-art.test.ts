import type { SceneArt } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import type { SequenceCard } from '../sequence-cards';
import {
  REPLAY_ART_SHARE,
  replayArtWidth,
  sequenceArtColumns,
  sequenceCardArt,
  sequenceCardArtWidth,
  sequenceHasArt,
} from '../sequence-art';

/** A picture every registry resolves: the palace hall with Hoya waving (the reader fixture's scene 1). */
const PALACE: SceneArt = {
  setting: 'scene:palace-hall',
  layers: [{ ref: 'hoya:wave', x: 200, y: 280 }],
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
    expect(sequenceCardArt(withArt)).toBe(PALACE);
  });

  it('is null for a legacy step and a scene whose art is pending: the words alone', () => {
    expect(sequenceCardArt(legacy)).toBeNull();
    expect(sequenceCardArt(pending)).toBeNull();
  });

  it('is null when the setting does not resolve, never a broken picture or a tinted placeholder', () => {
    expect(sequenceCardArt(unresolved)).toBeNull();
  });

  it('keeps the picture when only a layer is unknown (the setting still draws, like the reader)', () => {
    const art: SceneArt = { ...PALACE, layers: [{ ref: 'prop:no-such-thing', x: 10, y: 10 }] };
    expect(sequenceCardArt({ id: 's2', caption: 'x', art })).toBe(art);
  });

  it('is null for malformed art instead of throwing', () => {
    const broken = { id: 'x', caption: 'x', art: { setting: 'scene:palace-hall', layers: 'nope' } } as unknown as SequenceCard;
    expect(() => sequenceCardArt(broken)).not.toThrow();
    expect(sequenceCardArt(broken)).toBeNull();
  });
});

describe('sequenceHasArt', () => {
  it('is true when at least one card draws a picture', () => {
    expect(sequenceHasArt([pending, withArt])).toBe(true);
  });

  it('is false for the legacy sequences and for cards whose art is pending or unresolved', () => {
    expect(sequenceHasArt([legacy])).toBe(false);
    expect(sequenceHasArt([pending, unresolved])).toBe(false);
    expect(sequenceHasArt([])).toBe(false);
  });
});

// The screen passes token values; these mirror them: gap spacing.md 12; card chrome 72 (padding spacing.lg x 2,
// border borderWidth.base x 2, the mark icon spacing.xl and its gap spacing.md); art touchTarget.hero 96 .. 2 x hero 192.
const GAP = 12;
const CHROME = 72;
const MIN_ART = 96;
const MAX_ART = 192;

describe('sequenceArtColumns', () => {
  it('keeps the columns when every cell still holds a picture of the minimum width', () => {
    // 3 columns of a 720 grid: (720 - 24) / 3 = 232; 232 - 72 = 160 >= 96.
    expect(sequenceArtColumns(3, 720, GAP, CHROME, MIN_ART)).toBe(3);
  });

  it('drops columns until a picture fits, down to one', () => {
    // 2 columns of a 328 grid (a 360 dp phone): 158 - 72 = 86 < 96, so one column.
    expect(sequenceArtColumns(2, 328, GAP, CHROME, MIN_ART)).toBe(1);
    // 4 columns of a 680 grid: 161 - 72 = 89 < 96; 3 columns fit (218 - 72 = 146).
    expect(sequenceArtColumns(4, 680, GAP, CHROME, MIN_ART)).toBe(3);
    // 2 columns of a 361 grid (a 393 dp phone): 174 - 72 = 102 >= 96, so both stay.
    expect(sequenceArtColumns(2, 361, GAP, CHROME, MIN_ART)).toBe(2);
  });

  it('is one column even when a single column is narrower than the minimum picture', () => {
    expect(sequenceArtColumns(2, 150, GAP, CHROME, MIN_ART)).toBe(1);
  });

  it('keeps the given columns while the grid width is unknown', () => {
    expect(sequenceArtColumns(2, 0, GAP, CHROME, MIN_ART)).toBe(2);
    expect(sequenceArtColumns(3, Number.NaN, GAP, CHROME, MIN_ART)).toBe(3);
  });

  it('never returns fewer than one column', () => {
    expect(sequenceArtColumns(0, 720, GAP, CHROME, MIN_ART)).toBe(1);
  });
});

describe('sequenceCardArtWidth', () => {
  it('fills the cell less the card chrome, capped at the maximum', () => {
    // One column of a 288 grid (a 320 dp phone): 288 - 72 = 216, capped at 192.
    expect(sequenceCardArtWidth(288, 1, GAP, CHROME, MAX_ART)).toBe(192);
    // Three columns of a 720 grid: 232 - 72 = 160.
    expect(sequenceCardArtWidth(720, 3, GAP, CHROME, MAX_ART)).toBe(160);
  });

  it('is 0 (no picture yet) while the grid is unmeasured or too narrow', () => {
    expect(sequenceCardArtWidth(0, 1, GAP, CHROME, MAX_ART)).toBe(0);
    expect(sequenceCardArtWidth(60, 1, GAP, CHROME, MAX_ART)).toBe(0);
    expect(sequenceCardArtWidth(Number.NaN, 1, GAP, CHROME, MAX_ART)).toBe(0);
    expect(sequenceCardArtWidth(288, 0, GAP, CHROME, MAX_ART)).toBe(0);
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
      Math.floor((390 * REPLAY_ART_SHARE * 4) / 3),
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
