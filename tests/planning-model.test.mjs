import test from "node:test";
import assert from "node:assert/strict";
import { isPlanningRecord, planningRecords, evidenceUnresolved, canonicalProposal, confirmationStatus, marketingMetrics } from "../app/planning-model.js";

const AS_OF = "2026-10-19T18:00:00Z";
const proposal = {
  id: "plan:proposal:pilot", planningType: "proposal", title: "Residential pilot",
  direction: "Test selected residential service", rationale: "Validate delivery and cash",
  conditions: "Christian confirms qualified capacity", owner: "growth",
  decisionDate: "2026-10-19", reviewDate: "2026-11-02", evidenceIds: [], revision: 1,
};
const planningRow = (type, id, body = {}) => ({ category: "task", object_id: id, body: { planningType: type, ...body } });
function confirmations(current, records = {}) {
  const result = { ...records };
  for (const seat of ["christian", "growth"]) {
    const id = `${seat}:confirm:${current.id}`;
    result[`vote|${id}`] = { category: "vote", object_id: id, body: {
      seat, respondent_uid: `account-${seat}`, proposalId: current.id,
      choice: "confirmed", snapshot: canonicalProposal(current, records), confirmedAt: AS_OF,
    } };
  }
  return result;
}

test("planning collections cannot absorb real tasks, old answers, or another category's disguised planning body", () => {
  const records = {
    old: { category: "response", object_id: "growth:company_assets", body: { value: "Earlier answer", planningType: "evidence" } },
    task: { category: "task", object_id: "t1", body: { title: "Original task" } },
    evidence: planningRow("evidence", "plan:evidence:capacity", { id: "capacity", classification: "unknown", title: "Capacity", verified: false }),
    proposal: planningRow("proposal", proposal.id, proposal),
    malformed: { category: "task", object_id: "bad", body: [] },
  };
  const original = structuredClone(records);
  assert.equal(isPlanningRecord(records.task), false);
  assert.equal(isPlanningRecord(records.old), false);
  assert.equal(isPlanningRecord(records.evidence, "evidence"), true);
  assert.equal(isPlanningRecord(records.evidence, "proposal"), false);
  const result = planningRecords(records, "evidence");
  assert.equal(result.length, 1);
  assert.equal(result[0].id, "capacity", "Logical IDs are distinct from the typed storage key");
  assert.equal(result[0]._recordId, "plan:evidence:capacity");
  assert.equal(result[0].classification, "unknown");
  assert.equal(result[0].verified, false, "Displaying an evidence record must not verify its claims");
  assert.deepEqual(planningRecords(Object.values(records), "evidence"), result);
  assert.deepEqual(records, original, "Reads must preserve historical data and classifications");
});

test("logical document IDs retain typed storage IDs and linked evidence resolves by logical ID", () => {
  const rows = [
    planningRow("evidence", "plan:evidence:capacity", { id: "capacity", classification: "unknown", details: "Verify available labor" }),
    planningRow("finance-settings", "plan:finance-settings:settings", { id: "settings", openingCash: 0 }),
    planningRow("plan-settings", "plan:plan-settings:settings", { id: "settings", objective: "Validate pilot" }),
  ];
  assert.equal(planningRecords(rows, "finance-settings")[0]._recordId, "plan:finance-settings:settings");
  assert.equal(planningRecords(rows, "plan-settings")[0]._recordId, "plan:plan-settings:settings");
  const current = { ...proposal, evidenceIds: ["capacity"] };
  const records = confirmations(current, Object.fromEntries(rows.map(row => [row.object_id, row])));
  assert.equal(confirmationStatus(current, records).status, "confirmed");
  assert.deepEqual(confirmationStatus(current, records).evidenceMissingIds, []);
});

test("unverified estimates remain unresolved even without a separately written open question", () => {
  assert.equal(evidenceUnresolved({ classification: "estimate", verification: "unverified", remainingQuestion: "" }), true);
  assert.equal(evidenceUnresolved({ classification: "unknown", verification: "verified" }), true);
  assert.equal(evidenceUnresolved({ classification: "confirmed", verification: "verified", remainingQuestion: "Check whether scope changed" }), true);
  assert.equal(evidenceUnresolved({ classification: "confirmed", verification: "verified", remainingQuestion: " \n " }), false);
  assert.equal(evidenceUnresolved({ classification: "estimate", verification: "verified" }), false, "A checked estimate remains an estimate without necessarily being an open research task");
  assert.equal(evidenceUnresolved(null), false);
});

test("proposal fingerprints are deterministic but do not rely on a mutable revision counter", () => {
  const reordered = Object.fromEntries(Object.entries(proposal).reverse());
  assert.equal(canonicalProposal(reordered), canonicalProposal(proposal));
  assert.equal(canonicalProposal({ ...proposal, revision: 20, updatedAt: AS_OF, status: "confirmed" }), canonicalProposal(proposal));
  assert.notEqual(canonicalProposal({ ...proposal, direction: "Launch commercial jobs", revision: 1 }), canonicalProposal(proposal));
});

test("matching partner preferences never become a confirmed joint decision", () => {
  const records = Object.fromEntries(["christian", "growth"].map(seat => [seat, {
    category: "vote", object_id: `${seat}:launch_path`, body: { seat, choice: proposal.direction, respondent_uid: `account-${seat}` },
  }]));
  assert.deepEqual(confirmationStatus(proposal, records), {
    status: "awaiting-partner", confirmedSeats: [], missingSeats: ["christian", "growth"], staleSeats: [], evidenceMissingIds: [],
  });
  const both = confirmations(proposal, records);
  delete both[`vote|growth:confirm:${proposal.id}`];
  assert.deepEqual(confirmationStatus(proposal, both).confirmedSeats, ["christian"]);
  assert.equal(confirmationStatus(proposal, both).status, "awaiting-partner");
  assert.equal(confirmationStatus(proposal, confirmations(proposal, records)).status, "confirmed");
});

test("editing any agreed direction, rationale, conditions, responsibility, or date invalidates prior confirmations", () => {
  const records = confirmations(proposal);
  for (const field of ["direction", "rationale", "conditions", "owner", "decisionDate", "reviewDate", "title"]) {
    const changed = { ...proposal, [field]: `Changed ${field}` };
    const status = confirmationStatus(changed, records);
    assert.equal(status.status, "awaiting-partner", field);
    assert.deepEqual(status.staleSeats, ["christian", "growth"], field);
  }
  assert.equal(confirmationStatus({ ...proposal, revision: 1 }, records).status, "confirmed");
});

test("linked source edits invalidate approvals immediately and missing references cannot be approved", () => {
  const current = { ...proposal, evidenceIds: ["plan:evidence:capacity"] };
  const evidence = { evidence: planningRow("evidence", "plan:evidence:capacity", {
    title: "Capacity", classification: "estimate", owner: "christian", source: "Partner discussion", details: "Weekends only", verified: false,
  }) };
  const records = confirmations(current, evidence);
  assert.equal(confirmationStatus(current, records).status, "confirmed");
  records.evidence.body.details = "No weekend coverage available";
  assert.equal(confirmationStatus(current, records).status, "awaiting-partner");
  assert.deepEqual(confirmationStatus(current, records).staleSeats, ["christian", "growth"]);
  assert.equal(records.evidence.body.classification, "estimate");
  assert.equal(records.evidence.body.verified, false, "Agreement must not promote an estimate to a verified fact");
  const missing = confirmations(current);
  assert.deepEqual(confirmationStatus(current, missing).evidenceMissingIds, ["plan:evidence:capacity"]);
  assert.equal(confirmationStatus(current, missing).status, "awaiting-partner");
  const staleStoredSnapshot = { ...current, evidenceSnapshot: "Pretend the old evidence still applies" };
  assert.equal(canonicalProposal(staleStoredSnapshot, records), canonicalProposal(current, records));
});

test("each confirmation must have its own protected record identity and current snapshot", () => {
  for (const change of [
    body => { body.seat = "christian"; },
    body => { body.proposalId = "another-proposal"; },
    body => { body.respondent_uid = ""; },
    body => { body.confirmedAt = "invalid-date"; },
    body => { body.choice = "preferred"; },
    body => { body.snapshot = "old-content"; },
  ]) {
    const records = confirmations(proposal);
    change(records[`vote|growth:confirm:${proposal.id}`].body);
    assert.equal(confirmationStatus(proposal, records).status, "awaiting-partner");
  }
  const records = confirmations(proposal);
  records[`vote|growth:confirm:${proposal.id}`].category = "task";
  assert.equal(confirmationStatus(proposal, records).status, "awaiting-partner");
});

test("marketing requires exact experiment attribution and actual spending, without manufacturing zero-data success", () => {
  const experiment = { id: "plan:experiment:one", channel: "Referrals", budget: 500 };
  const metrics = marketingMetrics(experiment, [
    { id: "wrong", experimentId: "other", channel: "Referrals", stage: "Paid", cashCollected: 1000, customerId: "x" },
    { id: "unattributed", channel: "Referrals", stage: "Paid", cashCollected: 1000, customerId: "y" },
  ], { asOf: AS_OF });
  assert.equal(metrics.leads, 0);
  assert.equal(metrics.actualSpend, null, "A proposed budget is not money spent");
  for (const field of ["qualifiedRate", "quoteRate", "quoteToWinRate", "costPerLead", "customerAcquisitionCost", "cashReturnOnSpend", "revenueInvoiced", "grossProfit"]) assert.equal(metrics[field], null, field);
  assert.ok(metrics.warnings.some(warning => warning.includes("actual marketing spending")));
});

test("the funnel is cumulative and lost opportunities retain only their recorded progress", () => {
  const metrics = marketingMetrics({ id: "e", actualSpend: 60 }, [
    { id: "new", experimentId: "e", stage: "New lead" },
    { id: "bid-invite", experimentId: "e", stage: "Invited to bid" },
    { id: "quote", experimentId: "e", stage: "Submitted" },
    { id: "lost", experimentId: "e", stage: "Not pursued", qualifiedAt: "2026-10-10", quotedAt: "2026-10-11" },
    { id: "unknown-loss", experimentId: "e", stage: "Not pursued" },
    { id: "won", experimentId: "e", stage: "Awarded" },
  ], { asOf: AS_OF });
  assert.deepEqual(metrics.counts, { leads: 6, qualified: 3, quoted: 3, accepted: 1, completed: 0, invoiced: 0, paid: 0 });
  assert.equal(metrics.qualifiedRate, .5);
  assert.equal(metrics.quoteRate, 1);
  assert.equal(metrics.quoteToWinRate, 1 / 3);
  assert.equal(metrics.costPerLead, 10);
  assert.ok(metrics.inferredMilestones > 0);
});

test("whole-business results include unattributed opportunities without inventing marketing spend", () => {
  const rows = [
    { experimentId: "e", stage: "Submitted" },
    { stage: "Awarded" },
  ];
  const metrics = marketingMetrics(null, rows, { asOf: AS_OF });
  assert.equal(metrics.leads, 2);
  assert.equal(metrics.quoted, 2);
  assert.equal(metrics.accepted, 1);
  assert.equal(metrics.quoteToWinRate, .5);
  assert.equal(metrics.actualSpend, null);
  assert.equal(marketingMetrics(null, rows, { asOf: AS_OF, actualSpend: 100 }).costPerLead, 50);
  assert.equal(marketingMetrics({ id: "e", spend: 50 }, rows, { asOf: AS_OF }).actualSpend, 50, "The form's saved spend field is actual spending, never budget");
  assert.equal(marketingMetrics({ id: "e", actualSpend: 0, spend: 50 }, rows, { asOf: AS_OF }).actualSpend, 0, "Explicit actualSpend, including zero, takes precedence over legacy spend");
});

test("future and contradictory dates cannot create conversion or contaminate current inquiry counts", () => {
  const metrics = marketingMetrics({ id: "e", actualSpend: 100 }, [
    { id: "future-lead", experimentId: "e", inquiryDate: "2026-11-01", stage: "Paid", cashCollected: 9999, customerId: "future" },
    { id: "future-quote", experimentId: "e", inquiryDate: "2026-10-01", qualifiedAt: "2026-10-02", quotedAt: "2026-11-01", stage: "Paid" },
    { id: "wrong-order", experimentId: "e", inquiryDate: "2026-10-01", qualifiedAt: "2026-10-10", quotedAt: "2026-10-05", stage: "Awarded" },
  ], { asOf: AS_OF });
  assert.equal(metrics.leads, 2);
  assert.equal(metrics.qualified, 2);
  assert.equal(metrics.quoted, 0);
  assert.equal(metrics.accepted, 0);
  assert.equal(metrics.cashCollected, null);
  assert.ok(metrics.warnings.some(warning => warning.includes("future inquiry excluded")));
  assert.throws(() => marketingMetrics({ id: "e" }, [], { asOf: "bad-date" }), /valid reporting date/);
  assert.throws(() => marketingMetrics({ id: "e" }, [], { asOf: "2026-02-30" }), /valid reporting date/);
  const sameDay = marketingMetrics({ id: "e", actualSpend: 0 }, [{ experimentId: "e", inquiryDate: "2026-10-19T12:00:00Z", quotedAt: "2026-10-19T16:00:00Z" }], { asOf: "2026-10-19" });
  assert.equal(sameDay.quoted, 1, "A date-only reporting day includes that entire day");
});

test("cash-paying customers are deduplicated by identity, not paid job count or opportunity title", () => {
  const metrics = marketingMetrics({ id: "e", actualSpend: 150 }, [
    { experimentId: "e", stage: "Paid", customerName: "  Acme   Properties ", cashCollected: 200, invoiceAmount: 200, directCost: 90 },
    { experimentId: "e", stage: "Paid", customerName: "acme properties", cashCollected: 300, invoiceAmount: 300, directCost: 110 },
    { experimentId: "e", stage: "Accepted", customerId: "second", cashCollected: 50, invoiceAmount: 1000, directCost: 10 },
  ], { asOf: AS_OF });
  assert.equal(metrics.uniquePayingCustomers, 2);
  assert.equal(metrics.customerAcquisitionCost, 75);
  assert.equal(metrics.cashCollected, 550, "Deposits count as cash without inventing invoiced revenue");
  assert.equal(metrics.revenueInvoiced, 500);
  assert.equal(metrics.directCosts, 210);
  assert.equal(metrics.grossProfit, 300, "Only costs matched to invoiced jobs enter invoice-based gross profit");
  assert.equal(metrics.cashReturnOnSpend, 550 / 150);
});

test("missing customer identity or actual cash cannot yield a misleading acquisition cost", () => {
  const noIdentity = marketingMetrics({ id: "e", actualSpend: 100 }, [
    { experimentId: "e", name: "Repair project", stage: "Paid", cashCollected: 250 },
  ], { asOf: AS_OF });
  assert.equal(noIdentity.uniquePayingCustomers, 0);
  assert.equal(noIdentity.unidentifiedPayingRows, 1);
  assert.equal(noIdentity.customerAcquisitionCost, null);
  const noCash = marketingMetrics({ id: "e", actualSpend: 100 }, [
    { experimentId: "e", customerId: "x", stage: "Paid", value: "$10,000" },
  ], { asOf: AS_OF });
  assert.equal(noCash.paid, 1);
  assert.equal(noCash.cashCollected, null);
  assert.equal(noCash.customerAcquisitionCost, null);
  assert.equal(noCash.revenueInvoiced, null, "Estimated value never becomes recognized invoiced revenue");
});

test("missing job cost prevents a claimed profit while zero and negative-profit jobs remain meaningful", () => {
  const missing = marketingMetrics({ id: "e", actualSpend: 0 }, [
    { experimentId: "e", stage: "Invoiced", invoiceAmount: 200, directCost: "" },
  ], { asOf: AS_OF });
  assert.equal(missing.revenueInvoiced, 200);
  assert.equal(missing.grossProfit, null);
  const loss = marketingMetrics({ id: "e", actualSpend: 0 }, [
    { experimentId: "e", stage: "Paid", customerId: "a", invoiceAmount: 100, directCost: 150, cashCollected: 100, callbacks: 2 },
    { experimentId: "e", stage: "Invoiced", invoiceAmount: 0, directCost: 10, cashCollected: 0 },
  ], { asOf: AS_OF });
  assert.equal(loss.grossProfit, -60);
  assert.equal(loss.customerAcquisitionCost, 0, "Explicit zero actual spend differs from an unknown spend");
  assert.equal(loss.cashReturnOnSpend, null, "Zero advertising spend cannot produce an infinite return claim");
  assert.equal(loss.callbacks, 2);
  const invalid = marketingMetrics({ id: "e", actualSpend: -1 }, [], { asOf: AS_OF });
  assert.equal(invalid.actualSpend, null);
});

test("blank callback counts remain unknown, explicit zeros are valid, and partial coverage stays visible", () => {
  const noEntries = marketingMetrics(null, [{ stage: "Completed", callbacks: "" }, { stage: "New lead" }], { asOf: AS_OF });
  assert.equal(noEntries.callbacks, null);
  assert.equal(noEntries.callbackEntries, 0);
  assert.equal(noEntries.callbackMissingCount, 1);
  const zero = marketingMetrics(null, [{ stage: "Completed", callbacks: "0" }], { asOf: AS_OF });
  assert.equal(zero.callbacks, 0);
  assert.equal(zero.callbackMissingCount, 0);
  const partial = marketingMetrics(null, [{ stage: "Completed", callbacks: 2 }, { stage: "Completed", callbacks: "" }], { asOf: AS_OF });
  assert.equal(partial.callbacks, 2, "The sum describes recorded callbacks, not unreported work");
  assert.equal(partial.callbackMissingCount, 1);
  assert.ok(partial.warnings.some(warning => warning.includes("callback sum is incomplete")));
  assert.equal(marketingMetrics(null, [{ stage: "Completed", callbacks: .5 }], { asOf: AS_OF }).callbacks, null);
});

test("unpaid invoice balance uses each job's allocated collections, with unknown amounts blocking a total", () => {
  const rows = [
    { stage: "Invoiced", invoiceAmount: 100, cashCollected: 10 },
    { stage: "Paid", invoiceAmount: 100, cashCollected: 200 },
    { stage: "Accepted", cashCollected: 1000 },
  ];
  const metrics = marketingMetrics(null, rows, { asOf: AS_OF });
  assert.equal(metrics.unpaidInvoices, 90, "Another job's overpayment or deposit cannot clear an unpaid invoice");
  assert.equal(metrics.unpaidInvoiceCount, 1);
  rows[0].cashCollected = "";
  assert.equal(marketingMetrics(null, rows, { asOf: AS_OF }).unpaidInvoices, null);
  assert.equal(marketingMetrics(null, [], { asOf: AS_OF }).unpaidInvoices, null);
  assert.equal(marketingMetrics(null, [{ stage: "Invoiced", invoiceAmount: 0, cashCollected: 0 }], { asOf: AS_OF }).unpaidInvoices, 0);
});

test("legacy confirmation fingerprints remain byte-for-byte stable without typed source references", () => {
  const oldFingerprint = '{"conditions":"Christian confirms qualified capacity","decisionDate":"2026-10-19","direction":"Test selected residential service","evidenceIds":[],"evidenceSnapshot":[],"owner":"growth","rationale":"Validate delivery and cash","reviewDate":"2026-11-02","title":"Residential pilot"}';
  assert.equal(canonicalProposal(proposal), oldFingerprint);
  assert.equal(canonicalProposal({ ...proposal, sourceRefs: [] }), oldFingerprint, "An empty new reference picker does not stale an unchanged legacy agreement");
  assert.equal(confirmationStatus(proposal, confirmations(proposal)).status, "confirmed");
});

test("typed references protect current response, segment and charter content including meaningful source status", () => {
  const charter = { id: "charter", planningType: "charter", title: "Our working arrangement", sourceRefs: ["response:christian:business_mandate", "segment:residential"], evidenceIds: [] };
  const sources = {
    response: { category: "response", object_id: "christian:business_mandate", body: { seat: "christian", value: "Limited hours", explanation: "Technical approval retained", updatedAt: "2026-10-19" } },
    segment: planningRow("segment", "plan:segment:residential", { id: "residential", title: "Selected homeowners", status: "proposed", sourceRefs: ["evidence:coverage"] }),
    evidence: planningRow("evidence", "plan:evidence:coverage", { id: "coverage", title: "Weekday coverage", verification: "unverified", classification: "unknown" }),
  };
  const records = confirmations(charter, sources);
  assert.equal(confirmationStatus(charter, records).status, "confirmed");
  const saved = canonicalProposal(charter, records);
  assert.equal(canonicalProposal({ ...charter, sourceRefs: [...charter.sourceRefs].reverse(), sourceSnapshot: "fake old sources" }, records), saved);
  records.response.body.updatedAt = "2026-10-20";
  records.segment.body.revision = 100;
  assert.equal(canonicalProposal(charter, records), saved, "Storage metadata is not strategy content");
  for (const mutate of [
    rows => { rows.response.body.value = "No weekday availability"; },
    rows => { rows.segment.body.status = "rejected"; },
    rows => { rows.evidence.body.verification = "verified"; },
    rows => { rows.evidence.body.title = "Coverage withdrawn"; },
  ]) {
    const changed = structuredClone(records); mutate(changed);
    assert.deepEqual(confirmationStatus(charter, changed).staleSeats, ["christian", "growth"]);
  }
});

test("nested missing sources block confirmation even when the stored snapshot matches", () => {
  const current = { ...proposal, sourceRefs: ["charter:charter", "response:christian:absent"] };
  const source = { charter: planningRow("charter", "plan:charter:charter", { id: "charter", evidenceIds: ["missing-coverage"], sourceRefs: ["segment:missing-segment"] }) };
  const records = confirmations(current, source);
  const state = confirmationStatus(current, records);
  assert.equal(state.status, "awaiting-partner");
  assert.deepEqual(state.confirmedSeats, []);
  assert.deepEqual(state.sourceMissingIds, ["evidence:missing-coverage", "response:christian:absent", "segment:missing-segment"]);
  assert.deepEqual(state.staleSeats, ["christian", "growth"]);
});

test("cyclic source references are deterministic and still invalidate on changes to any reached record", () => {
  const current = { ...proposal, sourceRefs: ["segment:a"] };
  const source = {
    a: planningRow("segment", "plan:segment:a", { id: "a", title: "A", sourceRefs: ["charter:b"] }),
    b: planningRow("charter", "plan:charter:b", { id: "b", title: "B", sourceRefs: ["segment:a"] }),
  };
  const records = confirmations(current, source);
  assert.equal(confirmationStatus(current, records).status, "confirmed");
  assert.match(canonicalProposal(current, records), /"cycle":true/);
  records.b.body.title = "B revised";
  assert.equal(confirmationStatus(current, records).status, "awaiting-partner");
  const deep = {};
  for (let index = 0; index < 15; index++) deep[index] = planningRow("segment", `plan:segment:${index}`, { id: String(index), title: String(index), sourceRefs: index < 14 ? [`segment:${index + 1}`] : [] });
  const oversized = { ...proposal, sourceRefs: ["segment:0"] };
  assert.ok(confirmationStatus(oversized, confirmations(oversized, deep)).sourceMissingIds.length, "Excessive depth requires explicit review rather than silently excluding content");
});

test("ordinary tasks and opportunities are covered sources, while typed form links cannot silently bypass coverage", () => {
  const current = { ...proposal, sourceRefs: ["task:followup", "opportunity:job-1"] };
  const records = confirmations(current, {
    task: { category: "task", object_id: "followup", body: { title: "Review coverage", status: "in-progress" } },
    job: { category: "opportunity", object_id: "job-1", body: { title: "A real opportunity", invoiceAmount: "100" } },
  });
  assert.equal(confirmationStatus(current, records).status, "confirmed");
  records.task.body.status = "blocked";
  assert.equal(confirmationStatus(current, records).status, "awaiting-partner");
  const brief = { id: "strategy-brief", planningType: "strategy-brief", selectedSegmentId: "specific", sourceRefs: [] };
  const selected = confirmations(brief, {
    segment: planningRow("segment", "plan:segment:specific", { id: "specific", title: "A specific buyer", jobModelIds: ["job"], capabilityStatus: "unknown" }),
    job: planningRow("job-model", "plan:job-model:job", { id: "job", salePrice: "200" }),
  });
  assert.equal(confirmationStatus(brief, selected).status, "confirmed");
  selected.job.body.salePrice = "100";
  assert.equal(confirmationStatus(brief, selected).status, "awaiting-partner");
  delete selected.job;
  assert.deepEqual(confirmationStatus(brief, selected).sourceMissingIds, ["job-model:job"]);
});

test("captured forecast baselines protect their frozen content without following current live provenance", () => {
  const current = { ...proposal, sourceRefs: ["forecast-baseline:baseline-1"] };
  const records = confirmations(current, {
    baseline: planningRow("forecast-baseline", "plan:forecast-baseline:baseline-1", { id: "baseline-1", capturedAt: AS_OF, scenario: "base", sourceRefs: ["job-model:repair"], inputs: { salePrice: 100 }, forecast: { revenue: 1000 } }),
    live: planningRow("job-model", "plan:job-model:repair", { id: "repair", salePrice: 100 }),
  });
  assert.equal(confirmationStatus(current, records).status, "confirmed");
  records.live.body.salePrice = 200;
  assert.equal(confirmationStatus(current, records).status, "confirmed", "A new forecast does not rewrite a historical baseline");
  delete records.live;
  assert.equal(confirmationStatus(current, records).status, "confirmed", "Frozen inputs do not depend on live source retention");
  records.baseline.body.forecast.revenue = 2000;
  assert.equal(confirmationStatus(current, records).status, "awaiting-partner", "Changing captured values still invalidates confirmation");
});

test("actual-job service selections resolve to financial models while demand selections resolve to capacity models", () => {
  const current = { ...proposal, sourceRefs: ["job-actual:actual", "demand-week:demand"] };
  const sources = {
    actual: planningRow("job-actual", "plan:job-actual:actual", { id: "actual", serviceModelId: "financial", revenue: 100 }),
    demand: planningRow("demand-week", "plan:demand-week:demand", { id: "demand", serviceModelId: "capacity", jobs: 1 }),
    finance: planningRow("job-model", "plan:job-model:financial", { id: "financial", title: "Costed service" }),
    capacity: planningRow("service-capacity", "plan:service-capacity:capacity", { id: "capacity", jobModelId: "financial", fieldHours: 2 }),
  };
  const records = confirmations(current, sources);
  assert.equal(confirmationStatus(current, records).status, "confirmed");
  records.finance.body.title = "Revised service";
  assert.equal(confirmationStatus(current, records).status, "awaiting-partner");
});

test("dense cross-linked source graphs serialize each record once and remain sensitive to all content", () => {
  const sources = {};
  for (let index = 0; index < 12; index++) sources[index] = planningRow("segment", `plan:segment:${index}`, { id: String(index), title: `Segment ${index}`, sourceRefs: Array.from({ length: 12 }, (_, other) => `segment:${other}`) });
  const current = { ...proposal, sourceRefs: ["segment:0"] };
  const records = confirmations(current, sources);
  const snapshot = canonicalProposal(current, records);
  assert.ok(snapshot.length < 20000, "Cross-links use references rather than exponential repeated content");
  assert.equal(confirmationStatus(current, records).status, "confirmed");
  records[11].body.title = "Changed reachable source";
  assert.equal(confirmationStatus(current, records).status, "awaiting-partner");
});
