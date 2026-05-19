# Spacer

**The breathing room.** Reference brief — no visual prompt needed.

## 1. Context

`Spacer` is a pure layout helper that renders a sized `View` to push siblings apart on the spacing scale. There is no visual to design — it is invisible.

This brief exists only to confirm the spacing scale is respected.

## 2. Spec

Props:
- `size` ∈ {`none` 0, `xxs` 2, `xs` 4, `sm` 8, `md` 12 (default), `lg` 16, `xl` 24, `xxl` 32, `xxxl` 48, `jumbo` 64}
- `flex` boolean — if true, fills remaining space (used to push content to top/bottom)

The 10 spacing tokens are authoritative — never use raw numeric padding/margin in screens. Every gap is one of these values.

## 3. Visual contract

- 4pt sub-grid (xxs=2, xs=4, sm=8 …)
- 8pt grid for layout (md=12 is the visual default; lg=16 / xl=24 for sections)
- No fractional values

## 4. Anti-patterns

- Hardcoded `marginTop: 17` or any value not in the scale
- Spacer with non-Spacer siblings using inline gaps simultaneously (pick one)

## 5. No Claude Design prompt

Skip — this is an invisible component.

## 6. Output path

- (no output)
