import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { albumLegendArtIds, upperCellCardArtIds } from '../upper-card-ids';

/**
 * The upper-stage and legendary card drawings (`UpperCellArt.tsx`) after AMENDMENTS-PICTURES-2026-11 row PX-3: the
 * rules R1 to R4 of the amendment's section 3, read from the source, and what each redrawn or tweaked picture must
 * show (docs/design/picture-review-2026-11/triage.md section 2). The art budgets of this module stay in
 * `card-ids.test.ts`. The pictures themselves are reviewed on the contact sheet `/design-preview/cards` at 200, 64
 * and 54 px.
 */

const art = readFileSync(join(__dirname, '..', 'UpperCellArt.tsx'), 'utf8');
/** The source without its comments, so a comment ("no bubbles") is not read as drawing. */
const code = art.replace(/^\s*(\/\/|\/\*\*|\*).*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const drawings = [...code.matchAll(/^function (\w+Art)\(p: ArtProps\)[\s\S]*?^}$/gm)].map((m) => ({ name: m[1]!, body: m[0] }));
const body = (name: string): string => drawings.find((d) => d.name === name)?.body ?? '';
/** The shared figures, frames and the apple a drawing may reach its ink outline through. */
const SHARED = /<Pal |<Bowing |<Note |<Legend |<Wrestler |apple\(/;

/** What a picture must (`has`) and must not (`not`) draw, from the triage's "what to change" (R2, R3). */
const PINS: Record<string, { has?: RegExp[]; not?: RegExp[] }> = {
  // the four redraws: each its own subject, the text small and not the subject
  // [FU-2] insa drawn larger without the motion arcs
  InsaArt: { has: [/(<Bowing [\s\S]*){2}/, /flip/, /scale\(1\.1\)/], not: [/<Bubble/, /M10 92Q18 68/] },
  IreumArt: { has: [/vocab\.blue/, /'호야'/], not: [/<Page/] },
  AchimArt: { has: [/A44 44 0 0 1/, /vocab\.green/, /vocab\.brown/] },
  SaengilArt: { has: [/vocab\.pink/, /\[66, 100, 134\]\.map/, /vocab\.yellow/] },
  // Stage 4: one subject each, at most one bubble, no two talks the same template
  MwoyeyoArt: { has: [/vocab\.purple/, /(<Bubble[\s\S]*){1}/] },
  MasisseoyoArt: { has: [/hoya\.cheek/, /vocab\.gray/], not: [/<Bubble/] },
  BigaWayoArt: { has: [/vocab\.red/, /drop\(/], not: [/<Bubble/] },
  GachiArt: { has: [/(<Pal [\s\S]*){2}/, /vocab\.white/], not: [/<Bubble/] },
  // Stage 3: the rainbow slice, the moon behind a roof, the half-round sticks with one flat face
  TteokArt: { has: [/vocab\.pink, colors\.vocab\.yellow, colors\.vocab\.green, colors\.vocab\.white/, /<Polygon/] },
  FullMoonArt: { has: [/<Circle cx=\{100\} cy=\{92\} r=\{68\}/, /vocab\.black/], not: [/vocab\.pink|vocab\.red/] },
  YutArt: { has: [/\[54, 92, 130, 168\]/, /i === 1/, /A22 22 0 0 0/, /A22 22 0 0 1/] },
  HangeulArt: { has: [/M38 62H76V94M40 110V142H80M156 62H120V94H156M120 108H156V125H120V142H158/], not: [/SvgText|word\(/] },
  // Stage 6: the coin and the note; apples with stems and leaves, the extra one apart with a plus
  WonArt: { has: [/vocab\.blue/, /M108 118L117 162L128 132L139 162L148 118M104 136H152M106 147H150/] },
  DeomArt: { has: [/(apple\([\s\S]*){2}/, /M112 128H136M124 116V140/] },
  // Stage 7: the whole rabbit, the big paper plane on its flight arc
  TokkiArt: { has: [/<Ellipse cx=\{120\} cy=\{122\} rx=\{46\}/, /vocab\.pink/] },
  BihaenggiArt: { has: [/<Polygon/, /strokeDasharray/] },
  // legendary: the five-hole binding and the title slip; fruit and songpyeon in front of a small moon; the sea of
  // clouds and the summit stone
  HunminjeongeumArt: { has: [/(\[34, 60, 87, 114, 140\][\s\S]*){2}/, /vocab\.red/, /surface\.paper/] },
  HangawiArt: { has: [/<Circle cx=\{152\} cy=\{42\} r=\{26\}/, /vocab\.red/, /vocab\.green/] },
  // [FU-2] two cloud bands, the front peak rising out of the lower one; ssireum is two crouched wrestlers in the hold
  // with white satba belts, each arm gripping the other's thigh band, not two friends leaning in
  JirisanArt: { has: [/vocab\.gray/, /(surface\.paper[\s\S]*){2}/], not: [/vocab\.yellow|feedback\.nudge/] },
  SsireumArt: { has: [/(<Wrestler [\s\S]*){4}/, /flip arm/], not: [/<Pal /] },
};

describe('upper-stage and legendary card art (UpperCellArt.tsx, AMENDMENTS-PICTURES-2026-11 PX-3)', () => {
  it('has one drawing per album and legendary card', () => {
    expect(drawings).toHaveLength(upperCellCardArtIds.length + albumLegendArtIds.length);
  });

  it('uses tokens only: no colour literal, never feedback.danger (R4)', () => {
    expect(art).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
    expect(art).toMatch(/from '\.\.\/\.\.\/tokens'/);
    expect(code).not.toMatch(/feedback\.danger/);
  });

  it('R1: the outline is text.primary at 6 units, detail at 4, and no stroke in the module is drawn thinner than 4', () => {
    expect(code).toMatch(/const INK = \{ stroke: colors\.text\.primary, strokeWidth: 6,/);
    expect(code).toMatch(/const DET = \{ \.\.\.INK, strokeWidth: 4 \}/);
    const widths = [...code.matchAll(/strokeWidth=\{([\d.]+)\}/g)].map((m) => Number(m[1]));
    for (const w of widths) expect(w).toBeGreaterThanOrEqual(4);
    // a scaled friend keeps its outline: its widths are divided by its scale
    expect(code).toMatch(/strokeWidth: 6 \/ s/);
    expect(code).toMatch(/strokeWidth=\{4 \/ s\}/);
    // every drawing outlines its subject in ink, itself or through a shared figure or frame
    const outlined = new RegExp(`\\{\\.\\.\\.INK\\}|${SHARED.source}`);
    for (const d of drawings) expect(d.body, d.name).toMatch(outlined);
  });

  it('each picture draws what the triage asked for (R2, R3)', () => {
    for (const [name, pin] of Object.entries(PINS)) {
      expect(body(name), name).not.toBe('');
      for (const re of pin.has ?? []) expect(body(name), name).toMatch(re);
      for (const re of pin.not ?? []) expect(body(name), name).not.toMatch(re);
    }
  });

  it('Stage 4 drops the shared two-friends-with-bubbles template: at most one bubble in the five talks together', () => {
    const talks = ['MwoyeyoArt', 'MasisseoyoArt', 'InsaArt', 'BigaWayoArt', 'GachiArt'].map(body);
    expect(talks.join('').match(/<Bubble /g)).toHaveLength(1);
    expect(code).not.toMatch(/const pair =/);
  });

  it('Stage 7 drops the shared word-tile template: the sentence sits small on a note strip under the subject', () => {
    expect(code).not.toMatch(/function Page\(/);
    expect(code).toMatch(/function Note\([\s\S]*?Math\.min\(13,/);
    for (const name of ['IreumArt', 'AchimArt', 'SaengilArt', 'TokkiArt', 'BihaenggiArt']) expect(body(name), name).toMatch(/<Note /);
  });

  // The four moons of the whole set (AMENDMENTS-PICTURES-2026-11 section 4): Stage 1 `moon` is the crescent and
  // `chuseok` the full moon with its rabbit behind the songpyeon plate (`stage1-art.test.ts`); here the full moon
  // rises behind a tiled roof and Hangawi is the fruit and songpyeon in front of a small moon.
  it('the two upper moons differ by what stands in front of the moon', () => {
    const roof = /M52 132H148Q156 150 198 146/;
    expect(body('FullMoonArt')).toMatch(roof);
    expect(body('HangawiArt')).not.toMatch(roof);
    expect(body('FullMoonArt')).not.toMatch(/Q\$\{x\} \$\{i < 5 \? 116 : 100\}/);
    expect(body('HangawiArt')).toMatch(/Q\$\{x\} \$\{i < 5 \? 116 : 100\}/);
  });
});
