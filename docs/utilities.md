# Local file utilities

`src/main/utilities.js` implements original, local file operations for Scribble's command workspace. It consumes caller-selected absolute paths and returns `{ output, details }`. It never runs a script found in an input file, sends data to an AI service, or requires paid APIs.

```js
const { performUtility } = require('./src/main/utilities');
await performUtility({
  operation: 'image-convert',
  files: ['/absolute/path/photo.png'],
  output: '/absolute/path/photo.webp',
  options: { width: 1200, quality: 80 }
});
```

| Operation | Inputs | Options |
| --- | --- | --- |
| `image-convert` | One image | `format`: jpg/png/webp (or output extension), width, height, quality 1–100, enlarge, background for JPEG transparency, palette for PNG, lossless for WebP |
| `audio-convert` | One audio/video file | `format`: wav/mp3/m4a/opus, bitrate such as 192k, sampleRate 8000–192000, mono, normalize, start/duration in seconds |
| `video-convert` | One video | `format`: mp4/webm, width, crf 0–51, bitrate for audio, removeAudio, start/duration in seconds |
| `pdf-merge` | One or more PDFs, in order | Preserves existing page content and page sizes |
| `archive-create` / `zip` | Files and/or directories | Preserves nested paths under each input's basename |
| `archive-extract` / `unzip` | One ZIP | Output must be a new directory |
| `config-convert` | One UTF-8 JSON/YAML/TOML file | `from`: input format override, `format`: destination format override; otherwise extensions determine formats |
| `markdown-pdf` | One UTF-8 Markdown file | `fontPath`: optional absolute TTF/OTF font path |
| `text-markdown` | One UTF-8 text file | Writes the original text as Markdown |

Output never replaces an input, its hard link, or an input directory's descendant, including through a linked parent directory. Existing output files require the explicit boolean `options.overwrite: true`. Existing output directories are never merged or replaced. Each conversion writes a temporary sibling and publishes the result only after success; failed operations remove temporary files. Without overwrite, publishing uses an exclusive filesystem link so a concurrent existing file is preserved.

Media decoding/encoding uses the bundled FFmpeg executable and fixed argument arrays. User strings never become shell commands. Packaged Electron apps use the actual `app.asar.unpacked` executable. MP4 uses H.264/AAC, WebM uses VP9/Opus, M4A uses AAC, and WAV uses PCM. The optional audio normalization filter targets -16 LUFS. Images use Sharp, respect orientation, preserve aspect ratio within requested dimensions, and avoid enlargement unless requested. Different content can produce different compression ratios; quality controls are encoding choices, not a guaranteed file-size reduction.

ZIP creation and extraction are bounded to 10,000 entries and 512 MB total input/expanded content. Extraction rejects absolute paths, backslashes, traversal, duplicate paths, symbolic links, special files, encrypted archives, unsupported compression methods, and extreme compression ratios. Deflate is expanded with a bounded output length, then exact size and CRC-32 are checked before files are written. Archives never receive executable permissions from archive metadata. Creation rejects input symbolic links and special files. These checks are verified with actual malicious archive fixtures.

Configuration conversion parses data without evaluation. YAML aliases are limited, and configuration/text inputs are bounded to 16 MB. Formats have different data models; a value that cannot be represented in TOML produces a conversion error rather than silently flattening its structure.

Markdown PDF export renders headings, paragraphs, lists as text, basic emphasis, and link labels/URLs, with wrapping and pagination. Embedded images, HTML, interactive links, and table layout are not rendered. Unicode text uses a real caller-selected font; on macOS the installed Arial Unicode font is selected automatically when available. The font must cover the requested characters. Standard Helvetica handles basic Latin text; unsupported characters produce an explicit error when no appropriate font is available. Fonts are embedded/subset with `pdf-lib` and `@pdf-lib/fontkit`.

Tests: `node --test tests/utilities.test.js`. Verified with real synthetic PNG/JPEG/WebP conversions, audio encoding and re-decoding in all four formats, MP4/WebM encoding, PDF page merging, Unicode Markdown PDF creation, JSON→YAML→TOML→JSON round trip, nested ZIP extraction, malicious ZIP rejection, linked-path protection and explicit-overwrite behavior.

## Literal file commands and palette extraction

`parseFileCommand(text)` from `src/main/file-command.js` returns `{operation,options}` for recognized literal intents, otherwise `null`. It supports explicit JPG/PNG/WebP, WAV/MP3/M4A/Opus, MP4/WebM, and JSON/YAML/TOML conversion; image compression; PDF merge; ZIP/unzip; text-to-Markdown; Markdown-to-PDF; and image palette extraction. The caller asks the user to select input/output paths and then runs `performUtility`; parser text never supplies executable commands or shell arguments. Unsupported or compound requests fall back to the caller's usual handling. No model call is needed for these recognized actions.

`image-palette` samples at most 128×128 pixels using Sharp, excludes mostly transparent pixels, groups RGB values into bins of width 32, and averages the most populated bins. `options.colors` accepts 1–16 (default 6). Output is a JSON file with dominant RGB/hex colors, proportions relative to all visible sampled pixels, sampling dimensions, and method. It is an approximate dominant palette; selected proportions may sum to less than one when omitted bins contain other colors. A fully transparent image fails explicitly. A real fixture with 75% red and 25% blue verifies both returned colors and proportions.

`image-compress` reuses the actual image encoder (default quality 75). Details report input/output bytes, `reduced`, and nonnegative `savedBytes`. Re-encoding can increase size; such output includes a notice and `reduced:false`, rather than claiming compression succeeded. A tiny PNG-to-JPEG fixture verifies that larger outputs are reported honestly. All existing output safety checks and explicit overwrite requirements apply to both operations.
