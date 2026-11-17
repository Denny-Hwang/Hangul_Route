import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { supportedCardIds } from '../card-ids';

/**
 * The Stage 1 card drawings (`HeritageCardArt.tsx`) after AMENDMENTS-PICTURES-2026-11 row PX-2: the rules R1 to R4
 * of the amendment's section 3, read from the source, what each redrawn or tweaked picture must show, and an art
 * budget per drawing and for the module (the module is in the app's start bundle,
 * `apps/mobile/scripts/pwa/lesson-chunks.mjs`). The pictures themselves are reviewed on the contact sheet
 * `/design-preview/cards` at 200, 64 and 54 px.
 */

const art = readFileSync(join(__dirname, '..', 'HeritageCardArt.tsx'), 'utf8');
/** The source without its comments, so a comment ("no boat") is not read as drawing. */
const code = art.replace(/^\s*(\/\/|\/\*\*|\*).*$/gm, '');
const drawings = [...code.matchAll(/^function (\w+Art)\([\s\S]*?^}$/gm)].map((m) => ({ name: m[1]!, body: m[0] })).filter((d) => d.name !== 'FallbackArt');
const bytesOf = (name: string): number => Buffer.byteLength(new RegExp(`^function ${name}\\([\\s\\S]*?^}$`, 'm').exec(art)?.[0] ?? '');
/** The drawings brought to the rules by PX-2 so far; the row's later commits add the rest. */
const CHECKED: readonly string[] = ['BrushArt', 'ChopsticksArt', 'ChuseokArt', 'FamilyTableArt', 'GayageumArt', 'HangulDayArt', 'HanjiArt', 'InkArt', 'KimchiArt', 'MoonArt', 'MugunghwaArt', 'OrigamiArt', 'SeaArt', 'SebaeArt', 'SeollalArt', 'TteokgukArt', 'YutnoriArt'];

/** What a picture must (`has`) and must not (`not`) draw, from the triage's "what to change" (R3, R4). */
const PINS: Record<string, { has?: RegExp[]; not?: RegExp[] }> = {
  // kimchi is red on a flat plate, not a third bowl; the rice is the tall blue bowl (as the food-rice glyph); the
  // rice cake soup is the wide bowl with a spoon
  KimchiArt: { has: [/colors\.vocab\.red/, /<Ellipse cx=\{100\} cy=\{146\} rx=\{86\}/] },
  RiceArt: { has: [/colors\.brand\.secondary/] },
  TteokgukArt: { has: [/vocab\.gray/, /vocab\.black/] },
  // the moon is a crescent; the full harvest moon is Chuseok, with the songpyeon plate in front
  MoonArt: { has: [/A76 76 0 1 0/], not: [/<Circle/] },
  ChuseokArt: { has: [/<Circle cx=\{100\} cy=\{70\} r=\{54\}/, /vocab\.pink/] },
  // the sea: waves are the subject, no boat
  SeaArt: { has: [/vocab\.skyBlue/, /vocab\.blue/], not: [/[Ss]ail|[Bb]oat|[Mm]ast/] },
  // the New Year bow is the kneeling child; Lunar New Year adds the seated elder
  SebaeArt: { has: [/<Bower /] },
  SeollalArt: { has: [/<Bower /, /vocab\.purple/] },
  // the shield kite: a rectangle with the round centre hole, not a diamond
  KiteArt: { has: [/<Rect x=\{38\} y=\{22\} width=\{124\} height=\{146\}/, /<Circle cx=\{100\} cy=\{102\} r=\{24\}/], not: [/<Polygon/] },
  // a bridge on every string; the four yut sticks; Hangul Day's letters are shapes, never text (R5)
  GayageumArt: { has: [/strings\.map\(\(w, i\)/] },
  YutnoriArt: { has: [/(<Stick [\s\S]*){4}/] },
  HangulDayArt: { not: [/SvgText|<Text/] },
  InkArt: { has: [/vocab\.black/, /<Polygon/] },
  PotteryArt: { has: [/stage\.stage7/, /vocab\.white/] },
  MugunghwaArt: { has: [/vocab\.pink/, /vocab\.red/] },
  ChopsticksArt: { has: [/vocab\.gray/] },
};

describe('Stage 1 card art (HeritageCardArt.tsx, AMENDMENTS-PICTURES-2026-11 PX-2)', () => {
  it('has one drawing per Stage 1 card', () => {
    expect(drawings).toHaveLength(supportedCardIds.length);
  });

  it('uses tokens only: no colour literal, never feedback.danger (R4)', () => {
    expect(art).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
    expect(art).toMatch(/from '\.\.\/\.\.\/tokens'/);
    expect(code).not.toMatch(/feedback\.danger/);
  });

  it('R1: the outline is text.primary at 6 units, detail at 4, and no stroke is drawn thinner than 4', () => {
    expect(code).toMatch(/const INK = \{ stroke: colors\.text\.primary, strokeWidth: 6,/);
    expect(code).toMatch(/const DET = \{ \.\.\.INK, strokeWidth: 4 \}/);
    const checked = drawings.filter((d) => CHECKED.includes(d.name));
    const widths = [...checked.map((d) => d.body).join('').matchAll(/strokeWidth=\{([\d.]+)\}/g)].map((m) => Number(m[1]));
    for (const w of widths) expect(w).toBeGreaterThanOrEqual(4);
    // every drawing outlines its subject in ink, itself or through a shared figure (the bow, the yut stick)
    for (const d of checked) expect(d.body, d.name).toMatch(/\{\.\.\.INK\}|<Bower |<Stick /);
  });

  it('each picture draws what the triage asked for (R3, R4)', () => {
    for (const d of drawings.filter((x) => CHECKED.includes(x.name) && PINS[x.name] !== undefined)) {
      for (const re of PINS[d.name]!.has ?? []) expect(d.body, d.name).toMatch(re);
      for (const re of PINS[d.name]!.not ?? []) expect(d.body, d.name).not.toMatch(re);
    }
  });

  // PX-2 measured: the largest drawing (TigerArt) 1,715 B; the module 39,311 B (57,446 B before PX-2, which
  // repeated the outline props on every shape; the shared `INK`, `DET` and `Card` made it smaller).
  it('art budget: each drawing at most 1,800 B of source', () => {
    for (const name of CHECKED) expect(bytesOf(name), name).toBeLessThanOrEqual(1_800);
  });
});
