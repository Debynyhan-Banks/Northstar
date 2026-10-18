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
