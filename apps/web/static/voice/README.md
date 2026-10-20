# Neural voice data (self-hosted)

Data for the character's neural voice (Kokoro-82M, #32). The ONNX runtime is bundled by us;
only the model weights (~92 MB, `onnx-community/Kokoro-82M-v1.0-ONNX`, q8) come from the
Hugging Face Hub, after the player agrees to the download.

- `lexicon-us.json`: pronunciation dictionary, built by `apps/web/scripts/voice-lexicon.mjs` from
  Misaki's `us_gold.json` + `us_silver.json` (https://github.com/hexgrad/misaki, Apache-2.0,
  misaki 0.9.4). No eSpeak NG (GPL) anywhere.
- `*.bin`: Kokoro v1.0 voices (https://huggingface.co/hexgrad/Kokoro-82M, Apache-2.0): float32
  `[510, 256]` style vectors, one row per input length. Taken from `voices-v1.0.bin` of
  https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0 (an `.npz`).

| File             | SHA-256                                                            |
| ---------------- | ------------------------------------------------------------------ |
| `af_bella.bin`   | `f69d836209b78eb8c66e75e3cda491e26ea838a3674257e9d4e5703cbaf55c8b` |
| `af_heart.bin`   | `d583ccff3cdca2f7fae535cb998ac07e9fcb90f09737b9a41fa2734ec44a8f0b` |
| `af_nicole.bin`  | `cd2191ab31b914ed7b318416b0e4440fdf392ddad9106a060819aa600a64f59a` |
| `am_fenrir.bin`  | `c27989f741f7ee34d273a39d8a595cc0837d35f5ced9a29b7cc162614616df43` |
| `am_michael.bin` | `1d1f21dd8da39c30705cd4c75d039d265e9bc4a2a93ed09bc9e1b1225eb95ba1` |
| `am_puck.bin`    | `fcf73c989033e9233e0b98713eca600c8c74dcc1614b37009d5450ff4a2274a0` |
