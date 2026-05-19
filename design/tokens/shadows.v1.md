# shadows v1

**Authoritative elevation / shadow spec for Hangul Route.** Mirrors `packages/design-system/src/tokens.ts` (`shadows` export).
Drift detected by `.github/workflows/design-token-sync.yml`.

Last updated: 2026-05-19 · Version: v1

---

## Scale

Soft, warm-dark tinted (never pure black). Three tiers + none.

| Token | Recipe | Use |
|---|---|---|
| `shadows.none` | `none` | Flat surfaces, no elevation |
| `shadows.card` | offset(0, 2) blur 8, color #2A1F14 @ 6%, elevation 2 | Default card layer |
| `shadows.raised` | offset(0, 4) blur 16, color #2A1F14 @ 10%, elevation 6 | Highlighted card, raised CTA |
| `shadows.modal` | offset(0, 12) blur 32, color #2A1F14 @ 18%, elevation 12 | Modals, sheets, parent gate |

## React Native / iOS shadow object

```ts
shadows.card = {
  shadowColor: '#2A1F14',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 8,
  elevation: 2,
}
```

The `elevation` field is the Android Material Design counterpart; iOS uses the `shadow*` fields. Both ship together so a single style object works cross-platform.

## CSS equivalent (web)

```css
/* card */
box-shadow: 0 2px 8px rgba(42, 31, 20, 0.06);

/* raised */
box-shadow: 0 4px 16px rgba(42, 31, 20, 0.10);

/* modal */
box-shadow: 0 12px 32px rgba(42, 31, 20, 0.18);
```

---

## Rules

1. **No raw shadow literals** — always reference `shadows.<key>` from tokens.
2. **Shadow color must be `#2A1F14`** (warm-dark `text.primary`), never pure black `#000000`.
3. **Opacity tiers are fixed** — 6% / 10% / 18%. Adding a tier requires CLAUDE.md amendment.
4. **No inset shadows** in v1 (reserved for form input focus states in v2).
5. **`shadows.none`** is the default — only apply elevation when the surface needs to read as "above" its background.

## Promotion path

`design/tokens/shadows.v1.md` → `packages/design-system/src/tokens.ts` (`shadows` export) → components consume via `shadows.<key>` (spread into RN Animated style or inlined as `box-shadow` CSS).
