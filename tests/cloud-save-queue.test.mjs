import test from "node:test";
import assert from "node:assert/strict";
import { createSaveQueue } from "../app/cloud-save-queue.js";

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test("a failed save retains the newest edit to the same record", async () => {
  const first = deferred(), batches = [], failures = [];
  const queue = createSaveQueue({
    isActive: () => true,
    saveRows: async rows => { batches.push(rows); if (batches.length === 1) await first.promise; },
    onSaved: () => {}, onFailure: error => failures.push(error.message),
  });
  queue.enqueue("response", { value: "old" });
  const failedSave = queue.flush();
  queue.enqueue("response", { value: "new" });
  first.reject(new Error("offline"));
  assert.equal(await failedSave, false);
  assert.deepEqual(failures, ["offline"]);
  assert.equal(queue.hasUnsaved(), true);
  assert.equal(await queue.flush(), true);
  assert.deepEqual(batches[1], [{ value: "new" }]);
  assert.equal(queue.hasUnsaved(), false);
});

test("concurrent flushes serialize edits in order", async () => {
  const first = deferred(), batches = [];
  const queue = createSaveQueue({
    isActive: () => true,
    saveRows: async rows => { batches.push(rows); if (batches.length === 1) await first.promise; },
    onSaved: () => {}, onFailure: () => {},
  });
  queue.enqueue("task", { value: 1 });
  const initial = queue.flush();
  queue.enqueue("task", { value: 2 });
  const later = queue.flush();
  assert.equal(batches.length, 1);
  first.resolve();
  assert.equal(await initial, true);
  assert.equal(await later, true);
  assert.deepEqual(batches, [[{ value: 1 }], [{ value: 2 }]]);
  assert.equal(queue.hasUnsaved(), false);
});

test("recovery snapshots include an in-flight save and prefer newer edits", async () => {
  const first = deferred();
  const queue = createSaveQueue({ isActive: () => true, saveRows: () => first.promise, onSaved: () => {}, onFailure: () => {} });
  queue.enqueue('response', { value: 'initial' });
  const save = queue.flush();
  assert.deepEqual(queue.snapshot(), [{ value: 'initial' }]);
  queue.enqueue('response', { value: 'new draft' });
  assert.deepEqual(queue.snapshot(), [{ value: 'new draft' }]);
  first.resolve();
  await save;
  assert.deepEqual(queue.snapshot(), [{ value: 'new draft' }]);
});

test("resetting for another account prevents an old failure from replaying or reporting saved", async () => {
  const first = deferred(), notices = [];
  const queue = createSaveQueue({ isActive: () => true, saveRows: () => first.promise, onSaved: () => notices.push('saved'), onFailure: () => notices.push('failed') });
  queue.enqueue('previous', { account: 'previous' });
  const save = queue.flush();
  queue.reset();
  queue.enqueue('current', { account: 'current' });
  first.reject(new Error('old account offline'));
  assert.equal(await save, false);
  assert.deepEqual(queue.snapshot(), [{ account: 'current' }]);
  assert.deepEqual(notices, []);
});

test("acknowledged rows disappear from recovery before the saved notification", async () => {
  const seen = [];
  const queue = createSaveQueue({ isActive: () => true, saveRows: async () => {}, onSaved: () => seen.push(queue.snapshot()), onFailure: () => {} });
  queue.enqueue('answer', { value: 'yes' });
  assert.equal(await queue.flush(), true);
  assert.deepEqual(seen, [[]]);
});
