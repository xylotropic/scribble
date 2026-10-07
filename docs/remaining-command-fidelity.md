# Remaining Command Mode fidelity checks

Primary public reference: https://docs.vowen.ai/ai-features/command-mode (captured October 7, 2026).

- The Timer section describes a floating countdown pill over other applications and a maximum duration of 24 hours. Current source countdowns appear in the workspace. Timer commands now enforce 24 hours separately from reminders, which retain their 30-day limit. The independent native pill still requires implementation and desktop acceptance.
- The public examples include “Set a 10 minute timer”. `domain.parseCommand` now recognizes this natural duration-before-timer example as well as “set a timer for 10 minutes”; focused parser and main-action boundary tests pass.
- The language section promises tool execution in every supported transcription language. Current deterministic file/system/domain parsers primarily recognize English patterns. Unrecognized instructions fall through to text generation, which does not prove that file, timer or system actions execute in other languages. A bounded, validated tool-selection path and multilingual action fixtures remain required. Text translation output alone is insufficient evidence.
- Combined selected outputs require adjacent defaults `merged.pdf` and `archive.zip`, plus explicit naming. The selected-source implementation now has generated PDF/ZIP and routing tests; publication and real Finder acceptance must follow.
- Source tests and fresh-package byte parity do not replace live microphone, global shortcut, insertion, Finder selection or screen capture acceptance. macOS permission authentication is currently waiting for the user. Microphone and Accessibility testing are authorized; Screen Recording testing remains unauthorized.
