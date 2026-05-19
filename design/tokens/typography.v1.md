# typography v1

**Authoritative type scale for Hangul Route.** Mirrors `packages/design-system/src/tokens.ts` (`typography` export).
Drift detected by `.github/workflows/design-token-sync.yml`.

Last updated: 2026-05-19 · Version: v1

---

## Family

| Token | Value | Use |
|---|---|---|
| `family.sans` | `System` | Default UI font (system fallback for v1; custom font deferred) |
| `family.sansKr` | `System` | Korean text (same family — bumps size tier when prominence needed) |
| `family.display` | `System` | Display headings |
| `family.mono` | `Menlo, Courier, monospace` | Reserved (rare; code samples in parent dashboard) |

System fallback CSS stack on web:
```
-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif
```

## Size scale

Body floor is **18sp** — non-negotiable for 5–7 yo legibility.

| Token | Size (sp) | Use |
|---|---|---|
| `size.caption` | 14 | Helper text, age chips, captions |
| `size.bodySm` | 16 | Secondary body |
| `size.body` | 18 | **Floor for all reading text** |
| `size.bodyLg` | 20 | CTAs, emphasis body |
| `size.prompt` | 22 | Hoya speech, quiz prompts |
| `size.title` | 28 | Section headers |
| `size.display` | 36 | Page titles, results |
| `size.hero` | 48 | Landing hero, jamo display |

## Weight

| Token | Value |
|---|---|
| `weight.regular` | 400 |
| `weight.medium` | 500 |
| `weight.semibold` | 600 |
| `weight.bold` | 700 |

Only these 4 weights — no 300 (light), no 800 (extrabold).

## Line height (`leading`)

| Token | Value | Use |
|---|---|---|
| `leading.tight` | 1.15 | Display, hero |
| `leading.normal` | 1.35 | Body, default |
| `leading.relaxed` | 1.55 | Long-form reading |

## Letter spacing (`tracking`)

| Token | Value | Use |
|---|---|---|
| `tracking.tight` | -0.4 | Display headings |
| `tracking.normal` | 0 | Default |
| `tracking.wide` | 0.4 | Caption / chip labels |

---

## Rules

1. **No raw font-size literals** — always reference `typography.size.<key>`.
2. **Body floor 18sp** — never use `size.bodySm` (16) for primary reading text.
3. **Korean text uses same scale** — does NOT auto-bump. Designers explicitly pick a larger size for Korean when prominence is needed (e.g., Korean word at `prompt` 22sp in HoyaBubble).
4. **Weights restricted to 4 values** — adding a fifth weight requires CLAUDE.md amendment.
5. **No italic** in production UI (italics reserved for captions / romanization slots).

## Promotion path

`design/tokens/typography.v1.md` → `packages/design-system/src/tokens.ts` (`typography` export) → components consume via `typography.size.<key>` / `typography.weight.<key>` / `typography.leading.<key>`.
