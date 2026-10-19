import test from 'node:test';
import assert from 'node:assert/strict';
import { createDraftStore, draftScope, recoverableRows, restoreForReview, recoverySnapshot, resumeQuestionId } from '../app/workspace-drafts.js';
import { createSaveQueue } from '../app/cloud-save-queue.js';

function storage() { const map = new Map(); return { getItem: key => map.get(key) || null, setItem: (key, value) => map.set(key, value), removeItem: key => map.delete(key) }; }

test('reload recovery preserves blank amounts and values without crossing accounts, workspaces or seats', () => {
  const local = storage(), own = { userId: 'u1', workspaceId: 'w1', seat: 'growth' };
  const store = createDraftStore(local, draftScope(own)), value = { values: { budget: '', income: '0', answer: 'unfinished text', choices: ['one'] }, step: 2 };
  assert.equal(store.write('planning:segment:one', value), true);
  assert.deepEqual(createDraftStore(local, draftScope(own)).read('planning:segment:one'), value);
  for (const scope of [{ ...own, userId: 'u2' }, { ...own, workspaceId: 'w2' }, { ...own, seat: 'christian' }]) assert.equal(createDraftStore(local, draftScope(scope)).read('planning:segment:one'), null);
  assert.equal(createDraftStore(local, draftScope(own)).read('planning:segment:two'), null);
});

test('storage failure is reported and never masquerades as a saved draft', () => {
  const unavailable = { setItem() { throw new Error('full'); }, getItem() { throw new Error('blocked'); } };
  const store = createDraftStore(unavailable, draftScope({ userId: 'u', workspaceId: 'w', seat: 'growth' }));
  assert.equal(store.write('answer', 'text'), false);
  assert.equal(store.read('answer'), null);
  assert.equal(draftScope({ userId: 'u', seat: 'growth' }), null);
});

test('pending answer and vote recovery requires the exact account, workspace and own seat', () => {
  const own = { workspaceId: 'w', userId: 'u', seat: 'growth' }, good = { workspace_id: 'w', category: 'response', object_id: 'growth:q1', body: { seat: 'growth', respondent_uid: 'u', value: 'retained', answerStatus: 'draft' } };
  const rows = [good, { ...good, workspace_id: 'other' }, { ...good, body: { ...good.body, respondent_uid: 'other' } }, { ...good, object_id: 'christian:q1' }, { ...good, category: 'vote', body: { ...good.body, seat: 'christian' } }];
  assert.deepEqual(recoverableRows(rows, own), [good]);
  assert.deepEqual(recoverableRows(null, own), []);
});

test('resume chooses a valid stored question, otherwise the first unanswered applicable question', () => {
  const questions = [{ id: 'one' }, { id: 'two' }], response = id => ({ answerStatus: id === 'one' ? 'answered' : 'unknown' }), answered = row => row.answerStatus === 'answered';
  assert.equal(resumeQuestionId(questions, 'one', response, answered), 'one');
  assert.equal(resumeQuestionId(questions, 'other-seat-question', response, answered), 'two');
  assert.equal(resumeQuestionId([], 'one', response, answered), '');
});

test('reload recovery is review-only even when the pending record belongs to this account', async () => {
  const writes = [], queue = createSaveQueue({ isActive: () => true, saveRows: async rows => writes.push(rows), onSaved: () => {}, onFailure: () => {} });
  queue.enqueue('previous-session', { workspace_id: 'old' });
  const current = { category: 'response', object_id: 'growth:q1', body: { value: 'Newer answer from another device', answerStatus: 'answered' } };
  const serverRecords = { 'response|growth:q1': current }, before = structuredClone(serverRecords);
  const recovered = { workspace_id: 'w', category: 'response', object_id: 'growth:q1', body: { seat: 'growth', respondent_uid: 'u', value: 'Older unsaved text', answerStatus: 'draft' } };
  const review = restoreForReview({ queue, storedRows: [recovered], identity: { workspaceId: 'w', userId: 'u', seat: 'growth' } });
  assert.equal(review.length, 1);
  assert.equal(queue.hasUnsaved(), false);
  assert.deepEqual(queue.snapshot(), []);
  await queue.flush();
  assert.deepEqual(writes, []);
  assert.deepEqual(serverRecords, before);
  review[0].body.value = 'Changed only in recovery review';
  assert.equal(recovered.body.value, 'Older unsaved text');
  assert.equal(serverRecords['response|growth:q1'].body.value, 'Newer answer from another device');
});

test('checkpointing new writes retains unreviewed recovery and prefers explicitly edited versions', () => {
  const unreviewed = { category: 'task', object_id: 'plan:segment:one', body: { title: 'Recovered plan' } };
  const old = { category: 'response', object_id: 'growth:q1', body: { value: 'Recovered answer' } };
  const explicit = { category: 'response', object_id: 'growth:q1', body: { value: 'Restored and edited answer' } };
  const snapshot = recoverySnapshot([unreviewed, old], [explicit]);
  assert.deepEqual(snapshot, [unreviewed, explicit]);
  assert.equal(old.body.value, 'Recovered answer');
});
