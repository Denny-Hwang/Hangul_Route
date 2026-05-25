# motion v1

**Authoritative motion (duration / easing) spec for Hangul Route.** Mirrors `packages/design-system/src/tokens.ts` (`motion` export).
Drift detected by `.github/workflows/design-token-sync.yml`.

Last updated: 2026-05-25 · Version: v1

---

## Duration

Milliseconds. Calm and quick — kids lose the thread when motion drags (`docs/design/interaction-patterns.md`: "전환 120–300ms, 1초 넘지 않기").

| Token | ms | Use |
|---|---|---|
| `motion.duration.instant` | 60 | Press-down / immediate touch reaction |
| `motion.duration.fast` | 120 | Small state changes (tile select, toggle) |
| `motion.duration.base` | 200 | Default transition; correct-answer feedback |
| `motion.duration.slow` | 320 | Screen / sheet transitions (upper bound for everyday motion) |
| `motion.duration.crawl` | 600 | Deliberate emphasis (answer reveal hold-in) |
| `motion.duration.celebration` | 900 | Reward / star / card-unlock celebration (stays < 1s) |

## Easing

Cubic-bezier curves. Ease-out (decelerate) is the default for entrances — natural settle (`interaction-patterns.md`: "Ease-out 우선").

| Token | Curve | Use |
|---|---|---|
| `motion.easing.standard` | `cubic-bezier(0.2, 0, 0, 1)` | General transitions |
| `motion.easing.decelerate` | `cubic-bezier(0, 0, 0, 1)` | Entrances (element appears / settles) |
| `motion.easing.accelerate` | `cubic-bezier(0.3, 0, 1, 1)` | Exits (element leaves) |
| `motion.easing.bouncy` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Celebration only (star pop, card flip) |

## React Native (Animated / Reanimated)

```ts
import { motion } from '@hangul-route/design-system';

Animated.timing(value, {
  toValue: 1,
  duration: motion.duration.base,        // 200
  easing: Easing.bezier(0.2, 0, 0, 1),   // motion.easing.standard
  useNativeDriver: true,
}).start();
```

## CSS equivalent (web)

```css
transition: transform 200ms cubic-bezier(0.2, 0, 0, 1); /* base + standard */
```

---

## Rules

1. **No raw duration/easing literals** — always reference `motion.duration.<key>` / `motion.easing.<key>`.
2. **Everyday motion stays 120–320ms.** `instant` is for press reactions only; `crawl` / `celebration` are reserved for emphasis and reward moments.
3. **Respect `prefers-reduced-motion`** — when reduced, drop scale/shake/translate and apply the end state immediately; color/icon feedback still fires (`interaction-patterns.md`).
4. **`bouncy` is celebration-only** — never on routine transitions (overshoot reads as a bug in normal UI).
5. **Adding a duration step or easing curve requires a CLAUDE.md amendment** (keeps the scale shared and small).

## Promotion path

`design/tokens/motion.v1.md` → `packages/design-system/src/tokens.ts` (`motion` export) → components consume via `motion.duration.<key>` / `motion.easing.<key>` (RN `Animated`/`Easing` or CSS `transition`).
