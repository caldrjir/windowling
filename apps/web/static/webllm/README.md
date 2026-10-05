# WebLLM model libraries (self-hosted)

Compiled WebGPU kernels for the on-device brain (#31), served from our own origin so that no
executable code is fetched from third parties at runtime. Only model **weights** (data) come
from the Hugging Face Hub.

Source: https://github.com/mlc-ai/binary-mlc-llm-libs/tree/main/web-llm-models/v0_2_84/base
(the version `@mlc-ai/web-llm` 0.2.85 uses). Update together with the package.

| File                                             | SHA-256                                                            |
| ------------------------------------------------ | ------------------------------------------------------------------ |
| `Llama-3.2-1B-Instruct-q4f16_1_cs1k-webgpu.wasm` | `2aa9b5f0c8de532f6cbf6bb7b863aaa02645bf6fff856083b202f968712d3f92` |
| `Llama-3.2-1B-Instruct-q4f32_1_cs1k-webgpu.wasm` | `a1407404cb85b7dbc6db4bd77569291f02dab50aaeb1dc595b17595c2e204c66` |

Verify: `sha256sum apps/web/static/webllm/*.wasm`
