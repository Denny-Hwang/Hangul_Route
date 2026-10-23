import type { ReactNode, ReactElement } from 'react';
import { Svg, Circle, Ellipse, G, Line, Path, Rect } from 'react-native-svg';
import { colors } from '../../tokens';
import { upperCellCardArtIds } from './upper-card-ids';
import type { HeritageCardArtProps } from './types';

/**
 * The upper-cell card art (F-CURR-002 §7.2, row CM-23; F-CARD-S2-001 and F-CARD-S3-001 as amended): one drawing per
 * album card of Stages 2 to 4, in the shipped geometric minhwa language of `HeritageCardArt`
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

/** True for a card id this module draws. */
export const hasUpperCellArt = (cardId: string): boolean => upperCellCardArtIds.includes(cardId);

/** The drawings by card id; `upperCellCardArtIds` lists the same fifteen. */
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
    default: return null;
  }
}
