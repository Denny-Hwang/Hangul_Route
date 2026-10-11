import { OVERLAYS, isOverlayFieldAllowed, overlayPrefix, overlayTargets, type Overlays } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { minigameScopes } from '../../logic/minigame-config';
import { episodesAll } from '../episodes';
import { heritageCardsAll } from '../heritage-cards';
import { jamoAll } from '../jamo';
import { questsAll } from '../quests';
import { stages, themes } from '../stages';

/**
 * F-I18N-001 §3.6 interim: content that is still TypeScript in `src/content` (and the
 * minigame scopes) has no JSON for `scripts/validate-content.mjs` to check overlay ids
 * against, so this test does it. For every entry of the generated `OVERLAYS` whose id
 * prefix is TypeScript-resident: the entity exists in the shipped modules, every field
 * is on the allow-list, and every field lands on an English source the screens read (or
 * is a jamo hint an overlay may add). Ids of JSON content (vocab, pitem, story) are
 * the validator's business.
 */

const SHIPPED: Record<string, ReadonlyMap<string, object>> = {
  jamo: new Map(jamoAll.map((j) => [j.id, j])),
  card: new Map(heritageCardsAll.map((c) => [c.id, c])),
  episode: new Map(episodesAll.map((e) => [e.id, e])),
  quest: new Map(questsAll.map((q) => [q.id, q])),
  minigame: new Map(Object.entries(minigameScopes)),
  stage: new Map(stages.map((s) => [`stage:${s.key}`, s])),
  theme: new Map(themes.map((t) => [`theme:${t.key}`, t])),
};

function overlayProblems(overlays: Overlays): string[] {
  const problems: string[] = [];
  for (const [locale, entries] of Object.entries(overlays)) {
    for (const [id, fields] of Object.entries(entries)) {
      const shipped = SHIPPED[overlayPrefix(id)];
      if (shipped === undefined) continue;
      const entity = shipped.get(id);
      if (entity === undefined) {
        problems.push(`${locale} ${id}: not in the shipped content modules`);
        continue;
      }
      for (const field of Object.keys(fields)) {
        if (!isOverlayFieldAllowed(id, field)) problems.push(`${locale} ${id}.${field}: not on the allow-list`);
        else if (overlayTargets(entity, field).length === 0) problems.push(`${locale} ${id}.${field}: lands on no English source`);
      }
    }
  }
  return problems;
}

describe('content overlays for TypeScript-resident content (F-I18N-001 §3.6)', () => {
  it('every overlay id of the generated OVERLAYS exists in the shipped modules, with allowed, resolvable fields', () => {
    expect(overlayProblems(OVERLAYS)).toEqual([]);
  });

  it('the shipped modules are keyed the way overlays address them', () => {
    expect(SHIPPED.jamo!.has('jamo:giyeok')).toBe(true);
    expect(SHIPPED.card!.has('card:book')).toBe(true);
    expect(SHIPPED.stage!.has('stage:stage1')).toBe(true);
    expect(SHIPPED.theme!.has('theme:letters')).toBe(true);
    expect(SHIPPED.minigame!.has('minigame:s1-life-card-1')).toBe(true);
    expect(SHIPPED.episode!.size).toBeGreaterThan(0);
    expect(SHIPPED.quest!.size).toBeGreaterThan(0);
  });

  it('reports an unknown id, a field off the allow-list and a field that lands nowhere', () => {
    const quest = questsAll[0]!;
    const bad: Overlays = {
      es: {
        'card:not-shipped': { title: 'x' },
        'card:book': { title: 'Libro', romanization: 'x' },
        [quest.id]: { 'steps.no-such-step.title': 'x', title: 'ok' },
        'minigame:s1-life-card-1': { 'cardPairs.gimchi.gloss': 'Kimchi', 'cardPairs.nothing.gloss': 'x' },
        'jamo:giyeok': { soundHint: 'como la g de gato' },
        'vocab:not-checked-here': { gloss: 'x' },
      },
      ko: { 'theme:nope': { title: '없음' } },
    };
    expect(overlayProblems(bad)).toEqual([
      'es card:not-shipped: not in the shipped content modules',
      'es card:book.romanization: not on the allow-list',
      `es ${quest.id}.steps.no-such-step.title: lands on no English source`,
      'es minigame:s1-life-card-1.cardPairs.nothing.gloss: lands on no English source',
      'ko theme:nope: not in the shipped content modules',
    ]);
  });
});
