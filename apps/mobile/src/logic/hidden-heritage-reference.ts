import { localize, type Overlays, type UiLocale } from '@hangul-route/content-schema';
import type { HiddenHeritageRoundLike } from '@hangul-route/design-system/src/scene-art/hidden-heritage/types';

/**
 * A scene's reference round in the UI language (F-CURR-002 row CM-37; F-I18N-001 §3.6, §3.10): the scene's `scene:<id>`
 * overlay (`content/i18n/{es,ko}/hidden-heritage.json`, fields `round.alt` and `round.targets|others.<thing>.word.gloss`)
 * replaces the alt text and the meaning that names each spot, as a lesson's `content/i18n/` overlay does for a shipped
 * cell once its English round is parsed. The Korean word and its romanization never change; a meaning the overlay
 * leaves out stays English. Read by the fixture-build e2e screen only, so it rides in that screen's chunk.
 */
export function localizeReferenceRound<R extends HiddenHeritageRoundLike>(sceneId: string, round: R, locale: UiLocale, overlays: Overlays): R {
  return localize({ round }, sceneId, locale, overlays).round;
}
