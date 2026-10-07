# Scribble command line and MCP

The original Node-only CLI controls a running Scribble Mac app over its user-private Unix socket. It does not start the app or substitute a different transcription engine. Launch Scribble and configure a local model first. Commands propagate app/engine failures and return exit status 1.

```sh
node scripts/scribble.cjs status --json
node scripts/scribble.cjs models
node scripts/scribble.cjs transcribe /absolute/path/audio.wav
node scripts/scribble.cjs history "search words"
node scripts/scribble.cjs notes
node scripts/scribble.cjs dictionary Kubernetes "cooper netties"
node scripts/scribble.cjs settings '{"theme":"dark"}'
node scripts/scribble.cjs record dictation
node scripts/scribble.cjs cancel
```

`search QUERY` aliases history search. `notes ID` reads one note; `transcribe FILE --note` requests a note. `settings` reads current settings. `command INSTRUCTION` runs the app's command mode. Recording requests need the renderer, microphone permissions and target app; the CLI does not provide a standalone microphone recorder. Stop a recording from the app; cancel discards it.

The default socket is `~/Library/Application Support/Scribble/scribble.sock`. Set `SCRIBBLE_DATA_DIR` to the same directory used by a development or isolated app instance. It is never a network listener. Do not share the socket with untrusted users.

## MCP setup

Configure an MCP client with the actual absolute Node and checkout paths:

```json
{
  "mcpServers": {
    "scribble": {
      "command": "/absolute/path/to/node",
      "args": ["/absolute/path/to/scribble/scripts/scribble.cjs", "--mcp"]
    }
  }
}
```

The stdio server implements newline-delimited JSON-RPC initialize, ping, tools/list and tools/call. Ten tools expose status, history, models, file transcription, notes, vocabulary, settings, recording, cancellation and command mode. It supports tool discovery while the app is closed; operational tools return a readable error until the app runs. It writes protocol responses only to stdout. Resources are not advertised.

Transcription and AI commands follow the app's configured providers. If you choose cloud services, their requests may incur your provider charges; choose a local model/provider for no-payment operation. Agents should review the tool description before executing command or recording actions, which can affect the desktop or clipboard. Settings can change future provider routing.

Tests in `tests/cli.test.js` verify protocol framing, schemas, server-error propagation, command routing and local fake-socket transport. These prove CLI behavior, not real app/model/permission functionality. Actual app socket invocations remain required in the acceptance ledger.
