# F-CARD-S7-001 — Stage 7 Card Illustrations (deferred)

**Status**: `draft` — implementation **blocked** on Stage 7 self-expression content being authored.
**Scope**: `packages/design-system/src/components/HeritageCardArt/` + `apps/mobile/src/content/`
**Owner**: solo dev
**Rollout**: Stage 7 unlock — the final card stage

---

## 1. Context

Stage 7 of the Heritage Journey is **Self-expression** — the child speaks, writes, or creates *as themselves* in Korean. They record their introduction, write a short poem, draw + caption a picture, video-call a grandparent unscripted.

Stage 7 cards visually represent **the child's own creation** — but parametrized. Where Stage 6 cards were real-world artifacts, Stage 7 cards are **the child's voice** in Korean: a card might commemorate "My name is Mina" or "I love kimchi" with the child's actual recorded line.

Card count target: 30 (6 per theme), **plus an optional personalization slot** per card (see §3.5).

## 2. User story

> As **P5** (the final stage; child is now expressing themselves in Korean) earning a "My Self-Introduction" card, I want the card to **carry my name and my recorded voice** — so the card is uniquely *mine*, not a stock illustration.

## 3. Acceptance criteria (when implemented)

### 3.1 Card content

- `heritage-cards.ts` gains a Stage 7 section: 30 entries with `stage: 'stage7'`.
- Each card represents **one self-expression milestone**. Sample titles:
  - "My Self-Introduction" — child records "안녕! 저는 [name]이에요. [age]살이에요."
  - "My Korean Day" — short journal entry describing the day in Hangul
  - "Drawing + Caption" — child draws then writes the Korean caption
  - "Video Call Replay" — saved short transcript of a real video call (if opted in)
  - "My Korean Name" — handwritten 이름 in calligraphy mode

### 3.2 Visual contract (extends previous stages)

- **Personal palette** — each Stage 7 card has space for the child's chosen color palette (set during Stage 7 introduction)
- Max colors per card raised to **10** — these are the child's own creations and may need flexibility
- **Bold name slot** — the child's display name appears prominently
- Theme tinting flexible (4–12% range — child controls)
- **Stage 7 watermark**: `7` glyph + a tiny "person" icon

### 3.3 Rarity distribution

All Stage 7 cards are **legendary by default** — this is the final stage, every card is a milestone. Rarity colors compressed into "legendary" only for Stage 7.

### 3.4 HeritageCardArt extension

- 30 new switch cases bringing total to **210 supported cards** (Stages 1-7)
- Per-card SVG includes parametrized text slot rendering the child's `displayName`

### 3.5 Personalization slot (new for Stage 7)

- `HeritageCardArtProps` gains optional `personalName?: string` and `personalPaletteHex?: string` props
- When provided, the rendering uses them; when omitted, defaults to display name from active profile + default theme color
- For backwards compatibility, all Stages 1-6 cards ignore these props

## 4. Out of scope

- **Audio recording playback** of the child's voice — F-AUDIO-001 (Phase 3, requires recording infrastructure)
- **Custom illustration upload** — child draws but doesn't upload images (privacy + moderation cost)
- **Sharing self-expression cards externally** — F-CARD-003 share works but parents may want a privacy toggle (F-PRIV-001)

## 5. Suggested 30-card seed (subject to native-Korean editorial review)

### Letters & Books (6) — written self-expression
- "My name in Hangul" 한글 이름 · legendary
- "My first sentence" 내 첫 문장 · legendary
- "Letter to grandma" 할머니께 편지 · legendary
- "My favorite Korean letter" 좋아하는 자모 · legendary
- "Korean poem I wrote" 내가 쓴 시 · legendary
- "Hangul Day reflection" 한글날 소감 · legendary

### Food & Daily Life (6) — daily diary
- "What I ate today" 오늘 먹은 것 · legendary
- "My favorite Korean food" 좋아하는 한식 · legendary
- "Meal I cooked" 내가 만든 음식 · legendary
- "Family recipe I learned" 가족 레시피 · legendary
- "My lunchbox" 내 도시락 · legendary
- "Tea time with family" 가족과 차 시간 · legendary

### Holidays & Traditions (6) — personal moments
- "My Seollal memory" 내 설날 기억 · legendary
- "Bowing to grandparents" 조부모님께 절 · legendary
- "Songpyeon I made" 내가 만든 송편 · legendary
- "Lantern I lit" 내가 켠 연등 · legendary
- "Hanbok day photo (illustrated)" 한복 날 · legendary
- "What family means to me" 가족의 의미 · legendary

### Nature & Animals (6) — observation
- "My favorite Korean animal" 좋아하는 동물 · legendary
- "A flower I drew" 그린 꽃 · legendary
- "The sea I saw" 본 바다 · legendary
- "Mountain I climbed" 오른 산 · legendary
- "My nature poem" 자연 시 · legendary
- "Wildlife I want to protect" 지키고 싶은 자연 · legendary

### Play & Crafts (6) — creative
- "My kite design" 내가 디자인한 연 · legendary
- "Yutnori with friends" 친구들과 윷놀이 · legendary
- "Song I sang" 내가 부른 노래 · legendary
- "Dance I made up" 내가 만든 춤 · legendary
- "Paper crane wish" 종이학 소원 · legendary
- "My Hangul Route Journey" 나의 한글 여정 · legendary (the GRADUATION card — earned at full completion)

## 6. Ship-when triggers

Implement when **all** are true:
1. **Stage 7 self-expression content + activities authored**
2. **Personalization infrastructure** — `personalName` / `personalPaletteHex` propagation from profile-store
3. **Stage 6 beta complete**
4. **Privacy review** — Stage 7 introduces user-generated content (drawings + captions); privacy + COPPA review required

## 7. Dependencies

Upstream: F-CARD-S6-001, F-CARD-002, F-CARD-001, profile-store (✅ PR #13).
Downstream: **None** — this is the final card-content spec. Graduation milestone.
External: native-Korean editorial review; COPPA/PIPA privacy review (Stage 7 is the first stage involving user-generated content).
