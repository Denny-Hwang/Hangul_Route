import type { ReactNode, ReactElement } from 'react';
import { Svg, Circle, Ellipse, G, Path, Polygon, Rect } from 'react-native-svg';
import { colors } from '../../tokens';
import type { HeritageCardArtProps } from './types';

/**
 * HeritageCardArt — geometric SVG illustrations for all 30 Stage 1 Heritage cards, on a 200 x 200 grid in a light
 * theme-tinted frame. Visual language: design/brief/illustrations/heritage-card-art.md, with the [PX] rules of
 * docs/specs/AMENDMENTS-PICTURES-2026-11.md section 3 (row PX-2):
 *   - R1 every subject is outlined in `text.primary`, 6 units (`INK`); inner detail 4 units (`DET`); nothing thinner
 *   - R2 one subject fills 60-70 % of the frame, at most two supporting things
 *   - R3 told by shape inside the Stage 1 set (the bowls, the moons, the bows each have their own silhouette)
 *   - R4 real colours for real things: the `colors.vocab.*` tones are allowed; never `feedback.danger`
 *   - Smiling rule: any face smiles. No picture prints its own word (R5).
 */

export { supportedCardIds } from './card-ids';

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

/** A four-point sparkle (stars, festive marks). */
const sparkle = (x: number, y: number, r: number): string => `M${x} ${y - r}Q${x} ${y} ${x + r} ${y}Q${x} ${y} ${x} ${y + r}Q${x} ${y} ${x - r} ${y}Q${x} ${y} ${x} ${y - r}Z`;

// ---------------------------------------------------------------------------
// LETTERS & BOOKS
// ---------------------------------------------------------------------------

function BookArt(p: ArtProps): ReactElement {
  // An open book: two white pages over a red cover, rows of writing marks (no letters), a ribbon.
  return (
    <Card theme="letters" p={p}>
      {shadow(170, 76)}
      <Path d="M20 62Q100 50 180 62V164Q100 152 20 164Z" fill={colors.vocab.red} {...INK} />
      <Path d="M30 50Q66 40 100 56Q134 40 170 50V150Q134 140 100 156Q66 140 30 150Z" fill={colors.surface.paper} {...INK} />
      <Path d="M100 56V156" {...DET} />
      <Path d="M44 76Q62 70 84 78M44 98H84M44 120Q62 114 84 122M116 78Q138 70 156 76M116 98H156M116 122Q138 114 156 120" {...DET} fill={NONE} />
      <Path d="M126 46V24L134 30L142 24V44" fill={colors.vocab.yellow} {...DET} />
    </Card>
  );
}

function HanjiArt(p: ArtProps): ReactElement {
  // Mulberry paper: a sheet with deckled edges and a curled corner over a second sheet, a roll lying in front.
  return (
    <Card theme="letters" p={p}>
      {shadow(178, 70)}
      <Rect x={50} y={30} width={120} height={112} rx={3} fill={colors.surface.sunken} {...INK} transform="rotate(7 110 86)" />
      <Path
        d="M28 40q8-6 16 0t16 0t16 0t16 0t16 0t16 0t16 0t14 0q-4 10 0 18t0 18t0 18t0 18L130 140q-12 0-24-2t-24 0t-24 0t-26 0q4-10 0-18t0-18t0-18t0-18t-4-18Z"
        fill={colors.surface.paper}
        {...INK}
      />
      <Path d="M152 112L130 140Q126 118 152 112Z" fill={colors.surface.sunken} {...DET} />
      <Path d="M44 60Q62 54 78 64M92 54Q112 50 132 58M52 92Q76 84 98 94M112 86Q128 82 142 90M60 120Q80 114 104 122M70 72Q74 90 70 108M120 66Q126 84 122 104" stroke={colors.border.strong} strokeWidth={4} strokeLinecap="round" fill={NONE} />
      <Rect x={36} y={146} width={128} height={30} rx={15} fill={colors.surface.paper} {...INK} />
      <Ellipse cx={149} cy={161} rx={9} ry={15} fill={colors.surface.sunken} {...DET} />
      <Path d="M149 156Q153 161 149 166" {...DET} fill={NONE} />
    </Card>
  );
}

function BrushArt(p: ArtProps): ReactElement {
  // A calligraphy brush at a slant: hanging loop, bamboo handle with joints, a long black tip that ends in a point,
  // and the ink stroke it has just made.
  return (
    <Card theme="letters" p={p}>
      <Path d="M34 172Q70 150 104 168T170 160" stroke={colors.text.primary} strokeWidth={14} strokeLinecap="round" fill={NONE} />
      <G transform="rotate(34 100 96)">
        <Circle cx={100} cy={14} r={8} fill={NONE} {...DET} />
        <Rect x={90} y={22} width={20} height={88} rx={5} fill={colors.hoya.fur} {...INK} />
        <Path d="M90 50H110M90 80H110" {...DET} />
        <Rect x={87} y={108} width={26} height={12} rx={3} fill={colors.text.secondary} {...INK} />
        <Path d="M88 120H112Q122 150 100 186Q78 150 88 120Z" fill={colors.text.primary} {...INK} />
      </G>
    </Card>
  );
}

function InkArt(p: ArtProps): ReactElement {
  // Meok and byeoru: a black ink stick standing upright on a rectangular inkstone seen at three-quarter view, the
  // dark ink pool in its well.
  return (
    <Card theme="letters" p={p}>
      {shadow(184, 80)}
      <Polygon points="20,124 82,152 82,178 20,150" fill={colors.text.muted} {...INK} />
      <Polygon points="82,152 182,112 182,138 82,178" fill={colors.text.secondary} {...INK} />
      <Polygon points="20,124 120,86 182,112 82,152" fill={colors.vocab.gray} {...INK} />
      <Ellipse cx={136} cy={110} rx={28} ry={11} fill={colors.vocab.black} {...DET} transform="rotate(-20 136 110)" />
      <Ellipse cx={128} cy={108} rx={7} ry={2.5} fill={colors.surface.paper} opacity={0.7} transform="rotate(-20 128 108)" />
      <Polygon points="60,30 76,24 76,120 60,126" fill={colors.text.secondary} {...INK} />
      <Polygon points="44,24 60,30 60,126 44,120" fill={colors.vocab.black} {...INK} />
      <Polygon points="44,24 60,18 76,24 60,30" fill={colors.text.muted} {...INK} />
      <Rect x={48} y={52} width={8} height={36} fill={colors.hoya.fur} />
    </Card>
  );
}

function OrigamiArt(p: ArtProps): ReactElement {
  // A folded paper crane: two raised wings with crease lines, a long neck with the bent beak, a pointed raised tail.
  return (
    <Card theme="letters" p={p}>
      {shadow(178, 54)}
      <Polygon points="100,120 70,26 124,124" fill={colors.brand.primary} {...INK} />
      <Polygon points="100,120 150,30 120,130" fill={colors.vocab.orange} {...INK} />
      <Path d="M98 116L78 52M110 120L140 54" {...DET} stroke={colors.brand.primaryDark} />
      <Polygon points="58,134 30,66 80,126" fill={colors.vocab.orange} {...INK} />
      <Polygon points="24,60 44,66 12,86" fill={colors.vocab.orange} {...INK} />
      <Polygon points="142,134 186,64 120,126" fill={colors.vocab.orange} {...INK} />
      <Polygon points="56,134 100,114 144,134 100,160" fill={colors.brand.primary} {...INK} />
      <Path d="M100 114V160" {...DET} />
    </Card>
  );
}

function HangulDayArt(p: ArtProps): ReactElement {
  // Hangul Day: a tear-off calendar page whose big mark is the word 한글 drawn as shapes (ㅎ+ㅏ+ㄴ, ㄱ+ㅡ+ㄹ; no font
  // text), with sparkles.
  return (
    <Card theme="letters" p={p}>
      {shadow(184, 66)}
      <Rect x={34} y={34} width={132} height={144} rx={8} fill={colors.surface.paper} {...INK} />
      <Rect x={34} y={34} width={132} height={30} rx={8} fill={colors.vocab.red} {...INK} />
      <Path d="M62 24V44M138 24V44" stroke={colors.text.primary} strokeWidth={8} strokeLinecap="round" />
      <G stroke={colors.vocab.blue} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" fill={NONE}>
        <Path d="M58 78H72M48 90H82M90 76V128M90 102H100M52 134V160H98" />
        <Circle cx={65} cy={109} r={11} />
        <Path d="M110 80H148V100M104 114H154M110 126H148V139H110V152H150" />
      </G>      <Path d={sparkle(176, 76, 14) + sparkle(24, 140, 12)} fill={colors.vocab.yellow} {...DET} />
    </Card>
  );
}

// ---------------------------------------------------------------------------
// FOOD & DAILY LIFE
// ---------------------------------------------------------------------------

function KimchiArt(p: ArtProps): ReactElement {
  // Pogi-kimchi: half a napa cabbage lying on a plate, stem end on the left; white ribs fan out under the red
  // seasoning, a frilly green leaf edge, chili flakes. Wider than tall, on a flat plate (the rice is a tall bowl).
  return (
    <Card theme="life" p={p}>
      <Ellipse cx={100} cy={146} rx={86} ry={28} fill={colors.vocab.white} {...INK} />
      <Path d="M104 62Q120 40 140 50Q158 38 170 54Q188 56 184 76Q196 92 182 104Q188 122 168 126L112 118Z" fill={colors.vocab.green} {...INK} />
      <Path d="M26 142Q28 116 50 100Q78 74 106 66Q134 56 156 68Q176 82 170 106Q164 126 140 134Q96 148 26 142Z" fill={colors.vocab.red} {...INK} />
      <G fill={colors.vocab.white} {...DET}>
        <Path d="M34 136Q66 96 112 74Q80 106 34 136Z" />
        <Path d="M34 138Q86 100 148 84Q94 118 34 138Z" />
        <Path d="M34 140Q96 120 160 110Q100 136 34 140Z" />
      </G>
      <Ellipse cx={30} cy={138} rx={14} ry={12} fill={colors.vocab.white} {...INK} />
      <G fill={colors.brand.primaryDark}>
        <Circle cx={118} cy={92} r={3.5} />
        <Circle cx={140} cy={100} r={3.5} />
        <Circle cx={96} cy={122} r={3.5} />
        <Circle cx={150} cy={120} r={3.5} />
        <Circle cx={74} cy={104} r={3.5} />
      </G>
      <Path d="M128 78L136 74M110 132L118 128M62 126L70 122" stroke={colors.vocab.green} strokeWidth={5} strokeLinecap="round" />
    </Card>
  );
}

function RiceArt(p: ArtProps): ReactElement {
  // A tall blue rice bowl heaped with a high dome of white rice, grain ticks, steam.
  return (
    <Card theme="life" p={p}>
      {shadow(182, 52)}
      <Path d="M76 40Q84 30 76 20M100 36Q108 26 100 14M124 40Q132 30 124 20" stroke={colors.text.muted} strokeWidth={4} strokeLinecap="round" fill={NONE} />
      <Path d="M44 104Q46 50 100 48Q154 50 156 104Z" fill={colors.vocab.white} {...INK} />
      <Path d="M76 74l6 3M104 64l6-2M120 84l6 3M88 92l6-2M66 92l5 3" {...DET} stroke={colors.border.strong} />
      <Path d="M32 102H168Q166 150 126 162V176H74V162Q34 150 32 102Z" fill={colors.brand.secondary} {...INK} />
      <Path d="M44 124H156" {...DET} stroke={colors.brand.secondaryLight} />
    </Card>
  );
}

function ChopsticksArt(p: ArtProps): ReactElement {
  // Sujeo: a flat metal spoon and a pair of flat grey metal chopsticks laid side by side on a wooden rest.
  return (
    <Card theme="life" p={p}>
      {shadow(184, 70)}
      <Rect x={92} y={118} width={84} height={20} rx={10} fill={colors.vocab.brown} {...INK} transform="rotate(-52 134 128)" />
      <G transform="rotate(38 100 100)">
        <Rect x={68} y={14} width={14} height={112} rx={7} fill={colors.vocab.gray} {...INK} />
        <Ellipse cx={75} cy={150} rx={22} ry={32} fill={colors.vocab.gray} {...INK} />
        <Ellipse cx={75} cy={152} rx={12} ry={20} fill={colors.surface.paper} opacity={0.5} />
        <Polygon points="104,10 118,10 116,186 106,186" fill={colors.vocab.gray} {...INK} />
        <Polygon points="128,10 142,10 140,186 130,186" fill={colors.vocab.gray} {...INK} />
        <Path d="M106 34H116M130 34H140" {...DET} />
      </G>
    </Card>
  );
}

function HanbokArt(p: ArtProps): ReactElement {
  // A hanbok on a hanger: orange jeogori with the white collar strip and the long goreum tie, a full sky-blue chima.
  return (
    <Card theme="life" p={p}>
      <Path d="M100 14Q110 18 104 28" {...DET} fill={NONE} />
      <Path d="M54 42Q100 26 146 42" {...INK} fill={NONE} />
      <Path d="M68 100Q100 108 132 100L158 180Q100 190 42 180Z" fill={colors.brand.secondary} {...INK} />
      <Path d="M84 110L76 176M116 110L124 176" {...DET} stroke={colors.brand.secondaryDark} />
      <Path d="M28 58Q64 34 100 36Q136 34 172 58L160 86L132 74V104Q100 112 68 104V74L40 86Z" fill={colors.brand.primary} {...INK} />
      <Path d="M80 38L100 66L120 38" fill={NONE} stroke={colors.surface.paper} strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M80 38L100 66L120 38" fill={NONE} {...DET} />
      <Path d="M100 70L86 118M100 70L110 128" stroke={colors.vocab.red} strokeWidth={8} strokeLinecap="round" />
    </Card>
  );
}

function KimbapArt(p: ArtProps): ReactElement {
  // Three kimbap slices on a diagonal: the seaweed ring, white rice, carrot, spinach and egg.
  return (
    <Card theme="life" p={p}>
      {shadow(182, 70)}
      {([
        [60, 140],
        [100, 100],
        [140, 60],
      ] as const).map(([x, y]) => (
        <G key={x}>
          <Circle cx={x} cy={y} r={34} fill={colors.vocab.black} {...INK} />
          <Circle cx={x} cy={y} r={25} fill={colors.vocab.white} />
          <Circle cx={x - 8} cy={y + 6} r={7} fill={colors.vocab.orange} />
          <Circle cx={x + 8} cy={y - 6} r={7} fill={colors.vocab.green} />
          <Rect x={x - 5} y={y - 5} width={10} height={10} fill={colors.vocab.yellow} />
        </G>
      ))}
    </Card>
  );
}

function FamilyTableArt(p: ArtProps): ReactElement {
  // The family table seen from the side: a low round table with curved legs, a rice bowl, soup, kimchi and a spoon
  // with chopsticks laid at the front.
  return (
    <Card theme="life" p={p}>
      {shadow(184, 78)}
      <Path d="M44 128Q36 160 50 178M156 128Q164 160 150 178M100 140V182" stroke={colors.text.primary} strokeWidth={16} strokeLinecap="round" fill={NONE} />
      <Path d="M44 128Q36 160 50 178M156 128Q164 160 150 178M100 140V182" stroke={colors.vocab.brown} strokeWidth={6} strokeLinecap="round" fill={NONE} />
      <Path d="M14 108V122Q100 150 186 122V108Z" fill={colors.vocab.brown} {...INK} />
      <Ellipse cx={100} cy={108} rx={86} ry={22} fill={colors.feedback.nudge} {...INK} />
      <Path d="M30 98Q32 72 54 72Q76 72 78 98Z" fill={colors.surface.paper} {...INK} />
      <Path d="M70 92Q72 54 100 52Q128 54 130 92Z" fill={colors.vocab.white} {...INK} />
      <Path d="M66 90H134Q132 112 100 116Q68 112 66 90Z" fill={colors.brand.secondary} {...INK} />
      <Ellipse cx={150} cy={100} rx={26} ry={9} fill={colors.vocab.white} {...INK} />
      <Path d="M134 98Q142 80 152 88Q160 78 166 98Z" fill={colors.vocab.red} {...DET} />
      <Path d="M84 124L134 116M88 130L138 122" {...DET} stroke={colors.text.secondary} />
    </Card>
  );
}

// ---------------------------------------------------------------------------
// HOLIDAYS & TRADITIONS
// ---------------------------------------------------------------------------

/**
 * A child in hanbok in the deep New Year bow, side view: legs folded under, back rounded, head lowered to the floor,
 * hands flat on the floor in front. `k` is the scale the caller draws it at, so the outline stays 6 / 4 units (R1).
 */
function Bower({ k }: { k: number }): ReactElement {
  const ink = { ...INK, strokeWidth: 6 / k };
  return (
    <G>
      <Path d="M100 168Q96 96 140 90Q182 94 180 168Z" fill={colors.vocab.red} {...ink} />
      <Path d="M152 98Q118 96 94 112Q70 130 48 162L66 170Q90 152 110 142Q134 134 156 132Z" fill={colors.vocab.yellow} {...ink} />
      <Path d="M108 114Q118 122 114 140" stroke={colors.vocab.blue} strokeWidth={8 / k} strokeLinecap="round" fill={NONE} />
      <Ellipse cx={42} cy={166} rx={16} ry={7} fill={colors.surface.paper} {...ink} />
      <Circle cx={70} cy={130} r={24} fill={colors.surface.paper} {...ink} />
      <Path d="M53 113A24 24 0 0 1 87 147Z" fill={colors.text.primary} {...ink} />
      <Circle cx={56} cy={142} r={5} fill={colors.hoya.cheek} />
      <Path d="M58 128Q62 132 66 129" {...ink} strokeWidth={4 / k} fill={NONE} />
    </G>
  );
}

function SeollalArt(p: ArtProps): ReactElement {
  // Lunar New Year: a child bows deeply to a grandparent seated on a cushion. [FU] The child is drawn larger and faces
  // the grandparent (it had its back to her), and the lucky pouch is left out to make room.
  return (
    <Card theme="rites" p={p}>
      <Rect x={6} y={174} width={188} height={10} rx={5} fill={colors.feedback.nudge} {...DET} />
      <G transform="translate(134 51) scale(-0.72 0.72)">
        <Bower k={0.72} />
      </G>
      <G transform="translate(18 26) scale(0.88)">
        <Ellipse cx={150} cy={172} rx={42} ry={10} fill={colors.vocab.red} {...INK} strokeWidth={6 / 0.88} />
        <Path d="M112 166Q112 98 150 92Q188 98 188 166Z" fill={colors.vocab.purple} {...INK} strokeWidth={6 / 0.88} />
        <Path d="M126 132Q150 146 174 132" {...DET} fill={NONE} />
        <Circle cx={150} cy={66} r={24} fill={colors.surface.paper} {...INK} strokeWidth={6 / 0.88} />
        <Path d="M126 64Q128 40 150 40Q172 40 174 64Q160 52 150 54Q140 52 126 64Z" fill={colors.vocab.gray} {...DET} />
        <Circle cx={150} cy={36} r={9} fill={colors.vocab.gray} {...DET} />
        <Path d="M140 70Q143 66 146 70M154 70Q157 66 160 70M144 78Q150 84 156 78" {...DET} fill={NONE} />
      </G>
    </Card>
  );
}

function ChuseokArt(p: ArtProps): ReactElement {
  // Chuseok: a plate of songpyeon in front of the full harvest moon with the moon rabbit, ripe rice ears either side.
  return (
    <Card theme="rites" p={p}>
      <Circle cx={100} cy={70} r={54} fill={colors.vocab.yellow} {...INK} />
      <G fill={colors.hoya.furDark}>
        <Ellipse cx={110} cy={84} rx={20} ry={14} />
        <Circle cx={88} cy={74} r={11} />
        <Ellipse cx={80} cy={50} rx={5} ry={16} transform="rotate(-14 80 50)" />
        <Ellipse cx={92} cy={50} rx={5} ry={16} transform="rotate(10 92 50)" />
      </G>
      <G stroke={colors.hoya.furDark} strokeWidth={5} strokeLinecap="round" fill={NONE}>
        <Path d="M22 184Q20 130 36 100M178 184Q180 130 164 100" />
      </G>
      <G fill={colors.feedback.nudge} {...DET}>
        {[110, 124, 138, 152].map((y) => (
          <G key={y}>
            <Ellipse cx={(y - 100) / 6 + 28} cy={y} rx={7} ry={4} transform={`rotate(-50 ${(y - 100) / 6 + 28} ${y})`} />
            <Ellipse cx={172 - (y - 100) / 6} cy={y} rx={7} ry={4} transform={`rotate(50 ${172 - (y - 100) / 6} ${y})`} />
          </G>
        ))}
      </G>
      <Ellipse cx={100} cy={164} rx={66} ry={18} fill={colors.vocab.white} {...INK} />
      <G {...DET}>
        <Path d="M54 158Q70 128 86 158Z" fill={colors.vocab.pink} />
        <Path d="M114 158Q130 128 146 158Z" fill={colors.vocab.green} />
        <Path d="M82 162Q100 130 118 162Z" fill={colors.surface.paper} />
      </G>
    </Card>
  );
}

function TteokgukArt(p: ArtProps): ReactElement {
  // Rice cake soup: a wide white bowl open to view, oval rice cake slices with yellow egg and dark gim strips on
  // top, a spoon resting in it (wide and low, unlike the tall rice bowl).
  return (
    <Card theme="rites" p={p}>
      {shadow(178, 66)}
      <Path d="M20 96Q24 164 100 170Q176 164 180 96Z" fill={colors.vocab.white} {...INK} />
      <Ellipse cx={100} cy={96} rx={80} ry={26} fill={colors.feedback.nudgeLight} {...INK} />
      <G fill={colors.vocab.white} {...DET}>
        <Ellipse cx={62} cy={96} rx={18} ry={10} />
        <Ellipse cx={100} cy={86} rx={18} ry={10} />
        <Ellipse cx={92} cy={108} rx={18} ry={10} />
        <Ellipse cx={130} cy={104} rx={18} ry={10} />
      </G>
      <Path d="M70 84L84 80M112 98L124 92M58 108L72 106" stroke={colors.vocab.yellow} strokeWidth={6} strokeLinecap="round" />
      <Path d="M80 96L92 92M118 82L132 86M138 96L146 108" stroke={colors.vocab.black} strokeWidth={5} strokeLinecap="round" />
      <Circle cx={108} cy={118} r={4} fill={colors.vocab.green} />
      <Path d="M146 94L184 30" stroke={colors.text.primary} strokeWidth={16} strokeLinecap="round" />
      <Path d="M146 94L184 30" stroke={colors.vocab.gray} strokeWidth={6} strokeLinecap="round" />
    </Card>
  );
}

function SongpyeonArt(p: ArtProps): ReactElement {
  // Three half-moon rice cakes (white, pink, green) on a bed of pine needles.
  return (
    <Card theme="rites" p={p}>
      <G stroke={colors.vocab.green} strokeWidth={5} strokeLinecap="round">
        <Path d="M20 160L56 146M30 168L68 156M44 152L82 166M78 166L122 150M92 156L134 170M118 156L164 144M134 168L180 156" />
      </G>
      <G {...INK}>
        <Path d="M22 140Q46 86 96 118Q84 142 58 152Q36 152 22 140Z" fill={colors.vocab.white} />
        <Path d="M76 104Q102 48 158 84Q146 110 120 120Q94 122 76 104Z" fill={colors.vocab.pink} />
        <Path d="M112 140Q140 92 186 118Q174 142 150 150Q124 152 112 140Z" fill={colors.vocab.green} />
      </G>
    </Card>
  );
}

function SebaeArt(p: ArtProps): ReactElement {
  // Sebae: one child in hanbok in the deep kneeling New Year bow, side view, hands on the floor, on a mat.
  return (
    <Card theme="rites" p={p}>
      <Rect x={14} y={168} width={176} height={14} rx={7} fill={colors.feedback.nudge} {...DET} />
      <G transform="translate(-8 -6) scale(1.06)">
        <Bower k={1.06} />
      </G>
    </Card>
  );
}

function LanternArt(p: ArtProps): ReactElement {
  // A glowing round paper lantern with ribs, caps and a tassel; two smaller lanterns behind.
  return (
    <Card theme="rites" p={p}>
      <G opacity={0.55}>
        <Ellipse cx={36} cy={48} rx={18} ry={20} fill={colors.vocab.red} {...DET} />
        <Ellipse cx={168} cy={44} rx={16} ry={18} fill={colors.vocab.red} {...DET} />
      </G>
      <Circle cx={100} cy={100} r={66} fill={colors.feedback.nudge} opacity={0.3} />
      <Path d="M100 16V44" {...DET} />
      <Ellipse cx={100} cy={100} rx={48} ry={54} fill={colors.vocab.red} {...INK} />
      <Path d="M58 80Q100 88 142 80M52 100Q100 108 148 100M58 122Q100 130 142 122" {...DET} stroke={colors.brand.primaryDark} fill={NONE} />
      <Rect x={84} y={40} width={32} height={12} rx={3} fill={colors.vocab.yellow} {...DET} />
      <Rect x={84} y={148} width={32} height={12} rx={3} fill={colors.vocab.yellow} {...DET} />
      <Path d="M92 162L88 190M100 162V192M108 162L112 190" stroke={colors.vocab.yellow} strokeWidth={5} strokeLinecap="round" />
    </Card>
  );
}

// ---------------------------------------------------------------------------
// NATURE & ANIMALS
// ---------------------------------------------------------------------------

function TigerArt(p: ArtProps): ReactElement {
  // Hoya himself, cheering, with three sparkles.
  return (
    <Card theme="nature" p={p}>
      <Path d={sparkle(68, 36, 12) + sparkle(100, 22, 15) + sparkle(132, 36, 12)} fill={colors.vocab.yellow} {...DET} />
      <G transform="translate(36 55)">
        <Ellipse cx={64} cy={118} rx={40} ry={6} fill={colors.hoya.furDark} opacity={0.18} />
        <Path d="M22 78Q14 60 8 46M106 78Q114 60 120 46" stroke={colors.text.primary} strokeWidth={22} strokeLinecap="round" fill={NONE} />
        <Path d="M22 78Q14 60 8 46M106 78Q114 60 120 46" stroke={colors.hoya.fur} strokeWidth={10} strokeLinecap="round" fill={NONE} />
        <Circle cx={30} cy={32} r={13} fill={colors.hoya.fur} {...INK} />
        <Circle cx={98} cy={32} r={13} fill={colors.hoya.fur} {...INK} />
        <Circle cx={64} cy={66} r={46} fill={colors.hoya.fur} {...INK} />
        <Circle cx={30} cy={32} r={6} fill={colors.hoya.cheek} />
        <Circle cx={98} cy={32} r={6} fill={colors.hoya.cheek} />
        <Path d="M26 54Q30 58 26 62M24 70Q29 73 25 78M102 54Q98 58 102 62M104 70Q99 73 103 78M64 24Q66 30 64 36" stroke={colors.hoya.stripes} strokeWidth={5} strokeLinecap="round" fill={NONE} />
        <Ellipse cx={64} cy={86} rx={27} ry={17} fill={colors.hoya.belly} />
        <Path d="M46 70Q50 66 54 70M74 70Q78 66 82 70" {...DET} fill={NONE} />
        <Circle cx={40} cy={86} r={6} fill={colors.hoya.cheek} opacity={0.7} />
        <Circle cx={88} cy={86} r={6} fill={colors.hoya.cheek} opacity={0.7} />
        <Path d="M57 84H71L64 91Z" fill={colors.hoya.nose} />
        <Path d="M44 94Q60 112 78 94Q60 102 44 94Z" fill={colors.hoya.cheek} {...DET} />
      </G>
    </Card>
  );
}

function MagpieArt(p: ArtProps): ReactElement {
  // A black-and-white magpie with its white shoulder patch and long tail, perched on a bare branch.
  return (
    <Card theme="nature" p={p}>
      <Path d="M14 148Q60 140 100 146Q140 152 186 142M58 144Q64 132 72 126" stroke={colors.text.primary} strokeWidth={16} strokeLinecap="round" fill={NONE} />
      <Path d="M14 148Q60 140 100 146Q140 152 186 142M58 144Q64 132 72 126" stroke={colors.vocab.brown} strokeWidth={6} strokeLinecap="round" fill={NONE} />
      <Path d="M116 112Q146 124 176 160L160 172Q136 142 110 128Z" fill={colors.vocab.black} {...INK} />
      <Ellipse cx={96} cy={102} rx={34} ry={36} fill={colors.vocab.black} {...INK} />
      <Ellipse cx={92} cy={116} rx={18} ry={20} fill={colors.vocab.white} />
      <Path d="M102 88Q124 90 126 110Q112 104 100 100Z" fill={colors.vocab.white} {...DET} />
      <Circle cx={92} cy={62} r={22} fill={colors.vocab.black} {...INK} />
      <Path d="M110 56L132 58L110 68Z" fill={colors.text.secondary} {...DET} />
      <Circle cx={98} cy={56} r={5} fill={colors.vocab.white} />
      <Path d="M86 136L82 148M100 136L98 148" {...DET} />
    </Card>
  );
}

function MugunghwaArt(p: ArtProps): ReactElement {
  // Rose of Sharon: five pink petals, each with the dark red eye radiating up from the centre, the long pale stamen
  // column, two lobed leaves.
  const turns = [0, 72, 144, 216, 288];
  return (
    <Card theme="nature" p={p}>
      <Path d="M100 140V190" stroke={colors.vocab.green} strokeWidth={8} strokeLinecap="round" />
      <Path d="M100 168Q80 150 52 160Q40 150 26 162Q42 176 60 172Q78 184 100 170Z" fill={colors.vocab.green} {...INK} />
      <Path d="M102 160Q124 140 150 150Q160 138 176 148Q164 164 146 164Q126 176 102 160Z" fill={colors.vocab.green} {...INK} />
      {turns.map((a) => (
        <Ellipse key={a} cx={100} cy={46} rx={28} ry={36} fill={colors.vocab.pink} {...INK} transform={`rotate(${a} 100 82)`} />
      ))}
      <Circle cx={100} cy={82} r={20} fill={colors.vocab.red} />
      {turns.map((a) => (
        <Path key={a} d="M100 82L94 54L100 46L106 54Z" fill={colors.vocab.red} transform={`rotate(${a} 100 82)`} />
      ))}
      <Path d="M100 82L124 42" stroke={colors.text.primary} strokeWidth={12} strokeLinecap="round" />
      <Path d="M100 82L124 42" stroke={colors.vocab.white} strokeWidth={5} strokeLinecap="round" />
      <Circle cx={125} cy={40} r={7} fill={colors.vocab.yellow} {...DET} />
    </Card>
  );
}

function MountainArt(p: ArtProps): ReactElement {
  // Three green peaks, the tall middle one with a snow cap, the sun behind.
  return (
    <Card theme="nature" p={p}>
      <Circle cx={160} cy={50} r={20} fill={colors.vocab.yellow} {...INK} />
      <Polygon points="44,176 106,34 170,176" fill={colors.theme.nature} {...INK} />
      <Polygon points="106,34 90,72 100,66 108,76 116,66 124,72" fill={colors.vocab.white} {...DET} />
      <Polygon points="12,176 62,86 114,176" fill={colors.vocab.green} {...INK} />
      <Polygon points="104,176 150,96 192,176" fill={colors.vocab.green} {...INK} />
      <Path d="M62 86L72 130M150 96L140 136" {...DET} fill={NONE} />
    </Card>
  );
}

function SeaArt(p: ArtProps): ReactElement {
  // The sea: three rows of big waves with curling crests and white foam fill the tile, the sun low over the water
  // and one gull; no boat.
  return (
    <Card theme="nature" p={p}>
      <Circle cx={140} cy={54} r={22} fill={colors.vocab.yellow} {...INK} />
      <Path d="M34 46Q44 36 54 46Q64 36 74 46" {...DET} fill={NONE} />
      <Path d="M12 92Q30 64 54 84Q66 92 76 80Q96 58 118 80Q130 92 140 80Q160 58 188 88V122H12Z" fill={colors.vocab.skyBlue} {...INK} />
      <Path d="M12 122Q24 96 52 106Q68 112 74 100Q92 84 114 104Q126 116 134 104Q152 86 188 112V152H12Z" fill={colors.vocab.blue} {...INK} />
      <Path d="M12 152Q30 126 54 142Q66 150 76 138Q96 120 118 142Q130 150 140 138Q160 120 188 146V172Q188 186 174 186H26Q12 186 12 172Z" fill={colors.vocab.skyBlue} {...INK} />
      <Path d="M30 104Q40 98 50 104M92 102Q104 96 114 104M150 102Q160 98 170 106M34 168Q48 162 62 168M100 166Q114 160 128 168" stroke={colors.surface.paper} strokeWidth={6} strokeLinecap="round" fill={NONE} />
    </Card>
  );
}

function MoonArt(p: ArtProps): ReactElement {
  // Dal: a crescent moon in the night sky with stars and a small cloud across its lower horn (the full moon belongs
  // to the harvest cards, the sun to the sea and the mountain).
  return (
    <Card theme="nature" p={p}>
      <Rect x={0} y={0} width={200} height={200} rx={8} fill={colors.brand.secondaryDark} />
      <Path d="M112 24A76 76 0 1 0 176 128A60 60 0 0 1 112 24Z" fill={colors.vocab.yellow} {...INK} />
      <Path d={sparkle(148, 56, 16) + sparkle(176, 90, 10) + sparkle(36, 34, 9)} fill={colors.vocab.white} {...DET} />
      <Path d="M86 178Q78 160 96 156Q102 140 120 146Q134 136 146 150Q164 150 160 168Q160 180 146 180Z" fill={colors.brand.secondaryLight} {...INK} />
    </Card>
  );
}

// ---------------------------------------------------------------------------
// PLAY & CRAFTS
// ---------------------------------------------------------------------------

/** One yut stick: flat face up (light, `mark` adds the back-do X), or round back up (brown, with its ridge). */
function Stick({ x, y, a, flat, mark }: { x: number; y: number; a: number; flat: boolean; mark?: boolean }): ReactElement {
  return (
    <G transform={`translate(${x} ${y}) rotate(${a})`}>
      <Rect x={-40} y={-11} width={80} height={22} rx={flat ? 6 : 11} fill={flat ? colors.feedback.nudgeLight : colors.vocab.brown} {...INK} />
      {flat ? null : <Path d="M-30 -3H30" {...DET} stroke={colors.feedback.nudge} />}
      {mark ? <Path d="M-6 -5L6 5M6 -5L-6 5" {...DET} /> : null}
    </G>
  );
}

function YutnoriArt(p: ArtProps): ReactElement {
  // The yut game: the round board with its ring of stations and the cross inside, two tokens on it, and the four
  // half-round sticks thrown beside it, three flat faces up (one with the back-do mark) and one round back up.
  // [FU] The board sits at the top and the sticks lie in two pairs below it, none over the board (they crowded its
  // corner at 54 px).
  const ring = Array.from({ length: 20 }, (_, i) => (i * Math.PI) / 10);
  return (
    <Card theme="crafts" p={p}>
      <Circle cx={100} cy={64} r={54} fill={colors.feedback.nudgeLight} {...INK} />
      <Path d="M100 24V104M60 64H140" {...DET} stroke={colors.border.strong} />
      <G fill={colors.text.primary}>
        {ring.map((t) => (
          <Circle key={t} cx={100 + 40 * Math.cos(t)} cy={64 + 40 * Math.sin(t)} r={t % (Math.PI / 2) < 0.01 ? 7 : 4} />
        ))}
        {[-27, -13.5, 13.5, 27].map((d) => (
          <G key={d}>
            <Circle cx={100 + d} cy={64} r={4} />
            <Circle cx={100} cy={64 + d} r={4} />
          </G>
        ))}
        <Circle cx={100} cy={64} r={7} />
      </G>
      <Circle cx={86} cy={36} r={9} fill={colors.vocab.red} {...DET} />
      <Circle cx={128} cy={78} r={9} fill={colors.vocab.blue} {...DET} />
      <Stick x={52} y={146} a={-6} flat />
      <Stick x={148} y={146} a={6} flat mark />
      <Stick x={52} y={176} a={4} flat />
      <Stick x={148} y={176} a={-4} flat={false} />
    </Card>
  );
}

function JegiArt(p: ArtProps): ReactElement {
  // Jegi: a fan of bright paper strands rising from a brass coin with a square hole, and a kick arc.
  const strands: [number, string][] = [
    [-52, colors.vocab.red],
    [-30, colors.vocab.yellow],
    [-10, colors.vocab.blue],
    [10, colors.vocab.green],
    [30, colors.vocab.pink],
    [52, colors.vocab.orange],
  ];
  return (
    <Card theme="crafts" p={p}>
      {shadow(184, 40)}
      <Path d="M40 140Q20 90 46 52M160 140Q180 90 154 52" {...DET} stroke={colors.text.muted} fill={NONE} strokeDasharray="10 10" />
      {strands.map(([a, c]) => (
        <Path key={a} d="M100 140Q86 90 100 30Q114 90 100 140Z" fill={c} {...DET} transform={`rotate(${a} 100 140)`} />
      ))}
      <Ellipse cx={100} cy={156} rx={38} ry={16} fill={colors.hoya.fur} {...INK} />
      <Rect x={92} y={150} width={16} height={12} fill={colors.text.primary} />
    </Card>
  );
}

function KiteArt(p: ArtProps): ReactElement {
  // Bangpaeyeon: the rectangular shield kite with its round centre hole, bamboo sticks, the red circle at the top,
  // and the string.
  return (
    <Card theme="crafts" p={p}>
      <Path d="M100 162Q120 176 150 172Q170 168 188 186" {...DET} fill={NONE} />
      <Rect x={38} y={22} width={124} height={146} rx={6} fill={colors.surface.paper} {...INK} />
      <Path d="M38 22Q100 64 162 22Z" fill={colors.vocab.blue} {...DET} />
      <Path d="M100 22A20 20 0 0 1 100 62A20 20 0 0 1 100 22Z" fill={colors.vocab.red} {...DET} />
      <Path d="M100 22V168M38 22L162 168M162 22L38 168M38 94H162" stroke={colors.vocab.brown} strokeWidth={4} strokeLinecap="round" />
      <Circle cx={100} cy={102} r={24} fill={colors.surface.canvas} {...INK} />
      <Path d="M38 150H162" stroke={colors.vocab.green} strokeWidth={10} />
      <Rect x={38} y={22} width={124} height={146} rx={6} fill={NONE} {...INK} />
    </Card>
  );
}

function TopArt(p: ArtProps): ReactElement {
  // A wooden spinning top mid-spin: an orange band, the point below, motion lines either side.
  return (
    <Card theme="crafts" p={p}>
      <Ellipse cx={100} cy={176} rx={26} ry={5} fill={colors.hoya.furDark} opacity={0.3} />
      <Path d="M46 104Q34 112 30 124M36 86Q22 92 16 104M154 104Q166 112 170 124M164 86Q178 92 184 104" stroke={colors.text.muted} strokeWidth={4} strokeLinecap="round" fill={NONE} />
      <Path d="M62 52Q100 40 138 52V96Q138 132 100 166Q62 132 62 96Z" fill={colors.hoya.fur} {...INK} />
      <Path d="M62 84Q100 92 138 84V100Q100 108 62 100Z" fill={colors.brand.primary} {...DET} />
      <Rect x={92} y={34} width={16} height={14} rx={3} fill={colors.text.secondary} {...DET} />
      <Path d="M94 162L100 178L106 162Z" fill={colors.text.primary} {...DET} />
    </Card>
  );
}

function PotteryArt(p: ArtProps): ReactElement {
  // Goryeo celadon: a maebyeong vase (small mouth, broad shoulder, narrow foot) with one inlaid white crane in a
  // roundel and inlaid clouds.
  return (
    <Card theme="crafts" p={p}>
      {shadow(184, 46)}
      <Path d="M86 18H114V30Q160 40 164 82Q164 122 128 162L126 178H74L72 162Q36 122 36 82Q40 40 86 30Z" fill={colors.stage.stage7} fillOpacity={0.55} {...INK} />
      <Path d="M86 30H114" {...DET} />
      <Circle cx={100} cy={94} r={40} fill={NONE} stroke={colors.vocab.white} strokeWidth={5} />
      <G fill={colors.vocab.white} stroke={colors.vocab.black} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M112 106L138 116M84 104L68 94" />
        <Path d="M90 100Q92 64 128 58Q118 86 106 104Z" />
        <Ellipse cx={98} cy={104} rx={18} ry={9} transform="rotate(-12 98 104)" />
        <Circle cx={66} cy={92} r={5} />
      </G>
      <Path d="M54 150Q62 140 72 148M128 148Q138 140 146 150M58 62Q66 52 76 60" stroke={colors.vocab.white} strokeWidth={5} strokeLinecap="round" fill={NONE} />
    </Card>
  );
}

function GayageumArt(p: ArtProps): ReactElement {
  // The gayageum at three-quarter view: the long wooden body on a slant with its side showing, five bold strings,
  // each over its own movable bridge (anjok) in a slanting row, the fixed bridge at the head, cords coiled at the tail.
  const at = (t: number, w: number): [number, number] => [24 + 150 * t + 0.5 * w, 146 - 86 * t + 0.87 * w];
  const xy = (t: number, w: number): string => at(t, w).join(' ');
  const strings = [-24, -12, 0, 12, 24];
  return (
    <Card theme="crafts" p={p}>
      {shadow(186, 80)}
      <Path d={`M${xy(0, 36)}L${xy(1, 32)}v14L${at(0, 36)[0]} ${at(0, 36)[1] + 14}Z`} fill={colors.vocab.brown} {...INK} />
      <Path d={`M${xy(0, -36)}L${xy(1, -32)}L${xy(1, 32)}L${xy(0, 36)}Z`} fill={colors.stage.stage2} {...INK} />
      <Path d={`M${xy(0.1, -32)}L${xy(0.1, 32)}`} stroke={colors.vocab.brown} strokeWidth={8} strokeLinecap="round" />
      <Path d={strings.map((w) => `M${xy(0.1, w)}L${xy(0.88, w)}`).join('')} {...DET} strokeWidth={5} />
      {strings.map((w, i) => {
        const [x, y] = at(0.3 + 0.12 * i, w);
        return <Path key={w} d={`M${x - 9} ${y + 8}L${x} ${y - 12}L${x + 9} ${y + 8}Z`} fill={colors.vocab.white} {...DET} />;
      })}
      {strings.map((w) => {
        const [x, y] = at(0.93, w);
        return <Circle key={w} cx={x} cy={y} r={5} fill={colors.vocab.white} {...DET} />;
      })}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// FALLBACK (kept for unknown card ids)
// ---------------------------------------------------------------------------

function FallbackArt({ size, testID, accessibilityLabel }: ArtProps): ReactElement {
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200" testID={testID} accessibilityLabel={accessibilityLabel}>
      <Rect x={0} y={0} width={200} height={200} fill={colors.surface.sunken} rx={8} />
      <Circle cx={100} cy={100} r={60} fill={colors.brand.primaryLight} />
      <Circle cx={100} cy={100} r={40} fill={colors.brand.primary} opacity={0.6} />
      <Circle cx={100} cy={100} r={20} fill={colors.surface.paper} />
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

export function HeritageCardArt({
  cardId,
  size = 200,
  testID,
  accessibilityLabel,
}: HeritageCardArtProps): ReactElement {
  const label = accessibilityLabel ?? `Card art for ${cardId}`;
  const p: ArtProps = { size, testID, accessibilityLabel: label };
  switch (cardId) {
    // Letters
    case 'card:book': return <BookArt {...p} />;
    case 'card:hanji': return <HanjiArt {...p} />;
    case 'card:brush': return <BrushArt {...p} />;
    case 'card:ink': return <InkArt {...p} />;
    case 'card:origami': return <OrigamiArt {...p} />;
    case 'card:hangul-day': return <HangulDayArt {...p} />;
    // Life
    case 'card:kimchi': return <KimchiArt {...p} />;
    case 'card:rice': return <RiceArt {...p} />;
    case 'card:chopsticks': return <ChopsticksArt {...p} />;
    case 'card:hanbok': return <HanbokArt {...p} />;
    case 'card:kimbap': return <KimbapArt {...p} />;
    case 'card:family-table': return <FamilyTableArt {...p} />;
    // Rites
    case 'card:seollal': return <SeollalArt {...p} />;
    case 'card:chuseok': return <ChuseokArt {...p} />;
    case 'card:tteokguk': return <TteokgukArt {...p} />;
    case 'card:songpyeon': return <SongpyeonArt {...p} />;
    case 'card:sebae': return <SebaeArt {...p} />;
    case 'card:lantern': return <LanternArt {...p} />;
    // Nature
    case 'card:tiger': return <TigerArt {...p} />;
    case 'card:magpie': return <MagpieArt {...p} />;
    case 'card:mugunghwa': return <MugunghwaArt {...p} />;
    case 'card:mountain': return <MountainArt {...p} />;
    case 'card:sea': return <SeaArt {...p} />;
    case 'card:moon': return <MoonArt {...p} />;
    // Crafts
    case 'card:yutnori': return <YutnoriArt {...p} />;
    case 'card:jegi': return <JegiArt {...p} />;
    case 'card:kite': return <KiteArt {...p} />;
    case 'card:top': return <TopArt {...p} />;
    case 'card:pottery': return <PotteryArt {...p} />;
    case 'card:gayageum': return <GayageumArt {...p} />;
    default: return <FallbackArt {...p} />;
  }
}
