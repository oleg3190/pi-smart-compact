import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import smartCompact from "../src/index.ts";

function makeHarness(initialEntries = [], appendMode = "normal", hasUI = false, cwd = process.cwd(), model = {
  provider: "anthropic",
  id: "current-session-model",
  name: "Current Session Model",
}, sessionFile = join(cwd, "parent.jsonl"), sessionDir = cwd) {
  const handlers = new Map();
  const tools = new Map();
  const commands = new Map();
  const branch = [...initialEntries];
  const notifications = [];
  const statuses = [];

  const pi = {
    on(name, handler) {
      handlers.set(name, handler);
    },
    registerTool(definition) {
      tools.set(definition.name, definition);
    },
    registerCommand(name, definition) {
      commands.set(name, definition);
    },
    appendEntry(customType, data) {
      if (appendMode === "throw-before-persist") {
        throw new Error("append failure before persistence");
      }
      branch.push({ type: "custom", customType, data });
      if (appendMode === "throw-after-persist") {
        throw new Error("append failure after persistence");
      }
    },
  };

  smartCompact(pi);

  const ctx = {
    hasUI,
    cwd,
    isIdle: () => true,
    waitForIdle: async () => {},
    model,
    sessionManager: {
      getBranch: () => branch,
      getSessionFile: () => sessionFile,
      getSessionDir: () => sessionDir,
    },
    ui: {
      setStatus(_id, text) {
        statuses.push(text);
      },
      notify(text, type) {
        notifications.push({ text, type });
      },
      confirm: async () => true,
    },
  };

  return { handlers, tools, commands, branch, ctx, notifications, statuses };
}

async function start(h, enabled = true) {
  if (enabled) await h.commands.get("smart-compact")?.handler("on", h.ctx);
  await h.handlers.get("session_start")?.({ reason: "startup" }, h.ctx);
}

const malformedReason = makeHarness([
  {
    type: "custom",
    customType: "smart-compact-pinned-event",
    data: {
      version: 3,
      op: "revoke",
      id: "cf_bad_reason",
      at: Date.now(),
      reason: "x".repeat(501),
    },
  },
]);
await assert.doesNotReject(() => start(malformedReason));
const malformedList = await list(malformedReason);
assert.match(malformedList.content[0].text, /Pinned facts not found\./);

const recoveredAfterPersist = makeHarness([], "throw-after-persist");
await start(recoveredAfterPersist);
const recovered = await checkpoint(recoveredAfterPersist, {
  type: "finding",
  fact: "Persisted despite append error.",
});
assert.ok(recovered.details.id);
assert.equal(recoveredAfterPersist.branch.length, 1);
const recoveredList = await list(recoveredAfterPersist, { includeText: true });
assert.match(recoveredList.content[0].text, /Persisted despite append error\./);

const failedBeforePersist = makeHarness([], "throw-before-persist");
await start(failedBeforePersist);
await assert.rejects(
  () => checkpoint(failedBeforePersist, {
    type: "finding",
    fact: "Must not appear after failed persistence.",
  }),
  /append failure before persistence/,
);
const failedList = await list(failedBeforePersist);
assert.match(failedList.content[0].text, /Pinned facts not found\./);

function tool(h, name) {
  const definition = h.tools.get(name);
  assert.ok(definition, "missing tool " + name);
  return definition;
}

async function checkpoint(h, params) {
  return tool(h, "checkpoint").execute("test", params, undefined, undefined, h.ctx);
}

async function revise(h, params) {
  return tool(h, "checkpoint_revise").execute("test", params, undefined, undefined, h.ctx);
}

async function forget(h, params) {
  return tool(h, "checkpoint_forget").execute("test", params, undefined, undefined, h.ctx);
}

async function list(h, params = {}) {
  return tool(h, "checkpoint_list").execute("test", params, undefined, undefined, h.ctx);
}

const envDir = await mkdtemp(join(tmpdir(), "pi-smart-compact-env-test-"));
const savedBenchModelForEnvTest = process.env.PI_BENCH_MODEL;
const savedBenchProviderForEnvTest = process.env.PI_BENCH_PROVIDER;
try {
  delete process.env.PI_BENCH_MODEL;
  delete process.env.PI_BENCH_PROVIDER;
  await writeFile(
    join(envDir, ".env"),
    "PI_BENCH_MODEL=anthropic/from-project-dotenv\nPI_BENCH_THINKING=low\n",
    "utf8",
  );
  const envHarness = makeHarness([], "normal", true, envDir, null);
  await envHarness.commands.get("analyze-dialog")?.handler("status", envHarness.ctx);
  assert.match(envHarness.notifications.at(-1).text, /analysis model: anthropic\/from-project-dotenv \(\.env\)/);
  assert.match(envHarness.notifications.at(-1).text, /replay thinking: low/);
  await envHarness.commands.get("analyze-dialog")?.handler("status --json", envHarness.ctx);
  const envStatus = JSON.parse(envHarness.notifications.at(-1).text);
  assert.equal(envStatus.evaluator.configured, true);
  assert.equal(envStatus.evaluator.modelId, "from-project-dotenv");
  assert.equal(envStatus.evaluator.source, ".env");
} finally {
  if (savedBenchModelForEnvTest === undefined) delete process.env.PI_BENCH_MODEL; else process.env.PI_BENCH_MODEL = savedBenchModelForEnvTest;
  if (savedBenchProviderForEnvTest === undefined) delete process.env.PI_BENCH_PROVIDER; else process.env.PI_BENCH_PROVIDER = savedBenchProviderForEnvTest;
  await rm(envDir, { recursive: true, force: true });
}

const analyzeStatus = makeHarness([], "normal", true);
const savedBenchModel = process.env.PI_BENCH_MODEL;
const savedBenchProvider = process.env.PI_BENCH_PROVIDER;
const savedReplayModel = process.env.PI_REPLAY_MODEL;
const savedReplayProvider = process.env.PI_REPLAY_PROVIDER;
delete process.env.PI_BENCH_MODEL;
delete process.env.PI_BENCH_PROVIDER;
delete process.env.PI_REPLAY_MODEL;
delete process.env.PI_REPLAY_PROVIDER;
await analyzeStatus.commands.get("analyze-dialog")?.handler("status", analyzeStatus.ctx);
assert.match(analyzeStatus.notifications.at(-1).text, /analysis model: anthropic\/current-session-model \(current-session\)/);
assert.match(analyzeStatus.notifications.at(-1).text, /replay target: anthropic\/current-session-model/);
await analyzeStatus.commands.get("analyze-dialog")?.handler("status --json", analyzeStatus.ctx);
const analyzeStatusJson = JSON.parse(analyzeStatus.notifications.at(-1).text);
assert.equal(analyzeStatusJson.evaluator.configured, true);
assert.equal(analyzeStatusJson.replay.source, "current-session");
assert.equal(analyzeStatusJson.currentSessionModel.provider, "anthropic");
assert.equal(analyzeStatusJson.currentSessionModel.modelId, "current-session-model");
assert.equal(analyzeStatusJson.evaluator.source, "current-session");
if (savedBenchModel === undefined) delete process.env.PI_BENCH_MODEL; else process.env.PI_BENCH_MODEL = savedBenchModel;
if (savedBenchProvider === undefined) delete process.env.PI_BENCH_PROVIDER; else process.env.PI_BENCH_PROVIDER = savedBenchProvider;
if (savedReplayModel === undefined) delete process.env.PI_REPLAY_MODEL; else process.env.PI_REPLAY_MODEL = savedReplayModel;
if (savedReplayProvider === undefined) delete process.env.PI_REPLAY_PROVIDER; else process.env.PI_REPLAY_PROVIDER = savedReplayProvider;

const subagentDir = await mkdtemp(join(tmpdir(), "pi-smart-compact-subagents-test-"));
const parentSessionFile = join(subagentDir, "parent.jsonl");
const childSessionFile = join(subagentDir, "child.jsonl");
const unrelatedSessionFile = join(subagentDir, "unrelated.jsonl");
try {
  await writeFile(parentSessionFile, JSON.stringify({
    type: "session",
    version: 3,
    id: "parent-session",
    timestamp: "2026-09-20T00:00:00.000Z",
    cwd: subagentDir,
  }) + "\n", "utf8");
  await writeFile(childSessionFile, [
    JSON.stringify({
      type: "session",
      version: 3,
      id: "child-session",
      timestamp: "2026-09-20T00:01:00.000Z",
      cwd: subagentDir,
      parentSession: parentSessionFile,
    }),
    JSON.stringify({
      type: "message",
      id: "child-user",
      parentId: null,
      timestamp: "2026-09-20T00:01:01.000Z",
      message: { role: "user", content: "Child task" },
    }),
  ].join("\n") + "\n", "utf8");
  await writeFile(unrelatedSessionFile, JSON.stringify({
    type: "session",
    version: 3,
    id: "unrelated-session",
    timestamp: "2026-09-20T00:02:00.000Z",
    cwd: subagentDir,
  }) + "\n", "utf8");

  const subagentHarness = makeHarness(
    [],
    "normal",
    true,
    subagentDir,
    { provider: "anthropic", id: "current-session-model", name: "Current Session Model" },
    parentSessionFile,
    subagentDir,
  );
  await subagentHarness.commands.get("analyze-dialog")?.handler("subagents", subagentHarness.ctx);
  assert.match(subagentHarness.notifications.at(-1).text, /child-session/);
  assert.doesNotMatch(subagentHarness.notifications.at(-1).text, /unrelated-session/);
  await subagentHarness.commands.get("analyze-dialog")?.handler("subagent child-session", subagentHarness.ctx);
  assert.match(subagentHarness.notifications.at(-1).text, /Current Pi session has no dialogue messages yet\.|dialogue analysis failed:/);
} finally {
  await rm(subagentDir, { recursive: true, force: true });
}

const runtime = makeHarness([], "normal", true);
await start(runtime);
await runtime.commands.get("smart-compact")?.handler("status --json", runtime.ctx);
let runtimeStatus = JSON.parse(runtime.notifications.at(-1).text);
assert.equal(runtimeStatus.enabled, true);
assert.equal(runtimeStatus.runtimeActive, true);
assert.equal(runtimeStatus.activationSource, "command");
assert.equal(runtimeStatus.contextApplied, false);
assert.equal(runtimeStatus.contextApplications, 0);

await checkpoint(runtime, {
  type: "finding",
  fact: "Runtime telemetry test fact must be present in applied context.",
});

const runtimeContext = runtime.handlers.get("context")({ messages: [] }, runtime.ctx);
assert.ok(runtimeContext?.messages?.[0]?.content);
await runtime.handlers.get("session_before_compact")?.({ customInstructions: "", willRetry: false }, runtime.ctx);
await runtime.commands.get("smart-compact")?.handler("status --json", runtime.ctx);
runtimeStatus = JSON.parse(runtime.notifications.at(-1).text);
assert.equal(runtimeStatus.contextApplied, true);
assert.equal(runtimeStatus.contextApplications, 1);
assert.equal(runtimeStatus.compactionGuidanceApplied, true);
assert.equal(runtimeStatus.compactionGuidanceApplications, 1);
assert.equal(runtimeStatus.contextCost.totalChars, runtimeContext.messages[0].content.length);

await runtime.commands.get("smart-compact")?.handler("off", runtime.ctx);
await runtime.commands.get("smart-compact")?.handler("status --json", runtime.ctx);
runtimeStatus = JSON.parse(runtime.notifications.at(-1).text);
assert.equal(runtimeStatus.enabled, false);
assert.equal(runtimeStatus.runtimeActive, false);
assert.equal(runtimeStatus.contextApplied, true);

const bareEnable = makeHarness([], "normal", true);
await start(bareEnable, false);
await bareEnable.commands.get("smart-compact")?.handler("", bareEnable.ctx);
assert.match(bareEnable.notifications.at(-1).text, /enabled/i);
assert.ok(bareEnable.commands.get("smart-compact"));

await checkpoint(bareEnable, {
  type: "finding",
  fact: "Bare command enable test fact.",
});
assert.ok(bareEnable.handlers.get("context")({ messages: [] }, bareEnable.ctx));

const disabled = makeHarness();
await start(disabled, false);
assert.equal(disabled.handlers.get("context")({ messages: [] }, disabled.ctx), undefined);
const disabledAdd = await checkpoint(disabled, {
  type: "finding",
  fact: "Disabled mode must not mutate state.",
});
assert.match(disabledAdd.content[0].text, /smart-compact is disabled for this session/);
assert.equal(disabled.branch.length, 0);

const toggled = makeHarness();
await start(toggled);
const toggledAdd = await checkpoint(toggled, {
  type: "finding",
  fact: "Toggle state must survive disable/enable through durable replay.",
});
assert.ok(toggledAdd.details.id);
await toggled.commands.get("smart-compact")?.handler("off", toggled.ctx);
assert.equal(toggled.handlers.get("context")({ messages: [] }, toggled.ctx), undefined);
const offList = await list(toggled);
assert.match(offList.content[0].text, /smart-compact is disabled for this session/);
await toggled.commands.get("smart-compact")?.handler("on", toggled.ctx);
const onList = await list(toggled, { includeText: true });
assert.match(onList.content[0].text, /Toggle state must survive disable\/enable through durable replay\./);

const first = makeHarness();
await start(first);

const invalidRevision = await revise(first, { id: "bad-id", fact: "ignored" });
assert.equal(invalidRevision.details?.operation, "revise");
assert.equal(invalidRevision.details?.pinnedFactsCount, 0);

const invalidForget = await forget(first, { id: "bad-id" });
assert.equal(invalidForget.details?.operation, "forget");
assert.equal(invalidForget.details?.pinnedFactsCount, 0);

const added = await checkpoint(first, {
  type: "decision",
  fact: "Use Postgres transactions for durable writes.",
  hot: true,
  priority: 95,
});
const firstId = added.details.id;
assert.match(firstId, /^cf_/);

const contextBeforeRevision = first.handlers.get("context")({ messages: [] }, first.ctx);
assert.ok(contextBeforeRevision?.messages?.[0]?.content);
assert.match(contextBeforeRevision.messages[0].content, /Use Postgres transactions for durable writes/);

await revise(first, {
  id: firstId,
  fact: "Use Postgres transactions with SERIALIZABLE isolation for durable writes.",
  reason: "Isolation requirement clarified",
});

const contextAfterRevision = first.handlers.get("context")({ messages: [] }, first.ctx);
assert.ok(contextAfterRevision?.messages?.[0]?.content);
assert.match(contextAfterRevision.messages[0].content, /SERIALIZABLE isolation/);
assert.doesNotMatch(contextAfterRevision.messages[0].content, /<fact[^>]*>Use Postgres transactions for durable writes\.<\/fact>/);

const duplicate = await checkpoint(first, {
  type: "decision",
  fact: "Use Postgres transactions with SERIALIZABLE isolation for durable writes.",
});
assert.equal(duplicate.details.duplicate, true);

await forget(first, { id: firstId, reason: "No longer required" });

const replay = makeHarness(first.branch);
await start(replay);
const replayList = await list(replay);
assert.match(replayList.content[0].text, /Pinned facts not found\./);

const snapshotCommand = replay.commands.get("checkpoint-compact-journal");
assert.ok(snapshotCommand);
await snapshotCommand.handler("", replay.ctx);
assert.equal(replay.branch.at(-1).data.op, "snapshot");

const snapshotReplay = makeHarness(replay.branch);
await start(snapshotReplay);
const snapshotList = await list(snapshotReplay);
assert.match(snapshotList.content[0].text, /Pinned facts not found\./);

const revisionHarness = makeHarness();
await start(revisionHarness);
const revAdded = await checkpoint(revisionHarness, {
  type: "finding",
  fact: "Revision baseline",
});
const revId = revAdded.details.id;
await revise(revisionHarness, { id: revId, fact: "Revision two" });
await revise(revisionHarness, { id: revId, fact: "Revision three" });

const durableEvents = revisionHarness.branch.filter(
  (entry) => entry.type === "custom" && entry.customType === "smart-compact-pinned-event",
);
assert.equal(durableEvents.length, 3);
const addEvent = durableEvents[0];
const rev2 = durableEvents[1];
const rev3 = durableEvents[2];
const staleReplay = makeHarness([addEvent, rev2, rev3, rev2]);
await start(staleReplay);
const staleList = await list(staleReplay, { includeText: true });
assert.match(staleList.content[0].text, /Revision three/);
assert.doesNotMatch(staleList.content[0].text, /Revision two/);

const budgetHarness = makeHarness();
await start(budgetHarness);
for (let i = 0; i < 50; i++) {
  await checkpoint(budgetHarness, {
    type: "finding",
    fact: "Fact " + i + ": " + "x".repeat(140),
    priority: i,
  });
}
const contextResult = budgetHarness.handlers.get("context")({ messages: [] }, budgetHarness.ctx);
assert.ok(contextResult?.messages?.[0]?.content);
assert.ok(contextResult.messages[0].content.length <= 10_000);

console.log("runtime: OK");
