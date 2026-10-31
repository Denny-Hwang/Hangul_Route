import {
  CATALOG,
  assembleCatalogWithVolumesForTest,
  decodeDeck,
  encodeDeck,
  LectureOptionsSchema,
  type Catalog,
  type LectureDeck,
} from './volumes-fixture';
import { describe, expect, it } from 'vitest';
import { lectureBundle } from '../content';
import { expandDeck, type LectureBundle } from '../deck-builder';
import { CHOOSER_KEY_RE, parseHomeSnapshot, HOME_DEFAULT } from '../home-state';
import { presenterChooserGroups } from '../quick-source';

/**
 * The lecture side of a cell's Volume 2 (F-CURR-002 §8 and row CM-40): the presenter's chooser keeps a `-v2` episode key,
 * lists a cell's Volume 2 as its own row only while `volumes` is on, a deck carries the id through its link, and a
 * presenter whose bundle has no such episode (an older build, or this one before a Volume 2 ships) skips the block
 * calmly instead of failing the deck. The fixture Volume 2 is Stage 4 Play & Crafts'; Stage 2 Letters ships a real one
 * (row CM-44 S2).
 */

const V2 = 'episode:stage4-crafts-v2';
const SHIPPED_V2 = 'episode:stage2-letters-v2';
const deck = (id: string): LectureDeck => ({
  v: 1,
  id: 'lecture:vol2test1',
  title: 'Volume two',
  createdAt: '2026-10-30T00:00:00.000Z',
  seed: 7,
  options: LectureOptionsSchema.parse({}),
  picker: null,
  blocks: [{ kind: 'episode', id }],
});

describe('the presenter keeps and offers a Volume 2 (row CM-40)', () => {
  it('CHOOSER_KEY_RE keeps a -v2 episode key and still refuses anything else', () => {
    expect(CHOOSER_KEY_RE.test(V2)).toBe(true);
    expect(CHOOSER_KEY_RE.test('quest:stage2-nature-v2-q1')).toBe(true);
    expect(CHOOSER_KEY_RE.test('episode:stage2-nature-v3')).toBe(false);
    expect(CHOOSER_KEY_RE.test('episode:stage2-nature-v2 ')).toBe(false);
    expect(parseHomeSnapshot({ ...HOME_DEFAULT, chosen: [V2, 'episode:stage2-nature'] })?.chosen).toEqual([V2, 'episode:stage2-nature']);
  });

  it('lists a Volume 2 row after its cell only with volumes on, and only when the bundle can expand it', () => {
    const catalog: Catalog = assembleCatalogWithVolumesForTest();
    const real = lectureBundle('en');
    const crafts = real.episodeById('episode:stage4-crafts');
    const bundle: LectureBundle = { ...real, episodeById: (id) => (id === V2 && crafts ? { ...crafts, id: V2, volume: 2, questIds: [] } : real.episodeById(id)) };
    const keys = (volumes: boolean) =>
      presenterChooserGroups('en', { consonants: 'C', vowels: 'V' }, { catalog, bundle, volumes })
        .find((g) => g.id === 'stage4')
        ?.rows.map((r) => r.key);
    const on = keys(true) ?? [];
    expect(on.indexOf(V2)).toBe(on.indexOf('episode:stage4-crafts') + 1);
    expect(keys(false)).not.toContain(V2);
    // The shipped catalogue holds one Volume 2 (Stage 2 Letters, row CM-44 S2): listed after its cell only with volumes on.
    const shipped = (volumes: boolean) => presenterChooserGroups('en', { consonants: 'C', vowels: 'V' }, { volumes }).flatMap((g) => g.rows.map((r) => r.key));
    expect(shipped(true).filter((k) => k.endsWith('-v2'))).toEqual([SHIPPED_V2]);
    expect(shipped(true).indexOf(SHIPPED_V2)).toBe(shipped(true).indexOf('episode:stage2-letters') + 1);
    expect(shipped(false).some((k) => k.endsWith('-v2'))).toBe(false);
  });

  it('a deck with a Volume 2 block survives its link, and a presenter without that episode skips it (old-presenter path)', () => {
    const decoded = decodeDeck(encodeDeck(deck(V2)));
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.deck.blocks).toEqual([{ kind: 'episode', id: V2 }]);
    const expanded = expandDeck(decoded.deck, lectureBundle('en'), { canPlayKorean: true });
    expect(expanded.skipped).toEqual([{ blockIndex: 0, ref: V2, reason: 'unknown-id' }]);
    expect(CATALOG.cells.length).toBe(35);
  });
});
