import type { Quest, Story } from '@hangul-route/content-schema';
import { getMessages, pseudoLocalize, pseudoText } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { scanLearnerCopy } from '../../homework/banned-text';
import {
  resultsStoryOf,
  storyResultsActionEvent,
  storyResultsExtras as storyResultsExtrasWith,
  type StoryResultsInput,
} from '../results-extras';
import { readyStory } from './story-fixture';

// The words are learner.story.results (F-I18N-001 PR 7b); these tests read the dictionary.
const COPY = getMessages('en').learner.story.results;
const storyResultsExtras = (input: StoryResultsInput): ReturnType<typeof storyResultsExtrasWith> =>
  storyResultsExtrasWith(input, COPY);

const base: StoryResultsInput = {
  stars: 3,
  storyId: 'story:seollal-new-year',
  level: 'listen',
  title: { ko: '호야의 설날 아침', romanization: 'hoya-ui seollal achim', en: "Hoya's Seollal Morning" },
  nextQuestId: null,
  hasEpisodePage: true,
  cultureNote: null,
  episodeCompleteLine: null,
};

const texts = (out: ReturnType<typeof storyResultsExtras>): string[] => [
  out.primary.label,
  ...out.secondary.map((a) => a.label),
  ...(out.cultureNote ? [out.cultureNote.label] : []),
  ...(out.encouragement ? [out.encouragement] : []),
  ...(out.episodeLine ? [out.episodeLine] : []),
];

describe('storyResultsExtras: primary action', () => {
  it('is Next story when there is a next story', () => {
    const out = storyResultsExtras({ ...base, nextQuestId: 'quest:next-one' });
    expect(out.primary).toEqual({ action: 'next-story', label: 'Next story', questId: 'quest:next-one' });
  });

  it('is Back home otherwise', () => {
    const out = storyResultsExtras(base);
    expect(out.primary).toEqual({ action: 'home', label: 'Back home' });
  });
});

describe('storyResultsExtras: secondary actions', () => {
  it('offers Read it again (unscored replay target) then Episode page', () => {
    const out = storyResultsExtras({ ...base, level: 'read-along' });
    expect(out.secondary).toEqual([
      {
        action: 'read-again',
        label: 'Read it again',
        target: { storyId: 'story:seollal-new-year', level: 'read-along', mode: 'replay' },
      },
      { action: 'episode', label: 'Episode page' },
    ]);
  });

  it('drops the episode page when there is none, and never exceeds two ghosts', () => {
    const out = storyResultsExtras({ ...base, hasEpisodePage: false });
    expect(out.secondary.map((a) => a.action)).toEqual(['read-again']);
    for (const stars of [0, 1, 2, 3] as const) {
      expect(storyResultsExtras({ ...base, stars }).secondary.length).toBeLessThanOrEqual(2);
    }
  });

  it('puts Read it again first at 0 and 1 star, with an encouraging line', () => {
    for (const stars of [0, 1] as const) {
      const out = storyResultsExtras({ ...base, stars });
      expect(out.secondary[0]?.action).toBe('read-again');
      expect(out.encouragement).toBeTruthy();
    }
  });

  it('has no encouragement line at 2 and 3 stars', () => {
    for (const stars of [2, 3] as const) {
      expect(storyResultsExtras({ ...base, stars }).encouragement).toBeNull();
    }
  });
});

describe('storyResultsExtras: title, culture note, episode line', () => {
  it('passes the story title through as Korean + romanization + English', () => {
    expect(storyResultsExtras(base).title).toEqual(base.title);
  });

  it('shows the culture-note link only when one is supplied', () => {
    expect(storyResultsExtras(base).cultureNote).toBeNull();
    const out = storyResultsExtras({ ...base, cultureNote: { id: 'cn-seollal', titleEn: 'Seollal' } });
    expect(out.cultureNote).toEqual({ id: 'cn-seollal', label: 'Learn about Seollal' });
  });

  it('reserves the episode-complete line slot', () => {
    expect(storyResultsExtras(base).episodeLine).toBeNull();
    expect(storyResultsExtras({ ...base, episodeCompleteLine: 'Episode complete' }).episodeLine).toBe(
      'Episode complete',
    );
  });
});

describe('storyResultsExtras: copy rules (D3)', () => {
  it('has no digit, fraction or percent in any string, for every star tier', () => {
    for (const stars of [0, 1, 2, 3] as const) {
      const out = storyResultsExtras({
        ...base,
        stars,
        nextQuestId: 'quest:next-one',
        cultureNote: { id: 'cn-x', titleEn: 'Seollal' },
      });
      for (const t of texts(out)) {
        expect(t, t).not.toMatch(/[0-9%\/]/);
      }
      expect(scanLearnerCopy(texts(out))).toEqual([]);
    }
  });
});

describe('storyResultsExtras takes its words as a parameter (F-I18N-001 §3.4 rule 3)', () => {
  it('labels the actions from the subtree it is given (en-XA)', () => {
    const pseudo = pseudoLocalize(getMessages('en')).learner.story.results;
    const out = storyResultsExtrasWith({ ...base, stars: 1, cultureNote: { id: 'cn', titleEn: 'Seollal' } }, pseudo);
    expect(out.primary.label).toBe(pseudoText('Back home'));
    expect(out.secondary.map((a) => a.label)).toEqual([pseudoText('Read it again'), pseudoText('Episode page')]);
    expect(out.cultureNote?.label).toBe(pseudoText('Learn about Seollal'));
    expect(out.encouragement).toBe(pseudoText('Every read helps. Want to read it again?'));
  });
});

describe('resultsStoryOf (PR 3.7: is this a story quest, and which story)', () => {
  const story = readyStory();
  const slug = story.id.replace(/^story:/, '');
  const quest = (ref: string | undefined): Pick<Quest, 'steps'> => ({
    steps: [
      { id: 's1', kind: 'intro', titleEn: 'Story time', hoyaLineEn: 'Hi', durationSeconds: 8 },
      ...(ref === undefined
        ? []
        : [{ id: 's2', kind: 'present' as const, titleEn: 'Read', minigameKind: 'story-read' as const, minigameRef: ref, durationSeconds: 60 }]),
    ],
  });
  const find = (id: string): Story | undefined => (id === story.id ? story : undefined);

  it('reads the story, level and title from the quest story-read step', () => {
    expect(resultsStoryOf(quest(`minigame:story-read-along-${slug}`), find)).toEqual({
      storyId: story.id,
      level: 'read-along',
      title: { ko: story.title.ko, romanization: story.title.romanization, en: story.title.en },
    });
  });

  it('is null for a quest without a story-read step, an unknown quest, an unbundled story or a missing level', () => {
    expect(resultsStoryOf(quest(undefined), find)).toBeNull();
    expect(resultsStoryOf(undefined, find)).toBeNull();
    expect(resultsStoryOf(quest('minigame:story-read-listen-not-bundled'), find)).toBeNull();
    expect(resultsStoryOf(quest(`minigame:story-read-read-${slug}`), find)).toBeNull();
  });
});

describe('storyResultsActionEvent (story.results.action, spec §3.9)', () => {
  it('ids and the action only', () => {
    for (const action of ['next-story', 'read-again', 'episode', 'home', 'culture-note'] as const) {
      expect(storyResultsActionEvent('p1', 'quest:story-x-listen', 'story:x', action)).toEqual({
        name: 'story.results.action',
        profileId: 'p1',
        payload: { questId: 'quest:story-x-listen', storyId: 'story:x', action },
      });
    }
  });
});
