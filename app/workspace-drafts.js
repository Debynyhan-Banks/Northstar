// Local recovery is deliberately namespaced by account, workspace and seat.
// These are private working drafts; they are not partner confirmations.
export function draftScope({ userId, workspaceId, seat, demo = false }) {
  if (!seat || (!demo && (!userId || !workspaceId))) return null;
  return `${demo ? 'preview' : 'cloud'}:${encodeURIComponent(userId || 'demo')}::${encodeURIComponent(workspaceId || 'local')}::${encodeURIComponent(seat)}`;
}

export function createDraftStore(storage, scope) {
  const prefix = scope ? `cf-growth-recovery-v2:${scope}:` : null;
  const key = id => prefix && prefix + encodeURIComponent(id);
  function read(id) {
    if (!prefix) return null;
    try {
      const item = JSON.parse(storage.getItem(key(id)) || 'null');
      return item?.scope === scope ? item.value : null;
    } catch { return null; }
  }
  function write(id, value) {
    if (!prefix) return false;
    try { storage.setItem(key(id), JSON.stringify({ scope, value })); return true; }
    catch { return false; }
  }
  function remove(id) { if (prefix) { try { storage.removeItem(key(id)); } catch { /* Retain current in-memory work. */ } } }
  return { read, write, remove };
}

export function recoverableRows(value, { workspaceId, userId, seat }) {
  if (!Array.isArray(value)) return [];
  return value.filter(row => row && row.workspace_id === workspaceId && typeof row.category === 'string' && typeof row.object_id === 'string' && row.body && typeof row.body === 'object' &&
    (!['response', 'vote'].includes(row.category) || (row.object_id.startsWith(`${seat}:`) && row.body.seat === seat && row.body.respondent_uid === userId)));
}

// Recovery after a reload requires a deliberate comparison with current server
// records. Never enqueue recovered writes, even when their scope is valid.
export function restoreForReview({ queue, storedRows, identity }) {
  queue.reset();
  return recoverableRows(storedRows, identity).map(row => structuredClone(row));
}

export function recoverySnapshot(recoveredRows, pendingRows) {
  const rows = new Map(recoveredRows.map(row => [`${row.category}|${row.object_id}`, row]));
  for (const row of pendingRows) rows.set(`${row.category}|${row.object_id}`, row);
  return [...rows.values()];
}

export function resumeQuestionId(questions, savedId, responseFor, isAnswered) {
  if (questions.some(q => q.id === savedId)) return savedId;
  return questions.find(q => !isAnswered(responseFor(q.id)))?.id || questions[0]?.id || '';
}
