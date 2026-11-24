# Stroke-order table — for review (AMENDMENTS-STROKE-ORDER-STANDARD row SO-0b)

Status: **approved by the owner for SO-2, 2026-11-23 (OD-SO11, spec §10); textbook check by the reviewer pending (SO-3).** The owner approved every row for row SO-2 as owner, without waiting for the reviewer, with the OD-SO4 default: every sourced form is accepted (ㅈ A and B; ㅊ and ㅎ A and B; ㅌ A and B; ㅌ C is not accepted). The direction of ㅇ, of ㅎ's ring and of final ㅇ stays unsourced (AU-14's data stays). The reviewer's check is still a person's job and still the gate for a letter being taught: the Korean teacher of WO-27 (row HR-3s; OD-SO5, 2026-11-22) checks each row against the textbook and fills its review record (§4; §3.5 of the spec). Where sources differ, the owner decides (OD-SO4).

Researched 2026-11-22 on `main` `8a6e36543`. Every source below was seen on 2026-11-22 unless the entry says otherwise. This file changes no code and does not touch `reviewedStrokeIds`.

Spec: [`docs/specs/AMENDMENTS-STROKE-ORDER-STANDARD.md`](../AMENDMENTS-STROKE-ORDER-STANDARD.md) §3.4 (format, source order OD-SO3), §3.5 (review record), §10 (OD-SO3, OD-SO4). Data compared: `apps/mobile/src/content/jamo-strokes.ts` (AU-14) and its pin `apps/mobile/src/content/__tests__/jamo-stroke-order.test.ts` (`STANDARD`).

---

## 1. Read this first: what the sources are, and what is missing

**The first-priority source was not reached.** OD-SO3 puts the current 국정 first-grade 국어 textbook (2022 개정 교육과정 국어 1-1) or its 교사용 지도서 first. No row below cites it, because no page of it could be seen (§5, S1). The reviewer should check every row against the textbook in hand; that check is the main value the review adds.

What the rows rest on instead:

- **X1** — the only source that shows a numbered, arrowed diagram for 20 of the 24 jamo. It is a teacher-education lecture note by a professor of Korean education (광주교육대학교). Its diagrams are scanned at about 96 px per letter. It does not say where the diagrams come from or which textbook edition they follow. Not on the OD-SO3 list; listed as "other".
- **S2b, S2c, S2d** — 국립국어원 materials. None shows a stroke-by-stroke order for a letter. They give: the general principle (S2d), the fact that no stroke order is officially set (S2a, S2b), the forms of the ㅊ/ㅎ top stroke (S2b, S2c), and a 1989 proposal on letter shapes that bears on ㅈ, ㅊ, ㅎ, ㅌ (S2c).
- **X2, X3** — two web pages with no named author and no cited source. They are used only as weak support, and they are the **only** sources for ㅑ ㅕ ㅛ ㅠ.
- **S3** (세종학당) — not reached (§5).

So: the rows are sourced, but not from the textbook. Treat "agree" below as "agrees with X1 (and the weak sources)", not as "agrees with the textbook".

## 2. Counts

| | Rows |
|---|---|
| Jamo rows (24) with at least one source | 24 (ㅇ only in part: see the ㅇ row) |
| … of which a numbered diagram (X1) backs the order | 20 (14 consonants; ㅏ ㅓ ㅗ ㅜ ㅡ ㅣ) |
| … of which only weak sources (X2, X3) back the order | 4 (ㅑ ㅕ ㅛ ㅠ) |
| Rows citing the 국정 textbook (S1) | 0 (not reached) |
| AU-14 agrees with the sourced order | 21 jamo (ㄱ ㄴ ㄷ ㄹ ㅁ ㅂ ㅅ ㅈ ㅋ ㅌ ㅍ and all 10 vowels) |
| AU-14 disagrees with the sourced order | 2 (ㅊ, ㅎ: stroke 1 is a vertical tick in AU-14, a short left-to-right stroke in X1's diagram) |
| AU-14 only partly checkable | 1 (ㅇ: count and start point sourced; the direction round the circle is not). The same gap applies to ㅎ's ring and to final ㅇ |
| Letters with more than one sourced order or form (variants, OD-SO4) | 4 (ㅈ, ㅊ, ㅎ, ㅌ) |
| Finals (6) | inherit their consonant's row; no source found that gives a final's order separately (§3.3) |
| Rows with no source at all | 0 jamo; unsourced parts: the direction of ㅇ, of ㅎ's ring and of final ㅇ |
| Rows approved for SO-2 by the owner (OD-SO11, 2026-11-23) | 30 (every row) |
| Rows checked by the reviewer against the textbook (SO-3) | 0 |
| Forms accepted besides AU-14's (OD-SO11; the data's `altStrokes`) | 4: ㅈ B, ㅊ A, ㅎ A, ㅌ B |
| Forms not accepted | 1: ㅌ C |

## 3. The table

How to read it:

- **Strokes** are given in writing order, each as start → end in words. "Codes" uses the same leg names as `STANDARD` in `jamo-stroke-order.test.ts` (`right`, `down`, `downLeft`, `downRight`, `loop`; `>` joins legs drawn without a lift), so SO-2 can compare the two directly.
- **Codes of a row with more than one form**: one line per form (`<br>`), as `<label> (<where>): <codes>`, where `<where>` is `` `strokes` `` (the form the data shows: ghost, Show me, presenter; AU-14's form), `` `altStrokes` `` (another accepted form, OD-SO11; the data holds it in this order) or `not accepted`. A row with one form gives its codes only (`strokes`). `jamo-stroke-order.test.ts` parses this column: the data's `strokes` must equal the `strokes` line and its `altStrokes` the `altStrokes` lines.
- **Sources** use the ids of §5. "p." is the page number printed on the PDF page.
- **AU-14** describes `jamo-strokes.ts` as it is on `8a6e36543` (coordinates in the 200 × 200 viewBox).
- **Compare**: `agree`, `disagree` (with what), or `partly`.
- **Review**: every row started `unapproved`. Since OD-SO11 (2026-11-23) every row is approved by the owner for SO-2; the reviewer's textbook check (SO-3) is pending. The review records are in §4, one line per row.

### 3.1 Consonants (14)

| # | Jamo | Id | Strokes | Stroke order (start → end) | Codes | Sources | AU-14 data | Compare | Review |
|---|---|---|---|---|---|---|---|---|---|
| 1 | ㄱ | `jamo:giyeok` | 1 | 1. top-left → right along the top, turning down the right side to the bottom-right | `right>down` | X1 p.4 [표 2] (1획); X1 p.6 [표 4] diagram; X2 ("가로로 긋다가 꺾어서 한 번에 내려요", 1획) | 1 stroke: (40,50) → (160,50) → (160,150) | agree | SO-2 approved (OD-SO11); SO-3 pending |
| 2 | ㄴ | `jamo:nieun` | 1 | 1. top-left → down the left side, turning right along the bottom to the bottom-right | `down>right` | X1 p.4 [표 2] (1획); X1 p.6 diagram; X2 ("내리긋다가 꺾어서 한 번에 오른쪽으로", 1획) | 1 stroke: (50,40) → (50,150) → (160,150) | agree | SO-2 approved (OD-SO11); SO-3 pending |
| 3 | ㄷ | `jamo:digeut` | 2 | 1. top bar, left → right; 2. from the top-left (left end of the bar) down, turning right along the bottom (ㄴ shape) | `right`, `down>right` | X1 p.4 [표 2] (2획); X1 p.6 diagram; X2 ("① 위 가로 ② ㄴ 모양", 2획) | 2 strokes: bar (40,50) → (160,50); ㄴ shape from (50,50) | agree | SO-2 approved (OD-SO11); SO-3 pending |
| 4 | ㄹ | `jamo:rieul` | 3 | 1. ㄱ shape: top-left → top-right, down to the middle-right; 2. middle bar, left → right; 3. ㄴ shape: from the middle-left down, turning right along the bottom | `right>down`, `right`, `down>right` | X1 p.4 [표 2] (3획; "ㄹ – ㄱ을 쓰고 밑에 ㄷ을 씀"); X1 p.6 diagram; X2 ("① ㄱ 모양 ② 가운데 가로 ③ ㄴ 모양") | 3 strokes in this order; stroke 3 from (40,95) | agree | SO-2 approved (OD-SO11); SO-3 pending |
| 5 | ㅁ | `jamo:mieum` | 3 | 1. left side, top → bottom; 2. top-left → top-right, turning down the right side (ㄱ shape); 3. bottom bar, left → right | `down`, `right>down`, `right` | X1 p.4 [표 2] (3획); X1 p.6 diagram; X2 ("① 왼쪽 세로 ② ㄱ 모양 ③ 아래 가로로 닫기") | 3 strokes in this order | agree. No source found for the 1- or 2-stroke ㅁ named as a hypothesis in spec §1 | SO-2 approved (OD-SO11); SO-3 pending |
| 6 | ㅂ | `jamo:bieup` | 4 | 1. left side, top → bottom; 2. right side, top → bottom; 3. middle bar, left → right; 4. bottom bar, left → right | `down`, `down`, `right`, `right` | X1 p.4 [표 2] (4획; "ㅂ, ㅍ - 쌍으로 나타나는 요소는 앞→뒤 순서로 씀"); X1 p.6 diagram; X2 ("① 왼쪽 세로 ② 오른쪽 세로 ③ 가운데 가로 ④ 아래 가로") | 4 strokes in this order | agree | SO-2 approved (OD-SO11); SO-3 pending |
| 7 | ㅅ | `jamo:siot` | 2 | 1. from the top-centre down-left to the bottom-left; 2. from about the middle of stroke 1 down-right to the bottom-right | `downLeft`, `downRight` | X1 p.4 [표 2] (2획); X1 p.6 diagram (stroke 2 leaves from the middle of stroke 1); X2 ("① 왼쪽 삐침 ② 오른쪽 파임") | 2 strokes; stroke 2 from (110,80), on stroke 1 | agree | SO-2 approved (OD-SO11); SO-3 pending |
| 8 | ㅇ | `jamo:ieung` | 1 | 1. one closed round stroke, **starting at the top**. Direction round the circle: **no source found** | `loop` | X1 p.4 [표 2] (1획; "ㅇ - 왼쪽에서 시작하여 1획으로 끝냄" — wording ambiguous: it may mean the pen moves left first, i.e. counter-clockwise, but does not say so); X1 p.7 diagram (① at the top; the arrow is not legible at the scan's resolution); X2 ("위에서 시작해 한 번에 둥글게", no direction) | 1 stroke from the top, counter-clockwise | partly: count and start point agree; the counter-clockwise direction is not sourced (focus row F-3) | SO-2 approved (OD-SO11); SO-3 pending |
| 9 | ㅈ | `jamo:jieut` | 2 (variant 3) | **Order A (2 strokes):** 1. top bar, left → right, turning at the right end down-left to the bottom-left without a lift; 2. from about the middle of the slant down-right to the bottom-right. **Variant B (3 strokes):** top bar, then the two strokes of ㅅ joined at the middle of the bar (S2c; the order of the three is not stated there). B's codes are not a source's: they write the bar first, then ㅅ as row 7 does (left leg, then right leg from the middle of the left leg), by the general rule of S2d ("왼쪽에서 오른쪽으로, 위에서 아래로") and X1 p.4 ("모양은 위 - 가운데 - 아래 순서로 쓴다"); the reviewer confirms (SO-3) | A (`strokes`): `right>downLeft`, `downRight`<br>B (`altStrokes`): `right`, `downLeft`, `downRight` | A: X1 p.4 [표 2] (2획; "ㅈ - 윗 선을 긋고 ㅅ을 쓰면 3획이 되어 안 됨"); X1 p.7 diagram; X2 (2획; "가로를 긋고 ㅅ을 따로 쓰는 3획은 표준 획순이 아니에요"). B: S2c (proposes the 3-stroke shape as the standard letterform: "2획이 아닌 3획으로 써야 한다"; notes that the 2-stroke shape is the one used in 명조체 "특히 국정 교과서") | Order A: (40,50) → (160,50) → (50,150); (116,90) → (160,150) | agree with A. Variant B sourced (S2c, 1989, a letter-shape proposal) and rejected by X1 and X2. Owner decides (focus row F-2). **OD-SO11: A and B accepted** | SO-2 approved (OD-SO11); SO-3 pending |
| 10 | ㅊ | `jamo:chieut` | 3 | **Order A (sourced diagram):** 1. short top stroke, **left → right** (horizontal, slightly slanting down to the right); 2. as ㅈ stroke 1; 3. as ㅈ stroke 2. **Variant B (AU-14):** stroke 1 a short vertical tick, top → bottom; strokes 2–3 as A | A (`altStrokes`): `right`, `right>downLeft`, `downRight`<br>B (`strokes`): `down`, `right>downLeft`, `downRight` | Count and order: X1 p.4 [표 2] (3획; "ㅊ - 위 획을 긋고 ㅈ을 씀"); X2 ("① 꼭지 ② 가로에서 꺾어 왼쪽 삐침 ③ 오른쪽 파임"; direction of 꼭지 not stated). Stroke 1 as left → right: X1 p.7 diagram; S2c ("꼭지점을 가로로 긋는 편이 더 합리성을 지닐 것이다", a 1989 proposal). Vertical form exists: S2b ("가로점, 세로점, 사선점 등 다양한 형태"; "명확히 규정되어 있는 바는 따로 없습니다"); S2c (the top stroke was originally drawn vertically; historical) | 3 strokes; stroke 1 vertical (100,30) → (100,55) | **disagree** on stroke 1: X1's diagram draws it left → right; AU-14 draws it top → bottom. Count and strokes 2–3 agree. No source found that **teaches** the vertical tick; S2b and S2c only show it exists as a letterform (focus row F-1). **OD-SO11: A and B accepted** | SO-2 approved (OD-SO11); SO-3 pending |
| 11 | ㅋ | `jamo:kieuk` | 2 | 1. ㄱ shape: top-left → top-right, down the right side; 2. middle bar, left → right | `right>down`, `right` | X1 p.4 [표 2] (2획; "ㅋ - ㄱ을 먼저 쓰고 가획을 다음에 함"); X1 p.7 diagram; X2 ("① ㄱ 모양 ② 가운데 가로") | 2 strokes in this order | agree | SO-2 approved (OD-SO11); SO-3 pending |
| 12 | ㅌ | `jamo:tieut` | 3 | **Order A:** 1. top bar, left → right; 2. middle bar, left → right; 3. from the top-left (left end of the top bar) down, turning right along the bottom (ㄴ shape). **Variant B (一 + ㄷ):** top bar, then ㄷ below it, i.e. the ㄴ shape starts at the middle bar, not at the top. **Variant C (historical):** ㄷ first (top bar, ㄴ shape), then the middle bar | A (`strokes`): `right`, `right`, `down>right`<br>B (`altStrokes`): `right`, `right`, `down>right`<br>C (not accepted): `right`, `down>right`, `right` | A: X1 p.4 [표 2] (3획; "ㅌ - 위에 획을 긋고 아래에 ㄷ을 쓰면 안 됨"); X1 p.7 diagram (stroke 3 starts at the top-left); X2 ("① 위 가로 ② 가운데 가로 ③ ㄴ 모양"). B: S2c (1989: in handwriting, apart from primary-school pupils, most people wrote the other form; it proposes unifying on ㄷ plus a middle bar) and rejected by X1. C: S2c ("원래는 … 「ㄷ」을 쓰고 가운데에 한 획(덧줄기)을 가로 긋는 방식이었었다"; descriptive history, not a recommendation) | Order A: stroke 3 from (50,40) | agree with A. Variants B and C sourced only in S2c (1989). Owner decides. **OD-SO11: A and B accepted; C not accepted** (B has A's codes; the two differ in where stroke 3 starts) | SO-2 approved (OD-SO11); SO-3 pending |
| 13 | ㅍ | `jamo:pieup` | 4 | 1. top bar, left → right; 2. left short vertical, top → bottom; 3. right short vertical, top → bottom; 4. bottom bar, left → right | `right`, `down`, `down`, `right` | X1 p.4 [표 2] (4획; pairs "앞→뒤"); X1 p.7 diagram; X2 ("① 위 가로 ② 왼쪽 세로 ③ 오른쪽 세로 ④ 아래 가로") | 4 strokes in this order | agree | SO-2 approved (OD-SO11); SO-3 pending |
| 14 | ㅎ | `jamo:hieut` | 3 | **Order A (sourced diagram):** 1. short top stroke, **left → right**; 2. bar, left → right; 3. circle under the bar, starting at the top (direction **not sourced**). **Variant B (AU-14):** stroke 1 a short vertical tick, top → bottom | A (`altStrokes`): `right`, `right`, `loop`<br>B (`strokes`): `down`, `right`, `loop` | Count and order: X1 p.4 [표 2] (3획); X2 ("① 꼭지 ② 가로 ③ 동그라미"). Stroke 1 as left → right: X1 p.7 diagram; S2c (proposal, as for ㅊ). Vertical form exists: S2b; S2c (historical) | 3 strokes; stroke 1 vertical (100,30) → (100,50); ring from the top, counter-clockwise | **disagree** on stroke 1 (as ㅊ). Ring direction unsourced (as ㅇ). Count agrees (focus rows F-1, F-3). **OD-SO11: A and B accepted**; the ring keeps AU-14's direction | SO-2 approved (OD-SO11); SO-3 pending |

### 3.2 Vowels (10)

Direction of short bars and ticks: where a source names the order but not the direction, the general rule of S2d applies ("한글 자모의 쓰는 순서는 기본적으로 왼쪽에서 오른쪽으로, 위에서 아래로의 방향을 따른다"). The row says so.

| # | Jamo | Id | Strokes | Stroke order (start → end) | Codes | Sources | AU-14 data | Compare | Review |
|---|---|---|---|---|---|---|---|---|---|
| 15 | ㅏ | `jamo:a` | 2 | 1. long vertical, top → bottom; 2. short bar from the vertical, left → right | `down`, `right` | X1 p.6 [표 4] diagram; X2 ("① 세로 기둥 ② 오른쪽 곁줄기") | 2 strokes in this order | agree | SO-2 approved (OD-SO11); SO-3 pending |
| 16 | ㅑ | `jamo:ya` | 3 | 1. long vertical, top → bottom; 2. upper short bar, left → right; 3. lower short bar, left → right | `down`, `right`, `right` | **Weak only:** X2 ("① 세로 기둥 ② ③ 곁줄기는 위부터"); X3 ("긴 세로선을 위에서 아래로 긋습니다. 오른쪽에 짧은 획을 하나 답니다. 그 아래에 짧은 획을 하나 더 답니다."). Bar direction: S2d principle | 3 strokes in this order | agree (weak sources only) | SO-2 approved (OD-SO11); SO-3 pending |
| 17 | ㅓ | `jamo:eo` | 2 | 1. short bar, left → right (ending at the vertical); 2. long vertical, top → bottom | `right`, `down` | X1 p.6 diagram; X2 ("① 곁줄기 ② 세로 기둥 — 왼쪽 것 먼저!") | 2 strokes in this order | agree | SO-2 approved (OD-SO11); SO-3 pending |
| 18 | ㅕ | `jamo:yeo` | 3 | 1. upper short bar, left → right; 2. lower short bar, left → right; 3. long vertical, top → bottom | `right`, `right`, `down` | **Weak only:** X2 ("① ② 곁줄기 위부터 ③ 세로 기둥"); X3 ("왼쪽에 짧은 획을 하나 긋습니다. 그 아래에 짧은 획을 하나 더 긋습니다. 오른쪽에 긴 세로선을 내립니다."). Bar direction: S2d principle | 3 strokes in this order | agree (weak sources only) | SO-2 approved (OD-SO11); SO-3 pending |
| 19 | ㅗ | `jamo:o` | 2 | 1. short vertical, top → bottom (down to the bar); 2. long bar, left → right | `down`, `right` | X1 p.6 diagram; X2 ("① 짧은 세로 ② 아래 가로") | 2 strokes in this order | agree | SO-2 approved (OD-SO11); SO-3 pending |
| 20 | ㅛ | `jamo:yo` | 3 | 1. left short vertical, top → bottom; 2. right short vertical, top → bottom; 3. long bar, left → right | `down`, `down`, `right` | **Weak only:** X2 ("① ② 짧은 세로 왼쪽부터 ③ 아래 가로"); X3 ("짧은 세로획을 왼쪽에 하나 긋습니다. 오른쪽에 하나 더 긋습니다. 그 아래에 긴 가로선을 긋습니다."). Tick direction: S2d principle | 3 strokes in this order | agree (weak sources only) | SO-2 approved (OD-SO11); SO-3 pending |
| 21 | ㅜ | `jamo:u` | 2 | 1. long bar, left → right; 2. short vertical down from the bar, top → bottom | `right`, `down` | X1 p.6 diagram; X2 ("① 가로 ② 세로 내리긋기") | 2 strokes in this order | agree | SO-2 approved (OD-SO11); SO-3 pending |
| 22 | ㅠ | `jamo:yu` | 3 | 1. long bar, left → right; 2. left short vertical, top → bottom; 3. right short vertical, top → bottom | `right`, `down`, `down` | **Weak only:** X2 ("① 가로 ② ③ 세로는 왼쪽부터"); X3 ("긴 가로선을 먼저 긋습니다. 그 아래 왼쪽에 짧은 세로획을 하나 긋습니다. 오른쪽에 하나 더 긋습니다.") | 3 strokes in this order | agree (weak sources only) | SO-2 approved (OD-SO11); SO-3 pending |
| 23 | ㅡ | `jamo:eu` | 1 | 1. left → right | `right` | X1 p.6 diagram; X2 ("왼쪽에서 오른쪽으로 한 번에") | 1 stroke, left → right | agree | SO-2 approved (OD-SO11); SO-3 pending |
| 24 | ㅣ | `jamo:i` | 1 | 1. top → bottom | `down` | X1 p.6 diagram; X2 ("위에서 아래로 한 번에") | 1 stroke, top → bottom | agree | SO-2 approved (OD-SO11); SO-3 pending |

### 3.3 Finals (6)

No source found gives the stroke order of a consonant **as a final** separately. X1 pp.5, 8 treat finals (받침) only as a change of size and position in the syllable block (자형), not of order. Each final row therefore **inherits** its consonant's row: if the reviewer approves the consonant row, the final follows it, and a change to one changes the other (AU-14 already shares one definition, `jamo-strokes.ts` `GIYEOK` … `IEUNG` and `copy`). The reviewer should say in the review record whether they accept the inheritance.

| # | Jamo | Id | Inherits | Strokes | AU-14 data | Compare | Review |
|---|---|---|---|---|---|---|---|
| 25 | ㄱ (final) | `jamo:giyeok-batchim` | row 1 | 1 | `copy(GIYEOK)` | agree by inheritance; no final-specific source | SO-2 approved (OD-SO11); SO-3 pending |
| 26 | ㄴ (final) | `jamo:nieun-batchim` | row 2 | 1 | `copy(NIEUN)` | agree by inheritance; no final-specific source | SO-2 approved (OD-SO11); SO-3 pending |
| 27 | ㄹ (final) | `jamo:rieul-batchim` | row 4 | 3 | `copy(RIEUL)` | agree by inheritance; no final-specific source | SO-2 approved (OD-SO11); SO-3 pending |
| 28 | ㅁ (final) | `jamo:mieum-batchim` | row 5 | 3 | `copy(MIEUM)` | agree by inheritance; no final-specific source | SO-2 approved (OD-SO11); SO-3 pending |
| 29 | ㅂ (final) | `jamo:bieup-batchim` | row 6 | 4 | `copy(BIEUP)` | agree by inheritance; no final-specific source | SO-2 approved (OD-SO11); SO-3 pending |
| 30 | ㅇ (final) | `jamo:ieung-batchim` | row 8 | 1 | `copy(IEUNG)` | partly, as row 8 (direction unsourced) | SO-2 approved (OD-SO11); SO-3 pending |

### 3.4 Focus rows (spec §3.4: listed as rows of their own)

| Id | Question | What the sources say | AU-14 today | For the owner / reviewer |
|---|---|---|---|---|
| F-1 | ㅊ and ㅎ: the top stroke — vertical tick (top → bottom) or short horizontal stroke (left → right)? | **Horizontal, left → right:** X1 p.7 diagrams (both letters). S2c (1989) proposes the horizontal form as the more rational standard. **Several forms exist, none is regulated:** S2b (국립국어원 온라인가나다, answered 2026-01-27: "가로점, 세로점, 사선점 등 다양한 형태"; "명확히 규정되어 있는 바는 따로 없습니다"). **Vertical:** S2c says the top stroke was originally drawn vertically (history). No source found that teaches the vertical tick as the stroke to write. | vertical tick, top → bottom (`down`) | OD-SO4 default: accept both (`altStrokes`) — the horizontal form has the stronger source; the vertical form is attested only as a letterform. Check against the 국정 textbook diagram. **Decided 2026-11-23 (OD-SO11): both accepted.** The data shows AU-14's vertical tick (`strokes`) and accepts the horizontal form (`altStrokes`); which form the data shows once a letter is taught is a question for the reviewer (SO-3). |
| F-2 | ㅈ: 2 strokes or 3? | **2:** X1 p.4 (and says 3 is wrong), X1 p.7 diagram, X2 (and says 3 is not standard). **3:** S2c (1989) proposes the 3-stroke shape as the standard letterform, while noting that 국정 textbook 명조 type used the 2-stroke shape. | 2 strokes | OD-SO4 default: accept both. The 3-stroke form has one, older, shape-not-order source. **Decided 2026-11-23 (OD-SO11): both accepted** (2 strokes `strokes`, 3 strokes `altStrokes`). The order of the 3 strokes is derived, not sourced (row 9): the reviewer confirms it. |
| F-3 | ㅇ: start point and direction | **Start at the top:** X1 p.7 diagram (① at the top), X2. **Direction:** no source found. X1 p.4's "왼쪽에서 시작하여" is ambiguous. X1's arrow is not legible at 96 px. | from the top, counter-clockwise; the loop check scores winding only (spec §3.2) | Reviewer: confirm the direction from the textbook. Until then the direction of ㅇ, final ㅇ and ㅎ's ring is unsourced. **2026-11-23 (OD-SO11): still open**; AU-14's data stays. |
| F-4 | ㅌ: where stroke 3 starts (variants B, C of row 12) | See row 12. | stroke 3 from the top-left | OD-SO4: the owner decides whether the 1989 handwriting form (B) is accepted. **Decided 2026-11-23 (OD-SO11): B accepted (`altStrokes`); C not accepted.** |

### 3.5 Composition rule (spec §3.4)

Double consonants (ㄲ ㄸ ㅃ ㅆ ㅉ), compound vowels (ㅐ ㅔ ㅘ ㅝ …) and double finals (ㄺ …) are **not** separate entries. A letter built from two jamo is written as the first jamo's strokes, then the second jamo's (ㅘ = ㅗ then ㅏ; ㄲ = ㄱ then ㄱ; ㄺ = ㄹ then ㄱ), as `logic/trace-word/block-strokes.ts` builds them. This rule is the spec's; no source above was checked for it. Any future entry starts untaught (not in `reviewedStrokeIds`).

## 4. Review records (spec §3.5)

One line per row. **Status** is the row's approval: since OD-SO11 (2026-11-23) every row is approved by the owner for SO-2, so the data may follow it; the textbook check by the reviewer (SO-3) is pending. The other fields are the reviewer's SO-3 record, filled after checking the row against the textbook and the letter's Show me on a device: reviewer (name or initials), role (teacher / owner), sources checked (edition and page), what was seen (table row; Show me on a device; build), date, PR link. The commit that adds an id to `reviewedStrokeIds` carries a `Reviewed-by:` trailer, and `jamo-stroke-order.test.ts` fails when an id in `reviewedStrokeIds` has an empty field here. **All SO-3 fields empty: no letter is taught.**

| # | Id | Status | Reviewer | Role | Sources checked | Seen | Date | PR |
|---|---|---|---|---|---|---|---|---|
| 1 | `jamo:giyeok` | approved by the owner for SO-2, 2026-11-23 (OD-SO11); textbook check by the reviewer pending (SO-3) | | | | | | |
| 2 | `jamo:nieun` | approved by the owner for SO-2, 2026-11-23 (OD-SO11); textbook check by the reviewer pending (SO-3) | | | | | | |
| 3 | `jamo:digeut` | approved by the owner for SO-2, 2026-11-23 (OD-SO11); textbook check by the reviewer pending (SO-3) | | | | | | |
| 4 | `jamo:rieul` | approved by the owner for SO-2, 2026-11-23 (OD-SO11); textbook check by the reviewer pending (SO-3) | | | | | | |
| 5 | `jamo:mieum` | approved by the owner for SO-2, 2026-11-23 (OD-SO11); textbook check by the reviewer pending (SO-3) | | | | | | |
| 6 | `jamo:bieup` | approved by the owner for SO-2, 2026-11-23 (OD-SO11); textbook check by the reviewer pending (SO-3) | | | | | | |
| 7 | `jamo:siot` | approved by the owner for SO-2, 2026-11-23 (OD-SO11); textbook check by the reviewer pending (SO-3) | | | | | | |
| 8 | `jamo:ieung` | approved by the owner for SO-2, 2026-11-23 (OD-SO11); textbook check by the reviewer pending (SO-3) | | | | | | |
| 9 | `jamo:jieut` | approved by the owner for SO-2, 2026-11-23 (OD-SO11); textbook check by the reviewer pending (SO-3) | | | | | | |
| 10 | `jamo:chieut` | approved by the owner for SO-2, 2026-11-23 (OD-SO11); textbook check by the reviewer pending (SO-3) | | | | | | |
| 11 | `jamo:kieuk` | approved by the owner for SO-2, 2026-11-23 (OD-SO11); textbook check by the reviewer pending (SO-3) | | | | | | |
| 12 | `jamo:tieut` | approved by the owner for SO-2, 2026-11-23 (OD-SO11); textbook check by the reviewer pending (SO-3) | | | | | | |
| 13 | `jamo:pieup` | approved by the owner for SO-2, 2026-11-23 (OD-SO11); textbook check by the reviewer pending (SO-3) | | | | | | |
| 14 | `jamo:hieut` | approved by the owner for SO-2, 2026-11-23 (OD-SO11); textbook check by the reviewer pending (SO-3) | | | | | | |
| 15 | `jamo:a` | approved by the owner for SO-2, 2026-11-23 (OD-SO11); textbook check by the reviewer pending (SO-3) | | | | | | |
| 16 | `jamo:ya` | approved by the owner for SO-2, 2026-11-23 (OD-SO11); textbook check by the reviewer pending (SO-3) | | | | | | |
| 17 | `jamo:eo` | approved by the owner for SO-2, 2026-11-23 (OD-SO11); textbook check by the reviewer pending (SO-3) | | | | | | |
| 18 | `jamo:yeo` | approved by the owner for SO-2, 2026-11-23 (OD-SO11); textbook check by the reviewer pending (SO-3) | | | | | | |
| 19 | `jamo:o` | approved by the owner for SO-2, 2026-11-23 (OD-SO11); textbook check by the reviewer pending (SO-3) | | | | | | |
| 20 | `jamo:yo` | approved by the owner for SO-2, 2026-11-23 (OD-SO11); textbook check by the reviewer pending (SO-3) | | | | | | |
| 21 | `jamo:u` | approved by the owner for SO-2, 2026-11-23 (OD-SO11); textbook check by the reviewer pending (SO-3) | | | | | | |
| 22 | `jamo:yu` | approved by the owner for SO-2, 2026-11-23 (OD-SO11); textbook check by the reviewer pending (SO-3) | | | | | | |
| 23 | `jamo:eu` | approved by the owner for SO-2, 2026-11-23 (OD-SO11); textbook check by the reviewer pending (SO-3) | | | | | | |
| 24 | `jamo:i` | approved by the owner for SO-2, 2026-11-23 (OD-SO11); textbook check by the reviewer pending (SO-3) | | | | | | |
| 25 | `jamo:giyeok-batchim` | approved by the owner for SO-2, 2026-11-23 (OD-SO11); textbook check by the reviewer pending (SO-3) | | | | | | |
| 26 | `jamo:nieun-batchim` | approved by the owner for SO-2, 2026-11-23 (OD-SO11); textbook check by the reviewer pending (SO-3) | | | | | | |
| 27 | `jamo:rieul-batchim` | approved by the owner for SO-2, 2026-11-23 (OD-SO11); textbook check by the reviewer pending (SO-3) | | | | | | |
| 28 | `jamo:mieum-batchim` | approved by the owner for SO-2, 2026-11-23 (OD-SO11); textbook check by the reviewer pending (SO-3) | | | | | | |
| 29 | `jamo:bieup-batchim` | approved by the owner for SO-2, 2026-11-23 (OD-SO11); textbook check by the reviewer pending (SO-3) | | | | | | |
| 30 | `jamo:ieung-batchim` | approved by the owner for SO-2, 2026-11-23 (OD-SO11); textbook check by the reviewer pending (SO-3) | | | | | | |

## 5. Sources

In OD-SO3 order. Seen 2026-11-22 unless noted.

**S1 — 국정 국어 1-1 (2022 개정 교육과정; 교육부, 2024) and its 교사용 지도서. Not reached; cited by no row.**
Searched: web searches for the textbook's 자음자/모음자 쓰는 순서 pages, 교사용 지도서 PDFs, and teacher and parent pages reproducing them. The textbook and guide PDFs are distributed through 에듀넷 / school USBs behind teacher login; no openly viewable page with the diagrams was found. Pointers for the reviewer (not seen): the 2022 edition's 국어 1-1 ㉮ is organised as 한글 놀이 with 모음자 놀이 and 자음자 놀이 sections (bookseller listing, not opened); for the previous (2015 개정) edition, 실천교육교사모임's lesson page cites 국어 1-1 p.52 (writing ㄱ–ㅎ), pp.80–81 (vowel order) and 국어 활동 pp.14–27 (consonant tracing) — https://sites.google.com/view/onschool/1학년/1학년-국어 (its linked videos were not watched).

**S2 — 국립국어원 materials.** No 국립국어원 page with a letter-by-letter stroke order was found (confirming the spec's note of 2026-11-21).

- **S2a** — 국립국어원 on X (@urimal365), reply of 2014-06-20 (date from the post id): "한글 자모의 획순은 규정되어 있지 않습니다. 다만, 초등학교 교과 과정에서 지도하는 자음의 획순은 제시하신 대로입니다." https://x.com/urimal365/status/479865891211841537 — **seen only as a search-result snippet**; the page itself refused automated access (HTTP 402), so the question it answers (which order was "제시") could not be read. Used only for "no official stroke order is set".
- **S2b** — 국립국어원 온라인가나다, "ㅊㅎ 표기방법다른점", asked 2026-01-24, answered 2026-01-27. https://www.korean.go.kr/front/onlineQna/onlineQnaView.do?mn_id=216&qna_seq=326821&pageIndex=1 — the top stroke of ㅊ/ㅎ appears as 가로점, 세로점, 사선점; "명확히 규정되어 있는 바는 따로 없습니다". About letterforms, not stroke order.
- **S2c** — 홍윤표, 「한글 字形의 標準化에 대하여」, 『국어생활』 1989년 가을호 (국어연구소, now 국립국어원). https://www.korean.go.kr/nkview/nklife/1989_3/18_1.html — a proposal on **letter shapes** (it says so), not a stroke-order standard. Used for ㅈ (3-stroke shape proposed; 2-stroke shape in 국정 textbook 명조), ㅊ/ㅎ (horizontal top stroke proposed; vertical historical), ㅌ (handwriting form; historical order). 37 years old.
- **S2d** — 국립국어원, 「초급 한국어(쓰기) 교원용 지침서」 (development report; year not shown on the pages read), 「한글 익히기」 pp.3–4: "한글 자모의 쓰는 순서는 기본적으로 왼쪽에서 오른쪽으로, 위에서 아래로의 방향을 따른다." https://www.korean.go.kr/common/download.do?file_path=reportData&c_file_name=cc9a75c9-14ac-4d4f-ab04-1f5e4fa08558_1.pdf&o_file_name=초급+한국어(쓰기)+교원용+지침서+개발+보고서_2.pdf — general principle only; the learner book's diagrams it refers to were not found.
- Also checked, no stroke order shown: 국립국어원 「초등학생을 위한 표준 한국어 1」 classroom workbook (KSL), units 모음 1 and 자음 1 — trace-over letters without numbers or arrows. http://file.edu4mc.or.kr/nime_upload/attach/00000/2651/20200512160628189.pdf

**S3 — 세종학당 (King Sejong Institute) beginner textbooks. Not reached.** 『세종한국어 1』 is offered as an e-book on 누리-세종학당 after sign-in; only unofficial copies on document-sharing sites were found, and they were not used.

**Other sources (not on the OD-SO3 list):**

- **X1** — 임성규 (광주교육대학교 국어교육과), 「기초 문자 교육 방법론」, lecture notes, KOCW 2016. http://vod3.kocw.net/KOCW/document/2016/gnue/limsonggyu/1.pdf
  - p.4 "⑶ 자모의 필순": principles ("획은 위에서 아래로, 앞에서 뒤로 쓴다", "모양은 위 - 가운데 - 아래 순서로 쓴다", "짝을 이루는 것은 앞 - 뒤 순서로 한다", "막는 것(책받침)은 마지막에 한다") and [표 2] 국어 자음자의 획수와 필순 (1획 ㄱ ㄴ ㅇ; 2획 ㄷ ㅅ ㅈ ㅋ; 3획 ㄹ ㅁ ㅊ ㅌ ㅎ; 4획 ㅂ ㅍ; notes quoted in the rows).
  - pp.6–7 [표 4] 국어 자음자와 모음자의 필순 (worksheet "필순 익히기 2-①/②"): numbered, arrowed diagrams for the 14 consonants and ㅏ ㅓ ㅗ ㅜ ㅡ ㅣ (not ㅑ ㅕ ㅛ ㅠ). Each diagram is about 96 × 96 px; the ① … ④ numbers and straight arrows are legible, the arrows round ㅇ and ㅎ's circle are not. The notes do not say where the diagrams come from (they look like scans of a printed workbook).
  - Caveat: university lecture notes, not a textbook; edition of the diagrams unknown.
- **X2** — 글씨방, "한글 쓰기 순서(획순) — 자음 모음 바르게 쓰는 법 + 연습 프린트". https://geulssibang.com/hangul/order/ — all 24 jamo. No author, no cited source, "© 2026". **Weak.** Its counts and orders match AU-14 on every letter (it does not state the direction of the ㅊ/ㅎ 꼭지); it may share AU-14's own assumptions, so it does not count as independent confirmation.
- **X3** — "기본 모음 2: ㅑ·ㅕ·ㅛ·ㅠ — 획 하나로 y 소리 더하기". https://www.leemihee-korean-lecture.com/basics/alphabet/korean-basic-vowels-2 — no author, no date, no cited source ("창작 교육 콘텐츠"). **Weak.**

**Found but not read (for the reviewer):** 최종윤, 「한글 자모 필순 지도에 대한 고찰」, 『청람어문교육』 65 (2018), pp.127–152, doi:10.26589/jockle..65.201803.127 — studies how jamo stroke-order teaching changed over time and its principles; the full text was not openly available. It is the most likely published source for textbook-by-textbook differences (ㅊ/ㅎ top stroke, ㅈ count).

**Searched with no usable result:** a 2022-edition change to ㅈ's stroke count; textbook ㅎ 꼭지 direction; 국립국어원 온라인가나다 on 필순; 국립국어원 한국어교수학습샘터; 시모노세키한국교육원's 자모음쓰기 sheet (download refused).
