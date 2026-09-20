# pi-smart-compact

## 3.9.1

- Added `/analyze-dialog status` and `/analyze-dialog status --json` so evaluator/replay model configuration is visible before a paid LLM run.
- `PI_BENCH_MODEL` remains the fixed semantic evaluator and is required for reproducible dialogue-quality scoring.
- Counterfactual replay now uses the current Pi session model by default; `PI_REPLAY_MODEL` / `PI_REPLAY_PROVIDER` still override the replay target.
- Missing evaluator configuration now produces an actionable error pointing to `/analyze-dialog status`.

## 3.9.0

- Added `/analyze-dialog counterfactual` (also `/analyze-dialog compact replay`) for paired baseline-vs-compact replay of the same final user task.
- Both arms use the same target model, thinking level, tool configuration, and task; only the context variant changes.
- Reports include actual reported input/output/total usage, latency, both generated answers, semantic quality deltas, and the evaluator's grounded comparison.
- The replay intentionally excludes the historical dialogue so the compact context is tested as a replacement for durable context, not as an extra hint layered on top of the original conversation.
- A single replay pair is an experimental estimate because model sampling may be nondeterministic.
- Set `PI_REPLAY_MODEL`, `PI_REPLAY_PROVIDER`, and `PI_REPLAY_THINKING` to use a target model/config different from the semantic evaluator.

## 3.8.0

- /analyze-dialog compact now emits a deterministic compression audit alongside the LLM evaluation.
- Reports include estimated token savings, compression ratio/reduction, hard-budget utilization, fact recall, priority-weighted recall, recall by priority tier, omitted fact IDs, index-only facts, contamination/redundancy proxies, and actionable recommendations.
- The report explicitly identifies the baseline as the active pinned-fact baseline; it is not the full historical model prompt.
- Estimated token counts remain heuristic unless the evaluator/model reports actual token usage.

## 3.7.2

- Bare `/smart-compact` now enables smart-compact for the current Pi session. Use `/smart-compact status` for diagnostics and `/smart-compact off` to disable it.

## 3.7.1

- Added structured runtime telemetry for `/smart-compact status` and `/smart-compact status --json`: activation source, actual context application count, compaction-guidance applications, and current context cost.
- `/analyze-dialog compact` now records runtime evidence so reports distinguish enabled runtime from context actually applied.

## 3.7.0

- Added `/analyze-dialog` for fixed-model dialogue quality analysis directly from Pi.
- Added `/analyze-dialog compact` to compare the current dialogue against the full active pinned-fact baseline and measure smart-compact context reduction.
- Added `/analyze-dialog compare previous` and `/analyze-dialog compare <session.jsonl>` to compare the current active branch with another Pi session.
- Comparison reports include independent per-metric scores, per-metric deltas, mean delta, and grounded narrative differences.
- Full JSON reports are persisted under the project Pi session directory in `dialog-analysis/`.

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

Pass `--compact-context` and `--baseline-context` to compare task-relevant context preservation. Each report records the exact provider/model/thinking level, evaluator version, token usage, cost when reported, latency, and per-metric scores. `PI_BENCH_MODEL`, `PI_BENCH_PROVIDER`, and `PI_BENCH_THINKING` pin the evaluator configuration for reproducible runs. In Pi, use `/analyze-dialog status` before a run to inspect the fixed evaluator and replay target. For counterfactual replay, the current Pi session model is used automatically unless `PI_REPLAY_MODEL` / `PI_REPLAY_PROVIDER` override it.
