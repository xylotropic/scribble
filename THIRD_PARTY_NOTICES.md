# Third-party software

Scribble source and original artwork are MIT licensed. Dependencies retain their own licenses, included in installed packages and packaged application notices.

- Electron / Chromium: Electron MIT, Chromium and bundled components retain respective notices.
- whisper.cpp: MIT; downloaded by setup, pinned revision documented in the script.
- FluidAudio: Apache-2.0; used by the original Parakeet adapter.
- NVIDIA Parakeet CoreML models: upstream model licensing applies; pinned download manifests identify their source.
- Ollama: MIT; optional runtime, installed from its official release.
- Qwen3: upstream model licensing applies; optional downloaded model.
- FFmpeg: the supplied binary has its own LGPL/GPL configuration and notices. Distribution must preserve the relevant FFmpeg license and source obligations; inspect the pinned installer package before distributing a release.
- Sharp / libvips, pdf-lib, fontkit, YAML, TOML, and ZIP dependencies retain their package licenses.

Model/runtime downloads are not committed to this repository. System fonts used for PDF generation are selected from the user's Mac, not redistributed as source assets.
