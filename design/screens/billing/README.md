# Billing screens: the learner Plan screen and the Profile plan card (design mock v1)

Spec: `docs/specs/F-BILL-002-billing-in-app-all-personas.md`, PR **B-9** in the section 12 table (sections 4.7, 4.8, 4.12, 6.2, 6.3, 8).
Wireframes: `design/wireframes/billing/plan-status.md` (this screen), `design/wireframes/billing/plan-status-free-lessons.md` (F-ENT-003's lines that E3-8 puts in the free slot later).
Built by: B-9 (`apps/mobile/src/screens/paywall/PaywallScreen.tsx`, the Profile plan card in `screens/profile/ProfileScreen.tsx`, the view models in `apps/mobile/src/logic/paywall.ts`).

## What is here

| File | What it fixes |
|---|---|
| `plan-status.md` | the screen's anatomy, every state on web and native, the Profile card, accessibility and what the code must never render |
| `mock/plan-status.html` | a static board of the states (nine screens, three Profile cards) on `mock/plan-status.css`, which reuses the token custom properties of `../learning-route/mock/learning-route.css` |
| `shots/` | the board rendered in Chromium at 2x: `plan-status-375.png`, `plan-status-1280.png`, and `plan-status-320-text200.png` (browser text size 200 %; no sideways scroll at 320) |

**The mock is a design reference, not shipped code.** Every value is a token of `packages/design-system/src/tokens.ts`. Every drawn string is a dictionary value of `caregiver.plan.*`, `learner.profile.plan.*` or `a11y.planStatus` (B-6, #402), word for word. Learner and space names (Mina, Rio, Sunday Class A, Maple School) are examples. Hoya is the static port used by the Learning Route mock (poses `idle` and `cheering`).
