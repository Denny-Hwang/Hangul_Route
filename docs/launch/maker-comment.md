# Maker Comment (post within 4 hours of PH go-live)

> Length target: 180–220 words. PH algorithm rewards comments that get
> replies — write the kind of thing strangers want to respond to.

---

## Draft v1 — "Heritage story" (recommended primary)

> Hi Hunters 👋
>
> I'm the solo maker behind Hangul Route. I built this because of a
> conversation I overheard at a friend's house, where her 6-year-old
> daughter asked her halmeoni why her words "sounded different." Her mom
> couldn't explain. There wasn't an app that could either.
>
> So I made one. **Hangul Route** is a Korean learning app for English-
> speaking kids 5–11 — built especially for *heritage families* whose
> children are growing up without the language. It's not flashcards. It's
> a 7-stage × 5-theme journey across Korean letters, food, holidays,
> nature, and crafts. Every letter your child learns earns a real
> Heritage Card — from puppy (강아지) to Korea's national flower (무궁화)
> to the spinning top (팽이) every Korean grandparent remembers.
>
> Hoya, a young tiger, guides every quest. He never says "wrong."
>
> What's here today:
> • Stage 1 fully built (24 letters + 24 culture cards)
> • 8 mini-games, none of which feel like school
> • Mobile-first; English UI, Korean as the target language only
>
> Free for the first 12 cards. No ads, ever.
>
> I'd love to hear what you'd want for your kids — or, if you're a
> heritage adult yourself, what you wish *you* had at six.
>
> — Sungjoo

---

## Draft v2 — "Builder transparency"

> Hi PH 👋
>
> I'm a solo developer and this is my first launch. Hangul Route is a
> Korean language app for kids 5–11 — but specifically for the audience
> I couldn't find an app for: **heritage kids in English-speaking
> families**.
>
> Why now? Because K-culture is now the entry point, not Korean class.
> Kids are curious. The app meets them where they are.
>
> The grid: 7 stages × 5 themes. Kids draw their own *Route* through it.
> Letters → words → sentences → dialogues → stories → real-use → self-
> expression. Today, Stage 1 (Hangul) is fully built: 24 letters, 24
> heritage cards, 8 mini-games, one tiger named Hoya.
>
> Built on Expo + Cloudflare Workers. Fully type-safe content schema.
> No red feedback colors — the anti-shame contract is in the design
> tokens. Open to anyone who wants to peek at the architecture.
>
> What I'd love from PH:
> 1. Try a quest, tell me which one your kid kept playing.
> 2. Tell me what *you* wished you had at six.
>
> Thank you for being here on launch day.
> — Sungjoo

---

## Draft v3 — "What I cut" (PH builders love this)

> A long list of features I cut to ship this:
>
> • Voice recognition for kids (paused — STT accuracy at age 5 is a coin
>   flip, the worst possible UX for a learner)
> • Streak shame ("Duo is sad") — replaced with a soft Hoya nudge
> • Red error states — replaced with amber, codified into the design
>   tokens
> • Parent dashboard depth — kept it to one screen for launch
> • Subscription paywall — free for the first 12 cards, then 12-card
>   packs at $4.99
>
> What I kept:
>
> • 8 mini-games, each tied to a learning-science skill family
> • 24 heritage cards in Stage 1 — each one a small Korean cultural
>   moment (Arirang, Chuseok's full moon, K-pop, the tiger)
> • Hoya, a tiger guide whose dialogue pool was hand-written one line
>   at a time
>
> If you're building for children, ask me anything about why I removed
> the red.
>
> — Sungjoo

---

## Pick

**Default**: v1. Switch to v2 if early PH crowd skews builder-heavy.
**v3 is the "second comment"** you post 4–6 hours in, to keep the
thread alive.

## Reply templates (have ready)

| Likely comment | Reply (under 60 words) |
|---|---|
| "Looks like Duolingo for kids" | "Two big differences: Duolingo teaches vocab, we teach a relationship with heritage. And we never use a red color or 'wrong' — kids 5–11 can't take that." |
| "Is the audio accurate?" | "Pronunciation is your device's Korean voice today; recordings by a native speaker are in progress. Romanization is Revised, not McCune-Reischauer." |
| "Can I try it on Android?" | "Yes — Expo Go QR + APK are both linked at hangulroute.com/get. Native Play Store build lands D+7." |
| "What about adults learning Korean?" | "Not yet. The whole design assumes a 5–11 year old. We'll consider an adult mode once Stage 3 (sentences) ships." |
| "How do you make money?" | "Stage 1 is free. The Family Plan is $15.30 a year for up to 5 learners, cancel any time; classes have a yearly Group License. No ads. No data sold." (Before Stripe Live: "Stage 1 is free. No ads. No data sold. Plans are coming.") |
| "Is this COPPA compliant?" | "Child safety comes first: no ads, no third-party ad tracking, and our Privacy Policy is with legal counsel for review. Each learner's nickname and progress are backed up to our servers so a Rescue Code can restore them. A class or family a learner joins sees the name they join with and their progress." |
