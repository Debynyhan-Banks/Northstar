import test from 'node:test';
import assert from 'node:assert/strict';
import { renderBusinessPlan, exportBusinessPlan, planText } from '../app/business-plan.js';
import { canonicalProposal, planningRecords } from '../app/planning-model.js';
import { calculateFinance } from '../app/finance-model.js';
import { planningDashboard, ESSENTIAL_QUESTIONS, getPlanningForm } from '../app/planning-workspace.js';
import { QUESTIONS } from '../app/strategy-content.js';

const questions = [
  { id: 'three_year', audience: 'both', type: 'long', label: 'What do we each want?', labels: { christian: 'Christian, what is your vision?', growth: 'What is my vision?' } },
  { id: 'business_mandate', audience: 'christian', type: 'long', label: 'Christian, what should I run?' },
  { id: 'startup_economics', audience: 'growth', type: 'long', label: 'What must our first service earn?' },
  { id: 'residential_first', audience: 'christian', type: 'single', label: 'Could residential work fit?' },
];
function row(category, id, body) { return { category, object_id: id, body }; }
function doc(type, id, body) { return row('task', id, { planningType: type, ...body }); }
function context(entries = []) { return { records: Object.fromEntries(entries.map(item => [`${item.category}|${item.object_id}`, item])), questions, now: '2026-10-19', seats: { christian: 'Christian Okoh', growth: 'Debynyhan Banks' } }; }
function confirmed(context, proposal) {
  for (const seat of ['christian', 'growth']) {
    const id = `${seat}:confirm:${proposal.id}`;
    context.records[`vote|${id}`] = row('vote', id, { seat, proposalId: proposal.id, choice: 'confirmed', respondent_uid: `user-${seat}`, confirmedAt: '2026-10-19T14:00:00Z', snapshot: canonicalProposal(proposal, context.records) });
  }
}

test('empty plan is useful without inventing company readiness, revenue or approved strategy', () => {
  const html = renderBusinessPlan(context());
  for (const title of ['Our one-page strategy', 'Executive summary and objectives', 'Company position and delivery capabilities', 'Target customers and market evidence', 'Competition and our proposed advantage', 'Initial offer, launch choice and pricing', 'Marketing and sales execution', 'Responsibilities, authority and capacity', 'Financial assumptions and scenarios', 'Risks, unresolved questions and contingency actions', 'Thirteen-week execution schedule', 'Twelve-month milestones']) assert.ok(html.includes(title), title);
  assert.match(html, /Profit and cash availability are unknown/);
  assert.match(html, /Residential HVAC is a proposed initial revenue path/);
  assert.match(html, /Christian Okoh/);
  assert.match(html, /Debynyhan Banks/);
  assert.doesNotMatch(html, /Confirmed jointly for this saved version|\$0\.00|independently verified company/);
  assert.doesNotMatch(html, /<script|https:\/\/api\./);
});

test('plan attributes each saved answer and written alternative without treating matching answers as agreements', () => {
  const ctx = context([
    row('response', 'christian:three_year', { seat: 'christian', value: 'Steady maintenance work', respondent_uid: 'christian-user', updatedAt: '2026-10-18' }),
    row('response', 'growth:three_year', { seat: 'growth', value: 'Steady maintenance work', explanation: 'With flexible hours and reviewed compensation' }),
    row('response', 'christian:residential_first', { seat: 'christian', value: '', explanation: 'Only with a qualified weekday technician' }),
    row('response', 'growth:business_mandate', { seat: 'growth', value: 'Legacy input kept in its original record' }),
  ]);
  const before = structuredClone(ctx.records);
  const html = renderBusinessPlan(ctx);
  assert.match(html, /Christian Okoh · Christian, what is your vision\?/);
  assert.match(html, /Debynyhan Banks · What is my vision\?/);
  assert.match(html, /With flexible hours and reviewed compensation/);
  assert.match(html, /Only with a qualified weekday technician/);
  assert.match(html, /\[response:christian:residential_first\]/);
  assert.doesNotMatch(html, /Confirmed jointly for this saved version/);
  assert.deepEqual(ctx.records, before);
});

test('legacy matching preferences and proposal status fields cannot become a confirmed decision in a plan', () => {
  const ctx = context([
    doc('proposal', 'launch', { title: 'First revenue approach', direction: 'Try selected residential jobs', status: 'confirmed', confirmations: { christian: true, growth: true } }),
    row('vote', 'christian:launch', { seat: 'christian', choice: 'Try selected residential jobs' }),
    row('vote', 'growth:launch', { seat: 'growth', choice: 'Try selected residential jobs' }),
  ]);
  assert.match(renderBusinessPlan(ctx), /Proposed — awaiting current partner confirmations/);
  assert.doesNotMatch(renderBusinessPlan(ctx), /Confirmed jointly for this saved version/);
});

test('current partner confirmations count and are invalidated when proposal or linked evidence changes', () => {
  const ctx = context([
    doc('evidence', 'crew', { title: 'Technician availability', classification: 'confirmed', verification: 'verified', source: 'https://example.com/crew', owner: 'christian' }),
    doc('proposal', 'launch', { title: 'Initial pilot', direction: 'Try limited residential work', rationale: 'Capacity reviewed', conditions: 'Weekday technician confirmed', evidenceIds: ['crew'], owner: 'growth', reviewDate: '2026-11-01' }),
  ]);
  const proposal = planningRecords(ctx.records, 'proposal')[0];
  confirmed(ctx, proposal);
  assert.match(renderBusinessPlan(ctx), /Confirmed jointly for this saved version/);
  ctx.records['task|launch'].body.direction = 'Accept all residential calls';
  assert.doesNotMatch(renderBusinessPlan(ctx), /Confirmed jointly for this saved version/);
  assert.match(renderBusinessPlan(ctx), /prior confirmations no longer match/);
  ctx.records['task|launch'].body.direction = proposal.direction;
  ctx.records['task|crew'].body.title = 'Technician no longer available';
  assert.doesNotMatch(renderBusinessPlan(ctx), /Confirmed jointly for this saved version/);
  delete ctx.records['task|crew'];
  assert.match(renderBusinessPlan(ctx), /missing evidence: crew/);
});

test('export escapes stored markup and only makes credential-free HTTPS source links clickable', () => {
  const ctx = context([
    doc('settings', 'settings', { planTitle: '</title><script>alert(1)</script>', vision: '<img src=x onerror=alert(2)>', differentiator: 'A&B "service"' }),
    doc('evidence', 'bad', { title: '<svg onload=alert(3)>', source: 'javascript:alert(4)', classification: 'confirmed', verification: 'verified' }),
    doc('evidence', 'bad-auth', { title: 'Bad credentials URL', source: 'https://secret@example.com/private' }),
    doc('evidence', 'good', { title: 'Public source', source: 'https://example.com/research?a=1&b=2', classification: 'estimate', verification: 'unverified' }),
  ]);
  const html = exportBusinessPlan(ctx);
  assert.match(html, /^<!doctype html><html lang="en">/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /&lt;img src=x onerror=alert\(2\)&gt;/);
  assert.match(html, /href="https:\/\/example\.com\/research\?a=1&amp;b=2"/);
  assert.doesNotMatch(html, /<script|<img|<svg|href="javascript:|href="https:\/\/secret@/);
  assert.doesNotMatch(html, /<button|data-action=/);
  assert.match(html, /Do not treat as independently verified support/);
});

test('research, marketing decision rules, task evidence and milestones are present with traceable record references', () => {
  const ctx = context([
    doc('settings', 'settings', { monthMilestones: 'Month 3: review actual pilot margin and callbacks' }),
    doc('customer-research', 'conversation-1', { name: 'Homeowner interview', problem: 'Slow response', findings: 'Availability matters', objections: 'Unclear charges', nextAction: 'Validate offer', source: 'Interview note', observedOn: '2026-10-19' }),
    doc('competitor', 'competitor-1', { name: 'Observed contractor', strengths: 'Clear scheduling', weaknesses: 'Price unclear', source: 'https://example.com/' }),
    doc('experiment', 'trial-1', { title: 'Referral pilot', offer: 'A defined diagnostic visit', message: 'Clear scheduling', owner: 'growth', continueRule: 'Contribution covers acquisition', changeRule: 'Rework offer if quotes stall', stopRule: 'Pause when capacity is unavailable', responseStandard: 'Reply within agreed service hours' }),
    row('task', 'task-1', { title: 'Check delivery coverage', owner: 'christian', start: 1, duration: 2, dueDate: '2026-11-02', evidence: 'Written availability', metric: 'Covered weekday hours', target: 'Agreed operating hours', budget: 0, reportingDate: '2026-10-26' }),
  ]);
  const html = renderBusinessPlan(ctx);
  for (const text of ['Availability matters', 'Price unclear', 'Contribution covers acquisition', 'Rework offer if quotes stall', 'Pause when capacity is unavailable', 'Written availability', 'Covered weekday hours', '2026-10-26', '[customer-research:conversation-1]', '[competitor:competitor-1]', '[experiment:trial-1]', '[task:task-1]']) assert.ok(html.includes(text), text);
  assert.match(html, /Month 3: review actual pilot margin and callbacks/);
  const tasksStart = html.indexOf('10. Thirteen-week execution schedule');
  assert.ok(!html.slice(tasksStart).includes('Referral pilot'), 'Planning documents must not masquerade as execution tasks.');
});

test('financial output distinguishes unknown, zero, negative contribution, profit and cash without fabricated break-even', () => {
  const settings = { baseMonthlyOverhead: 100, baseMonthlyCompensation: 0, baseMonthlyMarketing: 0, baseMonthlyUnpaidOwnerHours: 0, baseUnpaidOwnerHourlyValue: 0, baseOpeningCash: 0, baseStartupCostsReviewed: 'yes' };
  const job = { id: 'repair', scenario: 'base', title: 'Repair estimate', salePrice: 100, paidLabor: 120, materials: 0, subcontractors: 0, travel: 0, paymentFees: 0, callbackAllowance: 0, allocatedAcquisition: 0, unpaidOwnerHours: 0, unpaidOwnerHourlyValue: 0, mixWeight: 1 };
  const base = calculateFinance({ settings, jobs: [job] });
  const ctx = { ...context(), finance: { base, downside: calculateFinance({}, 'downside') } };
  const html = renderBusinessPlan(ctx);
  assert.match(html, /Contribution is zero or negative/);
  assert.match(html, /-\$20\.00/);
  assert.match(html, /\$0\.00/);
  assert.match(html, /Downside case/);
  assert.match(html, /Financial assumptions and service models are missing/);
  assert.match(html, /Revenue, operating profit and cash collections are different measures/);
  assert.match(html, /Not calculated/);
  assert.doesNotMatch(html, /Infinity|NaN/);
});

test('standalone and text exports are deterministic, preserve sources and never mutate source records', () => {
  const ctx = context([doc('settings', 'settings', { objectives: 'Measure A&B outcomes' }), row('response', 'growth:three_year', { value: 'A sustainable service company', explanation: 'With reviewed capacity' })]);
  const before = structuredClone(ctx);
  const first = exportBusinessPlan(ctx);
  assert.equal(exportBusinessPlan(ctx), first);
  const text = planText(ctx);
  assert.match(text, /Measure A&B outcomes/);
  assert.match(text, /\[response:growth:three_year\]/);
  assert.doesNotMatch(text, /<article|&amp;/);
  assert.deepEqual(ctx, before);
});

test('generated plan uses current derived task deadlines, saved financial source notes and attributed experiment results', () => {
  const ctx = context([
    row('task', 'task-week-1', { title: 'Confirm the operating schedule', owner: 'christian', start: 1, duration: 1, status: 'not-started' }),
    doc('finance-settings', 'settings', { forecastStartDate: '2026-10-19', notes: 'Cash balance still needs Christian’s bank reconciliation' }),
    doc('job-model', 'cost-1', { title: 'Diagnostic model', scenario: 'base', materials: '15', notes: 'Supplier quote dated October 19' }),
    doc('startup-cost', 'tools', { title: 'Diagnostic tools', scenario: 'base', amount: '500', paymentDate: '2026-11-01', notes: 'Vendor quote, not yet approved' }),
    doc('experiment', 'referral', { title: 'Referral test', spend: '100', budget: '300', timeLimit: 'Two hours weekly', reportingDate: '2026-10-19' }),
    row('opportunity', 'actual-lead', { id: 'actual-lead', experimentId: 'referral', inquiryDate: '2026-10-18', customerId: 'customer-1', stage: 'Paid', cashCollected: '400', invoiceAmount: '400', directCost: '200' }),
    row('opportunity', 'other-lead', { id: 'other-lead', experimentId: 'other', inquiryDate: '2026-10-18', stage: 'Paid', cashCollected: '900', invoiceAmount: '900', directCost: '100' }),
  ]);
  ctx.tasks = [{ ...ctx.records['task|task-week-1'].body, id: 'task-week-1', dueDate: '2026-10-25' }];
  const html = exportBusinessPlan(ctx);
  for (const required of ['2026-10-25', 'Cash balance still needs Christian’s bank reconciliation', 'Supplier quote dated October 19', 'Vendor quote, not yet approved', 'Two hours weekly', '1 inquiries · 1 qualified · 1 quotes · 1 accepted jobs.', 'Cash collected: $400.00', 'Cost per paying customer: $100.00', 'Quote conversion: 100.0%']) assert.ok(html.includes(required), required);
  assert.doesNotMatch(html, /Cash collected: \$1,300\.00/);
});

test('dashboard preserves missing amounts and text-only delivery alternatives while showing actionable ownership and dependencies', () => {
  const ctx = context([
    row('response', 'christian:site_supervision', { value: '', explanation: 'A weekday qualified technician is still needed' }),
    doc('proposal', 'mandate', { title: 'Operating authority', direction: 'Proposed limited scope', conditions: 'Technical approval retained', evidenceIds: [] }),
    doc('evidence', 'capacity', { title: 'Weekday coverage', classification: 'unknown', verification: 'unverified', owner: 'christian', researchDue: '2026-10-22', relatedDecision: 'Operating authority' }),
  ]);
  ctx.tasks = [
    { id: 'finished', title: 'Already completed work', owner: 'christian', dueDate: '2026-10-18', status: 'completed' },
    { id: 'coverage', title: 'Get written availability', owner: 'christian', dueDate: '2026-10-22', status: 'in-progress', depends: 'finished', metric: 'Covered operating hours' },
    { id: 'offer', title: 'Define a costed offer', owner: 'growth', dueDate: '2026-10-23', status: 'not-started', depends: 'coverage' },
  ];
  const proposal = planningRecords(ctx.records, 'proposal')[0];
  const voteId = 'christian:confirm:mandate';
  ctx.records[`vote|${voteId}`] = row('vote', voteId, { seat: 'christian', proposalId: 'mandate', choice: 'confirmed', respondent_uid: 'user-christian', confirmedAt: '2026-10-19T14:00:00Z', snapshot: canonicalProposal(proposal, ctx.records) });
  const before = structuredClone(ctx);
  const html = planningDashboard(ctx);
  assert.match(html, /A weekday qualified technician is still needed/);
  assert.match(html, /Current confirmation needed from: Debynyhan Banks\./);
  assert.doesNotMatch(html, /Current confirmation needed from: Christian Okoh/);
  assert.match(html, /Dependency: Already completed work · recorded completed/);
  assert.match(html, /Dependency: Get written availability · still open/);
  assert.match(html, /Recorded callbacks/);
  assert.match(html, /Not reported/);
  assert.doesNotMatch(html, /\$0\.00/);
  assert.match(html, /does not replace both partners’ confirmations/);
  assert.deepEqual(ctx, before);
});

test('dashboard connects actual experiment results to business totals without treating deposits as unpaid invoice offsets', () => {
  const ctx = context([
    doc('experiment', 'test', { title: 'Referral pilot', owner: 'growth', spend: '100', reportingDate: '2026-10-19' }),
    row('opportunity', 'quote', { id: 'quote', experimentId: 'test', stage: 'Submitted', inquiryDate: '2026-10-18', cashCollected: '0', callbacks: '0' }),
    row('opportunity', 'invoice', { id: 'invoice', experimentId: 'test', customerId: 'a', stage: 'Invoiced', invoiceAmount: '1000', cashCollected: '200', directCost: '500', callbacks: '' }),
    row('opportunity', 'deposit', { id: 'deposit', experimentId: 'other', stage: 'Accepted', cashCollected: '5000', callbacks: '' }),
  ]);
  const html = planningDashboard(ctx);
  assert.match(html, /\$800\.00/);
  assert.match(html, /\$5,200\.00/);
  assert.match(html, /66\.7%/);
  assert.match(html, /50\.0%/);
  assert.match(html, /Referral pilot/);
  assert.match(html, /\$100\.00/);
  assert.match(html, /Callback entries are missing/);
  const unknownInvoice = structuredClone(ctx);
  unknownInvoice.records['opportunity|invoice'].body.cashCollected = '';
  const changed = planningDashboard(unknownInvoice);
  assert.doesNotMatch(changed, /\$800\.00/);
  assert.match(changed, /Cash-collection amounts are missing/);
});

test('essential discovery includes both partners’ services and customers plus quote approval, with valid routing', () => {
  for (const seat of ['christian', 'growth']) {
    for (const id of ['preferred_services', 'target_markets', 'technical_signoff']) assert.ok(ESSENTIAL_QUESTIONS[seat].includes(id), `${seat} needs ${id}`);
    for (const id of ESSENTIAL_QUESTIONS[seat]) {
      const question = QUESTIONS.find(item => item.id === id);
      assert.ok(question, id);
      assert.ok(question.audience === seat || question.audience === 'both', `${id} must belong to ${seat}`);
    }
  }
  const form = getPlanningForm('experiment');
  assert.match(form.fields.find(field => field.key === 'status').hint, /does not replace both partners’ confirmations/);
});

test('strategic brief includes selected segment, trade-offs, review triggers and exact-version confirmation dates', () => {
  const ctx = context([
    doc('segment', 'homeowners', { id: 'homeowners', title: 'Homeowners with planned replacement needs', problem: 'An aging system and uncertain replacement costs', evidenceIds: ['interviews'] }),
    doc('evidence', 'interviews', { id: 'interviews', title: 'Customer conversation notes', source: 'Private interview notes', classification: 'estimate', verification: 'unverified' }),
    doc('strategy-brief', 'strategy-brief', { id: 'strategy-brief', title: 'Our proposed launch strategy', objectives: 'Validate delivery and job economics', measures: 'Contribution, paid jobs and callback hours', selectedSegmentId: 'homeowners', customerProblem: 'Clear replacement choices', initialOffer: 'A scoped replacement consultation', positioning: 'A reviewed proposal with clear scheduling', advantage: 'Supported advantage still needs evidence', alternatives: 'Compare service calls and small commercial work', tradeoffs: 'Limit territory while capacity is constrained', operatingModel: 'Technical review by Christian', fundingNeeds: 'Supplier terms to verify', marketingApproach: 'A bounded referral test', risks: 'Weekday technical coverage', contingencies: 'Pause offers without coverage', executionPriorities: 'Confirm available hours', commercialMilestones: 'Document commercial bid requirements', reviewDate: '2026-11-02', changeTriggers: 'Change direction if capacity or unit contribution is inadequate', sourceRefs: ['segment:homeowners'] }),
  ]);
  const brief = planningRecords(ctx.records, 'strategy-brief')[0];
  confirmed(ctx, brief);
  const before = structuredClone(ctx);
  const html = exportBusinessPlan(ctx);
  for (const expected of ['Homeowners with planned replacement needs', 'Alternatives considered', 'Compare service calls and small commercial work', 'Strategic trade-offs', 'Limit territory while capacity is constrained', '2026-11-02', 'Change direction if capacity or unit contribution is inadequate', '[strategy-brief:strategy-brief]', '[segment:homeowners]', 'Christian Okoh: confirmed 2026-10-19T14:00:00Z', 'Debynyhan Banks: confirmed 2026-10-19T14:00:00Z']) assert.ok(html.includes(expected), expected);
  assert.match(html, /Confirmed jointly for this saved version/);
  assert.deepEqual(ctx, before);
  ctx.records['task|interviews'].body.source = 'Updated interview findings';
  const changed = exportBusinessPlan(ctx);
  assert.doesNotMatch(changed, /Confirmed jointly for this saved version/);
  assert.match(changed, /Prior confirmations no longer match/);
});

test('charter and website requirements export as private drafts with original partner inputs kept separate', () => {
  const ctx = context([
    row('response', 'christian:business_mandate', { value: 'Christian’s original mandate answer' }),
    doc('charter', 'charter', { id: 'charter', christianTitle: 'President — description to confirm', christianResponsibilities: 'Technical review', growthTitle: 'Debynyhan’s intended role', growthResponsibilities: 'Organize the business', mandate: 'A proposed operating arrangement', decisionLimits: 'Spending thresholds undecided', backup: 'Qualified weekday backup not yet confirmed', reviewDate: '2026-11-02', sourceRefs: ['response:christian:business_mandate'] }),
    doc('website-brief', 'website-brief', { id: 'website-brief', audience: 'Selected customer segment', goal: 'Qualified service inquiries', domain: 'Branded domain to agree', services: 'Only verified deliverable services', hours: 'Actual coverage still needs confirmation', companyProjects: 'Company examples require verification', christianExperience: 'Christian’s individual HVAC experience', testimonialPermissions: 'Written permission required', responseWorkflow: 'Debynyhan qualifies, Christian reviews technical scope', measurement: 'Inquiry through paid job' }),
    doc('website-page', 'service', { id: 'service', title: 'Residential services page', audience: 'Selected homeowners', offer: 'Scoped service offer', action: 'Request a service conversation', proof: 'Verified credential and permissioned example', owner: 'growth', sourceRefs: ['website-brief:website-brief'] }),
  ]);
  const html = exportBusinessPlan(ctx);
  for (const expected of ['Business planning record', 'Christian’s original mandate answer', 'A proposed operating arrangement', 'Spending thresholds undecided', '[charter:charter]', 'Private website requirements', 'Christian’s individual HVAC experience', 'Company examples require verification', 'Request a service conversation', '[website-page:service]', '[website-brief:website-brief]']) assert.ok(html.includes(expected), expected);
  assert.doesNotMatch(html, /Confirmed jointly for this saved version|<button|data-plan-new=/);
});

test('new strategic drafting fields are escaped and export does not fabricate selected segments or confirmations', () => {
  const ctx = context([
    doc('strategy-brief', 'strategy-brief', { id: 'strategy-brief', title: '<svg onload=alert(1)>', selectedSegmentId: 'missing', customerProblem: '<script>bad</script>', status: 'confirmed', sourceRefs: ['segment:missing'] }),
    doc('website-page', 'bad', { id: 'bad', title: '<img src=x onerror=alert(2)>', action: 'A&B' }),
  ]);
  const html = exportBusinessPlan(ctx);
  assert.match(html, /Selected segment record missing/);
  assert.match(html, /Missing linked sources: segment:missing/);
  assert.match(html, /&lt;script&gt;bad&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script|<svg|<img|Confirmed jointly for this saved version/);
});

test('an incomplete strategic brief cannot appear jointly ready in an export even if matching votes were stored', () => {
  const ctx = context([doc('strategy-brief', 'strategy-brief', { id: 'strategy-brief', title: 'Still being discussed', sourceRefs: [], objectives: 'Unknown' })]);
  confirmed(ctx, planningRecords(ctx.records, 'strategy-brief')[0]);
  const html = exportBusinessPlan(ctx);
  assert.doesNotMatch(html, /Confirmed jointly for this saved version/);
  assert.match(html, /Clarify business objectives before confirming/);
  assert.match(html, /Draft proposal — current partner confirmations needed/);
});

test('private plan exports capacity limitations and frozen-baseline comparisons with honest partial-period treatment', () => {
  const ctx = context([
    doc('capacity-person', 'christian', { id: 'christian', name: 'Christian Okoh', seat: 'christian', qualificationStatus: 'proposed', active: 'yes' }),
    doc('capacity-week', 'week', { id: 'week', personId: 'christian', weekStart: '2026-10-19', availabilityStatus: 'proposed', allocationBasis: 'whole-week', availableHours: '8', fieldHours: '4', travelHours: '1', estimatingHours: '1', adminHours: '0', supportHours: '0', supervisionHours: '1', callbackHours: '1' }),
    doc('forecast-baseline', 'original', { id: 'original', title: 'Original cash expectation', scenario: 'base', capturedAt: '2026-10-19T12:00:00Z', sourceRefs: ['cash-week:source'], inputs: [{ customerReceipts: 100 }], forecast: { cash: { periods: [{ startDate: '2026-10-19', endDate: '2026-10-25', inputs: { customerReceipts: 100 }, inflows: 100, outflows: 50, change: 50 }] } } }),
    doc('actual-period', 'week-results', { id: 'week-results', title: 'Week one collections review', periodKind: 'cash-week', startDate: '2026-10-19', endDate: '2026-10-25', reportingDate: '2026-10-25', coverage: 'complete', sourceMode: 'manual', customerReceipts: 80, otherInflows: 0, jobPayments: 30, overheadPayments: 0, compensationPayments: 0, marketingPayments: 0, startupPayments: 0, otherPayments: 0, explanation: 'One customer payment arrived later', correctiveAction: 'Confirm the remaining payment date', owner: 'growth', reviewDate: '2026-10-27' }),
  ]);
  const html = exportBusinessPlan(ctx);
  for (const expected of ['Proposed availability does not count as confirmed capacity', 'Christian Okoh', 'technical coverage is unverified', '[capacity-week:week]', 'Original cash expectation', '[forecast-baseline:original]', '2026-10-19T12:00:00Z', 'Week one collections review', 'One customer payment arrived later', 'Confirm the remaining payment date', '2026-10-27', '-20%']) assert.ok(html.includes(expected), expected);
  const partial = structuredClone(ctx);
  partial.records['task|week-results'].body.coverage = 'partial';
  const changed = exportBusinessPlan(partial);
  assert.match(changed, /Incomplete or incompatible reporting/);
  assert.match(changed, /Not comparable/);
  assert.doesNotMatch(changed, /-20%/);
});
