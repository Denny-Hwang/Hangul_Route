# F-002 — Hoya Feedback Bubble

**Status**: `ready`
**Scope**: `packages/design-system` · Component · MVP
**Owner**: solo dev
**Rollout**: MVP (first reusable component spec after F-001)

---

## 1. Context

HoyaBubble is the *voice* of Hoya — the speech-bubble component that
delivers prompts, hints, and celebrations to English-speaking child
learners 5–11. It is the first reusable UI component spec (after the
gameplay-focused F-001) and serves as the reference implementation of
the `component-skill` 5-file rule (§3.1).

It appears in at least four W2 wireframes:
- `design/wireframes/onboarding/welcome.md` — first greeting.
- `design/wireframes/onboarding/first-quest-preview.md` — "Tap the
  letter you hear" 30-second taste.
- `design/wireframes/quest/player.md` — prompt + wrong-answer hint
  (consumed directly by F-001 §3.1, §3.2).
- `design/wireframes/quest/results.md` — celebration after 5 rounds.

The component carries three responsibilities at once:
1. **Tone** — three visually distinct tones (`idle` / `cheering` /
   `thinking`) matching the Hoya v1 pose set. Tone is the principal
   semantic prop.
2. **Bilingual delivery** — English message + optional Korean +
   romanization slot. The Korean is the learning target; English is the
   UI. F-CNT-001's allow-list (`ko` / `korean` / `target` / `answer_ko`
   / `lang_ko`) treats the `romanization` slot as the home for Korean
   characters in this component.
3. **Anti-shame contract** — `thinking` tone is the failure-state
   surface. It MUST use `colors.feedback.nudge` (warm amber), NEVER
   `colors.feedback.danger` (red), and MUST NOT auto-dismiss faster
   than 1.5 s (child needs time to read the hint).

## 2. User story

> As **P5** (English-speaking K-culture child, 5–7 yo), I want Hoya to
> talk to me with a bubble that I instantly recognise as "him speaking",
> so that I trust the app's voice from the first 30 seconds.

Companion stories:

- As **P4** (heritage child), I want the romanization slot to be present
  but never louder than the English UI message, so the app respects that
  I already half-hear Korean.
- As the **developer consuming HoyaBubble**, I want a small, opinionated
  prop surface (tone, message, romanization, ctaInline, onDismiss) so I
  don't have to make tonal decisions at the call site.

## 3. Acceptance criteria

### 3.1 Tone × pose pairing

- **Given** `<HoyaBubble tone="idle" message="Tap the letter you hear" />`,
  **when** rendered, **then** the Hoya thumbnail shows the `idle` pose
  (`design/characters/hoya/v1/idle.png`) and the bubble border uses
  `colors.surface.bubble`.

- **Given** `tone="cheering"`, **then** the thumbnail is `cheering` pose
  and the bubble accent border uses `colors.brand.primary`.

- **Given** `tone="thinking"`, **then** the thumbnail is `thinking`
  pose and the accent border uses `colors.feedback.nudge`. The bubble
  MUST NOT use `colors.feedback.danger` under any state.

### 3.2 Bilingual slot

- **Given** `<HoyaBubble tone="idle" message="Tap the letter you hear"
  romanization={{ ko: "ㄱ", romanization: "giyeok" }} />`,
  **when** rendered, **then** the romanization line appears beneath the
  message in `typography.caption` (smaller than `message`) and the
  Korean character is contained ONLY in the `romanization` slot.

- **Given** a caller passes Korean characters in the `message` prop
  (e.g. `message="안녕하세요"`), **when** scanned by
  `scripts/validate-content.mjs`, **then** the call site is flagged
  with `korean-in-ui-field` and CI fails. (The component itself does
  not throw — content validation is the gate, not the component.)

### 3.3 Accessibility

- The bubble's root carries `accessibilityRole="status"` (RN) /
  `role="status"` (web) when tone is `cheering` or `thinking` (live
  region — screen reader announces transitions). For `idle` (initial
  prompt) the role is `accessibilityRole="text"` to avoid duplicate
  announcements on first paint.
- `accessibilityLabel = "Hoya says: ${message}"`. The `romanization`
  line is exposed as a sibling node with its own
  `accessibilityLabel = "Korean: ${ko}, pronounced ${romanization}"`.
- Optional `ctaInline` (Button `tertiary` variant) is treated as a
  child with its own role; HoyaBubble does not override it.
- All tappable surfaces (hoyaThumbnail, ctaInline, dismiss-on-tap when
  enabled) ≥ 64 dp via `tokens.hitSlop.comfortable`.

### 3.4 Motion + reduced-motion

- **Entrance**: 120 ms `scale 0.96 → 1.0` + `opacity 0 → 1`. Skipped
  under `prefers-reduced-motion` (web `@media`, RN
  `AccessibilityInfo.isReduceMotionEnabled`); fade-only at 100 ms.
- **Auto-dismiss**: governed by `dismissAfterMs` prop. **Minimum 1500 ms
  on `tone="thinking"`** — child must read the hint. The component
  enforces this minimum: if a caller passes `dismissAfterMs={500}` with
  `tone="thinking"`, the component clamps to 1500 (no throw, but a dev
  warning in non-production builds).
- **Dismiss-on-tap**: opt-in via `onDismiss` prop. When set, the bubble
  itself becomes tappable; without it, the bubble is non-interactive.

### 3.5 Token-only styling

- `styles.ts` references **only** `tokens.*` exports. No hex literals,
  no pixel literals.
- `node scripts/check-token-drift.mjs` (F-DES-001) passes after this
  component's `styles.ts` lands.

### 3.6 Props surface (closed)

The v1 prop surface is exactly:

| Prop | Type | Required | Notes |
|---|---|---|---|
| `tone` | `'idle' \| 'cheering' \| 'thinking'` | yes | drives pose + border |
| `message` | `string` | yes | English, ≤ 2 lines |
| `romanization` | `{ ko: string; romanization: string } \| undefined` | no | Korean target field |
| `hoyaThumbnail` | `'idle' \| 'cheering' \| 'thinking'` | no | overrides tone-default pose |
| `ctaInline` | `ReactElement<ButtonProps> \| undefined` | no | tertiary Button only |
| `onDismiss` | `() => void \| undefined` | no | enables dismiss-on-tap |
| `dismissAfterMs` | `number \| undefined` | no | auto-dismiss; clamped ≥ 1500 on `thinking` |

No `children`. No `style` prop override (token-only).

## 4. Out of scope

- **TTS playback** when tapping the Hoya thumbnail (out of scope of
  F-002; tracked as **F-CNT-004**).
- **Animated Hoya character** (limbs / mouth / blink). v1 uses static
  PNG pose. Animation is a separate component (`HoyaCharacter`,
  tentatively F-CHR-001).
- **Speech queue / sequencer** for chained bubbles (e.g. onboarding
  walk-through). v1 is one-at-a-time.
- **Localised Hoya voice** (Spanish UI / French UI etc.). i18n surface
  is F-I18N-001.
- **Sound effects** (whoosh on entrance, chime on dismiss).
- **Multi-line romanization** with line breaks.
- **Promotion to Storybook MDX docs** beyond the basic `*.stories.tsx`.

## 5. UI sketch

- Wireframe references: `design/wireframes/onboarding/welcome.md`,
  `design/wireframes/onboarding/first-quest-preview.md`,
  `design/wireframes/quest/player.md`, `design/wireframes/quest/results.md`
  (all four produced in W2 sprint).
- Component visual spec: `design/components/HoyaBubble/{spec.md, v1.png,
  tones.png}` (produced W3 Wednesday — `design/playbook/week-03/day-03-wednesday.md`).
- Code spec promotion target: `packages/design-system/src/components/HoyaBubble/`.

## 6. Tests

Per `docs/tests/coverage-targets.md` — `packages/design-system` W4
target is **85 %**. HoyaBubble's test file ships with promotion.

### Unit (jsdom)

| File | Coverage focus |
|---|---|
| `HoyaBubble.test.tsx` | tone × pose pairing (3 cases) |
| | thinking-tone border colour is `feedback.nudge`, never `feedback.danger` (regression guard) |
| | accessibilityLabel format (`"Hoya says: ${message}"`) |
| | romanization slot renders only the `ko` + `romanization` strings; absent when prop undefined |
| | `dismissAfterMs={500}` + `tone="thinking"` clamps to 1500 (dev-mode warning emitted) |
| | `onDismiss` undefined → bubble is not tappable |
| | `prefers-reduced-motion: reduce` → entrance animation skipped (assertion on transform / opacity transition spy) |

### Storybook stories (covering Storybook a11y addon)

- `Idle` / `Cheering` / `Thinking` × `WithRomanization` / `WithoutRomanization` × `WithInlineCta` / `WithoutInlineCta` = 12 stories.

### E2E

- Deferred. Covered indirectly by F-001 E2E once it lands.

## 7. Rollout

MVP. Lands in W3 Friday `design: promote W3 components to design-system`
PR alongside Button / Card / Progress. Once that PR merges, F-002 status
moves to `shipped`.

## 8. Dependencies

### Upstream (must ship first)

- **W1 design tokens** (`colors.brand.*`, `colors.feedback.nudge`,
  `colors.surface.bubble`, `typography.body`, `typography.caption`,
  `radius.md`, `shadow.sm`, `hitSlop.comfortable`, `opacity.pressed`,
  `opacity.disabled`).
- **Hoya v1 poses** — `design/characters/hoya/v1/{idle,cheering,thinking}.png`.
- **Button v1** (`design/components/Button/spec.md` + the Friday
  promotion) — `ctaInline` consumes Button tertiary variant.
- **Card v1** for `shadow.sm` token harmonisation only (not a direct
  dependency).

### Downstream (will unblock once F-002 ships)

- **F-001 Hangul Tile Game** — §3.1 prompt uses `tone="idle"` +
  romanization slot; §3.2 wrong-answer uses `tone="thinking"`; results
  screen uses `tone="cheering"`.
- **Onboarding flow** — `design/wireframes/onboarding/welcome.md` etc.
- **F-CHR-001 HoyaCharacter** (animated Hoya) — will likely replace the
  static thumbnail slot in a later major version.

### External

- None. PNG assets are committed under `design/characters/hoya/v1/`.
