# Local memory indexing

`src/main/memory-index.js` is an original local lexical index. It accepts named notes and explicitly chosen regular files. It does not download models, call a cloud service, watch folders, execute document content, or scrape current apps. Current context is supplied explicitly by the caller.

The shipped target's English localization independently establishes named note content, file memory, and Pending / Indexing / Indexed / Error status labels, plus index and reindex actions (`.private-analysis/extracted/locales/en.yml`, memory entries around line 2234). Static settings UI evidence also has pending/error index and indexed reindex buttons. These facts guide feature coverage only; proprietary source was not copied. Scribble previously read all imports as UTF-8 and truncated at 50,000 characters without an indexing state.

Supported files are UTF-8 `.txt`, `.md`, `.markdown`, `.csv`, `.json`, `.yaml`, `.yml`, `.toml`, and text-bearing `.pdf`. Config files are searchable literal text; they are not interpreted as commands. PDF text uses public `pdfjs-dist` with code evaluation disabled. Images, scanned PDF OCR, DOCX, web crawling, and embedding similarity are not implemented and should not be advertised as supported. Empty/scanned PDFs produce an error stating OCR is needed. Invalid UTF-8 and binary text also produce errors.

Files are limited to 8 MiB, extracted content to 500,000 characters, PDFs to 300 pages and 30 seconds. Files are opened with `O_NOFOLLOW`; explicit symbolic-link inputs are rejected. Chunk extraction is bounded and streaming for PDFs. A failed reindex removes old searchable content rather than claiming stale bytes are indexed. Removal or a newer index request supersedes an older asynchronous read.

Integration API:

```js
const { MemoryIndex, SUPPORTED_EXTENSIONS } = require('./memory-index');
const memory = new MemoryIndex({ onUpdate: item => publishStatus(item) });
await memory.index({ id: 'project', name: 'Project reference', content: noteText, enabled: true });
await memory.index({ id: 'file', name: 'Reference PDF', filePath: absoluteChosenPath });
await memory.reindex('file');
memory.setEnabled('file', false);
memory.remove('project');
const { text, sources } = memory.context(commandText, { maxChars: 12000, currentContext: explicitSelection });
```

`list()` and update callbacks return `id`, `name`, `enabled`, `source`, `filePath`, `status`, `error`, `content`, `chunkCount`, `indexedAt`, and a SHA-256 of normalized indexed text. Status is `indexing`, then `indexed` or `error`. A superseded operation returns `{id,status:'superseded'}` without republishing it. The UI may show `pending` before calling `index`; the index itself never pretends pending content is searchable. Persist metadata in the existing store; rehydrate this transient index from saved items at startup. File-backed items re-read the explicitly saved path when indexed/reindexed. Avoid persisting transient chunks or exposing internal maps.

`search(query,{limit:8})` returns matching chunks with source IDs, names, character offsets, text, and lexical score. Disabled/error/indexing items are excluded. Unicode terms and CJK bigrams support non-whitespace languages. Retrieval uses exact lexical overlap, not semantic embeddings. General reference notes that share no query terms are not automatically included. `context` prioritizes supplied current context, then relevant memory, and caps the total character budget. Source offsets describe the full retrieved chunk; the last included chunk may be truncated to the remaining budget. The model should receive these strings as reference data, never as privileged system instructions.

Tests create and parse actual PDFs, reject malformed/empty PDFs, verify changed-file reindex and stale-error removal, enforce enabled/context budgets, exercise CJK retrieval, and prove removal cannot resurrect an asynchronous index. Run `node --test test/memory-index.test.js`.

## Provider-generated memory summaries

`src/main/memory-summary.js` adds original provider-backed summary coordination. `await summarizeMemory(content, chat, {signal})` returns `{summary,chunkCount,providerCalls}`. Supply an actual configured provider adapter as `chat(messages,{signal})`; the adapter returns either a string or `{content:string}`. The caller records provider/model identity and indexing status, persists the summary separately, and retains the full original content in MemoryIndex. A summary is not a replacement for raw source text.

Input is divided into at most 12,000-character user messages. Multiple outputs undergo bounded hierarchical combination. Prompts request exact names, identifiers, dates, numbers, preferences, and exceptions, but factual fidelity depends on the selected model and requires review. Empty/malformed responses, provider failures, oversized outputs, and nonreducing combination fail explicitly. Cancellation is passed to the callback and checked before/after each request; the provider adapter must honor the signal to cancel its in-flight network request. No summary is returned after cancellation.

Provider indexing can use a free local Ollama model; optional cloud providers follow their own account pricing. Sending reference data occurs only through the caller's explicit provider request. Persist provider summaries separately and include enabled successful summaries in command context; keep lexical raw-source retrieval available for grounded follow-up. A failed reindex must show an error rather than label the previous summary current.

`test/memory-summary.test.js` uses mocked provider callbacks to verify request batching, returned-schema validation, fact-bearing combination inputs/outputs, cancellation, error propagation, and bounded reduction. These tests do not establish real-model summary accuracy or claim a cloud request was made. Genuine PDF extraction and indexing fixtures remain in `test/memory-index.test.js`.
