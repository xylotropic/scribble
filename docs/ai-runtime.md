# Packaged local AI runtime

`node scripts/bundle-ai.mjs` stages official Ollama 0.40.0 into `release/runtime/ollama`, including its runner executables, Metal libraries, CPU libraries, and upstream licence notices. It imports the release URL/version/SHA-256 from `scripts/setup-ai.mjs`, verifies the archive before extraction, and records SHA-256 hashes for every regular file plus safe relative symlink targets in `scribble-runtime.json`. Models are not included. The staged runtime currently occupies about 520 MB.

Packaging must copy this directory to `process.resourcesPath/runtime/ollama`. Preserve verified bytes when packaging. If code signing changes embedded executable or library bytes, the unsigned manifest will no longer match; the resulting packaged runtime must receive a reviewed post-sign manifest and be verified again. A version label alone is insufficient. `verifyRuntime()` rejects changed files, escaped paths, unsafe symlinks, mismatched release provenance, or a missing executable. The bundler also writes a manifest to an existing managed installation only after every listed file and symlink matches the freshly extracted official archive.

Main integration:

```js
const {ensureLocalAI, closeLocalAI} = require('./ai-runtime');
await ensureLocalAI({
  endpoint: settings.aiEndpoint,
  dataDir,
  resourcesPath: app.isPackaged ? process.resourcesPath : path.resolve('release')
});
// At application shutdown:
const shutdown = await closeLocalAI();
// shutdown.stopped proves the owned child emitted exit.
```

Invoke this only for an explicit local-AI operation, such as a user-requested model download, connection test, or local generation. It accepts exactly `http://127.0.0.1:11434`. Other configured endpoints must use their existing server and cannot cause this launcher to bind another address. It makes only `/api/version` readiness requests; it never downloads a model or runs cloud inference. The existing model-download action remains a separate explicit operation.

A healthy existing endpoint is reused without changing environment variables, model directories, or service ownership. Its returned `owned:false` status does not claim cloud-disabled configuration for that external service. App-owned launches use `OLLAMA_HOST=127.0.0.1:11434`, `OLLAMA_NO_CLOUD=1`, and owner-private `dataDir/local-ai/models`. Logs are written to owner-private `dataDir/local-ai/server.log`. Concurrent start requests share one startup. Errors and readiness timeouts reject honestly and stop only the child launched by this manager. Closing Scribble sends SIGTERM to that owned child, with a bounded SIGKILL fallback; `closeLocalAI()` returns a promise resolving `{owned,stopped}` after exit or the final bounded wait, so main should await it before allowing application termination; externally running servers are never killed.

The launcher uses Electron's bundled Node runtime when installed; the user does not need a separate Node installation or source checkout. It checks the bundled verified runtime first, then a fully manifested managed `~/.local/share/scribble-tools/ollama/0.40.0` installation. If neither is valid, it reports the missing runtime rather than downloading software silently.

Verification: `node --test tests/ai-runtime.test.js` covers real HTTP readiness with mocked process ownership, concurrent starts, explicit loopback constraints, startup failures/timeouts, and modified executable detection. It does not claim a new-user packaged launch has been verified; that requires running the final packaged app against a clean profile.

Official source: [Ollama 0.40.0 release](https://github.com/ollama/ollama/releases/tag/v0.40.0). The [Ollama FAQ](https://docs.ollama.com/faq) documents cloud-disable, host-binding, and model-directory environment variables.

For an app-owned child on Apple Silicon, Scribble selects `OLLAMA_LLM_LIBRARY=mlx_metal_v3` when the macOS product version is below 26.2 or cannot be determined. It reads Electron’s `process.getSystemVersion()` when available, otherwise the read-only `sw_vers -productVersion` command; it does not infer product versions from Darwin kernel numbers. On 26.2 or newer, and on Intel, upstream backend selection remains in effect. An explicitly supplied `OLLAMA_LLM_LIBRARY` is preserved. Selection changes only the managed child’s environment snapshot; a healthy external server is reused before version detection and remains untouched.

This boundary follows the packaged dylibs: the four `mlx_metal_v4` ARM libraries declare macOS 26.2, while `mlx_metal_v3` declares 14.0. The pinned [Ollama 0.40.0 MLX loader](https://github.com/ollama/ollama/blob/v0.40.0/mlx/dynamic.go#L240-L269) filters Metal 4 by major version 26, leaving 26.0/26.1 outside the packaged libraries’ deployment minimum. Its explicit variant override permits selecting the compatible Metal 3 directory. Tests verify child selection at 14, 26.0, 26.1, 26.2, newer and unknown versions, explicit overrides, Intel behavior and external-server reuse; they do not execute a model or establish macOS 14/26.1 live inference compatibility.
