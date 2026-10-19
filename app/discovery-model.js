const SEATS = ["christian", "growth"];
const CHOICE_TYPES = new Set(["single", "multi", "select", "radio", "checkbox"]);
const ANSWER_STATUSES = new Set(["unanswered", "draft", "unknown", "skipped", "answered"]);
const UNKNOWN_ONLY = /^(?:unknown|not known|not sure(?: yet)?|unsure|undecided|not yet determined|to be determined|tbd|i(?: am|['’]m) not sure(?: yet)?|i don['’]?t know|we don['’]?t know)[.!?\s]*$/i;

// The concise interface is separate from stable source wording used by exports
// and historical records. Never replace a saved question ID or answer with copy.
const QUESTION_PROMPTS = {
  three_year: "What do I want C.F. Mechanical to look like in three years?",
  primary_goal: "What should we focus on first?",
  target_markets: "Which customers should we serve first?",
  three_year_role: "How do I want my role to change as the business grows?",
  success_definition: "What would make the first year successful for me?",
  residential_first: "Could residential HVAC help us earn our first revenue?",
  growth_strategy: "Why start with residential work, and how would I test it?",
  completed_project: "Which jobs has C.F. Mechanical completed?",
  company_assets: "What does the business already have in place?",
  registration_details: "What licenses and qualifications does the company hold?",
  past_contacts: "Which existing relationships could help us get started?",
  business_readiness: "What information and access do I need to get started?",
  preferred_services: "Which services should we offer first?",
  special_capabilities: "What HVAC work can our team deliver now?",
  labor_model: "Who could work on our first jobs?",
  site_supervision: "Who will handle jobs while I am at work?",
  contract_range: "What size jobs should we take on first?",
  estimating_background: {
    christian: "What estimating and pricing experience can I contribute?",
    growth: "What technical and business experience can I bring to estimates?",
  },
  software_budget: "How much could we spend on estimating software each month?",
  estimating_needs: "What do we need our estimating tools to do?",
  technical_signoff: "Who should review and approve our quotes?",
  bid_go_no_go: "What should we check before quoting or accepting a job?",
  estimating_workflow: "How will I turn an inquiry into an approved quote?",
  capital_available: "How much company cash is available for our first jobs?",
  cash_requirements: "What money and payment processes should I organize first?",
  funding_preference: "How should we pay job expenses before customers pay us?",
  spending_approval: "Which money decisions should we approve together?",
  startup_economics: "What must each job earn to make the business worthwhile?",
  compensation_expectations: {
    christian: "What pay and ownership arrangement do I have in mind?",
    growth: "What pay and ownership arrangement do I want to discuss?",
  },
  financial_risk: "What limits do I need on money, debt and unpaid time?",
  partner_role_title: "What title and responsibilities do I want?",
  union_membership: {
    christian: "Why did I suggest union membership for Debynyhan?",
    growth: "What do I want to clarify about joining a union?",
  },
  business_lead_scope: {
    christian: "Which parts of the business do I want Debynyhan to lead?",
    growth: "Which parts of the business am I prepared to lead?",
  },
  technical_lead_scope: "Which technical responsibilities will I lead?",
  joint_decisions: "Which decisions should we always make together?",
  meeting_rhythm: "How often should we meet?",
  partner_expectations: "What do I need from our working relationship?",
  business_mandate: "What do I want Debynyhan to accomplish and decide?",
  skills_support: "What experience can I contribute, and what help do I need?",
  brand_position: "How should we describe C.F. Mechanical to customers?",
  website_priority: "What should our first public website help customers do?",
  marketing_assets: "What company material can Debynyhan use publicly?",
  brand_ideas: "What message and customer experience do I propose?",
  customer_acquisition: "How will I find and follow up with our first customers?",
  systems_workflow: "How will we track a customer from inquiry to payment?",
  systems_data_access: "What should our business tools help us do at launch?",
  systems_success: "How will I choose and test our business tools?",
  ninety_success: "What should we achieve in our first 90 days?",
  weekly_time: "How much time can I give the business each week?",
  roadblocks: "What could slow us down, and how could we respond?",
  first_actions: {
    christian: "What are the first three actions I will take or help with?",
    growth: "What are the first three actions I am prepared to own?",
  },
  launch_gates: "What must be ready before we accept our first job?",
  growth_execution: "What is my 13-week plan, and how will we track progress?",
};

export function questionsForSeat(questions, seat) {
  if (!SEATS.includes(seat)) return [];
  return (questions || []).filter(q => !q.audience || q.audience === "both" || q.audience === seat || (Array.isArray(q.audience) && q.audience.includes(seat)));
}

export function questionText(question, seat) {
  return question.labels?.[seat] || question.label || "";
}

export function questionHint(question, seat) {
  return question.hints?.[seat] || question.hint || "";
}

export function questionPrompt(question, seat) {
  const prompt = QUESTION_PROMPTS[question.id];
  return (typeof prompt === "string" ? prompt : prompt?.[seat]) || questionText(question, seat);
}

export function questionHelpPrompts(question, seat) {
  // Keep every source word, including caveats and ownership/approval details.
  // Sentence and semicolon boundaries give help one manageable thought at a time.
  return questionHint(question, seat).trim().split(/(?<=[.!?;])\s+(?=[A-Z])/).filter(Boolean);
}

export function hasAnswer(value) {
  if (Array.isArray(value)) return value.some(hasAnswer);
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  return typeof value === "boolean";
}

export function responseStatus(response) {
  if (!response || typeof response !== "object" || Array.isArray(response)) return "unanswered";
  const explicit = ANSWER_STATUSES.has(response.answerStatus) ? response.answerStatus : null;
  if (explicit && explicit !== "answered") return explicit;
  if (!explicit && (response.unknown === true || response.status === "unknown")) return "unknown";
  const values = [response.value, response.explanation].flat(Infinity).filter(hasAnswer);
  if (!values.length) return "unanswered";
  // Exact legacy uncertainty-only responses are not completed discovery. Mixed
  // selections or substantive written notes remain intact and count as answers.
  if (values.every(value => typeof value === "string" && UNKNOWN_ONLY.test(value.trim()))) return "unknown";
  return "answered";
}

export function responseAnswered(response) {
  return responseStatus(response) === "answered";
}

export function getResponse(records, seat, id) {
  const record = records?.[`response|${seat}:${id}`];
  const response = record?.body ?? record;
  return response && typeof response === "object" && !Array.isArray(response) ? response : null;
}

export function completion(questions, records, seat) {
  const relevant = questionsForSeat(questions, seat);
  const answered = relevant.filter(q => responseAnswered(getResponse(records, seat, q.id))).length;
  return { answered, total: relevant.length, percent: relevant.length ? Math.round(100 * answered / relevant.length) : 0 };
}

function choices(value) {
  return [...new Set((Array.isArray(value) ? value : [value]).filter(hasAnswer).map(item => String(item).trim()))].sort();
}

export function questionStatus(question, a, b) {
  if (!responseAnswered(a) || !responseAnswered(b)) return "pending";
  // Written perspectives need a conversation even when their wording is identical.
  if (!CHOICE_TYPES.has(question.type) || !hasAnswer(a.value) || !hasAnswer(b.value)) return "discussion";
  if (JSON.stringify(choices(a.value)) !== JSON.stringify(choices(b.value))) return "different";
  return String(a.explanation ?? "").trim() === String(b.explanation ?? "").trim() ? "aligned" : "discussion";
}

function comparable(question) {
  return question.audience === "both" && question.compare !== false;
}

export function compareResponses(questions, records) {
  return (questions || []).filter(comparable).map(q => {
    const a = getResponse(records, "christian", q.id);
    const b = getResponse(records, "growth", q.id);
    return { q, a, b, status: questionStatus(q, a, b) };
  });
}

export function topicStatus(topic, questions, records) {
  const id = typeof topic === "string" ? topic : topic.id;
  const mapped = {};
  const result = {};
  for (const seat of SEATS) {
    mapped[seat] = questionsForSeat(questions, seat).filter(q => Array.isArray(topic?.[seat]) ? topic[seat].includes(q.id) : q.topic === id || q.topics?.includes(id));
    const answered = mapped[seat].filter(q => responseAnswered(getResponse(records, seat, q.id))).length;
    result[seat] = { answered, total: mapped[seat].length };
  }
  const total = result.christian.total + result.growth.total;
  if (!total || SEATS.some(seat => result[seat].answered < result[seat].total)) return { ...result, status: "pending" };
  const sharedIds = new Set(mapped.christian.filter(q => mapped.growth.some(other => other.id === q.id)).map(q => q.id));
  const comparisons = compareResponses(questions, records).filter(pair => sharedIds.has(pair.q.id));
  const status = comparisons.some(pair => pair.status === "different") ? "different" : comparisons.some(pair => pair.status === "discussion") ? "discussion" : "ready";
  return { ...result, status };
}
