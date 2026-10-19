const SEATS = ["christian", "growth"];
const NON_CONTENT_FIELDS = new Set([
  "id", "_id", "_recordId", "_created_at", "_updated_at", "created_at", "updated_at",
  "createdAt", "updatedAt", "revision", "planningType", "status", "confirmations", "evidenceSnapshot",
]);

function recordRows(records) {
  return Array.isArray(records) ? records : Object.values(records || {});
}

export function isPlanningRecord(record, type) {
  return Boolean(record && record.category === "task" && record.body &&
    typeof record.body === "object" && !Array.isArray(record.body) &&
    typeof record.body.planningType === "string" && record.body.planningType &&
    (type === undefined || record.body.planningType === type));
}

export function planningRecords(records, type) {
  return recordRows(records).filter(record => isPlanningRecord(record, type)).map(record => ({
    ...record.body, id: record.body.id || record.object_id, _recordId: record.object_id,
  }));
}

export function evidenceUnresolved(row) {
  return Boolean(row && (row.verification !== "verified" || row.classification === "unknown" || String(row.remainingQuestion ?? "").trim()));
}

function sortedValue(value) {
  if (Array.isArray(value)) return value.map(sortedValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, sortedValue(value[key])]));
  }
  return value;
}

function contentOf(value) {
  return Object.fromEntries(Object.entries(value || {}).filter(([key]) => !NON_CONTENT_FIELDS.has(key)));
}

function evidenceIds(proposal) {
  return [...new Set((Array.isArray(proposal?.evidenceIds) ? proposal.evidenceIds : [])
    .filter(id => typeof id === "string" && id.trim()).map(id => id.trim()))].sort();
}

function currentEvidence(proposal, records) {
  const evidence = new Map(planningRecords(records, "evidence").map(item => [item.id, item]));
  return evidenceIds(proposal).map(id => ({ id, record: evidence.has(id) ? contentOf(evidence.get(id)) : null }));
}

// A confirmation covers the proposal's actual content and current linked sources.
// A revision counter or a stored snapshot cannot keep approval valid after edits.
export function canonicalProposal(proposal, records = {}) {
  const content = { ...contentOf(proposal), evidenceIds: evidenceIds(proposal), evidenceSnapshot: currentEvidence(proposal, records) };
  return JSON.stringify(sortedValue(content));
}

export function confirmationStatus(proposal, records = {}) {
  const id = proposal?.id || proposal?._recordId;
  const snapshot = canonicalProposal(proposal, records);
  const evidenceMissingIds = currentEvidence(proposal, records).filter(item => !item.record).map(item => item.id);
  const confirmedSeats = [], staleSeats = [];
  for (const seat of SEATS) {
    const vote = recordRows(records).find(record => record?.category === "vote" && record.object_id === `${seat}:confirm:${id}`);
    const body = vote?.body;
    const validIdentity = id && body?.seat === seat && body.proposalId === id &&
      typeof body.respondent_uid === "string" && body.respondent_uid.trim() &&
      typeof body.confirmedAt === "string" && Number.isFinite(Date.parse(body.confirmedAt));
    if (!validIdentity || body.choice !== "confirmed") continue;
    if (body.snapshot === snapshot && !evidenceMissingIds.length) confirmedSeats.push(seat);
    else staleSeats.push(seat);
  }
  const missingSeats = SEATS.filter(seat => !confirmedSeats.includes(seat));
  return { status: missingSeats.length ? "awaiting-partner" : "confirmed", confirmedSeats, missingSeats, staleSeats, evidenceMissingIds };
}

function nonnegative(value) {
  if (value === null || value === undefined || typeof value === "boolean" || String(value).trim() === "") return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

function parsedDate(value, endOfDay = false) {
  if (typeof value !== "string") return NaN;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const timestamp = Date.parse(`${value}T00:00:00Z`);
    if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) return NaN;
    return endOfDay ? timestamp + 86400000 - 1 : timestamp;
  }
  return Date.parse(value);
}

const MILESTONES = ["qualified", "quoted", "accepted", "completed", "invoiced", "paid"];
const STAGE_LEVEL = {
  "qualified": 0, "estimating": 0,
  "submitted": 1, "quoted": 1, "estimate sent": 1,
  "awarded": 2, "accepted": 2, "work scheduled": 2, "in progress": 2,
  "completed": 3, "invoiced": 4, "paid": 5,
};

function milestoneLevel(opportunity, cutoff, warnings, inferred) {
  const stage = String(opportunity.stage || "").trim().toLowerCase();
  let highest = Object.hasOwn(STAGE_LEVEL, stage) ? STAGE_LEVEL[stage] : -1;
  let ceiling = MILESTONES.length - 1;
  const inquiryTime = parsedDate(opportunity.inquiryDate || "");
  let lastTime = Number.isFinite(inquiryTime) ? inquiryTime : null;
  for (const [index, name] of MILESTONES.entries()) {
    const value = opportunity[`${name}At`];
    if (!value) continue;
    const timestamp = parsedDate(value);
    if (!Number.isFinite(timestamp) || timestamp > cutoff || (lastTime !== null && timestamp < lastTime)) {
      ceiling = Math.min(ceiling, index - 1);
      warnings.push(`${opportunity.id || opportunity._id || "Opportunity"}: ${name} date is invalid, future, or out of sequence; that milestone and later milestones are excluded.`);
    } else {
      highest = Math.max(highest, index);
      lastTime = timestamp;
    }
  }
  highest = Math.min(highest, ceiling);
  for (let index = 0; index <= highest; index++) {
    if (!opportunity[`${MILESTONES[index]}At`]) inferred.count++;
  }
  return highest;
}

function customerKey(opportunity) {
  if (typeof opportunity.customerId === "string" && opportunity.customerId.trim()) return `id:${opportunity.customerId.trim()}`;
  // The project/opportunity title is not necessarily a customer identity.
  const name = opportunity.customerName || opportunity.customer || opportunity.gc;
  return typeof name === "string" && name.trim() ? `name:${name.trim().replace(/\s+/g, " ").toLowerCase()}` : null;
}

// Rates are fractions, not percentages. Attribution requires the exact experiment
// ID. Later milestones imply earlier funnel steps, except explicit contradictory
// dates block the affected steps. Cash is a separately entered cumulative amount.
export function marketingMetrics(experiment, opportunities = [], { asOf = new Date().toISOString(), actualSpend: explicitSpend } = {}) {
  const cutoff = parsedDate(asOf, true);
  if (!Number.isFinite(cutoff)) throw new TypeError("A valid reporting date is required.");
  const warnings = [], inferred = { count: 0 };
  const counts = Object.fromEntries(["leads", ...MILESTONES].map(name => [name, 0]));
  const experimentId = experiment?.id || experiment?._recordId;
  const rows = (Array.isArray(opportunities) ? opportunities : []).filter(opportunity => {
    if (!opportunity || (experiment !== null && (!experimentId || opportunity.experimentId !== experimentId))) return false;
    if (!opportunity.inquiryDate) return true;
    const timestamp = parsedDate(opportunity.inquiryDate);
    if (Number.isFinite(timestamp) && timestamp > cutoff) {
      warnings.push(`${opportunity.id || opportunity._id || "Opportunity"}: future inquiry excluded.`);
      return false;
    }
    if (!Number.isFinite(timestamp)) warnings.push(`${opportunity.id || opportunity._id || "Opportunity"}: inquiry date is invalid; verify this record.`);
    return true;
  });
  let cashCollected = 0, knownInvoiceTotal = 0, directCosts = 0, grossProfit = 0, callbacks = 0, unpaidInvoices = 0, unpaidInvoiceCount = 0;
  let cashEntries = 0, invoiceEntries = 0, costEntries = 0, callbackEntries = 0, callbackMissingCount = 0, invoiceMissing = 0, invoiceCostMissing = 0, invoiceCashMissing = 0, cashMissingForPaid = 0, unidentifiedPayingRows = 0;
  const payingCustomers = new Set();
  for (const opportunity of rows) {
    counts.leads++;
    const level = milestoneLevel(opportunity, cutoff, warnings, inferred);
    for (let index = 0; index <= level; index++) counts[MILESTONES[index]]++;
    const cash = nonnegative(opportunity.cashCollected), invoice = nonnegative(opportunity.invoiceAmount), cost = nonnegative(opportunity.directCost);
    if (cash !== null) { cashCollected += cash; cashEntries++; }
    if (cost !== null) { directCosts += cost; costEntries++; }
    if (level >= 4) {
      if (invoice === null) invoiceMissing++;
      else { knownInvoiceTotal += invoice; invoiceEntries++; }
      if (invoice === null || cost === null) invoiceCostMissing++;
      else grossProfit += invoice - cost;
      if (invoice === null || cash === null) invoiceCashMissing++;
      else {
        const outstanding = Math.max(invoice - cash, 0);
        unpaidInvoices += outstanding;
        if (outstanding > 0) unpaidInvoiceCount++;
      }
    }
    if (level >= 5 && cash === null) cashMissingForPaid++;
    if (cash > 0) {
      const customer = customerKey(opportunity);
      if (customer) payingCustomers.add(customer);
      else unidentifiedPayingRows++;
    }
    const callbackCount = nonnegative(opportunity.callbacks);
    if (callbackCount !== null && Number.isInteger(callbackCount)) { callbacks += callbackCount; callbackEntries++; }
    else if (level >= 3) callbackMissingCount++;
  }
  const actualSpend = nonnegative(explicitSpend === undefined ? experiment?.actualSpend ?? experiment?.spend : explicitSpend);
  if (actualSpend === null) warnings.push("Enter actual marketing spending; a budget is not actual spending.");
  if (inferred.count) warnings.push(`${inferred.count} funnel milestones inferred from later progress or pipeline stage; record dates to verify them.`);
  if (invoiceMissing || invoiceCostMissing) warnings.push("Invoiced revenue or job costs are incomplete; gross profit is unavailable until all invoiced jobs have both.");
  if (invoiceCashMissing) warnings.push("Unpaid invoice balance is unavailable until every invoiced job has its invoice amount and allocated cash collected entered.");
  if (callbackMissingCount) warnings.push(`${callbackMissingCount} completed-job records have no valid callback count; the recorded callback sum is incomplete.`);
  if (cashMissingForPaid) warnings.push("Some paid-stage records have no cash-collected amount; paying-customer acquisition cost is unavailable.");
  if (unidentifiedPayingRows) warnings.push("Some cash receipts have no customer identity; unique paying customers and acquisition cost are incomplete.");
  const ratio = (numerator, denominator) => denominator > 0 && numerator !== null ? numerator / denominator : null;
  const uniquePayingCustomers = payingCustomers.size;
  return {
    ...counts, counts,
    actualSpend, uniquePayingCustomers, unidentifiedPayingRows,
    cashCollected: cashEntries ? cashCollected : null,
    revenueInvoiced: invoiceMissing ? null : invoiceEntries ? knownInvoiceTotal : null,
    knownInvoiceTotal,
    directCosts: costEntries ? directCosts : null,
    grossProfit: counts.invoiced && !invoiceCostMissing ? grossProfit : null,
    callbacks: callbackEntries ? callbacks : null,
    callbackEntries, callbackMissingCount,
    unpaidInvoices: counts.invoiced && !invoiceCashMissing ? unpaidInvoices : null,
    unpaidInvoiceCount: counts.invoiced && !invoiceCashMissing ? unpaidInvoiceCount : null,
    cashEntries, cashMissingCount: rows.length - cashEntries,
    costEntries, directCostMissingCount: rows.length - costEntries,
    qualifiedRate: ratio(counts.qualified, counts.leads),
    quoteRate: ratio(counts.quoted, counts.qualified),
    quoteToWinRate: ratio(counts.accepted, counts.quoted),
    leadToCustomerRate: ratio(uniquePayingCustomers, counts.leads),
    costPerLead: ratio(actualSpend, counts.leads),
    customerAcquisitionCost: unidentifiedPayingRows || cashMissingForPaid ? null : ratio(actualSpend, uniquePayingCustomers),
    cashReturnOnSpend: actualSpend > 0 && cashEntries ? cashCollected / actualSpend : null,
    asOf, inferredMilestones: inferred.count, warnings,
    definitions: {
      attribution: experiment === null ? "Whole-business view includes all recorded opportunities; actual marketing spend remains unknown unless explicitly supplied." : "Exact experiment ID; no attribution from matching channel names or project titles.",
      funnel: "Cumulative milestone counts, inferred from later progress or stage when dates are absent; contradictory dates block that step and later steps.",
      payingCustomer: "Distinct customer ID or normalized customer name with positive recorded cash collected; opportunity titles are not customer identities.",
      customerAcquisitionCost: "Actual marketing spending divided by distinct identified paying customers; unavailable if paid records lack cash amounts or paying customers lack identity.",
      grossProfit: "Invoiced amounts less direct costs on the same invoiced jobs; unavailable if an invoiced job lacks either amount. Excludes overhead and marketing spending.",
      cash: "Manually recorded cumulative cash collected, including deposits; distinct from invoiced revenue and forecast sales.",
      callbacks: "Sum of explicitly entered whole callback counts. Blank counts are unknown; no entries yields null, and missing counts on completed jobs are flagged as incomplete coverage.",
      unpaidInvoices: "Sum of max(invoice amount minus allocated cash collected, 0) on each invoiced job; no cross-job offset. Unavailable if any invoiced job lacks either amount or no invoices are recorded.",
      rates: "Fractions between 0 and 1. A zero denominator or missing required input produces null, not a claimed 0% result.",
    },
  };
}
