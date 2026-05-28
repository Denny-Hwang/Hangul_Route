# Launch — Product Hunt D-14 → D-0

This folder holds every artifact needed to launch Hangul Route on Product Hunt.
Everything in here is **copy you can paste**, not strategy theory.

## Files

| File | Use when |
|---|---|
| `tagline-decision.md` | Picking the one PH tagline + the 60-char description |
| `maker-comment.md` | Posting the first comment on the PH page (within 4h of launch) |
| `gallery-spec.md` | Briefing the designer / yourself on the 5 gallery images |
| `video-storyboard-30s.md` | Recording the 30-second demo video, shot by shot |
| `reddit-seeding.md` | Posting pre-launch maker stories on Reddit & Facebook groups |
| `faq.md` | One-line answers to every question PH commenters will ask |
| `launch-checklist-d14-d0.md` | Daily checklist from D-14 to launch day |
| `hallway-test-protocol.md` | 6-session script + worksheet for kids 5–11 (D-7) |
| `parent-interview-guide.md` | 5-parent 30-min interview script + triage rules |

## Design assets — handled in-house via Claude Design

The visual side of this launch is **not outsourced**. Every asset listed
in `gallery-spec.md`, `video-storyboard-30s.md`, and the FAQ's "anti-shame"
imagery is produced through Claude Design sessions, driven by the
paste-ready prompts in [`design/launch/`](../../design/launch/).

| `docs/launch/` asset | Claude Design prompt |
|---|---|
| `gallery-spec.md` Images 1–5 | `design/launch/02-ph-gallery-5-slides.md` |
| `gallery-spec.md` Bonus GIF | `design/launch/04-thumbnail-gif.md` |
| `video-storyboard-30s.md` shots 1–10 | `design/launch/05-video-keyframes.md` |
| `faq.md` / `maker-comment.md` "Hoya never says wrong" | `design/launch/01-hoya-three-poses.md` |
| `content/episodes/stage-1/cards.json` (24 cards) | `design/launch/03-card-illustrations-24.md` |

App icon, splash, store screenshots, and the canonical Hoya 5-pose sheet
remain in [`design/brief/`](../../design/brief/) — that library predates
this launch and stays the source of truth for in-app art.

## Operating principle

> **PH is not a feature showcase. It's a 24-hour story.**
> Every artifact in this folder serves the same story:
> *"A solo dev made a Korean-learning app for heritage kids — and finally,
>  their grandparents and their iPhone speak the same language."*

If a piece of copy doesn't serve that story, cut it.

## Status

- [ ] Tagline locked (A/B with 5 parents)
- [ ] Gallery image #1 (hero) shipped
- [ ] Gallery image #2 (card grid) shipped
- [ ] Gallery image #3 (mini-game collage) shipped
- [ ] Gallery image #4 (Hoya feedback moment) shipped
- [ ] Gallery image #5 (parent handoff) shipped
- [ ] 30s demo video recorded + edited
- [ ] Maker comment drafted
- [ ] 50-person cheering squad calendar-invited
- [ ] PH Hunter confirmed (or self-hunt)
- [ ] Reddit + Facebook groups warmed up
- [ ] TestFlight live + Expo Go QR ready
