import type { Overlays } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { episodeOf, plainQuest } from '../../stage1/__tests__/fixtures';
import type { MinigameScope } from '../../minigame-config';
import {
  LESSON_STAGE_NUMBERS,
  lessonLookup,
  lessonStageOfRef,
  mergeOverlays,
  questsInCursorOrder,
  shippedLessonStages,
  type LessonStage,
  type StageModule,
} from '../lesson-lookup';

const scope: MinigameScope = { kind: 'card-match', rounds: 2, cardPairs: [{ ko: '연', romanization: 'yeon', en: 'kite' }] };
const REF = 'minigame:s2-rites-q1-practice';
const EMPTY: Overlays = { es: {}, ko: {} };
const BASE: Overlays = { es: { 'card:a': { title: 'A' } }, ko: {} };

function modules() {
  const loads: LessonStage[] = [];
  const mod = (stage: LessonStage): StageModule => ({
    LESSON_SCOPES: stage === 2 ? { [REF]: scope } : {},
    LESSON_SCOPE_OVERLAYS: stage === 2 ? { es: { [REF]: { 'cardPairs.yeon.gloss': 'cometa' } }, ko: {} } : EMPTY,
  });
  return { loads, load: (stage: LessonStage) => (loads.push(stage), mod(stage)) };
}

describe('lessonStageOfRef', () => {
  it('reads the stage of a lesson minigame ref and nothing else', () => {
    expect(LESSON_STAGE_NUMBERS).toEqual([2, 3, 4, 6, 7]);
    expect(lessonStageOfRef(REF)).toBe(2);
    expect(lessonStageOfRef('minigame:s7-crafts-q3-check')).toBe(7);
    expect(lessonStageOfRef('minigame:s5-rites-q1-check')).toBeUndefined();
    expect(lessonStageOfRef('minigame:s1-letters-q1-check')).toBeUndefined();
    expect(lessonStageOfRef('minigame:s2-life-card-1')).toBeUndefined();
    expect(lessonStageOfRef('minigame:story-read-listen-sun-and-moon')).toBeUndefined();
  });
});

describe('lessonLookup (F-CURR-001 §3.12: a stage loads the first time one of its scopes is asked for)', () => {
  it('loads nothing at start and each shipped stage once, on first use', () => {
    const { loads, load } = modules();
    const lookup = lessonLookup(load, new Set<LessonStage>([2, 3]));
    expect(loads).toEqual([]);
    expect(lookup.scopeFor(REF)).toBe(scope);
    expect(lookup.scopeFor(REF)).toBe(scope);
    expect(lookup.scopeFor('minigame:s3-life-q1-apply')).toBeUndefined();
    expect(loads).toEqual([2, 3]);
  });

  it('never loads a stage with no shipped cell, nor for a ref that is not a lesson ref', () => {
    const { loads, load } = modules();
    const lookup = lessonLookup(load, new Set<LessonStage>([2]));
    expect(lookup.scopeFor('minigame:s6-life-q1-apply')).toBeUndefined();
    expect(lookup.scopeFor('minigame:s1-letters-q1-check')).toBeUndefined();
    expect(lookup.scopeOverlaysFor('minigame:s1-letters-q1-check', BASE)).toBe(BASE);
    expect(loads).toEqual([]);
  });

  it('adds the stage glosses of a lesson ref to the base overlays', () => {
    const { load } = modules();
    const lookup = lessonLookup(load, new Set<LessonStage>([2, 3]));
    expect(lookup.scopeOverlaysFor(REF, BASE)).toEqual({ es: { 'card:a': { title: 'A' }, [REF]: { 'cardPairs.yeon.gloss': 'cometa' } }, ko: {} });
    // A stage module with no glosses returns the base itself.
    expect(lookup.scopeOverlaysFor('minigame:s3-life-q1-apply', BASE)).toBe(BASE);
  });
});

describe('mergeOverlays', () => {
  it('is the base itself when there is nothing to add, else both tables', () => {
    expect(mergeOverlays(BASE, EMPTY)).toBe(BASE);
    expect(mergeOverlays(BASE, { es: {}, ko: { 'quest:x': { title: '엑스' } } })).toEqual({ es: BASE.es, ko: { 'quest:x': { title: '엑스' } } });
  });
});

describe('shippedLessonStages', () => {
  it('lists the lesson stages that hold an episode', () => {
    expect([...shippedLessonStages([{ stage: 'stage1' }, { stage: 'stage3' }, { stage: 'stage5' }, { stage: 'stage7' }, { stage: 'stage3' }])]).toEqual([3, 7]);
    expect(shippedLessonStages([]).size).toBe(0);
  });
});

describe('questsInCursorOrder', () => {
  const q = (id: string) => plainQuest(`quest:${id}`);
  const episodes = [
    episodeOf('episode:stage1-letters', ['quest:s1']),
    episodeOf('episode:stage2-life', ['quest:s2-life'], { stage: 'stage2', theme: 'life' }),
    episodeOf('episode:stage4-rites', ['quest:s4-rites'], { stage: 'stage4', theme: 'rites' }),
    episodeOf('episode:stage2-letters', ['quest:s2-wb'], { stage: 'stage2' }),
    episodeOf('episode:stage3-letters', ['quest:s3-fs'], { stage: 'stage3' }),
    episodeOf('episode:stage6-letters', ['quest:s6-menu', 'quest:s6-b'], { stage: 'stage6' }),
    episodeOf('episode:stage7-life', ['quest:s7-day'], { stage: 'stage7', theme: 'life' }),
  ];

  it('puts lesson quests of Stages 2-4 by stage before the stories and books, and Stages 6-7 after them', () => {
    const ids = questsInCursorOrder({
      early: [q('s1'), q('s2-life'), q('s4-rites')],
      lessons: [q('s7-day'), q('s2-wb'), q('s6-menu'), q('s3-fs'), q('s6-b')],
      middle: [q('story'), q('book')],
      episodes,
    }).map((x) => x.id.slice('quest:'.length));
    expect(ids).toEqual(['s1', 's2-life', 's2-wb', 's3-fs', 's4-rites', 'story', 'book', 's6-menu', 's6-b', 's7-day']);
  });

  it('keeps today\'s order when no lesson ships', () => {
    const early = [q('s1'), q('s2-life'), q('s4-rites')];
    expect(questsInCursorOrder({ early, lessons: [], middle: [q('story')], episodes }).map((x) => x.id)).toEqual([
      'quest:s1',
      'quest:s2-life',
      'quest:s4-rites',
      'quest:story',
    ]);
  });

  it('a quest no episode lists goes after the stories and books', () => {
    expect(questsInCursorOrder({ early: [q('loose')], lessons: [], middle: [q('story')], episodes }).map((x) => x.id)).toEqual([
      'quest:story',
      'quest:loose',
    ]);
  });
});
