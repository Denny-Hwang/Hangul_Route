import { colors, hoyaVariantColors, type HoyaVariant } from '@hangul-route/design-system/tokens';

/**
 * The shipped Hoya, as inline web SVG mirroring
 * packages/design-system/src/components/Hoya/Hoya.tsx. Shared by /design-preview
 * (the Hoya section) and /design-preview/scenes/library, where it stands beside
 * the scene-art data port (`hoyaNodes`) for the parity check (F-STORY-002 §3.9.4).
 */

export type HoyaPose = 'idle' | 'cheering' | 'thinking' | 'reading' | 'waving';

function eyeFor(pose: HoyaPose): { leftCx: number; rightCx: number; y: number; rx: number; ry: number } {
  switch (pose) {
    case 'cheering':
      return { leftCx: 50, rightCx: 78, y: 70, rx: 4, ry: 1.6 };
    case 'thinking':
      return { leftCx: 51, rightCx: 79, y: 68, rx: 3, ry: 4.5 };
    case 'reading':
      return { leftCx: 50, rightCx: 78, y: 76, rx: 3, ry: 3.5 };
    default:
      return { leftCx: 50, rightCx: 78, y: 72, rx: 3.5, ry: 4 };
  }
}

export function HoyaSvg({
  pose,
  size = 96,
  variant = 'orange',
}: {
  pose: HoyaPose;
  size?: number;
  variant?: HoyaVariant;
}): JSX.Element {
  const { fur, furDark } = hoyaVariantColors(variant);
  // Mirrors packages/design-system/src/components/Hoya/Hoya.tsx exactly.
  // Refined per design/brief/character/hoya-character-sheet.md.
  // When real Hoya art ships from design/characters/hoya/v1/, this preview will
  // be updated alongside the RN component in one PR.
  const eye = eyeFor(pose);
  const showCheeks = pose === 'idle' || pose === 'cheering' || pose === 'waving';
  return (
    <svg width={size} height={size} viewBox="0 0 128 128" aria-label={`Hoya ${pose}`}>
      {/* Foot shadow */}
      <ellipse cx={64} cy={116} rx={38} ry={5} fill={furDark} opacity={0.18} />

      {/* Arms / paws — pose-specific */}
      {pose === 'cheering' ? (
        <g>
          <path d="M22 78 Q14 60 8 46" stroke={fur} strokeWidth={10} strokeLinecap="round" fill="none" />
          <path d="M106 78 Q114 60 120 46" stroke={fur} strokeWidth={10} strokeLinecap="round" fill="none" />
          <circle cx={8} cy={46} r={7} fill={fur} />
          <circle cx={120} cy={46} r={7} fill={fur} />
        </g>
      ) : null}
      {pose === 'waving' ? (
        <g>
          <path d="M104 76 Q116 64 122 54" stroke={fur} strokeWidth={10} strokeLinecap="round" fill="none" />
          <circle cx={122} cy={54} r={7} fill={fur} />
        </g>
      ) : null}
      {pose === 'reading' ? (
        <g>
          <circle cx={42} cy={102} r={6} fill={fur} />
          <circle cx={86} cy={102} r={6} fill={fur} />
        </g>
      ) : null}

      {/* Head */}
      <circle cx={64} cy={64} r={44} fill={fur} />

      {/* Ears */}
      <circle cx={30} cy={32} r={12} fill={fur} />
      <circle cx={98} cy={32} r={12} fill={fur} />
      <circle cx={30} cy={32} r={6} fill={colors.hoya.cheek} opacity={0.85} />
      <circle cx={98} cy={32} r={6} fill={colors.hoya.cheek} opacity={0.85} />

      {/* Stripes — 3 per side + forehead */}
      <g stroke={colors.hoya.stripes} strokeWidth={3} strokeLinecap="round" fill="none">
        <path d="M26 54 Q30 58 26 62" />
        <path d="M24 70 Q29 73 25 78" />
        <path d="M28 84 Q33 86 30 90" />
        <path d="M102 54 Q98 58 102 62" />
        <path d="M104 70 Q99 73 103 78" />
        <path d="M100 84 Q95 86 98 90" />
        <path d="M64 24 Q66 30 64 36" />
      </g>

      {/* Belly */}
      <ellipse cx={64} cy={84} rx={26} ry={16} fill={colors.hoya.belly} />

      {/* Eyes */}
      <ellipse cx={eye.leftCx} cy={eye.y} rx={eye.rx} ry={eye.ry} fill={colors.hoya.stripes} />
      <ellipse cx={eye.rightCx} cy={eye.y} rx={eye.rx} ry={eye.ry} fill={colors.hoya.stripes} />

      {/* Eye glints — open eyes only */}
      {pose !== 'cheering' ? (
        <g fill={colors.surface.paper}>
          <circle cx={eye.leftCx + 1.2} cy={eye.y - 1.3} r={0.9} />
          <circle cx={eye.rightCx + 1.2} cy={eye.y - 1.3} r={0.9} />
        </g>
      ) : null}

      {/* Cheek blush — pose-conditional */}
      {showCheeks ? (
        <g>
          <circle cx={42} cy={84} r={5} fill={colors.hoya.cheek} opacity={0.6} />
          <circle cx={86} cy={84} r={5} fill={colors.hoya.cheek} opacity={0.6} />
        </g>
      ) : null}

      {/* Nose */}
      <path d="M58 84 H70 L64 90 Z" fill={colors.hoya.nose} />

      {/* Mouth — pose-specific */}
      {pose === 'cheering' ? (
        <path
          d="M44 92 Q60 110 76 92 Q60 100 44 92 Z"
          fill={colors.hoya.cheek}
          stroke={colors.hoya.stripes}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : pose === 'thinking' ? (
        <path d="M53 96 Q60 92 67 96" stroke={colors.hoya.stripes} strokeWidth={3} strokeLinecap="round" fill="none" />
      ) : pose === 'reading' ? (
        <line x1={56} y1={95} x2={64} y2={95} stroke={colors.hoya.stripes} strokeWidth={3} strokeLinecap="round" />
      ) : pose === 'waving' ? (
        <path d="M48 92 Q60 104 72 92" stroke={colors.hoya.stripes} strokeWidth={3} strokeLinecap="round" fill="none" />
      ) : (
        <path d="M50 92 Q60 100 70 92" stroke={colors.hoya.stripes} strokeWidth={3} strokeLinecap="round" fill="none" />
      )}

      {/* Thinking — thought cloud + 2 bubble dots leading up-right */}
      {pose === 'thinking' ? (
        <g>
          <circle cx={100} cy={26} r={2.5} fill={colors.surface.paper} stroke={colors.brand.secondary} strokeWidth={1.2} />
          <circle cx={106} cy={18} r={3.5} fill={colors.surface.paper} stroke={colors.brand.secondary} strokeWidth={1.2} />
          <rect
            x={108}
            y={2}
            width={18}
            height={12}
            rx={6}
            ry={6}
            fill={colors.surface.paper}
            stroke={colors.brand.secondary}
            strokeWidth={1.5}
          />
        </g>
      ) : null}

      {/* Cheering — 4-point pinwheel sparkles at top corners */}
      {pose === 'cheering' ? (
        <g fill={colors.feedback.nudge} opacity={0.85}>
          {/* Left sparkle at (20, 22) */}
          <path d="M20 16 L22 22 L20 28 L18 22 Z" />
          <path d="M14 22 L20 20 L26 22 L20 24 Z" />
          {/* Right sparkle at (108, 22) */}
          <path d="M108 16 L110 22 L108 28 L106 22 Z" />
          <path d="M102 22 L108 20 L114 22 L108 24 Z" />
        </g>
      ) : null}

      {/* Reading — book held below */}
      {pose === 'reading' ? (
        <g>
          <rect x={36} y={98} width={56} height={20} rx={3} ry={3} fill={furDark} opacity={0.2} />
          <rect
            x={36}
            y={94}
            width={56}
            height={22}
            rx={3}
            ry={3}
            fill={colors.surface.paper}
            stroke={colors.text.secondary}
            strokeWidth={1.5}
          />
          <line x1={64} y1={94} x2={64} y2={116} stroke={colors.text.secondary} strokeWidth={1} />
          <path d="M44 102 Q48 100 52 104" stroke={colors.text.primary} strokeWidth={2} strokeLinecap="round" fill="none" />
          <path d="M46 110 H54" stroke={colors.text.primary} strokeWidth={2} strokeLinecap="round" />
          <path d="M72 102 Q76 100 80 104" stroke={colors.text.primary} strokeWidth={2} strokeLinecap="round" fill="none" />
          <path d="M74 110 H82" stroke={colors.text.primary} strokeWidth={2} strokeLinecap="round" />
        </g>
      ) : null}
    </svg>
  );
}
