import type { HiddenHeritageRoundLike, HiddenHeritageScene } from '@hangul-route/design-system/src/scene-art/hidden-heritage/types';

/**
 * A scene's reference round in the UI language (F-CURR-002 row CM-37; F-I18N-001 §3.10): the scene's own es / ko text
 * replaces the alt text and the meaning that names each spot, as a lesson's `content/i18n/` overlay
 * (`hiddenHeritage.rounds.<roundId>.…`) does for a shipped cell once its English round is parsed. The Korean word and
 * its romanization never change; a meaning the overlay leaves out stays English. Read by the fixture-build e2e screen
 * only, so it rides in that screen's chunk.
 */
export function localizeReferenceRound<R extends HiddenHeritageRoundLike>(round: R, overlays: HiddenHeritageScene['overlays'], locale: string): R {
  const overlay = locale === 'es' || locale === 'ko' ? overlays?.[locale] : undefined;
  if (!overlay) return round;
  const meaning = <T extends R['others'][number]>(thing: T): T => ({ ...thing, word: { ...thing.word, en: overlay.things[thing.id] ?? thing.word.en } });
  return { ...round, altEn: overlay.alt, targets: round.targets.map(meaning), others: round.others.map(meaning) };
}
