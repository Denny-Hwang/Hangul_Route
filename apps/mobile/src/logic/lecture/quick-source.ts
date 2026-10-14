import type { UiLocale } from '@hangul-route/content-schema';
import { handWrittenEpisodes, isGridEpisode, jamoConsonants, jamoVowels, questById } from '../../content';
import { localizeEpisode, localizeQuest } from '../content-locale';
import type { QuickSource } from './quick-lesson';

/**
 * The bundled content behind Quick lesson (F-TCH-004 §3.12): shipped grid
 * episodes and their lessons, titled in the presenter language, and the
 * consonant and vowel sets. Story shelf episodes and word topics join with
 * their adapters (PR 11, PR 12), which add `stories` / `topics` here.
 */
export function quickSource(locale: UiLocale): QuickSource {
  const episodes = handWrittenEpisodes.filter((e) => e.status === 'shipped' && isGridEpisode(e) && e.questIds.length > 0);
  const questIds = [...new Set(episodes.flatMap((e) => e.questIds))];
  return {
    episodes: episodes.map((e) => {
      const local = localizeEpisode(e, locale);
      return { id: e.id, title: local.titleEn, minutes: e.estimatedMinutes, questIds: e.questIds };
    }),
    quests: questIds.flatMap((id) => {
      const quest = questById(id);
      if (!quest) return [];
      return [{ id, title: localizeQuest(quest, locale).titleEn, minutes: quest.estimatedMinutes }];
    }),
    consonants: jamoConsonants.map((j) => j.id),
    vowels: jamoVowels.map((j) => j.id),
  };
}
