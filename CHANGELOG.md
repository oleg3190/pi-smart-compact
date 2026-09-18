# Changelog

## 3.3.1

### Performance

- Precompute fact XML, compact index lines, and hot-fact preview lines once per `context` build.
- Replace the first-pass candidate-string probe with an O(1) character-budget calculation per fact.
- Keep the exact hard character budget and priority ordering unchanged.
- Reuse cached serialized representations while building compaction instructions.

### Correctness

- Fix strict-TypeScript inference in the localization helper by explicitly typing the mutable message as `string`.

### Preserved from 3.3.0

- Compact fact XML (`p`, optional `hot`, no `updated`, inline text).
- Removal of the old 8-iteration fixed-point loop.
- Concise context security warning.
- Date-free context index lines.
- Tool-named `promptGuidelines`.
- Concise compaction header.