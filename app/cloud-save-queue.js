// Serialize writes from one browser and retain the newest local edit on failure.
export function createSaveQueue({ saveRows, isActive, onSaved, onFailure }) {
  let pending = {};
  let inFlight = null;
  let activeBatch = {};
  let generation = 0;

  function enqueue(key, row) { pending[key] = row; }
  function hasUnsaved() { return !!inFlight || Object.keys(pending).length > 0; }
  function snapshot() { return Object.values({ ...activeBatch, ...pending }); }
  // A session change must never retry another account's rows. An old request can
  // finish, but its acknowledgements must not affect the newly selected account.
  function reset() { generation++; pending = {}; activeBatch = {}; inFlight = null; }

  async function flush() {
    const flushGeneration = generation;
    if (!isActive()) return false;
    while (inFlight) {
      if (!(await inFlight)) return false;
      if (generation !== flushGeneration) return false;
    }
    if (!isActive()) return false;
    if (!Object.keys(pending).length) return true;
    const batch = pending;
    pending = {};
    activeBatch = batch;
    const operationGeneration = generation;
    const operation = (async () => {
      try {
        await saveRows(Object.values(batch));
        if (generation !== operationGeneration) return false;
        activeBatch = {};
        onSaved(Object.keys(pending).length > 0);
        return true;
      } catch (error) {
        if (generation !== operationGeneration) return false;
        activeBatch = {};
        for (const [key, row] of Object.entries(batch)) {
          if (!pending[key]) pending[key] = row;
        }
        onFailure(error);
        return false;
      }
    })();
    inFlight = operation;
    const ok = await operation;
    if (inFlight === operation) inFlight = null;
    return ok;
  }
  return { enqueue, flush, hasUnsaved, snapshot, reset };
}
