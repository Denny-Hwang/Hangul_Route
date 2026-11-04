# nature-book2 (F-CURR-002 row CM-46): third pass, 2026-11-04

The third pass read the revised stories and overlays against `nature-book2.changes.md` and the quoted sources in
`nature-book2.sources.json`.

| story | check | verdict |
|---|---|---|
| jeju-volcanic-island | every narration sentence maps to f1-f8; "2007" echoes f2 (two sources); no number word without a fact | pass |
| jeju-volcanic-island | UNESCO name exact; Hallasan "highest in South Korea" (남한) | pass |
| jirisan-national-park | "1967" echoes f1 (two sources); "three provinces" echoes f2; "second-highest peak" echoes f3 (encykorea 제2의 고봉) | pass |
| jirisan-national-park | bears told calmly, no cause of harm narrated; the park service's aim quoted, not overstated | pass |
| suncheon-bay-wetland | "2006" echoes f8 (two sources); seasons list follows Suncheon City's wording; wintering claim current | pass |
| all | Story Order rounds settle by their captions; read lines and panels romanized by rule | pass |
| all | es and ko overlays: tokens equal, particles after tokens correct (섬이에요, 화산은, 봉우리가, 흑두루미가, 습지예요), ko glosses are meanings, not the Korean | pass |

THIRD PASS: PASS. Remaining uncertainty: the UNESCO and Ramsar Secretariat pages could not be read by the session;
spot-check them live in a browser before a later fact edit.

## Fix round 1, 2026-11-04

| story | check | verdict |
|---|---|---|
| suncheon-bay-wetland | every fact's first source is on the §6.6 allowlist (Korea Heritage Service; National Institute of Ecology for f7, f8); every narrated sentence maps to a fact that source states; no "only" claim | pass |
| jirisan-national-park | f7 cites the Korea National Park Service first; the last Story Order panel restates f4 and f5 | pass |
| jeju-volcanic-island | the UNESCO status is named Jeju Volcanic Island and Lava Tubes wherever a learner reads it (s7, summary) | pass |
| all | Story Order rounds settle by their markers; romanization by rule (build and lint) | pass |

The es and ko strings changed in this round go to the workflow's independent review on the PR before the story review
fields are signed again; this file records the author's check only.
