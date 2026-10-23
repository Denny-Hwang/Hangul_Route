import { describe, expect, it } from 'vitest';
import { PLAY_COURTYARD_OVERLAYS, PLAY_COURTYARD_SCENE } from '../hidden-heritage/play-courtyard';
import { HIDDEN_HERITAGE_LIMITS, checkHiddenHeritageRound, checkHiddenHeritageScene, sceneRegistry } from '../hidden-heritage/profile';
import type { HiddenHeritageScene } from '../hidden-heritage/types';
import { drawScene } from '../draw';
import { SCENE_ART_REGISTRY } from '../registry';
import { serializedBytes } from '../rules';

/**
 * The Play & Crafts Hidden Heritage scene (F-CURR-002 §5.6 S2 and §7.1 F7, row CM-37 part 4): a courtyard set out for
 * the traditional games, checked by the hidden-heritage profile of the scene style guide
 * (design/wireframes/minigame/hidden-heritage.md) and by the row's content rules (§5.1, §6.6, 7.7).
 */

const SCENE = PLAY_COURTYARD_SCENE;
const clone = (): HiddenHeritageScene => JSON.parse(JSON.stringify(SCENE)) as HiddenHeritageScene;
const rules = (findings: Array<{ rule: string }>): string[] => [...new Set(findings.map((f) => f.rule))].sort();
const things = [...SCENE.round.targets, ...SCENE.round.others];

describe('the Play courtyard scene (row CM-37 part 4)', () => {
  it('passes every rule of the hidden-heritage profile', () => {
    expect(checkHiddenHeritageScene(SCENE)).toEqual([]);
  });

  it('is 25,000 B or less as its chunk carries it, its meanings included (§10 ceilings table)', () => {
    const bytes = serializedBytes(SCENE) + serializedBytes(PLAY_COURTYARD_OVERLAYS);
    expect(bytes).toBeLessThanOrEqual(HIDDEN_HERITAGE_LIMITS.chunkBytes);
    const fat = clone();
    fat.note = { ...fat.note, accuracyNote: 'x'.repeat(25_000) };
    expect(rules(checkHiddenHeritageScene(fat))).toEqual(['H-budget']);
  });

  it('draws with its own items over the shared registry, which it leaves unchanged', () => {
    const drawn = drawScene(SCENE.art, sceneRegistry(SCENE));
    expect(drawn.issues).toEqual([]);
    expect(drawn.items.length).toBeGreaterThan(40);
    for (const item of SCENE.items) expect(SCENE_ART_REGISTRY[item.id], item.id).toBeUndefined();
  });

  it('asks the four Stage 2 Play words of quest:stage2-crafts-q2 with their card pictures, among four other game things', () => {
    const { round } = SCENE;
    expect(round.targets.map((t) => [t.word.ko, t.word.romanization, t.picture])).toEqual([
      ['연', 'yeon', 'card:kite'],
      ['팽이', 'paengi', 'card:top'],
      ['윷', 'yut', 'card:yutnori'],
      ['제기', 'jegi', 'card:jegi'],
    ]);
    expect(round.others.map((t) => [t.word.ko, t.word.romanization])).toEqual([
      ['얼레', 'eolle'],
      ['딱지', 'ttakji'],
      ['공기', 'gonggi'],
      ['윷판', 'yutpan'],
    ]);
    expect(Object.keys(SCENE.things).sort()).toEqual(things.map((t) => t.id).sort());
  });

  it('a target is never named by another thing: no other meaning holds a target meaning or a target word', () => {
    for (const other of SCENE.round.others) {
      for (const target of SCENE.round.targets) {
        expect(other.word.en.toLowerCase(), other.id).not.toContain(target.word.en.toLowerCase());
        expect(PLAY_COURTYARD_OVERLAYS.ko[`hiddenHeritage.rounds.hh1.others.${other.id}.word.gloss` as keyof typeof PLAY_COURTYARD_OVERLAYS.ko]).not.toContain(target.word.ko);
      }
    }
  });

  it('carries no text in the picture and an alt text that names the setting only', () => {
    expect(JSON.stringify(SCENE.items)).not.toMatch(/[가-힣]/);
    for (const thing of things) expect(SCENE.art.altEn.toLowerCase()).not.toContain(thing.word.en.toLowerCase());
    expect(SCENE.round.altEn).toBe(SCENE.art.altEn);
  });

  it('gives the alt text and every meaning in es and ko, under the overlay paths a lesson round uses', () => {
    const paths = ['hiddenHeritage.rounds.hh1.alt', ...SCENE.round.targets.map((t) => `hiddenHeritage.rounds.hh1.targets.${t.id}.word.gloss`), ...SCENE.round.others.map((t) => `hiddenHeritage.rounds.hh1.others.${t.id}.word.gloss`)];
    for (const locale of ['es', 'ko'] as const) {
      const table = PLAY_COURTYARD_OVERLAYS[locale] as Record<string, string>;
      expect(Object.keys(table).sort(), locale).toEqual([...paths].sort());
      for (const [path, text] of Object.entries(table)) {
        expect(text.trim().length, `${locale} ${path}`).toBeGreaterThan(0);
        if (locale === 'es') expect(text, path).not.toMatch(/[가-힣]/);
        if (locale === 'ko') expect(text, path).toMatch(/[가-힣]/);
      }
    }
    // A thing's ko meaning never just repeats its word (a circular gloss).
    for (const thing of things) {
      const kind = SCENE.round.targets.some((t) => t.id === thing.id) ? 'targets' : 'others';
      expect((PLAY_COURTYARD_OVERLAYS.ko as Record<string, string>)[`hiddenHeritage.rounds.hh1.${kind}.${thing.id}.word.gloss`]).not.toContain(thing.word.ko);
    }
  });

  it('cites an allowlisted institution with its URL, access date and quoted words for every fact; no UNESCO or origin claim', () => {
    const hosts: Record<string, RegExp> = {
      'Korea Heritage Service': /^https:\/\/www\.heritage\.go\.kr\//,
      'National Folk Museum of Korea': /^https:\/\/folkency\.nfm\.go\.kr\/kr\/topic\/detail\/\d+$/,
    };
    expect(SCENE.note.facts.length).toBeGreaterThanOrEqual(2);
    for (const fact of SCENE.note.facts) {
      expect(fact.sources.length, fact.id).toBeGreaterThan(0);
      expect(fact.claimEn).not.toMatch(/UNESCO|origin|invented|began in Korea|[가-힣]/i);
      for (const s of fact.sources) {
        expect(Object.keys(hosts)).toContain(s.institution);
        expect(s.url).toMatch(hosts[s.institution]!);
        expect(s.accessed).toBe('2026-10-23');
        expect(s.quote).toMatch(/[가-힣]/);
        expect(s.quote.length).toBeGreaterThan(10);
      }
    }
  });

  it('agrees with the shipped card:yut back: four sticks, two sides, how they land moves the pieces', () => {
    const yut = SCENE.note.facts.find((f) => f.id === 'f1')!;
    expect(yut.claimEn).toMatch(/four yut sticks/);
    expect(yut.claimEn).toMatch(/Two sides throw them, and how the sticks land/);
    expect(yut.sources[0]!.quote).toContain('윷가락 4개를 던져');
  });

  it('is reviewed by MAR in 3 passes, with no native-speaker or expert claim and no age wording', () => {
    expect(SCENE.review).toMatchObject({ reviewedBy: 'MAR', passes: 3 });
    const text = JSON.stringify({ review: SCENE.review, note: SCENE.note, overlays: PLAY_COURTYARD_OVERLAYS, items: SCENE.items.map((i) => i.alt) });
    expect(text).not.toMatch(/native speaker|native-speaker|expert/i);
    expect(text).not.toMatch(/\b(kids?|children|child|ages? \d)\b|어린이/i);
  });
});

describe('the profile on broken copies of the Play courtyard', () => {
  it('two spots too close, a spot under 75 units, a thing with no spot, every target in one half', () => {
    const s = clone();
    s.round.others[3]!.spot = { x: 294, y: 216, w: 86, h: 78 };
    expect(rules(checkHiddenHeritageRound(s, s.round))).toContain('H-2');
    const t = clone();
    t.round.targets[0]!.spot = { x: 22, y: 4, w: 74, h: 94 };
    expect(rules(checkHiddenHeritageRound(t, t.round))).toEqual(expect.arrayContaining(['H-1']));
    const u = clone();
    u.round.targets = u.round.targets.filter((x) => x.id !== 'jegi');
    expect(rules(checkHiddenHeritageRound(u, u.round))).toEqual(['H-named']);
    const v = clone();
    v.round.targets = v.round.targets.map((x) => (x.id === 'jegi' || x.id === 'yut' ? { ...x, spot: { ...x.spot, x: x.spot.x - 200 } } : x));
    expect(rules(checkHiddenHeritageRound(v, v.round))).toContain('H-focal');
  });

  it('a target painted the colour of the mat it lies on', () => {
    const s = clone();
    const yut = s.items.find((i) => i.id === 'prop:hh-yut-sticks')!;
    yut.nodes = yut.nodes.map((n) => (n.t === 'group' ? { ...n, kids: n.kids.map((k) => ({ ...k, fill: 'theme.life' as const })) } : n));
    expect(rules(checkHiddenHeritageRound(s, s.round))).toContain('H-camouflage');
  });
});
