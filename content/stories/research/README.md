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
- **Native review** of Korean text and tone (owner).
- Re-check the items listed under "remaining uncertainty" in the sign-off, in particular time-dependent facts: Haeinsa Janggyeong Panjeon visitor rules (haeinsa.or.kr) and the current location of the Hunminjeongeum Haerye (Kansong Art Museum).
- Where a source could only be read through an archive copy (unesco.org, heritage portal descriptions), spot-check it live in a browser.
