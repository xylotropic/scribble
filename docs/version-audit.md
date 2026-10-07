# Vowen version audit — October 7, 2026

The current public Mac release is **0.5.10**. The [official homepage](https://vowen.ai/) identifies that version with a September 30 label; the [official Mac download page](https://vowen.ai/mac/download/) names the same Apple Silicon DMG. Its actual application bundle and extracted package both report 0.5.10. The installed original and earlier private extraction report 0.5.9.

The official [documentation changelog](https://docs.vowen.ai/changelog) retrieved during this audit stops at 0.5.5, and the [Featurebase changelog](https://vowen.featurebase.app/changelog) listing stops at 0.5.7. Neither establishes the complete 0.5.10 release delta. No detailed 0.5.10 release note was found in those retrieved listings.

## Artifact provenance

Downloaded directly from `https://assets.vowen.ai/Vowen-0.5.10-arm64.dmg` into `.private-analysis/version-audit/`, mounted read-only without browsing, inspected statically, and detached. The app was not installed, launched, or substituted for the existing installation. Dependencies and executable code from this app were not imported into Scribble.

| Artifact | SHA-256 |
| --- | --- |
| Official DMG | `461f90a0d9093c011ee221a492d88038cd09684e5be2f5ef527a89eba6caf10d` |
| Extracted package.json | `7a82091c76973d8abf1eaf948ba0b3fad735bcb2b8f8a0c21aa869efca62673b` |
| Main bundle | `56feaf03ac41dff3f7ca587a0b877d78c147bde5f7aecd06b0172f4ac6bf02ed` |
| Settings bundle | `e8c7151ac2751a498c06fe2adf03550287acb236886435d53ce2b9428f036d4e` |
| English localization | `c3ae55e55e9966ae25254a743b249cf9c3a4187f32e9c9ffd8eac4f6ef62c704` |

Extraction used the public Electron ASAR tool for container inspection. This bounded static comparison required no native decompilation, target execution, account access, or entitlement modification. The private JSON locale delta remains beside the extraction.

## Established delta and entitlement

English localization has exactly five added keys and no changed/removed keys: a speaker-model selector label and description, plus Automatic, Standard pyannote, and Nemotron-3 choices. The selector describes Nemotron-3 as supporting up to eight speakers and cross-talk; Standard describes an unrestricted speaker count. These are shipped UI claims, not benchmark results from this audit. Native resources additionally contain `models/diarization-plda-community-1.json`.

The new main bundle contains Nemotron-3 diarizer model/configuration identifiers and an asset archive URL for that model. The settings control appears conditionally with a supported transcription engine and speaker-label preference on macOS. Obfuscation prevents this small static comparison from independently proving every entitlement condition. The [current official pricing page](https://vowen.ai/pricing/) explicitly places speaker identification in Pro. Therefore the new selector does **not** establish a newly required free reference-app feature; no paid gate was bypassed or exercised.

Public independent [FluidAudio diarization APIs](https://github.com/FluidInference/FluidAudio/blob/main/Documentation/API.md) and [Nemotron-3 CoreML weights](https://huggingface.co/FluidInference/nemotron-3-diarization-coreml) exist, but no diarization adapter was implemented or accuracy tested as part of this version audit. Their existence is separate from Vowen's entitlement and from Scribble's current verified functionality.

## Model, provider, and CLI bounds

The compared ASR manifest snippets retain Parakeet v2/v3, Japanese and Mandarin Parakeet, and English/multilingual Nemotron families. Some package download endpoints change, including versioned Japanese and Windows v2 archives. They do not alone establish new model families, licenses, or accuracy behavior. Scribble's pinned public-model downloads deliberately remain independent of Vowen asset archives.

No new English provider labels were added. App-level file inventories under `locales`, `dist-electron`, and `src` have no added or removed paths; package dependency names also have no added or removed entries. The older extraction omitted much of node_modules, so raw whole-directory additions were excluded from feature conclusions.

Raw string differences include rearranged OpenRouter/Cartesia dispatch and CLI-related identifiers. Because the bundles are obfuscated, a previously indirect string becoming literal is not proof that a provider or CLI command is new. This audit found no verified new free provider, ASR family, or CLI command requiring a new Scribble implementation. That is a bounded finding, **not** proof of complete 0.5.9/0.5.10 behavioral parity or all-free-feature parity. The detailed 0.5.10 release notes and authenticated runtime behavior remain unverified.
