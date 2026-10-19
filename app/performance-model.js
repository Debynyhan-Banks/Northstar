import { calculateFinance, numberInput } from './finance-model.js';
import { planningRecords } from './planning-model.js';
import { capacityDate, SERVICE_ROLES } from './capacity-model.js';

const read = (ctx, type) => planningRecords(ctx.records, type);
const rawRows = ctx => Array.isArray(ctx.records) ? ctx.records : Object.values(ctx.records || {});
const finite = value => Number.isFinite(value) ? value : null;
const sum = values => values.every(Number.isFinite) ? finite(values.reduce((a, b) => a + b, 0)) : null;
const subtract = (a, b) => a === null || b === null ? null : finite(a - b);
const within = (date, from, to) => capacityDate(date) !== null && date >= from && date <= to;
const validNumber = value => value === null || value === undefined || value === '' || numberInput(value) !== null;
const jobKey = row => row.opportunityId ? `opportunity:${row.opportunityId}` : `job:${String(row.jobReference || '').trim().toLowerCase()}`;
export const ACTUAL_JOB_FIELDS = ['revenue', 'directCost', 'acquisitionSpend', 'paidLaborHours', 'unpaidOwnerHours', 'deliveryHours', 'callbacks', 'invoiceAmount'];
export const ACTUAL_CASH_FIELDS = ['customerReceipts', 'otherInflows', 'jobPayments', 'overheadPayments', 'compensationPayments', 'marketingPayments', 'startupPayments', 'otherPayments'];
export const ACTUAL_OPERATING_FIELDS = ['jobs', 'revenue', 'directCost', 'acquisitionSpend', 'paidLaborHours', 'unpaidOwnerHours', 'deliveryHours', 'callbacks', 'invoicedAmount', 'overheadCost', 'compensationCost', 'fixedMarketingCost', 'collections'];

export function validatePerformanceRecord(type, row = {}, ctx = { records: {} }) {
  if (!['forecast-baseline', 'job-actual', 'actual-period'].includes(type)) return [];
  const issues = [];
  if (type === 'forecast-baseline') {
    if (!['base', 'downside'].includes(row.scenario)) issues.push('Choose a base or downside forecast scenario.');
    if (!String(row.title || '').trim()) issues.push('Name the dated forecast baseline.');
    if (read(ctx, type).some(existing => existing.id === row.id)) issues.push('Forecast baselines are immutable. Capture a new baseline instead of editing history.');
    return issues;
  }
  const numeric = type === 'job-actual' ? ACTUAL_JOB_FIELDS.filter(field => row.sourceMode !== 'pipeline' || !['revenue', 'directCost', 'callbacks', 'invoiceAmount'].includes(field)) : type === 'actual-period' ? row.periodKind === 'cash-week' ? ACTUAL_CASH_FIELDS : ACTUAL_OPERATING_FIELDS.filter(field => row.sourceMode !== 'job-records' || !['jobs', ...ACTUAL_JOB_FIELDS, 'invoicedAmount'].includes(field)) : [];
  for (const field of new Set(numeric)) if (!validNumber(row[field])) issues.push(`${field} must be a nonnegative finite amount, or blank when unknown.`);
  if (numeric.includes('callbacks') && row.callbacks !== '' && row.callbacks != null && !Number.isInteger(numberInput(row.callbacks))) issues.push('Callbacks must be a whole count.');
  if (numeric.includes('jobs') && row.jobs !== '' && row.jobs != null && !Number.isInteger(numberInput(row.jobs))) issues.push('Actual completed jobs must be a whole count.');
  if (capacityDate(row.reportingDate) === null) issues.push('Enter a valid actual-results reporting date.');
  if (type === 'job-actual') {
    if (!row.opportunityId && !String(row.jobReference || '').trim()) issues.push('Link an existing opportunity or enter a stable unique job reference.');
    if (!['pipeline', 'manual'].includes(row.sourceMode)) issues.push('Choose one actual job source: pipeline or manual.');
    if (row.sourceMode === 'pipeline' && !rawRows(ctx).some(record => record.category === 'opportunity' && (record.body?.id || record.object_id) === row.opportunityId)) issues.push('Choose an existing pipeline opportunity.');
    if (row.sourceMode === 'manual' && capacityDate(row.completedAt) === null) issues.push('Enter the actual completion date.');
    if (row.startedAt && capacityDate(row.startedAt) === null) issues.push('Enter a valid work start date.');
    if (row.completedAt && capacityDate(row.completedAt) === null) issues.push('Enter a valid completion date.');
    if (row.invoicedAt && capacityDate(row.invoicedAt) === null) issues.push('Enter a valid invoice date.');
    if (row.startedAt && row.completedAt && row.completedAt < row.startedAt) issues.push('Completion cannot precede the work start date.');
    if (row.completedAt && row.reportingDate && row.completedAt > row.reportingDate) issues.push('Actual completion cannot follow the reporting date.');
    if (read(ctx, type).some(other => other.id !== row.id && jobKey(other) === jobKey(row))) issues.push('This job already has an actual-results record. Edit it rather than counting the same job twice.');
    if (row.costBasisConfirmed !== 'yes') issues.push('Confirm that direct job cost includes attributed acquisition spending once.');
    if (row.sourceMode === 'manual' && numberInput(row.acquisitionSpend) !== null && numberInput(row.directCost) !== null && numberInput(row.acquisitionSpend) > numberInput(row.directCost)) issues.push('Job acquisition spending is a subset of total direct job cost and cannot exceed it.');
  }
  if (type === 'actual-period') {
    if (!['cash-week', 'operating-month'].includes(row.periodKind)) issues.push('Choose a weekly cash or monthly operating comparison.');
    if (capacityDate(row.startDate) === null || capacityDate(row.endDate) === null || row.endDate < row.startDate) issues.push('Enter valid period boundaries in chronological order.');
    if (!['complete', 'partial'].includes(row.coverage)) issues.push('State whether the period is completely reported or partial.');
    if (row.coverage === 'complete' && row.reportingDate < row.endDate) issues.push('A complete period requires a reporting date on or after its end.');
    if (!['manual', 'job-records'].includes(row.sourceMode)) issues.push('Choose manual period totals or linked job records, never both.');
    if (read(ctx, type).some(other => other.id !== row.id && other.periodKind === row.periodKind && capacityDate(other.startDate) !== null && capacityDate(other.endDate) !== null && other.startDate <= row.endDate && row.startDate <= other.endDate)) issues.push('An actual record already covers an overlapping period of this kind. Edit it instead of adding the same activity again.');
    if (row.correctiveAction && (!['christian', 'growth'].includes(row.owner) || capacityDate(row.reviewDate) === null)) issues.push('Give the corrective action one owner and a valid review deadline.');
    if (row.periodKind === 'operating-month' && row.sourceMode === 'manual' && numberInput(row.acquisitionSpend) !== null && numberInput(row.directCost) !== null && numberInput(row.acquisitionSpend) > numberInput(row.directCost)) issues.push('Job acquisition spending is an informational subset of direct job cost, not another cost to add.');
  }
  return issues;
}

export function captureForecastBaseline(ctx = { records: {} }, options = {}) {
  const scenario = options.scenario === 'downside' ? 'downside' : 'base';
  const types = ['finance-settings', 'job-model', 'startup-cost', 'cash-week', 'operating-month', 'service-capacity'];
  const source = types.flatMap(type => read(ctx, type).filter(row => type === 'finance-settings' || type === 'service-capacity' || row.scenario === scenario).map(row => ({ type, ...row })));
  const data = { settings: source.find(row => row.type === 'finance-settings' && row.id === 'settings') || {}, jobs: source.filter(row => row.type === 'job-model'), startupCosts: source.filter(row => row.type === 'startup-cost'), cashWeeks: source.filter(row => row.type === 'cash-week'), operatingMonths: source.filter(row => row.type === 'operating-month') };
  const forecast = calculateFinance(data, scenario);
  for (const period of forecast.operating.periods) {
    const lines = data.operatingMonths.filter(row => numberInput(row.month) === period.month);
    period.jobs = lines.length ? sum(lines.map(row => numberInput(row.units))) : null;
    period.serviceMix = [...new Set(lines.map(line => line.jobModelId || 'unclassified'))].map(jobModelId => ({ jobModelId, title: data.jobs.find(job => job.id === jobModelId)?.title || 'Unclassified', jobs: sum(lines.filter(line => (line.jobModelId || 'unclassified') === jobModelId).map(line => numberInput(line.units))) }));
    period.deliveryHours = lines.length ? sum(lines.map(line => {
      const units = numberInput(line.units);
      if (units === 0) return 0;
      const models = source.filter(row => row.type === 'service-capacity' && row.jobModelId === line.jobModelId);
      const hours = models.length === 1 ? sum(SERVICE_ROLES.filter(role => role !== 'estimating').map(role => numberInput(models[0][`${role}Hours`]))) : null;
      return units === null || hours === null ? null : finite(units * hours);
    })) : null;
    period.acquisitionSpend = lines.length ? sum(lines.map(line => {
      const units = numberInput(line.units);
      if (units === 0) return 0;
      const job = data.jobs.find(row => row.id === line.jobModelId);
      const spend = numberInput(job?.allocatedAcquisition);
      return units === null || spend === null ? null : finite(units * spend);
    })) : null;
  }
  return JSON.parse(JSON.stringify({ id: options.id, planningType: 'forecast-baseline', title: options.title || `${scenario} forecast`, scenario,
    capturedAt: options.capturedAt || new Date().toISOString(), notes: options.notes || '', modelVersion: 'finance-1-performance-1', sourceRefs: source.map(row => `${row.type}:${row.id}`), inputs: source, forecast }));
}

function resolveJob(row, ctx) {
  const issues = validatePerformanceRecord('job-actual', row, ctx);
  const opportunity = rawRows(ctx).find(record => record.category === 'opportunity' && (record.body?.id || record.object_id) === row.opportunityId)?.body;
  const source = row.sourceMode === 'pipeline' ? opportunity : row;
  const values = Object.fromEntries(ACTUAL_JOB_FIELDS.map(field => [field, numberInput(row[field])]));
  if (row.sourceMode === 'pipeline') {
    values.revenue = numberInput(source?.invoiceAmount);
    values.directCost = numberInput(source?.directCost);
    values.callbacks = numberInput(source?.callbacks);
    values.invoiceAmount = numberInput(source?.invoiceAmount);
  }
  const completedAt = source?.completedAt || '';
  const invoicedAt = source?.invoicedAt || '';
  if (capacityDate(completedAt) === null || completedAt > row.reportingDate) issues.push('A valid completion date on or before the reporting date is required.');
  if (invoicedAt && (capacityDate(invoicedAt) === null || invoicedAt > row.reportingDate)) issues.push('The invoice date must be valid and on or before the reporting date.');
  if (row.sourceMode === 'pipeline' && source?.reportingDate && source.reportingDate > row.reportingDate) issues.push('The linked pipeline update is later than this job-results reporting date.');
  if (numberInput(values.acquisitionSpend) !== null && values.directCost !== null && values.acquisitionSpend > values.directCost) issues.push('Acquisition spending exceeds the direct-cost total that should include it.');
  const started = capacityDate(row.startedAt), completed = capacityDate(completedAt);
  return { ...row, values, completedAt, invoicedAt, startedAt: row.startedAt || '', completionDays: started !== null && completed !== null && completed >= started ? (completed - started) / 86400000 : null,
    experimentId: row.experimentId || source?.experimentId || '', sourceRef: row.sourceMode === 'pipeline' ? `opportunity:${row.opportunityId}` : `job-actual:${row.id}`, issues, valid: issues.length === 0 };
}
export function variance(forecast, actual, complete = true) {
  if (!Number.isFinite(forecast) || !Number.isFinite(actual)) return { forecast: finite(forecast), actual: finite(actual), absolute: null, percentage: null, comparable: false };
  const absolute = finite(actual - forecast);
  return { forecast, actual, absolute: complete ? absolute : null, percentage: complete && forecast !== 0 ? finite(absolute / Math.abs(forecast)) : null, comparable: complete };
}
function periodValues(row, jobs) {
  const values = Object.fromEntries([...new Set([...ACTUAL_CASH_FIELDS, ...ACTUAL_OPERATING_FIELDS])].map(field => [field, numberInput(row[field])]));
  const included = jobs.filter(job => within(job.completedAt, row.startDate, row.endDate) && job.completedAt <= row.reportingDate);
  const issues = [];
  if (row.periodKind === 'operating-month' && row.sourceMode === 'job-records') {
    const invalid = included.some(job => !job.valid || job.reportingDate > row.reportingDate);
    values.jobs = invalid ? null : included.length || (row.coverage === 'complete' ? 0 : null);
    for (const field of ACTUAL_JOB_FIELDS.filter(field => field !== 'invoiceAmount')) values[field] = invalid ? null : included.length ? sum(included.map(job => job.values[field])) : row.coverage === 'complete' ? 0 : null;
    const invoiced = jobs.filter(job => within(job.invoicedAt, row.startDate, row.endDate) && job.invoicedAt <= row.reportingDate);
    const undatedInvoice = jobs.some(job => job.completedAt && job.completedAt <= row.endDate && (job.values.invoiceAmount === null || (job.values.invoiceAmount > 0 && capacityDate(job.invoicedAt) === null)));
    values.invoicedAmount = undatedInvoice || invoiced.some(job => !job.valid || job.reportingDate > row.reportingDate) ? null : invoiced.length ? sum(invoiced.map(job => job.values.invoiceAmount)) : row.coverage === 'complete' ? 0 : null;
    if (invalid) issues.push('A linked job is duplicated, invalid or reported after this period’s reporting date. Correct the source before relying on totals.');
  }
  const outflows = sum(['jobPayments', 'overheadPayments', 'compensationPayments', 'marketingPayments', 'startupPayments', 'otherPayments'].map(field => values[field]));
  const inflows = sum([values.customerReceipts, values.otherInflows]);
  const operatingProfit = subtract(subtract(values.revenue, values.directCost), sum([values.overheadCost, values.compensationCost, values.fixedMarketingCost]));
  const serviceMix = row.sourceMode === 'job-records' ? [...new Set(included.map(job => job.serviceModelId || 'unclassified'))].map(serviceModelId => ({ serviceModelId, jobs: included.filter(job => (job.serviceModelId || 'unclassified') === serviceModelId).every(job => job.valid) ? included.filter(job => (job.serviceModelId || 'unclassified') === serviceModelId).length : null })) : [];
  return { ...values, outflows, inflows, change: subtract(inflows, outflows), operatingProfit, serviceMix, includedJobIds: row.sourceMode === 'job-records' ? included.map(job => job.id) : [], issues };
}

export function calculatePerformance(ctx = { records: {} }) {
  const baselines = read(ctx, 'forecast-baseline');
  const jobs = read(ctx, 'job-actual').map(row => resolveJob(row, ctx));
  const periods = read(ctx, 'actual-period').map(row => {
    const issues = validatePerformanceRecord('actual-period', row, ctx);
    const actual = periodValues(row, jobs);
    issues.push(...actual.issues);
    const matches = baselines.flatMap(baseline => {
      const forecastRows = row.periodKind === 'cash-week' ? baseline.forecast?.cash?.periods : baseline.forecast?.operating?.periods;
      return (forecastRows || []).filter(period => period.startDate === row.startDate && period.endDate === row.endDate).map(forecast => ({ baseline, forecast }));
    });
    if (!matches.length) issues.push('No saved forecast baseline has these exact period boundaries. Capture a baseline or use its dates; partial periods are not extrapolated.');
    const coverageComplete = row.coverage === 'complete' && !issues.length;
    const requiredFields = row.periodKind === 'cash-week' ? ACTUAL_CASH_FIELDS : ACTUAL_OPERATING_FIELDS;
    const missingFields = requiredFields.filter(field => actual[field] === null);
    const complete = coverageComplete && !missingFields.length;
    const comparisons = matches.map(({ baseline, forecast }) => {
      const metrics = row.periodKind === 'cash-week' ? {
        customerReceipts: variance(forecast.inputs?.customerReceipts, actual.customerReceipts, coverageComplete), inflows: variance(forecast.inflows, actual.inflows, coverageComplete), outflows: variance(forecast.outflows, actual.outflows, coverageComplete), change: variance(forecast.change, actual.change, coverageComplete),
      } : {
        jobs: variance(forecast.jobs, actual.jobs, coverageComplete), revenue: variance(forecast.revenue, actual.revenue, coverageComplete), directCost: variance(forecast.directCost, actual.directCost, coverageComplete), acquisitionSpend: variance(forecast.acquisitionSpend, actual.acquisitionSpend, coverageComplete), operatingProfit: variance(forecast.operatingProfit, actual.operatingProfit, coverageComplete), collections: variance(forecast.collections, actual.collections, coverageComplete), deliveryHours: variance(forecast.deliveryHours, actual.deliveryHours, coverageComplete),
      };
      return { baselineId: baseline.id, baselineTitle: baseline.title, capturedAt: baseline.capturedAt, scenario: baseline.scenario, metrics, forecastServiceMix: forecast.serviceMix || [] };
    });
    return { ...row, actual, comparisons, complete, coverageComplete, missingFields, issues, sourceRefs: [...actual.includedJobIds.map(id => `job-actual:${id}`), `actual-period:${row.id}`] };
  });
  return { baselines, jobs, periods, issues: [...new Set([...jobs.flatMap(job => job.issues), ...periods.flatMap(period => period.issues)])], complete: periods.length > 0 && periods.every(period => period.complete) };
}
