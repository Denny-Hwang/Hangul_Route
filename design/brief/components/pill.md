# Pill

**The small chip / badge.** Theme tags, age groups, status labels.

## 1. Context

Used on Episode detail (stage/theme pills), Library cards (rarity), Homework cards (assigned-by), Profile cards (age group), HomeScreen header (streak/cards/stars summary). 6 tones × 2 sizes.

## 2. Layout

- Pill shape (`radii.pill`)
- Horizontal padding: sm `sm`(8) · md `md`(12)
- Vertical padding: sm `xxs`(2) · md `xs`(4)
- Label: sm `caption`(14) · md `bodySm`(16), weight 600
- Self-aligned to flex-start by default
- No icon support in v1

## 3. Tones

| Tone | Background | Label |
|---|---|---|
| `neutral` | `surface.sunken` #F2EBDE | `text.secondary` #5C4A36 |
| `primary` | `brand.primaryLight` #FAD9C6 | `brand.primaryDark` #B5562A |
| `secondary` | `brand.secondaryLight` #CDE5F4 | `brand.secondaryDark` #2E72A3 |
| `success` | `feedback.successLight` #D6EFDF | #2F6A47 |
| `nudge` | `feedback.nudgeLight` #FCEED1 | #B5862A |
| `info` | `feedback.infoLight` #D9E5FB | #2E5BC7 |

## 4. Anti-patterns

- Pills with hard borders (use tinted backgrounds only)
- Sharp corners
- Tone "nudge" used as a destructive marker (it's gentle, not alarming)
- Long labels (max 12 characters; longer needs a different component)

## 5. Claude Design prompt

```prompt
Create a Pill component sheet for Hangul Route. Output: one
1600 × 1000 PNG showing all pill variants.

Rows: 6 tones (neutral / primary / secondary / success / nudge / info)
Columns: 2 sizes (sm / md)

Pill spec:
- Pill shape (border-radius: 999px)
- Label centered, weight 600
- sm: 8px padding-x, 2px padding-y, 14sp label
- md: 12px padding-x, 4px padding-y, 16sp label
- No icon, no border

Tone colors (background / label):
- neutral: #F2EBDE / #5C4A36
- primary: #FAD9C6 / #B5562A
- secondary: #CDE5F4 / #2E72A3
- success: #D6EFDF / #2F6A47
- nudge: #FCEED1 / #B5862A
- info: #D9E5FB / #2E5BC7

Sample labels per tone (use real app labels):
- neutral: "Age 5-7" (sm) and "Coming soon" (md)
- primary: "Hangul" (sm) and "Stage 1" (md)
- secondary: "Letters" (sm) and "Theme A" (md)
- success: "Open" (sm) and "All done!" (md)
- nudge: "common" (sm) and "Try again" (md)
- info: "rare" (sm) and "Heritage card" (md)

Background canvas: warm hanji cream #FCF8F1.
Row labels on left in #5C4A36 16sp identify the tone.
Column labels on top: "sm" and "md".

Anti-patterns:
- Sharp corners (must be pill)
- Hard borders
- Labels with > 12 characters
- Tone "nudge" rendered as red (it's amber, gentle)

Deliverable: 1600 × 1000 PNG pill sheet.
```

## 6. Output path

- `design/components/Pill/variants__v1__YYYY-MM-DD.png`
