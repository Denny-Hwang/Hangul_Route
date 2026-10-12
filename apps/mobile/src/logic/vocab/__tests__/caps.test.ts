import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MinigameKindSchema } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { ACTIVITY_ROUTES, VOCAB_SCREENS, capabilities, vocabCapabilities } from '../caps';

describe('vocab capabilities (F-VOC-003 section 3.4)', () => {
  it('picWordMatch follows whether the build has the pic-word-match minigame kind', () => {
    expect(capabilities.picWordMatch).toBe(MinigameKindSchema.options.includes('pic-word-match'));
    expect(vocabCapabilities(['match-sound', 'pic-word-match']).picWordMatch).toBe(true);
    expect(vocabCapabilities(['match-sound', 'card-match']).picWordMatch).toBe(false);
    expect(vocabCapabilities([]).picWordMatch).toBe(false);
  });
});

describe('VOCAB_SCREENS (the topic page draws an activity only when its screen is in the build)', () => {
  const root = readFileSync(join(__dirname, '..', '..', '..', 'navigation', 'root.tsx'), 'utf8');
  const registered = (route: string): boolean => root.includes(`name="${route}"`);

  it('names the route of each activity (spec section 3.1; F-VOC-004 adds the Speed round)', () => {
    expect(ACTIVITY_ROUTES).toEqual({ learn: 'VocabCards', speed: 'VocabSpeedRound', match: 'VocabMatch' });
  });

  it.each(['learn', 'speed', 'match'] as const)(
    '%s is on exactly when navigation/root.tsx registers its route (the row that adds the screen sets it)',
    (activity) => {
      expect(VOCAB_SCREENS[activity]).toBe(registered(ACTIVITY_ROUTES[activity]));
    },
  );

  it('the topic routes this row adds are registered', () => {
    expect(registered('VocabTopics')).toBe(true);
    expect(registered('VocabTopic')).toBe(true);
  });
});
