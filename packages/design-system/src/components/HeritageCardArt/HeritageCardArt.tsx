import type { ReactNode, ReactElement } from 'react';
import { Svg, Circle, Ellipse, G, Line, Path, Polygon, Rect } from 'react-native-svg';
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

function Frame({ themeKey, children }: { themeKey: keyof typeof colors.theme; children: ReactNode }): ReactElement {
  return (
    <>
      <Rect x={0} y={0} width={200} height={200} fill={colors.theme[themeKey]} opacity={0.08} rx={8} />
      {children}
    </>
  );
}

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

function BookArt({ size, testID, accessibilityLabel }: ArtProps): ReactElement {
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200" testID={testID} accessibilityLabel={accessibilityLabel}>
      <Frame themeKey="letters">
        <Ellipse cx={100} cy={155} rx={75} ry={6} fill={colors.hoya.furDark} opacity={0.2} />
        <Path
          d="M40 60 Q100 50 160 60 L160 150 Q100 140 40 150 Z"
          fill={colors.surface.paper}
          stroke={colors.text.secondary}
          strokeWidth={2.5}
          strokeLinejoin="round"
        />
        <Path d="M100 55 V145" stroke={colors.text.secondary} strokeWidth={2} />
        <Path d="M52 80 Q62 76 72 84" stroke={colors.text.primary} strokeWidth={3.5} strokeLinecap="round" fill="none" />
        <Path d="M55 100 H82" stroke={colors.text.primary} strokeWidth={3.5} strokeLinecap="round" />
        <Path d="M55 120 Q65 116 78 122" stroke={colors.text.primary} strokeWidth={3.5} strokeLinecap="round" fill="none" />
        <Path d="M118 80 Q128 76 142 84" stroke={colors.text.primary} strokeWidth={3.5} strokeLinecap="round" fill="none" />
        <Path d="M120 100 H148" stroke={colors.text.primary} strokeWidth={3.5} strokeLinecap="round" />
        <Path d="M118 120 Q130 116 144 122" stroke={colors.text.primary} strokeWidth={3.5} strokeLinecap="round" fill="none" />
      </Frame>
    </Svg>
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
  // Hangul Day: a tear-off calendar page whose big mark is three letters drawn as shapes (ㅎ, ㄱ, ㄹ), with sparkles.
  return (
    <Card theme="letters" p={p}>
      {shadow(184, 66)}
      <Rect x={34} y={34} width={132} height={144} rx={8} fill={colors.surface.paper} {...INK} />
      <Rect x={34} y={34} width={132} height={30} rx={8} fill={colors.vocab.red} {...INK} />
      <Path d="M62 24V44M138 24V44" stroke={colors.text.primary} strokeWidth={8} strokeLinecap="round" />
      <G stroke={colors.vocab.blue} strokeWidth={11} strokeLinecap="round" strokeLinejoin="round" fill={NONE}>
        <Path d="M64 82H80M52 98H92" />
        <Circle cx={72} cy={130} r={18} />
        <Path d="M108 84H148V118" />
        <Path d="M108 132H148V146H108V160H148" />
      </G>
      <Path d={sparkle(176, 76, 14) + sparkle(24, 140, 12)} fill={colors.vocab.yellow} {...DET} />
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

function RiceArt({ size, testID, accessibilityLabel }: ArtProps): ReactElement {
  // Round cream bowl with mound of white rice + 3 steam wavy lines.
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200" testID={testID} accessibilityLabel={accessibilityLabel}>
      <Frame themeKey="life">
        {/* Steam lines */}
        <G stroke={colors.text.muted} strokeWidth={2.5} fill="none" strokeLinecap="round" opacity={0.6}>
          <Path d="M70 40 Q75 50 70 60 Q65 70 70 80" />
          <Path d="M100 30 Q105 40 100 50 Q95 60 100 70" />
          <Path d="M130 40 Q135 50 130 60 Q125 70 130 80" />
        </G>
        {/* Rice mound */}
        <Path
          d="M50 110 Q60 80 100 78 Q140 80 150 110 Z"
          fill={colors.surface.paper}
          stroke={colors.text.secondary}
          strokeWidth={2}
          strokeLinejoin="round"
        />
        {/* Rice grain hints */}
        <G fill={colors.text.muted} opacity={0.4}>
          <Ellipse cx={80} cy={95} rx={2} ry={1} />
          <Ellipse cx={100} cy={88} rx={2} ry={1} />
          <Ellipse cx={120} cy={95} rx={2} ry={1} />
          <Ellipse cx={90} cy={102} rx={2} ry={1} />
          <Ellipse cx={110} cy={102} rx={2} ry={1} />
        </G>
        {/* Bowl */}
        <Path
          d="M40 110 Q40 155 100 162 Q160 155 160 110 Z"
          fill={colors.feedback.nudge}
          opacity={0.5}
          stroke={colors.text.secondary}
          strokeWidth={2.5}
          strokeLinejoin="round"
        />
        <Path d="M40 110 Q100 122 160 110" fill="none" stroke={colors.text.secondary} strokeWidth={2} />
        <Ellipse cx={100} cy={170} rx={50} ry={4} fill={colors.hoya.furDark} opacity={0.18} />
      </Frame>
    </Svg>
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

function HanbokArt({ size, testID, accessibilityLabel }: ArtProps): ReactElement {
  // Child's hanbok on a hanger: orange jeogori (top) + cream collar + blue chima (skirt).
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200" testID={testID} accessibilityLabel={accessibilityLabel}>
      <Frame themeKey="life">
        {/* Hanger hook */}
        <Path d="M100 25 Q100 35 95 38" stroke={colors.text.secondary} strokeWidth={2.5} fill="none" strokeLinecap="round" />
        {/* Hanger bar */}
        <Path d="M55 50 Q100 38 145 50" stroke={colors.text.secondary} strokeWidth={3} fill="none" strokeLinecap="round" />
        {/* Jeogori top (orange) — flared sleeves */}
        <Path
          d="M40 60 Q70 50 100 50 Q130 50 160 60 L150 78 L130 70 L130 102 Q100 108 70 102 L70 70 L50 78 Z"
          fill={colors.brand.primary}
          stroke={colors.brand.primaryDark}
          strokeWidth={2}
          strokeLinejoin="round"
        />
        {/* Cream collar */}
        <Path
          d="M85 55 L100 65 L115 55 L105 50 L95 50 Z"
          fill={colors.surface.canvas}
          stroke={colors.brand.primaryDark}
          strokeWidth={1.5}
        />
        {/* Tie ribbon */}
        <Path
          d="M95 78 Q100 82 105 78 L108 95 L92 95 Z"
          fill={colors.brand.primaryLight}
          stroke={colors.brand.primaryDark}
          strokeWidth={1.5}
        />
        {/* Chima skirt (sky blue) */}
        <Path
          d="M68 102 Q100 108 132 102 L150 170 Q100 178 50 170 Z"
          fill={colors.brand.secondary}
          stroke={colors.brand.secondaryDark}
          strokeWidth={2}
          strokeLinejoin="round"
        />
        {/* Skirt vertical pleats */}
        <G stroke={colors.brand.secondaryDark} strokeWidth={1} opacity={0.5}>
          <Line x1={80} y1={108} x2={75} y2={165} />
          <Line x1={100} y1={108} x2={100} y2={172} />
          <Line x1={120} y1={108} x2={125} y2={165} />
        </G>
      </Frame>
    </Svg>
  );
}

function KimbapArt({ size, testID, accessibilityLabel }: ArtProps): ReactElement {
  // 3 round slices arranged diagonally with seaweed + rice + orange/green centers.
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200" testID={testID} accessibilityLabel={accessibilityLabel}>
      <Frame themeKey="life">
        {/* Floor shadow */}
        <Ellipse cx={100} cy={170} rx={70} ry={5} fill={colors.hoya.furDark} opacity={0.15} />
        {/* Three slices */}
        {[
          { cx: 60, cy: 140 },
          { cx: 100, cy: 100 },
          { cx: 140, cy: 60 },
        ].map((s, i) => (
          <G key={i}>
            {/* Outer seaweed ring */}
            <Circle cx={s.cx} cy={s.cy} r={28} fill={colors.text.primary} opacity={0.85} />
            {/* Inner rice */}
            <Circle cx={s.cx} cy={s.cy} r={22} fill={colors.surface.canvas} stroke={colors.text.secondary} strokeWidth={1} />
            {/* Rice grain hints */}
            <Circle cx={s.cx - 6} cy={s.cy - 6} r={1.5} fill={colors.text.muted} opacity={0.4} />
            <Circle cx={s.cx + 6} cy={s.cy + 6} r={1.5} fill={colors.text.muted} opacity={0.4} />
            {/* Filling: orange (carrot) + green (spinach) */}
            <Circle cx={s.cx - 6} cy={s.cy + 4} r={5} fill={colors.brand.primary} />
            <Circle cx={s.cx + 6} cy={s.cy - 4} r={5} fill={colors.theme.nature} />
            {/* Yellow center (egg) */}
            <Circle cx={s.cx} cy={s.cy} r={4} fill={colors.feedback.nudge} />
          </G>
        ))}
      </Frame>
    </Svg>
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
  // Lunar New Year: a child bows deeply to a grandparent seated on a cushion, a lucky pouch on the floor between.
  return (
    <Card theme="rites" p={p}>
      <Rect x={10} y={174} width={180} height={10} rx={5} fill={colors.feedback.nudge} {...DET} />
      <G transform="translate(-6 66) scale(0.6)">
        <Bower k={0.6} />
      </G>
      <Ellipse cx={150} cy={172} rx={42} ry={10} fill={colors.vocab.red} {...INK} />
      <Path d="M112 166Q112 98 150 92Q188 98 188 166Z" fill={colors.vocab.purple} {...INK} />
      <Path d="M126 132Q150 146 174 132" {...DET} fill={NONE} />
      <Circle cx={150} cy={66} r={24} fill={colors.surface.paper} {...INK} />
      <Path d="M126 64Q128 40 150 40Q172 40 174 64Q160 52 150 54Q140 52 126 64Z" fill={colors.vocab.gray} {...DET} />
      <Circle cx={150} cy={36} r={9} fill={colors.vocab.gray} {...DET} />
      <Path d="M140 70Q143 66 146 70M154 70Q157 66 160 70M144 78Q150 84 156 78" {...DET} fill={NONE} />
      <Path d="M86 160Q86 146 96 144Q106 146 106 160Q96 166 86 160Z" fill={colors.vocab.pink} {...DET} />
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

function SongpyeonArt({ size, testID, accessibilityLabel }: ArtProps): ReactElement {
  // 3 half-moon rice cakes on pine needle bed: cream / pink / green.
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200" testID={testID} accessibilityLabel={accessibilityLabel}>
      <Frame themeKey="rites">
        {/* Pine needle bed */}
        <G stroke={colors.theme.nature} strokeWidth={2} strokeLinecap="round" opacity={0.85}>
          <Line x1={30} y1={150} x2={60} y2={140} />
          <Line x1={40} y1={155} x2={70} y2={148} />
          <Line x1={50} y1={148} x2={80} y2={155} />
          <Line x1={80} y1={155} x2={120} y2={145} />
          <Line x1={90} y1={148} x2={130} y2={158} />
          <Line x1={120} y1={150} x2={160} y2={142} />
          <Line x1={130} y1={158} x2={170} y2={150} />
        </G>
        {/* 3 half-moon rice cakes — overlapping arrangement */}
        {/* Cream */}
        <Path
          d="M40 130 Q60 90 100 110 Q90 130 70 138 Z"
          fill={colors.surface.canvas}
          stroke={colors.text.secondary}
          strokeWidth={2}
          strokeLinejoin="round"
        />
        {/* Pink */}
        <Path
          d="M85 100 Q105 65 145 90 Q135 110 115 118 Z"
          fill={colors.hoya.cheek}
          stroke={colors.brand.primaryDark}
          strokeWidth={2}
          strokeLinejoin="round"
        />
        {/* Green */}
        <Path
          d="M125 120 Q145 85 180 105 Q170 125 150 132 Z"
          fill={colors.theme.nature}
          opacity={0.85}
          stroke={colors.brand.primaryDark}
          strokeWidth={2}
          strokeLinejoin="round"
        />
        {/* Floor shadow */}
        <Ellipse cx={100} cy={172} rx={60} ry={4} fill={colors.hoya.furDark} opacity={0.15} />
      </Frame>
    </Svg>
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

function LanternArt({ size, testID, accessibilityLabel }: ArtProps): ReactElement {
  // Glowing round paper lantern + tassel + 3 smaller background lanterns.
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200" testID={testID} accessibilityLabel={accessibilityLabel}>
      <Frame themeKey="rites">
        {/* Background lanterns (decreasing opacity, smaller) */}
        <G opacity={0.6}>
          <Ellipse cx={40} cy={50} rx={16} ry={18} fill={colors.feedback.nudge} opacity={0.6} />
          <Line x1={40} y1={68} x2={40} y2={80} stroke={colors.brand.primaryDark} strokeWidth={1.5} />
        </G>
        <G opacity={0.3}>
          <Ellipse cx={160} cy={40} rx={14} ry={16} fill={colors.feedback.nudge} opacity={0.6} />
          <Line x1={160} y1={56} x2={160} y2={68} stroke={colors.brand.primaryDark} strokeWidth={1.5} />
        </G>
        <G opacity={0.15}>
          <Ellipse cx={170} cy={75} rx={12} ry={14} fill={colors.feedback.nudge} opacity={0.6} />
          <Line x1={170} y1={89} x2={170} y2={99} stroke={colors.brand.primaryDark} strokeWidth={1} />
        </G>
        {/* Main lantern */}
        {/* Glow halo */}
        <Circle cx={100} cy={100} r={50} fill={colors.feedback.nudge} opacity={0.25} />
        {/* Lantern body */}
        <Ellipse cx={100} cy={100} rx={36} ry={42} fill={colors.feedback.nudge} stroke={colors.brand.primaryDark} strokeWidth={2.5} />
        {/* Horizontal ridges */}
        <G stroke={colors.brand.primaryDark} strokeWidth={1.5} fill="none" opacity={0.7}>
          <Path d="M68 90 Q100 92 132 90" />
          <Path d="M65 100 Q100 102 135 100" />
          <Path d="M68 112 Q100 114 132 112" />
        </G>
        {/* Top cap */}
        <Rect x={88} y={56} width={24} height={6} fill={colors.text.secondary} rx={2} />
        {/* Bottom cap */}
        <Rect x={88} y={140} width={24} height={6} fill={colors.text.secondary} rx={2} />
        {/* Tassel string + ball */}
        <Line x1={100} y1={146} x2={100} y2={170} stroke={colors.text.secondary} strokeWidth={2} strokeLinecap="round" />
        <Circle cx={100} cy={174} r={5} fill={colors.brand.primary} stroke={colors.brand.primaryDark} strokeWidth={1.5} />
        {/* Tassel strands */}
        <G stroke={colors.brand.primary} strokeWidth={1.5} strokeLinecap="round">
          <Line x1={98} y1={177} x2={96} y2={184} />
          <Line x1={100} y1={177} x2={100} y2={186} />
          <Line x1={102} y1={177} x2={104} y2={184} />
        </G>
      </Frame>
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// NATURE & ANIMALS
// ---------------------------------------------------------------------------

function TigerArt({ size, testID, accessibilityLabel }: ArtProps): ReactElement {
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200" testID={testID} accessibilityLabel={accessibilityLabel}>
      <Frame themeKey="nature">
        <G fill={colors.feedback.nudge} opacity={0.9}>
          <Path d="M70 30 L74 40 L70 50 L66 40 Z" />
          <Path d="M60 40 L70 36 L80 40 L70 44 Z" />
          <Path d="M100 16 L104 28 L100 40 L96 28 Z" />
          <Path d="M88 28 L100 24 L112 28 L100 32 Z" />
          <Path d="M130 30 L134 40 L130 50 L126 40 Z" />
          <Path d="M120 40 L130 36 L140 40 L130 44 Z" />
        </G>
        <G transform="translate(36 55)">
          <Ellipse cx={64} cy={116} rx={38} ry={5} fill={colors.hoya.furDark} opacity={0.18} />
          <Path d="M22 78 Q14 60 8 46" stroke={colors.hoya.fur} strokeWidth={10} strokeLinecap="round" fill="none" />
          <Path d="M106 78 Q114 60 120 46" stroke={colors.hoya.fur} strokeWidth={10} strokeLinecap="round" fill="none" />
          <Circle cx={8} cy={46} r={7} fill={colors.hoya.fur} />
          <Circle cx={120} cy={46} r={7} fill={colors.hoya.fur} />
          <Circle cx={64} cy={64} r={44} fill={colors.hoya.fur} />
          <Circle cx={30} cy={32} r={12} fill={colors.hoya.fur} />
          <Circle cx={98} cy={32} r={12} fill={colors.hoya.fur} />
          <Circle cx={30} cy={32} r={6} fill={colors.hoya.cheek} opacity={0.85} />
          <Circle cx={98} cy={32} r={6} fill={colors.hoya.cheek} opacity={0.85} />
          <G stroke={colors.hoya.stripes} strokeWidth={3} strokeLinecap="round" fill="none">
            <Path d="M26 54 Q30 58 26 62" />
            <Path d="M24 70 Q29 73 25 78" />
            <Path d="M102 54 Q98 58 102 62" />
            <Path d="M104 70 Q99 73 103 78" />
            <Path d="M64 24 Q66 30 64 36" />
          </G>
          <Ellipse cx={64} cy={84} rx={26} ry={16} fill={colors.hoya.belly} />
          <Ellipse cx={50} cy={70} rx={4} ry={1.6} fill={colors.hoya.stripes} />
          <Ellipse cx={78} cy={70} rx={4} ry={1.6} fill={colors.hoya.stripes} />
          <Circle cx={42} cy={84} r={5} fill={colors.hoya.cheek} opacity={0.6} />
          <Circle cx={86} cy={84} r={5} fill={colors.hoya.cheek} opacity={0.6} />
          <Path d="M58 84 H70 L64 90 Z" fill={colors.hoya.nose} />
          <Path
            d="M44 92 Q60 110 76 92 Q60 100 44 92 Z"
            fill={colors.hoya.cheek}
            stroke={colors.hoya.stripes}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </G>
      </Frame>
    </Svg>
  );
}

function MagpieArt({ size, testID, accessibilityLabel }: ArtProps): ReactElement {
  // Black-and-white magpie on a leafless branch.
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200" testID={testID} accessibilityLabel={accessibilityLabel}>
      <Frame themeKey="nature">
        {/* Branch */}
        <Path
          d="M20 140 Q60 135 100 140 Q140 145 180 138"
          stroke={colors.theme.life}
          strokeWidth={6}
          fill="none"
          strokeLinecap="round"
        />
        <Path d="M60 138 Q65 130 70 125" stroke={colors.theme.life} strokeWidth={3} fill="none" strokeLinecap="round" />
        <Path d="M130 142 Q138 138 145 132" stroke={colors.theme.life} strokeWidth={3} fill="none" strokeLinecap="round" />
        {/* Body — black */}
        <Ellipse cx={100} cy={100} rx={25} ry={28} fill={colors.text.primary} stroke={colors.text.primary} strokeWidth={2} />
        {/* Belly — white */}
        <Ellipse cx={100} cy={112} rx={14} ry={16} fill={colors.surface.canvas} />
        {/* Head */}
        <Circle cx={100} cy={75} r={14} fill={colors.text.primary} />
        {/* Beak */}
        <Path d="M114 72 L124 70 L114 78 Z" fill={colors.feedback.nudge} stroke={colors.brand.primaryDark} strokeWidth={1} />
        {/* Eye — small white with black pupil */}
        <Circle cx={107} cy={72} r={3} fill={colors.surface.canvas} />
        <Circle cx={108} cy={72} r={1.5} fill={colors.text.primary} />
        {/* Long tail going down-right at angle */}
        <Path
          d="M120 120 Q140 130 158 145 L148 152 Q135 138 118 130 Z"
          fill={colors.text.primary}
          stroke={colors.text.primary}
          strokeWidth={2}
          strokeLinejoin="round"
        />
        {/* Foot */}
        <Line x1={92} y1={128} x2={88} y2={142} stroke={colors.text.muted} strokeWidth={2} strokeLinecap="round" />
        <Line x1={108} y1={128} x2={104} y2={142} stroke={colors.text.muted} strokeWidth={2} strokeLinecap="round" />
      </Frame>
    </Svg>
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

function MountainArt({ size, testID, accessibilityLabel }: ArtProps): ReactElement {
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200" testID={testID} accessibilityLabel={accessibilityLabel}>
      <Frame themeKey="nature">
        <Circle cx={120} cy={70} r={26} fill={colors.feedback.nudge} opacity={0.7} />
        <Polygon points="40,150 90,60 140,150" fill={colors.theme.nature} opacity={0.4} stroke={colors.theme.nature} strokeWidth={2} strokeLinejoin="round" />
        <Polygon points="60,160 110,80 165,160" fill={colors.theme.nature} opacity={0.7} stroke={colors.theme.nature} strokeWidth={2} strokeLinejoin="round" />
        <Polygon points="20,170 75,100 130,170" fill={colors.theme.nature} stroke={colors.brand.primaryDark} strokeWidth={2} strokeLinejoin="round" />
        <Path d="M70 110 L75 100 L82 112 L78 108 Z" fill={colors.surface.paper} opacity={0.9} />
        <Path d="M105 90 L110 80 L116 92 L112 88 Z" fill={colors.surface.paper} opacity={0.9} />
        <Rect x={0} y={170} width={200} height={30} fill={colors.theme.life} opacity={0.3} />
      </Frame>
    </Svg>
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
  const ring = Array.from({ length: 20 }, (_, i) => (i * Math.PI) / 10);
  return (
    <Card theme="crafts" p={p}>
      <Circle cx={72} cy={72} r={60} fill={colors.feedback.nudgeLight} {...INK} />
      <Path d="M72 28V116M28 72H116" {...DET} stroke={colors.border.strong} />
      <G fill={colors.text.primary}>
        {ring.map((t) => (
          <Circle key={t} cx={72 + 44 * Math.cos(t)} cy={72 + 44 * Math.sin(t)} r={t % (Math.PI / 2) < 0.01 ? 7 : 4} />
        ))}
        {[-30, -15, 15, 30].map((d) => (
          <G key={d}>
            <Circle cx={72 + d} cy={72} r={4} />
            <Circle cx={72} cy={72 + d} r={4} />
          </G>
        ))}
        <Circle cx={72} cy={72} r={7} />
      </G>
      <Circle cx={57} cy={42} r={9} fill={colors.vocab.red} {...DET} />
      <Circle cx={102} cy={87} r={9} fill={colors.vocab.blue} {...DET} />
      <Stick x={120} y={142} a={-72} flat />
      <Stick x={143} y={138} a={-72} flat mark />
      <Stick x={166} y={134} a={-72} flat />
      <Stick x={96} y={180} a={-6} flat={false} />
    </Card>
  );
}

function JegiArt({ size, testID, accessibilityLabel }: ArtProps): ReactElement {
  // Feather shuttlecock: warm-grey coin base + cream feathers radiating up + purple wrap.
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200" testID={testID} accessibilityLabel={accessibilityLabel}>
      <Frame themeKey="crafts">
        {/* Floor shadow */}
        <Ellipse cx={100} cy={170} rx={40} ry={4} fill={colors.hoya.furDark} opacity={0.18} />
        {/* Coin base */}
        <Ellipse cx={100} cy={150} rx={26} ry={10} fill={colors.text.muted} stroke={colors.text.secondary} strokeWidth={2} />
        {/* Purple wrap on top of coin */}
        <Path
          d="M82 144 Q100 134 118 144 L116 150 Q100 142 84 150 Z"
          fill={colors.theme.rites}
          stroke={colors.brand.primaryDark}
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
        {/* Feathers radiating up */}
        <G fill={colors.surface.canvas} stroke={colors.text.secondary} strokeWidth={1.5} strokeLinejoin="round">
          <Path d="M86 144 Q72 110 78 75 Q86 110 94 144 Z" />
          <Path d="M95 144 Q92 90 100 50 Q108 90 105 144 Z" />
          <Path d="M105 144 Q108 105 120 75 Q108 110 113 144 Z" />
          <Path d="M114 144 Q126 120 135 95 Q120 120 117 144 Z" />
        </G>
        {/* Subtle feather striations */}
        <G stroke={colors.text.muted} strokeWidth={0.5} fill="none">
          <Path d="M82 130 Q90 110 86 90" />
          <Path d="M100 130 Q103 100 100 70" />
          <Path d="M118 130 Q115 105 122 88" />
        </G>
      </Frame>
    </Svg>
  );
}

function KiteArt({ size, testID, accessibilityLabel }: ArtProps): ReactElement {
  // Diamond kite with central hole + tiger face + 2 tassels.
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200" testID={testID} accessibilityLabel={accessibilityLabel}>
      <Frame themeKey="crafts">
        {/* String trailing */}
        <Path d="M100 130 Q115 145 130 155 Q150 162 170 165" stroke={colors.text.secondary} strokeWidth={1.5} fill="none" strokeLinecap="round" />
        {/* Diamond kite body */}
        <Polygon
          points="100,30 150,90 100,150 50,90"
          fill={colors.surface.canvas}
          stroke={colors.brand.secondary}
          strokeWidth={3}
          strokeLinejoin="round"
        />
        {/* Horizontal + vertical cross frame */}
        <Line x1={50} y1={90} x2={150} y2={90} stroke={colors.brand.secondary} strokeWidth={2} />
        <Line x1={100} y1={30} x2={100} y2={150} stroke={colors.brand.secondary} strokeWidth={2} />
        {/* Central hole */}
        <Circle cx={100} cy={90} r={12} fill={colors.brand.secondaryLight} stroke={colors.brand.secondary} strokeWidth={2} />
        {/* Tiger face in the hole */}
        <Circle cx={100} cy={90} r={9} fill={colors.hoya.fur} />
        {/* Eyes */}
        <Circle cx={97} cy={89} r={1.5} fill={colors.hoya.stripes} />
        <Circle cx={103} cy={89} r={1.5} fill={colors.hoya.stripes} />
        {/* Nose */}
        <Path d="M98 91 H102 L100 93 Z" fill={colors.hoya.stripes} />
        {/* Tassels hanging at top */}
        <G stroke={colors.brand.primary} strokeWidth={2} strokeLinecap="round">
          <Line x1={70} y1={45} x2={62} y2={60} />
          <Line x1={66} y1={56} x2={58} y2={68} />
          <Line x1={130} y1={45} x2={138} y2={60} />
          <Line x1={134} y1={56} x2={142} y2={68} />
        </G>
      </Frame>
    </Svg>
  );
}

function TopArt({ size, testID, accessibilityLabel }: ArtProps): ReactElement {
  // Wooden spinning top mid-spin + motion lines + dancheong stripe.
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200" testID={testID} accessibilityLabel={accessibilityLabel}>
      <Frame themeKey="crafts">
        {/* Floor shadow (smaller because spinning) */}
        <Ellipse cx={100} cy={170} rx={25} ry={3} fill={colors.hoya.furDark} opacity={0.3} />
        {/* Motion lines (curves either side) */}
        <G stroke={colors.text.muted} strokeWidth={2} fill="none" opacity={0.5} strokeLinecap="round">
          <Path d="M50 110 Q40 115 35 125" />
          <Path d="M40 95 Q28 100 22 110" />
          <Path d="M150 110 Q160 115 165 125" />
          <Path d="M160 95 Q172 100 178 110" />
        </G>
        {/* Top body — cream wood */}
        <Path
          d="M70 60 Q100 50 130 60 L130 100 Q130 130 100 160 Q70 130 70 100 Z"
          fill={colors.feedback.nudge}
          stroke={colors.brand.primaryDark}
          strokeWidth={2.5}
          strokeLinejoin="round"
        />
        {/* Dancheong orange band */}
        <Path
          d="M70 90 Q100 95 130 90 L130 100 Q100 105 70 100 Z"
          fill={colors.brand.primary}
          stroke={colors.brand.primaryDark}
          strokeWidth={1.5}
        />
        {/* Top handle (small knob on top) */}
        <Rect x={94} y={55} width={12} height={10} fill={colors.text.secondary} rx={2} />
        {/* Bottom tip — small triangle */}
        <Path d="M96 158 L100 168 L104 158 Z" fill={colors.text.primary} />
      </Frame>
    </Svg>
  );
}

function PotteryArt({ size, testID, accessibilityLabel }: ArtProps): ReactElement {
  // Round-bellied celadon vase with crackle pattern + curved crane etching.
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200" testID={testID} accessibilityLabel={accessibilityLabel}>
      <Frame themeKey="crafts">
        {/* Floor shadow */}
        <Ellipse cx={100} cy={172} rx={40} ry={4} fill={colors.hoya.furDark} opacity={0.18} />
        {/* Vase shape — neck + belly */}
        <Path
          d="M85 50 Q95 48 115 50 L113 65 Q126 70 138 90 Q145 115 130 145 Q115 165 100 168 Q85 165 70 145 Q55 115 62 90 Q74 70 87 65 Z"
          fill={colors.theme.nature}
          opacity={0.7}
          stroke={colors.brand.primaryDark}
          strokeWidth={2}
          strokeLinejoin="round"
        />
        {/* Vase mouth (top opening) */}
        <Ellipse cx={100} cy={50} rx={15} ry={4} fill={colors.text.secondary} opacity={0.4} stroke={colors.brand.primaryDark} strokeWidth={2} />
        {/* Crackle pattern */}
        <G stroke={colors.text.muted} strokeWidth={0.7} fill="none" opacity={0.6}>
          <Path d="M70 90 Q80 100 75 115" />
          <Path d="M85 100 L92 130" />
          <Path d="M105 95 Q112 110 108 130" />
          <Path d="M125 105 Q128 125 120 140" />
          <Path d="M80 140 Q90 145 100 145" />
          <Path d="M75 105 H92" />
        </G>
        {/* Curved crane etching */}
        <G stroke={colors.brand.primaryDark} strokeWidth={1.5} fill="none" strokeLinecap="round" opacity={0.85}>
          {/* Body curve */}
          <Path d="M85 110 Q100 100 120 105" />
          {/* Wing arc */}
          <Path d="M90 108 Q105 95 118 100" />
          {/* Neck */}
          <Path d="M120 105 Q125 95 128 88" />
          {/* Head */}
          <Circle cx={128} cy={86} r={2.5} fill={colors.brand.primaryDark} />
          {/* Beak */}
          <Path d="M130 85 L134 84" />
          {/* Legs */}
          <Path d="M95 115 L92 125" />
          <Path d="M105 115 L102 125" />
        </G>
      </Frame>
    </Svg>
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
