# Changelog

## 3.4.2 — 2026-09-18
- Added deterministic effectiveness benchmark for pressure compression, priority recall, stale/revoke exclusion, branch isolation, adversarial framing, and snapshot replay.
- CI now executes `npm run bench` and enforces objective packing/reliability thresholds.

### Reliability
- Made persisted-event reason validation non-throwing for malformed journal data.
- Enforced V3 snapshot active-fact count/size limits and canonical uniqueness.
- Added runtime coverage for post-persistence and pre-persistence append failures.


## 3.4.1 — 2026-09-18

### Reliability
- Fixed implementation verification for optional-chaining context-cache memoization.
- Fixed Pi tool-result typing: invalid IDs now return the required `details` payload for `checkpoint_revise` and `checkpoint_forget`.
- Added runtime coverage for cache invalidation after revision and invalid-ID result contracts.

### CI
- Runs strict TypeScript validation before runtime tests.
- Removed npm cache configuration because the repository intentionally has no `package-lock.json`.

## 3.4.0 — 2026-09-18

### Performance
- Added state-revision memoization for context assembly.
- Removed repeated prefix reconstruction from compaction probes.

### Reliability
- Added runtime replay/snapshot/duplicate/stale-revision tests.
- Added a 50-fact hard context-budget stress test.
- Pinned runtime and development dependency versions.

### CI
- Fixed the initial workflow failure caused by npm cache configuration without a lockfile.
- CI now performs a real install, runtime tests, and strict TypeScript checking.

## 3.3.1
- Precomputed serialized fact strings during context packing.
- Removed the old fixed-point candidate loop.
- Reduced LLM-facing context framing overhead.
