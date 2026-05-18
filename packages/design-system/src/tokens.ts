/**
 * Hangul Route — Design Tokens v1
 *
 * Visual identity:
 *   - Heritage warmth: 단청(dancheong) inspired primary palette
 *   - Hoya sky: 호야의 시그니처 blue accent
 *   - 한지(hanji) cream surfaces: paper-like, soft, warm
 *   - Anti-shame: no red for failure; amber `nudge` instead
 *
 * Typography:
 *   - System fallbacks; real font binding in `apps/mobile/App.tsx`
 *   - Sizes calibrated for ages 5–11 (body floor 18sp, prompt 22sp)
 *
 * Spacing: 4pt sub-grid for fine, 8pt grid for layout.
 * Radii: generous, paper-card feel.
 *
 * Consumers MUST import from `@hangul-route/design-system/tokens`.
 * Hardcoded color / spacing literals are forbidden (CLAUDE.md §4).
 */

export const colors = {
  // Brand
  brand: {
    primary: '#E8743B', // 단청 warm orange — main CTAs, Hoya accents
    primaryDark: '#B5562A',
    primaryLight: '#FAD9C6',
    secondary: '#4A9DD6', // Hoya sky blue
    secondaryDark: '#2E72A3',
    secondaryLight: '#CDE5F4',
  },
  // Surface — hanji-inspired cream layering
  surface: {
    canvas: '#FCF8F1', // background base
    paper: '#FFFFFF', // card / sheet
    sunken: '#F2EBDE', // inset / inactive
    overlay: 'rgba(20, 14, 8, 0.40)',
    inkScrim: 'rgba(20, 14, 8, 0.06)',
  },
  // Text — warm dark, never pure black
  text: {
    primary: '#2A1F14',
    secondary: '#5C4A36',
    muted: '#8A7860',
    inverse: '#FFFFFF',
    onPrimary: '#FFFFFF',
    onSecondary: '#FFFFFF',
  },
  // Feedback (anti-shame contract — no red for child failure)
  feedback: {
    success: '#4FA871', // green — correct answer
    successLight: '#D6EFDF',
    nudge: '#F2B33D', // amber — wrong-but-encouraging
    nudgeLight: '#FCEED1',
    info: '#5B8DEF',
    infoLight: '#D9E5FB',
    danger: '#C84B3D', // RESERVED for parent/admin destructive only — never on child failure
    dangerLight: '#F8DBD8',
  },
  // Stage axis (7) — themed accents for each Heritage Journey stage
  stage: {
    stage1: '#E8743B', // Hangul — primary
    stage2: '#D89B2B', // Word
    stage3: '#7BB552', // Sentence
    stage4: '#4A9DD6', // Dialogue
    stage5: '#8265C2', // Story
    stage6: '#C84B7D', // Real-use
    stage7: '#3D9B8C', // Self-expression
  },
  // Theme axis (5) — culture-theme tints
  theme: {
    letters: '#E8743B', // 자모와 책 — Letters
    life: '#F2B33D', // 음식과 일상 — Life
    rites: '#8265C2', // 명절과 전통 — Rites
    nature: '#7BB552', // 자연과 동물 — Nature
    crafts: '#4A9DD6', // 놀이와 공예 — Crafts
  },
  // Hoya — character palette
  hoya: {
    fur: '#F2B33D', // tiger gold
    furDark: '#B5862A',
    stripes: '#2A1F14',
    belly: '#FCF8F1',
    nose: '#2A1F14',
    cheek: '#F8B4B4',
  },
  // Card rarity (Heritage Library)
  rarity: {
    common: '#8A7860',
    uncommon: '#7BB552',
    rare: '#4A9DD6',
    legendary: '#E8743B',
  },
  // Borders / dividers
  border: {
    subtle: '#E8DFCD',
    strong: '#C5B8A1',
    focus: '#4A9DD6',
  },
} as const;

export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
  jumbo: 64,
} as const;

export const radii = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  pill: 999,
  circle: 9999,
} as const;

export const typography = {
  // Family — child-friendly, high legibility. System fallbacks for now.
  family: {
    sans: 'System',
    sansKr: 'System',
    display: 'System',
    mono: 'Menlo, Courier, monospace',
  },
  // Size scale — body floor 18 (5–7 yo legibility)
  size: {
    caption: 14,
    bodySm: 16,
    body: 18,
    bodyLg: 20,
    prompt: 22,
    title: 28,
    display: 36,
    hero: 48,
  },
  // Weight — semantic only
  weight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  // Line heights
  leading: {
    tight: 1.15,
    normal: 1.35,
    relaxed: 1.55,
  },
  // Letter spacing
  tracking: {
    tight: -0.4,
    normal: 0,
    wide: 0.4,
  },
} as const;

export const shadows = {
  none: 'none',
  // RN-friendly elevation + iOS shadow tuple
  card: {
    shadowColor: '#2A1F14',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  raised: {
    shadowColor: '#2A1F14',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 16,
    elevation: 6,
  },
  modal: {
    shadowColor: '#2A1F14',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 32,
    elevation: 12,
  },
} as const;

// Touch targets — children 5–11. Apple HIG recommends 75pt for children's apps;
// we floor at 64 (CLAUDE.md §4) but expose `child` size for primary actions.
export const touchTarget = {
  min: 64, // CLAUDE.md floor
  child: 80, // primary actions, children 5–7
  hero: 96, // jamo / tile prompts
} as const;

// Motion — durations + easings (anti-startle for kids)
export const motion = {
  duration: {
    instant: 60,
    fast: 120,
    base: 200,
    slow: 320,
    crawl: 600,
    celebration: 900,
  },
  easing: {
    standard: 'cubic-bezier(0.2, 0, 0, 1)',
    decelerate: 'cubic-bezier(0, 0, 0, 1)',
    accelerate: 'cubic-bezier(0.3, 0, 1, 1)',
    bouncy: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
} as const;

// Z-index — semantic
export const z = {
  base: 0,
  raised: 10,
  sticky: 20,
  drawer: 30,
  modal: 40,
  toast: 50,
  hoyaBubble: 60,
} as const;

export const tokens = {
  colors,
  spacing,
  radii,
  typography,
  shadows,
  touchTarget,
  motion,
  z,
} as const;

export type Tokens = typeof tokens;
export type ColorTokens = typeof colors;
export type SpacingTokens = typeof spacing;
export type RadiiTokens = typeof radii;
export type TypographyTokens = typeof typography;
export type StageKey = keyof typeof colors.stage;
export type ThemeKey = keyof typeof colors.theme;
export type RarityKey = keyof typeof colors.rarity;
