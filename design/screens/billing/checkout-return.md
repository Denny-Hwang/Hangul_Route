# Checkout return: waiting honestly for the payment to land (screen spec v1)

Spec: `docs/specs/F-BILL-002-billing-in-app-all-personas.md` sections 4.5, 4.12, 8 · wireframe `design/wireframes/billing/checkout-return.md`
Mock: `mock/checkout-return.html` (board, eight states) · shots `shots/checkout-return-375.png`, `-1280.png`, `-320-text200.png`
Code (B-8b): the billing page (`billing-home.md`) with the pure state machine `apps/web/src/lib/console/checkout-return.ts` (B-7): `readCheckoutReturn` and `cleanedReturnSearch` (into `history.replaceState`), `initialReturnState`, `returnStep`, `shouldPoll` (every `CHECKOUT_POLL_MS`, at most `CHECKOUT_POLL_MAX` per round), `returnNotice`, `busyCardId`, `focusCardId`.

## Where it sits

A state of the billing home, not a page of its own. The notice goes directly under the mode banner and above every other note and the cards. The board draws each state on the parent's family example ("Kim family", buying the Family Plan in test mode).

The notice: the console `Notice` (`role="status"`, `aria-live="polite"`, one region for every state, so each change is announced once). Text from `returnNotice(state).text`; its button, when there is one, from `.action.label` (secondary). It has no close button and is gone after the next navigation.

## States (board order, all from `returnStep`)

| # | Phase | Notice | Glyph and tone | The card for `id` |
|---|---|---|---|---|
| 1 | checking | "Almost there: checking your plan." | `replay` (static), info | outlined (D8); the offer's button and Apply code disabled; `aria-busy="true"` |
| 2 | done | "Thank you. The plan is active. Learners get it the next time they open Hangul Route." | `check-circle` in `feedback.successDark`, success tone | outlined; now "Family Plan", "Renews on Oct 12, 2029"; Manage enabled; **focus moves to its h3** (`tabindex="-1"`) |
| 3 | done, no learner yet | as 2 | as 2 | as 2, with "Next: connect a learner to this family." and **Connect a learner** |
| 4 | stillProcessing (10 checks, about 20 s) | "Your payment went through. The plan shows here in a minute." + **Check again** | info, no error tone | outlined; buttons disabled (still waiting) |
| 5 | offline | "You're offline. Plans and receipts need a connection." + **Try again** | info | outlined; buttons disabled; checks paused, attempts kept; resumes on `online` |
| 6 | error | "Can't check your plan right now." + **Try again** | info | outlined; buttons disabled; the payment line is not repeated |
| 7 | cancelled | "Nothing was charged." | info | as before, no outline, buttons enabled |
| 8 | done-unknown (no `plan` / `id`) | the done line after one reload | success tone | no outline (no target), focus stays where it was |

- The page never claims an active plan before a summary shows the bought plan active on that card.
- While a state waits (1, 4, 5, 6) `busyCardId` names the card, so its buy, Manage and Apply code stay disabled: no second purchase meanwhile. Other cards keep working.
- **Check again** starts one more round of ten checks; **Try again** resumes checking.

## Accessibility

- One polite live region, announced once per state change; the glyphs are decoration (`aria-hidden`), the words carry the state.
- Done moves focus to the bought space's card heading, which reads "Family · Kim family" followed by its new plan line.
- The outline is a shape cue (`borderWidth.thick`, `brand.secondary`, 5.20:1 on paper) next to the notice's words, never colour alone.
- No motion: the checking glyph does not spin.
