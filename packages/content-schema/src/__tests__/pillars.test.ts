import { describe, expect, it } from 'vitest';
import { CatalogueFieldsSchema, CompanionIdSchema, PillarTagSchema } from '../index';

describe('PillarTagSchema (F-STORY-005 §3.2)', () => {
  it.each(['A1', 'B5', 'E9'])('accepts %s', (tag) => {
    expect(PillarTagSchema.safeParse(tag).success).toBe(true);
  });

  it.each(['F1', 'a1', 'A0', 'A10', 'A', '1A', ''])('rejects %s', (tag) => {
    expect(PillarTagSchema.safeParse(tag).success).toBe(false);
  });
});

describe('CompanionIdSchema', () => {
  it('knows only hoya until the companion section unlocks more', () => {
    expect(CompanionIdSchema.parse('hoya')).toBe('hoya');
    expect(CompanionIdSchema.safeParse('tiger').success).toBe(false);
  });
});

describe('CatalogueFieldsSchema', () => {
  it('defaults to no tags and the hoya companion', () => {
    expect(CatalogueFieldsSchema.parse({})).toEqual({ pillarTags: [], companionId: 'hoya' });
  });

  it('accepts up to three tags, the first being primary', () => {
    const fields = { pillarTags: ['B5', 'C1', 'D2'], companionId: 'hoya' };
    expect(CatalogueFieldsSchema.parse(fields)).toEqual(fields);
    expect(CatalogueFieldsSchema.safeParse({ pillarTags: ['B5', 'C1', 'D2', 'E1'] }).success).toBe(
      false,
    );
  });

  it('rejects a malformed tag', () => {
    expect(CatalogueFieldsSchema.safeParse({ pillarTags: ['Z9'] }).success).toBe(false);
  });
});
