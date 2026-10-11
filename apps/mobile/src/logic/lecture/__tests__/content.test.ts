import { LectureDeckSchema, type LectureBlock, type Overlays } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { episodeById, episodesAll, jamoAll, questById, questsAll } from '../../../content';
import { scopeFor } from '../../minigame-config';
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
    // Content titles change with content PRs (#259 renamed q1): compare with the source, never a literal.
    expect(b.questById('quest:stage1-letters-q1')).toBe(questById('quest:stage1-letters-q1'));
    expect(b.questById('quest:stage1-letters-q1')?.titleEn).toEqual(expect.any(String));
    expect(b.episodeById('episode:stage1-letters')).toBe(episodeById('episode:stage1-letters'));
    expect(b.cardById('card:book')?.subtitleKo).toBe('책');
    const playRef = questById('quest:stage1-letters-q1')!.steps.find((s) => s.minigameRef !== undefined)!.minigameRef!;
    expect(b.scopeFor(playRef)).toEqual(scopeFor(playRef));
    expect(b.scopeFor(playRef)?.kind).toEqual(expect.any(String));
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

  it.each(['en', 'es', 'ko'] as const)(
    'every shipped episode and quest expands with no Korean missing its romanization (rule 11, %s)',
    (locale) => {
      const blocks: LectureBlock[] = [
        ...shippedEpisodes.map((e): LectureBlock => ({ kind: 'episode', id: e.id })),
        ...questsAll.map((q): LectureBlock => ({ kind: 'quest', id: q.id })),
      ];
      for (let i = 0; i < blocks.length; i += 30) {
        const { slides, skipped } = expandDeck(deck(blocks.slice(i, i + 30)), lectureBundle(locale), { canPlayKorean: true });
        expect(slides.length).toBeGreaterThan(0);
        expect(skipped.filter((s) => s.reason === 'no-romanization' || s.reason === 'unknown-id')).toEqual([]);
        // A skipped step is always a minigame kind the presenter cannot show, never a step dropped for having no minigame.
        expect(skipped.filter((s) => s.reason === 'unsupported-step' && !s.ref.startsWith('minigame:'))).toEqual([]);
      }
    },
  );

  it('every quest teaches: at least one slide besides its title and End', () => {
    for (const q of questsAll) {
      const { slides } = expandDeck(deck([{ kind: 'quest', id: q.id }]), lectureBundle('en'), { canPlayKorean: true });
      expect(slides.filter((s) => s.kind !== 'title' && s.kind !== 'end').length, q.id).toBeGreaterThan(0);
    }
  });

  it('every quest with a Discover step shows a letter slide for each jamo it discovers, before any quiz', () => {
    const discovering = questsAll.filter((q) => q.steps.some((s) => s.kind === 'discover'));
    expect(discovering.length).toBeGreaterThan(0);
    for (const q of discovering) {
      const jamoIds = q.steps.flatMap((s) => s.discover?.pages.flatMap((p) => p.items.flatMap((it) => (it.type === 'jamo' ? [it.jamoId] : []))) ?? []);
      expect(jamoIds.length, q.id).toBeGreaterThan(0);
      const { slides } = expandDeck(deck([{ kind: 'quest', id: q.id }]), lectureBundle('en'), { canPlayKorean: true });
      const letterAt = new Map(slides.flatMap((s, i) => (s.kind === 'letter' ? [[s.jamoId, i] as const] : [])));
      const firstQuiz = slides.findIndex((s) => s.kind === 'quiz');
      for (const id of jamoIds) {
        expect(letterAt.has(id), `${q.id} ${id}`).toBe(true);
        if (firstQuiz >= 0) expect(letterAt.get(id)!, `${q.id} ${id}`).toBeLessThan(firstQuiz);
      }
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
    expect(b.episodeById('episode:stage1-letters')?.titleEn).toBe(episodeById('episode:stage1-letters')!.titleEn);
    expect(b.jamoAll).not.toBe(jamoAll);
    const giyeok = b.jamoAll.find((j) => j.id === 'jamo:giyeok')!;
    expect(giyeok).toMatchObject({ char: 'ㄱ', exampleWordKo: '가족', exampleWordRomanization: 'gajok', exampleWordEn: 'familia' });
  });
});
