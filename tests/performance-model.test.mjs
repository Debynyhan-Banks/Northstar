import test from 'node:test';
import assert from 'node:assert/strict';
import { captureForecastBaseline, calculatePerformance, validatePerformanceRecord, variance } from '../app/performance-model.js';
import { renderPerformance, getPerformanceForm } from '../app/performance-workspace.js';

const record = (type, body) => ({ category: 'task', object_id: `plan:${type}:${body.id}`, body: { planningType: type, ...body } });
const ctx = (...records) => ({ records: records.flat(), now: '2026-11-01' });
const settings = { id: 'settings', forecastStartDate: '2026-10-19', baseOpeningCash: '1000', baseMonthlyOverhead: '100', baseMonthlyCompensation: '50', baseMonthlyMarketing: '20', baseMonthlyUnpaidOwnerHours: '0', baseUnpaidOwnerHourlyValue: '0', baseStartupCostsReviewed: 'yes' };
const job = { id: 'service', scenario: 'base', title: 'Service', salePrice: '200', paidLabor: '50', materials: '20', subcontractors: '0', travel: '0', paymentFees: '0', callbackAllowance: '0', allocatedAcquisition: '10', unpaidOwnerHours: '0', unpaidOwnerHourlyValue: '0', mixWeight: '1' };
const core = () => [record('finance-settings', settings), record('job-model', job), record('operating-month', { id: 'month', scenario: 'base', month: '1', jobModelId: 'service', units: '2', customerCollections: '100', jobPayments: '160', otherInflows: '0', otherPayments: '0' }), record('service-capacity', { id: 'capacity', jobModelId: 'service', fieldHours: '2', travelHours: '1', supervisionHours: '0', callbackHours: '.5', estimatingHours: '.5' }), record('cash-week', { id: 'cash', scenario: 'base', week: '1', customerReceipts: '100', otherInflows: '0', jobPayments: '50', overheadPayments: '0', compensationPayments: '0', marketingPayments: '0', otherPayments: '0' })];
const baseline = context => captureForecastBaseline(context, { id: 'baseline', title: 'Initial assumptions', scenario: 'base', capturedAt: '2026-10-19T12:00:00Z' });
const actual = (changes = {}) => ({ id: 'actual', title: 'October actuals', periodKind: 'operating-month', startDate: '2026-10-19', endDate: '2026-10-31', reportingDate: '2026-11-01', coverage: 'complete', sourceMode: 'manual', jobs: '2', revenue: '300', directCost: '200', acquisitionSpend: '10', paidLaborHours: '4', unpaidOwnerHours: '2', deliveryHours: '8', callbacks: '0', invoicedAmount: '300', collections: '120', overheadCost: '100', compensationCost: '50', fixedMarketingCost: '20', ...changes });
const actualJob = (changes = {}) => ({ id: 'actual-job', title: 'Completed service', sourceMode: 'manual', jobReference: 'JOB-1', serviceModelId: 'service', startedAt: '2026-10-20', completedAt: '2026-10-22', invoicedAt: '2026-10-23', reportingDate: '2026-10-31', revenue: '200', directCost: '80', acquisitionSpend: '10', paidLaborHours: '3', unpaidOwnerHours: '1', deliveryHours: '3.5', callbacks: '0', invoiceAmount: '200', costBasisConfirmed: 'yes', ...changes });

test('dated baseline copies existing finance calculations and preserves inputs after edits', () => {
  const context = ctx(core());
  const saved = baseline(context);
  assert.equal(saved.forecast.operating.periods[0].revenue, 400);
  assert.equal(saved.forecast.operating.periods[0].directCost, 160);
  assert.equal(saved.forecast.operating.periods[0].operatingProfit, 70);
  assert.equal(saved.forecast.operating.periods[0].deliveryHours, 7);
  assert.equal(saved.forecast.operating.periods[0].acquisitionSpend, 20);
  assert.ok(saved.sourceRefs.includes('job-model:service'));
  context.records.find(row => row.body.id === 'service').body.salePrice = '999';
  assert.equal(saved.inputs.find(row => row.id === 'service').salePrice, '200');
  assert.equal(saved.forecast.operating.periods[0].revenue, 400);
  assert.ok(validatePerformanceRecord('forecast-baseline', saved, ctx(record('forecast-baseline', saved))).some(issue => issue.includes('immutable')));
});

test('compatible complete periods show signed differences including negative operating profit without duplicate acquisition cost', () => {
  const source = ctx(core());
  const report = calculatePerformance(ctx(core(), record('forecast-baseline', baseline(source)), record('actual-period', actual())));
  const first = report.periods[0];
  assert.equal(first.actual.operatingProfit, -70);
  assert.equal(first.comparisons[0].metrics.operatingProfit.absolute, -140);
  assert.equal(first.comparisons[0].metrics.revenue.percentage, -.25);
  assert.equal(first.comparisons[0].metrics.directCost.actual, 200);
  assert.equal(first.complete, true);
});

test('missing versus zero and zero forecast denominators do not produce fabricated rates', () => {
  assert.equal(variance(0, 10).absolute, 10);
  assert.equal(variance(0, 10).percentage, null);
  assert.equal(variance(null, 10).absolute, null);
  const context = ctx(core());
  let result = calculatePerformance(ctx(core(), record('forecast-baseline', baseline(context)), record('actual-period', actual({ revenue: '' }))));
  assert.equal(result.periods[0].comparisons[0].metrics.revenue.actual, null);
  assert.equal(result.periods[0].actual.operatingProfit, null);
  assert.equal(result.periods[0].complete, false);
  assert.ok(result.periods[0].missingFields.includes('revenue'));
  result = calculatePerformance(ctx(core(), record('forecast-baseline', baseline(context)), record('actual-period', actual({ revenue: '0' }))));
  assert.equal(result.periods[0].comparisons[0].metrics.revenue.actual, 0);
  assert.equal(result.periods[0].actual.operatingProfit, -370);
});

test('partial and incompatible period coverage cannot be represented as whole-period variance', () => {
  const source = ctx(core());
  let report = calculatePerformance(ctx(core(), record('forecast-baseline', baseline(source)), record('actual-period', actual({ coverage: 'partial' }))));
  assert.equal(report.periods[0].comparisons[0].metrics.revenue.actual, 300);
  assert.equal(report.periods[0].comparisons[0].metrics.revenue.absolute, null);
  assert.equal(report.periods[0].complete, false);
  report = calculatePerformance(ctx(core(), record('forecast-baseline', baseline(source)), record('actual-period', actual({ startDate: '2026-10-20' }))));
  assert.equal(report.periods[0].comparisons.length, 0);
  assert.ok(report.periods[0].issues.some(issue => issue.includes('exact period')));
  assert.ok(validatePerformanceRecord('actual-period', actual({ reportingDate: '2026-10-25' }), source).some(issue => issue.includes('on or after')));
});

test('stable job identities and overlapping actual periods prevent duplicate jobs or expenses', () => {
  const one = actualJob();
  const two = actualJob({ id: 'duplicate' });
  const context = ctx(core(), record('job-actual', one), record('job-actual', two));
  assert.ok(validatePerformanceRecord('job-actual', two, context).some(issue => issue.includes('already')));
  const report = calculatePerformance(ctx(context.records, record('actual-period', actual({ sourceMode: 'job-records' }))));
  assert.equal(report.periods[0].actual.jobs, null);
  assert.equal(report.periods[0].actual.directCost, null);
  assert.ok(validatePerformanceRecord('actual-period', actual({ id: 'overlap', startDate: '2026-10-25', endDate: '2026-11-10' }), ctx(record('actual-period', actual()))).some(issue => issue.includes('overlapping')));
});

test('pipeline reuse ignores duplicate manual job amounts and never reuses lifetime cash as period collections', () => {
  const opportunity = { category: 'opportunity', object_id: 'op', body: { id: 'op', name: 'Job', completedAt: '2026-10-22', invoicedAt: '2026-10-23', reportingDate: '2026-10-31', invoiceAmount: '500', directCost: '250', callbacks: '1', cashCollected: '9999', experimentId: 'experiment' } };
  const linked = actualJob({ sourceMode: 'pipeline', opportunityId: 'op', revenue: '999', directCost: '999', callbacks: '99', invoiceAmount: '999' });
  const report = calculatePerformance(ctx(core(), opportunity, record('job-actual', linked), record('actual-period', actual({ sourceMode: 'job-records', revenue: '10000', directCost: '10000', collections: '' }))));
  assert.equal(report.periods[0].actual.jobs, 1);
  assert.equal(report.periods[0].actual.revenue, 500);
  assert.equal(report.periods[0].actual.directCost, 250);
  assert.equal(report.periods[0].actual.collections, null);
  assert.equal(report.periods[0].actual.callbacks, 1);
  assert.equal(report.periods[0].actual.invoicedAmount, 500);
  assert.equal(report.jobs[0].completionDays, 2);
  assert.equal(report.jobs[0].experimentId, 'experiment');
});

test('cash actuals preserve payment timing and cash deficits separately from operating earnings', () => {
  const source = ctx(core());
  const cash = actual({ periodKind: 'cash-week', endDate: '2026-10-25', customerReceipts: '0', otherInflows: '0', jobPayments: '500', overheadPayments: '0', compensationPayments: '0', marketingPayments: '0', startupPayments: '0', otherPayments: '0' });
  const report = calculatePerformance(ctx(core(), record('forecast-baseline', baseline(source)), record('actual-period', cash)));
  assert.equal(report.periods[0].actual.change, -500);
  assert.equal(report.periods[0].comparisons[0].metrics.change.forecast, 50);
  assert.equal(report.periods[0].comparisons[0].metrics.change.absolute, -550);
});

test('validation is scoped, unknown/negative values remain distinguishable and future source updates are flagged', () => {
  assert.deepEqual(validatePerformanceRecord('evidence', {}), []);
  assert.ok(validatePerformanceRecord('actual-period', actual({ directCost: -1 })).some(issue => issue.includes('nonnegative')));
  assert.ok(validatePerformanceRecord('actual-period', actual({ directCost: true })).some(issue => issue.includes('nonnegative')));
  assert.ok(validatePerformanceRecord('actual-period', actual({ correctiveAction: 'Review offer' })).some(issue => issue.includes('owner')));
  const opportunity = { category: 'opportunity', object_id: 'op', body: { id: 'op', completedAt: '2026-10-22', invoiceAmount: '100', directCost: '20', reportingDate: '2026-11-02' } };
  const report = calculatePerformance(ctx(opportunity, record('job-actual', actualJob({ sourceMode: 'pipeline', opportunityId: 'op' }))));
  assert.ok(report.jobs[0].issues.some(issue => issue.includes('later')));
});

test('manual performance forms retain links and rendered content is escaped', () => {
  const context = ctx(core(), record('actual-period', actual({ title: '<script>bad()</script>' })));
  assert.ok(renderPerformance(context).includes('&lt;script&gt;'));
  assert.ok(!renderPerformance(context).includes('<script>bad'));
  assert.ok(getPerformanceForm('job-actual', {}, context).fields.some(field => field.key === 'serviceModelId'));
  assert.deepEqual(getPerformanceForm('actual-period', {}, context).fields.find(field => field.key === 'customerReceipts').showWhen, { field: 'periodKind', value: 'cash-week' });
  assert.deepEqual(getPerformanceForm('actual-period', {}, context).fields.find(field => field.key === 'revenue').showWhen, { field: 'periodKind', value: 'operating-month' });
  assert.equal(getPerformanceForm('unrelated'), null);
  assert.equal(calculatePerformance(ctx()).complete, false);
});

test('missing invoice amounts or dates remain unknown in linked period invoice totals', () => {
  const report = calculatePerformance(ctx(record('job-actual', actualJob({ invoicedAt: '' })), record('actual-period', actual({ sourceMode: 'job-records' }))));
  assert.equal(report.periods[0].actual.invoicedAmount, null);
  assert.ok(report.periods[0].missingFields.includes('invoicedAmount'));
});
