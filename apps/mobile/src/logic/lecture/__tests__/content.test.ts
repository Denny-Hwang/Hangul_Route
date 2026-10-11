import { LectureDeckSchema, type LectureBlock, type Overlays } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { episodesAll, jamoAll, questsAll } from '../../../content';
import { expandDeck } from '../deck-builder';
import { PAUSE_WORD, lectureBundle } from '../content';

const deck = (blocks: LectureBlock[]) =>
  LectureDeckSchema.parse({ v: 1, id: 'lecture:ship01', title: 'All of it', createdAt: '2026-10-11T09:00:00Z', seed: 1, blocks });

const shippedEpisodes = episodesAll.filter((e) => e.status !== 'preview' && e.questIds.length > 0);

describe('the presenter content bundle (F-TCH-004 §3.3, §3.13)', () => {
  it('the Pause word is taught Korean with romanization and a gloss (no Hangul in a UI message)', () => {
    expect(PAUSE_WORD).toEqual({ ko: '잠깐', romanization: 'jamkkan', glossKey: 'learner.presenter.pause.gloss', en: 'wait a moment' });
  });

  it('looks up the bundled content', () => {
    const b = lectureBundle('en');
    expect(b.jamoAll).toBe(jamoAll);
    // Read the title from the content, so a quest rename (F-QUEST-002 Q-6a renamed this one) does not break the lookup check.
    const firstQuest = questsAll.find((q) => q.id === 'quest:stage1-letters-q1');
    expect(firstQuest).toBeDefined();
    expect(b.questById('quest:stage1-letters-q1')?.titleEn).toBe(firstQuest?.titleEn);
    expect(b.episodeById('episode:stage1-letters')?.titleEn).toBe('Meet the Letters');
    expect(b.cardById('card:book')?.subtitleKo).toBe('책');
    expect(b.scopeFor('minigame:s1-letters-q1-play')?.kind).toBe('match-sound');
    expect(b.questById('quest:nope')).toBeUndefined();
    expect(b.episodeById('episode:nope')).toBeUndefined();
    expect(b.cardById('card:nope')).toBeUndefined();
    expect(b.scopeFor('minigame:nope')).toBeUndefined();
    expect(b.hasStrokes('jamo:giyeok')).toBe(true);
    expect(b.hasStrokes('jamo:nope')).toBe(false);
    expect(b.strokeReviewed('jamo:giyeok')).toBe(false);
  });

  it('stories and vocabulary topics wait for their adapters (PR 11, PR 12)', () => {
    const b = lectureBundle('en');
    expect(b.story).toBeUndefined();
    expect(b.vocabTopic).toBeUndefined();
  });

  it('every shipped episode and quest expands with no Korean missing its romanization (rule 11)', () => {
    const blocks: LectureBlock[] = [
      ...shippedEpisodes.map((e): LectureBlock => ({ kind: 'episode', id: e.id })),
      ...questsAll.map((q): LectureBlock => ({ kind: 'quest', id: q.id })),
    ];
    for (let i = 0; i < blocks.length; i += 30) {
      const { slides, skipped } = expandDeck(deck(blocks.slice(i, i + 30)), lectureBundle('en'), { canPlayKorean: true });
      expect(slides.length).toBeGreaterThan(0);
      expect(skipped.filter((s) => s.reason === 'no-romanization' || s.reason === 'unknown-id')).toEqual([]);
    }
  });

  it('localizes content text through the overlays, never the Korean or its romanization', () => {
    const overlays: Overlays = {
      es: {
        'quest:stage1-letters-q1': { title: 'Conoce g, n, d, l' },
        'jamo:giyeok': { 'exampleWord.gloss': 'familia' },
        'card:book': { title: 'Libro' },
      },
      ko: {},
    };
    const b = lectureBundle('es', overlays);
    expect(b.questById('quest:stage1-letters-q1')?.titleEn).toBe('Conoce g, n, d, l');
    expect(b.cardById('card:book')).toMatchObject({ titleEn: 'Libro', subtitleKo: '책', romanization: 'chaek' });
    const { slides } = expandDeck(deck([{ kind: 'quest', id: 'quest:stage1-letters-q1' }]), b, { canPlayKorean: true });
    expect(slides[0]).toMatchObject({ kind: 'title', title: 'Conoce g, n, d, l' });
    expect(b.episodeById('episode:stage1-letters')?.titleEn).toBe('Meet the Letters');
    expect(b.jamoAll).not.toBe(jamoAll);
    const giyeok = b.jamoAll.find((j) => j.id === 'jamo:giyeok')!;
    expect(giyeok).toMatchObject({ char: 'ㄱ', exampleWordKo: '가족', exampleWordRomanization: 'gajok', exampleWordEn: 'familia' });
  });
});
