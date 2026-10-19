import { planningRecords, confirmationStatus, canonicalProposal, planningSourceRefs } from './planning-model.js';
import { getResponse, responseAnswered, questionsForSeat, questionText, questionStatus } from './discovery-model.js';
import { findQuestionResearchTask } from './execution-model.js';
import { calculateCapacity } from './capacity-model.js';
import { calculateFinance } from './finance-model.js';

const SEATS = { christian: 'Christian Okoh', growth: 'Debynyhan Banks' };
const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const opt = (value, label) => ({ value, label });
const field = (key, label, type = 'text', extra = {}) => ({ key, label, type, ...extra });
const ownerOptions = [opt('', 'Choose one accountable owner'), ...Object.entries(SEATS).map(([value, label]) => opt(value, label))];
const ownerField = () => field('owner', 'Accountable owner', 'select', { required: true, options: ownerOptions });
const text = (value, empty = 'Not recorded') => value === undefined || value === null || String(value).trim() === '' ? `<span class="unanswered">${esc(empty)}</span>` : esc(Array.isArray(value) ? value.join(', ') : value);
const docs = (ctx, type) => planningRecords(ctx.records, type);
const labelFor = row => row.title || row.name || row.personName || row.id;
const edit = (type, row, label = 'Edit draft') => `<button class="btn small" data-plan-edit="${esc(type)}" data-plan-id="${esc(row.id)}">${esc(label)}</button>`;
const add = (type, label, id = '') => `<button class="btn primary" data-plan-new="${esc(type)}"${id ? ` data-plan-id="${esc(id)}"` : ''}>${esc(label)}</button>`;
const viewButton = (view, label) => `<button class="btn small" data-view="${esc(view)}">${esc(label)}</button>`;
const title = (heading, intro, actions = '') => `<div class="heading-line"><div><span class="eyebrow">Our strategy in practice</span><h1>${esc(heading)}</h1><p class="subhead">${esc(intro)}</p></div><div class="button-row">${actions}</div></div>`;
const note = message => `<div class="info-note">${esc(message)}</div>`;
const facts = (row, entries) => `<dl class="planning-facts">${entries.map(([key, label]) => `<div><dt>${esc(label)}</dt><dd>${text(row[key])}</dd></div>`).join('')}</dl>`;
const listOrUnknown = (rows, render, message) => rows.length ? rows.map(render).join('') : `<p class="unanswered">${esc(message)}</p>`;

export const STRATEGY_PHASES = [
  {
    id: 'working-arrangement', title: 'Working arrangement & delivery capacity', view: 'charter', formType: 'charter', formId: 'charter',
    why: 'Before I take on the business work, we need to understand the authority, technical support, time and resources we can actually rely on.',
    constrained: 'Delegated work, customer commitments and service-hour promises remain constrained until we review authority and technical coverage.',
    dependencies: [],
    christian: ['partner_role_title', 'business_mandate', 'site_supervision', 'weekly_time', 'technical_signoff', 'compensation_expectations'],
    growth: ['partner_role_title', 'weekly_time', 'business_readiness', 'compensation_expectations'],
  },
  {
    id: 'customer-evidence', title: 'Customer & competitor evidence', view: 'research', formType: 'customer-research',
    why: 'Customer conversations and relevant competitors help us test who needs our offer and why they might choose us.',
    constrained: 'Demand, reachable customers, buying criteria and claims of advantage remain assumptions until supported by evidence.',
    dependencies: ['working-arrangement'], christian: ['past_contacts', 'completed_project', 'special_capabilities'], growth: ['customer_acquisition'],
  },
  {
    id: 'segment-offer', title: 'Launch segment & offer', view: 'segments', formType: 'segment',
    why: 'We need a focused first customer and offer that fit our actual ability to deliver, while keeping longer-term commercial growth visible.',
    constrained: 'A launch choice remains a proposal until we review customer evidence, capability, capacity and cash requirements together.',
    dependencies: ['working-arrangement', 'customer-evidence'], christian: ['target_markets', 'preferred_services', 'residential_first', 'launch_gates'], growth: ['target_markets', 'preferred_services', 'growth_strategy'],
  },
  {
    id: 'economics-funding', title: 'Economics & funding', view: 'finance', formType: 'finance-settings', formId: 'settings',
    why: 'The first jobs must support their own costs, our working arrangement and the cash needed to deliver them.',
    constrained: 'Pricing, spending and growth forecasts remain incomplete when costs, compensation, available cash or collection timing are unknown.',
    dependencies: ['working-arrangement', 'segment-offer'], christian: ['capital_available', 'financial_risk', 'spending_approval'], growth: ['startup_economics', 'financial_risk', 'cash_requirements'],
  },
  {
    id: 'marketing-website', title: 'Marketing & website requirements', view: 'website', formType: 'website-brief', formId: 'website-brief',
    why: 'Our message, customer journey and future public website should make a credible promise to the customers we decide to serve.',
    constrained: 'A public service promise or marketing test needs supported claims, a response owner and an offer we can deliver.',
    dependencies: ['segment-offer', 'economics-funding'], christian: ['marketing_assets', 'brand_position'], growth: ['website_priority', 'brand_position', 'systems_workflow'],
  },
  {
    id: 'execution-review', title: 'Execution & performance review', view: 'performance', formType: 'strategy-brief', formId: 'strategy-brief',
    why: 'A useful strategy becomes owned work, measured results and explicit decisions about what we should continue or change.',
    constrained: 'Forecasts are planning estimates; unreported activity cannot establish actual performance or business readiness.',
    dependencies: ['working-arrangement', 'segment-offer', 'economics-funding', 'marketing-website'], christian: ['first_actions', 'meeting_rhythm'], growth: ['first_actions', 'growth_execution', 'meeting_rhythm'],
  },
];

const SOURCE_TYPES = ['evidence', 'customer-research', 'competitor', 'launch-option', 'segment', 'job-model', 'finance-settings', 'cash-week', 'operating-month', 'experiment', 'charter', 'capacity-person', 'capacity-week', 'service-capacity', 'demand-week', 'forecast-baseline', 'actual-period', 'job-actual', 'proposal', 'website-brief', 'website-page', 'strategy-brief'];
const VIEW_FOR_TYPE = { evidence: 'evidence', 'customer-research': 'research', competitor: 'research', 'launch-option': 'launch', segment: 'segments', 'job-model': 'finance', 'finance-settings': 'finance', 'cash-week': 'finance', 'operating-month': 'finance', experiment: 'marketing', charter: 'charter', 'capacity-person': 'capacity', 'capacity-week': 'capacity', 'service-capacity': 'capacity', 'demand-week': 'capacity', 'forecast-baseline': 'performance', 'actual-period': 'performance', 'job-actual': 'performance', proposal: 'decisions', 'website-brief': 'website', 'website-page': 'website', 'strategy-brief': 'plan', task: 'tasks' };

function responseRefs(ctx, ids) {
  return Object.keys(SEATS).flatMap(seat => questionsForSeat(ctx.questions, seat).filter(question => (!ids || ids.includes(question.id)) && responseAnswered(getResponse(ctx.records, seat, question.id))).map(question => ({ ref: `response:${seat}:${question.id}`, seat, question, response: getResponse(ctx.records, seat, question.id) })));
}

function sourceOptions(ctx, excludeType, excludeId) {
  return [
    ...responseRefs(ctx).map(source => opt(source.ref, `${SEATS[source.seat]} · ${questionText(source.question, source.seat)}`)),
    ...SOURCE_TYPES.flatMap(type => docs(ctx, type).filter(row => type !== excludeType || row.id !== excludeId).map(row => opt(`${type}:${row.id}`, `${type} · ${labelFor(row)}`))),
  ];
}

function sourceFields(ctx, type, id) {
  return [
    field('sourceRefs', 'Linked discovery answers and planning records', 'multiselect', { options: sourceOptions(ctx, type, id), hint: 'Link the current sources we relied on. Their content is included when we confirm a shared charter or strategic brief.' }),
    field('evidenceIds', 'Supporting evidence records', 'multiselect', { options: docs(ctx, 'evidence').map(row => opt(row.id, labelFor(row))) }),
  ];
}

function recordSelect(ctx, type, label, key, multiple = true) {
  return field(key, label, multiple ? 'multiselect' : 'select', { allowMissing: true, options: [...(multiple ? [] : [opt('', 'Not selected')]), ...docs(ctx, type).map(row => opt(row.id, labelFor(row)))] });
}

export function getStrategyForm(type, row = {}, ctx = { records: {}, questions: [] }) {
  const initial = { ...row };
  let fields = [], formTitle = '', id = row.id;
  if (type === 'strategy-step') {
    const phase = STRATEGY_PHASES.find(item => item.id === row.id);
    formTitle = `${phase?.title || 'Strategy decision'} — planning notes`;
    fields = [ownerField(), field('dueDate', 'Proposed decision / review deadline', 'date'), field('status', 'Working status', 'select', { options: [opt('draft', 'Draft — still gathering inputs'), opt('in-progress', 'In progress — actively reviewing'), opt('deferred', 'Deferred — reason required')] }), field('direction', 'Proposed direction', 'textarea'), field('alternatives', 'Alternatives we should consider', 'textarea'), field('assumptions', 'Unresolved assumptions and their consequences', 'textarea'), field('deferredReason', 'If deferred, why and what will bring us back to it?', 'textarea'), field('reviewDate', 'Next review date', 'date'), recordSelect(ctx, 'proposal', 'Linked joint decision proposal', 'proposalId', false), ...sourceFields(ctx, type, id)];
    initial.status ??= 'draft';
  } else if (type === 'charter') {
    id = 'charter'; formTitle = 'Our proposed operating charter';
    fields = [
      field('title', 'Charter title', 'text', { required: true }),
      field('christianTitle', 'Christian — intended title'), field('christianResponsibilities', 'Christian — responsibilities and boundaries', 'textarea'), field('christianAvailability', 'Christian — weekly availability and response windows', 'textarea'), field('christianUnavailable', 'Christian — unavailable hours, weeks and other constraints', 'textarea'),
      field('growthTitle', 'Debynyhan Banks — intended title'), field('growthResponsibilities', 'Debynyhan Banks — responsibilities and boundaries', 'textarea'), field('growthAvailability', 'Debynyhan Banks — weekly availability and response windows', 'textarea'), field('growthUnavailable', 'Debynyhan Banks — unavailable hours, weeks and other constraints', 'textarea'),
      field('mandate', 'What Christian is asking me to accomplish and run', 'textarea'), field('decisionLimits', 'What I can decide independently; what requires consultation or both approvals', 'textarea'), field('technicalReview', 'Technical review owner, scope and turnaround', 'textarea'), field('supervision', 'Qualified supervision and support while Christian is working', 'textarea'),
      field('quoteAuthority', 'Who prepares, reviews, changes and releases quotes; thresholds', 'textarea'), field('purchasingAuthority', 'Purchasing and borrowing authority; limits and approval records', 'textarea'), field('hiringAuthority', 'Hiring and subcontractor authority', 'textarea'), field('contractAuthority', 'Contract, customer commitment and change-order authority', 'textarea'),
      field('christianCompensation', 'Christian — proposed pay, reimbursement and distribution expectations', 'textarea'), field('growthCompensation', 'Debynyhan Banks — proposed pay, reimbursement and distribution expectations', 'textarea'), field('contributions', 'Proposed cash, equipment and unpaid-time contributions; ownership questions', 'textarea'),
      field('customerResponse', 'Customer response owner, operating hours and backup', 'textarea'), field('scheduling', 'Scheduling and handoff responsibilities', 'textarea'), field('fieldCoverage', 'Field delivery and qualified technical coverage', 'textarea'), field('backup', 'Backup coverage when someone is unavailable', 'textarea'), field('quality', 'Quality checks and evidence before completion', 'textarea'), field('callbacks', 'Callback and warranty ownership', 'textarea'), field('escalation', 'Urgent escalation, disagreements and unavailable-partner decisions', 'textarea'), field('reporting', 'Reporting, meeting rhythm and review measures', 'textarea'), ownerField(), field('reviewDate', 'Review this working arrangement on', 'date'), ...sourceFields(ctx, type, id),
    ];
    initial.title ??= 'Our proposed working arrangement';
  } else if (type === 'segment') {
    formTitle = 'Customer segment & first offer';
    fields = [field('title', 'Specific customer segment', 'text', { required: true }), field('customer', 'Customer, buyer and decision-maker', 'textarea'), field('problem', 'HVAC problem and its consequence', 'textarea'), field('trigger', 'Buying trigger and urgency'), field('geography', 'Geography and reachable service area'), field('serviceExpectations', 'Service hours, response and customer expectations', 'textarea'), field('buyingProcess', 'Purchasing, approval and selection process', 'textarea'), field('alternatives', 'Current alternatives and competitors', 'textarea'), field('reachableMarket', 'Reachable-market assumptions and how we will verify them', 'textarea'), field('offer', 'Proposed offer and scope', 'textarea'), field('exclusions', 'What this offer excludes', 'textarea'), field('priceApproach', 'Price approach and source of the estimate', 'textarea'), field('promise', 'Customer promise and supporting proof', 'textarea'), field('acquisition', 'Acquisition channel, effort and cost assumptions', 'textarea'), field('deliveryRequirements', 'Delivery, equipment, technical and supervision requirements', 'textarea'), field('capacityFit', 'How the offer fits our actual capacity', 'textarea'), field('jobContribution', 'Expected job contribution and unresolved cost inputs', 'textarea'), field('paymentTiming', 'Deposits, invoicing, collections and cash needed before payment', 'textarea'), field('risks', 'Risks and unknowns', 'textarea'), field('changeEvidence', 'Evidence that would change our view or stop a test', 'textarea'),
      ...['capability', 'capacity', 'cash'].map(key => field(`${key}Status`, `${key === 'capability' ? 'Required technical capability' : key === 'capacity' ? 'Required delivery capacity' : 'Required cash coverage'} — review status`, 'select', { options: [opt('unknown', 'Unknown — evidence needed'), opt('met', 'Reported met — verify supporting sources'), opt('not-met', 'Not met — constraint to resolve')] })), field('constraintNotes', 'Who checked each constraint, when, and against which evidence?', 'textarea'), ownerField(), field('reviewDate', 'Review date', 'date'), recordSelect(ctx, 'customer-research', 'Linked customer research', 'researchIds'), recordSelect(ctx, 'competitor', 'Linked competitor observations', 'competitorIds'), recordSelect(ctx, 'launch-option', 'Linked launch options', 'launchOptionIds'), recordSelect(ctx, 'job-model', 'Linked job-cost models', 'jobModelIds'), recordSelect(ctx, 'experiment', 'Linked marketing experiments', 'experimentIds'), ...sourceFields(ctx, type, id)];
    for (const key of ['capabilityStatus', 'capacityStatus', 'cashStatus']) initial[key] ??= 'unknown';
  } else if (type === 'website-brief') {
    id = 'website-brief'; formTitle = 'Our future customer website — private implementation brief';
    fields = [field('title', 'Brief title', 'text', { required: true }), recordSelect(ctx, 'segment', 'Primary customer segment', 'segmentId', false), field('audience', 'Intended audience and its main problem', 'textarea'), field('primaryGoal', 'Primary website goal and customer action', 'textarea'), field('brand', 'Company name and brand details requiring confirmation', 'textarea'), field('domain', 'Proposed company domain and ownership status'), field('contact', 'Business contact details and what still needs confirmation', 'textarea'), field('services', 'Services we propose to advertise', 'textarea'), field('exclusions', 'Services or promises we must exclude', 'textarea'), field('geography', 'Verified service area'), field('hours', 'Actual operating and response hours'), field('positioning', 'Positioning and customer promise', 'textarea'), field('credentials', 'Credentials, verification source, date and approved wording', 'textarea'), field('companyHistory', 'C.F. Mechanical’s own completed work and evidence', 'textarea'), field('christianExperience', 'Christian’s individual HVAC experience, clearly attributed', 'textarea'), field('projectExamples', 'Authentic examples, photo rights and permission status', 'textarea'), field('testimonials', 'Testimonials, consent and exact approved wording', 'textarea'), field('pages', 'Proposed page structure and priorities', 'textarea'), field('callsToAction', 'Primary and supporting calls to action', 'textarea'), field('qualification', 'Inquiry questions, suitable work and referral / decline process', 'textarea'), field('responseWorkflow', 'Who receives inquiries, response target, follow-up and backup', 'textarea'), field('contentOwner', 'Content owner', 'select', { options: ownerOptions }), field('technicalReviewer', 'Technical review owner and approval workflow', 'textarea'), field('maintenance', 'Update owner, cadence and source review process', 'textarea'), field('searchTopics', 'Search topics based on customer problems and location', 'textarea'), field('measurement', 'How inquiries connect to quotes, completed work, contribution and cash', 'textarea'), field('publicationConditions', 'Conditions and approvals needed before building or publishing', 'textarea'), ownerField(), field('reviewDate', 'Brief review date', 'date'), ...sourceFields(ctx, type, id)];
    initial.title ??= 'C.F. Mechanical customer website brief';
  } else if (type === 'website-page') {
    formTitle = 'Proposed website page or campaign';
    fields = [field('title', 'Page or campaign title', 'text', { required: true }), field('format', 'Item type', 'select', { options: [opt('page', 'Website page'), opt('campaign', 'Marketing campaign / landing page')] }), recordSelect(ctx, 'segment', 'Linked customer segment', 'segmentId', false), field('audience', 'Audience and buying stage', 'textarea'), field('customerProblem', 'Customer question or problem this addresses', 'textarea'), field('offer', 'Offer and exclusions', 'textarea'), field('proof', 'Supporting proof and approval status', 'textarea'), field('action', 'Intended customer action'), field('response', 'What happens after the customer acts; response owner', 'textarea'), field('searchTopic', 'Customer search question / topic'), field('measurement', 'Success measure and connection to the revenue pipeline', 'textarea'), ownerField(), field('status', 'Content status', 'select', { options: [opt('proposed', 'Proposed'), opt('draft', 'Draft'), opt('needs-evidence', 'Needs evidence or permission'), opt('ready-for-review', 'Ready for partner review')] }), recordSelect(ctx, 'experiment', 'Linked marketing experiment', 'experimentId', false), ...sourceFields(ctx, type, id)];
    initial.format ??= 'page'; initial.status ??= 'proposed';
  } else if (type === 'strategy-brief') {
    id = 'strategy-brief'; formTitle = 'Our proposed strategic direction';
    fields = [field('title', 'Strategic brief title', 'text', { required: true }), field('objectives', 'Business objectives', 'textarea'), field('measures', 'Measures, targets, timeframe and source of each measure', 'textarea'), recordSelect(ctx, 'segment', 'Proposed initial customer segment', 'selectedSegmentId', false), field('customerProblem', 'Customer problem we will address', 'textarea'), field('initialOffer', 'Initial offer, boundaries and price approach', 'textarea'), field('positioning', 'How we want the chosen customer to understand C.F. Mechanical', 'textarea'), field('advantage', 'Supported reason to choose us and how we deliver it', 'textarea'), field('alternatives', 'Alternatives we considered', 'textarea'), field('tradeoffs', 'Strategic trade-offs and what we will postpone or decline', 'textarea'), field('operatingModel', 'Responsibilities, technical support and feasible delivery model', 'textarea'), field('fundingNeeds', 'Economic assumptions, funding needs and remaining unknowns', 'textarea'), field('marketingApproach', 'Acquisition, response and sales approach', 'textarea'), field('risks', 'Risks and dependencies', 'textarea'), field('contingencies', 'Contingency actions and who owns them', 'textarea'), field('executionPriorities', 'Thirteen-week execution priorities and linked work', 'textarea'), field('commercialMilestones', 'Longer-term commercial capability milestones', 'textarea'), field('reviewDate', 'Strategy review date', 'date'), field('changeTriggers', 'Results or evidence that would cause us to change strategy', 'textarea'), ownerField(), ...sourceFields(ctx, type, id)];
    initial.title ??= 'Our proposed strategy for C.F. Mechanical';
  } else return null;
  return { type, id, title: formTitle, fields, initial: { ...initial, ...(id ? { id } : {}) } };
}

export function validateStrategyRecord(type, row = {}, ctx = { records: {}, questions: [] }) {
  const form = getStrategyForm(type, row, ctx);
  if (!form) return [];
  const issues = [];
  if (['charter', 'website-brief', 'strategy-brief'].includes(type) && row.id !== ({ charter: 'charter', 'website-brief': 'website-brief', 'strategy-brief': 'strategy-brief' }[type])) issues.push('Use the existing shared record for this planning document.');
  if (type === 'strategy-step') {
    if (!STRATEGY_PHASES.some(phase => phase.id === row.id)) issues.push('Choose an existing strategy step.');
    if (row.status === 'deferred' && !String(row.deferredReason || '').trim()) issues.push('Record why this step is deferred and what will bring us back to it.');
    if (row.status === 'deferred' && !row.reviewDate) issues.push('Set a review date for a deferred step.');
  }
  for (const item of form.fields) {
    const value = row[item.key], present = Array.isArray(value) ? value.length > 0 : String(value ?? '').trim() !== '';
    if (item.required && !present) issues.push(`${item.label} is required.`);
    if (item.type === 'multiselect' && value !== undefined && (!Array.isArray(value) || value.some(entry => typeof entry !== 'string' || !entry.trim()))) issues.push(`${item.label} must contain record references.`);
    if (item.type === 'select' && present && !item.allowMissing && !item.options.some(option => option.value === value)) issues.push(`${item.label} has an unsupported selection.`);
    if (item.type === 'date' && present && (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(`${value}T00:00:00Z`)) || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value)) issues.push(`${item.label} must be a valid calendar date.`);
  }
  if (Array.isArray(row.sourceRefs) && row.sourceRefs.includes(`${type}:${row.id}`)) issues.push('A planning record cannot cite itself as supporting evidence.');
  if (type === 'segment' && ['capabilityStatus', 'capacityStatus', 'cashStatus'].some(key => row[key] === 'met')) {
    if (!String(row.constraintNotes || '').trim()) issues.push('Record who checked the reported constraints, when, and against which evidence.');
    if (!planningSourceRefs(row).length) issues.push('Link supporting evidence before reporting a required constraint as met.');
  }
  return [...new Set(issues)];
}

export function strategyConfirmationIssues(type, row = {}, ctx = { records: {}, questions: [] }) {
  const required = type === 'charter' ? [
    ['christianTitle', 'Christian’s intended title'], ['growthTitle', 'Debynyhan Banks’s intended title'],
    ['christianAvailability', 'Christian’s availability'], ['growthAvailability', 'Debynyhan Banks’s availability'],
    ['mandate', 'the operating mandate'], ['decisionLimits', 'decision boundaries'], ['technicalReview', 'technical review ownership'],
    ['fieldCoverage', 'qualified field coverage'], ['backup', 'backup arrangements'], ['customerResponse', 'customer-response ownership'],
    ['christianCompensation', 'Christian’s compensation expectations'], ['growthCompensation', 'Debynyhan Banks’s compensation expectations'], ['reviewDate', 'a charter review date'],
  ] : type === 'strategy-brief' ? [
    ['objectives', 'business objectives'], ['selectedSegmentId', 'an initial customer segment'], ['initialOffer', 'an initial offer'],
    ['tradeoffs', 'strategic trade-offs'], ['reviewDate', 'a strategy review date'], ['changeTriggers', 'conditions that would change the strategy'],
  ] : [];
  if (!required.length) return [];
  const issues = required.filter(([key]) => questionUnknown({ value: row[key] })).map(([, label]) => `Clarify ${label} before confirming this shared record.`);
  if (!planningSourceRefs(row).length) issues.push('Link the source inputs we relied on before confirming this shared record.');
  if (type === 'strategy-brief' && row.selectedSegmentId && !docs(ctx, 'segment').some(segment => segment.id === row.selectedSegmentId)) issues.push('The selected customer segment is missing; review the linked direction.');
  return issues;
}

function questionUnknown(response) {
  if (!responseAnswered(response)) return true;
  if (response.unknown === true || response.status === 'unknown') return true;
  const values = [response.value, response.explanation].flat().filter(value => typeof value === 'string' && value.trim());
  return values.some(value => /^(?:unknown|not known|not sure|unsure|undecided|not yet determined|to be determined|tbd|i don['’]?t know|we don['’]?t know)[.!?\s]*$/i.test(value.trim()));
}

function actualTasks(ctx) {
  return Array.isArray(ctx.tasks) ? ctx.tasks : Object.values(ctx.records || {}).filter(record => record.category === 'task' && !record.body?.planningType).map(record => ({ ...record.body, id: record.body?.id || record.object_id }));
}

function taskFor(tasks, input) {
  const candidates = tasks.filter(task => {
    if (input.questionId) {
      const ref = `response:${input.seat}:${input.questionId}`;
      return task.sourceRef === ref || task.sourceQuestion === `${input.seat}:${input.questionId}` || task.sourceQuestionId === `${input.seat}:${input.questionId}` || (task.sourceQuestionId === input.questionId && task.sourceSeat === input.seat) || (Array.isArray(task.sourceRefs) && task.sourceRefs.includes(ref));
    }
    return task.sourceRef === input.key || (input.evidenceId && task.sourceEvidenceId === input.evidenceId) || (Array.isArray(task.sourceRefs) && task.sourceRefs.includes(input.key));
  });
  return candidates.find(task => task.status !== 'completed') || candidates[0];
}

function documentGaps(ctx) {
  const gaps = [];
  const needed = (phaseId, type, title, reason, owner, exists) => {
    if (!exists) gaps.push({ key: `planning:${type}`, phaseId, type, title, reason, owner, view: VIEW_FOR_TYPE[type] || 'guide', kind: 'planning' });
  };
  const charter = docs(ctx, 'charter').find(row => row.id === 'charter') || docs(ctx, 'charter')[0];
  needed('working-arrangement', 'charter', 'A proposed working arrangement', 'Record the essential responsibilities, authority, availability, compensation and support arrangement, with source inputs, so we can review a specific proposal together.', charter?.owner || 'growth', charter && strategyConfirmationIssues('charter', charter, ctx).length === 0);
  const capacity = calculateCapacity(ctx);
  needed('working-arrangement', 'capacity-week', 'Dated delivery and technical coverage', 'Questionnaire availability does not establish qualified, dated technical coverage. At least one usable, confirmed week needs positive qualified field hours; the capacity model identifies remaining period coverage gaps.', 'christian', capacity.weeks.some(week => week.complete && week.usable && week.availabilityStatus === 'confirmed' && week.qualifiedHours.field > 0));
  needed('customer-evidence', 'customer-research', 'Customer evidence', 'No customer findings are recorded yet; demand and buying criteria remain untested.', 'growth', docs(ctx, 'customer-research').some(row => String(row.findings || row.problem || '').trim() && String(row.source || '').trim() && row.observedOn));
  needed('customer-evidence', 'competitor', 'Relevant competitor observations', 'We need current observations of the alternatives our intended customers use.', 'growth', docs(ctx, 'competitor').some(row => String(row.source || '').trim() && row.observedOn));
  needed('segment-offer', 'segment', 'A specific first customer and offer', 'Comparing launch paths does not yet identify a precise buyer, problem, offer and constraints.', 'growth', docs(ctx, 'segment').some(row => row.customer && row.problem && row.offer));
  for (const segment of docs(ctx, 'segment')) {
    for (const [key, label] of [['capabilityStatus', 'technical capability'], ['capacityStatus', 'delivery capacity'], ['cashStatus', 'cash coverage']]) {
      if (segment[key] !== 'met') gaps.push({ key: `segment:${segment.id}:${key}`, sourceRef: `segment:${segment.id}`, phaseId: 'segment-offer', type: 'segment', title: `${segment.title || 'Customer segment'} — required ${label}`, reason: segment[key] === 'not-met' ? `This required constraint is recorded as not met. Resolve it or revise the offer before relying on the segment.` : `This required constraint is unknown. Check the supporting evidence and capacity or financial model.`, owner: segment.owner, view: 'segments', kind: 'planning' });
    }
  }
  const settings = docs(ctx, 'finance-settings').find(row => row.id === 'settings') || docs(ctx, 'finance-settings')[0];
  needed('economics-funding', 'finance-settings', 'Available cash and fixed-cost assumptions', 'The base case needs an opening-cash amount and explicit overhead, compensation and marketing assumptions; blank amounts stay unknown.', 'christian', settings && ['baseOpeningCash', 'baseMonthlyOverhead', 'baseMonthlyCompensation', 'baseMonthlyMarketing'].every(key => typeof settings[key] === 'number' ? Number.isFinite(settings[key]) && settings[key] >= 0 : typeof settings[key] === 'string' && settings[key].trim() !== '' && Number.isFinite(Number(settings[key])) && Number(settings[key]) >= 0));
  const finance = calculateFinance({ settings: settings || {}, jobs: docs(ctx, 'job-model'), startupCosts: docs(ctx, 'startup-cost'), cashWeeks: docs(ctx, 'cash-week'), operatingMonths: docs(ctx, 'operating-month') });
  needed('economics-funding', 'job-model', 'A costed initial service', 'Service pricing needs a complete base-case job-cost model, including explicit zeros where a cost does not apply. Entered estimates still need source review.', 'christian', finance.jobs.some(job => job.complete));
  needed('marketing-website', 'experiment', 'A bounded marketing test', 'We need a customer, offer, spending or time limit, response owner and review rule before relying on a marketing approach.', 'growth', docs(ctx, 'experiment').some(row => row.offer && row.owner && row.channel && row.endDate && (String(row.budget ?? '').trim() || row.timeLimit) && row.continueRule && row.stopRule));
  needed('marketing-website', 'website-brief', 'A customer website implementation brief', 'The future customer website needs an audience, goal, supported offer and a response workflow.', 'growth', docs(ctx, 'website-brief').some(row => row.audience && row.primaryGoal && row.services && row.responseWorkflow));
  needed('execution-review', 'strategy-brief', 'A strategic brief and review triggers', 'We need an explicit proposed direction, trade-offs and conditions that would cause us to change the plan.', 'growth', docs(ctx, 'strategy-brief').some(row => row.objectives && row.tradeoffs && row.changeTriggers && row.reviewDate));
  needed('execution-review', 'forecast-baseline', 'A dated forecast baseline', 'Capture the planning scenario and source inputs before comparing results; the live editable forecast is not a historical baseline.', 'growth', docs(ctx, 'forecast-baseline').some(row => row.capturedAt && row.forecast && (row.forecast.cash || row.forecast.operating)));
  return gaps;
}

/** Derive guidance from source records without creating tasks or changing answers. */
export function deriveStrategyGuide(ctx = { records: {}, questions: [] }) {
  const tasks = actualTasks(ctx), steps = docs(ctx, 'strategy-step');
  const knownQuestions = new Map((ctx.questions || []).map(question => [question.id, question]));
  const allInputs = [], allDiscussions = [];
  const phases = STRATEGY_PHASES.map(phase => {
    const inputs = [];
    for (const seat of Object.keys(SEATS)) {
      const eligible = new Set(questionsForSeat(ctx.questions, seat).map(question => question.id));
      for (const questionId of phase[seat]) {
        const question = knownQuestions.get(questionId);
        if (!question || !eligible.has(questionId)) continue;
        const response = getResponse(ctx.records, seat, questionId);
        const input = { key: `response:${seat}:${questionId}`, kind: 'question', phaseId: phase.id, seat, owner: seat, questionId, title: questionText(question, seat), reason: phase.constrained, response, missing: questionUnknown(response) };
        const task = findQuestionResearchTask(ctx.records, seat, questionId) || taskFor(tasks, input);
        if (task) Object.assign(input, { taskId: task.id || task._id, taskStatus: task.status, taskDueDate: task.dueDate });
        inputs.push(input); allInputs.push(input);
      }
    }
    const linkedQuestionIds = new Set([...phase.christian, ...phase.growth]);
    const evidence = docs(ctx, 'evidence').filter(row => linkedQuestionIds.has(row.relatedQuestion) || linkedQuestionIds.has(String(row.relatedQuestion || '').split(':').at(-1)) || row.relatedDecision === phase.id);
    const discussions = [...linkedQuestionIds].map(id => knownQuestions.get(id)).filter(question => question?.audience === 'both' && question.compare !== false).map(question => ({ questionId: question.id, title: question.label, status: questionStatus(question, getResponse(ctx.records, 'christian', question.id), getResponse(ctx.records, 'growth', question.id)) })).filter(item => ['different', 'discussion'].includes(item.status));
    allDiscussions.push(...discussions.map(item => ({ ...item, phaseId: phase.id })));
    const step = steps.find(row => row.id === phase.id) || { id: phase.id, status: 'draft' };
    const proposal = docs(ctx, 'proposal').find(row => row.id === step.proposalId);
    const charter = phase.id === 'working-arrangement' ? docs(ctx, 'charter').find(row => row.id === 'charter') || docs(ctx, 'charter')[0] : null;
    const decisionRecord = proposal || charter;
    const confirmation = decisionRecord ? confirmationStatus(decisionRecord, ctx.records) : null;
    return { ...phase, inputs, evidence, discussions, step, proposal, decisionRecord, confirmation, missingInputs: inputs.filter(input => input.missing) };
  });
  for (const gap of documentGaps(ctx)) {
    const task = taskFor(tasks, gap);
    if (task) Object.assign(gap, { taskId: task.id || task._id, taskStatus: task.status, taskDueDate: task.dueDate });
    phases.find(phase => phase.id === gap.phaseId)?.missingInputs.push(gap);
  }
  const unresolvedEvidence = docs(ctx, 'evidence').filter(row => row.classification === 'unknown' || row.verification !== 'verified' || String(row.remainingQuestion || '').trim()).map(row => {
    const input = { key: `evidence:${row.id}`, evidenceId: row.id, kind: 'evidence', phaseId: phases.find(phase => phase.evidence.some(item => item.id === row.id))?.id || 'customer-evidence', title: row.title || row.id, reason: row.remainingQuestion || 'Verify this input against a recorded source.', owner: row.owner, dueDate: row.researchDue, view: 'evidence' };
    const task = row.researchTaskId ? tasks.find(item => (item.id || item._id) === row.researchTaskId) : taskFor(tasks, input);
    if (task) Object.assign(input, { taskId: task.id || task._id, taskStatus: task.status, taskDueDate: task.dueDate });
    return input;
  });
  for (const input of unresolvedEvidence) phases.find(phase => phase.id === input.phaseId)?.missingInputs.push(input);
  const missingInputs = [...new Map(phases.flatMap(phase => phase.missingInputs).map(input => [input.key, input])).values()];
  const activePhase = phases.find(phase => phase.step.status !== 'deferred' && (phase.missingInputs.length || (phase.confirmation && phase.confirmation.status !== 'confirmed'))) || phases.find(phase => phase.missingInputs.length) || phases[0];
  const ownMissing = activePhase.missingInputs.find(input => input.kind === 'question' && input.seat === ctx.seat);
  const otherMissing = activePhase.missingInputs.find(input => input.kind === 'question');
  const target = ownMissing || otherMissing || activePhase.missingInputs[0];
  const nextAction = target?.kind === 'question' ? { kind: target.seat === ctx.seat ? 'answer' : 'review', phaseId: activePhase.id, title: target.seat === ctx.seat ? 'Record my next essential input' : `Review the input we need from ${SEATS[target.seat]}`, questionId: target.questionId, seat: target.seat, detail: target.title, sourceRef: target.key } : { kind: 'planning', phaseId: activePhase.id, title: `Review ${activePhase.title.toLowerCase()}`, view: activePhase.view, detail: target?.reason || activePhase.why };
  return { phases, missingInputs, inputs: allInputs, discussions: [...new Map(allDiscussions.map(item => [item.questionId, item])).values()], nextAction, criticalMissingCount: missingInputs.length };
}

function responseExcerpt(response) {
  const value = response?.value;
  return `${value !== undefined && value !== null && String(value).trim() ? `<p class="planning-excerpt">${text(value)}</p>` : ''}${String(response?.explanation || '').trim() ? `<p class="planning-excerpt"><strong>Details / written alternative:</strong> ${text(response.explanation)}</p>` : ''}`;
}

function questionButton(seat, questionId, ctx, label) {
  return `<button class="btn small" data-open-question="${esc(questionId)}" data-open-seat="${esc(seat)}">${esc(label || (seat === ctx.seat ? 'Open my answer' : `Review ${SEATS[seat]}’s input`))}</button>`;
}

function sourceLink(ref, ctx) {
  if (typeof ref !== 'string') return '';
  const parts = ref.split(':'), type = parts.shift(), rest = parts.join(':');
  if (type === 'response' && parts.length >= 2) {
    const seat = parts.shift(), questionId = parts.join(':');
    const question = (ctx.questions || []).find(item => item.id === questionId);
    return `<li><span class="caption">[${esc(ref)}]</span> ${esc(SEATS[seat] || seat)} · ${esc(question ? questionText(question, seat) : questionId)} ${Object.hasOwn(SEATS, seat) ? questionButton(seat, questionId, ctx, 'Review source answer') : ''}</li>`;
  }
  const row = type === 'task' ? actualTasks(ctx).find(item => (item.id || item._id) === rest) : docs(ctx, type).find(item => item.id === rest);
  return `<li><span class="caption">[${esc(ref)}]</span> ${row ? esc(labelFor(row)) : '<span class="unanswered">Source is missing — review this reference</span>'} ${row && VIEW_FOR_TYPE[type] ? viewButton(VIEW_FOR_TYPE[type], 'Review source record') : ''}</li>`;
}

function renderSources(row, ctx) {
  const refs = planningSourceRefs(row);
  return `<details class="planning-detail" data-detail-id="sources-${esc(row.planningType || 'strategy')}-${esc(row.id)}"><summary>Linked source records (${refs.length})</summary>${refs.length ? `<ul class="list">${refs.map(ref => sourceLink(ref, ctx)).join('')}</ul>` : '<p class="unanswered">No supporting sources are linked to this draft yet.</p>'}</details>`;
}

function currentConfirmations(row, ctx, type) {
  const result = confirmationStatus(row, ctx.records);
  const missing = [...(result.evidenceMissingIds || []), ...(result.sourceMissingRefs || result.sourceMissingIds || [])];
  const issues = strategyConfirmationIssues(type, row, ctx);
  return `<div class="info-note"><strong>${result.status === 'confirmed' && !issues.length ? 'Both partners confirmed the current content and linked sources.' : 'Proposed — awaiting each partner’s current confirmation.'}</strong><p>${Object.keys(SEATS).map(seat => `${SEATS[seat]}: ${result.confirmedSeats.includes(seat) ? 'confirmed this version' : result.staleSeats.includes(seat) ? 'earlier confirmation is out of date' : 'confirmation needed'}`).map(esc).join(' · ')}</p>${missing.length ? `<p class="form-error">Missing source references: ${esc(missing.join(', '))}</p>` : ''}${issues.length ? `<details class="planning-detail"><summary>Before we can confirm this draft (${issues.length})</summary><ul>${issues.map(issue => `<li>${esc(issue)}</li>`).join('')}</ul><p>We can save and refine the draft while these inputs remain open.</p></details>` : ''}<button class="btn primary" data-plan-confirm-type="${esc(type)}" data-plan-confirm="${esc(row.id)}" data-plan-snapshot="${esc(canonicalProposal(row, ctx.records))}"${result.confirmedSeats.includes(ctx.seat) || missing.length || issues.length || !Object.hasOwn(SEATS, ctx.seat) ? ' disabled' : ''}>Confirm as ${esc(SEATS[ctx.seat] || 'my own account')}</button></div>`;
}

function missingInput(input, ctx) {
  const task = input.taskId ? `<button class="btn small" data-edit-task="${esc(input.taskId)}">Review linked task${input.taskStatus === 'completed' ? ' — input still unresolved' : ''}</button>` : '';
  const action = input.kind === 'question' ? `${questionButton(input.seat, input.questionId, ctx)}${task || `<button class="btn small" data-strategy-research-question="${esc(`${input.seat}:${input.questionId}`)}">Assign a follow-up</button>`}` : `${task}${viewButton(input.view || 'evidence', input.kind === 'planning' ? 'Open planning tool' : 'Review evidence')}`;
  return `<li><strong>${esc(input.title)}</strong><p>${esc(SEATS[input.owner] || 'Owner needs assignment')} · ${esc(input.taskDueDate || input.dueDate || 'Deadline not yet agreed')}</p><p class="caption">${esc(input.reason)}</p><div class="button-row">${action}</div><span class="caption">[${esc(input.key)}]</span></li>`;
}

function guidePage(ctx) {
  const guide = deriveStrategyGuide(ctx), next = guide.nextAction;
  const nextButton = next.questionId ? questionButton(next.seat, next.questionId, ctx, next.seat === ctx.seat ? 'Answer this question →' : 'Review requested input →') : viewButton(next.view, 'Open this planning step →');
  return title('Build our strategy, one decision at a time', 'Christian, let’s connect what we know to a practical offer, delivery plan and route to customers. We can keep useful work moving while making uncertainty visible.', add('strategy-brief', 'Draft our strategic direction', 'strategy-brief')) +
    `<section class="panel pad strategy-next"><span class="eyebrow">Recommended next action</span><h2>${esc(next.title)}</h2><p>${esc(next.detail)}</p><div class="button-row">${nextButton}${viewButton('discovery', 'Discovery essentials')}${viewButton('plan', 'Our living business plan')}</div></section>` +
    note(`${guide.criticalMissingCount} critical inputs or planning records still need attention. This is a working list, not a readiness score. Completing this list does not establish business readiness. We can draft later steps before every answer is complete; the constraints below explain what remains uncertain.`) +
    `<div class="strategy-sequence">${guide.phases.map((phase, index) => `<section class="panel pad" id="strategy-${esc(phase.id)}"><div class="item-head"><div><span class="eyebrow">Suggested step ${index + 1}</span><h2>${esc(phase.title)}</h2></div><span class="tag ${phase.confirmation?.status === 'confirmed' ? 'ready' : 'warn'}">${phase.step.status === 'deferred' ? 'Deferred — still unresolved' : phase.confirmation?.status === 'confirmed' ? 'Current shared record confirmed' : 'Working proposal'}</span></div><p>${esc(phase.why)}</p><p class="caption"><strong>Dependencies:</strong> ${phase.dependencies.length ? phase.dependencies.map(id => esc(STRATEGY_PHASES.find(item => item.id === id)?.title || id)).join(' · ') : 'Start here; no previous strategy step is required.'}</p><p>${esc(SEATS[phase.step.owner] || 'Choose an accountable owner')} · decision / review deadline ${esc(phase.step.dueDate || 'not agreed')} · next review ${esc(phase.step.reviewDate || 'not agreed')}</p>${facts(phase.step, [['direction', 'Proposed direction'], ['alternatives', 'Alternatives to consider'], ['assumptions', 'Unresolved assumptions']])}${phase.step.status === 'deferred' ? `<div class="info-note"><strong>Reason for deferral</strong><p>${text(phase.step.deferredReason, 'A reason is required; review this deferral.')}</p><p>Deferral does not resolve the missing inputs or confirm a decision.</p></div>` : ''}<p class="caption">${esc(phase.constrained)}</p><details class="planning-detail" data-detail-id="guide-missing-${esc(phase.id)}"><summary>Inputs still needed (${phase.missingInputs.length})</summary>${phase.missingInputs.length ? `<ul class="list">${phase.missingInputs.map(input => missingInput(input, ctx)).join('')}</ul>` : '<p>No mapped missing inputs are currently detected. This does not establish business readiness; review source quality and constraints.</p>'}</details><details class="planning-detail" data-detail-id="guide-inputs-${esc(phase.id)}"><summary>Existing partner inputs and evidence (${phase.inputs.filter(input => responseAnswered(input.response)).length + phase.evidence.length})</summary>${phase.inputs.filter(input => responseAnswered(input.response)).map(input => `<div class="strategy-source"><strong>${esc(SEATS[input.seat])} · ${esc(input.title)}</strong>${responseExcerpt(input.response)}<p class="caption">[${esc(input.key)}] · Used in ${esc(phase.title)}</p>${questionButton(input.seat, input.questionId, ctx)}</div>`).join('')}${phase.evidence.map(row => `<div class="strategy-source"><strong>${esc(row.title)}</strong><p>${esc(row.classification || 'Unknown classification')} · ${esc(row.verification || 'Not checked')} · ${esc(row.observedOn || 'No recorded date')}</p><p class="caption">[evidence:${esc(row.id)}]</p>${edit('evidence', row, 'Review evidence')}</div>`).join('') || (!phase.inputs.some(input => responseAnswered(input.response)) ? '<p class="unanswered">No relevant source inputs recorded yet.</p>' : '')}</details>${phase.discussions.length ? `<p class="form-error">Discuss these perspectives: ${phase.discussions.map(item => esc(item.title)).join(' · ')}. Different answers remain individual views until we agree on a proposal.</p>${viewButton('alignment', 'Review both perspectives')}` : ''}${phase.proposal ? `<p>Linked decision: <strong>${esc(phase.proposal.title)}</strong> · ${phase.confirmation.status === 'confirmed' ? 'confirmed for its current content and sources' : 'awaiting current partner confirmations'}</p>${viewButton('decisions', 'Review linked decision')}` : '<p class="caption">No joint decision proposal is linked to this step yet.</p>'}<div class="button-row">${viewButton(phase.view, 'Open working tool')}${edit('strategy-step', phase.step, 'Owner, deadline, draft or defer')}</div></section>`).join('')}</div>`;
}

function attributedContext(ctx, questionIds) {
  const sources = responseRefs(ctx, questionIds);
  const discussions = questionIds.map(id => (ctx.questions || []).find(question => question.id === id)).filter(question => question?.audience === 'both').map(question => ({ question, status: questionStatus(question, getResponse(ctx.records, 'christian', question.id), getResponse(ctx.records, 'growth', question.id)) })).filter(item => ['different', 'discussion'].includes(item.status));
  return `<section class="panel pad"><h2>Our existing perspectives — drafting inputs</h2><p>These remain each person’s own answers. A charter or strategic brief is a separate proposed arrangement; editing it does not change these answers.</p>${discussions.length ? `<div class="info-note"><strong>Perspectives to discuss</strong><ul>${discussions.map(item => `<li>${esc(item.question.label)} — ${item.status === 'different' ? 'selected answers differ' : 'written perspectives need discussion'}</li>`).join('')}</ul>${viewButton('alignment', 'Compare our answers')}</div>` : ''}${listOrUnknown(sources, source => `<details class="planning-detail" data-detail-id="context-${esc(source.seat)}-${esc(source.question.id)}"><summary>${esc(SEATS[source.seat])} · ${esc(questionText(source.question, source.seat))}</summary>${responseExcerpt(source.response)}<p class="caption">[${esc(source.ref)}]</p>${questionButton(source.seat, source.question.id, ctx)}</details>`, 'Relevant discovery answers are not recorded yet. We can draft the arrangement and identify what each of us needs to clarify.')}</section>`;
}

function charterPage(ctx) {
  const charter = docs(ctx, 'charter').find(row => row.id === 'charter') || docs(ctx, 'charter')[0];
  return title('Our operating charter', 'Christian, let’s make the responsibilities, authority, support and compensation we propose explicit before relying on them.', charter ? edit('charter', charter, 'Edit proposed arrangement') : add('charter', 'Draft our arrangement', 'charter')) + note('This is a business planning record. Existing answers and matching preferences do not create an agreed arrangement. We each confirm the exact shared version through our own account; changes to covered content or sources require fresh confirmation.') +
    (charter ? `<section class="panel pad"><h2>${esc(charter.title || 'Our proposed arrangement')}</h2>${currentConfirmations(charter, ctx, 'charter')}<div class="partner-grid"><section><h3>Christian Okoh</h3>${facts(charter, [['christianTitle', 'Intended title'], ['christianResponsibilities', 'Responsibilities'], ['christianAvailability', 'Available time and response windows'], ['christianUnavailable', 'Unavailable periods'], ['christianCompensation', 'Proposed compensation']])}</section><section><h3>Debynyhan Banks</h3>${facts(charter, [['growthTitle', 'Intended title'], ['growthResponsibilities', 'Responsibilities'], ['growthAvailability', 'Available time and response windows'], ['growthUnavailable', 'Unavailable periods'], ['growthCompensation', 'Proposed compensation']])}</section></div>${facts(charter, [['mandate', 'Operating mandate'], ['decisionLimits', 'Decision boundaries'], ['technicalReview', 'Technical review'], ['supervision', 'Qualified supervision'], ['quoteAuthority', 'Quote authority'], ['purchasingAuthority', 'Purchasing and borrowing'], ['hiringAuthority', 'Hiring and subcontractors'], ['contractAuthority', 'Contracts and commitments'], ['contributions', 'Proposed contributions'], ['customerResponse', 'Customer response'], ['scheduling', 'Scheduling'], ['fieldCoverage', 'Field delivery'], ['backup', 'Backup arrangements'], ['quality', 'Quality checks'], ['callbacks', 'Callbacks and warranty'], ['escalation', 'Escalation and disagreements'], ['reporting', 'Reporting and reviews'], ['reviewDate', 'Next charter review']])}${renderSources(charter, ctx)}<div class="button-row">${edit('charter', charter)}${viewButton('capacity', 'Test this arrangement against dated capacity')}</div></section>` : '<section class="panel pad"><h2>Our shared arrangement is not drafted yet</h2><p>We can use the answers below to prepare it. Titles, responsibilities and compensation remain open until we review and confirm a specific version.</p></section>') + attributedContext(ctx, ['partner_role_title', 'business_mandate', 'business_lead_scope', 'technical_lead_scope', 'weekly_time', 'site_supervision', 'technical_signoff', 'spending_approval', 'compensation_expectations', 'joint_decisions', 'meeting_rhythm', 'partner_expectations', 'union_membership']);
}

function linkedRows(row, ctx, type, key, heading) {
  const ids = Array.isArray(row[key]) ? row[key] : [];
  if (!ids.length) return '';
  return `<h4>${esc(heading)}</h4><ul class="list">${ids.map(id => sourceLink(`${type}:${id}`, ctx)).join('')}</ul>`;
}

function segmentsPage(ctx) {
  const segments = docs(ctx, 'segment');
  const comparison = segments.length ? `<div class="table-wrap"><table><thead><tr><th>Required constraint</th>${segments.map(row => `<th>${esc(row.title)}</th>`).join('')}</tr></thead><tbody>${[['capabilityStatus', 'Technical capability'], ['capacityStatus', 'Delivery capacity'], ['cashStatus', 'Cash coverage']].map(([key, label]) => `<tr><th scope="row">${esc(label)}</th>${segments.map(row => `<td><span class="tag ${row[key] === 'met' ? 'ready' : 'warn'}">${esc(row[key] === 'met' ? 'Reported met — check sources' : row[key] === 'not-met' ? 'Not met' : 'Unknown — needs evidence')}</span></td>`).join('')}</tr>`).join('')}${[['customer', 'Customer / decision-maker'], ['problem', 'Problem'], ['offer', 'Proposed offer'], ['priceApproach', 'Price approach'], ['jobContribution', 'Job contribution'], ['paymentTiming', 'Payment timing'], ['acquisition', 'Acquisition effort'], ['risks', 'Risks'], ['changeEvidence', 'What would change our view?']].map(([key, label]) => `<tr><th scope="row">${esc(label)}</th>${segments.map(row => `<td>${text(row[key])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : '<p class="unanswered">No specific customer segments are recorded yet. We can compare a focused residential offer with suitable commercial alternatives without choosing a winner automatically.</p>';
  return title('Which customers and offer should we pursue first?', 'Let’s compare specific buyers, problems and delivery requirements. A broad label such as “residential” or “commercial” is only a starting point.', add('segment', '+ Customer segment')) + note('Mandatory capability, delivery and cash constraints are separate from attractiveness. A reported “met” status is a manual assessment, not automatic verification or permission to accept work. Residential HVAC remains a hypothesis to evaluate.') + `<section class="panel pad"><h2>Our segment comparison</h2>${comparison}<div class="button-row">${viewButton('launch', 'Compare broader launch approaches')}${add('proposal', 'Draft a joint launch decision')}${viewButton('capacity', 'Review capacity constraints')}</div></section>` + segments.map(row => `<section class="panel pad"><div class="item-head"><h2>${esc(row.title)}</h2>${edit('segment', row)}</div><p class="caption">${esc(SEATS[row.owner] || 'Owner not assigned')} · review ${esc(row.reviewDate || 'not agreed')} · [segment:${esc(row.id)}]</p>${facts(row, [['customer', 'Customer / decision-maker'], ['problem', 'HVAC problem'], ['trigger', 'Buying trigger'], ['geography', 'Geography'], ['serviceExpectations', 'Service expectations'], ['buyingProcess', 'Purchasing and selection'], ['alternatives', 'Existing alternatives'], ['reachableMarket', 'Reachable-market assumptions'], ['offer', 'Proposed offer'], ['exclusions', 'Exclusions'], ['priceApproach', 'Price approach'], ['promise', 'Customer promise and proof'], ['acquisition', 'Acquisition channel and effort'], ['deliveryRequirements', 'Delivery requirements'], ['capacityFit', 'Capacity fit'], ['jobContribution', 'Job contribution'], ['paymentTiming', 'Cash and payment timing'], ['constraintNotes', 'Constraint checks and source references'], ['risks', 'Risks / unknowns'], ['changeEvidence', 'Review and stop triggers']])}${linkedRows(row, ctx, 'customer-research', 'researchIds', 'Customer findings')}${linkedRows(row, ctx, 'competitor', 'competitorIds', 'Competitor observations')}${linkedRows(row, ctx, 'launch-option', 'launchOptionIds', 'Launch approaches')}${linkedRows(row, ctx, 'job-model', 'jobModelIds', 'Job-cost models')}${linkedRows(row, ctx, 'experiment', 'experimentIds', 'Marketing experiments')}${renderSources(row, ctx)}</section>`).join('');
}

function websitePage(ctx) {
  const brief = docs(ctx, 'website-brief').find(row => row.id === 'website-brief') || docs(ctx, 'website-brief')[0], pages = docs(ctx, 'website-page');
  const segment = docs(ctx, 'segment').find(row => row.id === brief?.segmentId);
  const strategy = docs(ctx, 'strategy-brief').find(row => row.id === 'strategy-brief') || docs(ctx, 'strategy-brief')[0];
  return title('Our future customer website — implementation brief', 'Let’s turn the business direction into an accurate customer promise, page plan and inquiry process.', brief ? edit('website-brief', brief, 'Edit website brief') : add('website-brief', 'Draft website brief', 'website-brief')) + note('This is private partner planning for a future customer-facing website. It does not publish these records, register a domain or change DNS. Keep partner compensation, financial records and private research out of public content.') +
    `<section class="panel pad"><h2>Strategy inputs to review</h2>${strategy ? `<p><strong>${esc(strategy.title)}</strong> · ${confirmationStatus(strategy, ctx.records).status === 'confirmed' ? 'Both partners confirmed the current strategic brief.' : 'Proposed direction — current confirmations still needed.'}</p>${facts(strategy, [['initialOffer', 'Proposed initial offer'], ['positioning', 'Positioning'], ['advantage', 'Supporting advantage']])}${viewButton('plan', 'Review the complete strategy and sources')}` : '<p class="unanswered">A strategic brief is not drafted yet. We can prepare website requirements while keeping the customer offer and positioning provisional.</p>'}${segment ? `<h3>Linked audience: ${esc(segment.title)}</h3>${facts(segment, [['problem', 'Customer problem'], ['offer', 'Offer'], ['promise', 'Promise and proof'], ['serviceExpectations', 'Service expectations']])}${viewButton('segments', 'Review audience evidence')}` : '<p class="unanswered">No existing customer segment is linked to this website brief.</p>'}</section>` +
    (brief ? `<section class="panel pad"><h2>${esc(brief.title)}</h2><p class="caption">Working draft · owner ${esc(SEATS[brief.owner] || 'not assigned')} · review ${esc(brief.reviewDate || 'not agreed')}</p>${facts(brief, [['audience', 'Intended audience'], ['primaryGoal', 'Website goal and customer action'], ['brand', 'Brand details to confirm'], ['domain', 'Proposed domain / ownership status'], ['contact', 'Business contact details'], ['services', 'Services'], ['exclusions', 'Exclusions'], ['geography', 'Service area'], ['hours', 'Actual operating / response hours'], ['positioning', 'Positioning and promise'], ['credentials', 'Verified credentials and approved wording'], ['companyHistory', 'C.F. Mechanical company history'], ['christianExperience', 'Christian’s individual HVAC experience'], ['projectExamples', 'Authentic examples and permissions'], ['testimonials', 'Testimonials and consent'], ['pages', 'Proposed page structure'], ['callsToAction', 'Calls to action'], ['qualification', 'Inquiry qualification'], ['responseWorkflow', 'Inquiry response and follow-up'], ['technicalReviewer', 'Technical review workflow'], ['maintenance', 'Content ownership and updates'], ['searchTopics', 'Customer questions / search topics'], ['measurement', 'Inquiry-to-payment measurement'], ['publicationConditions', 'Conditions before public implementation']])}<p>Content owner: ${esc(SEATS[brief.contentOwner] || 'Not assigned')}</p>${renderSources(brief, ctx)}</section>` : '<section class="panel pad"><h2>Website requirements are not recorded yet</h2><p>Start with the customer, supported services and response process. Domain, credentials, project examples and publishing permissions remain inputs to confirm.</p></section>') +
    `<section class="panel pad"><div class="section-heading"><div><h2>Proposed pages & campaigns</h2><p>Connect each item to a customer, offer, proof and intended action.</p></div>${add('website-page', '+ Page / campaign')}</div>${listOrUnknown(pages, row => `<details class="planning-detail" data-detail-id="website-page-${esc(row.id)}"><summary>${esc(row.title)} · ${esc(row.format || 'page')} · ${esc(row.status || 'proposed')}</summary>${facts(row, [['audience', 'Audience and buying stage'], ['customerProblem', 'Customer question / problem'], ['offer', 'Offer and exclusions'], ['proof', 'Proof and permission status'], ['action', 'Intended action'], ['response', 'Response process'], ['searchTopic', 'Search topic'], ['measurement', 'Success measure']])}${row.segmentId ? `<ul class="list">${sourceLink(`segment:${row.segmentId}`, ctx)}</ul>` : '<p class="unanswered">No customer segment linked.</p>'}${row.experimentId ? `<ul class="list">${sourceLink(`experiment:${row.experimentId}`, ctx)}</ul>` : ''}${renderSources(row, ctx)}${edit('website-page', row)}</details>`, 'No page or campaign requirements recorded yet.')}</section>` + attributedContext(ctx, ['website_priority', 'brand_position', 'marketing_assets', 'brand_ideas', 'customer_acquisition', 'systems_workflow']);
}

export function renderStrategy(view, ctx) {
  if (view === 'guide') return guidePage(ctx);
  if (view === 'charter') return charterPage(ctx);
  if (view === 'segments') return segmentsPage(ctx);
  if (view === 'website') return websitePage(ctx);
  return '';
}
