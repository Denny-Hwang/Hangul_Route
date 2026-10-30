import { localize, type Overlays, type UiLocale } from '@hangul-route/content-schema';
import type { Messages } from '@hangul-route/i18n';
import type { SceneNote } from '@hangul-route/design-system/src/scene-art/hidden-heritage/types';
import { cardCitationView, type CardCitationView } from './library/card-citation';

/*
 * The facts of a Hidden Heritage scene on the step's card back (F-CURR-002 OD-10 and §17 Phase 4, the first Volume 2
 * row that places a scene: CM-42 S2). Every fact of the scene's `note.facts` in the UI language, from the scene's own
 * `scene:<id>` overlay (`note.facts.<factId>.claim`, content/i18n/<locale>/hidden-heritage.json), each with its first
 * source in the card back's citation format ("Source: <institution>, <title>" and "and N more sources"), never a URL, a
 * quote or a review record. A fact the overlay leaves out stays English (F-I18N-001 §3.13). Pure; read only by the
 * game's own chunk.
 */

type CitationMessages = Messages['learner']['cardDetail']['citation'];

export interface SceneFactView {
  id: string;
  /** The fact in the UI language. */
  text: string;
  /** Its first source as the card back prints it; null for a fact with no source (the scene lint never ships one). */
  citation: CardCitationView | null;
}

/** Every fact of the scene `sceneId`, in note order, as the card back draws it. */
export function sceneFactsView(
  note: Pick<SceneNote, 'facts'>,
  sceneId: string,
  locale: UiLocale,
  overlays: Overlays,
  m: CitationMessages,
): SceneFactView[] {
  const shown = localize({ note: { facts: note.facts.map((f) => ({ id: f.id, claimEn: f.claimEn })) } }, sceneId, locale, overlays).note.facts;
  return note.facts.map((fact, i) => {
    const first = fact.sources[0];
    return {
      id: fact.id,
      text: shown[i]?.claimEn ?? fact.claimEn,
      citation:
        first === undefined ? null : cardCitationView({ citation: { title: first.title, publisher: first.institution, more: fact.sources.length - 1 } }, m),
    };
  });
}
