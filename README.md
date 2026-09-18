# pi-smart-compact

`smart-compact` is a Pi extension that keeps important project facts across context compaction and branch navigation.

## v3.3.1

v3.3.1 keeps the v3.3 token-efficiency changes and fixes the remaining hot-path inefficiency in context packing:

- Fact XML / index / preview strings are serialized once per context build and reused.
- The first priority-expansion pass performs an O(1) character-budget probe per fact instead of building a candidate string for every fact.
- The old 8-iteration fixed-point loop remains removed.
- The hard `CONTEXT_TOTAL_CHARS` invariant is unchanged.
- Compaction rendering reuses cached serialized fact strings within each compaction build.

## Install

Install this repository as a Pi package, or clone it and point Pi at `src/index.ts`.

For a local clone:

```bash
npm install
pi -e ./src/index.ts
```

For package installation, Pi reads the `pi.extensions` entry from `package.json`.

## Tools

- `checkpoint` — persist an important fact.
- `checkpoint_revise` — replace an existing fact while keeping its id stable.
- `checkpoint_forget` — revoke a fact by id.
- `/checkpoints` — inspect active facts.
- `/checkpoint-forget <id>` — revoke from the command line.
- `/checkpoint-compact-journal` — compact the event journal into a snapshot.

## Notes

Persisted fact text is framed as quoted data and is not treated as instructions. Facts are branch-scoped and replayed deterministically from the journal.