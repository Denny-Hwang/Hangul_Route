# Heritage story research — verified drafts (not shipped yet)

24 story episodes about Korean heritage, researched and fact-checked for the story mode (F-STORY-001/002/005). They are **research files**: the app does not read them yet. F-STORY-001 defines the schema and the one-time importer that turns them into `content/stories/*.json` and the generated app module.

| Cluster | Episodes | Facts | Source entries |
|---|---|---|---|
| `records-joseon` — Annals of the Joseon Dynasty, Seungjeongwon Ilgi, Ilseongnok, Uigwe | 6 | 53 | 146 |
| `hangul-printing` — Hunminjeongeum, Jikji, Tripitaka Koreana, Janggyeong Panjeon | 6 | 52 | 148 |
| `science-art-life` — rain gauge, sundial, water clock, Donguibogam, Nanjung Ilgi, Kim Hong-do | 6 | 45 | 118 |
| `seasons-tales` — Seollal, Dano, Chuseok, Gimjang/Arirang, Sun and Moon, pansori tales | 6 | 61 | 164 |

## Accuracy process (owner requirement: no wrong information, exact references)
Every cluster went through **three independent passes**, run by different agents:
1. author (online research, every fact with sources);
2. fact-check A and fact-check B in parallel, neither seeing the other (B used different sources and also checked Korean, Revised Romanization, child-suitability and the quizzes);
3. a reviser who applied or *rejected with evidence* each issue (a wrong suggestion was rejected, e.g. the 서운관 romanization);
4. a **third final checker** who re-opened every cited source (incl. Internet Archive copies for unesco.org and the heritage portal's data files), hunted the remaining unverifiable items, and made only minimal sourced corrections.

Each `*.final.json` carries `verification: { passes: 3, checked_at: "2026-10-10" }`. For each cluster:
- `*.signoff.md` — facts verified, corrections made in the final pass, remaining uncertainty, sign-off per episode;
- `*.changes.md` — every issue raised by checkers A and B and how it was resolved, and the list of items that stayed unverifiable.

## Rules these files follow
- Every factual narration sentence maps to a `facts[]` entry with at least one authoritative source (국가유산청/국가유산포털, UNESCO, 국사편찬위원회 sillok/sjw, 한국민족문화대백과사전, national museums), with `title`, `publisher`, `url`, `accessed`, `quote_or_locator`.
- No numbered national-treasure designations in narration (국가유산청 naming since 2021).
- Traditional tales (해님 달님, 흥부와 놀부, 토끼전) are labelled as traditional tales, not history, and are retold gently.
- Narration is at most 45 words per scene; Korean with Revised Romanization (unhyphenated) and a gloss.
- Quiz answer positions are varied; each question has one answer supported by a fact.

## Before an episode is shown to learners
- **Native language and culture review** of Korean text and tone: the multi-agent final review (owner decision 2026-10-12; two separate passes signed `reviewedBy: "MAR"`, see [F-STORY-001 §3.6](../../../docs/specs/F-STORY-001-story-schema-pipeline.md) and [docs/workflows/story-content-qa.md](../../../docs/workflows/story-content-qa.md)).
- Re-check the items listed under "remaining uncertainty" in the sign-off, in particular time-dependent facts: Haeinsa Janggyeong Panjeon visitor rules (haeinsa.or.kr) and the current location of the Hunminjeongeum Haerye (Kansong Art Museum).
- Where a source could only be read through an archive copy (unesco.org, heritage portal descriptions), spot-check it live in a browser.

## Read tiers of the listen-only stories (F-CURR-002 row CM-46a, 2026-10-31)
The ten stories that shipped with a listen tier only (`tripitaka-koreana`, `sillok-royal-historians`, `janggyeong-panjeon`, `jikji-metal-type`, `sillok-mountain-archives`, `nanjung-ilgi`, `seungjeongwon-ilgi-every-day`, `ilseongnok-daily-reflection`, `uigwe-royal-birthday`, `joseon-records-today`) gained a `read` tier that restates facts they already cite; no fact or source changed. `read-tiers.changes.md` lists every checker finding and its outcome, and `read-tiers.signoff.md` the third pass.

## Nature book 2 (F-CURR-002 row CM-46, 2026-11-04)
Three new readers for the Stage 5 Nature cell's book 2 (`jeju-volcanic-island`, `jirisan-national-park`, `suncheon-bay-wetland`), authored directly in `content/stories/` (no importer run). `nature-book2.sources.json` holds every fact with its quoted source words as opened on 2026-11-04, the pages that could not be read and the institutions' names as of that date; `nature-book2.changes.md` lists the checker findings and outcomes and `nature-book2.signoff.md` the third pass.

## Food book 2 (F-CURR-002 row CM-46, 2026-11-04)
Two new tales for the Stage 5 Food cell's book 2 (`episode:stage5-life-v2`, Volume 2, behind `volumes`): `jang-fermented-sauces` (jang-making; UNESCO 2024, Korea Heritage Service) and `tteok-through-the-seasons` (seasonal rice cakes; National Folk Museum of Korea, encykorea). They were authored directly as story files (no cluster `.final.json`); every fact carries its quotes. `life-book2.changes.md` lists every checker finding and its outcome, and `life-book2.signoff.md` the third pass.

## Letters book 2 tales (F-CURR-002 row CM-46, 2026-11-04)
`eongan-letters` and `hangul-name` were authored straight from allowlisted public-institution pages (no cluster research file): each fact cites the page it restates, with the quote and the access date. `letters-book2.changes.md` lists the sources and the author decisions; the multi-agent review appends its findings there and writes `letters-book2.signoff.md` before the two stories are signed.
