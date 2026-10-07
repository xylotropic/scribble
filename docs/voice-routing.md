# Voice routing

Both dictation and command mode route saved voice shortcuts through the same bounded matcher. Exact triggers rank before filler-stripped triggers, then fuzzy matches with normalized Levenshtein similarity at least 0.75. Longer matched aliases rank first within a tier; custom shortcuts win equal-length ties against built-ins. Unicode word boundaries prevent exact prefix matches inside longer words. Built-in speech aliases are derived from canonical triggers, so saved profiles gain aliases without resetting enabled preferences.

Custom shortcuts can share a trigger with a built-in. Duplicate custom triggers remain rejected. Command mode tries saved shortcuts first; a recognized disabled or invalid shortcut family cannot reopen through the independent command parser. Independent syntax such as `launch Calculator` and `search for weather` remains available.

Website targets accept validated HTTP(S) URLs and bare hostnames, spoken `dot`, surrounding quotation marks and trailing sentence punctuation. Non-web schemes, credentials and empty/invalid addresses remain unresolved. Custom `{{text}}` substitutions are URI encoded. Common folders accept singular/plural names and optional `the`/`folder`, including Applications. OS folder-opening failures are surfaced rather than reported as success.

The matcher bounds input length, trigger length and candidate count. Unit and mocked main-action tests verify routing and failure behavior without opening apps or websites. Physical microphone, shortcut and insertion acceptance still requires an unlocked Mac and granted OS permissions. Per-shortcut browser profiles and multi-action sequences remain separate coverage gaps.
