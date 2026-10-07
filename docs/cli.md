# Scribble command line and MCP

The original CLI controls a running Scribble Mac app over its owner-private Unix socket. It uses the app's real recording, transcription, model and AI actions. It does not start a replacement engine. Launch the app first. Failures propagate to stderr and exit status 1.

```sh
node scripts/scribble.cjs status --json
node scripts/scribble.cjs record start dictation
node scripts/scribble.cjs stop
node scripts/scribble.cjs cancel
node scripts/scribble.cjs paste-last
node scripts/scribble.cjs history "meeting" --kind command --limit 10
node scripts/scribble.cjs history --since 2026-10-07T00:00:00Z --until 2026-10-08T00:00:00Z
node scripts/scribble.cjs history original ENTRY_ID
node scripts/scribble.cjs history revisions ENTRY_ID
node scripts/scribble.cjs history copy ENTRY_ID --revision 0
node scripts/scribble.cjs history retry ENTRY_ID
node scripts/scribble.cjs notes
node scripts/scribble.cjs notes get NOTE_ID
node scripts/scribble.cjs notes transcribe /absolute/path/meeting.wav --template Meeting
node scripts/scribble.cjs models list
node scripts/scribble.cjs models select base.en
node scripts/scribble.cjs models download base.en
node scripts/scribble.cjs models cancel base.en
node scripts/scribble.cjs models delete base.en
node scripts/scribble.cjs settings get autoEnter
node scripts/scribble.cjs settings set autoEnter true
node scripts/scribble.cjs settings '{"theme":"dark"}'
node scripts/scribble.cjs dictionary Kubernetes "cooper netties"
node scripts/scribble.cjs memory status
node scripts/scribble.cjs memory reindex MEMORY_ID
node scripts/scribble.cjs tones pin TONE_ID
node scripts/scribble.cjs tones auto
```

Existing commands remain compatible: `history QUERY`, `search QUERY`, `notes ID`, `models`, `settings JSON_PATCH`, `transcribe FILE --note`, `record MODE`, `cancel`, and `command INSTRUCTION`. `record stop` aliases `stop`; `record cancel` aliases `cancel`. Record modes are dictation, command, and note. Recording actions request the running renderer; they require microphone permissions and a real target application. Stop requests a save/transcription; its reply does not prove transcription has finished. Poll `status`/history for results. Cancel discards recording or interrupts current processing.

History queries search final text, originals, errors, command instructions and retained revision text/context. `--kind`, `--since`, `--until` and `--limit` combine with text queries. Time bounds are inclusive ISO timestamps; include an explicit offset or `Z` for reproducibility. Limits range from 0 to 10000. `history get ID` returns the full retained entry; original/revisions return those representations. `history copy ID` copies final text, `--original` copies retained original text, and `--revision INDEX` copies a zero-based retained revision. Conflicting selectors are rejected. Retry requires retained source audio and uses current settings. No command reconstructs discarded history or missing audio.

`settings get KEY` reads one preference; `settings set KEY JSON_VALUE` preserves JSON types. A one-argument `settings set JSON_OBJECT` is also supported. Speech model selection validates the catalog ID before changing preferences. Model download/removal/cancellation use the app's actual engine handlers. `memory list`/`memory get ID` read reference items; `memory status [ID]` returns indexing metadata without reference content. Reindex propagates a recorded indexing error as CLI failure. Tone pinning uses the app's existing tone identity; auto clears the pin and restores automatic routing.

The default socket is `~/Library/Application Support/Scribble/scribble.sock`. `SCRIBBLE_DATA_DIR` selects the app's actual data directory. It is never a public network listener. The app's socket allowlist must include `state`, `models`, `preferences`, `transcribe-file`, `command`, `start-recording`, `stop-recording`, `cancel-recording`, `paste-last`, `save-item`, `copy`, `retry`, `download-model`, `cancel-download`, `delete-model`, `memory-reindex`, and `select-tone`. An unavailable action returns the genuine app error.

## MCP

Configure the client with absolute Node and repository paths:

```json
{"mcpServers":{"scribble":{"command":"/absolute/path/to/node","args":["/absolute/path/to/scribble/scripts/scribble.cjs","--mcp"]}}}
```

The newline-delimited JSON-RPC server implements initialize, ping, tools/list and tools/call. All ten original tools retain their names and original arguments. Seven additional tools provide stop, paste-last, history-entry actions, filtered history, model management, memory management and tone management, for **17 tools** total. Discovery works with the app closed; operational tools return readable failures until it runs. Notifications produce no replies; stdout contains protocol responses only. Unknown arguments, required fields and enum values are validated before action dispatch. Resources are not advertised.

Commands follow configured providers. Cloud transcription/AI requests can incur provider charges; choose local engines/providers for no-payment operation. MCP descriptions disclose potentially external or desktop actions. Reindex, retry and stopping a recording may invoke configured providers; downloads are explicit. Read-only metadata commands do not start a microphone or provider request.

`tests/cli.test.js` exercises framing, schemas, retained revision search/copy, lifecycle routing, model validation, settings types, indexing metadata, and actual subprocess transport against an isolated fake Unix socket. These tests do not prove real app/model/permission behavior. Runtime parity and free public feature coverage remain tracked in the acceptance ledger. The interface is original; it does not claim compatibility with unobserved private CLI exports.

## Evidence and parity limits

The public feature inventory in `docs/public-features.md` identifies CLI/MCP as included in the free plan. Scribble exposes recording start/stop/cancel, paste-last, history search/filter/originals/revisions/copy/retry, note inspection/file transcription, model selection/download/cancellation/deletion, typed settings, memory inspection/reindexing, and automatic/pinned tones. These are implemented Scribble operations; their spelling and MCP schemas are not asserted to match Vowen.

A focused, read-only static check of the installed Vowen archive on October 7, 2026 found no separate first-party CLI/MCP script in the package listing. Literal searches in `dist-electron/main.bundle.js` did not establish `--mcp`, `tools/list`, or a CLI server route surface. Generic `--help` strings and MCP client-integration strings do not prove an exported command interface. Obfuscated strings and runtime-generated shims remain unknown; absence from this search is not proof that a feature is absent. The inspected main bundle has SHA-256 `bbc736ed772ac64f6c59dc76dcfcff5e2ef2e612ef772e6a0e6870ae368fd919`.

REA's full archive analysis stopped with `artifact_integrity_mismatch` for unpacked `node_modules/@ffmpeg-installer/darwin-arm64/ffmpeg`: declared SHA-256 `a2ad6f0fc42a3c8f5183ef1d53e906d6bb35478d14a6b67175c30ce6c17e9214`, calculated `57313f42e0928f44022a0d54fb99372cc9b73534f223ad2dd78f510df57fa5f7`. The app was not repaired, altered, or executed to discover CLI commands. Exact private help output, tool names, argument compatibility and live CLI behavior therefore remain unverified.
