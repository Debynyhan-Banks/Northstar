import test from 'node:test';
import assert from 'node:assert/strict';
import { getPlanningForm, renderPlanningModal, validatePlanningForm } from '../app/planning-workspace.js';
import { getStrategyForm } from '../app/strategy-workspace.js';
import { getCapacityForm } from '../app/capacity-workspace.js';
import { getPerformanceForm } from '../app/performance-workspace.js';
import { formSteps, capturePlanningValues, planningFieldVisible, planningStepForField, missingPlanningFields } from '../app/planning-form-flow.js';

const context = { records: {}, questions: [], seat: 'growth', now: '2026-10-19' };
const getForm = (type, values = {}) => getPlanningForm(type, values, context) || getStrategyForm(type, values, context) || getCapacityForm(type, values, context) || getPerformanceForm(type, values, context);

test('customer plan follows five stages without losing or duplicating any persisted field', () => {
  const saved = { id: 'segment-1', title: 'Residential', jobContribution: 'Unknown until costed', historicalNote: 'Preserve in record' };
  const original = structuredClone(saved);
  const form = getForm('segment', saved);
  const steps = formSteps(form);
  assert.deepEqual(steps.map(step => step.label), ['Customers', 'Services', 'Delivery', 'Money', 'Review']);
  assert.deepEqual(steps.flatMap(step => step.fields.map(field => field.key)).sort(), form.fields.map(field => field.key).sort());
  assert.equal(planningStepForField(form, 'jobContribution'), 3);
  assert.equal(planningStepForField(form, 'owner'), 4);
  assert.deepEqual(saved, original);
  assert.equal(form.initial.historicalNote, 'Preserve in record');
});

test('all supported forms retain every field and reach a final Review stage', () => {
  const types = ['evidence', 'customer-research', 'competitor', 'launch-option', 'experiment', 'proposal', 'settings', 'finance-settings', 'job-model', 'startup-cost', 'cash-week', 'operating-month', 'strategy-step', 'charter', 'segment', 'website-brief', 'website-page', 'strategy-brief', 'capacity-person', 'capacity-week', 'service-capacity', 'demand-week', 'forecast-baseline', 'job-actual', 'actual-period'];
  for (const type of types) {
    const form = getForm(type, type === 'strategy-step' ? { id: 'segment-offer' } : {});
    const steps = formSteps(form);
    assert.equal(steps.at(-1).id, 'review', type);
    const grouped = steps.flatMap(step => step.fields.map(field => field.key));
    assert.equal(grouped.length, new Set(grouped).size, `${type}: duplicate field`);
    assert.deepEqual(grouped.sort(), form.fields.map(field => field.key).sort(), `${type}: missing field`);
    const html = renderPlanningModal(form);
    for (const field of form.fields) assert.equal((html.match(new RegExp(`data-plan-field="${field.key}"`, 'g')) || []).length, 1, `${type}: ${field.key}`);
    assert.match(html, /data-plan-finish-later/);
  }
});

test('fields added in a future form version remain editable rather than silently disappearing', () => {
  const form = getForm('segment');
  form.fields.push({ key: 'futureSource', label: 'A future source', type: 'textarea' });
  assert.equal(formSteps(form).at(-1).fields.at(-1).key, 'futureSource');
  assert.match(renderPlanningModal(form), /data-plan-field="futureSource"/);
});

test('moving between stages preserves blank amounts, confirmed zero, original notes and source arrays', () => {
  const form = getForm('experiment', { budget: '0', spend: '', message: '  My own words\n\nKeep paragraphs.  ' });
  form.fields.push({ key: 'evidenceIds', label: 'Evidence', type: 'multiselect' });
  const elements = {
    budget: { value: '0' }, spend: { value: '' }, message: { value: form.initial.message },
    evidenceIds: { selectedOptions: [{ value: 'existing-source' }, { value: 'historical-source' }] },
  };
  const captured = capturePlanningValues(form, { querySelector: selector => elements[selector.match(/"([^"]+)"/)[1]] });
  assert.equal(captured.budget, '0');
  assert.equal(captured.spend, '');
  assert.equal(captured.message, form.initial.message);
  assert.deepEqual(captured.evidenceIds, ['existing-source', 'historical-source']);
  for (const step of [0, 1, 2, 3, 4, 0]) {
    const html = renderPlanningModal(form, { step, values: captured });
    assert.match(html, /data-plan-field="budget"[^>]*value="0"/);
    assert.match(html, /data-plan-field="spend"[^>]*value=""/);
    assert.match(html, /value="historical-source" selected/);
    assert.match(html, / {2}My own words\n\nKeep paragraphs\. {2}/);
  }
  assert.equal(captured.spend, '');
});

test('missing DOM controls fall back to prior values, preserving inactive conditional and historical choices', () => {
  const form = getForm('proposal', { evidenceIds: ['old-source'], direction: 'Do not lose this' });
  const before = structuredClone(form.initial.evidenceIds);
  const captured = capturePlanningValues(form, { querySelector: () => null });
  assert.deepEqual(captured.evidenceIds, ['old-source']);
  assert.equal(captured.direction, 'Do not lose this');
  captured.evidenceIds.push('new-source');
  assert.deepEqual(form.initial.evidenceIds, before);
});

test('conditional reporting fields stay tied to the actual source mode rather than stage visibility', () => {
  const form = getForm('actual-period');
  const source = form.fields.find(field => field.key === 'sourceMode');
  const cash = form.fields.find(field => field.key === 'customerReceipts');
  const revenue = form.fields.find(field => field.key === 'revenue');
  assert.equal(planningFieldVisible(source, { periodKind: 'cash-week' }), false);
  assert.equal(planningFieldVisible(source, { periodKind: 'operating-month' }), true);
  assert.equal(planningFieldVisible(cash, { periodKind: 'cash-week' }), true);
  assert.equal(planningFieldVisible(revenue, { periodKind: 'cash-week' }), false);
  const cashHtml = renderPlanningModal(form, { values: { periodKind: 'cash-week', revenue: '500', customerReceipts: '0' } });
  assert.match(cashHtml, /data-plan-field="revenue"\s+disabled[^>]*value="500"/);
  assert.match(cashHtml, /data-plan-field="customerReceipts"[^>]*value="0"/);
  assert.doesNotMatch(cashHtml, /data-plan-field="customerReceipts"[^>]*disabled/);
  const monthlyHtml = renderPlanningModal(form, { values: { periodKind: 'operating-month', revenue: '500', customerReceipts: '0' } });
  assert.doesNotMatch(monthlyHtml, /data-plan-field="revenue"[^>]*disabled/);
  assert.match(monthlyHtml, /data-plan-field="customerReceipts"\s+disabled[^>]*value="0"/);
});

test('review distinguishes missing required fields, unknown money and recorded zero without confirming a decision', () => {
  const form = getForm('experiment');
  const steps = formSteps(form);
  const values = { title: 'Pilot', segment: 'Residential', channel: 'Search', owner: '', startDate: '2026-10-19', endDate: '2026-11-19', budget: '0', spend: '' };
  assert.deepEqual(missingPlanningFields(form, values).map(field => field.key), ['owner']);
  const html = renderPlanningModal(form, { step: steps.length - 1, values });
  assert.match(html, /1 required answer is still missing/);
  assert.match(html, /1 financial or time amount remains unknown/);
  assert.match(html, /does not confirm a joint business decision/);
  assert.match(html, /Save marketing test/);
  assert.match(html, /novalidate/);
  assert.doesNotMatch(html, /data-plan-confirm/);
  assert.ok(validatePlanningForm(form, values).some(message => /owner.*required/i.test(message)));
  assert.equal(values.owner, '');
  assert.equal(values.spend, '');
});

test('only Review offers final submission, and all steps have accessible navigation and escaped draft status', () => {
  const form = getForm('segment', { title: 'Homeowners' });
  const first = renderPlanningModal(form, { step: 0, draftStatus: '<script>bad()</script>' });
  assert.doesNotMatch(first, /type="submit"/);
  assert.match(first, /aria-current="step"/);
  assert.match(first, /data-plan-step-heading tabindex="-1"/);
  assert.match(first, /role="status" aria-live="polite"/);
  assert.match(first, /&lt;script&gt;bad\(\)&lt;\/script&gt;/);
  assert.doesNotMatch(first, /<script>bad/);
  const last = renderPlanningModal(form, { step: 500 });
  assert.match(last, /Step 5 of 5: Review/);
  assert.match(last, /type="submit" class="btn primary">Save customer plan/);
});
