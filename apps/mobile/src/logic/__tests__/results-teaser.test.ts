import type { Episode, Overlays, Quest } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { discoverQuest, episodeOf, plainQuest, snapshotWith } from '../stage1/__tests__/fixtures';
import { isStageEntitled } from '../entitlement';
import {
  resultsActions,
  resultsTeaser,
  teaserCtaLabel,
  teaserTappedEvent,
  type ResultsTeaser,
} from '../quest-flow/results-teaser';

const nextUp = getMessages('en').learner.results.nextUp;
const Q1 = discoverQuest('quest:q1', ['jamo:giyeok', 'jamo:nieun']);
const Q2 = discoverQuest('quest:q2', ['jamo:jieut', 'jamo:chieut']);
const Q3 = discoverQuest('quest:q3', ['jamo:mieum'], { teaserEn: 'Say m like mom' });
const Q4: Quest = { ...plainQuest('quest:q4'), blurbEn: 'A plain blurb.' };
const Q5: Quest = plainQuest('quest:q5');
const QUESTS: Quest[] = [Q1, Q2, Q3, Q4, Q5];
const EPISODES: Episode[] = [
  episodeOf('episode:one', ['quest:q1', 'quest:q2', 'quest:q3']),
  episodeOf('episode:two', ['quest:q4'], { theme: 'life' }),
  episodeOf('episode:s2', ['quest:q5'], { stage: 'stage2', theme: 'life' }),
];
const done = (...ids: string[]) =>
  snapshotWith(ids.map((id) => ({ questId: `quest:${id}`, episodeId: EPISODES.find((e) => e.questIds.includes(`quest:${id}`))!.id })));
const base = { quests: QUESTS, episodes: EPISODES };

describe('resultsTeaser: which quest is next up', () => {
  it('is the quest after the one just finished', () => {
    const t = resultsTeaser({ ...base, snapshot: done(), questId: 'quest:q1', total: 5 });
    expect(t).toMatchObject({ questId: 'quest:q2', episodeId: 'episode:one', titleEn: 'Title quest:q2', again: false });
  });

  it('counts the quest just finished as done before the snapshot has it', () => {
    expect(resultsTeaser({ ...base, snapshot: done('q1'), questId: 'quest:q2', total: 5 })?.questId).toBe('quest:q3');
  });

  it('is the real cursor, not the quest after the replayed one (replay quest 1 while the cursor is quest 3)', () => {
    const t = resultsTeaser({ ...base, snapshot: done('q1', 'q2'), questId: 'quest:q1', total: 5 });
    expect(t?.questId).toBe('quest:q3');
  });

  it('crosses into the next episode', () => {
    const t = resultsTeaser({ ...base, snapshot: done('q1', 'q2'), questId: 'quest:q3', total: 5 });
    expect(t).toMatchObject({ questId: 'quest:q4', episodeId: 'episode:two' });
  });

  it('is undefined when nothing is left', () => {
    expect(resultsTeaser({ ...base, snapshot: done('q1', 'q2', 'q3', 'q4', 'q5'), questId: 'quest:q5', total: 5 })).toBeUndefined();
  });

  it('under the OD-4 tier rule, never teases a stage the tier leaves out', () => {
    const free = (stage: string) => isStageEntitled(stage, 'free');
    const all = done('q1', 'q2', 'q3');
    expect(resultsTeaser({ ...base, snapshot: all, questId: 'quest:q4', total: 5, isEntitled: free })).toBeUndefined();
    const premium = (stage: string) => isStageEntitled(stage, 'premium');
    expect(resultsTeaser({ ...base, snapshot: all, questId: 'quest:q4', total: 5, isEntitled: premium })?.questId).toBe('quest:q5');
  });
});

describe('resultsTeaser: placed-out quests (F-PLC-001 section 3.7, consumer 1)', () => {
  it('skips quests the level check placed out', () => {
    const skip = new Set(['quest:q2', 'quest:q3']);
    expect(resultsTeaser({ ...base, snapshot: done(), questId: 'quest:q1', total: 5, skipQuestIds: skip })?.questId).toBe('quest:q4');
  });

  it('offers a placed-out quest never played before nothing at all', () => {
    const skip = new Set(['quest:q2']);
    const t = resultsTeaser({ ...base, snapshot: done('q1', 'q3', 'q4'), questId: 'quest:q5', total: 5, skipQuestIds: skip });
    expect(t?.questId).toBe('quest:q2');
    expect(resultsTeaser({ ...base, snapshot: done('q1', 'q2', 'q3', 'q4'), questId: 'quest:q5', total: 5, skipQuestIds: skip })).toBeUndefined();
  });
});

describe('resultsTeaser: every game skipped', () => {
  it('offers the same quest again and says so', () => {
    const t = resultsTeaser({ ...base, snapshot: done(), questId: 'quest:q1', total: 0 });
    expect(t).toMatchObject({ questId: 'quest:q1', episodeId: 'episode:one', again: true });
    expect(teaserCtaLabel(t!, nextUp)).toBe('Try this one again');
  });

  it('does not count the skipped quest as done even when the cursor is elsewhere', () => {
    const t = resultsTeaser({ ...base, snapshot: done('q1'), questId: 'quest:q2', total: 0 });
    expect(t?.questId).toBe('quest:q2');
  });

  it('is undefined when the played quest is in no episode', () => {
    expect(resultsTeaser({ quests: QUESTS, episodes: [], snapshot: done(), questId: 'quest:q1', total: 0 })).toBeUndefined();
  });
});

describe('resultsTeaser: in the UI language (F-I18N-001 §3.6)', () => {
  const overlays: Overlays = {
    es: {
      'quest:q3': { title: 'Tres', teaser: 'Di m como en mamá' },
      'quest:q4': { title: 'Cuatro', blurb: 'Una descripción sencilla.' },
    },
    ko: {},
  };

  it('localizes the title and the line together: a translated title never sits above an English blurb or teaser', () => {
    const q4 = resultsTeaser({ ...base, snapshot: done('q1', 'q2'), questId: 'quest:q3', total: 5, locale: 'es', overlays });
    expect(q4).toMatchObject({ questId: 'quest:q4', titleEn: 'Cuatro', line: { kind: 'text', text: 'Una descripción sencilla.' } });
    const q3 = resultsTeaser({ ...base, snapshot: done('q1'), questId: 'quest:q2', total: 5, locale: 'es', overlays });
    expect(q3).toMatchObject({ questId: 'quest:q3', titleEn: 'Tres', line: { kind: 'text', text: 'Di m como en mamá' } });
  });

  it('stays English for en and for a quest without an overlay', () => {
    const en = resultsTeaser({ ...base, snapshot: done('q1', 'q2'), questId: 'quest:q3', total: 5, locale: 'en', overlays });
    expect(en).toMatchObject({ titleEn: 'Title quest:q4', line: { kind: 'text', text: 'A plain blurb.' } });
    const q2 = resultsTeaser({ ...base, snapshot: done(), questId: 'quest:q1', total: 5, locale: 'es', overlays });
    expect(q2?.titleEn).toBe('Title quest:q2');
  });
});

describe('resultsTeaser: the one line', () => {
  it('uses teaserEn when the quest has one', () => {
    const t = resultsTeaser({ ...base, snapshot: done('q1', 'q2'), questId: 'quest:q2', total: 5 });
    expect(t?.line).toEqual({ kind: 'text', text: 'Say m like mom' });
  });

  it('generates "New letters" from the Discover jamo, as taught content', () => {
    const t = resultsTeaser({ ...base, snapshot: done(), questId: 'quest:q1', total: 5 });
    expect(t?.line).toEqual({
      kind: 'letters',
      letters: [
        { ko: 'ㅈ', romanization: 'j' },
        { ko: 'ㅊ', romanization: 'ch' },
      ],
    });
  });

  it('falls back to the blurb, then to no line at all', () => {
    expect(resultsTeaser({ ...base, snapshot: done('q1', 'q2', 'q3'), questId: 'quest:q3', total: 5 })?.line).toEqual({
      kind: 'text',
      text: 'A plain blurb.',
    });
    const bare = resultsTeaser({ quests: [Q1, { ...Q5, blurbEn: undefined }], episodes: [EPISODES[0]!, EPISODES[2]!], snapshot: done('q1'), questId: 'quest:q1', total: 5, isEntitled: () => true });
    expect(bare?.questId).toBe('quest:q5');
    expect(bare?.line).toBeUndefined();
  });

  it('skips a jamo id the content does not know', () => {
    const odd = discoverQuest('quest:odd', ['jamo:nope', 'jamo:mieum']);
    const t = resultsTeaser({
      quests: [Q1, odd],
      episodes: [episodeOf('episode:x', ['quest:q1', 'quest:odd'])],
      snapshot: done(),
      questId: 'quest:q1',
      total: 5,
    });
    expect(t?.line).toEqual({ kind: 'letters', letters: [{ ko: 'ㅁ', romanization: 'm' }] });
  });

  it('uses the "word" Discover pages as no letters and falls to the blurb', () => {
    const wordsOnly = { ...discoverQuest('quest:w', []), blurbEn: 'Words from home.' };
    const t = resultsTeaser({
      quests: [Q1, wordsOnly],
      episodes: [episodeOf('episode:x', ['quest:q1', 'quest:w'])],
      snapshot: done(),
      questId: 'quest:q1',
      total: 5,
    });
    expect(t?.line).toEqual({ kind: 'text', text: 'Words from home.' });
  });

  it('never carries a count, a percent or "must"', () => {
    const t = resultsTeaser({ ...base, snapshot: done(), questId: 'quest:q1', total: 5 });
    expect(JSON.stringify(t)).not.toMatch(/%|must|\d+ of \d+/i);
    expect(teaserCtaLabel(t!, nextUp)).toBe('Play next quest');
    expect(JSON.stringify(t)).not.toMatch(/Play next quest|Try this one again|New letters/);
  });
});

describe('teaserCtaLabel: the words come from the message subtree', () => {
  it('picks "next" or "again" by the teaser, in the given language', () => {
    const next = { questId: 'quest:q2', again: false } as ResultsTeaser;
    const again = { questId: 'quest:q1', again: true } as ResultsTeaser;
    expect(teaserCtaLabel(next, nextUp)).toBe('Play next quest');
    expect(teaserCtaLabel(again, nextUp)).toBe('Try this one again');
    const es = { ...nextUp, next: { cta: 'Jugar la siguiente' }, again: { cta: 'Probar otra vez' } };
    expect(teaserCtaLabel(next, es)).toBe('Jugar la siguiente');
    expect(teaserCtaLabel(again, es)).toBe('Probar otra vez');
  });
});

describe('resultsActions: what the buttons look like', () => {
  const teaser = { questId: 'quest:q2' } as ResultsTeaser;

  it('keeps Back home primary and Episode page ghost with no teaser', () => {
    expect(resultsActions(undefined)).toEqual({ backHome: { tone: 'primary', size: 'hero' }, episodePage: { tone: 'ghost', size: 'md' } });
  });

  it('demotes Back home and Episode page to ghost under a teaser', () => {
    expect(resultsActions(teaser)).toEqual({ backHome: { tone: 'ghost', size: 'md' }, episodePage: { tone: 'ghost', size: 'md' } });
  });
});

describe('teaserTappedEvent', () => {
  it('is quest.teaser_tapped with from and to', () => {
    expect(teaserTappedEvent('profile:p1', 'quest:q1', { questId: 'quest:q2' } as ResultsTeaser)).toEqual({
      name: 'quest.teaser_tapped',
      profileId: 'profile:p1',
      payload: { fromQuestId: 'quest:q1', toQuestId: 'quest:q2' },
    });
  });

  it('reports the same quest for "Try this one again"', () => {
    expect(teaserTappedEvent('profile:p1', 'quest:q1', { questId: 'quest:q1' } as ResultsTeaser).payload).toEqual({
      fromQuestId: 'quest:q1',
      toQuestId: 'quest:q1',
    });
  });
});
