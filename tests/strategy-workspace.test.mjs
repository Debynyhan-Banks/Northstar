import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveStrategyGuide, getStrategyForm, renderStrategy, validateStrategyRecord, strategyConfirmationIssues, STRATEGY_PHASES } from '../app/strategy-workspace.js';
import { QUESTIONS } from '../app/strategy-content.js';
import { canonicalProposal } from '../app/planning-model.js';

const row = (category, object_id, body) => ({ category, object_id, body });
const doc = (planningType, id, body = {}) => row('task', `plan:${planningType}:${id}`, { planningType, id, ...body });
const answer = (seat, id, value, explanation = '') => row('response', `${seat}:${id}`, { seat, value, explanation });
const ctx = (rows = [], seat = 'growth') => ({ records: Object.fromEntries(rows.map(record => [`${record.category}|${record.object_id}`, record])), questions: QUESTIONS, seat, seats: { christian: 'Christian Okoh', growth: 'Debynyhan Banks' }, now: '2026-10-19' });

test('empty evidence register still derives critical partner inputs and planning gaps without a readiness score', () => {
  const context = ctx();
  const result = deriveStrategyGuide(context);
  assert.equal(result.phases.length, 6);
  assert.ok(result.criticalMissingCount > 30);
  assert.ok(result.missingInputs.some(input => input.key === 'response:christian:business_mandate'));
  assert.ok(result.missingInputs.some(input => input.key === 'response:growth:compensation_expectations'));
  assert.ok(result.missingInputs.some(input => input.key === 'planning:capacity-week'));
  assert.ok(result.missingInputs.some(input => input.key === 'planning:customer-research'));
  assert.equal(result.nextAction.seat, 'growth');
  const html = renderStrategy('guide', context);
  assert.match(html, /not a readiness score/);
  assert.match(html, /Forecasts are planning estimates/);
  assert.doesNotMatch(html, /100%|Ready to launch|Automatically selected/);
  assert.deepEqual(context.records, {});
});

test('guide routes company and technical questions to Christian and my own responsibilities to Debynyhan Banks', () => {
  const guide = deriveStrategyGuide(ctx());
  for (const id of ['business_mandate', 'site_supervision', 'residential_first', 'capital_available', 'marketing_assets']) {
    assert.ok(guide.inputs.some(input => input.seat === 'christian' && input.questionId === id), id);
    assert.ok(!guide.inputs.some(input => input.seat === 'growth' && input.questionId === id), id);
  }
  assert.ok(guide.inputs.some(input => input.seat === 'growth' && input.questionId === 'startup_economics'));
  assert.equal(guide.nextAction.seat, 'growth');
  assert.equal(deriveStrategyGuide(ctx([], 'christian')).nextAction.seat, 'christian');
  const html = renderStrategy('guide', ctx());
  assert.match(html, /data-open-question="business_mandate" data-open-seat="christian"/);
});

test('explicit unknown stays unresolved, while substantive written alternatives remain reusable answers', () => {
  for (const value of ['Unknown', 'Not sure', 'To be determined', 'TBD']) {
    const guide = deriveStrategyGuide(ctx([answer('christian', 'business_mandate', value, 'We should discuss the boundaries')]));
    assert.ok(guide.missingInputs.some(input => input.key === 'response:christian:business_mandate'), value);
  }
  const context = ctx([
    answer('christian', 'business_mandate', '', 'I want you to organize intake and prepare drafts for my approval'),
    answer('growth', 'partner_role_title', 'Business director', 'I need documented decision limits'),
  ]);
  assert.ok(!deriveStrategyGuide(context).missingInputs.some(input => input.key === 'response:christian:business_mandate'));
  const html = renderStrategy('guide', context);
  assert.match(html, /Christian Okoh · Christian, when you ask me/);
  assert.match(html, /Details \/ written alternative/);
  assert.match(html, /\[response:christian:business_mandate\]/);
  assert.match(html, /I need documented decision limits/);
  assert.match(html, /No joint decision proposal is linked/);
});

test('research follow-ups are deduplicated through direct and linked-evidence task references', () => {
  const context = ctx([
    row('task', 'followup-direct', { id: 'followup-direct', sourceSeat: 'christian', sourceQuestionId: 'business_mandate', owner: 'christian', status: 'in-progress', dueDate: '2026-10-25', title: 'Clarify delegated authority' }),
    doc('evidence', 'coverage-question', { title: 'Weekday coverage', relatedQuestion: 'christian:site_supervision', owner: 'christian', classification: 'unknown', verification: 'unverified', researchTaskId: 'followup-evidence' }),
    row('task', 'followup-evidence', { id: 'followup-evidence', title: 'Check qualified coverage', status: 'not-started', owner: 'christian', dueDate: '2026-10-28' }),
    row('task', 'unrelated', { id: 'unrelated', title: 'An unrelated task', owner: 'growth', status: 'not-started' }),
  ]);
  const guide = deriveStrategyGuide(context);
  const mandate = guide.missingInputs.find(input => input.key === 'response:christian:business_mandate');
  const coverage = guide.missingInputs.find(input => input.key === 'response:christian:site_supervision');
  assert.equal(mandate.taskId, 'followup-direct');
  assert.equal(coverage.taskId, 'followup-evidence');
  assert.equal(guide.missingInputs.find(input => input.key === 'planning:charter').taskId, undefined);
  const html = renderStrategy('guide', context);
  assert.match(html, /data-edit-task="followup-direct"/);
  assert.match(html, /data-edit-task="followup-evidence"/);
  assert.doesNotMatch(html, /data-strategy-research-question="christian:business_mandate"/);
  assert.doesNotMatch(html, /data-strategy-research-question="christian:site_supervision"/);
});

test('deferred phases retain constraints and unresolved inputs, with a reason and review date required', () => {
  const context = ctx([doc('strategy-step', 'working-arrangement', { status: 'deferred', deferredReason: 'Waiting for the availability discussion', reviewDate: '2026-10-26', owner: 'christian' })]);
  const guide = deriveStrategyGuide(context);
  assert.equal(guide.phases[0].step.status, 'deferred');
  assert.ok(guide.phases[0].missingInputs.length > 0);
  assert.notEqual(guide.nextAction.phaseId, 'working-arrangement');
  const html = renderStrategy('guide', context);
  assert.match(html, /Deferred — still unresolved/);
  assert.match(html, /Waiting for the availability discussion/);
  assert.match(html, /Deferral does not resolve the missing inputs/);
  const issues = validateStrategyRecord('strategy-step', { id: 'working-arrangement', owner: 'growth', status: 'deferred' }, context);
  assert.ok(issues.some(issue => issue.includes('why this step is deferred')));
  assert.ok(issues.some(issue => issue.includes('review date')));
  assert.deepEqual(validateStrategyRecord('strategy-step', { id: 'working-arrangement', owner: 'growth', status: 'deferred', deferredReason: 'Need coverage evidence', reviewDate: '2026-10-26' }, context), []);
});

test('blank capacity, proposed availability and unverified technical identity cannot hide the coverage gap', () => {
  const person = doc('capacity-person', 'technician', { name: 'Proposed technician', qualificationStatus: 'proposed', qualifiedFor: ['field', 'estimating', 'supervision', 'callback'], qualificationSource: 'Not checked' });
  const week = doc('capacity-week', 'week', { personId: 'technician', weekStart: '2026-10-19', availabilityStatus: 'proposed', availabilitySource: 'Confirmed hours in written availability note', allocationBasis: 'whole-week', availableHours: 20, fieldHours: 10, travelHours: 2, estimatingHours: 2, adminHours: 2, supportHours: 1, supervisionHours: 1, callbackHours: 2 });
  assert.ok(deriveStrategyGuide(ctx([person, week])).missingInputs.some(input => input.key === 'planning:capacity-week'));
  person.body.qualificationStatus = 'verified'; week.body.availabilityStatus = 'confirmed';
  assert.ok(!deriveStrategyGuide(ctx([person, week])).missingInputs.some(input => input.key === 'planning:capacity-week'));
  week.body.fieldHours = '';
  assert.ok(deriveStrategyGuide(ctx([person, week])).missingInputs.some(input => input.key === 'planning:capacity-week'));
  week.body.fieldHours = 30;
  assert.ok(deriveStrategyGuide(ctx([person, week])).missingInputs.some(input => input.key === 'planning:capacity-week'));
  week.body.fieldHours = 0;
  assert.ok(deriveStrategyGuide(ctx([person, week])).missingInputs.some(input => input.key === 'planning:capacity-week'));
});

test('financial guide distinguishes explicit zero from absent or malformed fixed-cost assumptions', () => {
  const settings = doc('finance-settings', 'settings', { baseOpeningCash: 0, baseMonthlyOverhead: '0', baseMonthlyCompensation: 0, baseMonthlyMarketing: '0' });
  assert.ok(!deriveStrategyGuide(ctx([settings])).missingInputs.some(input => input.key === 'planning:finance-settings'));
  for (const value of ['', false, [], null, 'NaN']) {
    settings.body.baseOpeningCash = value;
    assert.ok(deriveStrategyGuide(ctx([settings])).missingInputs.some(input => input.key === 'planning:finance-settings'), String(value));
  }
});

test('the recommended action advances after the operating inputs and current charter confirmations are present', () => {
  const firstPhase = STRATEGY_PHASES[0];
  const rows = Object.entries({ christian: firstPhase.christian, growth: firstPhase.growth }).flatMap(([seat, ids]) => ids.map(id => answer(seat, id, `Recorded perspective for ${id}`)));
  const charter = { id: 'charter', planningType: 'charter', title: 'Working proposal', owner: 'growth', sourceRefs: ['response:christian:business_mandate'] };
  for (const item of getStrategyForm('charter', charter, ctx()).fields.filter(item => ['text', 'textarea'].includes(item.type))) charter[item.key] = 'Terms recorded for discussion';
  charter.reviewDate = '2026-10-26';
  rows.push(doc('charter', 'charter', charter));
  rows.push(doc('capacity-person', 'tech', { name: 'Confirmed technician', qualificationStatus: 'verified', qualifiedFor: ['field'], qualificationSource: 'Recorded source' }));
  rows.push(doc('capacity-week', 'week', { personId: 'tech', weekStart: '2026-10-19', availabilityStatus: 'confirmed', availabilitySource: 'Written availability', allocationBasis: 'whole-week', availableHours: 10, fieldHours: 10, travelHours: 0, estimatingHours: 0, adminHours: 0, supportHours: 0, supervisionHours: 0, callbackHours: 0 }));
  const context = ctx(rows);
  assert.equal(deriveStrategyGuide(context).nextAction.phaseId, 'working-arrangement', 'A specific shared arrangement still needs both confirmations.');
  for (const seat of ['christian', 'growth']) {
    const id = `${seat}:confirm:charter`;
    context.records[`vote|${id}`] = row('vote', id, { seat, proposalId: 'charter', choice: 'confirmed', respondent_uid: `demo:${seat}`, confirmedAt: '2026-10-19T15:00:00Z', snapshot: canonicalProposal(charter, context.records) });
  }
  assert.equal(deriveStrategyGuide(context).nextAction.phaseId, 'customer-evidence');
  assert.equal(deriveStrategyGuide(context).phases[0].missingInputs.length, 0);
});

test('charter separates attributed preferences and discussions from the shared arrangement', () => {
  const context = ctx([
    answer('christian', 'technical_signoff', 'Both review and approve every bid'),
    answer('growth', 'technical_signoff', 'Separate approval thresholds based on contract size'),
    answer('christian', 'business_mandate', 'Prepare estimates; I release the approved quote'),
    doc('charter', 'charter', { title: 'Our draft', owner: 'growth', mandate: 'Debynyhan organizes the business workflow', christianTitle: 'President', growthTitle: 'Proposed operations lead' }),
  ]);
  const before = structuredClone(context.records);
  const html = renderStrategy('charter', context);
  assert.match(html, /selected answers differ/);
  assert.match(html, /Proposed — awaiting each partner/);
  assert.match(html, /Debynyhan organizes the business workflow/);
  assert.match(html, /Prepare estimates; I release the approved quote/);
  assert.match(html, /data-plan-confirm-type="charter"/);
  assert.match(html, /data-plan-confirm="charter"[^>]*disabled/);
  assert.match(html, /This is a business planning record/);
  assert.deepEqual(context.records, before);
});

test('incomplete charter and strategy drafts save, but meaningful fields and sources are needed for confirmation', () => {
  const charter = { id: 'charter', title: 'Draft operating arrangement', owner: 'growth' };
  assert.deepEqual(validateStrategyRecord('charter', charter, ctx()), []);
  assert.ok(strategyConfirmationIssues('charter', charter, ctx()).length > 8);
  const form = getStrategyForm('charter', charter, ctx());
  for (const item of form.fields.filter(item => ['text', 'textarea'].includes(item.type))) charter[item.key] = 'Proposed terms recorded for review';
  charter.reviewDate = '2026-10-26'; charter.sourceRefs = ['response:christian:business_mandate'];
  assert.deepEqual(strategyConfirmationIssues('charter', charter, ctx()), []);
  charter.technicalReview = 'Unknown';
  assert.ok(strategyConfirmationIssues('charter', charter, ctx()).some(issue => issue.includes('technical review')));
  const strategic = { id: 'strategy-brief', title: 'Our strategy', owner: 'growth', objectives: 'Sustainable first jobs', selectedSegmentId: 'missing', initialOffer: 'A defined service pilot', tradeoffs: 'Limit initial geography', reviewDate: '2026-10-26', changeTriggers: 'Pause without technical capacity', sourceRefs: ['segment:missing'] };
  assert.ok(strategyConfirmationIssues('strategy-brief', strategic, ctx()).some(issue => issue.includes('segment is missing')));
  assert.deepEqual(strategyConfirmationIssues('strategy-brief', strategic, ctx([doc('segment', 'missing', { title: 'Pilot segment' })])), []);
});

test('forms link existing answers and models without silently copying partner claims into the shared charter', () => {
  const context = ctx([answer('christian', 'business_mandate', 'Run intake'), doc('segment', 'homeowners', { title: 'Local homeowners' }), doc('job-model', 'diagnostic', { title: 'Diagnostic visit' })]);
  const before = structuredClone(context.records);
  const form = getStrategyForm('charter', {}, context);
  assert.equal(form.id, 'charter');
  assert.equal(form.initial.mandate, undefined);
  assert.ok(form.fields.find(item => item.key === 'sourceRefs').options.some(option => option.value === 'response:christian:business_mandate'));
  assert.equal(getStrategyForm('strategy-brief', {}, context).id, 'strategy-brief');
  assert.equal(getStrategyForm('website-brief', {}, context).id, 'website-brief');
  const segment = getStrategyForm('segment', { id: 'test' }, context);
  assert.equal(segment.initial.capabilityStatus, 'unknown');
  assert.equal(segment.initial.capacityStatus, 'unknown');
  assert.equal(segment.initial.cashStatus, 'unknown');
  assert.ok(segment.fields.find(item => item.key === 'jobModelIds').options.some(option => option.value === 'diagnostic'));
  assert.deepEqual(context.records, before);
});

test('reported segment constraints need documented checks and sources, and never create an automatic winner', () => {
  const segment = { id: 'homeowners', title: 'A specific homeowner segment', owner: 'growth', capabilityStatus: 'met', capacityStatus: 'unknown', cashStatus: 'not-met' };
  const issues = validateStrategyRecord('segment', segment, ctx());
  assert.ok(issues.some(issue => issue.includes('who checked')));
  assert.ok(issues.some(issue => issue.includes('supporting evidence')));
  segment.constraintNotes = 'Christian checked capability; coverage remains unknown'; segment.sourceRefs = ['response:christian:special_capabilities'];
  assert.deepEqual(validateStrategyRecord('segment', segment, ctx()), []);
  const html = renderStrategy('segments', ctx([doc('segment', segment.id, segment)]));
  for (const phrase of ['Reported met — check sources', 'Unknown — needs evidence', 'Not met', 'Residential HVAC remains a hypothesis', 'Draft a joint launch decision']) assert.ok(html.includes(phrase), phrase);
  assert.doesNotMatch(html, /Selected winner|Recommended winner|Score:|Automatically approved/);
});

test('website brief preserves private planning, separates experience and maps each page to audience offer proof and action', () => {
  const context = ctx([
    doc('website-brief', 'website-brief', { title: 'Website draft', audience: 'Homeowners with planned replacements', primaryGoal: 'Qualified inquiries', owner: 'growth', companyHistory: 'Only documented company jobs', christianExperience: 'Christian’s individual employment experience', responseWorkflow: 'Debynyhan receives inquiries; Christian reviews scope', sourceRefs: ['segment:homeowners'] }),
    doc('segment', 'homeowners', { title: 'Specific homeowner segment', problem: 'Unclear replacement options', offer: 'Reviewed replacement proposal' }),
    doc('website-page', 'replacement-page', { title: 'Replacement options', audience: 'Homeowners comparing options', offer: 'A scoped replacement quote', proof: 'Permissioned company project example', action: 'Request an assessment', segmentId: 'homeowners', experimentId: 'referral-test', owner: 'growth', status: 'needs-evidence', sourceRefs: ['evidence:permission'] }),
    doc('experiment', 'referral-test', { title: 'Referral test' }),
  ]);
  const html = renderStrategy('website', context);
  for (const phrase of ['private partner planning', 'does not publish', 'C.F. Mechanical company history', 'Christian’s individual HVAC experience', 'Request an assessment', 'Permissioned company project example', '[segment:homeowners]', '[experiment:referral-test]', 'Source is missing']) assert.ok(html.includes(phrase), phrase);
  assert.doesNotMatch(html, /href="https:\/\/therealfishandgrits.com\/.*public/);
});

test('stored markup and malicious references are escaped in all strategic views and confirmation attributes', () => {
  const malicious = '"><img src=x onerror=alert(1)><script>alert(2)</script>';
  const context = ctx([
    answer('christian', 'business_mandate', malicious),
    doc('charter', 'charter', { title: malicious, mandate: malicious, sourceRefs: ['response:christian:business_mandate', malicious], owner: 'growth' }),
    doc('segment', malicious, { title: malicious, offer: malicious, sourceRefs: [`evidence:${malicious}`] }),
    doc('website-brief', 'website-brief', { title: malicious, credentials: malicious, sourceRefs: [`segment:${malicious}`] }),
    doc('website-page', malicious, { title: malicious, action: malicious, proof: malicious }),
    doc('strategy-step', 'working-arrangement', { direction: malicious, deferredReason: malicious, status: 'deferred' }),
  ]);
  for (const view of ['guide', 'charter', 'segments', 'website']) {
    const html = renderStrategy(view, context);
    assert.doesNotMatch(html, /<script|<img|data-plan-id=""><img|href="javascript:/, view);
    assert.match(html, /&lt;img/, view);
  }
});

test('malformed selections, self citations, invalid dates and unsupported strategy-step identifiers are rejected', () => {
  const context = ctx();
  assert.ok(validateStrategyRecord('strategy-step', { id: 'invented', status: 'approved', owner: 'both' }, context).length >= 3);
  const issues = validateStrategyRecord('website-brief', { id: 'website-brief', title: 'Brief', owner: 'growth', reviewDate: '2026-02-30', sourceRefs: ['website-brief:website-brief'], evidenceIds: 'not-an-array' }, context);
  for (const phrase of ['valid calendar date', 'cannot cite itself', 'must contain record references']) assert.ok(issues.some(issue => issue.includes(phrase)), phrase);
  assert.equal(renderStrategy('unrelated-view', context), '');
  assert.equal(getStrategyForm('unrelated-type', {}, context), null);
  assert.deepEqual(STRATEGY_PHASES.map(phase => phase.dependencies).flat().filter(id => !STRATEGY_PHASES.some(phase => phase.id === id)), []);
});
