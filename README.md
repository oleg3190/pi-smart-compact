# pi-smart-compact

Branch-scoped pinned memory for Pi with deterministic journal replay, hard context budgets, injection-resistant fact framing, and token-efficient context packing.

## 3.6.0

- Added per-session runtime activation: `/smart-compact on|off|status`.
- Added fixed-model dialogue quality analysis via `npm run bench:dialog`.
- Added `PI_SMART_COMPACT=on` for agent/process-level startup activation.
- Global installation no longer implies active smart-compact behavior.

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

The package is intended to be installed globally. After installation, smart-compact is **disabled by default** unless `PI_SMART_COMPACT=on` (or `1`/`true`) is set. In an interactive session use `/smart-compact on`, `/smart-compact off`, or `/smart-compact status`.

For a dedicated agent/sub-agent, launch Pi with `PI_SMART_COMPACT=on`. For a clean agent, omit the variable and leave the extension installed but inactive.

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

The deterministic benchmark intentionally does not call an external LLM in CI. For real dialogue quality analysis use the fixed-model evaluator:

```bash
npm run bench:dialog -- --dialog ./dialog.jsonl --model anthropic/claude-sonnet-4-5
```

Pass `--compact-context` and `--baseline-context` to compare task-relevant context preservation. Each report records the exact provider/model/thinking level, evaluator version, token usage, cost when reported, latency, and per-metric scores. `PI_BENCH_MODEL`, `PI_BENCH_PROVIDER`, and `PI_BENCH_THINKING` can pin the evaluator configuration for reproducible runs.
