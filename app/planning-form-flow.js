const group = (label, keys, id = '') => ({ label, keys: keys.split(' ').filter(Boolean), id: id || label.toLowerCase().replace(/[^a-z0-9]+/g, '-') });
const reviewKeys = 'owner reviewDate sourceRefs evidenceIds notes';

// Field keys remain the persistence contract. These groups change presentation only.
const GROUPS = {
  segment: [
    group('Customers', 'title customer problem trigger geography buyingProcess alternatives reachableMarket researchIds competitorIds'),
    group('Services', 'offer exclusions serviceExpectations promise acquisition experimentIds'),
    group('Delivery', 'deliveryRequirements capacityFit capabilityStatus capacityStatus'),
    group('Money', 'priceApproach jobContribution paymentTiming cashStatus jobModelIds'),
    group('Review', `risks changeEvidence constraintNotes launchOptionIds ${reviewKeys}`, 'review'),
  ],
  charter: [
    group('Our roles', 'title mandate christianTitle christianResponsibilities growthTitle growthResponsibilities'),
    group('Time and support', 'christianAvailability christianUnavailable growthAvailability growthUnavailable technicalReview supervision fieldCoverage backup'),
    group('Decision authority', 'decisionLimits quoteAuthority purchasingAuthority hiringAuthority contractAuthority'),
    group('Pay and contributions', 'christianCompensation growthCompensation contributions'),
    group('Customer care', 'customerResponse scheduling quality callbacks escalation reporting'),
    group('Review', reviewKeys, 'review'),
  ],
  'website-brief': [
    group('Purpose and customers', 'title segmentId audience primaryGoal brand domain contact'),
    group('Services and proof', 'services exclusions geography hours positioning credentials companyHistory christianExperience projectExamples testimonials'),
    group('Pages and inquiries', 'pages callsToAction qualification responseWorkflow'),
    group('Running the website', 'contentOwner technicalReviewer maintenance searchTopics measurement publicationConditions'),
    group('Review', reviewKeys, 'review'),
  ],
  'strategy-brief': [
    group('Our direction', 'title objectives measures selectedSegmentId customerProblem initialOffer'),
    group('Why this approach', 'positioning advantage alternatives tradeoffs'),
    group('Delivery and money', 'operatingModel fundingNeeds marketingApproach'),
    group('Actions and risks', 'risks contingencies executionPriorities commercialMilestones changeTriggers'),
    group('Review', reviewKeys, 'review'),
  ],
  experiment: [
    group('Customer and offer', 'title segment geography offer message proof'),
    group('Finding customers', 'channel journey owner responseStandard followup'),
    group('Time and spending', 'startDate endDate budget spend timeLimit reportingDate'),
    group('How we decide', 'successMeasures continueRule changeRule stopRule status'),
    group('Review', '', 'review'),
  ],
  'launch-option': [
    group('Customer and service', 'title customer services geography demand'),
    group('Delivery and money', 'capacity startup unitEconomics collectionDays acquisition'),
    group('Review', 'risk evidenceIds', 'review'),
  ],
  'customer-research': [
    group('Customer and problem', 'name segment location problem trigger'),
    group('How they choose', 'currentAlternative selectionCriteria priceInfo objections findings'),
    group('Review', 'source observedOn owner nextAction nextActionDue', 'review'),
  ],
  competitor: [
    group('Business and services', 'name services geography positioning pricing'),
    group('What we observed', 'experience strengths weaknesses'),
    group('Review', 'source observedOn owner', 'review'),
  ],
  evidence: [
    group('What we know', 'title classification verification remainingQuestion'),
    group('Source and follow-up', 'source observedOn relatedQuestion relatedDecision researchDue owner'),
    group('Review', '', 'review'),
  ],
  proposal: [
    group('Proposed decision', 'title direction rationale conditions'),
    group('Sources and ownership', 'evidenceIds sourceRefs owner decisionDate reviewDate'),
    group('Review', '', 'review'),
  ],
  settings: [
    group('Direction', 'planTitle planStartDate vision objectives differentiator'),
    group('Customers and growth', 'serviceArea initialOffer longTermDirection'),
    group('Review', 'risks contingencies monthMilestones', 'review'),
  ],
  'strategy-step': [
    group('Proposed direction', 'owner dueDate status direction alternatives'),
    group('Questions and next steps', 'assumptions deferredReason reviewDate proposalId sourceRefs evidenceIds'),
    group('Review', '', 'review'),
  ],
  'website-page': [
    group('Customer and purpose', 'title format segmentId audience customerProblem'),
    group('Message and response', 'offer proof action response searchTopic measurement'),
    group('Review', 'owner status experimentId sourceRefs evidenceIds', 'review'),
  ],
  'job-model': [
    group('Service and price', 'title scenario salePrice mixWeight'),
    group('Direct job costs', 'paidLabor materials subcontractors travel paymentFees callbackAllowance allocatedAcquisition'),
    group('Your unpaid time', 'unpaidOwnerHours unpaidOwnerHourlyValue'),
    group('Review', 'notes', 'review'),
  ],
  'finance-settings': [
    group('Forecast dates', 'forecastStartDate'),
    group('Base case', 'baseOpeningCash baseMonthlyOverhead baseMonthlyCompensation baseMonthlyMarketing baseMonthlyUnpaidOwnerHours baseUnpaidOwnerHourlyValue baseStartupCostsReviewed'),
    group('Downside case', 'downsideOpeningCash downsideMonthlyOverhead downsideMonthlyCompensation downsideMonthlyMarketing downsideMonthlyUnpaidOwnerHours downsideUnpaidOwnerHourlyValue downsideStartupCostsReviewed'),
    group('Review', 'notes', 'review'),
  ],
  'cash-week': [
    group('Week and money coming in', 'scenario week customerReceipts otherInflows'),
    group('Money going out', 'jobPayments overheadPayments compensationPayments marketingPayments otherPayments'),
    group('Review', 'notes', 'review'),
  ],
  'operating-month': [
    group('Month and planned jobs', 'title scenario month jobModelId units'),
    group('Collections and payments', 'customerCollections jobPayments otherInflows otherPayments'),
    group('Review', 'notes', 'review'),
  ],
  'capacity-person': [
    group('Person', 'name seat identityKey active'),
    group('Skills and support', 'qualificationStatus qualifiedFor qualificationSource backup'),
    group('Review', 'notes', 'review'),
  ],
  'capacity-week': [
    group('Person and availability', 'personId weekStart availabilityStatus availabilitySource availableHours'),
    group('How time is used', 'fieldHours travelHours estimatingHours adminHours supportHours supervisionHours callbackHours allocationBasis'),
    group('Review', 'notes', 'review'),
  ],
  'service-capacity': [
    group('Service', 'title jobModelId technicalRequirements'),
    group('Time per job', 'fieldHours travelHours estimatingHours supervisionHours callbackHours'),
    group('Review', 'notes', 'review'),
  ],
  'demand-week': [
    group('Service and week', 'title serviceModelId experimentId weekStart'),
    group('Expected work', 'jobs inquiries expectedQuoteRate'),
    group('Review', 'notes', 'review'),
  ],
  'job-actual': [
    group('Job and source', 'title sourceMode opportunityId jobReference serviceModelId experimentId'),
    group('Work and invoice dates', 'startedAt completedAt invoicedAt reportingDate'),
    group('Money and costs', 'revenue directCost acquisitionSpend invoiceAmount costBasisConfirmed'),
    group('Time and callbacks', 'paidLaborHours unpaidOwnerHours deliveryHours callbacks'),
    group('Review', 'notes', 'review'),
  ],
  'actual-period': [
    group('Reporting dates', 'title periodKind startDate endDate reportingDate coverage sourceMode'),
    group('Job results', 'jobs revenue directCost acquisitionSpend paidLaborHours unpaidOwnerHours deliveryHours callbacks invoicedAmount'),
    group('Period expenses', 'overheadCost compensationCost fixedMarketingCost'),
    group('Cash received and paid', 'collections customerReceipts otherInflows jobPayments overheadPayments compensationPayments marketingPayments otherPayments'),
    group('Review', 'explanation correctiveAction owner reviewDate experimentId notes', 'review'),
  ],
};

export function formSteps(form) {
  const fields = form?.fields || [];
  const groups = GROUPS[form?.type] || [
    ...Array.from({ length: Math.ceil(fields.length / 5) }, (_, index) => group(fields.length <= 5 ? 'Details' : `Details ${index + 1}`, fields.slice(index * 5, index * 5 + 5).map(field => field.key).join(' '))),
    group('Review', '', 'review'),
  ];
  const used = new Set();
  const steps = groups.map(item => ({ id: item.id, label: item.label, fields: item.keys.flatMap(key => {
    const field = fields.find(candidate => candidate.key === key);
    if (!field || used.has(key)) return [];
    used.add(key);
    return [field];
  }) })).filter(item => item.fields.length || item.id === 'review');
  // New or historical fields must never disappear because a grouping was not updated.
  steps.at(-1).fields.push(...fields.filter(field => !used.has(field.key)));
  return steps;
}

export function planningStepForField(form, key) {
  return formSteps(form).findIndex(step => step.fields.some(field => field.key === key));
}

export function planningFieldVisible(field, values = {}) {
  return !field.showWhen || values[field.showWhen.field] === field.showWhen.value;
}

export function planningValuePresent(value) {
  return Array.isArray(value) ? value.length > 0 : String(value ?? '').trim() !== '';
}

export function missingPlanningFields(form, values = form.initial || {}, requiredOnly = true) {
  return (form.fields || []).filter(field => planningFieldVisible(field, values) && (!requiredOnly || field.required) && !planningValuePresent(values[field.key]));
}

export function capturePlanningValues(form, root, previous = form.initial || {}) {
  return Object.fromEntries((form.fields || []).map(field => {
    const element = root?.querySelector?.(`[data-plan-field="${field.key}"]`);
    const fallback = previous[field.key] ?? (field.type === 'multiselect' ? [] : '');
    const value = element ? field.type === 'multiselect' ? [...element.selectedOptions].map(option => option.value) : element.value : Array.isArray(fallback) ? [...fallback] : fallback;
    return [field.key, value];
  }));
}

const SAVE_LABELS = {
  segment: 'Save customer plan', charter: 'Save working arrangement', 'website-brief': 'Save website brief', 'strategy-brief': 'Save strategy draft', experiment: 'Save marketing test', 'customer-research': 'Save customer conversation', competitor: 'Save competitor notes', evidence: 'Save evidence record', proposal: 'Save proposal', 'launch-option': 'Save launch option', settings: 'Save plan settings', 'strategy-step': 'Save planning notes', 'website-page': 'Save page plan', 'job-model': 'Save job-cost model', 'finance-settings': 'Save financial assumptions', 'cash-week': 'Save weekly forecast', 'operating-month': 'Save monthly forecast', 'startup-cost': 'Save startup cost', 'capacity-person': 'Save person’s profile', 'capacity-week': 'Save weekly availability', 'service-capacity': 'Save service-time model', 'demand-week': 'Save demand estimate', 'forecast-baseline': 'Capture dated forecast', 'job-actual': 'Save job results', 'actual-period': 'Save period results',
};

export function planningSaveLabel(form) {
  return SAVE_LABELS[form.type] || 'Save plan';
}

const PLAIN_LABELS = {
  acquisition: 'How will customers find us, and what might it cost?',
  capacity: 'Who can do the work, and when?',
  capacityFit: 'Does this work fit our available time?',
  deliveryRequirements: 'What people, equipment and support do we need?',
  jobContribution: 'What is left after paying the job’s costs?',
  paymentTiming: 'When will customers pay, and what must we pay first?',
  reachableMarket: 'Who can we realistically reach, and how will we check?',
  buyingProcess: 'How will the customer choose and approve the work?',
  priceApproach: 'How will we set prices, and what supports the estimate?',
  capabilityStatus: 'Can we perform this work? — review status',
  capacityStatus: 'Do we have people and time? — review status',
  cashStatus: 'Can we cover the costs before payment? — review status',
  constraintNotes: 'Who checked these requirements, when, and using what information?',
  changeEvidence: 'What results would make us change or stop?',
  unitEconomics: 'What could each job earn after its costs?',
  positioning: 'What do we want customers to know about us?',
  allocatedAcquisition: 'Marketing cost assigned to this job',
  mixWeight: 'Expected share of this service in our work',
};

export function planningFieldLabel(field) {
  return PLAIN_LABELS[field.key] || field.label;
}
