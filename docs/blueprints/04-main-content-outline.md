# 메인 학습 컨텐츠 아웃라인 & 계획 v1
## Heritage Journey — 확장 가능한 격자 구조

> **목적**: Heritage 테마가 콘텐츠 확장에 따라 무한히 가지를 뻗을 수 있도록 학습 구조를 재설계.
> 동시에 학습 세션을 더 짧게 쪼개 작은 성취를 자주 만든다.
>
> **선행 문서**: 핵심기능_구체화_설계명세 v1, 엔지니어링_블루프린트 v2
> **이 문서가 변경한 것**: Level↔Theme 직교 구조, 세션 길이 단축, Quest 단위 도입
> **버전**: v1.0
> **기준일**: 2026.04

---

## 0. 핵심 구조 변경: 직교 격자 (Orthogonal Grid)

### 0.1 잘못된 구조 (이전 문서)

```
Level 0 = 집현전 테마 (고정)
Level 1 = 풍속화 테마 (고정)
Level 2 = 팔만대장경 (고정)
...
```

문제:
- 콘텐츠 추가 시 새 Level을 만들거나 기존 Level을 헤집어야 함
- 같은 언어 난이도에서 여러 시대를 다룰 수 없음
- 학습자가 "재미있는 시대"만 골라 가는 자유도 없음

### 0.2 새 구조: 격자 (Grid)

```
                          ─── Heritage Themes (가로축) ───
                  훈민정음    풍속화      팔만대장경    종묘     실록
                  (창제)     (생활)      (기록)       (의례)   (기록)
                  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Stage 1│           ●          ●           ●           ●         ●
한글기초│        Episode    Episode     Episode     Episode   Episode
       │         1.1       1.2         1.3         1.4       1.5
       │
Stage 2│           ●          ●           ●           ●         ●
첫단어  │       Episode    Episode     Episode     Episode   Episode
       │        2.1       2.2         2.3         2.4       2.5
       │
Stage 3│           ●          ●           ●           ●         ●
구문    │       Episode    Episode     Episode     Episode   Episode
       │        3.1       3.2         3.3         3.4       3.5
       │
... (계속)
```

**핵심 원리**:
- **Stage(세로)** = 언어 난이도. 사용자는 위에서 아래로 진행.
- **Theme(가로)** = 한국 문화유산. 같은 Stage 안에서 여러 테마 공존.
- **Episode** = Stage × Theme의 교차 칸. 콘텐츠의 단위.

### 0.3 이 구조의 확장성

새 콘텐츠가 추가될 때:

| 추가 형태 | 처리 방식 |
|---|---|
| 새 Stage 추가 (예: 고급 회화) | 격자에 행 하나 추가 |
| 새 Theme 추가 (예: 독립운동) | 격자에 열 하나 추가 |
| 특정 Stage·Theme 심화 | Episode 추가 |
| 계절·이벤트 콘텐츠 (설날) | 임시 열로 추가하고 종료 후 정규화 |
| 사용자 요청 콘텐츠 | 빈 칸을 채우는 형태 |

→ 아키텍처 변경 없이 콘텐츠 작업자만의 작업으로 확장 가능.

### 0.4 학습자 진행 규칙

- **기본 진행**: Stage 1의 Episode를 다 끝내야 Stage 2로 진행 (선형)
- **테마 자유도**: 같은 Stage 안에서는 어느 Theme의 Episode부터 해도 OK
- **추천 동선**: 시스템이 동기·취향 기반으로 다음 Episode 추천
- **진단 결과**: Stage 진입점만 결정. Theme 시작 순서는 자유.

이게 v1의 "Journey(고정 순서) vs Library(자유 선택)" 텐션을 더 깔끔하게 푸는 방식이에요. 격자 자체가 두 모드를 동시에 만족합니다.

---

## 1. 새로운 Stage 체계 (이전 Level → Stage)

### 1.1 명명 변경

이전 "Level 0~4"는 게임 잔재 같은 느낌이라 너무 일반적. **Stage**로 변경하고 각 Stage에 의미 있는 이름 부여:

| 구 명칭 | 신 명칭 | 한국어 |
|---|---|---|
| Level 0 | **Stage 1: Hangul** | 한글의 문 |
| Level 1 | **Stage 2: Words** | 첫 낱말 |
| Level 2 | **Stage 3: Phrases** | 짧은 말 |
| Level 3 | **Stage 4: Conversations** | 대화 |
| Level 4 | **Stage 5: Stories** | 짧은 이야기 |

확장 여지:
- Stage 6: 일기 (Journals)
- Stage 7: 편지 (Letters)
- Stage 8: 어린이 신문 읽기 (News)
- Stage 9: 짧은 발표 (Speech)
- ... 등 무한 확장 가능

### 1.2 각 Stage의 학습 목표 (Anchor Skill)

각 Stage는 명확한 **Anchor Skill** 하나로 정의됨:

| Stage | Anchor Skill | 측정 가능 목표 |
|---|---|---|
| Stage 1 | Hangul Recognition | 자모 24자 + 기본 받침 6개 인식 |
| Stage 2 | Vocabulary | 생활 단어 200개 인지·발음 |
| Stage 3 | Pattern Production | 8가지 기본 문형으로 짧은 문장 |
| Stage 4 | Conversation | 5턴 이내 일상 대화 |
| Stage 5 | Reading & Writing | 짧은 글 읽고 일기 쓰기 |

### 1.3 Stage 추가 규칙 (확장성 보장)

새 Stage를 추가할 때 따라야 할 규칙:
1. 단 하나의 Anchor Skill을 가져야 함
2. 이전 Stage들의 Anchor Skill을 전제로 해야 함
3. 측정 가능한 완료 기준이 있어야 함
4. 최소 3개 Theme이 동시에 다룰 수 있어야 함 (격자 의미 유지)

---

## 2. Heritage Theme 분류 체계

### 2.1 5대 Theme Pillar (확장 가능)

문화유산을 무작정 나열하면 길을 잃음. 5개의 큰 기둥으로 분류해서 어떤 새 콘텐츠가 들어와도 어느 기둥에 속하는지 분명하게:

```
┌─────────────────────────────────────────────────────┐
│ Pillar A: 글과 책의 유산 (Letters & Books)          │
│  · 훈민정음, 팔만대장경, 직지심체요절,              │
│    조선왕조실록, 승정원일기, 한글 활자             │
│  · 키워드: 기록·언어·지식                           │
├─────────────────────────────────────────────────────┤
│ Pillar B: 사람들의 삶 (People's Daily Life)         │
│  · 김홍도·신윤복 풍속화, 시장, 농촌, 민속놀이,     │
│    한복, 음식, 가족 관계                            │
│  · 키워드: 일상·풍속·놀이                           │
├─────────────────────────────────────────────────────┤
│ Pillar C: 나라와 의례 (Nation & Ritual)             │
│  · 종묘, 사직, 궁궐, 왕실 의례, 국가 무형유산,    │
│    판소리, 종묘제례악                               │
│  · 키워드: 공식·의례·예술                           │
├─────────────────────────────────────────────────────┤
│ Pillar D: 자연과 장소 (Nature & Places)             │
│  · 산·강·섬, 정원·정자, 명승, 서원·향교,          │
│    한옥마을, 사찰                                   │
│  · 키워드: 공간·자연·여행                           │
├─────────────────────────────────────────────────────┤
│ Pillar E: 발견과 만듦 (Discovery & Craft)           │
│  · 한지, 도자기, 금속활자, 측우기, 물시계,         │
│    천문, 의학(동의보감), 한복 만들기                │
│  · 키워드: 과학·공예·창조                           │
└─────────────────────────────────────────────────────┘
```

### 2.2 5 Pillar의 미덕

- **MECE에 가까움**: 거의 모든 한국 문화유산이 5개 중 하나로 분류됨
- **시각적 구별**: 각 Pillar의 색·아이콘·캐릭터를 다르게 잡으면 어린이가 빠르게 인식
- **확장 균형**: 한 Pillar만 비대해지지 않게 의식적 관리 가능
- **Library 메뉴 직접 매핑**: Library 첫 화면이 5개 카드로 깔끔

### 2.3 Theme 단위 (Pillar 하위)

각 Pillar 안에 구체적 Theme이 들어감:

```
Pillar A — 글과 책의 유산
  ├─ Theme A1: 훈민정음 (한글 창제)
  ├─ Theme A2: 팔만대장경 (목판 인쇄)
  ├─ Theme A3: 조선왕조실록 (역사 기록)
  ├─ Theme A4: 승정원일기 (일상 기록)
  └─ Theme A5: 직지심체요절 (금속활자) ... 확장

Pillar B — 사람들의 삶
  ├─ Theme B1: 김홍도의 시장
  ├─ Theme B2: 신윤복의 도시
  ├─ Theme B3: 농촌의 사계절
  ├─ Theme B4: 한복과 옷차림
  └─ Theme B5: 명절과 세시풍속 ... 확장

Pillar C — 나라와 의례
  ├─ Theme C1: 종묘제례
  ├─ Theme C2: 궁궐의 하루
  ├─ Theme C3: 판소리 마당
  └─ Theme C4: 무형문화재 ... 확장

Pillar D — 자연과 장소
  ├─ Theme D1: 한옥마을
  ├─ Theme D2: 산과 강
  ├─ Theme D3: 사찰과 서원
  └─ Theme D4: 정원과 정자 ... 확장

Pillar E — 발견과 만듦
  ├─ Theme E1: 한지와 붓
  ├─ Theme E2: 도자기 만들기
  ├─ Theme E3: 측우기와 자격루
  ├─ Theme E4: 동의보감
  └─ Theme E5: 천문과 우주 ... 확장
```

### 2.4 Pillar별 캐릭터 동반자

각 Pillar에는 호야와 함께하는 보조 캐릭터를 둬서 어린이가 Pillar를 즉시 식별:

| Pillar | 캐릭터 | 모티프 |
|---|---|---|
| A. 글과 책 | **훈이** (세종의 고양이) | 까만 먹빛 고양이, 붓을 들고 다님 |
| B. 사람들의 삶 | **풍이** (시장 아이) | 평범한 조선 아이, 활기참 |
| C. 나라와 의례 | **예이** (어린 무용수) | 한복 차림, 차분 |
| D. 자연과 장소 | **돌이** (산신령의 손자) | 도깨비 닮은 산 친구 |
| E. 발견과 만듦 | **장이** (장인의 제자) | 손에 항상 도구를 들고 있음 |

**호야**(주인공 호랑이)는 모든 Pillar를 관통. 보조 캐릭터들은 해당 Pillar에서만 등장 → 어린이가 "오늘 어느 동네 가지?" 결정.

---

## 3. Episode 구조 (격자의 한 칸)

### 3.1 Episode = Stage × Theme

하나의 Episode는 다음 좌표로 정의됨:

```
Episode 1.A1 = Stage 1 × Theme A1 (훈민정음)
              "훈민정음과 함께 자모 ㄱ ㄴ 배우기"

Episode 2.B1 = Stage 2 × Theme B1 (김홍도 시장)
              "시장에서 음식 단어 배우기"

Episode 3.C1 = Stage 3 × Theme C1 (종묘제례)
              "의례에서 듣는 짧은 문장"

... 등
```

### 3.2 Episode 내부 구조

각 Episode는 더 작은 단위로 쪼개짐:

```
Episode (10~15분)
   │
   ├─ Quest 1 (3~4분) ← 가장 작은 학습 단위
   ├─ Quest 2 (3~4분)
   └─ Quest 3 (3~4분)
        │
        └─ 각 Quest = Step 5개로 구성
              (Hook · Discover · Play · Check · Celebrate)
```

이 구조의 핵심:
- **Quest는 항상 3~4분** — 어린이가 한 번에 끝낼 수 있는 단위
- **Quest 끝마다 작은 보상** (스티커·별·캐릭터 반응)
- **Episode 끝에 큰 보상** (문화유산 컬렉션 카드 획득)
- **Stage 끝에 더 큰 보상** (Stage Certificate)

### 3.3 세션 길이 비교 (이전 vs 신)

| 단위 | v1 | 신 (이번) |
|---|---|---|
| 한 번 앉아서 끝내는 것 | 1 Lesson (6분) | **1 Quest (3~4분)** |
| 한 챕터 | 3~5 Lesson (20분+) | **1 Episode = 3 Quest (10~12분)** |
| 한 묶음 | Chapter (1주 학습) | **Episode** |
| 한 단계 | Level | **Stage** |

**작은 성취 빈도**:
- v1: 평균 6분마다 완료감
- 신: **평균 3~4분마다 완료감 + 12분마다 큰 완료감 + 컬렉션 획득**

### 3.4 Quest 5 Step 상세 (3~4분 분배)

```
[Step 1] Hook (15~20초)
  · 캐릭터 등장: "오늘은 ㄱ을 배워보자!"
  · 매우 짧은 애니메이션
  · 분위기 조성

[Step 2] Discover (45~60초)
  · 새 학습 요소 1~2개만 소개 (절대 더 많이 X)
  · 음성·이미지·짧은 설명
  · 반복 노출 3회

[Step 3] Play (90~120초)
  · 미니게임 1개 (이전엔 2~3개 → 1개로 축소)
  · 5~7라운드 짧게
  · 실패해도 진행

[Step 4] Check (30~45초)
  · 2문항 (3문항에서 축소)
  · 가볍게 확인하는 분위기

[Step 5] Celebrate (15~20초)
  · 캐릭터 환호
  · 별·스티커 획득
  · 다음 Quest 티저 한 줄

총 3~4분
```

### 3.5 학습 요소량 원칙

각 Quest에서 학습하는 새 요소 수는 엄격히 제한:

| Stage | 한 Quest의 새 요소 |
|---|---|
| Stage 1 (한글) | 자모 1~2개 |
| Stage 2 (단어) | 단어 3~4개 (테마 묶음) |
| Stage 3 (문장) | 문형 1개 + 응용 문장 3개 |
| Stage 4 (대화) | 대화 시나리오 1개 (5턴 이내) |
| Stage 5 (이야기) | 짧은 이야기 1개 (5문장) |

**핵심**: 적게, 자주, 깊게. 이전 Quest 복습이 새 요소만큼 들어감.

---

## 4. 격자 채우기 — Stage 1 상세 설계 (예시)

이걸 보면 격자가 실제로 어떻게 작동하는지 명확해져요.

### 4.1 Stage 1 (한글) 격자 매핑

```
              A1훈민정음  A2팔만대장경  A3실록   B1시장   E3측우기
              ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Quest 1.x.1  │  ㄱ ㄴ      ㄷ ㄹ        ㅁ ㅂ    ㅏ ㅓ    ㅗ ㅜ
Quest 1.x.2  │  ㅏ + ㄱㄴ   ㅓ + ㄷㄹ    ...      ...      ...
Quest 1.x.3  │  쓰기 연습  쓰기 연습   ...      ...      ...
              (각 Theme = 1 Episode = 3 Quest)
```

### 4.2 Stage 1 Episode 5개 상세 (MVP)

**Episode 1.A1 — 훈민정음**
- 배경: 집현전, 세종이 한글을 만드는 장면
- 등장: 호야 + 훈이 (세종의 고양이)
- 학습: 자음 ㄱ ㄴ + 천지인 모음 ㅏ ㅓ (조음기관 시각화)
- Quest 1: ㄱ ㄴ 소리 익히기 (혀 모양 시각화)
- Quest 2: ㅏ ㅓ 소리 익히기 (입 모양 시각화)
- Quest 3: 가·나·거·너 조립 + 첫 글자 읽기
- 컬렉션 보상: "훈민정음 해례본 한 페이지" 카드

**Episode 1.A2 — 팔만대장경**
- 배경: 해인사, 거대한 경판들 사이
- 등장: 호야 + 장이 (장인의 제자)
- 학습: 자음 ㄷ ㄹ ㅁ + 모음 ㅗ
- Quest 1: ㄷ ㄹ 소리 (혀 위치)
- Quest 2: ㅁ + ㅗ 소리
- Quest 3: 도·로·모 조립
- 컬렉션 보상: "경판 한 장" 카드 (실제 팔만대장경 사진)

**Episode 1.A3 — 조선왕조실록**
- 배경: 사관이 글을 쓰는 장면
- 등장: 호야 + 어린 사관 (Stage 5 캐릭터의 조상격)
- 학습: 자음 ㅂ ㅅ + 모음 ㅜ
- Quest 1: ㅂ ㅅ 소리
- Quest 2: ㅜ 소리
- Quest 3: 부·수·구 조립
- 컬렉션 보상: "실록 페이지" 카드

**Episode 1.B1 — 시장 (김홍도)**
- 배경: 김홍도 풍속화 속 조선 시장
- 등장: 호야 + 풍이 (시장 아이)
- 학습: 자음 ㅈ ㅊ + 모음 ㅣ
- Quest 1: ㅈ ㅊ 소리
- Quest 2: ㅣ 소리
- Quest 3: 지·치·기 조립
- 컬렉션 보상: "씨름도" 카드

**Episode 1.E3 — 측우기**
- 배경: 세종 시대 발명품 작업장
- 등장: 호야 + 장이
- 학습: 나머지 자음 ㅇ ㅎ + 받침 기초
- Quest 1: ㅇ ㅎ 소리
- Quest 2: 받침 ㅇ ㄴ ㅁ
- Quest 3: 받침 있는 글자 읽기
- 컬렉션 보상: "측우기 도면" 카드

### 4.3 Stage 1 완주 시점

5개 Episode × 3 Quest = **15 Quest 완주 → Stage 1 졸업**
총 학습 시간: 15 × 3.5분 = **약 52분** (이전 Level 0 168분 → 1/3 단축)
주 5회 × 1 Quest = **3주만에 Stage 1 완주 가능**

→ "한 달 만에 한글을 다 떼다" 라는 강력한 마케팅 카피 가능

### 4.4 Stage 1 졸업 인증서

5개 Episode가 끝나면 받는 것:
- **Hangul Discovery Certificate**
- 형식: 훈민정음 해례본 디자인 차용
- 본인 이름이 한글 가운데 배치
- 5개 컬렉션 카드 모음 + "당신은 이 5개의 한국 문화유산을 만났어요" 표시
- PDF 다운로드, 부모 공유 가능

---

## 5. Stage 2~5 격자 개략 (확장 청사진)

상세 설계는 Stage 1이 완성된 뒤 차례로. 지금은 격자가 어떻게 채워질지의 청사진만:

### 5.1 Stage 2 (Words) 예상 격자

```
                A1훈민정음   A3실록    B1시장    B5명절    D1한옥
Episode 2.A1 │  글자 단어   사관 단어  음식 이름  설날 단어  집의 부분
Episode 2.A3 │
Episode 2.B1 │
Episode 2.B5 │
Episode 2.D1 │
```

- 5개 Episode × 3 Quest = **15 Quest**
- 학습 단어 약 **60개** (Quest당 평균 4단어)
- 약 4~6주에 완주

### 5.2 Stage 3 (Phrases) 예상 격자

문형 8개를 5개 Theme에 분산:
- "~이에요/예요" (시장에서 인사)
- "~이 있어요" (한옥에서 사물 묘사)
- "~을 주세요" (시장에서 요청)
- "~고 싶어요" (자기소개)
- ...

### 5.3 Stage 4 (Conversations) 예상 격자

각 Theme에서 시나리오 1개:
- A1훈민정음: "세종에게 한글을 가르쳐달라고 요청"
- B1시장: "시장에서 떡 사기"
- C1종묘제례: "행사 안내 듣고 답하기"
- D1한옥: "친구네 집 방문"
- E2도자기: "도공에게 만들기 배우기"

### 5.4 Stage 5 (Stories) 예상 격자

짧은 글 읽기·쓰기:
- A3실록: "오늘의 짧은 기록"
- B5명절: "추석 이야기"
- C3판소리: "흥부와 놀부 (요약본)"
- D2산: "산에 간 날"
- E4동의보감: "건강 일기"

### 5.5 Stage 6+ 확장 여지

- Stage 6: 일기 쓰기
- Stage 7: 짧은 편지
- Stage 8: 동시·동요 짓기
- 특별 Stage: 한자 기초, 옛 한글, 사투리 ...

---

## 6. 컬렉션 시스템 — 작은 성취의 축적

### 6.1 무엇을 모으나

Episode 완료 시 받는 **Heritage Card**가 핵심 보상:
- 실제 문화유산 이미지 (공공누리 자료)
- 한 줄 설명 (영문·한국어 병기)
- 획득 일자
- 캐릭터 한마디

### 6.2 카드 시스템 단계

```
Quest 완료 → 별 1개 (작은 보상)
Episode 완료 → Heritage Card 1장 (중간 보상)
같은 Pillar 5장 모으기 → Pillar Badge (큰 보상)
모든 Pillar Badge → Hall of Heritage 입장 자격
```

### 6.3 Heritage Gallery (Library 내)

- 획득한 카드들을 한곳에서 보는 갤러리
- 각 카드 탭 시 짧은 학습 자료 (다시 보기)
- 부모와 함께 보는 공유 기능
- Phase 2: 카드 거래·선물 (단 어린이끼리는 안전 고려)

### 6.4 카드 디자인 일관성

- 모든 카드는 **세로 비율 (포켓몬 카드 형식)**
- Pillar별 색상 프레임 통일
- 좌상단: 출처 기관 + 공공누리 표시
- 우하단: 획득 일자

이 카드는 **공공누리 출처 표시 의무를 자연스럽게 통합**하는 우아한 방법이기도 해요. 별도 Credits 화면 없이 모든 카드가 출처를 들고 있음.

---

## 7. 데이터 모델 변경 (격자 구조 반영)

### 7.1 콘텐츠 JSON 스키마 변경

```json
// Stage 정의
{
  "id": "stage_1",
  "name": {"en": "Hangul", "ko": "한글의 문"},
  "anchor_skill": "hangul_recognition",
  "order": 1,
  "completion_criteria": {
    "min_episodes_completed": 5,
    "min_quests_per_episode": 3
  }
}

// Theme 정의
{
  "id": "theme_a1",
  "pillar": "A",
  "name": {"en": "Hunminjeongeum", "ko": "훈민정음"},
  "era": "1443",
  "characters": ["hoya", "hooni"],
  "color_palette": "indigo_ink"
}

// Episode 정의 (격자의 한 칸)
{
  "id": "episode_1_a1",
  "stage_id": "stage_1",
  "theme_id": "theme_a1",
  "title": {"en": "Meeting Hangul"},
  "estimated_minutes": 12,
  "quests": ["quest_1_a1_1", "quest_1_a1_2", "quest_1_a1_3"],
  "completion_card": "card_hunminjeongeum_page",
  "prerequisite_episodes": []  // Stage 1 첫 Episode면 빈 배열
}

// Quest 정의 (가장 작은 학습 단위)
{
  "id": "quest_1_a1_1",
  "episode_id": "episode_1_a1",
  "sequence": 1,
  "estimated_minutes": 3.5,
  "learning_elements": ["g_consonant", "n_consonant"],
  "steps": [
    {"type": "hook", "ref": "hook_hooni_intro"},
    {"type": "discover", "ref": "discover_g_n_articulation"},
    {"type": "play", "ref": "minigame_match_sound_to_shape"},
    {"type": "check", "ref": "check_g_n_2q"},
    {"type": "celebrate", "ref": "celebrate_first_consonants"}
  ],
  "rewards": {
    "stars": 3,
    "xp": 10
  }
}

// Heritage Card 정의
{
  "id": "card_hunminjeongeum_page",
  "pillar": "A",
  "title": {"en": "Page from Hunminjeongeum Haerye"},
  "image_url": "/assets/cards/hunminjeongeum_haerye_p1.jpg",
  "source": {
    "institution": "간송미술문화재단",
    "license": "public_domain",
    "attribution": "훈민정음 해례본, 1446년"
  },
  "description": {
    "en": "The original document explaining how Hangul was created."
  }
}
```

### 7.2 학습자 진행 추적 (DB)

```sql
-- 격자 위치 추적
CREATE TABLE child_stage_progress (
  child_id        UUID,
  stage_id        VARCHAR,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  PRIMARY KEY (child_id, stage_id)
);

CREATE TABLE child_episode_progress (
  child_id           UUID,
  episode_id         VARCHAR,
  quests_completed   INTEGER DEFAULT 0,
  card_collected     BOOLEAN DEFAULT FALSE,
  completed_at       TIMESTAMPTZ,
  PRIMARY KEY (child_id, episode_id)
);

CREATE TABLE child_quest_attempt (
  id              UUID PRIMARY KEY,
  child_id        UUID,
  quest_id        VARCHAR,
  completed_at    TIMESTAMPTZ,
  stars_earned    SMALLINT,
  source_view     VARCHAR  -- journey / library / classroom
);

CREATE TABLE child_heritage_cards (
  child_id        UUID,
  card_id         VARCHAR,
  collected_at    TIMESTAMPTZ,
  PRIMARY KEY (child_id, card_id)
);
```

이 구조가 격자를 자연스럽게 반영함. Episode·Quest 둘 다 별도 테이블로 진행 관리.

---

## 8. 추천 알고리즘 (어떤 Episode를 다음에 보여줄지)

격자에서 자유 선택을 허용하면서도 길을 잃지 않게 추천이 필요:

### 8.1 동기 기반 가중치

온보딩에서 받은 사용자 동기에 따라 Theme 우선순위:

| 사용자 동기 | 우선 Pillar |
|---|---|
| "가족이 한국 사람이에요" | B (사람들의 삶) → 친근함 우선 |
| "K-pop 좋아요" | C (나라와 의례) → 전통 공연 연결 |
| "그냥 궁금해요" | A (글과 책) → 한글의 멋 |
| "한국 친구 있어요" | B (사람들의 삶) → 또래 문화 |

→ 같은 Stage 안에서 어떤 Theme을 먼저 권할지 결정.

### 8.2 단순한 추천 로직 (MVP 수준)

```python
def recommend_next_episode(child):
    current_stage = child.current_stage
    completed = child.completed_episodes_in(current_stage)
    available = stage.episodes - completed

    if len(available) == 0:
        return advance_to_next_stage(child)

    # 1순위: 동기 매칭 Pillar
    motivation_pillar = MOTIVATION_TO_PILLAR[child.motivation]
    matches = [e for e in available if e.pillar == motivation_pillar]
    if matches:
        return matches[0]

    # 2순위: 나머지 중 첫 번째
    return available[0]
```

복잡한 ML 추천은 사용자 충분히 모인 후 (Phase 2+).

---

## 9. 콘텐츠 제작 우선순위

### 9.1 MVP 절대 필수

- **Stage 1 전체 5 Episode** (15 Quest) ← 한글 떼기
- 캐릭터: 호야 + 훈이 + 풍이 + 장이 (Pillar A·B·E)
- 컬렉션 카드 5장
- Stage 1 졸업 인증서

### 9.2 MVP 맛보기

- **Stage 2 첫 Episode 1개** (3 Quest) ← 다음 Stage 미리보기
- **Stage 4 시나리오 1개** (음성 인식 데모) ← Heritage 테마 활용

### 9.3 Phase 2 (M12~M18)

- Stage 2 전체 (5 Episode 더 추가)
- Stage 3 전체
- 캐릭터 예이·돌이 추가 (Pillar C·D)

### 9.4 Phase 3+

- Stage 4·5
- 각 Pillar의 Theme 확장 (10개 이상)
- 사용자 요청 기반 신규 Theme

---

## 10. 콘텐츠 생산 워크플로우 (1인 + AI)

각 Episode 제작에 들어가는 작업:

```
[1] 격자 위치 결정
    Stage·Theme·Episode 번호 부여

[2] 콘텐츠 명세서 작성
    학습 요소·캐릭터·시나리오·문화유산 자료 결정

[3] 공공누리 자료 수집
    이번 Episode에서 쓸 자료 다운로드 + 메타데이터 기록

[4] Claude로 Quest 3개 JSON 초안 생성
    명세서를 입력으로 LLM이 초안 작성

[5] TTS 생성 (Naver Clova 또는 ElevenLabs Korean)
    각 음성 클립 생성·검수

[6] Claude Design으로 화면별 시각 자산
    공공누리 자료 통합

[7] Heritage Card 디자인
    획득 보상 카드

[8] Git PR
    JSON + 자산 + 메타데이터 한꺼번에

[9] 자체 테스트 + 학부모 베타 1~2명 검수

[10] 배포
```

**1 Episode 제작 시간 추정** (1인 + AI 도움):
- 2~3일 (단 첫 몇 개는 5~7일, 워크플로우 정착 후 단축)
- Stage 1 전체 5 Episode = **2~3주 집중 작업**

---

## 11. 다음 작업 우선순위

### 11.1 지금 즉시 (이번 주)

1. **콘텐츠 명세서 템플릿 작성** — Episode 1개를 작업할 때 작성하는 표준 양식
2. **Episode 1.A1 (훈민정음) 명세서 채우기** — 첫 콘텐츠 제작 실험
3. **Claude 프롬프트 작성** — 명세서 → Quest JSON 변환

### 11.2 Heritage 자료 수집 (다음 주)

Stage 1에서 쓸 자료 5개:
- 훈민정음 해례본 페이지 (저작권 만료)
- 팔만대장경 경판 (국가유산청 공공누리 1유형 확인)
- 조선왕조실록 페이지 (국사편찬위원회)
- 김홍도 씨름도 (국립중앙박물관)
- 측우기 사진 (국가유산청)

### 11.3 캐릭터 디자인 (병렬)

Claude Design으로 캐릭터 시안:
- 호야 (5 포즈: 인사·놀라움·기쁨·생각·잠)
- 훈이 (집현전 의상)
- 풍이 (조선 아이 의상)
- 장이 (장인 의상)

---

## 부록: 격자 채우기 전체 비전 (시각화)

```
                    Pillar A    Pillar B    Pillar C    Pillar D    Pillar E
                    글과 책     사람들 삶    의례        장소        창조
                  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Stage 1 한글       ●A1 ●A2 ●A3   ●B1            -            -            ●E3
Stage 2 단어       ◐A1            ◐B1 ◐B5     -            ◐D1          -
Stage 3 문장       ◯A2            ◯B1            ◯C1          ◯D1          ◯E1
Stage 4 대화        -              ◯B1 ◯B5      ◯C1 ◯C2     ◯D1          ◯E2
Stage 5 이야기      ◯A3            ◯B5            ◯C3          ◯D2          ◯E4
                    .              .              .              .              .
                    .              .              .              .              .

● = MVP 제작 완료
◐ = MVP 맛보기 (1 Episode만)
◯ = Phase 2+
```

이 표가 채워져 가는 게 바로 "Heritage Journey가 풍성해지는 과정"이고, 사용자에게도 진행도로 보여줄 수 있어요. **"우리는 한국 문화의 격자 한 칸씩을 함께 채워가는 중이에요"** 가 마케팅 메시지.

---

*문서 버전 v1.0 — 2026.04.19*
*다음 업데이트: Episode 1.A1 명세서 완성 후 v1.1*
