# Screen 16 — Card Detail (modal)

**The hero card view.** Tap a Library card → see its art, hear its Korean.

## 1. Context

- **When**: tap any card in Library (unlocked or locked).
- **Goal**: showcase the card art + Korean word + fun fact + audio playback.
- **Success**: child taps "Hear it" + remembers the word.

## 2. Layout

```
┌─────────────────────────────────────┐
│ ×                                    │
│                                      │
│        [rarity pill]                 │
│        ┌─────────────────┐           │
│        │                  │           │
│        │  Card illustr.   │           │
│        │  (large hero)    │           │
│        │                  │           │
│        └─────────────────┘           │
│                                      │
│        Tiger                         │
│        호랑이                        │
│        horangi                       │
│                                      │
│ ┌────────────────────────────────┐ │
│ │ The proud Korean tiger — Hoya   │ │
│ │ is one!                          │ │
│ │                                  │ │
│ │ 💡 Tigers appear in many Korean │ │
│ │    folk tales.                   │ │
│ └────────────────────────────────┘ │
│                                      │
│ [Hear it (lg secondary)]             │
└─────────────────────────────────────┘
```

## 3. Visual style

- Close × icon top-left (modal)
- Big "card" container: paper, 4px rarity border, 24px radius — fills 60% width
- Inside: rarity pill top + illustration zone (theme-tinted background) + Korean word + romanization + English title
- Below the card: content Card with blurb + fun fact
- Bottom: "Hear it" secondary CTA (TTS replay)

## 4. Exact copy

- Rarity pill: dynamic (common / uncommon / rare / legendary)
- Card title: from `apps/mobile/src/content/heritage-cards.ts`
- Korean + romanization: same source
- Blurb: same
- Fun fact: prefixed with 💡 emoji
- CTA: **"Hear it"**

## 5. Claude Design prompt

```prompt
Design the Card Detail (modal) screen for Hangul Route. Output: 1170 ×
2532 PNG showing the LEGENDARY "Tiger" card (호랑이) unlocked state.

Layout (top to bottom, 48px horizontal padding):

1. 60px status bar
2. Close × icon top-left (84sp tap target) color #2A1F14
3. 48px gap

4. Hero card container (centered, 75% width):
   - Card paper md, fill #FFFFFF, 12px border #E8743B (legendary
     rarity), 72px radius (radii.xl), 48px padding
   - Centered column inside:
     • Rarity pill: "legendary" — sm nudge tone (fill #FCEED1 text
       #B5862A)
     • 36px gap
     • Illustration zone: 600 × 600 sp square, fill #7BB552 (nature
       theme tint), 96px radius, centered:
       - Inside: a big Hoya/tiger illustration (use the v1 Hoya
         character cheering pose at 480 × 480, knocked out of the
         green background)
     • 48px gap
     • English title "Tiger" — 84sp display weight 700 #2A1F14
     • 12px gap
     • Korean "호랑이" — 84sp weight 700 #E8743B (brand-primary —
       Korean stands out)
     • 6px gap
     • Romanization "horangi" — 42sp italic #5C4A36

5. 48px gap

6. Body Card (Card paper md):
   - Blurb "The proud Korean tiger — Hoya is one!" — 60sp #2A1F14
   - 24px gap
   - Fun fact line: "💡 Tigers appear in many Korean folk tales." —
     42sp #5C4A36 italic

7. 48px gap

8. Hear-it CTA: lg secondary tone, full-width, 240sp tall, pill,
   #4A9DD6 fill, label "Hear it" white 60sp weight 600

9. 72px bottom safe-area

VARIANT (locked state):
- Card border in #E8DFCD (subtle, not rarity)
- Illustration zone fill #F2EBDE
- Inside: lock icon 240 × 240 sp #8A7860 centered
- No Korean/English/romanization shown
- No "Hear it" CTA
- Caption "Earn this card to see what's inside" at the bottom

Background: warm hanji cream #FCF8F1.

Anti-patterns:
- Card border using rarity even when locked (must use neutral subtle
  border when locked)
- "Hear it" CTA shown when locked
- Romanization larger than English title
- Pure black rarity pill text

Deliverable: 1170 × 2532 PNG showing legendary Tiger card unlocked.
```

## 6. Acceptance checklist

- [ ] 12px rarity border when unlocked
- [ ] Theme-tinted illustration zone (nature green for Tiger)
- [ ] Korean larger than English title (brand-primary color)
- [ ] Fun fact prefixed with 💡
- [ ] "Hear it" CTA secondary tone (sky blue)
- [ ] Close × not red

## 7. Output path

- `design/screens/library/card-detail-unlocked__v1__YYYY-MM-DD.png`
- `design/screens/library/card-detail-locked__v1__YYYY-MM-DD.png`
