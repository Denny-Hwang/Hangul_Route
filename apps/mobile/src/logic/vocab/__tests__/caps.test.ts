import { MinigameKindSchema } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { capabilities, vocabCapabilities } from '../caps';

describe('vocab capabilities (F-VOC-003 section 3.4)', () => {
  it('picWordMatch follows whether the build has the pic-word-match minigame kind', () => {
    expect(capabilities.picWordMatch).toBe(MinigameKindSchema.options.includes('pic-word-match'));
    expect(vocabCapabilities(['match-sound', 'pic-word-match']).picWordMatch).toBe(true);
    expect(vocabCapabilities(['match-sound', 'card-match']).picWordMatch).toBe(false);
    expect(vocabCapabilities([]).picWordMatch).toBe(false);
  });
});
