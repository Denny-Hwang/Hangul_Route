# Hallway Test Protocol — Kids 5–11

> **Goal**: by D-6, watch 6 humans use Hangul Route for 30 minutes each,
> so we know what to ship vs. what to patch before PH D-0.
>
> **Sample size**: 3 children (ages 5–6, 7–8, 9–10) + 3 parents
> (one heritage Korean, one K-culture-curious, one bilingual).
> Six sessions in two days. Not statistically valid — diagnostically
> brutal.

---

## When + where

- **Days**: D-7 and D-6 of the PH sprint.
- **Where**: a quiet home, library, or church basement — **never** a
  café (the noise floor breaks audio cues).
- **Device**: iPad 10th gen or iPhone 14 in TestFlight. Always start
  the session with the app **logged out**, so each tester sees the
  cold path.

## What to bring

- The device, charged > 80% and on Do Not Disturb.
- A notebook (paper). No laptops in front of the kid.
- A second phone for recording — *audio only*. Confirm consent first.
- A small ㄱ→ㅎ printout the parent can keep as a souvenir.
- Snacks for the kid. Goldfish travels well.

## Consent + ethics (read once, out loud)

> "Hi [name]. I'm building a Korean learning app for kids your age.
> This is not a test — I'm trying to figure out if I built it right.
> Anything you say will help me make it better. If you don't like it,
> say so. If you want to stop, just say 'I'm done' and we'll stop.
> Is it OK if I write down what you do? You don't have to be nice."

For ages 5–8, ask the parent to be in the room but **silent** — the
parent can sit on the floor next to the kid but cannot prompt.

---

## The 30-minute script

### 0:00 — Intro (90s)

Hand over the device with the app icon visible on the home screen.
Say:
> "This app teaches Korean. Try it."

That's it. Do NOT explain the grid. Do NOT explain Hoya. The cold-
start moment is the test.

### 0:01 — First tap (5 minutes)

Watch. Write down:
- Where did the kid tap first?
- Did the kid wait for instructions, or jump in?
- At what second did the kid look up at you for help (the "lost
  glance")?
- If the kid says a Korean word out loud, write it down phonetically.

**Rule for you**: zero hints. If the kid asks "what do I do?" answer
"do whatever feels right." Two hint requests in a row = note it as a
showstopper.

### 0:06 — Onboarding (3 minutes)

Watch them through:
- Name entry — did they type their own name? Did the parent step in?
- Age selection — did they pick the right one or the biggest number?
- Avatar selection — did they vote with the cool colors or with the
  Hoya pose?

**Score**: how many seconds to complete the onboarding? Under 90s =
good. Over 180s = redesign the form.

### 0:09 — First quest (10 minutes)

The first quest is the make-or-break. Watch:
- Did they understand the 5-step structure (intro → present → practice
  → apply → reward)?
- Did the mini-game work on the first try?
- Did Hoya's amber feedback feel kind or confusing?
- Did the card-unlock moment land? Write down their reaction *exactly*
  ("oh!" / "cool" / nothing / "what?").

If they finish the quest, see if they ask for a second one without
prompting. That's the retention signal.

### 0:19 — Second quest or library (8 minutes)

If they ask: let them run another quest.
If they don't: ask "want to see your cards?" — observe whether the
Library feels like a reward or a chore.

### 0:27 — Exit interview (3 minutes)

Five questions, no follow-ups:
1. "Was that fun?" *(yes/no/kinda)*
2. "What was the best part?"
3. "What was the worst part?"
4. "Would you do this every day for a week?" *(yes/no)*
5. "Show me one thing that confused you." *(point at the screen)*

### 0:30 — Wrap

Thank them. Give them the souvenir printout. Tell them their name
won't be used. Pay the parent if it's a paid session
($25 gift card recommended).

---

## What to write down (the worksheet)

| Field | What goes here |
|---|---|
| **Tester id** | K-01, K-02, K-03 (kids), P-01, P-02, P-03 (parents) |
| **Age / role** | Kid: age. Parent: heritage / curious / bilingual |
| **Lost glances** | Count of times the tester looked up for help |
| **Hint requests** | Count of times they asked "what do I do" |
| **First-quest time** | Seconds from start to first card unlock |
| **Second-quest pull** | Did they ask for a second quest? Y/N |
| **Top moment** | One sentence — the funniest / warmest beat |
| **Bottom moment** | One sentence — the worst beat |
| **Showstopper?** | Did anything fully block them? Y/N + 1 line |
| **Verbatim quote** | The single best quote the tester said, intact |

Six rows. Single page. **You're done when the worksheet is full.**

---

## Triage rules (the day after)

After all 6 sessions:

1. **Anything that appears in 4+ "bottom moments"** → P0 fix tonight.
2. **Anything in 2–3 "bottom moments"** → P1, fix between D-5 and D-1.
3. **Anything in 1 "bottom moment"** → P2, ship and reassess after PH.
4. **Anything labeled "showstopper"** → STOP. Push the PH date back
   one week before shipping.

If you find a showstopper, that's a *blessing*, not a failure. The
purpose of hallway tests is to find them now, not in PH comments.

---

## What NOT to do

- Don't describe what you're trying to ship. The kid's reaction is
  the answer.
- Don't argue with a kid who hates it. Write it down, thank them,
  move on. Three hates is data; one is a bad day.
- Don't redesign mid-test. If shot 1 reveals a bug, finish shot 1,
  then patch overnight before shot 2.
- Don't optimize for the parent's polite "looks great" — kids tell
  the truth.

---

## Output artifacts

- 6 worksheets (1 page each)
- An audio recording per session (kept private, never shared on PH)
- One page of triaged findings, posted into the PR that fixes them.

Lands in `docs/launch/hallway-findings__YYYY-MM-DD.md` when complete.
