# Microphone orders

Audio settings show the effective input after a device refresh. Change opens the connected-device picker with a live level meter. Selecting a microphone promotes it while preserving the existing order. Reorder ranking holds arrow, drag and removal changes in a draft until Done editing; Cancel discards them. Only disconnected entries can be removed. System default terminates the fallback chain.

Notes can inherit the global order (`null`), keep a separate copied list, or use system default (`[]`). Customize requires a known device scan. Use global asks before discarding the custom order. Capture receives the entire chain and tries inputs in order; permission denial stops acquisition rather than silently trying another microphone. Empty enumeration preserves existing rankings. Names are remembered within the running session; an unseen disconnected device can display its saved ID after relaunch.

Global storage accepts 32 ranked IDs plus its legacy fallback. A 33-candidate order is preserved through the fallback representation and meeting copies. Larger promotions are explicitly refused without truncating preferences. The picker releases preview streams, timers and audio contexts on close, navigation, device changes and shutdown; late acquisition cannot restore a closed preview.

Tests cover inherited/copied/empty meeting preferences, drafts, drag, disconnects, level updates, late streams and shutdown. Physical microphone selection, disconnect recovery and meter behavior remain unverified. Public behavior reference: [Vowen microphones](https://docs.vowen.ai/features/microphones).
