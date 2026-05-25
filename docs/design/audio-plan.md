# Audio Plan — BGM · 효과음(SFX) · 음성(Voice)

> 배경음악(BGM)·효과음(SFX)·학습 음성(Voice/TTS)의 **토큰·플레이어·에셋·
> 라이선스·우선순위** 전체 계획. 인터랙션 사운드 규약은
> `docs/design/interaction-patterns.md` §사운드 — **모든 사운드 on/off 가능 +
> 시각 백업 필수**(사운드를 꺼도 피드백이 전달되어야 함).

**Status**: draft · **Owner**: solo dev · **Scope**: audio infra + assets · **Updated**: 2026-05-25

---

## 1. 현황

- `apps/mobile/src/platform/audio.ts`: `speak()`(expo-speech TTS, ko-KR 0.78× rate),
  `playJamoSound()`(placeholder — 현재 TTS 경유), `setMuted()/isMuted()`.
- **sound 토큰 0** — `minigame-skill` 의 `tokens.sound.positive-short`·`gentle-oops` 는
  **미구현(희망 사항)**. `packages/design-system/src/tokens.ts` 에 audio 섹션 없음.
- **BGM/SFX 플레이어 없음**, 오디오 파일(mp3/wav/ogg) **0개**.
- `content-schema` jamo 에 `audioRef?`(optional, 미바인딩). minigame round schema 엔 audio 필드 없음.
- `ui-store.soundOn` / `hapticsOn` 토글 상태 존재(연동 대상).
- 라이선스 csv 없음.

→ **오디오는 인프라부터** 필요(토큰 정의 → 플레이어 → 에셋 조달).

## 2. 오디오 범주

| 범주 | 예 | 길이 | 우선순위 |
|---|---|---|---|
| **음성(Voice)** | 자모·단어 발음, 호야 대사 | 0.5–3s | P0 |
| **효과음(SFX)** | 정답·오답·탭·완료·카드·별 | 0.1–1s | P0 |
| **배경음악(BGM)** | 화면/스테이지 배경 루프 | 30–90s loop | P1 |

## 3. sound 토큰 (design-system 추가 계획)

`packages/design-system/src/tokens.ts` 에 `sound` 섹션 추가(semantic-first, `docs/design/tokens.md`):

- `positiveShort` (정답), `gentleOops` (오답), `tap` (선택),
  `reward` (별/보상), `cardUnlock` (카드 획득), `transition` (화면 전환),
  `levelComplete` (스텝/퀘스트 완료).
- 토큰 = **의미 키 → 에셋 경로** 매핑. 코드에서 `tokens.sound.positiveShort` 로 참조.
- 하드코딩 경로 금지(토큰 경유) — CLAUDE.md 토큰 규약과 동일.

## 4. 플레이어 아키텍처 (`platform/audio.ts` 확장)

- 엔진: **expo-av `Sound`** (TTS는 expo-speech 유지).
- 3 레이어:
  - **voicePlayer** — jamo/word MP3 재생, 없으면 **TTS fallback**(현행 유지).
  - **sfxPlayer** — 원샷·동시 재생, 짧은 버퍼 프리로드.
  - **bgmPlayer** — 단일 인스턴스, 무한 루프, 화면 전환 시 crossfade.
- 제어: `ui-store.soundOn` 연동(off → 전체 mute). 볼륨은 voice/sfx/bgm 개별.
  음성 재생 중 BGM **ducking**(자동 감쇠).
- 정책: 모든 사운드는 시각 피드백과 **중복**되어야 함(무음 사용자 식별 가능) — `interaction-patterns.md`.

## 5. 효과음(SFX) 계획

- 라운드 라이프사이클 매핑(`minigame-skill` §3.4):
  - correct → `positiveShort` (200ms 시각 + 사운드)
  - incorrect → `gentleOops` (shake + 사운드, **날카로운 buzz 금지**)
  - tap/select → `tap`
  - step / quest complete → `levelComplete`
  - card unlock → `cardUnlock`, star → `reward`
- 톤: 5–11세 대상, 부드럽고 비위협적(anti-shame). 오답도 격려조.
- 소스: **CC0** 라이브러리(예: Freesound CC0 필터, Kenney) 또는 자체 제작. 라이선스 csv 기록.
- 우선순위 **P0** — 저비용·즉각 체감.

## 6. 배경음악(BGM) 계획

- 화면/스테이지별 무드:
  - 홈·저니: 밝고 차분한 탐험. **국악 모티프**(가야금 등) 가미 — heritage 정체성.
  - 퀘스트(플레이): 경쾌하되 집중 방해 없는 저자극.
  - 보상·축하: 짧은 팡파레 스팅어.
  - (선택) 스테이지별 테마 변형.
- 길이: 30–90s **seamless 루프**. 화면 전환 crossfade.
- 볼륨: BGM은 낮게(voice/sfx 우선), 음성 재생 시 ducking.
- 소스: CC0/구매(예산). 우선순위 **P1**(음성·SFX 이후).

## 7. 음성(Voice)

- **jamo 30 MP3** — 단일 원어민 녹음(`docs/build-v1-prototype.md`). 현재 TTS fallback.
- 단어/문장(Stage 2+)은 점진 확장.
- `jamo.ts` 의 `audioRef` → voicePlayer 바인딩.
- **Voice Echo(STT)** 는 별도(서버 프록시 + 일일 한도, `minigame-skill` §3.8) — 본 문서 범위 밖.

## 8. 라이선스 (`content/assets-license.csv` 신규)

- 컬럼: `asset_path, category(voice/sfx/bgm), source, license, attribution, url`.
- **CC0 우선**. 구매 시 라이선스 증빙 보관. 공공누리 해당 시 KOGL.
- 향후 `content-validation` CI 가 csv 일치 검증.

## 9. 우선순위 / 마일스톤

| 단계 | 범위 |
|---|---|
| **P0** | sound 토큰 정의 + `sfxPlayer` + 핵심 SFX 6종 + jamo 30 음성 |
| **P1** | `bgmPlayer` + 홈/퀘스트/보상 BGM 3종 |
| **P2** | 스테이지별 BGM 변형, 단어 음성 확장 |

- 비용: CC0 우선, STT 한도 별도 관리.

## 10. 후속 스펙 (구현 시 `docs/specs/`)

- **F-AUDIO-001** — sound 토큰 + `sfxPlayer` + 핵심 SFX.
- **F-AUDIO-002** — `bgmPlayer` + BGM 3종 + ducking.
- **F-AUDIO-003** — jamo 30 음성 녹음·바인딩(TTS fallback 유지).
- `content-schema`: minigame round 에 `audioRef` 추가 검토.
