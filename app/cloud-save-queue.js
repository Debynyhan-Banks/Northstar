// Serialize writes from one browser and retain the newest local edit on failure.
export function createSaveQueue({ saveRows, isActive, onSaved, onFailure }) {
  let pending = {};
  let inFlight = null;

  function enqueue(key, row) { pending[key] = row; }
  function hasUnsaved() { return !!inFlight || Object.keys(pending).length > 0; }

  async function flush() {
    if (!isActive()) return false;
    while (inFlight) {
      if (!(await inFlight)) return false;
    }
    if (!isActive()) return false;
    if (!Object.keys(pending).length) return true;
    const batch = pending;
    pending = {};
    const operation = (async () => {
      try {
        await saveRows(Object.values(batch));
        onSaved(Object.keys(pending).length > 0);
        return true;
      } catch (error) {
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
  return { enqueue, flush, hasUnsaved };
}
