import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('../src/index.ts', import.meta.url), 'utf8');
const benchSource = fs.readFileSync(new URL('../bench/analyze-dialog.mjs', import.meta.url), 'utf8');
const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

assert.equal(pkg.version, '3.9.0');
assert.match(source, /const initialRuntimeEnabled = \/\^\(1\|true\|on\)\$\/i\.test\(process\.env\.PI_SMART_COMPACT/);
assert.match(source, /let enabled = initialRuntimeEnabled;/);
assert.match(source, /pi\.registerCommand\("smart-compact"/);
assert.match(source, /Usage: \/smart-compact \[on\|off\|status \[--json\]\]/);
assert.match(source, /const RUNTIME_STATUS_VERSION = "1.0.0"/);
assert.match(source, /contextApplications/);
assert.match(source, /compactionGuidanceApplications/);
assert.match(source, /status --json/);
assert.match(source, /--runtime-status/);
assert.match(source, /compressionAudit/);
assert.match(source, /priorityWeightedRecall/);
assert.match(source, /estimatedTokensSaved/);
assert.match(source, /recommendations/);
assert.match(source, /counterfactual/);
assert.match(benchSource, /COUNTERFACTUAL_REPLAY_VERSION/);
assert.match(benchSource, /REPLAY_SYSTEM_PROMPT/);
assert.match(benchSource, /PI_REPLAY_MODEL/);
assert.match(source, /if \(!enabled\) return \{/);
assert.deepEqual(pkg.pi.extensions, ['./src/index.ts']);
assert.match(source, /pi\.registerCommand\("analyze-dialog"/);
assert.match(source, /Usage: \/analyze-dialog \| compact \[replay\] \| counterfactual/);
assert.match(source, /PI_BENCH_MODEL/);
assert.match(source, /SessionManager\.open/);
assert.match(source, /--compare-dialog/);

assert.match(source, /const formattedById = new Map<string, string>\(\)/);
assert.match(source, /let expandedSerializedChars = 0/);
assert.ok(source.includes('cachedContextBlock?.revision === stateRevision'));
assert.ok(source.includes('function getContextBlock()'));
assert.match(source, /const nextTotalChars = contextEnvelopeChars \+ nextExpandedSerializedChars/);
assert.doesNotMatch(source, /for \(let i = 0; i < 8/);
assert.doesNotMatch(source, /buildCandidate\(\[\.\.\.expanded, fact\], \[\]\)/);

assert.match(source, /function formatFactXML\(fact: PinnedFact\): string/);
assert.match(source, /const hotAttr = fact\.hot \? " hot" : ""/);
assert.match(source, /function formatCompactFactLine\(fact: PinnedFact\): string/);
assert.match(source, /Use checkpoint for exact technical facts/);
assert.match(source, /Pinned facts survive compaction/);

assert.doesNotMatch(source, /\[\.\.\.selectedFull\]/);
assert.doesNotMatch(source, /\[\.\.\.selectedPreview\]/);

console.log('verify: OK');
