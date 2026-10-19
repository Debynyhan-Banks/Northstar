import { getResponse, questionsForSeat, questionText, responseStatus, responseAnswered } from './discovery-model.js';
import { planningRecords, confirmationStatus, marketingMetrics } from './planning-model.js';
import { calculateFinance } from './finance-model.js';
import { renderStrategicBrief, renderOperatingCharter, renderSegmentAnalysis, renderWebsiteBrief, renderCapacityReview, renderPerformanceReview } from './strategy-brief.js';

const DEFAULT_SEATS = { christian: 'Christian Okoh', growth: 'Debynyhan Banks' };
const SEAT_KEYS = ['christian', 'growth'];
const CLASSIFICATIONS = { confirmed: 'Recorded as confirmed fact', estimate: 'Estimate', preference: 'Preference', unknown: 'Unknown' };
const VERIFICATIONS = { verified: 'Source verified', unverified: 'Source not verified', 'needs-review': 'Needs review' };
const META_FIELDS = new Set(['id', '_id', '_recordId', 'planningType', 'createdAt', 'updatedAt', '_created_at', '_updated_at']);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const textValue = value => Array.isArray(value) ? value.map(textValue).join('; ') : value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
const present = value => value !== null && value !== undefined && textValue(value).trim() !== '';
const shown = (value, fallback = 'Not recorded') => present(value) ? esc(textValue(value)) : `<span class="plan-missing">${esc(fallback)}</span>`;
const money = value => typeof value === 'number' && Number.isFinite(value) ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value) : 'Not calculated';
const reference = (type, id) => `<small class="plan-reference">[${esc(type)}:${esc(id || 'unidentified')}]</small>`;
const field = (label, value, fallback) => `<div class="plan-field"><dt>${esc(label)}</dt><dd>${shown(value, fallback)}</dd></div>`;

function rows(context, type) {
  const items = typeof context.planning === 'function' ? context.planning(type) : planningRecords(context.records || {}, type);
  return Array.isArray(items) ? items.filter(item => item && typeof item === 'object') : [];
}

function idOf(row) { return row.id || row._recordId || row._id || row.object_id || ''; }
function excerpt(value, length = 260) {
  const text = textValue(value).trim();
  return text.length > length ? `${text.slice(0, length).trimEnd()}… [full text in detailed plan]` : text;
}
function nameOf(context, seat) { return context.seats?.[seat] || DEFAULT_SEATS[seat] || (seat === 'both' ? 'Both partners — accountable owner to clarify' : seat || 'Owner not assigned'); }
function planSettings(context) { return rows(context, 'settings').find(row => idOf(row) === 'settings') || rows(context, 'settings')[0] || {}; }
function collection(context, category) {
  return Object.values(context.records || {}).filter(row => row?.category === category && row.body && !row.body.planningType).map(row => ({ ...row.body, id: row.object_id || row.body.id }));
}

function sourceLink(source) {
  if (!present(source)) return '<span class="plan-missing">Source not recorded</span>';
  const value = textValue(source).trim();
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && !url.username && !url.password) return `<a href="${esc(url.href)}" target="_blank" rel="noopener noreferrer">${esc(value)}</a>`;
  } catch { /* Notes and document references remain plain text. */ }
  return esc(value);
}

function table(headers, entries, empty) {
  if (!entries.length) return `<p class="plan-missing">${esc(empty)}</p>`;
  return `<div class="table-wrap"><table><thead><tr>${headers.map(header => `<th scope="col">${esc(header)}</th>`).join('')}</tr></thead><tbody>${entries.map(entry => `<tr>${entry.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

function section(title, content, id) { return `<section class="panel pad plan-section"${id ? ` id="${esc(id)}"` : ''}><h3>${esc(title)}</h3>${content}</section>`; }

function responseEntries(context, ids, includeMissing = false) {
  const questions = Array.isArray(context.questions) ? context.questions : [];
  return SEAT_KEYS.flatMap(seat => questionsForSeat(questions, seat).filter(question => ids.includes(question.id)).flatMap(question => {
    const response = getResponse(context.records, seat, question.id);
    if (!includeMissing && !responseAnswered(response)) return [];
    return [{ seat, question, response, answered: responseAnswered(response) }];
  }));
}

function partnerInputs(context, ids) {
  const entries = responseEntries(context, ids);
  if (!entries.length) return '<p class="plan-missing">No completed partner answers are recorded for this section. Any saved drafts and unknown or skipped answers are kept in the unfinished-answers appendix.</p>';
  return `<p class="caption">Recorded partner inputs. Individual answers and matching preferences do not establish a joint decision; supporting facts still need evidence.</p>${entries.map(({ seat, question, response }) => `<article class="plan-input"><h4>${esc(nameOf(context, seat))} · ${esc(questionText(question, seat))}</h4>${present(response.value) ? `<p>${shown(response.value)}</p>` : ''}${present(response.explanation) ? `<p><strong>Explanation / written alternative:</strong> ${shown(response.explanation)}</p>` : ''}${reference('response', `${seat}:${question.id}`)}</article>`).join('')}`;
}

function unfinishedPartnerInputs(context) {
  const labels = { draft: 'Draft — not marked answered', unknown: 'Not sure yet — unresolved', skipped: 'Skipped for now — unresolved', unanswered: 'Unanswered — retained notes' };
  const entries = Object.values(context.records || {}).flatMap(record => {
    if (record?.category !== 'response' || !record.body || typeof record.body !== 'object' || Array.isArray(record.body)) return [];
    const response = record.body, status = responseStatus(response);
    if (status === 'answered' || (status === 'unanswered' && !present(response.value) && !present(response.explanation))) return [];
    const [seat, ...parts] = String(record.object_id || '').split(':'), questionId = parts.join(':');
    const question = (context.questions || []).find(item => item.id === questionId);
    const title = question ? questionText(question, seat) : questionId || record.object_id || 'Earlier question';
    return [`<article class="plan-input"><h4>${esc(nameOf(context, seat))} · ${esc(title)}</h4><p><strong>${esc(labels[status] || 'Unresolved answer')}</strong></p>${present(response.value) ? `<p>${shown(response.value)}</p>` : ''}${present(response.explanation) ? `<p><strong>Explanation / written alternative:</strong> ${shown(response.explanation)}</p>` : ''}${reference('response', record.object_id)}</article>`];
  });
  if (!entries.length) return '';
  return `<p>These saved responses are retained for review. They do not count as completed discovery, verified evidence or joint decisions, and are excluded from completed-answer conclusions elsewhere in this plan.</p>${entries.join('')}`;
}

function decisions(context, compact = false) {
  const proposals = rows(context, 'proposal');
  if (!proposals.length) return '<p class="plan-missing">No strategic decision proposal is recorded. Capture the direction, rationale, conditions and supporting evidence, then obtain both partners’ confirmations.</p>';
  return table(['Decision', 'Current state', ...(compact ? [] : ['Rationale and conditions', 'Owner / review'])], (compact ? proposals.slice(0, 3) : proposals).map(proposal => {
    const state = confirmationStatus(proposal, context.records || {});
    const label = state.status === 'confirmed' ? 'Confirmed jointly for this saved version' : 'Proposed — awaiting current partner confirmations';
    const stateDetails = state.status === 'confirmed' ? '' : `<br><small>${esc((state.missingSeats || []).map(seat => nameOf(context, seat)).join(', ') || 'Confirmation needed')}${state.staleSeats?.length ? ' · prior confirmations no longer match' : ''}${state.evidenceMissingIds?.length ? ` · missing evidence: ${esc(state.evidenceMissingIds.join(', '))}` : ''}${state.sourceMissingIds?.length ? ` · missing sources: ${esc(state.sourceMissingIds.join(', '))}` : ''}</small>`;
    const confirmationDetails = compact ? '' : (state.confirmedSeats || []).map(seat => {
      const voteId = `${seat}:confirm:${idOf(proposal)}`;
      const vote = Object.values(context.records || {}).find(record => record.category === 'vote' && record.object_id === voteId);
      return `<p>${esc(nameOf(context, seat))}: confirmed ${shown(vote?.body?.confirmedAt)}${reference('vote', voteId)}</p>`;
    }).join('');
    const cells = [`<strong>${shown(proposal.title)}</strong><p>${shown(compact ? excerpt(proposal.direction, 150) : proposal.direction)}</p>${reference('proposal', idOf(proposal))}`, `<span class="tag ${state.status === 'confirmed' ? 'ready' : 'warn'}">${label}</span>${stateDetails}${confirmationDetails}`];
    if (!compact) cells.push(`<p>${shown(proposal.rationale)}</p><strong>Conditions:</strong> ${shown(proposal.conditions)}<br><strong>Evidence references:</strong> ${shown(proposal.evidenceIds)}`, `${esc(nameOf(context, proposal.owner))}<br>Decision date: ${shown(proposal.decisionDate)}<br>Review date: ${shown(proposal.reviewDate)}`);
    return cells;
  }), 'No decisions recorded.') + (compact && proposals.length > 3 ? `<p class="caption">Showing three of ${proposals.length} saved decision proposals; see all decisions in the detailed plan.</p>` : '');
}

function evidence(context, compact = false) {
  return table(['Evidence / claim', 'Classification and verification', ...(compact ? [] : ['Source / date', 'Owner and remaining question'])], rows(context, 'evidence').map(item => {
    const verifiedFact = item.classification === 'confirmed' && item.verification === 'verified' && present(item.source);
    const cells = [`<strong>${shown(item.title)}</strong>${reference('evidence', idOf(item))}`, `${esc(CLASSIFICATIONS[item.classification] || 'Classification not recorded')}<br>${esc(VERIFICATIONS[item.verification] || 'Verification not recorded')}${verifiedFact ? '' : '<br><small>Do not treat as independently verified support.</small>'}`];
    if (!compact) cells.push(`${sourceLink(item.source)}<br>Observed: ${shown(item.observedOn)}<br>Related question: ${shown(item.relatedQuestion)}<br>Related decision: ${shown(item.relatedDecision)}`, `${esc(nameOf(context, item.owner))}<br>${shown(item.remainingQuestion, 'No remaining question recorded')}<br>Research deadline: ${shown(item.researchDue)}${item.researchTaskId ? reference('task', item.researchTaskId) : ''}`);
    return cells;
  }), 'No evidence records yet. Business claims need a source, owner and verification status.');
}

function customerResearch(context) {
  return table(['Conversation / segment', 'Customer need and buying criteria', 'Findings and next action', 'Source'], rows(context, 'customer-research').map(item => [
    `<strong>${shown(item.name)}</strong><br>${shown(item.segment)} · ${shown(item.location)}${reference('customer-research', idOf(item))}`,
    `<dl>${field('Problem', item.problem)}${field('Buying trigger', item.trigger)}${field('Current alternative', item.currentAlternative)}${field('Selection criteria', item.selectionCriteria)}${field('Price information', item.priceInfo)}${field('Objections', item.objections)}</dl>`,
    `${shown(item.findings)}<p><strong>Next action:</strong> ${shown(item.nextAction)}<br>Due: ${shown(item.nextActionDue)}</p>`,
    `${sourceLink(item.source)}<br>${shown(item.observedOn)}<br>${esc(nameOf(context, item.owner))}`,
  ]), 'No customer conversations recorded. Customer demand is not established by questionnaire completion.');
}

function competitorResearch(context) {
  return table(['Competitor', 'Observed offer and positioning', 'Customer experience / comparison', 'Source'], rows(context, 'competitor').map(item => [
    `<strong>${shown(item.name)}</strong><br>${shown(item.geography)}${reference('competitor', idOf(item))}`,
    `<dl>${field('Services', item.services)}${field('Positioning', item.positioning)}${field('Public pricing', item.pricing)}</dl>`,
    `<dl>${field('Experience', item.experience)}${field('Strengths', item.strengths)}${field('Weaknesses', item.weaknesses)}</dl>`,
    `${sourceLink(item.source)}<br>${shown(item.observedOn)}<br>${esc(nameOf(context, item.owner))}`,
  ]), 'No competitor observations recorded. A competitive advantage remains a proposal until supported.');
}

function launchOptions(context) {
  return table(['Option', 'Demand and delivery', 'Economics and collection', 'Acquisition / risk / sources'], rows(context, 'launch-option').map(item => [
    `<strong>${shown(item.title)}</strong><br>${shown(item.customer)}<br>${shown(item.services)} · ${shown(item.geography)}${reference('launch-option', idOf(item))}`,
    `<strong>Demand evidence:</strong> ${shown(item.demand)}<p><strong>Capacity:</strong> ${shown(item.capacity)}</p>`,
    `<strong>Startup:</strong> ${shown(item.startup)}<br><strong>Job economics:</strong> ${shown(item.unitEconomics)}<br><strong>Collection days:</strong> ${shown(item.collectionDays)}`,
    `<strong>Acquisition:</strong> ${shown(item.acquisition)}<p><strong>Risks:</strong> ${shown(item.risk)}</p><strong>Evidence:</strong> ${shown(item.evidenceIds)}`,
  ]), 'Launch options have not been compared. Residential HVAC is a proposed initial revenue path; feasibility and the chosen approach remain to be decided.');
}

function experiments(context) {
  const opportunities = collection(context, 'opportunity');
  const reportingDate = context.now || null;
  return table(['Experiment / customer', 'Offer, message and journey', 'Ownership and resources', 'Measures and decision rules'], rows(context, 'experiment').map(item => {
    const date = item.reportingDate || reportingDate;
    const metrics = date && Number.isFinite(Date.parse(date)) ? marketingMetrics(item, opportunities, { asOf: date }) : null;
    const results = metrics ? `<p><strong>Manual results as of ${esc(date)}:</strong><br>${esc(metrics.leads)} inquiries · ${esc(metrics.qualified)} qualified · ${esc(metrics.quoted)} quotes · ${esc(metrics.accepted)} accepted jobs.<br>Cash collected: ${esc(money(metrics.cashCollected))}<br>Gross profit: ${esc(money(metrics.grossProfit))}<br>Cost per paying customer: ${esc(money(metrics.customerAcquisitionCost))}<br>Quote conversion: ${typeof metrics.quoteToWinRate === 'number' ? `${esc((metrics.quoteToWinRate * 100).toFixed(1))}%` : 'Not calculated'}</p>${metrics.warnings?.length ? `<details><summary>Result limitations</summary><ul>${metrics.warnings.map(warning => `<li>${esc(warning)}</li>`).join('')}</ul></details>` : ''}` : '<p class="plan-missing">No valid reporting date is recorded for calculating results.</p>';
    return [
    `<strong>${shown(item.title)}</strong><br>${shown(item.segment)} · ${shown(item.geography)}<br>Status: ${shown(item.status)}${reference('experiment', idOf(item))}`,
    `<dl>${field('Offer', item.offer)}${field('Message', item.message)}${field('Supporting proof', item.proof)}${field('Channel', item.channel)}${field('Customer journey', item.journey)}${field('Response standard', item.responseStandard)}${field('Follow-up', item.followup)}</dl>`,
    `${esc(nameOf(context, item.owner))}<br>${shown(item.startDate)} to ${shown(item.endDate)}<br>Time / effort limit: ${shown(item.timeLimit)}<br>Budget: ${shown(item.budget)}<br>Actual spend: ${shown(item.actualSpend ?? item.spend)}<br>Reporting date: ${shown(date)}`,
    `<dl>${field('Success measures', item.successMeasures)}${field('Continue if', item.continueRule)}${field('Change if', item.changeRule)}${field('Stop if', item.stopRule)}</dl>${results}`,
  ]; }), 'No marketing experiment recorded. Define a target customer, offer, budget, owner and continue/change/stop criteria before treating a campaign as an execution plan.') + (rows(context, 'experiment').length ? '<p class="caption">Marketing results use opportunities linked to the exact experiment ID. Quote conversion = accepted jobs ÷ quoted opportunities; customer acquisition cost = actual spend ÷ distinct identified paying customers. Missing values and zero denominators remain uncalculated. Later pipeline stages may imply earlier milestones; review the result limitations.</p>' : '');
}

function tasks(context, compact = false) {
  const saved = Array.isArray(context.tasks) ? context.tasks.filter(item => item && !item.planningType) : collection(context, 'task');
  const items = saved.slice().sort((a, b) => Number(a.start || 0) - Number(b.start || 0) || String(a.title || '').localeCompare(String(b.title || '')));
  const preview = compact ? items.filter(task => task.status !== 'completed').slice(0, 4) : items;
  return table(['Work item', 'Owner / timing', ...(compact ? ['Status / evidence'] : ['Budget, dependencies and blockers', 'Completion and measures'])], preview.map(task => {
    const start = Number(task.start), duration = Number(task.duration);
    const weekText = Number.isFinite(start) && start >= 1 ? `Week ${start}${Number.isFinite(duration) && duration > 1 ? `–${start + duration - 1}` : ''}` : 'Week not set';
    const cells = [`<strong>${shown(task.title)}</strong>${reference('task', idOf(task))}`, `${esc(nameOf(context, task.owner))}<br>${esc(weekText)}<br>Deadline: ${shown(task.dueDate)}`];
    if (compact) cells.push(`${shown(task.status)}<br>${shown(excerpt(task.evidence, 120), 'Completion evidence not recorded')}`);
    else cells.push(`<dl>${field('Budget', task.budget)}${field('Dependencies', task.depends)}${field('Blocker', task.blocker)}</dl>`, `<dl>${field('Status', task.status)}${field('Definition of completion', task.definitionOfDone || task.notes)}${field('Completion evidence', task.evidence)}${field('Measure', task.metric)}${field('Baseline', task.baseline)}${field('Target', task.target)}${field('Latest result', task.result)}${field('Reporting date', task.reportingDate)}</dl>`);
    return cells;
  }), compact ? 'No open execution tasks recorded.' : 'No execution tasks recorded. The plan needs an accountable owner, deadline, completion evidence and measure for each action.') + (compact && items.length > preview.length ? `<p class="caption">Showing up to four open work items; the detailed plan contains all ${items.length} saved tasks.</p>` : '');
}

function financeSummary(context, compact = false) {
  const input = { settings: rows(context, 'finance-settings')[0] || {}, jobs: rows(context, 'job-model'), startupCosts: rows(context, 'startup-cost'), cashWeeks: rows(context, 'cash-week'), operatingMonths: rows(context, 'operating-month') };
  if (!context.finance && !Object.keys(input.settings).length && !input.jobs.length && !input.startupCosts.length && !input.cashWeeks.length && !input.operatingMonths.length) return '<p class="plan-missing">Financial models have not been entered. Complete job costs, overhead, compensation, startup spending, cash timing, and base/downside forecasts in Financial planning. Profit and cash availability are unknown.</p>';
  const finance = context.finance || { base: calculateFinance(input, 'base'), downside: calculateFinance(input, 'downside') };
  const scenarios = finance.base || finance.downside ? [['Base case', finance.base], ['Downside case', finance.downside]] : [['Base case', finance], ['Downside case', null]];
  return `<p>Forecasts are estimates. Revenue, operating profit and cash collections are different measures; forecasts do not establish demand, available capacity or approval to spend.</p>${scenarios.map(([label, model]) => {
    if (!model) return `<h4>${label}</h4><p class="plan-missing">Scenario not calculated.</p>`;
    const key = label === 'Base case' ? 'base' : 'downside';
    const sourceNotes = compact ? '' : financialSourceNotes(context, key);
    return `<h4>${label}</h4>${financeDetails(model, compact)}${sourceNotes}`;
  }).join('')}`;
}

function financialSourceNotes(context, scenario) {
  const settings = rows(context, 'finance-settings')[0];
  const services = rows(context, 'job-model').filter(row => row.scenario === scenario);
  const startup = rows(context, 'startup-cost').filter(row => row.scenario === scenario);
  return `<details class="plan-financial-sources"><summary>Entered financial assumptions and source notes</summary>${settings ? `<p>Forecast opening date: ${shown(settings.forecastStartDate)}<br>Settings notes: ${shown(settings.notes)}${reference('finance-settings', idOf(settings))}</p>` : '<p class="plan-missing">Financial settings have not been recorded.</p>'}
    ${services.map(service => `<h4>${shown(service.title)}</h4>${table(['Job assumption', 'Entered value'], [['salePrice', 'Selling price'], ['paidLabor', 'Paid labor'], ['materials', 'Materials and equipment'], ['subcontractors', 'Subcontractors'], ['travel', 'Travel'], ['paymentFees', 'Payment fees'], ['callbackAllowance', 'Callback allowance'], ['allocatedAcquisition', 'Allocated acquisition cost'], ['unpaidOwnerHours', 'Unpaid technical hours'], ['unpaidOwnerHourlyValue', 'Value per unpaid technical hour'], ['mixWeight', 'Service-mix weight']].map(([key, label]) => [esc(label), shown(service[key])]), '')}<p>Assumptions / source: ${shown(service.notes)}${reference('job-model', idOf(service))}</p>`).join('')}
    <h4>Startup spending inputs</h4>${table(['Item', 'Amount / payment date', 'Assumptions / source'], startup.map(item => [`${shown(item.title)}${reference('startup-cost', idOf(item))}`, `${shown(item.amount)}<br>${shown(item.paymentDate)}`, shown(item.notes)]), 'No startup items recorded. An empty list is not assumed complete until reviewed in financial settings.')}</details>`;
}

function financeDetails(model, compact = false) {
  const summary = model.jobSummary || {};
  const breakEven = model.breakEven || {};
  const cash = model.cash || {};
  const operating = model.operating || {};
  const anyForecastData = [...(cash.periods || []), ...(operating.periods || [])].some(period => [period.inflows, period.outflows, period.revenue, period.collections].some(value => typeof value === 'number' && Number.isFinite(value)));
  if (!(model.jobs || []).length && !Object.values(model.settings || {}).some(value => value !== null && value !== undefined) && !Number.isFinite(model.startupBudget) && !anyForecastData) return '<p class="plan-missing">Financial assumptions and service models are missing. Enter them before calculating profitability, break-even workload or cash availability.</p>';
  const lines = [
    ['Startup-cost budget', model.startupBudget], ['Average sale at entered service mix', summary.averageSale],
    ['Average cash contribution per job after acquisition cost', summary.cashContribution],
    ['Average contribution including unpaid owner time', summary.economicContribution],
    ['Monthly fixed cash costs', summary.fixedCashCosts], ['Monthly fixed costs including unpaid owner time', summary.fixedEconomicCosts],
    ['Thirteen-week closing cash', cash.closingCash], ['Thirteen-week minimum cash', cash.minimumCash],
    ['Twelve-month earned revenue', operating.revenue], ['Twelve-month operating profit estimate', operating.operatingProfit],
    ['Twelve-month economic surplus after unpaid owner time', operating.economicProfit], ['Twelve-month customer cash collections', operating.collections],
  ];
  const issues = Array.isArray(model.issues) ? model.issues : [];
  if (compact) return `<dl>${field('Monthly break-even jobs', typeof breakEven.jobs === 'number' ? breakEven.jobs : breakEven.message || 'Not calculated')}${field('13-week closing cash estimate', money(cash.closingCash))}${field('12-month operating profit estimate', money(operating.operatingProfit))}</dl><p class="caption">Cash forecast: ${cash.complete ? 'all periods entered' : 'incomplete'} · Operating forecast: ${operating.complete ? 'all periods entered' : 'incomplete'}.</p>`;
  return `${table(['Measure', 'Estimated value'], lines.map(([label, value]) => [esc(label), esc(money(value))]), '')}
    <p><strong>Monthly break-even:</strong> ${typeof breakEven.jobs === 'number' ? `${esc(breakEven.jobs)} whole jobs` : esc(breakEven.message || 'Not calculated')}<br><strong>Including unpaid owner time:</strong> ${typeof model.economicBreakEven?.jobs === 'number' ? `${esc(model.economicBreakEven.jobs)} whole jobs` : esc(model.economicBreakEven?.message || 'Not calculated')}</p>
    <p class="caption">Operating profit is before tax, financing and noncash depreciation. Economic surplus additionally values unpaid owner time; it is not an accounting profit statement.</p>
    ${table(['Service model', 'Sale / gross profit', 'Cash contribution', 'Contribution including unpaid owner time'], (model.jobs || []).map(job => [`${esc(job.title)}${reference('job-model', job.id)}`, `${esc(money(job.salePrice))}<br>${esc(money(job.grossProfit))}`, esc(money(job.cashContribution)), esc(money(job.economicContribution))]), 'Service/job costs have not been modeled.')}
    ${model.settings ? `<details><summary>Saved scenario assumptions</summary>${table(['Assumption', 'Entered value'], Object.entries(model.settings).filter(([key]) => !META_FIELDS.has(key)).map(([key, value]) => [esc(key.replace(/([a-z])([A-Z])/g, '$1 $2')), shown(value)]), 'No financial settings recorded.')}</details>` : ''}
    <p>${reference('finance-settings', 'settings')} Formulas: cash contribution = sale price − direct cash job costs including allocated acquisition cost. Gross profit excludes allocated acquisition cost. Monthly break-even jobs = fixed monthly cash costs ÷ weighted average job contribution, rounded up. Positive contribution and a completed service mix are required.</p>
    <h4>Thirteen-week cash forecast · ${cash.complete ? 'complete inputs' : 'incomplete inputs'}</h4>${table(['Week / dates', 'Opening cash', 'Inflows', 'Outflows', 'Closing cash'], (cash.periods || []).map(period => [`Week ${esc(period.week)}<br>${shown(period.startDate)} to ${shown(period.endDate)}${reference('cash-week', period.id || `week-${period.week}-missing`)}`, esc(money(period.openingCash)), esc(money(period.inflows)), esc(money(period.outflows)), `${esc(money(period.closingCash))}${period.missing?.length ? `<br><small>${esc(period.missing.join(' '))}</small>` : ''}`]), 'Weekly cash records are missing.')}
    <h4>Twelve-month operating forecast · ${operating.complete ? 'complete inputs' : 'incomplete inputs'}</h4>${table(['Month / dates', 'Revenue / operating profit', 'Customer collections', 'Closing cash'], (operating.periods || []).map(period => [`Month ${esc(period.month)}<br>${shown(period.startDate)} to ${shown(period.endDate)}${(period.lines || []).map(line => reference('operating-month', line.id)).join('')}`, `${esc(money(period.revenue))}<br>${esc(money(period.operatingProfit))}`, esc(money(period.collections)), `${esc(money(period.closingCash))}${period.missing?.length ? `<br><small>${esc(period.missing.join(' '))}</small>` : ''}`]), 'Monthly operating records are missing.')}
    ${issues.length ? `<h4>Model limitations and missing inputs</h4><ul>${issues.map(issue => `<li>${esc(typeof issue === 'string' ? issue : issue.message || textValue(issue))}</li>`).join('')}</ul>` : ''}`;
}

function openQuestions(context) {
  const pendingEvidence = rows(context, 'evidence').filter(item => item.classification === 'unknown' || item.verification !== 'verified' || !present(item.source) || present(item.remainingQuestion));
  const missing = responseEntries(context, ['three_year', 'business_mandate', 'site_supervision', 'capital_available', 'compensation_expectations', 'residential_first', 'startup_economics', 'launch_gates'], true).filter(entry => !entry.answered);
  return `${table(['Missing discovery input', 'Person to answer', 'Reference'], missing.map(({ seat, question }) => [esc(questionText(question, seat)), esc(nameOf(context, seat)), reference('response', `${seat}:${question.id}`)]), 'Essential discovery inputs have been captured. Evidence verification and joint decisions still require review.')}
    <h4>Evidence to resolve</h4>${table(['Claim / question', 'Owner', 'Current status'], pendingEvidence.map(item => [`${shown(item.title)}<p>${shown(item.remainingQuestion, 'Verify the source and classification.')}</p>${reference('evidence', idOf(item))}`, esc(nameOf(context, item.owner)), `${esc(CLASSIFICATIONS[item.classification] || 'Classification missing')} · ${esc(VERIFICATIONS[item.verification] || 'Verification missing')}`]), 'No unresolved evidence records are listed. This does not verify facts that have not been entered.')}`;
}

function milestones(value) {
  if (!present(value)) return '<p class="plan-missing">Twelve-month milestones have not been recorded. Set dated outcomes, owners and measures after reviewing capacity and forecasts.</p>';
  if (Array.isArray(value)) return `<ol>${value.map(item => `<li>${shown(item)}</li>`).join('')}</ol>`;
  return `<p class="plan-preserve">${shown(value)}</p>`;
}

function onePage(context, settings) {
  const visions = responseEntries(context, ['three_year']).map(({ seat, question, response }) => `<p><strong>${esc(nameOf(context, seat))}:</strong> ${shown(excerpt([response.value, response.explanation].filter(present).join(' · '), 220))}${reference('response', `${seat}:${question.id}`)}</p>`).join('');
  return `<article class="plan-one-page" id="plan-one-page"><h2>Our one-page strategy</h2><p class="caption">Working draft from saved records. We still need to confirm proposed choices together.</p><div class="plan-grid">
    ${section('Purpose and outcomes', `<dl>${field('Proposed shared vision', excerpt(settings.vision))}${field('Objectives', excerpt(settings.objectives))}</dl>${reference('settings', idOf(settings) || 'settings')}`)}
    ${section('Customers and first offer', `<dl>${field('Service area', excerpt(settings.serviceArea, 120))}${field('Initial offer', excerpt(settings.initialOffer))}${field('Proposed differentiator', excerpt(settings.differentiator, 150))}</dl><p class="caption">Public claims require evidence and confirmation.</p>`)}
    ${section('Our strategic choices', renderStrategicBrief(context, true))}
    ${section('What each of us wants', visions || '<p class="plan-missing">Our individual visions have not been recorded.</p>')}
    ${section('Decisions and conditions', decisions(context, true))}
    ${section('Financial direction', financeSummary(context, true))}
    ${section('Risks and response', `<dl>${field('Risks', excerpt(settings.risks, 200))}${field('Contingency actions', excerpt(settings.contingencies, 200))}${field('Longer-term direction', excerpt(settings.longTermDirection, 150))}</dl>`)}
    </div>${section('Our immediate execution commitments', tasks(context, true))}</article>`;
}

function detailed(context, settings) {
  const unfinished = unfinishedPartnerInputs(context);
  return `<article class="plan-detailed" id="plan-detailed"><h2>Our detailed business and marketing plan</h2>
    ${section('1. Executive summary and objectives', `${renderStrategicBrief(context)}<dl>${field('Proposed shared vision', settings.vision)}${field('Business objectives', settings.objectives)}${field('Initial offer', settings.initialOffer)}${field('Longer-term direction', settings.longTermDirection)}</dl>${partnerInputs(context, ['primary_goal', 'three_year', 'success_definition'])}`, 'plan-executive-summary')}
    ${section('2. Company position and delivery capabilities', `<p>Christian’s recorded company information and delivery assessment need supporting records. Scope must fit actual availability while Christian is employed.</p>${partnerInputs(context, ['completed_project', 'company_assets', 'registration_details', 'special_capabilities', 'labor_model', 'site_supervision', 'launch_gates'])}${evidence(context)}`, 'plan-capabilities')}
    ${section('3. Target customers and market evidence', `${partnerInputs(context, ['target_markets', 'past_contacts', 'growth_strategy'])}${customerResearch(context)}<h4>Customer segments and strategic trade-offs</h4>${renderSegmentAnalysis(context)}`, 'plan-market')}
    ${section('4. Competition and our proposed advantage', `<dl>${field('Proposed differentiator', settings.differentiator)}</dl><p>Use the source records below and the evidence register to substantiate the advantage. Research observations remain observations; small samples do not establish market demand.</p>${competitorResearch(context)}`, 'plan-competition')}
    ${section('5. Initial offer, launch choice and pricing', `${partnerInputs(context, ['residential_first', 'preferred_services', 'contract_range', 'startup_economics', 'technical_signoff', 'bid_go_no_go', 'estimating_workflow'])}${launchOptions(context)}<h4>Recorded strategic decisions</h4>${decisions(context)}`, 'plan-offer')}
    ${section('6. Marketing and sales execution', `${partnerInputs(context, ['brand_position', 'brand_ideas', 'customer_acquisition', 'marketing_assets', 'website_priority'])}${experiments(context)}<h4>Our private website implementation brief</h4>${renderWebsiteBrief(context)}<h4>Operating information flow</h4>${partnerInputs(context, ['systems_workflow', 'systems_data_access', 'systems_success'])}<p class="caption">Review actual inquiry, qualification, quote, accepted work, completion, invoice, collection and follow-up records in the Revenue pipeline. No funnel stage is assumed complete from a plan entry.</p>`, 'plan-marketing')}
    ${section('7. Responsibilities, authority and capacity', `${renderOperatingCharter(context)}<h4>Delivery capacity and workload</h4>${renderCapacityReview(context)}${partnerInputs(context, ['partner_role_title', 'business_mandate', 'business_lead_scope', 'technical_lead_scope', 'weekly_time', 'compensation_expectations', 'joint_decisions', 'meeting_rhythm', 'union_membership'])}<p class="caption">These are each person’s inputs. Confirm delegated authority, compensation and conditions in the decision log before treating them as an agreement.</p>`, 'plan-roles')}
    ${section('8. Financial assumptions and scenarios', `${financeSummary(context)}<h4>Forecast versus actual results</h4>${renderPerformanceReview(context)}${partnerInputs(context, ['capital_available', 'cash_requirements', 'funding_preference', 'spending_approval', 'financial_risk'])}`, 'plan-finances')}
    ${section('9. Risks, unresolved questions and contingency actions', `<dl>${field('Recorded risks', settings.risks)}${field('Proposed contingency actions', settings.contingencies)}</dl>${partnerInputs(context, ['roadblocks', 'partner_expectations'])}${openQuestions(context)}`, 'plan-risks')}
    ${section('10. Thirteen-week execution schedule', `<p>The schedule contains our saved work items. Entries remain proposed until the relevant direction and commitments are confirmed; completion status needs evidence.</p><dl>${field('Plan start date', settings.planStartDate)}</dl>${tasks(context)}`, 'plan-execution')}
    ${section('11. Twelve-month milestones', milestones(settings.monthMilestones), 'plan-milestones')}
    ${section('12. Sources, review and use', `<p>This plan is assembled deterministically from saved discovery responses, evidence records, research, financial inputs, strategic proposals and tasks. References identify the underlying record so we can review the source. It does not infer demand, independently verify claims or convert preferences into agreements.</p><p>Review new evidence, current financial assumptions, outstanding partner confirmations and actual results together before making commitments. Exported copies contain private workspace information; share deliberately.</p>`, 'plan-sources')}
    ${unfinished ? section('Appendix: unfinished partner answers', unfinished, 'plan-unfinished-answers') : ''}
    </article>`;
}

function planBody(context) {
  const settings = planSettings(context);
  return `<div class="business-plan"><header class="plan-header"><div class="micro">C.F. Mechanical · private working plan</div><h1>${esc(settings.planTitle || 'Our strategic business and marketing plan')}</h1><p>Prepared from saved workspace information${present(context.now) ? ` · ${esc(context.now)}` : ''}.</p><p class="info-note">Draft planning document. Individual answers are attributed to their author. Strategy settings, launch ideas and forecasts remain proposals or estimates unless the decision log records both partners’ valid confirmations for the current version.</p></header>${onePage(context, settings)}<details class="plan-detail-toggle" open><summary>Read the detailed business and marketing plan</summary>${detailed(context, settings)}</details></div>`;
}

/** Assemble a working plan without changing any saved records or inferring approval. */
export function renderBusinessPlan(context = {}) {
  return `<div class="heading-line"><div><div class="micro">From our evidence to execution</div><h2>Our living business plan</h2><p class="item-desc">Review our strategy, supporting information, financial assumptions and accountable work.</p></div><div class="button-row"><button class="btn" data-plan-new="strategy-brief">Edit strategic brief</button><button class="btn" data-action="print-plan">Print / save PDF</button><button class="btn primary" data-action="export-plan">Export plan HTML ↓</button></div></div>${planBody(context)}`;
}

/** Export a standalone private, printable HTML document with no external services. */
export function exportBusinessPlan(context = {}) {
  const settings = planSettings(context);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(settings.planTitle || 'C.F. Mechanical business and marketing plan')}</title><style>${PLAN_EXPORT_CSS}</style></head><body>${planBody(context)}</body></html>`;
}

/** Plain text companion for accessible sharing or document editors. */
export function planText(context = {}) {
  return planBody(context).replace(/<br\s*\/?>/gi, '\n').replace(/<\/(?:h[1-6]|p|section|article|div|tr|li|dl|dt|dd|header|summary)>/gi, '\n').replace(/<\/t[dh]>/gi, '\t').replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/\n[ \t]+/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

const PLAN_EXPORT_CSS = `:root{color-scheme:light}*{box-sizing:border-box}body{font:15px/1.55 system-ui,sans-serif;color:#193640;background:#fff;margin:0;padding:40px}h1,h2,h3,h4{line-height:1.25;color:#12313b}h1{font-size:32px}h2{font-size:25px;margin-top:34px}h3{font-size:19px}h4{font-size:15px}p,dd{white-space:pre-wrap;overflow-wrap:anywhere}a{color:#125c71;overflow-wrap:anywhere}.micro,.caption,small{font-size:12px;color:#4a616a}.micro{text-transform:uppercase;letter-spacing:.1em}.info-note{padding:14px;background:#eef5f5;border-left:4px solid #397c80}.plan-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.plan-section{border:1px solid #cfdbde;border-radius:8px;padding:20px;margin:16px 0}.plan-grid .plan-section{margin:0}.plan-field{margin:10px 0}dt{font-weight:650}dd{margin:2px 0 0}.plan-missing{color:#755218;font-style:italic}.plan-reference{display:block;margin:5px 0;overflow-wrap:anywhere}.plan-input{border-top:1px solid #e0e7e8;padding:9px 0}table{border-collapse:collapse;width:100%;font-size:12px;table-layout:fixed}th,td{text-align:left;vertical-align:top;border:1px solid #d6e0e2;padding:9px;overflow-wrap:anywhere}th{background:#edf3f4}td p{margin:7px 0}.tag{display:inline-block;border:1px solid #d3dddf;border-radius:4px;padding:3px 6px;font-size:11px}.ready{background:#edf7ef}.warn{background:#fff5df}details>summary{cursor:pointer;font-weight:650;margin:20px 0}.business-plan{max-width:1250px;margin:auto}@media(max-width:700px){body{padding:16px}.plan-grid{grid-template-columns:1fr}table{font-size:11px}th,td{padding:5px}}@media print{body{padding:0;font-size:10pt}.plan-section{break-inside:auto;border-radius:0}h2,h3,h4,dt{break-after:avoid}tr,.plan-input{break-inside:avoid}thead{display:table-header-group}.plan-one-page{break-after:page}.plan-detail-toggle>summary{display:none}details{display:block}details>summary~*{display:block}a{color:inherit;text-decoration:none}.plan-grid{gap:9px}.plan-grid .plan-section{padding:12px}h1{font-size:23pt}h2{font-size:18pt}h3{font-size:13pt}}`;
