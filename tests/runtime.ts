import assert from "node:assert/strict";
import smartCompact from "../src/index.ts";

function makeHarness(initialEntries = []) {
  const handlers = new Map();
  const tools = new Map();
  const commands = new Map();
  const branch = [...initialEntries];

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
      branch.push({ type: "custom", customType, data });
    },
  };

  smartCompact(pi);

  const ctx = {
    hasUI: false,
    sessionManager: {
      getBranch: () => branch,
      getSessionFile: () => "runtime-test",
    },
    ui: {
      setStatus() {},
      notify() {},
      confirm: async () => true,
    },
  };

  return { handlers, tools, commands, branch, ctx };
}

async function start(h) {
  await h.handlers.get("session_start")?.({ reason: "startup" }, h.ctx);
}

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

const first = makeHarness();
await start(first);

const added = await checkpoint(first, {
  type: "decision",
  fact: "Use Postgres transactions for durable writes.",
  hot: true,
  priority: 95,
});
const firstId = added.details.id;
assert.match(firstId, /^cf_/);

await revise(first, {
  id: firstId,
  fact: "Use Postgres transactions with SERIALIZABLE isolation for durable writes.",
  reason: "Isolation requirement clarified",
});

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
const staleReplay = makeHarness([addEvent, rev3, rev2]);
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
