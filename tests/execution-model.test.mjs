import test from 'node:test';
import assert from 'node:assert/strict';
import {taskDueDate,dependencyIssue,exportWorkspace,validateTask,validateOpportunity,findQuestionResearchTask} from '../app/execution-model.js';
test('week-based deadlines use calendar dates across DST and respect a manual deadline',()=>{assert.equal(taskDueDate({start:1,duration:2},'2026-10-26'),'2026-11-08');assert.equal(taskDueDate({start:1,duration:2,dueDate:'2026-11-03'},'2026-10-26'),'2026-11-03');assert.equal(taskDueDate({start:1,duration:2},''),'');assert.equal(taskDueDate({start:1,duration:0},'2026-10-26'),'')});
test('dependencies cannot create cycles and missing tasks stay explicit',()=>{const tasks=[{id:'a',depends:'b'},{id:'b',depends:''}];assert.match(dependencyIssue({id:'b',depends:'a'},tasks),/cycle/);assert.equal(dependencyIssue({id:'c',depends:'a'},tasks),'');assert.match(dependencyIssue({id:'c',depends:'missing'},tasks),/no longer exists/)});
test('backups retain every planning document, answer, financial input and private confirmation',()=>{const rows={a:{category:'response',object_id:'growth:x',body:{value:'old'}},b:{category:'task',object_id:'plan:finance-settings:settings',body:{id:'settings',planningType:'finance-settings',baseOpeningCash:'0'}},c:{category:'vote',object_id:'christian:confirm:p',body:{snapshot:'exact content'}}};const before=JSON.stringify(rows);const backup=exportWorkspace(rows,{exportedAt:'2026-10-19T00:00:00Z'});assert.equal(backup.records.length,3);assert.equal(backup.version,2);assert.equal(JSON.stringify(rows),before);assert.deepEqual(JSON.parse(JSON.stringify(backup)).records,Object.values(rows))});


const task = { id: 't-1', title: 'Verify delivery coverage', owner: 'christian', start: '1', duration: '2', dueDate: '', status: 'not-started', definitionOfDone: 'Named delivery and callback coverage recorded', budget: '', evidence: '' };
const startDate = '2026-10-19';
const has = (errors, pattern) => errors.some((error) => pattern.test(error));

test('tasks require one accountable partner, a meaningful title and a completion definition', () => {
  assert.deepEqual(validateTask(task, [], startDate), []);
  for (const owner of ['', 'both', 'Christian Okoh']) assert.ok(has(validateTask({ ...task, owner }, [], startDate), /accountable owner/i));
  assert.ok(has(validateTask({ ...task, title: '  ' }, [], startDate), /task title/i));
  assert.ok(has(validateTask({ ...task, definitionOfDone: '', notes: '' }, [], startDate), /definition of done/i));
  assert.deepEqual(validateTask({ ...task, definitionOfDone: '', notes: 'Legacy completion requirements' }, [], startDate), []);
});

test('tasks need either a valid manual deadline or a calculable roadmap deadline', () => {
  assert.ok(has(validateTask(task, [], ''), /deadline|start date/i));
  assert.deepEqual(validateTask({ ...task, dueDate: '2026-10-30' }, [], ''), []);
  assert.ok(has(validateTask({ ...task, dueDate: '2026-02-30' }, [], startDate), /valid deadline/i));
  assert.ok(has(validateTask({ ...task, reportingDate: '2026-02-29' }, [], startDate), /reporting date/i));
  assert.deepEqual(validateTask({ ...task, reportingDate: '2026-10-19' }, [], startDate), []);
});

test('task weeks must be whole and fit inside the 13-week roadmap', () => {
  for (const change of [{ start: '0' }, { start: '14' }, { start: '1.5' }, { duration: '0' }, { duration: '-1' }, { duration: '1.5' }, { start: '13', duration: '2' }]) {
    assert.ok(has(validateTask({ ...task, ...change }, [], startDate), /whole weeks/i));
  }
  assert.deepEqual(validateTask({ ...task, start: '13', duration: '1' }, [], startDate), []);
  assert.equal(taskDueDate({ start: '13', duration: '1' }, startDate), '2027-01-17');
});

test('task validation detects missing dependencies and cycles before accepting the task', () => {
  const others = [{ id: 't-2', depends: 't-3' }, { id: 't-3', depends: 't-1' }];
  assert.ok(has(validateTask({ ...task, depends: 't-2' }, others, startDate), /cycle/i));
  assert.ok(has(validateTask({ ...task, depends: 't-1' }, [], startDate), /cycle/i));
  assert.ok(has(validateTask({ ...task, depends: 'missing' }, [], startDate), /no longer exists/i));
  assert.deepEqual(validateTask({ ...task, depends: 't-2' }, [{ id: 't-2', depends: '' }], startDate), []);
});

test('completed tasks need substantive completion evidence and preserve entered values', () => {
  const complete = { ...task, status: 'completed', evidence: '  ' };
  const before = structuredClone(complete);
  assert.ok(has(validateTask(complete, [], startDate), /completion evidence/i));
  assert.deepEqual(complete, before);
  assert.deepEqual(validateTask({ ...complete, evidence: 'Coverage confirmation in company records' }, [], startDate), []);
  assert.deepEqual(validateTask({ ...task, status: 'in-progress', evidence: '' }, [], startDate), []);
});

test('task budgets distinguish blank and explicit zero from negative, malformed or nonfinite amounts', () => {
  for (const budget of ['', undefined, null, '0', 0, '125.50']) assert.deepEqual(validateTask({ ...task, budget }, [], startDate), []);
  for (const budget of ['-1', Infinity, 'NaN', ' ', false, [], {}]) assert.ok(has(validateTask({ ...task, budget }, [], startDate), /budget.*nonnegative/i));
});

test('opportunities allow missing business data but require a name and real calendar dates', () => {
  assert.deepEqual(validateOpportunity({ name: 'New inquiry' }), []);
  assert.ok(has(validateOpportunity({ name: '  ' }), /name/i));
  for (const change of [{ inquiryDate: '2026-02-30' }, { quotedAt: 'not a date' }, { paidAt: '2026-10-19T12:00:00Z' }, { deadline: '2026-02-29' }, { reportingDate: '2026-13-01' }]) {
    assert.ok(has(validateOpportunity({ name: 'New inquiry', ...change }), /valid date/i));
  }
  assert.deepEqual(validateOpportunity({ name: 'New inquiry', inquiryDate: '2026-10-19', reportingDate: '2026-10-20' }), []);
});

test('recorded opportunity milestones must progress chronologically even when intermediate dates are unknown', () => {
  const row = { name: 'Actual opportunity', inquiryDate: '2026-10-19', quotedAt: '2026-10-21', acceptedAt: '2026-10-22', completedAt: '2026-10-23', invoicedAt: '2026-10-23', paidAt: '2026-10-26' };
  assert.deepEqual(validateOpportunity(row), []);
  assert.ok(has(validateOpportunity({ ...row, acceptedAt: '2026-10-20' }), /cannot precede/i));
  assert.ok(has(validateOpportunity({ name: 'Actual opportunity', inquiryDate: '2026-10-19', paidAt: '2026-10-18' }), /cannot precede/i));
  assert.deepEqual(validateOpportunity({ name: 'Actual opportunity', quotedAt: '2026-10-21', paidAt: '2026-10-26' }), []);
});

test('opportunity amounts preserve unknowns and explicit zeros while rejecting fabricated numeric coercions', () => {
  const row = { name: 'Actual opportunity', invoiceAmount: '', cashCollected: '', directCost: '', callbacks: '' };
  const before = structuredClone(row);
  assert.deepEqual(validateOpportunity(row), []);
  assert.deepEqual(row, before);
  assert.deepEqual(validateOpportunity({ ...row, invoiceAmount: '0', cashCollected: 0, directCost: '0', callbacks: '0' }), []);
  assert.deepEqual(validateOpportunity({ ...row, invoiceAmount: '125.50', cashCollected: '50.25', directCost: '75.10', callbacks: '2' }), []);
  for (const value of ['-1', Infinity, false, [], {}]) {
    assert.ok(has(validateOpportunity({ ...row, invoiceAmount: value }), /invoiced amount.*nonnegative/i));
    assert.ok(has(validateOpportunity({ ...row, directCost: value }), /job costs.*nonnegative/i));
  }
  for (const callbacks of ['-1', '1.5', false]) assert.ok(has(validateOpportunity({ ...row, callbacks }), /callbacks.*whole number/i));
});

test('critical-question research reuses open direct or evidence-linked tasks for the right partner',()=>{const r=(id,body)=>({category:'task',object_id:id,body});const records={a:r('research',{id:'research',sourceSeat:'christian',sourceQuestionId:'weekly_time',status:'not-started'}),b:r('plan:evidence:e',{id:'e',planningType:'evidence',relatedQuestion:'response:growth:weekly_time',owner:'growth',researchTaskId:'other'}),c:r('other',{id:'other',status:'in-progress'})};const before=JSON.stringify(records);assert.equal(findQuestionResearchTask(records,'christian','weekly_time').id,'research');assert.equal(findQuestionResearchTask(records,'growth','weekly_time').id,'other');assert.equal(findQuestionResearchTask(records,'growth','capital_available'),null);assert.equal(JSON.stringify(records),before);records.c.body.status='completed';assert.equal(findQuestionResearchTask(records,'growth','weekly_time'),null)});
