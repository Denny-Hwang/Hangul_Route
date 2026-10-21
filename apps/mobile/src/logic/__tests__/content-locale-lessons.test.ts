import { describe, expect, it } from 'vitest';
import { LESSON_EPISODES, LESSON_QUESTS, loadLessonTitles } from '../../content/__generated__/lessons-index';
import { localizeMissionCard, localizeTitle } from '../content-locale';
import type { MissionCard } from '../homework/mission-builder';

/** A shipped lesson cell's titles come from the locale's title chunk (F-CURR-001 §3.10, F-CURR-002 §10); the test setup loads both. */
describe('lesson glosses reach every title helper by default (F-CURR-001 §3.10)', () => {
  const quest = LESSON_QUESTS[0];
  const episode = LESSON_EPISODES[0];
  const card = {
    slot: 2,
    kind: 'new',
    titleEn: quest?.titleEn,
    subtitle: 'new',
    questId: quest?.id,
    episodeId: episode?.id,
    collected: false,
  } as MissionCard;

  it('localizeMissionCard shows a lesson quest title in Spanish and Korean, English as built', async () => {
    const [es, ko] = await Promise.all([loadLessonTitles('es'), loadLessonTitles('ko')]);
    const id = quest?.id ?? '';
    expect(es.LESSON_TITLE_OVERLAYS[id]?.title).toBeTruthy();
    expect(localizeMissionCard(card, 'es').titleEn).toBe(es.LESSON_TITLE_OVERLAYS[id]?.title);
    expect(localizeMissionCard(card, 'ko').titleEn).toBe(ko.LESSON_TITLE_OVERLAYS[id]?.title);
    expect(localizeMissionCard(card, 'en')).toBe(card);
  });

  it('localizeTitle (notes, the Results teaser) reads the same glosses', async () => {
    const es = await loadLessonTitles('es');
    const id = episode?.id ?? '';
    expect(localizeTitle({ titleEn: episode?.titleEn ?? '' }, id, 'es').titleEn).toBe(es.LESSON_TITLE_OVERLAYS[id]?.title);
  });
});
