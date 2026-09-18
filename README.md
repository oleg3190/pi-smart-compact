# pi-smart-compact

Branch-scoped pinned memory for Pi with deterministic journal replay, hard context budgets, injection-resistant fact framing, and token-efficient context packing.

## 3.4.1

- Fixed the CI verification regex for optional chaining in context-cache checks.
- CI runs TypeScript validation before runtime tests and enables npm cache.
- Runtime coverage now verifies context-cache invalidation after checkpoint revision.

## 3.4.0

- Memoized context assembly by state revision. Unchanged context is reused across `context`, status, and tool-result paths.
- Linear-time compaction probing by accumulating serialized full/preview text.
- Exact runtime dependency pins.
- Runtime tests for duplicate detection, revision ordering, revoke/replay, snapshot replay, and hard context budgets.
- Strict TypeScript CI.

## Install

```bash
pi install git:github.com/oleg3190/pi-smart-compact
```

The package entry point is `./src/index.ts`.

Pinned facts are branch-scoped and persisted in Pi's session journal. Fact text is framed as untrusted quoted data in LLM-facing context.
