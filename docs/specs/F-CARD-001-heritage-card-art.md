# F-CARD-001 — Heritage Card Art System

**Status**: `shipped` (back-fill — landed across PR #17 and PR #18, this spec written 2026-05-21)
**Scope**: `packages/design-system` · `apps/mobile` · `apps/web` · MVP
**Owner**: solo dev
**Rollout**: MVP — completes Stage 1 reward visuals

---

## 1. Context

Heritage Cards are the primary reward in Hangul Route (CLAUDE.md §1). Each card represents one piece of Korean culture (e.g., kimchi, tiger, hanji). Before this feature, cards rendered as theme-tinted boxes with the Korean glyph centered — informative but not "earned-feeling".

F-CARD-001 adds **geometric SVG illustrations** for all 30 Stage 1 cards, making the Library tab a true collection screen. Each card has bespoke art following the minhwa-inspired language locked in `design/brief/illustrations/heritage-card-art.md`.

Real illustrator output will replace these placeholders in a later sprint; the SVG implementations are the design contract those illustrations must match.

Implemented across:
- PR #17 (`design(card-art): add HeritageCardArt SVG component — 6 illustrated cards`) — initial 6 cards
- PR #18 (`design(card-art): complete all 30 Stage 1 Heritage card illustrations`) — completes the remaining 24

## 2. User story

> As **P5** (English-speaking K-culture child, 5–11 yo, has just earned their first card via Quest completion), I want the card I unlocked to look distinctly **special** — not a generic placeholder — so that collecting cards feels like collecting real treasures, not progress bars.

Companion stories:

- As **P4** (heritage child), I want some cards (호랑이 tiger / 김치 kimchi / 한복 hanbok) to look familiar from family or media, anchoring "this app knows my culture".
- As a **parent**, I want the cards to be visually quiet and respectful — no neon, no cartoony exaggeration — so I'm proud to show my child the Library.

## 3. Acceptance criteria

### 3.1 Coverage

- **All 30 Stage 1 cards** ship with bespoke SVG art.
- `supportedCardIds` exports the full list (`packages/design-system/src/components/HeritageCardArt/index.ts`).
- Consumers (`LibraryScreen`, `CardDetailScreen`) check `supportedCardIds.includes(card.id)` and render `<HeritageCardArt cardId={...} />` when supported; fall back to text-only otherwise.

### 3.2 Visual contract (per brief §3)

Every card art must:

- Use **only colors** from `tokens.colors` (theme tint + brand + surface + text + Hoya palette + rarity).
- Use **max 5 colors** within a single card.
- Use **rounded primitives only** — no sharp angles on visible shapes.
- Use **~3px stroke** weight at 200 viewBox scale.
- Render with a **theme-tinted background** at 8% opacity (`Frame` helper).
- **No red** anywhere except dancheong orange accents (kimchi uses amber `feedback.nudge`, not alarm-red).
- **No gradients** beyond simple radial shadows.
- **Smiling rule** — any face (bowing figures, magpie, etc.) shows a soft smile.

### 3.3 API contract

```ts
import { HeritageCardArt, supportedCardIds } from '@hangul-route/design-system';

// Required props
interface HeritageCardArtProps {
  cardId: string;                  // "card:tiger", "card:kimchi", etc.
  size?: number;                   // default 200
  testID?: string;
  accessibilityLabel?: string;     // default "Card art for {cardId}"
}
```

- Unknown `cardId` falls through to `FallbackArt` (soft neutral placeholder) — never throws.
- Size scales the viewBox uniformly (cards stay square).

### 3.4 Theme distribution

- **5 themes × 6 cards = 30**:
  - Letters (6): book / hanji / brush / ink / origami / hangul-day
  - Life (6): kimchi / rice / chopsticks / hanbok / kimbap / family-table
  - Rites (6): seollal / chuseok / tteokguk / songpyeon / sebae / lantern
  - Nature (6): tiger / magpie / mugunghwa / mountain / sea / moon
  - Crafts (6): yutnori / jegi / kite / top / pottery / gayageum

### 3.5 Anti-shame compliance

- No card depicts a sad, alarming, or shaming subject.
- No red borders, no red fills (only the reserved `feedback.danger` token, which no card uses).
- All faces smile.

## 4. Out of scope

- **Card backs** (Phase 2 — brief §5 specs the layout: Korean glyph prominent + fun fact + 💡 emoji).
- **Card-reveal celebration animation** — separate motion brief.
- **Real illustrator art** — waits on commission; current SVG is the contract.
- **Print-quality high-DPI exports** — deferred until parents request physical merch.
- **Cards for Stages 2–7** — Stage 1 only for now (each subsequent stage needs its own card brief + 30 illustrations).
- **Web-side mirror in /design-preview** — keeps 6 sample mirrors; the full 30 are visible in the mobile Library tab.

## 5. UI sketch

`design/brief/illustrations/heritage-card-art.md` is the canonical design source. Each card is rendered at the brief's specified visual brief, refined to fit the 200 × 200 viewBox.

Sample layout (Tiger card, the legendary):

```
┌──────────────────────────┐
│  ✨        ✨        ✨   │ ← 6 amber sparkles
│       ┌──────────┐       │
│       │   Hoya   │       │ ← Hoya in cheering pose
│       │ cheering │       │   (inline scaled-down)
│       │   480px  │       │
│       │ → 128px  │       │
│       └──────────┘       │
│                          │
│  [theme: nature 8% wash] │
└──────────────────────────┘
```

## 6. Tests

The component is **render-only** — no behavior to test in unit form. Validation strategy:

- **Typecheck**: every `cardId` in `supportedCardIds` must have a matching `case` in the dispatcher switch (compile-time via the `HeritageCardArtProps.cardId: string` and explicit cases).
- **Visual regression** (deferred to F-VR-001): Storybook snapshot per card.
- **Manual designer review**: open `/design-preview` (sample 6) and mobile Library (full 30) and validate against the brief acceptance checklist.

## 7. Rollout

- **PR #17**: 6 cards (book / kimchi / seollal / tiger / mountain / yutnori) — 1 per theme + 1 legendary.
- **PR #18**: 24 remaining cards.
- **Total**: all 30 Stage 1 cards illustrated, consumed by mobile Library tab + CardDetailScreen.
- Real illustrator art replaces SVG placeholders in a future sprint when commission lands. SVG contract is preserved for any card not yet illustrated.

## 8. Dependencies

### Upstream (must ship first — all done)

- `tokens.colors` with theme / rarity / brand / surface / hoya palettes (✅ tokens v1, PR #15).
- `packages/content-schema` Heritage Card schema (✅ PR #13).
- 30 cards seeded in `apps/mobile/src/content/heritage-cards.ts` (✅ PR #13).
- Hoya geometric SVG (✅ PR #16) — required for Tiger card inline rendering.

### Downstream

- Heritage Card back-face design (F-CARD-002, Phase 2).
- Card unlock celebration animation (F-CARD-003).
- Stage 2+ card illustrations (F-CARD-S2-001 through -S7-001).
- Visual regression coverage (F-VR-001).

### External

- `design/brief/illustrations/heritage-card-art.md` — visual contract per card.
- `react-native-svg` for RN-side rendering.
- Real illustrator commission (deferred).
