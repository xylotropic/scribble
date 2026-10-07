# Local file tools

Selected file transformations produce one output beside each original, preserving selection enumeration order. Up to 32 inputs are supported. The same behavior applies to multiple files chosen manually; a single manually chosen file retains its destination dialog. PDF merging and ZIP creation keep one combined output dialog. ZIP extraction gives each archive its own adjacent folder.

Before processing, the batch checks every input's identity and known size limit, every output name and parent, and existing names including case-equivalent aliases. Sources and destinations are checked again before each operation. Existing outputs are refused. Same-format conversions use `-converted`; compression uses `-compressed`. Failures stop subsequent items and report completed, failed and skipped paths. Cancellation preserves files already written and reports them. Files can still change during underlying utility reads; this is not an atomic filesystem snapshot.

| Tool | Verified output formats |
| --- | --- |
| Image conversion | PNG, JPG/JPEG, WebP, AVIF, GIF, TIFF, HEIC, HEIF, JFIF |
| Audio conversion | MP3, WAV, AAC, FLAC, OGG, M4A, WMA, Opus |
| Video conversion | MP4, AVI, MOV, MKV, WebM, FLV, WMV |
| Config conversion | JSON, YAML, TOML, XML |

Image compression preserves the source format and defaults to quality 80. It reports when re-encoding does not reduce size. Speak “compress these images to 70 percent” to set quality. HEIC and HEIF use genuine HEVC image data through an original macOS ImageIO helper, for reading and writing; AVIF is not renamed to HEIC. JFIF has its required APP0 header. GIF and WebP can preserve animated input; other outputs refuse multi-frame input rather than silently discard frames. The native codec accepts one frame, up to 128 MiB input/output, 64 million pixels and 10000 pixels on either axis. Its input read is bounded and refuses links or changes during reading; output is verified before exclusive creation.

Bundled FFmpeg uses explicit codecs and containers. OGG uses the bundled experimental Vorbis encoder, which requires stereo; mono requests fail explicitly. Video selects the first video stream and optional first audio stream. Tests encode and decode generated two-second fixtures with FFmpeg error checking; these establish the tested codec paths, not arbitrary media compatibility or Intel runtime execution.

XML configuration data uses an original bounded parser with no external resource resolution. Ordinary XML becomes a `$xml` tree of element names, attributes and ordered children; text children use `{$text: ...}` records, so mixed content also round-trips through TOML. Comments and declarations are not configuration data. CDATA/entity spellings become character data with XML newline rules. JSON types and arbitrary keys use a typed XML namespace (`urn:scribble:config:v1`). `xmlTyped: true` forces typed encoding when a JSON object deliberately uses the reserved `$xml` wrapper. DTDs, custom entities and processing instructions are refused. Limits are 16 MiB, depth 64 and 100000 nodes. Fixtures verify XML through JSON, YAML and TOML and back, including mixed text, attributes, repeated elements, whitespace and Unicode.

Actual Finder selection, spoken operation, packaged Intel execution and desktop acceptance remain unverified. The public tool list also includes spoken editor/settings navigation, screen palettes and Markdown PDF style choices; this file does not claim those remaining behaviors are complete.

## Additional command and presentation support

Markdown PDF exports now accept `style: "github"` (default) or `style: "minimal"`; the utility UI and spoken command parser expose both choices. For example, “Turn this Markdown into a PDF, minimal styling” selects the minimal style. Command results display a sanitized Markdown preview while copy/insertion use the unchanged source text.

Editor and Settings commands have synthetic routing coverage. Screen palette commands have local sampling and cancellation coverage using generated frames, but actual screen capture is not accepted yet. Live desktop checks and combined-output default naming remain outstanding.
