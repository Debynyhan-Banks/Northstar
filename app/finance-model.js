// Financial planning estimates. Blank values stay unknown; explicit zero is a valid input.
export function numberInput(value) {
  if (!['number', 'string'].includes(typeof value) || (typeof value === 'string' && value.trim() === '')) return null;
  const result = Number(value);
  return Number.isFinite(result) && result >= 0 ? result : null;
}
const finite = (value) => Number.isFinite(value) ? value : null;
const total = (values) => values.every(Number.isFinite) ? finite(values.reduce((sum, value) => sum + value, 0)) : null;
const mul = (a, b) => a === null || b === null ? null : finite(a * b);
const minus = (a, b) => a === null || b === null ? null : finite(a - b);
export const FINANCE_LABELS = { openingCash: 'opening cash', monthlyOverhead: 'monthly overhead', monthlyCompensation: 'monthly fixed compensation', monthlyMarketing: 'monthly fixed marketing', monthlyUnpaidOwnerHours: 'monthly unpaid management hours', unpaidOwnerHourlyValue: 'hourly value of unpaid owner time', customerReceipts: 'customer cash receipts', otherInflows: 'other cash inflows', jobPayments: 'direct job cash payments', overheadPayments: 'overhead cash payments', compensationPayments: 'fixed compensation payments', marketingPayments: 'fixed marketing payments', otherPayments: 'other cash payments', units: 'planned job count', customerCollections: 'customer cash collections', salePrice: 'selling price', paidLabor: 'paid labor', materials: 'materials and equipment', subcontractors: 'subcontractors', travel: 'travel', paymentFees: 'payment fees', callbackAllowance: 'callback allowance', allocatedAcquisition: 'job-allocated acquisition cost', unpaidOwnerHours: 'unpaid technical hours', mixWeight: 'service-mix weight' };
const issue = (label, field) => `${label}: enter ${FINANCE_LABELS[field] || field}, including 0 when none applies.`;
const scenarioName = (scenario) => scenario === 'downside' ? 'downside' : 'base';
export const JOB_COST_FIELDS = ['paidLabor', 'materials', 'subcontractors', 'travel', 'paymentFees', 'callbackAllowance', 'allocatedAcquisition'];
export const WEEK_FIELDS = ['customerReceipts', 'otherInflows', 'jobPayments', 'overheadPayments', 'compensationPayments', 'marketingPayments', 'otherPayments'];
export const MONTH_FIELDS = ['units', 'customerCollections', 'jobPayments', 'otherInflows', 'otherPayments'];
export const SETTING_FIELDS = ['openingCash', 'monthlyOverhead', 'monthlyCompensation', 'monthlyMarketing', 'monthlyUnpaidOwnerHours', 'unpaidOwnerHourlyValue'];
export function scenarioSettings(settings = {}, scenario = 'base') {
  const prefix = scenarioName(scenario);
  return Object.fromEntries(SETTING_FIELDS.map((key) => [key, numberInput(settings[`${prefix}${key[0].toUpperCase()}${key.slice(1)}`]) ]));
}
export function calculateJob(job = {}) {
  const fields = ['salePrice', ...JOB_COST_FIELDS, 'unpaidOwnerHours', 'unpaidOwnerHourlyValue'];
  const inputs = Object.fromEntries(fields.map((key) => [key, numberInput(job[key])]));
  const missing = fields.filter((key) => inputs[key] === null);
  const directCashCost = total(JOB_COST_FIELDS.map((key) => inputs[key]));
  const ownerTimeValue = mul(inputs.unpaidOwnerHours, inputs.unpaidOwnerHourlyValue);
  const cashContribution = minus(inputs.salePrice, directCashCost);
  const economicContribution = minus(cashContribution, ownerTimeValue);
  const productionCost = total(JOB_COST_FIELDS.filter((key) => key !== 'allocatedAcquisition').map((key) => inputs[key]));
  const grossProfit = minus(inputs.salePrice, productionCost);
  return { id: job.id, title: job.title || 'Untitled service', inputs, missing, complete: missing.length === 0,
    salePrice: inputs.salePrice, productionCost, grossProfit, directCashCost, ownerTimeValue, cashContribution, economicContribution,
    contributionMargin: inputs.salePrice > 0 && cashContribution !== null ? cashContribution / inputs.salePrice : null,
    mixWeight: numberInput(job.mixWeight),
  };
}
export function calculateBreakEven(fixedCosts, contribution) {
  if (!Number.isFinite(fixedCosts) || !Number.isFinite(contribution) || fixedCosts < 0) return { jobs: null, status: 'missing', message: 'Complete fixed-cost and service-mix assumptions.' };
  if (contribution <= 0) return { jobs: null, status: 'nonpositive', message: 'Contribution is zero or negative. No finite job volume covers these costs at this service mix.' };
  if (!Number.isFinite(fixedCosts / contribution)) return { jobs: null, status: 'missing', message: 'The entered amounts exceed the supported calculation range. Review financial assumptions.' };
  return { jobs: Math.ceil(fixedCosts / contribution), status: 'ready', message: 'Whole jobs required each month at the entered, normalized service mix.' };
}
function dateValue(input) {
  if (typeof input !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input)) return null;
  const d = new Date(`${input}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== input ? null : d;
}
function periodStartup(startupCosts, start, end, reviewed) {
  let amount = 0;
  const missing = reviewed ? [] : ['Confirm that the startup-cost list is complete, including an intentionally empty list.'];
  for (const row of startupCosts) {
    const payment = dateValue(row.paymentDate);
    const cost = numberInput(row.amount);
    if (!payment) { missing.push(`Schedule startup item: ${row.title || 'Untitled startup cost'}`); continue; }
    if (payment >= start && payment < end) {
      if (cost === null) missing.push(`Enter startup amount: ${row.title || 'Untitled startup cost'}`);
      else amount += cost;
    }
  }
  if (!Number.isFinite(amount)) missing.push('Startup spending exceeds the supported calculation range; review amounts.');
  return { amount: missing.length ? null : amount, missing };
}
const dateText = (date) => date ? date.toISOString().slice(0, 10) : '';
export function calculateCashForecast({ settings = {}, rows = [], startupCosts = [], scenario = 'base' } = {}) {
  const assumptions = scenarioSettings(settings, scenario);
  const start = dateValue(settings.forecastStartDate);
  let balance = assumptions.openingCash;
  const periods = [];
  for (let index = 1; index <= 13; index += 1) {
    const matches = rows.filter((row) => numberInput(row.week) === index);
    const row = matches.length === 1 ? matches[0] : {};
    const inputs = Object.fromEntries(WEEK_FIELDS.map((key) => [key, numberInput(row[key])]));
    const missing = WEEK_FIELDS.filter((key) => inputs[key] === null).map((key) => issue(`Week ${index}`, key));
    if (matches.length > 1) missing.push(`Week ${index} has duplicate entries; retain one weekly cash record.`);
    if (!start) missing.push('Enter a valid forecast start date in financial settings.');
    const from = start ? new Date(start.getTime() + (index - 1) * 7 * 86400000) : null;
    const to = from ? new Date(from.getTime() + 7 * 86400000) : null;
    const startup = from ? periodStartup(startupCosts, from, to, settings[`${scenarioName(scenario)}StartupCostsReviewed`] === 'yes') : { amount: null, missing: [] };
    missing.push(...startup.missing);
    const inflows = total([inputs.customerReceipts, inputs.otherInflows]);
    let outflows = total([inputs.jobPayments, inputs.overheadPayments, inputs.compensationPayments, inputs.marketingPayments, inputs.otherPayments, startup.amount]);
    if (matches.length > 1) outflows = null;
    const change = minus(inflows, outflows);
    const openingCash = balance;
    balance = total([balance, change]);
    periods.push({ week: index, id: row.id, startDate: dateText(from), endDate: to ? dateText(new Date(to.getTime() - 86400000)) : '', inputs, startup: startup.amount, inflows, outflows, change, openingCash, closingCash: balance, missing });
  }
  const knownBalances = periods.map((row) => row.closingCash).filter((value) => value !== null);
  return { periods, closingCash: balance, openingCash: assumptions.openingCash, minimumCash: knownBalances.length === 13 ? Math.min(assumptions.openingCash, ...knownBalances) : null, complete: start !== null && assumptions.openingCash !== null && periods.every((row) => row.missing.length === 0 && row.closingCash !== null), missingPeriods: periods.filter((row) => row.missing.length).length };
}
export function calculateOperatingForecast({ settings = {}, rows = [], jobs = [], startupCosts = [], scenario = 'base' } = {}) {
  const assumptions = scenarioSettings(settings, scenario);
  const start = dateValue(settings.forecastStartDate);
  const fixedCashCosts = total([assumptions.monthlyOverhead, assumptions.monthlyCompensation, assumptions.monthlyMarketing]);
  const fixedOwnerTime = mul(assumptions.monthlyUnpaidOwnerHours, assumptions.unpaidOwnerHourlyValue);
  const jobMap = new Map(jobs.map((job) => [job.id, calculateJob(job)]));
  let balance = assumptions.openingCash;
  const periods = [];
  for (let index = 1; index <= 12; index += 1) {
    const lines = rows.filter((row) => numberInput(row.month) === index);
    const missing = [];
    if (!lines.length) missing.push(`Month ${index}: add a forecast row. Enter zero jobs and zero cash when appropriate.`);
    const from = start ? (index === 1 ? start : new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + index - 1, 1))) : null;
    const to = start ? new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + index, 1)) : null;
    if (!start) missing.push('Enter a valid forecast start date in financial settings.');
    const startup = from ? periodStartup(startupCosts, from, to, settings[`${scenarioName(scenario)}StartupCostsReviewed`] === 'yes') : { amount: null, missing: [] };
    missing.push(...startup.missing);
    const calculated = lines.map((line) => {
      const inputs = Object.fromEntries(MONTH_FIELDS.map((key) => [key, numberInput(line[key])]));
      MONTH_FIELDS.filter((key) => inputs[key] === null).forEach((key) => missing.push(issue(`Month ${index}: ${line.title || 'service line'}`, key)));
      const model = jobMap.get(line.jobModelId);
      if (inputs.units !== 0 && model) model.missing.forEach((field) => missing.push(`Month ${index}: complete ${FINANCE_LABELS[field] || field} in service model ${model.title}.`));
      if (inputs.units !== 0 && !model) missing.push(`Month ${index}: select a service/job model for positive planned jobs.`);
      const amount = (key) => inputs.units === 0 ? 0 : model ? mul(inputs.units, model[key]) : null;
      return { id: line.id, inputs, revenue: amount('salePrice'), grossProfit: amount('grossProfit'), directCost: amount('directCashCost'), ownerTimeValue: amount('ownerTimeValue') };
    });
    const sum = (pick) => lines.length ? total(calculated.map(pick)) : null;
    const revenue = sum((line) => line.revenue);
    const grossProfit = sum((line) => line.grossProfit);
    const directCost = sum((line) => line.directCost);
    const ownerTimeValue = total([sum((line) => line.ownerTimeValue), fixedOwnerTime]);
    const operatingProfit = minus(minus(revenue, directCost), fixedCashCosts);
    const economicProfit = minus(operatingProfit, ownerTimeValue);
    const collections = sum((line) => line.inputs.customerCollections);
    const inflows = total([collections, sum((line) => line.inputs.otherInflows)]);
    const cashOutflows = total([sum((line) => line.inputs.jobPayments), sum((line) => line.inputs.otherPayments), fixedCashCosts, startup.amount]);
    const openingCash = balance;
    balance = total([balance, minus(inflows, cashOutflows)]);
    periods.push({ month: index, startDate: dateText(from), endDate: to ? dateText(new Date(to.getTime() - 86400000)) : '', lines: calculated, revenue, grossProfit, directCost, fixedCashCosts, ownerTimeValue, operatingProfit, economicProfit, collections, inflows, cashOutflows, startup: startup.amount, openingCash, closingCash: balance, missing });
  }
  return { periods, revenue: total(periods.map((row) => row.revenue)), operatingProfit: total(periods.map((row) => row.operatingProfit)), economicProfit: total(periods.map((row) => row.economicProfit)), collections: total(periods.map((row) => row.collections)), closingCash: balance, complete: start !== null && assumptions.openingCash !== null && fixedCashCosts !== null && fixedOwnerTime !== null && periods.every((row) => row.missing.length === 0 && row.economicProfit !== null && row.closingCash !== null) };
}
export function validateFinanceRecord(type, row = {}) {
  const errors = [];
  let numeric = [];
  if (type === 'finance-settings') {
    numeric = ['base', 'downside'].flatMap((prefix) => SETTING_FIELDS.map((field) => `${prefix}${field[0].toUpperCase()}${field.slice(1)}`));
    if (row.forecastStartDate && !dateValue(row.forecastStartDate)) errors.push('Enter a valid forecast opening date.');
  } else {
    if (!['base', 'downside'].includes(row.scenario)) errors.push('Choose the base or downside scenario.');
    if (type === 'job-model') numeric = ['salePrice', ...JOB_COST_FIELDS, 'unpaidOwnerHours', 'unpaidOwnerHourlyValue', 'mixWeight'];
    if (type === 'startup-cost') {
      numeric = ['amount'];
      if (row.paymentDate && !dateValue(row.paymentDate)) errors.push('Enter a valid startup payment date.');
    }
    if (type === 'cash-week') {
      numeric = WEEK_FIELDS;
      if (!Number.isInteger(numberInput(row.week)) || numberInput(row.week) < 1 || numberInput(row.week) > 13) errors.push('Choose a whole week from 1 through 13.');
    }
    if (type === 'operating-month') {
      numeric = MONTH_FIELDS;
      if (!Number.isInteger(numberInput(row.month)) || numberInput(row.month) < 1 || numberInput(row.month) > 12) errors.push('Choose a whole month from 1 through 12.');
      if (numberInput(row.units) > 0 && !row.jobModelId) errors.push('Choose a service/job model for planned jobs, or enter 0 jobs.');
    }
  }
  for (const field of numeric) {
    if (row[field] !== null && row[field] !== undefined && (typeof row[field] !== 'string' || row[field].trim() !== '') && numberInput(row[field]) === null) errors.push(`${field} must be a nonnegative finite number, or blank when unknown.`);
  }
  return errors;
}

export function calculateFinance({ settings = {}, jobs = [], startupCosts = [], cashWeeks = [], operatingMonths = [] } = {}, scenario = 'base') {
  const key = scenarioName(scenario);
  const filter = (rows) => rows.filter((row) => row.scenario === key);
  const assumptions = scenarioSettings(settings, key);
  const serviceModels = filter(jobs).map(calculateJob);
  const active = serviceModels.filter((job) => job.mixWeight !== null && job.mixWeight > 0);
  const weightsKnown = serviceModels.length > 0 && serviceModels.every((job) => job.mixWeight !== null);
  const weightTotal = weightsKnown ? total(active.map((job) => job.mixWeight)) : null;
  const weighted = (field) => weightTotal > 0 && active.every((job) => job[field] !== null) ? finite(active.reduce((sum, job) => sum + job[field] * (job.mixWeight / weightTotal), 0)) : null;
  const fixedCashCosts = total([assumptions.monthlyOverhead, assumptions.monthlyCompensation, assumptions.monthlyMarketing]);
  const fixedEconomicCosts = total([fixedCashCosts, mul(assumptions.monthlyUnpaidOwnerHours, assumptions.unpaidOwnerHourlyValue)]);
  const startups = filter(startupCosts);
  const startupBudget = settings[`${key}StartupCostsReviewed`] === 'yes' ? total(startups.map((row) => numberInput(row.amount))) : null;
  const issues = SETTING_FIELDS.filter((field) => assumptions[field] === null).map((field) => `Missing ${key} assumption: ${FINANCE_LABELS[field] || field}.`);
  if (settings[`${key}StartupCostsReviewed`] !== 'yes') issues.push('Review and confirm the startup-cost list in financial settings.');
  if (!weightsKnown || weightTotal <= 0) issues.push('Enter a nonnegative mix weight for each service; at least one must be positive for break-even.');
  const jobSummary = { weightTotal, averageSale: weighted('salePrice'), cashContribution: weighted('cashContribution'), economicContribution: weighted('economicContribution'), fixedCashCosts, fixedEconomicCosts };
  return { scenario: key, settings: assumptions, jobs: serviceModels, jobSummary, startupBudget, issues,
    breakEven: calculateBreakEven(fixedCashCosts, jobSummary.cashContribution), economicBreakEven: calculateBreakEven(fixedEconomicCosts, jobSummary.economicContribution),
    cash: calculateCashForecast({ settings, rows: filter(cashWeeks), startupCosts: startups, scenario: key }),
    operating: calculateOperatingForecast({ settings, rows: filter(operatingMonths), jobs: filter(jobs), startupCosts: startups, scenario: key }),
  };
}
