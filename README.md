# pi-smart-compact

Branch-scoped pinned memory for Pi with deterministic journal replay, hard context budgets, injection-resistant fact framing, and token-efficient context packing.

## 3.4.2

- Hardened replay validation against malformed oversized audit reasons.
- Enforced active-fact limits and canonical uniqueness on V3 snapshots.
- Added runtime coverage for append-entry recovery and invalid journal payloads.
- CI runs TypeScript validation before runtime tests.

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

## Effectiveness benchmark

Run the deterministic packing benchmark with:

```bash
npm run bench
```

The benchmark compares the production context handler with an unbounded full-fact baseline and verifies:
- pressure compression;
- full recall of high-priority facts;
- stale/revoked fact exclusion;
- branch isolation;
- untrusted-data framing;
- snapshot replay equivalence;
- the hard 10,000-character context budget.

CI requires at least 15% weighted token reduction on the pressure scenarios while keeping required-fact recall at 100%, stale leakage at 0%, and replay/context-budget checks green.

The benchmark intentionally does not call an external LLM in CI. Model-level task success should be measured separately with the same scenarios once a fixed model/evaluation endpoint is available.
