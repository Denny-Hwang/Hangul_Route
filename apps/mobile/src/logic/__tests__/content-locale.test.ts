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
  localizeTheme,
} from '../content-locale';
import type { MissionCard } from '../homework/mission-builder';
import { scopeFor } from '../minigame-config';

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
    'minigame:s1-life-card-1': { 'cardPairs.gimchi.gloss': 'Kimchi (es)' },
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
    const scope = scopeFor('minigame:s1-life-card-1')!;
    const es = localizeScope(scope, 'minigame:s1-life-card-1', 'es', overlays);
    expect(es.cardPairs?.find((p) => p.romanization === 'gimchi')?.en).toBe('Kimchi (es)');
    expect(es.cardPairs?.find((p) => p.romanization === 'bap')?.en).toBe('Rice');
    expect(localizeScope(scope, 'minigame:s1-life-card-1', 'en', overlays)).toBe(scope);
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

  it('defaults to the generated overlays', () => {
    expect(localizeCard(card, 'es')).toEqual(card);
    expect(localizeMissionCard({ slot: 2, kind: 'new', subtitle: 'new', collected: false, titleEn: 'x', questId: quest.id }, 'es').titleEn).toBe('x');
  });
});
