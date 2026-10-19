const SEATS = ["christian", "growth"];
const CHOICE_TYPES = new Set(["single", "multi", "select", "radio", "checkbox"]);

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

export function hasAnswer(value) {
  if (Array.isArray(value)) return value.some(hasAnswer);
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  return typeof value === "boolean";
}

export function responseAnswered(response) {
  return Boolean(response && (hasAnswer(response.value) || hasAnswer(response.explanation)));
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
