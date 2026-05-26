# Launch FAQ — One-line answers

> Have this open in another tab on launch day. When a commenter asks,
> paste the answer, then add one sentence of warmth.

---

## Product

**Q. What is Hangul Route?**
A. A Korean language learning app for English-speaking kids 5–11,
built especially for heritage families.

**Q. What makes it different from Duolingo Kids?**
A. Duolingo teaches vocabulary. Hangul Route teaches a child's
relationship with their heritage — one collectible culture card at a
time. And no red feedback colors, ever.

**Q. How is it different from LingoKids?**
A. LingoKids is generalist (many languages, mostly English). We're
Korean-only, heritage-first, and the reward is a 30-card Korean
culture collection — not stickers.

**Q. Why a tiger guide named Hoya?**
A. Korean folklore opens with "Long ago, when tigers smoked tobacco…"
The tiger is Korea's grandparent character. Hoya is a young one — so
kids meet a peer, not an authority.

---

## Audience

**Q. Is this only for Korean-American kids?**
A. No. The primary audience is heritage families (P4) — Korean parents
raising English-speaking kids. The secondary audience is *any* English-
speaking kid curious about K-culture (P5).

**Q. Will my 4-year-old like it?**
A. We tested with 5-year-olds. 4 is technically possible but the
fine-motor mini-games (tracing) feel hard. We'd say wait until ~5.

**Q. What about 12+ kids?**
A. Stage 1 will feel young for them. Stage 3 (sentences, ships later)
is designed with 10–14 in mind.

**Q. Adults learning Korean?**
A. Not yet. Adult mode is a P3 consideration after Stage 3 ships.

---

## Pedagogy

**Q. What romanization standard?**
A. Revised Romanization (RR), the South Korean government standard.
McCune-Reischauer feels old-fashioned to kids.

**Q. Standard Korean? Dialect?**
A. Seoul standard. Dialect packs (Gyeongsang, Jeolla) are P3.

**Q. Voice recognition?**
A. Not in the launch build. Children's STT accuracy at 5 is a coin
flip, and a coin-flip wrong-answer is the worst possible UX for a
learner. We'll ship it once we have a model trained on kids' voices.

**Q. North Korean?**
A. South Korean script only. Hangul itself is the same; vocabulary
choices differ — and we're teaching the version of Korean a heritage
family in Toronto or Sydney is most likely to use.

**Q. How long is a session?**
A. One quest = ~5 minutes. Most parents tell us their kid does 1–3
quests per session, then asks for more.

---

## Trust & privacy

**Q. Is this COPPA compliant?**
A. Yes. No third-party ad tracking, no PII on children, default mode
keeps learning data on-device. Parent email is the only PII stored.

**Q. GDPR?**
A. Yes. EU users can request export/delete via in-app settings or
email.

**Q. Do you sell data?**
A. No. We have a written policy banning it. Revenue is from in-app
purchases only.

**Q. Ads?**
A. Never. No ads, ever.

**Q. Offline play?**
A. Yes. After first sync, the whole Stage 1 plays offline.

---

## Pricing & access

**Q. How much?**
A. First 12 cards are free. After that, 12-card packs at $4.99
in-app. Lifetime full access at $29 (PH launch promo: $19).

**Q. Family plan?**
A. Up to 3 child profiles per account, no extra charge.

**Q. School / classroom pricing?**
A. Yes — DM us. We're working with two Korean heritage schools in beta.

---

## Tech

**Q. What's the stack?**
A. Expo React Native + Cloudflare Workers + D1. Turborepo monorepo,
TypeScript strict, vitest for unit and Detox for E2E. Hoya's
dialogue pool lives in a versioned content schema (zod).

**Q. Open source?**
A. Content schema and design system are MIT (planned). App code is
private for now. We may open more if there's interest.

**Q. Why React Native + Cloudflare?**
A. Solo-dev economics: zero infra cost while audience is < 10k, type-
safe end-to-end, deploy in 90 seconds. Easy to scale to native modules
if STT or animation needs demand it.

**Q. Why not Flutter / SwiftUI?**
A. Solo team. RN gives mobile + web from the same codebase. The trade-
off is animation polish, which we mitigate with Lottie and a tight
motion-token spec.

---

## Roadmap

**Q. When does Stage 2 ship?**
A. Stage 2 has a taste (one episode) at launch. Full Stage 2 in ~3
months.

**Q. iPad / tablet?**
A. The layout already scales. A dedicated iPad UX (split-screen with
a parent panel) is P2.

**Q. Android?**
A. Expo Go + APK available at launch. Native Play Store build in D+7.

**Q. Apple Watch?**
A. No.

**Q. Will there be a parent dashboard?**
A. Yes — basic version at launch (apps/web), full report-card-style
dashboard in 6–8 weeks.

---

## Founder

**Q. Who built this?**
A. One person, evenings and weekends, for 12 months. I'm not Korean,
but I grew up in a heritage family and watched both my parents
struggle to give me the language. This is for the next kid.

**Q. Did you use AI?**
A. Yes — to draft Hoya's dialogue variants and to validate content
JSON against schemas. All Korean voice acting is human. All cultural
content was reviewed by two native Korean editors.

**Q. Funding?**
A. Bootstrapped. No outside money. May raise pre-seed after Stage 3.

**Q. How can I help?**
A. Three ways: (1) try it and tell me what your kid did or didn't
keep playing, (2) introduce me to a heritage Korean teacher, (3)
share a card you wish existed.

---

## "Looks like a clone" rebuttals

**Q. This is just Pororo Korean?**
A. Pororo is great — it's a *story* app. We're a *quest* app. The
reward is collection, not narrative consumption.

**Q. This is just Eggbun?**
A. Eggbun is for adults and uses chat. We're for kids 5–11 and use
mini-games + cards. Different age, different verb.

**Q. This is just Duolingo with a tiger?**
A. The tiger is real (Hoya). The differences run deeper — anti-shame
contract, heritage-themed reward loop, 5–11 age band, English-only UI.
But yes, if "Korean Duolingo for heritage kids" helps you grok it,
we'll take that summary.
