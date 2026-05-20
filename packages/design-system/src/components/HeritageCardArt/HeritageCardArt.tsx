import React from 'react';
import Svg, { Circle, Ellipse, G, Line, Path, Polygon, Rect } from 'react-native-svg';
import { colors } from '../../tokens';
import type { HeritageCardArtProps } from './types';

/**
 * HeritageCardArt — geometric SVG illustrations for the most prominent
 * Heritage cards (1 per theme + 1 legendary). Implements 6 cards in v1;
 * remaining 24 cards fall through to FallbackArt until the next batch ships.
 *
 * Visual language locked by design/brief/illustrations/heritage-card-art.md:
 *   - Geometric minhwa primitives (rounded shapes only)
 *   - ~3px stroke with hand-painted feel
 *   - Max 5 colors per card from theme tint + brand + cream
 *   - No red except dancheong orange accents
 *   - Smiling rule: any face smiles
 *
 * Real illustrator output will replace each card in
 * `design/illustrations/heritage-cards/{theme}/{card-id}__YYYY-MM-DD.png`
 * in a later sprint.
 */

export const supportedCardIds: readonly string[] = [
  'card:tiger',
  'card:book',
  'card:kimchi',
  'card:seollal',
  'card:mountain',
  'card:yutnori',
];

interface ArtProps {
  size: number;
  testID?: string;
  accessibilityLabel: string;
}

function TigerArt({ size, testID, accessibilityLabel }: ArtProps): React.ReactElement {
  // Legendary — Hoya himself in cheering pose + 6 sparkles overhead.
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200" testID={testID} accessibilityLabel={accessibilityLabel}>
      <Rect x={0} y={0} width={200} height={200} fill={colors.theme.nature} opacity={0.08} rx={8} />
      {/* Three sparkle clusters overhead */}
      <G fill={colors.feedback.nudge} opacity={0.9}>
        <Path d="M70 30 L74 40 L70 50 L66 40 Z" />
        <Path d="M60 40 L70 36 L80 40 L70 44 Z" />
        <Path d="M100 16 L104 28 L100 40 L96 28 Z" />
        <Path d="M88 28 L100 24 L112 28 L100 32 Z" />
        <Path d="M130 30 L134 40 L130 50 L126 40 Z" />
        <Path d="M120 40 L130 36 L140 40 L130 44 Z" />
      </G>
      {/* Hoya inline (scaled down — 128 viewBox repositioned into 200 viewBox) */}
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
    </Svg>
  );
}

function BookArt({ size, testID, accessibilityLabel }: ArtProps): React.ReactElement {
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200" testID={testID} accessibilityLabel={accessibilityLabel}>
      <Rect x={0} y={0} width={200} height={200} fill={colors.theme.letters} opacity={0.08} rx={8} />
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
    </Svg>
  );
}

function KimchiArt({ size, testID, accessibilityLabel }: ArtProps): React.ReactElement {
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200" testID={testID} accessibilityLabel={accessibilityLabel}>
      <Rect x={0} y={0} width={200} height={200} fill={colors.theme.life} opacity={0.08} rx={8} />
      {/* Cabbage layers — back to front, three rounded shapes */}
      <Path
        d="M50 90 Q60 70 80 70 Q100 60 120 70 Q140 70 150 90 Q150 110 100 110 Q50 110 50 90 Z"
        fill={colors.brand.primary}
        stroke={colors.brand.primaryDark}
        strokeWidth={2.5}
      />
      <Path
        d="M60 95 Q75 80 100 80 Q125 80 140 95 Q140 110 100 112 Q60 110 60 95 Z"
        fill={colors.feedback.nudge}
        opacity={0.95}
        stroke={colors.brand.primaryDark}
        strokeWidth={2}
      />
      <Path
        d="M75 100 Q85 92 100 92 Q115 92 125 100 Q120 108 100 110 Q80 108 75 100 Z"
        fill={colors.brand.primaryLight}
        opacity={0.9}
        stroke={colors.brand.primaryDark}
        strokeWidth={1.5}
      />
      {/* Bowl */}
      <Path
        d="M40 110 Q40 150 100 158 Q160 150 160 110 Z"
        fill={colors.surface.paper}
        stroke={colors.text.secondary}
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
      <Path d="M40 110 Q100 120 160 110" fill="none" stroke={colors.text.secondary} strokeWidth={2} />
      <Ellipse cx={100} cy={165} rx={50} ry={4} fill={colors.hoya.furDark} opacity={0.18} />
    </Svg>
  );
}

function SeollalArt({ size, testID, accessibilityLabel }: ArtProps): React.ReactElement {
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200" testID={testID} accessibilityLabel={accessibilityLabel}>
      <Rect x={0} y={0} width={200} height={200} fill={colors.theme.rites} opacity={0.08} rx={8} />
      {/* Folding screen */}
      <Rect x={20} y={20} width={160} height={60} fill={colors.surface.paper} stroke={colors.text.secondary} strokeWidth={2} rx={4} />
      <Line x1={60} y1={20} x2={60} y2={80} stroke={colors.text.secondary} strokeWidth={2} />
      <Line x1={100} y1={20} x2={100} y2={80} stroke={colors.text.secondary} strokeWidth={2} />
      <Line x1={140} y1={20} x2={140} y2={80} stroke={colors.text.secondary} strokeWidth={2} />
      {/* Floor strip */}
      <Rect x={20} y={150} width={160} height={6} fill={colors.theme.life} opacity={0.4} rx={2} />
      {/* Adult (left) */}
      <G>
        <Path d="M60 120 Q56 140 50 152 H92 Q86 140 82 120 Z" fill={colors.theme.rites} />
        <Path d="M58 100 Q70 95 82 100 L82 122 Q70 118 60 122 Z" fill={colors.brand.primary} stroke={colors.brand.primaryDark} strokeWidth={1.5} />
        <Circle cx={70} cy={92} r={12} fill={colors.hoya.belly} stroke={colors.text.secondary} strokeWidth={1.5} />
        <Line x1={64} y1={92} x2={68} y2={92} stroke={colors.text.primary} strokeWidth={2} strokeLinecap="round" />
        <Line x1={72} y1={92} x2={76} y2={92} stroke={colors.text.primary} strokeWidth={2} strokeLinecap="round" />
        <Path d="M66 96 Q70 98 74 96" stroke={colors.text.primary} strokeWidth={1.5} strokeLinecap="round" fill="none" />
      </G>
      {/* Child (right) */}
      <G>
        <Path d="M125 130 Q121 140 117 150 H143 Q139 140 135 130 Z" fill={colors.brand.secondary} />
        <Path d="M123 115 Q130 112 137 115 L137 132 Q130 128 123 132 Z" fill={colors.feedback.nudge} stroke={colors.brand.primaryDark} strokeWidth={1.5} />
        <Circle cx={130} cy={108} r={10} fill={colors.hoya.belly} stroke={colors.text.secondary} strokeWidth={1.5} />
        <Line x1={126} y1={108} x2={128} y2={108} stroke={colors.text.primary} strokeWidth={2} strokeLinecap="round" />
        <Line x1={132} y1={108} x2={134} y2={108} stroke={colors.text.primary} strokeWidth={2} strokeLinecap="round" />
        <Path d="M127 112 Q130 114 133 112" stroke={colors.text.primary} strokeWidth={1.5} strokeLinecap="round" fill="none" />
      </G>
    </Svg>
  );
}

function MountainArt({ size, testID, accessibilityLabel }: ArtProps): React.ReactElement {
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200" testID={testID} accessibilityLabel={accessibilityLabel}>
      <Rect x={0} y={0} width={200} height={200} fill={colors.theme.nature} opacity={0.08} rx={8} />
      <Circle cx={120} cy={70} r={26} fill={colors.feedback.nudge} opacity={0.7} />
      <Polygon points="40,150 90,60 140,150" fill={colors.theme.nature} opacity={0.4} stroke={colors.theme.nature} strokeWidth={2} strokeLinejoin="round" />
      <Polygon points="60,160 110,80 165,160" fill={colors.theme.nature} opacity={0.7} stroke={colors.theme.nature} strokeWidth={2} strokeLinejoin="round" />
      <Polygon points="20,170 75,100 130,170" fill={colors.theme.nature} stroke={colors.brand.primaryDark} strokeWidth={2} strokeLinejoin="round" />
      {/* Snow caps */}
      <Path d="M70 110 L75 100 L82 112 L78 108 Z" fill={colors.surface.paper} opacity={0.9} />
      <Path d="M105 90 L110 80 L116 92 L112 88 Z" fill={colors.surface.paper} opacity={0.9} />
      <Rect x={0} y={170} width={200} height={30} fill={colors.theme.life} opacity={0.3} />
    </Svg>
  );
}

function YutnoriArt({ size, testID, accessibilityLabel }: ArtProps): React.ReactElement {
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200" testID={testID} accessibilityLabel={accessibilityLabel}>
      <Rect x={0} y={0} width={200} height={200} fill={colors.theme.crafts} opacity={0.08} rx={8} />
      <Ellipse cx={100} cy={170} rx={70} ry={6} fill={colors.hoya.furDark} opacity={0.15} />
      <G transform="rotate(-15 60 80)">
        <Rect x={28} y={73} width={64} height={14} fill={colors.surface.canvas} stroke={colors.text.secondary} strokeWidth={2} rx={6} />
        <Path d="M40 77 Q60 75 80 77" stroke={colors.text.muted} strokeWidth={1.5} fill="none" />
      </G>
      <G transform="rotate(20 140 80)">
        <Rect x={108} y={73} width={64} height={14} fill={colors.surface.canvas} stroke={colors.text.secondary} strokeWidth={2} rx={3} />
        <Circle cx={140} cy={80} r={4} fill={colors.brand.primary} />
      </G>
      <G transform="rotate(10 70 130)">
        <Rect x={38} y={123} width={64} height={14} fill={colors.surface.canvas} stroke={colors.text.secondary} strokeWidth={2} rx={6} />
        <Path d="M50 127 Q70 125 90 127" stroke={colors.text.muted} strokeWidth={1.5} fill="none" />
      </G>
      <G transform="rotate(-25 130 135)">
        <Rect x={98} y={128} width={64} height={14} fill={colors.surface.canvas} stroke={colors.text.secondary} strokeWidth={2} rx={6} />
        <Path d="M110 132 Q130 130 150 132" stroke={colors.text.muted} strokeWidth={1.5} fill="none" />
      </G>
    </Svg>
  );
}

function FallbackArt({ size, testID, accessibilityLabel }: ArtProps): React.ReactElement {
  // Soft theme-neutral placeholder for card ids not yet illustrated.
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200" testID={testID} accessibilityLabel={accessibilityLabel}>
      <Rect x={0} y={0} width={200} height={200} fill={colors.surface.sunken} rx={8} />
      <Circle cx={100} cy={100} r={60} fill={colors.brand.primaryLight} />
      <Circle cx={100} cy={100} r={40} fill={colors.brand.primary} opacity={0.6} />
      <Circle cx={100} cy={100} r={20} fill={colors.surface.paper} />
    </Svg>
  );
}

export function HeritageCardArt({
  cardId,
  size = 200,
  testID,
  accessibilityLabel,
}: HeritageCardArtProps): React.ReactElement {
  const label = accessibilityLabel ?? `Card art for ${cardId}`;
  switch (cardId) {
    case 'card:tiger':
      return <TigerArt size={size} testID={testID} accessibilityLabel={label} />;
    case 'card:book':
      return <BookArt size={size} testID={testID} accessibilityLabel={label} />;
    case 'card:kimchi':
      return <KimchiArt size={size} testID={testID} accessibilityLabel={label} />;
    case 'card:seollal':
      return <SeollalArt size={size} testID={testID} accessibilityLabel={label} />;
    case 'card:mountain':
      return <MountainArt size={size} testID={testID} accessibilityLabel={label} />;
    case 'card:yutnori':
      return <YutnoriArt size={size} testID={testID} accessibilityLabel={label} />;
    default:
      return <FallbackArt size={size} testID={testID} accessibilityLabel={label} />;
  }
}
