import test from 'node:test';
import assert from 'node:assert/strict';
import { numberInput, calculateJob, calculateBreakEven, calculateCashForecast, calculateOperatingForecast, calculateFinance, validateFinanceRecord } from '../app/finance-model.js';
import { getFinanceForm, renderFinance } from '../app/finance-workspace.js';

const settings = {
  id: 'settings', forecastStartDate: '2026-10-19',
  baseOpeningCash: '1000', baseMonthlyOverhead: '100', baseMonthlyCompensation: '200', baseMonthlyMarketing: '50', baseMonthlyUnpaidOwnerHours: '10', baseUnpaidOwnerHourlyValue: '20', baseStartupCostsReviewed: 'yes',
  downsideOpeningCash: '500', downsideMonthlyOverhead: '150', downsideMonthlyCompensation: '200', downsideMonthlyMarketing: '50', downsideMonthlyUnpaidOwnerHours: '10', downsideUnpaidOwnerHourlyValue: '20', downsideStartupCostsReviewed: 'yes',
};
const job = { id: 'service-1', scenario: 'base', title: 'Test service', salePrice: '500', paidLabor: '100', materials: '50', subcontractors: '0', travel: '10', paymentFees: '15', callbackAllowance: '25', allocatedAcquisition: '50', unpaidOwnerHours: '2', unpaidOwnerHourlyValue: '20', mixWeight: '100' };
const week = (index, overrides = {}) => ({ id: `week-${index}`, week: String(index), scenario: 'base', customerReceipts: '0', otherInflows: '0', jobPayments: '0', overheadPayments: '0', compensationPayments: '0', marketingPayments: '0', otherPayments: '0', ...overrides });
const month = (index, overrides = {}) => ({ id: `month-${index}`, month: String(index), scenario: 'base', jobModelId: 'service-1', units: '2', customerCollections: '1000', jobPayments: '500', otherInflows: '0', otherPayments: '0', ...overrides });

test('financial inputs preserve unknown versus confirmed zero and reject invalid/negative values', () => {
  for (const value of [undefined, null, '', ' ', 'not a number', Infinity, '-1', false, true, [], {}, [0], [1], new Number(5)]) assert.equal(numberInput(value), null);
  assert.equal(numberInput('0'), 0);
  assert.equal(numberInput(0), 0);
  assert.equal(numberInput('12.75'), 12.75);
});

test('job economics count acquisition once and keep unpaid labor out of cash expenses', () => {
  const result = calculateJob(job);
  assert.equal(result.productionCost, 200);
  assert.equal(result.grossProfit, 300);
  assert.equal(result.directCashCost, 250);
  assert.equal(result.cashContribution, 250);
  assert.equal(result.ownerTimeValue, 40);
  assert.equal(result.economicContribution, 210);
  assert.equal(result.contributionMargin, 0.5);
  assert.equal(result.complete, true);
  const unknown = calculateJob({ ...job, materials: '' });
  assert.equal(unknown.directCashCost, null);
  assert.equal(unknown.cashContribution, null);
  assert.deepEqual(unknown.missing, ['materials']);
});

test('break-even handles missing, negative and zero contribution without infinity or fabricated volume', () => {
  assert.equal(calculateBreakEven(null, 20).status, 'missing');
  assert.equal(calculateBreakEven(100, null).jobs, null);
  assert.equal(calculateBreakEven(100, 0).status, 'nonpositive');
  assert.equal(calculateBreakEven(100, -20).jobs, null);
  assert.equal(calculateBreakEven(101, 50).jobs, 3);
  assert.equal(calculateBreakEven(0, 50).jobs, 0);
});

test('service mix is explicit and normalized; fixed marketing and compensation are not job costs again', () => {
  const second = { ...job, id: 'service-2', salePrice: '750', mixWeight: '25' };
  const report = calculateFinance({ settings, jobs: [{ ...job, mixWeight: '75' }, second] });
  assert.equal(report.jobSummary.cashContribution, 312.5);
  assert.equal(report.jobSummary.fixedCashCosts, 350);
  assert.equal(report.jobSummary.fixedEconomicCosts, 550);
  assert.equal(report.breakEven.jobs, 2);
  assert.equal(calculateFinance({ settings, jobs: [{ ...job, mixWeight: '' }] }).breakEven.jobs, null);
  assert.equal(calculateFinance({ settings, jobs: [{ ...job, mixWeight: '0' }] }).breakEven.jobs, null);
});

test('13-week cash includes startup payment once on its date and carries actual balances, including deficits', () => {
  const rows = Array.from({ length: 13 }, (_, index) => week(index + 1));
  rows[0] = week(1, { customerReceipts: '50', jobPayments: '100' });
  const report = calculateCashForecast({ settings, rows, startupCosts: [{ amount: '1100', paymentDate: '2026-10-26' }] });
  assert.equal(report.periods[0].startup, 0);
  assert.equal(report.periods[0].closingCash, 950);
  assert.equal(report.periods[1].startup, 1100);
  assert.equal(report.periods[1].closingCash, -150);
  assert.equal(report.closingCash, -150);
  assert.equal(report.minimumCash, -150);
  assert.equal(report.complete, true);
});

test('missing weekly inputs and duplicate records cannot produce a reliable balance', () => {
  const rows = Array.from({ length: 13 }, (_, index) => week(index + 1));
  rows[1] = week(2, { customerReceipts: '' });
  let report = calculateCashForecast({ settings, rows });
  assert.equal(report.periods[0].closingCash, 1000);
  assert.equal(report.periods[1].closingCash, null);
  assert.equal(report.periods[12].closingCash, null);
  assert.equal(report.minimumCash, null);
  assert.equal(report.complete, false);
  report = calculateCashForecast({ settings, rows: [week(1), week(1)] });
  assert.equal(report.periods[0].closingCash, null);
  assert.ok(report.periods[0].missing.some((text) => text.includes('duplicate')));
});

test('unreviewed or unscheduled startup spending stays unknown rather than silently disappearing', () => {
  const rows = Array.from({ length: 13 }, (_, index) => week(index + 1));
  assert.equal(calculateCashForecast({ settings: { ...settings, baseStartupCostsReviewed: '' }, rows }).closingCash, null);
  assert.equal(calculateCashForecast({ settings, rows, startupCosts: [{ amount: '10', paymentDate: '' }] }).closingCash, null);
  assert.equal(calculateFinance({ settings: { ...settings, baseStartupCostsReviewed: '' } }).startupBudget, null);
  assert.equal(calculateFinance({ settings }).startupBudget, 0);
});

test('monthly forecast separates earned revenue, collections, startup spending and economic cost', () => {
  const rows = Array.from({ length: 12 }, (_, index) => month(index + 1));
  rows[0] = month(1, { customerCollections: '0', jobPayments: '0' });
  rows[1] = month(2, { customerCollections: '2000', jobPayments: '1000' });
  const report = calculateOperatingForecast({ settings, rows, jobs: [job], startupCosts: [{ amount: '100', paymentDate: '2026-11-01' }] });
  assert.equal(report.periods[0].revenue, 1000);
  assert.equal(report.periods[0].grossProfit, 600);
  assert.equal(report.periods[0].operatingProfit, 150);
  assert.equal(report.periods[0].economicProfit, -130);
  assert.equal(report.periods[0].closingCash, 650);
  assert.equal(report.periods[1].startup, 100);
  assert.equal(report.periods[1].closingCash, 1200);
  assert.equal(report.periods[0].startDate, '2026-10-19');
  assert.equal(report.periods[1].startDate, '2026-11-01');
  assert.equal(report.revenue, 12000);
  assert.equal(report.collections, 12000);
  assert.equal(report.complete, true);
});

test('multiple service lines apply fixed costs once and zero-job months need no invented model', () => {
  const rows = Array.from({ length: 12 }, (_, index) => month(index + 1, { units: '0', jobModelId: '', customerCollections: '0', jobPayments: '0' }));
  rows.push(month(1, { id: 'extra', units: '2' }));
  const report = calculateOperatingForecast({ settings, rows, jobs: [job] });
  assert.equal(report.periods[0].revenue, 1000);
  assert.equal(report.periods[0].fixedCashCosts, 350);
  assert.equal(report.periods[0].operatingProfit, 150);
  assert.equal(report.periods[1].revenue, 0);
  assert.equal(report.periods[1].operatingProfit, -350);
  assert.equal(report.complete, true);
});

test('downside requires its own inputs and cannot borrow a base-case service', () => {
  const report = calculateFinance({ settings, jobs: [job], cashWeeks: [week(1)], operatingMonths: [month(1, { scenario: 'downside' })] }, 'downside');
  assert.equal(report.settings.openingCash, 500);
  assert.equal(report.jobSummary.cashContribution, null);
  assert.equal(report.operating.periods[0].revenue, null);
  assert.equal(report.cash.periods[0].closingCash, null);
});

test('invalid dates are rejected instead of normalized and weeks do not extend past the horizon', () => {
  const report = calculateCashForecast({ settings: { ...settings, forecastStartDate: '2026-02-30' }, rows: [week(1)] });
  assert.equal(report.periods[0].startDate, '');
  assert.equal(report.complete, false);
  const horizon = calculateCashForecast({ settings, rows: Array.from({ length: 13 }, (_, index) => week(index + 1)), startupCosts: [{ amount: '900', paymentDate: '2027-01-18' }] });
  assert.equal(horizon.closingCash, 1000);
  assert.equal(horizon.periods[12].endDate, '2027-01-17');
});

test('finance forms retain unknown initial values and offer scenario-specific saved job models', () => {
  const form = getFinanceForm('operating-month', {}, { jobs: [job] });
  assert.equal(form.initial.units, undefined);
  assert.ok(form.fields.find((field) => field.key === 'jobModelId').options.some((option) => option.value === job.id));
  assert.equal(getFinanceForm('finance-settings').id, 'settings');
  assert.equal(getFinanceForm('not-finance'), null);
});

test('finance rendering escapes saved text and exposes missing-input status without sample figures', () => {
  const records = (type) => type === 'job-model' ? [{ ...job, title: '<script>bad()</script>' }] : [];
  const html = renderFinance({ records });
  assert.ok(html.includes('&lt;script&gt;bad()&lt;/script&gt;'));
  assert.ok(!html.includes('<script>bad()'));
  assert.ok(html.includes('Unknown'));
  assert.ok(html.includes('data-plan-edit="finance-settings"'));
  assert.ok(html.includes('data-plan-new="cash-week"'));
});


test('record validation blocks impossible periods and invalid amounts while allowing explicitly unknown costs', () => {
  assert.deepEqual(validateFinanceRecord('job-model', { ...job, materials: '' }), []);
  assert.ok(validateFinanceRecord('job-model', { ...job, materials: '-20' }).length);
  assert.ok(validateFinanceRecord('cash-week', week(14)).length);
  assert.ok(validateFinanceRecord('operating-month', month(0)).length);
  assert.ok(validateFinanceRecord('operating-month', month(1, { jobModelId: '' })).length);
  assert.ok(validateFinanceRecord('finance-settings', { forecastStartDate: '2026-02-30' }).length);
});


test('coerced types and overflow cannot fabricate financial amounts', () => {
  const report = calculateJob({ ...job, materials: false });
  assert.equal(report.directCashCost, null);
  assert.equal(calculateJob({ ...job, paidLabor: 1e308, materials: 1e308 }).directCashCost, null);
  assert.equal(calculateBreakEven(Infinity, 1).jobs, null);
  assert.ok(validateFinanceRecord('startup-cost', { scenario: 'base', amount: [] }).length);
  assert.ok(validateFinanceRecord('job-model', { ...job, materials: false }).length);
  const html = renderFinance({ records: (type) => type === 'startup-cost' ? [{ id: 'bad', scenario: 'base', title: 'Malformed startup', amount: false }] : [] });
  assert.ok(!html.includes('Malformed startup</td><td>$0.00'));
});

test('weekly cash actions identify the chosen scenario and week without changing financial inputs',()=>{const html=renderFinance({records:()=>[]});assert.match(html,/data-plan-new="cash-week" data-plan-scenario="base" data-plan-week="1"/);assert.match(html,/data-plan-new="cash-week" data-plan-scenario="downside" data-plan-week="13"/);assert.match(html,/data-plan-new="job-model" data-plan-scenario="downside"/)});
