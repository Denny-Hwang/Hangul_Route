# read-tiers (F-CURR-002 row CM-46a): checker findings and how each was resolved, 2026-10-31

The read tiers of the ten listen-only stories (tripitaka-koreana, sillok-royal-historians, janggyeong-panjeon, jikji-metal-type, sillok-mountain-archives, nanjung-ilgi, seungjeongwon-ilgi-every-day, ilseongnok-daily-reflection, uigwe-royal-birthday, joseon-records-today) went through the MAR pipeline of F-CURR-002 §9.2: an author, three checkers in parallel (language, culture and facts, learning design), each an agent that did not see the others' findings, a reviser, and a third independent pass. The es and ko overlays then had two independent reviewers (es, ko), a reviser and a third pass. No fact, source, claim or `rev` changed: every sentence restates facts the story already cites, verified in the cluster files `hangul-printing` and `records-joseon` (and `science-art-life` for nanjung-ilgi). All passes are AI review passes; no copy says a native speaker or a human expert reviewed anything.

## Language checker

| story | scene/check | finding | proposed fix | severity |
|---|---|---|---|---|
| tripitaka-koreana | all | no finding | — | note |
| sillok-royal-historians | s2 keyword 말 / s5 keyword 말 | Same spelling 말 taught as "words" (s2) and "horse" (s5) — a true homophone for a device voice (TTS cannot distinguish; vowel-length contrast is lost in modern TTS). Context disambiguates and it's intentionally glossed, so acceptable, but flag for audio. | Keep; ensure any TTS always reads 말 inside its full phrase (왕의 말을 / 말에서 떨어졌어요) so context carries the meaning. | note |
| sillok-royal-historians | s6 line 사관이 알게 하지 말라 | Register is written-imperative 말라, not 해요체. Authentic as King Taejong's quoted command and marked a character line, so defensible — but it's the one non-polite form a beginner meets here. | Keep (historical quote); confirm it reads as a quotation in the UI so the plain-imperative ending isn't modeled as learner speech. | note |
| sillok-royal-historians | r1 explainEn | explainEn romanizes 기록했어요 as "Girokhaesseoyo", contradicting the authoritative/target romanization "girokaesseoyo" (F-CNT-002: the 기록하다 join aspirates). | Change explain to "Girokaesseoyo means recorded, or wrote down." | should-fix |
| janggyeong-panjeon | all | no finding | — | note |
| jikji-metal-type | all | no finding | — | note |
| sillok-mountain-archives | s8 line 책을 햇볕에 말려요 | Line is present tense (말려요) for poswae, while the narration is past ("historians took the books out … and aired them"). Reads as a general custom, so tolerable, but it mixes tense within the scene (grammar rule: past for history). | Optionally 책을 햇볕에 말렸어요 ("dried the books in the sun") to match the past narration, or keep present and frame as a recurring custom. | note |
| nanjung-ilgi | s2 line 이순신은 장군이에요. | Gloss "Yi Sunsin is a **famous** commander." adds "famous" (유명한) — not present in the Korean, which says only "is a general/commander." (Narration also says "was a commander", so present copula is a mild tense shift too.) | Gloss → "Yi Sunsin is a commander." (If "famous" is wanted, Korean would need 유명한 장군이에요.) | should-fix |
| seungjeongwon-ilgi-every-day | s5 line 초서는 어려워요. | Gloss "Cursive script is **hard to read**" adds "to read"; the Korean 어려워요 says only "is hard/difficult" (keyword itself is glossed "is hard; difficult"). Context implies reading, but the words don't. | Gloss → "Cursive script is hard." (or Korean → 초서는 읽기 어려워요 to match "hard to read"). | note |
| ilseongnok-daily-reflection | s3 line 오늘 나는 무엇을 했지? | Hoya's self-question uses 반말 ending -지 (했지), not the 해요체 taught elsewhere. Works as inner monologue, but it introduces an unglossed informal ending to beginners. | Keep as character self-talk; or, to stay in register, 오늘 나는 무엇을 했어요? / 오늘 뭘 했을까요? | note |
| uigwe-royal-birthday | s8 line 활자로 의궤를 찍었어요. | Gloss "printed the uigwe with **metal** type" adds "metal"; 활자 is "(movable) type" (the story's own keyword glosses 활자 = "movable type"; metal type is 금속활자). Narration establishes metal, but the line word doesn't. | Gloss → "They printed the uigwe with movable type." (or Korean → 금속활자로 의궤를 찍었어요). | should-fix |
| joseon-records-today | s2 line 화성을 기록했어요. | Gloss "They recorded **the building of** Hwaseong" adds "the building of"; the Korean object is 화성 (the fortress), i.e. "recorded Hwaseong." Defensible from context (the uigwe recorded construction) but adds information. | Gloss → "They recorded Hwaseong." (or Korean → 화성 공사를 기록했어요 to carry "the building"). | note |
| joseon-records-today | r1 explainEn | explainEn romanizes 기록했어요 as "Girokhaesseoyo", contradicting the authoritative/target "girokaesseoyo" (same F-CNT-002 aspiration exception as above). | Change explain to "Girokaesseoyo means recorded." | should-fix |

## Culture and facts checker

| story | scene/check | finding | proposed fix | severity |
|---|---|---|---|---|
| tripitaka-koreana | — | No finding. All read scenes (s1,s2,s3,s5,s6,s8), lines and checks r1–r3 stay within cited facts; "tens of millions," "1237–1248," "wild cherry wood" all in f3/f6/f7; Buddhist scriptures and the Mongol invasions framed as shared heritage / told calmly; UNESCO not invoked in the read tier. | — | — |
| sillok-royal-historians | — | No finding. s1,s2,s4,s5,s6,s7 and r1–r3 supported by f1–f8; the 1404 fall is "not hurt" (f6), mild-peril advisory fits; "Do not let the historian know" quoted per f7; one correct option each. | — | — |
| janggyeong-panjeon | — | No finding. s1,s4,s5,s6,s7,s8 and r1–r3 supported by f1,f5,f6,f7,f8,f9; "some 500 years" (f7), "World Heritage List" exact (f8), "visitor entry is limited" matches f9; checks clean. | — | — |
| jikji-metal-type | — | No finding. s1–s6 and r1–r3 supported by f1–f6; "75 years old" in f2; second disciple correctly left unnamed; Baegun is "monk/seunim" (respectful); France location stated neutrally with no ownership/return hint (f6); checks clean. | — | — |
| sillok-mountain-archives | — | No finding. s1,s3,s4,s5,s6,s8 and r1–r3 supported by f1,f2,f4,f5,f6,f8,f10; "secho" limited to early Joseon (f4), war/loss told briefly ("a war that began in 1592"), scholars named respectfully; r1 distractor "Burned" is a plainly-wrong gloss of 씻었어요. | — | — |
| nanjung-ilgi | s2 line (gloss) | The Korean line 이순신은 장군이에요 ("Yi Sunsin is a commander/general") is glossed "Yi Sunsin is a **famous** commander." "Famous" is an added evaluative qualifier not in the Korean line and not in cited f1 (which only gives his post and that he built ships); no fact supports it. | Drop "famous": gloss as "Yi Sunsin is a commander." (or "...a general."). No fact can supply "famous," so remove it. | should-fix |
| seungjeongwon-ilgi-every-day | — | No finding. s2,s3,s4,s5,s6,s7 and r1–r3 supported by f2–f7,f9; "3,243 books / 1623–1910 / 2001" all in facts; fires told calmly (f6), loss advisory fits; "Memory of the World Register" stated exactly in s7; checks clean. | — | — |
| ilseongnok-daily-reflection | s7 narration | "in 2011 UNESCO added it to the **Memory of the World**" drops "Register." f9 and the convention give the exact name "Memory of the World Register" (and the sibling read scenes in nanjung s7 / seungjeongwon s7 keep "Register," so this is also an internal inconsistency). Zengzi/Analects (s2) are correctly framed as Chinese, not Korean. | Change to "…to the Memory of the World Register" to match f9 and the other read scenes. | note |
| uigwe-royal-birthday | s8 narration | Same as above: "In 2007, UNESCO added the Joseon uigwe to the **Memory of the World**" omits "Register" (f9 gives "Memory of the World Register"). All other claims (weddings/banquets/palace rebuilding f1; artisans' names f3; 1795 / Lady Hyegyeong / 60th birthday f4; Bongsudang + Annals f5; banchado bird's-eye f7; "unusually…metal type" f8) are supported; checks clean. | Change to "…to the Memory of the World Register." | note |
| joseon-records-today | — | No finding. s2,s3,s5,s6 supported by f1–f5 (1796, 288 years, "classical Chinese" framed correctly as the writing language); s8 is framing (no factIds); damage cause omitted; checks r1–r3 clean, one correct each. | — | — |

## Learning design checker

| story | scene/check | finding | proposed fix | severity |
|---|---|---|---|---|
| joseon-records-today | s6 | Only scene in all ten tiers with **no scene keyword**; its new words 누구나/읽을/수 (from the phrase chunk) are never highlighted/scaffolded as a target word. | Add a scene keyword for s6 (e.g. 읽을 수 있어요 "can read" or 누구나 "anyone"). | should-fix |
| tripitaka-koreana | r1 | Pick-meaning target 경전 "scriptures" is **not a listed keyword**; the tier taught only the chunk 불교 경전 "Buddhist scriptures" (s2), so 경전 alone was never glossed. | Target the actual keyword 불교 경전, or add 경전 as its own keyword glossed "scriptures". | should-fix |
| jikji-metal-type | sequence (Story Order) | Captions run printing (s1, 1377) before Baegun gathers the teachings (s2, 1372): reading the four cards reverses the real chronology. | Reorder the cards (gather → print) or reword captions so the order reads sensibly. | note |
| all tiers | scaffolding (rule 2) | Several lines pair a second new content noun with the scene keyword (e.g. janggyeong s4 창문+달라요; jikji s2 스님+만들었어요; nanjung s2 이순신+장군), above a strict "one new word per line"; the extra word is a glossed proper/context noun, acceptable for documentary but noted. | Keep the extra noun glossed + romanized; treat only the scene keyword as the learned target. | note |
| jikji-metal-type | s2 narration | "then 75 years old" is a biographical age; confirm it is acceptable under "no age words" (it labels Baegun, not the audience). | Keep if biographical ages are allowed; else trim to "the monk Baegun chose important teachings". | note |
| ilseongnok-daily-reflection | s1 narration + caption | "young Jeongjo" / "Young Jeongjo keeps a diary" uses an age descriptor; same audience-vs-biography check as above. | Keep, or drop "young" if "no age words" is read strictly. | note |
| tripitaka-koreana s2/s5; seungjeongwon s5; joseon s6 | narration (rule 5) | A few terms sit above A2: "the complete collection of Buddhist scriptures", "coated with lacquer", "drive back the Mongol invasions", "cursive script", "classical Chinese". | Simplify where possible per the Pre-A1–A2 guide (e.g. "a set of Buddhist books", "covered to protect it", "old flowing writing, hard to read"). | note |
| story | tokens | taught | share |
|---|---|---|---|
| tripitaka-koreana | 17 | 17 | 100% |
| sillok-royal-historians | 21 | 21 | 100% |
| janggyeong-panjeon | 14 | 14 | 100% |
| jikji-metal-type | 16 | 16 | 100% |
| sillok-mountain-archives | 18 | 18 | 100% |
| nanjung-ilgi | 16 | 16 | 100% |
| seungjeongwon-ilgi-every-day | 18 | 18 | 100% |
| ilseongnok-daily-reflection | 18 | 18 | 100% |
| uigwe-royal-birthday | 18 | 18 | 100% |
| joseon-records-today | 17 | 17 | 100% |

## Reviser outcomes (story content)

| lens | story | item | outcome |
|---|---|---|---|
| language | sillok-royal-historians | s2/s5 말 homophone | kept: glossed in each scene, read inside its phrase |
| language | sillok-royal-historians | s6 말라 (written imperative) | kept: King Taejong's quoted command, speaker character |
| language | sillok-royal-historians, joseon-records-today | r1 explain romanized Girokhaesseoyo | fixed: Girokaesseoyo; the keyword id is now girokaesseoyo; the four strings with 기록했어요 are listed in the romanization exceptions (the documented 기록하다 aspiration) |
| language | sillok-mountain-archives | s8 present 말려요 | kept: the line names the custom (the listen tier's phrase) |
| language + culture | nanjung-ilgi | s2 gloss "famous" | fixed: "Yi Sunsin is a commander." |
| language | seungjeongwon-ilgi-every-day | s5 gloss "hard to read" | fixed: "Cursive script is hard." |
| language | ilseongnok-daily-reflection | s3 했지 | kept: Hoya's self-question, the listen tier's phrase |
| language | uigwe-royal-birthday | s8 gloss "metal type" | fixed: "They printed the uigwe with movable type." |
| language | joseon-records-today | s2 gloss "the building of" | fixed: "They recorded Hwaseong." |
| culture | ilseongnok-daily-reflection, uigwe-royal-birthday | "Memory of the World" without "Register" | fixed: "Memory of the World Register" |
| learning | joseon-records-today | s6 had no scene keyword | fixed: new keyword 누구나 (nuguna, "anyone") as the scene keyword |
| learning | tripitaka-koreana | r1 target 경전 was not a keyword | fixed: the target is the keyword 불교 경전 ("Buddhist scriptures") |
| learning | jikji-metal-type | Story Order put printing (1377) before compiling (1372) | fixed: sequence s2, s3, s4, s6 (story order and time order agree) |
| learning | all | second glossed noun in some lines | kept: proper or context nouns, glossed and romanized |
| learning | jikji s2, ilseongnok s1 | biographical ages | kept: they describe historical people, not the learner |
| learning | several | terms above A2 | kept: the cited facts' own terms, as in the listen tier |

## es overlay reviewer

| story | field | finding | proposed es text | severity |
|---|---|---|---|---|
| tripitaka-koreana | tiers.read.scenes.s6.narration | "de forma tan pareja" — "pareja" for "evenly" leans informal/LatAm; not used elsewhere in the shipped overlays. More neutral (Spain + LatAm) wording is "uniforme". Meaning/tokens intact; style only. | ...grabaron decenas de millones de {kw:geulja} **de forma tan uniforme** que parece que una sola persona los talló todos. | note |
| sillok-royal-historians | — | no finding | | |
| janggyeong-panjeon | — | no finding | | |
| jikji-metal-type | — | no finding | | |
| sillok-mountain-archives | — | no finding | | |
| nanjung-ilgi | — | no finding | | |
| seungjeongwon-ilgi-every-day | tiers.read.scenes.s7.narration | "3.243" uses a point thousands-separator, but the listen tier in the **same file** writes the identical count as "3243" (stories-records.json line 197), which also matches RAE guidance for four-digit quantities. Inconsistent rendering of the same fact. | Hoy se conservan **3243** libros, de 1623 a 1910. Los diarios son un Tesoro Nacional, {kw:gukbo}, y desde 2001 están en el Registro de la Memoria del Mundo de la UNESCO. | should-fix |
| ilseongnok-daily-reflection | checks.r1.explain | "significa que miró hacia sí mismo para pensar en lo que hizo" expands the gloss beyond EN "means looked back on yourself"; the keyword gloss and option already render this as "pensó en lo que había hecho". Tighten for faithfulness/consistency. | Banseonghaesseoyo significa **que pensó en lo que había hecho**. Jeongjo quería examinarse cada día. | note |
| uigwe-royal-birthday | tiers.read.scenes.s3.narration | "even skilled craftspeople" → "incluso de los artesanos" drops "skilled". The shipped listen tier renders this as "los artesanos **expertos**" and the jangin gloss is "artesano, persona experta en un oficio", so the descriptor should be kept. | Los uigwe hacen una lista de las personas que participaron, incluso de los artesanos **expertos**, {kw:jangin}, con el nombre y la tarea de cada una. | should-fix |
| joseon-records-today | — | no finding | | |

## ko overlay reviewer

| story | field | finding | proposed ko text | severity |
|---|---|---|---|---|
| tripitaka-koreana | — | no finding | — | — |
| sillok-royal-historians | — | no finding | — | — |
| janggyeong-panjeon | — | no finding | — | — |
| jikji-metal-type | — | no finding | — | — |
| sillok-mountain-archives | — | no finding | — | — |
| nanjung-ilgi | tiers.read.scenes.s5.narration | EN lists two things he wrote about: "his family" and "the people who served with him." The ko "{kw:gajok}과 함께 일한 사람들" reads most naturally as a single unit "people who worked **together with family**," distorting the meaning and dropping "family" as a standalone topic. The shipped listen-tier s5 avoids this with "자기와 함께 일한 사람들"; restore that disambiguator (keeps the 과 particle after 가족). | 장군은 {kw:gajok}과 자기와 함께 일한 사람들에 대해서도 썼어요. | should-fix |
| seungjeongwon-ilgi-every-day | — | no finding | — | — |
| ilseongnok-daily-reflection | — | no finding | — | — |
| joseon-records-today | — | no finding | — | — |

## Reviser outcomes (overlays)

| lens | story | field | outcome |
|---|---|---|---|
| es | tripitaka-koreana | s6 narration "pareja" | fixed: "de forma tan uniforme" |
| es | seungjeongwon-ilgi-every-day | s7 narration "3.243" | fixed: "3243", as the listen tier writes it |
| es | ilseongnok-daily-reflection | r1 explain | fixed: "significa que pensó en lo que había hecho" |
| es | uigwe-royal-birthday | s3 narration dropped "skilled" | fixed: "los artesanos expertos" |
| ko | nanjung-ilgi | s5 narration could read "worked with family" | fixed: "{kw:gajok}과 자기와 함께 일한 사람들" |
| ko | uigwe-royal-birthday | not listed by the ko lens | to the third pass |
