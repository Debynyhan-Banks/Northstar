import test from "node:test";
import assert from "node:assert/strict";
import { questionsForSeat, questionText, questionHint, questionPrompt, questionHelpPrompts, hasAnswer, responseStatus, responseAnswered, getResponse, completion, questionStatus, compareResponses, topicStatus } from "../app/discovery-model.js";
import { QUESTIONS as STRATEGY_QUESTIONS, STRATEGY_TOPICS } from "../app/strategy-content.js";

const questions = [
  { id: "capacity", audience: "christian", type: "long", label: "Available HVAC capacity?" },
  { id: "time", audience: "growth", type: "long", label: "Available business hours?" },
  { id: "sequence", audience: "both", type: "single", label: "Which sequence?", labels: { christian: "Which sequence can we deliver?" }, hint: "Compare capacity and cash.", hints: { growth: "Consider our launch budget." } },
  { id: "vision", audience: "both", type: "long", label: "Our vision?" },
  { id: "fact", audience: "both", type: "single", compare: false, label: "A factual confirmation" },
];
function records(entries) {
  return Object.fromEntries(entries.map(([seat, id, value, explanation]) => [`response|${seat}:${id}`, { category: "response", object_id: `${seat}:${id}`, body: { seat, value, ...(explanation === undefined ? {} : { explanation }), respondent_uid: `user-${seat}`, updatedAt: "2026-10-19T12:00:00Z" } }]));
}

test("each partner sees only their own questions and shared questions", () => {
  assert.deepEqual(questionsForSeat(questions, "christian").map(q => q.id), ["capacity", "sequence", "vision", "fact"]);
  assert.deepEqual(questionsForSeat(questions, "growth").map(q => q.id), ["time", "sequence", "vision", "fact"]);
  assert.equal(questionsForSeat(questions, "outsider").length, 0);
  assert.equal(questionText(questions[2], "christian"), "Which sequence can we deliver?");
  assert.equal(questionText(questions[2], "growth"), "Which sequence?");
  assert.equal(questionHint(questions[2], "growth"), "Consider our launch budget.");
  assert.equal(questionHint(questions[2], "christian"), "Compare capacity and cash.");
});

test("legacy response keys and bodies retain all saved metadata without mutation", () => {
  const saved = records([["christian", "capacity", "Weekends only"]]);
  const original = structuredClone(saved);
  const body = saved["response|christian:capacity"].body;
  assert.equal(getResponse(saved, "christian", "capacity"), body);
  assert.equal(getResponse(saved, "growth", "capacity"), null);
  assert.equal(getResponse(null, "christian", "capacity"), null);
  assert.equal(getResponse({ "response|christian:capacity": body }, "christian", "capacity"), body);
  completion(questions, saved, "christian");
  compareResponses(questions, saved);
  assert.deepEqual(saved, original);
});

test("blank selections stay unanswered and a written alternative counts toward the correct partner", () => {
  assert.equal(hasAnswer([" ", "\n", null]), false);
  assert.equal(hasAnswer([" ", "Residential service"]), true);
  assert.equal(responseAnswered({ value: [], explanation: " \n " }), false);
  assert.equal(responseAnswered({ value: "", explanation: "A phased residential pilot" }), true);
  const saved = records([["growth", "sequence", "", "A phased residential pilot"], ["christian", "capacity", "Weekends only"]]);
  assert.deepEqual(completion(questions, saved, "growth"), { answered: 1, total: 4, percent: 25 });
  assert.deepEqual(completion([], saved, "growth"), { answered: 0, total: 0, percent: 0 });
});

test("choice comparison ignores selection order but never equates different rationales", () => {
  const q = { audience: "both", type: "multi" };
  assert.equal(questionStatus(q, { value: ["Repair", "Maintenance"] }, { value: ["Maintenance", "Repair"] }), "aligned");
  assert.equal(questionStatus(q, { value: ["Repair", "Maintenance"], explanation: "Cash quickly" }, { value: ["Maintenance", "Repair"], explanation: "Recurring customers" }), "discussion");
  assert.equal(questionStatus(q, { value: ["Repair"] }, { value: ["Maintenance"] }), "different");
  assert.equal(questionStatus(q, { value: ["Repair"] }, { value: [" "] }), "pending");
});

test("written and notes-only answers require discussion even with identical words", () => {
  assert.equal(questionStatus({ type: "long" }, { value: "A stable company" }, { value: "A stable company" }), "discussion");
  assert.equal(questionStatus({ type: "single" }, { value: "", explanation: "Pilot first" }, { value: "", explanation: "Pilot first" }), "discussion");
  assert.equal(questionStatus({ type: "single" }, { value: "Residential" }, null), "pending");
});

test("only shared comparable questions enter alignment; factual answers do not create false conflicts", () => {
  const saved = records([["christian", "capacity", "Weekends"], ["christian", "fact", "Yes"], ["christian", "sequence", "Pilot"], ["growth", "sequence", "Pilot"]]);
  const pairs = compareResponses(questions, saved);
  assert.deepEqual(pairs.map(pair => [pair.q.id, pair.status]), [["sequence", "aligned"], ["vision", "pending"]]);
  assert.equal(pairs[0].a.respondent_uid, "user-christian");
});

test("topic readiness requires each mapped partner input, without comparing different roles", () => {
  const topic = { id: "launch", christian: ["capacity"], growth: ["time"] };
  const saved = records([["christian", "capacity", "Weekends"], ["growth", "capacity", "Legacy irrelevant answer"]]);
  assert.deepEqual(topicStatus(topic, questions, saved), { christian: { answered: 1, total: 1 }, growth: { answered: 0, total: 1 }, status: "pending" });
  Object.assign(saved, records([["growth", "time", "", "Ten business hours each week"]]));
  assert.deepEqual(topicStatus(topic, questions, saved), { christian: { answered: 1, total: 1 }, growth: { answered: 1, total: 1 }, status: "ready" });
});

test("topic conflicts come only from completed shared questions; missing targeted input stays pending", () => {
  const topic = { id: "launch", christian: ["capacity", "sequence"], growth: ["time", "sequence"] };
  const saved = records([["christian", "capacity", "Weekends"], ["christian", "sequence", "Residential"], ["growth", "sequence", "Commercial"]]);
  assert.equal(topicStatus(topic, questions, saved).status, "pending");
  Object.assign(saved, records([["growth", "time", "Ten hours"]]));
  assert.equal(topicStatus(topic, questions, saved).status, "different");
  Object.assign(saved, records([["growth", "sequence", "Residential", "Conditional on a budget"]]));
  assert.equal(topicStatus(topic, questions, saved).status, "discussion");
  assert.equal(topicStatus({ christian: [], growth: [] }, questions, saved).status, "pending");
});

test("the actual questionnaire assigns HVAC feasibility and company facts to Christian and business design to Debynyhan", () => {
  const christian = new Set(questionsForSeat(STRATEGY_QUESTIONS, "christian").map(q => q.id));
  const growth = new Set(questionsForSeat(STRATEGY_QUESTIONS, "growth").map(q => q.id));
  for (const id of ["residential_first", "company_assets", "capital_available", "business_mandate"]) {
    assert.ok(christian.has(id), `Christian needs ${id}`);
    assert.ok(!growth.has(id), `Debynyhan should not be asked Christian's ${id}`);
  }
  for (const id of ["growth_strategy", "business_readiness", "systems_workflow", "skills_support", "startup_economics"]) {
    assert.ok(growth.has(id), `Debynyhan needs ${id}`);
    assert.ok(!christian.has(id), `Christian should not be asked Debynyhan's ${id}`);
  }
  for (const id of ["three_year", "success_definition", "partner_role_title", "union_membership", "business_lead_scope", "joint_decisions"]) {
    assert.ok(christian.has(id) && growth.has(id), `Both partners need their own ${id} response`);
  }
});

test("different personal roles, visions and available hours do not become automatic disagreements", () => {
  const saved = records([
    ["christian", "partner_role_title", "President and technical lead"],
    ["growth", "partner_role_title", "Business development and systems"],
    ["christian", "weekly_time", "5–10 hours"],
    ["growth", "weekly_time", "More than 25 hours"],
  ]);
  const pairs = compareResponses(STRATEGY_QUESTIONS, saved);
  for (const id of ["partner_role_title", "weekly_time", "three_year", "union_membership"]) {
    assert.ok(!pairs.some(pair => pair.q.id === id), `${id} needs contextual discussion, not a matching score`);
  }
  assert.ok(pairs.some(pair => pair.q.id === "primary_goal"));
  assert.ok(pairs.every(pair => pair.q.audience === "both" && pair.q.compare !== false));
});

test("every dashboard topic resolves to real questions assigned to the indicated partner", () => {
  assert.equal(new Set(STRATEGY_QUESTIONS.map(q => q.id)).size, STRATEGY_QUESTIONS.length, "Question IDs must be unique to preserve saved answers");
  assert.equal(new Set(STRATEGY_TOPICS.map(topic => topic.id)).size, STRATEGY_TOPICS.length);
  for (const topic of STRATEGY_TOPICS) {
    for (const seat of ["christian", "growth"]) {
      const eligible = new Set(questionsForSeat(STRATEGY_QUESTIONS, seat).map(q => q.id));
      assert.ok(topic[seat].length > 0, `${topic.id} needs an input from ${seat}`);
      assert.equal(new Set(topic[seat]).size, topic[seat].length, `Duplicate ${seat} inputs in ${topic.id}`);
      for (const id of topic[seat]) assert.ok(eligible.has(id), `${topic.id} routes ${id} to the wrong partner or a missing question`);
      assert.equal(topicStatus(topic, STRATEGY_QUESTIONS, {}).status, "pending");
    }
  }
});

test("residential strategy choices extend the previous commercial options", () => {
  const byId = new Map(STRATEGY_QUESTIONS.map(q => [q.id, q]));
  for (const id of ["primary_goal", "target_markets", "preferred_services", "brand_position", "ninety_success"]) {
    const question = byId.get(id);
    assert.equal(question.audience, "both");
    assert.ok(question.options.some(option => /residential|homeowners/i.test(option)), `${id} must permit evaluating residential work`);
  }
  assert.ok(byId.get("primary_goal").options.includes("Build a steady commercial customer base"));
  assert.ok(byId.get("preferred_services").options.includes("Commercial HVAC installations"));
  assert.ok(byId.get("preferred_services").options.includes("Other (explain below)"));
});

test("strategy completion preserves old answers even after an earlier shared question becomes role-specific", () => {
  const saved = records([
    ["growth", "company_assets", ["Business bank account", "A historical custom selection"], "Earlier notes retained"],
    ["christian", "company_assets", ["Business bank account"]],
    ["growth", "growth_strategy", "", "Test a small residential offer after Christian confirms capacity"],
  ]);
  const original = structuredClone(saved);
  const growth = completion(STRATEGY_QUESTIONS, saved, "growth");
  const christian = completion(STRATEGY_QUESTIONS, saved, "christian");
  assert.equal(growth.answered, 1, "The old company-facts answer is retained without counting against Debynyhan's new role");
  assert.equal(christian.answered, 1);
  for (const topic of STRATEGY_TOPICS) topicStatus(topic, STRATEGY_QUESTIONS, saved);
  compareResponses(STRATEGY_QUESTIONS, saved);
  assert.deepEqual(saved, original, "Dashboard and progress calculations must not delete or rewrite historical responses");
});

test("explicit response states retain text without treating drafts or unknowns as completed", () => {
  for (const answerStatus of ["unanswered", "draft", "unknown", "skipped"]) {
    const response = { answerStatus, value: "A retained installation plan", explanation: "Keep these notes", respondent_uid: "partner-a", updatedAt: "2026-10-19T12:00:00Z" };
    const original = structuredClone(response);
    assert.equal(responseStatus(response), answerStatus);
    assert.equal(responseAnswered(response), false);
    assert.deepEqual(response, original, "Status evaluation must not erase draft text or attribution");
  }
  assert.equal(responseStatus(null), "unanswered");
  assert.equal(responseStatus([]), "unanswered");
  assert.equal(responseStatus({ answerStatus: "answered", value: "   " }), "unanswered", "An empty completed flag cannot inflate progress");
  assert.equal(responseStatus({ answerStatus: "answered", value: "Service and replacement", unknown: true, status: "unknown" }), "answered", "A new explicit answer supersedes legacy flags");
  assert.equal(responseStatus({ answerStatus: "unrecognized", value: "A legacy answer" }), "answered", "Unknown metadata cannot make substantive legacy answers disappear");
});

test("legacy uncertainty-only answers stay unresolved while mixed substantive answers remain available", () => {
  for (const value of ["Unknown", "Not sure yet", "Not yet determined", "I’m not sure yet", "I don't know.", ["Unknown", "Undecided"]]) {
    assert.equal(responseStatus({ value }), "unknown", JSON.stringify(value));
    assert.equal(responseAnswered({ value }), false);
  }
  assert.equal(responseStatus({ value: "", explanation: "Unknown" }), "unknown");
  assert.equal(responseStatus({ value: ["Unknown", "Residential repairs"] }), "answered");
  assert.equal(responseStatus({ value: "Not sure", explanation: "I can install full residential systems and want to discuss available hours." }), "answered");
  assert.equal(responseStatus({ value: "Unknown customer demand will need a small test." }), "answered", "Unknown within a real answer is not an uncertainty-only response");
  assert.equal(responseStatus({ unknown: true, value: "Retain this older note" }), "unknown");
  assert.equal(responseStatus({ status: "unknown", explanation: "Need a supplier quote" }), "unknown");
  for (const value of [0, false]) assert.equal(responseStatus({ value }), "answered", "A deliberate zero or false remains a substantive value");
});

test("draft and unknown answers keep completion and partner comparison pending without rewriting records", () => {
  const saved = records([["christian", "sequence", "Pilot"], ["growth", "sequence", "Pilot"], ["growth", "time", "Ten hours"]]);
  const growthResponse = saved["response|growth:sequence"].body;
  const topic = { christian: ["sequence"], growth: ["sequence"] };
  for (const answerStatus of ["draft", "unknown", "skipped"]) {
    growthResponse.answerStatus = answerStatus;
    const original = structuredClone(saved);
    assert.deepEqual(completion(questions, saved, "growth"), { answered: 1, total: 4, percent: 25 });
    assert.equal(compareResponses(questions, saved).find(pair => pair.q.id === "sequence").status, "pending");
    assert.equal(topicStatus(topic, questions, saved).status, "pending");
    assert.deepEqual(saved, original);
  }
  growthResponse.answerStatus = "answered";
  assert.deepEqual(completion(questions, saved, "growth"), { answered: 2, total: 4, percent: 50 });
  assert.equal(compareResponses(questions, saved).find(pair => pair.q.id === "sequence").status, "aligned");
  assert.equal(topicStatus(topic, questions, saved).status, "ready");
});

test("readable questions preserve stable source wording and every word of optional help", () => {
  const original = structuredClone(STRATEGY_QUESTIONS);
  for (const seat of ["christian", "growth"]) {
    for (const q of questionsForSeat(STRATEGY_QUESTIONS, seat)) {
      const prompt = questionPrompt(q, seat);
      assert.ok(prompt.length > 0 && prompt.length <= 105, `${q.id} needs a short prompt for ${seat}`);
      const help = questionHelpPrompts(q, seat);
      assert.equal(help.join(" "), questionHint(q, seat).trim(), `${q.id} must retain its complete guidance`);
      assert.ok(help.every(part => part.length < 205), `${q.id} help should be manageable`);
    }
  }
  const workflow = STRATEGY_QUESTIONS.find(q => q.id === "estimating_workflow");
  assert.equal(questionText(workflow, "growth"), "How will I organize a repeatable process from inquiry to approved quote?");
  assert.equal(questionPrompt(workflow, "growth"), "How will I turn an inquiry into an approved quote?");
  assert.deepEqual(STRATEGY_QUESTIONS, original, "Readable rendering must not mutate IDs, audiences, source labels or options");
  assert.equal(questionPrompt(questions[2], "christian"), "Which sequence can we deliver?", "Future questions keep their original seat-specific fallback");
  assert.deepEqual(questionHelpPrompts({ hint: "Check availability. Record approval; Keep earlier notes." }, "growth"), ["Check availability.", "Record approval;", "Keep earlier notes."]);
  assert.deepEqual(questionHelpPrompts({ label: "A question without help" }, "growth"), []);
});

test("Debynyhan's help recognizes residential technical and marketing experience without changing question IDs", () => {
  const byId = new Map(STRATEGY_QUESTIONS.map(q => [q.id, q]));
  const estimating = questionHint(byId.get("estimating_background"), "growth");
  assert.match(estimating, /residential HVAC service and full-system installation experience/);
  assert.match(estimating, /marketing experience with Eternity Mechanical/);
  assert.doesNotMatch(estimating, /expertise I do not have/);
  assert.match(questionHint(byId.get("brand_ideas"), "growth"), /our combined capabilities/);
  assert.equal(byId.get("estimating_background").labels.growth, "What experience can I bring to organizing estimates, comparing quotes and managing bid submissions?", "Historical questionText remains exact");
});
