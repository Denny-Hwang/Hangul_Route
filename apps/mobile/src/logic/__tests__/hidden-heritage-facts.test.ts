import { OVERLAYS } from '@hangul-route/content-schema/overlays';
import { PLAY_COURTYARD_SCENE } from '@hangul-route/design-system/src/scene-art/hidden-heritage/play-courtyard';
import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { sceneFactsView } from '../hidden-heritage-facts';

/**
 * The facts of a Hidden Heritage scene on the step's card back (F-CURR-002 OD-10, §17 Phase 4; row CM-42 S2): every fact
 * of the scene's note, in the UI language from the scene's `scene:` overlay, with its first source as the card back
 * prints it.
 */

const SCENE = PLAY_COURTYARD_SCENE;
const citation = (locale: 'en' | 'es' | 'ko') => getMessages(locale).learner.cardDetail.citation;

describe('sceneFactsView', () => {
  it('lists every fact in note order, in English with its first source and how many more it has', () => {
    const view = sceneFactsView(SCENE.note, SCENE.id, 'en', OVERLAYS, citation('en'));
    expect(view.map((f) => f.id)).toEqual(SCENE.note.facts.map((f) => f.id));
    expect(view.map((f) => f.text)).toEqual(SCENE.note.facts.map((f) => f.claimEn));
    expect(view[0]!.citation?.line).toBe('Source: Korea Heritage Service, 국가무형유산 윷놀이 (National Intangible Heritage Yunnori)');
    expect(view[0]!.citation?.more).toBe('and 1 more source');
    expect(view[1]!.citation?.more).toBeNull();
  });

  it.each(['es', 'ko'] as const)('%s: each fact is the scene overlay claim, and the source line follows the UI language', (locale) => {
    const view = sceneFactsView(SCENE.note, SCENE.id, locale, OVERLAYS, citation(locale));
    for (const fact of view) expect(fact.text, fact.id).toBe(OVERLAYS[locale][SCENE.id]![`note.facts.${fact.id}.claim`]);
    expect(view[0]!.citation?.line).toBe(citation(locale).source('Korea Heritage Service', SCENE.note.facts[0]!.sources[0]!.title));
  });

  it('keeps a fact in English when its overlay is missing, and draws no source line for a fact with none', () => {
    const note = { facts: [{ id: 'f1', claimEn: 'A fact.', sources: [] }] };
    const view = sceneFactsView(note, 'scene:none', 'ko', { es: {}, ko: {} }, citation('ko'));
    expect(view).toEqual([{ id: 'f1', text: 'A fact.', citation: null }]);
  });

  it('never prints a web address in the source line', () => {
    const note = {
      facts: [{ id: 'f1', claimEn: 'A fact.', sources: [{ institution: 'National Folk Museum of Korea https://nfm.go.kr', title: 'Title', url: 'https://nfm.go.kr', accessed: '2026-10-30', quote: 'q' }] }],
    };
    expect(sceneFactsView(note, 'scene:none', 'en', OVERLAYS, citation('en'))[0]!.citation?.line).not.toMatch(/https?:/);
  });
});
