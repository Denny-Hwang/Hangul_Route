import type { Overlays } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { cardById, episodeById, findJamo, questById, stages, themes } from '../../content';
import {
  localizeCard,
  localizeEpisode,
  localizeJamo,
  localizeMissionCard,
  localizeQuest,
  localizeScope,
  localizeStage,
  localizeStory,
  localizeTheme,
  localizeTitle,
} from '../content-locale';
import type { MissionCard } from '../homework/mission-builder';
import { scopeFor } from '../minigame-config';
import { storiesAll } from '../../content/stories';
import { buildSequenceCards } from '../story/sequence-cards';
import { REALIA_FIXTURES } from '../../navigation/realia-read-e2e-fixture';

/**
 * F-I18N-001 §3.6: the screens show content titles, blurbs and glosses through
 * these helpers with the UI locale. They bind each kind of shipped content to its
 * overlay entity id (`stage:<key>`, `theme:<key>`, the content id otherwise).
 */

const card = cardById('card:book')!;
const episode = episodeById('episode:stage1-letters')!;
const quest = questById('quest:stage1-letters-q1')!;
const stage = stages.find((s) => s.key === 'stage1')!;
const theme = themes.find((t) => t.key === 'letters')!;
const jamo = findJamo('jamo:giyeok')!;

const overlays: Overlays = {
  es: {
    'card:book': { title: 'Perrito', blurb: 'Un perrito simpático.', fact: 'Dato.' },
    'episode:stage1-letters': { title: 'Letras', hoyaIntro: '¡Hola!' },
    'quest:stage1-letters-q1': { title: 'Primeras letras', [`steps.${quest.steps[0]!.id}.title`]: 'Empezamos' },
    'stage:stage1': { title: 'Hangul (es)', oneLiner: 'Cada letra.' },
    'theme:letters': { title: 'Letras' },
    'jamo:giyeok': { soundHint: 'como la g de gato', 'exampleWord.gloss': 'familia' },
    'minigame:s2-life-card-1': { 'cardPairs.gimbap.gloss': 'Kimbap (es)' },
  },
  ko: {},
};

describe('content-locale: one helper per kind of shipped content', () => {
  it('fixtures exist in the shipped modules', () => {
    for (const x of [card, episode, quest, stage, theme, jamo]) expect(x).toBeDefined();
  });

  it('returns the very same object in English and when a locale has no overlay', () => {
    expect(localizeCard(card, 'en', overlays)).toBe(card);
    expect(localizeCard(card, 'ko', overlays)).toBe(card);
    expect(localizeStage(stage, 'ko', overlays)).toBe(stage);
  });

  it('localizes cards, episodes and quests by their id; taught Korean and romanization stay', () => {
    const es = localizeCard(card, 'es', overlays);
    expect(es).toMatchObject({ titleEn: 'Perrito', blurbEn: 'Un perrito simpático.', factEn: 'Dato.' });
    expect(es.subtitleKo).toBe(card.subtitleKo);
    expect(es.romanization).toBe(card.romanization);
    expect(localizeEpisode(episode, 'es', overlays)).toMatchObject({ titleEn: 'Letras', hoyaIntroEn: '¡Hola!' });
    const q = localizeQuest(quest, 'es', overlays);
    expect(q.titleEn).toBe('Primeras letras');
    expect(q.steps[0]!.titleEn).toBe('Empezamos');
    expect(q.steps[1]).toBe(quest.steps[1]);
  });

  it('localizes stages and themes by stage:<key> and theme:<key>', () => {
    expect(localizeStage(stage, 'es', overlays)).toMatchObject({ titleEn: 'Hangul (es)', oneLinerEn: 'Cada letra.' });
    expect(localizeTheme(theme, 'es', overlays).titleEn).toBe('Letras');
  });

  it('localizes the jamo sound hint and example-word gloss, never the letter or its romanization', () => {
    const es = localizeJamo(jamo, 'es', overlays);
    expect(es.soundHint).toBe('como la g de gato');
    expect(es.exampleWordEn).toBe('familia');
    expect(es.char).toBe(jamo.char);
    expect(es.romanization).toBe(jamo.romanization);
    expect(es.exampleWordKo).toBe(jamo.exampleWordKo);
  });

  it('localizes a minigame scope by its minigame ref', () => {
    const scope = scopeFor('minigame:s2-life-card-1')!;
    const es = localizeScope(scope, 'minigame:s2-life-card-1', 'es', overlays);
    expect(es.cardPairs?.find((p) => p.romanization === 'gimbap')?.en).toBe('Kimbap (es)');
    expect(es.cardPairs?.find((p) => p.romanization === 'bap')?.en).toBe('Rice');
    expect(localizeScope(scope, 'minigame:s2-life-card-1', 'en', overlays)).toBe(scope);
  });

  it('localizes a Realia Read scope: question, picture label and the found-line gloss (row G-2)', () => {
    const scope = REALIA_FIXTURES.menu;
    const ref = 'minigame:e2e-realia-menu';
    const ko: Overlays = {
      es: {},
      ko: {
        [ref]: {
          'realiaRead.rounds.q1.question': '이건 얼마예요?',
          'realiaRead.rounds.q4.options.bread.label': '빵',
          'realiaRead.realia.entries.ramyeon.text.gloss': '라면 (ko)',
          'realiaRead.realia.entries.ramyeon.value.gloss': '3,000원 (ko)',
        },
      },
    };
    const out = localizeScope(scope, ref, 'ko', ko);
    const rounds = out.realiaRead!.rounds;
    expect(rounds.find((r) => r.id === 'q1')!.questionEn).toBe('이건 얼마예요?');
    const q4 = rounds.find((r) => r.id === 'q4')!;
    expect(q4.options.find((o) => o.id === 'bread')!.labelEn).toBe('빵');
    expect(q4.options.find((o) => o.id === 'banana')!.labelEn).toBe('banana');
    const ramyeon = out.realiaRead!.realia.entries.find((e) => e.id === 'ramyeon')!;
    expect(ramyeon.text.en).toBe('라면 (ko)');
    expect(ramyeon.value?.en).toBe('3,000원 (ko)');
    // The taught Korean and its romanization never change.
    expect(ramyeon.text.ko).toBe('라면');
    expect(ramyeon.text.romanization).toBe('ramyeon');
    expect(localizeScope(scope, ref, 'en', ko)).toBe(scope);
  });

  it('localizes a story by its id: the story-sequence cards show the overlay caption (F-STORY-001 §3.12 row)', () => {
    const story = storiesAll[0]!;
    const tier = story.tiers[0]!;
    const sceneId = tier.sequenceSceneIds[0]!;
    const local: Overlays = {
      es: { [story.id]: { [`scenes.${sceneId}.caption`]: 'Leyenda', [`scenes.${sceneId}.narration`]: 'Narración' } },
      ko: {},
    };
    const es = localizeStory(story, 'es', local);
    const scene = es.tiers[0]!.scenes.find((s) => s.id === sceneId)!;
    const source = tier.scenes.find((s) => s.id === sceneId)!;
    expect(scene.narrationEn).toBe('Narración');
    expect(scene.keyword).toBe(source.keyword);
    expect(localizeStory(story, 'en', local)).toBe(story);
    const scope = { kind: 'story-sequence', story: { storyId: story.id, level: tier.level } } as const;
    expect(buildSequenceCards(scope, es)[0]!.caption).toBe(source.captionEn === undefined ? 'Narración' : 'Leyenda');
  });

  it('localizes a mission card title from its quest, else its episode; the daily test names itself', () => {
    const base = { slot: 1, kind: 'replay', subtitle: 'replay', collected: false } as const;
    const questCard: MissionCard = { ...base, titleEn: quest.titleEn, questId: quest.id, episodeId: episode.id };
    const storyCard: MissionCard = { ...base, kind: 'story', subtitle: 'story', titleEn: episode.titleEn, episodeId: episode.id };
    const dailyTest: MissionCard = { ...base, kind: 'daily-test', subtitle: 'dailyTest', titleEn: null };
    const orphan: MissionCard = { ...base, titleEn: 'Something' };
    expect(localizeMissionCard(questCard, 'es', overlays).titleEn).toBe('Primeras letras');
    expect(localizeMissionCard(storyCard, 'es', overlays).titleEn).toBe('Letras');
    expect(localizeMissionCard(dailyTest, 'es', overlays)).toBe(dailyTest);
    expect(localizeMissionCard(orphan, 'es', overlays)).toBe(orphan);
    expect(localizeMissionCard(questCard, 'en', overlays)).toBe(questCard);
    expect(localizeMissionCard({ ...questCard, questId: 'quest:none' }, 'es', overlays).titleEn).toBe(quest.titleEn);
  });

  it('localizes a story card title from its story, not from its quest (F-STORY-004 §3.7)', () => {
    const local: Overlays = { es: { 'story:tiger': { title: 'El tigre' }, [quest.id]: { title: 'Primeras letras' } }, ko: {} };
    const storyCard: MissionCard = {
      slot: 1,
      kind: 'story',
      subtitle: 'story',
      collected: false,
      titleEn: 'The Tiger',
      storyId: 'story:tiger',
      storyReason: 'next',
      questId: quest.id,
      episodeId: episode.id,
    };
    expect(localizeMissionCard(storyCard, 'es', local).titleEn).toBe('El tigre');
    expect(localizeMissionCard({ ...storyCard, storyId: 'story:none' }, 'es', local).titleEn).toBe('The Tiger');
  });

  it('localizes a practice card of a word topic from its topic overlay (F-ENT-003 E3-7)', () => {
    const local: Overlays = { es: { 'vocab-topic:food': { title: 'Comida' } }, ko: {} };
    const practice: MissionCard = { slot: 2, kind: 'practice', subtitle: 'practice', practiceKind: 'topic', topicKey: 'food', collected: false, titleEn: 'Food' };
    expect(localizeMissionCard(practice, 'es', local).titleEn).toBe('Comida');
    expect(localizeMissionCard({ ...practice, topicKey: 'none' }, 'es', local).titleEn).toBe('Food');
    expect(localizeMissionCard({ ...practice, topicKey: undefined }, 'es', local)).toEqual({ ...practice, topicKey: undefined });
  });

  it('swaps the overlay title into anything that carries an entity title (the Results teaser)', () => {
    const teaser = { questId: quest.id, titleEn: quest.titleEn, line: 'x' };
    expect(localizeTitle(teaser, quest.id, 'es', overlays)).toEqual({ ...teaser, titleEn: 'Primeras letras' });
    expect(localizeTitle(teaser, quest.id, 'en', overlays)).toBe(teaser);
    expect(localizeTitle(teaser, 'quest:none', 'es', overlays)).toBe(teaser);
  });

  it('defaults to the generated overlays', () => {
    expect(localizeCard(card, 'es')).toEqual(card);
    expect(localizeMissionCard({ slot: 2, kind: 'new', subtitle: 'new', collected: false, titleEn: 'x', questId: quest.id }, 'es').titleEn).toBe('x');
  });
});
