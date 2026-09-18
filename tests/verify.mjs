import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('../src/index.ts', import.meta.url), 'utf8');
const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

assert.equal(pkg.version, '3.4.1');
assert.deepEqual(pkg.pi.extensions, ['./src/index.ts']);

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
