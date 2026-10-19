import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateCapacity, validateCapacityRecord, capacityDate } from '../app/capacity-model.js';
import { getCapacityForm, renderCapacity } from '../app/capacity-workspace.js';

const record = (type, body) => ({ category: 'task', object_id: `plan:${type}:${body.id}`, body: { planningType: type, ...body } });
const ctx = (...records) => ({ records: records.flat(), now: '2026-10-19' });
const person = (changes = {}) => ({ id: 'person', name: 'Technician', identityKey: 'technician-1', qualificationStatus: 'verified', qualifiedFor: ['field', 'estimating', 'supervision', 'callback'], qualificationSource: 'Verified capability record', active: 'yes', ...changes });
const week = (changes = {}) => ({ id: 'week', personId: 'person', weekStart: '2026-10-19', availabilityStatus: 'confirmed', availabilitySource: 'Person confirmed the schedule on 2026-10-19', allocationBasis: 'uniform-calendar', availableHours: '40', fieldHours: '20', travelHours: '5', estimatingHours: '5', adminHours: '4', supportHours: '2', supervisionHours: '2', callbackHours: '2', ...changes });
const service = (changes = {}) => ({ id: 'service', title: 'Service', jobModelId: 'job', fieldHours: '2', travelHours: '.5', estimatingHours: '.5', supervisionHours: '.2', callbackHours: '.1', ...changes });
const job = { id: 'job', scenario: 'base', title: 'Job', salePrice: '200', paidLabor: '50', materials: '20', subcontractors: '0', travel: '0', paymentFees: '0', callbackAllowance: '0', allocatedAcquisition: '0', unpaidOwnerHours: '0', unpaidOwnerHourlyValue: '0', mixWeight: '1' };
const settings = { id: 'settings', forecastStartDate: '2026-10-19', baseOpeningCash: '0', baseMonthlyOverhead: '130', baseMonthlyCompensation: '0', baseMonthlyMarketing: '0', baseMonthlyUnpaidOwnerHours: '0', baseUnpaidOwnerHourlyValue: '0', baseStartupCostsReviewed: 'yes' };
const core = () => [record('capacity-person', person()), record('capacity-week', week()), record('job-model', job), record('service-capacity', service())];

test('capacity preserves unknown versus explicit zero and rejects malformed dates and numbers', () => {
  assert.equal(capacityDate('2026-02-30'), null);
  const report = calculateCapacity(ctx(core(), record('capacity-week', week({ id: 'next', weekStart: '2026-10-26', availableHours: '', fieldHours: '0' }))));
  assert.equal(report.weeks[0].allocatedHours, 40);
  assert.equal(report.weeks[0].unallocatedHours, 0);
  assert.equal(report.weeks[1].availableHours, null);
  assert.equal(report.weeks[1].inputs.field, 0);
  assert.equal(report.weeks[1].complete, false);
  for (const value of [-1, false, [], {}, Infinity]) assert.ok(validateCapacityRecord('capacity-week', week({ fieldHours: value }), ctx(core())).length);
  assert.deepEqual(validateCapacityRecord('unrelated-record', {}), []);
  assert.ok(validateCapacityRecord('capacity-week', week({ availabilitySource: '' }), ctx(core())).some(issue => issue.includes('who confirmed')));
});

test('overlapping roles and overlapping weeks cannot double-count person hours', () => {
  assert.ok(validateCapacityRecord('capacity-week', week({ fieldHours: '30' }), ctx(core())).some(issue => issue.includes('exceed')));
  const extra = week({ id: 'overlap', weekStart: '2026-10-22' });
  const context = ctx(core(), record('capacity-week', extra));
  const report = calculateCapacity(context);
  assert.ok(report.weeks.every(row => !row.usable));
  assert.ok(validateCapacityRecord('capacity-week', extra, context).some(issue => issue.includes('overlapping')));
  assert.ok(validateCapacityRecord('capacity-person', person({ id: 'second', name: 'Other role' }), ctx(core())).some(issue => issue.includes('already')));
});

test('confirmed availability does not establish technical qualifications; proposed availability is excluded', () => {
  const demand = record('demand-week', { id: 'd', title: 'Demand', serviceModelId: 'service', weekStart: '2026-10-19', jobs: '1', inquiries: '2', expectedQuoteRate: '.5' });
  const unverified = calculateCapacity(ctx(record('capacity-person', person({ qualificationStatus: 'proposed', qualificationSource: '' })), ...core().slice(1), demand));
  assert.equal(unverified.weeklyDemand[0].capacityHours.field, null);
  const proposed = calculateCapacity(ctx(record('capacity-person', person()), record('capacity-week', week({ availabilityStatus: 'proposed' })), ...core().slice(2), demand));
  assert.equal(proposed.weeklyDemand[0].capacityHours.field, null);
  assert.equal(proposed.complete, false);
  const missingRole = calculateCapacity(ctx(record('capacity-person', person({ qualifiedFor: ['estimating'] })), ...core().slice(1), demand));
  assert.equal(missingRole.weeklyDemand[0].capacityHours.field, 0);
});

test('all services share one weekly capacity pool and quote demand includes unsuccessful inquiries', () => {
  const records = [record('demand-week', { id: 'one', serviceModelId: 'service', weekStart: '2026-10-19', jobs: '6', inquiries: '20', expectedQuoteRate: '1' }), record('service-capacity', service({ id: 'second-service', jobModelId: 'job2' })), record('job-model', { ...job, id: 'job2' }), record('demand-week', { id: 'two', serviceModelId: 'second-service', weekStart: '2026-10-19', jobs: '6', inquiries: '4', expectedQuoteRate: '1' })];
  const result = calculateCapacity(ctx(core(), records));
  assert.equal(result.weeklyDemand[0].quotes, 20);
  assert.equal(result.weeklyDemand[0].requiredHours.estimating, 10);
  assert.equal(result.demandTotals[0].requiredHours.field, 24);
  assert.ok(result.demandTotals[0].overloadedRoles.includes('field'));
  assert.ok(result.demandTotals[0].overloadedRoles.includes('estimating'));
});

test('monthly financial workload and break-even reuse existing job models and explicit allocation assumptions', () => {
  const records = [record('finance-settings', settings), record('operating-month', { id: 'month', scenario: 'base', month: '1', jobModelId: 'job', units: '10', customerCollections: '0', jobPayments: '0', otherInflows: '0', otherPayments: '0' }), record('capacity-week', week({ id: 'week2', weekStart: '2026-10-26' }))];
  let report = calculateCapacity(ctx(core(), records));
  const first = report.monthly.find(row => row.scenario === 'base' && row.month === 1);
  assert.equal(first.plannedJobs, 10);
  assert.equal(first.requiredHours.field, 20);
  assert.ok(Math.abs(first.capacityHours.field - 20 * 13 / 7) < 1e-8);
  assert.equal(first.breakEvenJobs, 1);
  assert.equal(first.breakEvenFeasible, true);
  assert.equal(report.breakEven.base.weightedHours.field, 2);
  report = calculateCapacity(ctx(core(), records.filter(row => row.body.planningType !== 'capacity-week'), record('capacity-week', week({ id: 'week2', weekStart: '2026-10-26', allocationBasis: 'whole-week' }))));
  assert.equal(report.monthly.find(row => row.scenario === 'base' && row.month === 1).capacityHours.field, null);
});

test('capacity forms provide existing source links and escape saved business content', () => {
  const context = ctx(core(), record('capacity-person', person({ id: 'hostile', name: '<img src=x onerror=alert(1)>', identityKey: 'hostile' })));
  assert.ok(getCapacityForm('service-capacity', {}, context).fields.find(field => field.key === 'jobModelId').options.some(option => option.value === 'job'));
  assert.equal(getCapacityForm('not-a-type'), null);
  assert.ok(renderCapacity(context).includes('&lt;img'));
  assert.ok(!renderCapacity(context).includes('<img src=x'));
  assert.equal(calculateCapacity(ctx()).complete, false);
});
