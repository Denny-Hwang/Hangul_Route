# Clip QA: local setup and run (AMENDMENTS-AUDIO-CLIPS section 9, row AC-4)

`audio:tts:qa` checks every generated Korean clip twice, with two speech recognizers from different model families that listen to the audio independently, plus signal and identity checks. A clip ships only when both recognizers and the shared checks pass and two MAR reviewer agents say keep (spec section 9).

- **Local only.** Both recognizers run on this machine. There is no network call at run time and no vendor speech-to-text. The command refuses to run when `CI` is set.
- **No account, no key.** Setup downloads public files: the whisper.cpp source, the Whisper model and the CTC model. None of them needs an account or a credential. An agent can do the setup on the owner's machine.
- **Where things live.** Models, the Python environment and the reports all go under `apps/mobile/recordings/`, which git ignores. Nothing here is committed.
- **Disk.** About 5 GB: Whisper large-v3 is 3.1 GB, the CTC model 0.4 GB, and PyTorch about 1 GB.

Korean pointer for the owner: `docs/launch/owner-runbook.md` section M-6.

## 1. Tools

- ffmpeg and ffprobe: `brew install ffmpeg`. ffmpeg decodes each clip to 16 kHz mono for both models and measures silence and loudness.
- CMake and a C++ compiler: `brew install cmake`, plus the Xcode command line tools.
- Python 3.10 to 3.12 for PyTorch: `brew install python@3.12`.

## 2. Pass 1: whisper.cpp with Whisper large-v3

whisper.cpp is under the MIT licence, and so are OpenAI's Whisper weights.

```sh
mkdir -p apps/mobile/recordings/models
git clone https://github.com/ggml-org/whisper.cpp ~/src/whisper.cpp
cd ~/src/whisper.cpp
cmake -B build && cmake --build build -j --config Release   # Metal is on by default on Apple silicon
sh ./models/download-ggml-model.sh large-v3                 # models/ggml-large-v3.bin, about 3.1 GB
cp models/ggml-large-v3.bin <repo>/apps/mobile/recordings/models/ggml-large-v3.bin
```

Put `build/bin/whisper-cli` on the `PATH`, or pass `--whisper-cli ~/src/whisper.cpp/build/bin/whisper-cli`.

What the QA asks of Whisper:

- **Free transcription** of every clip: `-l ko -nt -otxt`. All clips run in one call.
- **Forced choice** for every jamo clip and every clip of one or two syllables: `--grammar <file> --grammar-rule root --grammar-penalty 100`. The grammar allows only the clip's closed set: the target and its confusables. Clips that share a closed set run in one call.

## 3. Pass 2: a Korean wav2vec2 CTC model

The default model is `Kkonjeong/wav2vec2-base-korean`. Its model card was read on 2026-10-30:

- **Licence:** Apache-2.0.
- **Training:** fine-tuned from `facebook/wav2vec2-base` on Zeroth-Korean (CC BY 4.0).
- **Units:** 54 tokens, the compatibility jamo plus space, `[UNK]` and `[PAD]`. Because the units are jamo, the model can spell every syllable in a closed set, including rare ones such as 읔, 읕 and 앋.
- **Accuracy:** the card reports a character error rate of 7.3 % on the Zeroth test set. That is weaker than Whisper on free transcription. AC-5 measures both on the pilot.

Set it up:

```sh
python3.12 -m venv apps/mobile/recordings/models/venv
apps/mobile/recordings/models/venv/bin/pip install torch transformers numpy huggingface_hub
apps/mobile/recordings/models/venv/bin/huggingface-cli download Kkonjeong/wav2vec2-base-korean \
  --local-dir apps/mobile/recordings/models/wav2vec2-base-korean
```

The QA checks the model before it runs:

- It reads `license:` from the model card (`README.md`) and refuses a model whose licence is not one of `apache-2.0`, `mit`, `bsd-2-clause`, `bsd-3-clause`, `cc-by-4.0` or `cc0-1.0`.
- The report records the model id, its licence and the sha256 of the weights file.

To use another model, pass `--ctc-model <folder> --ctc-model-id <id>`. Add `--ctc-licence <spdx>` only when the card has no licence field and you have read the licence yourself.

An alternative is `kresnik/wav2vec2-large-xlsr-korean`: also Apache-2.0, and more accurate on free decoding. Its vocabulary is 1,205 whole syllables, though, so it cannot spell some letter-name syllables (읔, 읕, 읖). Those clips then fail with "cannot score the target".

How Pass 2 runs:

- `apps/mobile/scripts/audio/tts/pass2_ctc.py` loads the model from its folder with `local_files_only`, and is started with `HF_HUB_OFFLINE=1` and `TRANSFORMERS_OFFLINE=1`.
- For each clip it returns the best token per frame, plus the log-probabilities of the tokens that the clip's candidates need.
- The greedy decode and the Viterbi forced alignment then run in JS (`qa-lib.mjs`), where they are unit-tested.

## 4. Run

The owner generates the clips and says which folder they are in (owner runbook, section M). Then:

```sh
pnpm --filter @hangul-route/mobile audio:tts:qa --engine polly --voice Seoyeon --pilot
pnpm --filter @hangul-route/mobile audio:tts:qa --engine polly --voice Seoyeon --pack jamo-s1,jamo-wb
pnpm --filter @hangul-route/mobile audio:tts:qa --engine polly --voice Seoyeon --pack jamo-s1,jamo-wb \
  --dir apps/mobile/assets/audio/jamo          # the processed MP3s, before the content PR
```

- **Input:** the clips in `apps/mobile/recordings/tts/<engine>/<voice>/` (`<key>.wav` or `<key>.mp3`), or in the folders named by `--dir`. The QA also reads three committed files: `content/audio/tts-manifest.json`, `content/audio/pronunciation-overrides.json` (its `accept` variants) and `content/audio/tts-lock.json`.
- **Selection:** the same as the generator: `--pack`, `--pilot` or `--only <keys>`.
- **Margin:** `--margin <nats>` sets the Pass 2 threshold. The default is 2.0, and AC-5 calibrates it.
- **Output:** `qa-report.json` and `qa-report.md` in the master folder, or in `--out` (it must be gitignored).
- **Exit code:** 0 when every selected row passes; 1 when any clip fails, is missing or was vetoed; 2 on a usage error or a refusal.

### What is checked

- **Exact match.** Before any comparison, both passes apply NFC and remove punctuation and spaces. A transcript passes only if it equals the manifest `text` or an authored `accept` variant. 가방 heard as 가반 fails. A letter name also passes on its isolated pronunciation from the AC-B3 table (시옷 as [시옫]).
- **Closed set.** This applies to jamo clips and to clips of one or two syllables. The target is swapped one syllable at a time for:
  - the other members of its plain / aspirated / tense series (가/카/까, 다/타/따, 바/파/빠, 자/차/짜, 사/싸);
  - the other final sounds (악 안 알 암 압 앙 앋). A final that sounds the same as the target's own, such as 옷 and 옫, is never a confusable;
  - ㅓ/ㅗ, ㅡ/ㅜ, and 의 against 이 and 으.

  A letter name also has as confusables the names in its series and every name that shares a written or heard syllable with it (the 쌍 names against the plain ones). A syllable that none of these rules covers (나, 마, 하, 아, 야, 애, 와 ...) gets its nearest sounds instead: ㄴ/ㄷ, ㅁ/ㅂ, ㄹ/ㄴ, ㅎ/ㅇ, and a glide against its plain vowel. Vowels most speakers no longer tell apart (ㅐ/ㅔ, ㅚ/ㅙ/ㅞ) are never paired.
- **Pass 1.**
  - A word or sentence fails unless its free transcript matches exactly.
  - A closed-set clip fails when its forced choice is not the target. A free-transcript mismatch on a closed-set clip is only a flag.
- **Pass 2.**
  - A word or sentence fails unless its greedy decode matches exactly.
  - A closed-set clip fails when the target does not score highest, or when its margin over the best confusable is under the threshold (top but narrow).
- **Shared checks.**
  - Duration and size by class, from `CLIP_LIMITS`:
    - jamo: 0.6-1.5 s and 12 KB;
    - word: 0.6-4.0 s and 40 KB. The five tense letter names take this bound;
    - sentence and narration: 0.15-0.45 s per spoken syllable plus 0.6 s, with the byte cap that gives at 48 kbps.
  - Leading and trailing silence 0.25-0.4 s.
  - No internal silence over 0.5 s in a clip of one or two syllables.
  - In a jamo clip, the voiced span is at least 0.15 s and the onset is not clipped. For a final, the report also shows where the closure is.
  - Loudness -16 LUFS +/- 1.5 and true peak at most -1.5 dBTP.
  - Identity:
    - each row has exactly one clip;
    - each clip is in the lock: an MP3 by its sha256, a WAV master by its row's sha256 of the text sent;
    - no two jamo clips that must sound different are byte-identical.
- **WAV masters.** Masters are not processed yet. Format, size, loudness and edge silence are listed as pending until the processed MP3s are checked. Before the content PR, run the QA again on those MP3s.

### After the run

1. **Regenerate.** The report lists each failing, missing or vetoed row, with the exact commands for the owner's own terminal: move the master aside, then `audio:tts:generate ... --only <keys>`. For a row that keeps failing, add an AC-B3 override instead (`say`, plus an `accept` variant when the pronounced form is what the voice should say), then run `audio:tts:manifest`. Every regenerated row goes through both passes again.
2. **MAR.** At least two independent reviewer agents read the report. Each fills its own column of the table ("MAR 1", "MAR 2") with keep or regenerate and a reason, for every jamo clip and every flagged word or sentence. A clip ships only when both say keep. The table goes into the content PR body. It is a multi-agent review: no copy calls it a native-speaker or expert review.
3. **Optional owner listen.** About 10 minutes: `pnpm audio:tts:listen --pack jamo-s1,jamo-wb --engine polly --voice Seoyeon` plays the clips back to back (afplay, or ffplay) and prints each one's id, text and romanization. Enter keeps a clip, v vetoes it (with an optional reason), r plays it again, q stops. With `--veto <keys>` the clips still play, but nothing is asked and those keys are recorded as vetoed. The vetoes go into `owner-listen.json` and the report, and a vetoed row is regenerated.
