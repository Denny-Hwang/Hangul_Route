import type { ReactNode, ReactElement } from 'react';
import { Svg, Circle, Ellipse, G, Path, Polygon, Rect, Text as SvgText } from 'react-native-svg';
import { colors } from '../../tokens';
import { albumLegendArtIds, upperCellCardArtIds } from './upper-card-ids';
import type { HeritageCardArtProps } from './types';

/**
 * The upper-cell card art (F-CURR-002 §7.2, row CM-23; F-CARD-S2-001 and F-CARD-S3-001 as amended): one drawing per
 * album card of Stages 2 to 7 and per album legendary card, on the 200 grid of `HeritageCardArt`, with the [PX] rules
 * of docs/specs/AMENDMENTS-PICTURES-2026-11.md section 3 (row PX-3):
 *   - R1 every subject is outlined in `text.primary`, 6 units (`INK`); inner detail 4 units (`DET`); nothing thinner
 *   - R2 one subject fills 60-70 % of the frame, at most two supporting things
 *   - R3 told by shape within the upper set: every Stage 4 talk and every Stage 7 word has its own subject (no shared
 *     template), and the four moons of the whole set differ by what stands in front of the moon
 *   - R4 real colours for real things: the `colors.vocab.*` tones are allowed; never `feedback.danger`
 *   - R5 the Stage 6 and 7 cards and the legendary cards still print their Korean, small and secondary: the picture
 *     carries the meaning, and a test keeps every text card out of the question pictures (`text-cards.test.ts`)
 * A sibling of `HeritageCardArt.tsx`, never exported by the package barrel: the app loads it in its own chunk by this
 * file's path (`@hangul-route/design-system/src/components/HeritageCardArt/UpperCellArt`), so the start bundle carries
 * none of these drawings. The ids are `upperCellCardArtIds` (`upper-card-ids.ts`, pure).
 */

type ThemeKey = keyof typeof colors.theme;

interface ArtProps {
  size: number;
  testID?: string;
  accessibilityLabel: string;
}

/** The subject's outline (R1): `text.primary`, 6 units on the 200 grid. */
const INK = { stroke: colors.text.primary, strokeWidth: 6, strokeLinejoin: 'round', strokeLinecap: 'round' } as const;
/** Inner detail lines (R1): 4 units. */
const DET = { ...INK, strokeWidth: 4 } as const;
const NONE = 'none';

function Card({ theme, p, children }: { theme: ThemeKey; p: ArtProps; children: ReactNode }): ReactElement {
  return (
    <Svg width={p.size} height={p.size} viewBox="0 0 200 200" testID={p.testID} accessibilityLabel={p.accessibilityLabel}>
      <Rect x={0} y={0} width={200} height={200} fill={colors.theme[theme]} opacity={0.08} rx={8} />
      {children}
    </Svg>
  );
}

const shadow = (cy: number, rx: number): ReactElement => <Ellipse cx={100} cy={cy} rx={rx} ry={6} fill={colors.hoya.furDark} opacity={0.18} />;

/** A four-point sparkle. */
const sparkle = (x: number, y: number, r: number): string => `M${x} ${y - r}Q${x} ${y} ${x + r} ${y}Q${x} ${y} ${x} ${y + r}Q${x} ${y} ${x - r} ${y}Q${x} ${y} ${x} ${y - r}Z`;

// ---- Stage 2 ------------------------------------------------------------------------------------------

function NoraeArt(p: ArtProps): ReactElement {
  // Song: two beamed notes rising over two sound waves.
  return (
    <Card theme="letters" p={p}>
      <Path d="M22 160Q52 140 82 160T142 160T182 156M34 182Q64 164 94 182T154 182" stroke={colors.theme.letters} strokeWidth={6} fill={NONE} strokeLinecap="round" />
      <Path d="M70 50L146 30" stroke={colors.text.primary} strokeWidth={16} strokeLinecap="round" />
      <Path d="M70 50V124M146 30V106" {...INK} strokeWidth={8} />
      <Ellipse cx={54} cy={126} rx={21} ry={15} fill={colors.brand.primary} {...INK} transform="rotate(-20 54 126)" />
      <Ellipse cx={130} cy={108} rx={21} ry={15} fill={colors.brand.primary} {...INK} transform="rotate(-20 130 108)" />
      <Path d={sparkle(176, 74, 10) + sparkle(30, 62, 8)} fill={colors.vocab.yellow} {...DET} />
    </Card>
  );
}

function DosirakArt(p: ArtProps): ReactElement {
  // Lunch box: an open box with rice balls, a rolled egg and greens, the lid leaning behind.
  return (
    <Card theme="life" p={p}>
      {shadow(172, 76)}
      <Rect x={40} y={26} width={120} height={48} rx={10} fill={colors.brand.secondaryLight} {...INK} />
      <Rect x={22} y={66} width={156} height={100} rx={12} fill={colors.surface.paper} {...INK} />
      <Path d="M100 72V160" {...DET} />
      <G fill={colors.surface.paper} {...DET}>
        <Circle cx={46} cy={96} r={14} />
        <Circle cx={76} cy={96} r={14} />
        <Circle cx={46} cy={136} r={14} />
        <Circle cx={76} cy={136} r={14} />
      </G>
      <Rect x={110} y={80} width={58} height={34} rx={10} fill={colors.vocab.yellow} {...DET} />
      <Path d="M126 97Q134 88 142 97Q134 106 126 97" {...DET} fill={NONE} />
      <Path d="M110 152Q124 120 138 152Q152 120 168 152Z" fill={colors.vocab.green} {...DET} />
    </Card>
  );
}

function BokjumeoniArt(p: ArtProps): ReactElement {
  // Lucky pouch: a round silk pouch gathered at the top with a tie cord, a gold 'luck' knot on its front.
  return (
    <Card theme="rites" p={p}>
      {shadow(178, 62)}
      <Path d="M100 74Q82 40 62 32M100 74Q118 40 138 32" stroke={colors.feedback.nudge} strokeWidth={8} fill={NONE} strokeLinecap="round" />
      <Path d="M56 76Q26 124 50 160Q100 188 150 160Q174 124 144 76Z" fill={colors.theme.rites} {...INK} />
      <Path d="M58 76Q100 58 142 76L134 92Q100 82 66 92Z" fill={colors.brand.primary} {...INK} />
      <Circle cx={100} cy={128} r={22} fill={colors.feedback.nudgeLight} {...INK} />
      <Path d="M88 128H112M100 116V140" {...DET} />
    </Card>
  );
}

function ByeolArt(p: ArtProps): ReactElement {
  // Star: one big rounded five-point star with a smile and two small twinkles on a dusk sky.
  return (
    <Card theme="nature" p={p}>
      <Rect x={0} y={0} width={200} height={200} rx={8} fill={colors.theme.rites} opacity={0.14} />
      <Path d="M100 22L122 76L178 78L134 112L150 168L100 136L50 168L66 112L22 78L78 76Z" fill={colors.vocab.yellow} {...INK} />
      <Circle cx={86} cy={102} r={5} fill={colors.text.primary} />
      <Circle cx={114} cy={102} r={5} fill={colors.text.primary} />
      <Path d="M88 118Q100 128 112 118" {...DET} fill={NONE} />
      <Path d={sparkle(34, 30, 10) + sparkle(170, 172, 10)} fill={colors.surface.paper} {...DET} />
    </Card>
  );
}

function SwingArt(p: ArtProps): ReactElement {
  // Swing: a seat on two ropes hung from a willow branch, swung forward.
  return (
    <Card theme="crafts" p={p}>
      {shadow(182, 50)}
      <Path d="M16 40Q100 18 184 40" stroke={colors.text.primary} strokeWidth={16} fill={NONE} strokeLinecap="round" />
      <Path d="M16 40Q100 18 184 40" stroke={colors.vocab.brown} strokeWidth={8} fill={NONE} strokeLinecap="round" />
      <Path d="M36 38Q30 72 40 104M164 38Q172 72 160 104M54 34Q50 60 58 82" stroke={colors.vocab.green} strokeWidth={6} fill={NONE} strokeLinecap="round" />
      <Path d="M84 30L114 146M120 30L150 140" {...DET} />
      <Rect x={96} y={136} width={66} height={16} rx={6} fill={colors.brand.primary} {...INK} transform="rotate(-8 128 144)" />
      <Path d="M62 158Q74 168 88 170M56 136Q68 148 84 152" stroke={colors.theme.crafts} strokeWidth={4} fill={NONE} strokeLinecap="round" />
    </Card>
  );
}

// ---- Stage 3 ------------------------------------------------------------------------------------------

function HangeulArt(p: ArtProps): ReactElement {
  // Hangeul: an open book with the first four letters ㄱ ㄴ / ㄷ ㄹ drawn as bold strokes, each a letter of its own
  // (no syllable a learner could misread).
  return (
    <Card theme="letters" p={p}>
      {shadow(176, 80)}
      <Path d="M18 44Q100 30 182 44V162Q100 150 18 162Z" fill={colors.surface.paper} {...INK} />
      <Path d="M100 38V156" {...DET} />
      <Path d="M38 62H76V94M40 110V142H80M156 62H120V94H156M120 108H156V125H120V142H158" stroke={colors.brand.primary} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" fill={NONE} />
    </Card>
  );
}

function TteokArt(p: ArtProps): ReactElement {
  // Rice cake: a cut block of rainbow rice cake (mujigae-tteok) at three-quarter view on a plate, its layers showing
  // on the front and the side.
  const bands = [colors.vocab.pink, colors.vocab.yellow, colors.vocab.green, colors.vocab.white];
  return (
    <Card theme="life" p={p}>
      <Ellipse cx={100} cy={160} rx={88} ry={24} fill={colors.surface.paper} {...INK} />
      {bands.map((c, i) => (
        <G key={c} fill={c}>
          <Rect x={30} y={78 + 18 * i} width={100} height={18} />
          <Polygon points={`130,${78 + 18 * i} 172,${54 + 18 * i} 172,${72 + 18 * i} 130,${96 + 18 * i}`} />
        </G>
      ))}
      <Polygon points="30,78 72,54 172,54 130,78" fill={colors.vocab.pink} />
      <Path d="M30 96H130L172 72M30 114H130L172 90M30 132H130L172 108" {...DET} fill={NONE} />
      <Path d="M30 78L72 54H172V126L130 150H30ZM30 78H130L172 54M130 78V150" {...INK} fill={NONE} />
    </Card>
  );
}

function FullMoonArt(p: ArtProps): ReactElement {
  // Full moon (boreumdal): a big round moon on the night sky, rising behind the dark tiled roof of a hanok.
  return (
    <Card theme="rites" p={p}>
      <Rect x={0} y={0} width={200} height={200} rx={8} fill={colors.brand.secondaryDark} />
      <Circle cx={100} cy={92} r={68} fill={colors.vocab.yellow} {...INK} />
      <G fill={colors.feedback.nudge}>
        <Circle cx={74} cy={70} r={11} />
        <Circle cx={126} cy={96} r={8} />
        <Circle cx={92} cy={118} r={6} />
      </G>
      <Path d={sparkle(26, 28, 9) + sparkle(178, 40, 7)} fill={colors.surface.paper} />
      <Rect x={24} y={160} width={152} height={44} fill={colors.surface.paper} {...INK} />
      <Path d="M50 166V200M100 166V200M150 166V200" stroke={colors.vocab.black} strokeWidth={8} />
      <Path d="M52 132H148Q156 150 198 146Q186 170 100 170Q14 170 2 146Q44 150 52 132Z" fill={colors.vocab.black} {...INK} />
      <Path d="M44 128H156" {...INK} strokeWidth={12} />
      <Path d="M22 158Q100 172 178 158" stroke={colors.vocab.gray} strokeWidth={5} strokeDasharray="2 10" strokeLinecap="round" fill={NONE} />
    </Card>
  );
}

function GomArt(p: ArtProps): ReactElement {
  // Bear: a round black bear, smiling, with the white half-moon mark on its chest.
  return (
    <Card theme="nature" p={p}>
      <Ellipse cx={100} cy={160} rx={62} ry={34} fill={colors.vocab.black} {...INK} />
      <Path d="M68 150Q100 172 132 150Q100 162 68 150Z" fill={colors.surface.paper} stroke={colors.surface.paper} strokeWidth={6} strokeLinejoin="round" />
      <Circle cx={62} cy={40} r={17} fill={colors.vocab.black} {...INK} />
      <Circle cx={138} cy={40} r={17} fill={colors.vocab.black} {...INK} />
      <Circle cx={100} cy={82} r={50} fill={colors.vocab.black} {...INK} />
      <Ellipse cx={100} cy={100} rx={24} ry={17} fill={colors.vocab.brown} />
      <Ellipse cx={100} cy={91} rx={9} ry={6} fill={colors.vocab.black} />
      <Circle cx={80} cy={72} r={6} fill={colors.surface.paper} />
      <Circle cx={120} cy={72} r={6} fill={colors.surface.paper} />
      <Path d="M90 106Q100 114 110 106" stroke={colors.vocab.black} strokeWidth={4} fill={NONE} strokeLinecap="round" />
    </Card>
  );
}

function YutArt(p: ArtProps): ReactElement {
  // Yut sticks: four half-round sticks lying side by side, each showing its half-round end: three with the round
  // back up, one with the flat face up and its X marks.
  return (
    <Card theme="crafts" p={p}>
      {shadow(186, 80)}
      <G transform="rotate(-14 100 110)">
        {[54, 92, 130, 168].map((b, i) =>
          i === 1 ? (
            <G key={b}>
              <Path d={`M136 ${b - 22}A22 22 0 0 0 180 ${b - 22}Z`} fill={colors.feedback.nudgeLight} {...INK} />
              <Rect x={26} y={b - 22} width={132} height={22} rx={8} fill={colors.feedback.nudgeLight} {...INK} />
              <Path d={`M46 ${b - 17}l12 12m0-12l-12 12M84 ${b - 17}l12 12m0-12l-12 12M122 ${b - 17}l12 12m0-12l-12 12`} {...DET} />
            </G>
          ) : (
            <G key={b}>
              <Rect x={26} y={b - 22} width={132} height={22} rx={8} fill={colors.vocab.brown} {...INK} />
              <Path d={`M136 ${b}A22 22 0 0 1 180 ${b}Z`} fill={colors.feedback.nudgeLight} {...INK} />
            </G>
          ),
        )}
      </G>
    </Card>
  );
}

// ---- Stage 4 ------------------------------------------------------------------------------------------
// [PX] Each talk has its own subject (AMENDMENTS-PICTURES-2026-11 PX-3): the round friends in the HoyaBubble language,
// at most one bubble (cream fill, sky-blue border, never a danger colour).

/** A round friend: head centred at (x, y), body below, `s` its scale, `fur` its colour. */
function Pal({ x, y, s = 1, fur }: { x: number; y: number; s?: number; fur: string }): ReactElement {
  // the outline keeps its 6 and 4 units at any scale (R1)
  const ink = { ...INK, strokeWidth: 6 / s };
  return (
    <G transform={`translate(${x} ${y}) scale(${s})`}>
      <Ellipse cx={0} cy={50} rx={28} ry={24} fill={fur} {...ink} />
      <Circle cx={-20} cy={-22} r={10} fill={fur} {...ink} />
      <Circle cx={20} cy={-22} r={10} fill={fur} {...ink} />
      <Circle cx={0} cy={0} r={29} fill={fur} {...ink} />
      <Circle cx={-10} cy={-4} r={4} fill={colors.text.primary} />
      <Circle cx={10} cy={-4} r={4} fill={colors.text.primary} />
      <Path d="M-8 8Q0 16 8 8" {...ink} strokeWidth={4 / s} fill={NONE} />
    </G>
  );
}

/** A speech bubble at `x`, `w` wide, its tail pointing down at `tx`; `children` is the drawn word inside. */
function Bubble({ x, w, tx, children }: { x: number; w: number; tx: number; children?: ReactNode }): ReactElement {
  return (
    <G>
      <Path d={`M${tx - 8} 64L${tx} 84L${tx + 9} 64Z`} fill={colors.surface.canvas} stroke={colors.brand.secondary} strokeWidth={4} strokeLinejoin="round" />
      <Rect x={x} y={16} width={w} height={52} rx={16} fill={colors.surface.canvas} stroke={colors.brand.secondary} strokeWidth={4} />
      {children}
    </G>
  );
}

function MwoyeyoArt(p: ArtProps): ReactElement {
  // What is this?: a friend points at a big wrapped box; one bubble holds a big question mark.
  return (
    <Card theme="letters" p={p}>
      {shadow(186, 84)}
      <Pal x={46} y={118} s={0.85} fur={colors.hoya.fur} />
      <Bubble x={10} w={72} tx={42}>
        <Path d="M34 34Q34 24 46 24Q58 24 58 34Q58 42 46 46V52" stroke={colors.brand.primary} strokeWidth={6} fill={NONE} strokeLinecap="round" />
        <Path d="M46 61h0" stroke={colors.brand.primary} strokeWidth={8} strokeLinecap="round" />
      </Bubble>
      <Rect x={92} y={96} width={96} height={86} rx={6} fill={colors.vocab.purple} {...INK} />
      <Rect x={86} y={80} width={108} height={26} rx={6} fill={colors.vocab.purple} {...INK} />
      <Path d="M140 80V182" stroke={colors.vocab.red} strokeWidth={14} />
      <Path d="M140 80V182M134 80H146" {...DET} fill={NONE} />
      <Path d="M140 78Q112 50 118 74Q122 86 140 78Q158 86 162 74Q168 50 140 78Z" fill={colors.vocab.red} {...DET} />
    </Card>
  );
}

function MasisseoyoArt(p: ArtProps): ReactElement {
  // It is tasty: a friend with pink cheeks behind a big bowl of rice, a spoon in hand, hearts rising.
  return (
    <Card theme="life" p={p}>
      <Pal x={100} y={74} fur={colors.hoya.fur} />
      <G fill={colors.hoya.cheek}>
        <Circle cx={80} cy={82} r={7} />
        <Circle cx={120} cy={82} r={7} />
      </G>
      <Path d="M44 116Q100 92 156 116Z" fill={colors.vocab.white} {...INK} />
      <Path d="M24 116H176Q172 174 100 182Q28 174 24 116Z" fill={colors.vocab.white} {...INK} />
      <Path d="M36 134H164" stroke={colors.vocab.blue} strokeWidth={8} />
      <Path d="M150 72L132 112" stroke={colors.vocab.gray} strokeWidth={10} strokeLinecap="round" />
      <Ellipse cx={154} cy={64} rx={10} ry={14} fill={colors.vocab.white} {...DET} transform="rotate(24 154 64)" />
      <Path d="M30 52L20 42Q16 32 25 32Q30 32 30 37Q30 32 35 32Q44 32 40 42ZM176 38L168 30Q165 22 172 22Q176 22 176 26Q176 22 180 22Q187 22 184 30Z" fill={colors.vocab.red} {...DET} />
    </Card>
  );
}

/** A friend bowing in side view, facing right: legs, a body bent forward at the waist, the head lowered, eyes shut. */
function Bowing({ fur, flip }: { fur: string; flip?: boolean }): ReactElement {
  return (
    <G transform={flip ? 'matrix(-1 0 0 1 200 0)' : undefined}>
      <Rect x={12} y={140} width={30} height={42} rx={12} fill={fur} {...INK} />
      <Ellipse cx={36} cy={128} rx={34} ry={24} fill={fur} {...INK} transform="rotate(-48 36 128)" />
      <Circle cx={72} cy={100} r={10} fill={fur} {...INK} />
      <Circle cx={64} cy={124} r={24} fill={fur} {...INK} />
      <Path d="M62 128Q68 132 74 128" {...DET} fill={NONE} />
      <Ellipse cx={78} cy={142} rx={10} ry={8} fill={fur} {...DET} transform="rotate(40 78 142)" />
      <Ellipse cx={46} cy={150} rx={8} ry={16} fill={fur} {...DET} transform="rotate(-20 46 150)" />
    </G>
  );
}

function InsaArt(p: ArtProps): ReactElement {
  // Greeting: two friends bow to each other, bodies bent at the waist, heads lowered; no bubbles.
  return (
    <Card theme="rites" p={p}>
      {shadow(184, 90)}
      <Bowing fur={colors.hoya.fur} />
      <Bowing fur={colors.hoya.furBlue} flip />
      <Path d="M10 92Q18 68 42 64M190 92Q182 68 158 64" stroke={colors.theme.rites} strokeWidth={5} fill={NONE} strokeLinecap="round" />
    </Card>
  );
}

/** A raindrop with its tip at (x, y). */
const drop = (x: number, y: number): string => `M${x} ${y}Q${x + 9} ${y + 13} ${x} ${y + 18}Q${x - 9} ${y + 13} ${x} ${y}Z`;

function BigaWayoArt(p: ArtProps): ReactElement {
  // It is raining: a grey cloud with big drops over a friend under a red umbrella, a puddle at the feet.
  return (
    <Card theme="nature" p={p}>
      <Path d="M30 54Q16 34 38 26Q46 6 72 14Q90 0 112 12Q138 2 150 22Q178 20 174 44Q178 60 156 60H44Q28 62 30 54Z" fill={colors.brand.secondaryLight} {...INK} />
      <Path d={drop(24, 74) + drop(178, 70) + drop(26, 120) + drop(176, 118)} fill={colors.vocab.blue} {...DET} />
      <Ellipse cx={100} cy={190} rx={60} ry={8} fill={colors.vocab.blue} opacity={0.4} />
      <Pal x={80} y={134} s={0.8} fur={colors.hoya.fur} />
      <Path d="M100 76V160Q100 172 88 170" stroke={colors.text.primary} strokeWidth={7} fill={NONE} strokeLinecap="round" />
      <Path d="M36 104Q40 66 100 62Q160 66 164 104Q153 94 142 104Q131 94 121 104Q110 94 100 104Q90 94 79 104Q69 94 58 104Q47 94 36 104Z" fill={colors.vocab.red} {...INK} />
      <Path d="M100 64Q86 80 79 104M100 64Q114 80 121 104" {...DET} fill={NONE} />
    </Card>
  );
}

function GachiArt(p: ArtProps): ReactElement {
  // Shall we do it together?: two friends hold one big ball between them, a paw on each side.
  return (
    <Card theme="crafts" p={p}>
      {shadow(186, 84)}
      <Pal x={38} y={92} s={0.9} fur={colors.hoya.fur} />
      <Pal x={162} y={92} s={0.9} fur={colors.hoya.furBlue} />
      <Circle cx={100} cy={126} r={40} fill={colors.vocab.white} {...INK} />
      <Path d="M100 86Q76 126 100 166Q84 126 100 86ZM62 114Q100 130 138 114Q100 120 62 114Z" fill={colors.vocab.red} {...DET} />
      <Circle cx={64} cy={130} r={12} fill={colors.hoya.fur} {...INK} />
      <Circle cx={136} cy={130} r={12} fill={colors.hoya.furBlue} {...INK} />
    </Card>
  );
}

// ---- Stages 6-7 ----------------------------------------------------------------------------------------
// F-CARD-S6-001 and F-CARD-S7-001 as amended (row CM-23 part 3; [PX] row PX-3): a Stage 6 card is a thing read in the
// world (a price, a call, a ticket, a sign), drawn so the thing names itself, with its Korean small on it; a Stage 7
// card is its word's own subject, with the cell's sentence written small on a note strip below.

/** Korean (or a sign) drawn in a picture, centred on `x`. */
const word = (x: number, y: number, text: string, size = 14, fill: string = colors.text.primary): ReactElement => (
  <SvgText x={x} y={y} fontSize={size} fontWeight="700" fill={fill} textAnchor="middle">
    {text}
  </SvgText>
);

function WonArt(p: ArtProps): ReactElement {
  // Won: a big gold coin with the ₩ sign over a blue banknote, a small price card above.
  return (
    <Card theme="letters" p={p}>
      <Rect x={12} y={12} width={112} height={40} rx={8} fill={colors.surface.paper} {...DET} />
      {word(68, 38, '김밥 이천 원', 14)}
      <G transform="rotate(-10 92 106)">
        <Rect x={18} y={68} width={150} height={76} rx={6} fill={colors.vocab.blue} {...INK} />
        <Rect x={30} y={80} width={126} height={52} rx={4} fill={NONE} stroke={colors.brand.secondaryLight} strokeWidth={4} />
        <Circle cx={60} cy={106} r={16} fill={colors.brand.secondaryLight} {...DET} />
      </G>
      <Circle cx={128} cy={140} r={48} fill={colors.feedback.nudge} {...INK} />
      <Circle cx={128} cy={140} r={36} fill={NONE} stroke={colors.hoya.furDark} strokeWidth={4} />
      <Path d="M108 118L117 162L128 132L139 162L148 118M104 136H152M106 147H150" stroke={colors.text.primary} strokeWidth={7} fill={NONE} strokeLinecap="round" strokeLinejoin="round" />
    </Card>
  );
}

function YeogiyoArt(p: ArtProps): ReactElement {
  // Over here!: a friend at a table raises a paw and calls the server.
  return (
    <Card theme="life" p={p}>
      <Path d="M80 140L106 96" stroke={colors.text.primary} strokeWidth={20} strokeLinecap="round" />
      <Path d="M80 140L106 96" stroke={colors.hoya.fur} strokeWidth={10} strokeLinecap="round" />
      <Circle cx={108} cy={92} r={10} fill={colors.hoya.fur} {...INK} />
      <Pal x={60} y={118} fur={colors.hoya.fur} />
      <Rect x={14} y={164} width={172} height={20} rx={6} fill={colors.vocab.brown} {...INK} />
      <Path d="M118 164H170Q168 138 144 138Q120 138 118 164Z" fill={colors.surface.paper} {...INK} />
      <Bubble x={96} w={94} tx={112}>{word(143, 50, '여기요!', 18)}</Bubble>
    </Card>
  );
}

function GichapyoArt(p: ArtProps): ReactElement {
  // Train ticket: a ticket with a train on it, its stations and its time, a notch at each side.
  return (
    <Card theme="rites" p={p}>
      {shadow(166, 80)}
      <Path d="M14 42H186V84A14 14 0 0 0 186 112V156H14V112A14 14 0 0 0 14 84Z" fill={colors.surface.paper} {...INK} />
      <Path d="M14 42H186V68H14Z" fill={colors.theme.rites} {...DET} />
      {word(100, 61, '기차표', 15, colors.surface.paper)}
      <Rect x={30} y={86} width={46} height={54} rx={10} fill={colors.vocab.blue} {...DET} />
      <Rect x={38} y={94} width={30} height={18} rx={4} fill={colors.surface.paper} />
      <Path d="M40 124h2M64 124h2M36 148l8-8M70 148l-8-8" {...DET} />
      {word(128, 108, '서울 → 부산', 14)}
      {word(128, 134, '두 시', 14)}
    </Card>
  );
}

function JeongsangArt(p: ArtProps): ReactElement {
  // Summit: a trail sign before a green mountain, its board pointing up to the top.
  return (
    <Card theme="nature" p={p}>
      <Path d="M0 176L80 40L126 100L150 74L200 150V192Q200 200 192 200H8Q0 200 0 192Z" fill={colors.vocab.green} {...INK} />
      <Path d="M80 40L64 68L80 62L94 70Z" fill={colors.surface.paper} {...DET} />
      <Rect x={94} y={100} width={12} height={90} rx={3} fill={colors.vocab.brown} {...DET} />
      <Path d="M40 104H140L158 122L140 140H40Z" fill={colors.surface.paper} {...INK} />
      {word(94, 129, '정상 ↑', 20)}
      {word(52, 180, '한 시간', 14, colors.surface.paper)}
    </Card>
  );
}

/** An apple with its stem and leaf at (x, y), radius r. */
const apple = (x: number, y: number, r: number): ReactElement => (
  <G key={x}>
    <Path d={`M${x} ${y - r * 0.7}Q${x + r * 1.2} ${y - r * 1.3} ${x + r} ${y + r * 0.2}Q${x + r * 0.6} ${y + r} ${x} ${y + r * 0.8}Q${x - r * 0.6} ${y + r} ${x - r} ${y + r * 0.2}Q${x - r * 1.2} ${y - r * 1.3} ${x} ${y - r * 0.7}Z`} fill={colors.vocab.red} {...INK} />
    <Path d={`M${x} ${y - r * 0.6}V${y - r * 1.2}`} {...DET} />
    <Path d={`M${x + 2} ${y - r * 1.1}Q${x + r * 0.6} ${y - r * 1.6} ${x + r * 0.9} ${y - r * 1.1}Q${x + r * 0.4} ${y - r * 0.8} ${x + 2} ${y - r * 1.1}Z`} fill={colors.vocab.green} {...DET} />
  </G>
);

function DeomArt(p: ArtProps): ReactElement {
  // A little extra: three apples under their price card, a "+" and one more apple set apart with sparkles.
  return (
    <Card theme="crafts" p={p}>
      <Rect x={14} y={14} width={110} height={52} rx={8} fill={colors.surface.paper} {...DET} />
      {word(69, 36, '사과 세 개', 14)}
      {word(69, 56, '이천 원', 14)}
      {[34, 76, 56].map((x, i) => apple(x, i === 2 ? 106 : 142, 22))}
      <Path d="M112 128H136M124 116V140" stroke={colors.vocab.green} strokeWidth={8} strokeLinecap="round" />
      {apple(164, 142, 26)}
      <Path d={sparkle(186, 100, 9) + sparkle(140, 96, 7)} fill={colors.vocab.yellow} {...DET} />
    </Card>
  );
}

/** Stage 7: the card's own subject, with the cell's sentence written small on a note strip below. */
function Note({ theme, p, line, children }: { theme: ThemeKey; p: ArtProps; line: string; children: ReactNode }): ReactElement {
  return (
    <Card theme={theme} p={p}>
      {children}
      <Rect x={16} y={166} width={168} height={26} rx={6} fill={colors.surface.paper} {...DET} />
      {/* A Hangul syllable is about one font size wide: a long sentence gets a smaller size so it stays on the strip. */}
      {word(100, 184, line, Math.min(13, Math.floor(150 / line.length)))}
    </Card>
  );
}

function IreumArt(p: ArtProps): ReactElement {
  // Name: a name badge on a lanyard, Hoya's face on the left and the name on the right.
  return (
    <Note theme="letters" p={p} line="제 이름은 호야예요.">
      <Path d="M54 0L96 58M146 0L104 58" stroke={colors.text.primary} strokeWidth={14} strokeLinecap="round" />
      <Path d="M54 0L96 58M146 0L104 58" stroke={colors.vocab.blue} strokeWidth={6} strokeLinecap="round" />
      <Rect x={28} y={64} width={144} height={92} rx={10} fill={colors.surface.paper} {...INK} />
      <Path d="M28 74Q28 64 38 64H162Q172 64 172 74V88H28Z" fill={colors.vocab.blue} {...DET} />
      <Rect x={84} y={52} width={32} height={22} rx={5} fill={colors.vocab.gray} {...DET} />
      <Circle cx={50} cy={108} r={8} fill={colors.hoya.fur} {...DET} />
      <Circle cx={78} cy={108} r={8} fill={colors.hoya.fur} {...DET} />
      <Circle cx={64} cy={124} r={20} fill={colors.hoya.fur} {...DET} />
      <Path d="M57 122h0M71 122h0" stroke={colors.text.primary} strokeWidth={6} strokeLinecap="round" />
      <Path d="M58 131Q64 136 70 131" {...DET} fill={NONE} />
      {word(132, 126, '호야', 24)}
      <Path d="M100 142H162" {...DET} />
    </Note>
  );
}

function AchimArt(p: ArtProps): ReactElement {
  // Morning: the sun rises over a green ridge, seen through a window; a slice of toast stands in front of the sill.
  return (
    <Note theme="life" p={p} line="아침에 빵을 먹어요.">
      <Rect x={14} y={8} width={172} height={100} rx={6} fill={colors.theme.life} opacity={0.4} />
      <Path d="M44 38L34 26M108 38L118 26M76 28V14M128 64H140" stroke={colors.vocab.orange} strokeWidth={6} strokeLinecap="round" />
      <Path d="M32 84A44 44 0 0 1 120 84Z" fill={colors.vocab.orange} {...INK} />
      <Path d="M14 90Q56 66 100 84Q144 68 186 88V108H14Z" fill={colors.vocab.green} {...INK} />
      <Rect x={14} y={8} width={172} height={100} rx={6} fill={NONE} stroke={colors.vocab.brown} strokeWidth={10} />
      <Rect x={14} y={8} width={172} height={100} rx={6} fill={NONE} {...DET} />
      <Rect x={6} y={104} width={188} height={14} rx={4} fill={colors.vocab.brown} {...INK} />
      <Path d="M116 162V116Q106 112 108 100Q112 86 148 86Q184 86 188 100Q190 112 180 116V162Z" fill={colors.vocab.brown} {...INK} />
      <Path d="M126 153V110Q117 107 118 101Q121 95 148 95Q175 95 178 101Q179 107 170 110V153Z" fill={colors.theme.life} />
    </Note>
  );
}

function SaengilArt(p: ArtProps): ReactElement {
  // Birthday: a round pink cake with white cream on top, three candles alight, on a plate.
  return (
    <Note theme="rites" p={p} line="생일에 케이크를 먹었어요.">
      <Ellipse cx={100} cy={152} rx={84} ry={12} fill={colors.surface.paper} {...INK} />
      <Path d="M30 94V140Q100 162 170 140V94Z" fill={colors.vocab.pink} {...INK} />
      <Ellipse cx={100} cy={94} rx={70} ry={18} fill={colors.surface.paper} {...INK} />
      <Path d="M36 104Q44 122 52 108Q60 124 70 110M130 110Q140 124 148 108Q156 122 164 104" stroke={colors.surface.paper} strokeWidth={8} fill={NONE} strokeLinecap="round" />
      {[66, 100, 134].map((x) => (
        <G key={x}>
          <Rect x={x - 7} y={50} width={14} height={40} rx={4} fill={colors.vocab.skyBlue} {...DET} />
          <Path d={`M${x} 18Q${x + 11} 34 ${x} 44Q${x - 11} 34 ${x} 18Z`} fill={colors.vocab.yellow} {...DET} />
        </G>
      ))}
    </Note>
  );
}

function TokkiArt(p: ArtProps): ReactElement {
  // Rabbit: a whole white rabbit sitting in the grass, long ears up, a round tail, smiling.
  return (
    <Note theme="nature" p={p} line="토끼는 작아요.">
      <Path d="M20 160Q30 146 40 160M150 160Q160 144 172 160" stroke={colors.vocab.green} strokeWidth={6} fill={NONE} strokeLinecap="round" />
      <Circle cx={156} cy={128} r={16} fill={colors.vocab.white} {...INK} />
      <Ellipse cx={120} cy={122} rx={46} ry={38} fill={colors.vocab.white} {...INK} />
      <Ellipse cx={58} cy={54} rx={12} ry={38} fill={colors.vocab.white} {...INK} transform="rotate(-14 58 54)" />
      <Ellipse cx={88} cy={50} rx={12} ry={38} fill={colors.vocab.white} {...INK} transform="rotate(12 88 50)" />
      <Ellipse cx={58} cy={56} rx={5} ry={26} fill={colors.vocab.pink} transform="rotate(-14 58 56)" />
      <Ellipse cx={88} cy={52} rx={5} ry={26} fill={colors.vocab.pink} transform="rotate(12 88 52)" />
      <Circle cx={72} cy={106} r={34} fill={colors.vocab.white} {...INK} />
      <Ellipse cx={92} cy={154} rx={18} ry={9} fill={colors.vocab.white} {...INK} />
      <Circle cx={60} cy={100} r={5} fill={colors.text.primary} />
      <Circle cx={44} cy={112} r={5} fill={colors.vocab.pink} />
      <Path d="M50 120Q56 126 62 120" {...DET} fill={NONE} />
    </Note>
  );
}

function BihaenggiArt(p: ArtProps): ReactElement {
  // Plane: a big folded paper plane with its fold lines, on a dashed flight arc.
  return (
    <Note theme="crafts" p={p} line="비행기를 접어요.">
      <Path d="M10 152Q30 110 64 120" stroke={colors.brand.secondary} strokeWidth={5} strokeDasharray="10 9" fill={NONE} strokeLinecap="round" />
      <Polygon points="190,18 84,118 116,154" fill={colors.vocab.skyBlue} {...INK} />
      <Polygon points="190,18 14,86 84,118" fill={colors.surface.paper} {...INK} />
      <Polygon points="190,18 84,118 96,138" fill={colors.surface.paper} {...INK} />
      <Path d="M190 18L52 98" {...DET} />
    </Note>
  );
}

// ---- The album legendary cards (row CM-23 part 3) --------------------------------------------------------
// Each in a gold frame of the legendary rarity token, one subject of its album, its Korean name small on a label.

function Legend({ theme, p, name, children }: { theme: ThemeKey; p: ArtProps; name: string; children: ReactNode }): ReactElement {
  return (
    <Card theme={theme} p={p}>
      <Rect x={6} y={6} width={188} height={188} rx={12} fill={NONE} stroke={colors.rarity.legendary} strokeWidth={6} />
      {children}
      <Rect x={52} y={162} width={96} height={26} rx={9} fill={colors.surface.paper} stroke={colors.rarity.legendary} strokeWidth={4} />
      {word(100, 181, name, 14)}
    </Card>
  );
}

function HunminjeongeumArt(p: ArtProps): ReactElement {
  // Hunminjeongeum: an old thread-bound book, its aged patterned cover with a white title slip at the upper left and the
  // five-hole binding stitched along the right edge.
  return (
    <Legend theme="letters" p={p} name="훈민정음">
      <Path d="M54 26H154V154H54Z" fill={colors.surface.sunken} {...INK} transform="translate(6 6)" />
      <Rect x={46} y={20} width={108} height={134} rx={3} fill={colors.hoya.furDark} {...INK} />
      <Path d="M50 50L80 24M50 90L120 24M50 130L136 50M74 150L136 90M114 150L136 130M50 30L136 110M50 70L130 150M50 110L90 150" stroke={colors.feedback.nudge} strokeWidth={4} opacity={0.6} />
      <Rect x={58} y={32} width={26} height={78} rx={2} fill={colors.surface.paper} {...DET} />
      <Path d="M71 44V52M71 62V70M71 80V88M71 96V100" {...DET} />
      <G stroke={colors.vocab.red} strokeWidth={5} fill={NONE} strokeLinecap="round">
        {[34, 60, 87, 114, 140].map((y) => (
          <Path key={y} d={`M142 ${y}H160`} />
        ))}
        <Path d="M160 34V140" />
      </G>
      <G fill={colors.text.primary}>
        {[34, 60, 87, 114, 140].map((y) => (
          <Circle key={y} cx={142} cy={y} r={4} />
        ))}
      </G>
    </Legend>
  );
}

function JangArt(p: ArtProps): ReactElement {
  // Jang making: three round onggi jars in a row on a stone terrace, lids on.
  return (
    <Legend theme="life" p={p} name="장 담그기">
      <Rect x={16} y={134} width={168} height={18} rx={5} fill={colors.surface.sunken} {...INK} />
      {(
        [
          [48, 24],
          [100, 32],
          [152, 24],
        ] as const
      ).map(([x, r]) => (
        <G key={x}>
          <Ellipse cx={x} cy={134 - r} rx={r} ry={r} fill={colors.vocab.brown} {...INK} />
          <Ellipse cx={x} cy={134 - 2 * r + 2} rx={r * 0.62} ry={6} fill={colors.text.secondary} {...DET} />
          <Path d={`M${x - r * 0.7} ${134 - r}Q${x} ${128 - r} ${x + r * 0.7} ${134 - r}`} stroke={colors.surface.sunken} strokeWidth={4} fill={NONE} />
        </G>
      ))}
    </Legend>
  );
}

function HangawiArt(p: ArtProps): ReactElement {
  // Hangawi: a plate heaped with songpyeon in front, a footed dish piled with apples and pears behind it, a small full
  // moon in the corner.
  return (
    <Legend theme="rites" p={p} name="한가위">
      <Circle cx={152} cy={42} r={26} fill={colors.vocab.yellow} {...INK} />
      <Path d="M60 100H84L90 124H54Z" fill={colors.surface.paper} {...INK} />
      <Path d="M28 94H116Q110 106 72 106Q34 106 28 94Z" fill={colors.surface.paper} {...INK} />
      <G {...INK}>
        <Circle cx={46} cy={78} r={15} fill={colors.vocab.red} />
        <Circle cx={72} cy={78} r={15} fill={colors.vocab.yellow} />
        <Circle cx={98} cy={78} r={15} fill={colors.vocab.red} />
        <Circle cx={59} cy={52} r={15} fill={colors.vocab.yellow} />
        <Circle cx={85} cy={52} r={15} fill={colors.vocab.red} />
        <Circle cx={72} cy={26} r={14} fill={colors.vocab.red} />
      </G>
      <Ellipse cx={100} cy={146} rx={86} ry={14} fill={colors.surface.paper} {...INK} />
      <G {...DET}>
        {[40, 70, 100, 130, 160, 55, 85, 115, 145].map((x, i) => (
          <Path key={x} d={`M${x - 15} ${i < 5 ? 144 : 128}Q${x} ${i < 5 ? 116 : 100} ${x + 15} ${i < 5 ? 144 : 128}Z`} fill={[colors.surface.paper, colors.vocab.green, colors.vocab.yellow][i % 3]} />
        )).reverse()}
      </G>
    </Legend>
  );
}

function JirisanArt(p: ArtProps): ReactElement {
  // Jirisan: long ridges one behind another with a sea of clouds between them, the summit stone on the top peak.
  return (
    <Legend theme="nature" p={p} name="지리산">
      <Path d="M12 92Q40 58 66 78Q96 40 128 70Q156 50 188 82V120H12Z" fill={colors.theme.nature} {...INK} />
      <Path d="M12 112Q28 98 46 108Q62 94 82 106Q100 94 120 106Q140 94 160 106Q176 96 188 108V128H12Z" fill={colors.surface.paper} {...DET} />
      <Path d="M12 156L74 82L100 110L120 96L188 156Z" fill={colors.feedback.success} {...INK} />
      <Path d="M62 88L64 50Q72 40 86 46L90 88Z" fill={colors.vocab.gray} {...INK} />
    </Legend>
  );
}

function SsireumArt(p: ArtProps): ReactElement {
  // Ssireum: two friends lean in and hold each other's cloth belt in a round sand ring.
  return (
    <Legend theme="crafts" p={p} name="씨름">
      <Ellipse cx={100} cy={146} rx={86} ry={14} fill={colors.feedback.nudge} opacity={0.4} />
      <G transform="rotate(16 56 150)">
        <Pal x={56} y={76} fur={colors.hoya.fur} />
      </G>
      <G transform="rotate(-16 144 150)">
        <Pal x={144} y={76} fur={colors.hoya.furBlue} />
      </G>
      <Path d="M76 128H124" stroke={colors.text.primary} strokeWidth={18} strokeLinecap="round" />
      <Path d="M76 128H124" stroke={colors.brand.primary} strokeWidth={8} strokeLinecap="round" />
    </Legend>
  );
}

/** True for a card id this module draws. */
export const hasUpperCellArt = (cardId: string): boolean => upperCellCardArtIds.includes(cardId) || albumLegendArtIds.includes(cardId);

/** The drawings by card id; `upperCellCardArtIds` and `albumLegendArtIds` list the same thirty. */
export function UpperCellCardArt({ cardId, size = 200, testID, accessibilityLabel }: HeritageCardArtProps): ReactElement | null {
  const p: ArtProps = { size, testID, accessibilityLabel: accessibilityLabel ?? `Card art for ${cardId}` };
  switch (cardId) {
    case 'card:norae': return <NoraeArt {...p} />;
    case 'card:dosirak': return <DosirakArt {...p} />;
    case 'card:bokjumeoni': return <BokjumeoniArt {...p} />;
    case 'card:byeol': return <ByeolArt {...p} />;
    case 'card:swing': return <SwingArt {...p} />;
    case 'card:hangeul': return <HangeulArt {...p} />;
    case 'card:tteok': return <TteokArt {...p} />;
    case 'card:full-moon': return <FullMoonArt {...p} />;
    case 'card:gom': return <GomArt {...p} />;
    case 'card:yut': return <YutArt {...p} />;
    case 'card:mwoyeyo': return <MwoyeyoArt {...p} />;
    case 'card:masisseoyo': return <MasisseoyoArt {...p} />;
    case 'card:insa': return <InsaArt {...p} />;
    case 'card:biga-wayo': return <BigaWayoArt {...p} />;
    case 'card:gachi': return <GachiArt {...p} />;
    case 'card:won': return <WonArt {...p} />;
    case 'card:yeogiyo': return <YeogiyoArt {...p} />;
    case 'card:gichapyo': return <GichapyoArt {...p} />;
    case 'card:jeongsang': return <JeongsangArt {...p} />;
    case 'card:deom': return <DeomArt {...p} />;
    case 'card:ireum': return <IreumArt {...p} />;
    case 'card:achim': return <AchimArt {...p} />;
    case 'card:saengil': return <SaengilArt {...p} />;
    case 'card:tokki': return <TokkiArt {...p} />;
    case 'card:bihaenggi': return <BihaenggiArt {...p} />;
    case 'card:hunminjeongeum': return <HunminjeongeumArt {...p} />;
    case 'card:jang': return <JangArt {...p} />;
    case 'card:hangawi': return <HangawiArt {...p} />;
    case 'card:jirisan': return <JirisanArt {...p} />;
    case 'card:ssireum': return <SsireumArt {...p} />;
    default: return null;
  }
}
