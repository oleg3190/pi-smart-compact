import assert from "node:assert/strict";
import smartCompact from "../src/index.ts";

function makeHarness(initialEntries = [], appendMode = "normal", hasUI = false) {
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
    sessionManager: {
      getBranch: () => branch,
      getSessionFile: () => "runtime-test",
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
