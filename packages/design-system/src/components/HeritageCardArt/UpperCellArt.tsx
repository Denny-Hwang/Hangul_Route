import type { ReactNode, ReactElement } from 'react';
import { Svg, Circle, Ellipse, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { colors } from '../../tokens';
import { albumLegendArtIds, upperCellCardArtIds } from './upper-card-ids';
import type { HeritageCardArtProps } from './types';

/**
 * The upper-cell card art (F-CURR-002 §7.2, row CM-23; F-CARD-S2-001 and F-CARD-S3-001 as amended): one drawing per
 * album card of Stages 2 to 7 and per album legendary card, in the shipped geometric minhwa language of `HeritageCardArt`
 * (design/brief/illustrations/heritage-card-art.md): rounded primitives, a ~3 px stroke, at most five colours from
 * the theme tint, the brand and cream, every face smiling, theme tokens only. A sibling of `HeritageCardArt.tsx`,
 * never exported by the package barrel: the app loads it in its own chunk by this file's path
 * (`@hangul-route/design-system/src/components/HeritageCardArt/UpperCellArt`), so the start bundle carries none of
 * these drawings. The ids are `upperCellCardArtIds`
 * (`card-ids.ts`, pure).
 */

type ThemeKey = keyof typeof colors.theme;

interface ArtProps {
  size: number;
  testID?: string;
  accessibilityLabel: string;
}

function Card({ theme, p, children }: { theme: ThemeKey; p: ArtProps; children: ReactNode }): ReactElement {
  return (
    <Svg width={p.size} height={p.size} viewBox="0 0 200 200" testID={p.testID} accessibilityLabel={p.accessibilityLabel}>
      <Rect x={0} y={0} width={200} height={200} fill={colors.theme[theme]} opacity={0.08} rx={8} />
      {children}
    </Svg>
  );
}

const shadow = (cy: number, rx: number): ReactElement => (
  <Ellipse cx={100} cy={cy} rx={rx} ry={5} fill={colors.hoya.furDark} opacity={0.18} />
);

// ---- Stage 2 ------------------------------------------------------------------------------------------

function NoraeArt(p: ArtProps): ReactElement {
  // Song: two beamed notes rising over three soft sound waves.
  return (
    <Card theme="letters" p={p}>
      <G stroke={colors.theme.letters} strokeWidth={3} fill="none" strokeLinecap="round" opacity={0.6}>
        <Path d="M30 150 Q60 130 90 150 T150 150" />
        <Path d="M40 166 Q70 148 100 166 T160 166" />
      </G>
      <Path d="M78 58 L138 44 L138 112" stroke={colors.text.primary} strokeWidth={5} fill="none" strokeLinejoin="round" />
      <Path d="M78 58 L78 126" stroke={colors.text.primary} strokeWidth={5} strokeLinecap="round" />
      <Ellipse cx={66} cy={128} rx={15} ry={11} fill={colors.brand.primary} stroke={colors.brand.primaryDark} strokeWidth={2.5} />
      <Ellipse cx={126} cy={114} rx={15} ry={11} fill={colors.brand.primary} stroke={colors.brand.primaryDark} strokeWidth={2.5} />
      <Circle cx={160} cy={60} r={4} fill={colors.feedback.nudge} />
      <Circle cx={44} cy={70} r={3} fill={colors.feedback.nudge} />
    </Card>
  );
}

function DosirakArt(p: ArtProps): ReactElement {
  // Lunch box: an open box with rice, a rolled egg and greens, the lid leaning behind.
  return (
    <Card theme="life" p={p}>
      {shadow(166, 70)}
      <Rect x={44} y={38} width={112} height={44} rx={10} fill={colors.brand.secondaryLight} stroke={colors.brand.secondaryDark} strokeWidth={2.5} />
      <Rect x={32} y={78} width={136} height={84} rx={12} fill={colors.surface.paper} stroke={colors.text.secondary} strokeWidth={3} />
      <Line x1={100} y1={84} x2={100} y2={156} stroke={colors.text.secondary} strokeWidth={2.5} />
      <G fill={colors.surface.canvas} stroke={colors.text.muted} strokeWidth={1.5}>
        <Circle cx={56} cy={104} r={9} />
        <Circle cx={76} cy={104} r={9} />
        <Circle cx={56} cy={134} r={9} />
        <Circle cx={76} cy={134} r={9} />
      </G>
      <Rect x={110} y={92} width={48} height={24} rx={8} fill={colors.feedback.nudge} stroke={colors.hoya.furDark} strokeWidth={2} />
      <Path d="M112 140 Q124 124 134 140 Q146 124 156 140 Z" fill={colors.theme.nature} />
    </Card>
  );
}

function BokjumeoniArt(p: ArtProps): ReactElement {
  // Lucky pouch: a round silk pouch gathered at the top with a tie cord, a few grains beside it.
  return (
    <Card theme="rites" p={p}>
      {shadow(170, 56)}
      <Path
        d="M62 78 Q40 120 58 152 Q100 176 142 152 Q160 120 138 78 Z"
        fill={colors.theme.rites}
        stroke={colors.text.secondary}
        strokeWidth={3}
        strokeLinejoin="round"
      />
      <Path d="M70 78 Q100 64 130 78 L124 88 Q100 80 76 88 Z" fill={colors.brand.primary} stroke={colors.brand.primaryDark} strokeWidth={2} />
      <Path d="M100 76 Q86 50 70 44 M100 76 Q114 50 130 44" stroke={colors.feedback.nudge} strokeWidth={3.5} fill="none" strokeLinecap="round" />
      <Circle cx={100} cy={124} r={16} fill={colors.feedback.nudgeLight} stroke={colors.feedback.nudge} strokeWidth={2.5} />
      <Path d="M92 124 H108 M100 116 V132" stroke={colors.hoya.furDark} strokeWidth={2.5} strokeLinecap="round" />
      <G fill={colors.feedback.nudge}>
        <Ellipse cx={156} cy={162} rx={4} ry={3} />
        <Ellipse cx={166} cy={156} rx={4} ry={3} />
      </G>
    </Card>
  );
}

function ByeolArt(p: ArtProps): ReactElement {
  // Star: one big rounded five-point star with two small twinkles on a dusk sky.
  return (
    <Card theme="nature" p={p}>
      <Rect x={0} y={0} width={200} height={200} rx={8} fill={colors.theme.rites} opacity={0.14} />
      <Path
        d="M100 34 L118 78 L164 80 L128 108 L140 154 L100 128 L60 154 L72 108 L36 80 L82 78 Z"
        fill={colors.feedback.nudge}
        stroke={colors.hoya.furDark}
        strokeWidth={3}
        strokeLinejoin="round"
      />
      <Circle cx={88} cy={100} r={4} fill={colors.text.primary} />
      <Circle cx={112} cy={100} r={4} fill={colors.text.primary} />
      <Path d="M90 114 Q100 122 110 114" stroke={colors.text.primary} strokeWidth={3} fill="none" strokeLinecap="round" />
      <G fill={colors.surface.canvas}>
        <Path d="M40 40 L43 48 L40 56 L37 48 Z" />
        <Path d="M164 150 L167 158 L164 166 L161 158 Z" />
      </G>
    </Card>
  );
}

function SwingArt(p: ArtProps): ReactElement {
  // Swing: a seat on two ropes hung from a willow branch, swung forward.
  return (
    <Card theme="crafts" p={p}>
      {shadow(176, 50)}
      <Path d="M24 40 Q100 22 176 40" stroke={colors.hoya.furDark} strokeWidth={8} fill="none" strokeLinecap="round" />
      <G stroke={colors.theme.nature} strokeWidth={3} strokeLinecap="round" fill="none">
        <Path d="M40 40 Q36 70 44 96" />
        <Path d="M160 40 Q166 70 158 96" />
        <Path d="M56 36 Q54 58 60 76" />
      </G>
      <G stroke={colors.text.secondary} strokeWidth={3} strokeLinecap="round">
        <Line x1={84} y1={34} x2={112} y2={142} />
        <Line x1={118} y1={34} x2={146} y2={136} />
      </G>
      <Rect x={100} y={134} width={56} height={12} rx={5} fill={colors.brand.primary} stroke={colors.brand.primaryDark} strokeWidth={2} transform="rotate(-8 128 140)" />
      <G stroke={colors.theme.crafts} strokeWidth={2.5} strokeLinecap="round" opacity={0.6}>
        <Path d="M70 150 Q80 158 92 160" fill="none" />
        <Path d="M64 132 Q74 142 88 146" fill="none" />
      </G>
    </Card>
  );
}

// ---- Stage 3 ------------------------------------------------------------------------------------------

function HangeulArt(p: ArtProps): ReactElement {
  // Hangeul: an open page with the shapes of ㅎ, ㄱ and ㅡ drawn as bold strokes.
  return (
    <Card theme="letters" p={p}>
      {shadow(168, 70)}
      <Path
        d="M30 56 Q100 44 170 56 L170 156 Q100 146 30 156 Z"
        fill={colors.surface.paper}
        stroke={colors.text.secondary}
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
      <Path d="M100 50 V150" stroke={colors.text.secondary} strokeWidth={2} />
      <G stroke={colors.brand.primary} strokeWidth={6} strokeLinecap="round" fill="none">
        <Path d="M58 72 H74" />
        <Path d="M50 84 H82" />
        <Circle cx={66} cy={108} r={12} />
        <Path d="M116 76 H150 V112" />
        <Path d="M116 132 H152" />
      </G>
    </Card>
  );
}

function TteokArt(p: ArtProps): ReactElement {
  // Rice cake: a plate of soft rounded tteok, white, green and amber.
  return (
    <Card theme="life" p={p}>
      {shadow(160, 72)}
      <Ellipse cx={100} cy={136} rx={74} ry={22} fill={colors.surface.paper} stroke={colors.text.secondary} strokeWidth={3} />
      <G stroke={colors.text.muted} strokeWidth={2}>
        <Rect x={46} y={98} width={36} height={30} rx={12} fill={colors.surface.canvas} />
        <Rect x={84} y={90} width={36} height={34} rx={12} fill={colors.theme.nature} opacity={0.85} />
        <Rect x={122} y={98} width={36} height={30} rx={12} fill={colors.feedback.nudge} />
        <Rect x={66} y={70} width={34} height={28} rx={12} fill={colors.surface.canvas} />
        <Rect x={102} y={68} width={34} height={28} rx={12} fill={colors.brand.primaryLight} />
      </G>
      <G fill={colors.hoya.furDark} opacity={0.6}>
        <Circle cx={80} cy={82} r={1.8} />
        <Circle cx={116} cy={80} r={1.8} />
        <Circle cx={60} cy={110} r={1.8} />
      </G>
    </Card>
  );
}

function FullMoonArt(p: ArtProps): ReactElement {
  // Full moon: a big round moon rising over two low hills on a holiday night.
  return (
    <Card theme="rites" p={p}>
      <Rect x={0} y={0} width={200} height={200} rx={8} fill={colors.theme.rites} opacity={0.18} />
      <Circle cx={100} cy={86} r={58} fill={colors.feedback.nudge} opacity={0.25} />
      <Circle cx={100} cy={86} r={46} fill={colors.feedback.nudgeLight} stroke={colors.feedback.nudge} strokeWidth={3} />
      <Path d="M0 160 Q50 120 100 150 Q150 118 200 156 L200 192 Q200 200 192 200 L8 200 Q0 200 0 192 Z" fill={colors.theme.nature} opacity={0.75} />
      <Path d="M0 176 Q60 150 120 172 Q160 160 200 172" stroke={colors.feedback.success} strokeWidth={3} fill="none" opacity={0.6} />
      <G fill={colors.surface.canvas}>
        <Circle cx={36} cy={40} r={2.5} />
        <Circle cx={170} cy={34} r={2} />
        <Circle cx={162} cy={110} r={1.8} />
      </G>
    </Card>
  );
}

function GomArt(p: ArtProps): ReactElement {
  // Bear: a round black bear, smiling, with the white half-moon mark on its chest.
  return (
    <Card theme="nature" p={p}>
      <Ellipse cx={100} cy={160} rx={62} ry={34} fill={colors.text.primary} />
      <Path d="M70 150 Q100 170 130 150 Q100 160 70 150 Z" fill={colors.surface.canvas} stroke={colors.surface.canvas} strokeWidth={5} strokeLinejoin="round" />
      <Circle cx={64} cy={40} r={16} fill={colors.text.primary} />
      <Circle cx={136} cy={40} r={16} fill={colors.text.primary} />
      <Circle cx={100} cy={80} r={48} fill={colors.text.primary} />
      <Ellipse cx={100} cy={98} rx={22} ry={16} fill={colors.text.secondary} />
      <Ellipse cx={100} cy={90} rx={8} ry={5} fill={colors.surface.canvas} opacity={0.35} />
      <Circle cx={82} cy={72} r={5} fill={colors.surface.canvas} />
      <Circle cx={118} cy={72} r={5} fill={colors.surface.canvas} />
      <Path d="M90 104 Q100 112 110 104" stroke={colors.surface.canvas} strokeWidth={3} fill="none" strokeLinecap="round" />
    </Card>
  );
}

function YutArt(p: ArtProps): ReactElement {
  // Yut sticks: four sticks standing in a fan, three flat faces and one round back.
  return (
    <Card theme="crafts" p={p}>
      {shadow(172, 60)}
      {[-24, -8, 8, 24].map((angle, i) => (
        <G key={angle} transform={`rotate(${angle} 100 164)`}>
          <Rect
            x={90}
            y={44}
            width={20}
            height={118}
            rx={i === 3 ? 10 : 5}
            fill={i === 3 ? colors.hoya.fur : colors.surface.canvas}
            stroke={colors.text.secondary}
            strokeWidth={2.5}
          />
          {i === 3 ? null : <Path d="M95 70 L105 76 M95 100 L105 106 M95 130 L105 136" stroke={colors.brand.primary} strokeWidth={2.5} strokeLinecap="round" />}
        </G>
      ))}
    </Card>
  );
}

// ---- Stage 4 ------------------------------------------------------------------------------------------
// F-CARD-S4-001 3.2 as amended: each card is a moment of a talk, two round friends facing each other with speech
// bubbles in the HoyaBubble language (cream fill, sky-blue border, never red).

/** A round friend standing at `x`: ears, a head with a smiling face, and a body in its `fur` colour. */
function Pal({ x, fur }: { x: number; fur: string }): ReactElement {
  return (
    <G>
      <Ellipse cx={x} cy={164} rx={26} ry={22} fill={fur} />
      <Circle cx={x - 19} cy={92} r={9} fill={fur} />
      <Circle cx={x + 19} cy={92} r={9} fill={fur} />
      <Circle cx={x} cy={116} r={28} fill={fur} />
      <Circle cx={x - 9} cy={112} r={3.5} fill={colors.text.primary} />
      <Circle cx={x + 9} cy={112} r={3.5} fill={colors.text.primary} />
      <Path d={`M${x - 8} 124 Q${x} 132 ${x + 8} 124`} stroke={colors.text.primary} strokeWidth={3} fill="none" strokeLinecap="round" />
    </G>
  );
}

/** A speech bubble at `x`, `w` wide, its tail pointing down at `tx`; `children` is the drawn word inside. */
function Bubble({ x, w, tx, children }: { x: number; w: number; tx: number; children?: ReactNode }): ReactElement {
  return (
    <G>
      <Path d={`M${tx - 7} 66 L${tx} 84 L${tx + 8} 66 Z`} fill={colors.surface.canvas} stroke={colors.brand.secondary} strokeWidth={2.5} strokeLinejoin="round" />
      <Rect x={x} y={22} width={w} height={48} rx={16} fill={colors.surface.canvas} stroke={colors.brand.secondary} strokeWidth={2.5} />
      {children}
    </G>
  );
}

/** The two friends of every Stage 4 card: Hoya's gold on the left, a blue friend on the right. */
const pair = (
  <>
    <Pal x={58} fur={colors.hoya.fur} />
    <Pal x={142} fur={colors.hoya.furBlue} />
  </>
);

/** A question mark drawn in a bubble centred on `x`. */
const ask = (x: number): ReactElement => (
  <G>
    <Path d={`M${x - 9} 37 Q${x - 9} 29 ${x} 29 Q${x + 9} 29 ${x + 9} 37 Q${x + 9} 44 ${x} 47 V52`} stroke={colors.brand.primary} strokeWidth={4} fill="none" strokeLinecap="round" />
    <Circle cx={x} cy={60} r={2.5} fill={colors.brand.primary} />
  </G>
);

function MwoyeyoArt(p: ArtProps): ReactElement {
  // What is this?: one friend asks, the other names a thing; the answer bubble holds an eraser.
  return (
    <Card theme="letters" p={p}>
      {pair}
      <Bubble x={22} w={72} tx={56}>{ask(58)}</Bubble>
      <Bubble x={106} w={72} tx={144}>
        <Rect x={124} y={36} width={36} height={20} rx={5} fill={colors.hoya.furBlue} stroke={colors.brand.secondary} strokeWidth={2.5} />
        <Line x1={138} y1={36} x2={138} y2={56} stroke={colors.brand.secondary} strokeWidth={2.5} />
      </Bubble>
    </Card>
  );
}

function MasisseoyoArt(p: ArtProps): ReactElement {
  // It is tasty: a steaming bowl between the friends; one asks how it tastes, the other answers with a heart.
  return (
    <Card theme="life" p={p}>
      {pair}
      <Path d="M76 160 H124 Q122 184 100 184 Q78 184 76 160 Z" fill={colors.surface.paper} stroke={colors.text.secondary} strokeWidth={3} strokeLinejoin="round" />
      <Path d="M92 152 Q88 146 92 140 M108 152 Q104 146 108 140" stroke={colors.text.muted} strokeWidth={2.5} fill="none" strokeLinecap="round" />
      <Bubble x={22} w={72} tx={56}>{ask(58)}</Bubble>
      <Bubble x={106} w={72} tx={144}>
        <Path d="M142 60 L128 46 Q124 34 134 34 Q140 34 142 41 Q144 34 150 34 Q160 34 156 46 Z" fill={colors.brand.primary} stroke={colors.brand.primaryDark} strokeWidth={2} strokeLinejoin="round" />
      </Bubble>
    </Card>
  );
}

function InsaArt(p: ArtProps): ReactElement {
  // Greeting: the two friends bow a little toward each other, a warm hello in each bubble.
  return (
    <Card theme="rites" p={p}>
      <G transform="rotate(8 58 186)">
        <Pal x={58} fur={colors.hoya.fur} />
      </G>
      <G transform="rotate(-8 142 186)">
        <Pal x={142} fur={colors.hoya.furBlue} />
      </G>
      {(
        [
          [22, 62],
          [106, 138],
        ] as const
      ).map(([x, tx]) => (
        <Bubble key={x} x={x} w={72} tx={tx}>
          <Circle cx={x + 36} cy={46} r={11} fill={colors.feedback.nudgeLight} stroke={colors.feedback.nudge} strokeWidth={2.5} />
          <Path d={`M${x + 31} 47 Q${x + 36} 52 ${x + 41} 47`} stroke={colors.hoya.furDark} strokeWidth={2.5} fill="none" strokeLinecap="round" />
        </Bubble>
      ))}
    </Card>
  );
}

/** A raindrop with its tip at (x, y). */
const drop = (x: number, y: number, fill: string): ReactElement => (
  <Path key={`${x}-${y}`} d={`M${x} ${y} Q${x + 6} ${y + 9} ${x} ${y + 12} Q${x - 6} ${y + 9} ${x} ${y} Z`} fill={fill} />
);

function BigaWayoArt(p: ArtProps): ReactElement {
  // It is raining: rain falls behind the friends; one says it rains, the other answers with a little house.
  return (
    <Card theme="nature" p={p}>
      {(
        [
          [30, 88],
          [100, 80],
          [170, 92],
          [100, 116],
        ] as const
      ).map(([x, y]) => drop(x, y, colors.brand.secondary))}
      {pair}
      <Bubble x={22} w={72} tx={56}>
        {drop(44, 32, colors.brand.secondary)}
        {drop(58, 40, colors.brand.secondary)}
        {drop(72, 32, colors.brand.secondary)}
      </Bubble>
      <Bubble x={106} w={72} tx={144}>
        <Path d="M128 44 L142 32 L156 44 M132 42 V58 H152 V42 M139 58 V50 H145 V58" stroke={colors.brand.primary} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </Bubble>
    </Card>
  );
}

function GachiArt(p: ArtProps): ReactElement {
  // Shall we do it together?: a ball between the friends; one asks, the other answers with a bright star.
  return (
    <Card theme="crafts" p={p}>
      {pair}
      <Circle cx={100} cy={172} r={14} fill={colors.brand.primary} stroke={colors.brand.primaryDark} strokeWidth={2.5} />
      <Path d="M88 166 Q100 174 112 166" stroke={colors.surface.canvas} strokeWidth={2.5} fill="none" strokeLinecap="round" />
      <Bubble x={22} w={72} tx={56}>{ask(58)}</Bubble>
      <Bubble x={106} w={72} tx={144}>
        <Path d="M142 31 L146 41 L157 42 L149 49 L151 60 L142 54 L133 60 L135 49 L127 42 L138 41 Z" fill={colors.feedback.nudge} stroke={colors.hoya.furDark} strokeWidth={2} strokeLinejoin="round" />
      </Bubble>
    </Card>
  );
}

// ---- Stages 6-7 ----------------------------------------------------------------------------------------
// F-CARD-S6-001 and F-CARD-S7-001 as amended (row CM-23 part 3): a Stage 6 card is a thing read in the world, with its
// Korean drawn in it (a menu, a call, a ticket, a sign, a price card; amounts are round practice amounts in won); a
// Stage 7 card is writing: the word as a word-bank tile over a ruled page with a sentence the cell builds from its bank.

/** Korean (or a sign) drawn in a picture, centred on `x`. */
const word = (x: number, y: number, text: string, size = 18, fill: string = colors.text.primary): ReactElement => (
  <SvgText x={x} y={y} fontSize={size} fontWeight="700" fill={fill} textAnchor="middle">
    {text}
  </SvgText>
);

function WonArt(p: ArtProps): ReactElement {
  // Won: a menu board of two dishes and their prices, a won coin at its corner.
  return (
    <Card theme="letters" p={p}>
      {shadow(178, 70)}
      <Rect x={30} y={36} width={140} height={132} rx={12} fill={colors.surface.paper} stroke={colors.text.secondary} strokeWidth={3} />
      <Rect x={30} y={36} width={140} height={26} rx={12} fill={colors.theme.letters} />
      {word(100, 98, '김밥 이천 원')}
      {word(100, 132, '라면 삼천 원')}
      <Circle cx={160} cy={160} r={20} fill={colors.feedback.nudge} stroke={colors.hoya.furDark} strokeWidth={2.5} />
      {word(160, 167, '₩', 20, colors.hoya.furDark)}
    </Card>
  );
}

function YeogiyoArt(p: ArtProps): ReactElement {
  // Over here!: a friend at a table raises a paw and calls the server.
  return (
    <Card theme="life" p={p}>
      <Pal x={64} fur={colors.hoya.fur} />
      <Circle cx={100} cy={96} r={10} fill={colors.hoya.fur} />
      <Rect x={20} y={166} width={160} height={14} rx={6} fill={colors.hoya.furDark} />
      <Path d="M120 166 H164 Q162 146 142 146 Q122 146 120 166 Z" fill={colors.surface.paper} stroke={colors.text.secondary} strokeWidth={2.5} />
      <Bubble x={96} w={88} tx={112}>{word(140, 54, '여기요!')}</Bubble>
    </Card>
  );
}

function GichapyoArt(p: ArtProps): ReactElement {
  // Train ticket: a ticket with its stations and its time, a notch at each side.
  return (
    <Card theme="rites" p={p}>
      {shadow(160, 74)}
      <Path
        d="M26 54 H174 V86 A12 12 0 0 0 174 110 V146 H26 V110 A12 12 0 0 0 26 86 Z"
        fill={colors.surface.paper}
        stroke={colors.theme.rites}
        strokeWidth={3}
        strokeLinejoin="round"
      />
      {word(100, 82, '기차표', 16, colors.theme.rites)}
      {word(100, 112, '서울 → 부산', 20)}
      {word(100, 136, '두 시', 16, colors.text.secondary)}
    </Card>
  );
}

function JeongsangArt(p: ArtProps): ReactElement {
  // Summit: a trail sign before a green mountain, its board pointing up to the top.
  return (
    <Card theme="nature" p={p}>
      <Path d="M0 170 L84 52 L130 108 L150 86 L200 150 V192 Q200 200 192 200 H8 Q0 200 0 192 Z" fill={colors.theme.nature} opacity={0.8} />
      <Rect x={96} y={96} width={8} height={90} rx={3} fill={colors.hoya.furDark} />
      <Path d="M44 104 H140 L156 120 L140 136 H44 Z" fill={colors.surface.paper} stroke={colors.hoya.furDark} strokeWidth={3} strokeLinejoin="round" />
      {word(94, 127, '정상 ↑', 20)}
      {word(56, 176, '한 시간', 16, colors.surface.canvas)}
    </Card>
  );
}

function DeomArt(p: ArtProps): ReactElement {
  // A little extra: a market price card for three apples, and one more apple added beside them.
  return (
    <Card theme="crafts" p={p}>
      {shadow(176, 70)}
      <Rect x={30} y={30} width={140} height={64} rx={10} fill={colors.surface.paper} stroke={colors.text.secondary} strokeWidth={3} />
      {word(100, 58, '사과 세 개')}
      {word(100, 84, '이천 원', 18, colors.brand.primary)}
      {[56, 92, 128].map((x) => (
        <Circle key={x} cx={x} cy={146} r={17} fill={colors.brand.primary} stroke={colors.brand.primaryDark} strokeWidth={2} />
      ))}
      <Circle cx={164} cy={150} r={13} fill={colors.brand.primary} stroke={colors.brand.primaryDark} strokeWidth={2} />
      {word(164, 126, '덤', 16, colors.feedback.success)}
    </Card>
  );
}

/** Stage 7: the word as a word-bank tile, over a ruled page with the cell's sentence written on it. */
function Page({ theme, p, tile, line, children }: { theme: ThemeKey; p: ArtProps; tile: string; line: string; children?: ReactNode }): ReactElement {
  return (
    <Card theme={theme} p={p}>
      {shadow(184, 72)}
      <Rect x={14} y={88} width={172} height={90} rx={8} fill={colors.surface.paper} stroke={colors.text.secondary} strokeWidth={2.5} />
      <G stroke={colors.brand.secondaryLight} strokeWidth={2}>
        <Line x1={26} y1={136} x2={174} y2={136} />
        <Line x1={26} y1={162} x2={174} y2={162} />
      </G>
      {/* A Hangul syllable is about one font size wide: a long sentence gets a smaller size so it stays on the page. */}
      {word(100, 130, line, Math.min(16, Math.floor(150 / line.length)), colors.brand.secondaryDark)}
      <Rect x={58} y={30} width={84} height={40} rx={12} fill={colors.surface.canvas} stroke={colors.brand.secondary} strokeWidth={3} />
      {word(100, 57, tile, 20)}
      {children}
    </Card>
  );
}

function IreumArt(p: ArtProps): ReactElement {
  // Name: Hoya's name, written the way the cell's word bank builds it.
  return <Page theme="letters" p={p} tile="이름" line="제 이름은 호야예요." />;
}

function AchimArt(p: ArtProps): ReactElement {
  // Morning: the sun rises at the tile's side; Hoya's morning written below.
  return (
    <Page theme="life" p={p} tile="아침" line="아침에 빵을 먹어요.">
      <Circle cx={168} cy={44} r={14} fill={colors.feedback.nudge} />
    </Page>
  );
}

function SaengilArt(p: ArtProps): ReactElement {
  // Birthday: a small cake with a candle beside the tile; the day written below.
  return (
    <Page theme="rites" p={p} tile="생일" line="생일에 케이크를 먹었어요.">
      <Rect x={152} y={48} width={34} height={22} rx={5} fill={colors.brand.primaryLight} stroke={colors.brand.primary} strokeWidth={2} />
      <Path d="M169 48 V38" stroke={colors.brand.primary} strokeWidth={3} strokeLinecap="round" />
    </Page>
  );
}

function TokkiArt(p: ArtProps): ReactElement {
  // Rabbit: two long ears peek over the tile; the sentence about it below.
  return (
    <Page theme="nature" p={p} tile="토끼" line="토끼는 작아요.">
      <G fill={colors.surface.canvas} stroke={colors.text.muted} strokeWidth={2.5}>
        <Ellipse cx={86} cy={22} rx={7} ry={16} />
        <Ellipse cx={114} cy={22} rx={7} ry={16} />
      </G>
    </Page>
  );
}

function BihaenggiArt(p: ArtProps): ReactElement {
  // Plane: a folded paper plane flies past the tile; the folding step written below.
  return (
    <Page theme="crafts" p={p} tile="비행기" line="비행기를 접어요.">
      <Path d="M150 52 L192 36 L168 74 L162 60 Z" fill={colors.surface.paper} stroke={colors.brand.secondary} strokeWidth={2.5} strokeLinejoin="round" />
    </Page>
  );
}

// ---- The album legendary cards (row CM-23 part 3) --------------------------------------------------------
// Each in a gold frame of the legendary rarity token, its Korean name on a label, one emblem of its album.

function Legend({ theme, p, name, children }: { theme: ThemeKey; p: ArtProps; name: string; children: ReactNode }): ReactElement {
  return (
    <Card theme={theme} p={p}>
      <Rect x={8} y={8} width={184} height={184} rx={12} fill="none" stroke={colors.rarity.legendary} strokeWidth={4} />
      {children}
      <Rect x={44} y={150} width={112} height={32} rx={10} fill={colors.surface.paper} stroke={colors.rarity.legendary} strokeWidth={2.5} />
      {word(100, 172, name, 18)}
    </Card>
  );
}

function HunminjeongeumArt(p: ArtProps): ReactElement {
  // Hunminjeongeum: a stitch-bound book with its title strip, a ㅎ on its cover.
  return (
    <Legend theme="letters" p={p} name="훈민정음">
      <Rect x={58} y={26} width={84} height={114} rx={6} fill={colors.brand.secondaryLight} stroke={colors.brand.secondaryDark} strokeWidth={3} />
      <G fill={colors.brand.secondaryDark}>
        {[40, 62, 84, 106, 126].map((y) => (
          <Circle key={y} cx={68} cy={y} r={2.5} />
        ))}
      </G>
      <Rect x={98} y={36} width={30} height={60} rx={3} fill={colors.surface.paper} stroke={colors.brand.secondaryDark} strokeWidth={2} />
      <G stroke={colors.brand.primary} strokeWidth={4} strokeLinecap="round" fill="none">
        <Path d="M108 48 H118 M104 56 H122" />
        <Circle cx={113} cy={74} r={8} />
      </G>
    </Legend>
  );
}

function JangArt(p: ArtProps): ReactElement {
  // Jang making: three round onggi jars in a row on a stone terrace, lids on.
  return (
    <Legend theme="life" p={p} name="장 담그기">
      <Rect x={22} y={124} width={156} height={14} rx={5} fill={colors.surface.sunken} stroke={colors.text.muted} strokeWidth={2} />
      {(
        [
          [52, 20],
          [100, 26],
          [148, 20],
        ] as const
      ).map(([x, r]) => (
        <G key={x}>
          <Ellipse cx={x} cy={124 - r} rx={r} ry={r} fill={colors.hoya.furDark} stroke={colors.text.secondary} strokeWidth={2.5} />
          <Ellipse cx={x} cy={124 - 2 * r + 2} rx={r * 0.6} ry={5} fill={colors.text.secondary} />
        </G>
      ))}
    </Legend>
  );
}

function HangawiArt(p: ArtProps): ReactElement {
  // Hangawi: a full harvest moon over a plate of half-moon songpyeon.
  return (
    <Legend theme="rites" p={p} name="한가위">
      <Circle cx={100} cy={64} r={40} fill={colors.feedback.nudgeLight} stroke={colors.feedback.nudge} strokeWidth={3} />
      <Ellipse cx={100} cy={128} rx={52} ry={12} fill={colors.surface.paper} stroke={colors.text.secondary} strokeWidth={2.5} />
      {[74, 100, 126].map((x, i) => (
        <Path key={x} d={`M${x - 12} 124 Q${x} 104 ${x + 12} 124 Z`} fill={i === 1 ? colors.theme.nature : colors.surface.canvas} stroke={colors.text.muted} strokeWidth={2} />
      ))}
    </Legend>
  );
}

function JirisanArt(p: ArtProps): ReactElement {
  // Jirisan: long ridges one behind another, the sun over the highest peak.
  return (
    <Legend theme="nature" p={p} name="지리산">
      <Circle cx={140} cy={44} r={14} fill={colors.feedback.nudge} />
      <Path d="M12 120 Q56 52 100 92 Q136 40 188 110 V140 H12 Z" fill={colors.theme.nature} opacity={0.55} />
      <Path d="M12 140 Q60 92 108 124 Q150 92 188 128 V148 H12 Z" fill={colors.feedback.success} />
    </Legend>
  );
}

function SsireumArt(p: ArtProps): ReactElement {
  // Ssireum: two friends lean in and hold each other's cloth belt in a round sand ring.
  return (
    <Legend theme="crafts" p={p} name="씨름">
      <Ellipse cx={100} cy={136} rx={82} ry={14} fill={colors.feedback.nudge} opacity={0.3} />
      <G transform="rotate(10 58 186) translate(0 -46)">
        <Pal x={64} fur={colors.hoya.fur} />
      </G>
      <G transform="rotate(-10 142 186) translate(0 -46)">
        <Pal x={136} fur={colors.hoya.furBlue} />
      </G>
      <Rect x={58} y={112} width={84} height={8} rx={4} fill={colors.brand.primary} />
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
