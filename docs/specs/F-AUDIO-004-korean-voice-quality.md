Status: ready

# F-AUDIO-004 — Korean voice quality: sounds before names, a voice we can trust, text when there is none, recordings that drop in

> **Start order (review 2, 2026-10-10)**: PR A-1 (schemas, telemetry names) and A-3 (pure logic) have no dependency; A-2 needs F-QUEST-002 Q-1 (PR #103: `JamoSchema.soundHint`, `KoText.spokenKo`) only for merge order in `content/jamo.ts`; A-8 (recording pipeline and copy) needs A-2. A-9 is blocked on the owner's recordings (T-017) and is a content-only PR. **Amends F-QUEST-002** (landed spec): the interim spoken-form map and the ㅇ treatment, see §3.2 "Interim map" and `AMENDMENTS-LANDED-SPECS.md`.

**Scope**: `packages/content-schema` (audio schemas, jamo fields, telemetry names) · `apps/mobile` (`platform/audio*.ts`, new `logic/audio/`, `store/audio-store.ts`, call sites in 8 screens, MP3 path, PWA build) · `scripts/` (recording pipeline) · `docs/launch` (runbook Step 12, copy claims) · wireframe `design/wireframes/minigame/audio-fallback.md`
**Owner**: solo dev
**Rollout**: PWA first (primary channel, CLAUDE.md header "primary channel: web PWA"), native player after; recordings (owner task T-017) land as a content PR with no code change. PR order in §6.

Parent / siblings: F-001 §3.2-§3.4 (Match Sound; **this spec amends §3.2 and §3.3**, §6) · F-009 (narrated stroke demo; amended) · F-QUEST-002 §3.12 (consumes `playPrompt` and `spokenKo`; **keeps its signature**) · F-CNT-002 (romanization; validates `spokenRomanization`) · F-I18N-001 (`LOCALE_META[locale].speechLang`, message catalog) · F-LEARN-001 (`levelOrder()` for speech speed) · F-STORY-003 (Say-it-yourself chip, story audio) · F-PLC-001 / F-VOC (audio-off item filtering) · docs/design/audio-plan.md (this spec **absorbs the planned F-AUDIO-003**; F-AUDIO-001 SFX and F-AUDIO-002 BGM stay open) · audit AUD-01..AUD-14, F01, F09, F16 · owner task T-017 · `docs/launch/owner-runbook.md` Step 12 · wireframe `wireframes/audio-fallback.md`

---

## Decisions

Binding owner decisions this spec implements: **D1** (any age: no "kids" copy; speech speed follows the learner *level*, not an age) · **D2** (taught Korean always carries romanization; the spoken form's romanization is shown too) · **D4** (content fields live with the content record, validated on shipped content) · **D6** (TTS for v1 with a capability check and a visible text fallback; `audioRef` MP3 path supported so T-017 recordings drop in; isolated consonants are spoken as sounds with a carrier vowel, not as letter names, with correct romanization) · **D8** (spec id) · **D13** (Revised Romanization for every romanization string this spec adds).

Decisions taken in this spec (AD = audio decision):

| # | Decision | Why |
|---|---|---|
| AD1 | **Sound first, name second.** Every prompt that introduces a letter or asks "which letter?" plays the letter's *sound*. The letter *name* (기역, 니은 ...) is a second, optional thing: a "Letter name" button on the Discover page and the card/library view. A name is never the target of a Stage 1 exercise. | A zero-baseline learner reads and writes syllables, so the useful sound is `ga`, not `gi-yeok`. Verified with `say -v Yuna`: a lone ㄱ is spoken as 기역 (identical audio bytes), while the tile says `g/k` (audit F01 / AUD-03 / AUD-04). Heritage families (P4) know the names, so the name stays one tap away. |
| AD2 | **Carrier rule.** Consonant sound = consonant + ㅏ (가 나 다 라 마 바 사 자 차 카 타 파 하). Vowel sound = ㅇ + vowel (아 야 어 여 오 요 우 유 으 이). Batchim sound = the closed syllable ㅇ + ㅏ + the final (악 안 알 암 압 앙). **Exception**: initial ㅇ has no sound; it is asked and spoken by its name 이응 (`spokenKind: 'name'`). | ㅏ is the carrier of the traditional 가나다 table, every engine pronounces whole syllables correctly (lone jamo are engine-specific). ㅇ+ㅏ = 아 would make ㅇ and ㅏ indistinguishable by ear (identical audio bytes for 아 and the vowel ㅏ, verified); a *global uniqueness rule* on `spokenKo` removes that trap. Rejected carrier ㅡ (그 느 드 ...): an unfamiliar vowel for beginners and the sound of the syllable is less like the 가나다 table families already know. |
| AD3 | **Field names** on `Jamo`: `spokenKo` (what the voice says for the SOUND; the owner brief's "soundText"), `spokenRomanization` (RR of `spokenKo`), `nameKo` (the Hangul letter name; the brief's "nameText"), `spokenKind` (`'sound'` default, `'name'` only for `jamo:ieung`), `nameAudioRef`. | `spokenKo` already appears in F-QUEST-002 §3.1 / §3.12 and in F-CNT-002's `KoText`; reusing it keeps one name across specs. |
| AD4 | **Resolution order is MP3 > TTS > visible text.** A recording wins when `audioRef` has a bundled clip and the clip plays; a clip that fails to load or decode falls through to TTS; with no clip and no usable Korean voice (or sound muted) the prompt is shown as text, immediately, not after a failure. | D6; F-001 §3.3 / §3.4; audit AUD-01, AUD-02. |
| AD5 | **Voice choice is ranked, filtered and explicit.** Hard-exclude the Apple novelty Korean voices; exclude network-only voices while offline; prefer Premium > Enhanced > default-flagged > local; on native pass an explicit voice id; **never call the engine when no Korean voice exists** (an English voice must not read Hangul). | Audit AUD-05 / F09; `say -v '?'` lists eight novelty ko_KR voices before Yuna; `SpeechModule.kt:95-103` falls back to the default (English) locale. |
| AD6 | **Speed follows what is spoken and who listens.** Pitch 1.0 for every voice. Base rate: sound/syllable 0.75, word 0.85, sentence 0.9, narration 1.0. Level factor: Pictures first x0.9, Some reading x1.0, Reads easily x1.05; clamp 0.5-1.1. | Resolves the audit's AUD-12 vs F16 disagreement: pitch 1.05 has no evidence of benefit and risks artifacts on neural voices; rate was one fixed 0.78. Numbers are a starting point to be tuned by ear (§3.3, §8). |
| AD7 | **Mute is a device preference, persisted** under `device:audio` through the sanctioned wrapper; one store (`audio-store`) is the single source; `ui-store.soundOn` is removed. | Today `soundOn` lives in `ui-store.ts:4,17` and the engine's own `muted` in `audio.ts:8` / `audio.web.ts:7`, in memory only, reconciled by hand at `ProfileScreen.tsx:153-157`; a muted learner hears sound again after every restart. |
| AD8 | **iOS/Chrome unlock on the first gesture anywhere**, installed once at boot, not per-screen Start buttons. | The very first Welcome tap unlocks speech and audio for the page lifetime, long before the first quest prompt (audit AUD-06). |
| AD9 | **Web clips play through `fetch` + Web Audio `decodeAudioData`**, not an `<audio>` element. Native uses one library behind `platform/audio-player.ts`. | Workbox precache responses do not honour `Range` requests, which Safari media elements need; decoding bytes has no such dependency and gives low latency. (Unverified on device, §8.) |
| AD10 | **Jamo clips are precached; vocabulary and story clips are not** (runtime cache, cache-first). | 30 jamo clips are about 0.2-0.4 MB against a 2.26 MB precache; hundreds of word clips are not part of "plays offline after your first visit". |
| AD11 | **Recordings: 30 sound clips are T-017; 14 consonant-name clips are an optional second batch.** One speaker, files named by *id* (never by the letter), recorded from a generated script. | Audit AUD-08: `ㄱ.mp3` collides for six initial/final pairs and does not match `audioRef`. |
| AD12 | **Marketing claims are qualified until clips ship**: "plays offline" stays true for the app; pronunciation offline needs a device Korean voice or the recordings. The "native Seoul-accent speaker, not TTS" reply is withdrawn until T-017 is delivered. | `docs/roadmap/web-pwa-offline.md:167`; audit AUD-14. |
| AD13 | **Text fallback keeps D2.** In fallback the tiles keep their romanization; the prompt shows the spoken syllable in Hangul plus its romanization, no gloss. Rounds still score normally (F-001 §3.3). | Hiding tile romanization would contradict D2's default; the trade-off (a text-assisted round proves reading, not listening) is recorded in §8. |
| AD14 | **Four telemetry names**, `audio.*` namespace, sampled so they cannot flood (§3.14). | The shared list convention in `specs-out/TELEMETRY-NAMES.md` (rule 4). |

---

## 1. Context

Every Korean sound in the app is device text-to-speech. There is no MP3 playback code, no audio-player dependency and no audio file; `audioRef` is written in content and read by nobody. What the learner hears, and whether they hear anything, depends on the device. Facts verified against the repo at `origin/main` (`c939348`, PRs #91-#102) and, for the voice behaviour, with macOS `say -v Yuna` (the voice iOS and Safari use for ko-KR):

**Code**

- `playJamoSound(char, _audioRef)` ignores `_audioRef` and calls `speak(char)` (`apps/mobile/src/platform/audio.ts:50-54`, `audio.web.ts:73-77`). Nothing else reads `audioRef` (grep: only `content/jamo.ts:27,49,59` write it).
- Callers pass the raw compatibility jamo (`ㄱ`): `MatchSoundGame.tsx:52,91,97,154`, `TraceStrokeGame.tsx:125,354`. Five more screens call `speak()` directly with words: `TapRespondGame.tsx:40`, `BuildLetterGame.tsx:112`, `CardMatchGame.tsx:109`, `VoiceEchoGame.tsx:55`, `CardDetailScreen.tsx:220`.
- Rate 0.78 and pitch 1.05 for everything (`audio.ts:34-35`, `audio.web.ts:54-55`). Native `speak()` wires `onDone`, `onStopped` **and** `onError` to the same `opts.onDone` (`audio.ts:36-38`): an engine error looks like a normal end.
- Web `pickVoice` is `voices.find(v => v.lang === language)`, then a prefix match (`audio.web.ts:36-42`); `getVoices()` is read synchronously at every speak (`:56`), no `voiceschanged` listener, no `localService`/`default` use. `cancel()` and `speak()` run in the same tick (`:50`, `:66`); the promise settles only on `onend`/`onerror` (`:59-65`) with no timeout. With no `speechSynthesis`, `speak` calls `onDone` at once (`:45-49`): silence, no signal.
- `muted` is a module variable in each file (`audio.ts:8`, `audio.web.ts:7`); the UI switch is `useUiStore.soundOn` (`ui-store.ts:4,17,21`), toggled in `ProfileScreen.tsx:153-157`; neither is persisted. `TraceStrokeGame.tsx:72,353` reads `soundOn` itself; `MatchSoundGame` does not.
- Match Sound shows no text prompt when sound is off or no voice exists: heading "Tap the letter you hear" (`MatchSoundGame.tsx:110`) and a text hint only after a wrong tap (`:146-157`). F-001 §3.3 requires the text prompt when audio fails and §3.4 requires it "whenever sound is off".
- Tiles show the sound value (`romanization={j.romanization}`, `:136`: `g/k`, `d/t`, `∅/ng`), the voice says the name.
- `JamoSchema` has `audioRef` (`packages/content-schema/src/schemas/jamo.ts:19`) but no spoken form and no Hangul name (`:10-21`). `jamo.ts` writes `audio/jamo/<id>.mp3` and `audio/jamo/<id>-batchim.mp3` (`:27,49,59`); `apps/mobile/assets/` holds three PNGs.
- Batchim entries carry the same `char` as the initial (`jamo.ts:93-100`), so a batchim ㄱ is spoken 기역, like the initial.
- `pwa-postbuild.mjs:94` already globs `mp3` into the Workbox precache (`:92-101`, 6 MB per-file cap at `:100`). The audit's build log shows `precached 6 files (2.26 MB)`. `app.json` has no audio plugin; `package.json` has `expo-speech ~13.0.0` and no audio player (`expo-asset 11.0.5` is only a transitive dependency of `expo`).
- Sanctioned storage is `platform/storage.ts:10-21` (AsyncStorage, key prefix `hr:`) and `storage.web.ts:11-22` (IndexedDB). `packages/hooks`, named by CLAUDE.md §8, does not exist (F-I18N-001 §1 reached the same conclusion).
- Telemetry names are the one list `TELEMETRY_EVENT_NAMES` (`packages/content-schema/src/schemas/telemetry.ts:9-43`, 32 names at `c939348`, 38 once PR #103 merges); the API whitelist and the app's `track()` type both read it, and an exact-list assertion guards it (`packages/content-schema/src/__tests__/telemetry.test.ts:5-43`).

**Voices** (`say -v Yuna`, byte comparison of the rendered audio, re-run for this spec)

- A lone consonant is spoken as its name: ㄱ == 기역, ㄴ == 니은, ㅂ == 비읍, ㄹ == 리을, ㅅ == 시옷, ㅇ == 이응 (identical bytes). ㄱ differs from 그 and from 가.
- Vowels come out as carrier syllables: ㅏ == 아, ㅡ == 으, ㅣ == 이.
- The 30 spoken forms of §3.2 produce 30 *distinct* renderings; 아 for ㅏ and ㅇ+ㅏ are the same audio (hence AD2's ㅇ exception).
- 악 and 압 render to different audio with the same duration (0.207 s). Whether the unreleased final [k̚]/[p̚] is *audible enough* in an isolated syllable is not something bytes can show; it is on the owner's ear-check list (§3.11).
- `say -v '?'` lists nine ko_KR voices: Eddy, Flo, Grandma, Grandpa, Reed, Rocko, Sandy, Shelley (Apple's novelty voices, all before Yuna) and Yuna. Safari exposes the same family on macOS 14+/iOS 17+ (audit AUD-05; not re-verified in a browser here).
- 윷놀이 is spoken [윤노리] and 한글날 [한글랄] (F-CNT-002 owns the romanization fix; this spec only requires that the shown romanization be what the voice says).

**Engines** (`expo-speech 13.0.1`, read in `node_modules`)

| Aspect | iOS native (`ios/SpeechModule.swift`) | Android native (`android/.../SpeechModule.kt`) | Browser (`audio.web.ts`) |
|---|---|---|---|
| Voice pick | `AVSpeechSynthesisVoice(language:)` (`:33`) = system default for the language; an explicit `voice` id replaces it and throws if not installed (`:36-41`) | `Locale(language)`; if `LANG_MISSING_DATA` / `LANG_NOT_SUPPORTED` falls back to `Locale.getDefault()` (`:91-103`), i.e. an English voice reads Hangul; an explicit `voice` name overrides (`:105-109`) | `pickVoice`, first match |
| Voice list | `getVoices`: quality `Enhanced` or `Default` only (`:62`), so Premium is indistinguishable except by name | `quality > QUALITY_NORMAL` = `Enhanced` (`:51-55`); list is empty/throws until the lazy TTS engine is initialised (`:44-48`, `:124-165`) | `getVoices()` is `[]` until `voiceschanged` on Chrome; has `localService`, `default`, `voiceURI` |
| Rate | JS rate x `AVSpeechUtteranceDefaultSpeechRate` 0.5 (`:48-50`) | raw `setSpeechRate` (`:89`) | raw 0.1-10 |
| Queue | utterances queue (`:52`) | `QUEUE_ADD` (`:114`) | queue; app calls `cancel()` first |
| Errors | invalid voice throws inside an `AsyncFunction` (an unhandled rejection from `Speech.speak`, not an `onError`) | `onError` event (`:153-155`) | `onerror`; `cancel()` also raises `onerror` ('canceled'/'interrupted') in Chromium and WebKit (to verify with the fake, §5) |
| User gesture | none | none | first `speak()` of a page needs one on iOS Safari and Chrome (audit AUD-06) |
| Silent switch | default session is SoloAmbient: muted by the switch (unverified; audit AUD-07) | media volume | n/a |

On the web build Metro resolves `audio.web.ts` instead of `audio.ts` (same mechanism as `storage.web.ts:7-8`), so `expo-speech`'s own web module is not used; on native the browser column does not apply.

**Not verifiable here** (marked "unverified" wherever used): real iOS/Android device behaviour (first-gesture gating, silent switch, premium voice names, Android `Locale("ko-KR")` resolution), Edge/Firefox voice names, whether an isolated final consonant is audible. §8 lists each with the check that closes it.

## 2. User story

> As someone learning Hangul from zero, I want a tapped letter to say the sound I will use when I read (가, not 기역), a wrong answer to repeat that same sound, and, if my device cannot speak Korean or I switched the sound off, to see the sound written down so I can still play, so that audio quality never decides whether I can learn.

Companion stories:

- As a **heritage learner** (P4) whose parents say 기역 니은, I want the letter name one tap away, so I can connect the app to what I hear at home.
- As a **parent or teacher on a shared device**, I want "sound off" to stay off after a restart, and a plain line that says "no Korean voice on this device" (with how to add one) instead of a silent game.
- As the **owner recording the voice**, I want a script that says exactly what to say and what to name each file, so one session produces files the app can use without re-recording.
- As a **developer**, I want one `playPrompt` entry point and a fake `speechSynthesis`, so audio behaviour is tested, not guessed.

## 3. Acceptance criteria

### 3.1 The teaching rule (pedagogy, written down)

1. **What a prompt plays.** A *sound prompt* plays `spokenKo` (or its clip). A *name prompt* plays `nameKo` (or its clip). Match Sound, Listen & Pick (F-QUEST-002 §3.10), Trace Stroke's on-mount and "Show me" narration, the Discover page's main **Hear it** and the wrong-answer "Hear it" are sound prompts.
2. **Where the name appears.** Discover (F-QUEST-002 §3.2) shows, under the sound, a secondary button **Letter name** (consonants and vowels; batchim and ㅇ-initial excepted, below) that plays the name and prints `nameKo` with the existing `nameEn` romanization ("기역 · giyeok"). The Library card view may reuse the same chip. Names are never asked.
3. **The silent letter.** Initial ㅇ has `spokenKind: 'name'`: its Hear it plays 이응 and the Discover line says it is silent at the start of a syllable (copy owned by F-QUEST-002 Appendix A); the example word 아이 is played by its own button. In Match Sound a round whose prompt is ㅇ plays 이응.
4. **Batchim.** Batchim items play the closed syllable (악 안 알 암 압 앙), which is distinct audio from the initial form of the same consonant (가 vs 악). The Discover page also keeps the example word as its second sound (F-QUEST-002 §3.2).
5. **What is printed matches what is heard.** Next to every spoken sound the UI can show `spokenRomanization` (`ga`, `ak`) from the same record as `spokenKo`; the tile keeps the sound value (`g/k`). F-CNT-002 §3.5 checks `spokenRomanization === romanizeWord(spokenKo)` (its converter, merged in PR #102: `romanizeWord(word): string | null` in `packages/content-schema/src/romanization/rr.ts:167`; `romanize(text)` returns `{ text, unknown }`).
6. **Uniqueness.** No two of the 30 jamo share a `spokenKo`, so two tiles can never be correct by ear for the same prompt.

### 3.2 Data: `Jamo` fields and the 30 spoken forms (`packages/content-schema` + `apps/mobile/src/content/jamo.ts`)

Additive, all optional in the schema first (existing fixtures keep parsing); required for `jamo.ts` entries by the content test in §5.

```ts
// packages/content-schema/src/schemas/audio.ts (new, exported from index.ts)
export const AUDIO_REF_PATTERN = /^audio\/(jamo|vocab|story|card|dialogue)\/[a-z0-9][a-z0-9/-]*\.mp3$/;
export const AudioRefSchema = z.string().regex(AUDIO_REF_PATTERN);
export const SPEECH_LANGS = ['ko-KR', 'en-US', 'es-US'] as const;      // F-I18N-001 LOCALE_META speechLang
export const SpeechLangSchema = z.enum(SPEECH_LANGS);
export const DeviceAudioPrefsSchema = z.object({ muted: z.boolean().default(false) });   // §3.7

// packages/content-schema/src/schemas/jamo.ts (additions)
spokenKo: z.string().regex(/^[가-힣]{1,2}$/).optional(),       // one syllable, or the two-syllable name 이응 (AD2)
spokenRomanization: z.string().min(1).max(8).optional(),        // RR of spokenKo, unhyphenated (D13)
spokenKind: z.enum(['sound', 'name']).default('sound'),
nameKo: z.string().regex(/^[가-힣]{1,3}$/).optional(),          // 기역 ... 히읗; vowels: same as spokenKo
nameAudioRef: AudioRefSchema.optional(),
audioRef: AudioRefSchema.optional(),                            // was z.string(); every existing value matches
```

Refinements (in the schema): `spokenRomanization` requires `spokenKo`; `nameAudioRef` requires `nameKo`. The cross-record rules (uniqueness, carrier rule, romanization parity) are tests over `jamoAll` (§5) because they span records.

**Other `audioRef` fields use the same grammar.** `KoTextSchema.audioRef` (F-QUEST-002 Q-1, PR #103: `z.string().optional()`), the story schema's `narrationAudioRef` and `KeywordSchema`/`StoryLineSchema` (they extend KoText), and card/vocabulary `audioRef` fields are tightened to `AudioRefSchema` by the PR that first ships a clip for that kind (A-10 for vocabulary and story; no value exists today, so the tightening cannot break content); until then a malformed ref is simply a clip that is not found and falls through to TTS (AD4).

**The 30 rows** (canonical values; `jamo.ts` factories `c`, `v`, `b` at `:9-61` take them as three new arguments):

| id | char | `spokenKo` | `spokenRomanization` | `nameKo` | existing `nameEn` | `audioRef` (sound) |
|---|---|---|---|---|---|---|
| jamo:giyeok | ㄱ | 가 | ga | 기역 | giyeok | audio/jamo/giyeok.mp3 |
| jamo:nieun | ㄴ | 나 | na | 니은 | nieun | audio/jamo/nieun.mp3 |
| jamo:digeut | ㄷ | 다 | da | 디귿 | digeut | audio/jamo/digeut.mp3 |
| jamo:rieul | ㄹ | 라 | ra | 리을 | rieul | audio/jamo/rieul.mp3 |
| jamo:mieum | ㅁ | 마 | ma | 미음 | mieum | audio/jamo/mieum.mp3 |
| jamo:bieup | ㅂ | 바 | ba | 비읍 | bieup | audio/jamo/bieup.mp3 |
| jamo:siot | ㅅ | 사 | sa | 시옷 | siot | audio/jamo/siot.mp3 |
| jamo:ieung | ㅇ | **이응** (`spokenKind: 'name'`) | ieung | 이응 | ieung | audio/jamo/ieung.mp3 |
| jamo:jieut | ㅈ | 자 | ja | 지읒 | jieut | audio/jamo/jieut.mp3 |
| jamo:chieut | ㅊ | 차 | cha | 치읓 | chieut | audio/jamo/chieut.mp3 |
| jamo:kieuk | ㅋ | 카 | ka | 키읔 | kieuk | audio/jamo/kieuk.mp3 |
| jamo:tieut | ㅌ | 타 | ta | 티읕 | tieut | audio/jamo/tieut.mp3 |
| jamo:pieup | ㅍ | 파 | pa | 피읖 | pieup | audio/jamo/pieup.mp3 |
| jamo:hieut | ㅎ | 하 | ha | 히읗 | hieut | audio/jamo/hieut.mp3 |
| jamo:a | ㅏ | 아 | a | 아 | a | audio/jamo/a.mp3 |
| jamo:ya | ㅑ | 야 | ya | 야 | ya | audio/jamo/ya.mp3 |
| jamo:eo | ㅓ | 어 | eo | 어 | eo | audio/jamo/eo.mp3 |
| jamo:yeo | ㅕ | 여 | yeo | 여 | yeo | audio/jamo/yeo.mp3 |
| jamo:o | ㅗ | 오 | o | 오 | o | audio/jamo/o.mp3 |
| jamo:yo | ㅛ | 요 | yo | 요 | yo | audio/jamo/yo.mp3 |
| jamo:u | ㅜ | 우 | u | 우 | u | audio/jamo/u.mp3 |
| jamo:yu | ㅠ | 유 | yu | 유 | yu | audio/jamo/yu.mp3 |
| jamo:eu | ㅡ | 으 | eu | 으 | eu | audio/jamo/eu.mp3 |
| jamo:i | ㅣ | 이 | i | 이 | i | audio/jamo/i.mp3 |
| jamo:giyeok-batchim | ㄱ | 악 | ak | (none) | giyeok-final | audio/jamo/giyeok-batchim.mp3 |
| jamo:nieun-batchim | ㄴ | 안 | an | (none) | nieun-final | audio/jamo/nieun-batchim.mp3 |
| jamo:rieul-batchim | ㄹ | 알 | al | (none) | rieul-final | audio/jamo/rieul-batchim.mp3 |
| jamo:mieum-batchim | ㅁ | 암 | am | (none) | mieum-final | audio/jamo/mieum-batchim.mp3 |
| jamo:bieup-batchim | ㅂ | 압 | ap | (none) | bieup-final | audio/jamo/bieup-batchim.mp3 |
| jamo:ieung-batchim | ㅇ | 앙 | ang | (none) | ieung-final | audio/jamo/ieung-batchim.mp3 |

Notes: `audioRef` values are exactly what `jamo.ts:27,49,59` already write (no content churn); optional name clips are `nameAudioRef: 'audio/jamo/<id>-name.mp3'` for the 14 consonants only (vowel names equal the sound; batchim reuse the consonant name). `ipa` for ㄹ and ㅇ-final corrections (`r` to `ɾ`/`l`; audit AUD-11) belong to F-CNT-002 and are not touched here. The `∅/ng` romanization at `jamo.ts:71` becomes `silent/ng` in F-CNT-002 / F-QUEST-002 (whichever lands first); this spec does not touch it.

**Interim map and the ㅇ difference (amends F-QUEST-002).** F-QUEST-002 Q-3a may add `logic/stage1/spoken.ts` with the same values before this spec's PR A-2 lands (F-QUEST-002 §3.12). A-2 deletes that file (and its test) and points its callers at `spokenFor()` (§3.5); if A-2 lands first, Q-3a does not create it. The values are identical **except ㅇ**: F-QUEST-002's interim list spells the consonant ㅇ as 아 (its §3.12 list ends "... 마 바 사 아 자 차 ..."), which is the same audio as the vowel ㅏ (verified by byte comparison), so the two could never be told apart by ear; this spec replaces it with the name 이응 (AD2, `spokenKind: 'name'`) and the uniqueness test (§5) keeps it that way. **F-QUEST-002 is amended accordingly** (exact replacement text in `AMENDMENTS-LANDED-SPECS.md`, to be applied to `docs/specs/F-QUEST-002-discover-check-stage1-complete.md` by the Q-3a PR or a docs PR): (1) its §3.12 interim list uses 이응 for ㅇ; (2) its open assumption 2 ("F-AUDIO-004 may choose another carrier, e.g. ㅡ") is closed: the carrier is ㅏ (AD2); (3) the Discover line for ㅇ plays the name and prints `spokenRomanization` `ieung`, the "silent at the start of a block" hint staying as written; (4) `playPrompt`'s native error path is this spec's (`SpeakOptions.onError` is not added separately). F-QUEST-002's Hangul Check and Listen & Pick distractor lists need no change (re-read at review 2: ㅇ's confusables are ㅎ ㅁ ㅅ, and no vowel list contains ㅇ, so ㅇ and ㅏ are never in one list).

### 3.3 Rate and pitch (`logic/audio/rate.ts`, pure)

```ts
export type PromptKind = 'sound' | 'word' | 'sentence' | 'narration';
export function speechParams(kind: PromptKind, levelOrder: 0 | 1 | 2 | null, opts?: { slow?: boolean }): { rate: number; pitch: 1 };
```

| kind | base rate | used for |
|---|---|---|
| `sound` | 0.75 | jamo sounds/names, single syllables (BuildLetter target) |
| `word` | 0.85 | vocabulary, card words, Discover example words |
| `sentence` | 0.9 | dialogue and story lines |
| `narration` | 1.0 | UI-language narration (`en-US`, `es-US`, `ko-KR` UI) |

`rate = clamp(base x levelFactor x (slow ? 0.7 : 1), 0.5, 1.1)`; `levelFactor` = 0.9 / 1.0 / 1.05 for level order 0 / 1 / 2 (`levelOrder(profile.ageGroup)` from `packages/content-schema/src/schemas/learner-level.ts`, merged with F-LEARN-001 PR 1 as #101; an unknown id gives `null` = 1.0; the interim id map of the first draft is not needed). The active level reaches the player through `audio-store.setLevelOrder()`, called from a `profile-store` subscription in `App.tsx`, so game code never passes a level. Pitch is always 1.0 (AD6). `slow` has no UI in this spec (§4); the parameter exists so Discover can offer a "Slower" replay later without touching the engines.

Platform note (§1 table): the same number is not the same speed on iOS (x0.5 scale), Android and browsers; the table is a starting point validated on the §7 device checklist, and each constant sits in one `RATE_BASE` object.

### 3.4 Voice selection and capability (`logic/audio/voice-rank.ts`, `capability.ts`, pure)

```ts
export interface VoiceCandidate {
  id: string;                 // iOS identifier / Android name / web voiceURI (web: name when voiceURI is empty)
  name: string;
  lang: string;               // raw; normalised by normLang()
  local: boolean | null;      // web localService; iOS true; Android: false when the name contains "network"; null = unknown
  isDefault: boolean;
  quality: 'premium' | 'enhanced' | 'standard';
}
export function normLang(raw: string): string;                    // 'ko_KR' -> 'ko-kr', trims, lower-cases
export function rankVoices(all: readonly VoiceCandidate[], want: SpeechLang, ctx: { online: boolean }): VoiceCandidate[];   // best first, excluded removed
export function pickVoice(all, want, ctx): VoiceCandidate | null;  // rankVoices(...)[0] ?? null
```

**Eligibility** (a voice failing any rule is excluded, not demoted):
1. `normLang(v.lang)` equals the wanted tag (`ko-kr`) or starts with its language (`ko`); for `es-US` the chain is `es-us`, `es-mx`, `es-419`, then any `es-*`.
2. For Korean only: the name is not one of the Apple novelty voices `Eddy|Flo|Grandma|Grandpa|Reed|Rocko|Sandy|Shelley` (matched as a leading word of `name`, with or without the "(한국어(한국))" suffix). The list is a constant `KO_EXCLUDED_NAMES`; the test fixture is the real `say -v '?'` output above.
3. `ctx.online === false` excludes every voice with `local === false`.

**Score** (higher first; ties by `id` ascending so the result is deterministic): +100 known-good name (`/\b(Yuna|유나)\b/i`, `/Google\s*한국/`, `/Microsoft\b.*\b(SunHi|InJoon|Heami)\b/i`); +40 `premium`; +30 `enhanced`; +20 `isDefault`; +15 `local === true`; +5 exact `ko-KR` over a prefix match. Quality is read from the engine field where it exists and from the name otherwise (`(Premium)`, `(Enhanced)`, and their Korean localisations `프리미엄`, `향상됨`; iOS maps Premium to `Default` at `SpeechModule.swift:62`).

**Capability** (what the rest of the app reads):

```ts
export type KoVoiceStatus =
  | { state: 'unknown' }
  | { state: 'ready'; voiceId: string; voiceName: string; local: boolean; quality: 'premium' | 'enhanced' | 'standard' }
  | { state: 'none'; reason: 'no_engine' | 'no_korean_voice' | 'offline_network_only' };
export interface AudioCapability { tts: KoVoiceStatus; clips: boolean /* any bundled clip */; unlocked: boolean }
export function canPlayKorean(cap: AudioCapability): boolean;      // tts.ready || clips
```

- **Web `whenVoicesReady(engine, { timeoutMs: 1500 })`**: resolve at once if `getVoices()` is non-empty; otherwise wait for `voiceschanged` or the timeout and read again. The listener stays registered to re-rank when voices arrive late (Chrome) or when a voice pack is installed; `online`/`offline` events re-run the ranking. `speechSynthesis` missing => `{ state: 'none', reason: 'no_engine' }`.
- **Native `Speech.getAvailableVoicesAsync()`** (`expo-speech/build/Speech.js:80-85`). Android returns `[]` until its lazy engine is initialised (`SpeechModule.kt:44-48`), so an empty list is retried at 500 ms and 1500 ms (three reads) before `none`. `getAvailableVoicesAsync` throwing is `none/no_engine`. The ranked id is passed as `Speech.speak(..., { voice: id })`; **a voice id is only ever taken from a list read in the same session** (iOS throws an unhandled rejection for an uninstalled id, `SpeechModule.swift:39-41`).
- **`none` means do not speak.** The controller returns `unavailable` without calling the engine; the English default voice never reads Hangul (`SpeechModule.kt:95-103`).
- **While `unknown`** (first 1.5 s on web, first read on native) screens render the audio prompt, not the text prompt, so there is no flash; the first `playPrompt` awaits the capability (bounded by the same timeout) and resolves `unavailable` if it ends `none`.
- **Network voice that fails**: an `onerror` (not `canceled`/`interrupted`) on a voice with `local !== true` marks that voice failed for the session and the controller retries once with the next candidate before reporting `unavailable`.
- The capability is a store value (§3.7) with a subscription, so F-PLC-001 / F-VOC (audio-off item filtering), F-QUEST-002 (Listen & Pick falls back to text), and the lecture presenter's "Check this device" row (`describeKoVoice()` returns `voiceName`, `local`, `quality` for display; never sent to telemetry) read the same fact.

### 3.5 Playback API and resolution (`platform/audio.ts`, `audio.web.ts`, `logic/audio/controller.ts`)

Both platform files export the same surface; `logic/audio/controller.ts` holds all decisions and takes the engine, the clip player, the asset map and the clock as arguments (so it is a 100 % logic-lane module and the platform files stay thin adapters).

```ts
export type PlayResult = 'played' | 'muted' | 'unavailable';                    // unchanged from F-QUEST-002 §3.12
export interface PlaySpec {
  text: string;                       // what to say if there is no clip: item.spokenKo ?? item.ko
  audioRef?: string;                  // AudioRefSchema; wins when a bundled clip exists
  language?: SpeechLang;              // default 'ko-KR'
  kind?: PromptKind;                  // default 'word'; drives rate (§3.3)
  slow?: boolean;
  source?: string;                    // surface id for telemetry: 'match-sound' | 'discover' | 'trace' | ...
}
export function playPrompt(spec: PlaySpec): Promise<PlayResult>;
export function playJamo(jamo: Pick<Jamo, 'id' | 'char' | 'spokenKo' | 'spokenKind' | 'nameKo' | 'audioRef' | 'nameAudioRef'>, mode?: 'sound' | 'name'): Promise<PlayResult>;
export function spokenFor(jamo, mode: 'sound' | 'name'): { text: string; audioRef?: string; romanization: string };   // pure, logic/audio/spoken.ts
export function speak(text: string, opts?: SpeakOptions): void;                 // low level, kept for narration; goes through the same controller
export function stop(): void;
export function setMuted(muted: boolean): void;  export function isMuted(): boolean;
export function getCapability(): AudioCapability;  export function refreshCapability(): Promise<void>;
export function subscribeCapability(fn: (c: AudioCapability) => void): () => void;
export function unlockAudio(): void;             // §3.6
export function warmClips(refs: readonly string[]): Promise<void>;   // optional pre-decode (§3.10)
```

`playJamo(jamo, 'sound')` uses `spokenFor` (for `spokenKind: 'name'` the sound *is* the name); `playJamoSound` is removed (no remaining caller after §3.9). `SpeakOptions.language` widens from `'ko-KR' | 'en-US'` (`audio.ts:20`, `audio.web.ts:10`) to `SpeechLang`.

**Algorithm** (`controller.playPrompt`):

1. `muted` => return `'muted'` (no engine call; no clip).
2. A newer call **supersedes** the running one: the old promise resolves `'played'` (an interrupted prompt never drives the fallback) and the engine/clip is stopped first. (Replaces the web `cancel()` + same-tick `speak()` at `audio.web.ts:50,66`: when `speaking || pending` the new utterance starts after 50 ms.)
3. **Clip**: if `spec.audioRef` is in the bundled asset map (§3.10) and `flags.audioClips` (new, default true, `config/flags.ts`) => `clips.play(ref)`; `'played'` => return `'played'`; a failure (`missing | fetch | decode | blocked`) is recorded and the flow **falls through to TTS**.
4. **TTS**: await the capability (bounded); `none` => `'unavailable'`. Otherwise speak with the ranked voice, `speechParams(kind, level)`, `lang`. Result mapping: `onstart` or `onend` seen => `'played'`; `onerror` other than `canceled`/`interrupted` => retry once (network voice, §3.4) else `'unavailable'`; **no `onstart` and no `onend` within 1.5 s** => `'unavailable'` with reason `blocked` (iOS/Chrome refused it outside a gesture, or the engine is mute); started but no `onend` within `2000 + 400 * chars / rate` ms => `'played'` (the safety timeout so an awaiting caller never hangs; audit AUD-06).
5. Every `'unavailable'`/`'muted'` result is stored as `audio-store.lastFailure = { reason, at }`; screens read it through the prompt state (§3.8).

`speak()` (kept for callers that do not need a result, e.g. narration) is `void playPrompt(...)`; `audio.ts:36-38`'s "all callbacks are `onDone`" disappears: the native adapter maps `onStopped` to *interrupted*, `onError` to *error*, `onDone` to *done*.

### 3.6 First-gesture unlock (`unlockAudio`, web)

- `installGestureUnlock()` (called once from `App.tsx` before the navigator renders, web only) registers capture-phase `pointerdown`, `touchend` and `keydown` listeners on `document`. The first event runs `unlockAudio()` synchronously and removes all three.
- `unlockAudio()` (all inside the gesture): `speechSynthesis.speak(new SpeechSynthesisUtterance(' '))` with `volume = 0`; create the shared `AudioContext` if missing and `resume()` it, and start a one-sample silent buffer; set `audio-store.unlocked = true`.
- If the first `playPrompt` runs before any gesture (a deep link straight into a quest), the `blocked` result of §3.5 step 4 lands in the UI as "Tap to hear" (§3.8) and the learner's tap both unlocks and plays.
- `visibilitychange` to hidden calls `stop()` (speech must not continue behind a suspended PWA).
- Native: nothing to unlock; `platform/audio-player.ts` sets the audio session once at start (§3.10).

### 3.7 Mute persistence (`store/audio-store.ts`, key `device:audio`)

```ts
State:   { muted: boolean; hydrated: boolean; levelOrder: 0 | 1 | 2 | null; tts: KoVoiceStatus; unlocked: boolean; lastFailure: { reason: FailReason; at: number } | null }
Actions: hydrate() · setMuted(muted, source: 'profile' | 'fallback_panel') · setLevelOrder(n) · setCapability(c) · reportFailure(reason)
```

- Key `device:audio` through `readJson`/`writeJson` (`platform/storage.ts:10-21`; `hr:` prefix added by the wrapper), value `DeviceAudioPrefs` parsed with `safeParse`; a corrupt or missing value means `muted: false`; storage errors never throw into a game (the wrapper already swallows read errors, `storage.ts:10-17`; the write is `void writeJson` like `profile-store.ts:43`). Device-level, not per profile: a muted family iPad stays muted when the profile switches. No account, sync or backup field (not part of `BackupFileSchema`).
- `hydrateLearnerData()` (`store/bootstrap.ts:10-15`) gains `await useAudioStore.getState().hydrate()`, so the navigator (rendered after hydration, `App.tsx:47`) never plays a prompt for a learner who muted yesterday. `setMuted` also calls `platform/audio.setMuted` (stops any speech/clip). `isMuted()` in the platform files reads the store, not a module variable.
- `ui-store.ts` loses `soundOn` / `toggleSound`; `ProfileScreen.tsx:45-46,153-170` binds the Sound switch to `audio-store` (`checked = !muted`), and `TraceStrokeGame.tsx:72,353` drops its own `soundOn` guard (muting is enforced inside `playPrompt`).
- Profile "Sound" card (wireframe W7) gets a second line from `audio-store.tts`: "Korean voice: ready" / "No Korean voice on this device" with a **How to add one** sheet (static text per OS family, English now, catalog keys later; steps to verify per OS version, §8).

### 3.8 Visible text fallback (`logic/audio/prompt-state.ts` + one shared view)

Pure reducer, one per prompt slot (a Match Sound round, a Discover item, a Listen & Pick question):

```ts
type PromptPhase = 'idle' | 'playing' | 'ok' | 'text';
type FallbackReason = 'muted' | 'no_voice' | 'error' | 'blocked';
interface PromptState { phase: PromptPhase; reason: FallbackReason | null; attempts: number }
events: 'play' | { result: PlayResult; failure?: FallbackReason } | { capability: AudioCapability } | { muted: boolean } | 'reset'
export function showText(s: PromptState, cap: AudioCapability, muted: boolean, hasClip: boolean): boolean;
```

**Rules**

- Text is shown **proactively** when `muted`, or when the capability is `none` and the item has no bundled clip (F-001 §3.4: "whenever sound is off, regardless of audio load state"), and **reactively** after a failed play (`unavailable`: `error`, `blocked`). Once shown in a round it stays for that round (no flicker) and resets on the next round.
- A successful replay in the same round does not hide the text again.
- The speaker button stays present in every state; in `blocked` it reads "Tap to hear", in `muted` the panel offers **Turn sound on** (`audio-store.setMuted(false, 'fallback_panel')`), in `no_voice` it explains "No Korean voice on this device" with no button, in `error` it offers **Try again**.
- **Match Sound** shows, in the prompt zone, the spoken syllable in Hangul (title size), its `spokenRomanization`, and the line "No sound? Read it here." (all Pre-A1 English, via `logic/audio/copy.ts` until F-I18N-001's catalog exists, then `learner.audio.*` keys). Tiles keep their romanization (AD13). The 800 ms auto-replay after a wrong tap (`MatchSoundGame.tsx:90-92`) is skipped when text is showing and sound is muted or unavailable. The wrong-answer bubble (`:146-157`) says "Listen again. This one says" with `spokenKo` + `spokenRomanization` instead of `char` + `romanization`, and its **Hear it** button plays the same sound prompt.
- **Discover** (F-QUEST-002 §3.2): the "Say it out loud: <romanization>" line appears in the same states (already specified there; it reads this spec's `PlayResult`).
- **Story / reader** (F-STORY-003 "Say it yourself" chip) and **Listen & Pick** (F-QUEST-002 §3.10) use the same reducer and component; **placement and speed quizzes** call `canPlayKorean()` once before building the item list and drop audio-only items when it is false (F-PLC-001 "not tested", F-VOC audio-to-picture question).
- Heading copy in fallback replaces "Tap the letter you hear" with "Tap the letter for this sound".
- Screen readers: the text prompt is a polite live region and focus does not move; the speaker button's accessibility label states the state ("Play sound", "Play sound, sound is off").

### 3.9 Call-site migration (one entry point)

| File:line (today) | Change |
|---|---|
| `MatchSoundGame.tsx:19,52,91,97,154` | `playJamo(round.promptJamo, 'sound')`; add the prompt-state hook; fallback zone (§3.8) |
| `MatchSoundGame.tsx:110,146-157` | heading by state; bubble text from `spokenFor` |
| `TraceStrokeGame.tsx:32,125,354` | `playJamo(round.jamo, 'sound')`; remove `if (soundOn)` (`:353`). F-009 §3.1 is amended: narration is the **sound**, not the name |
| `BuildLetterGame.tsx:22,112` | `playPrompt({ text: targetSyllable, kind: 'sound' })` |
| `CardMatchGame.tsx:20,109` | `playPrompt({ text: p.ko, kind: 'word', audioRef })` |
| `VoiceEchoGame.tsx:19,55` | `playPrompt({ text: target, kind: 'word' })` |
| `CardDetailScreen.tsx:32,220` | `playPrompt({ text: card.subtitleKo, kind: 'word', audioRef: card.audioRef })` (optional field, additive on the card schema in F-CNT-002/F-VOC; absent today) |
| `TapRespondGame.tsx:5,40` | learner's reply: `playPrompt({ kind: 'sentence' })`; **also** the NPC line plays on turn mount and has a replay button (audit F06 / AUD-13); text fallback = the line already shown |
| `CultureQuizGame.tsx:74` (prompt shown, never spoken) | add a Hear-it button (audit AUD-13 / F16) |
| `ProfileScreen.tsx:25,45-46,153-170` | `audio-store` (§3.7) |
| F-QUEST-002 Discover, Listen & Pick, Pic-Word Match | consume `playPrompt` / `playJamo` / `spokenFor` as specified there |

A grep test (§5) asserts that no file under `src/screens` imports `speak` from `platform/audio`, or the removed `playJamoSound`.

### 3.10 The MP3 path

**Layout and file names**

```
apps/mobile/assets/audio/
  jamo/<id>.mp3                 30 sound clips    (T-017)   e.g. giyeok.mp3, giyeok-batchim.mp3, a.mp3
  jamo/<id>-name.mp3            14 consonant names (optional batch 2)
  vocab/<vocabId>.mp3           words             (F-VOC; list format §3.11)
  story/<storyId>/<lineId>.mp3  story lines       (F-STORY)
  card/<cardId>.mp3             heritage card words
  dialogue/<id>.mp3             Stage 4 lines
```

`audioRef` is `audio/<that path>` (`AudioRefSchema`, §3.2). **A ref may exist in content before its file does** (as `jamo.ts` already does): no file => TTS.

**Static asset map.** Metro needs literal `require` paths, so a generator writes `apps/mobile/src/content/__generated__/audio-assets.ts`:

```ts
export const AUDIO_ASSETS: Readonly<Record<string, number>> = {
  'audio/jamo/giyeok.mp3': require('../../../assets/audio/jamo/giyeok.mp3'),
  // ...
};
```

`apps/mobile/scripts/audio/gen-audio-map.mjs` (run by `pnpm --filter @hangul-route/mobile audio:map`, also by `build:web`) lists `assets/audio/**/*.mp3`; its pure core is `buildAssetMap(files)` in `apps/mobile/scripts/audio/lib.mjs` (sorted, deterministic; a sibling `lib.d.mts` types it, because the repo has no TypeScript loader for `.mjs`, F-CNT-002 C1), imported and unit-tested from `src/logic/audio/__tests__/audio-scripts.test.ts`. The `__generated__` path is excluded from coverage (`docs/tests/coverage-targets.md` "측정 제외" lists `**/__generated__/**`; `apps/mobile/vitest.config.ts:34-39` (the `coverage.exclude` list) gains that glob). A drift test (§5) fails when the committed map and the directory disagree. The map is **never imported by `logic/` or tests**: `platform/audio*.ts` import it and pass `{ has(ref), uri(ref) }` into the controller, and platform tests inject a fake map.

An `AUDIO_ASSETS` key with no `audioRef` anywhere in content, or a content `audioRef` that matches an existing file but is missing from the map, fails the content test; an `audioRef` without a file is only listed in the informational report `audio:status` ("29 of 30 clips missing"), which is the T-017 to-do list.

**Players** (`platform/audio-player.ts`, `audio-player.web.ts`)

```ts
export interface ClipPlayer {
  play(ref: string, h: { onStart(): void; onDone(): void; onError(reason: 'missing' | 'fetch' | 'decode' | 'blocked'): void }): { stop(): void };
  warm(refs: readonly string[]): Promise<void>;     // fetch + decode ahead of the round
  unlock(): void;
  stopAll(): void;
}
```

- **Web**: resolve `ref` to a URL with `Asset.fromModule(AUDIO_ASSETS[ref]).uri` (add `expo-asset ~11.0.5`, the version already pulled in by `expo`, as a direct dependency), `fetch(url)` => `arrayBuffer()` => `AudioContext.decodeAudioData` => `AudioBufferSourceNode`; decoded buffers live in a 64-entry LRU. No `<audio>` element (AD9). Reduced latency: `MatchSoundGame` and Discover call `warmClips()` for their scope on mount.
- **Native**: `expo-av ~15.0.x` (the stable audio API at Expo SDK 52; `expo-audio` was alpha at SDK 52 and is the successor; unverified, §8). Everything is behind `ClipPlayer`, so moving to `expo-audio` at an SDK upgrade touches one file. At first use set `Audio.setAudioModeAsync({ playsInSilentModeIOS: false, staysActiveInBackground: false })`: **the device's silent switch is respected** (owner decision 2026-10-10: a sudden sound in a quiet room — a classroom, a service — is worse than silence, and the visible text prompt keeps every round playable; AUD-07). Make it one constant (`PLAY_IN_SILENT_MODE = false`) so it can be flipped by a settings option later. `app.json` gets the plugin entry `["expo-av", { "microphonePermission": false }]` so the build does not add a microphone usage string or permission (`app.json:77` already lists `RECORD_AUDIO` under `android.blockedPermissions`); an Xcode archive/validate pass is part of PR A-7.
- `.mp3` type declaration: `apps/mobile/src/types/assets.d.ts` with `declare module '*.mp3'`.

**PWA build** (`apps/mobile/scripts/pwa-postbuild.mjs`)

- Expo's web export mirrors project-relative asset paths under `dist/assets/` (existing evidence: `dist/assets/__node_modules/...png`), so clips land at `dist/assets/assets/audio/jamo/<id>.<hash>.mp3`. **Verify after the first build and record the exact path in the PR.**
- The glob already contains `mp3` (`:94`), so jamo clips are precached with no change; at about 7.3 KB per clip (measured: 0.91 s mono, 64 kbps) the 30 clips add roughly 0.22 MB to the 2.26 MB precache. `maximumFileSizeToCacheInBytes` (6 MB, `:100`) is far above any clip.
- **Dot-directory trap (found while reading `dist/`)**: the existing build's `assets/__node_modules/.pnpm/...` PNGs are *not* in the precache manifest (6 URLs listed in the local `dist/sw.js` of the 2026-10-09 build, zero matches for `back-icon`), because Workbox's glob skips dot directories. Clips under `assets/audio/` have no dot directory, but this spec adds a **post-generate assertion** to `pwa-postbuild.mjs`: every `dist/**/*.mp3` outside the vocabulary/story groups must appear in the generated manifest, else the build fails. (The PNG omission is a separate, pre-existing issue, reported in §8, not fixed here.)
- **Vocabulary, story and card clips** (`audio/vocab|story|card|dialogue`) are excluded from the precache with `globIgnores` and served by a `runtimeCaching` rule (`CacheFirst`, cache name `hr-audio-v1`, `ExpirationPlugin { maxEntries: 400 }`, `CacheableResponsePlugin { statuses: [0, 200] }`). Topic packs can later pre-warm that cache through `warmClips`.
- `public/_headers` gains `/assets/audio/*  Cache-Control: public, max-age=31536000, immutable` (hashed names).
- e2e: after one online visit, offline reload, Match Sound plays a clip (§5).

### 3.11 Recording script and delivery (owner task T-017)

Replaces `docs/launch/owner-runbook.md` Step 12 (`:116-118`) and its hand-off row (`:141`). The runbook step becomes a pointer to a **generated** `docs/launch/audio-recording-script.md` (`apps/mobile/scripts/audio/gen-recording-script.mjs`, source = the content records, so the script cannot drift from the app). Row format:

| # | file id | Say exactly | Do NOT say | Romanization | Note |
|---|---|---|---|---|---|
| 1 | giyeok | 가 | 기역, 그 | ga | consonant sound = syllable with ㅏ |
| 8 | ieung | 이응 | 아 | ieung | ㅇ is silent at the start; say its name |
| 15 | a | 아 | | a | |
| 25 | giyeok-batchim | 악 | 각, 기역 | ak | end the sound with the mouth closed; do not add a vowel after it |
| ... | 30 rows in the order of §3.2 | | | | |

Rules for the owner (plain language in the runbook; Korean text allowed because the runbook is a Korean doc):

- Standard Seoul pronunciation, **one speaker** for all 30 (F-001 `:165`); same room, same distance (about 15 cm, a little off-axis from the mouth), no echo, phone voice memo is enough.
- Say each item as **one calm statement**, not a question and not stretched; no breath or "uh" before it. Record each **twice in a row with a 2 s pause**; the pipeline keeps the better take (the owner marks it, or the first by default).
- **File names are the `file id` column** plus the recorder's extension (`giyeok.m4a`, `giyeok-batchim.m4a`). Never name a file by the letter (`ㄱ.mp3` collides for six initial/final pairs, audit AUD-08).
- Ear check (owner, before delivery): play 악 / 압 / 안 / 알 / 암 / 앙 back to back and confirm the six are distinguishable. If the unreleased finals are not, record again with a very short vowel before closing; if still not, tell the developer, who will add a "contrast" clip (§4) instead of changing the script.
- Batch 2 (optional, later): the 14 consonant names as `<id>-name`, e.g. `giyeok-name` = 기역.
- **Vocabulary word list format** (`audio-recording-script.md` section generated from `content/vocab/**` when F-VOC lands; any `KoText` with an `audioRef` is a row): `file id | ko (what to say) | spokenKo if different | romanization | gloss | topic | note`, ordered by topic then id so a speaker records one topic per sitting. Phrases are spoken at natural speed, not word-by-word.
- A short signed voice-use release from the speaker is kept with the files; `content/assets-license.csv` (docs/design/audio-plan.md §8) gets one row per clip (`asset_path, category=voice, source, license, attribution`).

**Processing** (`apps/mobile/scripts/audio/process-recordings.mjs`, `ffmpeg` required locally, not in CI; command verified on a synthesized sample): per file, trim leading/trailing silence, add 0.3 s of silence each side, loudness-normalise, mono, 44.1 kHz, 64 kbps CBR MP3, strip metadata:

```
ffmpeg -i in.wav \
  -af "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.05,areverse,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.05,areverse,adelay=300:all=1,apad=pad_dur=0.3,loudnorm=I=-16:TP=-1.5:LRA=11" \
  -ar 44100 -ac 1 -c:a libmp3lame -b:a 64k -map_metadata -1 -id3v2_version 0 out.mp3
```

(Measured on the sample 가 clip: input -22.6 LUFS / -7.0 dBTP became -17.0 LUFS / -1.5 dBTP in one pass; 7,314 bytes, 0.91 s.) Targets for acceptance, checked by `apps/mobile/scripts/audio/check-audio.mjs` (ffprobe/ebur128 report; its pure `evaluateReport()` lives in `lib.mjs` and is unit-tested):

| Property | Jamo clip | Word / line clip |
|---|---|---|
| Channels / rate / codec | mono, 44.1 kHz, MP3 | same |
| Duration | 0.6-1.5 s including padding (1.5 s at 64 kbps is 12 KB) | 0.6-4.0 s |
| Integrated loudness | -16 LUFS +/- 1.5 | same |
| True peak | <= -1.5 dBTP | same |
| Size | <= 12 KB | <= 40 KB |
| Set total (30 jamo clips) | <= 400 KB | vocabulary per topic <= 1.5 MB |

Delivery: the owner sends the folder; a PR (`content(audio): jamo clips`) adds the processed files and re-runs `audio:map`. No code change is needed (§6, A-9).

### 3.12 Copy claims

Until A-9 is merged **and** the offline e2e passes, change (English now, catalog keys when F-I18N-001 ships):

- `apps/web/src/data/landing-copy.ts:63` "After your first visit, the full Stage 1 plays without a connection." => "After your first visit the app opens without a connection. Letter sounds need a Korean voice on your device until our own recordings arrive."
- `apps/web/src/app/page.tsx:200` ("Plays offline after your first visit"), `:402` ("the whole Stage 1 plays offline"), `:542` ("Stage 1 plays offline"): keep "works offline" wording for the app, drop "plays" claims about sound.
- `apps/mobile/public/manifest.webmanifest:4` and `pwa-postbuild.mjs:35` ("Works offline.") stay (the app does).
- `docs/launch/maker-comment.md:110`: replace with "Pronunciation is your device's Korean voice today; recordings by a native speaker are in progress."
- After A-9 + e2e, restore the strong claim and delete this section's qualifier in the same PR.

### 3.13 Accessibility, errors, offline

- Targets and type unchanged (`touchTarget.min` 64, speaker button >= `touchTarget.child`); text fallback body >= 18; tokens only; no emoji; the new `speaker-off` glyph for the Sound card goes through a design mock first (`design/components/`, CLAUDE.md §5) and is an addition to `components/Icon/glyphs.ts`.
- No audio-only information anywhere: every sound has its text (D6, audio-plan §4 "sound is always paired with a visual").
- Failure copy is plain and calm, never red (`colors.feedback.nudge` for a missed answer is untouched; the fallback panel uses the neutral card tone).
- Offline: clips are bundled (precached); TTS uses a local voice or none; network voices are excluded while offline (§3.4). Never an error dialog for audio.
- Errors the module itself can hit (storage unreadable, voice list throws, decode fails, AudioContext refused) are all swallowed into a `PlayResult` and a `lastFailure`; none rejects the `playPrompt` promise.

### 3.14 Telemetry (added to the `TELEMETRY_EVENT_NAMES` array in `schemas/telemetry.ts` and to the consolidated table `TELEMETRY-NAMES-2.md`)

| Name | Payload | When |
|---|---|---|
| `audio.capability_checked` | `{ platform: 'ios' \| 'android' \| 'web', engine: 'clips+tts' \| 'tts' \| 'clips' \| 'none', koVoice: 'none' \| 'network' \| 'local' \| 'enhanced' \| 'premium', reason?: 'no_engine' \| 'no_korean_voice' \| 'offline_network_only' }` | once per app session, when the capability first leaves `unknown` (and again only if the state class changes) |
| `audio.fallback_shown` | `{ source, reason: 'muted' \| 'no_voice' \| 'error' \| 'blocked' }` | once per (session, source, reason); `source` = surface id |
| `audio.mute_changed` | `{ muted: boolean, source: 'profile' \| 'fallback_panel' }` | on each change |
| `audio.playback_failed` | `{ kind: 'clip' \| 'tts', reason: 'missing' \| 'fetch' \| 'decode' \| 'blocked' \| 'timeout' \| 'engine' }` | at most 3 per session |

No voice names, text, ids of learners or free text are sent (`profileId` rides in the envelope as for every event). Per the telemetry rules, the PR that adds a name ships first (Worker deploy before the app release) and updates the exact-list test (`packages/content-schema/src/__tests__/telemetry.test.ts`, lines 5-43). The names are namespaced (`audio.`), do not collide with the 32 existing, the 6 of PR #103 or the 26 of review 1 (`TELEMETRY-NAMES.md`), and follow the "past tense for a discrete action" convention. `source` values used by other specs: `match-sound`, `discover`, `listen-pick`, `trace`, `story-reader` (F-STORY-002), `story-check` (F-STORY-003), `story-order` (F-STORY-003).

### 3.15 Behaviours (Given / When / Then)

| # | Given | When | Then |
|---|---|---|---|
| 1 | Match Sound with prompt ㄱ and a ranked Korean voice | the round opens | `playPrompt` speaks 가 (`spokenKo`, never 기역) at rate 0.75 x level factor and pitch 1.0 |
| 2 | the prompt is initial ㅇ | the round opens | the voice says 이응 and the fallback text prints 이응 and `ieung` |
| 3 | no Korean voice and no clip | the round opens | the engine is never called, the prompt zone shows 가 and `ga` with "No sound? Read it here.", tiles keep their romanization, the round scores normally, `audio.fallback_shown { reason: 'no_voice' }` fires once per session and source |
| 4 | sound muted yesterday | the app restarts | `device:audio` is read before the navigator renders, the profile switch is off, text shows proactively, no engine call is made |
| 5 | the very first tap on the Welcome screen | any gesture fires | speech and Web Audio are unlocked once and the listeners are removed |
| 6 | a bundled clip that fails to decode | `playPrompt` runs | it falls through to TTS, `audio.playback_failed { kind: 'clip', reason: 'decode' }` fires (at most 3 per session) |
| 7 | a second prompt while one is speaking | it starts | the first resolves `played`, the engine is stopped, the second starts after 50 ms |
| 8 | the device is offline and the only Korean voice is a network voice | the capability is read | `none/offline_network_only`, the prompt shows text |
| 9 | the voice list holds only the Apple novelty Korean voices | the capability is read | `none/no_korean_voice`; none of them is ever selected |
| 10 | `jamoAll` | `jamo-audio.test.ts` runs | all 30 `spokenKo` are distinct, consonants are consonant + ㅏ, vowels ㅇ + vowel, batchim closed syllables, ㅇ initial is `spokenKind: 'name'` |

## 4. Out of scope

- Sound effects (F-AUDIO-001) and background music (F-AUDIO-002) from `docs/design/audio-plan.md`; ducking; volume sliders.
- A spoken Hoya (no new voice character); UI-language narration is only *supported* through `kind: 'narration'` and `SpeechLang` for F-STORY-002/003 "Read to me"; `es-ES` and Korean-UI Hoya lines are not specified here.
- Speech recognition (Voice Echo STT), pronunciation scoring, phoneme/SSML control (neither expo-speech nor Web Speech exposes it reliably).
- A UI for "Slower" replay (the `slow` parameter exists), a batchim contrast clip (가 -> 각) unless the owner's ear check needs it, a per-profile mute, custom voice choice by the learner.
- Fixing the romanization of 윷놀이, 한글날 etc. (F-CNT-002), `∅/ng` (F-CNT-002), `ipa` corrections, the pre-existing precache omission of `assets/__node_modules` PNGs (reported in §8).
- Distinguishing text-assisted rounds in sync summaries (§8).
- Running TTS offline on devices without a Korean voice (impossible; that is what the recordings and the fallback are for).

## 5. Tests

Fake speech engine (new, shared): `apps/mobile/src/test-support/fake-speech-synthesis.ts` (not matched by the vitest `include`, excluded from coverage) with `FakeSpeechSynthesis` and `FakeUtterance`:

- `setVoices(list)`, `fireVoicesChanged()`, `getVoices()` returning `[]` until `setVoices` (Chrome behaviour);
- `speaking` / `pending`, queueing, `cancel()` raising `onerror('canceled')` on the running utterance (both flavours configurable);
- `requireGesture: true` (first `speak` without `markUserGesture()` is dropped silently, no events: iOS behaviour), `autoEnd`, `failNext('synthesis-failed')`, `holdUntil(clock)`, `neverStart` (engine mute);
- fake `AudioContext` + `fetch` for the clip player (`decodeAudioData` resolves/rejects on demand).

| File | Level | Cases |
|---|---|---|
| `packages/content-schema/src/__tests__/audio.test.ts` | unit, 100 % | `AudioRefSchema` accepts `audio/jamo/giyeok.mp3`, `audio/jamo/giyeok-batchim.mp3`, `audio/vocab/ice-cream.mp3`, rejects `giyeok.mp3`, `audio/jamo/ㄱ.mp3`, uppercase, `.wav`; `DeviceAudioPrefsSchema` default; `SpeechLangSchema`; `JamoSchema` new fields (single syllable, name pattern, `spokenRomanization` requires `spokenKo`, `nameAudioRef` requires `nameKo`, `spokenKind` default) |
| `packages/content-schema/src/__tests__/telemetry.test.ts` (edit) | unit | exact-list assertion gains the four `audio.*` names |
| `apps/mobile/src/content/__tests__/jamo-audio.test.ts` | unit | all 30 records have `spokenKo`, `spokenRomanization`; **unique `spokenKo`**; unique `audioRef` (no `ㄱ.mp3`-style collision: initial vs batchim differ); every consonant but ㅇ = consonant + ㅏ composed by Hangul arithmetic; vowels = ㅇ + vowel; batchim = ㅇ + ㅏ + final; ㅇ initial is `spokenKind: 'name'` and equals its `nameKo`; `spokenRomanization === romanizeWord(spokenKo)` (F-CNT-002 converter, `rr.ts:167`); `nameKo` list equals the 14 names of §3.2; every `audioRef` matches `AUDIO_REF_PATTERN` |
| `apps/mobile/src/logic/audio/__tests__/voice-rank.test.ts` | unit, 100 % | `normLang('ko_KR')`; the real macOS list (Eddy ... Yuna) => Yuna; Premium > Enhanced > default; novelty names excluded even if they are the only ko voice (=> `null`); offline excludes `local:false`; online keeps `Google 한국의`; non-ko voices never eligible; `es-US` chain; deterministic tie-break |
| `.../capability.test.ts` | unit | `unknown` => `ready` after `voiceschanged`; timeout => `none/no_korean_voice`; no engine => `none/no_engine`; offline + only network voice => `none/offline_network_only`; Android empty-then-filled retry (500/1500 ms with fake timers); late voices re-rank; `online`/`offline` events re-rank |
| `.../rate.test.ts` | unit | table of kind x level; slow factor; clamp; `null` level; pitch is 1 |
| `.../spoken.test.ts` | unit | `spokenFor` sound/name for a consonant, ㅇ-initial, vowel, batchim; falls back to `char` only when fields are absent |
| `.../prompt-state.test.ts` | unit | muted => text before any play; `none` + no clip => text; `blocked`/`error` => text and stays; success after text keeps text; reset per round; reasons map to actions |
| `.../controller.test.ts` | unit, 100 % | order MP3 > TTS > text: clip success; clip `decode` failure falls to TTS; clip + no voice => `unavailable`; muted never touches engine or clip; supersede resolves the old promise `'played'` and stops the engine; deferral of 50 ms when speaking; no `onstart` within 1.5 s => `unavailable/blocked`; started without `onend` => `played` at the safety timeout; `canceled` error is not a failure; network-voice error retries once with the next candidate; `none` never calls the engine; event callbacks fire with the right names/payloads and the 3-per-session cap |
| `apps/mobile/src/content/__tests__/audio-assets-drift.test.ts` | unit | committed `__generated__/audio-assets.ts` keys == files in `assets/audio/**`; no key without content ref; refs without a file are listed, not failed |
| `apps/mobile/src/store/__tests__/audio-store.test.ts` | unit | hydrate reads `device:audio`; corrupt value => unmuted; `setMuted` persists and calls the platform; `levelOrder`; `lastFailure`; `hydrateLearnerData` hydrates the audio store (extend `bootstrap.test.ts`) |
| `apps/mobile/src/platform/__tests__/audio.web.test.ts` (rewrite of the 4 cases at `:36-71`) | unit, platform lane | with `FakeSpeechSynthesis`: voices arriving after `speak`; ranking chooses Yuna from the Apple list; `requireGesture` + `installGestureUnlock` (first `pointerdown` unlocks, listeners removed, a later speak plays); `visibilitychange` stops; empty-utterance unlock has `volume 0`; no `speechSynthesis` => `none` |
| `apps/mobile/src/platform/__tests__/audio.test.ts` (extend the 5 cases) | unit | mock `expo-speech`: `getAvailableVoicesAsync` empty then filled; chosen `voice` id passed; no Korean voice => `Speech.speak` **not called**; `onError` mapped to a failure, `onStopped` to interrupted; rate/pitch from `speechParams` |
| `.../audio-player.web.test.ts`, `audio-player.test.ts` | unit | fake `fetch` + `AudioContext`: play, decode failure, `missing`, LRU eviction, `blocked` before unlock; `expo-av` mock: audio mode set once, play/stop/unload |
| `apps/mobile/src/logic/__tests__/no-direct-speak.test.ts` | unit (source scan; the vitest `include` has no `src/screens` lane, `apps/mobile/vitest.config.ts:21-27`) | no `screens/**` file imports `speak` or `playJamoSound` from `platform/audio` |
| `apps/mobile/e2e/web/audio.spec.ts` | e2e (Playwright) | `page.addInitScript` installs a fake `speechSynthesis`: (1) zero voices => Match Sound shows the text prompt with romanization and the round scores; (2) muted (persisted: reload keeps it muted, Profile switch is off); (3) voices incl. novelty names => spoken utterance uses Yuna; (4) offline reload with clips present plays a clip (`test.skip` until A-9 adds clips; runs against a fixture clip in the test build) and the precache manifest contains every jamo `.mp3` |
| `apps/mobile/src/logic/audio/__tests__/audio-scripts.test.ts` | unit | the pure cores in `scripts/audio/lib.mjs`: `buildAssetMap` (deterministic sorted output, ref from path, ignores non-mp3), `evaluateReport` (each limit of the §3.11 table passes/fails), recording-script row builder (30 rows in §3.2 order, file ids unique); the ffmpeg wrappers are one-off scripts (coverage-excluded, `docs/tests/coverage-targets.md` "scripts/") |

**Coverage**: `packages/content-schema` 100 %; `apps/mobile/src/logic/audio` 100 % branches (business lane, 6-month target); `platform/audio*.ts`, `audio-player*.ts` >= 80 % (platform lane gate 70 %, `coverage-targets.json`); the fake lives outside both lanes. `vitest.config.ts` gains `src/**/__generated__/**` in `coverage.exclude`.

**Manual device matrix** (cannot be automated; results recorded in the A-4a/A-4b and A-7 PRs):

| Device / browser | Checks |
|---|---|
| iPhone Safari, installed PWA, iOS 17/18 | first prompt after Welcome tap is audible (unlock); Yuna (or Enhanced/Premium if installed) chosen; silent-switch behaviour of TTS and of clips; offline clip playback via the service worker; 악 안 알 암 압 앙 audible and distinct |
| iPad Safari | same; novelty voices not chosen |
| iOS native build (Xcode) | explicit voice id; silent switch with `playsInSilentModeIOS`; archive validates with no microphone string |
| Android Chrome PWA | `ko_KR` voice found (underscore normalised); network vs local voice offline; Google Korean voice data missing => text fallback |
| Android native (Xcode-equivalent: Android Studio) | voice list non-empty after init retry; `Locale("ko-KR")` resolution with and without an explicit voice id |
| Desktop Chrome / Edge / Safari / Firefox | voice list async; `Google 한국의` (network) excluded offline; Edge `Microsoft SunHi/InJoon` (names unverified); Firefox/Linux without voices => text fallback |
| Classroom Chromebook / Windows | lecture "Check this device" shows the voice status |

## 6. Rollout and PR breakdown

Order is dependency order; each PR is a test + implementation commit set (CLAUDE.md §5). **Telemetry names ship first** (rule 1 of the shared list).

| PR | Title | Content | Size | Needs |
|---|---|---|---|---|
| A-1 | `feat(content-schema)`: audio schemas, jamo fields, telemetry names | `schemas/audio.ts`, `JamoSchema` additions, `AudioRefSchema` on `audioRef`, four names + exact-list test (rows appended to the shared telemetry table); deploy Worker | S | - |
| A-2 | `content(stage1)`: spoken forms for the 30 jamo | `jamo.ts` factories take `spokenKo`, `spokenRomanization`, `nameKo`, `spokenKind`; `jamo-audio.test.ts`; delete the Q-3a interim `logic/stage1/spoken.ts` if present | S | A-1 (F-CNT-002 PR 1 is merged, #102: `romanizeWord` is available) |
| A-3 | `feat(mobile)`: pure audio logic | `logic/audio/{voice-rank,capability,rate,spoken,prompt-state,controller,copy}.ts`, `test-support/fake-speech-synthesis.ts`, tests | M | A-1 |
| A-4a | `feat(mobile)`: engines and store | rewrite `audio.web.ts` and `audio.ts` as adapters over the controller; `audio-store` (`device:audio`); `bootstrap` step; `installGestureUnlock` in `App.tsx`; remove `ui-store.soundOn` and rebind the existing Profile switch (no new UI yet); platform tests | M | A-3 |
| A-4b | `feat(mobile)`: Profile voice status | Sound card voice status line + "How to add one" sheet (design mock first, CLAUDE.md §5), `speaker-off` glyph; device-checklist results | S | A-4a |
| A-5a | `feat(mobile)`: sound-first core and text fallback | Match Sound fallback zone and bubble, Trace (`playJamo`), the shared prompt-state component and its copy module, grep test (`no-direct-speak`); amend F-001 §3.2/§3.3 and F-009 §3.1 (dated "Revised" notes, as the first-try scoring note does); promote `wireframes/audio-fallback.md` to `design/wireframes/minigame/audio-fallback.md` | M | A-4a (F-QUEST-002 Q-3a consumes `playPrompt` from here) |
| A-5b | `feat(mobile)`: remaining call sites | the other rows of §3.9: BuildLetter, CardMatch, VoiceEcho, CardDetail, TapRespond NPC line, CultureQuiz Hear-it | S | A-5a |
| A-6 | `feat(mobile)`: clip path on the web | `audio-player.web.ts`, `__generated__/audio-assets.ts` + generator + drift test, `expo-asset` dependency, `flags.audioClips`, `pwa-postbuild.mjs` (assertion, `globIgnores`, runtime cache rule), `_headers`, e2e with a fixture clip | M | A-4a |
| A-7 | `feat(mobile)`: clip path on native | `audio-player.ts` (expo-av), audio session, `app.json` plugin entry, `.mp3` module declaration, Xcode archive/validate result | M | A-6 |
| A-8 | `docs(launch)`: recording pipeline and copy | `apps/mobile/scripts/audio/*` (the map generator lands with A-6), generated `audio-recording-script.md`, runbook Step 12 rewrite + `:141` row, `assets-license.csv` header, landing/maker-comment qualifiers (§3.12), T-017 note in `docs/tasks/INBOX.md` | S | A-2 |
| A-9 | `content(audio)`: 30 jamo clips | processed MP3s + `audio:map`; offline e2e un-skipped; restore the offline claim (§3.12) | S | A-6, owner delivery of T-017 |
| A-10 | `content(audio)`: consonant names, then vocabulary topics | batch 2 and F-VOC lists | S each | A-9, F-VOC |

Rollout: PWA ships at A-5b/A-6 with TTS only (every prompt now sound-first, ranked voice, text fallback, persisted mute). A-9 is a pure content release. No flag is needed for A-1..A-5b; `flags.audioClips` (A-6) lets a bad batch of clips be switched off without a redeploy of code (env override, `config/flags.ts`).

## 7. Dependencies

- **Upstream**: F-001 (§3.2-§3.4 amended here), F-009 (amended), F-CNT-002 (`romanize` converter, `∅/ng` fix, `KoText` / `JAMO_SOUND_VALUES`), F-I18N-001 (`speechLang`, catalog; interim `logic/audio/copy.ts` until PR 3 of that spec), F-LEARN-001 (`levelOrder`; interim map above), F-QUEST-002 (Discover, Listen & Pick: consume this API; Q-3a interim shim).
- **Downstream**: F-QUEST-002 Q-3a/Q-5 (`playPrompt`, `spokenKo`), F-STORY-002/003 (reader audio, Say-it-yourself, `narration` kind), F-VOC-001..005 (audio-to-picture, word clips), F-PLC-001 (`canPlayKorean`), lecture mode (voice status row, `setMuted`), F-TCH-004.
- **Libraries**: `expo-asset ~11.0.5` (direct), `expo-av ~15.0.x` (A-7; or `expo-audio` if stable for the SDK in use); `ffmpeg` locally for the recording pipeline only.
- **Owner tasks**: T-017 recordings (30 clips; Step 12 rewritten); identify the speaker and a release; Xcode archive check for A-7.

## 8. Open questions, risks and unverified assumptions

1. **Unreleased finals in isolation (악 압 ...).** Bytes show the six renderings differ; whether the final consonant is *audible and distinguishable* at the end of a 0.2 s utterance is unknown for TTS and for recordings. Owner ear check (§3.11); fallback is a contrast clip or a closed syllable inside a word.
2. **iOS/Chrome first-gesture rule and the unlock trick** (utterance of `' '` at volume 0 plus `AudioContext.resume()`) are from the audit and platform knowledge, not device-verified; closed by the §5 device matrix.
3. **Silent switch**: `playsInSilentModeIOS: true` plays lessons even with the ring switch on silent. A parent may expect the switch to win. Alternative: leave it false and show a "phone is on silent?" hint (the state is not detectable). Owner decision; default here is "play".
4. **Android `Locale("ko-KR")`** in `SpeechModule.kt:91-92` constructs a locale whose language is the whole string; whether `isLanguageAvailable` accepts it depends on the engine. The explicit voice id (applied afterwards, `:105-109`) makes this moot when a ranked voice exists; the device check confirms.
5. **Premium/Enhanced naming** on iOS Safari and Android Chrome (`(Premium)`, `(Enhanced)`, localized forms) and Edge's `Microsoft SunHi/InJoon` are assumed from the audit; the score table degrades gracefully (a missing name only loses its bonus).
6. **`expo-av` vs `expo-audio`** at SDK 52 and the iOS microphone usage-string risk of linking `expo-av` (plugin option `microphonePermission: false` is the mitigation; confirmed only by an Xcode archive validation in A-7).
7. **Range requests / Safari / service worker** (AD9) motivates fetch + Web Audio. If decode latency is noticeable, `warmClips` is the lever; the `<audio>` path is not planned.
8. **Rate numbers** (AD6) are untuned and not equal across engines (§1 table). Tuning table in the PR, by ear, on iOS native, Safari and Android.
9. **Sync summaries cannot tell a text-assisted round from a heard one** (`answerRound(roundIdx, correct)` has no source). A teacher could read "recognised by sound" for a muted learner. Follow-up for F-PAR/F-TCH: add an optional `assist` meta to `answerRound`. Not done here.
10. **Pre-existing precache gap**: `dist/assets/__node_modules/.pnpm/.../back-icon*.png` exist in `dist/` but are absent from the 6-URL precache in `dist/sw.js` (dot directory skipped by the glob); a first-visit-only offline start may be missing React Navigation's back icon. Separate PR; flagged to the owner.
11. **How-to-add-a-voice steps** (iOS: Settings > Accessibility > Spoken Content > Voices > Korean; Android: Settings > System > Languages > Text-to-speech > Google > install voice data) are from memory and vary by OS version; verify when writing the sheet.
12. **Voice release / speaker identity** for the recordings and who the speaker is (a Korean-speaking family member vs a volunteer) is an owner task; the app text must not claim "native speaker" until the files are in.
