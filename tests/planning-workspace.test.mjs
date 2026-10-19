import test from 'node:test';
import assert from 'node:assert/strict';
import { getPlanningForm, validatePlanningForm, renderPlanningModal, safeSource, financeSummary, renderPlanning, renderConfirmedDecisions, sourceReferenceOptions } from '../app/planning-workspace.js';

const context = { records: {}, seat: 'growth', now: '2026-10-19' };
const evidence = { title: 'Confirm available delivery hours', classification: 'confirmed', verification: 'verified', owner: 'christian', source: 'Company capacity review, 2026-10-19', observedOn: '2026-10-19', remainingQuestion: '', researchDue: '' };
const experiment = { title: 'Customer research test', segment: 'Proposed residential customers', channel: 'Customer interviews', owner: 'growth', startDate: '2026-10-19', endDate: '2026-11-01', budget: '', spend: '' };
const record = (type, id, body) => ({ category: 'task', object_id: `plan:${type}:${id}`, body: { ...body, id, planningType: type } });
const has = (errors, pattern) => errors.some((error) => pattern.test(error));

test('new evidence is an explicit unknown and opening a form preserves saved inputs without mutation', () => {
  const form = getPlanningForm('evidence', {}, context);
  assert.equal(form.initial.classification, 'unknown');
  assert.equal(form.initial.verification, 'unverified');
  assert.equal(form.initial.observedOn, undefined);
  const saved = { id: 'e-1', ...evidence, extraHistoricalData: 'Keep this' };
  const original = structuredClone(saved);
  const edit = getPlanningForm('evidence', saved, context);
  assert.deepEqual(saved, original);
  assert.equal(edit.id, 'e-1');
  assert.equal(edit.initial.extraHistoricalData, 'Keep this');
});

test('confirmed evidence needs a substantive source, checked status and valid observation date', () => {
  const form = getPlanningForm('evidence', {}, context);
  assert.deepEqual(validatePlanningForm(form, evidence), []);
  assert.ok(has(validatePlanningForm(form, { ...evidence, source: '' }), /source/i));
  assert.ok(has(validatePlanningForm(form, { ...evidence, source: '  \n ' }), /source/i));
  assert.ok(has(validatePlanningForm(form, { ...evidence, verification: 'unverified' }), /source|verification/i));
  assert.ok(has(validatePlanningForm(form, { ...evidence, observedOn: '' }), /date.*required|verification date.*required/i));
  assert.ok(has(validatePlanningForm(form, { ...evidence, observedOn: '2026-02-30' }), /valid date/i));
});

test('unknown, needs-review and open-question evidence requires a research deadline', () => {
  const form = getPlanningForm('evidence', {}, context);
  for (const unresolved of [
    { ...evidence, classification: 'unknown', verification: 'unverified' },
    { ...evidence, classification: 'estimate', verification: 'needs-review' },
    { ...evidence, classification: 'estimate', verification: 'unverified' },
    { ...evidence, classification: 'estimate', remainingQuestion: 'Who provides backup coverage?' },
  ]) {
    assert.ok(has(validatePlanningForm(form, unresolved), /research deadline/i));
    assert.deepEqual(validatePlanningForm(form, { ...unresolved, researchDue: '2026-10-23' }), []);
  }
  assert.ok(has(validatePlanningForm(form, { ...evidence, classification: 'unknown', researchDue: '  ' }), /research deadline/i));
  assert.deepEqual(validatePlanningForm(form, { ...evidence, classification: 'estimate', verification: 'verified', remainingQuestion: '   ' }), []);
});

test('marketing validation permits unknown budgets and confirmed zero, and rejects negative or nonfinite spending', () => {
  const form = getPlanningForm('experiment', {}, context);
  assert.deepEqual(validatePlanningForm(form, experiment), []);
  assert.deepEqual(validatePlanningForm(form, { ...experiment, budget: '0', spend: '0' }), []);
  assert.ok(has(validatePlanningForm(form, { ...experiment, budget: '-0.01' }), /at least 0/i));
  assert.ok(has(validatePlanningForm(form, { ...experiment, spend: 'Infinity' }), /finite number/i));
  assert.ok(has(validatePlanningForm(form, { ...experiment, spend: 'unknown' }), /finite number/i));
  assert.ok(has(validatePlanningForm(form, { ...experiment, owner: '' }), /owner.*required/i));
});

test('date validation rejects impossible dates, reversed experiment periods and reversed proposal review dates', () => {
  const experimentForm = getPlanningForm('experiment', {}, context);
  assert.ok(has(validatePlanningForm(experimentForm, { ...experiment, startDate: '2026-02-30' }), /valid date/i));
  assert.ok(has(validatePlanningForm(experimentForm, { ...experiment, endDate: '2026-10-18' }), /end date.*after/i));
  const proposal = { title: 'Proposed initial offer', direction: 'Run a limited test after approval', rationale: 'Gather evidence', owner: 'growth', decisionDate: '2026-10-19', reviewDate: '2026-10-26' };
  const proposalForm = getPlanningForm('proposal', {}, context);
  assert.deepEqual(validatePlanningForm(proposalForm, proposal), []);
  assert.ok(has(validatePlanningForm(proposalForm, { ...proposal, reviewDate: '2026-10-18' }), /review date.*after/i));
});

test('rendering preserves saved option values and evidence IDs absent from current choices', () => {
  const records = { 'task|plan:evidence:e-current': record('evidence', 'e-current', { title: 'Current source' }) };
  const form = getPlanningForm('proposal', { id: 'p-old', evidenceIds: ['e-current', 'e-archived<"'], direction: '<script>not executable</script>' }, { ...context, records });
  const html = renderPlanningModal(form);
  assert.match(html, /value="e-current" selected/);
  assert.match(html, /value="e-archived&lt;&quot;" selected/);
  assert.match(html, /Previously saved: e-archived&lt;&quot;/);
  assert.match(html, /&lt;script&gt;not executable&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>not executable/);
  const future = renderPlanningModal(getPlanningForm('evidence', { verification: 'future-review-status' }, context));
  assert.match(future, /value="future-review-status" selected/);
  assert.match(future, /Previously saved: future-review-status/);
});

test('source references allow HTTP links and keep executable schemes as escaped plain text', () => {
  assert.match(safeSource('https://example.com/evidence?x=1&y=2'), /href="https:\/\/example.com\/evidence\?x=1&amp;y=2"/);
  assert.match(safeSource('https://example.com/evidence'), /rel="noopener noreferrer"/);
  assert.doesNotMatch(safeSource('javascript:alert(1)'), /<a\b/);
  assert.equal(safeSource('<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;');
});

test('finance forms receive saved models through root planning context without fabricated amounts', () => {
  const records = { 'task|plan:job-model:j-1': record('job-model', 'j-1', { title: 'Entered service', scenario: 'base' }) };
  const form = getPlanningForm('operating-month', { id: 'month-1' }, { ...context, records });
  assert.ok(form.fields.find((field) => field.key === 'jobModelId').options.some((option) => option.value === 'j-1'));
  assert.equal(form.initial.units, undefined);
  assert.equal(getPlanningForm('finance-settings', {}, context).id, 'settings');
  assert.equal(getPlanningForm('unsupported-type', {}, context), null);
});

test('root financial summaries read scenario-specific stored settings and show incomplete forecasts honestly', () => {
  const records = { 'task|plan:finance-settings:settings': record('finance-settings', 'settings', { forecastStartDate: '2026-10-19', baseOpeningCash: '1200', downsideOpeningCash: '800' }) };
  const summary = financeSummary({ ...context, records });
  assert.equal(summary.base.settings.openingCash, 1200);
  assert.equal(summary.downside.settings.openingCash, 800);
  assert.equal(summary.base.cash.closingCash, null);
  assert.equal(summary.base.cash.complete, false);
  assert.equal(summary.base.operating.revenue, null);
  const html = renderPlanning('finance', { ...context, records });
  assert.match(html, /Incomplete — unknown inputs/);
  assert.match(html, /Startup included in cash out/);
  assert.match(html, /never added together/);
});

test('proposal source picker names the partner and question and blocks missing linked sources',()=>{const records={a:{category:'response',object_id:'christian:vision',body:{value:'Recorded vision'}},b:{category:'task',object_id:'plan:proposal:p',body:{id:'p',planningType:'proposal',title:'Review our direction',sourceRefs:['segment:missing']}}};const ctx={records,seat:'growth',questions:[{id:'vision',type:'long',audience:'both',label:'Our future direction'}]};assert.equal(sourceReferenceOptions(ctx).find(o=>o.value==='response:christian:vision').label,'Christian Okoh: Our future direction');const html=renderConfirmedDecisions(ctx);assert.match(html,/Missing source references/);assert.match(html,/segment:missing/);assert.match(html,/data-plan-confirm="p"[^>]*disabled/)});
