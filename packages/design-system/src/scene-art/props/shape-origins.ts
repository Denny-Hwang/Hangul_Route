/**
 * Match Shape's origin pictures (F-CURR-002 section 7.1 F4, row CM-33; design/screens/minigame-variety/README.md D6 and
 * "Drawn parts"; design/wireframes/minigame/match-shape.md, Round shape). Where the five basic consonants and the vowel
 * bases come from, each an original, simple drawing in token colours, never a copy of a printed diagram: a head from
 * the side, facing left, with the part that makes the letter's shape drawn heavier in `text.primary`, so it reads as
 * the letter (ㄱ ㄴ ㅁ ㅅ ㅇ); flat ground for ㅡ; a person standing for ㅣ; and the person with the round dot of the
 * sky on the right for ㅏ (ㆍ is shown only here, as a shape). At most 5 shapes and 5 colours each (D6); no
 * `brand.primary`, no `feedback.danger`. Every picture names the source of the fact it shows (`sourceRef`, National
 * Institute of Korean Language). People are faceless, as every scene-art figure.
 *
 * Kept out of the story registry and the package barrel: the Match Shape chunk reaches them by their file path, so
 * the start bundle carries none of them.
 */
import type { ItemDef, Shape } from '../types';

const BOX = { w: 200, h: 160 };
const CONSONANTS = { title: 'Principles of Han-geul (consonant letters)', publisher: 'National Institute of Korean Language', url: 'https://www.korean.go.kr/eng_hangeul/principle/002.html', accessed: '2026-10-23' };
const VOWELS = { title: 'Principles of Han-geul (vowel letters)', publisher: 'National Institute of Korean Language', url: 'https://www.korean.go.kr/eng_hangeul/principle/003.html', accessed: '2026-10-23' };

/** The head from the side, facing left (its outline), and its eye. */
const HEAD: Shape = {
  t: 'path',
  d: 'M154 152 C 176 120 180 64 148 34 C 118 6 60 8 34 38 C 24 50 22 62 24 72 L 12 88 L 24 92 L 22 100 L 28 104 C 22 114 28 126 40 128 C 52 130 62 136 70 152 Z',
  fill: 'hoya.belly',
  stroke: 'border.shape',
  sw: 'thick',
};
const EYE: Shape = { t: 'circle', cx: 60, cy: 54, r: 5, fill: 'text.primary' };
/** The inside of the mouth, behind the lips. */
const MOUTH: Shape = { t: 'path', d: 'M92 86 H34 Q28 86 28 92 V110 Q28 118 36 118 H84 Q92 118 92 110 Z', fill: 'surface.sunken', stroke: 'border.shape', sw: 'base' };
/** The ground and the standing person of the vowel pictures. */
const GROUND: Shape = { t: 'rect', x: 16, y: 136, w: 168, h: 16, r: 4, fill: 'surface.sunken', stroke: 'border.shape', sw: 'thin' };
const HEAD_OF_PERSON: Shape = { t: 'circle', cx: 88, cy: 30, r: 14, fill: 'hoya.belly', stroke: 'border.shape', sw: 'base' };
const BODY: Shape = { t: 'rect', x: 83, y: 50, w: 10, h: 84, r: 5, fill: 'text.primary' };

const origin = (letter: string, alt: string, accuracyNote: string, nodes: Shape[], sourceRef = CONSONANTS): ItemDef => ({
  id: `prop:shape-origin-${letter}`,
  kind: 'symbol',
  box: BOX,
  z: 'mid',
  alt,
  accuracyNote,
  sourceRef,
  nodes,
});

export const SHAPE_ORIGIN_PROPS: readonly ItemDef[] = [
  origin(
    'giyeok',
    'A head from the side. The back of the tongue touches the soft roof of the mouth.',
    'A plain side view facing left: the tongue is one heavy bend, flat under the soft roof at the back and then down, which reads as ㄱ. Not an anatomy diagram.',
    [HEAD, MOUTH, { t: 'poly', pts: [[52, 88], [92, 88], [92, 118], [84, 118], [84, 96], [52, 96]], fill: 'text.primary' }, EYE],
  ),
  origin(
    'nieun',
    'A head from the side. The tongue touches the upper gum.',
    'A plain side view facing left: the tip of the tongue rises to the gum behind the front teeth; the tongue is one heavy bend that reads as ㄴ. Not an anatomy diagram.',
    [HEAD, MOUTH, { t: 'rect', x: 30, y: 86, w: 7, h: 8, fill: 'surface.paper', stroke: 'border.shape', sw: 'base' }, { t: 'poly', pts: [[41, 88], [48, 88], [48, 106], [84, 106], [84, 113], [41, 113]], fill: 'text.primary' }, EYE],
  ),
  origin(
    'mieum',
    'A head from the side. The lips close: the shape of the mouth.',
    'A plain side view facing left: the closed mouth is drawn as a heavy square at the lips, which reads as ㅁ. Not an anatomy diagram.',
    [HEAD, { t: 'rect', x: 26, y: 90, w: 32, h: 30, r: 2, fill: 'text.primary' }, { t: 'rect', x: 34, y: 98, w: 16, h: 14, fill: 'surface.sunken' }, EYE],
  ),
  origin(
    'siot',
    'A head from the side. The shape of a tooth.',
    'A plain side view facing left: one front tooth is drawn as a heavy point, which reads as ㅅ. Not an anatomy diagram.',
    [HEAD, MOUTH, { t: 'poly', pts: [[46, 88], [53, 88], [68, 116], [60, 116], [49, 96], [38, 116], [30, 116]], fill: 'text.primary' }, EYE],
  ),
  origin(
    'ieung',
    'A head from the side. The shape of the throat.',
    'A plain side view facing left: the throat is drawn as a heavy ring in the neck, which reads as ㅇ. Not an anatomy diagram.',
    [HEAD, { t: 'circle', cx: 96, cy: 128, r: 15, fill: 'text.primary' }, { t: 'circle', cx: 96, cy: 128, r: 8, fill: 'surface.sunken' }, EYE],
  ),
  origin(
    'eu',
    'Flat ground, like the earth.',
    'Plain flat ground under an empty sky; its flat top is drawn as one heavy line, which reads as ㅡ.',
    [GROUND, { t: 'rect', x: 16, y: 126, w: 168, h: 10, r: 5, fill: 'text.primary' }],
    VOWELS,
  ),
  origin(
    'i',
    'A person standing upright.',
    'A faceless person standing on the ground; the upright body is drawn as one heavy line, which reads as ㅣ.',
    [GROUND, HEAD_OF_PERSON, BODY],
    VOWELS,
  ),
  origin(
    'a',
    'A person standing upright, with a round dot for the sky on the right.',
    'The standing person of the ㅣ picture with one round dot on the right side, as the old dot letter stood for the sky; together they read as ㅏ.',
    [GROUND, HEAD_OF_PERSON, BODY, { t: 'circle', cx: 116, cy: 92, r: 8, fill: 'text.primary' }],
    VOWELS,
  ),
];
