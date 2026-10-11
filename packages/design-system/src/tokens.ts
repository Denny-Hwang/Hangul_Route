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
 *   - Sizes calibrated for young readers and adult beginners alike (body floor 18sp, prompt 22sp)
 *
 * Spacing: 4pt sub-grid for fine, 8pt grid for layout.
 * Radii: generous, paper-card feel.
 *
 * Consumers MUST import from `@hangul-route/design-system/tokens`.
 * Hardcoded color / spacing literals are forbidden (CLAUDE.md §4).
 */

export const colors = {
  // Brand — fills carry white labels and the primary doubles as ghost/brand
  // text, so both meet WCAG AA 4.5:1 (UX-10; see contrast.test.ts).
  brand: {
    primary: '#B24915', // 단청 deep vermilion orange — main CTAs, ghost text, Hoya accents
    primaryDark: '#8D3A11',
    primaryLight: '#FAD9C6',
    secondary: '#2672A6', // Hoya sky blue, deepened for white labels
    secondaryDark: '#1D5881',
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
    muted: '#6F614D', // ≥ 4.5:1 on canvas, paper, sunken and brand tints
    inverse: '#FFFFFF',
    onPrimary: '#FFFFFF',
    onSecondary: '#FFFFFF',
  },
  // Feedback (anti-shame contract — no red for child failure)
  feedback: {
    success: '#397952', // green — correct answer; carries white labels
    successDark: '#2C5E3F', // pressed success fill
    successLight: '#D6EFDF',
    nudge: '#F2B33D', // amber — wrong-but-encouraging
    nudgeLight: '#FCEED1',
    info: '#5B8DEF',
    infoLight: '#D9E5FB',
    danger: '#C84B3D', // RESERVED for parent/admin destructive only — never on child failure
    dangerLight: '#F8DBD8',
  },
  // Stage axis (7) — themed accents for each Heritage Journey stage. Fills,
  // borders and accent shapes only: stage1-4 on canvas are 2.3-3.0:1, so any
  // text beside them is text.primary (never set text in a stage/theme/rarity colour).
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
    // Learner cub variants (F-LEARN-001 §3.6). Flat keys on purpose: the
    // tokens-parity test pins every colors.<group>.<key>. Orange is fur/furDark.
    furBlue: '#4891CB',
    furBlueDark: '#2E6A9E',
    furGreen: '#5E9E3E',
    furGreenDark: '#437A2A',
    furPurple: '#7C57C0',
    furPurpleDark: '#5B3F9A',
    furPink: '#D0527F',
    furPinkDark: '#A33A62',
  },
  // Card rarity (Heritage Library)
  rarity: {
    common: '#8A7860',
    uncommon: '#7BB552',
    rare: '#4A9DD6',
    legendary: '#E8743B',
  },
  // WordArt content colours (F-VOC-002 §3.4): the colour words a learner is
  // taught, drawn only inside WordArt (src/word-art/, components/WordArt/).
  // Content, never feedback: `red` is not a failure colour and never replaces
  // feedback.danger or feedback.nudge. Every swatch is outlined in
  // text.primary and paired with an object, so colour is never the only cue.
  vocab: {
    red: '#D83A34',
    orange: '#F28C28',
    yellow: '#F6D32D',
    green: '#3FA34D',
    blue: '#2F6BD0',
    purple: '#8E44AD',
    skyBlue: '#8FD0F5',
    brown: '#8B5A2B',
    gray: '#9E9E9E',
    white: '#FFFFFF',
    black: '#1F1A17',
    pink: '#F58FB5',
  },
  // Borders / dividers
  border: {
    subtle: '#E8DFCD',
    strong: '#C5B8A1',
    focus: '#3A7FB5', // ≥ 3:1 (non-text) on canvas, paper and sunken
    // Drawn-shape outlines (My route pips, the dotted trail connector; F-ROUTE-001 R-2b):
    // ≥ 3:1 (non-text) on canvas, paper, sunken and brand.primaryLight.
    shape: '#857360',
  },
} as const;

/** The five learner cubs; the avatar name (`hoya-blue`) is the contract for the colour. */
export const HOYA_VARIANTS = ['orange', 'blue', 'green', 'purple', 'pink'] as const;
export type HoyaVariant = (typeof HOYA_VARIANTS)[number];

const HOYA_VARIANT_COLORS: Record<HoyaVariant, { fur: string; furDark: string }> = {
  orange: { fur: colors.hoya.fur, furDark: colors.hoya.furDark },
  blue: { fur: colors.hoya.furBlue, furDark: colors.hoya.furBlueDark },
  green: { fur: colors.hoya.furGreen, furDark: colors.hoya.furGreenDark },
  purple: { fur: colors.hoya.furPurple, furDark: colors.hoya.furPurpleDark },
  pink: { fur: colors.hoya.furPink, furDark: colors.hoya.furPinkDark },
};

/**
 * Fur and shade of a cub variant. Pure and React-free, so the web app can
 * import it from `@hangul-route/design-system/tokens`. An unknown variant
 * (persisted junk) reads as the default orange cub.
 */
export function hoyaVariantColors(variant: HoyaVariant): { fur: string; furDark: string } {
  return HOYA_VARIANT_COLORS[variant] ?? HOYA_VARIANT_COLORS.orange;
}

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

/**
 * Responsive layout scale (F-LAYOUT-001 §3.1; design/tokens/layout.v1.md).
 * Units are CSS px / dp. The class (compact / regular / wide) follows the
 * window, not the device; `layoutClassFor` in `layout.ts` turns a window size
 * into these numbers. Type sizes and the 64 touch-target floor never change.
 */
export const layout = {
  breakpoint: { regular: 600, wide: 900 }, // window width
  shortHeight: 480, // window height below this = 'short'
  compactHeight: 640, // window height below this: a pinned hero CTA steps down to lg (F-STORY-002 reader, 320x568 and landscape phones)
  phoneShortSide: 600, // min(width, height) below this = a phone ...
  phoneMaxLongSide: 1000, // ... if the long side is also at most this (a 1100x500 desktop window is not a phone)
  sideBySideMin: 700, // F-STORY-002 reader: two columns when landscape and width >= this
  maxWidth: { reading: 720, full: 1120 },
  gutter: { compact: spacing.lg, regular: spacing.xl, wide: spacing.xxl },
  pane: { master: 400, gap: spacing.xl }, // master pane width on wide; detail takes the rest
  mediaScale: { compact: 1, regular: 1.2, wide: 1.4 },
  columns: { cards: { compact: 2, regular: 3, wide: 3 }, journeyCellMax: 112 },
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
  // Family — friendly, high legibility. System fallbacks for now.
  family: {
    sans: 'System',
    sansKr: 'System',
    display: 'System',
    mono: 'Menlo, Courier, monospace',
  },
  // Size scale — body floor 18 (young-reader legibility)
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

// Touch targets — child-sized for every learner. Apple HIG recommends 75pt for
// children's apps; we floor at 64 (CLAUDE.md §4) but expose `child` size for primary actions.
export const touchTarget = {
  min: 64, // CLAUDE.md floor
  child: 80, // primary actions, large and easy to hit
  hero: 96, // jamo / tile prompts
} as const;

// Border widths — outlines on cards, tiles and framed art. Three steps cover
// every border in the app; documented in design/tokens/spacing.v1.md.
export const borderWidth = {
  thin: 1, // hairline dividers, quiet outlines
  base: 2, // tiles, bubbles, selected states
  thick: 3, // framed art and trace/draw surfaces
} as const;

// Motion — durations + easings (anti-startle)
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

/**
 * Lecture presenter scale (F-TCH-004 §3.6; design/tokens/presenter.v1.md).
 * Sizes are logical stage units: a stage is 1280 units wide and 600-960 high,
 * and `stage-scale.ts` turns a unit into window pixels. Nothing projected is
 * smaller than `caption`, and on screen text never drops below the body floor.
 * The presenter projects existing colours only (pairs in presenter.v1.md).
 */
export const presenter = {
  stage: { width: 1280, minHeight: 600, maxHeight: 960 },
  size: { glyph: 380, display: 140, title: 80, prompt: 56, body: 40, caption: 28 }, // stage units
  font: 'HR Presenter KR', // family name of the bundled Hangul subset (F-TCH-004 PR 3)
  marker: { shapes: ['circle', 'triangle', 'square', 'star'] }, // quiz options 1-4, so colour is never the only cue
  autoHideMs: 3000, // control bar hides after this long with no pointer, touch or key
  dimOpacity: 0.8, // non-correct quiz options after the reveal; text.primary only (8.4:1 on paper; text.secondary would fall to 4.9:1)
} as const;

export const tokens = {
  colors,
  spacing,
  layout,
  radii,
  typography,
  shadows,
  touchTarget,
  borderWidth,
  motion,
  z,
  presenter,
} as const;

export type Tokens = typeof tokens;
export type ColorTokens = typeof colors;
export type SpacingTokens = typeof spacing;
export type LayoutTokens = typeof layout;
export type PresenterTokens = typeof presenter;
export type RadiiTokens = typeof radii;
export type TypographyTokens = typeof typography;
export type StageKey = keyof typeof colors.stage;
export type ThemeKey = keyof typeof colors.theme;
export type RarityKey = keyof typeof colors.rarity;
