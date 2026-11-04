import type { Overlays, UiLocale } from '@hangul-route/content-schema';
import type { Messages } from '@hangul-route/i18n';
import type { SceneNote } from '@hangul-route/design-system/src/scene-art/hidden-heritage/types';
import { cardCitationView, type CardCitationView } from './library/card-citation';

/*
 * The card back of a Hidden Heritage step (F-CURR-002 §17 Phase 4, row CM-41 S2; wireframe minigame/hidden-heritage.md,
 * "Facts on the card back"): once every word of a scene is found, its end panel turns the scene over and shows the
 * scene's sourced facts (`note.facts`), each in the UI language with its source line. The es and ko of each claim are the
 * scene's own overlay entries (`content/i18n/<locale>/hidden-heritage.json`, entity `scene:<key>`, field
 * `note.facts.<factId>.claim`), which ride in the locale chunks; a claim with no entry shows its English. The source line
 * is the card back's citation (`cardCitationView`): the first source's institution and title, and how many more, never a
 * URL or a quote. Pure, and read only by the game's chunk (`hidden-heritage-chunk.tsx`), so the start bundle carries none.
 */

type CitationMessages = Messages['learner']['cardDetail']['citation'];

export interface SceneFactView {
  id: string;
  /** The claim in the UI language. */
  claim: string;
  citation: CardCitationView | null;
}

export function sceneCardBack(
  scene: { id: string; note: Pick<SceneNote, 'facts'> },
  locale: UiLocale,
  overlays: Overlays,
  m: CitationMessages,
): SceneFactView[] {
  const entry = locale === 'en' ? undefined : overlays[locale]?.[scene.id];
  return scene.note.facts.map((fact) => {
    const given = entry?.[`note.facts.${fact.id}.claim`];
    const [first, ...rest] = fact.sources;
    return {
      id: fact.id,
      claim: typeof given === 'string' && given.trim() !== '' ? given : fact.claimEn,
      citation: first === undefined ? null : cardCitationView({ citation: { publisher: first.institution, title: first.title, more: rest.length } }, m),
    };
  });
}
