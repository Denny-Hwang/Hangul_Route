/**
 * Seasons-and-tales props (F-STORY-002 §3.9.4, PR 2.10d): the holiday, folk
 * game and folk-tale items of the seasons-tales cluster (Seollal, Chuseok and
 * Ganggangsullae, Dano and ssireum, gimjang and Arirang, pansori, The Sun and
 * the Moon). People are faceless (§3.9.5); animals smile or are calm. Shapes of
 * one paint are merged into one path to keep each item near 1 KB.
 */
import type { ItemDef, Shape } from '../types';

const ACCESSED = '2026-10-11';
const ENCYKOREA = '한국학중앙연구원 한국민족문화대백과사전 (encykorea.aks.ac.kr)';
const ency = (title: string, id: string): NonNullable<ItemDef['sourceRef']> => ({ title, publisher: ENCYKOREA, url: `https://encykorea.aks.ac.kr/Article/${id}`, accessed: ACCESSED });

const YUT_REF = ency('윷놀이', 'E0042794');
const MASK_REF = ency('강릉 관노탈놀이', 'E0001076');
const JEOGORI_REF = ency('저고리', 'E0049084');

/** Round to the 0.5 grid the item grammar requires. */
const g = (v: number): number => Math.round(v * 2) / 2;

/** The blank face: no eyes, no mouth. */
const face = (cx: number, cy: number, rx: number, ry: number): Shape => ({ t: 'ellipse', cx, cy, rx, ry, fill: 'surface.paper', stroke: 'border.strong', sw: 'base' });

/** Round-capped pips: a half-unit stroke at each point, drawn with a thick stroke. */
const pips = (pts: ReadonlyArray<readonly [number, number]>): string => pts.map(([x, y]) => `M${g(x)} ${g(y)}H${g(x) + 0.5}`).join('');

/** A closed rectangle path rotated by `deg` about its centre, on the 0.5 grid. */
const bar = (cx: number, cy: number, w: number, h: number, deg: number): string => {
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a);
  const sn = Math.sin(a);
  const pt = (x: number, y: number): string => `${g(cx + x * c - y * sn)} ${g(cy + x * sn + y * c)}`;
  return `M${pt(-w / 2, -h / 2)}L${pt(w / 2, -h / 2)}L${pt(w / 2, h / 2)}L${pt(-w / 2, h / 2)}Z`;
};

/** A closed dot path (a circle of radius r at each point), for merged rows of small round things. */
const dots = (pts: ReadonlyArray<readonly [number, number]>, r: number): string => pts.map(([x, y]) => `M${g(x - r)} ${g(y)}A${r} ${r} 0 1 0 ${g(x + r)} ${g(y)}A${r} ${r} 0 1 0 ${g(x - r)} ${g(y)}Z`).join(' ');

// --- people ------------------------------------------------------------------

export const FIG_WOMAN: ItemDef = {
  id: 'prop:fig-woman',
  kind: 'figure',
  box: { w: 60, h: 124 },
  z: 'mid',
  tintable: 'brand.primaryLight',
  alt: 'Woman in hanbok: short yellow jacket with a ribbon tie, full long skirt',
  sourceRef: JEOGORI_REF,
  accuracyNote: "The late Joseon women's jeogori (short, thin goreum tie) over a full chima, per the entry. Colours generic, skirt tintable. Face blank.",
  nodes: [
    { t: 'circle', cx: 39, cy: 19, r: 5, fill: 'text.primary' },
    { t: 'path', d: 'M19 42L41 42Q50 70 55 120L5 120Q10 70 19 42Z', fill: 'brand.primaryLight', stroke: 'text.primary', sw: 'thin' },
    { t: 'path', d: 'M20 27L40 27L48 33L54 56L47 58L42 44L18 44L13 58L6 56L12 33Z', fill: 'feedback.nudge', stroke: 'text.primary', sw: 'thin' },
    face(30, 16, 9, 10),
    { t: 'path', d: 'M21 15Q21 4 30 4Q39 4 39 15Q30 9 21 15Z', fill: 'text.primary' },
    { t: 'path', d: 'M25 27L30 33L35 27', stroke: 'surface.paper', sw: 'base', det: true },
    { t: 'path', d: 'M31 34L27 46M31 34L35 44M18 120V123H26M34 120V123H42', stroke: 'text.primary', sw: 'base' },
  ],
};

/** One sleeve band of a saekdong sleeve, between two cuts across the arm. */
function sleeveBands(sx: number): string[] {
  const top: Array<[number, number]> = [[23, 25], [19, 28], [14.5, 30.5], [10, 33], [6, 36]];
  const bot: Array<[number, number]> = [[23, 34], [19.5, 36], [16, 38.5], [12.5, 41], [9, 43]];
  const x = (v: number): number => (sx < 0 ? 64 - v : v);
  return [0, 1, 2, 3].map((i) => `M${x(top[i]![0])} ${top[i]![1]}L${x(top[i + 1]![0])} ${top[i + 1]![1]}L${x(bot[i + 1]![0])} ${bot[i + 1]![1]}L${x(bot[i]![0])} ${bot[i]![1]}Z`);
}
const [lb0, lb1, lb2, lb3] = sleeveBands(1);
const [rb0, rb1, rb2, rb3] = sleeveBands(-1);

export const FIG_GIRL: ItemDef = {
  id: 'prop:fig-girl',
  kind: 'figure',
  box: { w: 64, h: 88 },
  z: 'mid',
  alt: 'Girl in hanbok with rainbow-striped saekdong sleeves, arms held out',
  sourceRef: ency('색동옷', 'E0027478'),
  accuracyNote: 'Saekdong: sleeves pieced from strips of colour, worn mostly by small children. Red, yellow, white and black of the five named colours are drawn. Face blank.',
  nodes: [
    { t: 'path', d: 'M38 14Q46 26 42 46L38 46Q41 28 34 16Z', fill: 'text.primary' },
    { t: 'path', d: `M20 44 L44 44 L52 84 L12 84 Z ${lb1} ${rb1}`, fill: 'brand.primary', stroke: 'text.primary', sw: 'thin' },
    { t: 'path', d: `M23 24 L41 24 L44 45 L20 45 Z ${lb0} ${rb0}`, fill: 'feedback.nudge', stroke: 'text.primary', sw: 'thin' },
    { t: 'path', d: `${lb2} ${rb2}`, fill: 'surface.paper', stroke: 'text.primary', sw: 'thin' },
    { t: 'path', d: `${lb3} ${rb3}`, fill: 'text.primary' },
    face(32, 14, 9, 10),
    { t: 'path', d: 'M23 13Q23 2 32 2Q41 2 41 13Q32 7 23 13Z', fill: 'text.primary' },
    { t: 'path', d: 'M32 30L28 40M32 30L36 38', stroke: 'text.primary', sw: 'base', det: true },
    { t: 'path', d: 'M20 84H29V87H20ZM35 84H44V87H35Z', fill: 'surface.paper', stroke: 'border.strong', sw: 'thin' },
  ],
};

export const FIG_BOWING: ItemDef = {
  id: 'prop:fig-bowing',
  kind: 'figure',
  box: { w: 70, h: 50 },
  z: 'mid',
  tintable: 'brand.secondaryLight',
  alt: 'Person in hanbok kneeling low in a deep bow, seen from the side',
  sourceRef: ency('세배', 'E0029802'),
  accuracyNote: 'The entry says the young bow to elders but not how, so this is a general floor bow. Clothes tintable, face blank.',
  nodes: [
    { t: 'path', d: 'M66 48L66 36Q62 18 42 20Q26 22 22 36L24 48Z', fill: 'brand.secondaryLight', stroke: 'text.secondary', sw: 'thin' },
    { t: 'path', d: 'M38 26Q24 30 12 46L22 48Q30 38 42 34Z', fill: 'brand.secondaryLight', stroke: 'text.secondary', sw: 'thin' },
    face(14, 36, 8, 9),
    { t: 'path', d: 'M8 31Q14 25 21 29Q24 36 21 44Q19 35 8 31Z', fill: 'text.primary' },
    { t: 'path', d: 'M6 48H20', stroke: 'text.secondary', sw: 'thick' },
  ],
};

export const FIG_ELDER_SEATED: ItemDef = {
  id: 'prop:fig-elder-seated',
  kind: 'figure',
  box: { w: 80, h: 76 },
  z: 'mid',
  tintable: 'surface.sunken',
  alt: 'Grey-haired elder in hanbok seated on a floor cushion',
  sourceRef: JEOGORI_REF,
  accuracyNote: 'A grandparent in plain hanbok on a floor cushion, grey hair in a knot; gender not shown. Clothes tintable. Face blank.',
  nodes: [
    { t: 'rect', x: 4, y: 64, w: 72, h: 11, r: 4, fill: 'feedback.nudge' },
    { t: 'path', d: 'M8 68Q10 44 28 40L52 40Q70 44 72 68ZM28 25L52 25L58 42L22 42Z', fill: 'surface.sunken', stroke: 'text.secondary', sw: 'thin' },
    { t: 'path', d: 'M22 46Q40 56 58 46', stroke: 'text.secondary', sw: 'base' },
    face(40, 15, 9, 10),
    { t: 'path', d: 'M31 14Q31 4 40 4Q49 4 49 14Q40 9 31 14ZM36.5 3.5A3.5 3.5 0 1 0 43.5 3.5A3.5 3.5 0 1 0 36.5 3.5Z', fill: 'border.strong' },
    { t: 'path', d: 'M35 25L40 31L45 25', stroke: 'text.secondary', sw: 'thin', det: true },
  ],
};

export const FIG_PANSORI: ItemDef = {
  id: 'prop:fig-pansori',
  kind: 'figure',
  box: { w: 70, h: 124 },
  z: 'mid',
  alt: 'Pansori singer in a white hanbok, standing with an open folding fan',
  sourceRef: { title: '판소리 (한국의 인류무형문화유산)', publisher: '국가유산청 국가유산포털 (heritage.go.kr)', url: 'https://www.heritage.go.kr/heri/html/HtmlPage.do?pg=%2Funesco%2FCulHeritage%2FCulHeritage_02.jsp&pageNo=1_3_2_0', accessed: ACCESSED },
  accuracyNote: 'The heritage page: the singer needs only a fan. Costume not described: plain white hanbok. Face blank.',
  nodes: [
    { t: 'circle', cx: 30, cy: 19, r: 5, fill: 'text.primary' },
    { t: 'path', d: 'M15 42L35 42Q44 70 48 120L2 120Q6 70 15 42ZM16 27L34 27L40 33L56 18L62 24L40 46L14 46L9 58L2 56L8 33Z', fill: 'surface.paper', stroke: 'border.strong', sw: 'base' },
    face(25, 16, 9, 10),
    { t: 'path', d: 'M16 15Q16 4 25 4Q34 4 34 15Q25 9 16 15Z', fill: 'text.primary' },
    { t: 'path', d: 'M59 22L46 6Q58 0 70 10Z', fill: 'feedback.nudgeLight', stroke: 'text.secondary', sw: 'thin' },
    { t: 'path', d: 'M59 22L51 4M59 22L58 3M59 22L65 6M26 34L23 46M26 34L30 44', stroke: 'text.secondary', sw: 'thin' },
  ],
};

export const FIG_YANGBAN_MASK: ItemDef = {
  id: 'prop:fig-yangban-mask',
  kind: 'figure',
  box: { w: 70, h: 124 },
  z: 'mid',
  alt: 'Mask-play nobleman in a blue Joseon-style robe and black hat, a long beard on his white mask',
  sourceRef: MASK_REF,
  accuracyNote: "The Gwanno play's yangban per the entry: a hat, a blue dopo and a long hemp beard. The long pipe is left out; the mask is plain white.",
  nodes: [
    { t: 'path', d: 'M22 42L46 42Q54 80 58 120L10 120Q14 80 22 42ZM22 28L46 28L54 34L66 12L70 20L54 52L16 52L8 64L2 60L14 34Z', fill: 'brand.secondary', stroke: 'text.primary', sw: 'thin' },
    face(34, 17, 10, 11),
    { t: 'path', d: 'M27 26Q34 52 41 26M31 27Q34 46 37 27', stroke: 'border.strong', sw: 'thick' },
    { t: 'path', d: 'M24 9L44 9L42 0L26 0ZM20 9H48V12H20Z', fill: 'text.primary' },
    { t: 'path', d: 'M30 120V123H24M38 120V123H44', stroke: 'text.primary', sw: 'base' },
  ],
};


/** The Ganggangsullae ring: eight dancers on an ellipse, the back half smaller. */
const RING = (() => {
  const back: string[] = [];
  const front: string[] = [];
  const heads: string[] = [];
  const hair: string[] = [];
  for (const a of [202.5, 247.5, 292.5, 337.5, 22.5, 67.5, 112.5, 157.5]) {
    const r = (a * Math.PI) / 180;
    const x = 100 + 84 * Math.cos(r);
    const y = 61 + 16 * Math.sin(r);
    const k = Math.sin(r) < 0 ? 1.15 : 1.45;
    const skirt = `M${g(x - 5 * k)} ${g(y - 18 * k)}H${g(x + 5 * k)}L${g(x + 10 * k)} ${g(y)}H${g(x - 10 * k)}Z`;
    (Math.sin(r) < 0 ? back : front).push(skirt);
    const hr = k > 1.2 ? 7.5 : 6;
    const hy = g(y - 18 * k - hr);
    heads.push(`M${g(x - hr)} ${hy}A${hr} ${hr} 0 1 0 ${g(x + hr)} ${hy}A${hr} ${hr} 0 1 0 ${g(x - hr)} ${hy}Z`);
    hair.push(`M${g(x - hr)} ${hy}Q${g(x)} ${g(hy - 2.5 * hr)} ${g(x + hr)} ${hy}Z`);
  }
  return { back: back.join(''), front: front.join(''), heads, hair: hair.join('') };
})();

export const DANCE_CIRCLE: ItemDef = {
  id: 'prop:dance-circle',
  kind: 'figure',
  box: { w: 200, h: 80 },
  z: 'mid',
  tintable: 'brand.secondaryLight',
  alt: 'Eight women in hanbok holding hands in a ring, the Ganggangsullae dance',
  sourceRef: ency('강강술래', 'E0000958'),
  accuracyNote: 'The entry: women join hands in a ring under the full moon and turn as they sing; usually 20 to 30, eight drawn. Skirts tintable. Faces blank.',
  nodes: [
    { t: 'path', d: RING.back, fill: 'brand.secondaryLight', stroke: 'text.secondary', sw: 'thin' },
    { t: 'path', d: RING.heads.slice(0, 4).join(''), fill: 'surface.paper', stroke: 'border.strong', sw: 'thin' },
    { t: 'ellipse', cx: 100, cy: 48, rx: 84, ry: 15, fill: 'none', stroke: 'text.secondary', sw: 'base' },
    { t: 'path', d: RING.front, fill: 'brand.secondaryLight', stroke: 'text.secondary', sw: 'thin' },
    { t: 'path', d: RING.heads.slice(4).join(''), fill: 'surface.paper', stroke: 'border.strong', sw: 'thin' },
    { t: 'path', d: RING.hair, fill: 'text.primary' },
  ],
};

export const SWING: ItemDef = {
  id: 'prop:swing',
  kind: 'figure',
  box: { w: 160, h: 190 },
  z: 'mid',
  tintable: 'brand.primary',
  alt: 'Woman in hanbok standing on a rope swing hung from a thick branch',
  sourceRef: ency('그네', 'E0007319'),
  accuracyNote: 'The entry: two ropes from a big branch, a foot board, the rider standing or sitting, mostly women at Dano. Colours generic.',
  nodes: [
    { t: 'path', d: 'M0 4Q70 2 150 12L150 18Q70 10 0 14Z', fill: 'text.secondary' },
    { t: 'path', d: 'M50 10L100 126M84 11L130 122', stroke: 'text.secondary', sw: 'base' },
    { t: 'path', d: 'M98 126L132 122L133 126L99 130Z', fill: 'text.secondary' },
    { t: 'path', d: 'M108 84L124 84L130 124L102 126Q84 118 74 104Q90 100 108 84Z', fill: 'brand.primary', stroke: 'text.primary', sw: 'thin' },
    { t: 'path', d: 'M108 70L124 70L127 86L105 86ZM108 72L96 94L100 96L111 78ZM124 72L127 98L131 97L128 72Z', fill: 'surface.paper', stroke: 'border.strong', sw: 'thin' },
    face(116, 61, 7, 8),
    { t: 'path', d: 'M109 60Q109 52 116 52Q123 52 123 60Q116 56 109 60ZM106 58Q100 66 98 76L101 77Q104 68 110 62Z', fill: 'text.primary' },
  ],
};

// --- objects -----------------------------------------------------------------

export const SOBAN: ItemDef = {
  id: 'prop:soban',
  kind: 'furniture',
  box: { w: 90, h: 46 },
  z: 'mid',
  tintable: 'feedback.nudge',
  alt: 'A small round low table with two bowls of food',
  accuracyNote: 'A generic small floor table (soban); the food in the bowls is tintable (fruit, rice cakes, soup, kimchi).',
  nodes: [
    { t: 'path', d: 'M16 22L12 44H17L21 24ZM74 22L78 44H73L69 24ZM41 26H49V44H41Z', fill: 'text.secondary' },
    { t: 'ellipse', cx: 45, cy: 21, rx: 43, ry: 7, fill: 'text.secondary', stroke: 'text.primary', sw: 'thin' },
    { t: 'path', d: 'M16 6Q22 0 28 2Q34 0 39 6ZM51 6Q57 0 63 2Q69 0 74 6Z', fill: 'feedback.nudge', stroke: 'text.secondary', sw: 'thin' },
    { t: 'path', d: 'M15 6H40Q38 18 27.5 18Q17 18 15 6ZM50 6H75Q73 18 62.5 18Q52 18 50 6Z', fill: 'surface.paper', stroke: 'border.strong', sw: 'base' },
  ],
};


export const YUT_STICKS: ItemDef = {
  id: 'prop:yut-sticks',
  kind: 'object',
  box: { w: 100, h: 70 },
  z: 'mid',
  alt: 'Four yut sticks tumbling in the air, two flat side up and two round side up',
  tags: { heritage: true },
  sourceRef: YUT_REF,
  accuracyNote: 'Four hardwood sticks, round on one side and nearly flat on the other (entry). Plain: round side dark, flat side light.',
  nodes: [
    { t: 'path', d: bar(28, 20, 44, 10, -30) + bar(72, 52, 44, 10, -40), fill: 'feedback.nudgeLight', stroke: 'text.primary', sw: 'thin' },
    { t: 'path', d: bar(70, 16, 44, 10, 20) + bar(30, 50, 44, 10, 15), fill: 'text.secondary', stroke: 'text.primary', sw: 'thin' },
    { t: 'path', d: 'M50 4Q56 0 62 4M8 40Q4 34 8 28M94 34Q98 40 94 46', stroke: 'border.strong', sw: 'thin', det: true },
  ],
};

/** The 29 stations of the yut board: 20 on the round edge, 9 on the cross. */
const BOARD = (() => {
  const cx = 60;
  const cy = 33;
  const rim: Array<[number, number]> = Array.from({ length: 20 }, (_, i) => {
    const a = (i * 18 * Math.PI) / 180;
    return [cx + 48 * Math.cos(a), cy + 26 * Math.sin(a)];
  });
  const cross: Array<[number, number]> = [[cx, cy]];
  for (const deg of [0, 90, 180, 270]) {
    const a = (deg * Math.PI) / 180;
    for (const f of [1 / 3, 2 / 3]) cross.push([cx + 48 * f * Math.cos(a), cy + 26 * f * Math.sin(a)]);
  }
  return { rim, cross };
})();

export const YUT_BOARD: ItemDef = {
  id: 'prop:yut-board',
  kind: 'object',
  box: { w: 120, h: 66 },
  z: 'mid',
  alt: 'A cloth yut board with a ring of dots and a cross of dots',
  tags: { heritage: true },
  sourceRef: YUT_REF,
  accuracyNote: 'The entry: 29 stations, round outside (sky), square inside (earth). Here 20 rim dots and a cross of 9 on cloth.',
  nodes: [
    { t: 'rect', x: 2, y: 2, w: 116, h: 62, r: 6, fill: 'surface.sunken', stroke: 'border.strong', sw: 'base' },
    { t: 'path', d: 'M12 33H108M60 7V59', stroke: 'text.secondary', sw: 'thin' },
    { t: 'ellipse', cx: 60, cy: 33, rx: 48, ry: 26, fill: 'none', stroke: 'text.secondary', sw: 'thin' },
    { t: 'path', d: pips(BOARD.rim), stroke: 'text.primary', sw: 'thick' },
    { t: 'path', d: pips(BOARD.cross), stroke: 'text.primary', sw: 'thick' },
  ],
};

/** Five throws, do to mo: how many sticks land flat side up, and how far a piece moves. */
const THROWS = (() => {
  const flatUp = [1, 2, 3, 4, 0];
  const light: string[] = [];
  const dark: string[] = [];
  const steps: Array<[number, number]> = [];
  flatUp.forEach((n, p) => {
    const px = 4 + p * 74;
    for (let k = 0; k < 4; k++) {
      const x = px + 8 + k * 14;
      (k < n ? light : dark).push(`M${x} 10H${x + 10}V60H${x}Z`);
    }
    const moves = p + 1;
    for (let k = 0; k < moves; k++) steps.push([px + 33 - (moves - 1) * 5 + k * 10, 80]);
  });
  return { light, dark, steps };
})();

export const YUT_THROWS: ItemDef = {
  id: 'prop:yut-throws',
  kind: 'symbol',
  box: { w: 370, h: 96 },
  z: 'mid',
  alt: 'Five panels of four yut sticks, one to four flat sides up and then none, with one to five dots',
  accuracyNote: "The entry's throws: do, gae, geol, yut (one to four face up) and mo (none) move one to five spaces. Light is the flat side.",
  nodes: [
    { t: 'path', d: 'M2 2H72V94H2ZM76 2H146V94H76ZM150 2H220V94H150ZM224 2H294V94H224ZM298 2H368V94H298Z', fill: 'surface.paper', stroke: 'border.strong', sw: 'base' },
    { t: 'path', d: THROWS.light.join(''), fill: 'feedback.nudgeLight', stroke: 'text.primary', sw: 'thin' },
    { t: 'path', d: THROWS.dark.join(''), fill: 'text.secondary', stroke: 'text.primary', sw: 'thin' },
    { t: 'path', d: pips(THROWS.steps), stroke: 'text.primary', sw: 'thick' },
  ],
};

export const SONGPYEON: ItemDef = {
  id: 'prop:songpyeon',
  kind: 'object',
  box: { w: 100, h: 52 },
  z: 'mid',
  alt: 'A round steamer of half-moon rice cakes in white, green and yellow on pine needles',
  tags: { heritage: true },
  sourceRef: ency('송편', 'E0031123'),
  accuracyNote: 'The entry: steamed in a siru on pine needles. A low earthen steamer; the half-moon shape follows the story; white, mugwort green and yellow are generic.',
  nodes: [
    { t: 'path', d: 'M6 24H94L86 50H14Z', fill: 'text.secondary' },
    { t: 'path', d: 'M10 24L18 16M22 24L26 15M78 24L84 15M90 24L86 16M12 30H88', stroke: 'theme.nature', sw: 'base' },
    { t: 'path', d: 'M20 24A10 10 0 0 1 40 24ZM58 24A10 10 0 0 1 78 24Z', fill: 'surface.paper', stroke: 'text.secondary', sw: 'thin' },
    { t: 'path', d: 'M38 24A10 10 0 0 1 58 24ZM44 13A9 9 0 0 1 62 13Z', fill: 'theme.nature', stroke: 'text.secondary', sw: 'thin' },
    { t: 'path', d: 'M30 15A9 9 0 0 1 48 15ZM56 15A9 9 0 0 1 74 15Z', fill: 'feedback.nudgeLight', stroke: 'text.secondary', sw: 'thin' },
  ],
};


export const CABBAGES: ItemDef = {
  id: 'prop:cabbages',
  kind: 'object',
  box: { w: 96, h: 48 },
  z: 'mid',
  tintable: 'feedback.nudgeLight',
  alt: 'A heap of napa cabbages, some cut to show the inner leaves',
  accuracyNote: 'Napa cabbage, the main gimjang vegetable. The inner leaves are tintable: pale when salted, red when seasoned.',
  nodes: [
    { t: 'path', d: 'M4 46Q2 32 12 28Q24 26 28 36Q30 44 26 46ZM70 46Q68 30 80 26Q92 26 94 36Q94 44 90 46Z', fill: 'theme.nature', stroke: 'text.secondary', sw: 'thin' },
    { t: 'path', d: 'M24 46Q18 14 44 6Q70 2 74 26Q76 40 68 46Z', fill: 'feedback.nudgeLight', stroke: 'text.secondary', sw: 'thin' },
    { t: 'path', d: 'M34 22Q46 4 68 12Q56 16 52 24Q44 18 34 22Z', fill: 'theme.nature' },
    { t: 'path', d: 'M36 44Q40 32 50 26M46 44Q50 34 60 28M56 44Q58 36 64 32', stroke: 'text.secondary', sw: 'thin', det: true },
  ],
};

export const KIMCHI_JARS: ItemDef = {
  id: 'prop:kimchi-jars',
  kind: 'object',
  box: { w: 130, h: 80 },
  z: 'mid',
  alt: 'Three round brown earthenware kimchi jars with lids',
  tags: { heritage: true },
  sourceRef: ency('김장', 'E0010314'),
  accuracyNote: 'The entry: gimjang kimchi was kept in earthenware jars (dok). Three plain dark-brown jars; glaze patterns left out.',
  nodes: [
    { t: 'path', d: 'M10 78Q0 56 14 44L36 44Q50 56 40 78ZM90 78Q80 56 94 44L116 44Q130 56 120 78ZM44 78Q28 40 48 22L82 22Q102 40 86 78Z', fill: 'text.secondary', stroke: 'text.primary', sw: 'thin' },
    { t: 'path', d: 'M12 44Q25 34 38 44ZM92 44Q105 34 118 44ZM46 22Q65 8 84 22Z', fill: 'text.primary' },
    { t: 'path', d: 'M50 34Q65 38 80 34M16 54Q25 57 34 54M96 54Q105 57 114 54', stroke: 'surface.sunken', sw: 'base' },
  ],
};

export const LANTERNS: ItemDef = {
  id: 'prop:lanterns',
  kind: 'object',
  box: { w: 400, h: 200 },
  z: 'back',
  alt: 'Two poles with a string of orange and yellow paper lanterns and small blue flags',
  accuracyNote: 'Generic festival lanterns and pennants; they copy none of the Gangneung Danoje ritual objects.',
  nodes: [
    { t: 'path', d: 'M6 200V8M394 200V8', stroke: 'text.secondary', sw: 'thick' },
    { t: 'path', d: 'M6 10Q200 60 394 10', stroke: 'text.secondary', sw: 'thin' },
    { t: 'path', d: 'M50 22L58 34L66 26ZM130 40L138 52L146 42ZM254 42L262 52L270 40ZM334 26L342 34L350 22Z', fill: 'brand.secondaryLight', stroke: 'text.secondary', sw: 'thin' },
    { t: 'path', d: 'M84 32Q74 44 84 56H96Q106 44 96 32ZM184 46Q174 58 184 70H196Q206 58 196 46ZM290 38Q280 50 290 62H302Q312 50 302 38Z', fill: 'theme.letters', stroke: 'text.secondary', sw: 'thin' },
    { t: 'path', d: 'M30 16Q20 28 30 40H42Q52 28 42 16ZM234 46Q224 58 234 70H246Q256 58 246 46ZM362 18Q352 30 362 42H374Q384 30 374 18Z', fill: 'feedback.nudge', stroke: 'text.secondary', sw: 'thin' },
  ],
};

export const SUN_MOON_SCREEN: ItemDef = {
  id: 'prop:sun-moon-screen',
  kind: 'object',
  box: { w: 200, h: 120 },
  z: 'mid',
  alt: 'A four-panel screen with five green peaks, a red sun, a white moon, pines and waves',
  tags: { heritage: true },
  sourceRef: ency('일월오봉도', 'E0047296'),
  accuracyNote: 'Irworobongdo per the entry: five peaks, the largest central, sun right, moon left, pines at the edges, waves below. Waterfalls and rocks left out.',
  nodes: [
    { t: 'rect', x: 2, y: 2, w: 196, h: 116, fill: 'brand.secondaryLight', stroke: 'text.secondary', sw: 'thick' },
    { t: 'path', d: 'M10 92L30 50L50 92ZM150 92L170 50L190 92ZM36 92L62 36L88 92ZM112 92L138 36L164 92ZM70 92L100 18L130 92ZM14 100V40M186 100V40', fill: 'theme.nature', stroke: 'text.secondary', sw: 'base' },
    { t: 'path', d: 'M4 40Q14 30 24 40ZM176 40Q186 30 196 40Z', fill: 'theme.nature' },
    { t: 'circle', cx: 146, cy: 22, r: 9, fill: 'brand.primary' },
    { t: 'circle', cx: 54, cy: 22, r: 9, fill: 'surface.paper', stroke: 'text.secondary', sw: 'thin' },
    { t: 'path', d: 'M4 104Q24 94 44 104Q64 94 84 104Q104 94 124 104Q144 94 164 104Q184 94 196 102', stroke: 'surface.paper', sw: 'base' },
    { t: 'path', d: 'M51 2V118M100 2V118M149 2V118', stroke: 'text.secondary', sw: 'base' },
  ],
};


// --- nature ------------------------------------------------------------------

export const PERSIMMON_TREE: ItemDef = {
  id: 'prop:persimmon-tree',
  kind: 'nature',
  box: { w: 110, h: 150 },
  z: 'mid',
  tintable: 'theme.letters',
  alt: 'A persimmon tree with bare branches and round orange fruit',
  accuracyNote: 'A generic late-autumn persimmon tree, fruit left on bare branches. Fruit colour tintable.',
  nodes: [
    { t: 'path', d: 'M49 150L51 96Q40 80 22 70L25 66Q42 74 52 86L54 60Q46 44 34 36L38 32Q50 40 56 52Q64 40 80 34L82 38Q70 46 60 60L60 92Q72 80 90 74L92 78Q74 86 60 100L59 150Z', fill: 'text.secondary' },
    { t: 'path', d: 'M18 64Q26 58 32 66Q24 70 18 64ZM84 30Q92 26 96 34Q88 36 84 30ZM36 28Q42 22 48 28Q42 32 36 28Z', fill: 'theme.nature' },
    { t: 'path', d: dots([[24, 76], [40, 46], [72, 44], [88, 44], [84, 86]], 6), fill: 'theme.letters', stroke: 'text.secondary', sw: 'thin' },
    { t: 'path', d: dots([[36, 80], [66, 70], [96, 88]], 6), fill: 'theme.letters', stroke: 'text.secondary', sw: 'thin' },
  ],
};

export const RICE_FIELD: ItemDef = {
  id: 'prop:rice-field',
  kind: 'nature',
  box: { w: 400, h: 90 },
  z: 'back',
  tintable: 'feedback.nudge',
  alt: 'Rows of golden ripe rice in a paddy',
  accuracyNote: 'A generic rice paddy. Crop colour tintable: golden at harvest, green when newly planted.',
  nodes: [
    { t: 'path', d: 'M0 14Q100 4 200 10Q300 4 400 14V90H0Z', fill: 'feedback.nudge' },
    { t: 'path', d: 'M0 30Q200 20 400 30M0 50Q200 40 400 50M0 72Q200 62 400 72', stroke: 'text.secondary', sw: 'thin' },
    { t: 'path', d: 'M20 14V6M60 12V4M100 10V2M140 10V2M180 10V2M220 10V2M260 10V2M300 9V1M340 10V2M380 12V4', stroke: 'text.secondary', sw: 'base', det: true },
  ],
};

export const CHANGPO: ItemDef = {
  id: 'prop:changpo',
  kind: 'nature',
  box: { w: 60, h: 90 },
  z: 'mid',
  alt: 'A clump of tall, sword-shaped sweet flag leaves',
  accuracyNote: 'Changpo (sweet flag): long, narrow, sword-like leaves. No flower spikes.',
  nodes: [
    { t: 'path', d: 'M24 90L14 10L28 88ZM30 90L30 0L36 90ZM34 90L48 8L40 90ZM20 90L2 30L26 90ZM40 90L58 34L44 90Z', fill: 'theme.nature', stroke: 'text.primary', sw: 'thin' },
  ],
};

export const OX: ItemDef = {
  id: 'prop:ox',
  kind: 'nature',
  box: { w: 130, h: 86 },
  z: 'mid',
  alt: 'A calm golden-brown ox with short horns and gently closed eyes',
  accuracyNote: "A generic Korean farm ox in native golden-brown; the champion's prize in the story. No harness or nose ring.",
  nodes: [
    { t: 'path', d: 'M36 58H46V84H36ZM54 58H64V84H54ZM96 58H106V84H96ZM110 56H120V84H110Z', fill: 'stage.stage2', stroke: 'text.secondary', sw: 'thin' },
    { t: 'path', d: 'M30 30Q34 16 60 18L102 20Q124 22 122 44L120 62L32 62Q22 50 30 30Z', fill: 'stage.stage2', stroke: 'text.secondary', sw: 'thin' },
    { t: 'path', d: 'M120 30Q130 40 126 58', stroke: 'text.secondary', sw: 'base' },
    { t: 'path', d: 'M6 32Q4 20 18 18L34 24L36 46Q20 54 10 48Z', fill: 'stage.stage2', stroke: 'text.secondary', sw: 'thin' },
    { t: 'path', d: 'M4 40Q4 52 14 52Q22 50 22 42Z', fill: 'feedback.nudgeLight', stroke: 'text.secondary', sw: 'thin' },
    { t: 'path', d: 'M14 18Q8 10 14 4M28 20Q34 12 30 6', stroke: 'surface.paper', sw: 'thick' },
    { t: 'path', d: 'M14 30Q18 33 22 30M34 82H46M54 82H64M96 82H106M110 82H120', stroke: 'text.primary', sw: 'base' },
  ],
};

export const SWALLOW: ItemDef = {
  id: 'prop:swallow',
  kind: 'nature',
  box: { w: 44, h: 26 },
  z: 'mid',
  tags: { sky: true },
  alt: 'A small swallow with dark wings, a white belly and a forked tail',
  accuracyNote: 'A generic swallow: blue-black back, pale belly, brown throat, forked tail.',
  nodes: [
    { t: 'path', d: 'M14 12L2 2L20 8ZM24 12Q30 0 42 2Q34 8 30 14ZM8 16L0 24L6 14Z', fill: 'text.primary' },
    { t: 'path', d: 'M6 14Q14 8 26 10Q34 12 36 16Q26 22 14 20Z', fill: 'text.primary' },
    { t: 'path', d: 'M14 18Q24 22 32 16Q24 16 14 18Z', fill: 'surface.paper' },
    { t: 'circle', cx: 33, cy: 14, r: 2, fill: 'text.secondary' },
  ],
};

export const GOURDS: ItemDef = {
  id: 'prop:gourds',
  kind: 'nature',
  box: { w: 130, h: 66 },
  z: 'mid',
  alt: 'Two big round pale gourds and a third split open with rice and gold coins',
  accuracyNote: 'Bottle gourds for Heungbo-ga; money and rice pour from the split one in the tale. Treasure is plain coins and rice.',
  nodes: [
    { t: 'path', d: 'M6 62Q0 30 26 26Q52 30 46 62ZM88 62Q82 34 106 30Q130 34 124 62Z', fill: 'surface.paper', stroke: 'theme.nature', sw: 'base' },
    { t: 'path', d: 'M50 62Q48 44 66 42Q84 44 82 62Z', fill: 'surface.sunken', stroke: 'theme.nature', sw: 'base' },
    { t: 'path', d: 'M26 26Q24 20 28 16M106 30Q104 24 108 20', stroke: 'text.secondary', sw: 'base' },
    { t: 'path', d: dots([[60, 42], [70, 36], [64, 30], [76, 44], [58, 22]], 4), fill: 'feedback.nudge', stroke: 'text.secondary', sw: 'thin' },
    { t: 'path', d: 'M48 64Q56 54 64 60Q72 54 84 64Z', fill: 'surface.paper', stroke: 'text.secondary', sw: 'thin' },
  ],
};

export const TURTLE: ItemDef = {
  id: 'prop:turtle',
  kind: 'nature',
  box: { w: 78, h: 50 },
  z: 'mid',
  alt: 'A smiling soft-shelled turtle in a small black official hat',
  accuracyNote: 'The jara of Sugung-ga, titled Byeoljubu (jubu, an official post), so he wears an official hat. Smooth flat shell, calm face.',
  nodes: [
    { t: 'path', d: 'M10 48L14 38L22 40L20 48ZM44 48L46 38L54 38L56 48ZM58 30Q64 22 68 18Q74 22 70 30Q66 36 58 36Z', fill: 'feedback.nudgeLight', stroke: 'text.primary', sw: 'thin' },
    { t: 'path', d: 'M4 42Q6 20 32 18Q58 20 60 42Z', fill: 'theme.nature', stroke: 'text.primary', sw: 'base' },
    { t: 'path', d: 'M18 30Q32 24 46 30', stroke: 'text.primary', sw: 'thin', det: true },
    { t: 'path', d: 'M62 18L74 18L72 10L64 10ZM60 18H76', fill: 'text.primary', stroke: 'text.primary', sw: 'thin' },
    { t: 'path', d: 'M66 24Q68 26 70 24M64 30Q67 32 70 29', stroke: 'text.primary', sw: 'thin' },
  ],
};

export const RABBIT: ItemDef = {
  id: 'prop:rabbit',
  kind: 'nature',
  box: { w: 60, h: 56 },
  z: 'mid',
  alt: 'A white rabbit in mid-hop with long upright ears',
  accuracyNote: 'A generic white rabbit for the clever tokki of Sugung-ga. Calm open eye, no teeth.',
  nodes: [
    { t: 'path', d: 'M36 20Q34 0 40 0Q44 2 42 20ZM42 22Q46 2 52 4Q54 8 46 22Z', fill: 'surface.paper', stroke: 'border.strong', sw: 'base' },
    { t: 'path', d: 'M39 18Q38 6 40 4M45 18Q48 8 50 7', stroke: 'feedback.nudgeLight', sw: 'thick' },
    { t: 'path', d: 'M6 36Q8 24 24 24Q34 18 44 20Q56 22 56 32Q54 38 46 38L34 44L48 52L42 54L24 46Q10 46 6 36Z', fill: 'surface.paper', stroke: 'border.strong', sw: 'base' },
    { t: 'path', d: 'M2 34A4 4 0 1 0 10 34A4 4 0 1 0 2 34Z', fill: 'surface.paper', stroke: 'border.strong', sw: 'thin' },
    { t: 'circle', cx: 48, cy: 28, r: 2, fill: 'text.primary' },
    { t: 'path', d: 'M54 34Q52 36 50 34', stroke: 'text.primary', sw: 'thin' },
  ],
};

export const TIGER_TRICKSTER: ItemDef = {
  id: 'prop:tiger-trickster',
  kind: 'nature',
  box: { w: 96, h: 76 },
  z: 'mid',
  tintable: 'theme.letters',
  alt: 'A round, roly-poly orange tiger with a striped tail and a silly closed-eyed grin',
  accuracyNote: 'The folk-tale trickster drawn comic and harmless: closed eyes, small closed smile, no teeth or claws. Orange (tintable), never the yellow of Hoya.',
  nodes: [
    { t: 'path', d: 'M80 58Q96 50 92 30Q90 22 94 16', stroke: 'theme.letters', sw: 'thick' },
    { t: 'path', d: 'M10 74Q2 44 30 36Q56 32 76 44Q90 58 80 74Z', fill: 'theme.letters', stroke: 'text.primary', sw: 'thin' },
    { t: 'path', d: 'M28 74Q30 54 46 52Q60 54 62 74Z', fill: 'surface.paper' },
    { t: 'path', d: 'M10 26Q8 4 30 4Q52 4 50 26Q48 42 30 42Q12 42 10 26ZM12 10L14 2L22 6ZM38 6L46 2L48 10Z', fill: 'theme.letters', stroke: 'text.primary', sw: 'thin' },
    { t: 'path', d: 'M16 20Q20 16 24 20M36 20Q40 16 44 20M26 30Q30 33 34 30M30 4V10M24 5L26 10M36 5L34 10M66 42L62 52M74 50L68 58M50 38L50 46M89 30H96M87 42H94', stroke: 'text.primary', sw: 'base' },
  ],
};

export const SKY_ROPE: ItemDef = {
  id: 'prop:sky-rope',
  kind: 'nature',
  box: { w: 120, h: 260 },
  z: 'mid',
  tags: { sky: true },
  alt: 'A thick golden rope hanging from the sky beside a thin frayed grey rope',
  accuracyNote: "The tale: a new rope comes down for the siblings; the tiger's rotten one snaps. No fall is shown.",
  nodes: [
    { t: 'path', d: 'M40 0Q34 130 44 258', stroke: 'feedback.nudge', sw: 'thick' },
    { t: 'path', d: 'M36 0V256H48V0Z', fill: 'feedback.nudge', stroke: 'text.secondary', sw: 'thin' },
    { t: 'path', d: 'M36 20L48 30M36 50L48 60M36 80L48 90M36 110L48 120M36 140L48 150M36 170L48 180M36 200L48 210M36 230L48 240', stroke: 'text.secondary', sw: 'thin', det: true },
    { t: 'path', d: 'M96 0V96M96 120V150M92 104L96 96L100 104M92 112L96 120L100 112', stroke: 'border.strong', sw: 'base' },
  ],
};

export const SORGHUM: ItemDef = {
  id: 'prop:sorghum',
  kind: 'nature',
  box: { w: 80, h: 170 },
  z: 'mid',
  alt: 'Three tall sorghum stalks with red stems and drooping seed heads',
  accuracyNote: 'Sorghum (susu). The tale explains why the stalks are red, so stems and heads are deep red-brown.',
  nodes: [
    { t: 'path', d: 'M18 170V30H22V170ZM38 170V12H42V170ZM58 170V36H62V170Z', fill: 'brand.primaryDark' },
    { t: 'path', d: 'M20 120Q4 104 2 88Q12 104 20 108ZM40 100Q58 84 62 70Q56 90 40 108ZM60 140Q76 126 78 110Q72 130 60 146ZM40 140Q24 128 20 112Q30 128 40 132Z', fill: 'theme.nature', stroke: 'text.secondary', sw: 'thin' },
    { t: 'path', d: 'M20 32Q8 30 10 10Q20 14 22 30ZM40 14Q30 12 30 0Q40 2 42 12ZM60 38Q72 36 70 16Q60 20 58 36Z', fill: 'brand.primaryDark', stroke: 'text.primary', sw: 'thin' },
  ],
};
