import { describe, expect, it } from 'vitest';
import { drawScene } from '../draw';
import { FOUR_SEASONS_OVERLAYS, FOUR_SEASONS_SCENE } from '../hidden-heritage/four-seasons';
import { HIDDEN_HERITAGE_LIMITS, checkHiddenHeritageRound, checkHiddenHeritageScene, sceneRegistry } from '../hidden-heritage/profile';
import type { HiddenHeritageScene } from '../hidden-heritage/types';
import { SCENE_ART_REGISTRY } from '../registry';
import { resolveScene } from '../resolve';
import { cappedPalette, serializedBytes } from '../rules';

/**
 * The Nature & Animals Hidden Heritage scene, the four seasons (F-CURR-002 §5.5 S2, §7.1 F7 and OD-10, row CM-37 part 3),
 * on the `hidden-heritage` profile of the scene style guide (design/wireframes/minigame/hidden-heritage.md).
 */

const scene = FOUR_SEASONS_SCENE;
const clone = (): HiddenHeritageScene => JSON.parse(JSON.stringify(scene)) as HiddenHeritageScene;
const rules = (findings: Array<{ rule: string }>): string[] => [...new Set(findings.map((f) => f.rule))].sort();

describe('the four-season scene (row CM-37 part 3)', () => {
  it('passes every rule of the hidden-heritage profile', () => {
    expect(checkHiddenHeritageScene(scene)).toEqual([]);
  });

  it('is 25,000 B or less as its chunk carries it, its meanings included (§10 ceilings table), and the budget rule still bites', () => {
    expect(serializedBytes(scene) + serializedBytes(FOUR_SEASONS_OVERLAYS)).toBeLessThanOrEqual(HIDDEN_HERITAGE_LIMITS.chunkBytes);
    const fat = clone();
    fat.note = { ...fat.note, accuracyNote: 'x'.repeat(HIDDEN_HERITAGE_LIMITS.chunkBytes) };
    expect(rules(checkHiddenHeritageScene(fat))).toEqual(['H-budget']);
  });

  it('draws in eight theme colours with its own items over the shared registry, which it leaves unchanged', () => {
    const drawn = drawScene(scene.art, sceneRegistry(scene));
    expect(drawn.issues).toEqual([]);
    expect(drawn.items.length).toBeGreaterThan(40);
    for (const item of scene.items) expect(SCENE_ART_REGISTRY[item.id], item.id).toBeUndefined();
    const palette = cappedPalette(resolveScene(scene.art, sceneRegistry(scene)));
    expect(palette).toHaveLength(8);
    for (const token of palette) expect(token).toMatch(/^(surface|text|border\.strong|theme)\b/);
  });

  it('asks four Stage 2 Nature words, one in each season, each with its own bundled picture', () => {
    const { round } = scene;
    expect(round.targets.map((t) => [t.word.ko, t.word.romanization, t.word.en, t.picture])).toEqual([
      ['바람', 'baram', 'wind', 'word:science-wind'],
      ['비', 'bi', 'rain', 'word:nature-rain'],
      ['까치', 'kkachi', 'magpie', 'card:magpie'],
      ['눈', 'nun', 'snow', 'word:nature-snow'],
    ]);
    // Spring, summer, autumn and winter are the four panels, 100 units wide each.
    expect(round.targets.map((t) => Math.floor((t.spot.x + t.spot.w / 2) / 100))).toEqual([0, 1, 2, 3]);
    expect(round.others.map((t) => t.word.ko)).toEqual(['산', '꽃', '나무', '반달가슴곰']);
    expect(Object.keys(scene.things).sort()).toEqual([...round.targets, ...round.others].map((t) => t.id).sort());
  });

  it('hit areas: every spot at least 75 units (54 dp at 320 px), 11 apart, inside the canvas, over its drawn thing', () => {
    const things = [...scene.round.targets, ...scene.round.others];
    for (const t of things) expect(Math.min(t.spot.w, t.spot.h), t.id).toBeGreaterThanOrEqual(HIDDEN_HERITAGE_LIMITS.spotMin);
    // The smallest spot side on the 288 dp scene of a 320 px screen.
    const smallest = Math.min(...things.map((t) => Math.min(t.spot.w, t.spot.h)));
    expect(Math.floor((smallest * 288) / 400)).toBeGreaterThanOrEqual(54);
    const moved = clone();
    moved.round.others[0]!.spot = { ...moved.round.others[0]!.spot, x: 290 };
    expect(rules(checkHiddenHeritageRound(moved, moved.round))).toEqual(expect.arrayContaining(['H-2', 'H-3']));
  });

  it('carries no writing in the picture, no tiger, person or Hoya, and an alt text that names the setting only', () => {
    expect(JSON.stringify(scene.items)).not.toMatch(/[가-힣]/);
    expect(scene.art.layers.map((l) => l.ref).join(' ')).not.toMatch(/hoya|tiger|fig-|person/);
    for (const t of [...scene.round.targets, ...scene.round.others]) expect(scene.art.altEn.toLowerCase()).not.toContain(t.word.en);
    expect(scene.round.altEn).toBe(scene.art.altEn);
  });

  it('draws a calm bear: mouth closed and no claws, sitting in autumn', () => {
    const bear = scene.items.find((i) => i.id === 'prop:hh-moon-bear')!;
    expect(bear.accuracyNote).toMatch(/mouth closed/);
    expect(JSON.stringify(bear.nodes)).not.toMatch(/feedback|brand\.primary/);
    // Round shapes only: no pointed polygon (claws, teeth) anywhere, and one path, the white half-moon on the chest.
    expect(bear.nodes.filter((n) => n.t === 'poly')).toEqual([]);
    const paths = bear.nodes.filter((n) => n.t === 'path');
    expect(paths).toHaveLength(1);
    expect(paths[0]).toMatchObject({ fill: 'surface.paper' });
    // The muzzle is closed: under the nose (cy 30) nothing but the muzzle ellipse sits in the face (y 24 to 44).
    const face = bear.nodes.filter((n) => n.t === 'ellipse' && n.cy > 24 && n.cy < 44);
    expect(face.map((n) => (n.t === 'ellipse' ? [n.cx, n.cy] : null))).toEqual([
      [42, 33],
      [42, 30],
    ]);
    expect(Math.floor(scene.round.others.find((t) => t.id === 'bandalgaseumgom')!.spot.x / 100)).toBe(2);
  });

  it('the falling snow is the only snow: the mountain over the 눈 spot wears no white cap', () => {
    const mountain = scene.items.find((i) => i.id === 'prop:hh-winter-mountain')!;
    expect(JSON.stringify(mountain.nodes)).not.toContain('surface.paper');
    expect(`${mountain.alt} ${mountain.accuracyNote}`).not.toMatch(/\b(white|snowy|snowcap)\b/i);
    const snowColumn = Math.floor(scene.round.targets.find((t) => t.id === 'nun')!.spot.x / 100);
    expect(Math.floor(scene.round.others.find((t) => t.id === 'san')!.spot.x / 100)).toBe(snowColumn);
  });

  it('records the MAR review in at least 3 passes, a reviser and a third pass after it, with no native-speaker or expert claim and no age wording', () => {
    expect(scene.review).toMatchObject({ reviewedBy: 'MAR' });
    expect(scene.review.passes).toBeGreaterThanOrEqual(3);
    expect(scene.review.notes).toHaveLength(scene.review.passes);
    const reviser = scene.review.notes.findIndex((n) => n.startsWith('Pass 4 (reviser)'));
    expect(reviser).toBeGreaterThanOrEqual(0);
    expect(scene.review.notes.slice(reviser + 1).some((n) => /\(third pass\)/.test(n))).toBe(true);
    const text = JSON.stringify({ review: scene.review, note: scene.note, overlays: FOUR_SEASONS_OVERLAYS, items: scene.items.map((i) => i.alt) });
    expect(text).not.toMatch(/native speaker|native-speaker|expert/i);
    expect(text).not.toMatch(/\b(kids?|children|child|ages? \d)\b|어린이/i);
  });

  it('a target is never named by another thing: no other meaning holds a target meaning or a target word', () => {
    const ko = FOUR_SEASONS_OVERLAYS.ko as Record<string, string>;
    for (const other of scene.round.others) {
      for (const target of scene.round.targets) {
        expect(other.word.en.toLowerCase(), other.id).not.toContain(target.word.en.toLowerCase());
        expect(ko[`hiddenHeritage.rounds.hh1.others.${other.id}.word.gloss`], other.id).not.toContain(target.word.ko);
      }
    }
  });

  it('gives the alt text and every meaning in es and ko, under the overlay paths a lesson round uses', () => {
    const { round } = scene;
    const paths = [
      'hiddenHeritage.rounds.hh1.alt',
      ...round.targets.map((t) => `hiddenHeritage.rounds.hh1.targets.${t.id}.word.gloss`),
      ...round.others.map((t) => `hiddenHeritage.rounds.hh1.others.${t.id}.word.gloss`),
    ];
    for (const locale of ['es', 'ko'] as const) {
      const table = FOUR_SEASONS_OVERLAYS[locale] as Record<string, string>;
      expect(Object.keys(table).sort(), locale).toEqual([...paths].sort());
      for (const [path, value] of Object.entries(table)) {
        expect(value.trim().length, `${locale} ${path}`).toBeGreaterThan(0);
        expect(value, `${locale} ${path}`).not.toMatch(/%|\p{Extended_Pictographic}/u);
        if (locale === 'es') expect(value, path).not.toMatch(/[가-힣]/);
        if (locale === 'ko') expect(value, path).toMatch(/[가-힣]/);
      }
    }
    // A thing's ko meaning never just repeats its word (a circular gloss), and the alt never names a target.
    const ko = FOUR_SEASONS_OVERLAYS.ko as Record<string, string>;
    const es = FOUR_SEASONS_OVERLAYS.es as Record<string, string>;
    for (const t of [...round.targets, ...round.others]) {
      const kind = round.targets.some((x) => x.id === t.id) ? 'targets' : 'others';
      expect(ko[`hiddenHeritage.rounds.hh1.${kind}.${t.id}.word.gloss`], t.id).not.toContain(t.word.ko);
    }
    for (const t of round.targets) {
      expect(es['hiddenHeritage.rounds.hh1.alt']!.toLowerCase()).not.toContain(es[`hiddenHeritage.rounds.hh1.targets.${t.id}.word.gloss`]!);
      expect(ko['hiddenHeritage.rounds.hh1.alt']).not.toContain(t.word.ko);
    }
  });

  it('draws no tiger: the magpie and the tiger of folk painting are a card-back fact about old pictures only (§5.1)', () => {
    expect(JSON.stringify(scene.items)).not.toMatch(/tiger|horang/i);
    const minhwa = scene.note.facts.find((f) => /Kkachihorangi/.test(f.claimEn))!;
    expect(minhwa.claimEn).toMatch(/pictures of a magpie and a tiger/);
    expect(minhwa.claimEn).not.toMatch(/\b(fierce|attack\w*|bite\w*|danger\w*|eat\w*|kill\w*)\b/i);
    expect(minhwa.sources[0]!.quote).toContain('원나라 및 명나라 호랑이 그림에서 시작되었다');
  });

  it('cites the four Nature institutions with a URL, an access date and the quoted words for every fact', () => {
    const institutions = new Set(scene.note.facts.flatMap((f) => f.sources.map((s) => s.institution)));
    expect([...institutions].sort()).toEqual([
      'Korea Meteorological Administration',
      'Korea National Park Service',
      'National Folk Museum of Korea',
      'National Institute of Biological Resources',
    ]);
    for (const fact of scene.note.facts) {
      expect(fact.sources.length, fact.id).toBeGreaterThan(0);
      expect(fact.claimEn).not.toMatch(/[가-힣%]/);
      for (const s of fact.sources) {
        expect(s.url).toMatch(/^https:\/\/(www\.weather\.go\.kr|species\.nibr\.go\.kr|www\.knps\.or\.kr|folkency\.nfm\.go\.kr)\//);
        expect(s.accessed).toBe('2026-10-23');
        expect(s.quote.length).toBeGreaterThan(20);
      }
    }
  });
});

describe('the profile on broken copies of the four-season scene', () => {
  it('a thing with no spot, and every target moved into one half', () => {
    const named = clone();
    named.round.targets = named.round.targets.filter((t) => t.id !== 'nun');
    expect(rules(checkHiddenHeritageRound(named, named.round))).toEqual(['H-named']);
    const focal = clone();
    focal.round.targets = focal.round.targets.map((t) => (t.spot.x >= 200 ? { ...t, spot: { ...t.spot, x: t.spot.x - 200 } } : t));
    expect(rules(checkHiddenHeritageRound(focal, focal.round))).toContain('H-focal');
  });
});
