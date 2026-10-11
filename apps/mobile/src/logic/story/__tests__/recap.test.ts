import { describe, expect, it } from 'vitest';
import type { Story } from '@hangul-route/content-schema';
import { recapWords } from '../recap';
import { readyStory } from './story-fixture';

const kw = (id: string): Story['keywords'][number] => ({
  id,
  ko: `${id}-ko`,
  romanization: `${id}-rom`,
  en: `${id}-en`,
  kind: 'word',
});

describe('recapWords', () => {
  it('Listen: the tier newKeywordIds, in order, as KoText with their id', () => {
    const story = readyStory();
    const tier = story.tiers.find((t) => t.level === 'listen')!;
    const words = recapWords(story, 'listen');
    expect(words.map((w) => w.id)).toEqual(tier.newKeywordIds);
    const first = words[0]!;
    const source = story.keywords.find((k) => k.id === first.id)!;
    expect(first).toMatchObject({ ko: source.ko, romanization: source.romanization, en: source.en });
    expect('kind' in first).toBe(false);
    expect('art' in first).toBe(false);
  });

  it('Listen: caps at 4, drops duplicates and ids that match no keyword', () => {
    const story = readyStory();
    const tier = story.tiers.find((t) => t.level === 'listen')!;
    story.keywords = ['k1', 'k2', 'k3', 'k4', 'k5'].map(kw);
    tier.newKeywordIds = ['k1', 'k1', 'nope', 'k2', 'k3', 'k4', 'k5'];
    expect(recapWords(story, 'listen').map((w) => w.id)).toEqual(['k1', 'k2', 'k3', 'k4']);
  });

  it('keeps the audio and spoken fields of a keyword', () => {
    const story = readyStory();
    const tier = story.tiers.find((t) => t.level === 'listen')!;
    story.keywords = [{ ...kw('k1'), spokenKo: 'sp', audioRef: 'audio/k1.mp3', syllables: ['k1', '-rom'] }];
    tier.newKeywordIds = ['k1'];
    const [word] = recapWords(story, 'listen');
    expect(word).toMatchObject({ id: 'k1', spokenKo: 'sp', audioRef: 'audio/k1.mp3' });
  });

  it('read-along: unique keywords used by the tier scenes, authored order', () => {
    const story = readyStory();
    const tier = story.tiers.find((t) => t.level === 'read-along')!;
    const expected: string[] = [];
    for (const scene of tier.scenes) {
      if (scene.keyword && !expected.includes(scene.keyword.id)) expected.push(scene.keyword.id);
    }
    expect(expected.length).toBeGreaterThan(0);
    expect(recapWords(story, 'read-along').map((w) => w.id)).toEqual(expected);
  });

  it('read levels: removes duplicates by id and caps at 8', () => {
    const story = readyStory();
    const tier = story.tiers.find((t) => t.level === 'read-along')!;
    const base = tier.scenes[0]!;
    const ids = ['w1', 'w2', 'w3', 'w4', 'w5', 'w6', 'w7', 'w8', 'w9', 'w10'];
    tier.scenes = [...ids, 'w1', 'w2'].map((id, i) => ({
      ...base,
      id: `s${i + 1}`,
      keyword: kw(id),
    }));
    expect(recapWords(story, 'read-along').map((w) => w.id)).toEqual(ids.slice(0, 8));
  });

  it('skips scenes without a keyword', () => {
    const story = readyStory();
    const tier = story.tiers.find((t) => t.level === 'read-along')!;
    const base = tier.scenes[0]!;
    tier.scenes = [
      { ...base, id: 's1', keyword: undefined },
      { ...base, id: 's2', keyword: kw('only') },
    ];
    expect(recapWords(story, 'read-along').map((w) => w.id)).toEqual(['only']);
  });

  it('is empty when the story has no tier for the level', () => {
    expect(recapWords(readyStory(), 'read')).toEqual([]);
  });
});
