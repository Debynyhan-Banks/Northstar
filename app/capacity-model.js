import { numberInput, calculateFinance } from './finance-model.js';
import { planningRecords } from './planning-model.js';

export const CAPACITY_ROLES = ['field', 'travel', 'estimating', 'admin', 'support', 'supervision', 'callback'];
export const SERVICE_ROLES = ['field', 'travel', 'estimating', 'supervision', 'callback'];
const TECHNICAL = new Set(['field', 'estimating', 'supervision', 'callback']);
const DAY = 86400000;
export function capacityDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date.getTime() : null;
}
const dateText = value => new Date(value).toISOString().slice(0, 10);
const sum = values => values.every(Number.isFinite) && Number.isFinite(values.reduce((a, b) => a + b, 0)) ? values.reduce((a, b) => a + b, 0) : null;
const identity = person => person.seat && ['christian', 'growth'].includes(person.seat) ? `seat:${person.seat}` : String(person.identityKey || person.name || '').trim().toLowerCase();
const rows = (ctx, type) => planningRecords(ctx.records, type);
const numericFields = {
  'capacity-week': ['availableHours', ...CAPACITY_ROLES.map(role => `${role}Hours`)],
  'service-capacity': SERVICE_ROLES.map(role => `${role}Hours`),
  'demand-week': ['jobs', 'inquiries', 'expectedQuoteRate'],
};
const overlaps = (start, otherStart) => start !== null && otherStart !== null && start <= otherStart + 6 * DAY && otherStart <= start + 6 * DAY;

export function validateCapacityRecord(type, row = {}, ctx = { records: {} }) {
  const issues = [];
  for (const field of numericFields[type] || []) {
    if (row[field] !== '' && row[field] !== undefined && row[field] !== null && numberInput(row[field]) === null) issues.push(`${field} must be a nonnegative finite number, or blank when unknown.`);
  }
  if (type === 'capacity-person') {
    if (!String(row.name || '').trim()) issues.push('Enter the person’s name.');
    if (!identity(row)) issues.push('Identify the person once, even when they work in multiple roles.');
    if (!['proposed', 'verified'].includes(row.qualificationStatus)) issues.push('Record whether technical capability is proposed or verified.');
    if (row.qualificationStatus === 'verified' && !String(row.qualificationSource || '').trim()) issues.push('Record the source used to verify technical capability.');
    if (rows(ctx, type).some(other => other.id !== row.id && identity(other) === identity(row))) issues.push('This person already has a capacity profile. Keep their roles in that single profile.');
  }
  if (type === 'capacity-week') {
    const people = rows(ctx, 'capacity-person');
    const person = people.find(item => item.id === row.personId);
    if (!person) issues.push('Choose an existing person.');
    if (capacityDate(row.weekStart) === null) issues.push('Enter a valid week start date.');
    if (!['confirmed', 'proposed'].includes(row.availabilityStatus)) issues.push('Distinguish proposed from confirmed availability.');
    if (row.availabilityStatus === 'confirmed' && !String(row.availabilitySource || '').trim()) issues.push('Record who confirmed this availability, when and how.');
    if (!['whole-week', 'uniform-calendar'].includes(row.allocationBasis)) issues.push('Choose how weekly hours may be distributed at month boundaries.');
    const available = numberInput(row.availableHours);
    const allocated = sum(CAPACITY_ROLES.map(role => numberInput(row[`${role}Hours`])));
    if (available !== null && available > 168) issues.push('Weekly availability cannot exceed 168 hours.');
    if (available !== null && allocated !== null && allocated > available) issues.push('Role allocations exceed this person’s weekly availability. Allocate each hour to one role.');
    const samePerson = new Set(people.filter(other => identity(other) === identity(person || {})).map(other => other.id));
    if (rows(ctx, type).some(other => other.id !== row.id && samePerson.has(other.personId) && overlaps(capacityDate(row.weekStart), capacityDate(other.weekStart)))) issues.push('This person already has an overlapping week. Edit that record instead of counting availability again.');
  }
  if (type === 'service-capacity') {
    if (!rows(ctx, 'job-model').some(job => job.id === row.jobModelId)) issues.push('Link the service to an existing financial job model.');
    if (rows(ctx, type).some(other => other.id !== row.id && other.jobModelId === row.jobModelId)) issues.push('This financial service already has a capacity model. Edit the existing one.');
  }
  if (type === 'demand-week') {
    if (capacityDate(row.weekStart) === null) issues.push('Enter a valid demand week start date.');
    if (!rows(ctx, 'service-capacity').some(service => service.id === row.serviceModelId)) issues.push('Choose an existing service capacity model.');
    const rate = numberInput(row.expectedQuoteRate);
    if (rate !== null && rate > 1) issues.push('Enter the expected inquiry-to-quote fraction from 0 to 1.');
    if (rows(ctx, type).some(other => other.id !== row.id && other.serviceModelId === row.serviceModelId && other.weekStart === row.weekStart)) issues.push('This service already has a demand estimate for that week. Edit it to avoid duplicate workload.');
  }
  return issues;
}

function buildWeeks(ctx, people) {
  return rows(ctx, 'capacity-week').map(row => {
    const person = people.find(item => item.id === row.personId);
    const issues = validateCapacityRecord('capacity-week', row, ctx);
    const inputs = Object.fromEntries(CAPACITY_ROLES.map(role => [role, numberInput(row[`${role}Hours`])]));
    const availableHours = numberInput(row.availableHours);
    const allocatedHours = sum(Object.values(inputs));
    if (availableHours === null || allocatedHours === null) issues.push('Enter availability and every role allocation, including explicit zero when none applies.');
    if (person && validateCapacityRecord('capacity-person', person, ctx).length) issues.push('Resolve the person’s capability or duplicate-profile issue.');
    const qualifiedHours = Object.fromEntries(CAPACITY_ROLES.map(role => {
      const value = inputs[role];
      if (value === 0 || !TECHNICAL.has(role)) return [role, value];
      if (person?.qualificationStatus !== 'verified') return [role, null];
      return [role, Array.isArray(person.qualifiedFor) && person.qualifiedFor.includes(role) ? value : 0];
    }));
    for (const role of TECHNICAL) if (inputs[role] > 0 && qualifiedHours[role] !== inputs[role]) issues.push(`${role}: technical coverage is unverified or outside the recorded capability.`);
    const structural = issues.some(issue => !issue.includes('technical coverage'));
    return { ...row, person, inputs, availableHours, allocatedHours, qualifiedHours, unallocatedHours: availableHours !== null && allocatedHours !== null ? availableHours - allocatedHours : null,
      complete: !structural && Object.values(qualifiedHours).every(Number.isFinite), issues, usable: !structural, start: capacityDate(row.weekStart) };
  });
}

function periodCapacity(people, weeks, from, to) {
  const issues = [];
  const totals = Object.fromEntries(CAPACITY_ROLES.map(role => [role, 0]));
  if (from === null || to === null || !people.length) return { hours: Object.fromEntries(CAPACITY_ROLES.map(role => [role, null])), issues: ['Set the forecast dates and record the people needed to deliver the work.'] };
  for (const person of people) {
    for (let day = from; day <= to; day += DAY) {
      const matches = weeks.filter(week => week.personId === person.id && week.start !== null && day >= week.start && day <= week.start + 6 * DAY);
      if (matches.length !== 1 || !matches[0].usable || matches[0].availabilityStatus !== 'confirmed') {
        issues.push(`${person.name || 'Person'}: missing, proposed, incomplete or overlapping availability on ${dateText(day)}.`);
        for (const role of CAPACITY_ROLES) totals[role] = null;
        continue;
      }
      const week = matches[0];
      const split = week.start < from || week.start + 6 * DAY > to;
      if (split && week.allocationBasis !== 'uniform-calendar') {
        issues.push(`${person.name}: ${week.weekStart} crosses the reporting boundary. Confirm a uniform calendar-day allocation or compare the whole week.`);
        for (const role of CAPACITY_ROLES) totals[role] = null;
        continue;
      }
      for (const role of CAPACITY_ROLES) {
        if (totals[role] === null) continue;
        totals[role] = week.qualifiedHours[role] === null ? null : totals[role] + week.qualifiedHours[role] / 7;
      }
    }
  }
  return { hours: totals, issues: [...new Set(issues)] };
}
function serviceHours(service, units, extraQuotes = null) {
  return Object.fromEntries(SERVICE_ROLES.map(role => {
    const perJob = numberInput(service?.[`${role}Hours`]);
    const count = role === 'estimating' && extraQuotes !== null ? extraQuotes : units;
    const value = count === 0 ? 0 : perJob === null || count === null ? null : perJob * count;
    return [role, Number.isFinite(value) ? value : null];
  }));
}
function feasibleJobs(hours, perJob) {
  if (SERVICE_ROLES.some(role => hours[role] === null || perJob[role] === null)) return null;
  const ratios = SERVICE_ROLES.filter(role => perJob[role] > 0).map(role => hours[role] / perJob[role]);
  return ratios.length ? Math.floor(Math.min(...ratios)) : null;
}

export function calculateCapacity(ctx = { records: {} }) {
  const people = rows(ctx, 'capacity-person').filter(person => person.active !== 'no');
  const weeks = buildWeeks(ctx, people);
  const services = rows(ctx, 'service-capacity');
  const settings = rows(ctx, 'finance-settings').find(row => row.id === 'settings') || {};
  const data = { settings, jobs: rows(ctx, 'job-model'), startupCosts: rows(ctx, 'startup-cost'), cashWeeks: rows(ctx, 'cash-week'), operatingMonths: rows(ctx, 'operating-month') };
  const issues = [...people.flatMap(person => validateCapacityRecord('capacity-person', person, ctx)), ...weeks.flatMap(week => week.issues), ...services.flatMap(service => validateCapacityRecord('service-capacity', service, ctx))];
  if (!people.length) issues.push('No delivery-capacity people have been recorded.');
  if (!weeks.length) issues.push('No dated availability has been recorded.');
  const monthly = [];
  const breakEven = {};
  for (const scenario of ['base', 'downside']) {
    const finance = calculateFinance(data, scenario);
    const activeJobs = finance.jobs.filter(job => job.mixWeight > 0);
    const allWeightsKnown = finance.jobSummary.weightTotal > 0 && finance.jobs.every(job => job.mixWeight !== null);
    const weightedHours = Object.fromEntries(SERVICE_ROLES.map(role => {
      const values = activeJobs.map(job => {
        const models = services.filter(model => model.jobModelId === job.id);
        const hours = models.length === 1 ? numberInput(models[0][`${role}Hours`]) : null;
        return hours === null ? null : hours * job.mixWeight / finance.jobSummary.weightTotal;
      });
      return [role, allWeightsKnown && values.length ? sum(values) : null];
    }));
    breakEven[scenario] = { jobs: finance.breakEven.jobs, weightedHours, requiredHours: Object.fromEntries(SERVICE_ROLES.map(role => [role, finance.breakEven.jobs === null || weightedHours[role] === null ? null : finance.breakEven.jobs * weightedHours[role]])), message: finance.breakEven.message };
    for (const period of finance.operating.periods) {
      const capacity = periodCapacity(people, weeks, capacityDate(period.startDate), capacityDate(period.endDate));
      const lines = data.operatingMonths.filter(line => line.scenario === scenario && numberInput(line.month) === period.month);
      const workloads = lines.map(line => {
        const models = services.filter(model => model.jobModelId === line.jobModelId);
        return serviceHours(models.length === 1 ? models[0] : null, numberInput(line.units));
      });
      const requiredHours = Object.fromEntries(SERVICE_ROLES.map(role => [role, lines.length ? sum(workloads.map(workload => workload[role])) : null]));
      const plannedJobs = lines.length ? sum(lines.map(line => numberInput(line.units))) : null;
      const feasible = feasibleJobs(capacity.hours, weightedHours);
      const overloadedRoles = SERVICE_ROLES.filter(role => requiredHours[role] !== null && capacity.hours[role] !== null && requiredHours[role] > capacity.hours[role] + 1e-8);
      monthly.push({ scenario, month: period.month, startDate: period.startDate, endDate: period.endDate, plannedJobs, requiredHours, capacityHours: capacity.hours, feasibleJobs: feasible,
        breakEvenJobs: finance.breakEven.jobs, breakEvenFeasible: feasible === null || finance.breakEven.jobs === null ? null : finance.breakEven.jobs <= feasible, overloadedRoles, issues: capacity.issues });
    }
  }
  const weeklyDemand = rows(ctx, 'demand-week').map(demand => {
    const service = services.find(item => item.id === demand.serviceModelId);
    const rate = numberInput(demand.expectedQuoteRate), inquiries = numberInput(demand.inquiries);
    const quotes = rate === null || inquiries === null ? null : rate * inquiries;
    const requiredHours = serviceHours(service, numberInput(demand.jobs), quotes);
    const start = capacityDate(demand.weekStart);
    const capacity = periodCapacity(people, weeks, start, start === null ? null : start + 6 * DAY);
    const demandIssues = validateCapacityRecord('demand-week', demand, ctx);
    return { ...demand, quotes, requiredHours, capacityHours: capacity.hours, issues: [...demandIssues, ...capacity.issues], overloadedRoles: SERVICE_ROLES.filter(role => requiredHours[role] !== null && capacity.hours[role] !== null && requiredHours[role] > capacity.hours[role] + 1e-8) };
  });
  // Demand for different services in the same week must share one capacity pool.
  const demandTotals = [...new Set(weeklyDemand.map(row => row.weekStart))].map(weekStart => {
    const lines = weeklyDemand.filter(row => row.weekStart === weekStart);
    const duplicate = lines.some(line => line.issues.some(issue => issue.includes('duplicate workload')));
    const requiredHours = Object.fromEntries(SERVICE_ROLES.map(role => [role, duplicate ? null : sum(lines.map(line => line.requiredHours[role]))]));
    const capacityHours = lines[0].capacityHours;
    return { weekStart, requiredHours, capacityHours, overloadedRoles: SERVICE_ROLES.filter(role => requiredHours[role] !== null && capacityHours[role] !== null && requiredHours[role] > capacityHours[role] + 1e-8), issues: [...new Set(lines.flatMap(line => line.issues))] };
  });
  return { people, weeks, services, monthly, breakEven, weeklyDemand, demandTotals, issues: [...new Set(issues)], complete: people.length > 0 && weeks.length > 0 && issues.length === 0 && weeks.every(week => week.complete && week.availabilityStatus === 'confirmed') };
}
