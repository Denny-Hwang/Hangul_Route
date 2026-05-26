# Launch Checklist — D-14 → D-0

> The full day-by-day schedule. Cross items off as you go. If you fall
> behind by more than 2 days, push the launch — never ship a half-built
> Product Hunt page.

---

## Week 1 — Content & assets

### D-14 (Mon)
- [ ] Final tagline + 60-char description (see `tagline-decision.md`)
- [ ] A/B with 5 heritage parents via text — pick a winner
- [ ] Stand up `docs/launch/maker-comment.md` draft v1

### D-13 (Tue)
- [ ] Confirm Stage 1 content (24 jamo + 24 cards) → already done ✓
- [ ] Read each card's `blurb` aloud — would a 7yo follow it?
- [ ] Replace any abstract phrase ("symbol of") with concrete ("looks like")

### D-12 (Wed)
- [ ] Brief Hoya illustration freelancer (Fiverr/Korean illustrator)
  - 3 poses: idle, cheer, curious
  - Deadline: D-9
  - Budget: $80–150

### D-11 (Thu)
- [ ] Wire feature flag `MINIGAME_VOICE_ECHO_ENABLED=false` for launch
- [ ] Implement 5 telemetry events (onboarding_started, first_card_earned,
  quest_completed, minigame_finished, session_ended)
- [ ] Verify events fire on Expo + reach Cloudflare Worker

### D-10 (Fri)
- [ ] Landing page (`apps/web/`) — full hero, How it works, card preview,
  mini-game gallery, FAQ, email signup, footer
- [ ] hangulroute.com DNS → Cloudflare Pages
- [ ] Email signup wired (ConvertKit / Buttondown / mailerlite)

### D-9 (Sat)
- [ ] Receive Hoya illustrations from freelancer
- [ ] Drop into `packages/design-system/src/assets/`
- [ ] Verify `HoyaBubble` shows the real character in apps/mobile

### D-8 (Sun)
- [ ] PH gallery images 1–3 (hero grid, card collection, mini-game collage)
  - Use Figma; export at 2× then downscale to 1280×720
- [ ] Save sources to `design/launch/`

---

## Week 2 — Validation & launch

### D-7 (Mon)
- [ ] Hallway test #1: 3 parents (45 min each)
  - Watch them install TestFlight without help
  - Watch their child finish 1 quest
  - Note every "huh?" moment
- [ ] Hallway test #2: 3 kids ages 5, 7, 10 (30 min each)

### D-6 (Tue)
- [ ] Triage hallway findings:
  - Showstoppers → fix today
  - Polish → schedule for D+7
- [ ] Push patch PR
- [ ] PH gallery images 4–5 (Hoya feedback moment, parent handoff)

### D-5 (Wed)
- [ ] Record 30-second video (see `video-storyboard-30s.md`)
- [ ] Edit in CapCut or Descript (free tier OK)
- [ ] Export 16:9 and 9:16

### D-4 (Thu)
- [ ] Bonus thumbnail GIF (card snap animation, 1.5s loop, 240×240)
- [ ] TestFlight build live, link tested on 3 devices
- [ ] Android: Expo Go QR + APK direct download both work

### D-3 (Wed)
- [ ] Finalize Maker Comment v1 (see `maker-comment.md`)
- [ ] Set up the 50-person cheering squad spreadsheet (name, TZ, confirmed)
- [ ] Individual text to all 50 (not a group blast — see `reddit-seeding.md`)

### D-2 (Thu)
- [ ] Soft seeding posts on:
  - r/SideProject (builder framing, OK to mention PH date)
  - r/Korean (heritage framing, do NOT mention PH)
  - r/KoreanAmerican (heritage framing, do NOT mention PH)
  - 5 Facebook heritage parent groups (heritage framing)
- [ ] Reply to *every* comment within 2 hours

### D-1 (Fri)
- [ ] Final QA pass — 3 full onboardings + all 9 mini-games once each
- [ ] Schedule PH submission for 12:01 AM PT (the standard launch slot)
- [ ] Confirm Hunter (or self-hunt) — see PH Hunter Reach
- [ ] Send "tomorrow at 12:01 PT" reminder to 50-person squad
- [ ] **Get 8 hours of sleep** — launch days are 16 hours long

---

## Launch Day (D-0)

### 12:01 AM PT — Go live
- [ ] Confirm PH page is up
- [ ] Post Maker Comment v1 within 10 minutes
- [ ] Tweet the PH link from personal + Hangul Route handles
- [ ] Post in Slack/Discord communities (see `reddit-seeding.md`)

### 12:00–4:00 AM PT — Squad window
- [ ] Reply to every comment within 5 minutes
- [ ] Track upvote velocity (PH dashboard refresh every 15 min)
- [ ] If we fall under 30 upvotes/hour, send a second squad text

### 6:00–10:00 AM PT — East Coast wave
- [ ] Tweet a behind-the-scenes shot (the Maker's desk, the cup of coffee)
- [ ] Post Maker Comment v2 (the "what I cut" comment)
- [ ] Reply to every new commenter, by name

### 10:00 AM – 5:00 PM PT — Europe + builder community wave
- [ ] Long-form X thread: "What I learned shipping a solo PH launch"
- [ ] Newsletter announcement to existing email list
- [ ] Reach out to 3 newsletters (Indie Hackers, makers' weekly, etc.)

### 5:00–11:00 PM PT — Asia wake-up + final push
- [ ] Post in Korean dev/parent communities (DCInside, Naver Café)
  with Korean copy (the *one* place we write in Korean)
- [ ] Final tweet at 10 PM PT thanking everyone
- [ ] Bed. PH closes at midnight PT.

### D+1 — Retro
- [ ] Final upvote count, final ranking
- [ ] List every commenter who asked a question — reply within 24h
- [ ] Schedule a 1-week retro: what surprised you, what to ship next

---

## What success looks like

| Tier | Upvotes | Comments | Action |
|---|---|---|---|
| **Hit** | 800+ | 50+ | Push for "Featured" — apply for PH newsletter |
| **Good** | 400–800 | 20–50 | Solid debut. Convert traffic to email list |
| **Soft** | 150–400 | 5–20 | Reset, repost in 6 weeks with Stage 2 |
| **Miss** | < 150 | < 5 | Honest retro. Was it the product or the launch? |

Target for D-0: **500 upvotes, 30 comments, 200 email signups, 100
TestFlight installs**.

---

## What you'll be tempted to do and shouldn't

- ❌ Tweet "Please vote" — kills authenticity, PH algorithm penalizes
- ❌ Sock-puppet upvotes — PH detects and bans
- ❌ Ship a "fix" mid-launch — pushes will surprise installers
- ❌ Argue with negative commenters — say "good point, will think"
  and move on
- ❌ Stay up past midnight PT — the launch day is over, rest matters
  more than the next 100 upvotes
