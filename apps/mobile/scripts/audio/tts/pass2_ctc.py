"""Pass 2 of the clip QA (AMENDMENTS-AUDIO-CLIPS section 9; row AC-4): a local wav2vec2 CTC model.

    python pass2_ctc.py <request.json> <out.json>

request.json: {"model": "<local model folder>", "clips": [{"id": "0", "wav": "<16 kHz mono WAV>", "ids": [..]}]}
out.json:     {"clips": {"0": {"argmax": [..], "ids": [..], "emissions": [[..], ..]}}}

For each clip: the best token id per frame over the whole vocabulary (for the greedy decode) and, for the requested
ids only, the per-frame log-probabilities (log-softmax over the whole vocabulary). The greedy decode and the Viterbi
forced alignment are done by the caller (qa-lib.mjs), where they are unit-tested.

Local only: the model is loaded from its folder with local_files_only, and the caller sets HF_HUB_OFFLINE and
TRANSFORMERS_OFFLINE. Run by apps/mobile/scripts/audio/tts/recognizers.mjs; setup in docs/launch/tts-qa-setup.md.
"""

import json
import sys
import wave

import numpy as np
import torch
from transformers import Wav2Vec2FeatureExtractor, Wav2Vec2ForCTC


def read_wav(path):
    with wave.open(path, "rb") as w:
        if w.getnchannels() != 1 or w.getframerate() != 16000 or w.getsampwidth() != 2:
            raise SystemExit(f"{path}: expected 16 kHz mono 16-bit WAV")
        frames = w.readframes(w.getnframes())
    return np.frombuffer(frames, dtype="<i2").astype(np.float32) / 32768.0


def main(request_path, out_path):
    with open(request_path, encoding="utf-8") as f:
        request = json.load(f)
    model_dir = request["model"]
    extractor = Wav2Vec2FeatureExtractor.from_pretrained(model_dir, local_files_only=True)
    model = Wav2Vec2ForCTC.from_pretrained(model_dir, local_files_only=True).eval()
    clips = {}
    for clip in request["clips"]:
        audio = read_wav(clip["wav"])
        inputs = extractor(audio, sampling_rate=16000, return_tensors="pt")
        with torch.no_grad():
            logits = model(inputs.input_values).logits[0]
        logp = torch.log_softmax(logits.double(), dim=-1)
        ids = [int(i) for i in clip["ids"]]
        clips[clip["id"]] = {
            "argmax": [int(i) for i in logp.argmax(dim=-1).tolist()],
            "ids": ids,
            "emissions": logp[:, ids].tolist() if ids else [],
        }
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump({"clips": clips}, f)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("usage: pass2_ctc.py <request.json> <out.json>")
    main(sys.argv[1], sys.argv[2])
